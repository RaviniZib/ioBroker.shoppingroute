'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ShoppingListEditorModel: model } = require('../src-admin/shopping-list-editor');

test('shopping list display strips nested internal prefixes', () => {
    assert.equal(model.stripVisiblePrefix('14> 25> Weggummis'), 'Weggummis');
    assert.equal(model.stripVisiblePrefix('[14] 25> Veganes Hack'), 'Veganes Hack');
});

test('legacy short market headers never appear as shopping items', () => {
    const view = {
        markets: ['LIDL', 'REWE'],
        items: [
            { id: 'h', text: '14> — LIDL —', market: 'LIDL' },
            { id: 'a', text: '20> Weggummis', market: 'LIDL' },
        ],
    };
    assert.equal(model.headerMarket('14> — LIDL —', view.markets), 'LIDL');
    assert.deepEqual(model.visibleItems(view).map(item => item.text), ['Weggummis']);
});

test('structural market headers never appear when their label is misspelled or unknown', () => {
    const view = {
        markets: ['LIDL', 'REWE'],
        items: [
            { id: 'h', text: '15> ═════ DROGERIEMART ═════', market: 'LIDL' },
            { id: 'a', text: '20> Veganes Hack', market: 'REWE' },
        ],
    };
    assert.equal(model.headerMarket('15> ═════ DROGERIEMART ═════', view.markets), 'DROGERIEMART');
    assert.deepEqual(model.visibleItems(view).map(item => item.text), ['Veganes Hack']);
});

function listView(items) {
    return { listName: 'SHOP', lists: ['SHOP'], markets: ['ALDI', 'LIDL'], items, dryRun: false };
}

test('stored draft cannot resurrect checked-off Alexa items', () => {
    const fresh = listView([{ id: 'baby', text: 'Babybrei', market: 'LIDL', position: 0 }]);
    const old = [
        { itemId: 'schnitzel', itemText: 'XXL Riesenschnitzel', targetMarket: 'ALDI', targetPosition: 0 },
    ];
    const result = model.reconcileSavedMoves(fresh, old);
    assert.deepEqual(result.view.items.map(item => item.text), ['Babybrei']);
    assert.deepEqual(result.moves, []);
    assert.equal(result.dropped, 1);
});

test('valid offline move is rebased onto fresh Alexa data without losing new items', () => {
    const fresh = listView([
        { id: 'baby', text: 'Babybrei', market: 'LIDL', position: 0 },
        { id: 'milk', text: 'Milch', market: 'LIDL', position: 1 },
    ]);
    const result = model.reconcileSavedMoves(fresh, [
        { itemId: 'baby', itemText: 'Babybrei', targetMarket: 'ALDI', targetPosition: 0 },
        { itemId: 'old', itemText: 'Alt', targetMarket: 'ALDI', targetPosition: 1 },
    ]);
    assert.equal(result.dropped, 1);
    assert.deepEqual(result.view.items.map(item => [item.id, item.market]), [
        ['baby', 'ALDI'],
        ['milk', 'LIDL'],
    ]);
    assert.deepEqual(result.moves.map(move => move.itemId), ['baby']);
});

test('renamed items and missing markets cannot reuse stale draft commands', () => {
    const fresh = listView([{ id: 'a', text: 'Neuer Artikel', market: 'LIDL', position: 0 }]);
    const result = model.reconcileSavedMoves(fresh, [
        { itemId: 'a', itemText: 'Alter Artikel', targetMarket: 'ALDI', targetPosition: 0 },
        { itemId: 'a', itemText: 'Neuer Artikel', targetMarket: 'ENTFERNT', targetPosition: 0 },
    ]);
    assert.equal(result.dropped, 2);
    assert.deepEqual(result.view.items, fresh.items);
});

test('load always displays confirmed Alexa snapshot instead of persisted old view', async () => {
    const { ShoppingListEditor } = require('../src-admin/shopping-list-editor');
    const key = 'shoppingroute.0.shoppingDraft.SHOP';
    const stored = new Map([[key, JSON.stringify({
        view: listView([{ id: 'old', text: 'XXL Riesenschnitzel', market: 'ALDI', position: 0 }]),
        moves: [{ itemId: 'old', itemText: 'XXL Riesenschnitzel', targetMarket: 'LIDL', targetPosition: 0 }],
    })]]);
    const originalStorage = globalThis.sessionStorage;
    globalThis.sessionStorage = {
        getItem: name => stored.get(name) || null,
        setItem: (name, value) => stored.set(name, value),
        removeItem: name => stored.delete(name),
    };
    try {
        const editor = new ShoppingListEditor({
            adapterName: 'shoppingroute',
            instance: 0,
            socket: { sendTo: async () => listView([
                { id: 'baby', text: 'Babybrei', market: 'LIDL', position: 0 },
            ]) },
        });
        editor.setState = patch => Object.assign(editor.state, patch);
        await editor.load('SHOP');
        assert.deepEqual(editor.state.view.items.map(item => item.text), ['Babybrei']);
        assert.equal(editor.draftMoves.length, 0);
        assert.equal(editor.draftView, null);
        assert.equal(stored.has(key), false);
    } finally {
        globalThis.sessionStorage = originalStorage;
    }
});

test('failed fresh load hides old list instead of showing stale items as current', async () => {
    const { ShoppingListEditor } = require('../src-admin/shopping-list-editor');
    const editor = new ShoppingListEditor({
        socket: { sendTo: async () => { throw new Error('Amazon unavailable'); } },
    });
    editor.setState = patch => Object.assign(editor.state, patch);
    editor.state.view = listView([{ id: 'old', text: 'Alt', market: 'ALDI', position: 0 }]);
    await editor.load('SHOP');
    assert.equal(editor.state.view, null);
    assert.match(editor.state.error, /Amazon unavailable/);
});
