'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'admin/jsonConfig.json'), 'utf8'));
const main = fs.readFileSync(path.join(root, 'src/main.ts'), 'utf8');

test('Review accept-all sends complete unsaved admin data and requests an official refresh', () => {
    const button = config.items.reviewTab.items.reviewAcceptAll;
    assert.equal(button.command, 'markAllReviewItemsAccept');
    assert.match(button.jsonData, /JSON\.stringify\(data\)/);
    assert.notEqual(button.useNative, true);
    assert.match(main, /command:\s*'refresh'/);
    assert.match(main, /fullRefresh:\s*true/);
    assert.match(main, /data:\s*supplied/);
});

test('buffered transaction is persistent and old direct rollback helper is gone', () => {
    const ioPackage = JSON.parse(fs.readFileSync(path.join(root, 'io-package.json'), 'utf8'));
    assert.ok(ioPackage.instanceObjects.some(obj => obj._id === 'info.sortTransaction'));
    assert.match(main, /createBufferedSortProgram/);
    assert.match(main, /persistSortTransaction/);
    assert.match(main, /recoverInterruptedSortTransaction/);
    assert.doesNotMatch(main, /rollbackSortWrites/);
});
