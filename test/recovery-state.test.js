'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { classifyRecoveryStepState } = require('../build/lib/recovery-state');

function snapshot(value, overrides = {}) {
    return {
        jsonStable: overrides.jsonStable ?? true,
        queueBarrierAcknowledged: overrides.queueBarrierAcknowledged ?? true,
        queueBarrierObservedAt: overrides.queueBarrierObservedAt ?? 1200,
        json: {
            value,
            version: 18,
            updatedDateTime: 2000,
            acknowledged: true,
            observedAt: 1100,
            ...overrides.json,
        },
        item: {
            value,
            version: 18,
            updatedDateTime: 2000,
            acknowledged: true,
            versionAcknowledged: true,
            updatedDateTimeAcknowledged: true,
            valueObservedAt: 1200,
            versionObservedAt: 1200,
            updatedDateTimeObservedAt: 1200,
            ...overrides.item,
        },
    };
}

const original = 'Camembert';
const marker = 'ShoppingRoute Reihenfolge lifecycle 0';

test('consistent synchronized original state is already rolled back', () => {
    assert.equal(classifyRecoveryStepState(original, marker, snapshot(original)), 'from');
});

test('consistent synchronized marker state is still applied and requires rollback', () => {
    assert.equal(classifyRecoveryStepState(original, marker, snapshot(marker)), 'to');
});

test('restore applied before confirmedSteps persistence is recognized from marker to original', () => {
    assert.equal(classifyRecoveryStepState(marker, original, snapshot(original)), 'to');
});

test('stale JSON original and item marker never clear the journal', () => {
    assert.equal(classifyRecoveryStepState(original, marker, snapshot(original, {
        item: { value: marker, version: 19, updatedDateTime: 2100 },
    })), 'ambiguous');
});

test('JSON marker and item original never clear the journal', () => {
    assert.equal(classifyRecoveryStepState(original, marker, snapshot(marker, {
        item: { value: original, version: 17, updatedDateTime: 1900 },
    })), 'ambiguous');
});

test('missing item remains a hard recovery failure', () => {
    assert.equal(classifyRecoveryStepState(original, marker, snapshot(original, {
        item: { value: undefined },
    })), 'missing');
});

test('foreign values remain a hard recovery failure and are never overwritten', () => {
    assert.equal(classifyRecoveryStepState(original, marker, snapshot('Fremdwert')), 'foreign');
});

test('matching text without acknowledged synchronized metadata remains ambiguous', () => {
    assert.equal(classifyRecoveryStepState(original, marker, snapshot(original, {
        item: { versionAcknowledged: false },
    })), 'ambiguous');
});
