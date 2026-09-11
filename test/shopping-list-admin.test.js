'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'admin/jsonConfig.json'), 'utf8'));
const source = fs.readFileSync(path.join(root, 'src-admin/shopping-list-editor.js'), 'utf8');
const routeSource = fs.readFileSync(path.join(root, 'src-admin/route-editor.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src/main.ts'), 'utf8');

test('shopping list Admin tab uses an Admin 8 custom component and safe responsive widths', () => {
    const editor = config.items.shoppingListTab.items.shoppingListEditor;
    assert.equal(editor.guiApi, 2);
    assert.equal(editor.name, 'ShoppingRouteShoppingListSet/Components/ShoppingListEditor');
    assert.equal(editor.url, 'custom/shoppingList/shoppingListEditor.js');
    assert.equal(config.tabsStyle.width, 'calc(100% - 100px)');
    assert.match(source, /@media \(max-width: 600px\)/);
    assert.match(source, /draggable:/);
    assert.match(source, /moveShoppingItem/);
    assert.match(source, /clearManualShoppingOrder/);
});

test('route editor has a 600px mobile layout and no fixed 240px minimum control width', () => {
    assert.match(routeSource, /@media \(max-width: 600px\)/);
    assert.doesNotMatch(routeSource, /minWidth: '240px'/);
});

test('runtime exposes shopping list read, move and reset commands without browser credentials', () => {
    assert.match(main, /obj.command === 'getShoppingList'/);
    assert.match(main, /obj.command === 'moveShoppingItem'/);
    assert.match(main, /obj.command === 'clearManualShoppingOrder'/);
    assert.match(main, /info.manualOverrides/);
});
