"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricDate = metricDate;
exports.emptyTrafficMetrics = emptyTrafficMetrics;
exports.normalizeTrafficMetrics = normalizeTrafficMetrics;
function metricDate(now = new Date()) {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
function emptyTrafficMetrics(now = new Date()) {
    return {
        date: metricDate(now),
        localChecks: 0,
        plannedChanges: 0,
        sortRuns: 0,
        alexaWrites: 0,
        compatibilityWrites: 0,
        abortedRuns: 0,
        lastAlexaWrite: '',
        lastSortRun: '',
    };
}
function normalizeTrafficMetrics(value, now = new Date()) {
    const fresh = emptyTrafficMetrics(now);
    if (!value || typeof value !== 'object')
        return fresh;
    const raw = value;
    if (String(raw.date || '') !== fresh.date)
        return fresh;
    return {
        date: fresh.date,
        localChecks: Math.max(0, Number(raw.localChecks) || 0),
        plannedChanges: Math.max(0, Number(raw.plannedChanges) || 0),
        sortRuns: Math.max(0, Number(raw.sortRuns) || 0),
        alexaWrites: Math.max(0, Number(raw.alexaWrites) || 0),
        compatibilityWrites: Math.max(0, Number(raw.compatibilityWrites) || 0),
        abortedRuns: Math.max(0, Number(raw.abortedRuns) || 0),
        lastAlexaWrite: String(raw.lastAlexaWrite || ''),
        lastSortRun: String(raw.lastSortRun || ''),
    };
}
//# sourceMappingURL=metrics.js.map