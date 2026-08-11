"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("sort plan normalizes visible target whitespace before buffered permutation", () => {
    const sorterSource = fs.readFileSync(
        path.join(__dirname, "..", "src", "lib", "sorter.ts"),
        "utf8",
    );

    assert.match(
        sorterSource,
        /text:\s*String\(target\.parsed\.originalText\)\.trim\(\),/,
    );

    const source = [
        "Camembert",
        "Geflügelsalat",
        "Eiersalat",
        "Himbeerkonfitüre Frank Only",
        "---- LIDL ----",
    ];
    const rawTarget = [
        "---- LIDL ----",
        "Eiersalat",
        "Geflügelsalat",
        "Camembert ",
        "Himbeerkonfitüre Frank Only",
    ];
    const normalizedTarget = rawTarget.map(value => String(value).trim());

    const counts = values => {
        const result = new Map();
        for (const value of values) result.set(value, (result.get(value) || 0) + 1);
        return [...result.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    };

    assert.notDeepEqual(counts(source), counts(rawTarget));
    assert.deepEqual(counts(source), counts(normalizedTarget));
});
