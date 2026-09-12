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

## Local drag/drop duplicate correction

Incident: final verification expected 6 active entries and found 7. A direct read confirmed two distinct newly created IDs with the same target value, 89 ms apart; the original deleted ID was absent. The safety stop prevented further writes.

Four new regressions failed against the previous code, reproducing event bubbling, asynchronous React busy-state admission, the backend lock race before `isEnabled`, and concurrent manual preparation. The corrected code passes those cases plus three tests for automatic/manual contention, lock release/error handling, and preserving visible errors after refresh. **137 tests passed, 0 failed; lint/TypeScript passed.** These invoke the real component handlers and compiled adapter methods with controlled I/O, not a browser or live Amazon write test.

The fix reserves commands synchronously, stops drop propagation and preserves exclusive direct writes. No relaxation of final verification, no automatic duplicate deletion and no automatic retry after a safety stop were added.

### Verified incident recovery and Delete button

The stopped adapter's interrupted journal and active list were archived. Exactly the proven extra duplicate ID and the orphan LIDL header were deleted manually, with exact ID/value/version guards before each DELETE and direct verification after each. The user's intervening deletion of Schlabberwurst was preserved. The journal was manually reconciled only after the resulting four-entry list was verified. After restarting and re-enabling, the adapter reported four active prefix-sorted entries and an empty current error. Evidence is retained in `drag-drop-incident`; this is not a phone screenshot acceptance.

Seven additional regressions exercise the Delete button and real compiled message/manual/apply paths with mocked Amazon I/O: one ID-based request under rapid clicks, last-item/header deletion, preservation of a same-name second ID, failed verification with persistent journal and safety stop, blocked/stale/invalid requests, concurrent commands, and visible error reporting. Live personal articles are not deleted to test the new button. Final evidence is recorded below.

Final checks in both local working copies: **144 tests passed, 0 failed; lint and TypeScript passed**. Server package checks: **70 passed, 0 failed**. Scratch npm emitted its existing unknown-http-proxy environment warning; the server lint run did not. The existing repository checker warning W4001 remains documented above; no claim of globally zero warnings is made.

Installed main.js SHA-256: `8de0fabab86160313fe7ac7b939b1d9b3432cf44c25c0cd3e7c678f875959f44`. Admin entry read back from ioBroker: `8d52f5353bf5870f44aa7a8bcf7ca7104c8e6e4c4f39a12dd302779068c8b87d`; component bundle: `c2656c48b10f7202da1a002ab4b43e4b16b0f1713ad5a659e9dfdeb8051dadbc`. All match the tested local build. Read-back initially failed due to incorrect CLI path syntax, then a destination permission error; an absolute temporary destination succeeded. The first cleanup attempt refused to write because upload had re-enabled the instance; the adapter was stopped again before the guarded repair.

Post-install: instance alive, control enabled, current error empty, journal `{}`, and automatic direct verification reports four active prefix-sorted entries. Desktop/mobile browser acceptance of Delete and drag/drop remains pending. No GitHub writes or npm publication. Final logs: `drag-drop-incident/final-tests.log`, `final-lint.log`, `final-package-tests.log`, `final-upload.log`.

## Shopping-list render failure reported at 13:15

The previous test/install result did not establish browser acceptance. A regression now reproduces the exact `Cannot read properties of undefined (reading 'map')` exception by loading a response without `lists`. Four of five new cases failed before the correction. New coverage includes malformed load values, malformed views from all three mutation commands, preserving a previous valid view after a refresh error, retrying a failed initial load, and rendering an already invalid state safely.

The actual installed Admin WebSocket client was used for a read-only `getShoppingList` request. It returned a valid view with three items during diagnosis. The historical response that triggered the user's screenshot was not captured, so its source is still unconfirmed. Initial diagnostic attempts used incompatible Socket.IO clients; the installed ioBroker client succeeded. No personal shopping data was changed during this investigation.

Final F10 verification: 149 tests passed, 0 failed, plus lint/TypeScript in both working copies. Live read through the installed Admin WebSocket client into the real editor produced three item rows and three Delete buttons. This checks the React component tree, not a mounted browser DOM. An attempted HTML render was unavailable because react-dom/server is not installed; it was not counted as passed.

Admin entry SHA-256: f526b49316c5bec2c1bc6ca9dcc9474db589007aa038c9e0e6d757c68e185865. Component bundle: e27a775d3e879a245518ad8e9a6daeab4147e53b9fbf430d2fad33f62e243a75. Uploaded files were read back and matched. Instance alive, current error empty. Evidence retained in view-response-incident next to the server repository. No backend restart, shopping-data writes, GitHub writes or publication. Historical trigger and browser acceptance remain unconfirmed.

## User acceptance – 2026-09-12

Frank reports no further errors so far and confirms all previously reported errors are fixed. This supersedes earlier pending user-acceptance status for the reported UI problems; it does not claim exhaustive automated browser coverage. Read-only recheck of GitHub issue #16 confirms the same six bot findings remain on the public repository. Their corrections are local; the last local checker result remains 0 errors, 1 warning W4001, 0 suggestions. Repository-admission PR #6434 remains open. No push, bot recheck request, issue closure or publication was performed.

## Release 0.4.1 preparation

Fix set F01-F10 and all six current email findings were reconciled in RELEASE_0.4.1.md. PR #40 and its merged main commit 9845243 passed all ten CI jobs, including the 149 unit/component tests and four isolated persistence tests. The full remote repository checker 5.22.2 on GitHub SHA 9845243 reports 0 errors, 1 warning W4001, 0 suggestions. Production npm audit: 0 vulnerabilities.

The first version-preparation run caught the runtime VERSION constant still at 0.4.0; it was updated to 0.4.1 before re-running all checks. No failing run is counted as a pass. Only versions and release documentation change after the user-accepted functional fixes. Existing immutable npm versions and release tags are retained.

Final local 0.4.1 rerun: 149 unit/component tests passed, 0 failed; 70 package checks passed; ESLint and TypeScript passed. Build and diff whitespace checks passed. npm pack dry-run contains 83 files with required backend/Admin assets and no tests or node_modules. Published artifact verification remains a separate post-deploy check.
