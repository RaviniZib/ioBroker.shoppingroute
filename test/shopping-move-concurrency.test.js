'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { EventEmitter } = require('node:events');
const { Components: { ShoppingListEditor } } = require('../src-admin/shopping-list-editor');
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function elements(tree) { return !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(elements)]; }
function editorFixture() {
    const reply = deferred(); const calls = [];
    const editor = new ShoppingListEditor({ socket: { sendTo: async (...args) => { calls.push(args); return reply.promise; } } });
    editor.state = { loading: false, busy: '', error: '', view: { listName: 'SHOP', lists: ['SHOP'], markets: ['REWE'], items: [{ id: 'gum', text: 'Weckgummis', market: 'REWE', position: 0 }] } };
    // React batches setState during event propagation: state.busy is not a synchronous lock.
    const pending = [];
    editor.setState = patch => { pending.push(patch); };
    return { editor, calls, reply, pending };
}
function runtimeFixture() {
    class Adapter extends EventEmitter {
        constructor() { super(); this.config = { dryRun: false, lists: [{ name: 'SHOP' }], markets: [{name: 'REWE'}] }; this.log = { info() {}, debug() {}, warn() {}, error() {} }; }
        async getStateAsync() { return { val: true }; }
        async setStateAsync() {}
        setTimeout(fn, ms) { return setTimeout(fn, ms); }
        clearTimeout(timer) { clearTimeout(timer); }
    }
    const filename = path.join(__dirname, '../build/main.js');
    const runtime = new Module(filename, module);
    const realRequire = Module.createRequire(filename);
    runtime.filename = filename;
    runtime.require = id => id === '@iobroker/adapter-core' ? { Adapter } : realRequire(id);
    runtime._compile(fs.readFileSync(filename, 'utf8'), filename);
    const adapter = runtime.exports({});
    for (const method of ['persistRuntimeConfig', 'refreshExports', 'updateFeedbackReport', 'persistManualOverrides']) adapter[method] = async () => {};
    adapter.getStateAsync = async () => ({ val: '' });
    adapter.logDirectRuntime = () => {};
    return adapter;
}

test('dropping on an item does not also dispatch a drop to its market section', async () => {
    const { editor, calls, reply } = editorFixture();
    const tree = elements(editor.render());
    const row = tree.find(n => n.props?.className === 'shoppingroute-item-row');
    const section = tree.find(n => n.type === 'section');
    let stopped = false;
    const event = { preventDefault() {}, stopPropagation() { stopped = true; }, dataTransfer: { getData() { return 'gum'; } } };
    row.props.onDrop(event);
    if (!stopped) section.props.onDrop(event);
    try { assert.equal(stopped, true); assert.equal(calls.length, 1); }
    finally { reply.resolve({ ok: true, view: editor.state.view }); await tick(); }
});

test('two rapid move commands send only one request before React renders busy', async () => {
    const { editor, calls, reply } = editorFixture();
    const first = editor.move('gum', 'REWE', 0);
    const second = editor.move('gum', 'REWE', 1);
    try { assert.equal(calls.length, 1); }
    finally { reply.resolve({ ok: true, view: editor.state.view }); await Promise.all([first, second]); }
});

test('direct sorting reserves its lock before awaiting the enabled state', async () => {
    const adapter = runtimeFixture();
    const enabled = deferred(); const finish = deferred(); let runs = 0;
    adapter.isEnabled = () => enabled.promise;
    adapter.applyDirectSort = async () => { runs++; await finish.promise; };
    adapter.prepareImmediateApply('SHOP');
    const first = adapter.startApply('SHOP');
    const second = adapter.startApply('SHOP');
    enabled.resolve(true); await tick();
    try { assert.equal(runs, 1, 'one DELETE/CREATE transaction, not two'); }
    finally { finish.resolve(); await Promise.all([first, second]); }
});

test('manual moves reserve the command before any remote read or override persistence', async () => {
    const adapter = runtimeFixture();
    const view = { listName: 'SHOP', lists: ['SHOP'], markets: ['REWE'], items: [{id: 'gum', text: 'Weckgummis', market: 'REWE', position: 0}] };
    const read = deferred(); let preparations = 0;
    adapter.buildShoppingListView = () => read.promise;
    adapter.isEnabled = async () => true;
    adapter.persistManualOverrides = async () => { preparations++; };
    adapter.applyDirectSort = async () => {};
    const message = { listName: 'SHOP', itemId: 'gum', targetMarket: 'REWE', targetPosition: 0 };
    const first = adapter.applyManualMove(message);
    const second = adapter.applyManualMove(message).then(() => 'accepted', () => 'busy');
    read.resolve(view);
    await first;
    assert.equal(await second, 'busy');
    assert.equal(preparations, 1);
});

