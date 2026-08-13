export type DirectSortPhase = 'IDLE' | 'COLLECTING' | 'APPLYING';

export interface DirectSortLifecycle {
    phase: DirectSortPhase;
    firstEventAt: number;
    lastExternalAt: number;
    requestedAt: number;
    newIds: Set<string>;
    externalDirty: boolean;
}

export interface DirectCollectionResult {
    lifecycle: DirectSortLifecycle;
    deadline: number;
}

export function createDirectSortLifecycle(): DirectSortLifecycle {
    return {
        phase: 'IDLE',
        firstEventAt: 0,
        lastExternalAt: 0,
        requestedAt: 0,
        newIds: new Set(),
        externalDirty: false,
    };
}

export function collectDirectInput(
    current: DirectSortLifecycle,
    observedAt: number,
    addedIds: Iterable<string>,
    windowMs = 5000,
): DirectCollectionResult {
    const newIds = new Set(current.newIds);
    for (const id of addedIds) if (id) newIds.add(String(id));
    if (current.phase === 'APPLYING') {
        return {
            lifecycle: {
                ...current,
                newIds,
                lastExternalAt: observedAt,
                externalDirty: true,
            },
            deadline: Number.POSITIVE_INFINITY,
        };
    }
    const firstEventAt = current.phase === 'COLLECTING' ? current.firstEventAt : observedAt;
    const requestedAt = current.phase === 'COLLECTING' ? current.requestedAt : observedAt;
    return {
        lifecycle: {
            ...current,
            phase: 'COLLECTING',
            firstEventAt,
            lastExternalAt: observedAt,
            requestedAt,
            newIds,
            externalDirty: false,
        },
        deadline: newIds.size >= 2 ? observedAt : firstEventAt + Math.max(0, windowMs),
    };
}

export function beginDirectApply(current: DirectSortLifecycle): DirectSortLifecycle {
    if (current.phase !== 'COLLECTING') return current;
    return { ...current, phase: 'APPLYING', externalDirty: false };
}

export function finishDirectApply(current: DirectSortLifecycle, completedAt: number): DirectCollectionResult | undefined {
    if (!current.externalDirty) return undefined;
    const firstEventAt = current.lastExternalAt || completedAt;
    return {
        lifecycle: {
            ...createDirectSortLifecycle(),
            phase: 'COLLECTING',
            firstEventAt,
            lastExternalAt: firstEventAt,
            requestedAt: firstEventAt,
        },
        deadline: firstEventAt + 5000,
    };
}

export function collectionDue(lifecycle: DirectSortLifecycle, deadline: number, now: number): boolean {
    return lifecycle.phase === 'COLLECTING' && now >= deadline;
}
