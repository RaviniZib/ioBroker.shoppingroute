import * as utils from '@iobroker/adapter-core';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as https from 'node:https';

declare const require: any;
declare const module: any;

import type {
    AdapterConfigShape,
    AlexaListItem,
    MarketConfig,
    ProductConfig,
    ProductGroupConfig,
    ReviewItemConfig,
    RouteConfig,
    ShoppingListConfig,
} from './lib/model';
import { AlexaDirectClient, toAlexaListItems, type Alexa2NativeAuth } from './lib/alexa-direct';
import { emptyTrafficMetrics, normalizeTrafficMetrics, type TrafficMetrics } from './lib/metrics';
import {
    activeItems,
    applyReviewActions,
    collectUnknownItems,
    mergeReviewQueue,
    mergeUnknownProducts,
} from './lib/sorter';
import { findProduct, parseItem, suggestAliases } from './lib/parser';
import { isMarketHeader, realActiveItems } from './lib/market-plan';
import {
    buildPrefixTargets,
    createPrefixSortPlan,
    expectedValues,
    stripSortPrefix,
    verifyPrefixResult,
    type PrefixSortPlan,
} from './lib/prefix-sort';
import { buildMarketProfiles, exportConfig, importMarketProfile, normalizeRoutesForAdmin, parseConfigImport } from './lib/config-tools';
import { emptyUsageStatistics, normalizeUsageStatistics, recordAddedItem, type UsageStatistics } from './lib/statistics';
import {
    beginDirectApply,
    collectDirectInput,
    createDirectSortLifecycle,
    finishDirectApply,
    type DirectSortPhase,
} from './lib/direct-sort-lifecycle';

const VERSION = '0.3.2';
const COLLECT_WINDOW_MS = 5000;
const MAX_ACTIVE_ITEMS = 99;
const OWN_REFRESH_MAX_MS = 30000;
const DEFAULT_CATEGORIES = [
    'Obst/Gemüse',
    'Tee/Kaffee',
    'Brot/Gebäck',
    'Schokolade/Naschen',
    'Fleisch/Fisch',
    'Wurst/Salate/Teigwaren',
    'Milchprodukte',
    'Haushalt/Hygiene',
    'Nonfood',
    'Konserven',
    'H-Milch/Nudeln',
    'Kosmetikartikel',
    'Getränke',
    'TK-Produkte',
    'Sonstiges',
];

interface OwnApplyObservation {
    baselineOriginals: Map<string, string>;
    deletedIds: Set<string>;
    createdOriginalCounts: Map<string, number>;
    expectedOriginalCounts: Map<string, number>;
    expiresAt: number;
}

interface ListApplyState {
    phase: DirectSortPhase;
    timer?: ioBroker.Timeout;
    firstEventAt: number;
    lastExternalAt: number;
    requestedAt: number;
    newIds: Set<string>;
    externalDirty: boolean;
    lastSnapshot?: Map<string, string>;
    lastItems?: AlexaListItem[];
    ownObservation?: OwnApplyObservation;
}

interface DirectApplyRuntime {
    listName: string;
    requestedAt: number;
    startedAt: number;
    externalNewItems: number;
    putRequests: number;
    deleteRequests: number;
    batchCreateItems: number;
    amazonRequests: number;
    amazonMs: number;
    fallback: boolean;
    rebuildFrom: number | null;
}

interface DirectApplyJournal {
    version: 2;
    listName: string;
    listId: string;
    startedAt: string;
    status: 'applying' | 'failed';
    expectedValues: string[];
    deletedIds: string[];
    updatesConfirmed: number;
    deletesConfirmed: number;
    batchCreateConfirmed: boolean;
}

function itemSnapshot(items: AlexaListItem[]): Map<string, string> {
    return new Map(activeItems(items).map(item => [String(item.id), stripSortPrefix(item.value)]));
}

function countValues(values: Iterable<string>): Map<string, number> {
    const counts = new Map<string, number>();
    for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
    return counts;
}

function mapsEqual(left: Map<string, number>, right: Map<string, number>): boolean {
    if (left.size !== right.size) return false;
    for (const [key, value] of left) if (right.get(key) !== value) return false;
    return true;
}

