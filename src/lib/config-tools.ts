import type { AdapterConfigShape, ConfigExport, MarketConfig, MarketProfile, ProductGroupConfig, RouteConfig } from './model';

const EXPORT_KEYS: Array<keyof AdapterConfigShape> = [
    'alexaInstance', 'listName', 'lists', 'dryRun', 'autoLearnProducts', 'learningMode',
    'autoAliasSuggestions', 'debounceMs', 'writePauseMs', 'apiSafeMode', 'maxWritesPerMinute',
    'batchSize', 'batchPauseMs', 'maxWriteRetries', 'retryBaseMs', 'fallbackMarket', 'priorityMarket',
    'temporaryPriorityMarket', 'productGroups', 'markets', 'routes', 'products', 'reviewItems',
];

export function exportConfig(config: AdapterConfigShape, version: string, now = new Date()): ConfigExport {
    const clean: Partial<AdapterConfigShape> = {};
    for (const key of EXPORT_KEYS) {
        const value = config[key];
        if (value !== undefined) (clean as Record<string, unknown>)[key] = structuredClone(value);
    }
    return {
        format: 'shoppingroute-config-v1',
        exportedAt: now.toISOString(),
        version,
        config: clean,
    };
}

export function parseConfigImport(text: string): Partial<AdapterConfigShape> {
    const parsed = JSON.parse(String(text || '')) as Partial<ConfigExport> | Partial<AdapterConfigShape>;
    const source = (parsed as ConfigExport).format === 'shoppingroute-config-v1'
        ? (parsed as ConfigExport).config
        : parsed as Partial<AdapterConfigShape>;
    if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('Konfigurationsimport enthält kein Objekt.');

    const clean: Partial<AdapterConfigShape> = {};
    for (const key of EXPORT_KEYS) {
        if ((source as Record<string, unknown>)[key] !== undefined) {
            (clean as Record<string, unknown>)[key] = structuredClone((source as Record<string, unknown>)[key]);
        }
    }
    return clean;
}

export function buildMarketProfiles(markets: MarketConfig[], routes: RouteConfig[]): MarketProfile[] {
    return markets
        .filter(market => market.name)
        .sort((a, b) => (Number(a.order) || 9999) - (Number(b.order) || 9999))
        .map(market => ({
            format: 'shoppingroute-market-profile-v1',
            market: { ...market },
            route: routes
                .filter(route => route.market.toLocaleLowerCase('de') === market.name.toLocaleLowerCase('de'))
                .map((route, index) => ({ ...route, order: (index + 1) * 10 })),
        }));
}

export function importMarketProfile(
    text: string,
    markets: MarketConfig[],
    routes: RouteConfig[],
): { markets: MarketConfig[]; routes: RouteConfig[]; market: string } {
    const profile = JSON.parse(String(text || '')) as MarketProfile;
    if (profile.format !== 'shoppingroute-market-profile-v1' || !profile.market?.name || !Array.isArray(profile.route)) {
        throw new Error('Ungültiges ShoppingRoute-Marktprofil.');
    }

    const name = profile.market.name.trim();
    const nextMarkets = markets.filter(market => market.name.toLocaleLowerCase('de') !== name.toLocaleLowerCase('de'));
    nextMarkets.push({ ...profile.market, name });
    nextMarkets.sort((a, b) => (Number(a.order) || 9999) - (Number(b.order) || 9999));

    const nextRoutes = routes.filter(route => route.market.toLocaleLowerCase('de') !== name.toLocaleLowerCase('de'));
    profile.route.forEach((route, index) => nextRoutes.push({
        market: name,
        category: route.category,
        order: (index + 1) * 10,
    }));

    return { markets: nextMarkets, routes: nextRoutes, market: name };
}

export function ensureMarketRoutes(
    markets: MarketConfig[],
    productGroups: ProductGroupConfig[],
    routes: RouteConfig[],
): { routes: RouteConfig[]; added: number } {
    const result = routes.filter(Boolean).map(route => ({ ...route }));
    const existing = new Set(
        result.map(route => `${String(route.market || '').trim().toLocaleLowerCase('de')}\u0000${String(route.category || '').trim().toLocaleLowerCase('de')}`),
    );
    let added = 0;

    const activeMarkets = markets
        .filter(market => market && market.name && market.enabled !== false)
        .slice()
        .sort((a, b) => (Number(a.order) || 9999) - (Number(b.order) || 9999));
    const groups = productGroups
        .filter(group => group && group.name)
        .map(group => String(group.name).trim())
        .filter(Boolean);

    for (const market of activeMarkets) {
        const marketName = String(market.name).trim();
        const marketKey = marketName.toLocaleLowerCase('de');
        for (const category of groups) {
            const key = `${marketKey}\u0000${category.toLocaleLowerCase('de')}`;
            if (existing.has(key)) continue;
            result.push({ market: marketName, category, order: 0 });
            existing.add(key);
            added += 1;
        }
    }

    return { routes: reindexRoutes(result), added };
}

export function reindexRoutes(routes: RouteConfig[]): RouteConfig[] {
    const counters = new Map<string, number>();
    return routes.map(route => {
        const key = String(route.market || '').toLocaleLowerCase('de');
        const next = (counters.get(key) || 0) + 1;
        counters.set(key, next);
        return { ...route, order: next * 10 };
    });
}
