'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { applyReviewActions } = require('../build/lib/sorter');
const { normalizeProductAvailableMarkets } = require('../build/lib/review-tools');
const { ReviewEditorModel } = require('../src-admin/review-editor');

test('accept rows are applied once and removed from the persisted review queue', () => {
    const review = {
        key: 'milch', text: 'Milch', product: 'Milch', guessedCategory: 'Milchprodukte', market: 'ALDI',
        category: 'Milchprodukte', defaultMarket: 'ALDI', availableMarkets: 'ALDI,LIDL', aliases: '', action: 'accept',
    };
    const first = applyReviewActions([], [review]);
    assert.equal(first.accepted.length, 1);
    assert.equal(first.remainingReviews.length, 0);
    const second = applyReviewActions(first.products, [{ ...review, action: 'accepted' }]);
    assert.equal(second.accepted.length, 0);
    assert.equal(second.remainingReviews.length, 0);
    assert.equal(second.products.length, 1);
});

test('serialized editor draft and startup helper preserve markets without resurrecting rows', () => {
    const initial = {
        products: [],
        reviewItems: [{
            key: 'dinkelbroetchen', text: 'Dinkelbrötchen', product: 'Dinkelbrötchen',
            category: 'Brot/Gebäck', defaultMarket: 'REWE',
            availableMarkets: ['ALDI', 'LIDL', 'REWE'], aliases: '', action: 'pending',
        }],
    };
    const draft = ReviewEditorModel.acceptReviewRows(initial, [0]);
    assert.deepEqual(draft.reviewItems, []);
    assert.equal(initial.reviewItems.length, 1, 'discarding can restore unchanged original draft');
    assert.deepEqual(draft.products[0].availableMarkets, ['ALDI', 'LIDL', 'REWE']);
    const persisted = JSON.parse(JSON.stringify(draft));
    const afterRestart = applyReviewActions(persisted.products, persisted.reviewItems);
    assert.equal(afterRestart.accepted.length, 0, 'already accepted UI rows are not applied twice');
    assert.equal(afterRestart.remainingReviews.length, 0, 'persisted accepted rows are cleared on restart');
    assert.equal(afterRestart.products.length, 1, 'backend does not duplicate the product already written by the editor');
    assert.deepEqual(afterRestart.products[0].availableMarkets, ['ALDI', 'LIDL', 'REWE']);
});

test('startup detects accepted-row cleanup even when no product is applied again', () => {
    const persistedReviews = [{ key: 'milch', product: 'Milch', action: 'accepted' }];
    const result = applyReviewActions([{ name: 'Milch', category: 'Milchprodukte' }], persistedReviews);
    const reviewQueueChanged = JSON.stringify(result.remainingReviews) !== JSON.stringify(persistedReviews);
    assert.equal(result.accepted.length, 0);
    assert.equal(reviewQueueChanged, true);
    assert.deepEqual(result.remainingReviews, []);
});

test('startup normalizes legacy product market strings into arrays', () => {
    const configured = [{ name: 'Milch', category: 'Milchprodukte', availableMarkets: 'ALDI; LIDL,ALDI' }];
    const normalized = normalizeProductAvailableMarkets(configured);
    assert.deepEqual(normalized[0].availableMarkets, ['ALDI', 'LIDL']);
    assert.notEqual(JSON.stringify(normalized), JSON.stringify(configured));
});
