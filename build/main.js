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
const parser_1 = require("./lib/parser");
const config_tools_1 = require("./lib/config-tools");
const statistics_1 = require("./lib/statistics");
const VERSION = '0.2.0-beta.11';
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
    get writePauseMs() { return Math.max(250, Number(this.cfg.writePauseMs) || 1000); }
    get dryRun() { return this.cfg.dryRun !== false; }
    get apiSafeMode() { return this.cfg.apiSafeMode !== false; }
    get maxWritesPerMinute() { return Math.max(1, Number(this.cfg.maxWritesPerMinute) || 20); }
    get batchSize() { return Math.max(1, Number(this.cfg.batchSize) || 10); }
    get batchPauseMs() { return Math.max(0, Number(this.cfg.batchPauseMs) || 5000); }
    get maxWriteRetries() { return Math.max(0, Math.min(5, Number(this.cfg.maxWriteRetries) || 2)); }
    get retryBaseMs() { return Math.max(250, Number(this.cfg.retryBaseMs) || 1500); }
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
        this.ensureRoutesForMarketsAndGroups();
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
                const active = (0, sorter_1.activeItems)(Array.isArray(parsed) ? parsed : []);
                this.knownActiveIds.set(list.name, new Set(active.map(item => String(item.id))));
                this.activeCountByList.set(list.name, active.length);
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
        await this.refreshExports();
        await this.checkNpmVersion();
        await this.updateFeedbackReport();
        this.versionTimer = this.setInterval(() => void this.checkNpmVersion(), 6 * 60 * 60 * 1000);
        this.log.warn(`ShoppingRoute ${VERSION} BETA: Dry-Run ist für Ersttests ausdrücklich empfohlen.`);
        this.log.info(`Listen: ${this.listConfigs.map(item => item.name).join(', ')}. Lernmodus: ${this.learningMode}.`);
        this.log.info('WICHTIG: Die Alexa-App muss für jede verwaltete Liste auf „Älteste bis neueste“ gestellt sein.');
        this.scheduleAll(700);
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
        if (obj.command === 'getBackupUiUrl') {
            this.sendTo(obj.from, obj.command, {
                openUrl: `./adapter/shoppingroute/backup-transfer.html?instance=${encodeURIComponent(this.namespace)}`,
                window: 'shoppingrouteBackup',
            }, obj.callback);
            return;
        }
        if (obj.command === 'getProductGroups') {
            const options = this.productGroups.map(group => ({ value: group.name, label: group.name }))
                .sort((a, b) => a.label.localeCompare(b.label, 'de', { sensitivity: 'base' }));
            this.sendTo(obj.from, obj.command, options, obj.callback);
            return;
        }
        if (obj.command === 'getMarkets' || obj.command === 'getMarketsOptional' || obj.command === 'getActiveMarkets') {
            const sourceMarkets = obj.command === 'getActiveMarkets' ? this.markets.filter(market => market.enabled !== false) : this.markets;
            const options = sourceMarkets.map(market => ({ value: market.name, label: market.name }))
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
            this.scheduleAll(100);
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
            this.scheduleAll(100);
            return;
        }
        if (id === `${local}control.temporaryPriorityMarket` && !state.ack) {
            const selectedMarket = typeof state.val === 'string' ? state.val.trim() : '';
            this.temporaryPriorityMarket = selectedMarket === '__none__' ? '' : selectedMarket;
            await this.setStateAsync('control.temporaryPriorityMarket', this.temporaryPriorityMarket || '__none__', true);
            this.scheduleAll(100);
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
                this.scheduleAll(250);
            return;
        }
        const list = this.listConfigs.find(entry => id === this.listStateId(entry.name));
        if (list) {
            await this.setStateAsync('info.connection', true, true);
            if (this.compatibilityTesting)
                return;
            if (this.sortingListName === list.name)
                this.listChangedDuringSort = true;
            this.scheduleSort(list.name, this.debounceMs);
        }
    }
    onUnload(callback) {
        if (this.sortTimer)
            this.clearTimeout(this.sortTimer);
        if (this.versionTimer)
            this.clearInterval(this.versionTimer);
        void this.setState('info.connection', false, true);
        callback();
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
            this.activeCountByList.set(listName, active.length);
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
            const plan = (0, sorter_1.createSortPlan)(list, this.markets, this.routes, this.products, this.fallbackMarket, priority);
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
                await this.setStateAsync('info.lastSort', `${now} – ${listName}: bereits sortiert (${active.length} aktiv)`, true);
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
            const originalSignature = (0, sorter_1.activeIdSignature)(list);
            let written = 0;
            for (const entry of changes) {
                const fresh = await this.readList(listName);
                if ((0, sorter_1.activeIdSignature)(fresh) !== originalSignature) {
                    this.traffic.abortedRuns += 1;
                    await this.persistTrafficMetrics();
                    this.pendingLists.add(listName);
                    this.log.warn(`${listName}: Liste wurde während der Sortierung ergänzt oder abgehakt. Neue Berechnung folgt.`);
                    return;
                }
                const currentItem = (0, sorter_1.activeItems)(fresh).find(item => String(item.id) === entry.id);
                if (!currentItem || String(currentItem.value).trim() !== entry.from) {
                    this.traffic.abortedRuns += 1;
                    await this.persistTrafficMetrics();
                    this.pendingLists.add(listName);
                    this.log.warn(`${listName}: Eintrag wurde während der Sortierung verändert. Neue Berechnung folgt.`);
                    return;
                }
                const valueStateId = `${this.alexaInstance}.Lists.${listName}.items.${entry.id}.value`;
                const valueObject = await this.getForeignObjectAsync(valueStateId);
                if (!valueObject)
                    throw new Error(`Alexa-Wertedatenpunkt fehlt: ${valueStateId}`);
                await this.writeAlexaValue(valueStateId, entry.to);
                written += 1;
                if (this.apiSafeMode && written % this.batchSize === 0 && written < changes.length && this.batchPauseMs > 0) {
                    this.log.info(`API-Schonmodus: Batch-Pause nach ${written} Schreibzugriffen (${this.batchPauseMs} ms).`);
                    await this.wait(this.batchPauseMs);
                }
                else {
                    await this.wait(this.writePauseMs);
                }
            }
            await this.wait(Math.max(1000, this.writePauseMs));
            const verifyList = await this.readList(listName);
            if ((0, sorter_1.activeIdSignature)(verifyList) !== originalSignature) {
                this.traffic.abortedRuns += 1;
                await this.persistTrafficMetrics();
                this.pendingLists.add(listName);
                return;
            }
            const verifyPlan = (0, sorter_1.createSortPlan)(verifyList, this.markets, this.routes, this.products, this.fallbackMarket, priority);
            const remaining = verifyPlan.filter(entry => entry.changed);
            if (remaining.length > 0) {
                const message = `${listName}: Alexa hat ${remaining.length} geplante Textänderung(en) nicht bestätigt; kein automatischer Endlos-Retry.`;
                await this.setError(message);
                return;
            }
            await this.setStateAsync('info.lastSort', `${new Date().toISOString()} – ${listName}: ${changes.length} Änderung(en), ${active.length} aktiv`, true);
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
                this.armSortTimer(this.debounceMs);
        }
    }
    async writeAlexaValue(stateId, value) {
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
                this.log.warn(`Alexa-value-Schreibzugriff fehlgeschlagen; Retry ${attempt + 1}/${this.maxWriteRetries} in ${delay} ms.`);
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
            const timeoutAt = Date.now() + 10000;
            let confirmed = false;
            while (Date.now() < timeoutAt) {
                await this.wait(250);
                const current = await this.getForeignStateAsync(valueStateId);
                if (current && current.ack === true && String(current.val ?? '').trim() === originalValue && Number(current.ts || 0) > beforeTs) {
                    confirmed = true;
                    break;
                }
            }
            if (confirmed) {
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
    ensureRoutesForMarketsAndGroups() {
        const synchronized = (0, config_tools_1.ensureMarketRoutes)(this.markets, this.productGroups, this.runtimeRoutes);
        if (synchronized.added <= 0)
            return;
        this.runtimeRoutes = synchronized.routes;
        this.routesDirty = true;
        this.log.info(`${synchronized.added} fehlende Laufweg-Zuordnung(en) für neue Märkte/Produktgruppen automatisch ergänzt.`);
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