'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
    createSortPlan,
    mergeUnknownProducts,
    mergeReviewQueue,
    applyReviewActions,
    compareActiveSnapshot,
    activeSnapshotHasConflict,
} = require('../build/lib/sorter');
const { parseItem, stripQuantityDetailed, canonicalProductKey } = require('../build/lib/parser');

const markets = [
    { name: 'ALDI', aliases: 'Aldi,Aldi Nord', order: 10, enabled: true },
    { name: 'PENNY', aliases: 'Penny', order: 20, enabled: true },
    { name: 'LIDL', aliases: 'Lidl', order: 30, enabled: true },
    { name: 'REWE', aliases: 'Rewe', order: 40, enabled: true },
    { name: 'Ohne Markt', aliases: '', order: 999, enabled: true },
];
const routes = [
    { market: 'ALDI', category: 'Obst/Gemüse', order: 10 },
    { market: 'ALDI', category: 'Fleisch/Fisch', order: 20 },
    { market: 'ALDI', category: 'Milchprodukte', order: 30 },
    { market: 'ALDI', category: 'Haushalt/Hygiene', order: 40 },
    { market: 'ALDI', category: 'Nonfood', order: 50 },
    { market: 'PENNY', category: 'Milchprodukte', order: 10 },
    { market: 'PENNY', category: 'Obst/Gemüse', order: 20 },
    { market: 'LIDL', category: 'Obst/Gemüse', order: 10 },
    { market: 'LIDL', category: 'Milchprodukte', order: 20 },
    { market: 'REWE', category: 'Getränke', order: 10 },
    { market: 'Ohne Markt', category: 'Obst/Gemüse', order: 10 },
    { market: 'Ohne Markt', category: 'Fleisch/Fisch', order: 20 },
    { market: 'Ohne Markt', category: 'Milchprodukte', order: 30 },
    { market: 'Ohne Markt', category: 'Haushalt/Hygiene', order: 40 },
    { market: 'Ohne Markt', category: 'Nonfood', order: 50 },
];
const products = [
    { name: 'Bananen', aliases: 'Banane', category: 'Obst/Gemüse', defaultMarket: '', availableMarkets: '' },
    { name: 'Eier', aliases: 'Ei', category: 'Milchprodukte', defaultMarket: '', availableMarkets: '' },
    { name: 'Grillfleisch', aliases: '', category: 'Fleisch/Fisch', defaultMarket: '', availableMarkets: '' },
    { name: 'Hackfleisch', aliases: 'Hack,Rinderhack', category: 'Fleisch/Fisch', defaultMarket: '', availableMarkets: '' },
    { name: 'Pinsel', aliases: 'Grober Pinsel', category: 'Nonfood', defaultMarket: '', availableMarkets: '' },
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
    assert.deepEqual(plan.map(entry => entry.to), ['Bananen','Grillfleisch','Hackfleisch','Eier','Pinsel']);
    assert.deepEqual(plan.map(entry => entry.id), ['id1','id2','id3','id4','id5']);
});

test('explicit market is primary and visible text stays unchanged', () => {
    const list = [
        { id: 'a', value: 'Eier von Penny', completed: false, createdDateTime: 1 },
        { id: 'b', value: 'Bananen von Aldi', completed: false, createdDateTime: 2 },
        { id: 'c', value: 'Eier von Aldi', completed: false, createdDateTime: 3 },
    ];
    assert.deepEqual(createSortPlan(list, markets, routes, products, 'Ohne Markt').map(x => x.to), ['Bananen von Aldi','Eier von Aldi','Eier von Penny']);
});

test('quantities in digits, words and half units are stripped only for matching', () => {
    for (const [text, expected] of [
        ['3 Bananen von Aldi', 'Bananen'],
        ['500 Gramm Hackfleisch von Aldi', 'Hackfleisch'],
        ['zwei Packungen Eier von Penny', 'Eier'],
        ['6x Cola von Rewe', 'Cola'],
        ['halbes Kilo Hackfleisch', 'Hackfleisch'],
    ]) {
        const parsed = parseItem(text, markets, products, 'Ohne Markt', 'LIDL');
        assert.equal(parsed.productName, expected, text);
        assert.equal(parsed.originalText, text);
    }
    assert.equal(stripQuantityDetailed('1/2 Pfeiffer Leberwurst').productText, '1/2 Pfeiffer Leberwurst');
});

test('priority hierarchy and product availability are respected', () => {
    assert.equal(parseItem('Bananen', markets, products, 'Ohne Markt', 'LIDL').market, 'LIDL');
    assert.equal(parseItem('Bananen von Aldi', markets, products, 'Ohne Markt', 'LIDL').market, 'ALDI');
    const configured = products.map(p => p.name === 'Eier' ? { ...p, defaultMarket: 'PENNY' } : p);
    assert.equal(parseItem('Eier', markets, configured, 'Ohne Markt', 'LIDL').market, 'PENNY');
    const restricted = products.map(p => p.name === 'Bananen' ? { ...p, availableMarkets: 'ALDI,PENNY' } : p);
    assert.equal(parseItem('Bananen', markets, restricted, 'Ohne Markt', 'LIDL').market, 'ALDI');
});

test('duplicate learning uses canonical product keys', () => {
    assert.equal(canonicalProductKey('3 Bananen'), canonicalProductKey('Banane'));
    const list = [
        { id: 'u1', value: 'Milch', completed: false, createdDateTime: 1 },
        { id: 'u2', value: '2 Milch', completed: false, createdDateTime: 2 },
    ];
    const result = mergeUnknownProducts(list, markets, products, 'Ohne Markt', 'LIDL');
    assert.equal(result.learned.filter(p => p.name === 'Milch').length, 1);
});

