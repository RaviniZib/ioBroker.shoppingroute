# Test report – 2026-08-07

Validation for development version 0.0.3.

## Static/build validation

- TypeScript sources compile successfully against an ioBroker Adapter API type stub: PASS
- `node --check build/main.js`: PASS
- `node --check build/lib/parser.js`: PASS
- `node --check build/lib/sorter.js`: PASS
- JSON syntax `io-package.json`: PASS
- JSON syntax `admin/jsonConfig.json`: PASS
- `package.json` and `io-package.json` version consistency (`0.0.3`): PASS

A complete `npm install && npm test` is intentionally left to GitHub Actions / the ioBroker development server because the isolated build environment used for this update cannot reach the public npm registry for `@iobroker/adapter-core`.

## Unit tests

13/13 PASS:

1. Five-item proof: values are redistributed to IDs ordered oldest to newest.
2. Explicit market is the primary sorting level.
3. `3 Bananen von Aldi` keeps its visible text and is recognized correctly.
4. `500 Gramm Hackfleisch von Aldi` keeps its visible text and is recognized correctly.
5. Priority market is used when no explicit/product default market exists.
6. Explicit market overrides the priority market.
7. Product default market overrides the priority market.
8. Invalid priority market falls back to the configured fallback market.
9. Unknown products can be auto-learned without storing the priority market as their permanent default.
10. Ambiguous unknown `von/bei <name>` suffixes are not automatically learned into the product name.
11. Safety test: runtime source contains no Alexa write path to `#New`, `#delete` or `.completed`.
12. Product groups are centrally configurable and default groups are present.
13. Product and walking-route product-group fields use dynamic `selectSendTo` dropdowns.

## Already validated on the real ioBroker test system with 0.0.1

- Installation from the GitHub repository
- JSONConfig rendering in ioBroker Admin
- Reading the Alexa `SHOP` list
- Sorting real Alexa app entries by existing IDs / `value` redistribution
- Dry-Run diagnostics
- GitHub Actions workflow after adding `package-lock.json`

## Still to validate for 0.0.3

- Persistence of automatically learned products into the live instance configuration
- Priority-market behavior with a real Alexa list
- Admin display of newly learned products after configuration reload/reopen
- Long-list performance and minimum safe `value` write pause
- Product-group dropdown loading and refresh behavior in the real ioBroker Admin UI
- Existing-instance migration of default product groups
- Public Alexa2 compatibility without the local alexa-remote2 `updateListItem` fix
