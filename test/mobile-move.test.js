'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveMobileMarket, resolveMobileMoves } = require('../build/lib/mobile-move');

const markets = [
    { name: 'ALDI', enabled: true },
    { name: 'LIDL', enabled: true },
    { name: 'NETTO', enabled: true },
    { name: 'REWE', enabled: true },
];

function item(id, value, version = 2) {
    return { id, value, completed: false, version };
}

test('market typo correction recognizes one-letter mistakes without fixed market names', () => {
    for (const value of ['alsi', 'Sldi', 'Akdi', 'ALDI']) {
        assert.equal(resolveMobileMarket(value, markets), 'ALDI');
    }
    assert.equal(resolveMobileMarket('lIDk', markets), 'LIDL');
    assert.equal(resolveMobileMarket('neto', markets), 'NETTO');
    assert.equal(resolveMobileMarket('rewe', markets), 'REWE');
});

test('two independent mobile commands resolve against one numbered list snapshot', () => {
    const snapshot = [
        item('h', '02> ═════ ALDI ═════'),
        item('a', '13> Camembert'),
        item('b', '16> Joghurt'),
        item('c', '13WNETTO'),
        item('d', '16dneto'),
    ];
    const resolved = resolveMobileMoves(snapshot, markets);
    assert.equal(resolved.status, 'ready');
    assert.deepEqual(resolved.moves.map(move => move.mode), ['W', 'D']);
    assert.deepEqual(resolved.moves.map(move => [move.target.id, move.market]), [
        ['a', 'NETTO'], ['b', 'NETTO'],
    ]);
});

test('market headers cannot be moved by their prefix number', () => {
    const resolved = resolveMobileMoves([
        item('header', '35> ═════ ALDI ═════'),
        item('product', '71> Dinkelbrötchen'),
        item('command', '35wrewe'),
    ], markets);
    assert.equal(resolved.status, 'invalid');
});

test('duplicate commands for the same target fail without partial plan', () => {
    const resolved = resolveMobileMoves([
        item('product', '71> Dinkelbrötchen'),
        item('one', '71WALDI'),
        item('two', '71WNETTO'),
    ], markets);
    assert.equal(resolved.status, 'invalid');
    assert.equal(resolved.moves.length, 0);
});

test('unknown or ambiguous markets and missing versions remain unprocessed', () => {
    assert.equal(resolveMobileMoves([item('a', '13> Käse'), item('b', '13WUNKNOWN')], markets).status, 'invalid');
    assert.equal(resolveMobileMoves([item('a', '13> Käse'), item('b', '13WALDI', 0)], markets).status, 'invalid');
    assert.equal(resolveMobileMarket('ALSI', [{ name: 'ALDI' }, { name: 'ALSI' }]), 'ALSI');
    assert.equal(resolveMobileMarket('ALDI', [{ name: 'ALDI' }, { name: 'ALDI' }]), undefined);
});

test('no mobile commands means normal sorting remains unchanged', () => {
    assert.deepEqual(resolveMobileMoves([item('a', '13> Käse')], markets), { status: 'none', moves: [] });
});
