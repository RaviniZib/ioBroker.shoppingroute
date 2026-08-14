import type { AlexaListItem } from './model';

declare const require: any;

type Callback = (error?: unknown, result?: any) => void;

interface AlexaRemoteLike {
    init(options: Record<string, unknown>, callback: Callback): void;
    getLists(callback: Callback): void;
    getListItemsV2(listId: string, options: { limit: number }, callback: Callback): void;
    httpsGet(path: string, callback: Callback, flags?: Record<string, unknown>): void;
    stopProxyServer?(callback?: () => void): void;
}

export interface Alexa2NativeAuth {
    cookie?: unknown;
    csrf?: unknown;
    cookieData?: unknown;
    macDms?: unknown;
    alexaServiceHost?: unknown;
    userAgent?: unknown;
    acceptLanguage?: unknown;
}

export interface DirectAlexaList {
    listId: string;
    name: string;
}

export interface DirectAmazonItem {
    itemId: string;
    listId?: string;
    itemName: string;
    itemStatus: string;
    version: number;
    createAt?: number;
    updateAt?: number;
}

export interface BatchCreateResult {
    items: DirectAmazonItem[];
    failures: unknown[];
}

export class DirectAlexaError extends Error {
    public readonly kind: 'throttled' | 'authentication' | 'version-conflict' | 'remote';

    public constructor(kind: DirectAlexaError['kind'], message: string) {
        super(message);
        this.name = 'DirectAlexaError';
        this.kind = kind;
    }
}

function messageOf(value: unknown): string {
    if (value instanceof Error) return value.message;
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value); } catch { return String(value); }
}

export function classifyDirectAlexaError(error: unknown): DirectAlexaError {
    const message = messageOf(error);
    if (/429|too many requests|rate exceeded|throttlingexception/i.test(message)) {
        return new DirectAlexaError('throttled', `Amazon rate limit: ${message}`);
    }
    if (/401|403|unauthori[sz]ed|authentication|cookie invalid/i.test(message)) {
        return new DirectAlexaError('authentication', `Amazon authentication: ${message}`);
    }
    if (/409|version.?mismatch|version.?conflict|conflict/i.test(message)) {
        return new DirectAlexaError('version-conflict', `Amazon version conflict: ${message}`);
    }
    return new DirectAlexaError('remote', `Amazon API: ${message}`);
}

function amazonPageFromHost(host: unknown): string {
    const value = (typeof host === 'string' ? host : '').trim().replace(/^https?:\/\//, '').split('/')[0];
    return value.startsWith('alexa.') ? value.slice('alexa.'.length) : 'amazon.de';
}

function callbackPromise<T>(invoke: (callback: Callback) => void): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        let settled = false;
        invoke((error, result) => {
            if (settled) return;
            settled = true;
            if (error) reject(classifyDirectAlexaError(error));
            else resolve(result as T);
        });
    });
}

function remoteFailure(result: unknown): DirectAlexaError | undefined {
    if (!result || typeof result !== 'object') return undefined;
    const record = result as Record<string, unknown>;
    const status = Number(record.statusCode || record.status || 0);
    const error = record.error || record.message || record.code || record.type;
    if (status >= 400 || error) return classifyDirectAlexaError({ status, error, result });
    return undefined;
}

