'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    beginExecuting,
    beginPlanning,
    beginVerifying,
    collectExternalEvent,
    createListSortLifecycle,
    finishVerifying,
    recordAmazonWrite,
    recordSelfTrigger,
} = require('../build/lib/sort-lifecycle');
const { planMarketHeaderActions } = require('../build/lib/market-plan');

const QUIET_MS = 5_000;

function externalSnapshot(lifecycle, itemCount, observedAt) {
    const signature = JSON.stringify(Array.from({ length: itemCount }, (_entry, index) => [
        `id-${index}`,
        `Artikel ${index}`,
    ]));
    return collectExternalEvent(lifecycle, signature, observedAt, QUIET_MS).lifecycle;
}

test('A: ten one-second external snapshots produce zero writes and exactly one planning/executing run', () => {
    let lifecycle = createListSortLifecycle();
    for (let index = 0; index < 10; index++) {
        const observedAt = index * 1_000;
        lifecycle = externalSnapshot(lifecycle, index + 1, observedAt);
        assert.equal(lifecycle.phase, 'COLLECTING');
        assert.equal(lifecycle.metrics.amazonWrites, 0);
        assert.equal(lifecycle.metrics.sortListRuns, 0);
        assert.equal(beginPlanning(lifecycle, observedAt).phase, 'COLLECTING');
    }

    assert.equal(lifecycle.metrics.externalEvents, 10);
    assert.equal(lifecycle.metrics.quietResets, 9);
    assert.equal(beginPlanning(lifecycle, 13_999).phase, 'COLLECTING');
    lifecycle = beginPlanning(lifecycle, 14_000);
    assert.equal(lifecycle.phase, 'PLANNING');
    assert.equal(lifecycle.metrics.sortListRuns, 1);
    lifecycle = beginExecuting(lifecycle);
    assert.equal(lifecycle.phase, 'EXECUTING');
});

test('B: own Alexa2 refreshes during header execution never collect input or create another run', () => {
    let lifecycle = externalSnapshot(createListSortLifecycle(), 10, 0);
    lifecycle = beginExecuting(beginPlanning(lifecycle, QUIET_MS));
    for (let index = 0; index < 5; index++) {
        lifecycle = recordAmazonWrite(lifecycle);
        lifecycle = recordSelfTrigger(lifecycle);
        assert.equal(lifecycle.phase, 'EXECUTING');
        assert.equal(lifecycle.externalDirty, false);
        assert.equal(lifecycle.metrics.sortListRuns, 1);
    }
    lifecycle = finishVerifying(beginVerifying(lifecycle), 8_000, QUIET_MS);
    assert.equal(lifecycle.phase, 'IDLE');
    assert.equal(lifecycle.metrics.sortListRuns, 1);
    assert.equal(lifecycle.metrics.suppressedSelfTriggers, 5);
});

test('C: three external events during execution require one full quiet phase and exactly one follow-up run', () => {
    let lifecycle = externalSnapshot(createListSortLifecycle(), 1, 0);
    lifecycle = beginExecuting(beginPlanning(lifecycle, QUIET_MS));
    lifecycle = externalSnapshot(lifecycle, 2, 6_000);
    lifecycle = externalSnapshot(lifecycle, 3, 7_000);
    lifecycle = externalSnapshot(lifecycle, 4, 8_000);
    assert.equal(lifecycle.phase, 'EXECUTING');
    assert.equal(lifecycle.externalDirty, true);
    assert.equal(lifecycle.metrics.sortListRuns, 1);

    lifecycle = finishVerifying(beginVerifying(lifecycle), 12_000, QUIET_MS);
    assert.equal(lifecycle.phase, 'COLLECTING');
    assert.equal(lifecycle.quietUntil, 17_000);
    assert.equal(beginPlanning(lifecycle, 16_999).phase, 'COLLECTING');
    lifecycle = beginPlanning(lifecycle, 17_000);
    assert.equal(lifecycle.phase, 'PLANNING');
    assert.equal(lifecycle.metrics.sortListRuns, 2);
});

test('D: five missing headers are planned and written within one executing lifecycle', () => {
    const marketNames = ['ALDI', 'LIDL', 'REWE', 'EDEKA', 'KAUFLAND'];
    const markets = marketNames.map((name, index) => ({
        name,
        aliases: '',
        order: (index + 1) * 10,
        enabled: true,
    }));
    const list = Array.from({ length: 20 }, (_entry, index) => ({
        id: `article-${index}`,
        value: `Artikel ${index}`,
        completed: false,
    }));
    let lifecycle = externalSnapshot(createListSortLifecycle(), 20, 0);
    lifecycle = beginExecuting(beginPlanning(lifecycle, QUIET_MS));
    const actions = planMarketHeaderActions(list, marketNames, markets, 'Ohne Markt', true, marketNames);
    assert.equal(actions.length, 5);
    for (const action of actions) {
        assert.equal(action.type, 'create');
        lifecycle = recordAmazonWrite(lifecycle);
        lifecycle = recordSelfTrigger(lifecycle);
        assert.equal(lifecycle.phase, 'EXECUTING');
        assert.equal(lifecycle.metrics.sortListRuns, 1);
    }

    assert.equal(lifecycle.metrics.amazonWrites, 5);
    assert.equal(lifecycle.metrics.sortListRuns, 1);
});

test('E: verification without an external change returns to idle without another planning run', () => {
    let lifecycle = externalSnapshot(createListSortLifecycle(), 3, 0);
    lifecycle = beginExecuting(beginPlanning(lifecycle, QUIET_MS));
    lifecycle = finishVerifying(beginVerifying(lifecycle), 6_000, QUIET_MS);
    assert.equal(lifecycle.phase, 'IDLE');
    assert.equal(lifecycle.metrics.sortListRuns, 1);
    assert.equal(beginPlanning(lifecycle, 100_000).phase, 'IDLE');
});
