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
    assert.match(normalLoop, /waitForAlexaWriteReadiness\([\s\S]*listName,[\s\S]*step\.id,[\s\S]*step\.from,[\s\S]*'content'/);
    assert.ok(normalLoop.indexOf('waitForAlexaWriteReadiness') < normalLoop.indexOf('writeAlexaState(valueStateId, step.to,'));
    assert.match(normalLoop, /index \+ 1 < program\.steps\.length[\s\S]*waitForAlexaWriteSettlement/);
    assert.match(normalLoop, /: await this\.waitForAlexaValueConfirmation/);
    assert.doesNotMatch(normalLoop, /await this\.wait\(this\.writePauseMs\)/);
});

test("all transactional item-write paths use readiness without fixed write pauses", () => {
    const visibleStart = main.indexOf('private async refreshVisibleAlexaOrder');
    const visibleEnd = main.indexOf('private async persistSortTransaction', visibleStart);
    const visible = main.slice(visibleStart, visibleEnd);
    assert.match(visible, /waitForAlexaWriteReadiness\([\s\S]*expectedValue,[\s\S]*'marker'/);
    assert.match(visible, /waitForAlexaWriteSettlement\([\s\S]*markerBaseline,[\s\S]*'marker',[\s\S]*'restore'/);
    assert.doesNotMatch(visible, /const restoreReady = await this\.waitForAlexaWriteReadiness/);
    assert.doesNotMatch(visible, /await this\.wait\(this\.writePauseMs\)/);

    const rollbackStart = main.indexOf('private async rollbackBufferedTransaction');
    const rollbackEnd = main.indexOf('private async recoverInterruptedSortTransaction', rollbackStart);
    const rollback = main.slice(rollbackStart, rollbackEnd);
    assert.match(rollback, /waitForRecoveryStepState\([\s\S]*journal\.listName,[\s\S]*step\.id,[\s\S]*step\.to/);
    assert.ok(rollback.indexOf('waitForRecoveryStepState') < rollback.indexOf('writeAlexaState(valueStateId, step.from,'));
    assert.match(rollback, /journal\.confirmedSteps > 1[\s\S]*waitForAlexaWriteSettlement/);
    assert.match(rollback, /: await this\.waitForAlexaValueConfirmation/);
    assert.match(rollback, /confirmation !== 'confirmed'[\s\S]*waitForRecoveryLateSettlement/);
    assert.doesNotMatch(rollback, /await this\.wait\(this\.writePauseMs\)/);
});

test("recovery cannot bypass the guarded rollback item writes", () => {
    const recoveryStart = main.indexOf('private async recoverInterruptedSortTransaction');
    const recoveryEnd = main.indexOf('private async activateSortSafetyStop', recoveryStart);
    const recovery = main.slice(recoveryStart, recoveryEnd);
    assert.match(recovery, /rollbackBufferedTransaction\(journal\)/);
    assert.doesNotMatch(recovery, /writeAlexaState\(/);
});

test("recovery reconciliation settles intermediate writes but does not require readiness after the final rollback", () => {
    const transactionStart = main.indexOf('private async reconcilePendingTransactionStep');
    const rollbackStart = main.indexOf('private async reconcilePendingRollbackStep', transactionStart);
    const bufferedRollbackStart = main.indexOf('private async rollbackBufferedTransaction', rollbackStart);
    const transaction = main.slice(transactionStart, rollbackStart);
    const rollback = main.slice(rollbackStart, bufferedRollbackStart);

    assert.match(transaction, /waitForRecoveryStepState/);
    assert.match(rollback, /waitForRecoveryStepState/);
    assert.match(rollback, /state === 'from'[\s\S]*confirmedSteps -= 1/);
    assert.match(rollback, /state === 'to'[\s\S]*return 'not-applied'/);
});

test("manual sortNow is scheduled immediately without the stability delay", () => {
    const sortNowStart = main.indexOf('if (id === `${local}control.sortNow`');
    const sortNowEnd = main.indexOf("if (id === `${local}control.compatibilityTest`", sortNowStart);
    const sortNow = main.slice(sortNowStart, sortNowEnd);
    assert.match(sortNow, /const requestedAt = Date\.now\(\);/);
    assert.match(sortNow, /this\.scheduleAll\(0, requestedAt\);/);
    assert.doesNotMatch(sortNow, /sortStabilityDelayMs/);
});

test("all automatic sort triggers retain the stability window", () => {
    assert.match(main, /collectExternalChange\([\s\S]*this\.sortStabilityDelayMs/);
    assert.match(main, /if \(state\.val === true\) this\.scheduleAll\(this\.sortStabilityDelayMs\);/);
    assert.match(main, /pendingSortNotBefore\.set\(listName, collected\.series\.quietUntil\)/);
    assert.match(main, /pendingSortNotBefore\.set\(listName, series\.quietUntil\)/);
    assert.equal((main.match(/this\.scheduleAll\(this\.sortStabilityDelayMs\);/g) || []).length, 4);
});

test('Alexa2 refreshes from the active list are absorbed before automatic scheduling', () => {
    const stateChange = main.slice(main.indexOf('private async onStateChange'), main.indexOf('private onUnload'));
    assert.match(
        stateChange,
        /sortingListName === list\.name[\s\S]*observeActiveListEvent\(state\.val\)[\s\S]*return;[\s\S]*collectExternalListChange/,
    );
    assert.doesNotMatch(main, /listChangedDuringSort/);
});

test("runtime measurement observes existing waits without changing polling or timeout", () => {
    const confirmationStart = main.indexOf('private async waitForAlexaValueConfirmation');
    const settlementStart = main.indexOf('private async waitForAlexaWriteSettlement', confirmationStart);
    const readinessStart = main.indexOf('private async waitForAlexaWriteReadiness', settlementStart);
    const reconciliationStart = main.indexOf('private async reconcilePendingTransactionStep', readinessStart);
    const confirmation = main.slice(confirmationStart, settlementStart);
    const settlement = main.slice(settlementStart, readinessStart);
    const readiness = main.slice(readinessStart, reconciliationStart);
    for (const waitPath of [confirmation, settlement, readiness]) {
        assert.match(waitPath, /timeoutMs,/);
        assert.match(waitPath, /pollIntervalMs: ALEXA_CONFIRMATION_POLL_MS/);
        assert.match(waitPath, /pause: ms => this\.wait\(ms\)/);
        assert.match(waitPath, /finally \{[\s\S]*recordAlexaWait(?:Runtime|Duration)/);
    }

    const measurementStart = main.indexOf('private recordAlexaWaitRuntime');
    const visibleStart = main.indexOf('private async refreshVisibleAlexaOrder', measurementStart);
    const measurement = main.slice(measurementStart, visibleStart);
    assert.doesNotMatch(measurement, /await |\.wait\(|setTimeout|setInterval/);
    assert.equal((main.match(/this\.logSortRuntime\(listName, runtime\);/g) || []).length, 1);
    assert.match(main, /Amazon-Writes gesamt \$\{series\.amazonWrites\}/);
    assert.match(main, /Inhalt \$\{runtime\.writes\.content\}, Header \$\{runtime\.writes\.header\}, Marker \$\{runtime\.writes\.marker\}/);
    assert.match(main, /Restore \$\{runtime\.writes\.restore\}, Rollback \$\{runtime\.writes\.rollback\}/);
    assert.match(main, /Eigen-Trigger \$\{series\.suppressedSelfTriggers\} resorbiert/);
    assert.match(main, /externe Events \$\{series\.externalEventsCollected\}/);
});

test('pending work is processed only after its per-list quiet deadline and never drained in a while loop', () => {
    const scheduler = main.slice(main.indexOf('private armSortTimer'), main.indexOf('private async isEnabled'));
    assert.match(scheduler, /pendingSortNotBefore\.get\(name\)/);
    assert.match(scheduler, /await this\.sortList\(listName, requestedAt\)/);
    assert.doesNotMatch(scheduler, /while \(this\.pendingLists\.size > 0\)/);
});

test('an external change can discard a stale plan before its first Alexa write', () => {
    assert.match(main, /class InputPlanSupersededError extends Error/);
    assert.match(main, /plansDiscardedBeforeWrite: runtime\.inputSeries\.plansDiscardedBeforeWrite \+ 1/);
    const write = main.slice(main.indexOf('private async writeAlexaState'), main.indexOf('private assertAlexaWriteAllowed'));
    assert.equal((write.match(/assertInputPlanCurrentBeforeFirstWrite\(\)/g) || []).length, 2);
    assert.match(main, /pendingLists\.has\(listName\)[\s\S]*Eingabeserie wurde unmittelbar vor dem Snapshot fortgesetzt/);
});

test("buffered transaction rolls back when a new active id appears", () => {
    assert.match(main, /beforeWrite\.addedIds\.length > 0[\s\S]*neuer aktiver Alexa-Listeneintrag[\s\S]*rollbackBufferedTransaction\(journal\)/);
    assert.doesNotMatch(main, /if \(beforeWrite\.addedIds\.length > 0\) sawAdditionalItems = true/);
});

test("visible-order finalization aborts on a new id before another marker write", () => {
    const loopGuard = main.indexOf("Neuer aktiver Alexa-Listeneintrag während der Reihenfolge-Finalisierung erkannt");
    const markerWrite = main.indexOf("await this.writeAlexaState(valueStateId, marker, 'marker');", loopGuard);
    assert.ok(loopGuard >= 0);
    assert.ok(markerWrite > loopGuard);
    const guardWindow = main.slice(loopGuard, markerWrite);
    assert.match(guardWindow, /return \{ writes, interrupted: true, additionalItems \};/);
});
