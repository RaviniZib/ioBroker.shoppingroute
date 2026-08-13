'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createBufferedSortMarker, createBufferedSortProgram } = require('../build/lib/buffered-sort');

function applyVisibleWrites(currentOrder, steps) {
    const order = [...currentOrder];
    for (const step of steps) {
        const index = order.indexOf(step.id);
        assert.ok(index >= 0, `unknown visible ID ${step.id}`);
        order.splice(index, 1);
        order.push(step.id);
    }
    return order;
}

function minimalTouches(current, desired) {
    let currentIndex = 0;
    let keepPrefix = 0;
    for (; keepPrefix < desired.length; keepPrefix++) {
        const found = current.indexOf(desired[keepPrefix], currentIndex);
        if (found < 0) break;
        currentIndex = found + 1;
    }
    return desired.slice(keepPrefix);
}

function visiblePreference(ids) {
    return { currentOrderIds: ids, desiredOrderIds: ids };
}

test('normal buffer marker contains only Alexa-compatible letters, digits and spaces', () => {
    const marker = createBufferedSortMarker('msqakdsi-unsafe_suffix', 0, []);
    assert.equal(marker, 'ShoppingRoute Puffer msqakdsiunsafesuffix 0');
    assert.match(marker, /^[A-Za-z0-9ÄÖÜäöüß ]+$/);
    assert.doesNotMatch(marker, /_/);
    assert.equal(marker, marker.trim());
});

test('normal buffer marker is unique per transaction and step and collision-safe', () => {
    const first = createBufferedSortMarker('msqakdsi', 0, []);
    assert.notEqual(first, createBufferedSortMarker('msqakdsi', 1, []));
    assert.notEqual(first, createBufferedSortMarker('msqakdsj', 0, []));
    assert.equal(createBufferedSortMarker('msqakdsi', 0, [first, `${first} 1`]), `${first} 2`);
});

test('buffer, final and reversed rollback steps reuse only the Alexa-compatible marker', () => {
    const marker = createBufferedSortMarker('msqakdsi', 0, ['Lachsaufschnitt', '---- ALDI ----']);
    const program = createBufferedSortProgram([
        { id: 'one', from: 'Lachsaufschnitt', to: '---- ALDI ----' },
        { id: 'two', from: '---- ALDI ----', to: 'Lachsaufschnitt' },
    ], marker);
    const rollback = [...program.steps].reverse().map(step => ({ from: step.to, to: step.from }));

    assert.equal(program.steps[0].kind, 'buffer');
    assert.equal(program.steps[0].to, marker);
    assert.equal(program.steps.at(-1).kind, 'final');
    assert.equal(program.steps.at(-1).from, marker);
    assert.equal(rollback[0].to, marker);
    assert.equal(rollback.at(-1).from, marker);
    assert.match(marker, /^[A-Za-z0-9ÄÖÜäöüß ]+$/);
});

function plan(source, target) {
    return source.map((from, index) => ({ id: `id${index}`, position: index + 1, from, to: target[index] }));
}

function applySteps(sourcePlan, program, limit = program.steps.length) {
    const values = new Map(sourcePlan.map(entry => [entry.id, entry.from]));
    for (const step of program.steps.slice(0, limit)) {
        assert.equal(values.get(step.id), step.from, `unerwarteter Ausgangswert bei ${step.id}`);
        values.set(step.id, step.to);
    }
    return values;
}

function valuesFor(sourcePlan, values) {
    return sourcePlan.map(entry => values.get(entry.id));
}

function counts(values) {
    const result = new Map();
    for (const value of values) result.set(value, (result.get(value) || 0) + 1);
    return result;
}

test('buffered sorter rotates a three-item cycle with one extra write', () => {
    const sourcePlan = plan(['A', 'B', 'C'], ['B', 'C', 'A']);
    const program = createBufferedSortProgram(sourcePlan, 'BUFFER');
    assert.equal(program.changedSlots, 3);
    assert.equal(program.circuits, 1);
    assert.equal(program.amazonWrites, 4);
    assert.deepEqual(valuesFor(sourcePlan, applySteps(sourcePlan, program)), ['B', 'C', 'A']);
});

