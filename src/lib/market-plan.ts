import type { AlexaListItem, MarketConfig, ParsedItem, ProductConfig } from './model';
import { findProduct, normalize, parseItem, parseMarketList } from './parser';

export interface ParsedShoppingItem {
    source: AlexaListItem;
    parsed: ParsedItem;
}

const HEADER_PATTERN = /^\*\*\*\*\s+(.+?)\s+\*\*\*\*$/;
const LEGACY_HEADER_PATTERN = /^----\s+(.+?)\s+----$/;

export function formatMarketHeader(market: string): string {
    return `**** ${String(market || '').trim().toLocaleUpperCase('de-DE')} ****`;
}

/**
 * Recognize current and legacy managed headers so an upgrade reuses the existing Alexa item.
 *
 * @param value Prefix-free Alexa item text.
 * @param markets Configured active markets.
 */
export function marketNameFromHeader(value: string, markets: MarketConfig[]): string | undefined {
    const text = String(value || '').trim();
    const match = text.match(HEADER_PATTERN) || text.match(LEGACY_HEADER_PATTERN);
    if (!match?.[1]) return undefined;
    const wanted = normalize(match[1]);
    return markets.find(market => market.enabled !== false && normalize(market.name) === wanted)?.name;
}

export function isMarketHeader(value: string, markets: MarketConfig[]): boolean {
    return Boolean(marketNameFromHeader(value, markets));
}

export function realActiveItems(list: AlexaListItem[], markets: MarketConfig[]): AlexaListItem[] {
    return list.filter(item =>
        item &&
        item.completed === false &&
        Boolean(item.id) &&
        Boolean(String(item.value || '').trim()) &&
        !isMarketHeader(String(item.value), markets),
    );
}

function marketOrderMap(markets: MarketConfig[]): Map<string, number> {
    return new Map(markets.map(market => [market.name, Number.isFinite(Number(market.order)) ? Number(market.order) : 9999]));
}

function rankedMarkets(markets: Iterable<string>, counts: Map<string, number>, order: Map<string, number>): string[] {
    return [...new Set(markets)].sort((a, b) => {
        const countDiff = (counts.get(b) || 0) - (counts.get(a) || 0);
        if (countDiff !== 0) return countDiff;
        const orderDiff = (order.get(a) || 9999) - (order.get(b) || 9999);
        if (orderDiff !== 0) return orderDiff;
        return a.localeCompare(b, 'de', { sensitivity: 'base' });
    });
}

function allowedMarketsForItem(
    item: ParsedShoppingItem,
    markets: MarketConfig[],
    products: ProductConfig[],
): string[] {
    if (item.parsed.explicitMarket) return [item.parsed.market];
    const product = findProduct(item.parsed.productText, products);
    if (!product) return [item.parsed.market];
    const configured = parseMarketList(product.availableMarkets, markets);
    if (!configured.length) return [item.parsed.market];
    return [...new Set([item.parsed.market, ...configured])];
}

export function optimizeMarketAssignments(
    items: AlexaListItem[],
    markets: MarketConfig[],
    products: ProductConfig[],
    fallbackMarket: string,
    priorityMarket = '',
    minimumItemsPerMarket = 1,
): ParsedShoppingItem[] {
    const parsedItems = items.map(source => ({
        source,
        parsed: parseItem(String(source.value), markets, products, fallbackMarket, priorityMarket),
    }));

    const threshold = Math.max(1, Math.floor(Number(minimumItemsPerMarket) || 1));
    if (threshold <= 1 || parsedItems.length <= 1) return parsedItems;

    const order = marketOrderMap(markets);
    const counts = new Map<string, number>();
    const allowed = new Map<string, string[]>();
    const groups = new Map<string, ParsedShoppingItem[]>();
    const retained = new Set<string>();

    for (const item of parsedItems) {
        const market = item.parsed.market;
        counts.set(market, (counts.get(market) || 0) + 1);
        const list = groups.get(market) || [];
        list.push(item);
        groups.set(market, list);
        const candidates = allowedMarketsForItem(item, markets, products);
        allowed.set(String(item.source.id), candidates);
        if (item.parsed.explicitMarket || candidates.length <= 1) retained.add(market);
    }

    for (const [market, count] of counts) {
        if (count >= threshold) retained.add(market);
    }

    if (!retained.size && counts.size) {
        const anchor = rankedMarkets(counts.keys(), counts, order)[0];
        if (anchor) retained.add(anchor);
    }

    const assignment = new Map<string, string>();
    for (const item of parsedItems) assignment.set(String(item.source.id), item.parsed.market);

    const candidateGroups = [...groups.entries()]
        .filter(([market]) => !retained.has(market))
        .sort((a, b) => {
            const countDiff = a[1].length - b[1].length;
            if (countDiff !== 0) return countDiff;
            return (order.get(a[0]) || 9999) - (order.get(b[0]) || 9999);
        });

    for (const [market, group] of candidateGroups) {
        const targets = new Map<string, string>();
        let canRemoveStop = true;

        for (const item of group) {
            const choices = (allowed.get(String(item.source.id)) || [market]).filter(candidate => retained.has(candidate));
            const target = rankedMarkets(choices, counts, order)[0];
            if (!target) {
                canRemoveStop = false;
                break;
            }
            targets.set(String(item.source.id), target);
        }

        if (!canRemoveStop) {
            retained.add(market);
            continue;
        }

        for (const item of group) {
            const id = String(item.source.id);
            const target = targets.get(id);
            if (!target || target === market) continue;
            assignment.set(id, target);
            counts.set(market, Math.max(0, (counts.get(market) || 0) - 1));
            counts.set(target, (counts.get(target) || 0) + 1);
        }
    }

    return parsedItems.map(item => {
        const market = assignment.get(String(item.source.id)) || item.parsed.market;
        return market === item.parsed.market
            ? item
            : { source: item.source, parsed: { ...item.parsed, market } };
    });
}
