'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const buildDir = path.join(root, 'build');

function walk(dir) {
    const result = [];

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            result.push(...walk(full));
        } else if (entry.isFile()) {
            result.push(full);
        }
    }

    return result;
}

if (!fs.existsSync(buildDir)) {
    throw new Error('build directory does not exist');
}

const files = walk(buildDir);
const jsFiles = files.filter(file => file.endsWith('.js'));
const mapFiles = files.filter(file => file.endsWith('.map'));

if (jsFiles.length === 0) {
    throw new Error('No JavaScript files found in build directory');
}

for (const file of mapFiles) {
    fs.rmSync(file);
}

console.log(
    `Stable build prepared: ${jsFiles.length} readable JavaScript files, ${mapFiles.length} source maps removed.`,
);
