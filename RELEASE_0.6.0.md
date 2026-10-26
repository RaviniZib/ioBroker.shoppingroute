# ShoppingRoute 0.6.0 – Bring! lists, routing and synchronization

**Release version: 0.6.0 (2026-10-26).** Bring! support is optional and disabled by default.
This release combines the Bring! integration, explicit store detection and batched manual Alexa list changes with the latest main-branch fixes. Existing installations retain their current list configuration unless Bring! is explicitly enabled.

## Features

- Opt-in Bring! integration with four modes: off, one-way Bring! → Alexa, Bring!-only route preview, and two-way Alexa ↔ Bring! synchronization.
- Import of existing Bring! products, including their textual specifications.
- Completion synchronization: Alexa completed items move to Bring! recent content; completed Bring! items are removed from the active Alexa list via the existing direct versioned API.
- Initial join is additive only: existing entries on either side are preserved.
- Bring!-only users can inspect store and route ordering in the ShoppingRoute shopping-list UI without requiring Alexa.
- Separate Bring! ioBroker adapter command channel, never Alexa2 states.
- Visible sync status, preview and durable on-disk ioBroker state journal.
- Eleven Admin translations and updated DE/EN guides.

## Guardrails and known limitations

- Integration defaults to **off**. Dry Run disables all writes.
- Bring!'s own mobile app cannot display a freely defined item order. It sorts by categories. ShoppingRoute shows calculated routes only in its own view or Alexa.
- Unique product name + specification is the bridge identifier. Identical item names with different specifications or duplicates are blocked to avoid unsafe guesses.
- Bring! reads use only recently acknowledged data and verified connection status.
- On unexpected changes, stale data, conflicting specifications, failed confirmation, or 30+ queued actions, writes are blocked.
- Remote write transactions are persisted before the first remote command. Pending transactions require confirmation of both resulting provider snapshots before processing more changes. No automatic replay after partial failure.
- A stale or blocked pending transaction requires an operator to inspect both lists and journal carefully before any reset.
- Bring! uses periodic polling (~90 seconds); changes may arrive with delay.
- User testing confirms Bring! list import and automatic inclusion of new Bring! items in ShoppingRoute on the next sorting pass. Live two-way completion, deletion and all conflict/recovery scenarios are not independently confirmed; use backed-up test lists for these modes.

## Test matrix

Automated (local Node.js 24 and GitHub Actions Node.js 22/24/26 on Linux, macOS and Windows):
- TypeScript build/check
- Existing ioBroker Admin and Alexa regression tests
- Bring! parsing, names/descriptions and Alexa prefix handling
- Initial additive merge and one-way mode
- Changes and completions in both directions
- Independent simultaneous additions
- Duplicate and description mismatch safety stop
- Persistent pending journal recovery and snapshot confirmation checks

Further recommended manual test scenarios (not claimed as completed):
- Fresh installation with only Bring! (Alexa2 not installed)
- Brand-new and existing linked Bring!/Alexa lists with test items
- Pending command acknowledgement and eventual consistent snapshots
- Remote connection loss / restore during each write phase
- Update / delete conflicts, same-name items and long descriptions
- Admin phone view with Bring!-only route preview
- Recovery of a deliberately interrupted transaction

## Release sources and backups

