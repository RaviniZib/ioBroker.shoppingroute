import type { ReviewItemConfig } from './model';

/**
 * Apply the Admin review-table bulk action without dropping any row fields.
 *
 * @param rows Current unsaved review rows from the Admin draft.
 */
export function markAllReviewItemsAccept(rows: ReviewItemConfig[]): ReviewItemConfig[] {
    return rows.map(item => ({
        ...item,
        availableMarkets: Array.isArray(item.availableMarkets)
            ? item.availableMarkets
                .map(value => typeof value === 'string' ? value.trim() : '')
                .filter(Boolean)
                .join(',')
            : String(item.availableMarkets || ''),
        action: 'accept',
    }));
}
