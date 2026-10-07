'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { Components: { CatalogManager } } = require('../src-admin/catalog-manager');
const { Components: { MarketsEditor }, MarketsEditorModel } = require('../src-admin/markets-editor');
const { Components: { ProductGroupsEditor }, ProductGroupsEditorModel } = require('../src-admin/product-groups-editor');
const { Components: { RouteEditor }, RouteEditorModel } = require('../src-admin/route-editor');
const { ShoppingListEditor, ShoppingListEditorModel } = require('../src-admin/shopping-list-editor');
const { DropZone, DragHandle, dropIndex } = require('../src-admin/shoppingroute-admin-ui');
const initial = () => ({ lists: [{ name: 'SHOP', enabled: true }], markets: [{ name: 'ALDI', enabled: true }, { name: 'LIDL', enabled: true }], productGroups: [{ name: 'A' }, { name: 'B' }, { name: 'C' }], products: [{ name: 'Milk', category: 'A' }], reviewItems: [], routes: ['A', 'B', 'C'].map((category, i) => ({ market: 'ALDI', category, order: (i + 1) * 10 })) });
const flush = () => new Promise(resolve => setTimeout(resolve, 15));
function stateful(instance) {
    instance.setState = (patch, done) => { instance.state = { ...instance.state, ...(typeof patch === 'function' ? patch(instance.state) : patch) }; done?.(); };
    return instance;
}
function nodes(tree) { return !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)]; }
function runtime() {
    const file = path.join(__dirname, '../build/main.js');
    const nativeRequire = createRequire(file), container = { exports: {} };
    class Adapter {
        constructor() { this.config = initial(); this.namespace = 'shoppingroute.0'; this.states = new Map(); this.log = { warn() {}, error() {}, info() {}, debug() {} }; }
        on() {}
        async setStateAsync(id, value) { this.states.set(id, { val: value }); }
        async getStateAsync(id) { return this.states.get(id); }
        subscribeForeignStates() {}
        async setForeignObjectAsync() { throw Error('A runtime catalogue write must never change the instance object'); }
    }
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), { module: container, exports: container.exports, require: name => name === '@iobroker/adapter-core' ? { Adapter } : nativeRequire(name), console }, { filename: file });
    const adapter = container.exports();
    adapter.updateTemporaryMarketStateOptions = async () => {};
    adapter.refreshExports = async () => {};
    adapter.scheduleAll = () => {};
    return adapter;
}

test('local edits save through the actual backend without Amazon or instance-object writes', async () => {
    const adapter = runtime();
    adapter.initializeDirectClient = async () => { throw Error('Amazon is offline'); };
    const data = initial(); data.productGroups.reverse();
    const result = await adapter.applyManagedConfig(data);
    assert.deepEqual(Array.from(result.data.productGroups, x => x.name), ['C', 'B', 'A']);
    const stored = JSON.parse(adapter.states.get('data.managedConfig').val);
    assert.deepEqual(stored.data.productGroups.map(x => x.name), ['C', 'B', 'A']);
    assert.ok(adapter.states.get('info.configBackup'));
    adapter.productsDirty = true; adapter.runtimeProducts = [{ name: 'Learned product', category: 'B' }];
    await adapter.persistRuntimeConfig();
    assert.equal(JSON.parse(adapter.states.get('data.managedConfig').val).data.products[0].name, 'Learned product');
    assert.equal(adapter.productsDirty, false);
});

test('new Alexa bindings are still validated and rejected without changing the saved catalogue', async () => {
    const adapter = runtime(); let remoteChecks = 0;
    adapter.initializeDirectClient = async () => { remoteChecks++; };
    adapter.refreshDirectListIds = async () => {};
    const data = initial(); data.lists.push({ name: 'Missing', enabled: true });
    await assert.rejects(adapter.applyManagedConfig(data), /does not exist/);
    assert.equal(remoteChecks, 1);
    assert.equal(adapter.states.has('data.managedConfig'), false);
    assert.equal(adapter.config.lists.length, 1);
});