Base revision: `7d00a274110848f1cd0151d63409f2489a0febfb` (0.5.3).
Timestamped backup branch: `backup/shoppingroute-0.5.3-before-bring-sync-20261020`.
Merged from feature/bring-sync-0.6.0 and current main into release/0.6.0-20261026 (PR #81).

The v0.6.0 tag triggers the release workflow; npm/GitHub publication must be confirmed from the workflow result. The running ioBroker installation is not modified by preparing this release.

## Manual shopping-list batch fix (2026-10-23)

Manual shopping-list moves stay in a browser draft. Move all required items, then press **Transfer changes to Alexa**. Only this button starts one verified Alexa sorting transaction for the complete batch. A failed transfer keeps the draft; **Discard changes** reloads the current list. While a draft is pending, switching lists, adding, deleting and resetting are disabled to preserve the draft. Reloading the same browser tab restores the draft when session storage is available.

The backend validates every requested move against a fresh list before storing overrides and starting one existing verified transaction. Existing item identity, concurrency and write safeguards remain in effect. Regression tests cover local-only edits, rapid clicks, accumulated order, stale IDs, whole-batch validation, failure retention and draft restoration.

## Besondere Hinweise / Key release highlights

**DE – Bring!-Listen jetzt dabei:** Eine Bring!-Einkaufsliste kann optional importiert, ohne Alexa als nach Märkten, Produktgruppen und persönlichen Laufwegen sortierte Vorschau in ShoppingRoute angezeigt oder mit einer Alexa-Liste abgeglichen werden. **Wichtig:** Bring! selbst unterstützt nur seine Kategorie-Sortierung, keine frei vorgebbare Reihenfolge einzelner Artikel. Die individuelle Laufwegsortierung erscheint daher in ShoppingRoute bzw. bei verknüpften Alexa-Listen, nicht als erzwungene Artikelreihenfolge in der Bring!-App.

**EN – Bring! lists are now included:** Optionally import a Bring! shopping list, display it without Alexa as a read-only store/group/walking-route preview in ShoppingRoute, or synchronize it with an Alexa list. **Important:** The Bring! app supports its own category ordering, not arbitrary item-by-item reordering. The personalized walking-route order is available in ShoppingRoute or on linked Alexa lists, not forcibly inside the Bring! app.

**DE – Weitere Verbesserungen:** Erkannte Marktnamen an beliebiger Stelle im Artikeltext haben für den aktuellen Einkauf Vorrang vor dem Standardmarkt, ohne Stammdaten zu ändern. Manuelle Listenverschiebungen werden zunächst gesammelt und erst nach ausdrücklicher Bestätigung gemeinsam an Alexa übertragen.

**EN – Additional improvements:** Explicit store names anywhere in item text take precedence for the current trip without changing catalogue defaults. Manual list moves are staged locally and transferred to Alexa together only when confirmed.

**DE/EN – Sicherheit / Safety:** Bring!-Integration ist standardmäßig ausgeschaltet / Bring! integration is disabled by default. Dry Run, bestätigte Listenstände, Konfliktsperre und Journal-Wiederherstellung bleiben aktiv / Dry run, verified snapshots, conflict safety stop and recovery journal remain active.

## Release verification (2026-10-26)

- 248 automated tests: PASS; 76 package/schema tests: PASS; 5 isolated ioBroker integration tests: PASS.
- GitHub Actions: check/lint and all 9 adapter-test jobs PASS (Node.js 22, 24, 26 on Ubuntu, macOS and Windows).
- npm package dry run: verified contents, including compiled Bring! bridge and ShoppingRoute Admin pages.
- User-confirmed live behaviour: existing Bring! lists import; newly added Bring! items appear in ShoppingRoute and follow the configured route on the next sorting run.
- NOT claimed as live-tested: every two-way completion/delete and interruption/recovery scenario. Use dedicated, backed-up lists when enabling write-capable synchronization.

## Security advisory / Sicherheitshinweis

**DE:** Die Produktions-Abhängigkeitsprüfung meldet weiterhin drei High-Funde über die vorgelagerte Bibliothek node-forge in @iobroker/adapter-core. Ein erzwungenes Downgrade auf adapter-core 3.4.2 wurde nicht vorgenommen, um Kompatibilitätsprobleme zu vermeiden. Die Upstream-Warnung bleibt bestehen und sollte beobachtet werden.

**EN:** The production dependency audit still reports three high-severity findings through the upstream node-forge dependency in @iobroker/adapter-core. A forced downgrade to adapter-core 3.4.2 was deliberately avoided. Monitor the upstream advisory for a compatible fix.

## Sprachkurzbefehl ohne Bring!-Skill / Short voice commands without invoking Bring!

**DE – Besonderer Vorteil:** Im Modus **Bring! ↔ Alexa** reicht der normale Alexa-Satz **„Alexa, Milch auf die Einkaufsliste“**. ShoppingRoute verarbeitet den Alexa-Eintrag, ordnet ihn nach Markt und Laufweg ein und übernimmt ihn beim bestätigten Abgleich nach Bring!. Der längere explizite Bring!-Skill-Aufruf ist dafür nicht erforderlich. Wird der Artikel in Bring! erledigt, entfernt ShoppingRoute den zuvor gespiegelten Eintrag aus der aktiven Alexa-Liste (technisch: Entfernen statt Alexa-Erledigt-Markierung). Gültig nur bei aktiviertem bidirektionalem Modus und erfolgreicher Konflikt-/Bestätigungsprüfung.

**EN – Key benefit:** In **Bring! ↔ Alexa** mode, a normal voice request such as **“Alexa, add milk to my shopping list”** is sufficient. ShoppingRoute processes the Alexa list item, applies store/walking-route sorting and mirrors it into Bring! after successful synchronization. No explicit long Bring! skill invocation is necessary. Completing the mirrored item in Bring! removes it from the active Alexa list (delete rather than setting an Alexa completed flag). This requires the enabled bidirectional mode and successful safety/confirmation checks.

The Alexa-to-Bring! addition and Bring!-to-Alexa removal paths are covered by automated reconciliation tests; this description does not claim comprehensive two-cloud-provider fault/recovery live testing.
