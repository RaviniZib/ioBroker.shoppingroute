# Changelog

## 0.2.0-beta.1 (2026-08-08)

- Added multi-list support with per-list priority markets.
- Added temporary priority market for one-off shopping trips.
- Added unknown-product review queue with accept/change/ignore workflow.
- Improved quantity parsing, duplicate detection, category suggestions and alias suggestions.
- Added product availability across multiple markets.
- Walking-route order now follows the table row order and is automatically reindexed.
- Added sorting preview in JSON and human-readable form.
- Added API Safe Mode with write-rate limiting, batching and exponential retry backoff.
- Added local shopping statistics without telemetry.
- Added configuration export/import and shareable market profiles.
- Added npm beta version check and privacy-safe feedback report.
- Improved adapter branding and German card title to `ShoppingRoute`.
- Added explicit documentation for ioBroker Admin's generic `not maintained` display while the adapter is outside the official repository.
- Alexa safety invariant remains unchanged: no `#New`, no `#delete`, no automatic `completed` writes.

## 0.1.0-beta.3 (2026-08-08)

- Added daily API/traffic operation counters for local checks, planned changes, real sorting runs, Alexa value writes, compatibility-test writes and safely aborted runs.
- Added `info.traffic` consolidated diagnostics and `control.resetTrafficStats`.
- Added automatic daily counter reset.
- Added closed-beta license/terms and marked the development package private to prevent accidental publishing. The separately generated closed-beta tarball is publishable with an npm beta tag.
- Added source-free closed-beta packaging workflow with JavaScript obfuscation.
- Added German closed-beta installation guide and tester invitation draft.
- Updated beta diagnostics/version strings to beta.3.

## 0.1.0-beta.2 (2026-08-07)

- Added the official ShoppingRoute logo and ioBroker adapter icon.
- Added the logo to the English and German GitHub README files.
- Added `common.icon` metadata so ioBroker Admin can display the adapter branding.
- Includes all closed-beta safety and compatibility checks introduced in beta.1.

## 0.1.0-beta.1 (2026-08-07)

- First closed-beta preparation build.
- Added automatic read-only inspection of the installed Alexa2/alexa-remote2 write path for the known malformed `?version =...` query.
- Added beta write guard: real Alexa value sorting writes are blocked when compatibility is `known-bug`, `live-failed` or `unknown`. Dry-Run remains available.
- Added `info.writeCapability`, `info.compatibility` and `info.lastCompatibilityTest`.
- Added `control.compatibilityTest` for an explicit same-value Alexa2 acknowledgement test without creating, deleting, completing or visibly renaming a list item.
- Expanded the Admin diagnostics guidance for beta testers.
- Added German and English beta test guides and a GitHub beta feedback issue template.
- Dry-Run remains enabled by default for new installations.

## 0.0.4 (2026-08-07)

- Changed Fallback market and Priority market on the General tab to dynamic market drop-downs.
- Changed market selection in walking routes and product defaults to dynamic market drop-downs.
- Sorts all dynamic product-group and market drop-downs alphabetically.
- Product catalogue columns Product, Product group and Default market can now be sorted from the table header.
- Keeps the stored product catalogue alphabetically ordered by product name so the default view is alphabetical and grouped table sorting stays alphabetical within equal groups.

## 0.0.3 (2026-08-07)

- Added central **Product groups / Produktgruppen** administration tab
- Product group assignment in the product catalogue now uses a drop-down instead of free text
- Product group assignment in market walking routes now uses the same drop-down
- Drop-down values are provided dynamically by the running adapter from the configured product groups
- Existing installations receive the default product groups automatically on first start

## 0.0.2 (2026-08-07)

- Added configurable priority market for products without an explicit or product-specific default market
- Market precedence is now: explicit market → product default market → priority market → fallback market
- Added automatic learning of unknown products into the adapter product catalogue
- Auto-learning remains active in Dry-Run; Dry-Run still blocks every Alexa write
- Priority market is deliberately not stored as a permanent product default when a product is learned
- Ambiguous unknown names ending in `von/bei <Name>` are not auto-learned to avoid accidentally storing an unknown market or brand as part of the product name
- Added `info.lastLearnedItems` diagnostics state
- Expanded unit tests for priority-market precedence and auto-learning

## 0.0.1 (2026-08-07)

- Initial development version
- Safe Alexa `value` redistribution using existing IDs
- Store/main-category sorting
- Separate category route per store
- Product aliases and default stores
- Quantity-aware product recognition
- Dry-Run and diagnostics
- Abort/recalculate protection for list changes during sorting
