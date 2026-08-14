# Beta testing ioBroker.shoppingroute 0.2.0-beta.12

> **Archive notice:** This document describes the historical test phase for `0.2.0-beta.12`; it does not describe the adapter's current release stage.

This public beta is intended for testing on different ioBroker/Alexa2 systems.

## Safety

- Dry-Run is enabled by default on new installations.
- The adapter never writes Alexa2 list-item states or `completed`; it reuses the local Alexa2 login for direct requests.
- Direct sorting is blocked when the alexa-remote2 session cannot be initialized safely.
- The Alexa app must sort the shopping list by **A–Z**.

## Recommended flow

1. Install the adapter and create an instance.
2. Verify the Alexa2 instance and list name.
3. Keep Dry-Run enabled.
4. Add a few test items through Alexa or the Alexa app.
5. Inspect `shoppingroute.0.info.lastPlan`.
6. Inspect `shoppingroute.0.info.compatibility`.
7. Optionally set `shoppingroute.0.control.compatibilityTest` to `true` to perform a direct read-only connection check.
8. Only when `info.writeCapability` is `direct-ok`, disable Dry-Run for a small real sorting test.
9. Verify that adding and normally checking off items in the Alexa app still works.

The compatibility test only reads the configured list through the direct session. It does not create, delete, complete or rename an item.

For feedback include `info.compatibility`, `info.lastError`, `info.lastPlan` when relevant, and the related ioBroker log lines. Never include tokens or passwords.


## API/traffic diagnostics

During testing also monitor `shoppingroute.0.info.traffic`, especially `localChecks`, `sortRuns` and `alexaWrites`. This shows how many local checks and actual Alexa writes a typical household causes. Counters reset daily.
