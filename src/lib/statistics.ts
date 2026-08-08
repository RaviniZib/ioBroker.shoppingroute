import type { ParsedItem } from './model';

export interface UsageStatistics {
    startedAt: string;
    lastUpdated: string;
    totalAddedItems: number;
    byProduct: Record<string, number>;
    byMarket: Record<string, number>;
    byCategory: Record<string, number>;
    byList: Record<string, number>;
    automaticLearned: number;
    reviewAccepted: number;
    reviewIgnored: number;
}

export function emptyUsageStatistics(now = new Date()): UsageStatistics {
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

export function normalizeUsageStatistics(value: unknown, now = new Date()): UsageStatistics {
    const base = emptyUsageStatistics(now);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return base;
    const raw = value as Partial<UsageStatistics>;
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

function increment(map: Record<string, number>, key: string): void {
    const safe = String(key || '').trim() || 'Unbekannt';
    map[safe] = (Number(map[safe]) || 0) + 1;
}

export function recordAddedItem(stats: UsageStatistics, listName: string, parsed: ParsedItem): UsageStatistics {
    const result = normalizeUsageStatistics(stats);
    result.totalAddedItems += 1;
    result.lastUpdated = new Date().toISOString();
    increment(result.byProduct, parsed.productName);
    increment(result.byMarket, parsed.market);
    increment(result.byCategory, parsed.category);
    increment(result.byList, listName);
    return result;
}
