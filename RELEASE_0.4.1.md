# ShoppingRoute 0.4.1 – Release-Prüfung

## Vollständigkeit

| Punkt | Enthalten / Nachweis |
| --- | --- |
| F01 Prüflistenübernahme | Übernahme und Zeilenentfernung im selben Entwurf; Einzel-/Sammelübernahme und echte Persistenz geprüft |
| F02 Zusätzliche Märkte | Einzelne Checkboxen, sichtbare Auswahl; vorhandene weitere Märkte bleiben erhalten |
| F03 Markt-Strings/Arrays | Normalisierung und bestehende Regressionstests erhalten |
| F04 Überschriftenfilter | Alte, unbekannte und vertippte Marktüberschriften bleiben ausgefiltert |
| F05 Einkaufsliste | Einspaltige, responsive Darstellung erhalten |
| F06 Leere Märkte | Verwaiste Überschriften werden beim Sortieren bzw. Löschen entfernt; Schreibstopp bleibt wirksam |
| F07 Dokumentation | History, Fehlerbericht und beide Anleitungen aktualisiert |
| F08 Drag-and-drop-Duplikate | Ein Drop-Aufruf; synchrone UI-/Backend-Sperren vor asynchroner Verarbeitung |
| F09 Löschtaste | Konkrete Amazon-ID, persistentes Journal und direkte Bestätigung; gleichnamige andere IDs bleiben erhalten |
| F10 map-Absturz | Antwortprüfung, Fehleranzeige und erneutes Laden; gültige alte Ansicht bleibt bei Fehlern erhalten |

Frank bestätigt alle bislang gemeldeten Fehler als behoben. Das ist eine Benutzerabnahme, keine Behauptung vollständiger automatisierter Browser-Abdeckung. Der historische Auslöser der unvollständigen Antwort bei F10 ist nicht aufgezeichnet.

## E-Mails, Issues und Pull Requests

Alle acht in den verbundenen Postfächern auffindbaren ShoppingRoute-/PR-6434-E-Mails wurden gelesen; Outlook lieferte keine zusätzlichen Treffer. Die aktuelle Mail betrifft E2004, E4048, E4050, E4051, E6034 und S0064. Alle sechs Korrekturen sind in PR #40 enthalten. Ältere Mails bestätigen bereits behobene Adapter-core- und Objektstruktur-Punkte.

Einzig offenes Adapter-Issue bei der Prüfung: #16. Öffentlicher Bot-Recheck ist angefordert. W4001 betrifft die weiter offene Aufnahme in ioBroker/ioBroker.repositories#6434 und ist laut Checker bei vorhandenem Aufnahme-PR zulässig.

Offene Update-PRs wurden geprüft: #29 Vite 8, #22 React 19 und #5 TypeScript 7 sind separate Hauptversionsupdates; #28 aktualisiert die tsconfig-Lockversion. Diese Updates gehören nicht zur Fehlerkorrektur 0.4.1. #8 schlägt testing-action-check@v2 vor, das auf main bereits eingesetzt wird. Alte fehlgeschlagene Update-PR-Läufe sind keine Fehler des geprüften Release-Stands.

## Veröffentlichung

Basis: gemergter PR #40, Commit 9845243. Alle zehn CI-Jobs dieses Hauptbranch-Stands sind bestanden. Laufzeit-Audit: 0 Schwachstellen. Dependabot-Sicherheitswarnungen sind im Repository nicht aktiviert; der Audit ersetzt keine unbekannten Befunde dieser deaktivierten Funktion.

Version 0.4.1 wird als eigenes Patch-Release veröffentlicht. Bestehende npm-Versionen und Tags werden nicht überschrieben. Der Tag-Workflow prüft erneut vor dem Deploy. Sentry bleibt wie zuvor bewusst deaktiviert. npm-Herkunftsnachweis und Paketinhalt werden nach Veröffentlichung geprüft.

Vollständiger Remote-Repository-Check auf GitHub-SHA 9845243: **0 Fehler, 1 Warnung W4001, 0 Vorschläge**. Die fehlgeschlagenen kurzen Diagnoseaufrufe davor sind keine bestandenen Prüfungen. Der aktuelle vollständige Lauf ist protokolliert.

Abschließende lokale Prüfung des vorbereiteten 0.4.1-Stands: 149 Unit-/Komponententests bestanden, 0 fehlgeschlagen; 70 Paketprüfungen bestanden; ESLint und TypeScript ohne Befund. Build und `git diff --check` erfolgreich. Pack-Vorschau: 83 Dateien, erforderliche Backend- und Admin-Dateien enthalten, keine Tests oder node_modules. Die endgültigen Tag-CI- und npm-Nachweise folgen bei der Veröffentlichung.
