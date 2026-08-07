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
const compatibility_1 = require("./lib/compatibility");
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
    compatibilityTesting = false;
    writeCapability = 'unknown';
    compatibilityDetail = 'Noch nicht geprüft.';
    alexa2Version = 'unbekannt';
    alexaRemote2Version = 'unbekannt';
    lastCompatibilityTest = 'Noch nicht ausgeführt.';
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
        return result.sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));
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
        const configuredProducts = (Array.isArray(this.cfg.products) ? this.cfg.products : [])
            .filter(product => product && product.name)
            .map(product => ({ ...product }));
        this.runtimeProducts = [...configuredProducts]
            .sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));
        this.productsDirty = configuredProducts.some((product, index) => product.name !== this.runtimeProducts?.[index]?.name);
        await this.ensureProductGroupsConfig();
        if (this.productsDirty)
            await this.persistProductsConfig();
        await this.setStateAsync('info.connection', false, true);
        await this.setStateAsync('info.lastError', '', true);
        const enabled = await this.getStateAsync('control.enabled');
        if (!enabled)
            await this.setStateAsync('control.enabled', true, true);
        await this.setStateAsync('control.sortNow', false, true);
        await this.setStateAsync('control.compatibilityTest', false, true);
        this.subscribeStates('control.*');
        this.subscribeForeignStates(this.listStateId);
        const listState = await this.getForeignStateAsync(this.listStateId);
        if (!listState || typeof listState.val !== 'string') {
            await this.setError(`Alexa list state not found or unreadable: ${this.listStateId}`);
            this.log.error(`Alexa-Liste nicht gefunden: ${this.listStateId}`);
            return;
        }
        await this.setStateAsync('info.connection', true, true);
        await this.runStartupCompatibilityCheck();
        this.log.warn('BETA-Version: Dry-Run ist für Ersttests ausdrücklich empfohlen. Alexa-Einträge werden weiterhin niemals angelegt, gelöscht oder automatisch abgehakt.');
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
            const options = this.productGroups
                .map(group => ({ value: group.name, label: group.name }))
                .sort((a, b) => a.label.localeCompare(b.label, 'de', { sensitivity: 'base' }));
            this.sendTo(obj.from, obj.command, options, obj.callback);
            return;
        }
        if (obj.command === 'getMarkets' || obj.command === 'getMarketsOptional') {
            const options = this.markets
                .map(market => ({ value: market.name, label: market.name }))
                .sort((a, b) => a.label.localeCompare(b.label, 'de', { sensitivity: 'base' }));
            if (obj.command === 'getMarketsOptional') {
                options.unshift({ value: '', label: '—' });
            }
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
        if (id === `${this.namespace}.control.compatibilityTest`) {
            if (!state.ack && state.val === true) {
                await this.setStateAsync('control.compatibilityTest', false, true);
                await this.runLiveCompatibilityTest();
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
            if (this.compatibilityTesting)
                return;
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
            if (!(0, compatibility_1.canWriteAlexa)(this.writeCapability)) {
                const message = this.writeCapability === 'known-bug'
                    ? 'Alexa-Schreibzugriffe blockiert: Die bekannte fehlerhafte alexa-remote2 version-Query wurde erkannt. Bitte Alexa2/alexa-remote2 aktualisieren oder den Fehler upstream beheben lassen.'
                    : this.writeCapability === 'live-failed'
                        ? 'Alexa-Schreibzugriffe blockiert: Der Kompatibilitätstest ist fehlgeschlagen. Dry-Run kann weiter verwendet werden.'
                        : 'Alexa-Schreibzugriffe blockiert: Die Schreibkompatibilität konnte nicht sicher bestätigt werden. Bitte control.compatibilityTest einmal mit mindestens einem aktiven Listeneintrag ausführen.';
                await this.setStateAsync('info.lastSort', `${now} – BETA-Sicherheitsblock: keine Alexa-Schreibzugriffe`, true);
                await this.setStateAsync('info.lastError', message, true);
                this.log.error(message);
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
    async runStartupCompatibilityCheck() {
        try {
            const alexaObject = await this.getForeignObjectAsync(`system.adapter.${this.alexaInstance}`);
            this.alexa2Version = String(alexaObject?.common?.version || 'unbekannt');
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
            const message = error instanceof Error ? error.message : String(error);
            this.writeCapability = 'unknown';
            this.compatibilityDetail = `alexa-remote2 konnte nicht automatisch geprüft werden: ${message}`;
            this.alexaRemote2Version = 'unbekannt';
        }
        if (this.writeCapability === 'known-bug') {
            this.log.error('Bekannte inkompatible alexa-remote2 updateListItem-Version erkannt. ' +
                'Echte Alexa-Schreibzugriffe werden von shoppingroute blockiert; Dry-Run bleibt möglich.');
        }
        else if (this.writeCapability === 'source-ok') {
            this.log.info('Alexa2-Schreibkompatibilität: bekannte version-Query ist in alexa-remote2 korrigiert.');
        }
        else {
            this.log.warn('Alexa2-Schreibkompatibilität konnte aus der installierten Quelle nicht eindeutig bestimmt werden. ' +
                'Vor echten Schreibzugriffen bitte control.compatibilityTest ausführen.');
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
                    return String(parsed.version);
            }
            catch {
                // Continue walking towards the package root.
            }
            const parent = path.dirname(current);
            if (parent === current)
                break;
            current = parent;
        }
        return 'unbekannt';
    }
    async runLiveCompatibilityTest() {
        if (this.compatibilityTesting)
            return;
        this.compatibilityTesting = true;
        try {
            if (this.writeCapability === 'known-bug') {
                this.lastCompatibilityTest = `${new Date().toISOString()} – NICHT AUSGEFÜHRT: bekannte inkompatible alexa-remote2-Version erkannt`;
                await this.setStateAsync('info.lastCompatibilityTest', this.lastCompatibilityTest, true);
                await this.updateCompatibilityDiagnostics();
                this.log.error('Kompatibilitätstest nicht ausgeführt: bekannte fehlerhafte alexa-remote2 version-Query erkannt.');
                return;
            }
            const list = await this.readList();
            const active = (0, sorter_1.sortSlotsOldestFirst)((0, sorter_1.activeItems)(list));
            if (active.length === 0) {
                this.lastCompatibilityTest = `${new Date().toISOString()} – nicht möglich: kein aktiver Alexa-Listeneintrag vorhanden`;
                await this.setStateAsync('info.lastCompatibilityTest', this.lastCompatibilityTest, true);
                await this.updateCompatibilityDiagnostics();
                this.log.warn('Kompatibilitätstest benötigt mindestens einen aktiven Alexa-Listeneintrag.');
                return;
            }
            const testItem = active[0];
            const originalValue = String(testItem.value || '').trim();
            const valueStateId = `${this.alexaInstance}.Lists.${this.listName}.items.${testItem.id}.value`;
            const valueObject = await this.getForeignObjectAsync(valueStateId);
            const before = await this.getForeignStateAsync(valueStateId);
            if (!valueObject || !before)
                throw new Error(`Alexa-Wertedatenpunkt fehlt oder ist nicht lesbar: ${valueStateId}`);
            const beforeTs = Number(before.ts || 0);
            this.log.info(`Starte Alexa-Schreibkompatibilitätstest mit „${originalValue}“. ` +
                'Es wird ausschließlich derselbe value-Text erneut geschrieben; der sichtbare Listentext bleibt unverändert.');
            await this.setForeignStateAsync(valueStateId, { val: originalValue, ack: false });
            const timeoutAt = Date.now() + 10000;
            let confirmed = false;
            while (Date.now() < timeoutAt) {
                await this.wait(250);
                const current = await this.getForeignStateAsync(valueStateId);
                if (current &&
                    current.ack === true &&
                    String(current.val ?? '').trim() === originalValue &&
                    Number(current.ts || 0) > beforeTs) {
                    confirmed = true;
                    break;
                }
            }
            if (confirmed) {
                this.writeCapability = 'live-ok';
                this.compatibilityDetail = 'Live-Test erfolgreich: Alexa2 hat einen erneuten Schreibzugriff mit unverändertem value bestätigt.';
                this.lastCompatibilityTest = `${new Date().toISOString()} – ERFOLG mit „${originalValue}“`;
                await this.setStateAsync('info.lastError', '', true);
                this.log.info('Alexa-Schreibkompatibilitätstest erfolgreich.');
            }
            else {
                this.writeCapability = 'live-failed';
                this.compatibilityDetail = 'Live-Test fehlgeschlagen: Alexa2 hat den erneuten value-Schreibzugriff nicht innerhalb von 10 Sekunden bestätigt.';
                this.lastCompatibilityTest = `${new Date().toISOString()} – FEHLGESCHLAGEN mit „${originalValue}“`;
                await this.setStateAsync('info.lastError', 'Alexa-Schreibkompatibilitätstest fehlgeschlagen. Echte Sortier-Schreibzugriffe bleiben aus Sicherheitsgründen blockiert; Dry-Run kann weiter verwendet werden.', true);
                this.log.error('Alexa-Schreibkompatibilitätstest fehlgeschlagen. Schreibzugriffe bleiben blockiert.');
            }
            await this.setStateAsync('info.lastCompatibilityTest', this.lastCompatibilityTest, true);
            await this.updateCompatibilityDiagnostics();
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.writeCapability = 'live-failed';
            this.compatibilityDetail = `Live-Test konnte nicht abgeschlossen werden: ${message}`;
            this.lastCompatibilityTest = `${new Date().toISOString()} – FEHLER: ${message}`;
            await this.setStateAsync('info.lastCompatibilityTest', this.lastCompatibilityTest, true);
            await this.setStateAsync('info.lastError', `Kompatibilitätstest: ${message}`, true);
            await this.updateCompatibilityDiagnostics();
            this.log.error(`Kompatibilitätstest: ${message}`);
        }
        finally {
            this.compatibilityTesting = false;
        }
    }
    async updateCompatibilityDiagnostics() {
        await this.setStateAsync('info.writeCapability', this.writeCapability, true);
        await this.setStateAsync('info.lastCompatibilityTest', this.lastCompatibilityTest, true);
        await this.setStateAsync('info.compatibility', JSON.stringify({
            shoppingrouteVersion: '0.1.0-beta.1',
            beta: true,
            alexaInstance: this.alexaInstance,
            alexa2Version: this.alexa2Version,
            alexaRemote2Version: this.alexaRemote2Version,
            listName: this.listName,
            listStateId: this.listStateId,
            dryRun: this.dryRun,
            writeCapability: this.writeCapability,
            detail: this.compatibilityDetail,
            lastCompatibilityTest: this.lastCompatibilityTest,
            requiredAlexaAppSorting: 'Älteste bis neueste / Oldest to newest',
            checkedAt: new Date().toISOString(),
        }, null, 2), true);
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
                products: [...this.runtimeProducts]
                    .sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }))
                    .map(product => ({ ...product })),
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