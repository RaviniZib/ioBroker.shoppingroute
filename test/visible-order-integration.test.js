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
    assert.match(main, /currentUpdated !== previousUpdated/);
    assert.match(main, /if \(changes\.length === 0\)[\s\S]*visibleOrderRefreshIds\(list, plan\)/);
    assert.match(main, /journal\.confirmedSteps = 2;[\s\S]*await this\.persistSortTransaction\(null\);/);
    assert.doesNotMatch(main, /Same-Value-Writes/);
});
