'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    buildPrefixTargets,
    createPrefixSortPlan,
    expectedValues,
    formatSortPrefix,
    parseSortPrefix,
    stripSortPrefix,
    verifyPrefixResult,
} = require('../build/lib/prefix-sort');

const markets = [
    { name: 'LIDL', order: 1 },
    { name: 'ALDI', order: 2 },
    { name: 'PENNY', order: 3 },
];
const routes = [
    { market: 'LIDL', category: 'Obst/Gemüse', order: 1 },
    { market: 'LIDL', category: 'Milchprodukte', order: 2 },
    { market: 'ALDI', category: 'Milchprodukte', order: 1 },
    { market: 'PENNY', category: 'Getränke', order: 1 },
];
const products = [
    { name: 'Bananen', category: 'Obst/Gemüse', defaultMarket: 'LIDL' },
    { name: 'Tomaten', category: 'Obst/Gemüse', defaultMarket: 'LIDL' },
    { name: 'Milch', category: 'Milchprodukte', defaultMarket: 'LIDL' },
    { name: 'Eier', category: 'Milchprodukte', defaultMarket: 'ALDI' },
    { name: 'Cola', category: 'Getränke', defaultMarket: 'PENNY' },
];

function item(id, value, version = 1, completed = false) {
    return { id, value, version, completed };
}

test('prefix helpers accept exactly [NN] plus a space, including [00], and preserve original text', () => {
    assert.deepEqual(parseSortPrefix('[25] Tomaten'), { number: 25, originalText: 'Tomaten' });
    assert.deepEqual(parseSortPrefix('[00] ---- ALDI ----'), { number: 0, originalText: '---- ALDI ----' });
    assert.equal(parseSortPrefix('[5] Tomaten'), undefined);
    assert.equal(parseSortPrefix('25 Tomaten'), undefined);
    assert.equal(parseSortPrefix('[100] Tomaten'), undefined);
    assert.equal(stripSortPrefix('[25] Tomaten'), 'Tomaten');
    assert.equal(stripSortPrefix('Tomaten'), 'Tomaten');
    assert.equal(formatSortPrefix(7, '[25] Tomaten'), '[07] Tomaten');
    assert.equal(formatSortPrefix(0, '---- ALDI ----'), '[00] ---- ALDI ----');
});

test('A: legacy list with 10 items and 3 markets becomes one evenly spaced total plan', () => {
    const list = [
        item('b', 'Bananen'), item('t', 'Tomaten'), item('m', 'Milch'), item('e', 'Eier'), item('c', 'Cola'),
        item('b2', 'Bananen'), item('t2', 'Tomaten'), item('m2', 'Milch'), item('e2', 'Eier'), item('c2', 'Cola'),
    ];
    const desired = buildPrefixTargets(list, markets, routes, products, 'Ohne Markt', '', 1, true);
    const plan = createPrefixSortPlan(list, desired);
    assert.equal(plan.fallback, false);
    assert.equal(plan.deletes.length, 0);
    assert.equal(plan.updates.length, 10);
    assert.equal(plan.creates.length, 3);
    const values = expectedValues(plan);
    const numbers = values.map(value => parseSortPrefix(value).number);
    assert.equal(new Set(numbers).size, 13);
    assert.ok(numbers[0] >= 0 && numbers.at(-1) <= 99);
    assert.deepEqual(values.map(stripSortPrefix).slice(0, 4), [
        '---- LIDL ----', 'Bananen', 'Bananen', 'Tomaten',
    ]);
});

test('completely empty list with planned targets uses one evenly spaced batch create', () => {
    const desired = [
        { key: 'h', originalText: '---- LIDL ----', market: 'LIDL', category: '', product: 'header' },
        { key: 'a', originalText: 'Bananen', market: 'LIDL', category: 'Obst/Gemüse', product: 'Bananen' },
        { key: 'b', originalText: 'Milch', market: 'LIDL', category: 'Milchprodukte', product: 'Milch' },
    ];
    const plan = createPrefixSortPlan([], desired);
    assert.equal(plan.fallback, false);
    assert.equal(plan.updates.length, 0);
    assert.equal(plan.deletes.length, 0);
    assert.equal(plan.creates.length, 3);
    assert.deepEqual(plan.creates.map(create => create.value), ['[24] ---- LIDL ----', '[49] Bananen', '[74] Milch']);
});

