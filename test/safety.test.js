'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('runtime performs no writes through Alexa2 states and serializes direct item operations', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.ts'), 'utf8');
    assert.doesNotMatch(source, /setForeignStateAsync|\.Lists\.[^\n]*\.#New|\.Lists\.[^\n]*\.#delete/);
    assert.match(source, /for \(const update of plan\.updates\)/);
    assert.match(source, /for \(const deletion of plan\.deletes\)/);
    assert.match(source, /client\.batchCreate/);
    assert.match(source, /SAFETY STOP/);
});
