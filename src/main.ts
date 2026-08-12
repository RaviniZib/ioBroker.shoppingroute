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
import { canWriteAlexa, inspectAlexaRemoteSource, type WriteCapability } from './lib/compatibility';
import { emptyTrafficMetrics, normalizeTrafficMetrics, type TrafficMetrics } from './lib/metrics';
import {
    activeItems,
    activeSnapshotHasConflict,
    compareActiveSnapshot,
    applyReviewActions,
    collectUnknownItems,
    createSortPlan,
    makePreviewText,
    mergeReviewQueue,
    mergeUnknownProducts,
    sortSlotsOldestFirst,
} from './lib/sorter';
import {
    createBufferedSortMarker,
    createBufferedSortProgram,
    createVisibleOrderMarker,
    createVisibleOrderRefreshPlan,
    createVisibleOrderTouchProgram,
    sortIdsByAlexaUpdatedTime,
    type BufferedSortStep,
} from './lib/buffered-sort';
import { findProduct, parseItem, suggestAliases } from './lib/parser';
import {
    isMarketHeader,
    planMarketHeaderAction,
    realActiveItems,
    requiredMarkets,
    type MarketHeaderAction,
} from './lib/market-plan';
import { buildMarketProfiles, exportConfig, importMarketProfile, normalizeRoutesForAdmin, parseConfigImport } from './lib/config-tools';
import { emptyUsageStatistics, normalizeUsageStatistics, recordAddedItem, type UsageStatistics } from './lib/statistics';
import { waitForConfirmation, type ConfirmationResult } from './lib/confirmation-wait';
import {
    classifyAlexaWriteConfirmation,
    type AlexaWriteSnapshot,
} from './lib/alexa-write-confirmation';
import {
    isAlexaWriteReady,
    type AlexaWriteReadinessSnapshot,
} from './lib/alexa-write-readiness';

const VERSION = '0.3.2';
const LIST_STABILITY_MS = 5000;
const ALEXA_CONFIRMATION_TIMEOUT_MS = 10000;
const ALEXA_CONFIRMATION_POLL_MS = 100;
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


interface SortTransactionJournal {
    version: 1;
    transactionId: string;
    listName: string;
    marker: string;
    startedAt: string;
    status: 'applying' | 'rollback' | 'failed-applying' | 'failed-rollback';
    originalValues: Record<string, string>;
    targetValues: Record<string, string>;
    steps: BufferedSortStep[];
    confirmedSteps: number;
}

export class ShoppingRoute extends utils.Adapter {
    private sortTimer: ioBroker.Timeout | null | undefined = null;
    private versionTimer: ioBroker.Interval | null | undefined = null;
    private pendingLists = new Set<string>();
    private sortingListName = '';
    private listChangedDuringSort = false;
    private runtimeProducts: ProductConfig[] = [];
    private runtimeReviews: ReviewItemConfig[] = [];
    private productsDirty = false;
    private reviewsDirty = false;
    private routesDirty = false;
    private runtimeRoutes: RouteConfig[] = [];
    private compatibilityTesting = false;
    private writeCapability: WriteCapability = 'unknown';
    private compatibilityDetail = 'Noch nicht geprüft.';
    private alexa2Version = 'unbekannt';
    private alexaRemote2Version = 'unbekannt';
    private lastCompatibilityTest = 'Noch nicht ausgeführt.';
    private traffic: TrafficMetrics = emptyTrafficMetrics();
    private statistics: UsageStatistics = emptyUsageStatistics();
    private knownActiveIds = new Map<string, Set<string>>();
    private activeCountByList = new Map<string, number>();
    private writeTimestamps: number[] = [];
    private temporaryPriorityMarket = '';
    private latestBetaVersion = '';
    private lastVersionCheck = '';

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({ ...options, name: 'shoppingroute' });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    private get cfg(): AdapterConfigShape {
        return this.config;
    }

    private get alexaInstance(): string {
        return String(this.cfg.alexaInstance || 'alexa2.0').trim() || 'alexa2.0';
    }

    private get listConfigs(): ShoppingListConfig[] {
        const configured = Array.isArray(this.cfg.lists)
            ? this.cfg.lists.filter(item => item && item.name && item.enabled !== false)
            : [];
        if (configured.length > 0) return configured;
        return [{ name: String(this.cfg.listName || 'SHOP').trim() || 'SHOP', enabled: true, priorityMarket: '' }];
    }

    private listStateId(listName: string): string {
        return `${this.alexaInstance}.Lists.${listName}.json`;
    }

    private get markets(): MarketConfig[] {
        const configured = Array.isArray(this.cfg.markets) ? this.cfg.markets : [];
        return configured.filter(market => market && market.name && market.enabled !== false);
    }

    private get routes(): RouteConfig[] {
        return this.runtimeRoutes.length ? this.runtimeRoutes : (Array.isArray(this.cfg.routes) ? this.cfg.routes.filter(Boolean) : []);
    }

