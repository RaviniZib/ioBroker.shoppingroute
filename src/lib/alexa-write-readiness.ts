import type { AlexaWriteEvidence, AlexaWriteSnapshot } from './alexa-write-confirmation';

export interface AlexaWriteReadinessSnapshot extends AlexaWriteSnapshot {
    jsonStable?: boolean;
    queueBarrierAcknowledged?: boolean;
    queueBarrierObservedAt?: number;
    json: AlexaWriteEvidence & {
        observedAt?: number;
    };
    item: AlexaWriteEvidence & {
        valueObservedAt?: number;
        versionObservedAt?: number;
        updatedDateTimeObservedAt?: number;
    };
}

function numericValue(value: number | string | undefined): number | undefined {
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    if (typeof value !== 'string' || !value.trim()) return undefined;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : undefined;
}

function sameMetadata(
    jsonValue: number | string | undefined,
    itemValue: number | string | undefined,
): boolean {
    const jsonNumeric = numericValue(jsonValue);
    const itemNumeric = numericValue(itemValue);
    return jsonNumeric !== undefined && itemNumeric !== undefined && jsonNumeric === itemNumeric;
}

function observedAfterJson(itemObservedAt: number | undefined, jsonObservedAt: number | undefined): boolean {
    return typeof itemObservedAt === 'number' &&
        Number.isFinite(itemObservedAt) &&
        typeof jsonObservedAt === 'number' &&
        Number.isFinite(jsonObservedAt) &&
        itemObservedAt >= jsonObservedAt;
}

/**
 * Alexa2's writable value callback closes over the complete item returned by getListItems(), including its version.
 * The individual states are written after Lists.<LIST>.json. Their state timestamps therefore prove that the callback
 * and its read-only metadata originate from the same (or a newer) Alexa2 refresh before another write is released.
 *
 * @param expectedValue Value which must still be current before the next write.
 * @param snapshot Independently read Alexa2 JSON, item-state and queue-barrier evidence.
 * @returns Whether Alexa2 has installed a synchronized write callback for the item.
 */
export function isAlexaWriteReady(
    expectedValue: string,
    snapshot: AlexaWriteReadinessSnapshot,
): boolean {
    return snapshot.jsonStable === true &&
        snapshot.queueBarrierAcknowledged === true &&
        observedAfterJson(snapshot.queueBarrierObservedAt, snapshot.json.observedAt) &&
        snapshot.json.acknowledged === true &&
        snapshot.json.value === expectedValue &&
        snapshot.item.acknowledged === true &&
        snapshot.item.value === expectedValue &&
        snapshot.item.versionAcknowledged === true &&
        snapshot.item.updatedDateTimeAcknowledged === true &&
        sameMetadata(snapshot.json.version, snapshot.item.version) &&
        sameMetadata(snapshot.json.updatedDateTime, snapshot.item.updatedDateTime) &&
        observedAfterJson(snapshot.item.valueObservedAt, snapshot.json.observedAt) &&
        observedAfterJson(snapshot.item.versionObservedAt, snapshot.json.observedAt) &&
        observedAfterJson(snapshot.item.updatedDateTimeObservedAt, snapshot.json.observedAt);
}
