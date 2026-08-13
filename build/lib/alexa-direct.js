"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlexaDirectClient = exports.DirectAlexaError = void 0;
exports.classifyDirectAlexaError = classifyDirectAlexaError;
exports.toAlexaListItems = toAlexaListItems;
class DirectAlexaError extends Error {
    kind;
    constructor(kind, message) {
        super(message);
        this.name = 'DirectAlexaError';
        this.kind = kind;
    }
}
exports.DirectAlexaError = DirectAlexaError;
function messageOf(value) {
    if (value instanceof Error)
        return value.message;
    if (typeof value === 'string')
        return value;
    try {
        return JSON.stringify(value);
    }
    catch {
        return String(value);
    }
}
function classifyDirectAlexaError(error) {
    const message = messageOf(error);
    if (/429|too many requests|rate exceeded|throttlingexception/i.test(message)) {
        return new DirectAlexaError('throttled', `Amazon-Rate-Limit: ${message}`);
    }
    if (/401|403|unauthori[sz]ed|authentication|cookie invalid/i.test(message)) {
        return new DirectAlexaError('authentication', `Amazon-Authentifizierung: ${message}`);
    }
    if (/409|version.?mismatch|version.?conflict|conflict/i.test(message)) {
        return new DirectAlexaError('version-conflict', `Amazon-Versionskonflikt: ${message}`);
    }
    return new DirectAlexaError('remote', `Amazon-API: ${message}`);
}
function amazonPageFromHost(host) {
    const value = (typeof host === 'string' ? host : '').trim().replace(/^https?:\/\//, '').split('/')[0];
    return value.startsWith('alexa.') ? value.slice('alexa.'.length) : 'amazon.de';
}
function callbackPromise(invoke) {
    return new Promise((resolve, reject) => {
        let settled = false;
        invoke((error, result) => {
            if (settled)
                return;
            settled = true;
            if (error)
                reject(classifyDirectAlexaError(error));
            else
                resolve(result);
        });
    });
}
function remoteFailure(result) {
    if (!result || typeof result !== 'object')
        return undefined;
    const record = result;
    const status = Number(record.statusCode || record.status || 0);
    const error = record.error || record.message || record.code || record.type;
    if (status >= 400 || error)
        return classifyDirectAlexaError({ status, error, result });
    return undefined;
}
function mapItem(raw) {
    return {
        itemId: String(raw?.itemId || raw?.id || ''),
        listId: raw?.listId ? String(raw.listId) : undefined,
        itemName: String(raw?.itemName ?? raw?.value ?? '').trim(),
        itemStatus: String(raw?.itemStatus || (raw?.completed ? 'COMPLETE' : 'ACTIVE')),
        version: Number(raw?.version || 0),
        createAt: raw?.createAt ?? raw?.createdDateTime,
        updateAt: raw?.updateAt ?? raw?.updatedDateTime,
    };
}
function toAlexaListItems(items) {
    return items.map(item => ({
        id: item.itemId,
        listId: item.listId,
        value: item.itemName,
        completed: item.itemStatus === 'COMPLETE',
        version: item.version,
        createdDateTime: item.createAt,
        updatedDateTime: item.updateAt,
    }));
}
class AlexaDirectClient {
    remote;
    amazonPage;
    constructor(remote, amazonPage = 'amazon.de') {
        this.remote = remote;
        this.amazonPage = amazonPage;
    }
    static async connect(native, load = require) {
        let AlexaRemote;
        try {
            AlexaRemote = load('alexa-remote2');
        }
        catch (firstError) {
            try {
                AlexaRemote = load('/opt/iobroker/node_modules/alexa-remote2');
            }
            catch {
                throw classifyDirectAlexaError(firstError);
            }
        }
        const remote = new AlexaRemote();
        const amazonPage = amazonPageFromHost(native.alexaServiceHost);
        let cookieData = native.cookieData;
        if (typeof cookieData === 'string' && cookieData.trim().startsWith('{')) {
            try {
                cookieData = JSON.parse(cookieData);
            }
            catch { /* alexa-remote2 can still consume the raw value */ }
        }
        const cookie = cookieData || native.cookie;
        if (!cookie)
            throw new DirectAlexaError('authentication', 'Alexa2 enthält kein wiederverwendbares Cookie.');
        await callbackPromise(callback => remote.init({
            cookie,
            csrf: native.csrf,
            formerRegistrationData: typeof cookieData === 'object' ? cookieData : undefined,
            macDms: native.macDms,
            alexaServiceHost: native.alexaServiceHost,
            userAgent: native.userAgent,
            acceptLanguage: native.acceptLanguage,
            amazonPage,
            setupProxy: false,
            usePushConnection: false,
            bluetooth: false,
            notifications: false,
            cookieRefreshInterval: 0,
        }, callback));
        return new AlexaDirectClient(remote, amazonPage);
    }
    close() {
        this.remote.stopProxyServer?.();
    }
    async getLists() {
        const lists = await callbackPromise(callback => this.remote.getLists(callback));
        return (Array.isArray(lists) ? lists : []).map(list => ({
            listId: String(list?.listId || list?.itemId || list?.id || ''),
            name: String(list?.name || list?.listName || list?.type || '').trim(),
        })).filter(list => list.listId && list.name);
    }
    async getItems(listId) {
        const items = await callbackPromise(callback => this.remote.getListItemsV2(listId, { limit: 100 }, callback));
        return (Array.isArray(items) ? items : []).map(mapItem).filter(item => item.itemId);
    }
    async request(path, method, data) {
        const result = await callbackPromise(callback => this.remote.httpsGet(path, callback, {
            method,
            ...(data === undefined ? {} : { data: JSON.stringify(data) }),
        }));
        const failure = remoteFailure(result);
        if (failure)
            throw failure;
        return result;
    }
    async updateItem(listId, itemId, version, value) {
        const result = await this.request(`https://www.${this.amazonPage}/alexashoppinglists/api/v2/lists/${encodeURIComponent(listId)}/items/${encodeURIComponent(itemId)}?version=${version}`, 'PUT', { itemAttributesToUpdate: [{ type: 'itemName', value }], itemAttributesToRemove: [] });
        const item = mapItem(result?.itemInfo || result?.itemInfoList?.[0]);
        if (!item.itemId || item.itemId !== itemId || item.itemName !== value || item.version <= version) {
            throw new DirectAlexaError('remote', `UPDATE-Antwort für ID ${itemId} bestätigt Zielwert oder neue Version nicht eindeutig.`);
        }
        return item;
    }
    async deleteItem(listId, itemId, version) {
        const result = await this.request(`https://www.${this.amazonPage}/alexashoppinglists/api/v2/lists/${encodeURIComponent(listId)}/items/${encodeURIComponent(itemId)}?version=${version}`, 'DELETE');
        if (result?.success === false)
            throw classifyDirectAlexaError(result);
    }
    async batchCreate(listId, values) {
        if (!values.length)
            return { items: [], failures: [] };
        const result = await this.request(`https://www.${this.amazonPage}/alexashoppinglists/api/v2/lists/${encodeURIComponent(listId)}/items`, 'POST', { items: values.map(itemName => ({ itemType: 'KEYWORD', itemName })) });
        const failures = Array.isArray(result?.failures) ? result.failures : [];
        const items = (Array.isArray(result?.itemInfoList) ? result.itemInfoList : []).map(mapItem);
        if (failures.length || items.length !== values.length) {
            throw new DirectAlexaError('remote', `Batch-CREATE unvollständig: ${items.length}/${values.length}, failures=${failures.length}.`);
        }
        const expected = new Map();
        const actual = new Map();
        for (const value of values)
            expected.set(value, (expected.get(value) || 0) + 1);
        for (const item of items) {
            if (!item.itemId || !item.itemName)
                throw new DirectAlexaError('remote', 'Batch-CREATE-Antwort enthält kein eindeutiges Item.');
            actual.set(item.itemName, (actual.get(item.itemName) || 0) + 1);
        }
        if (expected.size !== actual.size || [...expected].some(([value, count]) => actual.get(value) !== count)) {
            throw new DirectAlexaError('remote', 'Batch-CREATE-Antwort enthält nicht exakt die angeforderten Werte.');
        }
        return { items, failures };
    }
}
exports.AlexaDirectClient = AlexaDirectClient;
//# sourceMappingURL=alexa-direct.js.map