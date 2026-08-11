"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
    createVisibleOrderRefreshPlan,
    sortIdsByAlexaUpdatedTime,
} = require("../build/lib/buffered-sort");

function applyTouches(current, touches) {
    const touched = new Set(touches);
    return current.filter(id => !touched.has(id)).concat(touches);
}

test("live five-item case is reconstructed from updatedDateTime and needs only three order writes", () => {
    const items = [
        { id: "him", createdDateTime: 1786436197038, updatedDateTime: 1786446870704 },
        { id: "cam", createdDateTime: 1786433078797, updatedDateTime: 1786446868729 },
        { id: "gef", createdDateTime: 1786432995300, updatedDateTime: 1786446876944 },
        { id: "ei", createdDateTime: 1786432985063, updatedDateTime: 1786446879061 },
        { id: "header", createdDateTime: 1786430864436, updatedDateTime: 1786446872685 },
    ];
    const current = sortIdsByAlexaUpdatedTime(items);
    assert.deepEqual(current, ["cam", "him", "header", "gef", "ei"]);

    const desired = ["header", "ei", "gef", "cam", "him"];
    const touches = createVisibleOrderRefreshPlan(current, desired);
    assert.deepEqual(touches, ["gef", "cam", "him"]);
    assert.deepEqual(applyTouches(current, touches), desired);
});

test("already correct visible order needs no additional write", () => {
    const ids = ["header", "ei", "gef", "cam", "him"];
    assert.deepEqual(createVisibleOrderRefreshPlan(ids, ids), []);
});

test("visible-order refresh plan is minimal for random permutations", () => {
    function shuffled(values) {
        const result = [...values];
        for (let index = result.length - 1; index > 0; index--) {
            const other = Math.floor(Math.random() * (index + 1));
            [result[index], result[other]] = [result[other], result[index]];
        }
        return result;
    }

    for (let round = 0; round < 400; round++) {
        const size = 2 + Math.floor(Math.random() * 6);
        const ids = Array.from({ length: size }, (_value, index) => `id${index}`);
        const current = shuffled(ids);
        const desired = shuffled(ids);
        const touches = createVisibleOrderRefreshPlan(current, desired);
        assert.deepEqual(applyTouches(current, touches), desired);

        for (let mask = 0; mask < (1 << size); mask++) {
            const selected = ids.filter((_id, index) => (mask & (1 << index)) !== 0);
            if (selected.length >= touches.length) continue;
            const selectedSet = new Set(selected);
            const orderedTouches = desired.filter(id => selectedSet.has(id));
            assert.notDeepEqual(applyTouches(current, orderedTouches), desired);
        }
    }
});

test("visible-order helper rejects mismatching or duplicate id sets", () => {
    assert.throws(() => createVisibleOrderRefreshPlan(["a", "b"], ["a", "c"]), /dieselben IDs/);
    assert.throws(() => createVisibleOrderRefreshPlan(["a", "a"], ["a", "a"]), /doppelte IDs/);
});
