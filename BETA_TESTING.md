# Beta testing ioBroker.shoppingroute 0.2.0-beta.4

This beta is intended for a small closed group of testers on different ioBroker/Alexa2 systems.

## Safety

- Dry-Run is enabled by default on new installations.
- The adapter still never uses `#New`, `#delete` or `completed`.
- Real sorting writes are blocked when Alexa2/alexa-remote2 write compatibility cannot be confirmed safely.
- The Alexa app must sort the shopping list by **Oldest to newest**.

## Recommended flow

1. Install the adapter and create an instance.
2. Verify the Alexa2 instance and list name.
3. Keep Dry-Run enabled.
4. Add a few test items through Alexa or the Alexa app.
5. Inspect `shoppingroute.0.info.lastPlan`.
6. Inspect `shoppingroute.0.info.compatibility`.
7. If `info.writeCapability` is `unknown`, set `shoppingroute.0.control.compatibilityTest` to `true` once while at least one active list item exists.
8. Only when `info.writeCapability` is `source-ok` or `live-ok`, disable Dry-Run for a small real sorting test.
9. Verify that adding and normally checking off items in the Alexa app still works.

The live test writes the **same visible `value` text** of one existing active item once and waits up to 10 seconds for Alexa2 to acknowledge it. It does not create, delete, complete or visibly rename an item.

For feedback include `info.compatibility`, `info.lastError`, `info.lastPlan` when relevant, and the related ioBroker log lines. Never include tokens or passwords.


## API/traffic diagnostics

During testing also monitor `shoppingroute.0.info.traffic`, especially `localChecks`, `sortRuns` and `alexaWrites`. This shows how many local checks and actual Alexa writes a typical household causes. Counters reset daily.