test('failed persistent writes do not activate an unsaved catalogue in memory', async () => {
    const adapter = runtime(), data = initial();
    data.productGroups.reverse();
    adapter.setStateAsync = async () => { throw Error('Disk unavailable'); };
    await assert.rejects(adapter.applyManagedConfig(data), /Disk unavailable/);
    assert.deepEqual(Array.from(adapter.config.productGroups, group => group.name), ['A', 'B', 'C']);
});

test('rapid structural saves queue once, preserve latest edits and survive backend readback', async () => {
    const adapter = runtime(); let release, calls = 0;
    adapter.initializeDirectClient = async () => { throw Error('No Amazon call for local edits'); };
    const manager = stateful(new CatalogManager({ socket: { sendTo: async (_id, command, message) => {
        if (command === 'getManagedConfig') return { ok: true, data: JSON.parse(adapter.states.get('data.managedConfig').val).data };
        calls++; if (calls === 1) await new Promise(resolve => { release = resolve; });
        return { ok: true, ...await adapter.applyManagedConfig(message.data) };
    } } }));
    manager.state = { ...manager.state, loading: false, data: initial(), base: initial() };
    manager.del('productGroups', 0); await flush();
    manager.del('productGroups', 0); await flush();
    release(); await flush(); await flush();
    assert.equal(calls, 2);
    assert.equal(manager.state.error, '');
    assert.equal(manager.changed(), false);
    await manager.load();
    assert.deepEqual(manager.state.data.productGroups.map(x => x.name), ['C']);
    manager.componentWillUnmount();
});

test('typing waits for the save button; failed saves retain edits without an automatic retry loop', async () => {
    let calls = 0;
    const manager = stateful(new CatalogManager({ socket: { sendTo: async () => { calls++; return { ok: false, error: 'disk unavailable' }; } } }));
    manager.state = { ...manager.state, loading: false, data: initial(), base: initial() };
    manager.edit('products', 0, { name: 'Milk and bread' }); await flush();
    assert.equal(calls, 0);
    await manager.save(); await flush();
    assert.equal(calls, 1);
    assert.equal(manager.state.data.products[0].name, 'Milk and bread');
    assert.equal(manager.changed(), true);
    assert.equal(manager.state.error, 'disk unavailable');
    manager.componentWillUnmount();
});

test('route, group and market end-drop targets move to the end and back', () => {
    for (const [Editor, key, scope] of [[MarketsEditor, 'markets', 'markets'], [ProductGroupsEditor, 'productGroups', 'groups'], [RouteEditor, 'routes', 'routes']]) {
        let data = initial();
        const editor = stateful(new Editor({ data, onChange: next => { data = next; editor.props = { ...editor.props, data }; } }));
        const zone = nodes(editor.render()).find(node => node.type === DropZone && node.props.scope === scope);
        assert.ok(zone, key);
        editor.state.dragIndex = 0; zone.props.onDrop();
        if (key === 'routes') assert.equal(RouteEditorModel.marketRoutes(data.routes, 'ALDI').at(-1).category, 'A');
        else assert.equal(data[key].at(-1).name, key === 'markets' ? 'ALDI' : 'A');
        if (key === 'markets') assert.deepEqual(data.markets.map(x => x.order), [10, 20]);
        editor.state.dragIndex = data[key].length - 1; editor.drop(0);
        assert.equal(key === 'routes' ? RouteEditorModel.marketRoutes(data.routes, 'ALDI')[0].category : data[key][0].name, key === 'markets' ? 'ALDI' : 'A');
    }
    assert.equal(MarketsEditorModel.moveMarketTo(initial().markets, 0, 2).at(-1).name, 'ALDI');
    assert.equal(ProductGroupsEditorModel.moveProductGroupTo(initial().productGroups, 0, 3).at(-1).name, 'A');
});

