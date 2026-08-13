const test = require('node:test');
const assert = require('node:assert/strict');

const {
    activeValueSignature,
    collectExternalChange,
    deferAfterActiveSort,
    isInputQuiet,
    recordSortListRun,
} = require('../build/lib/input-quiescence');

test('ten external additions reset one quiet series nine times and permit one run only after quiet', () => {
    let series;
    for (let index = 0; index < 10; index++) {
        const values = new Map(Array.from({ length: index + 1 }, (_, item) => [`id-${item}`, `item-${item}`]));
        const result = collectExternalChange(series, activeValueSignature(values), index * 1_000, 5_000);
        assert.equal(result.collected, true);
        series = result.series;
        assert.equal(isInputQuiet(series, index * 1_000), false);
        assert.equal(series.sortListRuns, 0);
        assert.equal(series.amazonWrites, 0);
    }

    assert.equal(series.externalEventsCollected, 10);
    assert.equal(series.quietTimerResets, 9);
    assert.equal(series.quietUntil, 14_000);
    assert.equal(isInputQuiet(series, 13_999), false);
    assert.equal(isInputQuiet(series, 14_000), true);
    series = recordSortListRun(series);
    assert.equal(series.sortListRuns, 1);
});

test('identical external snapshots are coalesced without extending the quiet deadline', () => {
    const first = collectExternalChange(undefined, 'same', 1_000, 5_000).series;
    const duplicate = collectExternalChange(first, 'same', 3_000, 5_000);

    assert.equal(duplicate.collected, false);
    assert.equal(duplicate.series.externalEventsCollected, 1);
    assert.equal(duplicate.series.quietTimerResets, 0);
    assert.equal(duplicate.series.quietUntil, 6_000);
});

test('an external change during sorting gets a full quiet phase after the active section', () => {
    let series = collectExternalChange(undefined, 'one', 0, 5_000).series;
    series = recordSortListRun(series);
    series = collectExternalChange(series, 'two', 6_000, 5_000).series;
    series = collectExternalChange(series, 'three', 7_000, 5_000).series;
    series = collectExternalChange(series, 'four', 8_000, 5_000).series;
    series = deferAfterActiveSort(series, 12_000, 5_000);

    assert.equal(series.externalEventsCollected, 4);
    assert.equal(series.quietTimerResets, 3);
    assert.equal(series.sortListRuns, 1);
    assert.equal(series.quietUntil, 17_000);
    assert.equal(isInputQuiet(series, 16_999), false);
    series = recordSortListRun(series);
    assert.equal(series.sortListRuns, 2);
});

test('a completed series gives the next external action a new start timestamp', () => {
    const completed = collectExternalChange(undefined, 'old', 1_000, 5_000).series;
    const next = collectExternalChange(undefined, 'new', 20_000, 5_000).series;

    assert.equal(completed.startedAt, 1_000);
    assert.equal(next.startedAt, 20_000);
    assert.equal(next.sortListRuns, 0);
});
