# ShoppingRoute for ioBroker

![ShoppingRoute](admin/shoppingroute.png)

**Current version: 0.4.0**

ShoppingRoute sorts Alexa shopping-list entries by market, product group and each store's individual walking route. It assigns visible two-digit keys such as `20> Bananas` and `40> ═════ ALDI ═════`; managed lists must therefore be set to **A–Z** in the Alexa app. ShoppingRoute reuses the local Alexa2 authentication for direct item updates, deletes and batch creates, while Alexa2 list states remain the external change trigger.

## User guide / Bedienungsanleitung

🇬🇧 [**English user guide**](USER_GUIDE_EN.md)  
🇩🇪 [**Deutsche Bedienungsanleitung**](BEDIENUNGSANLEITUNG_DE.md)

## Highlights

- multiple Alexa lists with per-list priority markets
- global, per-list and temporary market priorities
- market aliases and common market-name variants
- optional automatically managed market headings such as `═════ ALDI ═════`
- optional cross-market consolidation using a minimum-item threshold; explicit market requests are never moved
- configurable product groups and store-specific routes
- product catalogue with aliases, preferred and available markets
- quantity parser for digits, number words, packs, half-kilo and `6x` forms
- duplicate-resistant product learning
- review queue for unknown products
- automatic/review/off learning modes
- category and alias suggestions
- sorting preview before writes
- incremental `00>`–`99>` prefix sorting with gap-preserving inserts and suffix-only rebuilds
- direct Amazon responses plus one final list read as write confirmation
- API Safe Mode with configurable write-rate limiting
- local-only shopping statistics
- configuration backup/restore
- shareable market-route profiles
- privacy-safe diagnostic/feedback report
- Alexa2/alexa-remote2 direct-session diagnostics
- Dry Run safety mode

See `README_DE.md` for the detailed German documentation.

## Changelog

### **WORK IN PROGRESS**

- Adds a Delete button for each shopping item. Deletes the selected Amazon ID and empty market headers through the exclusive, journaled transaction with direct final verification. Dry Run and the safety stop block deletion.

- Prevents duplicate shopping items from overlapping drag/drop events and concurrent direct writes. Reserves UI/backend operations synchronously and keeps move errors visible after refresh.

- Corrects checker #16 metadata: removes unpublished 0.3.8 from `common.news`, adds the existing npm maintainer email to author/copyright fields, links the MIT license and declares testing ^6.2.1. Local checker: no errors; repository admission remains pending in PR #6434.

- Updates the catalogue and removes accepted review rows in one Admin draft change, avoiding stale accepted rows after saving. Discarding restores the original draft. UI acceptance is pending.
- Replaces the review queue’s native multi-select with independently clickable market checkboxes and a visible selection summary. Desktop/mobile acceptance is still pending; this fix is not part of published 0.4.0.

### 0.4.0 (2026-09-12)

**Correction to the original acceptance claim:** The complete review workflow was not fixed. Accepted rows could remain visible in the Admin draft, and market selection still used a native multi-select. The original “end-to-end test” description was incorrect: tests covered editor/helper functions and serialization, not full Admin interaction.

- Persists startup cleanup of previously accepted review rows even without accepting another product.
- Normalizes legacy product-market strings to arrays at startup and preserves market arrays in acceptance functions.
- The additional local UI correction is listed under “WORK IN PROGRESS”; it is not part of the published 0.4.0 package.

### 0.3.9 (2026-09-11)

- Replaces incomplete 0.3.8 snapshots that may have been installed directly from GitHub with an unambiguous newer version.
- Includes the final product-market normalization, review cleanup, single-column shopping-list view, structural header filtering, and orphaned-header removal verified in PR #37.
- No user configuration migration is required; legacy comma/semicolon market values are normalized automatically.

### 0.3.8 (2026-09-11)

- “Available markets” is stored consistently as a multi-select array; legacy comma/semicolon strings remain readable and are migrated to arrays at startup.
- Accepted review entries are removed after saving once the product catalogue has been updated.
- The current shopping list is presented as a clear single-column sequence of market sections.
- Structurally formatted market headings are filtered even when their label is unknown or misspelled (for example `═════ DROGERIEMART ═════`).
- Market headings without associated active items are deleted from the Alexa shopping list during the next sorting run.
- Fixed the review queue so accepting an item updates the article catalogue and visible status immediately in the same Admin draft.
- Legacy market headings such as `— LIDL —` are recognized as headings and can no longer enter the shopping items or review queue.
- Nested internal sort prefixes are stripped recursively from parsing and the Admin shopping-list display.
- Simplified the current shopping-list view by hiding empty market columns while retaining drag, arrow and market-selector controls.
- Updated current ioBroker CI/checker compatibility: testing-action-check v2, Node.js 26 matrix coverage, current @iobroker/testing and bounded common.news history.

