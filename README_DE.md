# ShoppingRoute für ioBroker

![ShoppingRoute](admin/shoppingroute.png)

**Entwicklungsstand: 0.2.0-beta.2 – Beta**

ShoppingRoute sortiert vorhandene Alexa-Einkaufslisteneinträge nach Markt, Produktgruppe und dem individuellen Laufweg durch den jeweiligen Markt. Dabei werden **keine Einträge angelegt, gelöscht oder automatisch abgehakt**. Der Adapter verteilt ausschließlich die sichtbaren Texte auf bereits vorhandene aktive Alexa-IDs. Die Alexa-App muss für verwaltete Listen auf **„Älteste bis neueste“** gestellt sein.

## Funktionen

- mehrere Alexa-Einkaufslisten mit eigenem Prioritätsmarkt
- globale, listenbezogene und temporäre Marktpriorität
- Markt-Aliase und automatische Erkennung häufiger Marktvarianten
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

## Wichtige Datenpunkte

- `info.previewText` – lesbare Sortiervorschau
- `info.reviewQueue` – unbekannte Artikel
- `info.statistics` – lokale Einkaufsstatistik
- `info.traffic` – API-/Schreibzähler
- `info.configExport` – komplette Konfigurationssicherung
- `info.marketProfiles` – teilbare Marktprofile
- `info.versionInstalled`, `info.versionBeta`, `info.updateAvailable` – Versionsstatus
- `info.feedbackReport` – bereinigter Beta-Fehlerbericht ohne Einkaufsinhalte
- `control.temporaryPriorityMarket` – temporärer Markt für den aktuellen Einkauf
- `control.clearTemporaryPriorityMarket` – temporären Markt löschen
- `control.importConfigJson` – Konfiguration importieren
- `control.marketProfileImport` – Marktprofil importieren

## Hinweis zur ioBroker-Adapterkarte

Solange ShoppingRoute noch nicht im offiziellen ioBroker-Repository geführt wird, kann ioBroker Admin bei **„Verfügbare Version“** generisch **„nicht gewartet“** anzeigen. Das ist keine Aussage des laufenden Adapters. ShoppingRoute zeigt deshalb seinen eigenen npm-Versionsstatus über die `info.version*`-Datenpunkte an.

## Beta-Lizenz

Für diese Beta gilt die im Paket enthaltene **ShoppingRoute Closed Beta License 1.0**. Frühere separat unter einer anderen Lizenz veröffentlichte Versionen bleiben unter der jeweils damals gültigen Lizenz.
