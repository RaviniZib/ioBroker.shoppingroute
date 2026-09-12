# Planung für ShoppingRoute 0.4.0

Diese Datei sammelt verbindlich vorgesehene Änderungen für Version 0.4.0. Ein Eintrag gilt erst nach Implementierung, automatischen Tests und einem manuellen Test in der ioBroker-Admin-Oberfläche als erledigt.

## Offener Fehler: Mehrfachauswahl „Verfügbare Märkte“

**Status:** implementiert und auf der realen ioBroker-Instanz geprüft; Freigabe nach vollständiger CI
**Gemeldet:** 2026-09-12
**Betroffen:** Prüfliste; vorsorglich auch Artikelliste prüfen

### Fehlerbild

In der Prüfliste werden die verfügbaren Märkte als Mehrfachauswahl angezeigt. Zusätzlich ausgewählte Märkte werden jedoch nicht zuverlässig übernommen beziehungsweise gespeichert. Dadurch landet ein übernommener Artikel nicht mit allen ausgewählten Märkten im Artikelstamm.

### Bestätigte Ursache

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

## Offener Fehler: Übernommene Prüflistenzeile bleibt nach dem Speichern stehen

**Status:** implementiert und auf der realen ioBroker-Instanz geprüft; Freigabe nach vollständiger CI
**Gemeldet:** 2026-09-12
**Betroffen:** Prüfliste und Verarbeitung beim Adapterstart

### Bestätigtes Fehlerbild

Der neue Prüflisten-Editor übernimmt den Artikel sofort in den Artikelstamm und zeigt danach den Status „Übernommen“. Nach dem Speichern und Adapterneustart bleibt dieselbe Zeile jedoch weiterhin in der Prüfliste.

### Bestätigte Ursache

Der Admin-Editor setzt den Status auf `accepted`. Die Startverarbeitung entfernt diesen Eintrag intern bereits, meldet aber keinen neu übernommenen Artikel. Der Startcode setzt deshalb kein Änderungsflag und schreibt die bereinigte Prüfliste nicht in die Instanzkonfiguration zurück. Zusätzlich wurden ältere `availableMarkets`-Strings im Artikelstamm beim Start nicht als Arrays gespeichert.

### Ziel für 0.4.0

- Für den gesamten Ablauf gilt ein eindeutiges Statusmodell.
- `accept` löst die Übernahme aus.
- `accepted` darf höchstens ein kurzfristiger UI-Bestätigungsstatus sein und muss beim Speichern zuverlässig entfernt oder serverseitig als bereits übernommen bereinigt werden.
- Eine Zeile darf nach erfolgreicher Übernahme weder erneut verarbeitet noch nach einem Neustart wieder angezeigt werden.
- Der Artikel darf im Artikelstamm nur einmal vorhanden sein.

### Verbindliche Release-Sperre

Version 0.4.0 darf erst veröffentlicht werden, wenn der vollständige reale Ablauf nachweislich funktioniert:

1. Unbekannten Artikel in der Prüfliste bearbeiten.
2. Mehrere verfügbare Märkte auswählen.
3. „Übernehmen“ wählen.
4. Prüfen, dass der Artikel sofort korrekt im Artikelstamm erscheint.
5. Speichern.
6. Vollständigen Adapterneustart abwarten.
7. Admin-Seite neu laden.
8. Prüfen, dass die Zeile aus der Prüfliste verschwunden ist.
9. Prüfen, dass der Artikel exakt einmal und mit allen ausgewählten Märkten im Artikelstamm steht.
10. Adapterkonfiguration direkt kontrollieren: kein zurückgebliebener `accepted`-Eintrag in `reviewItems`.

### Automatische Regressionstests

- `accept` wird verarbeitet, in den Artikelstamm übernommen und aus der Prüfliste entfernt.
- Ein vom Editor erzeugtes `accepted` bleibt nach Speichern und Neustart nicht in der Prüfliste.
- Bereits übernommene Artikel werden nicht dupliziert.
- Der Test bildet den vollständigen Zyklus Editor → Speichern → Adapterstart → persistierte Konfiguration ab.
- Der Release-Prozess muss bei einem Fehlschlag dieses Zyklustests abbrechen.
