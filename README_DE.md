# ShoppingRoute für ioBroker

![ShoppingRoute](admin/shoppingroute.png)

**Aktuelle Version: 0.3.6**

ShoppingRoute sortiert Alexa-Einkaufslisteneinträge nach Markt, Produktgruppe und dem individuellen Laufweg durch den jeweiligen Markt. Dazu vergibt es sichtbare zweistellige Schlüssel wie `20> Bananen` und `40> ═════ ALDI ═════`; verwaltete Listen müssen deshalb in der Alexa-App auf **A–Z** stehen. ShoppingRoute übernimmt lokal die Alexa2-Authentifizierung für direkte Updates, Deletes und Batch-Creates; Alexa2-Listenstates bleiben die Triggerquelle für externe Änderungen.

## Bedienungsanleitung / User guide

🇩🇪 [**Deutsche Bedienungsanleitung**](BEDIENUNGSANLEITUNG_DE.md)  
🇬🇧 [**English user guide**](USER_GUIDE_EN.md)

## Funktionen

- mehrere Alexa-Einkaufslisten mit eigenem Prioritätsmarkt
- globale, listenbezogene und temporäre Marktpriorität
- Markt-Aliase und automatische Erkennung häufiger Marktvarianten
- optionale, automatisch verwaltete Marktüberschriften wie `═════ ALDI ═════`
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
- inkrementelle Präfixsortierung `00>`–`99>` mit Lückenerhalt und Suffix-Fallback
- direkte Amazon-Antworten plus ein abschließender Listenabruf als Bestätigung
- API-Schonmodus mit konfigurierbarem Schreibzugriffs-Limit
- lokale Einkaufsstatistik ohne Cloud-Telemetrie
- Konfigurations-Export/Import
- exportierbare/importierbare Marktprofile zum Teilen von Laufwegen
- datenschutzfreundlicher Diagnose-/Feedbackbericht
- Alexa2/alexa-remote2-Diagnose der direkten Sitzung
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
- `info.versionInstalled` – installierte Adapterversion
- `info.feedbackReport` – bereinigter Diagnose-/Feedbackbericht ohne Einkaufsinhalte
- `control.temporaryPriorityMarket` – temporärer Markt für den aktuellen Einkauf
- `control.importConfigJson` – Konfiguration importieren
- `control.marketProfileImport` – Marktprofil importieren

## Lizenz

ShoppingRoute wird unter der **MIT-Lizenz** veröffentlicht. Frühere bereits veröffentlichte Versionen bleiben unter der jeweils damals gültigen Lizenz.

## Changelog

### 0.3.6 (2026-09-04)

- Vermeidbare Repository-Checker-Warnungen bereinigt.
- Den JSON-Config-i18n-Modus explizit gesetzt und alle bestehenden Übersetzungen in die Standard-Sprachdateistruktur verschoben.
- Veralteten Prepublish-Schutz entfernt und ältere Changelog-Einträge archiviert.
- Sortier- und Laufzeitverhalten wurden nicht geändert.

### 0.3.5 (2026-08-17)

- Verbleibende Repository-Re-Review-Bereinigung mit englischem Statistik-Fallback abgeschlossen.
- Release-Deploy auf denselben regulären und getesteten `npm run build`-Pfad vereinheitlicht.
- Veralteten `stable:build`-/Source-Map-Bereinigungspfad entfernt und die zugehörige Regression-Prüfung angepasst.
- Sortierverhalten und Adapterfunktionalität wurden nicht verändert.

### 0.3.4 (2026-08-14)

- Admin-8-Kompatibilität für alle benutzerdefinierten Admin-Komponenten ergänzt und die Admin-Mindestversion auf 8.0.0 gesetzt.
- Logging mit optionaler Sortier-Abschlussmeldung verbessert und Marktüberschriften deutlicher gestaltet (`═════ MARKT ═════`).
- Prüflisten-Funktion „Alle auf Übernehmen stellen“ repariert; fremde Alexa2-States werden nur noch bei bestätigten Werten verarbeitet.
- Veraltete Timing-/API-Konfigurationsoptionen und die interne npm-Versionsprüfung entfernt.
- Code-Obfuscation und überholte Paketvorbereitungswege entfernt.
- Repository-Review- und Kompatibilitätsbereinigung abgeschlossen, einschließlich englischer Runtime-Log-/State-Texte und begrenzter `maxWritesPerMinute`-Verarbeitung.

### 0.3.3 (2026-08-13)

- Neue direkte `00>`–`99>`-Präfixsortierung für Alexa-Listen in A–Z.
- Sehr schnelle inkrementelle Einfügungen in freie Nummernlücken; nur bei ausgeschöpfter Lücke wird das betroffene Suffix neu aufgebaut.
- Direkte Amazon-Antworten bestätigen jede Operation, anschließend verifiziert genau ein direkter Kontrollabruf das vollständige Listenergebnis.
- Verwaltete Alexa-Listen müssen in der Alexa-App auf **A–Z** gestellt sein.

### 0.3.2 (2026-08-11)

- Den bisherigen Puffer-/Marker-/`updatedDateTime`-Sortierer durch genau eine direkte `00>`–`99>`-Präfixarchitektur für Alexa-Listen in A–Z ersetzt.
- Neue Artikel werden mittig in freie Nummernlücken eingesetzt; reicht eine Lücke nicht, wird nur das kleinste notwendige Suffix seriell gelöscht und mit einem Batch neu erzeugt.
- Die Alexa2-Anmeldedaten werden lokal wiederverwendet, ohne Secrets zu loggen oder Alexa2-Itemstates zu beschreiben. Direkte Amazon-Antworten bestätigen jede Operation; genau ein direkter Listenabruf prüft anschließend den Gesamtlauf.
- Einfachen exklusiven Lebenszyklus `IDLE`/`COLLECTING`/`APPLYING` ergänzt: Ein neuer Artikel wartet höchstens fünf Sekunden, der zweite startet den gemeinsamen Lauf sofort.
- Die alte Marker-Transaktion wurde durch ein kompaktes persistentes Direkt-Apply-Journal und Sicherheitsstopp bei unvollständigem oder uneindeutigem Remote-Ergebnis ersetzt.

### 0.3.1 (2026-08-10)

- Neustartschleife im Prüflisten-Lernmodus korrigiert: identische Wiederholungsbeobachtungen schreiben `reviewItems` nicht mehr allein wegen eines neuen `lastSeen`-Zeitpunkts zurück.

### 0.3.0 (2026-08-10)

- Optionale Marktüberschriften ergänzt (jetziges Format: `═════ MARKT ═════`).
- Überschriften bleiben aktiv, solange mindestens ein echter Artikel des Marktes offen ist, und werden danach vollständig gelöscht statt unter erledigten Artikeln stehen zu bleiben.
- Marktübergreifende Zusammenlegung anhand einer konfigurierbaren Mindestanzahl ergänzt.
- Explizite Marktangaben bleiben von der Zusammenlegung ausnahmslos unberührt.
- Die damalige Header-Verwaltung nutzte Alexa2-Datenpunkte (`#New`, `#delete`). Ab 0.3.2 werden Header als normale präfixierte Items über die direkte, lokal authentifizierte Sitzung verwaltet.

Ältere Versionen: [CHANGELOG_OLD.md](CHANGELOG_OLD.md).

Copyright (c) 2026 RaviniZib
