'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { AlexaDirectClient, DirectAlexaError, classifyDirectAlexaError } = require('../build/lib/alexa-direct');

function fakeRemote(handler) {
    return {
        init(_options, callback) { callback(); },
        getLists(callback) { callback(null, [{ listId: 'list-1', name: 'SHOP' }]); },
        getListItemsV2(_id, _options, callback) { callback(null, []); },
        httpsGet(path, callback, flags) { handler(path, flags, callback); },
    };
}

test('direct UPDATE uses the exact item URL/version and requires a newer confirmed response', async () => {
    const calls = [];
    const client = new AlexaDirectClient(fakeRemote((path, flags, callback) => {
        calls.push({ path, flags });
        callback(null, { itemInfo: { itemId: 'item-1', itemName: '[25] Tomaten', version: 5, itemStatus: 'ACTIVE' } });
    }));
    const result = await client.updateItem('list-1', 'item-1', 4, '[25] Tomaten');
    assert.equal(result.version, 5);
    assert.match(calls[0].path, /items\/item-1\?version=4$/);
    assert.equal(calls[0].flags.method, 'PUT');
    assert.deepEqual(JSON.parse(calls[0].flags.data).itemAttributesToUpdate, [{ type: 'itemName', value: '[25] Tomaten' }]);
});

test('batch CREATE sends every suffix item in one POST and validates failures', async () => {
    let call;
    const client = new AlexaDirectClient(fakeRemote((path, flags, callback) => {
        call = { path, flags };
        callback(null, {
            itemInfoList: [
                { itemId: 'a', itemName: '[30] Milch', version: 1 },
                { itemId: 'b', itemName: '[40] Eier', version: 1 },
            ],
            failures: [],
        });
    }));
    const result = await client.batchCreate('list-1', ['[30] Milch', '[40] Eier']);
    assert.equal(result.items.length, 2);
    assert.equal(call.flags.method, 'POST');
    assert.equal(JSON.parse(call.flags.data).items.length, 2);

    const failed = new AlexaDirectClient(fakeRemote((_path, _flags, callback) => {
        callback(null, { itemInfoList: [], failures: [{ reason: 'bad' }] });
    }));
    await assert.rejects(failed.batchCreate('list-1', ['[30] Milch']), /Batch-CREATE unvollständig/);
});

test('DELETE is item-specific and version conflicts are never retried by the client', async () => {
    let calls = 0;
    const client = new AlexaDirectClient(fakeRemote((_path, _flags, callback) => {
        calls += 1;
        callback(new Error('HTTP 409 VersionMismatch'));
    }));
    await assert.rejects(client.deleteItem('list-1', 'item-1', 7), error => {
        assert.ok(error instanceof DirectAlexaError);
        assert.equal(error.kind, 'version-conflict');
        return true;
    });
    assert.equal(calls, 1);
});

test('429 and auth errors are classified for safe abort handling', () => {
    assert.equal(classifyDirectAlexaError(new Error('HTTP 429 Too Many Requests')).kind, 'throttled');
    assert.equal(classifyDirectAlexaError(new Error('401 Unauthorized')).kind, 'authentication');
});

test('local Alexa2 auth is reused without logging credentials', async () => {
    let options;
    const logs = [];
    class Remote {
        init(value, callback) { options = value; callback(); }
        getLists(callback) { callback(null, []); }
        getListItemsV2(_id, _options, callback) { callback(null, []); }
        httpsGet() {}
    }
    await AlexaDirectClient.connect({
        cookie: 'secret-cookie',
        csrf: 'secret-csrf',
        macDms: { private: true },
        alexaServiceHost: 'alexa.amazon.de',
        userAgent: 'agent',
        acceptLanguage: 'de-DE',
    }, () => Remote);
    assert.equal(options.cookie, 'secret-cookie');
    assert.equal(options.csrf, 'secret-csrf');
    assert.equal(options.setupProxy, false);
    assert.equal(options.usePushConnection, false);
    assert.equal(options.cookieRefreshInterval, 0);
    assert.equal(options.logger, undefined);
    assert.deepEqual(logs, []);
});
