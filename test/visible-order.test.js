"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
    classifyVisibleOrderFinalConfirmation,
    createVisibleOrderMarker,
    createVisibleOrderRefreshPlan,
    createVisibleOrderTouchProgram,
    sortIdsByAlexaUpdatedTime,
} = require("../build/lib/buffered-sort");

test("visible-order final confirmation trusts the updated Alexa list JSON", () => {
    assert.equal(
        classifyVisibleOrderFinalConfirmation(
            "Lachsaufschnitt",
            "ShoppingRoute Reihenfolge msq9n6tkww5waqth 0",
            1786540000000,
            "Lachsaufschnitt",
            1786540005000,
            "Lachsaufschnitt",
            false,
        ),
        "confirmed",
    );
});

test("a genuine version mismatch without confirmed final JSON remains unconfirmed", () => {
    const marker = "ShoppingRoute Reihenfolge msq9n6tkww5waqth 0";
    assert.equal(
        classifyVisibleOrderFinalConfirmation("Lachsaufschnitt", marker, 1, marker, 2, marker, true),
        "not-applied",
    );
    assert.equal(
        classifyVisibleOrderFinalConfirmation("Lachsaufschnitt", marker, 1, "Extern geändert", 2, marker, false),
        "ambiguous",
    );
});

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

test("one misplaced element needs exactly one minimal touch", () => {
    const current = ["a", "c", "b"];
    const desired = ["a", "b", "c"];
    const touches = createVisibleOrderRefreshPlan(current, desired);

    assert.deepEqual(touches, ["c"]);
    assert.deepEqual(applyTouches(current, touches), desired);
});

test("reversed and cyclic orders use their mathematically minimal suffix", () => {
    assert.deepEqual(
        createVisibleOrderRefreshPlan(["e", "d", "c", "b", "a"], ["a", "b", "c", "d", "e"]),
        ["b", "c", "d", "e"],
    );
    assert.deepEqual(
        createVisibleOrderRefreshPlan(["c", "d", "a", "b"], ["a", "b", "c", "d"]),
        ["c", "d"],
    );
    assert.deepEqual(
        createVisibleOrderRefreshPlan(["b", "c", "d", "a"], ["a", "b", "c", "d"]),
        ["b", "c", "d"],
    );
});

test("duplicate texts do not affect minimal ordering because Alexa IDs are distinct", () => {
    const items = [
        { id: "milk-2", value: "Milch" },
        { id: "bread", value: "Brot" },
        { id: "milk-1", value: "Milch" },
    ];
    const desired = ["milk-1", "milk-2", "bread"];
    const touches = createVisibleOrderRefreshPlan(items.map(item => item.id), desired);

    assert.deepEqual(touches, ["milk-2", "bread"]);
    assert.deepEqual(applyTouches(items.map(item => item.id), touches), desired);
});

test("visible-order touch uses a real marker change and restores the exact original text", () => {
    const program = createVisibleOrderTouchProgram("aldi-header", "---- ALDI ----", "__ORDER_MARKER__");
    assert.equal(program.amazonWrites, 2);
    assert.deepEqual(program.steps, [
        { id: "aldi-header", from: "---- ALDI ----", to: "__ORDER_MARKER__", kind: "buffer", circuit: 1 },
        { id: "aldi-header", from: "__ORDER_MARKER__", to: "---- ALDI ----", kind: "final", circuit: 1 },
    ]);
});

test("visible-order touch rejects empty values and marker collisions", () => {
    assert.throws(() => createVisibleOrderTouchProgram("", "ALDI", "marker"), /Eintrags-ID/);
    assert.throws(() => createVisibleOrderTouchProgram("id", "", "marker"), /sichtbaren Text/);
    assert.throws(() => createVisibleOrderTouchProgram("id", "ALDI", "ALDI"), /kollidiert/);
});

test("visible-order marker contains only Alexa-compatible letters, digits and spaces", () => {
    const marker = createVisibleOrderMarker("msq8gg3y-unsafe_suffix", 0, []);
    assert.equal(marker, "ShoppingRoute Reihenfolge msq8gg3yunsafesuffix 0");
    assert.match(marker, /^[A-Za-z0-9ÄÖÜäöüß ]+$/);
    assert.doesNotMatch(marker, /_/);
    assert.equal(marker, marker.trim());
});

test("visible-order marker is unique per transaction and step and avoids real item collisions", () => {
    const first = createVisibleOrderMarker("msq8gg3y", 0, []);
    const nextStep = createVisibleOrderMarker("msq8gg3y", 1, []);
    const nextTransaction = createVisibleOrderMarker("msq8gg3z", 0, []);
    const collisionSafe = createVisibleOrderMarker("msq8gg3y", 0, [first, `${first} 1`]);

    assert.notEqual(first, nextStep);
    assert.notEqual(first, nextTransaction);
    assert.equal(collisionSafe, `${first} 2`);
    assert.ok(!new Set([first, `${first} 1`]).has(collisionSafe));
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

test("visible-order refresh plan is exhaustive-minimal through six distinct IDs", () => {
    function permutations(values) {
        if (values.length <= 1) return [values];
        return values.flatMap((value, index) => permutations(values.filter((_entry, other) => other !== index))
            .map(rest => [value, ...rest]));
    }

    for (let size = 1; size <= 6; size++) {
        const desired = Array.from({ length: size }, (_value, index) => `id${index}`);
        for (const current of permutations(desired)) {
            const touches = createVisibleOrderRefreshPlan(current, desired);
            assert.deepEqual(applyTouches(current, touches), desired);

            for (let mask = 0; mask < (1 << size); mask++) {
                const selected = desired.filter((_id, index) => (mask & (1 << index)) !== 0);
                if (selected.length >= touches.length) continue;
                assert.notDeepEqual(applyTouches(current, selected), desired);
            }
        }
    }
});

test("visible-order helper rejects mismatching or duplicate id sets", () => {
    assert.throws(() => createVisibleOrderRefreshPlan(["a", "b"], ["a", "c"]), /dieselben IDs/);
    assert.throws(() => createVisibleOrderRefreshPlan(["a", "a"], ["a", "a"]), /doppelte IDs/);
});
