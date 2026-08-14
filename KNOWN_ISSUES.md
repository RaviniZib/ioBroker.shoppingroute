# Known issues / compatibility notes

## Alexa2 / alexa-remote2 updateListItem compatibility

Earlier beta testing required a one-character correction in the installed `alexa-remote2` implementation so that Amazon accepted list item updates. The stable-release environment was verified with Alexa2 3.28.3 and alexa-remote2 8.1.0, where the affected `updateListItem` query is correct without local modification.

Observed malformed query:

```text
?version =${options.version}
```

Expected:

```text
?version=${options.version}
```

The adapter itself does **not** patch another adapter or its node_modules. Stable release 0.2.0 was verified against Alexa2 3.28.3 with alexa-remote2 8.1.0, where item value updates no longer require the earlier local correction.

## Alexa app sorting

The list in the Alexa app must be configured to **A–Z**. ShoppingRoute deliberately uses visible `00>`–`99>` prefixes because Alexa ignores invisible Unicode prefixes during alphabetic sorting.

## Direct-session guard

ShoppingRoute does not patch foreign modules. It reuses the locally stored Alexa2 authentication to initialize alexa-remote2 and performs direct item requests. `control.compatibilityTest` is read-only and reports `direct-ok` or `direct-unavailable`.
