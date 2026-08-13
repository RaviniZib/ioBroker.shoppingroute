'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.ts'), 'utf8');
const prefix = fs.readFileSync(path.join(root, 'src', 'lib', 'prefix-sort.ts'), 'utf8');

test('only one productive direct prefix path remains', () => {
    assert.match(main, /applyDirectSort/);
    assert.match(main, /client\.updateItem/);
    assert.match(main, /client\.deleteItem/);
    assert.match(main, /client\.batchCreate/);
    assert.doesNotMatch(main, /setForeignStateAsync/);
    assert.doesNotMatch(main, /ShoppingRoute (?:Puffer|Reihenfolge)/);
    assert.doesNotMatch(main, /createVisibleOrderRefreshPlan|refreshVisibleAlexaOrder|writeAlexaState|waitForAlexaWrite/);
    assert.doesNotMatch(prefix, /updatedDateTime|createdDateTime/);
});

test('collection applies immediately at two new IDs or five seconds after the first event', () => {
    assert.match(main, /const COLLECT_WINDOW_MS = 5000;/);
    assert.match(main, /collectDirectInput\(state, observedAt, addedIds, COLLECT_WINDOW_MS\)/);
    assert.match(main, /armCollectionDeadline/);
    assert.equal((main.match(/void this\.startApply\(listName\)/g) || []).length, 1);
});

test('APPLYING is exclusive and external changes create at most one new collection window', () => {
    assert.match(main, /collectDirectInput\(state, observedAt, addedIds, COLLECT_WINDOW_MS\)/);
    assert.match(main, /if \(this\.applyingListName\)/);
    assert.match(main, /if \(state\.externalDirty && !this\.isUnloading\)[\s\S]*finishDirectApply/);
    assert.match(main, /The active list's finally block arms every other collected list exactly once/);
    assert.doesNotMatch(main, /Date\.now\(\) \+ 1/);
    assert.doesNotMatch(main, /pendingLists|while \(.*sort|scheduleSort/);
});

test('own direct writes are absorbed by IDs and prefix-free text, including batch-created IDs', () => {
    assert.match(main, /private isOwnRefresh/);
    assert.match(main, /baselineOriginals/);
    assert.match(main, /createdOriginalCounts/);
    assert.match(main, /deletedIds/);
    assert.match(main, /if \(this\.isOwnRefresh\(state, current, observedAt\)\) return;/);
});

test('one final Amazon read verifies the complete APPLYING result and no state confirmation is used', () => {
    const apply = main.slice(main.indexOf('private async applyDirectSort'), main.indexOf('private buildOwnObservation'));
    const writeSection = apply.slice(apply.indexOf('for (const update'));
    assert.equal((writeSection.match(/readDirectItems\(listId, runtime\)/g) || []).length, 1);
    assert.match(writeSection, /verifyPrefixResult/);
    assert.doesNotMatch(writeSection, /getForeignState|waitFor/);
});

test('planning uses one fresh direct Amazon snapshot so every PUT/DELETE has the current version', () => {
    const apply = main.slice(main.indexOf('private async applyDirectSort'), main.indexOf('private buildOwnObservation'));
    assert.match(apply, /const snapshot = await this\.readDirectItems\(listId, runtime\)/);
    assert.doesNotMatch(apply, /getForeignStateAsync/);
});

test('legacy transaction markers are not recovered by the new architecture', () => {
    assert.match(main, /journal\.version !== 2/);
    assert.match(main, /Alte unterbrochene Marker-Transaktion/);
    assert.doesNotMatch(main, /rollbackBufferedTransaction|recoverInterruptedSortTransaction/);
});

test('compact runtime log contains every requested direct metric', () => {
    assert.match(main, /SHOP Direkt-Sortierung/);
    for (const label of ['externe neue Artikel', 'Debounce', 'PUTs', 'DELETEs', 'Batch-CREATE-Items', 'Amazon-Requests', 'Amazon', 'gesamt', 'Fallback', 'Rebuild ab']) {
        assert.ok(main.includes(label), label);
    }
});
