'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'test', 'product-groups-editor.test.js');
let source = fs.readFileSync(file, 'utf8');

const targets = [
    'src-admin/route-editor.js',
    'src-admin/route-editor-components.mjs',
    'admin/custom/routeEditor.js',
    'admin/custom/mf-manifest.json',
];

for (const target of targets) {
    const content = fs.readFileSync(path.join(root, target), 'utf8').replace(/\r\n?/g, '\n');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`('${escaped}':\\s*')[a-f0-9]{64}(')`);
    if (!pattern.test(source)) throw new Error(`Hash anchor missing for ${target}`);
    source = source.replace(pattern, `$1${hash}$2`);
}

fs.writeFileSync(file, source);
console.log('Updated intentional Admin build artifact hashes.');