export class ShoppingRoute extends utils.Adapter {
    private versionTimer: ioBroker.Interval | null | undefined = null;
    private listStates = new Map<string, ListApplyState>();
    private applyingListName = '';
    private directClient: AlexaDirectClient | null = null;
    private directClientPromise: Promise<AlexaDirectClient> | null = null;
    private directListIds = new Map<string, string>();
    private runtimeProducts: ProductConfig[] = [];
    private runtimeReviews: ReviewItemConfig[] = [];
    private runtimeRoutes: RouteConfig[] = [];
    private productsDirty = false;
    private reviewsDirty = false;
    private routesDirty = false;
    private compatibilityTesting = false;
    private isUnloading = false;
    private traffic: TrafficMetrics = emptyTrafficMetrics();
    private statistics: UsageStatistics = emptyUsageStatistics();
    private knownActiveIds = new Map<string, Set<string>>();
    private activeCountByList = new Map<string, number>();
    private writeTimestamps: number[] = [];
    private temporaryPriorityMarket = '';
    private alexa2Version = 'unbekannt';
    private alexaRemote2Version = 'unbekannt';
    private compatibilityDetail = 'Direkte Alexa-Session noch nicht initialisiert.';
    private lastCompatibilityTest = 'Noch nicht ausgeführt.';
    private latestBetaVersion = '';
    private lastVersionCheck = '';

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({ ...options, name: 'shoppingroute' });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    private get cfg(): AdapterConfigShape { return this.config; }
    private get alexaInstance(): string { return String(this.cfg.alexaInstance || 'alexa2.0').trim() || 'alexa2.0'; }
    private get listConfigs(): ShoppingListConfig[] {
        const configured = Array.isArray(this.cfg.lists)
            ? this.cfg.lists.filter(item => item && item.name && item.enabled !== false)
            : [];
        return configured.length
            ? configured
            : [{ name: String(this.cfg.listName || 'SHOP').trim() || 'SHOP', enabled: true, priorityMarket: '' }];
    }
    private listStateId(listName: string): string { return `${this.alexaInstance}.Lists.${listName}.json`; }
    private get markets(): MarketConfig[] {
        return (Array.isArray(this.cfg.markets) ? this.cfg.markets : []).filter(market => market?.name && market.enabled !== false);
    }
    private get routes(): RouteConfig[] {
        return this.runtimeRoutes.length ? this.runtimeRoutes : (Array.isArray(this.cfg.routes) ? this.cfg.routes.filter(Boolean) : []);
    }
    private get productGroups(): ProductGroupConfig[] {
        const configured = Array.isArray(this.cfg.productGroups) ? this.cfg.productGroups : [];
        const source = configured.length ? configured : DEFAULT_CATEGORIES.map(name => ({ name }));
        const seen = new Set<string>();
        return source.map(entry => ({ name: String(entry?.name || '').trim() })).filter(entry => {
            const key = entry.name.toLocaleLowerCase('de');
            if (!entry.name || seen.has(key)) return false;
            seen.add(key);
            return true;
        }).sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));
    }
    private get products(): ProductConfig[] { return this.runtimeProducts.filter(product => product?.name); }
    private get fallbackMarket(): string { return String(this.cfg.fallbackMarket || 'Ohne Markt').trim() || 'Ohne Markt'; }
    private get priorityMarket(): string { return String(this.cfg.priorityMarket || '').trim(); }
    private priorityMarketForList(listName: string): string {
        if (this.temporaryPriorityMarket) return this.temporaryPriorityMarket;
        const list = this.listConfigs.find(entry => entry.name === listName);
        return String(list?.priorityMarket || this.priorityMarket || '').trim();
    }
    private get learningMode(): 'automatic' | 'review' | 'off' {
        const configured = String(this.cfg.learningMode || '').trim();
        if (configured === 'automatic' || configured === 'review' || configured === 'off') return configured;
        return this.cfg.autoLearnProducts === false ? 'off' : 'automatic';
    }
    private get dryRun(): boolean { return this.cfg.dryRun !== false; }
    private get apiSafeMode(): boolean { return this.cfg.apiSafeMode !== false; }
    private get maxWritesPerMinute(): number { return Math.max(1, Number(this.cfg.maxWritesPerMinute) || 20); }
    private get marketHeadersEnabled(): boolean { return this.cfg.marketHeaders === true; }
    private get minimumItemsPerMarket(): number { return Math.max(1, Math.floor(Number(this.cfg.minItemsPerMarket) || 1)); }

    private getListState(listName: string): ListApplyState {
        let state = this.listStates.get(listName);
        if (!state) {
            state = { ...createDirectSortLifecycle() };
            this.listStates.set(listName, state);
        }
        return state;
    }

    private async onReady(): Promise<void> {
        this.runtimeProducts = (Array.isArray(this.cfg.products) ? this.cfg.products : [])
            .filter(product => product?.name).map(product => ({ ...product }))
            .sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));
        this.runtimeReviews = (Array.isArray(this.cfg.reviewItems) ? this.cfg.reviewItems : []).map(item => ({ ...item }));
        this.runtimeRoutes = normalizeRoutesForAdmin(Array.isArray(this.cfg.routes) ? this.cfg.routes.filter(Boolean) : []);
        this.routesDirty = JSON.stringify(this.runtimeRoutes) !== JSON.stringify(Array.isArray(this.cfg.routes) ? this.cfg.routes : []);
        await this.loadTrafficMetrics();
        await this.loadStatistics();

        const reviewResult = applyReviewActions(this.runtimeProducts, this.runtimeReviews);
        if (reviewResult.accepted.length) {
            this.runtimeProducts = reviewResult.products;
            this.runtimeReviews = reviewResult.remainingReviews;
            this.productsDirty = true;
            this.reviewsDirty = true;
            this.statistics.reviewAccepted += reviewResult.accepted.length;
            await this.persistStatistics();
        }
        await this.ensureProductGroupsConfig();
        await this.updateTemporaryMarketStateOptions();
        await this.persistRuntimeConfig();
        await this.setStateAsync('info.connection', false, true);
        await this.setStateAsync('info.versionInstalled', VERSION, true);
        for (const id of ['sortNow', 'compatibilityTest', 'resetTrafficStats', 'resetStatistics', 'exportConfig', 'refreshFeedbackReport', 'clearTemporaryPriorityMarket']) {
            await this.setStateAsync(`control.${id}`, false, true);
        }
        const enabled = await this.getStateAsync('control.enabled');
        if (!enabled) await this.setStateAsync('control.enabled', true, true);
        const temp = await this.getStateAsync('control.temporaryPriorityMarket');
        const tempRaw = String(temp?.val ?? this.cfg.temporaryPriorityMarket ?? '').trim();
        this.temporaryPriorityMarket = tempRaw === '__none__' ? '' : tempRaw;
        await this.setStateAsync('control.temporaryPriorityMarket', this.temporaryPriorityMarket || '__none__', true);

        this.subscribeStates('control.*');
        for (const list of this.listConfigs) this.subscribeForeignStates(this.listStateId(list.name));
        let stateConnected = false;
        for (const list of this.listConfigs) {
            const state = await this.getForeignStateAsync(this.listStateId(list.name));
            const parsed = this.parseListState(state?.val);
            if (!parsed) {
                this.log.warn(`Alexa-Liste nicht gefunden: ${this.listStateId(list.name)}`);
                continue;
            }
            stateConnected = true;
            this.getListState(list.name).lastSnapshot = itemSnapshot(parsed);
            this.getListState(list.name).lastItems = parsed.map(item => ({ ...item }));
            this.knownActiveIds.set(list.name, new Set(activeItems(parsed).map(item => String(item.id))));
            this.activeCountByList.set(list.name, realActiveItems(this.prefixFreeItems(parsed), this.markets).length);
        }
        await this.updateActiveItemCount();
        if (!stateConnected) {
            await this.setError(`Keine der konfigurierten Alexa-Listen ist lesbar: ${this.listConfigs.map(item => item.name).join(', ')}`);
            return;
        }

        try {
            await this.initializeDirectClient();
            await this.setStateAsync('info.connection', true, true);
        } catch (error) {
            await this.setError(`Direkte Alexa-Verbindung fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
            return;
        }
        if (!(await this.recoverDirectApplyJournal())) return;
        await this.setStateAsync('info.lastError', '', true);
        await this.refreshExports();
        await this.checkNpmVersion();
        await this.updateFeedbackReport();
        this.versionTimer = this.setInterval(() => void this.checkNpmVersion(), 6 * 60 * 60 * 1000);
        this.log.warn(`ShoppingRoute ${VERSION} BETA: Dry-Run ist für Ersttests ausdrücklich empfohlen.`);
        this.log.info('WICHTIG: Die Alexa-App muss für jede verwaltete Liste auf alphabetische Sortierung A–Z gestellt sein.');
        this.log.info('Direkt-Sortierung: sichtbare Präfixe [00]–[99]; Alexa2-Listenstates dienen nur noch als externe Triggerquelle.');
        this.scheduleAll(COLLECT_WINDOW_MS);
    }

    private async discoverAlexaLists(instanceName = this.alexaInstance): Promise<string[]> {
        const instance = String(instanceName || this.alexaInstance).trim() || this.alexaInstance;
        const prefix = `${instance}.Lists.`;
        const suffix = '.json';
        const names = new Set<string>();
        try {
            const objects = await (this as any).getForeignObjectsAsync(`${instance}.Lists.*.json`, 'state') as Record<string, unknown> | undefined;
            for (const id of Object.keys(objects || {})) {
                if (!id.startsWith(prefix) || !id.endsWith(suffix)) continue;
                const name = id.slice(prefix.length, -suffix.length).trim();
                if (name && !name.includes('.')) names.add(name);
            }
        } catch (error) {
            this.log.debug(`Alexa-Listen konnten für ${instance} nicht gelesen werden: ${String(error)}`);
        }
        for (const list of this.listConfigs) if (list.name) names.add(String(list.name).trim());
        return [...names].filter(Boolean).sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
    }

    private async onMessage(obj: { command: string; from: string; callback?: any; message?: any }): Promise<void> {
        if (!obj?.callback) return;
        if (obj.command === 'markAllReviewItemsAccept') {
            const supplied = obj.message?.native && typeof obj.message.native === 'object'
                ? { ...(obj.message.native as Record<string, unknown>) }
                : { ...(this.cfg as unknown as Record<string, unknown>) };
            const rows = Array.isArray((supplied as any).reviewItems) ? (supplied as any).reviewItems : this.runtimeReviews;
            const updatedReviewItems = rows.map((item: any) => ({
                ...item,
                availableMarkets: Array.isArray(item?.availableMarkets)
                    ? item.availableMarkets.map((value: unknown) => typeof value === 'string' ? value.trim() : '').filter(Boolean).join(',')
                    : String(item?.availableMarkets || ''),
                action: 'accept',
            }));
            this.sendTo(obj.from, obj.command, { native: { reviewItems: updatedReviewItems } }, obj.callback);
            return;
        }
        if (obj.command === 'normalizeMarketSelection') {
            const values = Array.isArray(obj.message?.value) ? obj.message.value : String(obj.message?.value || '').split(/[;,]/);
            const result: string[] = [];
            const seen = new Set<string>();
            for (const value of values) {
                if (typeof value !== 'string') continue;
                const trimmed = value.trim();
                const key = trimmed.toLocaleLowerCase('de');
                if (!trimmed || seen.has(key)) continue;
                seen.add(key);
                result.push(trimmed);
            }
            this.sendTo(obj.from, obj.command, result, obj.callback);
            return;
        }
        if (obj.command === 'getBackupUiUrl') {
            this.sendTo(obj.from, obj.command, {
                openUrl: `./adapter/shoppingroute/backup-transfer.html?instance=${encodeURIComponent(this.namespace)}`,
                window: 'shoppingrouteBackup',
            }, obj.callback);
            return;
        }
        if (obj.command === 'getProductGroups') {
            const source = Array.isArray(obj.message?.productGroups)
                ? obj.message.productGroups.map((group: any) => ({ name: String(group?.name || '').trim() })).filter((group: { name: string }) => group.name)
                : this.productGroups;
            this.sendTo(obj.from, obj.command, source.map((group: { name: string }) => ({ value: group.name, label: group.name }))
                .sort((a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label, 'de', { sensitivity: 'base' })), obj.callback);
            return;
        }
        if (obj.command === 'getMarkets' || obj.command === 'getMarketsOptional' || obj.command === 'getActiveMarkets') {
            const supplied = Array.isArray(obj.message?.markets)
                ? obj.message.markets.map((market: any) => ({ name: String(market?.name || '').trim(), enabled: market?.enabled !== false })).filter((market: { name: string }) => market.name)
                : this.markets;
            const source = obj.command === 'getActiveMarkets' ? supplied.filter((market: { enabled?: boolean }) => market.enabled !== false) : supplied;
            const options = source.map((market: { name: string }) => ({ value: market.name, label: market.name }))
                .sort((a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label, 'de', { sensitivity: 'base' }));
            if (obj.command === 'getMarketsOptional') options.unshift({ value: '', label: '—' });
            this.sendTo(obj.from, obj.command, options, obj.callback);
            return;
        }
        if (obj.command === 'getAlexaLists' || obj.command === 'getLists') {
            const instance = String(obj.message?.alexaInstance || this.alexaInstance).trim() || this.alexaInstance;
            const lists = await this.discoverAlexaLists(instance);
            this.sendTo(obj.from, obj.command, lists.map(name => ({ value: name, label: name })), obj.callback);
        }
    }

    private async onStateChange(id: string, state: { val: unknown; ack: boolean } | null | undefined): Promise<void> {
        if (!state || this.isUnloading) return;
        const local = `${this.namespace}.`;
        if (id === `${local}control.sortNow` && !state.ack && state.val === true) {
            await this.setStateAsync('control.sortNow', false, true);
            this.scheduleAll(0);
            return;
        }
        if (id === `${local}control.compatibilityTest` && !state.ack && state.val === true) {
            await this.setStateAsync('control.compatibilityTest', false, true);
            await this.runLiveCompatibilityTest();
            return;
        }
        if (id === `${local}control.resetTrafficStats` && !state.ack && state.val === true) {
            await this.setStateAsync('control.resetTrafficStats', false, true);
            this.traffic = emptyTrafficMetrics();
            await this.persistTrafficMetrics();
            return;
        }
        if (id === `${local}control.resetStatistics` && !state.ack && state.val === true) {
            await this.setStateAsync('control.resetStatistics', false, true);
            this.statistics = emptyUsageStatistics();
            await this.persistStatistics();
            return;
        }
        if (id === `${local}control.exportConfig` && !state.ack && state.val === true) {
            await this.setStateAsync('control.exportConfig', false, true);
            await this.refreshExports();
            return;
        }
        if (id === `${local}control.refreshFeedbackReport` && !state.ack && state.val === true) {
            await this.setStateAsync('control.refreshFeedbackReport', false, true);
            await this.updateFeedbackReport();
            return;
        }
        if (id === `${local}control.clearTemporaryPriorityMarket` && !state.ack && state.val === true) {
            await this.setStateAsync('control.clearTemporaryPriorityMarket', false, true);
            this.temporaryPriorityMarket = '';
            await this.setStateAsync('control.temporaryPriorityMarket', '__none__', true);
            this.scheduleAll(COLLECT_WINDOW_MS);
            return;
        }
        if (id === `${local}control.temporaryPriorityMarket` && !state.ack) {
            const selected = typeof state.val === 'string' ? state.val.trim() : '';
            this.temporaryPriorityMarket = selected === '__none__' ? '' : selected;
            await this.setStateAsync('control.temporaryPriorityMarket', this.temporaryPriorityMarket || '__none__', true);
            this.scheduleAll(COLLECT_WINDOW_MS);
            return;
        }
        if (id === `${local}control.importConfigJson` && !state.ack && typeof state.val === 'string' && state.val.trim()) {
            try {
                const imported = parseConfigImport(state.val);
                await this.setStateAsync('control.importConfigJson', '', true);
                await this.updateConfig(imported as Record<string, unknown>);
            } catch (error) {
                await this.setStateAsync('control.importConfigJson', '', true);
                await this.setError(`Konfigurationsimport fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
            }
            return;
        }
        if (id === `${local}control.marketProfileImport` && !state.ack && typeof state.val === 'string' && state.val.trim()) {
            try {
                const imported = importMarketProfile(state.val, this.markets, this.routes);
                await this.setStateAsync('control.marketProfileImport', '', true);
                await this.updateConfig({ markets: imported.markets, routes: imported.routes } as Record<string, unknown>);
            } catch (error) {
                await this.setStateAsync('control.marketProfileImport', '', true);
                await this.setError(`Marktprofil-Import fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
            }
            return;
        }
        if (id === `${local}control.enabled` && !state.ack) {
            await this.setStateAsync('control.enabled', Boolean(state.val), true);
            if (state.val === true) this.scheduleAll(COLLECT_WINDOW_MS);
            return;
        }
        const list = this.listConfigs.find(entry => id === this.listStateId(entry.name));
        if (list) {
            await this.setStateAsync('info.connection', true, true);
            if (!this.compatibilityTesting) this.observeListState(list.name, state.val);
        }
    }

    private onUnload(callback: () => void): void {
        this.isUnloading = true;
        for (const state of this.listStates.values()) if (state.timer) this.clearTimeout(state.timer);
        this.listStates.clear();
        if (this.versionTimer) this.clearInterval(this.versionTimer);
        this.versionTimer = null;
        this.directClient?.close();
        void this.setStateAsync('info.connection', false, true).catch(() => undefined).finally(callback);
    }

    private parseListState(rawValue: unknown): AlexaListItem[] | undefined {
        if (typeof rawValue !== 'string' || !rawValue.trim()) return undefined;
        try {
            const parsed: unknown = JSON.parse(rawValue);
            return Array.isArray(parsed) ? parsed as AlexaListItem[] : undefined;
        } catch { return undefined; }
    }

    private prefixFreeItems(items: AlexaListItem[]): AlexaListItem[] {
        return items.map(item => ({ ...item, value: stripSortPrefix(item.value) }));
    }

    private isOwnRefresh(state: ListApplyState, current: Map<string, string>, now: number): boolean {
        const own = state.ownObservation;
        if (!own || now > own.expiresAt) {
            state.ownObservation = undefined;
            return false;
        }
        const newCounts = new Map(own.createdOriginalCounts);
        for (const [id, value] of current) {
            const baseline = own.baselineOriginals.get(id);
            if (baseline !== undefined) {
                if (baseline !== value) return false;
                continue;
            }
            const remaining = newCounts.get(value) || 0;
            if (remaining < 1) return false;
            newCounts.set(value, remaining - 1);
        }
        for (const id of own.baselineOriginals.keys()) {
            if (!current.has(id) && !own.deletedIds.has(id)) return false;
        }
        const currentCounts = countValues(current.values());
        if (mapsEqual(currentCounts, own.expectedOriginalCounts)) {
            state.lastSnapshot = new Map(current);
            state.ownObservation = undefined;
        }
        return true;
    }

    private observeListState(listName: string, rawValue: unknown, observedAt = Date.now()): void {
        const items = this.parseListState(rawValue);
        if (!items) return;
        const current = itemSnapshot(items);
        const state = this.getListState(listName);
        if (this.isOwnRefresh(state, current, observedAt)) return;
        const previous = state.lastSnapshot;
        if (previous && previous.size === current.size && [...current].every(([id, value]) => previous.get(id) === value)) return;
        const addedIds = previous ? [...current.keys()].filter(id => !previous.has(id)) : [];
        state.lastSnapshot = current;
        state.lastItems = items.map(item => ({ ...item }));
        const collected = collectDirectInput(state, observedAt, addedIds, COLLECT_WINDOW_MS);
        Object.assign(state, collected.lifecycle);
        if (state.phase !== 'APPLYING') this.armCollectionDeadline(listName, state, collected.deadline);
    }

    private armCollectionDeadline(listName: string, state: ListApplyState, deadline: number): void {
        if (state.timer) this.clearTimeout(state.timer);
        const delay = Math.max(0, deadline - Date.now());
        state.timer = this.setTimeout(() => {
            state.timer = undefined;
            void this.startApply(listName);
        }, delay);
    }

    private scheduleAll(delay: number): void {
        if (this.isUnloading) return;
        const now = Date.now();
        for (const list of this.listConfigs) {
            const state = this.getListState(list.name);
            if (state.phase === 'APPLYING') {
                Object.assign(state, collectDirectInput(state, now, [], COLLECT_WINDOW_MS).lifecycle);
                continue;
            }
            const collected = collectDirectInput(state, now, [], delay);
            Object.assign(state, collected.lifecycle);
            this.armCollectionDeadline(list.name, state, delay === 0 ? now : collected.deadline);
        }
    }

    private async startApply(listName: string): Promise<void> {
        const state = this.getListState(listName);
        if (this.isUnloading || state.phase !== 'COLLECTING') return;
        if (this.applyingListName) {
            // The active list's finally block arms every other collected list exactly once.
            return;
        }
        if (!(await this.isEnabled())) {
            state.phase = 'IDLE';
            return;
        }
        Object.assign(state, beginDirectApply(state));
        this.applyingListName = listName;
        const runtime: DirectApplyRuntime = {
            listName,
            requestedAt: state.requestedAt || Date.now(),
            startedAt: Date.now(),
            externalNewItems: state.newIds.size,
            putRequests: 0,
            deleteRequests: 0,
            batchCreateItems: 0,
            amazonRequests: 0,
            amazonMs: 0,
            fallback: false,
            rebuildFrom: null,
        };
        try {
            await this.applyDirectSort(listName, state, runtime);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await this.activateDirectSafetyStop(listName, message);
        } finally {
            this.applyingListName = '';
            if (state.externalDirty && !this.isUnloading) {
                const followup = finishDirectApply(state, Date.now());
                if (followup) {
                    Object.assign(state, followup.lifecycle);
                    this.armCollectionDeadline(listName, state, followup.deadline);
                }
            } else {
                state.phase = 'IDLE';
                state.firstEventAt = 0;
                state.requestedAt = 0;
                state.newIds.clear();
            }
            this.logDirectRuntime(runtime);
            for (const [otherName, other] of this.listStates) {
                if (otherName !== listName && other.phase === 'COLLECTING' && !other.timer) {
                    this.armCollectionDeadline(otherName, other, other.firstEventAt + COLLECT_WINDOW_MS);
                }
            }
            try {
                await this.persistRuntimeConfig();
                await this.refreshExports();
                await this.updateFeedbackReport();
            } catch { /* diagnostics must not start another apply */ }
        }
    }

    private async isEnabled(): Promise<boolean> {
        const state = await this.getStateAsync('control.enabled');
        return !state || state.val !== false;
    }

    private async initializeDirectClient(): Promise<AlexaDirectClient> {
        if (this.directClient) return this.directClient;
        if (this.directClientPromise) return this.directClientPromise;
        this.directClientPromise = (async () => {
            const object = await this.getForeignObjectAsync(`system.adapter.${this.alexaInstance}`);
            if (!object) throw new Error(`Alexa2-Instanzobjekt system.adapter.${this.alexaInstance} fehlt.`);
            const native = (object.native || {}) as Alexa2NativeAuth;
            const version = (object.common as { version?: unknown } | undefined)?.version;
            this.alexa2Version = typeof version === 'string' || typeof version === 'number' ? String(version) : 'unbekannt';
            const client = await AlexaDirectClient.connect(native);
            this.directClient = client;
            this.compatibilityDetail = 'Direkte alexa-remote2-Session mit lokaler Alexa2-Authentifizierung ist bereit.';
            try {
                const resolved = require.resolve('alexa-remote2');
                this.alexaRemote2Version = this.findPackageVersion(resolved, 'alexa-remote2');
            } catch { this.alexaRemote2Version = 'über Alexa2 bereitgestellt'; }
            await this.refreshDirectListIds();
            await this.updateCompatibilityDiagnostics();
            return client;
        })().finally(() => { this.directClientPromise = null; });
        return this.directClientPromise;
    }

    private async refreshDirectListIds(): Promise<void> {
        const client = this.directClient;
        if (!client) return;
        const lists = await client.getLists();
        this.directListIds.clear();
        for (const list of lists) this.directListIds.set(list.name.toLocaleLowerCase('de'), list.listId);
    }

    private async directListId(listName: string, runtime?: DirectApplyRuntime): Promise<string> {
        const client = await this.initializeDirectClient();
        let listId = this.directListIds.get(listName.toLocaleLowerCase('de'));
        if (!listId) {
            await this.amazonCall(runtime, () => this.refreshDirectListIds());
            listId = this.directListIds.get(listName.toLocaleLowerCase('de'));
        }
        if (!client || !listId) throw new Error(`Amazon-Listen-ID für „${listName}“ wurde nicht gefunden.`);
        return listId;
    }

    private async amazonCall<T>(runtime: DirectApplyRuntime | undefined, operation: () => Promise<T>): Promise<T> {
        const started = Date.now();
        if (runtime) runtime.amazonRequests += 1;
        try { return await operation(); }
        finally { if (runtime) runtime.amazonMs += Date.now() - started; }
    }

    private async readDirectItems(listId: string, runtime?: DirectApplyRuntime): Promise<AlexaListItem[]> {
        const client = await this.initializeDirectClient();
        return toAlexaListItems(await this.amazonCall(runtime, () => client.getItems(listId)));
    }

    private async applyDirectSort(listName: string, state: ListApplyState, runtime: DirectApplyRuntime): Promise<void> {
        await this.ensureTrafficDay();
        this.traffic.localChecks += 1;
        await this.persistTrafficMetrics();
        const listId = await this.directListId(listName, runtime);
        // A direct planning snapshot supplies the current Amazon versions; the Alexa2 state remains trigger-only.
        const snapshot = await this.readDirectItems(listId, runtime);
        if (activeItems(snapshot).length > MAX_ACTIVE_ITEMS) throw new Error(`${listName}: mehr als 99 aktive Einträge.`);
        const logical = this.prefixFreeItems(snapshot);
        await this.recordNewItems(listName, logical);
        await this.updateLearningAndDiagnostics(listName, logical);
        const priority = this.priorityMarketForList(listName);
        const desired = buildPrefixTargets(
            snapshot,
            this.markets,
            this.routes,
            this.products,
            this.fallbackMarket,
            priority,
            this.minimumItemsPerMarket,
            this.marketHeadersEnabled,
        );
        const plan = createPrefixSortPlan(snapshot, desired);
        runtime.fallback = plan.fallback;
        runtime.rebuildFrom = plan.rebuildFrom;
        const operationCount = plan.updates.length + plan.deletes.length + (plan.creates.length ? 1 : 0);
        this.traffic.plannedChanges += plan.updates.length + plan.deletes.length + plan.creates.length;
        await this.persistTrafficMetrics();
        await this.setStateAsync('info.lastPlan', JSON.stringify({ listName, architecture: 'direct-prefix-v1', plan }, null, 2), true);
        await this.setStateAsync('info.preview', JSON.stringify({
            listName,
            fallback: plan.fallback,
            rebuildFrom: plan.rebuildFrom,
            updates: plan.updates,
            deletes: plan.deletes,
            creates: plan.creates,
            desired: expectedValues(plan),
        }, null, 2), true);
        await this.setStateAsync('info.previewText', this.prefixPreviewText(listName, plan), true);
        if (!operationCount) {
            await this.setStateAsync('info.lastSort', `${new Date().toISOString()} – ${listName}: bereits präfixsortiert (${desired.length} aktiv)`, true);
            await this.setStateAsync('info.lastError', '', true);
            state.lastSnapshot = itemSnapshot(snapshot);
            state.lastItems = snapshot.map(item => ({ ...item }));
            return;
        }
        if (this.dryRun) {
            await this.setStateAsync('info.lastSort', `${new Date().toISOString()} – ${listName} Dry-Run: ${operationCount} Amazon-Request(s) geplant`, true);
            await this.setStateAsync('info.lastError', '', true);
            return;
        }
        if (state.externalDirty) {
            this.log.info(`${listName}: Direkter Präfixplan wurde vor dem ersten Write durch externe Änderung verworfen.`);
            return;
        }

        this.traffic.sortRuns += 1;
        this.traffic.lastSortRun = new Date().toISOString();
        await this.persistTrafficMetrics();
        const journal: DirectApplyJournal = {
            version: 2,
            listName,
            listId,
            startedAt: new Date().toISOString(),
            status: 'applying',
            expectedValues: expectedValues(plan),
            deletedIds: plan.deletes.map(entry => entry.id),
            updatesConfirmed: 0,
            deletesConfirmed: 0,
            batchCreateConfirmed: plan.creates.length === 0,
        };
        await this.persistDirectJournal(journal);
        state.ownObservation = this.buildOwnObservation(snapshot, plan);

        const client = await this.initializeDirectClient();
        for (const update of plan.updates) {
            await this.beforeDirectWrite();
            await this.amazonCall(runtime, () => client.updateItem(listId, update.id, update.version, update.to));
            runtime.putRequests += 1;
            journal.updatesConfirmed += 1;
            await this.recordDirectWrite();
            await this.persistDirectJournal(journal);
        }
        for (const deletion of plan.deletes) {
            await this.beforeDirectWrite();
            await this.amazonCall(runtime, () => client.deleteItem(listId, deletion.id, deletion.version));
            runtime.deleteRequests += 1;
            journal.deletesConfirmed += 1;
            await this.recordDirectWrite();
            await this.persistDirectJournal(journal);
        }
        if (plan.creates.length) {
            await this.beforeDirectWrite();
            await this.amazonCall(runtime, () => client.batchCreate(listId, plan.creates.map(create => create.value)));
            runtime.batchCreateItems = plan.creates.length;
            journal.batchCreateConfirmed = true;
            await this.recordDirectWrite();
            await this.persistDirectJournal(journal);
        }

        // Exactly one direct control read after all writes; Alexa2 states are intentionally not part of confirmation.
        const verifiedItems = await this.readDirectItems(listId, runtime);
        const verification = verifyPrefixResult(verifiedItems, plan, state.externalDirty);
        if (!verification.ok) throw new Error(`${listName}: direkte Abschlussprüfung fehlgeschlagen: ${verification.reason}`);
        await this.clearDirectJournal();
        state.lastSnapshot = itemSnapshot(verifiedItems);
        state.lastItems = verifiedItems.map(item => ({ ...item }));
        state.ownObservation = this.buildOwnObservation(snapshot, plan);
        this.activeCountByList.set(listName, realActiveItems(this.prefixFreeItems(verifiedItems), this.markets).length);
        await this.updateActiveItemCount();
        await this.setStateAsync('info.lastSort', `${new Date().toISOString()} – ${listName}: Präfixsortierung direkt bestätigt`, true);
        await this.setStateAsync('info.lastError', '', true);
    }

    private buildOwnObservation(snapshot: AlexaListItem[], plan: PrefixSortPlan): OwnApplyObservation {
        const baselineOriginals = itemSnapshot(snapshot);
        const createdOriginalCounts = countValues(plan.creates.map(create => create.originalText));
        const expectedOriginalCounts = countValues(expectedValues(plan).map(stripSortPrefix));
        return {
            baselineOriginals,
            deletedIds: new Set(plan.deletes.map(entry => entry.id)),
            createdOriginalCounts,
            expectedOriginalCounts,
            expiresAt: Date.now() + OWN_REFRESH_MAX_MS,
        };
    }

    private prefixPreviewText(listName: string, plan: PrefixSortPlan): string {
        return [
            `Liste: ${listName}`,
            `Direkte Präfixsortierung: ${plan.fallback ? `Fallback ab Position ${(plan.rebuildFrom || 0) + 1}` : 'inkrementell'}`,
            `PUT: ${plan.updates.length}, DELETE: ${plan.deletes.length}, Batch-CREATE: ${plan.creates.length}`,
            ...expectedValues(plan).map((value, index) => `${String(index + 1).padStart(2, '0')}. ${value}`),
        ].join('\n');
    }

    private async beforeDirectWrite(): Promise<void> {
        if (this.isUnloading) throw new Error('Direkter Alexa-Write wegen Adapter-Shutdown abgebrochen.');
        if (!this.apiSafeMode) return;
        while (true) {
            const now = Date.now();
            this.writeTimestamps = this.writeTimestamps.filter(timestamp => now - timestamp < 60000);
            if (this.writeTimestamps.length < this.maxWritesPerMinute) return;
            const waitMs = Math.max(500, 60000 - (now - this.writeTimestamps[0]) + 100);
            this.log.info(`API-Schonmodus: Request-Limit ${this.maxWritesPerMinute}/Minute erreicht, Pause ${waitMs} ms.`);
            await this.wait(waitMs);
            if (this.isUnloading) throw new Error('Direkter Alexa-Write während API-Pause abgebrochen.');
        }
    }

    private async recordDirectWrite(): Promise<void> {
        this.writeTimestamps.push(Date.now());
        this.traffic.alexaWrites += 1;
        this.traffic.lastAlexaWrite = new Date().toISOString();
        await this.persistTrafficMetrics();
    }

    private async activateDirectSafetyStop(listName: string, reason: string): Promise<void> {
        if (this.isUnloading) return;
        this.traffic.abortedRuns += 1;
        await this.persistTrafficMetrics();
        try {
            const state = await this.getStateAsync('info.sortTransaction');
            if (typeof state?.val === 'string' && state.val.trim() && state.val !== '{}') {
                const journal = JSON.parse(state.val) as DirectApplyJournal;
                journal.status = 'failed';
                await this.persistDirectJournal(journal);
            }
        } catch { /* preserve the last journal payload */ }
        await this.setStateAsync('control.enabled', false, true);
        const message = `${listName}: ${reason} SICHERHEITSSTOPP: weitere direkte Writes sind deaktiviert; kein automatischer Retry.`;
        await this.setError(message);
        this.log.error(message);
    }

    private async persistDirectJournal(journal: DirectApplyJournal): Promise<void> {
        await this.setStateAsync('info.sortTransaction', JSON.stringify(journal), true);
    }

    private async clearDirectJournal(): Promise<void> {
        if (this.isUnloading) return;
        await this.setStateAsync('info.sortTransaction', '{}', true);
    }

    private async recoverDirectApplyJournal(): Promise<boolean> {
        const state = await this.getStateAsync('info.sortTransaction');
        const raw = typeof state?.val === 'string' ? state.val.trim() : '';
        if (!raw || raw === '{}') return true;
        let journal: DirectApplyJournal;
        try { journal = JSON.parse(raw) as DirectApplyJournal; }
        catch {
            await this.activateDirectSafetyStop('unbekannt', 'Persistentes Apply-Journal ist nicht lesbar.');
            return false;
        }
        if (journal.version !== 2) {
            await this.activateDirectSafetyStop(journal.listName || 'unbekannt', 'Alte unterbrochene Marker-Transaktion gefunden; automatische Präfixmigration bleibt gesperrt.');
            return false;
        }
        try {
            const items = await this.readDirectItems(journal.listId);
            const activeValues = activeItems(items).map(item => String(item.value).trim()).sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
            const expected = [...journal.expectedValues];
            const ids = new Set(activeItems(items).map(item => String(item.id)));
            const exact = activeValues.length === expected.length && activeValues.every((value, index) => value === expected[index]);
            const deletedGone = journal.deletedIds.every(id => !ids.has(id));
            if (exact && deletedGone) {
                await this.clearDirectJournal();
                this.log.info(`${journal.listName}: unterbrochener Direkt-Apply war remote vollständig abgeschlossen; Journal bereinigt.`);
                return true;
            }
            await this.activateDirectSafetyStop(journal.listName, 'Unterbrochener Direkt-Apply ist remote nicht vollständig; Journal bleibt erhalten.');
            return false;
        } catch (error) {
            await this.activateDirectSafetyStop(journal.listName, `Recovery-Kontrollabruf fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    private logDirectRuntime(runtime: DirectApplyRuntime): void {
        const totalMs = Date.now() - runtime.startedAt;
        const waitedMs = Math.max(0, runtime.startedAt - runtime.requestedAt);
        this.log.info(
            `${runtime.listName} SHOP Direkt-Sortierung: externe neue Artikel ${runtime.externalNewItems} | ` +
            `Debounce ${waitedMs} ms | PUTs ${runtime.putRequests} | DELETEs ${runtime.deleteRequests} | ` +
            `Batch-CREATE-Items ${runtime.batchCreateItems} | Amazon-Requests ${runtime.amazonRequests} | ` +
            `Amazon ${runtime.amazonMs} ms | gesamt ${totalMs} ms | Fallback ${runtime.fallback ? 'ja' : 'nein'} | ` +
            `Rebuild ab ${runtime.rebuildFrom === null ? '–' : runtime.rebuildFrom + 1}`,
        );
    }

    private async updateLearningAndDiagnostics(listName: string, list: AlexaListItem[]): Promise<void> {
        const priority = this.priorityMarketForList(listName);
        let unknown = collectUnknownItems(list, this.markets, this.products, this.fallbackMarket, priority);
        if (this.learningMode === 'automatic') {
            const merged = mergeUnknownProducts(list, this.markets, this.products, this.fallbackMarket, priority);
            if (merged.learned.length) {
                this.runtimeProducts = merged.products;
                this.productsDirty = true;
                this.statistics.automaticLearned += merged.learned.length;
                await this.persistStatistics();
                await this.setStateAsync('info.lastLearnedItems', JSON.stringify(merged.learned, null, 2), true);
                unknown = collectUnknownItems(list, this.markets, this.products, this.fallbackMarket, priority);
            }
        } else if (this.learningMode === 'review') {
            const before = JSON.stringify(this.runtimeReviews);
            this.runtimeReviews = mergeReviewQueue(this.runtimeReviews, unknown);
            if (JSON.stringify(this.runtimeReviews) !== before) this.reviewsDirty = true;
        }
        await this.setStateAsync('info.unknownItems', JSON.stringify({ listName, items: unknown }, null, 2), true);
        await this.setStateAsync('info.reviewQueue', JSON.stringify(this.runtimeReviews, null, 2), true);
        await this.updateAliasSuggestions(list);
    }

    private async updateAliasSuggestions(list: AlexaListItem[]): Promise<void> {
        if (this.cfg.autoAliasSuggestions === false) {
            await this.setStateAsync('info.aliasSuggestions', '[]', true);
            return;
        }
        const suggestions: Array<{ product: string; alias: string }> = [];
        for (const item of activeItems(this.prefixFreeItems(list))) {
            if (isMarketHeader(item.value, this.markets)) continue;
            const parsed = parseItem(item.value, this.markets, this.products, this.fallbackMarket, this.priorityMarket);
            const product = findProduct(parsed.productText, this.products);
            if (!product) continue;
            for (const alias of suggestAliases(parsed.productText, product)) suggestions.push({ product: product.name, alias });
        }
        const unique = [...new Map(suggestions.map(entry => [`${entry.product}|${entry.alias}`.toLocaleLowerCase('de'), entry])).values()];
        await this.setStateAsync('info.aliasSuggestions', JSON.stringify(unique, null, 2), true);
    }

    private async recordNewItems(listName: string, list: AlexaListItem[]): Promise<void> {
        const currentItems = activeItems(this.prefixFreeItems(list));
        const previous = this.knownActiveIds.get(listName);
        const current = new Set(currentItems.map(item => String(item.id)));
        if (!previous) {
            this.knownActiveIds.set(listName, current);
            return;
        }
        for (const item of currentItems) {
            if (previous.has(String(item.id)) || isMarketHeader(item.value, this.markets)) continue;
            const parsed = parseItem(item.value, this.markets, this.products, this.fallbackMarket, this.priorityMarketForList(listName));
            this.statistics = recordAddedItem(this.statistics, listName, parsed);
        }
        this.knownActiveIds.set(listName, current);
        await this.persistStatistics();
    }

    private async updateActiveItemCount(): Promise<void> {
        const total = [...this.activeCountByList.values()].reduce((sum, value) => sum + value, 0);
        await this.setStateAsync('info.activeItems', total, true);
        await this.setStateAsync('info.activeItemsByList', JSON.stringify(Object.fromEntries(this.activeCountByList), null, 2), true);
    }

    private findPackageVersion(moduleFile: string, expectedName: string): string {
        let current = path.dirname(moduleFile);
        for (let level = 0; level < 6; level++) {
            try {
                const parsed = JSON.parse(fs.readFileSync(path.join(current, 'package.json'), 'utf8')) as { name?: string; version?: string };
                if (parsed.name === expectedName && parsed.version) return parsed.version;
            } catch { /* continue */ }
            const parent = path.dirname(current);
            if (parent === current) break;
            current = parent;
        }
        return 'unbekannt';
    }

    private async runLiveCompatibilityTest(): Promise<void> {
        if (this.isUnloading || this.compatibilityTesting || this.applyingListName) return;
        this.compatibilityTesting = true;
        try {
            const listName = this.listConfigs[0]?.name;
            if (!listName) throw new Error('Keine aktive Alexa-Liste konfiguriert.');
            const listId = await this.directListId(listName);
            const items = await this.readDirectItems(listId);
            this.compatibilityDetail = 'Direkter Kontrollabruf über die lokale Alexa2-Authentifizierung war erfolgreich; kein Test-Write nötig.';
            this.lastCompatibilityTest = `${new Date().toISOString()} – ERFOLG, ${items.length} Items gelesen`;
            await this.setStateAsync('info.lastError', '', true);
        } catch (error) {
            this.compatibilityDetail = `Direkter Kontrollabruf fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`;
            this.lastCompatibilityTest = `${new Date().toISOString()} – FEHLER`;
            await this.setError(this.compatibilityDetail);
        } finally {
            this.compatibilityTesting = false;
            await this.updateCompatibilityDiagnostics();
        }
    }

    private async updateCompatibilityDiagnostics(): Promise<void> {
        const ready = Boolean(this.directClient);
        await this.setStateAsync('info.writeCapability', ready ? 'direct-ok' : 'direct-unavailable', true);
        await this.setStateAsync('info.lastCompatibilityTest', this.lastCompatibilityTest, true);
        await this.setStateAsync('info.compatibility', JSON.stringify({
            shoppingrouteVersion: VERSION,
            beta: true,
            alexaInstance: this.alexaInstance,
            alexa2Version: this.alexa2Version,
            alexaRemote2Version: this.alexaRemote2Version,
            lists: this.listConfigs.map(item => item.name),
            dryRun: this.dryRun,
            writeCapability: ready ? 'direct-ok' : 'direct-unavailable',
            detail: this.compatibilityDetail,
            lastCompatibilityTest: this.lastCompatibilityTest,
            requiredAlexaAppSorting: 'Alphabetisch A–Z',
            checkedAt: new Date().toISOString(),
        }, null, 2), true);
    }

    private async updateTemporaryMarketStateOptions(): Promise<void> {
        try {
            const states: Record<string, string> = { __none__: '— Kein Markt —' };
            for (const market of [...this.markets].sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }))) states[market.name] = market.name;
            await this.extendObjectAsync('control.temporaryPriorityMarket', { common: { states } });
        } catch (error) { this.log.warn(`Temporäre Markt-Auswahlliste konnte nicht aktualisiert werden: ${String(error)}`); }
    }

    private async ensureProductGroupsConfig(): Promise<void> {
        if (Array.isArray(this.cfg.productGroups) && this.cfg.productGroups.length) return;
        try { await this.updateConfig({ productGroups: DEFAULT_CATEGORIES.map(name => ({ name })) } as Record<string, unknown>); }
        catch (error) { this.log.warn(`Produktgruppen konnten nicht initialisiert werden: ${String(error)}`); }
    }

    private async persistRuntimeConfig(): Promise<void> {
        if (!this.productsDirty && !this.reviewsDirty && !this.routesDirty) return;
        try {
            const instanceId = `system.adapter.${this.namespace}`;
            const object = await this.getForeignObjectAsync(instanceId);
            if (!object) throw new Error(`Instanzobjekt nicht gefunden: ${instanceId}`);
            object.native = {
                ...((object.native || {}) as Record<string, unknown>),
                ...(this.productsDirty ? { products: this.runtimeProducts.map(product => ({ ...product })) } : {}),
                ...(this.reviewsDirty ? { reviewItems: this.runtimeReviews.map(item => ({ ...item })) } : {}),
                ...(this.routesDirty ? { routes: this.runtimeRoutes.map(route => ({ ...route })) } : {}),
            };
            await this.setForeignObjectAsync(instanceId, object);
            this.productsDirty = false;
            this.reviewsDirty = false;
            this.routesDirty = false;
        } catch (error) { await this.setError(`Lern-/Konfigurationsdaten konnten nicht gespeichert werden: ${String(error)}`); }
    }

    private async refreshExports(): Promise<void> {
        const cfg = { ...(this.cfg as unknown as Record<string, unknown>), products: this.runtimeProducts, routes: this.routes, reviewItems: this.runtimeReviews } as AdapterConfigShape;
        await this.setStateAsync('info.configExport', JSON.stringify(exportConfig(cfg, VERSION), null, 2), true);
        await this.setStateAsync('info.marketProfiles', JSON.stringify(buildMarketProfiles(this.markets, this.routes), null, 2), true);
    }

    private async loadTrafficMetrics(): Promise<void> {
        try {
            const state = await this.getStateAsync('info.traffic');
            this.traffic = normalizeTrafficMetrics(state && typeof state.val === 'string' && state.val.trim() ? JSON.parse(state.val) : null);
        } catch { this.traffic = emptyTrafficMetrics(); }
        await this.persistTrafficMetrics();
    }

    private async ensureTrafficDay(): Promise<void> {
        const normalized = normalizeTrafficMetrics(this.traffic);
        if (normalized.date !== this.traffic.date) {
            this.traffic = normalized;
            await this.persistTrafficMetrics();
        }
    }

    private async persistTrafficMetrics(): Promise<void> {
        this.traffic = normalizeTrafficMetrics(this.traffic);
        await this.setStateAsync('info.localChecksToday', this.traffic.localChecks, true);
        await this.setStateAsync('info.plannedChangesToday', this.traffic.plannedChanges, true);
        await this.setStateAsync('info.sortRunsToday', this.traffic.sortRuns, true);
        await this.setStateAsync('info.alexaWritesToday', this.traffic.alexaWrites, true);
        await this.setStateAsync('info.compatibilityWritesToday', this.traffic.compatibilityWrites, true);
        await this.setStateAsync('info.abortedRunsToday', this.traffic.abortedRuns, true);
        await this.setStateAsync('info.traffic', JSON.stringify({ ...this.traffic, note: 'Zählt Operationen, keine Netzwerk-Bytes.' }, null, 2), true);
    }

    private async loadStatistics(): Promise<void> {
        try {
            const state = await this.getStateAsync('info.statistics');
            this.statistics = normalizeUsageStatistics(state && typeof state.val === 'string' && state.val.trim() ? JSON.parse(state.val) : null);
        } catch { this.statistics = emptyUsageStatistics(); }
        await this.persistStatistics();
    }

    private async persistStatistics(): Promise<void> {
        this.statistics.lastUpdated = new Date().toISOString();
        await this.setStateAsync('info.statistics', JSON.stringify(this.statistics, null, 2), true);
    }

    private async checkNpmVersion(): Promise<void> {
        try {
            const data = await this.httpJson('https://registry.npmjs.org/iobroker.shoppingroute');
            const tags = (data['dist-tags'] || {}) as Record<string, unknown>;
            this.latestBetaVersion = typeof tags.beta === 'string' ? tags.beta : typeof tags.latest === 'string' ? tags.latest : '';
            this.lastVersionCheck = new Date().toISOString();
            await this.setStateAsync('info.versionBeta', this.latestBetaVersion || 'unbekannt', true);
            await this.setStateAsync('info.updateAvailable', Boolean(this.latestBetaVersion && this.latestBetaVersion !== VERSION), true);
            await this.setStateAsync('info.versionCheck', `${this.lastVersionCheck} – npm beta: ${this.latestBetaVersion || 'unbekannt'}`, true);
        } catch (error) {
            this.lastVersionCheck = new Date().toISOString();
            await this.setStateAsync('info.versionCheck', `${this.lastVersionCheck} – npm-Abfrage fehlgeschlagen: ${String(error)}`, true);
        }
        await this.updateFeedbackReport();
    }

    private httpJson(url: string): Promise<Record<string, any>> {
        return new Promise((resolve, reject) => {
            const request = https.get(url, { headers: { 'User-Agent': `ioBroker.shoppingroute/${VERSION}` } }, (response: any) => {
                if ((response.statusCode || 500) >= 400) {
                    response.resume();
                    reject(new Error(`HTTP ${response.statusCode}`));
                    return;
                }
                let data = '';
                response.setEncoding('utf8');
                response.on('data', (chunk: string) => { data += chunk; });
                response.on('end', () => {
                    try { resolve(JSON.parse(data) as Record<string, any>); }
                    catch (error) { reject(error instanceof Error ? error : new Error('Ungültige JSON-Antwort')); }
                });
            });
            request.setTimeout(8000, () => request.destroy(new Error('Timeout')));
            request.on('error', reject);
        });
    }

    private async updateFeedbackReport(): Promise<void> {
        const report = {
            generatedAt: new Date().toISOString(),
            shoppingrouteVersion: VERSION,
            node: process.version,
            alexaInstance: this.alexaInstance,
            alexa2Version: this.alexa2Version,
            alexaRemote2Version: this.alexaRemote2Version,
            lists: this.listConfigs.map(list => ({ name: list.name, activeItems: this.activeCountByList.get(list.name) || 0 })),
            dryRun: this.dryRun,
            learningMode: this.learningMode,
            apiSafeMode: this.apiSafeMode,
            writeCapability: this.directClient ? 'direct-ok' : 'direct-unavailable',
            lastCompatibilityTest: this.lastCompatibilityTest,
            lastError: String((await this.getStateAsync('info.lastError'))?.val || ''),
            traffic: this.traffic,
            update: { installed: VERSION, npmBeta: this.latestBetaVersion || 'unbekannt', checkedAt: this.lastVersionCheck || 'noch nicht' },
            privacy: 'Produktnamen, Einkaufslistentexte, Aliase, Cookies und komplette Konfiguration sind nicht enthalten.',
        };
        await this.setStateAsync('info.feedbackReport', JSON.stringify(report, null, 2), true);
    }

    private async setError(message: string): Promise<void> { await this.setStateAsync('info.lastError', message, true); }
    private wait(ms: number): Promise<void> { return new Promise(resolve => this.setTimeout(resolve, ms)); }
    public static getDefaultCategories(): string[] { return [...DEFAULT_CATEGORIES]; }
}

if (require.main !== module) module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new ShoppingRoute(options);
else (() => new ShoppingRoute())();