### 0.3.7 (2026-09-11)

- Added an interactive current shopping-list view to Admin with drag-and-drop plus touch-friendly arrow/market controls.
- Manual item positions and market moves are persisted locally and take precedence over automatic sorting while that active list item exists.
- Alexa writes are performed by the adapter; the browser receives no Alexa/Amazon credentials, and failed moves reload the confirmed list state.
- Improved responsive Admin layouts for xs/sm screens and added the repository Responsive Design tab width recommendation.
- Review entries now retain an idempotent “Accepted” status after a normal Save instead of falling back to “Pending”.

### 0.3.6 (2026-09-04)

- Cleaned up avoidable repository-checker warnings.
- Made the JSON Config i18n mode explicit and moved all existing translations into the standard language-file structure.
- Removed obsolete prepublish protection and archived older changelog entries.
- No sorting or runtime behavior was changed.

### 0.3.5 (2026-08-17)

- Completed the remaining repository re-review cleanup with an English statistics fallback.
- Aligned release deployment with the regular tested `npm run build` path.
- Removed the obsolete `stable:build` / source-map cleanup path and updated its regression protection.
- No sorting behavior or adapter functionality was changed.

### 0.3.4 (2026-08-14)

- Added Admin 8 compatibility for all custom Admin components and set the minimum Admin version to 8.0.0.
- Improved logging with an optional sort-summary message and made market headings clearer (`═════ MARKET ═════`).
- Fixed the review queue’s “Accept all” action and now process foreign Alexa2 states only when their values are acknowledged.
- Removed obsolete timing/API configuration options and the internal npm version check.
- Removed code obfuscation and obsolete package-preparation paths.
- Completed repository-review compatibility cleanup, including English runtime log/state texts and bounded `maxWritesPerMinute` handling.

### 0.3.3 (2026-08-13)

- New direct `00>`–`99>` prefix sorting for Alexa lists configured to A–Z.
- Added very fast incremental insertion into free numeric gaps; only the affected suffix is rebuilt when a gap is exhausted.
- Direct Amazon responses confirm each operation, followed by one final direct verification of the complete list result.
- Managed Alexa lists must be set to **A–Z** in the Alexa app.

### 0.3.2 (2026-08-11)

- Replaced the former buffered/marker/`updatedDateTime` sorter with one direct `00>`–`99>` prefix architecture for Alexa A–Z lists.
- Added midpoint insertion into existing numeric gaps; if a gap is exhausted, only the smallest necessary suffix is deleted serially and recreated with one batch request.
- Reuses Alexa2 credentials locally without logging secrets or writing Alexa2 item states. Direct Amazon responses confirm each operation and one final direct list read verifies the complete apply.
- Added a simple exclusive `IDLE`/`COLLECTING`/`APPLYING` lifecycle: one new item waits at most five seconds, while a second new item starts the collected run immediately.
- Replaced the old marker transaction with a compact persistent direct-apply journal and a safety stop for incomplete or ambiguous remote results.

### 0.3.1 (2026-08-10)

- Fixed a restart loop in Review learning: repeated identical observations no longer rewrite `reviewItems` solely to refresh `lastSeen`.

### 0.3.0 (2026-08-10)

- Added optional market headings (now formatted as `═════ MARKET ═════`).
- A heading stays active until the last real item for that market is completed and is then deleted completely instead of remaining among completed items.
- Added configurable minimum-items-per-market consolidation for flexible articles.
- Explicit market phrases always remain assigned to the requested market.
- Header management uses Alexa2 states (`#New`, `#delete`) and does not create a second Amazon session; normal shopping items are never automatically deleted or completed.

Older releases: [CHANGELOG_OLD.md](CHANGELOG_OLD.md).

## License

Licensed under the MIT License. See [LICENSE](LICENSE) for the complete terms.

Copyright (c) 2026 RaviniZib <zib@ravini.org>
