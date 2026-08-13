# ShoppingRoute – Installation der öffentlichen Beta

## Voraussetzungen

- ioBroker mit aktuellem js-controller
- Node.js >= 22
- installierter und funktionierender Alexa2-Adapter
- mindestens eine Alexa-Einkaufsliste, normalerweise `SHOP`

## Sicherheit beim Erststart

1. Nach der Installation eine ShoppingRoute-Instanz anlegen.
2. **Dry-Run eingeschaltet lassen.**
3. Alexa2-Instanz und Listenname auswählen.
4. In der Alexa-App die betreffende Liste auf **A–Z** stellen.
5. `shoppingroute.0.info.writeCapability` prüfen.
6. Optional `shoppingroute.0.control.compatibilityTest` auslösen; die nur lesende Direktprüfung soll `direct-ok` melden.
7. Erst wenn `source-ok` oder `live-ok` gemeldet wird, Dry-Run für einen kleinen Test ausschalten.

ShoppingRoute legt keine Alexa-Listeneinträge an, löscht keine und hakt keine automatisch ab. Für die Sortierung werden nur die sichtbaren `value`-Texte vorhandener aktiver IDs verteilt.

## Installation der öffentlichen Beta

Die aktuelle öffentliche Beta wird über npm unter dem Tag `beta` bereitgestellt.

```bash
cd /opt/iobroker
npm install iobroker.shoppingroute@beta
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
