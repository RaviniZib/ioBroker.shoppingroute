# ioBroker.shoppingroute

<p align="center">
  <img src="admin/shoppingroute.png" width="190" alt="ShoppingRoute logo">
</p>

**Entwicklungsstand: 0.1.0-beta.3 – geschlossene Beta**

`ioBroker.shoppingroute` sortiert eine vorhandene Alexa-Einkaufsliste nach **Einkaufsmarkt** und dem **individuellen Laufweg durch den jeweiligen Markt**. Die originale Alexa-App bleibt die einzige App für den Einkauf und die Artikel werden dort weiterhin ganz normal abgehakt.

## Grundidee

Alexa vergibt für jeden Listeneintrag eine ID und einen Erstellungszeitpunkt. Wenn die Alexa-App auf **„Älteste bis neueste“** eingestellt ist, können diese vorhandenen IDs als feste Listenplätze verwendet werden.

Der Adapter:

1. liest ausschließlich die **aktiven** Einträge aus `alexa2.x.Lists.<LISTE>.json`,
2. sortiert die vorhandenen IDs nach `createdDateTime` von alt nach neu,
3. analysiert unabhängig davon die Artikelnamen,
4. sortiert die Artikel nach **Markt → Laufweg/Kategorie → Artikelname**,
5. schreibt ausschließlich die sichtbaren `value`-Texte auf die bereits vorhandenen IDs zurück.

### Harte Sicherheitsregel

Der Adapter verwendet **niemals**:

- `#New`
- `#delete`
- `completed`

Er legt also selbst keine Alexa-Listeneinträge an, löscht keine und hakt keine ab.

## Alexa-App vorbereiten

In der Alexa-App für die Einkaufsliste einstellen:

**Sortieren nach → Älteste bis neueste**

Ohne diese Einstellung kann die App ihre eigene A–Z-Sortierung über die vom Adapter erzeugte Reihenfolge legen.

## Beispiele

### Markt explizit nennen

Sprachbefehl sinngemäß:

`Alexa, setze Bananen von Aldi auf die Einkaufsliste.`

Der sichtbare Eintrag bleibt:

`Bananen von Aldi`

Intern erkennt der Adapter:

- Artikel: `Bananen`
- Markt: `ALDI`
- Kategorie: `Obst/Gemüse`

### Mengenangaben

Auch folgende Einträge bleiben sichtbar unverändert:

- `3 Bananen von Aldi`
- `2 Packungen Eier von Penny`
- `500 Gramm Hackfleisch von Lidl`

Die Menge wird nur für die Artikelerkennung ausgeblendet, niemals aus dem Alexa-Text entfernt.

### Prioritätsmarkt

Optional kann ein **Prioritätsmarkt** festgelegt werden. Damit muss der bevorzugte Markt nicht bei jedem Artikel mitgesprochen werden.

Beispiel mit `Prioritätsmarkt = LIDL`:

- `Milch` → LIDL
- `Bananen` → LIDL
- `Cola von Rewe` → REWE
- hat `Katzenfutter` im Artikelstamm den Standardmarkt ALDI → ALDI

Die Reihenfolge der Marktentscheidung ist verbindlich:

**ausdrücklich genannter Markt → Artikel-Standardmarkt → Prioritätsmarkt → Fallback-Markt**

Der Prioritätsmarkt wird beim automatischen Lernen eines Artikels **nicht** als fester Standardmarkt gespeichert. Ein späterer Wechsel des Prioritätsmarkts wirkt dadurch auch auf bereits gelernte Artikel ohne eigenen Standardmarkt.

## Konfiguration

### Allgemein

- Alexa2-Instanz, z. B. `alexa2.0`
- Listenname, normalerweise `SHOP`
- Dry-Run
- unbekannte Artikel automatisch lernen
- Wartezeit nach Listenänderungen
- Pause zwischen Alexa-`value`-Updates
- Fallback-Hauptkategorie/Markt
- Prioritätsmarkt, z. B. `LIDL` (optional)

### Märkte / Hauptkategorien

Beliebig viele Märkte können angelegt und in eine Reihenfolge gebracht werden.

Beispiel:

