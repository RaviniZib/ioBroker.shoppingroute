'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.ts'), 'utf8');

test('events for the actively sorted list are classified and never scheduled directly', () => {
    const stateChange = main.slice(main.indexOf('private async onStateChange'), main.indexOf('private onUnload'));
    const activeBranch = stateChange.slice(
        stateChange.indexOf('if (this.sortingListName === list.name)'),
        stateChange.indexOf('this.collectExternalListChange(list.name, state.val)'),
    );
    assert.match(activeBranch, /observeActiveListEvent\(state\.val\)/);
    assert.match(activeBranch, /return;/);
    assert.doesNotMatch(activeBranch, /scheduleSort|pendingLists/);
});

test('one final snapshot absorbs own refreshes and gives an unresolved external follow-up a full quiet phase', () => {
    const finalize = main.slice(
        main.indexOf('private async finalizeActiveListChangeTracking'),
        main.indexOf('private async sortList'),
    );
    assert.match(finalize, /const current = await this\.readList\(listName\)/);
    assert.match(finalize, /classifyExpectedListEvent\([\s\S]*tracker\.expectedValues,[\s\S]*tracker\.transition[\s\S]*settledListValues\.set/);
    assert.match(finalize, /else \{[\s\S]*collectExternalListChange/);
    assert.match(finalize, /beginVerifying/);
    assert.match(finalize, /finishVerifying\(verifying, Date\.now\(\), this\.sortStabilityDelayMs\)/);
});

test('header reconciliation stays inside one sortList run and waits for each list effect', () => {
    const headers = main.slice(
        main.indexOf('private async reconcileMarketHeaders'),
        main.indexOf('private visibleOrderRefreshIds'),
    );
    assert.match(main, /const headerActions = planMarketHeaderActions/);
    assert.match(headers, /for \(let actionIndex = 0; actionIndex < actions\.length;\)/);
    assert.match(headers, /for \(const createAction of createActions\)[\s\S]*applyMarketHeaderAction/);
    assert.match(headers, /waitForMarketHeaderAction/);
    assert.match(headers, /waitForMarketHeaderBatch/);
    assert.match(headers, /waitForHeaderCreateCommandConsumption/);
    assert.match(headers, /updateActiveListExpectation\(list\)/);
    assert.doesNotMatch(headers, /creationOrder\.shift/);
    assert.doesNotMatch(headers, /sortList\(|scheduleSort\(|scheduleAll\(/);
});

test('an unsettled header batch cannot request an autonomous follow-up run', () => {
    const headers = main.slice(
        main.indexOf('private async reconcileMarketHeaders'),
        main.indexOf('private visibleOrderRefreshIds'),
    );
    assert.match(headers, /for \(const createAction of createActions\)[\s\S]*applyMarketHeaderAction/);
    assert.match(headers, /unsettledHeaderTransitions\.set/);
    assert.doesNotMatch(headers, /requestSortFollowup|requestFollowup|armListLifecycle|scheduleAll|scheduleSort/);
    assert.doesNotMatch(main, /private requestSortFollowup/);
});

test('moving to idle removes the per-list timer and no idle timer is armed', () => {
    const setter = main.slice(main.indexOf('private setSortLifecycle'), main.indexOf('private armListLifecycle'));
    const armer = main.slice(main.indexOf('private armListLifecycle'), main.indexOf('private armCollectingLifecycles'));
    assert.match(setter, /lifecycle\.phase !== 'COLLECTING'[\s\S]*clearTimeout[\s\S]*sortTimers\.delete/);
    assert.match(armer, /lifecycleTimerDelay/);
    assert.match(armer, /delay === undefined[\s\S]*return/);
});

test('all consecutive header creates are submitted before one remote batch observation', () => {
    const headers = main.slice(
        main.indexOf('private async reconcileMarketHeaders'),
        main.indexOf('private visibleOrderRefreshIds'),
    );
    const createLoop = headers.indexOf('for (const createAction of createActions)');
    const createWrite = headers.indexOf('applyMarketHeaderAction(listName, createAction)', createLoop);
    const commandConsumption = headers.indexOf('waitForHeaderCreateCommandConsumption(commandStateId)', createWrite);
    const batchWait = headers.indexOf('waitForMarketHeaderBatch(', commandConsumption);
    assert.ok(createLoop >= 0 && createLoop < createWrite && createWrite < commandConsumption && commandConsumption < batchWait);
    assert.equal((headers.match(/waitForMarketHeaderBatch\(/g) || []).length, 1);
});
