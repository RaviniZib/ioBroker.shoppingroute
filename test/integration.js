'use strict';

const path = require('node:path');
const assert = require('node:assert/strict');
const { tests } = require('@iobroker/testing');
const { Components: { ReviewEditor } } = require('../src-admin/review-editor');

async function startThroughConfigPersistence(harness) {
    // onReady writes this state after persisting review/catalogue changes.
    await harness.states.setStateAsync('shoppingroute.0.info.versionInstalled', { val: 'waiting', ack: true });
    await harness.startAdapterAndWait();
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
        const state = await harness.states.getStateAsync('shoppingroute.0.info.versionInstalled');
        if (state?.val === require('../package.json').version) return;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Adapter did not finish startup configuration persistence');
}

tests.integration(path.join(__dirname, '..'), {
    controllerVersion: process.env.SHOPPINGROUTE_TEST_CONTROLLER_VERSION,
    defineAdditionalTests({ suite, it }) {
        for (const bulk of [false, true]) {
            suite(`Review persistence: ${bulk ? 'bulk' : 'individual'} acceptance`, getHarness => {
                it('persists the editor draft across actual adapter startup and reload', async function () {
                    this.timeout(60000);
                    const harness = getHarness();
                    const original = await harness.getAdapterConfig();
                    const selected = ['ALDI', 'LIDL', 'REWE'];
                    const rows = ['Review probe one', 'Review probe two'].map((product, index) => ({
                        key: `review-probe-${index}`, product, action: 'pending',
                        category: 'Sonstiges', defaultMarket: 'LIDL', availableMarkets: selected,
                    }));
                    const initial = { ...original.native, dryRun: true, products: [], reviewItems: rows };
                    const editor = new ReviewEditor({
                        data: initial,
                        onChange: data => { editor.props = { ...editor.props, data }; },
                    });
                    if (bulk) editor.acceptAll();
                    else editor.accept(0);
                    const draft = JSON.parse(JSON.stringify(editor.props.data));
                    assert.equal(initial.reviewItems.length, 2, 'acceptance must not mutate the discarded draft');
                    const expectedNames = bulk ? rows.map(row => row.product) : [rows[0].product];
                    const expectedReviewKeys = bulk ? [] : [rows[1].key];
                    // Save the actual editor output to an isolated ioBroker object database.
                    // changeAdapterConfig merges arrays by index; Admin saves the whole native object.
                    await harness.objects.setObjectAsync('system.adapter.shoppingroute.0', { ...original, native: draft });
                    await startThroughConfigPersistence(harness);
                    const saved = await harness.getAdapterConfig();
                    assert.deepEqual(saved.native.reviewItems.map(row => row.key), expectedReviewKeys);
                    assert.deepEqual(saved.native.products.map(product => product.name), expectedNames);
                    for (const product of saved.native.products) {
                        assert.deepEqual(product.availableMarkets, selected);
                        assert.equal(product.defaultMarket, 'LIDL');
                    }
                    const reloaded = new ReviewEditor({ data: saved.native });
                    assert.equal(reloaded.props.data.reviewItems.length, expectedReviewKeys.length);
                    await harness.stopAdapter();
                });
            });
        }
        suite('Legacy accepted review cleanup', getHarness => {
            it('persists cleanup in managed data without rewriting native', async function () {
                this.timeout(60000);
                const harness = getHarness();
                const original = await harness.getAdapterConfig();
                await harness.objects.setObjectAsync('system.adapter.shoppingroute.0', { ...original, native: {
                    ...original.native,
                    dryRun: true,
                    products: [{ name: 'Existing probe', category: 'Sonstiges', availableMarkets: 'ALDI;LIDL' }],
                    reviewItems: [{ key: 'existing-probe', product: 'Existing probe', action: 'accepted' }],
                } });
                await startThroughConfigPersistence(harness);
                const saved = await harness.getAdapterConfig();
                assert.deepEqual(saved.native.reviewItems, [
                    { key: 'existing-probe', product: 'Existing probe', action: 'accepted' },
                ], 'runtime cleanup must not rewrite the instance object and trigger a restart');
                assert.equal(saved.native.products.length, 1);
                const managedState = await harness.states.getStateAsync('shoppingroute.0.data.managedConfig');
                const managed = JSON.parse(String(managedState?.val || '{}'));
                assert.equal(managed.version, 1);
                assert.deepEqual(managed.data.reviewItems, []);
                assert.equal(managed.data.products.length, 1);
                assert.deepEqual(managed.data.products[0].availableMarkets, ['ALDI', 'LIDL']);
                await harness.stopAdapter();
            });
        });
        // The integration harness has one adapter lifetime per suite.
        suite('Managed catalogue startup reload', getHarness => {
            it('loads a persisted cleaned catalogue instead of stale native reviews on startup', async function () {
                this.timeout(30000);
                const harness = getHarness();
                const original = await harness.getAdapterConfig();
                const product = { name: 'Persisted probe', category: 'Sonstiges', availableMarkets: ['ALDI', 'LIDL'] };
                const legacyReviews = [{ key: 'stale-probe', product: 'Stale native probe', action: 'accepted' }];
                await harness.objects.setObjectAsync('system.adapter.shoppingroute.0', { ...original, native: {
                    ...original.native, dryRun: true, products: [], reviewItems: legacyReviews,
                } });
                const data = { ...original.native, products: [product], reviewItems: [] };
                await harness.states.setStateAsync('shoppingroute.0.data.managedConfig', {
                    val: JSON.stringify({ version: 1, savedAt: '2026-10-07T00:00:00.000Z', data }), ack: true,
                });
                await startThroughConfigPersistence(harness);
                const state = await harness.states.getStateAsync('shoppingroute.0.data.managedConfig');
                const managed = JSON.parse(String(state?.val || '{}'));
                assert.deepEqual(managed.data.reviewItems, []);
                assert.deepEqual(managed.data.products.map(row => row.name), ['Persisted probe']);
                assert.deepEqual(managed.data.products[0].availableMarkets, ['ALDI', 'LIDL']);
                const saved = await harness.getAdapterConfig();
                assert.deepEqual(saved.native.reviewItems, legacyReviews);
                await harness.stopAdapter();
            });
        });
    },
});