test('ambiguous unknown market suffix is not learned as product', () => {
    const list = [{ id: 'u1', value: '35 Sushi von Ukuhama', completed: false, createdDateTime: 1 }];
    const result = mergeUnknownProducts(list, markets, products, 'Ohne Markt', 'LIDL');
    assert.equal(result.learned.length, 0);
    const parsed = parseItem('35 Sushi von Ukuhama', markets, products, 'Ohne Markt', 'LIDL');
    assert.equal(parsed.market, 'Ohne Markt');
    assert.equal(parsed.ambiguousMarketSuffix, 'Ukuhama');
});

test('review queue supports correction, acceptance and ignore', () => {
    const unknown = [{ key: 'toilettenpapier', text: 'Toilettenpapier', product: 'Toilettenpapier', market: 'LIDL', guessedCategory: 'Haushalt/Hygiene' }];
    const queue = mergeReviewQueue([], unknown, '2026-08-08T00:00:00Z');
    queue[0].action = 'accept'; queue[0].category = 'Haushalt/Hygiene'; queue[0].defaultMarket = 'LIDL';
    const applied = applyReviewActions(products, queue);
    const added = applied.products.find(p => p.name === 'Toilettenpapier');
    assert.ok(added); assert.equal(added.category, 'Haushalt/Hygiene'); assert.equal(added.defaultMarket, 'LIDL');
    assert.equal(applied.remainingReviews.length, 0);

    const ignored = mergeReviewQueue([{ ...queue[0], action: 'ignore' }], unknown);
    assert.equal(ignored[0].action, 'ignore');
});

test('route row order determines product-group order', () => {
    const movedRoutes = [
        { market: 'ALDI', category: 'Milchprodukte', order: 999 },
        { market: 'ALDI', category: 'Obst/Gemüse', order: 1 },
    ];
    const list = [
        { id: 'a', value: 'Bananen von Aldi', completed: false, createdDateTime: 1 },
        { id: 'b', value: 'Eier von Aldi', completed: false, createdDateTime: 2 },
    ];
    assert.deepEqual(createSortPlan(list, markets, movedRoutes, products, 'Ohne Markt').map(x => x.to), ['Eier von Aldi','Bananen von Aldi']);
});


test('review queue is stable for repeated identical observations', () => {
    const unknown = [{
        key: 'toilettenpapier',
        text: 'Toilettenpapier',
        product: 'Toilettenpapier',
        market: 'LIDL',
        guessedCategory: 'Haushalt/Hygiene',
    }];

    const first = mergeReviewQueue([], unknown, '2026-08-10T18:00:00.000Z');
    const second = mergeReviewQueue(first, unknown, '2026-08-10T18:05:00.000Z');

    assert.deepEqual(second, first);
    assert.equal(second[0].lastSeen, '2026-08-10T18:00:00.000Z');

    const ignored = [{ ...first[0], action: 'ignore' }];
    const ignoredAgain = mergeReviewQueue(ignored, unknown, '2026-08-10T18:10:00.000Z');
    assert.deepEqual(ignoredAgain, ignored);
});

test('review queue updates lastSeen when the observed item really changes', () => {
    const unknown = [{
        key: 'toilettenpapier',
        text: 'Toilettenpapier',
        product: 'Toilettenpapier',
        market: 'LIDL',
        guessedCategory: 'Haushalt/Hygiene',
    }];

    const first = mergeReviewQueue([], unknown, '2026-08-10T18:00:00.000Z');
    const changed = [{
        ...unknown[0],
        text: 'Toilettenpapier bei Aldi',
        market: 'ALDI',
    }];
    const second = mergeReviewQueue(first, changed, '2026-08-10T18:05:00.000Z');

    assert.equal(second[0].text, 'Toilettenpapier bei Aldi');
    assert.equal(second[0].market, 'ALDI');
    assert.equal(second[0].lastSeen, '2026-08-10T18:05:00.000Z');
});


test('transaction snapshot treats newly added items as a conflict', () => {
    const original = [
        { id: 'a', value: 'Möhren', completed: false, createdDateTime: 1 },
        { id: 'b', value: 'Gurke', completed: false, createdDateTime: 2 },
    ];
    const fresh = [
        ...original,
        { id: 'c', value: 'Milch', completed: false, createdDateTime: 3 },
    ];
    const expected = new Map([['a', 'Möhren'], ['b', 'Gurke']]);
    const comparison = compareActiveSnapshot(original, fresh, expected);

    assert.deepEqual(comparison.addedIds, ['c']);
    assert.deepEqual(comparison.missingIds, []);
    assert.deepEqual(comparison.changedIds, []);
    assert.equal(activeSnapshotHasConflict(comparison), true);
});

test('transaction snapshot detects changed or completed original items', () => {
    const original = [
        { id: 'a', value: 'Möhren', completed: false, createdDateTime: 1 },
        { id: 'b', value: 'Gurke', completed: false, createdDateTime: 2 },
    ];
    const fresh = [
        { id: 'a', value: 'Möhren geändert', completed: false, createdDateTime: 1 },
        { id: 'b', value: 'Gurke', completed: true, createdDateTime: 2 },
        { id: 'c', value: 'Milch', completed: false, createdDateTime: 3 },
    ];
    const expected = new Map([['a', 'Möhren'], ['b', 'Gurke']]);
    const comparison = compareActiveSnapshot(original, fresh, expected);

    assert.deepEqual(comparison.addedIds, ['c']);
    assert.deepEqual(comparison.missingIds, ['b']);
    assert.deepEqual(comparison.changedIds, ['a']);
    assert.equal(activeSnapshotHasConflict(comparison), true);
});
