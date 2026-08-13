import type {
    AlexaListItem,
    MarketConfig,
    ProductConfig,
    ReviewItemConfig,
} from './model';
import { canonicalProductKey, findProduct, normalize, parseItem } from './parser';
import { isMarketHeader } from './market-plan';

export function activeItems(list: AlexaListItem[]): AlexaListItem[] {
    return list.filter(item =>
        item &&
        item.completed === false &&
        Boolean(item.id) &&
        Boolean(String(item.value || '').trim()),
    );
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
