# ShoppingRoute 0.5.0

Released: 2026-10-05

## Highlights

- New dedicated ShoppingRoute management page in the ioBroker sidebar.
- Direct runtime management of the shopping list, products, markets, product groups, walking routes, Alexa lists and review queue.
- Catalogue changes no longer require saving the adapter instance configuration or restarting the adapter.
- Large catalogue data is stored in `shoppingroute.<instance>.data.managedConfig` and protected against destructive Admin/default resets.
- Real-instance recovery test completed successfully for issue #59.
- Market names are normalized to uppercase on create, rename, load and save; related route, product, list-priority and review references are normalized consistently.
- Stable sticky header with ShoppingRoute logo and redesigned shaded/zebra list presentation.

## Compatibility

- ioBroker Admin 8 or newer.
- Existing 0.4.x installations are migrated automatically on startup.
- Existing mixed-case market data is normalized automatically; no manual migration is required.
