import type {
    AlexaListItem,
    MarketConfig,
    ProductConfig,
    ReviewItemConfig,
    RouteConfig,
    SortPlanEntry,
    SortableItem,
} from './model';
import { canonicalProductKey, findProduct, normalize, parseItem } from './parser';
import { formatMarketHeader, isMarketHeader, optimizeMarketAssignments } from './market-plan';

export function toTimestamp(value: number | string | undefined): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) return numeric;
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
}

function marketOrder(markets: MarketConfig[], marketName: string): number {
    const market = markets.find(entry => normalize(entry.name) === normalize(marketName));
    return Number.isFinite(Number(market?.order)) ? Number(market?.order) : 9999;
}

function categoryOrder(routes: RouteConfig[], marketName: string, category: string): number {
    const marketRoutes = routes.filter(entry => normalize(entry.market) === normalize(marketName));
    const index = marketRoutes.findIndex(entry => normalize(entry.category) === normalize(category));
    if (index >= 0) return (index + 1) * 10;

    const route = routes.find(entry =>
        normalize(entry.market) === normalize(marketName) &&
        normalize(entry.category) === normalize(category),
    );
    return Number.isFinite(Number(route?.order)) ? Number(route?.order) : 9999;
}

export function activeItems(list: AlexaListItem[]): AlexaListItem[] {
    return list.filter(item =>
        item &&
        item.completed === false &&
        Boolean(item.id) &&
        Boolean(String(item.value || '').trim()),
    );
}

export function activeIdSignature(list: AlexaListItem[]): string {
    return activeItems(list)
        .map(item => String(item.id))
        .sort()
        .join('|');
}

export interface ActiveSnapshotComparison {
    addedIds: string[];
    missingIds: string[];
    changedIds: string[];
}

export function compareActiveSnapshot(
    originalItems: AlexaListItem[],
    freshItems: AlexaListItem[],
    expectedValues: Map<string, string>,
): ActiveSnapshotComparison {
    const original = activeItems(originalItems);
    const fresh = activeItems(freshItems);
    const originalIds = new Set(original.map(item => String(item.id)));
    const freshById = new Map(fresh.map(item => [String(item.id), item]));

    const addedIds = fresh
        .map(item => String(item.id))
        .filter(id => !originalIds.has(id));

    const missingIds: string[] = [];
    const changedIds: string[] = [];

    for (const item of original) {
        const id = String(item.id);
        const current = freshById.get(id);
        if (!current) {
            missingIds.push(id);
            continue;
        }
        const expected = expectedValues.get(id);
        if (expected !== undefined && String(current.value || '').trim() !== expected) {
            changedIds.push(id);
        }
    }

    return { addedIds, missingIds, changedIds };
}

export function activeSnapshotHasConflict(comparison: ActiveSnapshotComparison): boolean {
    return comparison.addedIds.length > 0 || comparison.missingIds.length > 0 || comparison.changedIds.length > 0;
}

export function sortSlotsOldestFirst(items: AlexaListItem[]): AlexaListItem[] {
    return [...items].sort((a, b) => {
        const timeA = toTimestamp(a.createdDateTime);
        const timeB = toTimestamp(b.createdDateTime);
        if (timeA !== timeB) return timeA - timeB;
        return String(a.id).localeCompare(String(b.id));
    });
}

export function buildDesiredItems(
    items: AlexaListItem[],
    markets: MarketConfig[],
    routes: RouteConfig[],
    products: ProductConfig[],
    fallbackMarket: string,
    priorityMarket = '',
    minimumItemsPerMarket = 1,
): SortableItem[] {
    return optimizeMarketAssignments(items, markets, products, fallbackMarket, priorityMarket, minimumItemsPerMarket)
        .map(({ source, parsed }) => {
            return {
                source,
                parsed,
                marketOrder: marketOrder(markets, parsed.market),
                categoryOrder: categoryOrder(routes, parsed.market, parsed.category),
            };
        })
        .sort((a, b) => {
            if (a.marketOrder !== b.marketOrder) return a.marketOrder - b.marketOrder;
            if (a.categoryOrder !== b.categoryOrder) return a.categoryOrder - b.categoryOrder;
            const categoryCompare = a.parsed.category.localeCompare(b.parsed.category, 'de', { sensitivity: 'base' });
            if (categoryCompare !== 0 && a.categoryOrder === 9999 && b.categoryOrder === 9999) return categoryCompare;
            return a.parsed.productName.localeCompare(b.parsed.productName, 'de', { sensitivity: 'base' });
        });
}

