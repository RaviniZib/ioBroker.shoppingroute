"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inspectAlexaWriteSettlement = inspectAlexaWriteSettlement;
exports.classifyAlexaWriteSettlement = classifyAlexaWriteSettlement;
const alexa_write_confirmation_1 = require("./alexa-write-confirmation");
const alexa_write_readiness_1 = require("./alexa-write-readiness");
function classifyLegacyConfirmation(from, to, previousTs, current) {
    if (current.json.value === to &&
        current.item.value === to &&
        current.item.acknowledged === true &&
        Number(current.item.valueObservedAt || 0) >= previousTs)
        return 'confirmed';
    if (current.json.value === from &&
        current.json.acknowledged === true &&
        current.item.value === from &&
        current.item.acknowledged === true)
        return 'not-applied';
    return 'ambiguous';
}
/**
 * Classifies one shared post-write snapshot. Confirmation rules stay unchanged; a confirmed result is released for a
 * following write only after the same target snapshot also satisfies every Alexa2 readiness condition.
 *
 * @param from Expected value before the write.
 * @param to Written target value.
 * @param baseline Pre-write timestamp or versioned Alexa evidence.
 * @param current Current combined confirmation/readiness snapshot.
 * @returns The unchanged confirmation classification and the independently evaluated readiness result.
 */
function inspectAlexaWriteSettlement(from, to, baseline, current) {
    const confirmation = baseline.json && baseline.item
        ? (0, alexa_write_confirmation_1.classifyAlexaWriteConfirmation)(from, to, baseline.json, baseline.item, current.json, current.item)
        : classifyLegacyConfirmation(from, to, Number(baseline.previousTs || 0), current);
    return {
        confirmation,
        ready: (0, alexa_write_readiness_1.isAlexaWriteReady)(to, current),
    };
}
function classifyAlexaWriteSettlement(from, to, baseline, current) {
    const state = inspectAlexaWriteSettlement(from, to, baseline, current);
    if (state.confirmation !== 'confirmed')
        return state.confirmation;
    return state.ready ? 'confirmed' : 'ambiguous';
}
//# sourceMappingURL=alexa-write-settlement.js.map