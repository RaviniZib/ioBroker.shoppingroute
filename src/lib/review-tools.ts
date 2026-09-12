import type { ProductConfig, ReviewItemConfig } from './model';

export function normalizeAvailableMarkets(value: unknown): string[] {
    const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[;,]/) : [];
    return [...new Set(values
        .map(entry => typeof entry === 'string' ? entry.trim() : '')
        .filter(Boolean))];
}

export function normalizeProductAvailableMarkets(products: ProductConfig[]): ProductConfig[] {
    return products.map(product => ({
        ...product,
        availableMarkets: normalizeAvailableMarkets(product.availableMarkets),
    }));
}

/**
 * Apply the Admin review-table bulk action without dropping any row fields.
 *
 * @param rows Current unsaved review rows from the Admin draft.
 */
export function markAllReviewItemsAccept(rows: ReviewItemConfig[]): ReviewItemConfig[] {
    return rows.map(item => ({
        ...item,
        availableMarkets: normalizeAvailableMarkets(item.availableMarkets),
        action: 'accept',
    }));
}
