export interface TrafficMetrics {
    date: string;
    localChecks: number;
    plannedChanges: number;
    sortRuns: number;
    alexaWrites: number;
    compatibilityWrites: number;
    abortedRuns: number;
    lastAlexaWrite: string;
    lastSortRun: string;
}

export function metricDate(now = new Date()): string {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function emptyTrafficMetrics(now = new Date()): TrafficMetrics {
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

export function normalizeTrafficMetrics(value: unknown, now = new Date()): TrafficMetrics {
    const fresh = emptyTrafficMetrics(now);
    if (!value || typeof value !== 'object') return fresh;

    const raw = value as Partial<TrafficMetrics>;
    if (String(raw.date || '') !== fresh.date) return fresh;

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
