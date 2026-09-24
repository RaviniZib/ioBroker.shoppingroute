'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { AlexaDirectClient, DirectAlexaError, classifyDirectAlexaError } = require('../build/lib/alexa-direct');

const timerApi = {
    setTimeout(callback, timeout) { return setTimeout(callback, timeout); },
    clearTimeout(timeout) { clearTimeout(timeout); },
};

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
        callback(null, { itemInfo: { itemId: 'item-1', itemName: '25> Tomaten', version: 5, itemStatus: 'ACTIVE' } });
    }), timerApi);
    const result = await client.updateItem('list-1', 'item-1', 4, '25> Tomaten');
    assert.equal(result.version, 5);
    assert.match(calls[0].path, /items\/item-1\?version=4$/);
    assert.equal(calls[0].flags.method, 'PUT');
    assert.deepEqual(JSON.parse(calls[0].flags.data).itemAttributesToUpdate, [{ type: 'itemName', value: '25> Tomaten' }]);
});

test('batch CREATE sends every suffix item in one POST and validates failures', async () => {
    let call;
    const client = new AlexaDirectClient(fakeRemote((path, flags, callback) => {
        call = { path, flags };
        callback(null, {
            itemInfoList: [
                { itemId: 'a', itemName: '30> Milch', version: 1 },
                { itemId: 'b', itemName: '40> Eier', version: 1 },
            ],
            failures: [],
        });
    }), timerApi);
    const result = await client.batchCreate('list-1', ['30> Milch', '40> Eier']);
    assert.equal(result.items.length, 2);
    assert.equal(call.flags.method, 'POST');
    assert.equal(JSON.parse(call.flags.data).items.length, 2);

    const failed = new AlexaDirectClient(fakeRemote((_path, _flags, callback) => {
        callback(null, { itemInfoList: [], failures: [{ reason: 'bad' }] });
    }), timerApi);
    await assert.rejects(failed.batchCreate('list-1', ['30> Milch']), /Batch CREATE incomplete/);
});

test('DELETE is item-specific and version conflicts are never retried by the client', async () => {
    let calls = 0;
    const client = new AlexaDirectClient(fakeRemote((_path, _flags, callback) => {
        calls += 1;
        callback(new Error('HTTP 409 VersionMismatch'));
    }), timerApi);
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
    }, timerApi, () => Remote);
    assert.equal(options.cookie, 'secret-cookie');
    assert.equal(options.csrf, 'secret-csrf');
    assert.equal(options.setupProxy, false);
    assert.equal(options.usePushConnection, false);
    assert.equal(options.cookieRefreshInterval, 0);
    assert.equal(options.logger, undefined);
    assert.deepEqual(logs, []);
});

test('stalled Alexa list reads time out instead of hanging forever', async () => {
    const remote = fakeRemote(() => {});
    remote.getListItemsV2 = () => {};
    const client = new AlexaDirectClient(remote, timerApi, 'amazon.de', 20);
    await assert.rejects(client.getItems('list-1'), error => {
        assert.ok(error instanceof DirectAlexaError);
        assert.equal(error.kind, 'remote');
        assert.match(error.message, /Alexa list item lookup timed out after 20 ms/);
        return true;
    });
});

test('stalled Alexa initialization times out instead of blocking adapter startup', async () => {
    class Remote {
        init() {}
        getLists(callback) { callback(null, []); }
        getListItemsV2(_id, _options, callback) { callback(null, []); }
        httpsGet() {}
    }
    await assert.rejects(
        AlexaDirectClient.connect({ cookie: 'secret-cookie', alexaServiceHost: 'alexa.amazon.de' }, timerApi, () => Remote, 20),
        /Alexa initialization timed out after 20 ms/,
    );
});

test('every Alexa operation times out once without retrying or accepting a late callback', async () => {
    const operations = [
        client => client.getLists(),
        client => client.getItems('list-1'),
        client => client.updateItem('list-1', 'item-1', 1, 'Milk'),
        client => client.deleteItem('list-1', 'item-1', 1),
        client => client.batchCreate('list-1', ['Milk']),
    ];
    for (const operation of operations) {
        let expire;
        let lateCallback;
        let calls = 0;
        const capture = callback => { calls++; lateCallback = callback; };
        const remote = {
            getLists: capture,
            getListItemsV2: (_id, _options, callback) => capture(callback),
            httpsGet: (_path, callback) => capture(callback),
        };
        const timers = {
            setTimeout(callback, delay) { assert.equal(delay, 30000); expire = callback; return 1; },
            clearTimeout() { assert.fail('expired timer must not be cleared by a late callback'); },
        };
        const pending = operation(new AlexaDirectClient(remote, timers));
        const rejected = assert.rejects(pending, /timed out after 30000 ms/);
        expire();
        await rejected;
        lateCallback(null, []);
        lateCallback(new Error('late failure'));
        await assert.rejects(pending, /timed out after 30000 ms/);
        assert.equal(calls, 1);
    }
});

test('successful callbacks and synchronous failures clear the injected timer', async () => {
    for (const fail of [false, true]) {
        const cleared = [];
        const timers = {
            setTimeout() { return 42; },
            clearTimeout(handle) { cleared.push(handle); },
        };
        const remote = fakeRemote(() => {});
        if (fail) remote.getLists = () => { throw new Error('synchronous failure'); };
        const pending = new AlexaDirectClient(remote, timers).getLists();
        if (fail) await assert.rejects(pending, /synchronous failure/);
        else assert.deepEqual(await pending, [{ listId: 'list-1', name: 'SHOP' }]);
        assert.deepEqual(cleared, [42]);
    }
});

test('adapter shutdown refuses requests when ioBroker cannot create a timeout', async () => {
    const timers = {
        setTimeout() { return undefined; },
        clearTimeout() { assert.fail('no timer was created'); },
    };
    const remote = fakeRemote(() => assert.fail('no Amazon write may start during shutdown'));
    const client = new AlexaDirectClient(remote, timers);
    await assert.rejects(client.deleteItem('list-1', 'item-1', 1), /adapter is stopping/);
});
