import type { AlexaListItem, MarketConfig } from './model';
import { isMarketHeader } from './market-plan';
import { stripSortPrefix } from './prefix-sort';

/**
 * Pure Bring!/Alexa reconciliation. Never writes to either provider.
 * Missing baseline means a non-destructive initial union.
 */
export type BringSyncMode = 'off' | 'import' | 'bring-only' | 'bidirectional';

export interface BridgeItem {
    key: string;
    name: string;
    specification: string;
    text: string;
    alexaId?: string;
    alexaVersion?: number;
}
export interface BridgeBaseline {
    version: 1;
    scope: string;
    mode: BringSyncMode;
    bring: string[];
    alexa: string[];
    pending?: {
        createdAt: string;
        bring: string[];
        alexa: string[];
    };
}
export interface BridgePlan {
    addToBring: BridgeItem[];
    removeFromBring: BridgeItem[];
    addToAlexa: BridgeItem[];
    removeFromAlexa: BridgeItem[];
    expectedBring: string[];
    expectedAlexa: string[];
    initial: boolean;
}
export function itemKey(name: string, specification = ''): string {
    const compact = (value: string): string => String(value || '').normalize('NFC')
        .trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE');
    return JSON.stringify([compact(name), compact(specification)]);
}
function item(name: unknown, specification: unknown, alexaId?: string, alexaVersion?: number): BridgeItem {
    if (typeof name !== 'string' || (specification != null && typeof specification !== 'string')) {
        throw new Error('Item must contain string name and specification.');
    }
    const n = name.trim();
    const spec = typeof specification === 'string' ? specification.trim() : '';
    if (!n || n.length > 250 || spec.length > 1000) throw new Error('Invalid or oversized shopping item.');
    return { key: itemKey(n, spec), name: n, specification: spec,
        text: spec ? n + ', ' + spec : n, alexaId, alexaVersion };
}
export function parseBringContent(raw: unknown): BridgeItem[] {
    const value: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(value)) throw new Error('Bring! content is not a JSON array.');
    if (value.length > 250) throw new Error('Bring! list exceeds the 250-item safety limit.');
    return value.map(entry => {
        if (!entry || typeof entry !== 'object' || typeof entry.name !== 'string') {
            throw new Error('Bring! item has no valid name.');
        }
        return item(entry.name, entry.specification);
    });
}
export function parseAlexaContent(list: AlexaListItem[], markets: MarketConfig[]): BridgeItem[] {
    return list.filter(entry => entry && entry.completed === false && entry.id).flatMap(entry => {
        const value = stripSortPrefix(String(entry.value || ''));
        if (!value || isMarketHeader(value, markets) || /^\d{2}[WCFHEURD][\p{L}\d]+$/iu.test(value)) return [];
        const comma = value.indexOf(',');
        const name = comma < 0 ? value : value.slice(0, comma);
        const specification = comma < 0 ? '' : value.slice(comma + 1);
        return [item(name, specification, String(entry.id), Number(entry.version))];
    });
}
export function indexBridgeItems(items: BridgeItem[], side: string): Map<string, BridgeItem> {
    const map = new Map<string, BridgeItem>();
    const names = new Map<string, string>();
    for (const entry of items) {
        const nameKey = itemKey(entry.name);
        if (map.has(entry.key) || names.has(nameKey)) {
            throw new Error(side + ': duplicate or ambiguous item "' + entry.name + '". Resolve manually.');
        }
        map.set(entry.key, entry);
        names.set(nameKey, entry.key);
    }
    return map;
}
export function reconcileBring(
    mode: BringSyncMode, previous: BridgeBaseline | null,
    bringItems: BridgeItem[], alexaItems: BridgeItem[],
): BridgePlan {
    if (mode !== 'import' && mode !== 'bidirectional') throw new Error('Invalid synchronization mode.');
    if (previous?.pending) throw new Error('Pending synchronization must be verified first.');
    const b = indexBridgeItems(bringItems, 'Bring!');
    const a = indexBridgeItems(alexaItems, 'Alexa');
    // Bring! treats the product name as its identity. Different specifications for
    // the same product are ambiguous and must never be silently overwritten.
    for (const bring of b.values()) {
        const other = alexaItems.find(entry => itemKey(entry.name) === itemKey(bring.name));
        if (other && other.key !== bring.key) {
            throw new Error('Conflicting specifications for "' + bring.name + '". Resolve manually.');
        }
    }
    const oldB = new Set(previous?.bring || []);
    const oldA = new Set(previous?.alexa || []);
    const desiredB = new Set(b.keys());
    const desiredA = new Set(a.keys());
    const universe = new Set([...oldB, ...oldA, ...b.keys(), ...a.keys()]);
    for (const key of universe) {
        const nowB = b.has(key);
        const nowA = a.has(key);
        if (!previous) {
            if (mode === 'bidirectional' && nowA) desiredB.add(key);
            if (nowB) desiredA.add(key);
            continue;
        }
        const bChanged = oldB.has(key) !== nowB;
        const aChanged = oldA.has(key) !== nowA;
        if (mode === 'import') {
            // Alexa-only changes are outside the scope of one-way mirroring.
            if (bChanged && nowB) desiredA.add(key);
            if (bChanged && !nowB && oldA.has(key)) desiredA.delete(key);
            if (!bChanged && nowB && !nowA && oldA.has(key)) {
                // Alexa removed its copy: do not recreate against an explicit user action.
                desiredA.delete(key);
            }
        } else if (bChanged && aChanged && nowB !== nowA) {
            throw new Error('Conflicting simultaneous changes; no automatic deletion.');
        } else if (bChanged && !aChanged) {
            if (nowB) desiredA.add(key); else desiredA.delete(key);
        } else if (aChanged && !bChanged) {
            if (nowA) desiredB.add(key); else desiredB.delete(key);
        } else if (bChanged && aChanged) {
            if (nowB) { desiredB.add(key); desiredA.add(key); }
            else { desiredB.delete(key); desiredA.delete(key); }
        } else if (nowB !== nowA) {
            throw new Error('Lists are inconsistent without a tracked change. Resync manually.');
        }
    }
    const all = new Map([...a, ...b]);
    const asItems = (keys: Iterable<string>): BridgeItem[] => [...keys].map(key => {
        const value = all.get(key);
        if (!value) throw new Error('Missing original item for synchronization.');
        return value;
    });
    const delta = (target: Set<string>, current: Map<string, BridgeItem>): BridgeItem[] =>
        asItems([...target].filter(key => !current.has(key)));
    const gone = (target: Set<string>, current: Map<string, BridgeItem>): BridgeItem[] =>
        [...current].filter(([key]) => !target.has(key)).map(([, value]) => value);
    return {
        addToBring: delta(desiredB, b), removeFromBring: gone(desiredB, b),
        addToAlexa: delta(desiredA, a), removeFromAlexa: gone(desiredA, a),
        expectedBring: [...desiredB].sort(), expectedAlexa: [...desiredA].sort(),
        initial: !previous,
    };
}
export function itemsMatchExpected(items: BridgeItem[], expected: string[]): boolean {
    return JSON.stringify([...indexBridgeItems(items, 'Verification').keys()].sort()) === JSON.stringify([...expected].sort());
}
export function serializeBridgeBaseline(baseline: BridgeBaseline): string {
    return JSON.stringify(baseline);
}
export function parseBridgeBaseline(raw: unknown): BridgeBaseline | null {
    if (raw == null || raw === '' || raw === '{}') return null;
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!value || typeof value !== 'object' || value.version !== 1 ||
        typeof value.scope !== 'string' || !Array.isArray(value.bring) || !Array.isArray(value.alexa) ||
        !value.bring.every((s: unknown) => typeof s === 'string') ||
        !value.alexa.every((s: unknown) => typeof s === 'string')) throw new Error('Invalid Bring! sync journal; manual recovery needed.');
    if (value.pending && (typeof value.pending.createdAt !== 'string' ||
        !Array.isArray(value.pending.bring) || !Array.isArray(value.pending.alexa) ||
        !value.pending.bring.every((s: unknown) => typeof s === 'string') ||
        !value.pending.alexa.every((s: unknown) => typeof s === 'string'))) {
        throw new Error('Invalid pending Bring! sync journal; manual recovery needed.');
    }
    return value as BridgeBaseline;
}


