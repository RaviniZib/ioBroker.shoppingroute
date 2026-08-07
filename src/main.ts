import * as utils from '@iobroker/adapter-core';
import * as fs from 'node:fs';
import * as path from 'node:path';

declare const require: any;
declare const module: any;
import type { AdapterConfigShape, AlexaListItem, MarketConfig, ProductConfig, ProductGroupConfig, RouteConfig } from './lib/model';
import { canWriteAlexa, inspectAlexaRemoteSource, type WriteCapability } from './lib/compatibility';
import { activeIdSignature, activeItems, collectUnknownItems, createSortPlan, mergeUnknownProducts, sortSlotsOldestFirst } from './lib/sorter';

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

export class ShoppingRoute extends utils.Adapter {
    private sortTimer: ReturnType<typeof setTimeout> | null = null;
    private sorting = false;
    private abortAndRerun = false;
    private listChangedDuringSort = false;
    private runtimeProducts: ProductConfig[] | null = null;
    private productsDirty = false;
    private compatibilityTesting = false;
    private writeCapability: WriteCapability = 'unknown';
    private compatibilityDetail = 'Noch nicht geprüft.';
    private alexa2Version = 'unbekannt';
    private alexaRemote2Version = 'unbekannt';
    private lastCompatibilityTest = 'Noch nicht ausgeführt.';

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: 'shoppingroute',
        });

        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    private get cfg(): AdapterConfigShape {
        return this.config as unknown as AdapterConfigShape;
    }

    private get alexaInstance(): string {
        return String(this.cfg.alexaInstance || 'alexa2.0').trim() || 'alexa2.0';
    }

    private get listName(): string {
        return String(this.cfg.listName || 'SHOP').trim() || 'SHOP';
    }

    private get listStateId(): string {
        return `${this.alexaInstance}.Lists.${this.listName}.json`;
    }

    private get markets(): MarketConfig[] {
        const configured = Array.isArray(this.cfg.markets) ? this.cfg.markets : [];
        return configured.filter(market => market && market.name && market.enabled !== false);
    }

    private get routes(): RouteConfig[] {
        return Array.isArray(this.cfg.routes) ? this.cfg.routes.filter(Boolean) : [];
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
        if (this.runtimeProducts) return this.runtimeProducts.filter(product => product && product.name);
        return Array.isArray(this.cfg.products) ? this.cfg.products.filter(product => product && product.name) : [];
    }

    private get fallbackMarket(): string {
        return String(this.cfg.fallbackMarket || 'Ohne Markt').trim() || 'Ohne Markt';
    }

    private get priorityMarket(): string {
        return String(this.cfg.priorityMarket || '').trim();
    }

    private get debounceMs(): number {
        return Math.max(250, Number(this.cfg.debounceMs) || 2500);
    }

    private get writePauseMs(): number {
        return Math.max(250, Number(this.cfg.writePauseMs) || 1000);
    }

    private get dryRun(): boolean {
        return this.cfg.dryRun !== false;
    }

    private get autoLearnProducts(): boolean {
        return this.cfg.autoLearnProducts !== false;
    }

    private async onReady(): Promise<void> {
        const configuredProducts = (Array.isArray(this.cfg.products) ? this.cfg.products : [])
            .filter(product => product && product.name)
            .map(product => ({ ...product }));
        this.runtimeProducts = [...configuredProducts]
            .sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));
        this.productsDirty = configuredProducts.some((product, index) => product.name !== this.runtimeProducts?.[index]?.name);

        await this.ensureProductGroupsConfig();
        if (this.productsDirty) await this.persistProductsConfig();

        await this.setStateAsync('info.connection', false, true);
        await this.setStateAsync('info.lastError', '', true);

        const enabled = await this.getStateAsync('control.enabled');
        if (!enabled) await this.setStateAsync('control.enabled', true, true);
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
        this.log.info(
            `Prioritätsmarkt: ${this.priorityMarket || 'keiner'}. ` +
            `Artikel automatisch lernen: ${this.autoLearnProducts ? 'JA' : 'NEIN'}.`,
        );
        this.log.info('WICHTIG: Die Alexa-App muss für diese Liste auf „Älteste bis neueste“ gestellt sein.');
        this.scheduleSort(500);
    }

    private onMessage(obj: { command: string; from: string; callback?: any }): void {
        if (!obj || !obj.callback) return;

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

    private async onStateChange(
        id: string,
        state: { val: unknown; ack: boolean } | null | undefined,
    ): Promise<void> {
        if (!state) return;

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
                if (state.val === true) this.scheduleSort(250);
            }
            return;
        }

        if (id === this.listStateId) {
            await this.setStateAsync('info.connection', true, true);
            if (this.compatibilityTesting) return;
            if (this.sorting) {
                this.listChangedDuringSort = true;
                return;
            }
            this.scheduleSort(this.debounceMs);
        }
    }

    private onUnload(callback: () => void): void {
        if (this.sortTimer) clearTimeout(this.sortTimer);
        this.setState('info.connection', false, true);
        callback();
    }

    private scheduleSort(delay: number): void {
        if (this.sortTimer) clearTimeout(this.sortTimer);
        this.sortTimer = setTimeout(() => {
            this.sortTimer = null;
            void this.sortList();
        }, delay);
    }

    private async isEnabled(): Promise<boolean> {
        const state = await this.getStateAsync('control.enabled');
        return !state || state.val !== false;
    }

    private async readList(): Promise<AlexaListItem[]> {
        const state = await this.getForeignStateAsync(this.listStateId);
        if (!state || typeof state.val !== 'string' || !state.val.trim()) {
            throw new Error(`Datenpunkt ${this.listStateId} enthält keine lesbare Liste.`);
        }

        const parsed: unknown = JSON.parse(state.val);
        if (!Array.isArray(parsed)) throw new Error(`${this.listStateId} enthält kein JSON-Array.`);

        return parsed as AlexaListItem[];
    }

    private async sortList(): Promise<void> {
        if (this.sorting) {
            this.abortAndRerun = true;
            return;
        }
        if (!(await this.isEnabled())) return;

        this.sorting = true;
        this.abortAndRerun = false;
        this.listChangedDuringSort = false;
        let learnedThisRun: ProductConfig[] = [];

        try {
            const list = await this.readList();
            const active = activeItems(list);
            await this.setStateAsync('info.activeItems', active.length, true);
            await this.setStateAsync('info.connection', true, true);

            if (this.autoLearnProducts) {
                const merged = mergeUnknownProducts(
                    list,
                    this.markets,
                    this.products,
                    this.fallbackMarket,
                    this.priorityMarket,
                );
                if (merged.learned.length > 0) {
                    this.runtimeProducts = merged.products;
                    this.productsDirty = true;
                    learnedThisRun = merged.learned;
                    await this.setStateAsync('info.lastLearnedItems', JSON.stringify(learnedThisRun, null, 2), true);
                    this.log.info(
                        `Neue Artikel gelernt: ${merged.learned.map(product => `„${product.name}“`).join(', ')}.`,
                    );
                }
            }

            const unknown = collectUnknownItems(
                list,
                this.markets,
                this.products,
                this.fallbackMarket,
                this.priorityMarket,
            );
            await this.setStateAsync('info.unknownItems', JSON.stringify(unknown, null, 2), true);

            const plan = createSortPlan(
                list,
                this.markets,
                this.routes,
                this.products,
                this.fallbackMarket,
                this.priorityMarket,
            );
            await this.setStateAsync('info.lastPlan', JSON.stringify(plan, null, 2), true);

            const changes = plan.filter(entry => entry.changed);
            const now = new Date().toISOString();

            if (changes.length === 0) {
                await this.setStateAsync('info.lastSort', `${now} – bereits sortiert (${active.length} aktiv)`, true);
                await this.setStateAsync('info.lastError', '', true);
                return;
            }

            this.log.info(
                `Sortierplan: ${active.length} aktive Artikel, ${changes.length} Textänderung(en)` +
                `${this.dryRun ? ' [DRY-RUN]' : ''}.`,
            );
            for (const entry of changes) {
                this.log.info(
                    `Platz ${entry.position}: „${entry.from}“ → „${entry.to}“ ` +
                    `[${entry.market} / ${entry.category}]`,
                );
            }

            if (this.dryRun) {
                await this.setStateAsync(
                    'info.lastSort',
                    `${now} – Dry-Run: ${changes.length} Änderung(en) geplant`,
                    true,
                );
                await this.setStateAsync('info.lastError', '', true);
                return;
            }

            if (!canWriteAlexa(this.writeCapability)) {
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

            const originalSignature = activeIdSignature(list);

            for (const entry of changes) {
                const fresh = await this.readList();
                if (activeIdSignature(fresh) !== originalSignature) {
                    this.abortAndRerun = true;
                    this.log.warn('Liste wurde während der Sortierung ergänzt oder abgehakt. Durchlauf wird neu berechnet.');
                    break;
                }

                const currentItem = activeItems(fresh).find(item => String(item.id) === entry.id);
                if (!currentItem || String(currentItem.value).trim() !== entry.from) {
                    this.abortAndRerun = true;
                    this.log.warn(
                        `Eintrag ${entry.id} wurde während der Sortierung verändert. Durchlauf wird neu berechnet.`,
                    );
                    break;
                }

                const valueStateId = `${this.alexaInstance}.Lists.${this.listName}.items.${entry.id}.value`;
                const valueObject = await this.getForeignObjectAsync(valueStateId);
                if (!valueObject) throw new Error(`Alexa-Wertedatenpunkt fehlt: ${valueStateId}`);

                await this.setForeignStateAsync(valueStateId, { val: entry.to, ack: false });
                await this.wait(this.writePauseMs);
            }

            if (this.abortAndRerun) return;

            await this.wait(Math.max(1000, this.writePauseMs));
            const verifyList = await this.readList();

            if (activeIdSignature(verifyList) !== originalSignature) {
                this.abortAndRerun = true;
                this.log.warn('Liste wurde unmittelbar nach der Sortierung verändert. Neue Berechnung folgt.');
                return;
            }

            const verifyPlan = createSortPlan(
                verifyList,
                this.markets,
                this.routes,
                this.products,
                this.fallbackMarket,
                this.priorityMarket,
            );
            const remaining = verifyPlan.filter(entry => entry.changed);

            if (remaining.length > 0) {
                const message =
                    `Alexa hat ${remaining.length} geplante Textänderung(en) nicht bestätigt. ` +
                    'Kein automatischer Wiederholungsloop wird gestartet.';
                await this.setError(message);
                this.log.error(message);
                return;
            }

            await this.setStateAsync(
                'info.lastSort',
                `${new Date().toISOString()} – ${changes.length} Änderung(en), ${active.length} aktive Artikel`,
                true,
            );
            await this.setStateAsync('info.lastError', '', true);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await this.setError(message);
            this.log.error(message);
        } finally {
            this.sorting = false;
            if (this.productsDirty) await this.persistProductsConfig();
            if (this.abortAndRerun) {
                this.abortAndRerun = false;
                this.scheduleSort(this.debounceMs);
            } else if (this.listChangedDuringSort) {
                // Own value writes also update SHOP.json. Verify once, but the no-change plan prevents a loop.
                this.listChangedDuringSort = false;
                this.scheduleSort(this.debounceMs);
            }
        }
    }

    private async runStartupCompatibilityCheck(): Promise<void> {
        try {
            const alexaObject = await this.getForeignObjectAsync(`system.adapter.${this.alexaInstance}`);
            this.alexa2Version = String((alexaObject?.common as { version?: unknown } | undefined)?.version || 'unbekannt');
        } catch {
            this.alexa2Version = 'unbekannt';
        }

        try {
            const resolved = require.resolve('alexa-remote2');
            const source = fs.readFileSync(resolved, 'utf8');
            const inspection = inspectAlexaRemoteSource(source);
            this.writeCapability = inspection.status;
            this.compatibilityDetail = inspection.detail;
            this.alexaRemote2Version = this.findPackageVersion(resolved, 'alexa-remote2');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.writeCapability = 'unknown';
            this.compatibilityDetail = `alexa-remote2 konnte nicht automatisch geprüft werden: ${message}`;
            this.alexaRemote2Version = 'unbekannt';
        }

        if (this.writeCapability === 'known-bug') {
            this.log.error(
                'Bekannte inkompatible alexa-remote2 updateListItem-Version erkannt. ' +
                'Echte Alexa-Schreibzugriffe werden von shoppingroute blockiert; Dry-Run bleibt möglich.',
            );
        } else if (this.writeCapability === 'source-ok') {
            this.log.info('Alexa2-Schreibkompatibilität: bekannte version-Query ist in alexa-remote2 korrigiert.');
        } else {
            this.log.warn(
                'Alexa2-Schreibkompatibilität konnte aus der installierten Quelle nicht eindeutig bestimmt werden. ' +
                'Vor echten Schreibzugriffen bitte control.compatibilityTest ausführen.',
            );
        }

        await this.updateCompatibilityDiagnostics();
    }

    private findPackageVersion(moduleFile: string, expectedName: string): string {
        let current = path.dirname(moduleFile);
        for (let level = 0; level < 6; level++) {
            const packageFile = path.join(current, 'package.json');
            try {
                const parsed = JSON.parse(fs.readFileSync(packageFile, 'utf8')) as { name?: string; version?: string };
                if (parsed.name === expectedName && parsed.version) return String(parsed.version);
            } catch {
                // Continue walking towards the package root.
            }
            const parent = path.dirname(current);
            if (parent === current) break;
            current = parent;
        }
        return 'unbekannt';
    }

    private async runLiveCompatibilityTest(): Promise<void> {
        if (this.compatibilityTesting) return;
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
            const active = sortSlotsOldestFirst(activeItems(list));
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
            if (!valueObject || !before) throw new Error(`Alexa-Wertedatenpunkt fehlt oder ist nicht lesbar: ${valueStateId}`);

            const beforeTs = Number((before as { ts?: number }).ts || 0);
            this.log.info(
                `Starte Alexa-Schreibkompatibilitätstest mit „${originalValue}“. ` +
                'Es wird ausschließlich derselbe value-Text erneut geschrieben; der sichtbare Listentext bleibt unverändert.',
            );

            await this.setForeignStateAsync(valueStateId, { val: originalValue, ack: false });

            const timeoutAt = Date.now() + 10000;
            let confirmed = false;
            while (Date.now() < timeoutAt) {
                await this.wait(250);
                const current = await this.getForeignStateAsync(valueStateId);
                if (
                    current &&
                    current.ack === true &&
                    String(current.val ?? '').trim() === originalValue &&
                    Number((current as { ts?: number }).ts || 0) > beforeTs
                ) {
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
            } else {
                this.writeCapability = 'live-failed';
                this.compatibilityDetail = 'Live-Test fehlgeschlagen: Alexa2 hat den erneuten value-Schreibzugriff nicht innerhalb von 10 Sekunden bestätigt.';
                this.lastCompatibilityTest = `${new Date().toISOString()} – FEHLGESCHLAGEN mit „${originalValue}“`;
                await this.setStateAsync(
                    'info.lastError',
                    'Alexa-Schreibkompatibilitätstest fehlgeschlagen. Echte Sortier-Schreibzugriffe bleiben aus Sicherheitsgründen blockiert; Dry-Run kann weiter verwendet werden.',
                    true,
                );
                this.log.error('Alexa-Schreibkompatibilitätstest fehlgeschlagen. Schreibzugriffe bleiben blockiert.');
            }

            await this.setStateAsync('info.lastCompatibilityTest', this.lastCompatibilityTest, true);
            await this.updateCompatibilityDiagnostics();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.writeCapability = 'live-failed';
            this.compatibilityDetail = `Live-Test konnte nicht abgeschlossen werden: ${message}`;
            this.lastCompatibilityTest = `${new Date().toISOString()} – FEHLER: ${message}`;
            await this.setStateAsync('info.lastCompatibilityTest', this.lastCompatibilityTest, true);
            await this.setStateAsync('info.lastError', `Kompatibilitätstest: ${message}`, true);
            await this.updateCompatibilityDiagnostics();
            this.log.error(`Kompatibilitätstest: ${message}`);
        } finally {
            this.compatibilityTesting = false;
        }
    }

    private async updateCompatibilityDiagnostics(): Promise<void> {
        await this.setStateAsync('info.writeCapability', this.writeCapability, true);
        await this.setStateAsync('info.lastCompatibilityTest', this.lastCompatibilityTest, true);
        await this.setStateAsync(
            'info.compatibility',
            JSON.stringify(
                {
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
                },
                null,
                2,
            ),
            true,
        );
    }

    private async ensureProductGroupsConfig(): Promise<void> {
        if (Array.isArray(this.cfg.productGroups) && this.cfg.productGroups.length > 0) return;

        try {
            const instanceId = `system.adapter.${this.namespace}`;
            const object = await this.getForeignObjectAsync(instanceId);
            if (!object) return;

            const currentNative = (object.native || {}) as Record<string, unknown>;
            object.native = {
                ...currentNative,
                productGroups: DEFAULT_CATEGORIES.map(name => ({ name })),
            };
            await this.setForeignObjectAsync(instanceId, object);
            this.log.info('Standard-Produktgruppen wurden in die Adapterkonfiguration übernommen.');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.log.warn(`Produktgruppen konnten nicht initialisiert werden: ${message}`);
        }
    }

    private async persistProductsConfig(): Promise<void> {
        if (!this.productsDirty || !this.runtimeProducts) return;

        try {
            const instanceId = `system.adapter.${this.namespace}`;
            const object = await this.getForeignObjectAsync(instanceId);
            if (!object) throw new Error(`Instanzobjekt nicht gefunden: ${instanceId}`);

            const currentNative = (object.native || {}) as Record<string, unknown>;
            object.native = {
                ...currentNative,
                products: [...this.runtimeProducts]
                    .sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }))
                    .map(product => ({ ...product })),
            };

            await this.setForeignObjectAsync(instanceId, object);
            this.productsDirty = false;
            this.log.info(
                `Artikelstamm gespeichert (${this.runtimeProducts.length} Artikel). ` +
                'Die Admin-Konfigurationsseite ggf. neu öffnen, um neue Artikel zu sehen.',
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await this.setStateAsync('info.lastError', `Artikelstamm konnte nicht gespeichert werden: ${message}`, true);
            this.log.error(`Artikelstamm konnte nicht gespeichert werden: ${message}`);
        }
    }

    private async setError(message: string): Promise<void> {
        await this.setStateAsync('info.lastError', message, true);
        await this.setStateAsync('info.connection', false, true);
    }

    private wait(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    public static getDefaultCategories(): string[] {
        return [...DEFAULT_CATEGORIES];
    }
}

if (require.main !== module) {
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new ShoppingRoute(options);
} else {
    (() => new ShoppingRoute())();
}
