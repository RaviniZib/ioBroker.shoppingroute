'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    classifyAlexaWriteSettlement,
    inspectAlexaWriteSettlement,
} = require('../build/lib/alexa-write-settlement');
const { waitForConfirmation } = require('../build/lib/confirmation-wait');

const original = 'Camembert';
const marker = 'ShoppingRoute Reihenfolge msqmwp8tjmfoz8rs 0';
const baseline = {
    json: {
        value: original,
        version: 16,
        updatedDateTime: 1000,
        acknowledged: true,
    },
    item: {
        value: original,
        version: 16,
        updatedDateTime: 1000,
        acknowledged: true,
        versionAcknowledged: true,
        updatedDateTimeAcknowledged: true,
    },
};

function snapshot(overrides = {}) {
    return {
        jsonStable: overrides.jsonStable ?? true,
        queueBarrierAcknowledged: overrides.queueBarrierAcknowledged ?? true,
        queueBarrierObservedAt: overrides.queueBarrierObservedAt ?? 2200,
        json: {
            value: marker,
            version: 17,
            updatedDateTime: 2000,
            acknowledged: true,
            observedAt: 2100,
            ...overrides.json,
        },
        item: {
            value: marker,
            version: 17,
            updatedDateTime: 2000,
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

const pending = snapshot({
    json: {
        value: original,
        version: 16,
        updatedDateTime: 1000,
    },
    item: {
        value: original,
        version: 16,
        updatedDateTime: 1000,
    },
});
const confirmedNotReady = snapshot({ queueBarrierObservedAt: 2000 });
const ready = snapshot();

async function runSamples(samples, timeoutMs = 10000) {
    const pauses = [];
    let last = samples[samples.length - 1];
    const result = await waitForConfirmation({
        timeoutMs,
        pollIntervalMs: 100,
        pause: async delay => pauses.push(delay),
        probe: async () => {
            last = samples.shift() ?? last;
            return classifyAlexaWriteSettlement(original, marker, baseline, last);
        },
    });
    return { result, pauses };
}

test('confirmation and readiness in the same 500 ms sample release the following write once', async () => {
    const result = await runSamples(Array.from({ length: 5 }, () => pending).concat(ready));

    assert.equal(result.result, 'confirmed');
    assert.equal(result.pauses.length, 5);
    assert.equal(result.pauses.reduce((total, delay) => total + delay, 0), 500);
});

test('confirmation at 300 ms and readiness at 800 ms release at 800 ms', async () => {
    const confirmationStates = [];
    const samples = Array.from({ length: 3 }, () => pending)
        .concat(Array.from({ length: 5 }, () => confirmedNotReady), ready);
    const pauses = [];
    let last = samples[samples.length - 1];
    const result = await waitForConfirmation({
        timeoutMs: 10000,
        pollIntervalMs: 100,
        pause: async delay => pauses.push(delay),
        probe: async () => {
            last = samples.shift() ?? last;
            const state = inspectAlexaWriteSettlement(original, marker, baseline, last);
            confirmationStates.push(state.confirmation);
            if (state.confirmation !== 'confirmed') return state.confirmation;
            return state.ready ? 'confirmed' : 'ambiguous';
        },
    });

    assert.equal(result, 'confirmed');
    assert.equal(confirmationStates[3], 'confirmed');
    assert.equal(pauses.reduce((total, delay) => total + delay, 0), 800);
});

test('a confirmed write which never becomes ready times out before the following write', async () => {
    const result = await runSamples([confirmedNotReady]);

    assert.equal(result.result, 'ambiguous');
    assert.equal(result.pauses.length, 100);
    assert.equal(result.pauses.reduce((total, delay) => total + delay, 0), 10000);
});

test('a write which remains at the baseline is not applied and never releases another write', async () => {
    const result = await runSamples([pending]);

    assert.equal(result.result, 'not-applied');
    assert.equal(result.pauses.length, 100);
});

test('a foreign value remains ambiguous and never releases another write', async () => {
    const foreign = snapshot({
        json: { value: 'Fremdwert', version: 17, updatedDateTime: 2000 },
        item: { value: 'Fremdwert', version: 17, updatedDateTime: 2000 },
    });
    const result = await runSamples([foreign]);

    assert.equal(result.result, 'ambiguous');
    assert.equal(result.pauses.length, 100);
});

test('the visible marker is settled only after confirmation and full Alexa2 readiness', () => {
    assert.equal(classifyAlexaWriteSettlement(original, marker, baseline, confirmedNotReady), 'ambiguous');
    assert.equal(classifyAlexaWriteSettlement(original, marker, baseline, ready), 'confirmed');
});