/**
 * One-shot visibility for stalled Bring!/Alexa bridge operations. No log output
 * during healthy polls. Returning a key lets callers suppress repeated reports.
 */
export interface BringSyncLogEvent {
    level: 'info' | 'warn' | 'error';
    key: string | null;
    message: string;
}
export function bringSyncLogEvent(
    status: string, description: string, previousKey: string | null,
    pendingSince?: string, nowMs = Date.now(),
): BringSyncLogEvent | null {
    if (status === 'blocked') {
        const key = 'blocked:' + description;
        return previousKey === key ? null : {
            level: 'error', key,
            message: '[Bring!-Sync] BLOCKIERT/BLOCKED: ' + description +
                ' Datenpunkt info.bringSyncStatus und Journal data.bringSyncJournal prüfen; nicht blind zurücksetzen.',
        };
    }
    if (status === 'verifying' && pendingSince) {
        const elapsed = nowMs - Date.parse(pendingSince);
        if (Number.isFinite(elapsed) && elapsed >= 180_000) {
            const key = 'confirmation-delayed';
            return previousKey === key ? null : {
                level: 'warn', key,
                message: '[Bring!-Sync] WARNUNG/WARNING: Provider-Bestätigung seit mindestens 3 Minuten ausstehend. ' +
                    'Weitere Änderungen können verzögert werden; info.bringSyncStatus prüfen.',
            };
        }
    }
    if (status === 'synced' && previousKey) {
        return {
            level: 'info', key: null,
            message: '[Bring!-Sync] OK: Abgleich wieder bestätigt / synchronization confirmed again.',
        };
    }
    return null;
}


