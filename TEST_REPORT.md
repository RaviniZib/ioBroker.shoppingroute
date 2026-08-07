# Test report – 0.0.4

Date: 2026-08-07

## Result

- TypeScript build: passed
- Node unit tests: 16/16 passed
- Safety test: passed; runtime source contains no Alexa create/delete/complete write path
- Dynamic product-group dropdowns: passed
- Dynamic market dropdowns for Fallback market, Priority market, route market and product default market: passed
- Alphabetical dynamic dropdown ordering: passed
- Sortable product catalogue columns (Product, Product group, Default market): passed
- Existing sorting/parser/priority-market/learning tests: passed

The update does not change the Alexa write safety model: only existing active item values may be redistributed; no list items are created, deleted or completed by Shopping Route.
