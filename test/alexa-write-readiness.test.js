'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { isAlexaWriteReady } = require('../build/lib/alexa-write-readiness');
const { waitForConfirmation } = require('../build/lib/confirmation-wait');

function snapshot(overrides = {}) {
    return {
        jsonStable: overrides.jsonStable ?? true,
        queueBarrierAcknowledged: overrides.queueBarrierAcknowledged ?? true,
        queueBarrierObservedAt: overrides.queueBarrierObservedAt ?? 1200,
        json: {
            value: 'Lachsaufschnitt',
            version: 2,
            updatedDateTime: 1786567290028,
            acknowledged: true,
            observedAt: 1000,
            ...overrides.json,
        },
        item: {
            value: 'Lachsaufschnitt',
            version: 2,
            updatedDateTime: 1786567290028,
            acknowledged: true,
            versionAcknowledged: true,
            updatedDateTimeAcknowledged: true,
            valueObservedAt: 1100,
            versionObservedAt: 1102,
            updatedDateTimeObservedAt: 1101,
            ...overrides.item,
        },
    };
}

test('matching acknowledged value and metadata from the current JSON refresh release a write', () => {
    assert.equal(isAlexaWriteReady('Lachsaufschnitt', snapshot()), true);
});

test('the real rejected-write state with local ack false does not release another write', () => {
    assert.equal(isAlexaWriteReady('Lachsaufschnitt', snapshot({
        item: {
            value: '---- ALDI ----',
            acknowledged: false,
        },
    })), false);
});

test('a stale item version does not release a write', () => {
    assert.equal(isAlexaWriteReady('Lachsaufschnitt', snapshot({
        item: { version: 1 },
    })), false);
});

test('a stale item update timestamp does not release a write', () => {
    assert.equal(isAlexaWriteReady('Lachsaufschnitt', snapshot({
        item: { updatedDateTime: 1786567289000 },
    })), false);
});

test('matching values and metadata are insufficient when item states predate list JSON', () => {
    assert.equal(isAlexaWriteReady('Lachsaufschnitt', snapshot({
        item: {
            valueObservedAt: 999,
            versionObservedAt: 999,
            updatedDateTimeObservedAt: 999,
        },
    })), false);
});

test('matching target metadata waits until Alexa2 has processed the complete list refresh queue', () => {
    assert.equal(isAlexaWriteReady('Lachsaufschnitt', snapshot({
        queueBarrierObservedAt: 999,
    })), false);
});

test('a changing JSON snapshot cannot release a write', () => {
    assert.equal(isAlexaWriteReady('Lachsaufschnitt', snapshot({
        jsonStable: false,
    })), false);
});

test('a later Alexa2 item refresh releases the write without a fixed delay', () => {
    const stale = snapshot({
        item: {
            version: 1,
            updatedDateTime: 1786567289000,
            valueObservedAt: 900,
            versionObservedAt: 900,
            updatedDateTimeObservedAt: 900,
        },
    });
    const synchronized = snapshot();

    assert.equal(isAlexaWriteReady('Lachsaufschnitt', stale), false);
    assert.equal(isAlexaWriteReady('Lachsaufschnitt', synchronized), true);
});

test('readiness polling continues immediately after the first synchronized sample', async () => {
    const samples = [
        snapshot({ item: { version: 1 } }),
        snapshot(),
    ];
    const pauses = [];
    const result = await waitForConfirmation({
        timeoutMs: 10000,
        pollIntervalMs: 100,
        pause: async delay => pauses.push(delay),
        probe: async () => isAlexaWriteReady('Lachsaufschnitt', samples.shift())
            ? 'confirmed'
            : 'ambiguous',
    });

    assert.equal(result, 'confirmed');
    assert.deepEqual(pauses, [100]);
    assert.equal(samples.length, 0);
});

test('numeric strings and numbers identify the same Alexa metadata revision', () => {
    assert.equal(isAlexaWriteReady('Lachsaufschnitt', snapshot({
        item: {
            version: '2',
            updatedDateTime: '1786567290028',
        },
    })), true);
});

test('missing or unacknowledged read-only metadata keeps the gate closed', () => {
    assert.equal(isAlexaWriteReady('Lachsaufschnitt', snapshot({
        item: {
            version: undefined,
            versionAcknowledged: false,
        },
    })), false);
});
