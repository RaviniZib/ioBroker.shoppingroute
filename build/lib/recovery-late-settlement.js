"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyRecoveryLateSettlement = classifyRecoveryLateSettlement;
exports.observeRecoveryLateSettlement = observeRecoveryLateSettlement;
function numericValue(value) {
    if (typeof value === 'number')
        return Number.isFinite(value) ? value : undefined;
    if (typeof value !== 'string' || !value.trim())
        return undefined;
    const numeric = Number(value);
    if (Number.isFinite(numeric))
        return numeric;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : undefined;
}
function sameMetadata(left, right) {
    const leftVersion = numericValue(left.version);
    const rightVersion = numericValue(right.version);
    const leftUpdated = numericValue(left.updatedDateTime);
    const rightUpdated = numericValue(right.updatedDateTime);
    return leftVersion !== undefined &&
        rightVersion !== undefined &&
        leftVersion === rightVersion &&
        leftUpdated !== undefined &&
        rightUpdated !== undefined &&
        leftUpdated === rightUpdated;
}
function evidenceAdvanced(previous, current) {
    const previousVersion = numericValue(previous.version);
    const currentVersion = numericValue(current.version);
    const previousUpdated = numericValue(previous.updatedDateTime);
    const currentUpdated = numericValue(current.updatedDateTime);
    return (previousVersion !== undefined &&
        currentVersion !== undefined &&
        currentVersion > previousVersion) || (previousUpdated !== undefined &&
        currentUpdated !== undefined &&
        currentUpdated > previousUpdated);
}
function evidenceUnchanged(previous, current) {
    const previousVersion = numericValue(previous.version);
    const currentVersion = numericValue(current.version);
    const previousUpdated = numericValue(previous.updatedDateTime);
    const currentUpdated = numericValue(current.updatedDateTime);
    return previousVersion !== undefined &&
        currentVersion !== undefined &&
        previousVersion === currentVersion &&
        previousUpdated !== undefined &&
        currentUpdated !== undefined &&
        previousUpdated === currentUpdated;
}
function acknowledgedRemoteMetadata(evidence) {
    return evidence.versionAcknowledged === true && evidence.updatedDateTimeAcknowledged === true;
}
/**
 * Classifies the read-only observation after a recovery/rollback confirmation timeout. Unlike the normal confirmation
 * path, this deliberately requires both Alexa2 representations to converge on one newer acknowledged remote revision.
 *
 * @param from Expected source value before the rollback write.
 * @param to Target value written by the rollback.
 * @param baseline Alexa2 evidence captured immediately before the rollback write.
 * @param current Current read-only Alexa2 state evidence.
 * @returns Current late-settlement classification.
 */
function classifyRecoveryLateSettlement(from, to, baseline, current) {
    const jsonValue = current.json.value;
    const itemValue = current.item.value;
    const allowed = new Set([from, to]);
    if ((jsonValue !== undefined && !allowed.has(jsonValue)) ||
        (itemValue !== undefined && !allowed.has(itemValue)))
        return 'ambiguous';
    if (jsonValue === undefined || itemValue === undefined)
        return 'pending';
    const jsonAdvanced = evidenceAdvanced(baseline.json, current.json);
    const itemAdvanced = acknowledgedRemoteMetadata(current.item) &&
        evidenceAdvanced(baseline.item, current.item);
    if (jsonValue === to && itemValue === to) {
        if (current.json.acknowledged === true &&
            current.item.acknowledged === true &&
            acknowledgedRemoteMetadata(current.item) &&
            sameMetadata(current.json, current.item) &&
            (jsonAdvanced || itemAdvanced))
            return 'confirmed';
        return 'pending';
    }
    if (jsonValue === from && itemValue === from) {
        if (jsonAdvanced || itemAdvanced)
            return 'ambiguous';
        if (current.json.acknowledged === true &&
            current.item.acknowledged === true &&
            acknowledgedRemoteMetadata(current.item) &&
            sameMetadata(current.json, current.item) &&
            evidenceUnchanged(baseline.json, current.json) &&
            evidenceUnchanged(baseline.item, current.item))
            return 'not-applied';
        return 'pending';
    }
    const fromAdvanced = jsonValue === from ? jsonAdvanced : itemAdvanced;
    if (fromAdvanced)
        return 'ambiguous';
    return 'pending';
}
/**
 * Polls Alexa2 states only. A not-applied source state is intentionally observed until the complete extra timeout,
 * while a confirmed target or a true contradiction terminates immediately.
 *
 * @param options Observation inputs and timing callbacks.
 * @returns Final recovery write classification after settlement or timeout.
 */
async function observeRecoveryLateSettlement(options) {
    const timeoutMs = Math.max(0, options.timeoutMs);
    const pollIntervalMs = Math.max(1, options.pollIntervalMs);
    let elapsedMs = 0;
    let latest = 'pending';
    while (true) {
        if (options.shouldAbort?.())
            return 'ambiguous';
        latest = classifyRecoveryLateSettlement(options.from, options.to, options.baseline, await options.probe());
        if (latest === 'confirmed' || latest === 'ambiguous')
            return latest;
        if (elapsedMs >= timeoutMs)
            return latest === 'not-applied' ? 'not-applied' : 'ambiguous';
        const delayMs = Math.min(pollIntervalMs, timeoutMs - elapsedMs);
        await options.pause(delayMs);
        elapsedMs += delayMs;
    }
}
//# sourceMappingURL=recovery-late-settlement.js.map