'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseItem } = require('../build/lib/parser');
const { buildPrefixTargets } = require('../build/lib/prefix-sort');

const markets = [
    { name: 'ALDI', enabled: true, order: 10, aliases: 'Aldi Nord' },
    { name: 'LIDL', enabled: true, order: 20 },
    { name: 'PENNY', enabled: true, order: 30, aliases: 'Penny Markt' },
    { name: 'REWE', enabled: true, order: 40, aliases: 'Rewe Markt' },
    { name: 'MARKT', enabled: true, order: 50 },
    { name: 'NETTO', enabled: true, order: 60 },
    { name: 'EDEKA', enabled: false, order: 70 },
];

const products = [
    { name: 'Milch', category: 'Milchprodukte', defaultMarket: 'LIDL', availableMarkets: [] },
    { name: 'Hähnchenschenkel', category: 'Fleisch/Fisch', defaultMarket: 'LIDL', availableMarkets: [] },
];

for (const expression of [
    'Hähnchenbeine vom Aldi',
    'Hähnchenbeine von Aldi',
    'Hähnchenbeine bei Aldi',
    'Hähnchenbeine Aldi',
    'ALDI Hähnchenbeine',
    'ALDI: Hähnchenbeine',
    'Hähnchenbeine (Aldi)',
    '2 Hähnchenbeine - Aldi',
    'Hähnchenbeine Aldi Nord',
]) {
    test('recognize ALDI explicitly, regardless of position or preposition: ' + expression, () => {
        const parsed = parseItem(expression, markets, products, 'LIDL', 'LIDL');
        assert.equal(parsed.market, 'ALDI');
        assert.equal(parsed.explicitMarket, true);
        assert.equal(parsed.productName.includes('Aldi'), false);
        assert.equal(parsed.category, 'Fleisch/Fisch');
    });
}

test('a store name overrides the product default without changing the product catalogue', () => {
    const original = JSON.stringify(products);
    const parsed = parseItem('Milch Rewe', markets, products, 'LIDL', 'LIDL');
    assert.equal(parsed.market, 'REWE');
    assert.equal(parsed.productName, 'Milch');
    assert.equal(parsed.explicitMarket, true);
    assert.equal(JSON.stringify(products), original);
});

test('longest matching market alias wins over overlapping generic market names', () => {
    for (const expression of ['Penny Markt Milch', 'Milch aus Penny Markt']) {
        const parsed = parseItem(expression, markets, products, 'LIDL', 'LIDL');
        assert.equal(parsed.market, 'PENNY');
        assert.equal(parsed.productName, 'Milch');
        assert.equal(parsed.explicitMarket, true);
    }
    assert.equal(parseItem('REWE Markt Milch', markets, products, 'LIDL').market, 'REWE');
});

test('partial words never match unrelated market names, and disabled markets stay inactive', () => {
    const partial = parseItem('Milch Nettogewicht', markets, products, 'LIDL', 'LIDL');
    assert.equal(partial.market, 'LIDL');
    assert.equal(partial.explicitMarket, false);
    const disabled = parseItem('Milch Edeka', markets, products, 'LIDL', 'LIDL');
    assert.equal(disabled.market, 'LIDL');
    assert.equal(disabled.explicitMarket, false);
});

test('two distinct explicitly mentioned stores are ambiguous, not arbitrarily chosen', () => {
    const parsed = parseItem('Milch ALDI LIDL', markets, products, 'LIDL', 'LIDL');
    assert.equal(parsed.explicitMarket, false);
    assert.equal(parsed.ambiguousMarketSuffix, 'ALDI, LIDL');
});

test('an explicit market is never moved by market-consolidation optimization', () => {
    const snapshot = [
        { id: 'a', value: 'Milch Aldi', completed: false, version: 1 },
        { id: 'b', value: 'Hähnchenschenkel', completed: false, version: 1 },
    ];
    const desired = buildPrefixTargets(
        snapshot, markets, [], products, 'LIDL', 'LIDL', 5, true,
    );
    const first = desired.find(entry => entry.id === 'a');
    assert.equal(first.market, 'ALDI');
    assert.equal(desired.find(entry => entry.id === 'b').market, 'LIDL');
});
