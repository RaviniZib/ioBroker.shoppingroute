'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
    formatMarketHeader,
    marketFromHeader,
    optimizeMarketAssignments,
    planMarketHeaderAction,
    realActiveItems,
    requiredMarkets,
} = require('../build/lib/market-plan');
const { createSortPlan } = require('../build/lib/sorter');

const markets = [
    { name: 'ALDI', aliases: 'Aldi,Aldi Nord', order: 10, enabled: true },
    { name: 'LIDL', aliases: 'Lidl', order: 20, enabled: true },
    { name: 'REWE', aliases: 'Rewe', order: 30, enabled: true },
    { name: 'Ohne Markt', aliases: '', order: 999, enabled: true },
];
const routes = [
    { market: 'ALDI', category: 'Milchprodukte', order: 10 },
    { market: 'LIDL', category: 'Milchprodukte', order: 10 },
    { market: 'REWE', category: 'Milchprodukte', order: 10 },
];
const products = [
    { name: 'Milch', aliases: '', category: 'Milchprodukte', defaultMarket: 'ALDI', availableMarkets: 'ALDI,LIDL,REWE' },
    { name: 'Eier', aliases: 'Ei', category: 'Milchprodukte', defaultMarket: 'ALDI', availableMarkets: 'ALDI,LIDL,REWE' },
    { name: 'Cola', aliases: '', category: 'Getränke', defaultMarket: 'LIDL', availableMarkets: 'ALDI,LIDL,REWE' },
    { name: 'Spezial', aliases: '', category: 'Sonstiges', defaultMarket: 'LIDL', availableMarkets: 'LIDL' },
];
const item = (id, value, completed = false, createdDateTime = 1) => ({ id, value, completed, createdDateTime });

test('market header uses reserved visible format and configured market names', () => {
    assert.equal(formatMarketHeader('Aldi'), '---- ALDI ----');
    assert.equal(marketFromHeader('---- ALDI ----', markets), 'ALDI');
    assert.equal(marketFromHeader('---- NICHT KONFIGURIERT ----', markets), undefined);
});

test('sub-threshold flexible market is removed when all items fit an existing stop', () => {
    const configured = products.map(product => product.name === 'Cola' ? { ...product, defaultMarket: 'LIDL' } : product);
    const list = [item('a', 'Milch'), item('b', 'Eier'), item('c', 'Cola')];
    const optimized = optimizeMarketAssignments(list, markets, configured, 'Ohne Markt', '', 3);
    assert.deepEqual(optimized.map(entry => entry.parsed.market), ['ALDI', 'ALDI', 'ALDI']);
    assert.deepEqual(requiredMarkets(list, markets, configured, 'Ohne Markt', '', 3), ['ALDI']);
});

test('explicit market is immutable and may become the consolidation target', () => {
    const list = [item('a', 'Milch von LIDL'), item('b', 'Eier'), item('c', 'Milch')];
    const optimized = optimizeMarketAssignments(list, markets, products, 'Ohne Markt', '', 3);
    assert.equal(optimized[0].parsed.explicitMarket, true);
    assert.equal(optimized[0].parsed.market, 'LIDL');
    assert.deepEqual(optimized.map(entry => entry.parsed.market), ['LIDL', 'LIDL', 'LIDL']);
    assert.equal(optimized[0].parsed.originalText, 'Milch von LIDL');
});

test('market with a non-movable article remains even below the minimum', () => {
    const fixed = products.map(product =>
        product.name === 'Milch' || product.name === 'Eier'
            ? { ...product, availableMarkets: 'ALDI' }
            : product,
    );
    const list = [item('a', 'Spezial'), item('b', 'Milch'), item('c', 'Eier')];
    assert.deepEqual(requiredMarkets(list, markets, fixed, 'Ohne Markt', '', 3), ['ALDI', 'LIDL']);
});

test('header lifecycle creates and deletes managed headings without polling', () => {
    assert.deepEqual(
        planMarketHeaderAction([item('a', 'Milch')], ['ALDI'], markets, 'Ohne Markt', true),
        { type: 'create', market: 'ALDI', value: '---- ALDI ----' },
    );
    assert.deepEqual(
        planMarketHeaderAction([item('h', '---- ALDI ----', true), item('a', 'Milch')], ['ALDI'], markets, 'Ohne Markt', true),
        { type: 'delete', market: 'ALDI', id: 'h' },
    );
    assert.deepEqual(
        planMarketHeaderAction([item('h', '---- ALDI ----'), item('a', 'Milch')], [], markets, 'Ohne Markt', true),
        { type: 'delete', market: 'ALDI', id: 'h' },
    );
});

test('headers are excluded from real item counts and disabled feature deletes them', () => {
    const list = [item('h', '---- ALDI ----'), item('a', 'Milch')];
    assert.deepEqual(realActiveItems(list, markets).map(entry => entry.id), ['a']);
    assert.deepEqual(
        planMarketHeaderAction(list, ['ALDI'], markets, 'Ohne Markt', false),
        { type: 'delete', market: 'ALDI', id: 'h' },
    );
});

test('legacy completed and stale headers are deleted instead of reused', () => {
    assert.deepEqual(
        planMarketHeaderAction([item('old', '---- LIDL ----', true), item('a', 'Cola')], ['LIDL'], markets, 'Ohne Markt', true),
        { type: 'delete', market: 'LIDL', id: 'old' },
    );
    assert.deepEqual(
        planMarketHeaderAction([item('stale', '---- AMAZON ----', true), item('a', 'Milch')], ['ALDI'], markets, 'Ohne Markt', true),
        { type: 'delete', market: 'AMAZON', id: 'stale' },
    );
});

test('sort plan places the header before its market while retaining fixed Alexa slots', () => {
    const list = [
        item('id1', 'Milch', false, 100),
        item('id2', 'Eier', false, 200),
        item('idh', '---- ALDI ----', false, 300),
    ];
    const plan = createSortPlan(list, markets, routes, products, 'Ohne Markt', '', 3, true);
    assert.deepEqual(plan.map(entry => entry.id), ['id1', 'id2', 'idh']);
    assert.deepEqual(plan.map(entry => entry.to), ['---- ALDI ----', 'Eier', 'Milch']);
});
