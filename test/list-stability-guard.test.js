"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const main = fs.readFileSync(path.join(__dirname, "..", "src", "main.ts"), "utf8");

test("list stability guard uses a fixed 30-second minimum quiet window", () => {
    assert.match(main, /const LIST_STABILITY_MS = 30000;/);
    assert.match(main, /sortStabilityDelayMs\(\): number \{ return Math\.max\(this\.debounceMs, LIST_STABILITY_MS\); \}/);
});

test("all normal sort triggers wait for the stability window", () => {
    assert.match(main, /this\.scheduleSort\(list\.name, this\.sortStabilityDelayMs\);/);
    assert.match(main, /if \(state\.val === true\) this\.scheduleAll\(this\.sortStabilityDelayMs\);/);
    assert.match(main, /if \(this\.pendingLists\.size > 0\) this\.armSortTimer\(this\.sortStabilityDelayMs\);/);
    assert.equal((main.match(/this\.scheduleAll\(this\.sortStabilityDelayMs\);/g) || []).length, 5);
});

test("buffered transaction rolls back when a new active id appears", () => {
    assert.match(main, /beforeWrite\.addedIds\.length > 0[\s\S]*neuer aktiver Alexa-Listeneintrag[\s\S]*rollbackBufferedTransaction\(journal\)/);
    assert.doesNotMatch(main, /if \(beforeWrite\.addedIds\.length > 0\) sawAdditionalItems = true/);
});

test("visible-order finalization aborts on a new id before another same-value write", () => {
    const loopGuard = main.indexOf("Neuer aktiver Alexa-Listeneintrag während der Reihenfolge-Finalisierung erkannt");
    const sameValueWrite = main.indexOf("await this.writeAlexaState(valueStateId, expectedValue);", loopGuard);
    assert.ok(loopGuard >= 0);
    assert.ok(sameValueWrite > loopGuard);
    const guardWindow = main.slice(loopGuard, sameValueWrite);
    assert.match(guardWindow, /return \{ writes, interrupted: true, additionalItems \};/);
});
