"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDirectSortLifecycle = createDirectSortLifecycle;
exports.collectDirectInput = collectDirectInput;
exports.beginDirectApply = beginDirectApply;
exports.finishDirectApply = finishDirectApply;
exports.collectionDue = collectionDue;
function createDirectSortLifecycle() {
    return {
        phase: 'IDLE',
        firstEventAt: 0,
        lastExternalAt: 0,
        requestedAt: 0,
        newIds: new Set(),
        externalDirty: false,
    };
}
function collectDirectInput(current, observedAt, addedIds, windowMs = 5000) {
    const newIds = new Set(current.newIds);
    for (const id of addedIds)
        if (id)
            newIds.add(String(id));
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
function beginDirectApply(current) {
    if (current.phase !== 'COLLECTING')
        return current;
    return { ...current, phase: 'APPLYING', externalDirty: false };
}
function finishDirectApply(current, completedAt) {
    if (!current.externalDirty)
        return undefined;
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
function collectionDue(lifecycle, deadline, now) {
    return lifecycle.phase === 'COLLECTING' && now >= deadline;
}
//# sourceMappingURL=direct-sort-lifecycle.js.map