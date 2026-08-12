"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { waitForConfirmation } = require("../build/lib/confirmation-wait");

test("confirmation returns immediately when Alexa2 already confirms", async () => {
    let probes = 0;
    let waitedMs = 0;
    const result = await waitForConfirmation({
        timeoutMs: 10000,
        pollIntervalMs: 100,
        probe: async () => {
            probes += 1;
            return "confirmed";
        },
        pause: async ms => { waitedMs += ms; },
    });

    assert.equal(result, "confirmed");
    assert.equal(probes, 1);
    assert.equal(waitedMs, 0);
});

test("confirmation follows a delayed Alexa2 acknowledgement without a fixed extra wait", async () => {
    let probes = 0;
    let waitedMs = 0;
    const result = await waitForConfirmation({
        timeoutMs: 10000,
        pollIntervalMs: 100,
        probe: async () => {
            probes += 1;
            return probes === 5 ? "confirmed" : "ambiguous";
        },
        pause: async ms => { waitedMs += ms; },
    });

    assert.equal(result, "confirmed");
    assert.equal(probes, 5);
    assert.equal(waitedMs, 400);
});

test("confirmation returns the real final state exactly at timeout", async () => {
    let probes = 0;
    let waitedMs = 0;
    const result = await waitForConfirmation({
        timeoutMs: 1000,
        pollIntervalMs: 100,
        probe: async () => {
            probes += 1;
            return "not-applied";
        },
        pause: async ms => { waitedMs += ms; },
    });

    assert.equal(result, "not-applied");
    assert.equal(waitedMs, 1000);
    assert.equal(probes, 11);
});
