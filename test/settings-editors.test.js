'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

test('shared settings bundle exposes all migrated custom editors via module federation', () => {
  const customDir = join(__dirname, '..', 'admin', 'custom', 'settings');
  const manifest = JSON.parse(readFileSync(join(customDir, 'mf-manifest.json'), 'utf8'));
  const exposedComponents = manifest.exposes.find(expose => expose.path === './Components');

  assert.equal(manifest.metaData.remoteEntry.name, 'settingsEditors.js');
  assert.equal(manifest.metaData.remoteEntry.type, 'module');
  assert.equal(exposedComponents && exposedComponents.name, 'Components');

  const temporaryRoot = mkdtempSync(join(tmpdir(), 'shoppingroute-settings-editors-'));
  const temporaryCustomDir = join(temporaryRoot, 'custom');
  try {
    cpSync(customDir, temporaryCustomDir, { recursive: true });
    writeFileSync(join(temporaryCustomDir, 'package.json'), '{"type":"module"}\n');
    const loaderProbe = `
      globalThis.window = globalThis;
      globalThis.location = { origin: 'http://127.0.0.1:8081', search: '' };
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
      const remote = await import('./settingsEditors.js');
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
      components: ['GeneralEditor', 'ListsEditor', 'ProductsEditor', 'ReviewEditor', 'TransferEditor'],
    });
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
