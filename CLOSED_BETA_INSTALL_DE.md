# ShoppingRoute – Installation einer geschlossenen Beta

## Voraussetzungen

- ioBroker mit aktuellem js-controller
- Node.js >= 22
- installierter und funktionierender Alexa2-Adapter
- mindestens eine Alexa-Einkaufsliste, normalerweise `SHOP`

## Sicherheit beim Erststart

1. Nach der Installation eine ShoppingRoute-Instanz anlegen.
2. **Dry-Run eingeschaltet lassen.**
3. Alexa2-Instanz und Listenname auswählen.
4. In der Alexa-App die betreffende Liste auf **„Älteste bis neueste“** stellen.
5. `shoppingroute.0.info.writeCapability` prüfen.
6. Falls der Wert `unknown` ist, mit mindestens einem aktiven Listeneintrag einmal `shoppingroute.0.control.compatibilityTest` auslösen.
7. Erst wenn `source-ok` oder `live-ok` gemeldet wird, Dry-Run für einen kleinen Test ausschalten.

ShoppingRoute legt keine Alexa-Listeneinträge an, löscht keine und hakt keine automatisch ab. Für die Sortierung werden nur die sichtbaren `value`-Texte vorhandener aktiver IDs verteilt.

## Installation des privaten Testerpakets

Das Testerpaket wird als `.tgz` persönlich bereitgestellt. Nach dem Kopieren auf den ioBroker-Server kann es entsprechend der ioBroker-Entwicklerdokumentation über npm installiert und anschließend in ioBroker hochgeladen werden:

```bash
cd /opt/iobroker
npm install /PFAD/ZU/iobroker.shoppingroute-0.2.0-beta.5.tgz
iobroker upload shoppingroute
```

Bei einer Erstinstallation anschließend eine Instanz anlegen, zum Beispiel über die Admin-Oberfläche oder:

```bash
iobroker add shoppingroute
```

Bei einem Update einer bestehenden Instanz bleibt deren Konfiguration erhalten. Danach die Instanz neu starten und die Diagnose kontrollieren.

## Feedback

Bitte bei Problemen mindestens mitsenden:
- `shoppingroute.0.info.compatibility`
- `shoppingroute.0.info.traffic`
- `shoppingroute.0.info.lastError`
- relevante Logzeilen
- kurze Beschreibung, welche Artikel hinzugefügt/abgehakt wurden und was erwartet wurde