test('content-write rotation removes the visible touch from a two-item swap', () => {
    const sourcePlan = plan(['A', 'B'], ['B', 'A']);
    const ids = sourcePlan.map(entry => entry.id);
    const baseline = createBufferedSortProgram(sourcePlan, 'BUFFER');
    const optimized = createBufferedSortProgram(sourcePlan, 'BUFFER', visiblePreference(ids));
    const baselineTouches = minimalTouches(applyVisibleWrites(ids, baseline.steps), ids);
    const optimizedTouches = minimalTouches(applyVisibleWrites(ids, optimized.steps), ids);

    assert.equal(baseline.amazonWrites, 3);
    assert.equal(optimized.amazonWrites, 3);
    assert.equal(baselineTouches.length, 1);
    assert.equal(optimizedTouches.length, 0);
    assert.equal(baseline.amazonWrites + baselineTouches.length * 2, 5);
    assert.equal(optimized.amazonWrites + optimizedTouches.length * 2, 3);
    assert.deepEqual(valuesFor(sourcePlan, applySteps(sourcePlan, optimized)), ['B', 'A']);
});

test('content-write rotation reduces a three-item cycle from two visible touches to one', () => {
    const sourcePlan = plan(['A', 'B', 'C'], ['B', 'C', 'A']);
    const ids = sourcePlan.map(entry => entry.id);
    const baseline = createBufferedSortProgram(sourcePlan, 'BUFFER');
    const optimized = createBufferedSortProgram(sourcePlan, 'BUFFER', visiblePreference(ids));
    const baselineTouches = minimalTouches(applyVisibleWrites(ids, baseline.steps), ids);
    const optimizedTouches = minimalTouches(applyVisibleWrites(ids, optimized.steps), ids);

    assert.equal(baseline.amazonWrites, 4);
    assert.equal(optimized.amazonWrites, 4);
    assert.equal(baselineTouches.length, 2);
    assert.equal(optimizedTouches.length, 1);
    assert.equal(baseline.amazonWrites + baselineTouches.length * 2, 8);
    assert.equal(optimized.amazonWrites + optimizedTouches.length * 2, 6);
    assert.deepEqual(valuesFor(sourcePlan, applySteps(sourcePlan, optimized)), ['B', 'C', 'A']);
});

test('independent content cycles are ordered to eliminate all later visible touches', () => {
    const sourcePlan = plan(['A', 'B', 'C', 'D'], ['B', 'A', 'D', 'C']);
    const ids = sourcePlan.map(entry => entry.id);
    const baseline = createBufferedSortProgram(sourcePlan, 'BUFFER');
    const optimized = createBufferedSortProgram(sourcePlan, 'BUFFER', visiblePreference(ids));
    const baselineTouches = minimalTouches(applyVisibleWrites(ids, baseline.steps), ids);
    const optimizedTouches = minimalTouches(applyVisibleWrites(ids, optimized.steps), ids);

    assert.equal(baseline.amazonWrites, optimized.amazonWrites);
    assert.equal(baselineTouches.length, 3);
    assert.equal(optimizedTouches.length, 0);
    assert.equal(baseline.amazonWrites + baselineTouches.length * 2, 12);
    assert.equal(optimized.amazonWrites + optimizedTouches.length * 2, 6);
    assert.deepEqual(valuesFor(sourcePlan, applySteps(sourcePlan, optimized)), ['B', 'A', 'D', 'C']);
});

test('duplicate texts retain distinct IDs and exact final values while reusing content writes for order', () => {
    const sourcePlan = plan(['A', 'A', 'B', 'B'], ['B', 'B', 'A', 'A']);
    const ids = sourcePlan.map(entry => entry.id);
    const baseline = createBufferedSortProgram(sourcePlan, 'BUFFER');
    const optimized = createBufferedSortProgram(sourcePlan, 'BUFFER', visiblePreference(ids));
    const baselineTouches = minimalTouches(applyVisibleWrites(ids, baseline.steps), ids);
    const optimizedTouches = minimalTouches(applyVisibleWrites(ids, optimized.steps), ids);

    assert.equal(optimized.amazonWrites, 5);
    assert.deepEqual(valuesFor(sourcePlan, applySteps(sourcePlan, optimized)), ['B', 'B', 'A', 'A']);
    assert.equal(new Set(applyVisibleWrites(ids, optimized.steps)).size, ids.length);
    assert.equal(baseline.amazonWrites + baselineTouches.length * 2, 11);
    assert.equal(optimized.amazonWrites + optimizedTouches.length * 2, 7);
});

