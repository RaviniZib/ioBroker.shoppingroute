# Test report – 2026-08-07

Local development validation for version 0.0.1.

## Build

- TypeScript compilation: PASS
- `node --check build/main.js`: PASS
- JSON syntax `io-package.json`: PASS
- JSON syntax `admin/jsonConfig.json`: PASS

## Unit tests

5/5 PASS:

1. Five-item proof: values are redistributed to IDs ordered oldest to newest.
2. Explicit market is the primary sorting level.
3. `3 Bananen von Aldi` keeps its visible text and is recognized as ALDI / Obst-Gemüse.
4. `500 Gramm Hackfleisch von Aldi` keeps its visible text and is recognized as ALDI / Fleisch-Fisch.
5. Safety test: runtime main source contains no write path to `#New`, `#delete` or `.completed`.

## Not yet validated

- Installation through ioBroker Admin from GitHub
- JSONConfig rendering in the user's real Admin 7.8.x instance
- Long-list performance and minimum safe value-write pause
- Multiple real stores with different configured walking routes
- Public Alexa2 compatibility without the local alexa-remote2 updateListItem fix
