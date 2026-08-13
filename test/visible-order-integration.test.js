"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("runtime finalizes Alexa visible order with journaled marker writes", () => {
    const main = fs.readFileSync(path.join(__dirname, "..", "src", "main.ts"), "utf8");
    assert.match(main, /createVisibleOrderRefreshPlan/);
    assert.match(main, /sortIdsByAlexaUpdatedTime/);
    assert.match(main, /refreshVisibleAlexaOrder/);
    assert.match(main, /updatedDateTime/);
    assert.match(main, /createVisibleOrderTouchProgram/);
    assert.match(main, /createVisibleOrderMarker\(transactionId, index, expectedValues\.values\(\)\)/);
    assert.doesNotMatch(main, /__SHOPPINGROUTE_REIHENFOLGE_/);
    assert.match(main, /await this\.persistSortTransaction\(journal\);[\s\S]*await this\.writeAlexaState\(valueStateId, marker\);/);
    assert.match(main, /await this\.writeAlexaState\(valueStateId, expectedValue\);/);
    assert.match(main, /items\.\$\{id\}\.version/);
    assert.match(main, /items\.\$\{id\}\.updatedDateTime/);
    assert.match(main, /classifyAlexaWriteConfirmation/);
    assert.match(
        main,
        /const visibleOrderPreference = \{[\s\S]*currentOrderIds: sortIdsByAlexaUpdatedTime\(active\),[\s\S]*desiredOrderIds:[\s\S]*createBufferedSortProgram\(plan, marker, visibleOrderPreference\)/,
        'normal content writes must be ordered to reduce later visible-order touches',
    );
    assert.match(main, /const markerBaseline = await this\.readAlexaWriteSnapshot\(listName, id\);/);
    assert.match(main, /const restoreBaseline = await this\.readAlexaWriteSnapshot\(listName, id\);/);
    assert.match(main, /if \(changes\.length === 0\)[\s\S]*visibleOrderRefreshIds\(list, plan\)/);
    const refreshStart = main.indexOf("private async refreshVisibleAlexaOrder");
    const refreshEnd = main.indexOf("private async persistSortTransaction", refreshStart);
    const refresh = main.slice(refreshStart, refreshEnd);
    const markerReady = refresh.indexOf('const markerReady = await this.waitForAlexaWriteReadiness');
    const markerWrite = refresh.indexOf('writeAlexaState(valueStateId, marker)');
    const markerSettlement = refresh.indexOf('const markerConfirmation = await this.waitForAlexaWriteSettlement');
    const restoreWrite = refresh.indexOf('writeAlexaState(valueStateId, expectedValue)');
    assert.ok(markerReady >= 0 && markerReady < markerWrite, 'marker write must wait for the original value readiness');
    assert.ok(markerSettlement > markerWrite && markerSettlement < restoreWrite, 'marker confirmation and readiness must settle before restore');
    assert.match(refresh.slice(markerReady, markerWrite), /expectedValue,[\s\S]*'marker'/);
    assert.match(
        refresh.slice(markerSettlement, restoreWrite),
        /markerBaseline,[\s\S]*'marker',[\s\S]*'restore'[\s\S]*if \(markerConfirmation !== 'confirmed'\)[\s\S]*activateSortSafetyStop/,
        'marker settlement timeout must stop before the restore write',
    );
    assert.doesNotMatch(refresh, /const restoreReady = await this\.waitForAlexaWriteReadiness/);
    assert.doesNotMatch(refresh, /await this\.wait\(this\.writePauseMs\)/);
    assert.equal(
        [...refresh.matchAll(/await this\.writeAlexaState\(valueStateId, expectedValue\);/g)].length,
        1,
        "the final value must be written exactly once",
    );
    assert.ok(
        refresh.indexOf("if (markerConfirmation !== 'confirmed')") <
        refresh.indexOf("await this.writeAlexaState(valueStateId, expectedValue);"),
        "the exact original text is restored only after marker confirmation and readiness settle together",
    );
    assert.match(
        refresh,
        /const restored = await this\.waitForAlexaValueConfirmation\([\s\S]*restoreBaseline,[\s\S]*'restore'/,
        'the final restore requires confirmation without an unnecessary final readiness wait',
    );
    assert.doesNotMatch(refresh, /rollbackBufferedTransaction\(journal\)/);
    assert.match(refresh, /restored !== 'confirmed'[\s\S]*activateSortSafetyStop/);
    assert.match(
        refresh,
        /journal\.confirmedSteps = 2;[\s\S]*persistSortTransaction\(journal\);[\s\S]*clearSortTransaction\(\)/,
    );
    assert.ok(
        refresh.indexOf("if (restored !== 'confirmed')") < refresh.indexOf("await this.clearSortTransaction()"),
        "the journal is cleared only after the restored value was confirmed",
    );
    assert.doesNotMatch(main, /Same-Value-Writes/);
});
