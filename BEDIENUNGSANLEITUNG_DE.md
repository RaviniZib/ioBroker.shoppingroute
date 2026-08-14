# ShoppingRoute – Bedienungsanleitung

**Stand: ioBroker.shoppingroute 0.3.3 (Stable)**

ShoppingRoute sortiert aktive Alexa-Einkaufslisteneinträge nach Markt, Produktgruppe und deinem individuellen Laufweg. Sichtbare zweistellige Präfixe von `00>` bis `99>` bilden den Sortierschlüssel. Marktüberschriften erscheinen als `═════ MARKT ═════`. Einzelne Einträge werden direkt aktualisiert; bei ausgeschöpften Nummernlücken wird nur das notwendige Listensuffix gelöscht und in einem Batch neu angelegt. ShoppingRoute hakt keine Artikel automatisch ab.

> **Wichtig:** Jede von ShoppingRoute verwaltete Alexa-Liste muss in der Alexa-App auf **A–Z** stehen. Für die Ersteinrichtung sollte **Dry-Run** aktiviert bleiben.

## 1. Voraussetzungen

- ioBroker mit Admin ab 7.6.20
- installierte und aktivierte Alexa2-Instanz
- mindestens eine Alexa-Einkaufsliste
- ShoppingRoute 0.3.3 oder neuer

## 2. Grundprinzip

ShoppingRoute beantwortet für jeden Artikel drei Fragen:

1. Zu welchem Markt gehört er?
2. Zu welcher Produktgruppe gehört er?
3. An welcher Stelle liegt diese Produktgruppe im Laufweg des gewählten Marktes?

Beispiel für einen Laufweg:

```text
ALDI
1. Obst/Gemüse
2. Brot/Gebäck
3. Fleisch/Fisch
4. Milchprodukte
5. Getränke
6. TK-Produkte
```

## 3. Erste Einrichtung

### Alexa2-Instanz

Im Reiter **Allgemein** wählst du die gewünschte Alexa2-Instanz. Es werden nur installierte und aktivierte Instanzen angeboten. Nach einem Wechsel der Alexa2-Instanz einmal speichern und die Konfigurationsseite neu öffnen, damit die verfügbaren Listen neu geladen werden.

### Dry-Run

Mit **Dry-Run (nichts zu Alexa schreiben)** liest und analysiert ShoppingRoute die Liste und erzeugt einen Sortierplan, schreibt aber noch keine Änderungen zurück. Erst wenn die Vorschau sinnvoll aussieht, Dry-Run deaktivieren.

## 4. Alexa-Listen

Im Reiter **Listen** legst du fest, welche Alexa-Listen verwaltet werden.

Für jede Liste gibt es:

- **Aktiv** – Liste wird verarbeitet oder ignoriert
- **Alexa-Liste** – Auswahl aus der gewählten Alexa2-Instanz
- **Standardmarkt dieser Liste** – optionaler bevorzugter Markt nur für diese Liste

Mehrere Listen können gleichzeitig verwaltet werden. Jede Liste kann einen eigenen Standardmarkt besitzen.

## 5. Märkte

Im Reiter **Märkte** pflegst du deine Geschäfte.

Jeder Markt besitzt:

- **Aktiv**
- **Reihenfolge**
- **Markt**
- **Aliase**

Aliase werden durch Komma getrennt, zum Beispiel:

```text
REWE
Aliase: Rewe, Rewe Markt, Rewe Center
```

Die Marktreihenfolge ist die oberste Sortierebene. Häufige Varianten von ALDI, LIDL, REWE und PENNY werden zusätzlich automatisch erkannt.

Der Markt **„Ohne Markt“** eignet sich als Auffangbereich für nicht eindeutig zuordenbare Artikel.

## 6. Produktgruppen

Im Reiter **Produktgruppen** definierst du die Bereiche, nach denen innerhalb eines Marktes sortiert wird, zum Beispiel:

- Obst/Gemüse
- Brot/Gebäck
- Fleisch/Fisch
- Milchprodukte
- Getränke
- TK-Produkte
- Haushalt/Hygiene
- Nonfood
- Sonstiges

`Produktgruppen` ist die zentrale Hauptliste aller bekannten Gruppen. Die Laufwege der einzelnen Märkte werden unabhängig voneinander gespeichert. Im Laufweg-Editor werden zum Hinzufügen nur die Gruppen angeboten, die im gewählten Markt noch fehlen. Das Hinzufügen oder Löschen einer Laufwegzeile verändert weder die Hauptliste noch die Laufwege anderer Märkte.

## 7. Laufwege

Im Reiter **Laufwege** wählst du zunächst einen aktiven Markt. Darunter wird nur der Laufweg dieses Marktes angezeigt.

Die sichtbare Reihenfolge entspricht deinem Weg durch das Geschäft. Verschiedene Märkte dürfen völlig unterschiedliche Laufwege besitzen.

Beispiel:

