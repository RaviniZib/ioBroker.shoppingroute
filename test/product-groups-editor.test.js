'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  Components: { ProductGroupsEditor },
  ProductGroupsEditorModel: model,
} = require('../src-admin/product-groups-editor');

const existing = [
  { name: 'Brot/Gebäck' },
  { name: 'Obst/Gemüse' },
  { name: 'Milchprodukte' },
];

test('product group editor loads existing productGroups without changing their order', () => {
  assert.deepEqual(model.productGroupRows(existing), existing);
});

test('product group editor adds a product group at the end using the unchanged structure', () => {
  const result = model.addProductGroup(existing, 'Getränke');

  assert.deepEqual(result, [...existing, { name: 'Getränke' }]);
  assert.deepEqual(Object.keys(result.at(-1)), ['name']);
});

test('product group editor edits only the selected product group', () => {
  const result = model.editProductGroup(existing, 1, 'Frisches Obst und Gemüse');

  assert.deepEqual(result, [
    { name: 'Brot/Gebäck' },
    { name: 'Frisches Obst und Gemüse' },
    { name: 'Milchprodukte' },
  ]);
});

test('product group editor deletes only the selected product group', () => {
  assert.deepEqual(model.removeProductGroup(existing, 1), [
    { name: 'Brot/Gebäck' },
    { name: 'Milchprodukte' },
  ]);
});

test('product group editor preserves and explicitly changes row order without sorting', () => {
  const moved = model.moveProductGroup(existing, 2, -1);

  assert.deepEqual(moved.map(group => group.name), ['Brot/Gebäck', 'Milchprodukte', 'Obst/Gemüse']);
  assert.deepEqual(model.editProductGroup(moved, 1, 'Molkerei').map(group => group.name), [
    'Brot/Gebäck',
    'Molkerei',
    'Obst/Gemüse',
  ]);
});

test('all product group operations leave their source data untouched', () => {
  const source = structuredClone(existing);

  model.addProductGroup(source, 'Getränke');
  model.editProductGroup(source, 0, 'Backwaren');
  model.removeProductGroup(source, 1);
  model.moveProductGroup(source, 1, -1);

  assert.deepEqual(source, existing);
});

test('saving and discarding use only the normal ioBroker Admin draft', () => {
  const persisted = { productGroups: structuredClone(existing), dryRun: true };
  const calls = [];
  const editor = new ProductGroupsEditor({
    data: persisted,
    onChange: (draft, changed) => calls.push({ draft, changed }),
  });
  const editedGroups = model.editProductGroup(persisted.productGroups, 0, 'Backwaren');

  editor.updateProductGroups(editedGroups);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].changed, true);
  assert.deepEqual(calls[0].draft, { productGroups: editedGroups, dryRun: true });
  assert.notEqual(calls[0].draft, persisted);
  assert.deepEqual(persisted.productGroups, existing, 'discard keeps persisted data');
  assert.deepEqual(model.productGroupRows(calls[0].draft.productGroups), editedGroups, 'save reloads the draft');

  const source = readFileSync(join(__dirname, '..', 'src-admin', 'product-groups-editor.js'), 'utf8');
  assert.doesNotMatch(source, /setObject|extendObject|setStateAsync|sendTo|socket\./);
});

test('delivered product group editor satisfies the ioBroker module federation contract', () => {
  const customDir = join(__dirname, '..', 'admin', 'custom', 'productGroups');
  const manifest = JSON.parse(readFileSync(join(customDir, 'mf-manifest.json'), 'utf8'));
  const exposedComponents = manifest.exposes.find(expose => expose.path === './Components');

  assert.equal(manifest.metaData.remoteEntry.name, 'productGroupsEditor.js');
  assert.equal(manifest.metaData.remoteEntry.type, 'module');
  assert.equal(exposedComponents && exposedComponents.name, 'Components');

  const temporaryRoot = mkdtempSync(join(tmpdir(), 'shoppingroute-product-groups-editor-'));
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
      const remote = await import('./productGroupsEditor.js');
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
      components: ['ProductGroupsEditor'],
    });
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('walking route editor source and delivered entry remain file-identical', () => {
  const root = join(__dirname, '..');
  const hashes = {
    'src-admin/route-editor.js': 'be2781669e027154839bd60b56f4f9a9c9d524e8d02862b7da4453bddc56e58e',
    'src-admin/route-editor-components.mjs': 'f0fe127c17f646ccecb87905cb27fe818a91883a49bbd55858beb20cfef970fa',
    'admin/custom/routeEditor.js': '98477502048d3f303385e546e5a61577665a6b594fae9e31fb67c789323f3249',
    'admin/custom/mf-manifest.json': 'f8c3a08f9ed24d0b37c937e21836bc215c316e11399696181c8c3121150a360b',
  };

  for (const [file, expected] of Object.entries(hashes)) {
    const content = readFileSync(join(root, file), 'utf8').replace(/\r\n?/g, '\n');
    const actual = crypto.createHash('sha256').update(content).digest('hex');
    assert.equal(actual, expected, file);
  }
});
