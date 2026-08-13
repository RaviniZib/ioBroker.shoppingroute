"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createListSortLifecycle = createListSortLifecycle;
exports.collectExternalEvent = collectExternalEvent;
exports.requestSortRun = requestSortRun;
exports.beginPlanning = beginPlanning;
exports.beginExecuting = beginExecuting;
exports.beginVerifying = beginVerifying;
exports.finishVerifying = finishVerifying;
exports.requestFollowup = requestFollowup;
exports.recordSelfTrigger = recordSelfTrigger;
exports.recordAmazonWrite = recordAmazonWrite;
exports.recordPlanDiscard = recordPlanDiscard;
exports.recordExternalRollback = recordExternalRollback;
exports.activeValueSignature = activeValueSignature;
function emptyMetrics(startedAt = 0) {
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
function createListSortLifecycle() {
    return {
        phase: 'IDLE',
        requestedAt: 0,
        quietUntil: 0,
        lastExternalSignature: '',
        externalDirty: false,
        followupRequested: false,
        metrics: emptyMetrics(),
    };
}
function collectExternalEvent(current, signature, observedAt, quietMs) {
    if (current.lastExternalSignature === signature)
        return { lifecycle: current, collected: false };
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
function requestSortRun(current, requestedAt, delayMs) {
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
    return { ...current, followupRequested: true };
}
function beginPlanning(current, observedAt) {
    if (current.phase !== 'COLLECTING' || observedAt < current.quietUntil)
        return current;
    return {
        ...current,
        phase: 'PLANNING',
        externalDirty: false,
        followupRequested: false,
        metrics: { ...current.metrics, sortListRuns: current.metrics.sortListRuns + 1 },
    };
}
function beginExecuting(current) {
    return current.phase === 'PLANNING' ? { ...current, phase: 'EXECUTING' } : current;
}
function beginVerifying(current) {
    return current.phase === 'PLANNING' || current.phase === 'EXECUTING'
        ? { ...current, phase: 'VERIFYING' }
        : current;
}
function finishVerifying(current, observedAt, quietMs) {
    if (current.phase !== 'VERIFYING')
        return current;
    if (current.externalDirty) {
        return {
            ...current,
            phase: 'COLLECTING',
            quietUntil: observedAt + quietMs,
            externalDirty: false,
            followupRequested: false,
        };
    }
    if (current.followupRequested) {
        const nextSeriesAt = Math.max(observedAt, current.metrics.lastExternalAt);
        return {
            ...current,
            phase: 'COLLECTING',
            requestedAt: nextSeriesAt,
            quietUntil: observedAt + quietMs,
            lastExternalSignature: '',
            externalDirty: false,
            followupRequested: false,
            metrics: emptyMetrics(nextSeriesAt),
        };
    }
    return {
        ...current,
        phase: 'IDLE',
        requestedAt: 0,
        quietUntil: 0,
        lastExternalSignature: '',
        externalDirty: false,
        followupRequested: false,
    };
}
function requestFollowup(current) {
    return { ...current, followupRequested: true };
}
function recordSelfTrigger(current) {
    return {
        ...current,
        metrics: { ...current.metrics, suppressedSelfTriggers: current.metrics.suppressedSelfTriggers + 1 },
    };
}
function recordAmazonWrite(current) {
    return { ...current, metrics: { ...current.metrics, amazonWrites: current.metrics.amazonWrites + 1 } };
}
function recordPlanDiscard(current) {
    return {
        ...current,
        followupRequested: true,
        metrics: {
            ...current.metrics,
            plansDiscardedBeforeWrite: current.metrics.plansDiscardedBeforeWrite + 1,
        },
    };
}
function recordExternalRollback(current) {
    if (!current.externalDirty)
        return current;
    return {
        ...current,
        metrics: {
            ...current.metrics,
            rollbacksDueToExternalChange: current.metrics.rollbacksDueToExternalChange + 1,
        },
    };
}
function activeValueSignature(values) {
    return JSON.stringify([...values].sort(([left], [right]) => left.localeCompare(right)));
}
//# sourceMappingURL=sort-lifecycle.js.map