import type { ConfirmationResult } from './confirmation-wait';
import {
    classifyAlexaWriteConfirmation,
    type AlexaWriteEvidence,
} from './alexa-write-confirmation';
import {
    isAlexaWriteReady,
    type AlexaWriteReadinessSnapshot,
} from './alexa-write-readiness';

export interface AlexaWriteSettlementBaseline {
    previousTs?: number;
    json?: AlexaWriteEvidence;
    item?: AlexaWriteEvidence;
}

export interface AlexaWriteSettlementState {
    confirmation: ConfirmationResult;
    ready: boolean;
}

function classifyLegacyConfirmation(
    from: string,
    to: string,
    previousTs: number,
    current: AlexaWriteReadinessSnapshot,
): ConfirmationResult {
    if (
        current.json.value === to &&
        current.item.value === to &&
        current.item.acknowledged === true &&
        Number(current.item.valueObservedAt || 0) >= previousTs
    ) return 'confirmed';
    if (
        current.json.value === from &&
        current.json.acknowledged === true &&
        current.item.value === from &&
        current.item.acknowledged === true
    ) return 'not-applied';
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
export function inspectAlexaWriteSettlement(
    from: string,
    to: string,
    baseline: AlexaWriteSettlementBaseline,
    current: AlexaWriteReadinessSnapshot,
): AlexaWriteSettlementState {
    const confirmation = baseline.json && baseline.item
        ? classifyAlexaWriteConfirmation(
            from,
            to,
            baseline.json,
            baseline.item,
            current.json,
            current.item,
        )
        : classifyLegacyConfirmation(from, to, Number(baseline.previousTs || 0), current);

    return {
        confirmation,
        ready: isAlexaWriteReady(to, current),
    };
}

export function classifyAlexaWriteSettlement(
    from: string,
    to: string,
    baseline: AlexaWriteSettlementBaseline,
    current: AlexaWriteReadinessSnapshot,
): ConfirmationResult {
    const state = inspectAlexaWriteSettlement(from, to, baseline, current);

    if (state.confirmation !== 'confirmed') return state.confirmation;
    return state.ready ? 'confirmed' : 'ambiguous';
}