test('B: one new item between [20] and [30] needs exactly one PUT and uses [25]', () => {
    const list = [item('a', '[20] Bananen', 4), item('n', 'Tomaten', 2), item('b', '[30] Milch', 7)];
    const desired = buildPrefixTargets(list, markets, routes, products, 'Ohne Markt', '', 1, false);
    const plan = createPrefixSortPlan(list, desired);
    assert.equal(plan.fallback, false);
    assert.deepEqual(plan.deletes, []);
    assert.deepEqual(plan.creates, []);
    assert.deepEqual(plan.updates, [{ id: 'n', version: 2, from: 'Tomaten', to: '[25] Tomaten' }]);
});

test('two collected new items sharing one gap need exactly two PUTs and no fallback', () => {
    const list = [item('a', '[20] Bananen', 4), item('n1', 'Tomaten', 2), item('n2', 'Milch', 3), item('b', '[40] Cola', 7)];
    const desired = [
        { key: 'id:a', id: 'a', version: 4, originalText: 'Bananen', market: 'LIDL', category: '', product: 'Bananen', currentValue: '[20] Bananen', currentPrefix: 20 },
        { key: 'id:n1', id: 'n1', version: 2, originalText: 'Tomaten', market: 'LIDL', category: '', product: 'Tomaten', currentValue: 'Tomaten' },
        { key: 'id:n2', id: 'n2', version: 3, originalText: 'Milch', market: 'LIDL', category: '', product: 'Milch', currentValue: 'Milch' },
        { key: 'id:b', id: 'b', version: 7, originalText: 'Cola', market: 'PENNY', category: '', product: 'Cola', currentValue: '[40] Cola', currentPrefix: 40 },
    ];
    const plan = createPrefixSortPlan(list, desired);
    assert.equal(plan.fallback, false);
    assert.equal(plan.updates.length, 2);
    assert.deepEqual(plan.updates.map(update => update.to), ['[26] Tomaten', '[33] Milch']);
    assert.deepEqual(plan.deletes, []);
    assert.deepEqual(plan.creates, []);
});

test('already correctly prefixed items never receive same-value writes', () => {
    const list = [item('a', '[20] Bananen', 4), item('b', '[30] Milch', 7)];
    const desired = buildPrefixTargets(list, markets, routes, products, 'Ohne Markt', '', 1, false);
    const plan = createPrefixSortPlan(list, desired);
    assert.equal(plan.fallback, false);
    assert.deepEqual(plan.updates, []);
    assert.deepEqual(plan.deletes, []);
    assert.deepEqual(plan.creates, []);
});

test('C/D: no number between [20] and [21] keeps the correct prefix and rebuilds only the suffix', () => {
    const list = [item('a', '[20] Bananen', 4), item('n', 'Tomaten', 2), item('b', '[21] Milch', 7)];
    const desired = buildPrefixTargets(list, markets, routes, products, 'Ohne Markt', '', 1, false);
    const plan = createPrefixSortPlan(list, desired);
    assert.equal(plan.fallback, true);
    assert.equal(plan.rebuildFrom, 1);
    assert.deepEqual(plan.deletes.map(entry => entry.id).sort(), ['b', 'n']);
    assert.equal(plan.creates.length, 2);
    assert.equal(plan.updates.length, 0);
    assert.equal(expectedValues(plan)[0], '[20] Bananen');
    assert.ok(parseSortPrefix(plan.creates[0].value).number > 20);
});

test('a ten-item suffix rebuild means ten DELETE requests and one batch CREATE request', () => {
    const list = [item('keep', '[10] Keep', 1)];
    const desired = [{
        key: 'id:keep', id: 'keep', version: 1, originalText: 'Keep', market: 'LIDL', category: '', product: 'Keep', currentValue: '[10] Keep', currentPrefix: 10,
    }];
    for (let index = 0; index < 10; index++) {
        const number = index === 0 ? 10 : 10 + index;
        const currentValue = `[${String(number).padStart(2, '0')}] Suffix ${index}`;
        list.push(item(`s${index}`, currentValue, index + 2));
        desired.push({
            key: `id:s${index}`,
            id: `s${index}`,
            version: index + 2,
            originalText: `Suffix ${index}`,
            market: 'LIDL',
            category: '',
            product: `Suffix ${index}`,
            currentValue,
            currentPrefix: number,
        });
    }
    const plan = createPrefixSortPlan(list, desired);
    assert.equal(plan.fallback, true);
    assert.equal(plan.rebuildFrom, 1);
    assert.equal(plan.deletes.length, 10);
    assert.equal(plan.creates.length, 10);
    assert.equal(plan.updates.length, 0);
    assert.equal(plan.deletes.length + (plan.creates.length ? 1 : 0), 11);
    const rebuiltNumbers = plan.creates.map(create => parseSortPrefix(create.value).number);
    assert.ok(rebuiltNumbers.every((number, index) => index === 0 || number - rebuiltNumbers[index - 1] > 1));
    assert.ok(rebuiltNumbers.at(-1) < 100);
});

