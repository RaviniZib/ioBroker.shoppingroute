# Older changelog entries

## English

### 0.2.0 (2026-08-09)

- First stable release of ShoppingRoute.
- Completed Admin translations for all supported ioBroker languages and fixed the walking-route market help text.
- Added protected stable publishing through GitHub Actions and npm Trusted Publishing/OIDC.
- Verified `updateListItem` compatibility with Alexa2 3.28.3 and alexa-remote2 8.1.0 without local modifications to foreign modules.

### 0.2.0-beta.12 (2026-08-09)

- Added an official stable-release deployment path while keeping public-beta packaging separate.
- Added the shared ioBroker ESLint configuration and resolved type-safety/lint findings without functional changes.
- Updated the resolved `@iobroker/testing` version to 5.3.0 and revalidated the test suite.

### 0.2.0-beta.11 (2026-08-09)

- Added official ioBroker package and integration tests and completed further workflow and JSON Config compatibility fixes.
- Switched ShoppingRoute to the MIT License.
- Updated public-beta documentation, release history and version information.

### 0.2.0-beta.10 (2026-08-09)

- Added an Admin 7.6 compatible backup and sharing interface for configuration backups and market profiles.
- Added JSON validation for configuration and market-profile imports.
- Fixed the runtime version consistency check and improved automated compatibility tests.

### 0.2.0-beta.9 (2026-08-09)

- Renamed closed-beta references to public beta across packaging, workflow and documentation.

### 0.2.0-beta.8 (2026-08-09)

- Version update only; no functional changes.

### 0.2.0-beta.7 (2026-08-08)

- Added a real standalone market dropdown for the walking-route editor; only the selected market route is shown while the complete route list remains stored internally.
- Centralized Admin translations in reusable JSON Config i18n variables for all required ioBroker languages.
- Added further repository-checker compliance fixes for responsive tables, CI, Dependabot, button roles and VS Code schemas.


### 0.2.0-beta.6 (2026-08-08)

- Alexa2 instance is now selected from installed/enabled Alexa2 instances instead of free text.
- Alexa lists are offered as dynamically detected dropdown values.
- Walking routes use native ioBroker JSON Config controls again; the faulty custom Module Federation editor has been removed.
- The current-shopping market can be visibly reset to “— No market —” directly in its dropdown; the separate clear button has been removed.
- Renamed the permanent and one-off market settings to make their purpose clearer.
- API protection settings moved into General so they are not overlooked.

### 0.2.0-beta.4 (2026-08-08)

- Added a market filter to the walking-route table so one market can be edited at a time.
- Walking-route rows are grouped alphabetically by market while preserving the configured route order inside each market.
- Added ioBroker repository-checker metadata, responsive JSON Config sizing and explicit JSON Config i18n mode.
- Updated ioBroker adapter dependencies and development testing metadata.
- Replaced plain Node.js timers with adapter-managed timers.
- Added standard GitHub test workflow and Dependabot configuration.

### 0.2.0-beta.2 (2026-08-08)

- New active markets and new product groups automatically receive missing walking-route rows.

### 0.2.0-beta.1 (2026-08-08)

- Added review queue, improved parser and aliases, API safe mode, multi-list support, statistics, transfer tools and beta diagnostics.

### 0.1.0-beta.3 (2026-08-08)

- First public beta npm package with safe value-only Alexa list sorting and fixed-slot ordering.

## Deutsch

### 0.2.0 (2026-08-09)

- Erste stabile Veröffentlichung von ShoppingRoute.
- Vollständige Admin-Übersetzungen für alle unterstützten ioBroker-Sprachen abgeschlossen und den Hilfetext der Laufwege-Auswahl korrigiert.
- Geschützten Stable-Publish über GitHub Actions, npm Trusted Publishing/OIDC und obfuskierten Runtime-Build eingerichtet.
- Kompatibilität mit Alexa2 3.28.3 und alexa-remote2 8.1.0 für `updateListItem` ohne lokale Fremdmodul-Änderung verifiziert.

### 0.2.0-beta.12 (2026-08-09)

