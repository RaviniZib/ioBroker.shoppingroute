# ShoppingRoute für ioBroker

![ShoppingRoute](admin/shoppingroute.png)

**Aktuelle Version: 0.3.1**

ShoppingRoute sortiert Alexa-Einkaufslisteneinträge nach Markt, Produktgruppe und dem individuellen Laufweg durch den jeweiligen Markt. Normale Einkaufsartikel werden weiterhin ausschließlich über ihre vorhandenen Alexa-IDs und sichtbaren Texte sortiert. Optional kann ShoppingRoute über Alexa2 eigene Marktüberschriften wie `---- ALDI ----` anlegen. Sobald ein Markt nicht mehr benötigt wird, löscht ShoppingRoute ausschließlich diesen selbst verwalteten Überschriftseintrag wieder vollständig. Die Alexa-App muss für verwaltete Listen auf **„Älteste bis neueste“** gestellt sein.

## Bedienungsanleitung / User guide

🇩🇪 [**Deutsche Bedienungsanleitung**](BEDIENUNGSANLEITUNG_DE.md)  
🇬🇧 [**English user guide**](USER_GUIDE_EN.md)

## Funktionen

- mehrere Alexa-Einkaufslisten mit eigenem Prioritätsmarkt
- globale, listenbezogene und temporäre Marktpriorität
- Markt-Aliase und automatische Erkennung häufiger Marktvarianten
- optionale, automatisch verwaltete Marktüberschriften wie `---- ALDI ----`
- optionale marktübergreifende Zusammenlegung anhand einer Mindestanzahl von Artikeln pro zusätzlichem Markt; explizite Marktangaben bleiben unverändert
- frei pflegbare Produktgruppen und marktbezogene Laufwege
- Laufweg nach Tabellenreihenfolge; Reihenfolgen werden automatisch neu nummeriert
- Artikelstamm mit Aliasen, Produktgruppe, bevorzugtem Markt und verfügbaren Märkten
- verbesserter Mengenparser für Zahlen, Zahlwörter, Packungen, Kisten, halbes Kilo, `6x` usw.
- Duplikaterkennung beim Lernen unbekannter Produkte
- Prüfliste für unbekannte Artikel mit Übernehmen/Ändern/Ignorieren
- automatische oder manuelle Lernstrategie
- intelligente Kategorie-Vorschläge aus Regeln und bereits bekannten Artikeln
- Alias-Vorschläge für erkannte Schreibvarianten
- Sortiervorschau vor Alexa-Schreibzugriffen
- API-Schonmodus mit Rate-Limit, Blöcken und Retry-Backoff
- lokale Einkaufsstatistik ohne Cloud-Telemetrie
- Konfigurations-Export/Import
- exportierbare/importierbare Marktprofile zum Teilen von Laufwegen
- npm-Beta-Versionsprüfung im Adapter
- datenschutzfreundlicher Diagnose-/Feedbackbericht
- Alexa2/alexa-remote2-Kompatibilitätsprüfung vor echten Schreibzugriffen
- Dry-Run für sichere Tests

## Prioritätslogik

Bei der Marktzuordnung gilt:

1. ausdrücklich genannter Markt (`Milch von REWE`)
2. Artikel-Standardmarkt
3. temporärer Prioritätsmarkt
4. Prioritätsmarkt der jeweiligen Alexa-Liste
5. globaler Prioritätsmarkt
6. erster erlaubter Markt aus „Verfügbare Märkte“
7. Fallback-Markt

Anschließend kann 0.3.0 flexible Artikel marktübergreifend zusammenlegen, wenn ein zusätzlicher Markt die konfigurierte Mindestanzahl nicht erreicht. Dafür werden ausschließlich im Artikelstamm hinterlegte alternative verfügbare Märkte verwendet. Explizite Angaben wie `Milch von LIDL` oder `Eier bei ALDI` werden niemals verschoben.

## Wichtige Datenpunkte

- `info.previewText` – lesbare Sortiervorschau
- `info.reviewQueue` – unbekannte Artikel
- `info.statistics` – lokale Einkaufsstatistik
- `info.traffic` – API-/Schreibzähler
- `info.sortTransaction` – lokales Wiederherstellungsjournal einer laufenden Sortierung; im Normalzustand `{}`
- `info.configExport` – komplette Konfigurationssicherung
- `info.marketProfiles` – teilbare Marktprofile
- `info.versionInstalled`, `info.versionBeta`, `info.updateAvailable` – Versionsstatus
- `info.feedbackReport` – bereinigter Diagnose-/Feedbackbericht ohne Einkaufsinhalte
- `control.temporaryPriorityMarket` – temporärer Markt für den aktuellen Einkauf
- `control.importConfigJson` – Konfiguration importieren
- `control.marketProfileImport` – Marktprofil importieren

## Hinweis zur ioBroker-Adapterkarte

