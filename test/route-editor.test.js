'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const { RouteEditorModel: model } = require('../src-admin/route-editor');

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

test('delivered route editor satisfies the ioBroker module federation contract', () => {
  const customDir = join(__dirname, '..', 'admin', 'custom');
  const manifest = JSON.parse(readFileSync(join(customDir, 'mf-manifest.json'), 'utf8'));
  const exposedComponents = manifest.exposes.find(expose => expose.path === './Components');
  const jsonConfig = JSON.parse(readFileSync(join(__dirname, '..', 'admin', 'jsonConfig.json'), 'utf8'));
  const editorConfig = jsonConfig.items.routesTab.items.routeEditor;

  assert.equal(manifest.metaData.remoteEntry.name, 'routeEditor.js');
  assert.equal(manifest.metaData.remoteEntry.type, 'module');
  assert.equal(exposedComponents && exposedComponents.name, 'Components');
  assert.equal(editorConfig.bundlerType, 'module');
  assert.equal(editorConfig.name, 'ShoppingRouteAdminSet/Components/RouteEditor');

  const temporaryRoot = mkdtempSync(join(tmpdir(), 'shoppingroute-route-editor-'));
  const temporaryCustomDir = join(temporaryRoot, 'custom');
  try {
    cpSync(customDir, temporaryCustomDir, { recursive: true });
    writeFileSync(join(temporaryCustomDir, 'package.json'), '{"type":"module"}\n');
    const loaderProbe = `
      globalThis.window = globalThis;
      globalThis.document = {
        defaultView: globalThis,
        getElementsByTagName: () => [],
        querySelector: () => null,
        createElement: () => ({ setAttribute() {}, addEventListener() {} }),
        head: { appendChild() {} },
      };
      globalThis.dispatchEvent = () => true;
      globalThis.Event = class {
        constructor(type, options) {
          this.type = type;
          this.defaultPrevented = false;
          Object.assign(this, options);
        }
      };
      const remote = await import('./routeEditor.js');
      await remote.init({});
      const factory = await remote.get('./Components');
      const exposed = factory();
      console.log(JSON.stringify({
        exports: Object.keys(remote).sort(),
        module: Object.keys(exposed).sort(),
        components: Object.keys(exposed.default || {}).sort(),
      }));
    `;
    const probe = spawnSync(process.execPath, ['--input-type=module', '--eval', loaderProbe], {
      cwd: temporaryCustomDir,
      encoding: 'utf8',
    });

    assert.equal(probe.status, 0, probe.stderr);
    assert.deepEqual(JSON.parse(probe.stdout.trim()), {
      exports: ['get', 'init'],
      module: ['default'],
      components: ['RouteEditor'],
    });
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

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
