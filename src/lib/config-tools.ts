import type { AdapterConfigShape, ConfigExport, MarketConfig, MarketProfile, RouteConfig } from './model';

const EXPORT_KEYS: Array<keyof AdapterConfigShape> = [
    'alexaInstance', 'listName', 'lists', 'dryRun', 'autoLearnProducts', 'learningMode',
    'autoAliasSuggestions', 'logSortSummary', 'apiSafeMode', 'maxWritesPerMinute',
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

export function groupRoutesByMarket(routes: RouteConfig[]): RouteConfig[] {
    return routes
        .map((route, index) => ({ route: { ...route }, index }))
        .sort((a, b) => {
            const byMarket = String(a.route.market || '').localeCompare(String(b.route.market || ''), 'de', { sensitivity: 'base' });
            return byMarket || a.index - b.index;
        })
        .map(entry => entry.route);
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

export function normalizeRoutesForAdmin(routes: RouteConfig[]): RouteConfig[] {
    return reindexRoutes(groupRoutesByMarket(routes.filter(Boolean)));
}
