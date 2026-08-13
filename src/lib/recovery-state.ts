import { isAlexaWriteReady, type AlexaWriteReadinessSnapshot } from './alexa-write-readiness';

export type RecoveryStepState = 'from' | 'to' | 'missing' | 'foreign' | 'ambiguous';

/**
 * Classifies an interrupted journal step only from a fully synchronized Alexa2 snapshot. A stale aggregate JSON
 * value, a lone item value or unacknowledged metadata can therefore never discard a persistent transaction.
 *
 * @param from Expected value before the journal step.
 * @param to Expected value after the journal step.
 * @param snapshot Current synchronized Alexa2 evidence.
 */
export function classifyRecoveryStepState(
    from: string,
    to: string,
    snapshot: AlexaWriteReadinessSnapshot,
): RecoveryStepState {
    const jsonValue = snapshot.json.value;
    const itemValue = snapshot.item.value;
    if (jsonValue === undefined || itemValue === undefined) return 'missing';

    const allowed = new Set([from, to]);
    if (!allowed.has(jsonValue) || !allowed.has(itemValue)) return 'foreign';
    if (jsonValue !== itemValue) return 'ambiguous';
    if (jsonValue === from) return isAlexaWriteReady(from, snapshot) ? 'from' : 'ambiguous';
    if (jsonValue === to) return isAlexaWriteReady(to, snapshot) ? 'to' : 'ambiguous';
    return 'ambiguous';
}
