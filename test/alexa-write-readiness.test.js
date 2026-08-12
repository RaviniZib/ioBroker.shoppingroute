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

test('visible-order restore waits for the synchronized marker revision', () => {
    const marker = 'ShoppingRoute Reihenfolge msqmwp8tjmfoz8rs 0';
    const markerPending = snapshot({
        json: {
            value: marker,
            version: 17,
            updatedDateTime: 1786572113531,
        },
        item: {
            value: marker,
            version: 16,
            updatedDateTime: 1786572110000,
            acknowledged: false,
        },
    });
    assert.equal(isAlexaWriteReady(marker, markerPending), false);
});

test('visible-order restore is released by a fully synchronized marker revision', () => {
    const marker = 'ShoppingRoute Reihenfolge msqmwp8tjmfoz8rs 0';
    const markerReady = snapshot({
        json: {
            value: marker,
            version: 17,
            updatedDateTime: 1786572113531,
        },
        item: {
            value: marker,
            version: 17,
            updatedDateTime: 1786572113531,
        },
    });
    assert.equal(isAlexaWriteReady(marker, markerReady), true);
});

test('marker readiness after 600 ms releases restore without a fixed 1000 ms sleep', async () => {
    const marker = 'ShoppingRoute Reihenfolge msqmwp8tjmfoz8rs 0';
    const staleMarker = snapshot({
        json: { value: marker, version: 17, updatedDateTime: 1786572113531 },
        item: { value: marker, version: 16, updatedDateTime: 1786572110000 },
    });
    const readyMarker = snapshot({
        json: { value: marker, version: 17, updatedDateTime: 1786572113531 },
        item: { value: marker, version: 17, updatedDateTime: 1786572113531 },
    });
    const samples = Array.from({ length: 6 }, () => staleMarker).concat(readyMarker);
    const pauses = [];
    const result = await waitForConfirmation({
        timeoutMs: 10000,
        pollIntervalMs: 100,
        pause: async delay => pauses.push(delay),
        probe: async () => isAlexaWriteReady(marker, samples.shift()) ? 'confirmed' : 'ambiguous',
    });

    assert.equal(result, 'confirmed');
    assert.deepEqual(pauses, [100, 100, 100, 100, 100, 100]);
});

test('missing marker readiness for ten seconds never releases the restore write', async () => {
    const marker = 'ShoppingRoute Reihenfolge msqmwp8tjmfoz8rs 0';
    const staleMarker = snapshot({
        json: { value: marker, version: 17, updatedDateTime: 1786572113531 },
        item: { value: marker, version: 16, updatedDateTime: 1786572110000 },
    });
    const pauses = [];
    let probes = 0;
    const result = await waitForConfirmation({
        timeoutMs: 10000,
        pollIntervalMs: 100,
        pause: async delay => pauses.push(delay),
        probe: async () => {
            probes += 1;
            return isAlexaWriteReady(marker, staleMarker) ? 'confirmed' : 'ambiguous';
        },
    });

    assert.equal(result, 'ambiguous');
    assert.equal(probes, 101);
    assert.equal(pauses.length, 100);
    assert.equal(pauses.reduce((total, delay) => total + delay, 0), 10000);
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
