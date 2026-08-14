'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const customOutput = path.join(root, 'admin', 'custom');
const federationTemp = path.join(root, '.__mf__temp');
const viteCli = path.join(path.dirname(require.resolve('vite/package.json')), 'bin', 'vite.js');

const builds = [
    {
        config: undefined,
        directory: '',
        name: 'ShoppingRouteAdminSet',
        remoteEntry: 'routeEditor.js',
    },
    {
        config: 'vite.product-groups.config.mjs',
        directory: 'productGroups',
        name: 'ShoppingRouteProductGroupsSet',
        remoteEntry: 'productGroupsEditor.js',
    },
    {
        config: 'vite.markets.config.mjs',
        directory: 'markets',
        name: 'ShoppingRouteMarketsSet',
        remoteEntry: 'marketsEditor.js',
    },
];

function cleanAdminOutput(directory = customOutput) {
    fs.rmSync(directory, { recursive: true, force: true });
}

function cleanFederationTemp(directory = federationTemp) {
    fs.rmSync(directory, { recursive: true, force: true });
}

function removeViteMetadata(directory = customOutput) {
    if (!fs.existsSync(directory)) return;

    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;

        const target = path.join(directory, entry.name);
        if (entry.name === '.vite') {
            fs.rmSync(target, { recursive: true, force: true });
        } else {
            removeViteMetadata(target);
        }
    }
}

function verifyBuildOutputs(directory = customOutput) {
    for (const build of builds) {
        const outputDirectory = path.join(directory, build.directory);
        const manifestPath = path.join(outputDirectory, 'mf-manifest.json');
        const remoteEntryPath = path.join(outputDirectory, build.remoteEntry);

        if (!fs.existsSync(manifestPath) || !fs.existsSync(remoteEntryPath)) {
            throw new Error(`Missing Module Federation output for ${build.name}`);
        }

        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        if (manifest.name !== build.name || manifest.metaData?.remoteEntry?.name !== build.remoteEntry) {
            throw new Error(`Unexpected Module Federation manifest for ${build.name}`);
        }
        if (manifest.shared?.some(dependency => dependency.name === '@iobroker/adapter-react-v5')) {
            throw new Error(`Generation 1 GUI dependency found in manifest for ${build.name}`);
        }
    }
}

function buildAdmin() {
    cleanAdminOutput();
    cleanFederationTemp();

    for (const build of builds) {
        const args = [viteCli, 'build'];
        if (build.config) args.push('--config', build.config);

        const result = spawnSync(process.execPath, args, {
            cwd: root,
            stdio: 'inherit',
            shell: false,
        });
        if (result.status !== 0) {
            throw new Error(`Vite build failed for ${build.name}${result.signal ? ` (${result.signal})` : ''}`);
        }
    }

    removeViteMetadata();
    cleanFederationTemp();
    verifyBuildOutputs();
}

if (require.main === module) buildAdmin();

module.exports = {
    builds,
    cleanAdminOutput,
    cleanFederationTemp,
    removeViteMetadata,
    verifyBuildOutputs,
};
