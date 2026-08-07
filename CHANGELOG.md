# Changelog

## 0.0.2 (2026-08-07)

- Added configurable priority market for products without an explicit or product-specific default market
- Market precedence is now: explicit market → product default market → priority market → fallback market
- Added automatic learning of unknown products into the adapter product catalogue
- Auto-learning remains active in Dry-Run; Dry-Run still blocks every Alexa write
- Priority market is deliberately not stored as a permanent product default when a product is learned
- Ambiguous unknown names ending in `von/bei <Name>` are not auto-learned and do not inherit the priority market, avoiding accidental storage/routing of an unknown market or brand
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