1. ALDI
2. PENNY
3. LIDL
4. REWE
5. Ohne Markt

Aliase ermöglichen z. B. `Aldi` und `Aldi Nord` für denselben Markt.

### Produktgruppen

Produktgruppen wie `Obst/Gemüse`, `TK-Produkte`, `Milchprodukte` oder `Nonfood` werden zentral in einem eigenen Reiter gepflegt. In **Artikel** und **Laufwege** werden Produktgruppen nicht mehr frei eingetippt, sondern aus dieser Liste per Pulldown ausgewählt. Nach Änderungen an den Produktgruppen die Konfiguration speichern, damit die Auswahllisten neu geladen werden.

### Laufwege

Jeder Markt bekommt eine eigene Kategorienreihenfolge.

Beispiel ALDI:

1. Obst/Gemüse
2. Brot/Gebäck
3. Fleisch/Fisch
4. Wurst/Salate/Teigwaren
5. Milchprodukte
6. Konserven
7. Getränke
8. TK-Produkte
9. Nonfood

PENNY kann eine vollständig andere Reihenfolge besitzen.

### Artikelstamm

Pro Artikel können gepflegt werden:

- Name
- Aliase
- Kategorie
- Standardmarkt

Ein ausdrücklich genannter Markt (`Bananen von Penny`) hat Vorrang vor dem Standardmarkt des Artikels.

## Unbekannte Artikel und automatisches Lernen

Nicht im Artikelstamm vorhandene Artikel werden nicht blockiert. Ab 0.0.2 können sie automatisch in den Artikelstamm übernommen werden. Dabei wird eine Kategorie heuristisch vorgeschlagen; ein globaler Prioritätsmarkt wird **nicht** als fester Artikel-Standardmarkt gespeichert.

Dry-Run verhindert ausschließlich Alexa-Schreibzugriffe. Das Lernen neuer Artikel darf weiterhin stattfinden, damit sich der Artikelstamm gefahrlos aufbauen lässt.

Nicht automatisch gelernte unbekannte Artikel werden nach

`shoppingroute.0.info.unknownItems`

geschrieben. Neu gelernte Artikel stehen zusätzlich unter

`shoppingroute.0.info.lastLearnedItems`.

Ein unbekannter Text mit einem nicht erkannten Suffix wie `35 Sushi von Ukuhama` wird aus Sicherheitsgründen nicht automatisch als Produkt `Sushi von Ukuhama` gelernt. `Ukuhama` könnte ein noch nicht angelegter Markt oder auch eine Marke sein. Solche Einträge übernehmen deshalb auch **nicht** den Prioritätsmarkt, sondern bleiben im Fallback-Markt und zur manuellen Klärung in `info.unknownItems`.

## Verhalten während des Einkaufs

Wenn während einer laufenden Umsortierung ein Artikel hinzugefügt oder abgehakt wird, erkennt der Adapter die geänderte Menge aktiver IDs, bricht den aktuellen Durchlauf ab und berechnet die Liste anschließend neu.

Es werden außerdem nur Plätze beschrieben, deren Text sich tatsächlich ändern muss.

## Datenpunkte

- `info.connection`
- `info.activeItems`
- `info.lastSort`
- `info.lastError`
- `info.lastPlan`
- `info.unknownItems`
- `info.lastLearnedItems`
- `info.writeCapability`
- `info.compatibility`
- `info.lastCompatibilityTest`
- `control.enabled`
- `control.sortNow`
- `control.compatibilityTest`

`info.lastPlan` ist besonders für den Dry-Run gedacht und zeigt vor dem echten Schreiben exakt, welcher Text auf welche vorhandene Alexa-ID geschrieben würde.

## Dry-Run

Neue Installationen starten standardmäßig mit **Dry-Run = EIN**.

Damit wird die Sortierung vollständig berechnet und protokolliert, aber Alexa wird nicht verändert. Erst wenn das Ergebnis plausibel ist, sollte Dry-Run in der Adapterkonfiguration deaktiviert werden.


## Beta-Sicherheitsprüfung ab 0.1.0-beta.1

