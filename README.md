# ShoppingRoute for ioBroker

![ShoppingRoute](admin/shoppingroute.png)

**Current version: 0.3.6**

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

Licensed under the MIT License. See LICENSE for the complete terms.

Copyright (c) 2026 RaviniZib
