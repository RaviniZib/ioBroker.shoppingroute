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


test('Bring! content event wakes the bridge immediately; unchanged or unacknowledged changes are ignored', async () => {
    const { adapter, scheduled } = fixture();
    adapter.config.bringSyncMode = 'bidirectional';
    adapter.config.bringInstance = 'bring.0';
    adapter.config.bringListId = '6efd5207-a4fa-4aba-8bd4-6f46ce2306d3';
    adapter.config.bringAlexaList = 'SHOP';
    adapter.armBringPoll = delay => scheduled.push(delay);
    const stateId = 'bring.0.6efd5207-a4fa-4aba-8bd4-6f46ce2306d3.content';
    await adapter.onStateChange(stateId, { ack: true, val: '[{"name":"Milch","specification":""}]' });
    assert.deepEqual(scheduled, [750]);
    await adapter.onStateChange(stateId, { ack: false, val: '' });
    assert.deepEqual(scheduled, [750]);
    adapter.observeListState = () => {};
    await adapter.onStateChange('alexa2.0.Lists.SHOP.json', { ack: true, val: '[]' });
    assert.deepEqual(scheduled, [750, 750]);
});

test('Bring! backstop does not postpone an already scheduled event check', () => {
    const { adapter } = fixture();
    adapter.config.bringSyncMode = 'bidirectional';
    const timers = [];
    const cleared = [];
    adapter.setTimeout = (fn, delay) => {
        timers.push({ fn, delay });
        return timers.length;
    };
    adapter.clearTimeout = id => cleared.push(id);
    adapter.armBringPoll(30000);
    adapter.armBringPoll(750);
    adapter.armBringPoll(30000);
    assert.deepEqual(timers.map(x => x.delay), [30000, 750]);
    assert.deepEqual(cleared, [1]);
    assert.equal(adapter.bringPollDueAt > 0, true);
    adapter.bringSyncRunning = true;
    adapter.requestBringPoll();
    assert.equal(adapter.bringPollQueued, true);
    assert.deepEqual(timers.map(x => x.delay), [30000, 750]);
});

test('Bridge defers reconciliation during collection with short retry and no extra cloud reads', async () => {
    const { adapter, states } = fixture();
    adapter.config.bringSyncMode = 'bidirectional';
    adapter.config.bringInstance = 'bring.0';
    adapter.config.bringListId = '6efd5207-a4fa-4aba-8bd4-6f46ce2306d3';
    adapter.config.bringAlexaList = 'SHOP';
    const scheduled = [];
    adapter.armBringPoll = delay => scheduled.push(delay);
    adapter.getForeignStateAsync = async id => {
        if (id === 'bring.0.info.connection') return { val: true };
        if (id.endsWith('.content')) return { val: '[]', ack: true, ts: Date.now() };
        throw new Error('Unexpected foreign read: ' + id);
    };
    adapter.bringRoutePreview = async () => {};
    adapter.getListState('SHOP').phase = 'COLLECTING';
    adapter.directListId = async () => { throw new Error('Direct read must be deferred'); };
    await adapter.runBringSync();
    assert.deepEqual(scheduled, [3000]);
    assert.equal(JSON.parse(states.get('info.bringSyncStatus')).status, 'busy');
});

test('Bridge uses a 30-second read fallback while keeping default Alexa-only polling', async () => {
    const { adapter, scheduled } = fixture();
    adapter.config.bringSyncMode = 'bidirectional';
    adapter.directListId = async () => 'list';
    adapter.readDirectItems = async () => [];
    adapter.observeListState = () => {};
    await adapter.runDirectPoll();
    assert.deepEqual(scheduled, [30000]);
});
