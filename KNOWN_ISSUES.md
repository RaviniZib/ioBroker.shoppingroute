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

The list in the Alexa app must be configured to **Oldest to newest**. Alphabetical sorting overrides the positional effect of redistributing values across existing IDs.
## Compatibility guard

`0.2.0` does not patch foreign modules. It detects the known malformed query where possible and blocks real Alexa sorting writes if compatibility is unsafe or unknown. An explicit same-value compatibility test is available through `control.compatibilityTest`.

The compatibility guard remains as an additional safety mechanism.



## GitHub URL vs npm beta

Installing from the GitHub repository URL installs the version committed to the repository branch/commit. Publishing a newer beta to npm does not update GitHub automatically. Therefore the GitHub URL can legitimately install an older build until the newer source is committed and pushed.

The ioBroker Admin card can also show a generic “not maintained”/“nicht gewartet” value while ShoppingRoute is not part of an official ioBroker repository. ShoppingRoute exposes its own installed/beta version status in the Diagnostics tab; it cannot overwrite that repository-level Admin card field.
