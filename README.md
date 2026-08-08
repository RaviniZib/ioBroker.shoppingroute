# ShoppingRoute for ioBroker

![ShoppingRoute](admin/shoppingroute.png)

**Development status: 0.2.0-beta.2 – beta**

ShoppingRoute sorts existing Alexa shopping-list entries by market, product group and each store's individual walking route. It **never creates, deletes or automatically completes Alexa list items**. It only redistributes visible texts across existing active Alexa IDs. Managed Alexa lists must be set to **Oldest to newest** in the Alexa app.

## Highlights

- multiple Alexa lists with per-list priority markets
- global, per-list and temporary market priorities
- market aliases and common market-name variants
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
- privacy-safe beta feedback report
- Alexa2/alexa-remote2 write compatibility guard
- Dry Run safety mode

See `README_DE.md` for the detailed German documentation.
