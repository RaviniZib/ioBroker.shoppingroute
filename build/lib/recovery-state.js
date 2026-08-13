"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyRecoveryStepState = classifyRecoveryStepState;
const alexa_write_readiness_1 = require("./alexa-write-readiness");
/**
 * Classifies an interrupted journal step only from a fully synchronized Alexa2 snapshot. A stale aggregate JSON
 * value, a lone item value or unacknowledged metadata can therefore never discard a persistent transaction.
 *
 * @param from Expected value before the journal step.
 * @param to Expected value after the journal step.
 * @param snapshot Current synchronized Alexa2 evidence.
 */
function classifyRecoveryStepState(from, to, snapshot) {
    const jsonValue = snapshot.json.value;
    const itemValue = snapshot.item.value;
    if (jsonValue === undefined || itemValue === undefined)
        return 'missing';
    const allowed = new Set([from, to]);
    if (!allowed.has(jsonValue) || !allowed.has(itemValue))
        return 'foreign';
    if (jsonValue !== itemValue)
        return 'ambiguous';
    if (jsonValue === from)
        return (0, alexa_write_readiness_1.isAlexaWriteReady)(from, snapshot) ? 'from' : 'ambiguous';
    if (jsonValue === to)
        return (0, alexa_write_readiness_1.isAlexaWriteReady)(to, snapshot) ? 'to' : 'ambiguous';
    return 'ambiguous';
}
//# sourceMappingURL=recovery-state.js.map