Solange ShoppingRoute noch nicht im offiziellen ioBroker-Repository geführt wird, kann ioBroker Admin bei **„Verfügbare Version“** generisch **„nicht gewartet“** anzeigen. Das ist keine Aussage des laufenden Adapters. ShoppingRoute zeigt deshalb seinen eigenen npm-Versionsstatus über die `info.version*`-Datenpunkte an.

## Lizenzierung der Beta-Versionen

ShoppingRoute wird ab dieser Version unter der **MIT-Lizenz** veröffentlicht. Frühere bereits veröffentlichte Versionen bleiben unter der jeweils damals gültigen Lizenz.

## Changelog

### Unveröffentlicht

- List-Stability-Guard: Nach jeder Alexa2-Listenänderung wartet ShoppingRoute mindestens 30 Sekunden ohne weitere Listenänderung, bevor Sortierschreibzugriffe beginnen. Taucht während einer gepufferten Sortierung eine neue aktive ID auf, wird der bestätigte Sortierpfad rückwärts zurückgesetzt; die neue ID selbst bleibt unangetastet. Auch die `updatedDateTime`-Finalisierung bricht bei neuen IDs sofort ab und plant erst nach erneuter Synchronisationsruhe neu.

- Die sichtbare Alexa-Reihenfolge wird nach der gepufferten Inhalts-Permutation jetzt anhand von `updatedDateTime` finalisiert. Dafür werden nur die minimal notwendigen Einträge mit ihrem unveränderten Text erneut bestätigt; normale Einkaufsartikel werden weiterhin weder gelöscht noch neu angelegt. Dadurch bleibt der Puffer-Schutz gegen Artikelvervielfältigung erhalten, während „Älteste bis neueste“ in der Alexa-App wieder dem ShoppingRoute-Sortierplan entspricht.

- Zieltexte der Sortierplanung werden jetzt genauso wie die vorhandenen Alexa-Listentexte an den Rändern bereinigt. Dadurch kann ein unsichtbares nachgestelltes Leerzeichen (z. B. `Camembert `) die gepufferte Permutationsprüfung nicht mehr fälschlich blockieren.

- Die direkte, schrittweise Textumverteilung wurde durch eine gepufferte Euler-Kreis-Transaktion ersetzt. Pro getrenntem Wertekreis wird genau ein temporärer Pufferwert verwendet; normale Einkaufsartikel werden weder gelöscht noch neu angelegt und der Amazon-Schreibverkehr bleibt nahe an der Zahl der tatsächlich geänderten Listenplätze.
- Ein dauerhaftes lokales Sortierjournal (`info.sortTransaction`) wurde ergänzt. Jeder bestätigte Schritt wird lokal festgehalten; nach einem Neustart wird eine unterbrochene Transaktion Schritt für Schritt rückwärts aufgelöst, statt einen Zwischenstand der Alexa-Liste als neue Wahrheit zu übernehmen.
- Jeder Sortierschritt wird von Alexa2 bestätigt. Bei einem nicht eindeutig auflösbaren Schreibstatus greift ein Sicherheitsstopp. Tauchen während einer laufenden Transaktion neue aktive Artikel auf, wird die gepufferte Sortierung sicher abgebrochen und erst nach einer erneuten 30-sekündigen Synchronisationsruhe neu geplant.
- Admin-Korrekturen für voneinander unabhängige Marktlaufwege, neu angelegte Märkte/Produktgruppen, die Mehrfachauswahl alternativer Märkte in Artikel- und Prüfliste sowie „Alle übernehmen“ dokumentiert und abgesichert.
- Dokumentiert, dass ShoppingRoute ausschließlich den von Alexa2 aktuell gelieferten Listenstand verarbeiten kann. Bei einer festhängenden Alexa2-Listensynchronisierung erscheinen neue App-Einträge deshalb erst nach der erneuten Alexa2-Synchronisierung in ShoppingRoute.

### 0.3.1 (2026-08-10)

- Neustartschleife im Prüflisten-Lernmodus korrigiert: identische Wiederholungsbeobachtungen schreiben `reviewItems` nicht mehr allein wegen eines neuen `lastSeen`-Zeitpunkts zurück.

### 0.3.0 (2026-08-10)

- Optionale Marktüberschriften im Format `---- MARKT ----` ergänzt.
- Überschriften bleiben aktiv, solange mindestens ein echter Artikel des Marktes offen ist, und werden danach vollständig gelöscht statt unter erledigten Artikeln stehen zu bleiben.
- Marktübergreifende Zusammenlegung anhand einer konfigurierbaren Mindestanzahl ergänzt.
- Explizite Marktangaben bleiben von der Zusammenlegung ausnahmslos unberührt.
- Header-Verwaltung nutzt ausschließlich Alexa2-Datenpunkte (`#New`, `#delete`) und erzeugt keine zweite Amazon-Sitzung; normale Einkaufsartikel werden niemals automatisch gelöscht oder erledigt.

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

## Lizenz

MIT-Lizenz. Die vollständigen Bedingungen stehen in LICENSE.

Copyright (c) 2026 RaviniZib
