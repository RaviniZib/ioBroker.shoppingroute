'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    classifyRecoveryLateSettlement,
    observeRecoveryLateSettlement,
} = require('../build/lib/recovery-late-settlement');

const from = 'ShoppingRoute Puffer msr913es4z0687a2 0';
const to = '---- ALDI ----';
const baseline = {
    json: {
        value: from,
        version: 6,
        updatedDateTime: 1786609319000,
        acknowledged: true,
    },
    item: {
        value: from,
        version: 6,
        updatedDateTime: 1786609319000,
        acknowledged: true,
        versionAcknowledged: true,
        updatedDateTimeAcknowledged: true,
    },
};

function snapshot(value, version, updatedDateTime, overrides = {}) {
    return {
        jsonStable: overrides.jsonStable ?? true,
        queueBarrierAcknowledged: overrides.queueBarrierAcknowledged ?? true,
        queueBarrierObservedAt: overrides.queueBarrierObservedAt ?? 2200,
        json: {
            value,
            version,
            updatedDateTime,
            acknowledged: true,
            observedAt: 2100,
            ...overrides.json,
        },
        item: {
            value,
            version,
            updatedDateTime,
            acknowledged: true,
            versionAcknowledged: true,
            updatedDateTimeAcknowledged: true,
            valueObservedAt: 2200,
            versionObservedAt: 2200,
            updatedDateTimeObservedAt: 2200,
            ...overrides.item,
        },
    };
}

const unchanged = snapshot(from, 6, 1786609319000);
const applied = snapshot(to, 7, 1786609320276);

test('real rollback v6 to v7 is confirmed when it settles four seconds after the normal wait', async () => {
    const samples = Array.from({ length: 40 }, () => unchanged).concat(applied);
    const pauses = [];
    let latest = samples.at(-1);
    let probes = 0;

    const result = await observeRecoveryLateSettlement({
        from,
        to,
        baseline,
        timeoutMs: 10000,
        pollIntervalMs: 100,
        pause: async delay => pauses.push(delay),
        probe: async () => {
            probes += 1;
            latest = samples.shift() ?? latest;
            return latest;
        },
    });

    assert.equal(result, 'confirmed');
    assert.equal(pauses.reduce((sum, delay) => sum + delay, 0), 4000);
    assert.equal(probes, 41);
});

test('a new consistent target revision is required for late confirmation', () => {
    assert.equal(classifyRecoveryLateSettlement(from, to, baseline, applied), 'confirmed');
    assert.equal(classifyRecoveryLateSettlement(from, to, baseline, snapshot(to, 6, 1786609319000)), 'pending');
});

test('a foreign value remains ambiguous and stops the late observation immediately', async () => {
    const pauses = [];
    const result = await observeRecoveryLateSettlement({
        from,
        to,
        baseline,
        timeoutMs: 10000,
        pollIntervalMs: 100,
        pause: async delay => pauses.push(delay),
        probe: async () => snapshot('Extern geändert', 7, 1786609320276),
    });

    assert.equal(result, 'ambiguous');
    assert.deepEqual(pauses, []);
});

test('unchanged synchronized source revision is not-applied only after the full late window', async () => {
    const pauses = [];
    const result = await observeRecoveryLateSettlement({
        from,
        to,
        baseline,
        timeoutMs: 10000,
        pollIntervalMs: 100,
        pause: async delay => pauses.push(delay),
        probe: async () => unchanged,
    });

    assert.equal(result, 'not-applied');
    assert.equal(pauses.length, 100);
    assert.equal(pauses.reduce((sum, delay) => sum + delay, 0), 10000);
});

test('shutdown aborts observation without a write or a successful settlement', async () => {
    let unloading = false;
    let probes = 0;
    const result = await observeRecoveryLateSettlement({
        from,
        to,
        baseline,
        timeoutMs: 10000,
        pollIntervalMs: 100,
        pause: async () => { unloading = true; },
        shouldAbort: () => unloading,
        probe: async () => {
            probes += 1;
            return unchanged;
        },
    });

    assert.equal(result, 'ambiguous');
    assert.equal(probes, 1);
});

test('a newer contradictory source revision is ambiguous', () => {
    const contradiction = snapshot(from, 7, 1786609320276, {
        item: { value: to, version: 6, updatedDateTime: 1786609319000 },
    });
    assert.equal(classifyRecoveryLateSettlement(from, to, baseline, contradiction), 'ambiguous');
});

test('an older-looking but post-baseline opposing revision is still a contradiction', () => {
    const contradiction = snapshot(to, 8, 1786609321000, {
        json: { value: from, version: 7, updatedDateTime: 1786609320276 },
    });
    assert.equal(classifyRecoveryLateSettlement(from, to, baseline, contradiction), 'ambiguous');
});
