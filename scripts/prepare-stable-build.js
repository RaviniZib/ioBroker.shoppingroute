'use strict';

const fs = require('node:fs');
const path = require('node:path');
const JavaScriptObfuscator = require('javascript-obfuscator');

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

for (const file of jsFiles) {
    const source = fs.readFileSync(file, 'utf8');

    const obfuscated = JavaScriptObfuscator.obfuscate(source, {
        compact: true,
        controlFlowFlattening: false,
        deadCodeInjection: false,
        debugProtection: false,
        disableConsoleOutput: false,
        identifierNamesGenerator: 'hexadecimal',
        renameGlobals: false,
        renameProperties: false,
        selfDefending: false,
        simplify: true,
        splitStrings: false,
        stringArray: true,
        stringArrayCallsTransform: false,
        stringArrayEncoding: [],
        stringArrayThreshold: 0.65,
        transformObjectKeys: false,
        unicodeEscapeSequence: false,
    }).getObfuscatedCode();

    fs.writeFileSync(file, obfuscated + '\n');
}

for (const file of mapFiles) {
    fs.rmSync(file);
}

console.log(
    `Stable build prepared: ${jsFiles.length} JavaScript files obfuscated, ${mapFiles.length} source maps removed.`,
);
