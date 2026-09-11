'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { collectUnknownItems } = require('../build/lib/sorter');

const markets = [{ name: 'LIDL', enabled: true }, { name: 'REWE', enabled: true }];
const item = (id, value) => ({ id, value, completed: false, version: 1 });

test('legacy short market headings never enter the review queue', () => {
    const unknown = collectUnknownItems([
        item('h1', '— LIDL —'),
        item('h2', '14> — REWE —'),
        item('h3', '14> 25> — LIDL —'),
        item('a', 'Schmelzkäse'),
    ], markets, [], 'LIDL');
    assert.deepEqual(unknown.map(entry => entry.product), ['Schmelzkäse']);
});
