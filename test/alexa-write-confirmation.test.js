'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { classifyAlexaWriteConfirmation } = require('../build/lib/alexa-write-confirmation');
const { waitForConfirmation } = require('../build/lib/confirmation-wait');

const from = 'Lachsaufschnitt';
const to = 'ShoppingRoute Reihenfolge msqc6to65gag27z5 0';
const previousJson = { value: from, version: 4, updatedDateTime: 100, acknowledged: true };
const previousItem = {
    value: from,
    version: 4,
    updatedDateTime: 100,
    acknowledged: true,
    versionAcknowledged: true,
    updatedDateTimeAcknowledged: true,
};

test('updated Alexa2 item states confirm a write while list JSON is still old', () => {
    assert.equal(classifyAlexaWriteConfirmation(
        from,
        to,
        previousJson,
        previousItem,
        previousJson,
        {
            ...previousItem,
            value: to,
            version: 5,
        },
    ), 'confirmed');
});

test('updated Alexa2 list JSON remains a valid write confirmation', () => {
    assert.equal(classifyAlexaWriteConfirmation(
        from,
        to,
        previousJson,
        previousItem,
        {
            ...previousJson,
            value: to,
            updatedDateTime: 200,
        },
        previousItem,
    ), 'confirmed');
});

test('both independently advanced sources confirm the target value', () => {
    assert.equal(classifyAlexaWriteConfirmation(
        from,
        to,
        previousJson,
        previousItem,
        { ...previousJson, value: to, version: 5 },
        { ...previousItem, value: to, updatedDateTime: 200 },
    ), 'confirmed');
});

test('a target value without a newer version or timestamp is not automatically confirmed', () => {
    assert.equal(classifyAlexaWriteConfirmation(
        from,
        to,
        previousJson,
        previousItem,
        previousJson,
        { ...previousItem, value: to, acknowledged: false },
    ), 'ambiguous');
});

test('advanced item metadata with a foreign value is ambiguous', () => {
    assert.equal(classifyAlexaWriteConfirmation(
        from,
        to,
        previousJson,
        previousItem,
        previousJson,
        { ...previousItem, value: 'Extern geändert', version: 5, updatedDateTime: 200 },
    ), 'ambiguous');
});

test('a target item value remains ambiguous when list JSON contains a foreign value', () => {
    assert.equal(classifyAlexaWriteConfirmation(
        from,
        to,
        previousJson,
        previousItem,
        { ...previousJson, value: 'Extern geändert' },
        { ...previousItem, value: to, version: 5, acknowledged: false },
    ), 'ambiguous');
});

test('a freshly advanced opposing source keeps the result ambiguous', () => {
    assert.equal(classifyAlexaWriteConfirmation(
        from,
        to,
        previousJson,
        previousItem,
        { ...previousJson, value: to, version: 5 },
        { ...previousItem, updatedDateTime: 200 },
    ), 'ambiguous');
});

test('ack false target value is confirmed by a newer acknowledged read-only version', () => {
    assert.equal(classifyAlexaWriteConfirmation(
        from,
        to,
        previousJson,
        previousItem,
        previousJson,
        { ...previousItem, value: to, version: 5, acknowledged: false },
    ), 'confirmed');
});

test('ack false target value is confirmed by a newer acknowledged read-only timestamp', () => {
    assert.equal(classifyAlexaWriteConfirmation(
        from,
        to,
        previousJson,
        previousItem,
        previousJson,
        { ...previousItem, value: to, updatedDateTime: 200, acknowledged: false },
    ), 'confirmed');
});

test('unacknowledged metadata plus ack false value is not accepted as confirmation', () => {
    assert.equal(classifyAlexaWriteConfirmation(
        from,
        to,
        previousJson,
        previousItem,
        previousJson,
        {
            ...previousItem,
            value: to,
            version: 5,
            acknowledged: false,
            versionAcknowledged: false,
        },
    ), 'ambiguous');
});

test('unchanged old sources report not-applied', () => {
    assert.equal(classifyAlexaWriteConfirmation(
        from,
        to,
        previousJson,
        previousItem,
        previousJson,
        previousItem,
    ), 'not-applied');
});

test('no change through the timeout remains not-applied for the caller safety stop', async () => {
    let probes = 0;
    const result = await waitForConfirmation({
        timeoutMs: 300,
        pollIntervalMs: 100,
        pause: async () => {},
        probe: async () => {
            probes += 1;
            return classifyAlexaWriteConfirmation(
                from,
                to,
                previousJson,
                previousItem,
                previousJson,
                previousItem,
            );
        },
    });

    assert.equal(result, 'not-applied');
    assert.equal(probes, 4);
});
