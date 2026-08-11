'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { RouteEditorModel: model } = require('../admin/custom/routeEditor');

const productGroups = [
  { name: 'Milchprodukte' },
  { name: 'Obst/Gemüse' },
  { name: 'Werkzeug' },
];

const routes = [
  { market: 'ALDI', category: 'Milchprodukte', order: 10 },
  { market: 'ALDI', category: 'Obst/Gemüse', order: 20 },
  { market: 'BAUMARKT', category: 'Milchprodukte', order: 10 },
  { market: 'BAUMARKT', category: 'Werkzeug', order: 20 },
];

const categories = (value, market) => model.marketRoutes(value, market).map(route => route.category);

test('deleting a BAUMARKT group survives save and reload without changing ALDI or productGroups', () => {
  const originalGroups = structuredClone(productGroups);
  const originalAldi = structuredClone(model.marketRoutes(routes, 'ALDI'));
  const draft = model.removeMarketRoute(routes, 'BAUMARKT', 0);
  const reloaded = structuredClone(draft);

  assert.deepEqual(categories(reloaded, 'BAUMARKT'), ['Werkzeug']);
  assert.deepEqual(model.marketRoutes(reloaded, 'ALDI'), originalAldi);
  assert.deepEqual(productGroups, originalGroups);
});

test('switching from an edited BAUMARKT draft to ALDI reads only ALDI routes', () => {
  const draft = model.removeMarketRoute(routes, 'BAUMARKT', 0);

  assert.deepEqual(categories(draft, 'BAUMARKT'), ['Werkzeug']);
  assert.deepEqual(categories(draft, 'ALDI'), ['Milchprodukte', 'Obst/Gemüse']);
  assert.deepEqual(categories(draft, 'BAUMARKT'), ['Werkzeug']);
});

test('discarding an unsaved draft leaves the persisted routes unchanged', () => {
  const persisted = structuredClone(routes);
  const draft = model.removeMarketRoute(persisted, 'BAUMARKT', 0);

  assert.deepEqual(categories(draft, 'BAUMARKT'), ['Werkzeug']);
  assert.deepEqual(categories(persisted, 'BAUMARKT'), ['Milchprodukte', 'Werkzeug']);
  assert.deepEqual(persisted, routes);
});

test('available groups exclude this market routes and re-adding changes BAUMARKT only', () => {
  const afterDelete = model.removeMarketRoute(routes, 'BAUMARKT', 0);
  const beforeAldi = structuredClone(model.marketRoutes(afterDelete, 'ALDI'));

  assert.deepEqual(
    model.availableProductGroups(productGroups, afterDelete, 'BAUMARKT'),
    ['Milchprodukte', 'Obst/Gemüse'],
  );

  const afterAdd = model.addMarketRoute(afterDelete, 'BAUMARKT', 'Milchprodukte');
  assert.deepEqual(categories(afterAdd, 'BAUMARKT'), ['Werkzeug', 'Milchprodukte']);
  assert.deepEqual(model.marketRoutes(afterAdd, 'ALDI'), beforeAldi);
  assert.deepEqual(
    model.availableProductGroups(productGroups, afterAdd, 'BAUMARKT'),
    ['Obst/Gemüse'],
  );
});

test('historical route groups outside productGroups remain visible and removable', () => {
  const withHistorical = routes.concat({ market: 'BAUMARKT', category: 'Historische Gruppe', order: 30 });

  assert.deepEqual(categories(withHistorical, 'BAUMARKT'), ['Milchprodukte', 'Werkzeug', 'Historische Gruppe']);
  assert.doesNotMatch(model.availableProductGroups(productGroups, withHistorical, 'BAUMARKT').join(','), /Historische Gruppe/);

  const removed = model.removeMarketRoute(withHistorical, 'BAUMARKT', 2);
  assert.deepEqual(categories(removed, 'BAUMARKT'), ['Milchprodukte', 'Werkzeug']);
  assert.deepEqual(categories(removed, 'ALDI'), ['Milchprodukte', 'Obst/Gemüse']);
});

test('reordering changes only the selected market and keeps source routes immutable', () => {
  const source = structuredClone(routes);
  const reordered = model.moveMarketRoute(source, 'BAUMARKT', 1, -1);

  assert.deepEqual(categories(reordered, 'BAUMARKT'), ['Werkzeug', 'Milchprodukte']);
  assert.deepEqual(categories(reordered, 'ALDI'), ['Milchprodukte', 'Obst/Gemüse']);
  assert.deepEqual(source, routes);
});
