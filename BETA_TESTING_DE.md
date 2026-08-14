# Beta-Test ioBroker.shoppingroute 0.2.0-beta.12

> **Archivhinweis:** Dieses Dokument beschreibt die historische Testphase für `0.2.0-beta.12` und keine aktuelle Veröffentlichungsstufe des Adapters.

Diese öffentliche Beta soll auf unterschiedlichen ioBroker-/Alexa2-Systemen prüfen, ob Einlesen, Erkennung, Sortierplanung und Alexa-`value`-Updates zuverlässig funktionieren.

## Sicherheitsregeln

- **Dry-Run ist bei Neuinstallationen standardmäßig EIN.**
- Der Adapter beschreibt weder Alexa2-Itemstates noch `completed`; er verwendet die lokale Alexa2-Anmeldung für direkte Anfragen.
- Direkte Sortier-Schreibzugriffe werden blockiert, wenn die alexa-remote2-Sitzung nicht sicher initialisiert werden kann.
- Die Alexa-App muss für die betreffende Einkaufsliste auf **A–Z** gestellt sein.

## Empfohlener Testablauf

1. Adapter installieren und Instanz anlegen.
2. Alexa2-Instanz und Listenname prüfen.
3. Dry-Run eingeschaltet lassen.
4. Einige Testartikel über Alexa oder die Alexa-App hinzufügen.
5. `shoppingroute.0.info.lastPlan` kontrollieren.
6. `shoppingroute.0.info.compatibility` kontrollieren.
7. Optional `shoppingroute.0.control.compatibilityTest` einmal auf `true` setzen, um die direkte Verbindung nur lesend zu prüfen.
8. Erst wenn `info.writeCapability` `direct-ok` zeigt, Dry-Run für einen kleinen echten Sortiertest ausschalten.
9. Zunächst mit wenigen Einträgen testen und prüfen, ob Hinzufügen und normales Abhaken in der Alexa-App weiter funktionieren.

## Kompatibilitätstest

Der Kompatibilitätstest liest die konfigurierte Liste ausschließlich über die direkte Sitzung. Er legt keinen Eintrag an, löscht keinen, hakt keinen ab und benennt nichts um.

Mögliche Werte von `info.writeCapability`:

- `direct-ok` – die lokale Alexa2-Anmeldung konnte als direkte Sitzung initialisiert werden.
- `direct-unavailable` – die direkte Sitzung ist nicht verfügbar; echte Sortier-Schreibzugriffe bleiben blockiert.

## Feedback

Für einen Fehlerbericht bitte mindestens mitsenden:

- Inhalt von `shoppingroute.0.info.compatibility`
- Inhalt von `shoppingroute.0.info.lastError`
- Inhalt von `shoppingroute.0.info.lastPlan`, wenn die Reihenfolge falsch ist
- relevante ioBroker-Logzeilen
- welche Alexa2-Instanz und welche Einkaufsliste verwendet wird
- ob die Alexa-App auf **A–Z** steht
- kurze Beschreibung der erwarteten und tatsächlichen Reihenfolge

Tokens, Passwörter oder andere Zugangsdaten dürfen niemals in einem Fehlerbericht stehen.


## API-/Traffic-Diagnose

Während des Tests bitte auch `shoppingroute.0.info.traffic` beobachten. Entscheidend sind insbesondere `localChecks`, `sortRuns` und `alexaWrites`. Damit lässt sich beurteilen, wie viele lokale Prüfungen und tatsächliche Alexa-Schreibzugriffe ein typischer Haushalt verursacht. Die Zähler werden täglich zurückgesetzt.