    private get productGroups(): ProductGroupConfig[] {
        const configured = Array.isArray(this.cfg.productGroups) ? this.cfg.productGroups : [];
        const source = configured.length > 0 ? configured : DEFAULT_CATEGORIES.map(name => ({ name }));
        const seen = new Set<string>();
        const result: ProductGroupConfig[] = [];
        for (const entry of source) {
            const name = String(entry?.name || '').trim();
            const key = name.toLocaleLowerCase('de');
            if (!name || seen.has(key)) continue;
            seen.add(key);
            result.push({ name });
        }
        return result.sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));
    }

    private get products(): ProductConfig[] {
        return this.runtimeProducts.filter(product => product && product.name);
    }

    private get fallbackMarket(): string {
        return String(this.cfg.fallbackMarket || 'Ohne Markt').trim() || 'Ohne Markt';
    }

    private get priorityMarket(): string {
        return String(this.cfg.priorityMarket || '').trim();
    }

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

    private get debounceMs(): number { return Math.max(250, Number(this.cfg.debounceMs) || 5000); }
    private get sortStabilityDelayMs(): number { return Math.max(this.debounceMs, LIST_STABILITY_MS); }
    private get writePauseMs(): number { return Math.max(250, Number(this.cfg.writePauseMs) || 1000); }
    private get dryRun(): boolean { return this.cfg.dryRun !== false; }
    private get apiSafeMode(): boolean { return this.cfg.apiSafeMode !== false; }
    private get maxWritesPerMinute(): number { return Math.max(1, Number(this.cfg.maxWritesPerMinute) || 20); }
    private get batchSize(): number { return Math.max(1, Number(this.cfg.batchSize) || 10); }
    private get batchPauseMs(): number { return Math.max(0, Number(this.cfg.batchPauseMs) || 5000); }
    private get maxWriteRetries(): number { return Math.max(0, Math.min(5, Number(this.cfg.maxWriteRetries) || 2)); }
    private get retryBaseMs(): number { return Math.max(250, Number(this.cfg.retryBaseMs) || 1500); }
    private get marketHeadersEnabled(): boolean { return this.cfg.marketHeaders === true; }
    private get minimumItemsPerMarket(): number { return Math.max(1, Math.floor(Number(this.cfg.minItemsPerMarket) || 1)); }

    private async onReady(): Promise<void> {
        this.runtimeProducts = (Array.isArray(this.cfg.products) ? this.cfg.products : [])
            .filter(product => product && product.name)
            .map(product => ({ ...product }))
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
            this.log.info(`Aus der Prüfliste übernommen: ${reviewResult.accepted.map(item => `„${item.name}“`).join(', ')}.`);
        }

        await this.ensureProductGroupsConfig();
        await this.updateTemporaryMarketStateOptions();
        await this.persistRuntimeConfig();

        await this.setStateAsync('info.connection', false, true);
        await this.setStateAsync('info.lastError', '', true);
        await this.setStateAsync('info.versionInstalled', VERSION, true);
        await this.setStateAsync('control.sortNow', false, true);
        await this.setStateAsync('control.compatibilityTest', false, true);
        await this.setStateAsync('control.resetTrafficStats', false, true);
        await this.setStateAsync('control.resetStatistics', false, true);
        await this.setStateAsync('control.exportConfig', false, true);
        await this.setStateAsync('control.refreshFeedbackReport', false, true);
        await this.setStateAsync('control.clearTemporaryPriorityMarket', false, true);

        const enabled = await this.getStateAsync('control.enabled');
        if (!enabled) await this.setStateAsync('control.enabled', true, true);
        const temp = await this.getStateAsync('control.temporaryPriorityMarket');
        const tempRaw = String(temp?.val ?? this.cfg.temporaryPriorityMarket ?? '').trim();
        this.temporaryPriorityMarket = tempRaw === '__none__' ? '' : tempRaw;
        await this.setStateAsync('control.temporaryPriorityMarket', this.temporaryPriorityMarket || '__none__', true);

        this.subscribeStates('control.*');
        for (const list of this.listConfigs) this.subscribeForeignStates(this.listStateId(list.name));

        let connected = false;
        for (const list of this.listConfigs) {
            const listState = await this.getForeignStateAsync(this.listStateId(list.name));
            if (!listState || typeof listState.val !== 'string') {
                this.log.warn(`Alexa-Liste nicht gefunden: ${this.listStateId(list.name)}`);
                continue;
            }
            connected = true;
            try {
                const parsed = JSON.parse(listState.val) as AlexaListItem[];
                const listItems = Array.isArray(parsed) ? parsed : [];
                const active = activeItems(listItems);
                const realActive = realActiveItems(listItems, this.markets);
                this.knownActiveIds.set(list.name, new Set(active.map(item => String(item.id))));
                this.activeCountByList.set(list.name, realActive.length);
            } catch {
                this.knownActiveIds.set(list.name, new Set());
            }
        }
        await this.setStateAsync('info.connection', connected, true);
        await this.updateActiveItemCount();

        if (!connected) {
            await this.setError(`Keine der konfigurierten Alexa-Listen ist lesbar: ${this.listConfigs.map(item => item.name).join(', ')}`);
            return;
        }

        await this.runStartupCompatibilityCheck();
        await this.recoverInterruptedSortTransaction();
        await this.refreshExports();
        await this.checkNpmVersion();
        await this.updateFeedbackReport();
        this.versionTimer = this.setInterval(() => void this.checkNpmVersion(), 6 * 60 * 60 * 1000);

        this.log.warn(`ShoppingRoute ${VERSION} BETA: Dry-Run ist für Ersttests ausdrücklich empfohlen.`);
        this.log.info(`Listen: ${this.listConfigs.map(item => item.name).join(', ')}. Lernmodus: ${this.learningMode}.`);
        this.log.info('WICHTIG: Die Alexa-App muss für jede verwaltete Liste auf „Älteste bis neueste“ gestellt sein.');
        this.log.info(`Synchronisationsschutz: Sortierschreibzugriffe starten erst nach mindestens ${this.sortStabilityDelayMs} ms ohne Listenänderung.`);
        this.scheduleAll(this.sortStabilityDelayMs);
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
            this.log.debug(`Alexa-Listen konnten für ${instance} nicht automatisch gelesen werden: ${String(error)}`);
        }
        // Keep already configured names available as a fallback, e.g. while Alexa2 is reconnecting.
        for (const list of this.listConfigs) if (list.name) names.add(String(list.name).trim());
        return [...names].filter(Boolean).sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
    }

    private async onMessage(obj: { command: string; from: string; callback?: any; message?: any }): Promise<void> {
        if (!obj || !obj.callback) return;
        if (obj.command === 'markAllReviewItemsAccept') {
            const supplied = obj.message?.native && typeof obj.message.native === 'object'
                ? { ...(obj.message.native as Record<string, unknown>) }
                : { ...(this.cfg as unknown as Record<string, unknown>) };
            const rows = Array.isArray((supplied as any).reviewItems)
                ? (supplied as any).reviewItems
                : this.runtimeReviews;
            const updatedReviewItems = rows.map((item: any) => ({
                ...item,
                availableMarkets: Array.isArray(item?.availableMarkets)
                    ? item.availableMarkets
                        .map((value: unknown) => typeof value === 'string' ? value.trim() : '')
                        .filter(Boolean)
                        .join(',')
                    : String(item?.availableMarkets || ''),
                action: 'accept',
            }));
            this.sendTo(
                obj.from,
                obj.command,
                {
                    native: {
                        reviewItems: updatedReviewItems,
                    },
                },
                obj.callback,
            );
            return;
        }
        if (obj.command === 'normalizeMarketSelection') {
            const raw = obj.message?.value;
            const values = Array.isArray(raw)
                ? raw
                : String(raw || '').split(/[;,]/);
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
            this.sendTo(
                obj.from,
                obj.command,
                {
                    openUrl: `./adapter/shoppingroute/backup-transfer.html?instance=${encodeURIComponent(this.namespace)}`,
                    window: 'shoppingrouteBackup',
                },
                obj.callback,
            );
            return;
        }
        if (obj.command === 'getProductGroups') {
            const suppliedGroups = Array.isArray(obj.message?.productGroups)
                ? obj.message.productGroups
                    .map((group: any) => ({ name: String(group?.name || '').trim() }))
                    .filter((group: { name: string }) => Boolean(group.name))
                : this.productGroups;
            const options = suppliedGroups
                .map((group: { name: string }) => ({ value: group.name, label: group.name }))
                .sort((a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label, 'de', { sensitivity: 'base' }));
            this.sendTo(obj.from, obj.command, options, obj.callback);
            return;
        }
        if (obj.command === 'getMarkets' || obj.command === 'getMarketsOptional' || obj.command === 'getActiveMarkets') {
            const suppliedMarkets = Array.isArray(obj.message?.markets)
                ? obj.message.markets
                    .map((market: any) => ({
                        name: String(market?.name || '').trim(),
                        enabled: market?.enabled !== false,
                    }))
                    .filter((market: { name: string }) => Boolean(market.name))
                : this.markets;
            const sourceMarkets = obj.command === 'getActiveMarkets'
                ? suppliedMarkets.filter((market: { enabled?: boolean }) => market.enabled !== false)
                : suppliedMarkets;
            const options = sourceMarkets
                .map((market: { name: string }) => ({ value: market.name, label: market.name }))
                .sort((a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label, 'de', { sensitivity: 'base' }));
            if (obj.command === 'getMarketsOptional') options.unshift({ value: '', label: '—' });
            this.sendTo(obj.from, obj.command, options, obj.callback);
            return;
        }
        if (obj.command === 'getAlexaLists' || obj.command === 'getLists') {
            const requestedInstance = String(obj.message?.alexaInstance || this.alexaInstance).trim() || this.alexaInstance;
            const lists = await this.discoverAlexaLists(requestedInstance);
            const options = lists.map(name => ({ value: name, label: name }));
            this.sendTo(obj.from, obj.command, options, obj.callback);
        }
    }

    private async onStateChange(id: string, state: { val: unknown; ack: boolean } | null | undefined): Promise<void> {
        if (!state) return;
        const local = `${this.namespace}.`;
        if (id === `${local}control.sortNow` && !state.ack && state.val === true) {
            await this.setStateAsync('control.sortNow', false, true);
            this.scheduleAll(this.sortStabilityDelayMs);
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
            this.scheduleAll(this.sortStabilityDelayMs);
            return;
        }
        if (id === `${local}control.temporaryPriorityMarket` && !state.ack) {
            const selectedMarket = typeof state.val === 'string' ? state.val.trim() : '';
            this.temporaryPriorityMarket = selectedMarket === '__none__' ? '' : selectedMarket;
            await this.setStateAsync('control.temporaryPriorityMarket', this.temporaryPriorityMarket || '__none__', true);
            this.scheduleAll(this.sortStabilityDelayMs);
            return;
        }
        if (id === `${local}control.importConfigJson` && !state.ack && typeof state.val === 'string' && state.val.trim()) {
            try {
                const imported = parseConfigImport(state.val);
                await this.setStateAsync('control.importConfigJson', '', true);
                await this.updateConfig(imported as Record<string, unknown>);
                this.log.info('ShoppingRoute-Konfiguration importiert; Instanz wird durch ioBroker neu gestartet.');
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
                this.log.info(`Marktprofil „${imported.market}“ importiert.`);
            } catch (error) {
                await this.setStateAsync('control.marketProfileImport', '', true);
                await this.setError(`Marktprofil-Import fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
            }
            return;
        }
        if (id === `${local}control.enabled` && !state.ack) {
            await this.setStateAsync('control.enabled', Boolean(state.val), true);
            if (state.val === true) this.scheduleAll(this.sortStabilityDelayMs);
            return;
        }

        const list = this.listConfigs.find(entry => id === this.listStateId(entry.name));
        if (list) {
            await this.setStateAsync('info.connection', true, true);
            if (this.compatibilityTesting) return;
            if (this.sortingListName === list.name) this.listChangedDuringSort = true;
            this.scheduleSort(list.name, this.sortStabilityDelayMs);
        }
    }

    private onUnload(callback: () => void): void {
        if (this.sortTimer) this.clearTimeout(this.sortTimer);
        if (this.versionTimer) this.clearInterval(this.versionTimer);
        void this.setStateAsync('info.connection', false, true)
            .catch(() => undefined)
            .finally(callback);
    }

    private scheduleAll(delay: number): void {
        for (const list of this.listConfigs) this.pendingLists.add(list.name);
        this.armSortTimer(delay);
    }

    private scheduleSort(listName: string, delay: number): void {
        this.pendingLists.add(listName);
        this.armSortTimer(delay);
    }

    private armSortTimer(delay: number): void {
        if (this.sortTimer) this.clearTimeout(this.sortTimer);
        this.sortTimer = this.setTimeout(() => {
            this.sortTimer = null;
            void this.processPendingSorts();
        }, delay);
    }

    private async processPendingSorts(): Promise<void> {
        if (this.sortingListName) return;
        while (this.pendingLists.size > 0) {
            const listName = this.pendingLists.values().next().value;
            if (!listName) break;
            this.pendingLists.delete(listName);
            await this.sortList(listName);
        }
    }

    private async isEnabled(): Promise<boolean> {
        const state = await this.getStateAsync('control.enabled');
        return !state || state.val !== false;
    }

    private async readList(listName: string): Promise<AlexaListItem[]> {
        const stateId = this.listStateId(listName);
        const state = await this.getForeignStateAsync(stateId);
        if (!state || typeof state.val !== 'string' || !state.val.trim()) throw new Error(`Datenpunkt ${stateId} enthält keine lesbare Liste.`);
        const parsed: unknown = JSON.parse(state.val);
        if (!Array.isArray(parsed)) throw new Error(`${stateId} enthält kein JSON-Array.`);
        return parsed as AlexaListItem[];
    }

    private async sortList(listName: string): Promise<void> {
        if (this.sortingListName) {
            this.pendingLists.add(listName);
            return;
        }
        if (!(await this.isEnabled())) return;
        this.sortingListName = listName;
        this.listChangedDuringSort = false;

        await this.ensureTrafficDay();
        this.traffic.localChecks += 1;
        await this.persistTrafficMetrics();

        try {
            const list = await this.readList(listName);
            const active = activeItems(list);
            const realActive = realActiveItems(list, this.markets);
            this.activeCountByList.set(listName, realActive.length);
            await this.updateActiveItemCount();
            await this.recordNewItems(listName, list);

            const priority = this.priorityMarketForList(listName);
            let unknown = collectUnknownItems(list, this.markets, this.products, this.fallbackMarket, priority);

            if (this.learningMode === 'automatic') {
                const merged = mergeUnknownProducts(list, this.markets, this.products, this.fallbackMarket, priority);
                if (merged.learned.length > 0) {
                    this.runtimeProducts = merged.products;
                    this.productsDirty = true;
                    this.statistics.automaticLearned += merged.learned.length;
                    await this.persistStatistics();
                    await this.setStateAsync('info.lastLearnedItems', JSON.stringify(merged.learned, null, 2), true);
                    this.log.info(`Neue Artikel automatisch gelernt: ${merged.learned.map(product => `„${product.name}“`).join(', ')}.`);
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

            const required = requiredMarkets(
                realActive,
                this.markets,
                this.products,
                this.fallbackMarket,
                priority,
                this.minimumItemsPerMarket,
            );
            const headerAction = planMarketHeaderAction(
                list,
                required,
                this.markets,
                this.fallbackMarket,
                this.marketHeadersEnabled,
            );
            if (headerAction) {
                await this.setStateAsync(
                    'info.lastPlan',
                    JSON.stringify({ listName, requiredMarkets: required, headerAction }, null, 2),
                    true,
                );
                if (this.dryRun) {
                    await this.setStateAsync(
                        'info.lastSort',
                        `${new Date().toISOString()} – ${listName} Dry-Run: Marktüberschrift-Aktion ${headerAction.type} für ${headerAction.market} geplant`,
                        true,
                    );
                    await this.setStateAsync('info.lastError', '', true);
                    return;
                }
                if (!canWriteAlexa(this.writeCapability)) {
                    const message = this.writeCapability === 'known-bug'
                        ? 'Alexa-Schreibzugriffe blockiert: bekannte fehlerhafte alexa-remote2 version-Query erkannt.'
                        : this.writeCapability === 'live-failed'
                            ? 'Alexa-Schreibzugriffe blockiert: Kompatibilitätstest fehlgeschlagen.'
                            : 'Alexa-Schreibzugriffe blockiert: Schreibkompatibilität noch nicht bestätigt; control.compatibilityTest ausführen.';
                    await this.setStateAsync('info.lastError', message, true);
                    this.log.error(message);
                    return;
                }
                await this.applyMarketHeaderAction(listName, headerAction);
                await this.setStateAsync(
                    'info.lastSort',
                    `${new Date().toISOString()} – ${listName}: Marktüberschrift ${headerAction.market} aktualisiert`,
                    true,
                );
                await this.setStateAsync('info.lastError', '', true);
                return;
            }

            const plan = createSortPlan(
                list,
                this.markets,
                this.routes,
                this.products,
                this.fallbackMarket,
                priority,
                this.minimumItemsPerMarket,
                this.marketHeadersEnabled,
            );
            await this.setStateAsync('info.lastPlan', JSON.stringify({ listName, plan }, null, 2), true);
            await this.setStateAsync('info.preview', JSON.stringify({ listName, changes: plan.filter(entry => entry.changed), plan }, null, 2), true);
            await this.setStateAsync('info.previewText', makePreviewText(listName, plan), true);

            const changes = plan.filter(entry => entry.changed);
            const now = new Date().toISOString();
            if (changes.length > 0) {
                this.traffic.plannedChanges += changes.length;
                await this.persistTrafficMetrics();
            }
            if (changes.length === 0) {
                const visibleOrderWrites = this.visibleOrderRefreshIds(list, plan);
                if (visibleOrderWrites.length === 0) {
                    await this.setStateAsync('info.lastSort', `${now} – ${listName}: bereits sortiert (${active.length} aktiv)`, true);
                    await this.setStateAsync('info.lastError', '', true);
                    return;
                }

                this.log.info(`${listName}: Inhalte sind sortiert, sichtbare Alexa-Reihenfolge benötigt ${visibleOrderWrites.length} Aktualisierung(en)${this.dryRun ? ' [DRY-RUN]' : ''}.`);
                if (this.dryRun) {
                    await this.setStateAsync(
                        'info.lastSort',
                        `${now} – ${listName} Dry-Run: ${visibleOrderWrites.length} Aktualisierung(en) der sichtbaren Reihenfolge geplant`,
                        true,
                    );
                    await this.setStateAsync('info.lastError', '', true);
                    return;
                }
                if (!canWriteAlexa(this.writeCapability)) {
                    const message = this.writeCapability === 'known-bug'
                        ? 'Alexa-Schreibzugriffe blockiert: bekannte fehlerhafte alexa-remote2 version-Query erkannt.'
                        : this.writeCapability === 'live-failed'
                            ? 'Alexa-Schreibzugriffe blockiert: Kompatibilitätstest fehlgeschlagen.'
                            : 'Alexa-Schreibzugriffe blockiert: Schreibkompatibilität noch nicht bestätigt; control.compatibilityTest ausführen.';
                    await this.setStateAsync('info.lastSort', `${now} – BETA-Sicherheitsblock: keine Alexa-Schreibzugriffe`, true);
                    await this.setStateAsync('info.lastError', message, true);
                    this.log.error(message);
                    return;
                }

                this.traffic.sortRuns += 1;
                this.traffic.lastSortRun = new Date().toISOString();
                await this.persistTrafficMetrics();
                const visibleResult = await this.refreshVisibleAlexaOrder(listName, plan);
                if (visibleResult.interrupted) return;
                await this.setStateAsync(
                    'info.lastSort',
                    `${new Date().toISOString()} – ${listName}: sichtbare Reihenfolge mit ${visibleResult.writes} inhaltsneutralen Schreibzugriff(en) korrigiert, ${active.length} aktiv`,
                    true,
                );
                await this.setStateAsync('info.lastError', '', true);
                return;
            }

            this.log.info(`${listName}: ${active.length} aktive Artikel, ${changes.length} Änderung(en)${this.dryRun ? ' [DRY-RUN]' : ''}.`);
            if (this.dryRun) {
                await this.setStateAsync('info.lastSort', `${now} – ${listName} Dry-Run: ${changes.length} Änderung(en) geplant`, true);
                await this.setStateAsync('info.lastError', '', true);
                return;
            }
            if (!canWriteAlexa(this.writeCapability)) {
                const message = this.writeCapability === 'known-bug'
                    ? 'Alexa-Schreibzugriffe blockiert: bekannte fehlerhafte alexa-remote2 version-Query erkannt.'
                    : this.writeCapability === 'live-failed'
                        ? 'Alexa-Schreibzugriffe blockiert: Kompatibilitätstest fehlgeschlagen.'
                        : 'Alexa-Schreibzugriffe blockiert: Schreibkompatibilität noch nicht bestätigt; control.compatibilityTest ausführen.';
                await this.setStateAsync('info.lastSort', `${now} – BETA-Sicherheitsblock: keine Alexa-Schreibzugriffe`, true);
                await this.setStateAsync('info.lastError', message, true);
                this.log.error(message);
                return;
            }

            this.traffic.sortRuns += 1;
            this.traffic.lastSortRun = new Date().toISOString();
            await this.persistTrafficMetrics();

            const originalSnapshot = active.map(item => ({ ...item }));
            const originalValues = Object.fromEntries(
                originalSnapshot.map(item => [String(item.id), String(item.value || '').trim()]),
            );
            const targetValues = Object.fromEntries(
                plan.map(entry => [String(entry.id), String(entry.to || '').trim()]),
            );
            const expectedValues = new Map<string, string>(Object.entries(originalValues));

            const transactionId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
            const existingValues = [...Object.values(originalValues), ...Object.values(targetValues)];
            let program;
            let marker = '';
            for (let attempt = 0; attempt < 10; attempt++) {
                marker = createBufferedSortMarker(transactionId, attempt, existingValues);
                try {
                    program = createBufferedSortProgram(plan, marker);
                    break;
                } catch (error) {
                    if (!String(error).includes('kollidiert') || attempt === 9) throw error;
                }
            }
            if (!program) throw new Error('Sortierpuffer konnte nicht erzeugt werden.');

            const journal: SortTransactionJournal = {
                version: 1,
                transactionId,
                listName,
                marker,
                startedAt: new Date().toISOString(),
                status: 'applying',
                originalValues,
                targetValues,
                steps: program.steps,
                confirmedSteps: 0,
            };
            await this.persistSortTransaction(journal);

            let written = 0;

            try {
                for (let index = 0; index < program.steps.length; index++) {
                    const step = program.steps[index];
                    const fresh = await this.readList(listName);
                    const beforeWrite = compareActiveSnapshot(originalSnapshot, fresh, expectedValues);

                    if (activeSnapshotHasConflict(beforeWrite)) {
                        const reason = beforeWrite.addedIds.length > 0
                            ? `${listName}: Während der Sortierung ist ein neuer aktiver Alexa-Listeneintrag hinzugekommen.`
                            : beforeWrite.missingIds.length > 0
                                ? `${listName}: Ein ursprünglicher Listeneintrag wurde während der Sortierung entfernt oder abgehakt.`
                                : `${listName}: Ein ursprünglicher Listeneintrag wurde während der Sortierung verändert.`;
                        this.traffic.abortedRuns += 1;
                        await this.persistTrafficMetrics();
                        const restored = await this.rollbackBufferedTransaction(journal);
                        if (!restored) {
                            await this.activateSortSafetyStop(listName, reason, journal);
                            return;
                        }
                        this.pendingLists.add(listName);
                        this.log.warn(`${reason} Der bestätigte Sortierpfad wurde rückwärts zurückgesetzt; neue Berechnung folgt.`);
                        return;
                    }

                    const currentItem = activeItems(fresh).find(item => String(item.id) === step.id);
                    if (!currentItem || String(currentItem.value || '').trim() !== step.from) {
                        this.traffic.abortedRuns += 1;
                        await this.persistTrafficMetrics();
                        const reason = `${listName}: Sortierpuffer erwartete bei ID ${step.id} „${step.from}“, gefunden wurde ein anderer Wert.`;
                        const restored = await this.rollbackBufferedTransaction(journal);
                        if (!restored) {
                            await this.activateSortSafetyStop(listName, reason, journal);
                            return;
                        }
                        this.pendingLists.add(listName);
                        this.log.warn(`${reason} Der bestätigte Sortierpfad wurde rückwärts zurückgesetzt.`);
                        return;
                    }

                    const valueStateId = `${this.alexaInstance}.Lists.${listName}.items.${step.id}.value`;
                    const valueObject = await this.getForeignObjectAsync(valueStateId);
                    if (!valueObject) {
                        throw new Error(`Alexa-Wertedatenpunkt fehlt: ${valueStateId}`);
                    }
                    const beforeState = await this.getForeignStateAsync(valueStateId);
                    const beforeTs = Number((beforeState as { ts?: number } | null)?.ts || 0);

                    const writeReady = await this.waitForAlexaWriteReadiness(listName, step.id, step.from);
                    if (!writeReady) {
                        this.traffic.abortedRuns += 1;
                        await this.persistTrafficMetrics();
                        await this.activateSortSafetyStop(
                            listName,
                            `${listName}: Alexa2-Metadaten für ID ${step.id} waren vor Sortierschritt ${index + 1}/${program.steps.length} nicht synchron.`,
                            journal,
                        );
                        return;
                    }

                    await this.writeAlexaState(valueStateId, step.to);
                    const confirmation = await this.waitForAlexaValueConfirmation(
                        listName,
                        step.id,
                        step.from,
                        step.to,
                        beforeTs,
                    );
                    if (confirmation === 'ambiguous') {
                        this.traffic.abortedRuns += 1;
                        await this.persistTrafficMetrics();
                        await this.activateSortSafetyStop(
                            listName,
                            `${listName}: Alexa2 hat Sortierschritt ${index + 1}/${program.steps.length} nicht eindeutig bestätigt.`,
                            journal,
                        );
                        return;
                    }
                    if (confirmation === 'not-applied') {
                        this.traffic.abortedRuns += 1;
                        await this.persistTrafficMetrics();
                        const restored = await this.rollbackBufferedTransaction(journal);
                        if (!restored) {
                            await this.activateSortSafetyStop(
                                listName,
                                `${listName}: Sortierschritt ${index + 1}/${program.steps.length} wurde von Alexa2 verworfen.`,
                                journal,
                            );
                            return;
                        }
                        this.pendingLists.add(listName);
                        await this.setError(`${listName}: Alexa2 hat einen Sortierschritt verworfen; Ausgangszustand wurde wiederhergestellt.`);
                        return;
                    }

                    expectedValues.set(step.id, step.to);
                    journal.confirmedSteps = index + 1;
                    await this.persistSortTransaction(journal);
                    written += 1;

                    const confirmedList = await this.readList(listName);
                    const afterWrite = compareActiveSnapshot(originalSnapshot, confirmedList, expectedValues);
                    if (activeSnapshotHasConflict(afterWrite)) {
                        this.traffic.abortedRuns += 1;
                        await this.persistTrafficMetrics();
                        const reason = `${listName}: Die Liste wurde während der gepufferten Sortierung außerhalb des bestätigten Schritts verändert.`;
                        const restored = await this.rollbackBufferedTransaction(journal);
                        if (!restored) {
                            await this.activateSortSafetyStop(listName, reason, journal);
                            return;
                        }
                        this.pendingLists.add(listName);
                        this.log.warn(`${reason} Der bestätigte Sortierpfad wurde rückwärts zurückgesetzt.`);
                        return;
                    }

                    if (written < program.steps.length) {
                        if (
                            this.apiSafeMode &&
                            written % this.batchSize === 0 &&
                            this.batchPauseMs > 0
                        ) {
                            this.log.info(`API-Schonmodus: Batch-Pause nach ${written} Schreibzugriffen (${this.batchPauseMs} ms).`);
                            await this.wait(this.batchPauseMs);
                        }
                    }
                }

                const verifyList = await this.readList(listName);
                const targetMap = new Map<string, string>(Object.entries(targetValues));
                const verification = compareActiveSnapshot(originalSnapshot, verifyList, targetMap);
                if (activeSnapshotHasConflict(verification)) {
                    this.traffic.abortedRuns += 1;
                    await this.persistTrafficMetrics();
                    const reason = `${listName}: Abschlussprüfung der gepufferten Sortierung ist fehlgeschlagen.`;
                    const restored = await this.rollbackBufferedTransaction(journal);
                    if (!restored) {
                        await this.activateSortSafetyStop(listName, reason, journal);
                        return;
                    }
                    this.pendingLists.add(listName);
                    this.log.warn(`${reason} Ausgangszustand wurde wiederhergestellt.`);
                    return;
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.traffic.abortedRuns += 1;
                await this.persistTrafficMetrics();

                const pending = await this.reconcilePendingTransactionStep(journal);
                if (pending === 'ambiguous') {
                    await this.activateSortSafetyStop(listName, `${listName}: Sortierfehler mit unklarem Alexa2-Schreibstatus: ${message}`, journal);
                    return;
                }
                const restored = await this.rollbackBufferedTransaction(journal);
                if (!restored) {
                    await this.activateSortSafetyStop(listName, `${listName}: Sortierfehler: ${message}`, journal);
                    return;
                }
                this.pendingLists.add(listName);
                await this.setError(`${listName}: Gepufferte Sortierung abgebrochen und rückwärts auf den Ausgangszustand gesetzt: ${message}`);
                this.log.error(`${listName}: Gepufferte Sortierung abgebrochen und zurückgesetzt: ${message}`);
                return;
            }

            await this.persistSortTransaction(null);

            const visibleResult = await this.refreshVisibleAlexaOrder(listName, plan);
            if (visibleResult.interrupted) return;

            await this.setStateAsync(
                'info.lastSort',
                `${new Date().toISOString()} – ${listName}: ${program.changedSlots} Änderung(en), ${program.amazonWrites} gepufferte Schreibzugriffe, ${visibleResult.writes} Reihenfolge-Schreibzugriff(e), ${active.length} Ausgangseinträge`,
                true,
            );
            await this.setStateAsync('info.lastError', '', true);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await this.setError(message);
            this.log.error(message);
        } finally {
            this.sortingListName = '';
            await this.persistRuntimeConfig();
            await this.refreshExports();
            await this.updateFeedbackReport();
            if (this.listChangedDuringSort) this.pendingLists.add(listName);
            if (this.pendingLists.size > 0) this.armSortTimer(this.sortStabilityDelayMs);
        }
    }

    private visibleOrderRefreshIds(
        list: AlexaListItem[],
        plan: Array<{ id: string; to: string; position: number }>,
    ): string[] {
        const orderedPlan = [...plan].sort((left, right) => Number(left.position) - Number(right.position));
        const desiredIds = orderedPlan.map(entry => String(entry.id));
        const desiredSet = new Set(desiredIds);
        const relevant = activeItems(list).filter(item => desiredSet.has(String(item.id)));
        if (relevant.length !== desiredIds.length) {
            throw new Error('Sichtbare Reihenfolge kann nicht geprüft werden: Ein geplanter aktiver Alexa-Eintrag fehlt.');
        }
        const currentIds = sortIdsByAlexaUpdatedTime(relevant);
        return createVisibleOrderRefreshPlan(currentIds, desiredIds);
    }

    private async readAlexaWriteSnapshot(listName: string, id: string): Promise<AlexaWriteSnapshot> {
        const valueStateId = `${this.alexaInstance}.Lists.${listName}.items.${id}.value`;
        const [state, versionState, updatedState, listState] = await Promise.all([
            this.getForeignStateAsync(valueStateId),
            this.getForeignStateAsync(`${this.alexaInstance}.Lists.${listName}.items.${id}.version`),
            this.getForeignStateAsync(`${this.alexaInstance}.Lists.${listName}.items.${id}.updatedDateTime`),
            this.getForeignStateAsync(this.listStateId(listName)),
        ]);
        if (!listState || typeof listState.val !== 'string' || !listState.val.trim()) {
            throw new Error(`Datenpunkt ${this.listStateId(listName)} enthält keine lesbare Liste.`);
        }
        const parsed: unknown = JSON.parse(listState.val);
        if (!Array.isArray(parsed)) throw new Error(`${this.listStateId(listName)} enthält kein JSON-Array.`);
        const list: Array<AlexaListItem & { version?: number | string }> = parsed;
        const item = list.find(entry => String(entry?.id || '') === id);

        return {
            json: {
                value: item ? String(item.value || '').trim() : undefined,
                version: item?.version,
                updatedDateTime: item?.updatedDateTime,
                acknowledged: listState.ack === true,
            },
            item: {
                value: state ? String(state.val ?? '').trim() : undefined,
                version: versionState?.val as number | string | undefined,
                updatedDateTime: updatedState?.val as number | string | undefined,
                acknowledged: state?.ack === true,
                versionAcknowledged: versionState?.ack === true,
                updatedDateTimeAcknowledged: updatedState?.ack === true,
            },
        };
    }

    private async readAlexaWriteReadinessSnapshot(
        listName: string,
        id: string,
    ): Promise<AlexaWriteReadinessSnapshot> {
        const listStateId = this.listStateId(listName);
        const firstListState = await this.getForeignStateAsync(listStateId);
        if (!firstListState || typeof firstListState.val !== 'string' || !firstListState.val.trim()) {
            throw new Error(`Datenpunkt ${listStateId} enthält keine lesbare Liste.`);
        }
        const parsed: unknown = JSON.parse(firstListState.val);
        if (!Array.isArray(parsed)) throw new Error(`${listStateId} enthält kein JSON-Array.`);
        const list: Array<AlexaListItem & { version?: number | string }> = parsed;
        const item = list.find(entry => String(entry?.id || '') === id);
        const queueBarrierId = String(list.at(-1)?.id || '');
        const itemStatePrefix = `${this.alexaInstance}.Lists.${listName}.items.${id}`;
        const [state, versionState, updatedState, queueBarrierState, finalListState] = await Promise.all([
            this.getForeignStateAsync(`${itemStatePrefix}.value`),
            this.getForeignStateAsync(`${itemStatePrefix}.version`),
            this.getForeignStateAsync(`${itemStatePrefix}.updatedDateTime`),
            queueBarrierId
                ? this.getForeignStateAsync(`${this.alexaInstance}.Lists.${listName}.items.${queueBarrierId}.listName`)
                : Promise.resolve(null),
            this.getForeignStateAsync(listStateId),
        ]);
        const firstObservedAt = Number((firstListState as { ts?: number }).ts || 0);
        const finalObservedAt = Number((finalListState as { ts?: number } | null)?.ts || 0);

        return {
            jsonStable: finalObservedAt === firstObservedAt && finalListState?.val === firstListState.val,
            queueBarrierAcknowledged: queueBarrierState?.ack === true,
            queueBarrierObservedAt: Number((queueBarrierState as { ts?: number } | null)?.ts || 0),
            json: {
                value: item ? String(item.value || '').trim() : undefined,
                version: item?.version,
                updatedDateTime: item?.updatedDateTime,
                acknowledged: firstListState.ack === true,
                observedAt: firstObservedAt,
            },
            item: {
                value: state ? String(state.val ?? '').trim() : undefined,
                version: versionState?.val as number | string | undefined,
                updatedDateTime: updatedState?.val as number | string | undefined,
                acknowledged: state?.ack === true,
                versionAcknowledged: versionState?.ack === true,
                updatedDateTimeAcknowledged: updatedState?.ack === true,
                valueObservedAt: Number((state as { ts?: number } | null)?.ts || 0),
                versionObservedAt: Number((versionState as { ts?: number } | null)?.ts || 0),
                updatedDateTimeObservedAt: Number((updatedState as { ts?: number } | null)?.ts || 0),
            },
        };
    }

    private async refreshVisibleAlexaOrder(
        listName: string,
        plan: Array<{ id: string; to: string; position: number }>,
    ): Promise<{ writes: number; interrupted: boolean; additionalItems: boolean }> {
        const orderedPlan = [...plan].sort((left, right) => Number(left.position) - Number(right.position));
        const desiredIds = orderedPlan.map(entry => String(entry.id));
        const desiredSet = new Set(desiredIds);
        const expectedValues = new Map(
            orderedPlan.map(entry => [String(entry.id), String(entry.to || '').trim()]),
        );

        const firstList = await this.readList(listName);
        let additionalItems = activeItems(firstList).some(item => !desiredSet.has(String(item.id)));
        if (additionalItems) {
            this.pendingLists.add(listName);
            this.log.warn(`${listName}: Neuer aktiver Alexa-Listeneintrag vor der Reihenfolge-Finalisierung erkannt; Finalisierung abgebrochen. Neue Berechnung folgt nach Synchronisationsruhe.`);
            return { writes: 0, interrupted: true, additionalItems: true };
        }
        let touchIds: string[];
        try {
            touchIds = this.visibleOrderRefreshIds(firstList, orderedPlan);
        } catch (error) {
            this.pendingLists.add(listName);
            this.log.warn(`${listName}: Sichtbare Reihenfolge wird neu berechnet: ${error instanceof Error ? error.message : String(error)}`);
            return { writes: 0, interrupted: true, additionalItems };
        }
        if (touchIds.length === 0) return { writes: 0, interrupted: false, additionalItems };

        let writes = 0;
        for (let index = 0; index < touchIds.length; index++) {
            const id = touchIds[index];
            const fresh = await this.readList(listName);
            const active = activeItems(fresh);
            if (active.some(item => !desiredSet.has(String(item.id)))) {
                additionalItems = true;
                this.pendingLists.add(listName);
                this.log.warn(`${listName}: Neuer aktiver Alexa-Listeneintrag während der Reihenfolge-Finalisierung erkannt; weitere Reihenfolge-Aktualisierungen werden abgebrochen.`);
                return { writes, interrupted: true, additionalItems };
            }
            const byId = new Map(active.map(item => [String(item.id), item]));

            let conflict = false;
            for (const [expectedId, expectedValue] of expectedValues) {
                const item = byId.get(expectedId);
                if (!item || String(item.value || '').trim() !== expectedValue) {
                    conflict = true;
                    break;
                }
            }
            if (conflict) {
                this.pendingLists.add(listName);
                this.log.warn(`${listName}: Liste wurde während der Reihenfolge-Finalisierung verändert; keine Textwerte wurden zurückgerollt, neue Berechnung folgt.`);
                return { writes, interrupted: true, additionalItems };
            }

            const currentItem = byId.get(id);
            const expectedValue = expectedValues.get(id);
            if (!currentItem || expectedValue === undefined) {
                this.pendingLists.add(listName);
                return { writes, interrupted: true, additionalItems };
            }

            const valueStateId = `${this.alexaInstance}.Lists.${listName}.items.${id}.value`;
            const valueObject = await this.getForeignObjectAsync(valueStateId);
            if (!valueObject) {
                await this.activateSortSafetyStop(
                    listName,
                    `${listName}: Alexa-Wertedatenpunkt für die sichtbare Reihenfolge fehlt: ${valueStateId}`,
                );
                return { writes, interrupted: true, additionalItems };
            }
            const transactionId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
            const marker = createVisibleOrderMarker(transactionId, index, expectedValues.values());
            const touchProgram = createVisibleOrderTouchProgram(id, expectedValue, marker);
            const journal: SortTransactionJournal = {
                version: 1,
                transactionId,
                listName,
                marker,
                startedAt: new Date().toISOString(),
                status: 'applying',
                originalValues: { [id]: expectedValue },
                targetValues: { [id]: expectedValue },
                steps: touchProgram.steps,
                confirmedSteps: 0,
            };
            await this.persistSortTransaction(journal);

            const markerReady = await this.waitForAlexaWriteReadiness(listName, id, expectedValue);
            if (!markerReady) {
                await this.activateSortSafetyStop(
                    listName,
                    `${listName}: Alexa2 war vor dem Reihenfolge-Marker für ID ${id} nicht schreibbereit.`,
                    journal,
                );
                return { writes, interrupted: true, additionalItems };
            }
            const markerBaseline = await this.readAlexaWriteSnapshot(listName, id);
            await this.writeAlexaState(valueStateId, marker);
            const markerConfirmation = await this.waitForAlexaValueConfirmation(
                listName,
                id,
                expectedValue,
                marker,
                0,
                markerBaseline,
            );
            if (markerConfirmation !== 'confirmed') {
                await this.activateSortSafetyStop(
                    listName,
                    `${listName}: Temporärer Reihenfolge-Marker für ID ${id} wurde nicht eindeutig bestätigt.`,
                    journal,
                );
                return { writes, interrupted: true, additionalItems };
            }
            journal.confirmedSteps = 1;
            await this.persistSortTransaction(journal);

            const restoreReady = await this.waitForAlexaWriteReadiness(listName, id, marker);
            if (!restoreReady) {
                await this.activateSortSafetyStop(
                    listName,
                    `${listName}: Alexa2 war vor der Rückschreibung des Originaltexts für ID ${id} nicht schreibbereit.`,
                    journal,
                );
                return { writes, interrupted: true, additionalItems };
            }
            const restoreBaseline = await this.readAlexaWriteSnapshot(listName, id);
            await this.writeAlexaState(valueStateId, expectedValue);
            const restored = await this.waitForAlexaValueConfirmation(
                listName,
                id,
                marker,
                expectedValue,
                0,
                restoreBaseline,
            );
            if (restored !== 'confirmed') {
                await this.activateSortSafetyStop(
                    listName,
                    restored === 'not-applied'
                        ? `${listName}: Rückschreibung des Originaltexts für ID ${id} wurde nicht bestätigt.`
                        : `${listName}: Rückschreibung des Originaltexts für ID ${id} ist nicht eindeutig auflösbar.`,
                    journal,
                );
                return { writes, interrupted: true, additionalItems };
            }
            journal.confirmedSteps = 2;
            await this.persistSortTransaction(journal);
            await this.persistSortTransaction(null);
            writes += touchProgram.amazonWrites;

            if (index + 1 < touchIds.length) {
                if (
                    this.apiSafeMode &&
                    (index + 1) % this.batchSize === 0 &&
                    this.batchPauseMs > 0
                ) {
                    this.log.info(`API-Schonmodus: Batch-Pause nach ${index + 1} Reihenfolge-Aktualisierung(en) (${this.batchPauseMs} ms).`);
                    await this.wait(this.batchPauseMs);
                }
            }
        }

        const verifyList = await this.readList(listName);
        if (activeItems(verifyList).some(item => !desiredSet.has(String(item.id)))) {
            additionalItems = true;
            this.pendingLists.add(listName);
            this.log.warn(`${listName}: Neuer aktiver Alexa-Listeneintrag bei der Abschlussprüfung erkannt; neue Berechnung folgt nach Synchronisationsruhe.`);
            return { writes, interrupted: true, additionalItems };
        }
        let remaining: string[];
        try {
            remaining = this.visibleOrderRefreshIds(verifyList, orderedPlan);
        } catch (error) {
            this.pendingLists.add(listName);
            this.log.warn(`${listName}: Abschlussprüfung der sichtbaren Reihenfolge wird neu berechnet: ${error instanceof Error ? error.message : String(error)}`);
            return { writes, interrupted: true, additionalItems };
        }
        if (remaining.length > 0) {
            await this.activateSortSafetyStop(
                listName,
                `${listName}: Alexa2 hat die sichtbare Zielreihenfolge trotz bestätigter Marker-Aktualisierungen nicht hergestellt.`,
            );
            return { writes, interrupted: true, additionalItems };
        }

        return { writes, interrupted: false, additionalItems };
    }

    private async persistSortTransaction(journal: SortTransactionJournal | null): Promise<void> {
        await this.setStateAsync('info.sortTransaction', journal ? JSON.stringify(journal, null, 2) : '{}', true);
    }

    private async readSortTransaction(): Promise<SortTransactionJournal | null> {
        const state = await this.getStateAsync('info.sortTransaction');
        const raw = String(state?.val || '').trim();
        if (!raw || raw === '{}') return null;
        try {
            const parsed = JSON.parse(raw) as SortTransactionJournal;
            if (
                parsed?.version !== 1 ||
                !parsed.listName ||
                !parsed.marker ||
                !Array.isArray(parsed.steps) ||
                !Number.isInteger(parsed.confirmedSteps) ||
                parsed.confirmedSteps < 0 ||
                parsed.confirmedSteps > parsed.steps.length ||
                !parsed.originalValues ||
                !parsed.targetValues ||
                !['applying', 'rollback', 'failed-applying', 'failed-rollback'].includes(parsed.status)
            ) {
                throw new Error('ungültige Journal-Struktur');
            }
            return parsed;
        } catch (error) {
            throw new Error(`Sortierjournal ist beschädigt: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async waitForAlexaValueConfirmation(
        listName: string,
        id: string,
        from: string,
        to: string,
        previousTs = 0,
        previousEvidence?: AlexaWriteSnapshot,
        timeoutMs = ALEXA_CONFIRMATION_TIMEOUT_MS,
    ): Promise<ConfirmationResult> {
        const valueStateId = `${this.alexaInstance}.Lists.${listName}.items.${id}.value`;
        return waitForConfirmation({
            timeoutMs,
            pollIntervalMs: ALEXA_CONFIRMATION_POLL_MS,
            pause: ms => this.wait(ms),
            probe: async () => {
                if (previousEvidence) {
                    const currentEvidence = await this.readAlexaWriteSnapshot(listName, id);
                    return classifyAlexaWriteConfirmation(
                        from,
                        to,
                        previousEvidence.json,
                        previousEvidence.item,
                        currentEvidence.json,
                        currentEvidence.item,
                    );
                }

                const [state, list] = await Promise.all([
                    this.getForeignStateAsync(valueStateId),
                    this.readList(listName),
                ]);
                const item = list.find(entry => String(entry?.id || '') === id);
                const listValue = item ? String(item.value || '').trim() : undefined;
                const stateValue = state ? String(state.val ?? '').trim() : undefined;
                const stateTs = Number((state as { ts?: number } | null)?.ts || 0);

                if (listValue === to && stateValue === to && state?.ack === true && stateTs >= previousTs) {
                    return 'confirmed';
                }
                if (listValue === from && stateValue === from && state?.ack === true) return 'not-applied';
                return 'ambiguous';
            },
        });
    }

    private async waitForAlexaWriteReadiness(
        listName: string,
        id: string,
        expectedValue: string,
        timeoutMs = ALEXA_CONFIRMATION_TIMEOUT_MS,
    ): Promise<boolean> {
        const readiness = await waitForConfirmation({
            timeoutMs,
            pollIntervalMs: ALEXA_CONFIRMATION_POLL_MS,
            pause: ms => this.wait(ms),
            probe: async () => isAlexaWriteReady(
                expectedValue,
                await this.readAlexaWriteReadinessSnapshot(listName, id),
            ) ? 'confirmed' : 'ambiguous',
        });
        return readiness === 'confirmed';
    }

    private async reconcilePendingTransactionStep(
        journal: SortTransactionJournal,
    ): Promise<'confirmed' | 'not-applied' | 'ambiguous'> {
        if (journal.confirmedSteps >= journal.steps.length) return 'confirmed';
        const step = journal.steps[journal.confirmedSteps];
        const valueStateId = `${this.alexaInstance}.Lists.${journal.listName}.items.${step.id}.value`;
        const [state, list] = await Promise.all([
            this.getForeignStateAsync(valueStateId),
            this.readList(journal.listName),
        ]);
        const item = list.find(entry => String(entry?.id || '') === step.id);
        const listValue = item ? String(item.value || '').trim() : undefined;
        const stateValue = state ? String(state.val ?? '').trim() : undefined;

        if (listValue === step.to && stateValue === step.to && state?.ack === true) {
            journal.confirmedSteps += 1;
            await this.persistSortTransaction(journal);
            return 'confirmed';
        }
        if (listValue === step.from && stateValue === step.from && state?.ack === true) return 'not-applied';

        if (stateValue === step.to && state?.ack === false) {
            const result = await this.waitForAlexaValueConfirmation(
                journal.listName,
                step.id,
                step.from,
                step.to,
                Number((state as { ts?: number } | null)?.ts || 0),
            );
            if (result === 'confirmed') {
                journal.confirmedSteps += 1;
                await this.persistSortTransaction(journal);
            }
            return result;
        }

        return 'ambiguous';
    }

    private async reconcilePendingRollbackStep(
        journal: SortTransactionJournal,
    ): Promise<'confirmed' | 'not-applied' | 'ambiguous'> {
        if (journal.confirmedSteps <= 0) return 'confirmed';
        const step = journal.steps[journal.confirmedSteps - 1];
        const valueStateId = `${this.alexaInstance}.Lists.${journal.listName}.items.${step.id}.value`;
        const [state, list] = await Promise.all([
            this.getForeignStateAsync(valueStateId),
            this.readList(journal.listName),
        ]);
        const item = list.find(entry => String(entry?.id || '') === step.id);
        const listValue = item ? String(item.value || '').trim() : undefined;
        const stateValue = state ? String(state.val ?? '').trim() : undefined;

        if (listValue === step.from && stateValue === step.from && state?.ack === true) {
            journal.confirmedSteps -= 1;
            await this.persistSortTransaction(journal);
            return 'confirmed';
        }
        if (listValue === step.to && stateValue === step.to && state?.ack === true) return 'not-applied';

        if (stateValue === step.from && state?.ack === false) {
            const result = await this.waitForAlexaValueConfirmation(
                journal.listName,
                step.id,
                step.to,
                step.from,
                Number((state as { ts?: number } | null)?.ts || 0),
            );
            if (result === 'confirmed') {
                journal.confirmedSteps -= 1;
                await this.persistSortTransaction(journal);
            }
            return result;
        }

        return 'ambiguous';
    }

    private async rollbackBufferedTransaction(journal: SortTransactionJournal): Promise<boolean> {
        journal.status = 'rollback';
        await this.persistSortTransaction(journal);

        while (journal.confirmedSteps > 0) {
            const index = journal.confirmedSteps - 1;
            const step = journal.steps[index];
            try {
                const currentList = await this.readList(journal.listName);
                const currentItem = currentList.find(item => String(item?.id || '') === step.id);
                if (!currentItem) {
                    this.log.warn(`${journal.listName}: Rollback überspringt extern entfernte ID ${step.id}.`);
                    journal.confirmedSteps -= 1;
                    await this.persistSortTransaction(journal);
                    continue;
                }

                const currentValue = String(currentItem.value || '').trim();
                if (currentValue === step.from) {
                    journal.confirmedSteps -= 1;
                    await this.persistSortTransaction(journal);
                    continue;
                }

                if (currentValue !== step.to) {
                    this.log.warn(`${journal.listName}: Rollback überschreibt extern geänderte ID ${step.id} nicht.`);
                    journal.confirmedSteps -= 1;
                    await this.persistSortTransaction(journal);
                    continue;
                }

                const valueStateId = `${this.alexaInstance}.Lists.${journal.listName}.items.${step.id}.value`;
                const valueObject = await this.getForeignObjectAsync(valueStateId);
                if (!valueObject) {
                    this.log.error(`${journal.listName}: Rollback-Datenpunkt fehlt: ${valueStateId}`);
                    return false;
                }
                const writeReady = await this.waitForAlexaWriteReadiness(
                    journal.listName,
                    step.id,
                    step.to,
                );
                if (!writeReady) {
                    this.log.error(`${journal.listName}: Alexa2 war vor dem Rollback für ID ${step.id} nicht schreibbereit.`);
                    return false;
                }
                const beforeState = await this.getForeignStateAsync(valueStateId);
                const beforeTs = Number((beforeState as { ts?: number } | null)?.ts || 0);
                await this.writeAlexaState(valueStateId, step.from);
                const confirmation = await this.waitForAlexaValueConfirmation(
                    journal.listName,
                    step.id,
                    step.to,
                    step.from,
                    beforeTs,
                );
                if (confirmation !== 'confirmed') {
                    this.log.error(`${journal.listName}: Rollback-Schritt für ID ${step.id} wurde nicht eindeutig bestätigt.`);
                    return false;
                }

                journal.confirmedSteps -= 1;
                await this.persistSortTransaction(journal);
            } catch (error) {
                this.log.error(
                    `${journal.listName}: Rollback für ID ${step.id} fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`,
                );
                return false;
            }
        }

        await this.persistSortTransaction(null);
        return true;
    }

    private async transactionMatchesTarget(journal: SortTransactionJournal): Promise<boolean> {
        const list = await this.readList(journal.listName);
        const values = new Map(list.map(item => [String(item?.id || ''), String(item?.value || '').trim()]));
        for (const [id, expected] of Object.entries(journal.targetValues)) {
            if (values.get(id) !== expected) return false;
        }
        return true;
    }

    private async recoverInterruptedSortTransaction(): Promise<void> {
        let journal: SortTransactionJournal | null;
        try {
            journal = await this.readSortTransaction();
        } catch (error) {
            await this.activateSortSafetyStop('unbekannt', error instanceof Error ? error.message : String(error));
            return;
        }
        if (!journal) return;

        this.log.warn(`${journal.listName}: Unterbrochene Sortiertransaktion ${journal.transactionId} gefunden; Wiederherstellung startet.`);
        if (!canWriteAlexa(this.writeCapability)) {
            await this.activateSortSafetyStop(
                journal.listName,
                `${journal.listName}: Unterbrochene Sortierung kann wegen fehlender Alexa-Schreibfreigabe nicht wiederhergestellt werden.`,
                journal,
            );
            return;
        }

        try {
            if (await this.transactionMatchesTarget(journal)) {
                await this.persistSortTransaction(null);
                this.log.info(`${journal.listName}: Unterbrochene Transaktion war bereits vollständig abgeschlossen; Journal bereinigt.`);
                return;
            }

            if (journal.status === 'rollback' || journal.status === 'failed-rollback') {
                const pendingRollback = await this.reconcilePendingRollbackStep(journal);
                if (pendingRollback === 'ambiguous') {
                    await this.activateSortSafetyStop(
                        journal.listName,
                        `${journal.listName}: Letzter Rollback-Schritt der unterbrochenen Transaktion ist nicht eindeutig auflösbar.`,
                        journal,
                    );
                    return;
                }
            } else if (journal.confirmedSteps < journal.steps.length) {
                const pending = await this.reconcilePendingTransactionStep(journal);
                if (pending === 'ambiguous') {
                    await this.activateSortSafetyStop(
                        journal.listName,
                        `${journal.listName}: Letzter Sortierschritt der unterbrochenen Transaktion ist nicht eindeutig auflösbar.`,
                        journal,
                    );
                    return;
                }
            }

            const restored = await this.rollbackBufferedTransaction(journal);
            if (!restored) {
                await this.activateSortSafetyStop(
                    journal.listName,
                    `${journal.listName}: Unterbrochene Sortierung konnte nicht vollständig zurückgesetzt werden.`,
                    journal,
                );
                return;
            }
            this.log.warn(`${journal.listName}: Unterbrochene Sortierung wurde anhand des lokalen Journals vollständig rückwärts aufgelöst.`);
        } catch (error) {
            await this.activateSortSafetyStop(
                journal.listName,
                `${journal.listName}: Wiederherstellung der unterbrochenen Sortierung fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`,
                journal,
            );
        }
    }

    private async activateSortSafetyStop(
        listName: string,
        reason: string,
        journal?: SortTransactionJournal,
    ): Promise<void> {
        this.pendingLists.clear();
        if (journal) {
            journal.status = journal.status === 'rollback' || journal.status === 'failed-rollback'
                ? 'failed-rollback'
                : 'failed-applying';
            await this.persistSortTransaction(journal);
        }
        await this.setStateAsync('control.enabled', false, true);
        const prefix = listName !== 'unbekannt' && !reason.startsWith(`${listName}:`) ? `${listName}: ` : '';
        const message = `${prefix}${reason} SICHERHEITSSTOPP: ShoppingRoute wurde deaktiviert; weitere automatische Sortierung bleibt gesperrt.`;
        await this.setError(message);
        this.log.error(message);
    }

    private async applyMarketHeaderAction(listName: string, action: MarketHeaderAction): Promise<void> {
        const stateId = action.type === 'create'
            ? `${this.alexaInstance}.Lists.${listName}.#New`
            : `${this.alexaInstance}.Lists.${listName}.items.${action.id}.#delete`;
        const value = action.type === 'create' ? action.value : true;
        const stateObject = await this.getForeignObjectAsync(stateId);
        if (!stateObject) throw new Error(`Alexa-Datenpunkt für Marktüberschrift fehlt: ${stateId}`);
        await this.writeAlexaState(stateId, value);
        this.log.info(`${listName}: Marktüberschrift ${action.market} – ${action.type}.`);
    }

    private async writeAlexaState(stateId: string, value: string | boolean): Promise<void> {
        let lastError: unknown;
        for (let attempt = 0; attempt <= this.maxWriteRetries; attempt++) {
            try {
                if (this.apiSafeMode) await this.waitForWriteBudget();
                await this.setForeignStateAsync(stateId, { val: value, ack: false });
                this.writeTimestamps.push(Date.now());
                this.traffic.alexaWrites += 1;
                this.traffic.lastAlexaWrite = new Date().toISOString();
                await this.persistTrafficMetrics();
                return;
            } catch (error) {
                lastError = error;
                if (attempt >= this.maxWriteRetries) break;
                const delay = this.retryBaseMs * Math.pow(2, attempt);
                this.log.warn(`Alexa-Schreibzugriff fehlgeschlagen; Retry ${attempt + 1}/${this.maxWriteRetries} in ${delay} ms.`);
                await this.wait(delay);
            }
        }
        throw lastError instanceof Error ? lastError : new Error(String(lastError));
    }

    private async waitForWriteBudget(): Promise<void> {
        while (true) {
            const now = Date.now();
            this.writeTimestamps = this.writeTimestamps.filter(timestamp => now - timestamp < 60000);
            if (this.writeTimestamps.length < this.maxWritesPerMinute) return;
            const waitMs = Math.max(500, 60000 - (now - this.writeTimestamps[0]) + 100);
            this.log.info(`API-Schonmodus: Schreiblimit ${this.maxWritesPerMinute}/Minute erreicht, Pause ${waitMs} ms.`);
            await this.wait(waitMs);
        }
    }

    private async updateAliasSuggestions(list: AlexaListItem[]): Promise<void> {
        if (this.cfg.autoAliasSuggestions === false) {
            await this.setStateAsync('info.aliasSuggestions', '[]', true);
            return;
        }
        const suggestions: Array<{ product: string; alias: string }> = [];
        for (const item of activeItems(list)) {
            if (isMarketHeader(String(item.value), this.markets)) continue;
            const parsed = parseItem(String(item.value), this.markets, this.products, this.fallbackMarket, this.priorityMarket);
            const product = findProduct(parsed.productText, this.products);
            if (!product) continue;
            for (const alias of suggestAliases(parsed.productText, product)) suggestions.push({ product: product.name, alias });
        }
        const unique = [...new Map(suggestions.map(entry => [`${entry.product}|${entry.alias}`.toLocaleLowerCase('de'), entry])).values()];
        await this.setStateAsync('info.aliasSuggestions', JSON.stringify(unique, null, 2), true);
    }

    private async recordNewItems(listName: string, list: AlexaListItem[]): Promise<void> {
        const active = activeItems(list);
        const previous = this.knownActiveIds.get(listName);
        const current = new Set(active.map(item => String(item.id)));
        if (!previous) {
            this.knownActiveIds.set(listName, current);
            return;
        }
        for (const item of active) {
            if (previous.has(String(item.id))) continue;
            if (isMarketHeader(String(item.value), this.markets)) continue;
            const parsed = parseItem(String(item.value), this.markets, this.products, this.fallbackMarket, this.priorityMarketForList(listName));
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

    private async runStartupCompatibilityCheck(): Promise<void> {
        try {
            const alexaObject = await this.getForeignObjectAsync(`system.adapter.${this.alexaInstance}`);
            const alexaVersion = (alexaObject?.common as { version?: unknown } | undefined)?.version;
            this.alexa2Version = typeof alexaVersion === 'string' ? alexaVersion : 'unbekannt';
        } catch { this.alexa2Version = 'unbekannt'; }
        try {
            const resolved = require.resolve('alexa-remote2');
            const source = fs.readFileSync(resolved, 'utf8');
            const inspection = inspectAlexaRemoteSource(source);
            this.writeCapability = inspection.status;
            this.compatibilityDetail = inspection.detail;
            this.alexaRemote2Version = this.findPackageVersion(resolved, 'alexa-remote2');
        } catch (error) {
            this.writeCapability = 'unknown';
            this.compatibilityDetail = `alexa-remote2 konnte nicht automatisch geprüft werden: ${error instanceof Error ? error.message : String(error)}`;
            this.alexaRemote2Version = 'unbekannt';
        }
        await this.updateCompatibilityDiagnostics();
    }

    private findPackageVersion(moduleFile: string, expectedName: string): string {
        let current = path.dirname(moduleFile);
        for (let level = 0; level < 6; level++) {
            const packageFile = path.join(current, 'package.json');
            try {
                const parsed = JSON.parse(fs.readFileSync(packageFile, 'utf8')) as { name?: string; version?: string };
                if (parsed.name === expectedName && parsed.version) return parsed.version;
            } catch { /* continue */ }
            const parent = path.dirname(current);
            if (parent === current) break;
            current = parent;
        }
        return 'unbekannt';
    }

    private async runLiveCompatibilityTest(): Promise<void> {
        if (this.compatibilityTesting || this.sortingListName) return;
        this.compatibilityTesting = true;
        try {
            const listName = this.listConfigs[0]?.name;
            if (!listName) throw new Error('Keine aktive Alexa-Liste konfiguriert.');
            const list = await this.readList(listName);
            const item = sortSlotsOldestFirst(activeItems(list))[0];
            if (!item) throw new Error('Für den Kompatibilitätstest wird mindestens ein aktiver Listeneintrag benötigt.');
            const valueStateId = `${this.alexaInstance}.Lists.${listName}.items.${item.id}.value`;
            const before = await this.getForeignStateAsync(valueStateId);
            const originalValue = String(before?.val ?? item.value).trim();
            if (!originalValue) throw new Error('Der Testeintrag enthält keinen sichtbaren value-Text.');
            const beforeTs = Number((before as { ts?: number } | null)?.ts || 0);
            await this.setForeignStateAsync(valueStateId, { val: originalValue, ack: false });
            this.traffic.alexaWrites += 1;
            this.traffic.compatibilityWrites += 1;
            this.traffic.lastAlexaWrite = new Date().toISOString();
            await this.persistTrafficMetrics();
            const confirmation = await waitForConfirmation({
                timeoutMs: ALEXA_CONFIRMATION_TIMEOUT_MS,
                pollIntervalMs: ALEXA_CONFIRMATION_POLL_MS,
                pause: ms => this.wait(ms),
                probe: async () => {
                    const current = await this.getForeignStateAsync(valueStateId);
                    return current &&
                        current.ack === true &&
                        String(current.val ?? '').trim() === originalValue &&
                        Number((current as { ts?: number }).ts || 0) > beforeTs
                        ? 'confirmed'
                        : 'ambiguous';
                },
            });
            if (confirmation === 'confirmed') {
                this.writeCapability = 'live-ok';
                this.compatibilityDetail = 'Live-Test erfolgreich: Alexa2 hat einen unveränderten value-Schreibzugriff bestätigt.';
                this.lastCompatibilityTest = `${new Date().toISOString()} – ERFOLG mit „${originalValue}“`;
                await this.setStateAsync('info.lastError', '', true);
            } else {
                this.writeCapability = 'live-failed';
                this.compatibilityDetail = 'Live-Test fehlgeschlagen: Alexa2 hat den value-Schreibzugriff nicht innerhalb von 10 Sekunden bestätigt.';
                this.lastCompatibilityTest = `${new Date().toISOString()} – FEHLGESCHLAGEN mit „${originalValue}“`;
                await this.setStateAsync('info.lastError', 'Alexa-Schreibkompatibilitätstest fehlgeschlagen; Sortierschreibzugriffe bleiben blockiert.', true);
            }
            await this.updateCompatibilityDiagnostics();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.writeCapability = 'live-failed';
            this.compatibilityDetail = `Live-Test konnte nicht abgeschlossen werden: ${message}`;
            this.lastCompatibilityTest = `${new Date().toISOString()} – FEHLER: ${message}`;
            await this.setStateAsync('info.lastError', `Kompatibilitätstest: ${message}`, true);
            await this.updateCompatibilityDiagnostics();
        } finally { this.compatibilityTesting = false; }
    }

    private async updateCompatibilityDiagnostics(): Promise<void> {
        await this.setStateAsync('info.writeCapability', this.writeCapability, true);
        await this.setStateAsync('info.lastCompatibilityTest', this.lastCompatibilityTest, true);
        await this.setStateAsync('info.compatibility', JSON.stringify({
            shoppingrouteVersion: VERSION,
            beta: true,
            alexaInstance: this.alexaInstance,
            alexa2Version: this.alexa2Version,
            alexaRemote2Version: this.alexaRemote2Version,
            lists: this.listConfigs.map(item => item.name),
            dryRun: this.dryRun,
            writeCapability: this.writeCapability,
            detail: this.compatibilityDetail,
            lastCompatibilityTest: this.lastCompatibilityTest,
            requiredAlexaAppSorting: 'Älteste bis neueste / Oldest to newest',
            checkedAt: new Date().toISOString(),
        }, null, 2), true);
    }

    private async updateTemporaryMarketStateOptions(): Promise<void> {
        try {
            const states: Record<string, string> = { __none__: '— Kein Markt —' };
            for (const market of [...this.markets].sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }))) {
                states[market.name] = market.name;
            }
            await this.extendObjectAsync('control.temporaryPriorityMarket', { common: { states } });
        } catch (error) {
            this.log.warn(`Temporäre Markt-Auswahlliste konnte nicht aktualisiert werden: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    private async ensureProductGroupsConfig(): Promise<void> {
        if (Array.isArray(this.cfg.productGroups) && this.cfg.productGroups.length > 0) return;
        try {
            await this.updateConfig({ productGroups: DEFAULT_CATEGORIES.map(name => ({ name })) } as Record<string, unknown>);
        } catch (error) {
            this.log.warn(`Produktgruppen konnten nicht initialisiert werden: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async persistRuntimeConfig(): Promise<void> {
        if (!this.productsDirty && !this.reviewsDirty && !this.routesDirty) return;
        try {
            const instanceId = `system.adapter.${this.namespace}`;
            const object = await this.getForeignObjectAsync(instanceId);
            if (!object) throw new Error(`Instanzobjekt nicht gefunden: ${instanceId}`);
            const currentNative = (object.native || {}) as Record<string, unknown>;
            object.native = {
                ...currentNative,
                ...(this.productsDirty ? { products: this.runtimeProducts.map(product => ({ ...product })) } : {}),
                ...(this.reviewsDirty ? { reviewItems: this.runtimeReviews.map(item => ({ ...item })) } : {}),
                ...(this.routesDirty ? { routes: this.runtimeRoutes.map(route => ({ ...route })) } : {}),
            };
            await this.setForeignObjectAsync(instanceId, object);
            this.productsDirty = false;
            this.reviewsDirty = false;
            this.routesDirty = false;
        } catch (error) {
            await this.setStateAsync('info.lastError', `Lern-/Konfigurationsdaten konnten nicht gespeichert werden: ${error instanceof Error ? error.message : String(error)}`, true);
        }
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
            const betaTag = typeof tags.beta === 'string' ? tags.beta : '';
            const latestTag = typeof tags.latest === 'string' ? tags.latest : '';
            this.latestBetaVersion = betaTag || latestTag;
            this.lastVersionCheck = new Date().toISOString();
            await this.setStateAsync('info.versionBeta', this.latestBetaVersion || 'unbekannt', true);
            await this.setStateAsync('info.updateAvailable', Boolean(this.latestBetaVersion && this.latestBetaVersion !== VERSION), true);
            await this.setStateAsync('info.versionCheck', `${this.lastVersionCheck} – npm beta: ${this.latestBetaVersion || 'unbekannt'}`, true);
        } catch (error) {
            this.lastVersionCheck = new Date().toISOString();
            await this.setStateAsync('info.versionCheck', `${this.lastVersionCheck} – npm-Abfrage fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`, true);
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
                    catch (error) {
                        reject(error instanceof Error ? error : new Error('Ungültige JSON-Antwort'));
                    }
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
            writeCapability: this.writeCapability,
            lastCompatibilityTest: this.lastCompatibilityTest,
            lastError: String((await this.getStateAsync('info.lastError'))?.val || ''),
            traffic: this.traffic,
            update: { installed: VERSION, npmBeta: this.latestBetaVersion || 'unbekannt', checkedAt: this.lastVersionCheck || 'noch nicht' },
            privacy: 'Produktnamen, Einkaufslistentexte, Aliase und komplette Konfiguration sind absichtlich nicht enthalten.',
        };
        await this.setStateAsync('info.feedbackReport', JSON.stringify(report, null, 2), true);
    }

    private async setError(message: string): Promise<void> {
        await this.setStateAsync('info.lastError', message, true);
    }

    private wait(ms: number): Promise<void> { return new Promise(resolve => this.setTimeout(resolve, ms)); }

    public static getDefaultCategories(): string[] { return [...DEFAULT_CATEGORIES]; }
}

if (require.main !== module) module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new ShoppingRoute(options);
else (() => new ShoppingRoute())();
