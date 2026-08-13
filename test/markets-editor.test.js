'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  Components: { MarketsEditor },
  MarketsEditorModel: model,
} = require('../src-admin/markets-editor');

const existing = [
  { enabled: true, order: 10, name: 'ALDI', aliases: 'Aldi,Aldi Nord' },
  { enabled: true, order: 20, name: 'LIDL', aliases: 'Lidl' },
  { enabled: false, order: 30, name: 'BAUMARKT', aliases: 'Obi,Toom' },
];

test('markets editor loads existing markets without changing their order or fields', () => {
  assert.deepEqual(model.marketRows(existing), existing);
});

test('markets editor edits market name, order, enabled state and aliases', () => {
  const renamed = model.editMarket(existing, 1, { name: 'LIDL CITY' });
  const reordered = model.editMarket(renamed, 1, { order: 15 });
  const disabled = model.editMarket(reordered, 0, { enabled: false });
  const realiased = model.editMarket(disabled, 2, { aliases: 'OBI, Toom Baumarkt' });

  assert.deepEqual(realiased, [
    { enabled: false, order: 10, name: 'ALDI', aliases: 'Aldi,Aldi Nord' },
    { enabled: true, order: 15, name: 'LIDL CITY', aliases: 'Lidl' },
    { enabled: false, order: 30, name: 'BAUMARKT', aliases: 'OBI, Toom Baumarkt' },
  ]);
});

test('markets editor adds a market with the unchanged data structure', () => {
  const result = model.addMarket(existing, 'REWE');

  assert.deepEqual(result.at(-1), { enabled: true, order: 40, name: 'REWE', aliases: '' });
  assert.deepEqual(Object.keys(result.at(-1)), ['enabled', 'order', 'name', 'aliases']);
});

test('markets editor ignores blank market additions', () => {
  assert.deepEqual(model.addMarket(existing, '   '), existing);
});

test('markets editor deletes only the selected market', () => {
  assert.deepEqual(model.removeMarket(existing, 1), [
    { enabled: true, order: 10, name: 'ALDI', aliases: 'Aldi,Aldi Nord' },
    { enabled: false, order: 30, name: 'BAUMARKT', aliases: 'Obi,Toom' },
  ]);
});

test('markets editor changes row order without sorting or rewriting order values', () => {
  const moved = model.moveMarket(existing, 2, -1);

  assert.deepEqual(moved.map(market => market.name), ['ALDI', 'BAUMARKT', 'LIDL']);
  assert.deepEqual(moved.map(market => market.order), [10, 30, 20]);
});

test('all market operations leave source data, productGroups and routes untouched', () => {
  const source = {
    markets: structuredClone(existing),
    productGroups: [{ name: 'Milchprodukte' }],
    routes: [{ market: 'ALDI', category: 'Milchprodukte', order: 10 }],
  };
  const expected = structuredClone(source);

  model.addMarket(source.markets, 'REWE');
  model.editMarket(source.markets, 0, { name: 'ALDI NORD' });
  model.removeMarket(source.markets, 1);
  model.moveMarket(source.markets, 1, -1);

  assert.deepEqual(source, expected);
});

test('saving and discarding markets use only the normal ioBroker Admin draft', () => {
  const persisted = {
    markets: structuredClone(existing),
    productGroups: [{ name: 'Milchprodukte' }],
    routes: [{ market: 'ALDI', category: 'Milchprodukte', order: 10 }],
    dryRun: true,
  };
  const calls = [];
  const editor = new MarketsEditor({
    data: persisted,
    onChange: (draft, changed) => calls.push({ draft, changed }),
  });
  const editedMarkets = model.editMarket(persisted.markets, 0, { aliases: 'Aldi Süd' });

  editor.updateMarkets(editedMarkets);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].changed, true);
  assert.deepEqual(calls[0].draft, {
    markets: editedMarkets,
    productGroups: persisted.productGroups,
    routes: persisted.routes,
    dryRun: true,
  });
  assert.notEqual(calls[0].draft, persisted);
  assert.deepEqual(persisted.markets, existing, 'discard keeps persisted markets');
  assert.deepEqual(model.marketRows(calls[0].draft.markets), editedMarkets, 'save reloads the draft');

  const source = readFileSync(join(__dirname, '..', 'src-admin', 'markets-editor.js'), 'utf8');
  assert.doesNotMatch(source, /setObject|extendObject|setStateAsync|sendTo|socket\./);
});

test('delivered markets editor satisfies the ioBroker module federation contract', () => {
  const customDir = join(__dirname, '..', 'admin', 'custom', 'markets');
  const manifest = JSON.parse(readFileSync(join(customDir, 'mf-manifest.json'), 'utf8'));
  const exposedComponents = manifest.exposes.find(expose => expose.path === './Components');

  assert.equal(manifest.metaData.remoteEntry.name, 'marketsEditor.js');
  assert.equal(manifest.metaData.remoteEntry.type, 'module');
  assert.equal(exposedComponents && exposedComponents.name, 'Components');

  const temporaryRoot = mkdtempSync(join(tmpdir(), 'shoppingroute-markets-editor-'));
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
      const remote = await import('./marketsEditor.js');
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
      components: ['MarketsEditor'],
    });
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