export function createSortPlan(
    items: AlexaListItem[],
    markets: MarketConfig[],
    routes: RouteConfig[],
    products: ProductConfig[],
    fallbackMarket: string,
    priorityMarket = '',
    minimumItemsPerMarket = 1,
    marketHeaders = false,
): SortPlanEntry[] {
    const active = activeItems(items);
    const real = active.filter(item => !isMarketHeader(String(item.value), markets));
    const slots = sortSlotsOldestFirst(active);
    const desired = buildDesiredItems(
        real,
        markets,
        routes,
        products,
        fallbackMarket,
        priorityMarket,
        minimumItemsPerMarket,
    );

    const targets: Array<{ text: string; market: string; category: string; product: string }> = [];
    let lastMarket = '';
    for (const target of desired) {
        const market = target.parsed.market;
        if (
            marketHeaders &&
            normalize(market) !== normalize(fallbackMarket) &&
            normalize(market) !== normalize(lastMarket)
        ) {
            const header = formatMarketHeader(market);
            targets.push({ text: header, market, category: '', product: header });
        }
        targets.push({
            text: String(target.parsed.originalText).trim(),
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

export interface UnknownItem {
    key: string;
    text: string;
    product: string;
    market: string;
    guessedCategory: string;
    ambiguousMarketSuffix?: string;
}

export function collectUnknownItems(
    items: AlexaListItem[],
    markets: MarketConfig[],
    products: ProductConfig[],
    fallbackMarket: string,
    priorityMarket = '',
): UnknownItem[] {
    const seen = new Set<string>();
    const result: UnknownItem[] = [];

    for (const item of activeItems(items)) {
        if (isMarketHeader(String(item.value), markets)) continue;
        const parsed = parseItem(String(item.value), markets, products, fallbackMarket, priorityMarket);
        if (parsed.knownProduct) continue;
        const key = canonicalProductKey(parsed.productName) || normalize(parsed.productName);
        if (!key || seen.has(key)) continue;
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

export function mergeUnknownProducts(
    items: AlexaListItem[],
    markets: MarketConfig[],
    products: ProductConfig[],
    fallbackMarket: string,
    priorityMarket = '',
): { products: ProductConfig[]; learned: ProductConfig[] } {
    const merged = products.map(product => ({ ...product }));
    const learned: ProductConfig[] = [];
    const knownKeys = new Set(
        merged.flatMap(product => [product.name, ...(String(product.aliases || '').split(/[;,]/))])
            .map(canonicalProductKey)
            .filter(Boolean),
    );
    const unknown = collectUnknownItems(items, markets, merged, fallbackMarket, priorityMarket);

    for (const entry of unknown) {
        const name = String(entry.product || '').trim();
        const key = canonicalProductKey(name);
        if (!key || knownKeys.has(key)) continue;
        if (entry.ambiguousMarketSuffix) continue;

        const existing = findProduct(name, merged);
        if (existing) continue;

        const product: ProductConfig = {
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

export function mergeReviewQueue(
    current: ReviewItemConfig[],
    unknown: UnknownItem[],
    now = new Date().toISOString(),
): ReviewItemConfig[] {
    const byKey = new Map(current.map(item => [item.key, { ...item }]));
    for (const entry of unknown) {
        const previous = byKey.get(entry.key);
        if (previous?.action === 'ignore') {
            byKey.set(entry.key, previous);
            continue;
        }

        const next: ReviewItemConfig = {
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
            previous!.text === next.text &&
            previous!.product === next.product &&
            previous!.guessedCategory === next.guessedCategory &&
            previous!.market === next.market &&
            previous!.category === next.category &&
            previous!.defaultMarket === next.defaultMarket &&
            JSON.stringify(previous!.availableMarkets ?? '') === JSON.stringify(next.availableMarkets ?? '') &&
            previous!.aliases === next.aliases &&
            previous!.action === next.action &&
            previous!.firstSeen === next.firstSeen;

        byKey.set(entry.key, unchanged ? previous! : next);
    }
    return [...byKey.values()].sort((a, b) => a.product.localeCompare(b.product, 'de', { sensitivity: 'base' }));
}

export function applyReviewActions(
    products: ProductConfig[],
    reviewItems: ReviewItemConfig[],
): { products: ProductConfig[]; remainingReviews: ReviewItemConfig[]; accepted: ProductConfig[] } {
    const merged = products.map(product => ({ ...product }));
    const accepted: ProductConfig[] = [];
    const remaining: ReviewItemConfig[] = [];

    for (const review of reviewItems) {
        if (review.action !== 'accept') {
            remaining.push({ ...review });
            continue;
        }

        const name = String(review.product || '').trim();
        if (!name) continue;
        const existing = findProduct(name, merged);
        if (existing) {
            if (review.category) existing.category = review.category;
            if (review.defaultMarket !== undefined) existing.defaultMarket = review.defaultMarket;
            if (review.availableMarkets !== undefined) {
                existing.availableMarkets = Array.isArray(review.availableMarkets)
                    ? [...review.availableMarkets]
                    : String(review.availableMarkets || '');
            }
            if (review.aliases) {
                const aliases = new Set(String(existing.aliases || '').split(/[;,]/).map(value => value.trim()).filter(Boolean));
                for (const alias of review.aliases.split(/[;,]/).map(value => value.trim()).filter(Boolean)) aliases.add(alias);
                existing.aliases = [...aliases].join(',');
            }
            accepted.push({ ...existing });
            continue;
        }

        const product: ProductConfig = {
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

export function makePreviewText(listName: string, plan: SortPlanEntry[]): string {
    const lines = [`Liste: ${listName}`, `Aktive Plätze: ${plan.length}`, `Änderungen: ${plan.filter(entry => entry.changed).length}`];
    for (const entry of plan) {
        const marker = entry.changed ? '→' : '=';
        lines.push(`${String(entry.position).padStart(2, '0')}. ${entry.from} ${marker} ${entry.to} [${entry.market} / ${entry.category}]`);
    }
    return lines.join('\n');
}
