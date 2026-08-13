'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    beginDirectApply,
    collectDirectInput,
    collectionDue,
    createDirectSortLifecycle,
    finishDirectApply,
} = require('../build/lib/direct-sort-lifecycle');

test('one new article starts one five-second collection window', () => {
    const collected = collectDirectInput(createDirectSortLifecycle(), 1000, ['a'], 5000);
    assert.equal(collected.lifecycle.phase, 'COLLECTING');
    assert.equal(collected.deadline, 6000);
    assert.equal(collectionDue(collected.lifecycle, collected.deadline, 5999), false);
    assert.equal(collectionDue(collected.lifecycle, collected.deadline, 6000), true);
});

test('the second new article starts the same apply immediately without a parallel run', () => {
    const first = collectDirectInput(createDirectSortLifecycle(), 1000, ['a'], 5000);
    const second = collectDirectInput(first.lifecycle, 2500, ['b'], 5000);
    assert.equal(second.deadline, 2500);
    assert.deepEqual([...second.lifecycle.newIds], ['a', 'b']);
    const applying = beginDirectApply(second.lifecycle);
    assert.equal(applying.phase, 'APPLYING');
    assert.equal(beginDirectApply(applying).phase, 'APPLYING');
});

test('completed/remove change with no new ID still applies after five seconds', () => {
    const collected = collectDirectInput(createDirectSortLifecycle(), 4000, [], 5000);
    assert.equal(collected.deadline, 9000);
    assert.equal(collected.lifecycle.newIds.size, 0);
});

test('external input during APPLYING creates a full follow-up collection window', () => {
    const first = collectDirectInput(createDirectSortLifecycle(), 1000, ['a'], 5000);
    const applying = beginDirectApply(first.lifecycle);
    const dirty = collectDirectInput(applying, 3000, ['b', 'c'], 5000);
    assert.equal(dirty.lifecycle.phase, 'APPLYING');
    assert.equal(dirty.lifecycle.externalDirty, true);
    const followup = finishDirectApply(dirty.lifecycle, 3500);
    assert.ok(followup);
    assert.equal(followup.lifecycle.phase, 'COLLECTING');
    assert.equal(followup.deadline, 8000);
    assert.equal(collectionDue(followup.lifecycle, followup.deadline, 7999), false);
});

test('successful APPLYING without external input returns to IDLE without a timer request', () => {
    const applying = beginDirectApply(collectDirectInput(createDirectSortLifecycle(), 1000, ['a'], 5000).lifecycle);
    assert.equal(finishDirectApply(applying, 2000), undefined);
});
