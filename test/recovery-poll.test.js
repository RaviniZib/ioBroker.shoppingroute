'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { EventEmitter } = require('node:events');
function fixture() {
    class Adapter extends EventEmitter {
        constructor() {
            super();
            this.config = { lists: [{ name: 'SHOP', enabled: true }] };
            this.log = { info() {}, debug() {}, warn() {}, error() {} };
        }
    }
    const filename = path.join(__dirname, '../build/main.js');
    const runtime = new Module(filename, module);
    const realRequire = Module.createRequire(filename);
    runtime.filename = filename;
    runtime.require = id => id === '@iobroker/adapter-core' ? { Adapter } : realRequire(id);
    runtime._compile(fs.readFileSync(filename, 'utf8'), filename);
    const adapter = runtime.exports({});
    const states = new Map([['control.enabled', true]]);
    adapter.getStateAsync = async id => ({ val: states.get(id) });
    adapter.setStateAsync = async (id, value) => states.set(id, value);
    adapter.persistTrafficMetrics = async () => {};
    adapter.wait = async () => {};
    const scheduled = [];
    adapter.armDirectPoll = delay => scheduled.push(delay);
    return { adapter, states, scheduled };
}
function journal() {
    return { version: 2, listName: 'SHOP', listId: 'list', expectedValues: ['10> Milch'], deletedIds: ['old'], status: 'failed' };
}
function item(id, value) { return { id, value, completed: false, version: 2 }; }
test('recovery clears a fully confirmed journal even when new items were added', async () => {
    const { adapter, states } = fixture();
    states.set('info.sortTransaction', JSON.stringify(journal()));
    adapter.readDirectItems = async () => [item('milk', '10> Milch'), item('new', 'Brot')];
    assert.equal(await adapter.recoverDirectApplyJournal(), true);
    assert.equal(states.get('info.sortTransaction'), '{}');
    assert.equal(states.get('control.enabled'), true);
});
test('recovery preserves the stop for missing values, duplicate shortages and undeleted IDs', async () => {
    for (const [expected, items] of [
        [['10> Milch'], [item('milk', 'Milch')]],
        [['10> Milch', '10> Milch'], [item('milk', '10> Milch')]],
        [['10> Milch'], [item('milk', '10> Milch'), item('old', 'Brot')]],
    ]) {
        const { adapter, states } = fixture();
        states.set('info.sortTransaction', JSON.stringify({ ...journal(), expectedValues: expected }));
        adapter.readDirectItems = async () => items;
        assert.equal(await adapter.recoverDirectApplyJournal(), false);
        assert.equal(states.get('control.enabled'), false);
        assert.notEqual(states.get('info.sortTransaction'), '{}');
    }
});
test('recovery retries delayed reads and retains the journal on a read failure', async () => {
    const { adapter, states } = fixture();
    states.set('info.sortTransaction', JSON.stringify(journal()));
    let reads = 0;
    adapter.readDirectItems = async () => ++reads === 1 ? [] : [item('milk', '10> Milch')];
    assert.equal(await adapter.recoverDirectApplyJournal(), true);
    assert.equal(reads, 2);
    states.set('info.sortTransaction', JSON.stringify(journal()));
    adapter.readDirectItems = async () => { throw new Error('timeout'); };
    assert.equal(await adapter.recoverDirectApplyJournal(), false);
    assert.notEqual(states.get('info.sortTransaction'), '{}');
});
test('polling reschedules while applying, during manual changes and while disabled', async () => {
    for (const mode of ['applying', 'manual', 'disabled']) {
        const { adapter, states, scheduled } = fixture();
        if (mode === 'applying') adapter.applyingListName = 'SHOP';
        if (mode === 'manual') adapter.manualCommandPending = true;
        if (mode === 'disabled') states.set('control.enabled', false);
        adapter.readDirectItems = async () => { throw new Error('unexpected read'); };
        await adapter.runDirectPoll();
        assert.deepEqual(scheduled, [60000]);
        assert.equal(adapter.directPollRunning, false);
    }
});
test('poll failures invalidate the session and retry with bounded backoff', async () => {
    const { adapter, scheduled } = fixture();
    let closed = false;
    adapter.directClient = { close() { closed = true; } };
    adapter.directListId = async () => { throw new Error('timeout'); };
    adapter.directPollDelayMs = 15 * 60000;
    await adapter.runDirectPoll();
    assert.equal(closed, true);
    assert.equal(adapter.directClient, null);
    assert.deepEqual(scheduled, [15 * 60000]);
});
test('successful direct poll observes Amazon additions and schedules the next check', async () => {
    const { adapter, states, scheduled } = fixture();
    const items = [item('new', 'Brot')];
    adapter.directListId = async () => 'list';
    adapter.readDirectItems = async () => items;
    let observed;
    adapter.observeListState = (name, raw) => { observed = [name, JSON.parse(raw)]; };
    await adapter.runDirectPoll();
    assert.deepEqual(observed, ['SHOP', items]);
    assert.equal(states.get('info.connection'), true);
    assert.deepEqual(scheduled, [60000]);
});
