"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toTimestamp = toTimestamp;
exports.activeItems = activeItems;
exports.activeIdSignature = activeIdSignature;
exports.sortSlotsOldestFirst = sortSlotsOldestFirst;
exports.buildDesiredItems = buildDesiredItems;
exports.createSortPlan = createSortPlan;
exports.collectUnknownItems = collectUnknownItems;
const parser_1 = require("./parser");
function toTimestamp(value) {
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value === 'string' && value.trim()) {
        const numeric = Number(value);
        if (Number.isFinite(numeric))
            return numeric;
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed))
            return parsed;
    }
    return 0;
}
function marketOrder(markets, marketName) {
    const market = markets.find(entry => (0, parser_1.normalize)(entry.name) === (0, parser_1.normalize)(marketName));
    return Number.isFinite(Number(market?.order)) ? Number(market?.order) : 9999;
}
function categoryOrder(routes, marketName, category) {
    const route = routes.find(entry => (0, parser_1.normalize)(entry.market) === (0, parser_1.normalize)(marketName) &&
        (0, parser_1.normalize)(entry.category) === (0, parser_1.normalize)(category));
    return Number.isFinite(Number(route?.order)) ? Number(route?.order) : 9999;
}
function activeItems(list) {
    return list.filter(item => item &&
        item.completed === false &&
        Boolean(item.id) &&
        Boolean(String(item.value || '').trim()));
}
function activeIdSignature(list) {
    return activeItems(list)
        .map(item => String(item.id))
        .sort()
        .join('|');
}
function sortSlotsOldestFirst(items) {
    return [...items].sort((a, b) => {
        const timeA = toTimestamp(a.createdDateTime);
        const timeB = toTimestamp(b.createdDateTime);
        if (timeA !== timeB)
            return timeA - timeB;
        return String(a.id).localeCompare(String(b.id));
    });
}
function buildDesiredItems(items, markets, routes, products, fallbackMarket) {
    return items
        .map(source => {
        const parsed = (0, parser_1.parseItem)(String(source.value), markets, products, fallbackMarket);
        return {
            source,
            parsed,
            marketOrder: marketOrder(markets, parsed.market),
            categoryOrder: categoryOrder(routes, parsed.market, parsed.category),
        };
    })
        .sort((a, b) => {
        if (a.marketOrder !== b.marketOrder)
            return a.marketOrder - b.marketOrder;
        if (a.categoryOrder !== b.categoryOrder)
            return a.categoryOrder - b.categoryOrder;
        const categoryCompare = a.parsed.category.localeCompare(b.parsed.category, 'de', { sensitivity: 'base' });
        if (categoryCompare !== 0 && a.categoryOrder === 9999 && b.categoryOrder === 9999)
            return categoryCompare;
        return a.parsed.productName.localeCompare(b.parsed.productName, 'de', { sensitivity: 'base' });
    });
}
function createSortPlan(items, markets, routes, products, fallbackMarket) {
    const active = activeItems(items);
    const slots = sortSlotsOldestFirst(active);
    const desired = buildDesiredItems(active, markets, routes, products, fallbackMarket);
    return slots.map((slot, index) => {
        const target = desired[index];
        const from = String(slot.value).trim();
        const to = target?.parsed.originalText || from;
        return {
            position: index + 1,
            id: String(slot.id),
            createdDateTime: toTimestamp(slot.createdDateTime),
            from,
            to,
            market: target?.parsed.market || fallbackMarket,
            category: target?.parsed.category || 'Sonstiges',
            changed: from !== to,
        };
    });
}
function collectUnknownItems(items, markets, products, fallbackMarket) {
    const seen = new Set();
    const result = [];
    for (const item of activeItems(items)) {
        const parsed = (0, parser_1.parseItem)(String(item.value), markets, products, fallbackMarket);
        if (parsed.knownProduct)
            continue;
        const key = (0, parser_1.normalize)(parsed.productName);
        if (!key || seen.has(key))
            continue;
        seen.add(key);
        result.push({
            text: parsed.originalText,
            product: parsed.productName,
            market: parsed.market,
            guessedCategory: parsed.category,
        });
    }
    return result;
}
//# sourceMappingURL=sorter.js.map