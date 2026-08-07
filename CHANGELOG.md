## 0.0.4 (2026-08-07)

- Changed Fallback market and Priority market on the General tab to dynamic market drop-downs.
- Changed market selection in walking routes and product defaults to dynamic market drop-downs.
- Sorts all dynamic product-group and market drop-downs alphabetically.
- Product catalogue columns Product, Product group and Default market can now be sorted from the table header.
- Keeps the stored product catalogue alphabetically ordered by product name so the default view is alphabetical and grouped table sorting stays alphabetical within equal groups.

# Changelog

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
