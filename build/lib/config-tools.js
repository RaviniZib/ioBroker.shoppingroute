"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportConfig = exportConfig;
exports.parseConfigImport = parseConfigImport;
exports.buildMarketProfiles = buildMarketProfiles;
exports.importMarketProfile = importMarketProfile;
exports.groupRoutesByMarket = groupRoutesByMarket;
exports.reindexRoutes = reindexRoutes;
exports.normalizeRoutesForAdmin = normalizeRoutesForAdmin;
const EXPORT_KEYS = [
    'alexaInstance', 'listName', 'lists', 'dryRun', 'autoLearnProducts', 'learningMode',
    'autoAliasSuggestions', 'debounceMs', 'writePauseMs', 'apiSafeMode', 'maxWritesPerMinute',
    'batchSize', 'batchPauseMs', 'maxWriteRetries', 'retryBaseMs', 'fallbackMarket', 'priorityMarket',
    'temporaryPriorityMarket', 'productGroups', 'markets', 'routes', 'products', 'reviewItems',
];
function exportConfig(config, version, now = new Date()) {
    const clean = {};
    for (const key of EXPORT_KEYS) {
        const value = config[key];
        if (value !== undefined)
            clean[key] = structuredClone(value);
    }
    return {
        format: 'shoppingroute-config-v1',
        exportedAt: now.toISOString(),
        version,
        config: clean,
    };
}
function parseConfigImport(text) {
    const parsed = JSON.parse(String(text || ''));
    const source = parsed.format === 'shoppingroute-config-v1'
        ? parsed.config
        : parsed;
    if (!source || typeof source !== 'object' || Array.isArray(source))
        throw new Error('Konfigurationsimport enthält kein Objekt.');
    const clean = {};
    for (const key of EXPORT_KEYS) {
        if (source[key] !== undefined) {
            clean[key] = structuredClone(source[key]);
        }
    }
    return clean;
}
function buildMarketProfiles(markets, routes) {
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
function importMarketProfile(text, markets, routes) {
    const profile = JSON.parse(String(text || ''));
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
function groupRoutesByMarket(routes) {
    return routes
        .map((route, index) => ({ route: { ...route }, index }))
        .sort((a, b) => {
        const byMarket = String(a.route.market || '').localeCompare(String(b.route.market || ''), 'de', { sensitivity: 'base' });
        return byMarket || a.index - b.index;
    })
        .map(entry => entry.route);
}
function reindexRoutes(routes) {
    const counters = new Map();
    return routes.map(route => {
        const key = String(route.market || '').toLocaleLowerCase('de');
        const next = (counters.get(key) || 0) + 1;
        counters.set(key, next);
        return { ...route, order: next * 10 };
    });
}
function normalizeRoutesForAdmin(routes) {
    return reindexRoutes(groupRoutesByMarket(routes.filter(Boolean)));
}
//# sourceMappingURL=config-tools.js.map