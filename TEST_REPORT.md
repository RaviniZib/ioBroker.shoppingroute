# ShoppingRoute 0.3.9 bug-fix and test report

Date: **2026-09-11**

## Corrected regressions

- Product catalogue: `availableMarkets` is normalised from legacy comma/semicolon strings to arrays so the market filter and multi-select values work consistently.
- Review queue: accepting an entry updates the product catalogue and removes the processed review row after saving.
- Current shopping list: market sections use a readable single-column layout instead of a responsive card grid.
- Header filtering: current and legacy decorated headings are recognised structurally. A misspelled or no-longer-configured label such as `15> ═════ DROGERIEMART ═════` therefore cannot appear as a product or review entry.
- Empty markets: orphaned known, legacy, unknown, or misspelled market headings are planned as deletes and removed from the Alexa shopping list on the next sorting run.
- Build verification: TypeScript runs before the final Admin build so temporary Vite metadata cannot invalidate the package-output test.

## Verification

- `npm test`: **123 passed, 0 failed**
- `npm run lint`: **passed**, including TypeScript `--noEmit`
- `git diff --check`: **passed**
- Dedicated regressions cover unknown/misspelled decorated headers in both runtime review collection and the Admin shopping-list view.
- The generated runtime and Admin bundles were rebuilt from the changed sources.
- Manual ioBroker verification confirmed the article catalogue and review queue fixes and the revised shopping-list presentation before repository integration.
