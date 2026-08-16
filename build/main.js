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
const alexa_direct_1 = require("./lib/alexa-direct");
const metrics_1 = require("./lib/metrics");
const sorter_1 = require("./lib/sorter");
const parser_1 = require("./lib/parser");
const market_plan_1 = require("./lib/market-plan");
const prefix_sort_1 = require("./lib/prefix-sort");
const config_tools_1 = require("./lib/config-tools");
const statistics_1 = require("./lib/statistics");
const review_tools_1 = require("./lib/review-tools");
const state_change_1 = require("./lib/state-change");
const direct_sort_lifecycle_1 = require("./lib/direct-sort-lifecycle");
const VERSION = '0.3.5';
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
function itemSnapshot(items) {
    return new Map((0, sorter_1.activeItems)(items).map(item => [String(item.id), (0, prefix_sort_1.stripSortPrefix)(item.value)]));
}
function countValues(values) {
    const counts = new Map();
    for (const value of values)
        counts.set(value, (counts.get(value) || 0) + 1);
    return counts;
}
function mapsEqual(left, right) {
    if (left.size !== right.size)
        return false;
    for (const [key, value] of left)
        if (right.get(key) !== value)
            return false;
    return true;
}
function englishRuntimeError(error) {
    const message = error instanceof Error ? error.message : String(error);
    return message
        .replace(/^Ungültiger ShoppingRoute-Sortierpräfix: (.+)$/, 'Invalid ShoppingRoute sorting prefix: $1')
        .replace(/^Ein Sortierpräfix benötigt einen sichtbaren Originaltext\.$/, 'A sorting prefix requires visible original text.')
        .replace(/^Die Liste enthält (\d+) Soll-Einträge; maximal 99 sind zulässig\.$/, 'The list contains $1 target entries; at most 99 are allowed.')
        .replace(/^(UPDATE|DELETE) für ID (.+): Item-ID oder positive Amazon-Version fehlt\.$/, '$1 for ID $2: item ID or positive Amazon version is missing.')
        .replace(/^Der neu aufzubauende Listenteil passt nicht in die Präfixe 00>–99>\.$/, 'The list section to rebuild does not fit into prefixes 00>–99>.')
        .replace(/^DELETE für ID (.+): positive Amazon-Version fehlt\.$/, 'DELETE for ID $1: positive Amazon version is missing.')
        .replace(/^Maximal 99 aktive Listeneinträge sind zulässig\.$/, 'At most 99 active list entries are allowed.')
        .replace(/^Gelöschte ID (.+) ist weiterhin aktiv\.$/, 'Deleted ID $1 is still active.')
        .replace(/^ID (.+) besitzt nicht den erwarteten Zielwert „(.*)“\.$/, 'ID $1 does not have the expected target value “$2”.')
        .replace(/^Batch-CREATE-Ziel „(.*)“ ist nicht vollständig vorhanden\.$/, 'Batch CREATE target “$1” is not fully present.')
        .replace(/^Erwartet (\d+), gefunden (\d+) aktive Items\.$/, 'Expected $1 active items, found $2.')
        .replace(/^Position (\d+): erwartet „(.*)“, gefunden „(.*)“\.$/, 'Position $1: expected “$2”, found “$3”.')
        .replace(/^Die sichtbaren Originaltexte stimmen nach dem Apply nicht überein\.$/, 'The visible original texts do not match after applying the sort.');
}
class ShoppingRoute extends utils.Adapter {
    listStates = new Map();
    applyingListName = '';
    directClient = null;
    directClientPromise = null;
    directListIds = new Map();
    runtimeProducts = [];
    runtimeReviews = [];
    runtimeRoutes = [];
    productsDirty = false;
    reviewsDirty = false;
    routesDirty = false;
    compatibilityTesting = false;
    isUnloading = false;
    traffic = (0, metrics_1.emptyTrafficMetrics)();
    statistics = (0, statistics_1.emptyUsageStatistics)();
    knownActiveIds = new Map();
    activeCountByList = new Map();
    writeTimestamps = [];
    temporaryPriorityMarket = '';
    alexa2Version = 'unknown';
    alexaRemote2Version = 'unknown';
    compatibilityDetail = 'Direct Alexa session has not been initialized yet.';
    lastCompatibilityTest = 'Not executed yet.';
    constructor(options = {}) {
        super({ ...options, name: 'shoppingroute' });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }
    get cfg() { return this.config; }
    get alexaInstance() { return String(this.cfg.alexaInstance || 'alexa2.0').trim() || 'alexa2.0'; }
    get listConfigs() {
        const configured = Array.isArray(this.cfg.lists)
            ? this.cfg.lists.filter(item => item && item.name && item.enabled !== false)
            : [];
        return configured.length
            ? configured
            : [{ name: String(this.cfg.listName || 'SHOP').trim() || 'SHOP', enabled: true, priorityMarket: '' }];
    }
    listStateId(listName) { return `${this.alexaInstance}.Lists.${listName}.json`; }
    get markets() {
        return (Array.isArray(this.cfg.markets) ? this.cfg.markets : []).filter(market => market?.name && market.enabled !== false);
    }
    get routes() {
        return this.runtimeRoutes.length ? this.runtimeRoutes : (Array.isArray(this.cfg.routes) ? this.cfg.routes.filter(Boolean) : []);
    }
    get productGroups() {
        const configured = Array.isArray(this.cfg.productGroups) ? this.cfg.productGroups : [];
        const source = configured.length ? configured : DEFAULT_CATEGORIES.map(name => ({ name }));
        const seen = new Set();
        return source.map(entry => ({ name: String(entry?.name || '').trim() })).filter(entry => {
            const key = entry.name.toLocaleLowerCase('de');
            if (!entry.name || seen.has(key))
                return false;
            seen.add(key);
            return true;
        }).sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));
    }
    get products() { return this.runtimeProducts.filter(product => product?.name); }
    get fallbackMarket() { return String(this.cfg.fallbackMarket || 'Ohne Markt').trim() || 'Ohne Markt'; }
    get priorityMarket() { return String(this.cfg.priorityMarket || '').trim(); }
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
    get dryRun() { return this.cfg.dryRun !== false; }
    get logSortSummary() { return this.cfg.logSortSummary !== false; }
    get apiSafeMode() { return this.cfg.apiSafeMode !== false; }
    get maxWritesPerMinute() { return (0, config_tools_1.normalizeMaxWritesPerMinute)(this.cfg.maxWritesPerMinute); }
    get marketHeadersEnabled() { return this.cfg.marketHeaders === true; }
    get minimumItemsPerMarket() { return Math.max(1, Math.floor(Number(this.cfg.minItemsPerMarket) || 1)); }
    getListState(listName) {
        let state = this.listStates.get(listName);
        if (!state) {
            state = { ...(0, direct_sort_lifecycle_1.createDirectSortLifecycle)() };
            this.listStates.set(listName, state);
        }
        return state;
    }
    async onReady() {
        this.runtimeProducts = (Array.isArray(this.cfg.products) ? this.cfg.products : [])
            .filter(product => product?.name).map(product => ({ ...product }))
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
        if (!enabled)
            await this.setStateAsync('control.enabled', true, true);
        const temp = await this.getStateAsync('control.temporaryPriorityMarket');
        const tempRaw = String(temp?.val ?? this.cfg.temporaryPriorityMarket ?? '').trim();
        this.temporaryPriorityMarket = tempRaw === '__none__' ? '' : tempRaw;
        await this.setStateAsync('control.temporaryPriorityMarket', this.temporaryPriorityMarket || '__none__', true);
        this.subscribeStates('control.*');
        for (const list of this.listConfigs)
            this.subscribeForeignStates(this.listStateId(list.name));
        let stateConnected = false;
        for (const list of this.listConfigs) {
            const state = await this.getForeignStateAsync(this.listStateId(list.name));
            const parsed = this.parseListState(state?.val);
            if (!parsed) {
                this.log.warn(`Alexa list not found: ${this.listStateId(list.name)}`);
                continue;
            }
            stateConnected = true;
            this.getListState(list.name).lastSnapshot = itemSnapshot(parsed);
            this.getListState(list.name).lastItems = parsed.map(item => ({ ...item }));
            this.knownActiveIds.set(list.name, new Set((0, sorter_1.activeItems)(parsed).map(item => String(item.id))));
            this.activeCountByList.set(list.name, (0, market_plan_1.realActiveItems)(this.prefixFreeItems(parsed), this.markets).length);
        }
        await this.updateActiveItemCount();
        if (!stateConnected) {
            await this.setError(`None of the configured Alexa lists can be read: ${this.listConfigs.map(item => item.name).join(', ')}`);
            return;
        }
        try {
            await this.initializeDirectClient();
            await this.setStateAsync('info.connection', true, true);
        }
        catch (error) {
            await this.setError(`Direct Alexa connection failed: ${error instanceof Error ? error.message : String(error)}`);
            return;
        }
        if (!(await this.recoverDirectApplyJournal()))
            return;
        await this.setStateAsync('info.lastError', '', true);
        await this.refreshExports();
        await this.updateFeedbackReport();
        this.log.warn(`ShoppingRoute ${VERSION}: Dry Run is strongly recommended for initial testing.`);
        this.log.info('IMPORTANT: Set every managed list in the Alexa app to alphabetical sorting (A–Z).');
        this.log.debug('Direct sorting uses visible prefixes 00>–99>; Alexa2 list states are used only as an external trigger source.');
        this.scheduleAll(COLLECT_WINDOW_MS);
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
            this.log.debug(`Alexa lists could not be read for ${instance}: ${String(error)}`);
        }
        for (const list of this.listConfigs)
            if (list.name)
                names.add(String(list.name).trim());
        return [...names].filter(Boolean).sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
    }
    async onMessage(obj) {
        if (!obj?.callback)
            return;
        if (obj.command === 'markAllReviewItemsAccept') {
            const supplied = obj.message?.native && typeof obj.message.native === 'object'
                ? { ...obj.message.native }
                : { ...this.cfg };
            const rows = Array.isArray(supplied.reviewItems) ? supplied.reviewItems : this.runtimeReviews;
            const updatedReviewItems = (0, review_tools_1.markAllReviewItemsAccept)(rows);
            this.sendTo(obj.from, obj.command, { native: { ...supplied, reviewItems: updatedReviewItems } }, obj.callback);
            return;
        }
        if (obj.command === 'normalizeMarketSelection') {
            const values = Array.isArray(obj.message?.value) ? obj.message.value : String(obj.message?.value || '').split(/[;,]/);
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
            const source = Array.isArray(obj.message?.productGroups)
                ? obj.message.productGroups.map((group) => ({ name: String(group?.name || '').trim() })).filter((group) => group.name)
                : this.productGroups;
            this.sendTo(obj.from, obj.command, source.map((group) => ({ value: group.name, label: group.name }))
                .sort((a, b) => a.label.localeCompare(b.label, 'de', { sensitivity: 'base' })), obj.callback);
            return;
        }
        if (obj.command === 'getMarkets' || obj.command === 'getMarketsOptional' || obj.command === 'getActiveMarkets') {
            const supplied = Array.isArray(obj.message?.markets)
                ? obj.message.markets.map((market) => ({ name: String(market?.name || '').trim(), enabled: market?.enabled !== false })).filter((market) => market.name)
                : this.markets;
            const source = obj.command === 'getActiveMarkets' ? supplied.filter((market) => market.enabled !== false) : supplied;
            const options = source.map((market) => ({ value: market.name, label: market.name }))
                .sort((a, b) => a.label.localeCompare(b.label, 'de', { sensitivity: 'base' }));
            if (obj.command === 'getMarketsOptional')
                options.unshift({ value: '', label: '—' });
            this.sendTo(obj.from, obj.command, options, obj.callback);
            return;
        }
        if (obj.command === 'getAlexaLists' || obj.command === 'getLists') {
            const instance = String(obj.message?.alexaInstance || this.alexaInstance).trim() || this.alexaInstance;
            const lists = await this.discoverAlexaLists(instance);
            this.sendTo(obj.from, obj.command, lists.map(name => ({ value: name, label: name })), obj.callback);
        }
    }
    async onStateChange(id, state) {
        if (!state || this.isUnloading)
            return;
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
                const imported = (0, config_tools_1.parseConfigImport)(state.val);
                await this.setStateAsync('control.importConfigJson', '', true);
                await this.updateConfig(imported);
            }
            catch (error) {
                await this.setStateAsync('control.importConfigJson', '', true);
                await this.setError(`Configuration import failed: ${error instanceof Error ? error.message : String(error)}`);
            }
            return;
        }
        if (id === `${local}control.marketProfileImport` && !state.ack && typeof state.val === 'string' && state.val.trim()) {
            try {
                const imported = (0, config_tools_1.importMarketProfile)(state.val, this.markets, this.routes);
                await this.setStateAsync('control.marketProfileImport', '', true);
                await this.updateConfig({ markets: imported.markets, routes: imported.routes });
            }
            catch (error) {
                await this.setStateAsync('control.marketProfileImport', '', true);
                await this.setError(`Market profile import failed: ${error instanceof Error ? error.message : String(error)}`);
            }
            return;
        }
        if (id === `${local}control.enabled` && !state.ack) {
            await this.setStateAsync('control.enabled', Boolean(state.val), true);
            if (state.val === true)
                this.scheduleAll(COLLECT_WINDOW_MS);
            return;
        }
        const list = this.listConfigs.find(entry => id === this.listStateId(entry.name));
        if (list) {
            if (!(0, state_change_1.isAcknowledgedForeignState)(state))
                return;
            await this.setStateAsync('info.connection', true, true);
            if (!this.compatibilityTesting)
                this.observeListState(list.name, state.val);
        }
    }
    onUnload(callback) {
        this.isUnloading = true;
        for (const state of this.listStates.values())
            if (state.timer)
                this.clearTimeout(state.timer);
        this.listStates.clear();
        this.directClient?.close();
        void this.setStateAsync('info.connection', false, true).catch(() => undefined).finally(callback);
    }
    parseListState(rawValue) {
        if (typeof rawValue !== 'string' || !rawValue.trim())
            return undefined;
        try {
            const parsed = JSON.parse(rawValue);
            return Array.isArray(parsed) ? parsed : undefined;
        }
        catch {
            return undefined;
        }
    }
    prefixFreeItems(items) {
        return items.map(item => ({ ...item, value: (0, prefix_sort_1.stripSortPrefix)(item.value) }));
    }
    isOwnRefresh(state, current, now) {
        const own = state.ownObservation;
        if (!own || now > own.expiresAt) {
            state.ownObservation = undefined;
            return false;
        }
        const newCounts = new Map(own.createdOriginalCounts);
        for (const [id, value] of current) {
            const baseline = own.baselineOriginals.get(id);
            if (baseline !== undefined) {
                if (baseline !== value)
                    return false;
                continue;
            }
            const remaining = newCounts.get(value) || 0;
            if (remaining < 1)
                return false;
            newCounts.set(value, remaining - 1);
        }
        for (const id of own.baselineOriginals.keys()) {
            if (!current.has(id) && !own.deletedIds.has(id))
                return false;
        }
        const currentCounts = countValues(current.values());
        if (mapsEqual(currentCounts, own.expectedOriginalCounts)) {
            state.lastSnapshot = new Map(current);
            state.ownObservation = undefined;
        }
        return true;
    }
    observeListState(listName, rawValue, observedAt = Date.now()) {
        const items = this.parseListState(rawValue);
        if (!items)
            return;
        const current = itemSnapshot(items);
        const state = this.getListState(listName);
        if (this.isOwnRefresh(state, current, observedAt))
            return;
        const previous = state.lastSnapshot;
        if (previous && previous.size === current.size && [...current].every(([id, value]) => previous.get(id) === value))
            return;
        const addedIds = previous ? [...current.keys()].filter(id => !previous.has(id)) : [];
        state.lastSnapshot = current;
        state.lastItems = items.map(item => ({ ...item }));
        const collected = (0, direct_sort_lifecycle_1.collectDirectInput)(state, observedAt, addedIds, COLLECT_WINDOW_MS);
        Object.assign(state, collected.lifecycle);
        if (state.phase !== 'APPLYING')
            this.armCollectionDeadline(listName, state, collected.deadline);
    }
    armCollectionDeadline(listName, state, deadline) {
        if (state.timer)
            this.clearTimeout(state.timer);
        const delay = Math.max(0, deadline - Date.now());
        state.timer = this.setTimeout(() => {
            state.timer = undefined;
            void this.startApply(listName);
        }, delay);
    }
    scheduleAll(delay) {
        if (this.isUnloading)
            return;
        const now = Date.now();
        for (const list of this.listConfigs) {
            const state = this.getListState(list.name);
            if (state.phase === 'APPLYING') {
                Object.assign(state, (0, direct_sort_lifecycle_1.collectDirectInput)(state, now, [], COLLECT_WINDOW_MS).lifecycle);
                continue;
            }
            const collected = (0, direct_sort_lifecycle_1.collectDirectInput)(state, now, [], delay);
            Object.assign(state, collected.lifecycle);
            this.armCollectionDeadline(list.name, state, delay === 0 ? now : collected.deadline);
        }
    }
    async startApply(listName) {
        const state = this.getListState(listName);
        if (this.isUnloading || state.phase !== 'COLLECTING')
            return;
        if (this.applyingListName) {
            // The active list's finally block arms every other collected list exactly once.
            return;
        }
        if (!(await this.isEnabled())) {
            state.phase = 'IDLE';
            return;
        }
        Object.assign(state, (0, direct_sort_lifecycle_1.beginDirectApply)(state));
        this.applyingListName = listName;
        const runtime = {
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
        }
        catch (error) {
            const message = englishRuntimeError(error);
            await this.activateDirectSafetyStop(listName, message);
        }
        finally {
            this.applyingListName = '';
            if (state.externalDirty && !this.isUnloading) {
                const followup = (0, direct_sort_lifecycle_1.finishDirectApply)(state, Date.now());
                if (followup) {
                    Object.assign(state, followup.lifecycle);
                    this.armCollectionDeadline(listName, state, followup.deadline);
                }
            }
            else {
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
            }
            catch { /* diagnostics must not start another apply */ }
        }
    }
    async isEnabled() {
        const state = await this.getStateAsync('control.enabled');
        return !state || state.val !== false;
    }
    async initializeDirectClient() {
        if (this.directClient)
            return this.directClient;
        if (this.directClientPromise)
            return this.directClientPromise;
        this.directClientPromise = (async () => {
            const object = await this.getForeignObjectAsync(`system.adapter.${this.alexaInstance}`);
            if (!object)
                throw new Error(`Alexa2 instance object system.adapter.${this.alexaInstance} is missing.`);
            const native = (object.native || {});
            const version = object.common?.version;
            this.alexa2Version = typeof version === 'string' || typeof version === 'number' ? String(version) : 'unknown';
            const client = await alexa_direct_1.AlexaDirectClient.connect(native);
            this.directClient = client;
            this.compatibilityDetail = 'Direct alexa-remote2 session using local Alexa2 authentication is ready.';
            try {
                const resolved = require.resolve('alexa-remote2');
                this.alexaRemote2Version = this.findPackageVersion(resolved, 'alexa-remote2');
            }
            catch {
                this.alexaRemote2Version = 'provided by Alexa2';
            }
            await this.refreshDirectListIds();
            await this.updateCompatibilityDiagnostics();
            return client;
        })().finally(() => { this.directClientPromise = null; });
        return this.directClientPromise;
    }
    async refreshDirectListIds() {
        const client = this.directClient;
        if (!client)
            return;
        const lists = await client.getLists();
        this.directListIds.clear();
        for (const list of lists)
            this.directListIds.set(list.name.toLocaleLowerCase('de'), list.listId);
    }
    async directListId(listName, runtime) {
        const client = await this.initializeDirectClient();
        let listId = this.directListIds.get(listName.toLocaleLowerCase('de'));
        if (!listId) {
            await this.amazonCall(runtime, () => this.refreshDirectListIds());
            listId = this.directListIds.get(listName.toLocaleLowerCase('de'));
        }
        if (!client || !listId)
            throw new Error(`Amazon list ID for “${listName}” was not found.`);
        return listId;
    }
    async amazonCall(runtime, operation) {
        const started = Date.now();
        if (runtime)
            runtime.amazonRequests += 1;
        try {
            return await operation();
        }
        finally {
            if (runtime)
                runtime.amazonMs += Date.now() - started;
        }
    }
    async readDirectItems(listId, runtime) {
        const client = await this.initializeDirectClient();
        return (0, alexa_direct_1.toAlexaListItems)(await this.amazonCall(runtime, () => client.getItems(listId)));
    }
    async applyDirectSort(listName, state, runtime) {
        await this.ensureTrafficDay();
        this.traffic.localChecks += 1;
        await this.persistTrafficMetrics();
        const listId = await this.directListId(listName, runtime);
        // A direct planning snapshot supplies the current Amazon versions; the Alexa2 state remains trigger-only.
        const snapshot = await this.readDirectItems(listId, runtime);
        if ((0, sorter_1.activeItems)(snapshot).length > MAX_ACTIVE_ITEMS)
            throw new Error(`${listName}: more than 99 active entries.`);
        const logical = this.prefixFreeItems(snapshot);
        await this.recordNewItems(listName, logical);
        await this.updateLearningAndDiagnostics(listName, logical);
        const priority = this.priorityMarketForList(listName);
        const desired = (0, prefix_sort_1.buildPrefixTargets)(snapshot, this.markets, this.routes, this.products, this.fallbackMarket, priority, this.minimumItemsPerMarket, this.marketHeadersEnabled);
        const plan = (0, prefix_sort_1.createPrefixSortPlan)(snapshot, desired);
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
            desired: (0, prefix_sort_1.expectedValues)(plan),
        }, null, 2), true);
        await this.setStateAsync('info.previewText', this.prefixPreviewText(listName, plan), true);
        if (!operationCount) {
            await this.setStateAsync('info.lastSort', `${new Date().toISOString()} – ${listName}: already prefix-sorted (${desired.length} active)`, true);
            await this.setStateAsync('info.lastError', '', true);
            state.lastSnapshot = itemSnapshot(snapshot);
            state.lastItems = snapshot.map(item => ({ ...item }));
            return;
        }
        if (this.dryRun) {
            await this.setStateAsync('info.lastSort', `${new Date().toISOString()} – ${listName} Dry Run: ${operationCount} Amazon request(s) planned`, true);
            await this.setStateAsync('info.lastError', '', true);
            return;
        }
        if (state.externalDirty) {
            this.log.debug(`${listName}: Direct prefix plan was discarded before the first write because of an external change.`);
            return;
        }
        this.traffic.sortRuns += 1;
        this.traffic.lastSortRun = new Date().toISOString();
        await this.persistTrafficMetrics();
        const journal = {
            version: 2,
            listName,
            listId,
            startedAt: new Date().toISOString(),
            status: 'applying',
            expectedValues: (0, prefix_sort_1.expectedValues)(plan),
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
        const verification = (0, prefix_sort_1.verifyPrefixResult)(verifiedItems, plan, state.externalDirty);
        if (!verification.ok)
            throw new Error(`${listName}: direct final verification failed: ${englishRuntimeError(verification.reason || 'Unknown verification error.')}`);
        await this.clearDirectJournal();
        state.lastSnapshot = itemSnapshot(verifiedItems);
        state.lastItems = verifiedItems.map(item => ({ ...item }));
        state.ownObservation = this.buildOwnObservation(snapshot, plan);
        this.activeCountByList.set(listName, (0, market_plan_1.realActiveItems)(this.prefixFreeItems(verifiedItems), this.markets).length);
        await this.updateActiveItemCount();
        await this.setStateAsync('info.lastSort', `${new Date().toISOString()} – ${listName}: prefix sorting confirmed directly`, true);
        await this.setStateAsync('info.lastError', '', true);
    }
    buildOwnObservation(snapshot, plan) {
        const baselineOriginals = itemSnapshot(snapshot);
        const createdOriginalCounts = countValues(plan.creates.map(create => create.originalText));
        const expectedOriginalCounts = countValues((0, prefix_sort_1.expectedValues)(plan).map(prefix_sort_1.stripSortPrefix));
        return {
            baselineOriginals,
            deletedIds: new Set(plan.deletes.map(entry => entry.id)),
            createdOriginalCounts,
            expectedOriginalCounts,
            expiresAt: Date.now() + OWN_REFRESH_MAX_MS,
        };
    }
    prefixPreviewText(listName, plan) {
        return [
            `List: ${listName}`,
            `Direct prefix sorting: ${plan.fallback ? `fallback from position ${(plan.rebuildFrom || 0) + 1}` : 'incremental'}`,
            `PUT: ${plan.updates.length}, DELETE: ${plan.deletes.length}, Batch-CREATE: ${plan.creates.length}`,
            ...(0, prefix_sort_1.expectedValues)(plan).map((value, index) => `${String(index + 1).padStart(2, '0')}. ${value}`),
        ].join('\n');
    }
    async beforeDirectWrite() {
        if (this.isUnloading)
            throw new Error('Direct Alexa write aborted because the adapter is shutting down.');
        if (!this.apiSafeMode)
            return;
        while (true) {
            const now = Date.now();
            this.writeTimestamps = this.writeTimestamps.filter(timestamp => now - timestamp < 60000);
            if (this.writeTimestamps.length < this.maxWritesPerMinute)
                return;
            const waitMs = Math.max(500, 60000 - (now - this.writeTimestamps[0]) + 100);
            this.log.debug(`API Safe Mode: request limit of ${this.maxWritesPerMinute} per minute reached; waiting ${waitMs} ms.`);
            await this.wait(waitMs);
            if (this.isUnloading)
                throw new Error('Direct Alexa write aborted during the API wait period.');
        }
    }
    async recordDirectWrite() {
        this.writeTimestamps.push(Date.now());
        this.traffic.alexaWrites += 1;
        this.traffic.lastAlexaWrite = new Date().toISOString();
        await this.persistTrafficMetrics();
    }
    async activateDirectSafetyStop(listName, reason) {
        if (this.isUnloading)
            return;
        this.traffic.abortedRuns += 1;
        await this.persistTrafficMetrics();
        try {
            const state = await this.getStateAsync('info.sortTransaction');
            if (typeof state?.val === 'string' && state.val.trim() && state.val !== '{}') {
                const journal = JSON.parse(state.val);
                journal.status = 'failed';
                await this.persistDirectJournal(journal);
            }
        }
        catch { /* preserve the last journal payload */ }
        await this.setStateAsync('control.enabled', false, true);
        const message = `${listName}: ${reason} SAFETY STOP: further direct writes are disabled; no automatic retry.`;
        await this.setError(message);
        this.log.error(message);
    }
    async persistDirectJournal(journal) {
        await this.setStateAsync('info.sortTransaction', JSON.stringify(journal), true);
    }
    async clearDirectJournal() {
        if (this.isUnloading)
            return;
        await this.setStateAsync('info.sortTransaction', '{}', true);
    }
    async recoverDirectApplyJournal() {
        const state = await this.getStateAsync('info.sortTransaction');
        const raw = typeof state?.val === 'string' ? state.val.trim() : '';
        if (!raw || raw === '{}')
            return true;
        let journal;
        try {
            journal = JSON.parse(raw);
        }
        catch {
            await this.activateDirectSafetyStop('unknown', 'Persistent apply journal cannot be read.');
            return false;
        }
        if (journal.version !== 2) {
            await this.activateDirectSafetyStop(journal.listName || 'unknown', 'Old interrupted marker transaction found; automatic prefix migration remains blocked.');
            return false;
        }
        try {
            const items = await this.readDirectItems(journal.listId);
            const activeValues = (0, sorter_1.activeItems)(items).map(item => String(item.value).trim()).sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
            const expected = [...journal.expectedValues];
            const ids = new Set((0, sorter_1.activeItems)(items).map(item => String(item.id)));
            const exact = activeValues.length === expected.length && activeValues.every((value, index) => value === expected[index]);
            const deletedGone = journal.deletedIds.every(id => !ids.has(id));
            if (exact && deletedGone) {
                await this.clearDirectJournal();
                this.log.debug(`${journal.listName}: interrupted direct apply was fully completed remotely; journal cleared.`);
                return true;
            }
            await this.activateDirectSafetyStop(journal.listName, 'Interrupted direct apply is not complete remotely; journal is retained.');
            return false;
        }
        catch (error) {
            await this.activateDirectSafetyStop(journal.listName, `Recovery verification read failed: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }
    logDirectRuntime(runtime) {
        const totalMs = Date.now() - runtime.startedAt;
        const waitedMs = Math.max(0, runtime.startedAt - runtime.requestedAt);
        this.log.debug(`${runtime.listName} SHOP direct sorting: external new items ${runtime.externalNewItems} | ` +
            `Debounce ${waitedMs} ms | PUTs ${runtime.putRequests} | DELETEs ${runtime.deleteRequests} | ` +
            `Batch-CREATE-Items ${runtime.batchCreateItems} | Amazon-Requests ${runtime.amazonRequests} | ` +
            `Amazon ${runtime.amazonMs} ms | total ${totalMs} ms | Fallback ${runtime.fallback ? 'yes' : 'no'} | ` +
            `Rebuild from ${runtime.rebuildFrom === null ? '–' : runtime.rebuildFrom + 1}`);
        if (this.logSortSummary) {
            this.log.info(`${runtime.listName}: sorting run completed after ${totalMs} ms.`);
        }
    }
    async updateLearningAndDiagnostics(listName, list) {
        const priority = this.priorityMarketForList(listName);
        let unknown = (0, sorter_1.collectUnknownItems)(list, this.markets, this.products, this.fallbackMarket, priority);
        if (this.learningMode === 'automatic') {
            const merged = (0, sorter_1.mergeUnknownProducts)(list, this.markets, this.products, this.fallbackMarket, priority);
            if (merged.learned.length) {
                this.runtimeProducts = merged.products;
                this.productsDirty = true;
                this.statistics.automaticLearned += merged.learned.length;
                await this.persistStatistics();
                await this.setStateAsync('info.lastLearnedItems', JSON.stringify(merged.learned, null, 2), true);
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
    }
    async updateAliasSuggestions(list) {
        if (this.cfg.autoAliasSuggestions === false) {
            await this.setStateAsync('info.aliasSuggestions', '[]', true);
            return;
        }
        const suggestions = [];
        for (const item of (0, sorter_1.activeItems)(this.prefixFreeItems(list))) {
            if ((0, market_plan_1.isMarketHeader)(item.value, this.markets))
                continue;
            const parsed = (0, parser_1.parseItem)(item.value, this.markets, this.products, this.fallbackMarket, this.priorityMarket);
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
        const currentItems = (0, sorter_1.activeItems)(this.prefixFreeItems(list));
        const previous = this.knownActiveIds.get(listName);
        const current = new Set(currentItems.map(item => String(item.id)));
        if (!previous) {
            this.knownActiveIds.set(listName, current);
            return;
        }
        for (const item of currentItems) {
            if (previous.has(String(item.id)) || (0, market_plan_1.isMarketHeader)(item.value, this.markets))
                continue;
            const parsed = (0, parser_1.parseItem)(item.value, this.markets, this.products, this.fallbackMarket, this.priorityMarketForList(listName));
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
    findPackageVersion(moduleFile, expectedName) {
        let current = path.dirname(moduleFile);
        for (let level = 0; level < 6; level++) {
            try {
                const parsed = JSON.parse(fs.readFileSync(path.join(current, 'package.json'), 'utf8'));
                if (parsed.name === expectedName && parsed.version)
                    return parsed.version;
            }
            catch { /* continue */ }
            const parent = path.dirname(current);
            if (parent === current)
                break;
            current = parent;
        }
        return 'unknown';
    }
    async runLiveCompatibilityTest() {
        if (this.isUnloading || this.compatibilityTesting || this.applyingListName)
            return;
        this.compatibilityTesting = true;
        try {
            const listName = this.listConfigs[0]?.name;
            if (!listName)
                throw new Error('No active Alexa list is configured.');
            const listId = await this.directListId(listName);
            const items = await this.readDirectItems(listId);
            this.compatibilityDetail = 'Direct verification read using local Alexa2 authentication succeeded; no test write was needed.';
            this.lastCompatibilityTest = `${new Date().toISOString()} – SUCCESS, ${items.length} items read`;
            await this.setStateAsync('info.lastError', '', true);
        }
        catch (error) {
            this.compatibilityDetail = `Direct verification read failed: ${error instanceof Error ? error.message : String(error)}`;
            this.lastCompatibilityTest = `${new Date().toISOString()} – ERROR`;
            await this.setError(this.compatibilityDetail);
        }
        finally {
            this.compatibilityTesting = false;
            await this.updateCompatibilityDiagnostics();
        }
    }
    async updateCompatibilityDiagnostics() {
        const ready = Boolean(this.directClient);
        await this.setStateAsync('info.writeCapability', ready ? 'direct-ok' : 'direct-unavailable', true);
        await this.setStateAsync('info.lastCompatibilityTest', this.lastCompatibilityTest, true);
        await this.setStateAsync('info.compatibility', JSON.stringify({
            shoppingrouteVersion: VERSION,
            alexaInstance: this.alexaInstance,
            alexa2Version: this.alexa2Version,
            alexaRemote2Version: this.alexaRemote2Version,
            lists: this.listConfigs.map(item => item.name),
            dryRun: this.dryRun,
            writeCapability: ready ? 'direct-ok' : 'direct-unavailable',
            detail: this.compatibilityDetail,
            lastCompatibilityTest: this.lastCompatibilityTest,
            requiredAlexaAppSorting: 'Alphabetical A–Z',
            checkedAt: new Date().toISOString(),
        }, null, 2), true);
    }
    async updateTemporaryMarketStateOptions() {
        try {
            const states = { __none__: '— No market —' };
            for (const market of [...this.markets].sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' })))
                states[market.name] = market.name;
            await this.extendObjectAsync('control.temporaryPriorityMarket', { common: { states } });
        }
        catch (error) {
            this.log.warn(`Temporary market selection list could not be updated: ${String(error)}`);
        }
    }
    async ensureProductGroupsConfig() {
        if (Array.isArray(this.cfg.productGroups) && this.cfg.productGroups.length)
            return;
        try {
            await this.updateConfig({ productGroups: DEFAULT_CATEGORIES.map(name => ({ name })) });
        }
        catch (error) {
            this.log.warn(`Product groups could not be initialized: ${String(error)}`);
        }
    }
    async persistRuntimeConfig() {
        if (!this.productsDirty && !this.reviewsDirty && !this.routesDirty)
            return;
        try {
            const instanceId = `system.adapter.${this.namespace}`;
            const object = await this.getForeignObjectAsync(instanceId);
            if (!object)
                throw new Error(`Instance object not found: ${instanceId}`);
            object.native = {
                ...(object.native || {}),
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
            await this.setError(`Learning/configuration data could not be saved: ${String(error)}`);
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
        await this.setStateAsync('info.traffic', JSON.stringify({ ...this.traffic, note: 'Counts operations, not network bytes.' }, null, 2), true);
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
            writeCapability: this.directClient ? 'direct-ok' : 'direct-unavailable',
            lastCompatibilityTest: this.lastCompatibilityTest,
            lastError: String((await this.getStateAsync('info.lastError'))?.val || ''),
            traffic: this.traffic,
            privacy: 'Product names, shopping-list texts, aliases, cookies and the complete configuration are not included.',
        };
        await this.setStateAsync('info.feedbackReport', JSON.stringify(report, null, 2), true);
    }
    async setError(message) { await this.setStateAsync('info.lastError', message, true); }
    wait(ms) { return new Promise(resolve => this.setTimeout(resolve, ms)); }
    static getDefaultCategories() { return [...DEFAULT_CATEGORIES]; }
}
exports.ShoppingRoute = ShoppingRoute;
if (require.main !== module)
    module.exports = (options) => new ShoppingRoute(options);
else
    (() => new ShoppingRoute())();
//# sourceMappingURL=main.js.map