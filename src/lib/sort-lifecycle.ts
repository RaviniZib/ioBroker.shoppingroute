export type SortLifecyclePhase = 'IDLE' | 'COLLECTING' | 'PLANNING' | 'EXECUTING' | 'VERIFYING';

export interface SortSeriesMetrics {
    startedAt: number;
    lastExternalAt: number;
    externalEvents: number;
    quietResets: number;
    sortListRuns: number;
    plansDiscardedBeforeWrite: number;
    rollbacksDueToExternalChange: number;
    suppressedSelfTriggers: number;
    amazonWrites: number;
}

export interface ListSortLifecycle {
    phase: SortLifecyclePhase;
    requestedAt: number;
    quietUntil: number;
    lastExternalSignature: string;
    externalDirty: boolean;
    metrics: SortSeriesMetrics;
}

function emptyMetrics(startedAt = 0): SortSeriesMetrics {
    return {
        startedAt,
        lastExternalAt: 0,
        externalEvents: 0,
        quietResets: 0,
        sortListRuns: 0,
        plansDiscardedBeforeWrite: 0,
        rollbacksDueToExternalChange: 0,
        suppressedSelfTriggers: 0,
        amazonWrites: 0,
    };
}

export function createListSortLifecycle(): ListSortLifecycle {
    return {
        phase: 'IDLE',
        requestedAt: 0,
        quietUntil: 0,
        lastExternalSignature: '',
        externalDirty: false,
        metrics: emptyMetrics(),
    };
}

export function collectExternalEvent(
    current: ListSortLifecycle,
    signature: string,
    observedAt: number,
    quietMs: number,
): { lifecycle: ListSortLifecycle; collected: boolean } {
    if (current.lastExternalSignature === signature) return { lifecycle: current, collected: false };

    const startsSeries = current.phase === 'IDLE';
    const startsExternalSeries = startsSeries || current.metrics.externalEvents === 0;
    const metrics = startsExternalSeries ? emptyMetrics(observedAt) : current.metrics;
    const externalEvents = metrics.externalEvents + 1;
    const collecting = current.phase === 'IDLE' || current.phase === 'COLLECTING';
    return {
        collected: true,
        lifecycle: {
            ...current,
            phase: startsSeries ? 'COLLECTING' : current.phase,
            requestedAt: startsExternalSeries ? observedAt : current.requestedAt,
            quietUntil: collecting ? observedAt + quietMs : current.quietUntil,
            lastExternalSignature: signature,
            externalDirty: collecting ? false : true,
            metrics: {
                ...metrics,
                lastExternalAt: observedAt,
                externalEvents,
                quietResets: metrics.quietResets + (externalEvents > 1 ? 1 : 0),
            },
        },
    };
}

export function requestSortRun(
    current: ListSortLifecycle,
    requestedAt: number,
    delayMs: number,
): ListSortLifecycle {
    if (current.phase === 'IDLE') {
        return {
            ...createListSortLifecycle(),
            phase: 'COLLECTING',
            requestedAt,
            quietUntil: requestedAt + Math.max(0, delayMs),
            metrics: emptyMetrics(requestedAt),
        };
    }
    if (current.phase === 'COLLECTING') {
        return {
            ...current,
            quietUntil: delayMs === 0
                ? requestedAt
                : Math.max(current.quietUntil, requestedAt + delayMs),
        };
    }
    return current;
}

export function beginPlanning(current: ListSortLifecycle, observedAt: number): ListSortLifecycle {
    if (current.phase !== 'COLLECTING' || observedAt < current.quietUntil) return current;
    return {
        ...current,
        phase: 'PLANNING',
        externalDirty: false,
        metrics: { ...current.metrics, sortListRuns: current.metrics.sortListRuns + 1 },
    };
}

export function beginExecuting(current: ListSortLifecycle): ListSortLifecycle {
    return current.phase === 'PLANNING' ? { ...current, phase: 'EXECUTING' } : current;
}

export function beginVerifying(current: ListSortLifecycle): ListSortLifecycle {
    return current.phase === 'PLANNING' || current.phase === 'EXECUTING'
        ? { ...current, phase: 'VERIFYING' }
        : current;
}

export function finishVerifying(
    current: ListSortLifecycle,
    observedAt: number,
    quietMs: number,
): ListSortLifecycle {
    if (current.phase !== 'VERIFYING') return current;
    if (current.externalDirty) {
        return {
            ...current,
            phase: 'COLLECTING',
            quietUntil: observedAt + quietMs,
            externalDirty: false,
        };
    }
    return {
        ...current,
        phase: 'IDLE',
        requestedAt: 0,
        quietUntil: 0,
        lastExternalSignature: '',
        externalDirty: false,
    };
}

export function recordSelfTrigger(current: ListSortLifecycle): ListSortLifecycle {
    return {
        ...current,
        metrics: { ...current.metrics, suppressedSelfTriggers: current.metrics.suppressedSelfTriggers + 1 },
    };
}

export function recordAmazonWrite(current: ListSortLifecycle): ListSortLifecycle {
    return { ...current, metrics: { ...current.metrics, amazonWrites: current.metrics.amazonWrites + 1 } };
}

export function recordPlanDiscard(current: ListSortLifecycle): ListSortLifecycle {
    return {
        ...current,
        metrics: {
            ...current.metrics,
            plansDiscardedBeforeWrite: current.metrics.plansDiscardedBeforeWrite + 1,
        },
    };
}

export function lifecycleTimerDelay(current: ListSortLifecycle, observedAt: number): number | undefined {
    return current.phase === 'COLLECTING' ? Math.max(0, current.quietUntil - observedAt) : undefined;
}

export function recordExternalRollback(current: ListSortLifecycle): ListSortLifecycle {
    if (!current.externalDirty) return current;
    return {
        ...current,
        metrics: {
            ...current.metrics,
            rollbacksDueToExternalChange: current.metrics.rollbacksDueToExternalChange + 1,
        },
    };
}

export function activeValueSignature(values: ReadonlyMap<string, string>): string {
    return JSON.stringify([...values].sort(([left], [right]) => left.localeCompare(right)));
}