- Offiziellen Stable-Release-Deploy-Weg ergänzt, während die öffentliche Beta-Paketierung getrennt bleibt.
- Gemeinsame ioBroker-ESLint-Konfiguration ergänzt und Typ-/Lint-Funde ohne funktionale Änderungen bereinigt.
- Aufgelöste Version von `@iobroker/testing` auf 5.3.0 aktualisiert und Testsuite erneut validiert.

### 0.2.0-beta.11 (2026-08-09)

- Offizielle ioBroker-Paket- und Integrationstests ergänzt sowie weitere Workflow- und JSON-Config-Kompatibilitätskorrekturen abgeschlossen.
- ShoppingRoute auf die MIT-Lizenz umgestellt.
- Public-Beta-Dokumentation, Versionshistorie und Versionsangaben aktualisiert.

### 0.2.0-beta.10 (2026-08-09)

- Admin-7.6-kompatible Oberfläche für Sicherung und Teilen von Konfigurationssicherungen und Marktprofilen ergänzt.
- JSON-Prüfung für den Import von Konfigurationen und Marktprofilen ergänzt.
- Konsistenzprüfung der Runtime-Version korrigiert und automatisierte Kompatibilitätstests erweitert.

### 0.2.0-beta.9 (2026-08-09)

- Bezeichnungen und Dokumentation von „Closed Beta“ auf „Public Beta“ umgestellt, einschließlich Paketbau und Workflow.

### 0.2.0-beta.8 (2026-08-09)

- Reine Versionsanhebung ohne funktionale Änderungen.

### 0.2.0-beta.7 (2026-08-08)

- Echter Markt-Pulldown für den Laufweg-Editor; sichtbar ist nur der ausgewählte Markt, die vollständige Laufwegliste bleibt intern erhalten.
- Admin-Übersetzungen zentral als wiederverwendbare JSON-Config-i18n-Variablen für alle von ioBroker geforderten Sprachen hinterlegt.
- Weitere Checker-Korrekturen für responsive Tabellen, CI, Dependabot, Button-Rollen und VS-Code-Schemas.


### 0.2.0-beta.6 (2026-08-08)

- Alexa2-Instanz wird aus den installierten/aktiven Alexa2-Instanzen ausgewählt statt frei eingetippt.
- Alexa-Listen werden dynamisch erkannt und als Pulldown angeboten.
- Laufwege verwenden wieder ausschließlich native ioBroker-JSON-Config-Komponenten; damit entfällt der fehlerhafte Custom-/Module-Federation-Editor.
- „Markt für aktuellen Einkauf“ lässt sich direkt im Pulldown sichtbar auf „— Kein Markt —“ zurücksetzen; der separate Löschbutton entfällt.
- Dauerhafter Standardmarkt und einmaliger Markt für den aktuellen Einkauf sind verständlicher benannt.
- API-Schutz wurde direkt in „Allgemein“ integriert, damit die Einstellungen nicht übersehen werden.

### 0.2.0-beta.4 (2026-08-08)

- Marktfilter in den Laufwegen: Es kann gezielt nur ein Markt angezeigt und bearbeitet werden.
- Laufwege werden alphabetisch nach Markt gruppiert; die individuelle Reihenfolge innerhalb eines Marktes bleibt erhalten.
- ioBroker-Repochecker-Metadaten, responsive JSON-Config-Größen und expliziter i18n-Modus ergänzt.
- ioBroker-Abhängigkeiten und Entwicklungs-Testmetadaten aktualisiert.
- Globale Timer durch adapterverwaltete Timer ersetzt.
- Standard-GitHub-Testworkflow und Dependabot ergänzt.

### 0.2.0-beta.2 (2026-08-08)

- Neue aktive Märkte und neue Produktgruppen erhalten automatisch fehlende Laufweg-Einträge.

### 0.2.0-beta.1 (2026-08-08)

- Review-Warteschlange, verbesserter Parser und Aliase, API-Schutzmodus, Unterstützung mehrerer Listen, Statistiken, Übertragungswerkzeuge und Beta-Diagnose ergänzt.

### 0.1.0-beta.3 (2026-08-08)

- Erstes öffentliches npm-Betapaket mit sicherer Alexa-Listensortierung nur über value-Texte und feste Positions-IDs.