```text
REWE
1. Getränke
2. Obst/Gemüse
3. Brot/Gebäck
4. Milchprodukte
5. Fleisch/Fisch
6. TK-Produkte
```

Die internen Ordnungswerte werden automatisch passend neu nummeriert.

## 8. Artikelstamm

Im Reiter **Artikel** werden bekannte Produkte gepflegt.

### Name

Der Hauptname des Artikels, zum Beispiel `Milch`.

### Aliase

Alternative Schreibweisen oder Bezeichnungen. Mehrere Aliase können durch Komma oder Semikolon getrennt werden.

### Produktgruppe

Bestimmt die Position des Artikels innerhalb des Laufwegs.

### Standardmarkt

Optionaler bevorzugter Markt dieses Artikels. Ein Artikel-Standardmarkt hat Vorrang vor allgemeinen Marktprioritäten.

### Verfügbare Märkte

Mehrere mögliche Märkte können durch Komma oder Semikolon angegeben werden, zum Beispiel:

```text
ALDI, REWE, LIDL
```

Mehrere verfügbare Märkte werden erkannt. Flexible Artikel können anhand der konfigurierten Mindestanzahl marktübergreifend optimiert werden; explizite Marktangaben bleiben dabei unverändert.

## 9. Markt direkt über Alexa vorgeben

ShoppingRoute erkennt ausdrücklich genannte Märkte am Ende des Eintrags, insbesondere:

```text
Milch von REWE
Milch bei ALDI
Cola bei LIDL
```

Eine solche ausdrückliche Angabe hat Vorrang vor Standard- und Prioritätsregeln.

## 10. Mengenangaben

Viele übliche Mengenangaben werden für die Produkterkennung vom eigentlichen Artikelnamen getrennt, bleiben aber im sichtbaren Alexa-Text erhalten.

Beispiele:

```text
2 Milch
3 Packungen Milch
zwei Flaschen Cola
1,5 kg Kartoffeln
6x Wasser
halbes Kilo Hack
```

## 11. Markt-Prioritäten

Wenn kein Markt ausdrücklich genannt wurde, gilt grundsätzlich folgende Reihenfolge:

1. ausdrücklich im Alexa-Text genannter Markt
2. Standardmarkt des Artikels
3. temporärer Markt für den aktuellen Einkauf
4. Standardmarkt der jeweiligen Alexa-Liste
5. allgemeiner Standardmarkt für Einkäufe
6. erster passender Markt aus „Verfügbare Märkte“
7. Fallback-Markt

Der temporäre Markt kann über folgenden Datenpunkt gesetzt werden:

```text
shoppingroute.0.control.temporaryPriorityMarket
```

Damit lässt sich für einen einzelnen Einkauf ein anderer Markt bevorzugen, ohne die dauerhafte Konfiguration zu ändern.

## 12. Unbekannte Artikel

Unter **Allgemein → Umgang mit unbekannten Artikeln** stehen drei Modi zur Verfügung:

- **Erst prüfen** – unbekannte Artikel landen in der Prüfliste
- **Automatisch lernen** – eindeutige unbekannte Artikel werden automatisch übernommen
- **Nicht lernen** – unbekannte Artikel werden nicht dauerhaft übernommen

Für den normalen Betrieb empfiehlt sich zunächst **Erst prüfen**.

## 13. Prüfliste

Im Reiter **Prüfliste** können unbekannte Artikel kontrolliert werden. Bearbeitbar sind unter anderem Produktname, Produktgruppe, Standardmarkt und Aliase.

Mögliche Aktionen:

- **Ausstehend**
- **Übernehmen**
- **Ignorieren**

Beim Übernehmen wird der Artikel in den Artikelstamm aufgenommen beziehungsweise ein bereits bekannter Artikel ergänzt.

## 14. Alias-Vorschläge

Mit **Aliase automatisch vorschlagen** versucht ShoppingRoute, unterschiedliche Schreibweisen bekannter Artikel zu erkennen. Vorschläge stehen unter:

```text
shoppingroute.0.info.aliasSuggestions
```

## 15. Sortiervorschau

Besonders wichtig während der Einrichtung sind:

```text
shoppingroute.0.info.preview
shoppingroute.0.info.previewText
shoppingroute.0.info.lastPlan
```

`previewText` enthält eine lesbare Vorschau mit Position, bisherigem Text, Zieltext, Markt und Produktgruppe.

## 16. Manuell sortieren und Automatik schalten

Eine Sortierung kann manuell angestoßen werden über:

```text
shoppingroute.0.control.sortNow
```

Die automatische Sortierung lässt sich über diesen Datenpunkt ein- oder ausschalten:

```text
shoppingroute.0.control.enabled
```

## 17. API-Schutz

ShoppingRoute besitzt einen API-Schonmodus, damit Alexa nicht unnötig mit vielen direkten Schreibzugriffen belastet wird. Batch-CREATE wird bevorzugt; einzelne PUT- und DELETE-Anfragen laufen seriell.

Einstellbar sind unter anderem:

