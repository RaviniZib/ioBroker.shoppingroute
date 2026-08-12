"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const main = fs.readFileSync(path.join(__dirname, "..", "src", "main.ts"), "utf8");

test("list stability guard uses the configured debounce with a five-second safe minimum", () => {
    assert.match(main, /const LIST_STABILITY_MS = 5000;/);
    assert.match(main, /sortStabilityDelayMs\(\): number \{ return Math\.max\(this\.debounceMs, LIST_STABILITY_MS\); \}/);
});

test("sort confirmation waits are adaptive and recovery has no fixed startup sleep", () => {
    assert.match(main, /const ALEXA_CONFIRMATION_TIMEOUT_MS = 10000;/);
    assert.match(main, /const ALEXA_CONFIRMATION_POLL_MS = 100;/);
    assert.match(main, /waitForConfirmation/);
    assert.doesNotMatch(main, /await this\.wait\(3000\);/);
});

test("normal sort writes use adaptive Alexa2 readiness instead of a fixed pause", () => {
    const normalLoopStart = main.indexOf('for (let index = 0; index < program.steps.length; index++)');
    const normalLoopEnd = main.indexOf('const verifyList = await this.readList(listName);', normalLoopStart);
    const normalLoop = main.slice(normalLoopStart, normalLoopEnd);
    assert.match(normalLoop, /waitForAlexaWriteReadiness\(listName, step\.id, step\.from\)/);
    assert.ok(normalLoop.indexOf('waitForAlexaWriteReadiness') < normalLoop.indexOf('writeAlexaState(valueStateId, step.to)'));
    assert.doesNotMatch(normalLoop, /await this\.wait\(this\.writePauseMs\)/);
});

test("configured write pauses remain between visible-order and rollback writes", () => {
    assert.match(main, /if \(index \+ 1 < touchIds\.length\)/);
    assert.match(main, /if \(journal\.confirmedSteps > 0 && this\.writePauseMs > 0\)/);
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

test("visible-order finalization aborts on a new id before another marker write", () => {
    const loopGuard = main.indexOf("Neuer aktiver Alexa-Listeneintrag während der Reihenfolge-Finalisierung erkannt");
    const markerWrite = main.indexOf("await this.writeAlexaState(valueStateId, marker);", loopGuard);
    assert.ok(loopGuard >= 0);
    assert.ok(markerWrite > loopGuard);
    const guardWindow = main.slice(loopGuard, markerWrite);
    assert.match(guardWindow, /return \{ writes, interrupted: true, additionalItems \};/);
});
