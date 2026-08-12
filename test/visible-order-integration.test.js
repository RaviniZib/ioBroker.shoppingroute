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
    assert.match(main, /const markerBaseline = await this\.readAlexaWriteSnapshot\(listName, id\);/);
    assert.match(main, /const restoreBaseline = await this\.readAlexaWriteSnapshot\(listName, id\);/);
    assert.match(main, /if \(changes\.length === 0\)[\s\S]*visibleOrderRefreshIds\(list, plan\)/);
    const refreshStart = main.indexOf("private async refreshVisibleAlexaOrder");
    const refreshEnd = main.indexOf("private async persistSortTransaction", refreshStart);
    const refresh = main.slice(refreshStart, refreshEnd);
    assert.equal(
        [...refresh.matchAll(/await this\.writeAlexaState\(valueStateId, expectedValue\);/g)].length,
        1,
        "the final value must be written exactly once",
    );
    assert.ok(
        refresh.indexOf("if (markerConfirmation !== 'confirmed')") <
        refresh.indexOf("await this.writeAlexaState(valueStateId, expectedValue);"),
        "the exact original text is restored immediately after marker confirmation",
    );
    assert.doesNotMatch(refresh, /rollbackBufferedTransaction\(journal\)/);
    assert.match(refresh, /restored !== 'confirmed'[\s\S]*activateSortSafetyStop/);
    assert.match(
        refresh,
        /journal\.confirmedSteps = 2;[\s\S]*persistSortTransaction\(journal\);[\s\S]*persistSortTransaction\(null\);/,
    );
    assert.ok(
        refresh.indexOf("if (restored !== 'confirmed')") < refresh.indexOf("await this.persistSortTransaction(null);"),
        "the journal is cleared only after the restored value was confirmed",
    );
    assert.doesNotMatch(main, /Same-Value-Writes/);
});
