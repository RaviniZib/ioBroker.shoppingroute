"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShoppingRoute = void 0;
const utils = __importStar(require("@iobroker/adapter-core"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const https = __importStar(require("node:https"));
const compatibility_1 = require("./lib/compatibility");
const metrics_1 = require("./lib/metrics");
const sorter_1 = require("./lib/sorter");
const buffered_sort_1 = require("./lib/buffered-sort");
const parser_1 = require("./lib/parser");
const market_plan_1 = require("./lib/market-plan");
const config_tools_1 = require("./lib/config-tools");
const statistics_1 = require("./lib/statistics");
const confirmation_wait_1 = require("./lib/confirmation-wait");
const alexa_write_confirmation_1 = require("./lib/alexa-write-confirmation");
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
class ShoppingRoute extends utils.Adapter {
    sortTimer = null;
    versionTimer = null;
    pendingLists = new Set();
    sortingListName = '';
    listChangedDuringSort = false;
    runtimeProducts = [];
    runtimeReviews = [];
    productsDirty = false;
    reviewsDirty = false;
    routesDirty = false;
    runtimeRoutes = [];
    compatibilityTesting = false;
    writeCapability = 'unknown';
    compatibilityDetail = 'Noch nicht geprüft.';
    alexa2Version = 'unbekannt';
    alexaRemote2Version = 'unbekannt';
    lastCompatibilityTest = 'Noch nicht ausgeführt.';
    traffic = (0, metrics_1.emptyTrafficMetrics)();
    statistics = (0, statistics_1.emptyUsageStatistics)();
    knownActiveIds = new Map();
    activeCountByList = new Map();
    writeTimestamps = [];
    temporaryPriorityMarket = '';
    latestBetaVersion = '';
    lastVersionCheck = '';
    constructor(options = {}) {
        super({ ...options, name: 'shoppingroute' });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }
    get cfg() {
        return this.config;
    }
    get alexaInstance() {
        return String(this.cfg.alexaInstance || 'alexa2.0').trim() || 'alexa2.0';
    }
    get listConfigs() {
        const configured = Array.isArray(this.cfg.lists)
            ? this.cfg.lists.filter(item => item && item.name && item.enabled !== false)
            : [];
        if (configured.length > 0)
            return configured;
        return [{ name: String(this.cfg.listName || 'SHOP').trim() || 'SHOP', enabled: true, priorityMarket: '' }];
    }
    listStateId(listName) {
        return `${this.alexaInstance}.Lists.${listName}.json`;
    }
    get markets() {
        const configured = Array.isArray(this.cfg.markets) ? this.cfg.markets : [];
        return configured.filter(market => market && market.name && market.enabled !== false);
    }
    get routes() {
        return this.runtimeRoutes.length ? this.runtimeRoutes : (Array.isArray(this.cfg.routes) ? this.cfg.routes.filter(Boolean) : []);
    }
    get productGroups() {
        const configured = Array.isArray(this.cfg.productGroups) ? this.cfg.productGroups : [];
        const source = configured.length > 0 ? configured : DEFAULT_CATEGORIES.map(name => ({ name }));
        const seen = new Set();
        const result = [];
        for (const entry of source) {
            const name = String(entry?.name || '').trim();
            const key = name.toLocaleLowerCase('de');
            if (!name || seen.has(key))
                continue;
            seen.add(key);
            result.push({ name });
        }
        return result.sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));
    }
    get products() {
        return this.runtimeProducts.filter(product => product && product.name);
    }
    get fallbackMarket() {
        return String(this.cfg.fallbackMarket || 'Ohne Markt').trim() || 'Ohne Markt';
    }
    get priorityMarket() {
        return String(this.cfg.priorityMarket || '').trim();
    }
    priorityMarketForList(listName) {
        if (this.temporaryPriorityMarket)
            return this.temporaryPriorityMarket;
        const list = this.listConfigs.find(entry => entry.name === listName);
        return String(list?.priorityMarket || this.priorityMarket || '').trim();
    }
    get learningMode() {
        const configured = String(this.cfg.learningMode || '').trim();
        if (configured === 'automatic' || configured === 'review' || configured === 'off')
            return configured;
        return this.cfg.autoLearnProducts === false ? 'off' : 'automatic';
    }
    get debounceMs() { return Math.max(250, Number(this.cfg.debounceMs) || 5000); }
    get sortStabilityDelayMs() { return Math.max(this.debounceMs, LIST_STABILITY_MS); }
    get writePauseMs() { return Math.max(250, Number(this.cfg.writePauseMs) || 1000); }
    get dryRun() { return this.cfg.dryRun !== false; }
    get apiSafeMode() { return this.cfg.apiSafeMode !== false; }
    get maxWritesPerMinute() { return Math.max(1, Number(this.cfg.maxWritesPerMinute) || 20); }
    get batchSize() { return Math.max(1, Number(this.cfg.batchSize) || 10); }
    get batchPauseMs() { return Math.max(0, Number(this.cfg.batchPauseMs) || 5000); }
    get maxWriteRetries() { return Math.max(0, Math.min(5, Number(this.cfg.maxWriteRetries) || 2)); }
    get retryBaseMs() { return Math.max(250, Number(this.cfg.retryBaseMs) || 1500); }
    get marketHeadersEnabled() { return this.cfg.marketHeaders === true; }
    get minimumItemsPerMarket() { return Math.max(1, Math.floor(Number(this.cfg.minItemsPerMarket) || 1)); }
    async onReady() {
        this.runtimeProducts = (Array.isArray(this.cfg.products) ? this.cfg.products : [])
            .filter(product => product && product.name)
            .map(product => ({ ...product }))
            .sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));
        this.runtimeReviews = (Array.isArray(this.cfg.reviewItems) ? this.cfg.reviewItems : []).map(item => ({ ...item }));
        this.runtimeRoutes = (0, config_tools_1.normalizeRoutesForAdmin)(Array.isArray(this.cfg.routes) ? this.cfg.routes.filter(Boolean) : []);
        this.routesDirty = JSON.stringify(this.runtimeRoutes) !== JSON.stringify(Array.isArray(this.cfg.routes) ? this.cfg.routes : []);
        await this.loadTrafficMetrics();
        await this.loadStatistics();
        const reviewResult = (0, sorter_1.applyReviewActions)(this.runtimeProducts, this.runtimeReviews);
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
        if (!enabled)
            await this.setStateAsync('control.enabled', true, true);
        const temp = await this.getStateAsync('control.temporaryPriorityMarket');
        const tempRaw = String(temp?.val ?? this.cfg.temporaryPriorityMarket ?? '').trim();
        this.temporaryPriorityMarket = tempRaw === '__none__' ? '' : tempRaw;
        await this.setStateAsync('control.temporaryPriorityMarket', this.temporaryPriorityMarket || '__none__', true);
        this.subscribeStates('control.*');
        for (const list of this.listConfigs)
            this.subscribeForeignStates(this.listStateId(list.name));
        let connected = false;
        for (const list of this.listConfigs) {
            const listState = await this.getForeignStateAsync(this.listStateId(list.name));
            if (!listState || typeof listState.val !== 'string') {
                this.log.warn(`Alexa-Liste nicht gefunden: ${this.listStateId(list.name)}`);
                continue;
            }
            connected = true;
            try {
                const parsed = JSON.parse(listState.val);
                const listItems = Array.isArray(parsed) ? parsed : [];
                const active = (0, sorter_1.activeItems)(listItems);
                const realActive = (0, market_plan_1.realActiveItems)(listItems, this.markets);
                this.knownActiveIds.set(list.name, new Set(active.map(item => String(item.id))));
                this.activeCountByList.set(list.name, realActive.length);
            }
            catch {
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
    async discoverAlexaLists(instanceName = this.alexaInstance) {
        const instance = String(instanceName || this.alexaInstance).trim() || this.alexaInstance;
        const prefix = `${instance}.Lists.`;
        const suffix = '.json';
        const names = new Set();
        try {
            const objects = await this.getForeignObjectsAsync(`${instance}.Lists.*.json`, 'state');
            for (const id of Object.keys(objects || {})) {
                if (!id.startsWith(prefix) || !id.endsWith(suffix))
                    continue;
                const name = id.slice(prefix.length, -suffix.length).trim();
                if (name && !name.includes('.'))
                    names.add(name);
            }
        }
        catch (error) {
            this.log.debug(`Alexa-Listen konnten für ${instance} nicht automatisch gelesen werden: ${String(error)}`);
        }
        // Keep already configured names available as a fallback, e.g. while Alexa2 is reconnecting.
        for (const list of this.listConfigs)
            if (list.name)
                names.add(String(list.name).trim());
        return [...names].filter(Boolean).sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
    }
    async onMessage(obj) {
        if (!obj || !obj.callback)
            return;
        if (obj.command === 'markAllReviewItemsAccept') {
            const supplied = obj.message?.native && typeof obj.message.native === 'object'
                ? { ...obj.message.native }
                : { ...this.cfg };
            const rows = Array.isArray(supplied.reviewItems)
                ? supplied.reviewItems
                : this.runtimeReviews;
            const updatedReviewItems = rows.map((item) => ({
                ...item,
                availableMarkets: Array.isArray(item?.availableMarkets)
                    ? item.availableMarkets
                        .map((value) => typeof value === 'string' ? value.trim() : '')
                        .filter(Boolean)
                        .join(',')
                    : String(item?.availableMarkets || ''),
                action: 'accept',
            }));
            this.sendTo(obj.from, obj.command, {
                native: {
                    reviewItems: updatedReviewItems,
                },
            }, obj.callback);
            return;
        }
        if (obj.command === 'normalizeMarketSelection') {
            const raw = obj.message?.value;
            const values = Array.isArray(raw)
                ? raw
                : String(raw || '').split(/[;,]/);
            const result = [];
            const seen = new Set();
            for (const value of values) {
                if (typeof value !== 'string')
                    continue;
                const trimmed = value.trim();
                const key = trimmed.toLocaleLowerCase('de');
                if (!trimmed || seen.has(key))
                    continue;
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
            const suppliedGroups = Array.isArray(obj.message?.productGroups)
                ? obj.message.productGroups
                    .map((group) => ({ name: String(group?.name || '').trim() }))
                    .filter((group) => Boolean(group.name))
                : this.productGroups;
            const options = suppliedGroups
                .map((group) => ({ value: group.name, label: group.name }))
                .sort((a, b) => a.label.localeCompare(b.label, 'de', { sensitivity: 'base' }));
            this.sendTo(obj.from, obj.command, options, obj.callback);
            return;
        }
        if (obj.command === 'getMarkets' || obj.command === 'getMarketsOptional' || obj.command === 'getActiveMarkets') {
            const suppliedMarkets = Array.isArray(obj.message?.markets)
                ? obj.message.markets
                    .map((market) => ({
                    name: String(market?.name || '').trim(),
                    enabled: market?.enabled !== false,
                }))
                    .filter((market) => Boolean(market.name))
                : this.markets;
            const sourceMarkets = obj.command === 'getActiveMarkets'
                ? suppliedMarkets.filter((market) => market.enabled !== false)
                : suppliedMarkets;
            const options = sourceMarkets
                .map((market) => ({ value: market.name, label: market.name }))
                .sort((a, b) => a.label.localeCompare(b.label, 'de', { sensitivity: 'base' }));
            if (obj.command === 'getMarketsOptional')
                options.unshift({ value: '', label: '—' });
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
    async onStateChange(id, state) {
        if (!state)
            return;
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
            this.traffic = (0, metrics_1.emptyTrafficMetrics)();
            await this.persistTrafficMetrics();
            return;
        }
        if (id === `${local}control.resetStatistics` && !state.ack && state.val === true) {
            await this.setStateAsync('control.resetStatistics', false, true);
            this.statistics = (0, statistics_1.emptyUsageStatistics)();
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
                const imported = (0, config_tools_1.parseConfigImport)(state.val);
                await this.setStateAsync('control.importConfigJson', '', true);
                await this.updateConfig(imported);
                this.log.info('ShoppingRoute-Konfiguration importiert; Instanz wird durch ioBroker neu gestartet.');
            }
            catch (error) {
                await this.setStateAsync('control.importConfigJson', '', true);
                await this.setError(`Konfigurationsimport fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
            }
            return;
        }
        if (id === `${local}control.marketProfileImport` && !state.ack && typeof state.val === 'string' && state.val.trim()) {
            try {
                const imported = (0, config_tools_1.importMarketProfile)(state.val, this.markets, this.routes);
                await this.setStateAsync('control.marketProfileImport', '', true);
                await this.updateConfig({ markets: imported.markets, routes: imported.routes });
                this.log.info(`Marktprofil „${imported.market}“ importiert.`);
            }
            catch (error) {
                await this.setStateAsync('control.marketProfileImport', '', true);
                await this.setError(`Marktprofil-Import fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
            }
            return;
        }
        if (id === `${local}control.enabled` && !state.ack) {
            await this.setStateAsync('control.enabled', Boolean(state.val), true);
            if (state.val === true)
                this.scheduleAll(this.sortStabilityDelayMs);
            return;
        }
        const list = this.listConfigs.find(entry => id === this.listStateId(entry.name));
        if (list) {
            await this.setStateAsync('info.connection', true, true);
            if (this.compatibilityTesting)
                return;
            if (this.sortingListName === list.name)
                this.listChangedDuringSort = true;
            this.scheduleSort(list.name, this.sortStabilityDelayMs);
        }
    }
    onUnload(callback) {
        if (this.sortTimer)
            this.clearTimeout(this.sortTimer);
        if (this.versionTimer)
            this.clearInterval(this.versionTimer);
        void this.setStateAsync('info.connection', false, true)
            .catch(() => undefined)
            .finally(callback);
    }
    scheduleAll(delay) {
        for (const list of this.listConfigs)
            this.pendingLists.add(list.name);
        this.armSortTimer(delay);
    }
    scheduleSort(listName, delay) {
        this.pendingLists.add(listName);
        this.armSortTimer(delay);
    }
    armSortTimer(delay) {
        if (this.sortTimer)
            this.clearTimeout(this.sortTimer);
        this.sortTimer = this.setTimeout(() => {
            this.sortTimer = null;
            void this.processPendingSorts();
        }, delay);
    }
    async processPendingSorts() {
        if (this.sortingListName)
            return;
        while (this.pendingLists.size > 0) {
            const listName = this.pendingLists.values().next().value;
            if (!listName)
                break;
            this.pendingLists.delete(listName);
            await this.sortList(listName);
        }
    }
    async isEnabled() {
        const state = await this.getStateAsync('control.enabled');
        return !state || state.val !== false;
    }
    async readList(listName) {
        const stateId = this.listStateId(listName);
        const state = await this.getForeignStateAsync(stateId);
        if (!state || typeof state.val !== 'string' || !state.val.trim())
            throw new Error(`Datenpunkt ${stateId} enthält keine lesbare Liste.`);
        const parsed = JSON.parse(state.val);
        if (!Array.isArray(parsed))
            throw new Error(`${stateId} enthält kein JSON-Array.`);
        return parsed;
    }
    async sortList(listName) {
        if (this.sortingListName) {
            this.pendingLists.add(listName);
            return;
        }
        if (!(await this.isEnabled()))
            return;
        this.sortingListName = listName;
        this.listChangedDuringSort = false;
        await this.ensureTrafficDay();
        this.traffic.localChecks += 1;
        await this.persistTrafficMetrics();
        try {
            const list = await this.readList(listName);
            const active = (0, sorter_1.activeItems)(list);
            const realActive = (0, market_plan_1.realActiveItems)(list, this.markets);
            this.activeCountByList.set(listName, realActive.length);
            await this.updateActiveItemCount();
            await this.recordNewItems(listName, list);
            const priority = this.priorityMarketForList(listName);
            let unknown = (0, sorter_1.collectUnknownItems)(list, this.markets, this.products, this.fallbackMarket, priority);
            if (this.learningMode === 'automatic') {
                const merged = (0, sorter_1.mergeUnknownProducts)(list, this.markets, this.products, this.fallbackMarket, priority);
                if (merged.learned.length > 0) {
                    this.runtimeProducts = merged.products;
                    this.productsDirty = true;
                    this.statistics.automaticLearned += merged.learned.length;
                    await this.persistStatistics();
                    await this.setStateAsync('info.lastLearnedItems', JSON.stringify(merged.learned, null, 2), true);
                    this.log.info(`Neue Artikel automatisch gelernt: ${merged.learned.map(product => `„${product.name}“`).join(', ')}.`);
                    unknown = (0, sorter_1.collectUnknownItems)(list, this.markets, this.products, this.fallbackMarket, priority);
                }
            }
            else if (this.learningMode === 'review') {
                const before = JSON.stringify(this.runtimeReviews);
                this.runtimeReviews = (0, sorter_1.mergeReviewQueue)(this.runtimeReviews, unknown);
                if (JSON.stringify(this.runtimeReviews) !== before)
                    this.reviewsDirty = true;
            }
            await this.setStateAsync('info.unknownItems', JSON.stringify({ listName, items: unknown }, null, 2), true);
            await this.setStateAsync('info.reviewQueue', JSON.stringify(this.runtimeReviews, null, 2), true);
            await this.updateAliasSuggestions(list);
            const required = (0, market_plan_1.requiredMarkets)(realActive, this.markets, this.products, this.fallbackMarket, priority, this.minimumItemsPerMarket);
            const headerAction = (0, market_plan_1.planMarketHeaderAction)(list, required, this.markets, this.fallbackMarket, this.marketHeadersEnabled);
            if (headerAction) {
                await this.setStateAsync('info.lastPlan', JSON.stringify({ listName, requiredMarkets: required, headerAction }, null, 2), true);
                if (this.dryRun) {
                    await this.setStateAsync('info.lastSort', `${new Date().toISOString()} – ${listName} Dry-Run: Marktüberschrift-Aktion ${headerAction.type} für ${headerAction.market} geplant`, true);
                    await this.setStateAsync('info.lastError', '', true);
                    return;
                }
                if (!(0, compatibility_1.canWriteAlexa)(this.writeCapability)) {
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
                await this.setStateAsync('info.lastSort', `${new Date().toISOString()} – ${listName}: Marktüberschrift ${headerAction.market} aktualisiert`, true);
                await this.setStateAsync('info.lastError', '', true);
                return;
            }
            const plan = (0, sorter_1.createSortPlan)(list, this.markets, this.routes, this.products, this.fallbackMarket, priority, this.minimumItemsPerMarket, this.marketHeadersEnabled);
            await this.setStateAsync('info.lastPlan', JSON.stringify({ listName, plan }, null, 2), true);
            await this.setStateAsync('info.preview', JSON.stringify({ listName, changes: plan.filter(entry => entry.changed), plan }, null, 2), true);
            await this.setStateAsync('info.previewText', (0, sorter_1.makePreviewText)(listName, plan), true);
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
                    await this.setStateAsync('info.lastSort', `${now} – ${listName} Dry-Run: ${visibleOrderWrites.length} Aktualisierung(en) der sichtbaren Reihenfolge geplant`, true);
                    await this.setStateAsync('info.lastError', '', true);
                    return;
                }
                if (!(0, compatibility_1.canWriteAlexa)(this.writeCapability)) {
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
                if (visibleResult.interrupted)
                    return;
                await this.setStateAsync('info.lastSort', `${new Date().toISOString()} – ${listName}: sichtbare Reihenfolge mit ${visibleResult.writes} inhaltsneutralen Schreibzugriff(en) korrigiert, ${active.length} aktiv`, true);
                await this.setStateAsync('info.lastError', '', true);
                return;
            }
            this.log.info(`${listName}: ${active.length} aktive Artikel, ${changes.length} Änderung(en)${this.dryRun ? ' [DRY-RUN]' : ''}.`);
            if (this.dryRun) {
                await this.setStateAsync('info.lastSort', `${now} – ${listName} Dry-Run: ${changes.length} Änderung(en) geplant`, true);
                await this.setStateAsync('info.lastError', '', true);
                return;
            }
            if (!(0, compatibility_1.canWriteAlexa)(this.writeCapability)) {
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
            const originalValues = Object.fromEntries(originalSnapshot.map(item => [String(item.id), String(item.value || '').trim()]));
            const targetValues = Object.fromEntries(plan.map(entry => [String(entry.id), String(entry.to || '').trim()]));
            const expectedValues = new Map(Object.entries(originalValues));
            const transactionId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
            const existingValues = [...Object.values(originalValues), ...Object.values(targetValues)];
            let program;
            let marker = '';
            for (let attempt = 0; attempt < 10; attempt++) {
                marker = (0, buffered_sort_1.createBufferedSortMarker)(transactionId, attempt, existingValues);
                try {
                    program = (0, buffered_sort_1.createBufferedSortProgram)(plan, marker);
                    break;
                }
                catch (error) {
                    if (!String(error).includes('kollidiert') || attempt === 9)
                        throw error;
                }
            }
            if (!program)
                throw new Error('Sortierpuffer konnte nicht erzeugt werden.');
            const journal = {
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
                    const beforeWrite = (0, sorter_1.compareActiveSnapshot)(originalSnapshot, fresh, expectedValues);
                    if ((0, sorter_1.activeSnapshotHasConflict)(beforeWrite)) {
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
                    const currentItem = (0, sorter_1.activeItems)(fresh).find(item => String(item.id) === step.id);
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
                    const beforeTs = Number(beforeState?.ts || 0);
                    await this.writeAlexaState(valueStateId, step.to);
                    const confirmation = await this.waitForAlexaValueConfirmation(listName, step.id, step.from, step.to, beforeTs);
                    if (confirmation === 'ambiguous') {
                        this.traffic.abortedRuns += 1;
                        await this.persistTrafficMetrics();
                        await this.activateSortSafetyStop(listName, `${listName}: Alexa2 hat Sortierschritt ${index + 1}/${program.steps.length} nicht eindeutig bestätigt.`, journal);
                        return;
                    }
                    if (confirmation === 'not-applied') {
                        this.traffic.abortedRuns += 1;
                        await this.persistTrafficMetrics();
                        const restored = await this.rollbackBufferedTransaction(journal);
                        if (!restored) {
                            await this.activateSortSafetyStop(listName, `${listName}: Sortierschritt ${index + 1}/${program.steps.length} wurde von Alexa2 verworfen.`, journal);
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
                    const afterWrite = (0, sorter_1.compareActiveSnapshot)(originalSnapshot, confirmedList, expectedValues);
                    if ((0, sorter_1.activeSnapshotHasConflict)(afterWrite)) {
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
                        if (this.apiSafeMode &&
                            written % this.batchSize === 0 &&
                            this.batchPauseMs > 0) {
                            this.log.info(`API-Schonmodus: Batch-Pause nach ${written} Schreibzugriffen (${this.batchPauseMs} ms).`);
                            await this.wait(this.batchPauseMs);
                        }
                        else if (this.writePauseMs > 0) {
                            await this.wait(this.writePauseMs);
                        }
                    }
                }
                const verifyList = await this.readList(listName);
                const targetMap = new Map(Object.entries(targetValues));
                const verification = (0, sorter_1.compareActiveSnapshot)(originalSnapshot, verifyList, targetMap);
                if ((0, sorter_1.activeSnapshotHasConflict)(verification)) {
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
            }
            catch (error) {
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
            if (visibleResult.interrupted)
                return;
            await this.setStateAsync('info.lastSort', `${new Date().toISOString()} – ${listName}: ${program.changedSlots} Änderung(en), ${program.amazonWrites} gepufferte Schreibzugriffe, ${visibleResult.writes} Reihenfolge-Schreibzugriff(e), ${active.length} Ausgangseinträge`, true);
            await this.setStateAsync('info.lastError', '', true);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await this.setError(message);
            this.log.error(message);
        }
        finally {
            this.sortingListName = '';
            await this.persistRuntimeConfig();
            await this.refreshExports();
            await this.updateFeedbackReport();
            if (this.listChangedDuringSort)
                this.pendingLists.add(listName);
            if (this.pendingLists.size > 0)
                this.armSortTimer(this.sortStabilityDelayMs);
        }
    }
    visibleOrderRefreshIds(list, plan) {
        const orderedPlan = [...plan].sort((left, right) => Number(left.position) - Number(right.position));
        const desiredIds = orderedPlan.map(entry => String(entry.id));
        const desiredSet = new Set(desiredIds);
        const relevant = (0, sorter_1.activeItems)(list).filter(item => desiredSet.has(String(item.id)));
        if (relevant.length !== desiredIds.length) {
            throw new Error('Sichtbare Reihenfolge kann nicht geprüft werden: Ein geplanter aktiver Alexa-Eintrag fehlt.');
        }
        const currentIds = (0, buffered_sort_1.sortIdsByAlexaUpdatedTime)(relevant);
        return (0, buffered_sort_1.createVisibleOrderRefreshPlan)(currentIds, desiredIds);
    }
    async readAlexaWriteSnapshot(listName, id) {
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
        const parsed = JSON.parse(listState.val);
        if (!Array.isArray(parsed))
            throw new Error(`${this.listStateId(listName)} enthält kein JSON-Array.`);
        const list = parsed;
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
                version: versionState?.val,
                updatedDateTime: updatedState?.val,
                acknowledged: state?.ack === true,
                versionAcknowledged: versionState?.ack === true,
                updatedDateTimeAcknowledged: updatedState?.ack === true,
            },
        };
    }
    async refreshVisibleAlexaOrder(listName, plan) {
        const orderedPlan = [...plan].sort((left, right) => Number(left.position) - Number(right.position));
        const desiredIds = orderedPlan.map(entry => String(entry.id));
        const desiredSet = new Set(desiredIds);
        const expectedValues = new Map(orderedPlan.map(entry => [String(entry.id), String(entry.to || '').trim()]));
        const firstList = await this.readList(listName);
        let additionalItems = (0, sorter_1.activeItems)(firstList).some(item => !desiredSet.has(String(item.id)));
        if (additionalItems) {
            this.pendingLists.add(listName);
            this.log.warn(`${listName}: Neuer aktiver Alexa-Listeneintrag vor der Reihenfolge-Finalisierung erkannt; Finalisierung abgebrochen. Neue Berechnung folgt nach Synchronisationsruhe.`);
            return { writes: 0, interrupted: true, additionalItems: true };
        }
        let touchIds;
        try {
            touchIds = this.visibleOrderRefreshIds(firstList, orderedPlan);
        }
        catch (error) {
            this.pendingLists.add(listName);
            this.log.warn(`${listName}: Sichtbare Reihenfolge wird neu berechnet: ${error instanceof Error ? error.message : String(error)}`);
            return { writes: 0, interrupted: true, additionalItems };
        }
        if (touchIds.length === 0)
            return { writes: 0, interrupted: false, additionalItems };
        let writes = 0;
        for (let index = 0; index < touchIds.length; index++) {
            const id = touchIds[index];
            const fresh = await this.readList(listName);
            const active = (0, sorter_1.activeItems)(fresh);
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
                await this.activateSortSafetyStop(listName, `${listName}: Alexa-Wertedatenpunkt für die sichtbare Reihenfolge fehlt: ${valueStateId}`);
                return { writes, interrupted: true, additionalItems };
            }
            const transactionId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
            const marker = (0, buffered_sort_1.createVisibleOrderMarker)(transactionId, index, expectedValues.values());
            const touchProgram = (0, buffered_sort_1.createVisibleOrderTouchProgram)(id, expectedValue, marker);
            const journal = {
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
            const markerBaseline = await this.readAlexaWriteSnapshot(listName, id);
            await this.writeAlexaState(valueStateId, marker);
            const markerConfirmation = await this.waitForAlexaValueConfirmation(listName, id, expectedValue, marker, 0, markerBaseline);
            if (markerConfirmation !== 'confirmed') {
                await this.activateSortSafetyStop(listName, `${listName}: Temporärer Reihenfolge-Marker für ID ${id} wurde nicht eindeutig bestätigt.`, journal);
                return { writes, interrupted: true, additionalItems };
            }
            journal.confirmedSteps = 1;
            await this.persistSortTransaction(journal);
            const restoreBaseline = await this.readAlexaWriteSnapshot(listName, id);
            await this.writeAlexaState(valueStateId, expectedValue);
            const restored = await this.waitForAlexaValueConfirmation(listName, id, marker, expectedValue, 0, restoreBaseline);
            if (restored !== 'confirmed') {
                await this.activateSortSafetyStop(listName, restored === 'not-applied'
                    ? `${listName}: Rückschreibung des Originaltexts für ID ${id} wurde nicht bestätigt.`
                    : `${listName}: Rückschreibung des Originaltexts für ID ${id} ist nicht eindeutig auflösbar.`, journal);
                return { writes, interrupted: true, additionalItems };
            }
            journal.confirmedSteps = 2;
            await this.persistSortTransaction(journal);
            await this.persistSortTransaction(null);
            writes += touchProgram.amazonWrites;
            if (index + 1 < touchIds.length) {
                if (this.apiSafeMode &&
                    (index + 1) % this.batchSize === 0 &&
                    this.batchPauseMs > 0) {
                    this.log.info(`API-Schonmodus: Batch-Pause nach ${index + 1} Reihenfolge-Aktualisierung(en) (${this.batchPauseMs} ms).`);
                    await this.wait(this.batchPauseMs);
                }
                else if (this.writePauseMs > 0) {
                    await this.wait(this.writePauseMs);
                }
            }
        }
        const verifyList = await this.readList(listName);
        if ((0, sorter_1.activeItems)(verifyList).some(item => !desiredSet.has(String(item.id)))) {
            additionalItems = true;
            this.pendingLists.add(listName);
            this.log.warn(`${listName}: Neuer aktiver Alexa-Listeneintrag bei der Abschlussprüfung erkannt; neue Berechnung folgt nach Synchronisationsruhe.`);
            return { writes, interrupted: true, additionalItems };
        }
        let remaining;
        try {
            remaining = this.visibleOrderRefreshIds(verifyList, orderedPlan);
        }
        catch (error) {
            this.pendingLists.add(listName);
            this.log.warn(`${listName}: Abschlussprüfung der sichtbaren Reihenfolge wird neu berechnet: ${error instanceof Error ? error.message : String(error)}`);
            return { writes, interrupted: true, additionalItems };
        }
        if (remaining.length > 0) {
            await this.activateSortSafetyStop(listName, `${listName}: Alexa2 hat die sichtbare Zielreihenfolge trotz bestätigter Marker-Aktualisierungen nicht hergestellt.`);
            return { writes, interrupted: true, additionalItems };
        }
        return { writes, interrupted: false, additionalItems };
    }
    async persistSortTransaction(journal) {
        await this.setStateAsync('info.sortTransaction', journal ? JSON.stringify(journal, null, 2) : '{}', true);
    }
    async readSortTransaction() {
        const state = await this.getStateAsync('info.sortTransaction');
        const raw = String(state?.val || '').trim();
        if (!raw || raw === '{}')
            return null;
        try {
            const parsed = JSON.parse(raw);
            if (parsed?.version !== 1 ||
                !parsed.listName ||
                !parsed.marker ||
                !Array.isArray(parsed.steps) ||
                !Number.isInteger(parsed.confirmedSteps) ||
                parsed.confirmedSteps < 0 ||
                parsed.confirmedSteps > parsed.steps.length ||
                !parsed.originalValues ||
                !parsed.targetValues ||
                !['applying', 'rollback', 'failed-applying', 'failed-rollback'].includes(parsed.status)) {
                throw new Error('ungültige Journal-Struktur');
            }
            return parsed;
        }
        catch (error) {
            throw new Error(`Sortierjournal ist beschädigt: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async waitForAlexaValueConfirmation(listName, id, from, to, previousTs = 0, previousEvidence, timeoutMs = ALEXA_CONFIRMATION_TIMEOUT_MS) {
        const valueStateId = `${this.alexaInstance}.Lists.${listName}.items.${id}.value`;
        return (0, confirmation_wait_1.waitForConfirmation)({
            timeoutMs,
            pollIntervalMs: ALEXA_CONFIRMATION_POLL_MS,
            pause: ms => this.wait(ms),
            probe: async () => {
                if (previousEvidence) {
                    const currentEvidence = await this.readAlexaWriteSnapshot(listName, id);
                    return (0, alexa_write_confirmation_1.classifyAlexaWriteConfirmation)(from, to, previousEvidence.json, previousEvidence.item, currentEvidence.json, currentEvidence.item);
                }
                const [state, list] = await Promise.all([
                    this.getForeignStateAsync(valueStateId),
                    this.readList(listName),
                ]);
                const item = list.find(entry => String(entry?.id || '') === id);
                const listValue = item ? String(item.value || '').trim() : undefined;
                const stateValue = state ? String(state.val ?? '').trim() : undefined;
                const stateTs = Number(state?.ts || 0);
                if (listValue === to && stateValue === to && state?.ack === true && stateTs >= previousTs) {
                    return 'confirmed';
                }
                if (listValue === from && stateValue === from && state?.ack === true)
                    return 'not-applied';
                return 'ambiguous';
            },
        });
    }
    async reconcilePendingTransactionStep(journal) {
        if (journal.confirmedSteps >= journal.steps.length)
            return 'confirmed';
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
        if (listValue === step.from && stateValue === step.from && state?.ack === true)
            return 'not-applied';
        if (stateValue === step.to && state?.ack === false) {
            const result = await this.waitForAlexaValueConfirmation(journal.listName, step.id, step.from, step.to, Number(state?.ts || 0));
            if (result === 'confirmed') {
                journal.confirmedSteps += 1;
                await this.persistSortTransaction(journal);
            }
            return result;
        }
        return 'ambiguous';
    }
    async reconcilePendingRollbackStep(journal) {
        if (journal.confirmedSteps <= 0)
            return 'confirmed';
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
        if (listValue === step.to && stateValue === step.to && state?.ack === true)
            return 'not-applied';
        if (stateValue === step.from && state?.ack === false) {
            const result = await this.waitForAlexaValueConfirmation(journal.listName, step.id, step.to, step.from, Number(state?.ts || 0));
            if (result === 'confirmed') {
                journal.confirmedSteps -= 1;
                await this.persistSortTransaction(journal);
            }
            return result;
        }
        return 'ambiguous';
    }
    async rollbackBufferedTransaction(journal) {
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
                const beforeState = await this.getForeignStateAsync(valueStateId);
                const beforeTs = Number(beforeState?.ts || 0);
                await this.writeAlexaState(valueStateId, step.from);
                const confirmation = await this.waitForAlexaValueConfirmation(journal.listName, step.id, step.to, step.from, beforeTs);
                if (confirmation !== 'confirmed') {
                    this.log.error(`${journal.listName}: Rollback-Schritt für ID ${step.id} wurde nicht eindeutig bestätigt.`);
                    return false;
                }
                journal.confirmedSteps -= 1;
                await this.persistSortTransaction(journal);
                if (journal.confirmedSteps > 0 && this.writePauseMs > 0) {
                    await this.wait(this.writePauseMs);
                }
            }
            catch (error) {
                this.log.error(`${journal.listName}: Rollback für ID ${step.id} fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
                return false;
            }
        }
        await this.persistSortTransaction(null);
        return true;
    }
    async transactionMatchesTarget(journal) {
        const list = await this.readList(journal.listName);
        const values = new Map(list.map(item => [String(item?.id || ''), String(item?.value || '').trim()]));
        for (const [id, expected] of Object.entries(journal.targetValues)) {
            if (values.get(id) !== expected)
                return false;
        }
        return true;
    }
    async recoverInterruptedSortTransaction() {
        let journal;
        try {
            journal = await this.readSortTransaction();
        }
        catch (error) {
            await this.activateSortSafetyStop('unbekannt', error instanceof Error ? error.message : String(error));
            return;
        }
        if (!journal)
            return;
        this.log.warn(`${journal.listName}: Unterbrochene Sortiertransaktion ${journal.transactionId} gefunden; Wiederherstellung startet.`);
        if (!(0, compatibility_1.canWriteAlexa)(this.writeCapability)) {
            await this.activateSortSafetyStop(journal.listName, `${journal.listName}: Unterbrochene Sortierung kann wegen fehlender Alexa-Schreibfreigabe nicht wiederhergestellt werden.`, journal);
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
                    await this.activateSortSafetyStop(journal.listName, `${journal.listName}: Letzter Rollback-Schritt der unterbrochenen Transaktion ist nicht eindeutig auflösbar.`, journal);
                    return;
                }
            }
            else if (journal.confirmedSteps < journal.steps.length) {
                const pending = await this.reconcilePendingTransactionStep(journal);
                if (pending === 'ambiguous') {
                    await this.activateSortSafetyStop(journal.listName, `${journal.listName}: Letzter Sortierschritt der unterbrochenen Transaktion ist nicht eindeutig auflösbar.`, journal);
                    return;
                }
            }
            const restored = await this.rollbackBufferedTransaction(journal);
            if (!restored) {
                await this.activateSortSafetyStop(journal.listName, `${journal.listName}: Unterbrochene Sortierung konnte nicht vollständig zurückgesetzt werden.`, journal);
                return;
            }
            this.log.warn(`${journal.listName}: Unterbrochene Sortierung wurde anhand des lokalen Journals vollständig rückwärts aufgelöst.`);
        }
        catch (error) {
            await this.activateSortSafetyStop(journal.listName, `${journal.listName}: Wiederherstellung der unterbrochenen Sortierung fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`, journal);
        }
    }
    async activateSortSafetyStop(listName, reason, journal) {
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
    async applyMarketHeaderAction(listName, action) {
        const stateId = action.type === 'create'
            ? `${this.alexaInstance}.Lists.${listName}.#New`
            : `${this.alexaInstance}.Lists.${listName}.items.${action.id}.#delete`;
        const value = action.type === 'create' ? action.value : true;
        const stateObject = await this.getForeignObjectAsync(stateId);
        if (!stateObject)
            throw new Error(`Alexa-Datenpunkt für Marktüberschrift fehlt: ${stateId}`);
        await this.writeAlexaState(stateId, value);
        this.log.info(`${listName}: Marktüberschrift ${action.market} – ${action.type}.`);
    }
    async writeAlexaState(stateId, value) {
        let lastError;
        for (let attempt = 0; attempt <= this.maxWriteRetries; attempt++) {
            try {
                if (this.apiSafeMode)
                    await this.waitForWriteBudget();
                await this.setForeignStateAsync(stateId, { val: value, ack: false });
                this.writeTimestamps.push(Date.now());
                this.traffic.alexaWrites += 1;
                this.traffic.lastAlexaWrite = new Date().toISOString();
                await this.persistTrafficMetrics();
                return;
            }
            catch (error) {
                lastError = error;
                if (attempt >= this.maxWriteRetries)
                    break;
                const delay = this.retryBaseMs * Math.pow(2, attempt);
                this.log.warn(`Alexa-Schreibzugriff fehlgeschlagen; Retry ${attempt + 1}/${this.maxWriteRetries} in ${delay} ms.`);
                await this.wait(delay);
            }
        }
        throw lastError instanceof Error ? lastError : new Error(String(lastError));
    }
    async waitForWriteBudget() {
        while (true) {
            const now = Date.now();
            this.writeTimestamps = this.writeTimestamps.filter(timestamp => now - timestamp < 60000);
            if (this.writeTimestamps.length < this.maxWritesPerMinute)
                return;
            const waitMs = Math.max(500, 60000 - (now - this.writeTimestamps[0]) + 100);
            this.log.info(`API-Schonmodus: Schreiblimit ${this.maxWritesPerMinute}/Minute erreicht, Pause ${waitMs} ms.`);
            await this.wait(waitMs);
        }
    }
    async updateAliasSuggestions(list) {
        if (this.cfg.autoAliasSuggestions === false) {
            await this.setStateAsync('info.aliasSuggestions', '[]', true);
            return;
        }
        const suggestions = [];
        for (const item of (0, sorter_1.activeItems)(list)) {
            if ((0, market_plan_1.isMarketHeader)(String(item.value), this.markets))
                continue;
            const parsed = (0, parser_1.parseItem)(String(item.value), this.markets, this.products, this.fallbackMarket, this.priorityMarket);
            const product = (0, parser_1.findProduct)(parsed.productText, this.products);
            if (!product)
                continue;
            for (const alias of (0, parser_1.suggestAliases)(parsed.productText, product))
                suggestions.push({ product: product.name, alias });
        }
        const unique = [...new Map(suggestions.map(entry => [`${entry.product}|${entry.alias}`.toLocaleLowerCase('de'), entry])).values()];
        await this.setStateAsync('info.aliasSuggestions', JSON.stringify(unique, null, 2), true);
    }
    async recordNewItems(listName, list) {
        const active = (0, sorter_1.activeItems)(list);
        const previous = this.knownActiveIds.get(listName);
        const current = new Set(active.map(item => String(item.id)));
        if (!previous) {
            this.knownActiveIds.set(listName, current);
            return;
        }
        for (const item of active) {
            if (previous.has(String(item.id)))
                continue;
            if ((0, market_plan_1.isMarketHeader)(String(item.value), this.markets))
                continue;
            const parsed = (0, parser_1.parseItem)(String(item.value), this.markets, this.products, this.fallbackMarket, this.priorityMarketForList(listName));
            this.statistics = (0, statistics_1.recordAddedItem)(this.statistics, listName, parsed);
        }
        this.knownActiveIds.set(listName, current);
        await this.persistStatistics();
    }
    async updateActiveItemCount() {
        const total = [...this.activeCountByList.values()].reduce((sum, value) => sum + value, 0);
        await this.setStateAsync('info.activeItems', total, true);
        await this.setStateAsync('info.activeItemsByList', JSON.stringify(Object.fromEntries(this.activeCountByList), null, 2), true);
    }
    async runStartupCompatibilityCheck() {
        try {
            const alexaObject = await this.getForeignObjectAsync(`system.adapter.${this.alexaInstance}`);
            const alexaVersion = alexaObject?.common?.version;
            this.alexa2Version = typeof alexaVersion === 'string' ? alexaVersion : 'unbekannt';
        }
        catch {
            this.alexa2Version = 'unbekannt';
        }
        try {
            const resolved = require.resolve('alexa-remote2');
            const source = fs.readFileSync(resolved, 'utf8');
            const inspection = (0, compatibility_1.inspectAlexaRemoteSource)(source);
            this.writeCapability = inspection.status;
            this.compatibilityDetail = inspection.detail;
            this.alexaRemote2Version = this.findPackageVersion(resolved, 'alexa-remote2');
        }
        catch (error) {
            this.writeCapability = 'unknown';
            this.compatibilityDetail = `alexa-remote2 konnte nicht automatisch geprüft werden: ${error instanceof Error ? error.message : String(error)}`;
            this.alexaRemote2Version = 'unbekannt';
        }
        await this.updateCompatibilityDiagnostics();
    }
    findPackageVersion(moduleFile, expectedName) {
        let current = path.dirname(moduleFile);
        for (let level = 0; level < 6; level++) {
            const packageFile = path.join(current, 'package.json');
            try {
                const parsed = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
                if (parsed.name === expectedName && parsed.version)
                    return parsed.version;
            }
            catch { /* continue */ }
            const parent = path.dirname(current);
            if (parent === current)
                break;
            current = parent;
        }
        return 'unbekannt';
    }
    async runLiveCompatibilityTest() {
        if (this.compatibilityTesting || this.sortingListName)
            return;
        this.compatibilityTesting = true;
        try {
            const listName = this.listConfigs[0]?.name;
            if (!listName)
                throw new Error('Keine aktive Alexa-Liste konfiguriert.');
            const list = await this.readList(listName);
            const item = (0, sorter_1.sortSlotsOldestFirst)((0, sorter_1.activeItems)(list))[0];
            if (!item)
                throw new Error('Für den Kompatibilitätstest wird mindestens ein aktiver Listeneintrag benötigt.');
            const valueStateId = `${this.alexaInstance}.Lists.${listName}.items.${item.id}.value`;
            const before = await this.getForeignStateAsync(valueStateId);
            const originalValue = String(before?.val ?? item.value).trim();
            if (!originalValue)
                throw new Error('Der Testeintrag enthält keinen sichtbaren value-Text.');
            const beforeTs = Number(before?.ts || 0);
            await this.setForeignStateAsync(valueStateId, { val: originalValue, ack: false });
            this.traffic.alexaWrites += 1;
            this.traffic.compatibilityWrites += 1;
            this.traffic.lastAlexaWrite = new Date().toISOString();
            await this.persistTrafficMetrics();
            const confirmation = await (0, confirmation_wait_1.waitForConfirmation)({
                timeoutMs: ALEXA_CONFIRMATION_TIMEOUT_MS,
                pollIntervalMs: ALEXA_CONFIRMATION_POLL_MS,
                pause: ms => this.wait(ms),
                probe: async () => {
                    const current = await this.getForeignStateAsync(valueStateId);
                    return current &&
                        current.ack === true &&
                        String(current.val ?? '').trim() === originalValue &&
                        Number(current.ts || 0) > beforeTs
                        ? 'confirmed'
                        : 'ambiguous';
                },
            });
            if (confirmation === 'confirmed') {
                this.writeCapability = 'live-ok';
                this.compatibilityDetail = 'Live-Test erfolgreich: Alexa2 hat einen unveränderten value-Schreibzugriff bestätigt.';
                this.lastCompatibilityTest = `${new Date().toISOString()} – ERFOLG mit „${originalValue}“`;
                await this.setStateAsync('info.lastError', '', true);
            }
            else {
                this.writeCapability = 'live-failed';
                this.compatibilityDetail = 'Live-Test fehlgeschlagen: Alexa2 hat den value-Schreibzugriff nicht innerhalb von 10 Sekunden bestätigt.';
                this.lastCompatibilityTest = `${new Date().toISOString()} – FEHLGESCHLAGEN mit „${originalValue}“`;
                await this.setStateAsync('info.lastError', 'Alexa-Schreibkompatibilitätstest fehlgeschlagen; Sortierschreibzugriffe bleiben blockiert.', true);
            }
            await this.updateCompatibilityDiagnostics();
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.writeCapability = 'live-failed';
            this.compatibilityDetail = `Live-Test konnte nicht abgeschlossen werden: ${message}`;
            this.lastCompatibilityTest = `${new Date().toISOString()} – FEHLER: ${message}`;
            await this.setStateAsync('info.lastError', `Kompatibilitätstest: ${message}`, true);
            await this.updateCompatibilityDiagnostics();
        }
        finally {
            this.compatibilityTesting = false;
        }
    }
    async updateCompatibilityDiagnostics() {
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
    async updateTemporaryMarketStateOptions() {
        try {
            const states = { __none__: '— Kein Markt —' };
            for (const market of [...this.markets].sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }))) {
                states[market.name] = market.name;
            }
            await this.extendObjectAsync('control.temporaryPriorityMarket', { common: { states } });
        }
        catch (error) {
            this.log.warn(`Temporäre Markt-Auswahlliste konnte nicht aktualisiert werden: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async ensureProductGroupsConfig() {
        if (Array.isArray(this.cfg.productGroups) && this.cfg.productGroups.length > 0)
            return;
        try {
            await this.updateConfig({ productGroups: DEFAULT_CATEGORIES.map(name => ({ name })) });
        }
        catch (error) {
            this.log.warn(`Produktgruppen konnten nicht initialisiert werden: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async persistRuntimeConfig() {
        if (!this.productsDirty && !this.reviewsDirty && !this.routesDirty)
            return;
        try {
            const instanceId = `system.adapter.${this.namespace}`;
            const object = await this.getForeignObjectAsync(instanceId);
            if (!object)
                throw new Error(`Instanzobjekt nicht gefunden: ${instanceId}`);
            const currentNative = (object.native || {});
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
        }
        catch (error) {
            await this.setStateAsync('info.lastError', `Lern-/Konfigurationsdaten konnten nicht gespeichert werden: ${error instanceof Error ? error.message : String(error)}`, true);
        }
    }
    async refreshExports() {
        const cfg = { ...this.cfg, products: this.runtimeProducts, routes: this.routes, reviewItems: this.runtimeReviews };
        await this.setStateAsync('info.configExport', JSON.stringify((0, config_tools_1.exportConfig)(cfg, VERSION), null, 2), true);
        await this.setStateAsync('info.marketProfiles', JSON.stringify((0, config_tools_1.buildMarketProfiles)(this.markets, this.routes), null, 2), true);
    }
    async loadTrafficMetrics() {
        try {
            const state = await this.getStateAsync('info.traffic');
            this.traffic = (0, metrics_1.normalizeTrafficMetrics)(state && typeof state.val === 'string' && state.val.trim() ? JSON.parse(state.val) : null);
        }
        catch {
            this.traffic = (0, metrics_1.emptyTrafficMetrics)();
        }
        await this.persistTrafficMetrics();
    }
    async ensureTrafficDay() {
        const normalized = (0, metrics_1.normalizeTrafficMetrics)(this.traffic);
        if (normalized.date !== this.traffic.date) {
            this.traffic = normalized;
            await this.persistTrafficMetrics();
        }
    }
    async persistTrafficMetrics() {
        this.traffic = (0, metrics_1.normalizeTrafficMetrics)(this.traffic);
        await this.setStateAsync('info.localChecksToday', this.traffic.localChecks, true);
        await this.setStateAsync('info.plannedChangesToday', this.traffic.plannedChanges, true);
        await this.setStateAsync('info.sortRunsToday', this.traffic.sortRuns, true);
        await this.setStateAsync('info.alexaWritesToday', this.traffic.alexaWrites, true);
        await this.setStateAsync('info.compatibilityWritesToday', this.traffic.compatibilityWrites, true);
        await this.setStateAsync('info.abortedRunsToday', this.traffic.abortedRuns, true);
        await this.setStateAsync('info.traffic', JSON.stringify({ ...this.traffic, note: 'Zählt Operationen, keine Netzwerk-Bytes.' }, null, 2), true);
    }
    async loadStatistics() {
        try {
            const state = await this.getStateAsync('info.statistics');
            this.statistics = (0, statistics_1.normalizeUsageStatistics)(state && typeof state.val === 'string' && state.val.trim() ? JSON.parse(state.val) : null);
        }
        catch {
            this.statistics = (0, statistics_1.emptyUsageStatistics)();
        }
        await this.persistStatistics();
    }
    async persistStatistics() {
        this.statistics.lastUpdated = new Date().toISOString();
        await this.setStateAsync('info.statistics', JSON.stringify(this.statistics, null, 2), true);
    }
    async checkNpmVersion() {
        try {
            const data = await this.httpJson('https://registry.npmjs.org/iobroker.shoppingroute');
            const tags = (data['dist-tags'] || {});
            const betaTag = typeof tags.beta === 'string' ? tags.beta : '';
            const latestTag = typeof tags.latest === 'string' ? tags.latest : '';
            this.latestBetaVersion = betaTag || latestTag;
            this.lastVersionCheck = new Date().toISOString();
            await this.setStateAsync('info.versionBeta', this.latestBetaVersion || 'unbekannt', true);
            await this.setStateAsync('info.updateAvailable', Boolean(this.latestBetaVersion && this.latestBetaVersion !== VERSION), true);
            await this.setStateAsync('info.versionCheck', `${this.lastVersionCheck} – npm beta: ${this.latestBetaVersion || 'unbekannt'}`, true);
        }
        catch (error) {
            this.lastVersionCheck = new Date().toISOString();
            await this.setStateAsync('info.versionCheck', `${this.lastVersionCheck} – npm-Abfrage fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`, true);
        }
        await this.updateFeedbackReport();
    }
    httpJson(url) {
        return new Promise((resolve, reject) => {
            const request = https.get(url, { headers: { 'User-Agent': `ioBroker.shoppingroute/${VERSION}` } }, (response) => {
                if ((response.statusCode || 500) >= 400) {
                    response.resume();
                    reject(new Error(`HTTP ${response.statusCode}`));
                    return;
                }
                let data = '';
                response.setEncoding('utf8');
                response.on('data', (chunk) => { data += chunk; });
                response.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    }
                    catch (error) {
                        reject(error instanceof Error ? error : new Error('Ungültige JSON-Antwort'));
                    }
                });
            });
            request.setTimeout(8000, () => request.destroy(new Error('Timeout')));
            request.on('error', reject);
        });
    }
    async updateFeedbackReport() {
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
    async setError(message) {
        await this.setStateAsync('info.lastError', message, true);
    }
    wait(ms) { return new Promise(resolve => this.setTimeout(resolve, ms)); }
    static getDefaultCategories() { return [...DEFAULT_CATEGORIES]; }
}
exports.ShoppingRoute = ShoppingRoute;
if (require.main !== module)
    module.exports = (options) => new ShoppingRoute(options);
else
    (() => new ShoppingRoute())();
//# sourceMappingURL=main.js.map