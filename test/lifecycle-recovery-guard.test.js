'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.ts'), 'utf8');

test('shutdown synchronously blocks writes, clears runtime queues and preserves the journal', () => {
    const unload = main.slice(main.indexOf('private onUnload'), main.indexOf('private scheduleAll'));
    assert.match(unload, /this\.isUnloading = true;/);
    assert.match(unload, /this\.pendingLists\.clear\(\)/);
    assert.match(unload, /this\.pendingSortRequestedAt\.clear\(\)/);
    assert.doesNotMatch(unload, /persistSortTransaction/);

    const writer = main.slice(main.indexOf('private async writeAlexaState'), main.indexOf('private async waitForWriteBudget'));
    assert.match(writer, /assertAlexaWriteAllowed\(\)[\s\S]*setForeignStateAsync/);
});

test('visible marker confirmation is persisted before restore and shutdown blocks the restore write', () => {
    const visible = main.slice(
        main.indexOf('private async refreshVisibleAlexaOrder'),
        main.indexOf('private async persistSortTransaction'),
    );
    const confirmed = visible.indexOf('journal.confirmedSteps = 1;');
    const persisted = visible.indexOf('persistSortTransaction(journal);', confirmed);
    const restore = visible.indexOf('writeAlexaState(valueStateId, expectedValue);', persisted);
    assert.ok(confirmed >= 0 && confirmed < persisted && persisted < restore);
    assert.match(main, /private async writeAlexaState[\s\S]*assertAlexaWriteAllowed\(\)/);
});

test('journal clear is centralized and forbidden during shutdown or an open Alexa write', () => {
    const clear = main.slice(main.indexOf('private async clearSortTransaction'), main.indexOf('private async readSortTransaction'));
    assert.match(clear, /this\.isUnloading \|\| this\.activeAlexaWrites > 0/);
    assert.match(clear, /setStateAsync\('info\.sortTransaction', '\{\}', true\)/);
    assert.equal((main.match(/persistSortTransaction\(null\)/g) || []).length, 0);
});

test('startup recovery runs before lastError is cleared and before normal scheduling', () => {
    const ready = main.slice(main.indexOf('private async onReady'), main.indexOf('private async discoverAlexaLists'));
    const recovery = ready.indexOf('recoverInterruptedSortTransaction');
    assert.ok(recovery >= 0);
    assert.ok(recovery < ready.indexOf("setStateAsync('info.lastError', '', true)", recovery));
    assert.ok(recovery < ready.indexOf('scheduleAll(this.sortStabilityDelayMs)'));
});

test('unsafe aggregate-only recovery shortcut is removed', () => {
    assert.doesNotMatch(main, /transactionMatchesTarget/);
    assert.match(main, /waitForRecoveryTargetConsistency/);
    assert.match(main, /readAlexaWriteReadinessSnapshot/);
});

test('rollback never decrements the journal for missing, foreign or contradictory states', () => {
    const rollback = main.slice(
        main.indexOf('private async rollbackBufferedTransaction'),
        main.indexOf('private async recoverInterruptedSortTransaction'),
    );
    assert.match(rollback, /state === 'from'[\s\S]*confirmedSteps -= 1/);
    assert.match(rollback, /state !== 'to'[\s\S]*return false/);
    assert.doesNotMatch(rollback, /Rollback überspringt/);
    assert.doesNotMatch(rollback, /überschreibt extern geänderte/);
});

test('sort, pending processing, compatibility writes and header writes are recovery guarded', () => {
    assert.match(main, /private async processPendingSorts[\s\S]*this\.recoveryInProgress/);
    assert.match(main, /private async sortList[\s\S]*this\.recoveryInProgress/);
    assert.match(main, /private async runLiveCompatibilityTest[\s\S]*this\.recoveryInProgress/);
    assert.match(main, /private assertAlexaWriteAllowed[\s\S]*this\.recoveryInProgress && !this\.recoveryWritesAllowed/);
    assert.match(main, /private async applyMarketHeaderAction[\s\S]*writeAlexaState/);
});

test('sortNow during recovery only queues work because recovery prevents timer processing', () => {
    const stateChange = main.slice(main.indexOf('private async onStateChange'), main.indexOf('private onUnload'));
    const sortNow = stateChange.slice(
        stateChange.indexOf('control.sortNow'),
        stateChange.indexOf('control.compatibilityTest'),
    );
    assert.match(sortNow, /scheduleAll\(0, requestedAt\)/);
    assert.match(main, /private armSortTimer[\s\S]*this\.recoveryInProgress/);
    assert.match(main, /private async processPendingSorts[\s\S]*this\.recoveryInProgress/);
});

test('list changes during recovery are queued without arming a parallel sort', () => {
    const stateChange = main.slice(main.indexOf('private async onStateChange'), main.indexOf('private onUnload'));
    assert.match(
        stateChange,
        /if \(this\.recoveryInProgress\)[\s\S]*pendingLists\.add\(list\.name\)[\s\S]*return;[\s\S]*scheduleSort/,
    );
});
