'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSortPlan, mergeUnknownProducts } = require('../build/lib/sorter');
const { parseItem } = require('../build/lib/parser');

const markets = [
    { name: 'ALDI', aliases: 'Aldi,Aldi Nord', order: 10, enabled: true },
    { name: 'PENNY', aliases: 'Penny', order: 20, enabled: true },
    { name: 'LIDL', aliases: 'Lidl', order: 30, enabled: true },
    { name: 'Ohne Markt', aliases: '', order: 999, enabled: true },
];

const routes = [
    { market: 'Ohne Markt', category: 'Obst/Gemüse', order: 10 },
    { market: 'Ohne Markt', category: 'Fleisch/Fisch', order: 20 },
    { market: 'Ohne Markt', category: 'Milchprodukte', order: 30 },
    { market: 'Ohne Markt', category: 'Nonfood', order: 40 },
    { market: 'ALDI', category: 'Obst/Gemüse', order: 10 },
    { market: 'ALDI', category: 'Milchprodukte', order: 20 },
    { market: 'PENNY', category: 'Milchprodukte', order: 10 },
    { market: 'PENNY', category: 'Obst/Gemüse', order: 20 },
    { market: 'LIDL', category: 'Obst/Gemüse', order: 10 },
    { market: 'LIDL', category: 'Milchprodukte', order: 20 },
];

const products = [
    { name: 'Bananen', aliases: 'Banane', category: 'Obst/Gemüse', defaultMarket: '' },
    { name: 'Eier', aliases: 'Ei', category: 'Milchprodukte', defaultMarket: '' },
    { name: 'Grillfleisch', aliases: '', category: 'Fleisch/Fisch', defaultMarket: '' },
    { name: 'Hackfleisch', aliases: 'Hack,Rinderhack', category: 'Fleisch/Fisch', defaultMarket: '' },
    { name: 'Pinsel', aliases: 'Grober Pinsel', category: 'Nonfood', defaultMarket: '' },
];

test('five-item proof sorts values onto oldest IDs', () => {
    const list = [
        { id: 'id3', value: 'Grillfleisch', completed: false, createdDateTime: 300 },
        { id: 'id1', value: 'Hackfleisch', completed: false, createdDateTime: 100 },
        { id: 'id5', value: 'Eier', completed: false, createdDateTime: 500 },
        { id: 'id2', value: 'Bananen', completed: false, createdDateTime: 200 },
        { id: 'id4', value: 'Pinsel', completed: false, createdDateTime: 400 },
    ];

    const plan = createSortPlan(list, markets, routes, products, 'Ohne Markt');
    assert.deepEqual(plan.map(entry => entry.to), [
        'Bananen',
        'Grillfleisch',
        'Hackfleisch',
        'Eier',
        'Pinsel',
    ]);
    assert.deepEqual(plan.map(entry => entry.id), ['id1', 'id2', 'id3', 'id4', 'id5']);
});

test('explicit market becomes primary sort level', () => {
    const list = [
        { id: 'a', value: 'Eier von Penny', completed: false, createdDateTime: 1 },
        { id: 'b', value: 'Bananen von Aldi', completed: false, createdDateTime: 2 },
        { id: 'c', value: 'Eier von Aldi', completed: false, createdDateTime: 3 },
    ];

    const plan = createSortPlan(list, markets, routes, products, 'Ohne Markt');
    assert.deepEqual(plan.map(entry => entry.to), [
        'Bananen von Aldi',
        'Eier von Aldi',
        'Eier von Penny',
    ]);
});

test('amounts remain visible while product is recognized', () => {
    const parsed = parseItem('3 Bananen von Aldi', markets, products, 'Ohne Markt');
    assert.equal(parsed.originalText, '3 Bananen von Aldi');
    assert.equal(parsed.productName, 'Bananen');
    assert.equal(parsed.market, 'ALDI');
    assert.equal(parsed.category, 'Obst/Gemüse');
});

test('500 grams minced meat keeps text and matches product', () => {
    const parsed = parseItem('500 Gramm Hackfleisch von Aldi', markets, products, 'Ohne Markt');
    assert.equal(parsed.originalText, '500 Gramm Hackfleisch von Aldi');
    assert.equal(parsed.productName, 'Hackfleisch');
    assert.equal(parsed.market, 'ALDI');
    assert.equal(parsed.category, 'Fleisch/Fisch');
});

test('priority market is used when no explicit or product default market exists', () => {
    const parsed = parseItem('Bananen', markets, products, 'Ohne Markt', 'LIDL');
    assert.equal(parsed.market, 'LIDL');
    assert.equal(parsed.productName, 'Bananen');
});

test('explicit market overrides priority market', () => {
    const parsed = parseItem('Bananen von Aldi', markets, products, 'Ohne Markt', 'LIDL');
    assert.equal(parsed.market, 'ALDI');
});

test('product default market overrides priority market', () => {
    const configuredProducts = products.map(product =>
        product.name === 'Eier' ? { ...product, defaultMarket: 'PENNY' } : product,
    );
    const parsed = parseItem('Eier', markets, configuredProducts, 'Ohne Markt', 'LIDL');
    assert.equal(parsed.market, 'PENNY');
});

test('invalid priority market falls back to fallback market', () => {
    const parsed = parseItem('Bananen', markets, products, 'Ohne Markt', 'NICHT VORHANDEN');
    assert.equal(parsed.market, 'Ohne Markt');
});

test('unknown products can be learned without freezing the priority market', () => {
    const list = [
        { id: 'u1', value: 'Milch', completed: false, createdDateTime: 1 },
        { id: 'u2', value: 'Toilettenpapier', completed: false, createdDateTime: 2 },
    ];
    const result = mergeUnknownProducts(list, markets, products, 'Ohne Markt', 'LIDL');
    const milk = result.learned.find(product => product.name === 'Milch');
    const toiletPaper = result.learned.find(product => product.name === 'Toilettenpapier');

    assert.ok(milk);
    assert.equal(milk.category, 'Milchprodukte');
    assert.equal(milk.defaultMarket, '');
    assert.ok(toiletPaper);
    assert.equal(toiletPaper.category, 'Kosmetikartikel');
    assert.equal(toiletPaper.defaultMarket, '');
});

test('ambiguous unknown "von/bei" suffix is not learned into the product name', () => {
    const list = [
        { id: 'u1', value: '35 Sushi von Ukuhama', completed: false, createdDateTime: 1 },
    ];
    const result = mergeUnknownProducts(list, markets, products, 'Ohne Markt', 'LIDL');
    const parsed = parseItem('35 Sushi von Ukuhama', markets, products, 'Ohne Markt', 'LIDL');
    assert.equal(result.learned.length, 0);
    assert.equal(result.products.some(product => product.name === 'Sushi von Ukuhama'), false);
    assert.equal(parsed.market, 'Ohne Markt');
});
