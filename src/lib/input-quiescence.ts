export interface InputQuiescenceSeries {
    startedAt: number;
    lastExternalAt: number;
    quietUntil: number;
    lastExternalSignature: string;
    externalEventsCollected: number;
    quietTimerResets: number;
    sortListRuns: number;
    plansDiscardedBeforeWrite: number;
    rollbacksDueToExternalChange: number;
    suppressedSelfTriggers: number;
    amazonWrites: number;
}

export interface CollectedExternalChange {
    series: InputQuiescenceSeries;
    collected: boolean;
}

export function createInputQuiescenceSeries(startedAt: number): InputQuiescenceSeries {
    return {
        startedAt,
        lastExternalAt: 0,
        quietUntil: startedAt,
        lastExternalSignature: '',
        externalEventsCollected: 0,
        quietTimerResets: 0,
        sortListRuns: 0,
        plansDiscardedBeforeWrite: 0,
        rollbacksDueToExternalChange: 0,
        suppressedSelfTriggers: 0,
        amazonWrites: 0,
    };
}

/**
 * Adds a genuine external list snapshot to an input series and moves its quiet deadline.
 * Repeated delivery of the identical external snapshot is deliberately coalesced.
 *
 * @param current Existing input series, if one is already being collected.
 * @param signature Stable signature of the active IDs and values.
 * @param observedAt Timestamp of the external observation.
 * @param quietMs Required quiet interval after the latest observation.
 */
export function collectExternalChange(
    current: InputQuiescenceSeries | undefined,
    signature: string,
    observedAt: number,
    quietMs: number,
): CollectedExternalChange {
    if (current?.lastExternalSignature === signature) return { series: current, collected: false };
    if (!current || current.externalEventsCollected === 0) {
        return {
            collected: true,
            series: {
                ...createInputQuiescenceSeries(observedAt),
                startedAt: observedAt,
                lastExternalAt: observedAt,
                quietUntil: observedAt + quietMs,
                lastExternalSignature: signature,
                externalEventsCollected: 1,
                sortListRuns: current?.sortListRuns ?? 0,
                plansDiscardedBeforeWrite: current?.plansDiscardedBeforeWrite ?? 0,
                rollbacksDueToExternalChange: current?.rollbacksDueToExternalChange ?? 0,
                suppressedSelfTriggers: current?.suppressedSelfTriggers ?? 0,
                amazonWrites: current?.amazonWrites ?? 0,
            },
        };
    }
    return {
        collected: true,
        series: {
            ...current,
            lastExternalAt: observedAt,
            quietUntil: observedAt + quietMs,
            lastExternalSignature: signature,
            externalEventsCollected: current.externalEventsCollected + 1,
            quietTimerResets: current.quietTimerResets + 1,
        },
    };
}

/**
 * Starts a full new quiet phase after an active transactional section has stopped.
 *
 * @param current Existing input series.
 * @param observedAt Timestamp at which the active sort section stopped.
 * @param quietMs Required quiet interval after that point.
 */
export function deferAfterActiveSort(
    current: InputQuiescenceSeries,
    observedAt: number,
    quietMs: number,
): InputQuiescenceSeries {
    return {
        ...current,
        quietUntil: Math.max(current.quietUntil, observedAt + quietMs),
    };
}

export function recordSortListRun(current: InputQuiescenceSeries): InputQuiescenceSeries {
    return { ...current, sortListRuns: current.sortListRuns + 1 };
}

export function isInputQuiet(current: InputQuiescenceSeries, observedAt: number): boolean {
    return observedAt >= current.quietUntil;
}

export function activeValueSignature(values: ReadonlyMap<string, string>): string {
    return JSON.stringify([...values].sort(([left], [right]) => left.localeCompare(right)));
}
