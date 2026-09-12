'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ShoppingListEditor } = require('../src-admin/shopping-list-editor');
const view = { listName: 'SHOP', lists: ['SHOP'], markets: ['REWE'], items: [{ id: 'gum', text: 'Weckgummis', market: 'REWE', position: 0 }], dryRun: false };
function editor(send) {
    const instance = new ShoppingListEditor({ socket: { sendTo: async (_instance, command, message) => send(command, message) } });
    instance.setState = patch => { instance.state = { ...instance.state, ...patch }; };
    return instance;
}
function nodes(tree) { return !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)]; }

test('missing lists in a successful-looking load does not crash the editor', async () => {
    const instance = editor(() => ({ markets: ['REWE'], items: [] }));
    await instance.load();
    assert.doesNotThrow(() => instance.render());
    assert.ok(instance.state.error, 'invalid responses must not be silently shown as an empty list');
    assert.equal(instance.state.view, null);
    assert.ok(nodes(instance.render()).some(n => n.key === 'retry'));
});

test('malformed load responses display an error and allow a real reload', async () => {
    const badResponses = [undefined, null, true, 'permissionError', {}, { ...view, lists: undefined }, { ...view, markets: undefined }, { ...view, items: undefined }, { ...view, items: [null] }, { ...view, markets: [null] }, { ...view, lists: 'SHOP' }];
    for (const bad of badResponses) {
        let response = bad;
        const instance = editor(() => response);
        await instance.load();
        assert.doesNotThrow(() => instance.render());
        assert.ok(instance.state.error, JSON.stringify(bad));
        assert.equal(instance.state.view, null);
        const retry = nodes(instance.render()).find(n => n.key === 'retry');
        assert.ok(retry);
        response = view;
        await retry.props.onClick();
        assert.equal(instance.state.error, '');
        assert.deepEqual(instance.state.view, view);
        assert.equal(nodes(instance.render()).filter(n => n.props?.className === 'shoppingroute-item-row').length, 1);
    }
});

test('malformed mutation views never replace the last usable view', async () => {
    for (const command of ['moveShoppingItem', 'deleteShoppingItem', 'clearManualShoppingOrder']) {
        const instance = editor(name => name === 'getShoppingList' ? view : { ok: true, view: { items: [] } });
        await instance.load();
        if (command === 'moveShoppingItem') await instance.move('gum', 'REWE', 0);
        else if (command === 'deleteShoppingItem') await instance.remove('gum');
        else await instance.clearManual();
        assert.ok(instance.state.error, command);
        assert.deepEqual(instance.state.view, view);
        assert.doesNotThrow(() => instance.render());
        assert.equal(instance.commandPending, false);
    }
});

test('failed refresh preserves the existing list and its visible error', async () => {
    let response = view;
    const instance = editor(() => response);
    await instance.load();
    response = { error: 'Amazon unavailable' };
    await instance.load();
    assert.deepEqual(instance.state.view, view);
    assert.equal(instance.state.error, 'Amazon unavailable');
    assert.doesNotThrow(() => instance.render());
});

test('render is defensive even if a stale invalid view is already in component state', () => {
    const instance = editor(() => view);
    instance.state = { ...instance.state, loading: false, view: {} };
    assert.doesNotThrow(() => instance.render());
    assert.ok(nodes(instance.render()).some(n => n.key === 'retry'));
});
