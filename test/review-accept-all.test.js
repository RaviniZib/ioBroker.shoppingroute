'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'admin/jsonConfig.json'), 'utf8'));
const main = fs.readFileSync(path.join(root, 'src/main.ts'), 'utf8');

test('Review accept-all updates only reviewItems in the unsaved Admin draft via useNative', () => {
    const button = config.items.reviewTab.items.reviewAcceptAll;
    assert.equal(button.command, 'markAllReviewItemsAccept');
    assert.match(button.jsonData, /JSON\.stringify\(data\)/);
    assert.equal(button.useNative, true);

    const handler = main.slice(
        main.indexOf("if (obj.command === 'markAllReviewItemsAccept')"),
        main.indexOf("if (obj.command === 'normalizeMarketSelection')"),
    );
    assert.match(handler, /const updatedReviewItems = rows\.map/);
    assert.match(handler, /\.\.\.item,[\s\S]*action:\s*'accept'/);
    assert.match(handler, /native:\s*{\s*reviewItems:\s*updatedReviewItems/);
    assert.doesNotMatch(handler, /command:\s*'refresh'/);
    assert.doesNotMatch(handler, /fullRefresh/);
    assert.doesNotMatch(handler, /native:\s*supplied/);
});

test('Review accept-all preserves every row field and sets all returned actions to accept', () => {
    const rows = [
        {
            product: 'Milch',
            text: '2 Milch ALDI',
            category: 'Milchprodukte',
            defaultMarket: 'ALDI',
            availableMarkets: ['ALDI', 'LIDL'],
            aliases: 'Vollmilch',
            action: 'pending',
            customField: 'bleibt erhalten',
        },
        {
            product: 'Hammer',
            text: 'Hammer BAUMARKT',
            category: 'Werkzeug',
            defaultMarket: 'BAUMARKT',
            availableMarkets: 'BAUMARKT',
            aliases: '',
            action: 'ignore',
        },
    ];

    const updatedReviewItems = rows.map(item => ({
        ...item,
        availableMarkets: Array.isArray(item.availableMarkets)
            ? item.availableMarkets.map(value => typeof value === 'string' ? value.trim() : '').filter(Boolean).join(',')
            : String(item.availableMarkets || ''),
        action: 'accept',
    }));

    assert.deepEqual(updatedReviewItems, [
        { ...rows[0], availableMarkets: 'ALDI,LIDL', action: 'accept' },
        { ...rows[1], availableMarkets: 'BAUMARKT', action: 'accept' },
    ]);
    assert.ok(updatedReviewItems.every(item => item.action === 'accept'));
    assert.equal(updatedReviewItems[0].customField, 'bleibt erhalten');
});

test('buffered transaction is persistent and old direct rollback helper is gone', () => {
    const ioPackage = JSON.parse(fs.readFileSync(path.join(root, 'io-package.json'), 'utf8'));
    assert.ok(ioPackage.instanceObjects.some(obj => obj._id === 'info.sortTransaction'));
    assert.match(main, /createBufferedSortProgram/);
    assert.match(main, /persistSortTransaction/);
    assert.match(main, /recoverInterruptedSortTransaction/);
    assert.doesNotMatch(main, /rollbackSortWrites/);
});
