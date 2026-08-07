import type {
    AlexaListItem,
    MarketConfig,
    ProductConfig,
    RouteConfig,
    SortPlanEntry,
    SortableItem,
} from './model';
import { normalize, parseItem } from './parser';

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
): SortableItem[] {
    return items
        .map(source => {
            const parsed = parseItem(String(source.value), markets, products, fallbackMarket, priorityMarket);
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
): SortPlanEntry[] {
    const active = activeItems(items);
    const slots = sortSlotsOldestFirst(active);
    const desired = buildDesiredItems(active, markets, routes, products, fallbackMarket, priorityMarket);

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

export function collectUnknownItems(
    items: AlexaListItem[],
    markets: MarketConfig[],
    products: ProductConfig[],
    fallbackMarket: string,
    priorityMarket = '',
): Array<{ text: string; product: string; market: string; guessedCategory: string }> {
    const seen = new Set<string>();
    const result: Array<{ text: string; product: string; market: string; guessedCategory: string }> = [];

    for (const item of activeItems(items)) {
        const parsed = parseItem(String(item.value), markets, products, fallbackMarket, priorityMarket);
        if (parsed.knownProduct) continue;
        const key = normalize(parsed.productName);
        if (!key || seen.has(key)) continue;
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

export function mergeUnknownProducts(
    items: AlexaListItem[],
    markets: MarketConfig[],
    products: ProductConfig[],
    fallbackMarket: string,
    priorityMarket = '',
): { products: ProductConfig[]; learned: ProductConfig[] } {
    const merged = products.map(product => ({ ...product }));
    const learned: ProductConfig[] = [];
    const knownNames = new Set(merged.map(product => normalize(product.name)).filter(Boolean));
    const unknown = collectUnknownItems(items, markets, merged, fallbackMarket, priorityMarket);

    for (const entry of unknown) {
        const name = String(entry.product || '').trim();
        const key = normalize(name);
        if (!key || knownNames.has(key)) continue;

        // A trailing "von/bei <Name>" may be a not-yet-configured market (or a brand).
        // Do not permanently learn that ambiguous suffix into the product name automatically.
        if (/\s+(?:von|bei)\s+\S.+$/i.test(name)) continue;

        const product: ProductConfig = {
            name,
            aliases: '',
            category: entry.guessedCategory || 'Sonstiges',
            // The current priority market is deliberately not made permanent.
            // A product-specific default market must be a conscious user choice.
            defaultMarket: '',
        };

        merged.push(product);
        learned.push(product);
        knownNames.add(key);
    }

    return { products: merged, learned };
}
