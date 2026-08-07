'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const ioPackage = JSON.parse(fs.readFileSync(path.join(root, 'io-package.json'), 'utf8'));
const jsonConfig = JSON.parse(fs.readFileSync(path.join(root, 'admin', 'jsonConfig.json'), 'utf8'));

test('product groups are centrally configurable', () => {
    assert.equal(ioPackage.common.messagebox, true);
    assert.ok(Array.isArray(ioPackage.native.productGroups));
    assert.ok(ioPackage.native.productGroups.some(group => group.name === 'Obst/Gemüse'));
    assert.ok(ioPackage.native.productGroups.some(group => group.name === 'TK-Produkte'));
    assert.ok(jsonConfig.items.productGroupsTab);
});

test('product and walking-route product groups use dynamic dropdowns', () => {
    const routeCategory = jsonConfig.items.routesTab.items.routes.items.find(item => item.attr === 'category');
    const productCategory = jsonConfig.items.productsTab.items.products.items.find(item => item.attr === 'category');

    for (const field of [routeCategory, productCategory]) {
        assert.equal(field.type, 'selectSendTo');
        assert.equal(field.command, 'getProductGroups');
        assert.equal(field.manual, false);
        assert.equal(field.noTranslation, true);
    }
});


test('market selections use dynamic dropdowns', () => {
    const general = jsonConfig.items.general.items;
    const routeMarket = jsonConfig.items.routesTab.items.routes.items.find(item => item.attr === 'market');
    const productMarket = jsonConfig.items.productsTab.items.products.items.find(item => item.attr === 'defaultMarket');

    assert.equal(general.fallbackMarket.type, 'selectSendTo');
    assert.equal(general.fallbackMarket.command, 'getMarkets');
    assert.equal(general.priorityMarket.type, 'selectSendTo');
    assert.equal(general.priorityMarket.command, 'getMarketsOptional');
    assert.equal(routeMarket.type, 'selectSendTo');
    assert.equal(routeMarket.command, 'getMarkets');
    assert.equal(productMarket.type, 'selectSendTo');
    assert.equal(productMarket.command, 'getMarketsOptional');
});

test('product catalogue exposes sortable product, product-group and market columns', () => {
    const fields = jsonConfig.items.productsTab.items.products.items;
    for (const attr of ['name', 'category', 'defaultMarket']) {
        const field = fields.find(item => item.attr === attr);
        assert.equal(field.sort, true, `${attr} should be sortable`);
    }
});

test('dynamic dropdown handlers sort market and product-group labels alphabetically', () => {
    const source = fs.readFileSync(path.join(root, 'src', 'main.ts'), 'utf8');
    assert.match(source, /getProductGroups[\s\S]*localeCompare\(b\.label/);
    assert.match(source, /getMarkets[\s\S]*localeCompare\(b\.label/);
});

test('beta build keeps Dry-Run default on and exposes compatibility diagnostics', () => {
    assert.equal(ioPackage.common.version, '0.1.0-beta.1');
    assert.equal(ioPackage.native.dryRun, true);

    const ids = new Set(ioPackage.instanceObjects.map(object => object._id));
    for (const id of [
        'info.writeCapability',
        'info.compatibility',
        'info.lastCompatibilityTest',
        'control.compatibilityTest',
    ]) {
        assert.ok(ids.has(id), `${id} should exist`);
    }

    assert.ok(jsonConfig.items.diagnosticsTab.items.betaDiagnostics);
    assert.ok(jsonConfig.items.diagnosticsTab.items.compatibilityTestHelp);
});

test('beta runtime blocks real sorting writes unless Alexa write compatibility is confirmed', () => {
    const source = fs.readFileSync(path.join(root, 'src', 'main.ts'), 'utf8');
    assert.match(source, /if \(!canWriteAlexa\(this\.writeCapability\)\)/);
    assert.match(source, /BETA-Sicherheitsblock/);
    assert.match(source, /control\.compatibilityTest/);
});
