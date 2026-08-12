'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const {
  Components: { ProductsEditor },
  ProductsEditorModel: model,
} = require('../src-admin/products-editor');

const existing = [
  { name: 'Milch', aliases: 'Vollmilch', category: 'Milchprodukte', defaultMarket: 'ALDI', availableMarkets: 'ALDI,LIDL' },
  { name: 'Hammer', aliases: '', category: 'Werkzeug', defaultMarket: 'BAUMARKT', availableMarkets: 'BAUMARKT' },
];

test('products editor loads existing products without changing their stored structure', () => {
  assert.deepEqual(model.productRows(existing), existing);
});

test('products editor adds, edits, removes and reorders products immutably', () => {
  const added = model.addProduct(existing);
  assert.deepEqual(added.at(-1), { name: '', aliases: '', category: '', defaultMarket: '', availableMarkets: '' });

  const edited = model.editProduct(added, 2, {
    name: 'Brot',
    aliases: 'Backwaren',
    category: 'Brot/Gebäck',
    defaultMarket: 'LIDL',
    availableMarkets: 'LIDL,ALDI',
  });
  assert.equal(edited.at(-1).name, 'Brot');

  const moved = model.moveProduct(edited, 2, -2);
  assert.deepEqual(moved.map(product => product.name), ['Brot', 'Hammer', 'Milch']);

  const removed = model.removeProduct(moved, 0);
  assert.deepEqual(removed, [
    { name: 'Hammer', aliases: '', category: 'Werkzeug', defaultMarket: 'BAUMARKT', availableMarkets: 'BAUMARKT' },
    { name: 'Milch', aliases: 'Vollmilch', category: 'Milchprodukte', defaultMarket: 'ALDI', availableMarkets: 'ALDI,LIDL' },
  ]);
  assert.deepEqual(existing[0].availableMarkets, 'ALDI,LIDL');
});

test('products editor writes only through the normal admin draft object', () => {
  const persisted = {
    products: structuredClone(existing),
    productGroups: [{ name: 'Milchprodukte' }, { name: 'Werkzeug' }],
    markets: [{ enabled: true, order: 10, name: 'ALDI', aliases: '' }],
    routes: [{ market: 'ALDI', category: 'Milchprodukte', order: 10 }],
  };
  const calls = [];
  const editor = new ProductsEditor({
    data: persisted,
    onChange: (draft, changed) => calls.push({ draft, changed }),
  });

  editor.updateProducts(model.editProduct(persisted.products, 0, { aliases: 'H-Milch' }));

  assert.equal(calls.length, 1);
  assert.equal(calls[0].changed, true);
  assert.equal(calls[0].draft.products[0].aliases, 'H-Milch');
  assert.deepEqual(calls[0].draft.productGroups, persisted.productGroups);
  assert.deepEqual(calls[0].draft.routes, persisted.routes);
  assert.deepEqual(persisted.products, existing);

  const source = readFileSync(join(__dirname, '..', 'src-admin', 'products-editor.js'), 'utf8');
  assert.doesNotMatch(source, /setObject|extendObject|setStateAsync|socket\./);
});