/**
 * A pending bridge transaction may have finished its own writes even when
 * users changed unrelated items while the cloud snapshots were being
 * confirmed. Only acknowledge the transaction if EVERY change attempted
 * against the old baseline is visible on the correct provider. New changes
 * to untouched items remain pending for the NEXT reconciliation pass.
 *
 * This must never bypass confirmation of an incomplete or ambiguous write.
 *
 * @param previous Persisted bridge baseline and expected pending transaction.
 * @param bringItems Current acknowledged Bring! items.
 * @param alexaItems Current Alexa items.
 * @returns True only when every originally requested mutation is observable.
 */
export function pendingWritesConfirmedExceptConcurrent(
    previous: BridgeBaseline, bringItems: BridgeItem[], alexaItems: BridgeItem[],
): boolean {
    if (!previous.pending) return false;
    const actualBring = indexBridgeItems(bringItems, 'Bring!');
    const actualAlexa = indexBridgeItems(alexaItems, 'Alexa');
    let mutations = 0;
    const allPlannedMutationsPresent = (
        beforeKeys: string[], expectedKeys: string[], actual: Map<string, BridgeItem>,
    ): boolean => {
        const before = new Set(beforeKeys);
        const expected = new Set(expectedKeys);
        for (const key of new Set([...before, ...expected])) {
            if (before.has(key) === expected.has(key)) continue;
            mutations++;
            if (actual.has(key) !== expected.has(key)) return false;
        }
        return true;
    };
    return allPlannedMutationsPresent(previous.bring, previous.pending.bring, actualBring) &&
        allPlannedMutationsPresent(previous.alexa, previous.pending.alexa, actualAlexa) &&
        mutations > 0;
}
