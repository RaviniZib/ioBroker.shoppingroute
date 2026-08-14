"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAllReviewItemsAccept = markAllReviewItemsAccept;
/**
 * Apply the Admin review-table bulk action without dropping any row fields.
 *
 * @param rows Current unsaved review rows from the Admin draft.
 */
function markAllReviewItemsAccept(rows) {
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
//# sourceMappingURL=review-tools.js.map