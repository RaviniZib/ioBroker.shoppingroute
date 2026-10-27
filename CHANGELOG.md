# Changelog / Änderungsprotokoll

## Unreleased – planned for 0.6.1 / für 0.6.1 vorgesehen

### Deutsch

- **Bring! ↔ Alexa:** Bestätigte Schreibvorgänge einer offenen Transaktion werden auch dann anerkannt, wenn zwischenzeitlich andere Artikel erledigt oder hinzugefügt wurden. Anschließende Änderungen werden in einer neuen Transaktion sicher abgeglichen, ohne erledigte Artikel in Bring! wiederherzustellen.
- **Sicherheitslogik:** Nicht bestätigte Schreibvorgänge bleiben weiterhin gesperrt. Das Transaktionsjournal wird nicht blind zurückgesetzt.
- **Protokollierung:** Bei mehr als drei Minuten ausstehender Bestätigung wird einmalig eine Warnung, beim Timeout eine Fehlermeldung und nach erfolgreicher Wiederherstellung eine Entwarnung im normalen ioBroker-Log ausgegeben. Wiederholte Polls erzeugen keine Logflut.
- **Tests und Dokumentation:** Automatische Regressionstests für konkurrierende Erledigungen, vollständige Bestätigung und ausstehende Schreibvorgänge; deutsche und englische Anleitungen aktualisiert.
- **Status:** Noch nicht veröffentlicht. Änderungen bedürfen erfolgreicher Tests und Freigabe.

### English

- **Bring! ↔ Alexa:** Confirmed writes within a pending bridge transaction are recognized even when unrelated items were completed or added meanwhile. Later changes are handled in a separate safe reconciliation pass without resurrecting completed Bring! items.
- **Safety:** Incomplete or unconfirmed original writes remain blocked. Never blindly reset a pending journal.
- **Logging:** One warning for confirmations pending longer than three minutes, one error upon timeout, and an informational recovery message. Recurring polls do not flood the ioBroker log.
- **Tests and documentation:** Regression tests for concurrent completions, confirmed writes and incomplete pending transactions; bilingual guides updated.
- **Status:** Not released. CI and review are required before publishing.

## 0.6.0 – 2026-10-26

- **DE:** Optionale Bring!-Integration, Alexa-/Bring!-Abgleich und Kurzspracheingabe, marktabhängige Artikelzuordnung sowie gebündelte manuelle Alexa-Sortierung.
- **EN:** Optional Bring! integration, Alexa/Bring! synchronization and short voice workflow, explicit store assignment, and batched manual Alexa sorting.

[Issue #82](https://github.com/RaviniZib/ioBroker.shoppingroute/issues/82) · [Draft PR #83](https://github.com/RaviniZib/ioBroker.shoppingroute/pull/83)
