const test = require('node:test');
const assert = require('node:assert/strict');
const { emptyTrafficMetrics, metricDate, normalizeTrafficMetrics } = require('../build/lib/metrics');

test('traffic metrics use the local calendar day and start at zero', () => {
    const now = new Date(2026, 7, 8, 12, 30, 0);
    const metrics = emptyTrafficMetrics(now);
    assert.equal(metrics.date, '2026-08-08');
    assert.equal(metrics.localChecks, 0);
    assert.equal(metrics.alexaWrites, 0);
});

test('traffic metrics are kept on the same day', () => {
    const now = new Date(2026, 7, 8, 12, 30, 0);
    const metrics = normalizeTrafficMetrics({
        date: metricDate(now),
        localChecks: 12,
        plannedChanges: 8,
        sortRuns: 3,
        alexaWrites: 7,
        compatibilityWrites: 1,
        abortedRuns: 2,
        lastAlexaWrite: 'x',
        lastSortRun: 'y',
    }, now);
    assert.equal(metrics.localChecks, 12);
    assert.equal(metrics.alexaWrites, 7);
    assert.equal(metrics.abortedRuns, 2);
});

test('traffic metrics reset automatically on a new day', () => {
    const now = new Date(2026, 7, 9, 0, 1, 0);
    const metrics = normalizeTrafficMetrics({ date: '2026-08-08', alexaWrites: 99 }, now);
    assert.equal(metrics.date, '2026-08-09');
    assert.equal(metrics.alexaWrites, 0);
});
