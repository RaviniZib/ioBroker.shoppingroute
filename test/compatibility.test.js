'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { inspectAlexaRemoteSource, canWriteAlexa } = require('../build/lib/compatibility');

test('known malformed alexa-remote2 version query is detected', () => {
    const result = inspectAlexaRemoteSource('path += `?version =${options.version}`;');
    assert.equal(result.status, 'known-bug');
    assert.equal(canWriteAlexa('known-bug'), false);
});

test('fixed alexa-remote2 version query is accepted', () => {
    const result = inspectAlexaRemoteSource('path += `?version=${options.version}`;');
    assert.equal(result.status, 'source-ok');
    assert.equal(canWriteAlexa('source-ok'), true);
});

test('unknown alexa-remote2 implementation requires live proof before writes', () => {
    const result = inspectAlexaRemoteSource('function updateListItem() { return true; }');
    assert.equal(result.status, 'unknown');
    assert.equal(canWriteAlexa('unknown'), false);
    assert.equal(canWriteAlexa('live-ok'), true);
    assert.equal(canWriteAlexa('live-failed'), false);
});
