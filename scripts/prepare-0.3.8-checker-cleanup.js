'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, content) => fs.writeFileSync(path.join(root, file), content);

// Keep only the seven newest news entries, matching the current repository builder limit.
{
    const file = 'io-package.json';
    const ioPackage = JSON.parse(read(file));
    const news = ioPackage.common?.news || {};
    const entries = Object.entries(news);
    ioPackage.common.news = Object.fromEntries(entries.slice(0, 7));
    write(file, `${JSON.stringify(ioPackage, null, 2)}\n`);
}

// Adopt the current ioBroker testing package requested by repochecker.
{
    const file = 'package.json';
    const pkg = JSON.parse(read(file));
    pkg.devDependencies['@iobroker/testing'] = '^6.1.0';
    write(file, `${JSON.stringify(pkg, null, 2)}\n`);
}

// Adopt current check action and recommended Node matrix, including Node 26.
{
    const file = '.github/workflows/test-and-release.yml';
    let source = read(file);
    if (!source.includes('ioBroker/testing-action-check@v1')) {
        throw new Error('Expected testing-action-check@v1 anchor missing');
    }
    if (!source.includes('node-version: [22.x, 24.x]')) {
        throw new Error('Expected Node matrix anchor missing');
    }
    source = source.replace('ioBroker/testing-action-check@v1', 'ioBroker/testing-action-check@v2');
    source = source.replace('node-version: [22.x, 24.x]', 'node-version: [22.x, 24.x, 26.x]');
    write(file, source);
}

console.log('Current repository checker requirements prepared.');
