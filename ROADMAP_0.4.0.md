# Planung für ShoppingRoute 0.4.0

Diese Datei sammelt verbindlich vorgesehene Änderungen für Version 0.4.0. Ein Eintrag gilt erst nach Implementierung, automatischen Tests und einem manuellen Test in der ioBroker-Admin-Oberfläche als erledigt.

## Offener Fehler: Mehrfachauswahl „Verfügbare Märkte“

**Status:** offen  
**Gemeldet:** 2026-09-12  
**Betroffen:** Prüfliste; vorsorglich auch Artikelliste prüfen

### Fehlerbild

In der Prüfliste werden die verfügbaren Märkte als Mehrfachauswahl angezeigt. Zusätzlich ausgewählte Märkte werden jedoch nicht zuverlässig übernommen beziehungsweise gespeichert. Dadurch landet ein übernommener Artikel nicht mit allen ausgewählten Märkten im Artikelstamm.

### Vermutete Ursache

Die Admin-Konfiguration wandelt `availableMarkets` während einer Tabellenänderung von einem Array in einen kommagetrennten String um. Die Mehrfachauswahl arbeitet dagegen mit einem Array. Diese Typänderung während der Bedienung kann bereits gewählte Märkte verwerfen. Auch die Funktion „Alle übernehmen“ serialisiert Arrays derzeit zu Strings.

### Ziel für 0.4.0

- `availableMarkets` wird in Prüfliste, Artikelliste und Adapterkonfiguration durchgehend als `string[]` behandelt.
- Bereits vorhandene Komma- oder Semikolon-Strings bleiben lesbar und werden einmalig in Arrays normalisiert.
- Jede Auswahl und Abwahl bleibt sofort sichtbar.
- „Übernehmen“, „Alle übernehmen“, Speichern und Adapterneustart erhalten alle ausgewählten Märkte.
- Der Artikelstamm enthält anschließend exakt dieselben Märkte.
- Desktop- und Mobilansicht müssen ohne Sondertasten bedienbar sein.
- Standardmarkt und verfügbare Märkte dürfen sich nicht gegenseitig überschreiben.

### Verbindliche Prüfungen

1. In der Prüfliste mindestens drei Märkte auswählen.
2. Einen Markt wieder abwählen und erneut auswählen.
3. Status auf „Übernehmen“ setzen und speichern.
4. Adapterneustart abwarten.
5. Prüfen, dass der Eintrag aus der Prüfliste entfernt wurde.
6. Prüfen, dass der Artikel im Artikelstamm mit exakt allen gewählten Märkten vorhanden ist.
7. Konfiguration direkt kontrollieren: `availableMarkets` muss ein Array sein.
8. Den Ablauf mit „Alle übernehmen“ wiederholen.
9. Den Ablauf in der mobilen Admin-Ansicht wiederholen.
10. Regressionstest für ältere Werte wie `"ALDI,LIDL"` und `"ALDI; LIDL"`.

### Automatische Tests

- Mehrfachauswahl bleibt nach jeder einzelnen Änderung ein Array.
- Speichern und erneutes Laden erhalten mehrere Märkte.
- `markAllReviewItemsAccept` erhält Arrays und normalisiert Legacy-Strings zu Arrays.
- `applyReviewActions` übernimmt alle Märkte ohne Typwechsel.
- Artikelliste und Prüfliste verwenden denselben Normalisierungspfad.