test('completed items keep their numeric gap and are neither recreated nor renumbered', () => {
    const list = [item('a', '[10] Bananen'), item('gone', '[20] Tomaten', 3, true), item('b', '[30] Milch')];
    const desired = buildPrefixTargets(list, markets, routes, products, 'Ohne Markt', '', 1, false);
    const plan = createPrefixSortPlan(list, desired);
    assert.deepEqual(plan.updates, []);
    assert.deepEqual(plan.deletes, []);
    assert.deepEqual(plan.creates, []);
    assert.deepEqual(expectedValues(plan), ['[10] Bananen', '[30] Milch']);
});

test('duplicate visible names remain independent because desired targets retain distinct IDs', () => {
    const list = [item('a', '[20] Bananen', 1), item('b', 'Bananen', 2), item('c', '[40] Milch', 3)];
    const desired = buildPrefixTargets(list, markets, routes, products, 'Ohne Markt', '', 1, false);
    assert.deepEqual(desired.filter(target => target.originalText === 'Bananen').map(target => target.id), ['a', 'b']);
    const plan = createPrefixSortPlan(list, desired);
    assert.deepEqual(plan.updates, [{ id: 'b', version: 2, from: 'Bananen', to: '[30] Bananen' }]);
});

test('99 active targets are supported and the 100th fails safely', () => {
    const desired = Array.from({ length: 99 }, (_, index) => ({
        key: `new:${index}`,
        originalText: `Artikel ${index}`,
        market: 'Ohne Markt',
        category: '',
        product: `Artikel ${index}`,
    }));
    const plan = createPrefixSortPlan([], desired);
    assert.equal(plan.creates.length, 99);
    assert.equal(new Set(plan.creates.map(create => parseSortPrefix(create.value).number)).size, 99);
    assert.ok(plan.creates.every(create => /^\[\d{2}\] /.test(create.value)));
    assert.throws(() => createPrefixSortPlan([], desired.concat({ ...desired[0], key: '100' })), /Maximal 99/);
});

test('a preserved high prefix is moved into the smallest feasible fallback suffix', () => {
    const list = [item('a', '[99] Bananen', 4), item('b', 'Milch', 5)];
    const desired = buildPrefixTargets(list, markets, routes, products, 'Ohne Markt', '', 1, false);
    const plan = createPrefixSortPlan(list, desired);
    assert.equal(plan.fallback, true);
    assert.equal(plan.rebuildFrom, 0);
    assert.deepEqual(plan.deletes.map(entry => entry.id).sort(), ['a', 'b']);
    assert.equal(plan.creates.length, 2);
});

test('direct final verification requires exact prefixed values and A-Z order', () => {
    const list = [item('a', '[20] Bananen', 1), item('b', '[30] Milch', 1)];
    const desired = buildPrefixTargets(list, markets, routes, products, 'Ohne Markt', '', 1, false);
    const plan = createPrefixSortPlan(list, desired);
    assert.deepEqual(verifyPrefixResult(list, plan), { ok: true });
    assert.equal(verifyPrefixResult([item('a', '[20] Bananen'), item('b', '[31] Milch')], plan).ok, false);
});

test('direct final verification rejects an old suffix ID even when visible values look right', () => {
    const list = [item('a', '[20] Bananen', 1), item('b', '[21] Milch', 1), item('n', 'Tomaten', 1)];
    const desired = buildPrefixTargets(list, markets, routes, products, 'Ohne Markt', '', 1, false);
    const plan = createPrefixSortPlan(list, desired);
    assert.equal(plan.fallback, true);
    const fake = expectedValues(plan).map((value, index) => item(index === 0 ? 'a' : `new-${index}`, value));
    fake[1].id = plan.deletes[0].id;
    assert.match(verifyPrefixResult(fake, plan).reason, /weiterhin aktiv/);
});

test('known external input may add items while every own direct operation remains mandatory', () => {
    const list = [item('a', '[20] Bananen', 4), item('n', 'Tomaten', 2), item('b', '[30] Milch', 7)];
    const desired = buildPrefixTargets(list, markets, routes, products, 'Ohne Markt', '', 1, false);
    const plan = createPrefixSortPlan(list, desired);
    const settled = [item('a', '[20] Bananen'), item('n', '[25] Tomaten'), item('b', '[30] Milch'), item('external', 'Eis')];
    assert.deepEqual(verifyPrefixResult(settled, plan, true), { ok: true });
    assert.equal(verifyPrefixResult([item('a', '[20] Bananen'), item('n', 'Tomaten'), item('b', '[30] Milch'), item('external', 'Eis')], plan, true).ok, false);
});
