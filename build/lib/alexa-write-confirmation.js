"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyAlexaWriteConfirmation = classifyAlexaWriteConfirmation;
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
function increased(previous, current) {
    const previousValue = numericValue(previous);
    const currentValue = numericValue(current);
    return previousValue !== undefined && currentValue !== undefined && currentValue > previousValue;
}
function jsonAdvanced(previous, current) {
    return increased(previous.version, current.version) ||
        increased(previous.updatedDateTime, current.updatedDateTime);
}
function itemAdvanced(previous, current) {
    return (current.versionAcknowledged === true &&
        increased(previous.version, current.version)) || (current.updatedDateTimeAcknowledged === true &&
        increased(previous.updatedDateTime, current.updatedDateTime));
}
function olderThan(left, right) {
    let comparable = false;
    let older = false;
    for (const key of ['version', 'updatedDateTime']) {
        const leftValue = numericValue(left[key]);
        const rightValue = numericValue(right[key]);
        if (leftValue === undefined || rightValue === undefined)
            continue;
        comparable = true;
        if (leftValue > rightValue)
            return false;
        if (leftValue < rightValue)
            older = true;
    }
    return comparable && older;
}
function classifyAlexaWriteConfirmation(from, to, previousJson, previousItem, currentJson, currentItem) {
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
    if (jsonForeign || itemForeign)
        return 'ambiguous';
    if (currentJsonAdvanced &&
        currentJson.value !== to &&
        !(currentJson.value === from && itemConfirmed && olderThan(currentJson, currentItem)))
        return 'ambiguous';
    if (currentItemAdvanced &&
        currentItem.value !== to &&
        !(currentItem.value === from && jsonConfirmed && olderThan(currentItem, currentJson)))
        return 'ambiguous';
    if (jsonConfirmed || itemConfirmed) {
        return 'confirmed';
    }
    if (currentJson.value === from &&
        currentJson.acknowledged === true &&
        currentItem.value === from &&
        currentItem.acknowledged === true)
        return 'not-applied';
    return 'ambiguous';
}
//# sourceMappingURL=alexa-write-confirmation.js.map