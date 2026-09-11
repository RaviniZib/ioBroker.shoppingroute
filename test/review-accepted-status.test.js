'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { applyReviewActions } = require('../build/lib/sorter');

test('accepted review rows remain as accepted status and are not applied twice', () => {
    const review = {
        key: 'milch', text: 'Milch', product: 'Milch', guessedCategory: 'Milchprodukte', market: 'ALDI',
        category: 'Milchprodukte', defaultMarket: 'ALDI', availableMarkets: 'ALDI,LIDL', aliases: '', action: 'accept',
    };
    const first = applyReviewActions([], [review]);
    assert.equal(first.accepted.length, 1);
    assert.equal(first.remainingReviews.length, 1);
    assert.equal(first.remainingReviews[0].action, 'accepted');
    const second = applyReviewActions(first.products, first.remainingReviews);
    assert.equal(second.accepted.length, 0);
    assert.equal(second.remainingReviews[0].action, 'accepted');
});
