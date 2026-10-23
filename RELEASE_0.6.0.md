# ShoppingRoute 0.6.0 – Bring! integration (unpublished development candidate)

**Status: Development branch only. NOT published to npm, ioBroker latest/stable or GitHub Releases.**
Public users remain on 0.5.3. The Bring! integration has not been deployed to the running instance. The manual shopping-list batch fix is also prepared as a targeted 0.5.3 hotfix.

## Features

- Opt-in Bring! integration with four modes: off, one-way Bring! → Alexa, Bring!-only route preview, and two-way Alexa ↔ Bring! synchronization.
- Import of existing Bring! products, including their textual specifications.
- Completion synchronization: Alexa completed items move to Bring! recent content; completed Bring! items are removed from the active Alexa list via the existing direct versioned API.
- Initial join is additive only: existing entries on either side are preserved.
- Bring!-only users can inspect store and route ordering in the ShoppingRoute shopping-list UI without requiring Alexa.
- Separate Bring! ioBroker adapter command channel, never Alexa2 states.
- Visible sync status, preview and durable on-disk ioBroker state journal.
- Eleven Admin translations and updated DE/EN guides.

## Guardrails and known limitations

- Integration defaults to **off**. Dry Run disables all writes.
- Bring!'s own mobile app cannot display a freely defined item order. It sorts by categories. ShoppingRoute shows calculated routes only in its own view or Alexa.
- Unique product name + specification is the bridge identifier. Identical item names with different specifications or duplicates are blocked to avoid unsafe guesses.
- Bring! reads use only recently acknowledged data and verified connection status.
- On unexpected changes, stale data, conflicting specifications, failed confirmation, or 30+ queued actions, writes are blocked.
- Remote write transactions are persisted before the first remote command. Pending transactions require confirmation of both resulting provider snapshots before processing more changes. No automatic replay after partial failure.
- A stale or blocked pending transaction requires an operator to inspect both lists and journal carefully before any reset.
- Bring! uses periodic polling (~90 seconds); changes may arrive with delay.
- A complete two-provider **live integration test remains outstanding**. Do not deploy this build to production before testing with sacrificial lists.

## Test matrix

Automated (scratch checkout, Node.js 24):
- TypeScript build/check
- Existing ioBroker Admin and Alexa regression tests
- Bring! parsing, names/descriptions and Alexa prefix handling
- Initial additive merge and one-way mode
- Changes and completions in both directions
- Independent simultaneous additions
- Duplicate and description mismatch safety stop
- Persistent pending journal recovery and snapshot confirmation checks

Manual testing required before release:
- Fresh installation with only Bring! (Alexa2 not installed)
- Brand-new and existing linked Bring!/Alexa lists with test items
- Pending command acknowledgement and eventual consistent snapshots
- Remote connection loss / restore during each write phase
- Update / delete conflicts, same-name items and long descriptions
- Admin phone view with Bring!-only route preview
- Recovery of a deliberately interrupted transaction

## Development and backup

Base revision: `7d00a274110848f1cd0151d63409f2489a0febfb` (0.5.3).
Timestamped backup branch: `backup/shoppingroute-0.5.3-before-bring-sync-20261020`.
Working branch: `feature/bring-sync-0.6.0`.

No tag, public release or npm upload has been made. Bring! remains a development candidate.

## Manual shopping-list batch fix (2026-10-23)

Manual shopping-list moves stay in a browser draft. Move all required items, then press **Transfer changes to Alexa**. Only this button starts one verified Alexa sorting transaction for the complete batch. A failed transfer keeps the draft; **Discard changes** reloads the current list. While a draft is pending, switching lists, adding, deleting and resetting are disabled to preserve the draft. Reloading the same browser tab restores the draft when session storage is available.

The backend validates every requested move against a fresh list before storing overrides and starting one existing verified transaction. Existing item identity, concurrency and write safeguards remain in effect. Regression tests cover local-only edits, rapid clicks, accumulated order, stale IDs, whole-batch validation, failure retention and draft restoration.
