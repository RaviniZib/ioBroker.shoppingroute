'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('runtime source has no Alexa create/delete/complete write path', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.ts'), 'utf8');

    assert.doesNotMatch(source, /setForeignStateAsync\([^\n]*(?:#New|#delete|\.completed)/);
    assert.doesNotMatch(source, /Lists\.[^\n]*#New/);
    assert.doesNotMatch(source, /Lists\.[^\n]*#delete/);
});
