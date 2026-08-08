"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyUsageStatistics = emptyUsageStatistics;
exports.normalizeUsageStatistics = normalizeUsageStatistics;
exports.recordAddedItem = recordAddedItem;
function emptyUsageStatistics(now = new Date()) {
    const iso = now.toISOString();
    return {
        startedAt: iso,
        lastUpdated: iso,
        totalAddedItems: 0,
        byProduct: {},
        byMarket: {},
        byCategory: {},
        byList: {},
        automaticLearned: 0,
        reviewAccepted: 0,
        reviewIgnored: 0,
    };
}
function normalizeUsageStatistics(value, now = new Date()) {
    const base = emptyUsageStatistics(now);
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return base;
    const raw = value;
    return {
        startedAt: String(raw.startedAt || base.startedAt),
        lastUpdated: String(raw.lastUpdated || base.lastUpdated),
        totalAddedItems: Math.max(0, Number(raw.totalAddedItems) || 0),
        byProduct: { ...(raw.byProduct || {}) },
        byMarket: { ...(raw.byMarket || {}) },
        byCategory: { ...(raw.byCategory || {}) },
        byList: { ...(raw.byList || {}) },
        automaticLearned: Math.max(0, Number(raw.automaticLearned) || 0),
        reviewAccepted: Math.max(0, Number(raw.reviewAccepted) || 0),
        reviewIgnored: Math.max(0, Number(raw.reviewIgnored) || 0),
    };
}
function increment(map, key) {
    const safe = String(key || '').trim() || 'Unbekannt';
    map[safe] = (Number(map[safe]) || 0) + 1;
}
function recordAddedItem(stats, listName, parsed) {
    const result = normalizeUsageStatistics(stats);
    result.totalAddedItems += 1;
    result.lastUpdated = new Date().toISOString();
    increment(result.byProduct, parsed.productName);
    increment(result.byMarket, parsed.market);
    increment(result.byCategory, parsed.category);
    increment(result.byList, listName);
    return result;
}
//# sourceMappingURL=statistics.js.map