test('automatic sorting waits for a manual command and remains usable afterwards', async () => {
    const adapter = runtimeFixture(); const read = deferred(); let runs = 0;
    const view = { listName: 'SHOP', lists: ['SHOP'], markets: ['REWE'], items: [{id: 'gum', text: 'Weckgummis', market: 'REWE', position: 0}] };
    adapter.buildShoppingListView = () => read.promise;
    adapter.isEnabled = async () => true;
    adapter.applyDirectSort = async () => { runs++; };
    adapter.prepareImmediateApply('SHOP');
    const manual = adapter.applyManualMove({listName: 'SHOP', itemId: 'gum', targetMarket: 'REWE'});
    await adapter.startApply('SHOP');
    assert.equal(runs, 0);
    await assert.rejects(adapter.clearManualShoppingOrder({listName: 'SHOP'}), /already running/);
    read.resolve(view); await manual;
    assert.equal(runs, 1);
    adapter.prepareImmediateApply('SHOP'); await adapter.startApply('SHOP');
    assert.equal(runs, 2, 'next legitimate operation is allowed');
});

test('disabled and failed applies release their lock and report one safety stop', async () => {
    const adapter = runtimeFixture(); let enabled = false; let runs = 0; const errors = [];
    adapter.isEnabled = async () => enabled;
    adapter.log.error = message => errors.push(message);
    adapter.applyDirectSort = async () => { runs++; throw new Error('SHOP: verification failed'); };
    adapter.prepareImmediateApply('SHOP'); await adapter.startApply('SHOP');
    assert.equal(runs, 0); assert.equal(adapter.applyingListName, '');
    enabled = true; adapter.prepareImmediateApply('SHOP');
    await Promise.all([adapter.startApply('SHOP'), adapter.startApply('SHOP')]);
    assert.equal(runs, 1); assert.equal(errors.length, 1);
    assert.match(errors[0], /^SHOP: verification failed SAFETY STOP:/);
    assert.equal(adapter.applyingListName, '');
});

test('a rejected move keeps its error visible after reloading the actual list', async () => {
    const { editor } = editorFixture(); const view = editor.state.view;
    editor.setState = patch => { editor.state = { ...editor.state, ...patch }; };
    editor.send = async command => command === 'moveShoppingItem'
        ? { ok: false, error: 'Safety stop is active.' } : view;
    await editor.move('gum', 'REWE', 1);
    assert.equal(editor.state.error, 'Safety stop is active.');
    assert.equal(editor.state.busy, '');
    assert.equal(editor.commandPending, false);
});

function deletionFixture({ duplicate = false, ignoreDelete = false } = {}) {
    const adapter = runtimeFixture();
    adapter.config.fallbackMarket = 'Ohne Markt';
    adapter.runtimeProducts = [{ name: 'Weckgummis', category: 'Nonfood', defaultMarket: 'REWE' }];
    adapter.config.marketHeaders = true;
    let items = [
        { id: 'header', value: '10> ═════ REWE ═════', version: 1, completed: false },
        { id: 'gum', value: '20> Weckgummis', version: 3, completed: false },
        ...(duplicate ? [{ id: 'other', value: '30> Weckgummis', version: 2, completed: false }] : []),
    ];
    const states = new Map([['control.enabled', true]]);
    const writes = [];
    adapter.getStateAsync = async id => ({ val: states.get(id) });
    adapter.setStateAsync = async (id, value) => { states.set(id, value); };
    for (const method of ['ensureTrafficDay', 'persistTrafficMetrics', 'recordNewItems', 'updateLearningAndDiagnostics']) adapter[method] = async () => {};
    adapter.directListId = async () => 'amazon-shop';
    adapter.readDirectItems = async () => items.map(item => ({ ...item }));
    adapter.initializeDirectClient = async () => ({
        deleteItem: async (listId, id, version) => {
            assert.equal(listId, 'amazon-shop');
            assert.equal(items.find(item => item.id === id)?.version, version);
            assert.notEqual(states.get('info.sortTransaction'), '{}', 'journal exists before the write');
            writes.push(id);
            if (!ignoreDelete) items = items.filter(item => item.id !== id);
        },
        updateItem: async () => assert.fail('Deleting must preserve the remaining valid prefixes'),
        batchCreate: async () => assert.fail('Deleting must not recreate an item'),
    });
    return { adapter, states, writes, items: () => items };
}

