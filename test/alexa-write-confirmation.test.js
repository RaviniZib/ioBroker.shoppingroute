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

test('real restore from marker version 17 to original text version 18 is confirmed', () => {
    const marker = 'ShoppingRoute Reihenfolge XYZ';
    const markerJson = { value: marker, version: 17, updatedDateTime: 1000, acknowledged: true };
    const markerItem = {
        ...markerJson,
        versionAcknowledged: true,
        updatedDateTimeAcknowledged: true,
    };
    const restoredJson = { value: 'Kuchen', version: 18, updatedDateTime: 2000, acknowledged: true };
    const restoredItem = {
        ...restoredJson,
        versionAcknowledged: true,
        updatedDateTimeAcknowledged: true,
    };

    assert.equal(classifyAlexaWriteConfirmation(
        marker,
        'Kuchen',
        markerJson,
        markerItem,
        restoredJson,
        restoredItem,
    ), 'confirmed');
});

test('real Camembert restore from marker version 17 to version 18 is confirmed', () => {
    const marker = 'ShoppingRoute Reihenfolge msqmwp8tjmfoz8rs 0';
    const markerJson = { value: marker, version: 17, updatedDateTime: 1786572113531, acknowledged: true };
    const markerItem = {
        ...markerJson,
        versionAcknowledged: true,
        updatedDateTimeAcknowledged: true,
    };
    const restoredJson = { value: 'Camembert', version: 18, updatedDateTime: 1786572114131, acknowledged: true };
    const restoredItem = {
        ...restoredJson,
        versionAcknowledged: true,
        updatedDateTimeAcknowledged: true,
    };

    assert.equal(classifyAlexaWriteConfirmation(
        marker,
        'Camembert',
        markerJson,
        markerItem,
        restoredJson,
        restoredItem,
    ), 'confirmed');
});

test('newer restored item confirms while list JSON still has the older marker', () => {
    const marker = 'ShoppingRoute Reihenfolge XYZ';
    assert.equal(classifyAlexaWriteConfirmation(
        marker,
        'Kuchen',
        { value: 'Kuchen', version: 16, updatedDateTime: 500, acknowledged: true },
        {
            value: marker,
            version: 17,
            updatedDateTime: 1000,
            acknowledged: true,
            versionAcknowledged: true,
            updatedDateTimeAcknowledged: true,
        },
        { value: marker, version: 17, updatedDateTime: 1000, acknowledged: true },
        {
            value: 'Kuchen',
            version: 18,
            updatedDateTime: 2000,
            acknowledged: true,
            versionAcknowledged: true,
            updatedDateTimeAcknowledged: true,
        },
    ), 'confirmed');
});

test('newer restored JSON confirms while item states still have the older marker', () => {
    const marker = 'ShoppingRoute Reihenfolge XYZ';
    assert.equal(classifyAlexaWriteConfirmation(
        marker,
        'Kuchen',
        { value: marker, version: 17, updatedDateTime: 1000, acknowledged: true },
        {
            value: 'Kuchen',
            version: 16,
            updatedDateTime: 500,
            acknowledged: true,
            versionAcknowledged: true,
            updatedDateTimeAcknowledged: true,
        },
        { value: 'Kuchen', version: 18, updatedDateTime: 2000, acknowledged: true },
        {
            value: marker,
            version: 17,
            updatedDateTime: 1000,
            acknowledged: true,
            versionAcknowledged: true,
            updatedDateTimeAcknowledged: true,
        },
    ), 'confirmed');
});

test('same-revision marker contradicts a restored target and remains ambiguous', () => {
    const marker = 'ShoppingRoute Reihenfolge XYZ';
    assert.equal(classifyAlexaWriteConfirmation(
        marker,
        'Kuchen',
        { value: 'Kuchen', version: 16, updatedDateTime: 500, acknowledged: true },
        {
            value: marker,
            version: 17,
            updatedDateTime: 1000,
            acknowledged: true,
            versionAcknowledged: true,
            updatedDateTimeAcknowledged: true,
        },
        { value: marker, version: 18, updatedDateTime: 2000, acknowledged: true },
        {
            value: 'Kuchen',
            version: 18,
            updatedDateTime: 2000,
            acknowledged: true,
            versionAcknowledged: true,
            updatedDateTimeAcknowledged: true,
        },
    ), 'ambiguous');
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
