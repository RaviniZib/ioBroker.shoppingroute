"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeAvailableMarkets = normalizeAvailableMarkets;
exports.normalizeProductAvailableMarkets = normalizeProductAvailableMarkets;
exports.markAllReviewItemsAccept = markAllReviewItemsAccept;
function normalizeAvailableMarkets(value) {
    const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[;,]/) : [];
    return [...new Set(values
            .map(entry => typeof entry === 'string' ? entry.trim() : '')
            .filter(Boolean))];
}
function normalizeProductAvailableMarkets(products) {
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
function markAllReviewItemsAccept(rows) {
    return rows.map(item => ({
        ...item,
        availableMarkets: normalizeAvailableMarkets(item.availableMarkets),
        action: 'accept',
    }));
}
//# sourceMappingURL=review-tools.js.map