Vor echten Alexa-Schreibzugriffen prüft die Beta den installierten Alexa2/alexa-remote2-Pfad auf den bekannten `updateListItem`-Fehler. Das Ergebnis steht in `shoppingroute.0.info.writeCapability` und ausführlich in `shoppingroute.0.info.compatibility`.

Bei `source-ok` oder `live-ok` sind echte Sortier-Schreibzugriffe freigegeben. Bei `known-bug`, `live-failed` oder `unknown` werden sie blockiert; Dry-Run funktioniert weiterhin. Ist der Status `unknown`, kann mit mindestens einem aktiven Listeneintrag `shoppingroute.0.control.compatibilityTest` einmal auf `true` gesetzt werden. Der Test schreibt ausschließlich denselben sichtbaren `value` erneut und verändert den sichtbaren Artikelnamen nicht.

Eine Schritt-für-Schritt-Anleitung für Tester steht in [BETA_TESTING_DE.md](BETA_TESTING_DE.md).

## Aktueller Alexa2-Hinweis

Während der Entwicklung im August 2026 wurde in einer verwendeten `alexa-remote2`-Version ein Fehler beim Aktualisieren von Listeneinträgen gefunden. In `updateListItem` war die Versions-Query als

`?version =${options.version}`

statt

`?version=${options.version}`

gebildet. In der Testinstallation musste dieser Fehler korrigiert werden, bevor `value`/`completed`-Updates von Amazon akzeptiert wurden.

**Für eine öffentliche Release-Version von shoppingroute ist ein upstream behobener Alexa2/alexa-remote2-Stand Voraussetzung.** Nutzer sollen später keine Dateien in `node_modules` manuell verändern müssen.

## Entwicklungsinstallation

Das Repository ist zunächst für Tests über GitHub vorgesehen. Nach dem Push auf GitHub kann es in ioBroker im Expertenmodus über die benutzerdefinierte GitHub-/URL-Installation installiert werden.

Vor einem späteren offiziellen Release folgen mindestens:

- Test auf mehreren ioBroker-Systemen
- Prüfung der Admin-JSONConfig
- Kompatibilitätstest mit aktuellen Alexa2-Versionen
- npm-Veröffentlichung
- Antrag für das ioBroker-Latest-Repository

## Lizenz

Closed Beta License 1.0 © 2026 RaviniZib – siehe LICENSE


### Admin-Oberfläche ab 0.0.4

Fallback-Markt und Prioritätsmarkt werden als Pulldown aus den aktiven Märkten angeboten. Auch Standardmarkt im Artikelstamm und Markt im Laufweg sind Pulldowns. Dynamische Markt- und Produktgruppenlisten werden alphabetisch sortiert. Im Artikelstamm können die Spalten Artikel, Produktgruppe und Standardmarkt über den Spaltenkopf sortiert werden; innerhalb gleicher Gruppen bleibt die alphabetische Artikelreihenfolge erhalten.


## API-/Traffic-Diagnose

ShoppingRoute arbeitet ereignisgesteuert auf dem lokalen ioBroker-Datenpunkt der Alexa-Liste und führt kein eigenes Cloud-Polling durch. Für die geschlossene Beta zählt der Adapter deshalb getrennt lokale Listenprüfungen, geplante Änderungen, echte Sortierläufe und tatsächliche Alexa-`value`-Schreibzugriffe. Die Tageswerte stehen unter `shoppingroute.0.info.*Today`, die Gesamtübersicht unter `shoppingroute.0.info.traffic`. Die Werte sind Vorgangszähler und keine Messung des übertragenen Byte-Volumens.

## Geschlossenes Testerpaket

Für externe Betatester kann mit `npm run beta:package` ein separates Paket erzeugt werden. Das Entwicklungsprojekt selbst bleibt mit `private: true` gegen versehentliches Veröffentlichen geschützt; nur das erzeugte Tester-Tarball ist für eine bewusste Veröffentlichung mit dem npm `beta`-Tag freigegeben. Dieses enthält keine TypeScript-Quellen, keine Tests, keine GitHub-Workflow-Dateien und keine Source-Maps. Das zur Laufzeit benötigte JavaScript wird zusätzlich obfuskiert. Das private Entwicklungsrepository ist dafür nicht erforderlich.
