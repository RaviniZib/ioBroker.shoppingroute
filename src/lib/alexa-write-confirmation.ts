import type { ConfirmationResult } from './confirmation-wait';

export interface AlexaWriteEvidence {
    value?: string;
    version?: number | string;
    updatedDateTime?: number | string;
    acknowledged?: boolean;
    versionAcknowledged?: boolean;
    updatedDateTimeAcknowledged?: boolean;
}

export interface AlexaWriteSnapshot {
    json: AlexaWriteEvidence;
    item: AlexaWriteEvidence;
}

function numericValue(value: number | string | undefined): number | undefined {
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    if (typeof value !== 'string' || !value.trim()) return undefined;

    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;

    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : undefined;
}

function increased(previous: number | string | undefined, current: number | string | undefined): boolean {
    const previousValue = numericValue(previous);
    const currentValue = numericValue(current);
    return previousValue !== undefined && currentValue !== undefined && currentValue > previousValue;
}

function jsonAdvanced(previous: AlexaWriteEvidence, current: AlexaWriteEvidence): boolean {
    return increased(previous.version, current.version) ||
        increased(previous.updatedDateTime, current.updatedDateTime);
}

function itemAdvanced(previous: AlexaWriteEvidence, current: AlexaWriteEvidence): boolean {
    return (
        current.versionAcknowledged === true &&
        increased(previous.version, current.version)
    ) || (
        current.updatedDateTimeAcknowledged === true &&
        increased(previous.updatedDateTime, current.updatedDateTime)
    );
}

function olderThan(left: AlexaWriteEvidence, right: AlexaWriteEvidence): boolean {
    let comparable = false;
    let older = false;

    for (const key of ['version', 'updatedDateTime'] as const) {
        const leftValue = numericValue(left[key]);
        const rightValue = numericValue(right[key]);
        if (leftValue === undefined || rightValue === undefined) continue;
        comparable = true;
        if (leftValue > rightValue) return false;
        if (leftValue < rightValue) older = true;
    }

    return comparable && older;
}

export function classifyAlexaWriteConfirmation(
    from: string,
    to: string,
    previousJson: AlexaWriteEvidence,
    previousItem: AlexaWriteEvidence,
    currentJson: AlexaWriteEvidence,
    currentItem: AlexaWriteEvidence,
): ConfirmationResult {
    const currentJsonAdvanced = jsonAdvanced(previousJson, currentJson);
    const currentItemAdvanced = itemAdvanced(previousItem, currentItem);
    const jsonForeign = currentJson.value !== undefined &&
        currentJson.value !== from &&
        currentJson.value !== to;
    const itemForeign = currentItem.value !== undefined &&
        currentItem.value !== from &&
        currentItem.value !== to;

    const jsonConfirmed = currentJsonAdvanced &&
        currentJson.value === to &&
        currentJson.acknowledged === true;
    const itemConfirmed = currentItemAdvanced &&
        currentItem.value === to;

    if (jsonForeign || itemForeign) return 'ambiguous';
    if (
        currentJsonAdvanced &&
        currentJson.value !== to &&
        !(currentJson.value === from && itemConfirmed && olderThan(currentJson, currentItem))
    ) return 'ambiguous';
    if (
        currentItemAdvanced &&
        currentItem.value !== to &&
        !(currentItem.value === from && jsonConfirmed && olderThan(currentItem, currentJson))
    ) return 'ambiguous';

    if (jsonConfirmed || itemConfirmed) {
        return 'confirmed';
    }

    if (
        currentJson.value === from &&
        currentJson.acknowledged === true &&
        currentItem.value === from &&
        currentItem.acknowledged === true
    ) return 'not-applied';
    return 'ambiguous';
}
