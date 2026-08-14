'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
    builds,
    cleanAdminOutput,
    cleanFederationTemp,
    removeViteMetadata,
    verifyBuildOutputs,
} = require('../scripts/build-admin');

const root = path.join(__dirname, '..');
const jsonConfig = JSON.parse(fs.readFileSync(path.join(root, 'admin', 'jsonConfig.json'), 'utf8'));

function findCustomEntries(value, location = []) {
    if (Array.isArray(value)) {
        return value.flatMap((item, index) => findCustomEntries(item, [...location, index]));
    }
    if (!value || typeof value !== 'object') return [];

    const current = value.type === 'custom' ? [{ location, config: value }] : [];
    return current.concat(
        Object.entries(value).flatMap(([key, item]) => findCustomEntries(item, [...location, key])),
    );
}

function findViteMetadata(directory) {
    if (!fs.existsSync(directory)) return [];

    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        if (!entry.isDirectory()) return [];
        const target = path.join(directory, entry.name);
        return entry.name === '.vite' ? [target] : findViteMetadata(target);
    });
}

const customEntries = findCustomEntries(jsonConfig);

test('every jsonConfig custom component declares GUI API 2 without deprecated bundlerType', () => {
    assert.deepEqual(
        customEntries.map(entry => entry.config.url).sort(),
        [
            'custom/markets/marketsEditor.js',
            'custom/productGroups/productGroupsEditor.js',
            'custom/routeEditor.js',
        ],
    );

    for (const { location, config } of customEntries) {
        assert.equal(config.guiApi, 2, location.join('.'));
        assert.equal('bundlerType' in config, false, location.join('.'));
    }
});

test('every custom component Vite build enables a Module Federation manifest', () => {
    const configs = [
        ['vite.config.mjs', 'admin/custom'],
        ['vite.markets.config.mjs', 'admin/custom/markets'],
        ['vite.product-groups.config.mjs', 'admin/custom/productGroups'],
    ];

    for (const [file, outputDirectory] of configs) {
        const source = fs.readFileSync(path.join(root, file), 'utf8');
        assert.match(source, /federation\(\{[\s\S]*?manifest:\s*true/, file);
        assert.match(source, new RegExp(`outDir:\\s*["']${outputDirectory}["']`), file);
        assert.match(source, /emptyOutDir:\s*true/, file);
    }
});

test('every delivered custom entry has its own matching manifest beside its remote entry', () => {
    const customRoot = path.join(root, 'admin', 'custom');
    const manifests = [];

    for (const { config } of customEntries) {
        const relativeRemote = config.url.replace(/^custom\//, '');
        const outputDirectory = path.join(customRoot, path.dirname(relativeRemote));
        const remoteEntry = path.basename(relativeRemote);
        const manifestPath = path.join(outputDirectory, 'mf-manifest.json');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const federationName = config.name.split('/')[0];

        assert.ok(fs.existsSync(path.join(outputDirectory, remoteEntry)), config.url);
        assert.equal(manifest.name, federationName, manifestPath);
        assert.equal(manifest.metaData.name, federationName, manifestPath);
        assert.equal(manifest.metaData.remoteEntry.name, remoteEntry, manifestPath);
        assert.equal(manifest.metaData.remoteEntry.type, 'module', manifestPath);
        assert.ok(manifest.exposes.some(expose => expose.path === './Components'), manifestPath);
        assert.equal(
            manifest.shared.some(dependency => dependency.name === '@iobroker/adapter-react-v5'),
            false,
            manifestPath,
        );
        manifests.push(manifest.name);
    }

    assert.equal(new Set(manifests).size, customEntries.length);
    verifyBuildOutputs(customRoot);
    assert.deepEqual(findViteMetadata(customRoot), []);
    assert.equal(fs.existsSync(path.join(root, '.__mf__temp')), false);
});

test('admin build cleanup removes stale manifests and generated cache metadata before packaging', () => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'shoppingroute-admin-build-'));
    const temporaryFederation = `${temporaryRoot}-federation`;
    try {
        const nestedOutput = path.join(temporaryRoot, 'markets');
        fs.mkdirSync(path.join(nestedOutput, '.vite'), { recursive: true });
        fs.writeFileSync(path.join(temporaryRoot, 'mf-manifest.json'), '{"stale":true}\n');
        fs.writeFileSync(path.join(nestedOutput, 'mf-manifest.json'), '{"stale":true}\n');
        fs.writeFileSync(path.join(nestedOutput, '.vite', 'manifest.json'), '{}\n');

        cleanAdminOutput(temporaryRoot);
        assert.equal(fs.existsSync(temporaryRoot), false);

        fs.mkdirSync(path.join(temporaryRoot, 'productGroups', '.vite'), { recursive: true });
        fs.writeFileSync(path.join(temporaryRoot, 'productGroups', 'productGroupsEditor.js'), 'keep\n');
        fs.writeFileSync(path.join(temporaryRoot, 'productGroups', '.vite', 'manifest.json'), '{}\n');
        removeViteMetadata(temporaryRoot);

        assert.equal(fs.existsSync(path.join(temporaryRoot, 'productGroups', '.vite')), false);
        assert.equal(fs.existsSync(path.join(temporaryRoot, 'productGroups', 'productGroupsEditor.js')), true);

        fs.mkdirSync(temporaryFederation, { recursive: true });
        fs.writeFileSync(path.join(temporaryFederation, 'localSharedImportMap.js'), 'stale\n');
        cleanFederationTemp(temporaryFederation);
        assert.equal(fs.existsSync(temporaryFederation), false);
    } finally {
        fs.rmSync(temporaryRoot, { recursive: true, force: true });
        fs.rmSync(temporaryFederation, { recursive: true, force: true });
    }
});

test('the clean build covers every jsonConfig custom component exactly once', () => {
    const buildKeys = builds.map(build => `${build.name}/${build.remoteEntry}`).sort();
    const configKeys = customEntries
        .map(({ config }) => `${config.name.split('/')[0]}/${path.basename(config.url)}`)
        .sort();

    assert.deepEqual(buildKeys, configKeys);
});
