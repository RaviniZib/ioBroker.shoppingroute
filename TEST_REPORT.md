# ShoppingRoute 0.4.0 bug-fix and test report

Date: **2026-09-12**

## Correction to the 0.4.0 acceptance claim

The 0.4.0 release did not fulfil the requirement to select multiple markets without modifier keys. It still shipped a native `select multiple`. The reported real-server check covered cleanup of an existing accepted row and normalization of one stored market string. It did not cover selecting three markets through the UI, deselecting/reselecting, mobile interaction, and saving/reloading through Admin.

The next user report showed an accepted row still visible in Admin while the actual server review queue was empty. The unpublished correction therefore also removes accepted rows in the same Admin draft update that writes the catalogue. Discarding restores the original unmodified draft; no server refresh is required for newly accepted rows to disappear.

An unpublished correction replaces that control with labeled checkboxes (44px label targets), a persistent visible selection summary, and preservation of previously selected inactive/renamed markets. Three component-handler regressions cover independent selection, deselection/reselection, and individual/bulk acceptance. Desktop/mobile visual and full Admin save/restart checks remain open in `ROADMAP_0.4.0.md`; the cloud browser blocked access to the local test fixture.

## Historical 0.4.0 changes (not a full UI acceptance)

- Review lifecycle: the Admin status `accepted` is cleaned from the persisted review queue during adapter startup after the editor has already updated the product catalogue.
- Persistence: startup marks the review queue dirty when it only removes an already accepted row, and writes the cleaned queue back even though no product is accepted again.
- Multi-market selection: the Admin editor, bulk action and persisted product data retain `availableMarkets` as arrays instead of converting them back to comma-separated strings.
- Idempotency: startup cleanup does not apply or duplicate products already written by the Admin editor.
- Product catalogue: `availableMarkets` is normalised from legacy comma/semicolon strings to arrays so the market filter and multi-select values work consistently.
- Review queue: the catalogue update and startup cleanup were implemented, but the visible Admin draft was not reliably cleared. The current unpublished correction addresses this separately.
- Current shopping list: market sections use a readable single-column layout instead of a responsive card grid.
- Header filtering: current and legacy decorated headings are recognised structurally. A misspelled or no-longer-configured label such as `15> ═════ DROGERIEMART ═════` therefore cannot appear as a product or review entry.
- Empty markets: orphaned known, legacy, unknown, or misspelled market headings are planned as deletes and removed from the Alexa shopping list on the next sorting run.
- Build verification: TypeScript runs before the final Admin build so temporary Vite metadata cannot invalidate the package-output test.

## Historical verification before the current local correction

- `npm test`: **127 passed, 0 failed**
- `npm run lint`: **passed**, including TypeScript `--noEmit`
- `npm run test:package` on the ioBroker server: **70 passed, 0 failed**, including the official online JSON Config schema.
- `npm audit --omit=dev`: **0 production vulnerabilities** in every severity class.
- `git diff --check`: **passed**
- Dedicated regressions cover unknown/misspelled decorated headers in both runtime review collection and the Admin shopping-list view.
- The generated runtime and Admin bundles were rebuilt from the changed sources.
- Real ioBroker 0.4.0 restart verification: the persisted `accepted` row was removed, the existing article remained exactly once, its legacy `"ALDI"` market value became `["ALDI"]`, and no product retained a non-array `availableMarkets` value.

## Unpublished correction verification

- Local build and tests: **130 passed, 0 failed**.
- Lint and TypeScript: passed.
- UI acceptance in real desktop/mobile Admin: **pending**.

- Local server installation: Admin files uploaded successfully; the entry and component bundle were read back from the ioBroker file store and matched local SHA-256 hashes. Version remains 0.4.0; no new release was published.
- Post-install configuration observation: review queue empty, reported article present exactly once. This does not prove a new accept/save interaction in Admin.
- Environment warning: npm reports unknown `http-proxy` environment configuration. Lint/TypeScript still exit 0.
- Deployment encountered a file timestamp permission error with archive-copy mode; copying file contents without metadata succeeded. Initial file read-back used an unwritable destination; retry with absolute temporary paths succeeded.

## Local completion and issue #16

- Rebuilt on the server from an isolated local checkout: 130 unit/component tests passed, 0 failed.
- Package tests after metadata fixes: 70 passed, 0 failed. Lint and TypeScript passed.
- repochecker 5.22.2, local mode with authenticated read-only GitHub access: **0 errors, 1 warning (W4001), 0 suggestions**. The warning is the pending repository-admission PR #6434. The checker itself labels local mode experimental.
- E2004, E4048, E4050, E4051, E6034 and S0064 are addressed locally; detailed evidence is in ROADMAP_0.4.0.md. The contact address comes from the existing public npm maintainer record.
- Historical 0.4.0 claims of a complete review fix/end-to-end verification have been explicitly corrected in README and io-package news, rather than left as unconditional success claims.
- No GitHub write, issue closure, new release or npm publication was performed.

### Added real ioBroker persistence regression

- `SHOPPINGROUTE_TEST_CONTROLLER_VERSION=7.2.2 npm run test:integration` in an isolated Docker test environment: **4 passed, 0 failed**, exit 0. Node 24.21.0, controller 7.2.2, @iobroker/testing 6.2.1.
- Covers default startup, individual acceptance, bulk acceptance, and legacy `accepted` cleanup when the catalogue entry already exists. The real editor output is written to the real isolated object database; the actual adapter starts and the persisted configuration is read back. Selected markets and unrelated pending rows are checked.
- Does not exercise the actual browser/Admin save button or Alexa. No production configuration is copied into the test database. The missing Alexa test list produces an expected warning.
- Earlier attempts were not counted as passes: production-controller guard refused a host run; the scratch runner could not enumerate network interfaces; a first container lacked dependency resolution. Initial new-test failures exposed test-harness semantics (array merging and one-use harness), corrected by replacing the whole saved native object and using one actual adapter start per case.
- Fresh test-container dependency installation emitted upstream deprecation/install-script notices. There is no blanket claim of zero warnings.
- Logs retained on the server beside the local repository: `local-tests.log`, `local-lint.log`, `package-tests.log`, `integration-verified.log`, `repochecker-final.log`.