function mapItem(raw: any): DirectAmazonItem {
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

export function toAlexaListItems(items: DirectAmazonItem[]): AlexaListItem[] {
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

export class AlexaDirectClient {
    private readonly remote: AlexaRemoteLike;
    private readonly amazonPage: string;

    public constructor(remote: AlexaRemoteLike, amazonPage = 'amazon.de') {
        this.remote = remote;
        this.amazonPage = amazonPage;
    }

    public static async connect(
        native: Alexa2NativeAuth,
        load: (id: string) => any = require,
    ): Promise<AlexaDirectClient> {
        let AlexaRemote: any;
        try { AlexaRemote = load('alexa-remote2'); }
        catch (firstError) {
            try { AlexaRemote = load('/opt/iobroker/node_modules/alexa-remote2'); }
            catch { throw classifyDirectAlexaError(firstError); }
        }
        const remote: AlexaRemoteLike = new AlexaRemote();
        const amazonPage = amazonPageFromHost(native.alexaServiceHost);
        let cookieData = native.cookieData;
        if (typeof cookieData === 'string' && cookieData.trim().startsWith('{')) {
            try { cookieData = JSON.parse(cookieData); } catch { /* alexa-remote2 can still consume the raw value */ }
        }
        const cookie = cookieData || native.cookie;
        if (!cookie) throw new DirectAlexaError('authentication', 'Alexa2 does not contain a reusable cookie.');
        await callbackPromise<void>(callback => remote.init({
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

    public close(): void {
        this.remote.stopProxyServer?.();
    }

    public async getLists(): Promise<DirectAlexaList[]> {
        const lists = await callbackPromise<any[]>(callback => this.remote.getLists(callback));
        return (Array.isArray(lists) ? lists : []).map(list => ({
            listId: String(list?.listId || list?.itemId || list?.id || ''),
            name: String(list?.name || list?.listName || list?.type || '').trim(),
        })).filter(list => list.listId && list.name);
    }

    public async getItems(listId: string): Promise<DirectAmazonItem[]> {
        const items = await callbackPromise<any[]>(callback => this.remote.getListItemsV2(listId, { limit: 100 }, callback));
        return (Array.isArray(items) ? items : []).map(mapItem).filter(item => item.itemId);
    }

    private async request(path: string, method: string, data?: unknown): Promise<any> {
        const result = await callbackPromise<any>(callback => this.remote.httpsGet(path, callback, {
            method,
            ...(data === undefined ? {} : { data: JSON.stringify(data) }),
        }));
        const failure = remoteFailure(result);
        if (failure) throw failure;
        return result;
    }

    public async updateItem(listId: string, itemId: string, version: number, value: string): Promise<DirectAmazonItem> {
        const result = await this.request(
            `https://www.${this.amazonPage}/alexashoppinglists/api/v2/lists/${encodeURIComponent(listId)}/items/${encodeURIComponent(itemId)}?version=${version}`,
            'PUT',
            { itemAttributesToUpdate: [{ type: 'itemName', value }], itemAttributesToRemove: [] },
        );
        const item = mapItem(result?.itemInfo || result?.itemInfoList?.[0]);
        if (!item.itemId || item.itemId !== itemId || item.itemName !== value || item.version <= version) {
            throw new DirectAlexaError('remote', `UPDATE response for ID ${itemId} does not unambiguously confirm the target value or new version.`);
        }
        return item;
    }

    public async deleteItem(listId: string, itemId: string, version: number): Promise<void> {
        const result = await this.request(
            `https://www.${this.amazonPage}/alexashoppinglists/api/v2/lists/${encodeURIComponent(listId)}/items/${encodeURIComponent(itemId)}?version=${version}`,
            'DELETE',
        );
        if (result?.success === false) throw classifyDirectAlexaError(result);
    }

    public async batchCreate(listId: string, values: string[]): Promise<BatchCreateResult> {
        if (!values.length) return { items: [], failures: [] };
        const result = await this.request(
            `https://www.${this.amazonPage}/alexashoppinglists/api/v2/lists/${encodeURIComponent(listId)}/items`,
            'POST',
            { items: values.map(itemName => ({ itemType: 'KEYWORD', itemName })) },
        );
        const failures = Array.isArray(result?.failures) ? result.failures : [];
        const items = (Array.isArray(result?.itemInfoList) ? result.itemInfoList : []).map(mapItem);
        if (failures.length || items.length !== values.length) {
            throw new DirectAlexaError('remote', `Batch CREATE incomplete: ${items.length}/${values.length}, failures=${failures.length}.`);
        }
        const expected = new Map<string, number>();
        const actual = new Map<string, number>();
        for (const value of values) expected.set(value, (expected.get(value) || 0) + 1);
        for (const item of items) {
            if (!item.itemId || !item.itemName) throw new DirectAlexaError('remote', 'Batch CREATE response does not contain an unambiguous item.');
            actual.set(item.itemName, (actual.get(item.itemName) || 0) + 1);
        }
        if (expected.size !== actual.size || [...expected].some(([value, count]) => actual.get(value) !== count)) {
            throw new DirectAlexaError('remote', 'Batch CREATE response does not contain exactly the requested values.');
        }
        return { items, failures };
    }
}
