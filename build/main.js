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
const sorter_1 = require("./lib/sorter");
const DEFAULT_CATEGORIES = [
    'Obst/Gemüse',
    'Tee/Kaffee',
    'Brot/Gebäck',
    'Schokolade/Naschen',
    'Fleisch/Fisch',
    'Wurst/Salate/Teigwaren',
    'Milchprodukte',
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
    sorting = false;
    abortAndRerun = false;
    listChangedDuringSort = false;
    runtimeProducts = null;
    productsDirty = false;
    constructor(options = {}) {
        super({
            ...options,
            name: 'shoppingroute',
        });
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
    get listName() {
        return String(this.cfg.listName || 'SHOP').trim() || 'SHOP';
    }
    get listStateId() {
        return `${this.alexaInstance}.Lists.${this.listName}.json`;
    }
    get markets() {
        const configured = Array.isArray(this.cfg.markets) ? this.cfg.markets : [];
        return configured.filter(market => market && market.name && market.enabled !== false);
    }
    get routes() {
        return Array.isArray(this.cfg.routes) ? this.cfg.routes.filter(Boolean) : [];
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
        return result;
    }
    get products() {
        if (this.runtimeProducts)
            return this.runtimeProducts.filter(product => product && product.name);
        return Array.isArray(this.cfg.products) ? this.cfg.products.filter(product => product && product.name) : [];
    }
    get fallbackMarket() {
        return String(this.cfg.fallbackMarket || 'Ohne Markt').trim() || 'Ohne Markt';
    }
    get priorityMarket() {
        return String(this.cfg.priorityMarket || '').trim();
    }
    get debounceMs() {
        return Math.max(250, Number(this.cfg.debounceMs) || 2500);
    }
    get writePauseMs() {
        return Math.max(250, Number(this.cfg.writePauseMs) || 1000);
    }
    get dryRun() {
        return this.cfg.dryRun !== false;
    }
    get autoLearnProducts() {
        return this.cfg.autoLearnProducts !== false;
    }
    async onReady() {
        this.runtimeProducts = (Array.isArray(this.cfg.products) ? this.cfg.products : [])
            .filter(product => product && product.name)
            .map(product => ({ ...product }));
        await this.ensureProductGroupsConfig();
        await this.setStateAsync('info.connection', false, true);
        await this.setStateAsync('info.lastError', '', true);
        const enabled = await this.getStateAsync('control.enabled');
        if (!enabled)
            await this.setStateAsync('control.enabled', true, true);
        await this.setStateAsync('control.sortNow', false, true);
        this.subscribeStates('control.*');
        this.subscribeForeignStates(this.listStateId);
        const listState = await this.getForeignStateAsync(this.listStateId);
        if (!listState || typeof listState.val !== 'string') {
            await this.setError(`Alexa list state not found or unreadable: ${this.listStateId}`);
            this.log.error(`Alexa-Liste nicht gefunden: ${this.listStateId}`);
            return;
        }
        await this.setStateAsync('info.connection', true, true);
        this.log.info(`Verbunden mit ${this.listStateId}. Dry-Run: ${this.dryRun ? 'JA' : 'NEIN'}.`);
        this.log.info(`Prioritätsmarkt: ${this.priorityMarket || 'keiner'}. ` +
            `Artikel automatisch lernen: ${this.autoLearnProducts ? 'JA' : 'NEIN'}.`);
        this.log.info('WICHTIG: Die Alexa-App muss für diese Liste auf „Älteste bis neueste“ gestellt sein.');
        this.scheduleSort(500);
    }
    onMessage(obj) {
        if (!obj || !obj.callback)
            return;
        if (obj.command === 'getProductGroups') {
            const options = this.productGroups.map(group => ({
                value: group.name,
                label: group.name,
            }));
            this.sendTo(obj.from, obj.command, options, obj.callback);
        }
    }
    async onStateChange(id, state) {
        if (!state)
            return;
        if (id === `${this.namespace}.control.sortNow`) {
            if (!state.ack && state.val === true) {
                await this.setStateAsync('control.sortNow', false, true);
                this.scheduleSort(100);
            }
            return;
        }
        if (id === `${this.namespace}.control.enabled`) {
            if (!state.ack) {
                await this.setStateAsync('control.enabled', Boolean(state.val), true);
                if (state.val === true)
                    this.scheduleSort(250);
            }
            return;
        }
        if (id === this.listStateId) {
            await this.setStateAsync('info.connection', true, true);
            if (this.sorting) {
                this.listChangedDuringSort = true;
                return;
            }
            this.scheduleSort(this.debounceMs);
        }
    }
    onUnload(callback) {
        if (this.sortTimer)
            clearTimeout(this.sortTimer);
        this.setState('info.connection', false, true);
        callback();
    }
    scheduleSort(delay) {
        if (this.sortTimer)
            clearTimeout(this.sortTimer);
        this.sortTimer = setTimeout(() => {
            this.sortTimer = null;
            void this.sortList();
        }, delay);
    }
    async isEnabled() {
        const state = await this.getStateAsync('control.enabled');
        return !state || state.val !== false;
    }
    async readList() {
        const state = await this.getForeignStateAsync(this.listStateId);
        if (!state || typeof state.val !== 'string' || !state.val.trim()) {
            throw new Error(`Datenpunkt ${this.listStateId} enthält keine lesbare Liste.`);
        }
        const parsed = JSON.parse(state.val);
        if (!Array.isArray(parsed))
            throw new Error(`${this.listStateId} enthält kein JSON-Array.`);
        return parsed;
    }
    async sortList() {
        if (this.sorting) {
            this.abortAndRerun = true;
            return;
        }
        if (!(await this.isEnabled()))
            return;
        this.sorting = true;
        this.abortAndRerun = false;
        this.listChangedDuringSort = false;
        let learnedThisRun = [];
        try {
            const list = await this.readList();
            const active = (0, sorter_1.activeItems)(list);
            await this.setStateAsync('info.activeItems', active.length, true);
            await this.setStateAsync('info.connection', true, true);
            if (this.autoLearnProducts) {
                const merged = (0, sorter_1.mergeUnknownProducts)(list, this.markets, this.products, this.fallbackMarket, this.priorityMarket);
                if (merged.learned.length > 0) {
                    this.runtimeProducts = merged.products;
                    this.productsDirty = true;
                    learnedThisRun = merged.learned;
                    await this.setStateAsync('info.lastLearnedItems', JSON.stringify(learnedThisRun, null, 2), true);
                    this.log.info(`Neue Artikel gelernt: ${merged.learned.map(product => `„${product.name}“`).join(', ')}.`);
                }
            }
            const unknown = (0, sorter_1.collectUnknownItems)(list, this.markets, this.products, this.fallbackMarket, this.priorityMarket);
            await this.setStateAsync('info.unknownItems', JSON.stringify(unknown, null, 2), true);
            const plan = (0, sorter_1.createSortPlan)(list, this.markets, this.routes, this.products, this.fallbackMarket, this.priorityMarket);
            await this.setStateAsync('info.lastPlan', JSON.stringify(plan, null, 2), true);
            const changes = plan.filter(entry => entry.changed);
            const now = new Date().toISOString();
            if (changes.length === 0) {
                await this.setStateAsync('info.lastSort', `${now} – bereits sortiert (${active.length} aktiv)`, true);
                await this.setStateAsync('info.lastError', '', true);
                return;
            }
            this.log.info(`Sortierplan: ${active.length} aktive Artikel, ${changes.length} Textänderung(en)` +
                `${this.dryRun ? ' [DRY-RUN]' : ''}.`);
            for (const entry of changes) {
                this.log.info(`Platz ${entry.position}: „${entry.from}“ → „${entry.to}“ ` +
                    `[${entry.market} / ${entry.category}]`);
            }
            if (this.dryRun) {
                await this.setStateAsync('info.lastSort', `${now} – Dry-Run: ${changes.length} Änderung(en) geplant`, true);
                await this.setStateAsync('info.lastError', '', true);
                return;
            }
            const originalSignature = (0, sorter_1.activeIdSignature)(list);
            for (const entry of changes) {
                const fresh = await this.readList();
                if ((0, sorter_1.activeIdSignature)(fresh) !== originalSignature) {
                    this.abortAndRerun = true;
                    this.log.warn('Liste wurde während der Sortierung ergänzt oder abgehakt. Durchlauf wird neu berechnet.');
                    break;
                }
                const currentItem = (0, sorter_1.activeItems)(fresh).find(item => String(item.id) === entry.id);
                if (!currentItem || String(currentItem.value).trim() !== entry.from) {
                    this.abortAndRerun = true;
                    this.log.warn(`Eintrag ${entry.id} wurde während der Sortierung verändert. Durchlauf wird neu berechnet.`);
                    break;
                }
                const valueStateId = `${this.alexaInstance}.Lists.${this.listName}.items.${entry.id}.value`;
                const valueObject = await this.getForeignObjectAsync(valueStateId);
                if (!valueObject)
                    throw new Error(`Alexa-Wertedatenpunkt fehlt: ${valueStateId}`);
                await this.setForeignStateAsync(valueStateId, { val: entry.to, ack: false });
                await this.wait(this.writePauseMs);
            }
            if (this.abortAndRerun)
                return;
            await this.wait(Math.max(1000, this.writePauseMs));
            const verifyList = await this.readList();
            if ((0, sorter_1.activeIdSignature)(verifyList) !== originalSignature) {
                this.abortAndRerun = true;
                this.log.warn('Liste wurde unmittelbar nach der Sortierung verändert. Neue Berechnung folgt.');
                return;
            }
            const verifyPlan = (0, sorter_1.createSortPlan)(verifyList, this.markets, this.routes, this.products, this.fallbackMarket, this.priorityMarket);
            const remaining = verifyPlan.filter(entry => entry.changed);
            if (remaining.length > 0) {
                const message = `Alexa hat ${remaining.length} geplante Textänderung(en) nicht bestätigt. ` +
                    'Kein automatischer Wiederholungsloop wird gestartet.';
                await this.setError(message);
                this.log.error(message);
                return;
            }
            await this.setStateAsync('info.lastSort', `${new Date().toISOString()} – ${changes.length} Änderung(en), ${active.length} aktive Artikel`, true);
            await this.setStateAsync('info.lastError', '', true);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await this.setError(message);
            this.log.error(message);
        }
        finally {
            this.sorting = false;
            if (this.productsDirty)
                await this.persistProductsConfig();
            if (this.abortAndRerun) {
                this.abortAndRerun = false;
                this.scheduleSort(this.debounceMs);
            }
            else if (this.listChangedDuringSort) {
                // Own value writes also update SHOP.json. Verify once, but the no-change plan prevents a loop.
                this.listChangedDuringSort = false;
                this.scheduleSort(this.debounceMs);
            }
        }
    }
    async ensureProductGroupsConfig() {
        if (Array.isArray(this.cfg.productGroups) && this.cfg.productGroups.length > 0)
            return;
        try {
            const instanceId = `system.adapter.${this.namespace}`;
            const object = await this.getForeignObjectAsync(instanceId);
            if (!object)
                return;
            const currentNative = (object.native || {});
            object.native = {
                ...currentNative,
                productGroups: DEFAULT_CATEGORIES.map(name => ({ name })),
            };
            await this.setForeignObjectAsync(instanceId, object);
            this.log.info('Standard-Produktgruppen wurden in die Adapterkonfiguration übernommen.');
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.log.warn(`Produktgruppen konnten nicht initialisiert werden: ${message}`);
        }
    }
    async persistProductsConfig() {
        if (!this.productsDirty || !this.runtimeProducts)
            return;
        try {
            const instanceId = `system.adapter.${this.namespace}`;
            const object = await this.getForeignObjectAsync(instanceId);
            if (!object)
                throw new Error(`Instanzobjekt nicht gefunden: ${instanceId}`);
            const currentNative = (object.native || {});
            object.native = {
                ...currentNative,
                products: this.runtimeProducts.map(product => ({ ...product })),
            };
            await this.setForeignObjectAsync(instanceId, object);
            this.productsDirty = false;
            this.log.info(`Artikelstamm gespeichert (${this.runtimeProducts.length} Artikel). ` +
                'Die Admin-Konfigurationsseite ggf. neu öffnen, um neue Artikel zu sehen.');
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await this.setStateAsync('info.lastError', `Artikelstamm konnte nicht gespeichert werden: ${message}`, true);
            this.log.error(`Artikelstamm konnte nicht gespeichert werden: ${message}`);
        }
    }
    async setError(message) {
        await this.setStateAsync('info.lastError', message, true);
        await this.setStateAsync('info.connection', false, true);
    }
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    static getDefaultCategories() {
        return [...DEFAULT_CATEGORIES];
    }
}
exports.ShoppingRoute = ShoppingRoute;
if (require.main !== module) {
    module.exports = (options) => new ShoppingRoute(options);
}
else {
    (() => new ShoppingRoute())();
}
//# sourceMappingURL=main.js.map