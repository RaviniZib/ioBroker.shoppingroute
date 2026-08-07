# Beta-Test ioBroker.shoppingroute 0.1.0-beta.2

Diese Beta ist für eine kleine geschlossene Testgruppe gedacht. Sie soll auf unterschiedlichen ioBroker-/Alexa2-Systemen prüfen, ob Einlesen, Erkennung, Sortierplanung und Alexa-`value`-Updates zuverlässig funktionieren.

## Sicherheitsregeln

- **Dry-Run ist bei Neuinstallationen standardmäßig EIN.**
- Der Adapter verwendet weiterhin niemals `#New`, `#delete` oder `completed`.
- Echte Sortier-Schreibzugriffe werden in der Beta zusätzlich blockiert, wenn die Alexa2/alexa-remote2-Schreibkompatibilität nicht sicher bestätigt werden konnte.
- Die Alexa-App muss für die betreffende Einkaufsliste auf **Älteste bis neueste** gestellt sein.

## Empfohlener Testablauf

1. Adapter installieren und Instanz anlegen.
2. Alexa2-Instanz und Listenname prüfen.
3. Dry-Run eingeschaltet lassen.
4. Einige Testartikel über Alexa oder die Alexa-App hinzufügen.
5. `shoppingroute.0.info.lastPlan` kontrollieren.
6. `shoppingroute.0.info.compatibility` kontrollieren.
7. Wenn `info.writeCapability` den Wert `unknown` hat, bei mindestens einem aktiven Listeneintrag `shoppingroute.0.control.compatibilityTest` einmal auf `true` setzen.
8. Erst wenn `info.writeCapability` `source-ok` oder `live-ok` zeigt, Dry-Run für einen kleinen echten Sortiertest ausschalten.
9. Zunächst mit wenigen Einträgen testen und prüfen, ob Hinzufügen und normales Abhaken in der Alexa-App weiter funktionieren.

## Kompatibilitätstest

Der Live-Test schreibt **denselben sichtbaren `value`-Text** eines vorhandenen aktiven Eintrags erneut. Er legt keinen Eintrag an, löscht keinen, hakt keinen ab und benennt sichtbar nichts um. Der Test wartet bis zu 10 Sekunden auf die Bestätigung von Alexa2.

Mögliche Werte von `info.writeCapability`:

- `source-ok` – die bekannte fehlerhafte `version`-Query wurde nicht gefunden und die korrigierte Schreibweise ist vorhanden; echte Sortier-Schreibzugriffe sind freigegeben.
- `live-ok` – der Live-Kompatibilitätstest wurde bestätigt; echte Sortier-Schreibzugriffe sind freigegeben.
- `known-bug` – die bekannte fehlerhafte `alexa-remote2`-Query wurde erkannt; echte Sortier-Schreibzugriffe sind blockiert.
- `live-failed` – der Live-Test wurde nicht bestätigt; echte Sortier-Schreibzugriffe sind blockiert.
- `unknown` – die installierte Implementierung konnte nicht eindeutig erkannt werden; echte Sortier-Schreibzugriffe bleiben blockiert, bis der Live-Test erfolgreich war.

## Feedback

Für einen Fehlerbericht bitte mindestens mitsenden:

- Inhalt von `shoppingroute.0.info.compatibility`
- Inhalt von `shoppingroute.0.info.lastError`
- Inhalt von `shoppingroute.0.info.lastPlan`, wenn die Reihenfolge falsch ist
- relevante ioBroker-Logzeilen
- welche Alexa2-Instanz und welche Einkaufsliste verwendet wird
- ob die Alexa-App auf **Älteste bis neueste** steht
- kurze Beschreibung der erwarteten und tatsächlichen Reihenfolge

Tokens, Passwörter oder andere Zugangsdaten dürfen niemals in einem Fehlerbericht stehen.
