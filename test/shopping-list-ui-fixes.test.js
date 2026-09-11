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
