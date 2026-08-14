'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { isAcknowledgedForeignState } = require('../build/lib/state-change');

test('foreign Alexa2 list states are processed only when acknowledged', () => {
    assert.equal(isAcknowledgedForeignState({ ack: true }), true);
    assert.equal(isAcknowledgedForeignState({ ack: false }), false);
});

test('foreign ack guard precedes observation while own writable controls retain !ack handling', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.ts'), 'utf8');
    const foreignBlock = source.slice(
        source.indexOf('const list = this.listConfigs.find'),
        source.indexOf('private onUnload'),
    );
    assert.match(foreignBlock, /if \(!isAcknowledgedForeignState\(state\)\) return;[\s\S]*observeListState/);
    for (const control of ['sortNow', 'compatibilityTest', 'resetTrafficStats', 'enabled']) {
        assert.match(source, new RegExp(`control\\.${control}[^\\n]*!state\\.ack`), control);
    }
});
