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
    assert.match(finalize, /matchesExpected[\s\S]*settledListValues\.set/);
    assert.match(finalize, /else \{[\s\S]*collectExternalListChange/);
    assert.match(finalize, /deferAfterActiveSort\([\s\S]*sortStabilityDelayMs/);
    assert.match(finalize, /pendingSortNotBefore\.set\(listName, series\.quietUntil\)/);
});

test('header reconciliation stays inside one sortList run and waits for each list effect', () => {
    const headers = main.slice(
        main.indexOf('private async reconcileMarketHeaders'),
        main.indexOf('private visibleOrderRefreshIds'),
    );
    assert.match(headers, /for \(let actionIndex = 0;/);
    assert.match(headers, /applyMarketHeaderAction[\s\S]*waitForMarketHeaderAction/);
    assert.match(headers, /updateActiveListExpectation\(list\)/);
    assert.doesNotMatch(headers, /sortList\(|scheduleSort\(|scheduleAll\(/);
});
