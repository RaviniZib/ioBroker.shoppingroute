'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'admin/jsonConfig.json'), 'utf8'));
const { ReviewEditorModel: model } = require('../src-admin/review-editor');

test('review uses a direct Admin draft editor instead of sendTo/useNative', () => {
    const review = config.items.reviewTab.items;
    assert.equal(review.reviewAcceptAll, undefined);
    assert.equal(review.reviewEditor.type, 'custom');
    assert.equal(review.reviewEditor.url, 'custom/review/reviewEditor.js');
    assert.equal(review.reviewEditor.name, 'ShoppingRouteReviewSet/Components/ReviewEditor');
    assert.equal(review.reviewEditor.guiApi, 2);
    assert.equal(review.reviewItems.hidden, 'true');
});

test('accept immediately updates the catalogue and visible status in the same Admin draft', () => {
    const data = {
        products: [],
        reviewItems: [{
            key: 'schmelzkaese',
            product: 'Schmelzkäse',
            text: 'Schmelzkäse',
            guessedCategory: 'Milchprodukte',
            category: 'Milchprodukte',
            defaultMarket: 'LIDL',
            availableMarkets: ['LIDL', 'REWE'],
            aliases: '',
            action: 'pending',
        }],
    };
    const result = model.acceptReviewRows(data, [0]);
    assert.equal(result.reviewItems[0].action, 'accepted');
    assert.deepEqual(result.reviewItems[0].availableMarkets, ['LIDL', 'REWE']);
    assert.deepEqual(result.products, [{
        name: 'Schmelzkäse',
        aliases: '',
        category: 'Milchprodukte',
        defaultMarket: 'LIDL',
        availableMarkets: ['LIDL', 'REWE'],
    }]);
    assert.equal(data.reviewItems[0].action, 'pending', 'source draft remains immutable');
});

test('accepting an already-known article updates it without creating a duplicate', () => {
    const data = {
        products: [{ name: 'Zucchini', aliases: '', category: 'Sonstiges', defaultMarket: '', availableMarkets: '' }],
        reviewItems: [{ product: 'Zucchini', category: 'Obst/Gemüse', defaultMarket: 'LIDL', availableMarkets: 'LIDL', aliases: 'Zucchino', action: 'pending' }],
    };
    const result = model.acceptReviewRows(data, [0]);
    assert.equal(result.products.length, 1);
    assert.equal(result.products[0].category, 'Obst/Gemüse');
    assert.equal(result.products[0].defaultMarket, 'LIDL');
    assert.equal(result.products[0].aliases, 'Zucchino');
    assert.deepEqual(result.products[0].availableMarkets, ['LIDL']);
    assert.equal(result.reviewItems[0].action, 'accepted');
});

test('market selection remains an array throughout repeated review edits', () => {
    assert.deepEqual(model.normalizeMarketSelection('ALDI; LIDL,ALDI'), ['ALDI', 'LIDL']);
    const first = model.updateReviewRow({ reviewItems: [{ availableMarkets: [] }] }, 0, {
        availableMarkets: ['ALDI', 'LIDL'],
    });
    assert.deepEqual(first.reviewItems[0].availableMarkets, ['ALDI', 'LIDL']);
    const second = model.updateReviewRow(first, 0, { availableMarkets: ['ALDI', 'LIDL', 'REWE'] });
    assert.deepEqual(second.reviewItems[0].availableMarkets, ['ALDI', 'LIDL', 'REWE']);
});