test('target-aware Euler traversal minimizes a duplicate-value content cycle', () => {
    const sourcePlan = plan(['A', 'B', 'A', 'C', 'B', 'C'], ['B', 'C', 'B', 'A', 'C', 'A']);
    const ids = sourcePlan.map(entry => entry.id);
    const baseline = createBufferedSortProgram(sourcePlan, 'BUFFER');
    const optimized = createBufferedSortProgram(sourcePlan, 'BUFFER', visiblePreference(ids));
    const baselineTouches = minimalTouches(applyVisibleWrites(ids, baseline.steps), ids);
    const optimizedTouches = minimalTouches(applyVisibleWrites(ids, optimized.steps), ids);

    assert.equal(baseline.amazonWrites, 7);
    assert.equal(optimized.amazonWrites, 7);
    assert.equal(baselineTouches.length, 5);
    assert.equal(optimizedTouches.length, 1);
    assert.equal(baseline.amazonWrites + baselineTouches.length * 2, 17);
    assert.equal(optimized.amazonWrites + optimizedTouches.length * 2, 9);
    assert.deepEqual(valuesFor(sourcePlan, applySteps(sourcePlan, optimized)), ['B', 'C', 'B', 'A', 'C', 'A']);
});

test('duplicate values stay in one Euler circuit instead of creating extra swaps', () => {
    const sourcePlan = plan(['A', 'A', 'B', 'B'], ['B', 'B', 'A', 'A']);
    const program = createBufferedSortProgram(sourcePlan, 'BUFFER');
    assert.equal(program.changedSlots, 4);
    assert.equal(program.circuits, 1);
    assert.equal(program.amazonWrites, 5);
    assert.deepEqual(valuesFor(sourcePlan, applySteps(sourcePlan, program)), ['B', 'B', 'A', 'A']);
});

test('disconnected value cycles use exactly one buffer write per circuit', () => {
    const sourcePlan = plan(['A', 'B', 'C', 'D', 'E', 'F'], ['B', 'A', 'D', 'C', 'F', 'E']);
    const program = createBufferedSortProgram(sourcePlan, 'BUFFER');
    assert.equal(program.changedSlots, 6);
    assert.equal(program.circuits, 3);
    assert.equal(program.amazonWrites, 9);
});

test('unchanged slots are never written', () => {
    const sourcePlan = plan(['A', 'B', 'C', 'D'], ['A', 'C', 'B', 'D']);
    const program = createBufferedSortProgram(sourcePlan, 'BUFFER');
    assert.equal(program.changedSlots, 2);
    assert.ok(program.steps.every(step => step.id === 'id1' || step.id === 'id2'));
});

test('intermediate states never amplify a real list value', () => {
    const sourcePlan = plan(['A', 'A', 'B', 'B', 'C'], ['B', 'B', 'A', 'A', 'C']);
    const program = createBufferedSortProgram(sourcePlan, 'BUFFER');
    const originalCounts = counts(sourcePlan.map(entry => entry.from));
    for (let written = 0; written <= program.steps.length; written++) {
        const current = valuesFor(sourcePlan, applySteps(sourcePlan, program, written));
        assert.ok(current.filter(value => value === 'BUFFER').length <= 1);
        const currentCounts = counts(current.filter(value => value !== 'BUFFER'));
        for (const [value, count] of currentCounts) {
            assert.ok(count <= (originalCounts.get(value) || 0), `${value} wurde künstlich vervielfältigt`);
        }
    }
});

test('reversing every confirmed prefix restores the exact original list', () => {
    const sourcePlan = plan(['A', 'A', 'B', 'B', 'C', 'D'], ['B', 'B', 'A', 'A', 'D', 'C']);
    const program = createBufferedSortProgram(sourcePlan, 'BUFFER');
    for (let confirmed = 0; confirmed < program.steps.length; confirmed++) {
        const values = applySteps(sourcePlan, program, confirmed);
        const rollback = program.steps.slice(0, confirmed).reverse();
        for (const step of rollback) {
            assert.equal(values.get(step.id), step.to);
            values.set(step.id, step.from);
        }
        assert.deepEqual(valuesFor(sourcePlan, values), sourcePlan.map(entry => entry.from));
    }
});