test('shopping end drops include empty return markets and optimistic rendering respects positions', async () => {
    const view = { listName: 'SHOP', lists: ['SHOP'], markets: ['ALDI', 'LIDL'], items: [{ id: 'a', text: 'Milk', market: 'ALDI', position: 0 }, { id: 'b', text: 'Bread', market: 'ALDI', position: 1 }], dryRun: false };
    const editor = stateful(new ShoppingListEditor({})); editor.state = { ...editor.state, view, loading: false };
    editor.visitedMarkets.add('LIDL');
    assert.ok(nodes(editor.render()).some(node => node.props?.['data-drop-market'] === 'LIDL'));
    assert.ok(nodes(editor.render()).some(node => node.key === 'drop-end'));
    const moved = ShoppingListEditorModel.optimisticMove(view, 'a', 'ALDI', 1);
    assert.deepEqual(ShoppingListEditorModel.visibleItems(moved).map(x => x.id), ['b', 'a']);
    const calls = []; editor.move = async (...args) => calls.push(args); editor.dragItemId = 'a';
    const end = nodes(editor.render()).find(node => node.key === 'drop-end');
    end.props.onDrop({ preventDefault() {}, stopPropagation() {}, dataTransfer: { getData: () => 'a' } });
    assert.deepEqual(calls[0], ['a', 'ALDI', 1]);
});

test('touch handle sends the target market and end position instead of the original market', () => {
    const drops = [], scope = { getAttribute: () => 'shopping' }, targetMarket = { getAttribute: key => key === 'data-drop-market' ? 'LIDL' : '2' };
    const row = { getAttribute: key => key === 'data-drop-index' ? '2' : 'true', closest: key => key === '[data-sort-scope]' ? scope : targetMarket };
    const handle = new DragHandle({ scope: 'shopping', market: 'ALDI', length: 3, index: 0, onStart() {}, onDrop: (...args) => drops.push(args) });
    const handlers = handle.render().props, event = { pointerType: 'touch', pointerId: 7, clientX: 2, clientY: 3, preventDefault() {}, stopPropagation() {}, currentTarget: { ownerDocument: { elementFromPoint: () => ({ closest: () => row }) } } };
    handlers.onPointerDown(event); handlers.onPointerMove(event); handlers.onPointerUp(event);
    assert.deepEqual(drops, [[2, 'LIDL']]);
});

test('return move safely resolves a uniquely named item after Amazon changes its ID', async () => {
    const adapter = runtime(), view = { listName: 'SHOP', markets: ['ALDI', 'LIDL'], lists: ['SHOP'], items: [{ id: 'fresh-id', text: 'Milk', market: 'LIDL', position: 0 }], dryRun: false };
    adapter.config.dryRun = false;
    adapter.buildShoppingListView = async () => view;
    adapter.prepareImmediateApply = () => {};
    adapter.startApply = async () => {};
    const result = await adapter.applyManualMove({ listName: 'SHOP', itemId: 'stale-id', itemText: 'Milk', targetMarket: 'ALDI', targetPosition: 0 });
    assert.equal(result.ok, true, result.error);
    assert.equal(adapter.manualOverrides[0].itemId, 'fresh-id');
    assert.equal(adapter.manualOverrides[0].market, 'ALDI');
    view.items.push({ id: 'duplicate', text: 'Milk', market: 'LIDL', position: 1 });
    const rejected = await adapter.applyManualMove({ listName: 'SHOP', itemId: 'stale-id', itemText: 'Milk', targetMarket: 'ALDI', targetPosition: 0 });
    assert.equal(rejected.ok, false);
});

test('cross-market insertion keeps the selected slot; own-market insertion adjusts for removal', () => {
    const event = { currentTarget: { getBoundingClientRect: () => ({ top: 0, height: 100 }) }, clientY: 80 };
    assert.equal(dropIndex(event, 1, -1, 4), 2);
    assert.equal(dropIndex(event, 1, 0, 3), 1);
});