test('delete button sends one ID-based command and excludes a concurrent move', async () => {
    const { editor, calls, reply } = editorFixture();
    const button = elements(editor.render()).find(n => n.key === 'delete');
    assert.ok(button); assert.equal(button.props.disabled, undefined);
    button.props.onClick(); button.props.onClick();
    await editor.move('gum', 'REWE', 0);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][1], 'deleteShoppingItem');
    assert.deepEqual(calls[0][2], { listName: 'SHOP', itemId: 'gum' });
    reply.resolve({ ok: true, view: { ...editor.state.view, items: [] } }); await tick();
    assert.equal(editor.commandPending, false);
});

test('deleting the last article removes its orphan market header in the same verified transaction', async () => {
    const { adapter, states, writes, items } = deletionFixture();
    const result = await adapter.deleteShoppingItem({ listName: 'SHOP', itemId: 'gum' });
    assert.equal(result.ok, true);
    assert.deepEqual(result.view.items, []); assert.deepEqual(items(), []);
    assert.deepEqual(writes.sort(), ['gum', 'header']);
    assert.equal(states.get('info.sortTransaction'), '{}');
    assert.equal(states.get('control.enabled'), true);
});

test('deleting one of two same-name items preserves the other ID and its market header', async () => {
    const { adapter, writes, items } = deletionFixture({ duplicate: true });
    const result = await adapter.deleteShoppingItem({ listName: 'SHOP', itemId: 'gum' });
    assert.equal(result.ok, true);
    assert.deepEqual(writes, ['gum']);
    assert.deepEqual(items().map(item => item.id), ['header', 'other']);
    assert.deepEqual(result.view.items.map(item => item.id), ['other']);
});

test('unconfirmed deletion returns failure, retains its journal, stops writes and does not retry', async () => {
    const { adapter, states, writes } = deletionFixture({ duplicate: true, ignoreDelete: true });
    const result = await adapter.deleteShoppingItem({ listName: 'SHOP', itemId: 'gum' });
    assert.equal(result.ok, false); assert.match(result.error, /SAFETY STOP/);
    assert.deepEqual(writes, ['gum']);
    assert.equal(states.get('control.enabled'), false);
    assert.equal(JSON.parse(states.get('info.sortTransaction')).status, 'failed');
    await adapter.deleteShoppingItem({ listName: 'SHOP', itemId: 'gum' });
    assert.deepEqual(writes, ['gum']);
});

test('dry run, disabled writes, stale IDs, headers and unknown lists cannot delete', async () => {
    const { adapter, states, writes } = deletionFixture();
    const message = { listName: 'SHOP', itemId: 'gum' };
    adapter.config.dryRun = true;
    assert.equal((await adapter.deleteShoppingItem(message)).ok, false);
    adapter.config.dryRun = false; states.set('control.enabled', false);
    assert.equal((await adapter.deleteShoppingItem(message)).ok, false);
    states.set('control.enabled', true);
    for (const itemId of ['missing', 'header', '']) assert.equal((await adapter.deleteShoppingItem({ ...message, itemId })).ok, false);
    await assert.rejects(adapter.deleteShoppingItem({ ...message, listName: 'OTHER' }), /not configured/);
    assert.deepEqual(writes, []);
});

test('pending deletion excludes another deletion and move before its first remote read finishes', async () => {
    const { adapter, writes } = deletionFixture(); const read = deferred();
    const originalRead = adapter.readDirectItems.bind(adapter);
    adapter.readDirectItems = async (...args) => { await read.promise; return originalRead(...args); };
    const first = adapter.deleteShoppingItem({ listName: 'SHOP', itemId: 'gum' });
    await assert.rejects(adapter.deleteShoppingItem({ listName: 'SHOP', itemId: 'gum' }), /already running/);
    await assert.rejects(adapter.applyManualMove({ listName: 'SHOP', itemId: 'gum' }), /already running/);
    read.resolve(); assert.equal((await first).ok, true);
    assert.deepEqual(writes.sort(), ['gum', 'header']);
});

test('delete dispatch replies to Admin and the UI keeps a failed deletion visible', async () => {
    const { adapter } = deletionFixture(); const replies = [];
    adapter.sendTo = (...args) => replies.push(args);
    await adapter.onMessage({ command: 'deleteShoppingItem', from: 'admin.0', callback: { id: 1 }, message: { listName: 'SHOP', itemId: 'gum' } });
    assert.equal(replies.length, 1); assert.equal(replies[0][2].ok, true);
    const { editor } = editorFixture(); const view = editor.state.view;
    editor.setState = patch => { editor.state = { ...editor.state, ...patch }; };
    editor.send = async command => command === 'deleteShoppingItem' ? { ok: false, error: 'Deletion was not confirmed.' } : view;
    await editor.remove('gum');
    assert.equal(editor.state.error, 'Deletion was not confirmed.');
    assert.equal(editor.state.view.items.length, 1);
    assert.equal(editor.commandPending, false);
});
