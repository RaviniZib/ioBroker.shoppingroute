# ShoppingRoute 0.4.0 bug-fix and test report

Date: **2026-09-12**

## Corrected regressions

- Review lifecycle: the Admin status `accepted` is cleaned from the persisted review queue during adapter startup after the editor has already updated the product catalogue.
- Persistence: startup marks the review queue dirty when it only removes an already accepted row, and writes the cleaned queue back even though no product is accepted again.
- Multi-market selection: the Admin editor, bulk action and persisted product data retain `availableMarkets` as arrays instead of converting them back to comma-separated strings.
- Idempotency: startup cleanup does not apply or duplicate products already written by the Admin editor.
- Product catalogue: `availableMarkets` is normalised from legacy comma/semicolon strings to arrays so the market filter and multi-select values work consistently.
- Review queue: accepting an entry updates the product catalogue and removes the processed review row after saving.
- Current shopping list: market sections use a readable single-column layout instead of a responsive card grid.
- Header filtering: current and legacy decorated headings are recognised structurally. A misspelled or no-longer-configured label such as `15> ═════ DROGERIEMART ═════` therefore cannot appear as a product or review entry.
- Empty markets: orphaned known, legacy, unknown, or misspelled market headings are planned as deletes and removed from the Alexa shopping list on the next sorting run.
- Build verification: TypeScript runs before the final Admin build so temporary Vite metadata cannot invalidate the package-output test.

## Verification

- `npm test`: **127 passed, 0 failed**
- `npm run lint`: **passed**, including TypeScript `--noEmit`
- `npm run test:package` on the ioBroker server: **70 passed, 0 failed**, including the official online JSON Config schema.
- `npm audit --omit=dev`: **0 production vulnerabilities** in every severity class.
- `git diff --check`: **passed**
- Dedicated regressions cover unknown/misspelled decorated headers in both runtime review collection and the Admin shopping-list view.
- The generated runtime and Admin bundles were rebuilt from the changed sources.
- Real ioBroker 0.4.0 restart verification: the persisted `accepted` row was removed, the existing article remained exactly once, its legacy `"ALDI"` market value became `["ALDI"]`, and no product retained a non-array `availableMarkets` value.
