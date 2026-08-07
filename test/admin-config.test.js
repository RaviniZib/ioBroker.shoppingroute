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
