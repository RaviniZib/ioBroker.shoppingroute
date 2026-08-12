'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('productive sorting has no legacy SHOPPINGROUTE underscore marker', () => {
    const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.ts'), 'utf8');
    assert.doesNotMatch(main, /SHOPPINGROUTE_[A-Z_]+/);
    assert.match(main, /createBufferedSortMarker\(transactionId, attempt, existingValues\)/);
    assert.match(main, /createVisibleOrderMarker\(transactionId, index, expectedValues\.values\(\)\)/);
});
