# ShoppingRoute for ioBroker

![ShoppingRoute](admin/shoppingroute.png)

**Current version: 0.3.0**

ShoppingRoute sorts Alexa shopping-list entries by market, product group and each store's individual walking route. Normal shopping items are still sorted only by redistributing visible texts across existing Alexa IDs. Optionally, ShoppingRoute can use Alexa2 to create its own market headings such as `---- ALDI ----`. Once a market is no longer needed, ShoppingRoute completely deletes only that self-managed heading entry. Managed Alexa lists must be set to **Oldest to newest** in the Alexa app.

## User guide / Bedienungsanleitung

🇬🇧 [**English user guide**](USER_GUIDE_EN.md)  
🇩🇪 [**Deutsche Bedienungsanleitung**](BEDIENUNGSANLEITUNG_DE.md)

## Highlights

- multiple Alexa lists with per-list priority markets
- global, per-list and temporary market priorities
- market aliases and common market-name variants
- optional automatically managed market headings such as `---- ALDI ----`
- optional cross-market consolidation using a minimum-item threshold; explicit market requests are never moved
- configurable product groups and store-specific routes
- product catalogue with aliases, preferred and available markets
- quantity parser for digits, number words, packs, half-kilo and `6x` forms
- duplicate-resistant product learning
- review queue for unknown products
- automatic/review/off learning modes
- category and alias suggestions
- sorting preview before writes
- API safe mode with write-rate limiting, batches and retry backoff
- local-only shopping statistics
- configuration backup/restore
- shareable market-route profiles
- npm beta version check
- privacy-safe diagnostic/feedback report
- Alexa2/alexa-remote2 write compatibility guard
- Dry Run safety mode

See `README_DE.md` for the detailed German documentation.

## Changelog

### 0.3.0 (2026-08-10)

- Added optional `---- MARKET ----` headings.
- A heading stays active until the last real item for that market is completed and is then deleted completely instead of remaining among completed items.
- Added configurable minimum-items-per-market consolidation for flexible articles.
- Explicit market phrases always remain assigned to the requested market.
- Header management uses Alexa2 states (`#New`, `#delete`) and does not create a second Amazon session; normal shopping items are never automatically deleted or completed.

### 0.2.0 (2026-08-09)

- First stable release of ShoppingRoute.
- Completed Admin translations for all supported ioBroker languages and fixed the walking-route market help text.
- Added protected stable publishing through GitHub Actions, npm Trusted Publishing/OIDC and an obfuscated runtime build.
- Verified `updateListItem` compatibility with Alexa2 3.28.3 and alexa-remote2 8.1.0 without local modifications to foreign modules.

### 0.2.0-beta.12 (2026-08-09)

- Added an official stable-release deployment path while keeping public-beta packaging separate.
- Added the shared ioBroker ESLint configuration and resolved type-safety/lint findings without functional changes.
- Updated the resolved `@iobroker/testing` version to 5.3.0 and revalidated the test suite.

### 0.2.0-beta.11 (2026-08-09)

- Added official ioBroker package and integration tests and completed further workflow and JSON Config compatibility fixes.
- Switched ShoppingRoute to the MIT License.
- Updated public-beta documentation, release history and version information.

### 0.2.0-beta.10 (2026-08-09)

- Added an Admin 7.6 compatible backup and sharing interface for configuration backups and market profiles.
- Added JSON validation for configuration and market-profile imports.
- Fixed the runtime version consistency check and improved automated compatibility tests.

### 0.2.0-beta.9 (2026-08-09)

- Renamed closed-beta references to public beta across packaging, workflow and documentation.

### 0.2.0-beta.8 (2026-08-09)

- Version update only; no functional changes.

### 0.2.0-beta.7 (2026-08-08)

- Added a real standalone market dropdown for the walking-route editor; only the selected market route is shown while the complete route list remains stored internally.
- Centralized Admin translations in reusable JSON Config i18n variables for all required ioBroker languages.
- Added further repository-checker compliance fixes for responsive tables, CI, Dependabot, button roles and VS Code schemas.


### 0.2.0-beta.6 (2026-08-08)

- Alexa2 instance is now selected from installed/enabled Alexa2 instances instead of free text.
- Alexa lists are offered as dynamically detected dropdown values.
- Walking routes use native ioBroker JSON Config controls again; the faulty custom Module Federation editor has been removed.
- The current-shopping market can be visibly reset to “— No market —” directly in its dropdown; the separate clear button has been removed.
- Renamed the permanent and one-off market settings to make their purpose clearer.
- API protection settings moved into General so they are not overlooked.

### 0.2.0-beta.4 (2026-08-08)

- Added a market filter to the walking-route table so one market can be edited at a time.
- Walking-route rows are grouped alphabetically by market while preserving the configured route order inside each market.
- Added ioBroker repository-checker metadata, responsive JSON Config sizing and explicit JSON Config i18n mode.
- Updated ioBroker adapter dependencies and development testing metadata.
- Replaced plain Node.js timers with adapter-managed timers.
- Added standard GitHub test workflow and Dependabot configuration.

### 0.2.0-beta.2 (2026-08-08)

- New active markets and new product groups automatically receive missing walking-route rows.

### 0.2.0-beta.1 (2026-08-08)

- Added review queue, improved parser and aliases, API safe mode, multi-list support, statistics, transfer tools and beta diagnostics.

### 0.1.0-beta.3 (2026-08-08)

- First public beta npm package with safe value-only Alexa list sorting and fixed-slot ordering.

## License

Licensed under the MIT License. See LICENSE for the complete terms.

Copyright (c) 2026 RaviniZib
