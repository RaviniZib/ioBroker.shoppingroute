"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activeItems = activeItems;
exports.collectUnknownItems = collectUnknownItems;
exports.mergeUnknownProducts = mergeUnknownProducts;
exports.mergeReviewQueue = mergeReviewQueue;
exports.applyReviewActions = applyReviewActions;
const parser_1 = require("./parser");
const market_plan_1 = require("./market-plan");
function activeItems(list) {
    return list.filter(item => item &&
        item.completed === false &&
        Boolean(item.id) &&
        Boolean(String(item.value || '').trim()));
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
            byKey.set(entry.key, previous);
            continue;
        }
        const next = {
            key: entry.key,
            text: entry.text,
            product: previous?.product || entry.product,
            guessedCategory: entry.guessedCategory,
            market: entry.market,
            category: previous?.category || entry.guessedCategory,
            defaultMarket: previous?.defaultMarket || '',
            availableMarkets: previous?.availableMarkets ?? '',
            aliases: previous?.aliases || '',
            action: previous?.action || 'pending',
            firstSeen: previous?.firstSeen || now,
            lastSeen: now,
        };
        const unchanged = Boolean(previous) &&
            previous.text === next.text &&
            previous.product === next.product &&
            previous.guessedCategory === next.guessedCategory &&
            previous.market === next.market &&
            previous.category === next.category &&
            previous.defaultMarket === next.defaultMarket &&
            JSON.stringify(previous.availableMarkets ?? '') === JSON.stringify(next.availableMarkets ?? '') &&
            previous.aliases === next.aliases &&
            previous.action === next.action &&
            previous.firstSeen === next.firstSeen;
        byKey.set(entry.key, unchanged ? previous : next);
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
            if (review.availableMarkets !== undefined) {
                existing.availableMarkets = Array.isArray(review.availableMarkets)
                    ? [...review.availableMarkets]
                    : String(review.availableMarkets || '');
            }
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
            availableMarkets: Array.isArray(review.availableMarkets)
                ? [...review.availableMarkets]
                : String(review.availableMarkets || ''),
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
//# sourceMappingURL=sorter.js.map