test('visible-order optimized journal prefixes remain exactly reversible', () => {
    const sourcePlan = plan(['A', 'B', 'C', 'D', 'E', 'F'], ['B', 'A', 'D', 'C', 'F', 'E']);
    const ids = sourcePlan.map(entry => entry.id);
    const program = createBufferedSortProgram(sourcePlan, 'BUFFER', visiblePreference(ids));

    for (let confirmed = 0; confirmed < program.steps.length; confirmed++) {
        const values = applySteps(sourcePlan, program, confirmed);
        for (const step of program.steps.slice(0, confirmed).reverse()) {
            assert.equal(values.get(step.id), step.to);
            values.set(step.id, step.from);
        }
        assert.deepEqual(valuesFor(sourcePlan, values), sourcePlan.map(entry => entry.from));
    }
});

test('content-order optimization never increases Amazon writes or remaining minimal touches', () => {
    let seed = 0x5eed1234;
    const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 2 ** 32;
    };
    const shuffle = values => {
        const result = [...values];
        for (let index = result.length - 1; index > 0; index--) {
            const other = Math.floor(random() * (index + 1));
            [result[index], result[other]] = [result[other], result[index]];
        }
        return result;
    };

    for (let run = 0; run < 500; run++) {
        const length = 2 + Math.floor(random() * 10);
        const source = Array.from({ length }, () => String.fromCharCode(65 + Math.floor(random() * Math.min(5, length))));
        const target = shuffle(source);
        const sourcePlan = plan(source, target);
        const desiredIds = sourcePlan.map(entry => entry.id);
        const currentIds = shuffle(desiredIds);
        const marker = `BUFFER_${run}`;
        const baseline = createBufferedSortProgram(sourcePlan, marker);
        const optimized = createBufferedSortProgram(sourcePlan, marker, {
            currentOrderIds: currentIds,
            desiredOrderIds: desiredIds,
        });
        const baselineTouches = minimalTouches(applyVisibleWrites(currentIds, baseline.steps), desiredIds);
        const optimizedTouches = minimalTouches(applyVisibleWrites(currentIds, optimized.steps), desiredIds);

        assert.equal(optimized.amazonWrites, baseline.amazonWrites);
        assert.ok(optimizedTouches.length <= baselineTouches.length);
        assert.deepEqual(valuesFor(sourcePlan, applySteps(sourcePlan, optimized)), target);
    }
});

test('random permutations with duplicate values always reach target without amplification', () => {
    let seed = 0x12345678;
    const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 2 ** 32;
    };
    for (let run = 0; run < 500; run++) {
        const length = 2 + Math.floor(random() * 20);
        const source = Array.from({ length }, () => String.fromCharCode(65 + Math.floor(random() * Math.min(7, length))));
        const target = [...source];
        for (let index = length - 1; index > 0; index--) {
            const other = Math.floor(random() * (index + 1));
            [target[index], target[other]] = [target[other], target[index]];
        }
        const sourcePlan = plan(source, target);
        const marker = `BUFFER_${run}`;
        const program = createBufferedSortProgram(sourcePlan, marker);
        assert.equal(program.amazonWrites, program.changedSlots + program.circuits);
        assert.deepEqual(valuesFor(sourcePlan, applySteps(sourcePlan, program)), target);
        const originalCounts = counts(source);
        for (let written = 0; written <= program.steps.length; written++) {
            const current = valuesFor(sourcePlan, applySteps(sourcePlan, program, written));
            assert.ok(current.filter(value => value === marker).length <= 1);
            const currentCounts = counts(current.filter(value => value !== marker));
            for (const [value, count] of currentCounts) assert.ok(count <= (originalCounts.get(value) || 0));
        }
    }
});

test('non-permutation plans and marker collisions are rejected before any write', () => {
    assert.throws(() => createBufferedSortProgram(plan(['A', 'B'], ['A', 'A']), 'BUFFER'), /keine reine Permutation/);
    assert.throws(() => createBufferedSortProgram(plan(['BUFFER', 'A'], ['A', 'BUFFER']), 'BUFFER'), /kollidiert/);
});
