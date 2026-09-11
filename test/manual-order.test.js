'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { moveManualOverride, reconcileManualOverrides } = require('../build/lib/manual-order');
const { buildPrefixTargets } = require('../build/lib/prefix-sort');

test('manual override moves one item to another market and wins over automatic assignment', () => {
    const items = [
        { id: '1', value: '10> Milch', completed: false, version: 2 },
        { id: '2', value: '20> Brot', completed: false, version: 2 },
    ];
    const markets = [
        { name: 'ALDI', order: 10, enabled: true },
        { name: 'LIDL', order: 20, enabled: true },
    ];
    const products = [
        { name: 'Milch', category: 'Milch', defaultMarket: 'ALDI' },
        { name: 'Brot', category: 'Brot', defaultMarket: 'ALDI' },
    ];
    const moved = moveManualOverride([], {
        listName: 'SHOP', itemId: '2', originalText: 'Brot', fromMarket: 'ALDI', fromPosition: 1,
        toMarket: 'LIDL', toPosition: 0,
    });
    const targets = buildPrefixTargets(items, markets, [], products, 'Ohne Markt', '', 1, false, moved, 'SHOP');
    assert.equal(targets.find(target => target.id === '2').market, 'LIDL');
    assert.equal(targets.filter(target => target.market === 'LIDL')[0].id, '2');
});

test('manual override is rebound after an Amazon suffix rebuild changes the item id', () => {
    const overrides = [{
        listName: 'SHOP', itemId: 'old', originalText: 'Milch', market: 'LIDL', position: 0,
        updatedAt: new Date().toISOString(),
    }];
    const reconciled = reconcileManualOverrides(overrides, 'SHOP', [
        { id: 'new', value: '42> Milch', completed: false, version: 1 },
    ]);
    assert.equal(reconciled.length, 1);
    assert.equal(reconciled[0].itemId, 'new');
    assert.equal(reconciled[0].market, 'LIDL');
});
