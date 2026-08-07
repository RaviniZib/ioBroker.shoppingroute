import * as utils from '@iobroker/adapter-core';

declare const require: any;
declare const module: any;
import type { AdapterConfigShape, AlexaListItem, MarketConfig, ProductConfig, ProductGroupConfig, RouteConfig } from './lib/model';
import { activeIdSignature, activeItems, collectUnknownItems, createSortPlan, mergeUnknownProducts } from './lib/sorter';

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

        if (id === `${this.namespace}.control.enabled`) {
            if (!state.ack) {
                await this.setStateAsync('control.enabled', Boolean(state.val), true);
                if (state.val === true) this.scheduleSort(250);
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
