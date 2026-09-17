# Release 0.4.2 — 2026-09-17

Includes PR #42 callback timeouts and the locally verified September 17 repair: direct Amazon polling, bounded verification retries, safe follow-up sorting for concurrent additions, and interrupted-transaction recovery. Existing Admin and shopping-list controls are preserved.

The original PR CI used stale checked-in JavaScript, so its two new timeout tests were cancelled. This release regenerates build output from the matching TypeScript source.

Polling uses a 60-second baseline and up to 15 minutes of error backoff. It remains scheduled during active writes and disabled sorting. Incomplete writes, missing expected items, and unconfirmed deletions still retain the safety stop and transaction journal.

Validation results are recorded after the release checks complete.

Local validation: build successful; 160 unit/component tests passed, 70 package checks passed, ESLint and TypeScript passed. The walking-route editor source hashes remain unchanged. Generated bundle hashes are no longer pinned because Module Federation emits build-specific identifiers; a real module-loading test now verifies the delivered route editor exports instead.

The functional sources match the installed September 17 repair apart from the 0.4.2 runtime version. Release assets use the existing lockfile dependency versions, including the already merged Module Federation 1.21.3 update.
