"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toTimestamp = toTimestamp;
exports.activeItems = activeItems;
exports.activeIdSignature = activeIdSignature;
exports.sortSlotsOldestFirst = sortSlotsOldestFirst;
exports.buildDesiredItems = buildDesiredItems;
exports.createSortPlan = createSortPlan;
exports.collectUnknownItems = collectUnknownItems;
exports.mergeUnknownProducts = mergeUnknownProducts;
exports.mergeReviewQueue = mergeReviewQueue;
exports.applyReviewActions = applyReviewActions;
exports.makePreviewText = makePreviewText;
const parser_1 = require("./parser");
const market_plan_1 = require("./market-plan");
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
    const marketRoutes = routes.filter(entry => (0, parser_1.normalize)(entry.market) === (0, parser_1.normalize)(marketName));
    const index = marketRoutes.findIndex(entry => (0, parser_1.normalize)(entry.category) === (0, parser_1.normalize)(category));
    if (index >= 0)
        return (index + 1) * 10;
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
function buildDesiredItems(items, markets, routes, products, fallbackMarket, priorityMarket = '', minimumItemsPerMarket = 1) {
    return (0, market_plan_1.optimizeMarketAssignments)(items, markets, products, fallbackMarket, priorityMarket, minimumItemsPerMarket)
        .map(({ source, parsed }) => {
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
function createSortPlan(items, markets, routes, products, fallbackMarket, priorityMarket = '', minimumItemsPerMarket = 1, marketHeaders = false) {
    const active = activeItems(items);
    const real = active.filter(item => !(0, market_plan_1.isMarketHeader)(String(item.value), markets));
    const slots = sortSlotsOldestFirst(active);
    const desired = buildDesiredItems(real, markets, routes, products, fallbackMarket, priorityMarket, minimumItemsPerMarket);
    const targets = [];
    let lastMarket = '';
    for (const target of desired) {
        const market = target.parsed.market;
        if (marketHeaders &&
            (0, parser_1.normalize)(market) !== (0, parser_1.normalize)(fallbackMarket) &&
            (0, parser_1.normalize)(market) !== (0, parser_1.normalize)(lastMarket)) {
            const header = (0, market_plan_1.formatMarketHeader)(market);
            targets.push({ text: header, market, category: '', product: header });
        }
        targets.push({
            text: target.parsed.originalText,
            market,
            category: target.parsed.category,
            product: target.parsed.productName,
        });
        lastMarket = market;
    }
    // Header creation/completion is reconciled before sorting. If the slot count is not yet
    // synchronized, leave all texts untouched rather than risk losing or overwriting an item.
    if (targets.length !== slots.length) {
        return slots.map((slot, index) => {
            const from = String(slot.value).trim();
            return {
                position: index + 1,
                id: String(slot.id),
                createdDateTime: toTimestamp(slot.createdDateTime),
                from,
                to: from,
                market: fallbackMarket,
                category: '',
                product: from,
                changed: false,
            };
        });
    }
    return slots.map((slot, index) => {
        const target = targets[index];
        const from = String(slot.value).trim();
        const to = target?.text || from;
        return {
            position: index + 1,
            id: String(slot.id),
            createdDateTime: toTimestamp(slot.createdDateTime),
            from,
            to,
            market: target?.market || fallbackMarket,
            category: target?.category || '',
            product: target?.product || to,
            changed: from !== to,
        };
    });
}
function collectUnknownItems(items, markets, products, fallbackMarket, priorityMarket = '') {
    const seen = new Set();
    const result = [];
    for (const item of activeItems(items)) {
        if ((0, market_plan_1.isMarketHeader)(String(item.value), markets))
            continue;
        const parsed = (0, parser_1.parseItem)(String(item.value), markets, products, fallbackMarket, priorityMarket);
        if (parsed.knownProduct)
            continue;
        const key = (0, parser_1.canonicalProductKey)(parsed.productName) || (0, parser_1.normalize)(parsed.productName);
        if (!key || seen.has(key))
            continue;
        seen.add(key);
        result.push({
            key,
            text: parsed.originalText,
            product: parsed.productName,
            market: parsed.market,
            guessedCategory: parsed.category,
            ambiguousMarketSuffix: parsed.ambiguousMarketSuffix,
        });
    }
    return result;
}
function mergeUnknownProducts(items, markets, products, fallbackMarket, priorityMarket = '') {
    const merged = products.map(product => ({ ...product }));
    const learned = [];
    const knownKeys = new Set(merged.flatMap(product => [product.name, ...(String(product.aliases || '').split(/[;,]/))])
        .map(parser_1.canonicalProductKey)
        .filter(Boolean));
    const unknown = collectUnknownItems(items, markets, merged, fallbackMarket, priorityMarket);
    for (const entry of unknown) {
        const name = String(entry.product || '').trim();
        const key = (0, parser_1.canonicalProductKey)(name);
        if (!key || knownKeys.has(key))
            continue;
        if (entry.ambiguousMarketSuffix)
            continue;
        const existing = (0, parser_1.findProduct)(name, merged);
        if (existing)
            continue;
        const product = {
            name,
            aliases: '',
            category: entry.guessedCategory || 'Sonstiges',
            defaultMarket: '',
            availableMarkets: '',
        };
        merged.push(product);
        learned.push(product);
        knownKeys.add(key);
    }
    return { products: merged, learned };
}
function mergeReviewQueue(current, unknown, now = new Date().toISOString()) {
    const byKey = new Map(current.map(item => [item.key, { ...item }]));
    for (const entry of unknown) {
        const previous = byKey.get(entry.key);
        if (previous?.action === 'ignore') {
            previous.lastSeen = now;
            byKey.set(entry.key, previous);
            continue;
        }
        byKey.set(entry.key, {
            key: entry.key,
            text: entry.text,
            product: previous?.product || entry.product,
            guessedCategory: entry.guessedCategory,
            market: entry.market,
            category: previous?.category || entry.guessedCategory,
            defaultMarket: previous?.defaultMarket || '',
            aliases: previous?.aliases || '',
            action: previous?.action || 'pending',
            firstSeen: previous?.firstSeen || now,
            lastSeen: now,
        });
    }
    return [...byKey.values()].sort((a, b) => a.product.localeCompare(b.product, 'de', { sensitivity: 'base' }));
}
function applyReviewActions(products, reviewItems) {
    const merged = products.map(product => ({ ...product }));
    const accepted = [];
    const remaining = [];
    for (const review of reviewItems) {
        if (review.action !== 'accept') {
            remaining.push({ ...review });
            continue;
        }
        const name = String(review.product || '').trim();
        if (!name)
            continue;
        const existing = (0, parser_1.findProduct)(name, merged);
        if (existing) {
            if (review.category)
                existing.category = review.category;
            if (review.defaultMarket !== undefined)
                existing.defaultMarket = review.defaultMarket;
            if (review.aliases) {
                const aliases = new Set(String(existing.aliases || '').split(/[;,]/).map(value => value.trim()).filter(Boolean));
                for (const alias of review.aliases.split(/[;,]/).map(value => value.trim()).filter(Boolean))
                    aliases.add(alias);
                existing.aliases = [...aliases].join(',');
            }
            accepted.push({ ...existing });
            continue;
        }
        const product = {
            name,
            aliases: String(review.aliases || ''),
            category: String(review.category || review.guessedCategory || 'Sonstiges'),
            defaultMarket: String(review.defaultMarket || ''),
            availableMarkets: '',
        };
        merged.push(product);
        accepted.push(product);
    }
    return {
        products: merged.sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' })),
        remainingReviews: remaining,
        accepted,
    };
}
function makePreviewText(listName, plan) {
    const lines = [`Liste: ${listName}`, `Aktive Plätze: ${plan.length}`, `Änderungen: ${plan.filter(entry => entry.changed).length}`];
    for (const entry of plan) {
        const marker = entry.changed ? '→' : '=';
        lines.push(`${String(entry.position).padStart(2, '0')}. ${entry.from} ${marker} ${entry.to} [${entry.market} / ${entry.category}]`);
    }
    return lines.join('\n');
}
//# sourceMappingURL=sorter.js.map