- maximale Schreibvorgänge pro Minute
- Schreibvorgänge pro Block
- Pause zwischen Blöcken
- maximale Wiederholungen
- Grundpause für Wiederholungen
- Schreibpause zwischen einzelnen Änderungen
- Verzögerung vor der Verarbeitung einer Listenänderung

Für den normalen Betrieb sollte der API-Schonmodus aktiviert bleiben, solange kein konkreter Grund für Änderungen besteht.

Aktuelle Zähler stehen unter:

```text
shoppingroute.0.info.traffic
```

## 18. Direkte Alexa-Verbindungsprüfung

ShoppingRoute kann prüfen, ob aus der lokalen Alexa2-Anmeldung eine direkte, lesbare alexa-remote2-Sitzung aufgebaut werden kann. Dabei wird kein Test-Write ausgeführt.

Wichtige Datenpunkte:

```text
shoppingroute.0.control.compatibilityTest
shoppingroute.0.info.compatibility
shoppingroute.0.info.lastCompatibilityTest
shoppingroute.0.info.writeCapability
```

## 19. Sicherung und Wiederherstellung

Im Reiter **Sicherung / Teilen** öffnet **„Sicherung / Teilen öffnen“** eine eigene Oberfläche.

Dort kann die komplette ShoppingRoute-Konfiguration als JSON-Datei heruntergeladen und später wiederhergestellt werden. Vor größeren Änderungen an Märkten, Laufwegen oder dem Artikelstamm empfiehlt sich eine Sicherung.

## 20. Marktprofile teilen

Ein Marktprofil enthält den Markt und seinen Laufweg. Damit kann ein gepflegter Markt auf eine andere ShoppingRoute-Installation übertragen werden.

In **Sicherung / Teilen** kannst du:

1. einen Markt auswählen,
2. sein Marktprofil herunterladen,
3. ein vorhandenes Marktprofil importieren.

Beim Import wird der betreffende Markt mit seinem Laufweg übernommen beziehungsweise ersetzt.

## 21. Diagnose und Statistiken

Hilfreiche Datenpunkte sind:

```text
shoppingroute.0.info.connection
shoppingroute.0.info.lastError
shoppingroute.0.info.lastSort
shoppingroute.0.info.statistics
shoppingroute.0.info.traffic
shoppingroute.0.info.feedbackReport
shoppingroute.0.info.versionInstalled
shoppingroute.0.info.versionBeta
shoppingroute.0.info.updateAvailable
```

Der Diagnose-/Feedbackbericht ist dafür vorgesehen, technische Informationen bereitzustellen, ohne Einkaufsinhalte unnötig offenzulegen.

## 22. Typische Probleme

### Alexa-Listen werden nicht angeboten

Alexa2-Instanz prüfen, in ShoppingRoute auswählen, speichern und die Konfigurationsseite neu öffnen.

### Reihenfolge in Alexa wirkt falsch

Prüfen, ob die betreffende Liste in der Alexa-App auf **A–Z** steht und alle aktiven Einträge einen Präfix `00>`–`99>` besitzen.

### Artikel landet im falschen Markt

In dieser Reihenfolge prüfen:

1. ausdrückliche Angabe `bei <Markt>` oder `von <Markt>`
2. Standardmarkt des Artikels
3. temporärer Markt
4. Standardmarkt der Liste
5. allgemeiner Standardmarkt
6. verfügbare Märkte
7. Fallback-Markt

### Artikel landet an falscher Position

Produktgruppe und Laufweg des betreffenden Marktes prüfen.

### Unbekannte Artikel werden nicht übernommen

Den Modus unter **Umgang mit unbekannten Artikeln** prüfen.

### Zu viele Schreibfehler

API-Schonmodus, Schreibpausen und `info.traffic`, `info.compatibility` sowie `info.lastError` prüfen.

## 23. Empfohlene Ersteinrichtung

1. Alexa2-Instanz auswählen.
2. Dry-Run eingeschaltet lassen.
3. Alexa-Liste auswählen und in Alexa auf A–Z stellen.
4. Märkte anlegen oder kontrollieren.
5. Produktgruppen kontrollieren.
6. Für jeden Markt den Laufweg sortieren.
7. Erste wichtige Artikel im Artikelstamm pflegen.
8. Lernmodus auf **Erst prüfen** stellen.
9. Testartikel über Alexa eintragen.
10. `info.previewText` kontrollieren.
11. Prüfliste bearbeiten.
12. Wenn die Vorschau stimmt, Dry-Run deaktivieren.
13. Konfigurationssicherung erstellen.

## 24. Versionshinweis

Diese Anleitung beschreibt **ShoppingRoute 0.3.3 Stable** mit automatischen Marktüberschriften, marktübergreifender Optimierung und direkter `00>`–`99>`-Präfixsortierung. Jede verwaltete Alexa-Liste muss in der Alexa-App auf **A–Z** gestellt sein.

## Lizenz

MIT-Lizenz. Copyright (c) 2026 RaviniZib.
