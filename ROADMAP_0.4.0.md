# Fehlerliste und Abnahme: ShoppingRoute 0.4.0

## Aktueller Stand: Übernahme in 0.4.1

Alle gemeldeten Punkte F01–F10 sind im abgenommenen Stand aus PR #40 enthalten. Die vollständige Zuordnung und der E-Mail-/Issue-Abgleich stehen in [RELEASE_0.4.1.md](RELEASE_0.4.1.md). Die folgenden Abschnitte dokumentieren den historischen Verlauf einschließlich damaliger offener Prüfungen.

Diese Datei sammelt verbindlich vorgesehene Änderungen für Version 0.4.0. Ein Eintrag gilt erst nach Implementierung, automatischen Tests und einem manuellen Test in der ioBroker-Admin-Oberfläche als erledigt.


## Korrigierter Prüfstand nach Rückmeldung vom 12.09.2026

Die Freigabe von 0.4.0 war unvollständig: Die Speicherung wurde geprüft, die geforderte Mehrfachauswahl ohne Sondertasten jedoch nicht. Der vorherige pauschale Status „auf der realen Instanz geprüft“ war für diesen Bedienablauf nicht belegt.

| ID | Gemeldeter Fehler / Anforderung | Beleg / Stand | Noch erforderlich |
| --- | --- | --- | --- |
| F01 | Übernommene Artikel bleiben sichtbar in der Prüfliste | Erneut gemeldet: „Schluck die Wurst“. Serverliste leer, Admin zeigt weiter `accepted`. Lokale Korrektur entfernt die Zeile zusammen mit der Artikelübernahme im selben Entwurf | Reale UI-Abnahme von Einzel-/Sammelübernahme, Speichern und Neuladen offen |
| F02 | Zusätzliche Märkte lassen sich nicht einfach gemeinsam auswählen | 0.4.0 enthielt weiterhin `select multiple`; lokale Korrektur mit einzelnen Checkboxen und sichtbarer Auswahl | Desktop- und Handy-Bedienung auf der echten Admin-Seite bestätigen |
| F03 | Komma-/Semikolon-Strings und Arrays im Artikelstamm | 0.4.0: vorhandener String wurde beim realen Neustart Array; danach 0 Nicht-Array-Felder | Marktfilter mit mehreren Märkten erneut über die Oberfläche prüfen |
| F04 | Marktüberschriften erscheinen als Artikel / Filter `====MARKT====` | Vorherige Korrektur und Regressionstests für alte/unbekannte/vertippte Überschriften vorhanden | Als bestehende Korrektur erhalten; aktueller Screenshot meldet F02 |
| F05 | Unbrauchbare Darstellung der aktuellen Einkaufsliste | Einspaltige Marktabschnitte in 0.3.9; Nutzer hatte die Handyansicht bestätigt | Kein neuer Fehlerbericht hierzu |
| F06 | Leere Märkte bleiben in Alexa am Handy | Entfernung verwaister Überschriften in 0.3.9; vorherige Handy-Prüfung bestätigt | Bestehende Regressionstests erhalten |
| F07 | History, Bugfix-Bericht und Bedienungsanleitung müssen mitgeführt werden | Änderungen und verbleibende Prüflücken werden in diesen Dateien dokumentiert | Nur belegte Ergebnisse als bestanden markieren |

### Abnahme der Checkbox- und Entwurfskorrektur (noch unveröffentlicht)

- [x] Isolierte ioBroker-Integration: Editor-Entwurf in die echte Objektdatenbank speichern, tatsächlichen Adapter starten und Konfiguration erneut lesen; Einzel-/Sammelübernahme sowie alte `accepted`-Einträge geprüft (4 Tests inklusive Starttest bestanden). Kein Browser-Test.
- [x] Artikelübernahme und Zeilenentfernung in einem einzigen Admin-`onChange`; Handler-Tests prüfen auch die neu gerenderte Liste und das unveränderte Original zum Verwerfen.
- [x] Einzelne Checkboxen statt nativem Mehrfach-Select implementiert.
- [x] Handler-Tests: drei Märkte wählen, einen abwählen/wieder wählen; Einzelübernahme und Sammelübernahme erhalten die Auswahl.
- [x] Bestehende Auswahl außerhalb der aktiven Marktliste bleibt sichtbar und abwählbar.
- [ ] Desktop: normaler Klick auf drei Märkte, Abwahl und Wiederwahl; kein Strg/Cmd.
- [ ] Handy: derselbe Ablauf per Antippen; Beschriftung und Auswahl vollständig sichtbar.
- [ ] Einzelübernahme → normales Speichern → Neustart → Neuladen: Zeile weg, Artikel einmal, alle gewählten Märkte vorhanden.
- [ ] „Alle übernehmen“: denselben vollständigen Ablauf wiederholen.
- [ ] Artikelliste: dieselben Märkte sichtbar, Filter passt.

Die Browser-Abnahme konnte in dieser Sitzung wegen der Zugriffssperre des Cloud-Browsers für lokale Testseiten nicht ausgeführt werden. Komponenten-/Handler-Tests ersetzen diese Abnahme nicht. Keine neue Release-Freigabe aus diesen Tests ableiten.

## Offener Fehler: Mehrfachauswahl „Verfügbare Märkte“

**Status:** Speicherung teilweise belegt; Checkbox-Korrektur lokal implementiert, UI-Abnahme offen
**Gemeldet:** 2026-09-12
**Betroffen:** Prüfliste; vorsorglich auch Artikelliste prüfen

### Fehlerbild

In der Prüfliste werden die verfügbaren Märkte als Mehrfachauswahl angezeigt. Zusätzlich ausgewählte Märkte werden jedoch nicht zuverlässig übernommen beziehungsweise gespeichert. Dadurch landet ein übernommener Artikel nicht mit allen ausgewählten Märkten im Artikelstamm.

### Frühere Ursache und verbliebener UI-Fehler

In früheren Fassungen wandelte die Admin-Konfiguration `availableMarkets` während einer Tabellenänderung von einem Array in einen kommagetrennten String um. Auch die Sammelübernahme serialisierte Arrays zu Strings. Diese Datenpfade wurden korrigiert; 0.4.0 verwendete aber weiterhin `select multiple` und erfüllte damit die Bedienanforderung ohne Sondertasten nicht. Die jetzige lokale Änderung verwendet einzelne Checkboxen.

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

**Status:** Bereinigung eines vorhandenen Eintrags beim realen Neustart belegt; vollständige UI-Abnahme mit mehreren Märkten offen
**Gemeldet:** 2026-09-12
**Betroffen:** Prüfliste und Verarbeitung beim Adapterstart

### Bestätigtes Fehlerbild

Der neue Prüflisten-Editor übernimmt den Artikel sofort in den Artikelstamm und zeigt danach den Status „Übernommen“. Nach dem Speichern und Adapterneustart bleibt dieselbe Zeile jedoch weiterhin in der Prüfliste.

### Frühere Ursache und verbliebener UI-Fehler

Der frühere Admin-Editor setzte den Status auf `accepted`. Die Startverarbeitung entfernte diesen Eintrag intern, schrieb die Änderung jedoch ohne neu übernommenen Artikel nicht zurück. 0.4.0 korrigierte diese Persistenz und die Normalisierung älterer Markt-Strings. Der Admin-Entwurf behielt die übernommene Zeile trotzdem bei. Die lokale Korrektur entfernt sie deshalb im selben Entwurfsupdate wie die Artikelübernahme.

### Ziel für 0.4.0

- Für den gesamten Ablauf gilt ein eindeutiges Statusmodell.
- `accept` löst die Übernahme aus.
- `accepted` darf höchstens ein kurzfristiger UI-Bestätigungsstatus sein und muss beim Speichern zuverlässig entfernt oder serverseitig als bereits übernommen bereinigt werden.
- Eine Zeile darf nach erfolgreicher Übernahme weder erneut verarbeitet noch nach einem Neustart wieder angezeigt werden.
- Der Artikel darf im Artikelstamm nur einmal vorhanden sein.

### Ursprüngliche Release-Sperre – bei 0.4.0 nicht eingehalten

Die folgende Abnahme war vor 0.4.0 gefordert und wurde nicht vollständig durchgeführt. Sie bleibt für eine neue Freigabe verbindlich:

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


### Ergebnis der lokalen Prüfung dieser Korrektur

- `npm test`: 130 bestanden, 0 fehlgeschlagen.
- `npm run lint`: bestanden, einschließlich TypeScript.
- Der neue Test ruft die vom Editor gerenderten Checkbox-/Übernahme-Handler auf und prüft die danach gerenderte Liste. Er ist kein vollständiger Browser-/Admin-Integrationstest.
- Version bleibt 0.4.0; Änderungen sind eine unveröffentlichte lokale Korrektur. Die öffentliche 0.4.0 wird nicht als nachträglich korrigiert ausgegeben.

### Lokale Installation auf dem Server

Die unveröffentlichte Korrektur wurde am 12.09.2026 in die installierten Admin-Dateien kopiert und mit `iobroker upload shoppingroute` in den ioBroker-Dateispeicher übertragen. Einstieg und Komponenten-Bundle wurden daraus zurückgelesen und ihre SHA-256-Prüfsummen mit dem lokalen Build verglichen: identisch. Version bleibt 0.4.0; kein neues GitHub-/npm-Release.

Sicherung der vorherigen Oberfläche: `/home/pi/shoppingroute-review-fix.289xqv/installed-ui-before.tar.gz`. Nach der Installation: persistierte Prüfliste leer, „Schluck die Wurst“ einmal im Artikelstamm. Das ist eine Zustandsprüfung, keine erfolgreiche Benutzerabnahme. Die offenen Desktop-/Handy-Prüfpunkte bleiben offen.

## Issue #16: Repository-Checker, Rückmeldung vom 12.09.2026

Quelle: https://github.com/RaviniZib/ioBroker.shoppingroute/issues/16#issuecomment-5645003007

| Kennung | Befund | Lokale Korrektur / Ergebnis |
| --- | --- | --- |
| E2004 | 0.3.8 in `common.news`, aber nie auf npm veröffentlicht | Aus `common.news` entfernt; historische README-Einträge bleiben nachvollziehbar |
| E4048 | Autor/Maintainer ohne E-Mail | `RaviniZib <zib@ravini.org>` in package.json und io-package.json; Adresse aus dem bereits öffentlichen npm-Maintainerkonto |
| E4050 | Copyright in README ohne E-Mail | Bestehenden Copyright-Inhaber um dieselbe Adresse ergänzt |
| E4051 | Copyright in LICENSE ohne E-Mail | Dieselbe Ergänzung; Lizenztext bleibt MIT |
| E6034 | Fehlender anklickbarer Lizenzverweis | `[LICENSE](LICENSE)` in README; deutsche Anleitung ebenfalls verlinkt |
| S0064 | Deklarierte Testpaket-Version veraltet | Mindestversion `@iobroker/testing` auf `^6.2.1`; Lockdatei angepasst, zuvor bereits aufgelöste Version 6.2.1 unverändert |
| W4001 | Aufnahme in ioBroker latest fehlt | Weiter offen: bestehender PR https://github.com/ioBroker/ioBroker.repositories/pull/6434 wartet auf Merge; laut Checker ist dieser Hinweis bei bestehendem PR zulässig |
| W6028 | Neue Überschrift „Unreleased“ nicht erkannt | Auf die vom Releasewerkzeug unterstützte Markierung `WORK IN PROGRESS` umgestellt |

**Lokaler Prüflauf mit repochecker 5.22.2:** 0 Fehler, 1 Warnung (W4001), 0 Vorschläge. Prüfung im lokalen Modus, mit authentifiziertem Lesezugriff auf GitHub-Protokolle. Der erste unauthentifizierte Lauf konnte CI-Protokolle nicht abrufen; diese Warnungen sind im authentifizierten Lauf entfallen. Der Checker bezeichnet seinen lokalen Modus selbst als experimentell.

GitHub-Issue #16 bleibt offen und unverändert. Es wurden weder ein Recheck-Kommentar noch ein Commit-Push, Merge oder Release ausgeführt. Die Korrekturen liegen lokal im Repository auf dem Server.

### Abschluss des lokalen Quellstands

Vollständiges Server-Repository: `/home/pi/shoppingroute-review-fix.289xqv/repository`, lokaler Branch `fix/local-review-completion`. Die Arbeitskopie basiert auf dem veröffentlichten main-Stand; alle aktuellen Korrekturen sind dort enthalten. Build, 130 Unit-/Komponententests, 70 Pakettests, Lint/TypeScript und 4 isolierte ioBroker-Integrationstests sind bestanden.

Die Integration läuft in einem getrennten Testcontainer mit Node 24.21.0 und Controller 7.2.2. Sie speichert den vom echten Editor erzeugten Entwurf direkt in die Test-Objektdatenbank und startet den tatsächlichen Adapterprozess. Sie ersetzt keinen Browser-Test des Admin-Speicherbuttons. Die Desktop-/Handy-Abnahme bleibt deshalb offen. Der Test enthält keine echte Alexa-Liste; entsprechende Warnungen sind im Testprotokoll sichtbar.

## F08 – Doppelter Artikel nach Drag & Drop (12.09.2026, 12:19 Uhr)

**Befund:** Nach einer Verschiebung erschien derselbe Artikel zweimal; Schlussprüfung „Expected 6 active items, found 7“, danach Schreibstopp. Direkte Amazon-Lesung bestätigt zwei neue IDs für denselben Zieltext im Abstand von 89 ms. Die alte ID war entfernt. Diagnose-Schnappschüsse liegen lokal unter `drag-drop-incident` neben dem Server-Repository.

**Reproduzierte Ursachen:** Drop-Ereignisse wurden von der Artikelzeile zum Marktabschnitt weitergereicht und zweimal verarbeitet. Reacts asynchrones `setState` sperrte den zweiten Aufruf nicht sofort. Im Adapter wurde die globale Apply-Sperre erst nach `await isEnabled()` gesetzt; manuelle Befehle hatten während Lesen/Speichern noch keine Reservierung.

**Lokale Korrektur:** `stopPropagation` am Drop; synchrone Befehlsreservierung im Editor; exklusive manuelle Bearbeitung vor der ersten asynchronen Operation; globale Apply-Sperre vor dem ersten `await`. Automatische Läufe warten während manueller Vorbereitung und werden danach wieder eingeplant. Fehler bleiben nach dem Nachladen sichtbar; Meldungen enthalten den Listennamen nur einmal. Der Sicherheitsstopp wird nicht gelockert.

**Nachweis:** Vier gezielte Regressionsfälle scheiterten vor der Änderung und bestehen danach. Insgesamt sieben neue Tests prüfen Ereignisweitergabe, schnelle doppelte Bedienung, parallele Backend-Aufrufe, manuell/automatisch konkurrierende Läufe, erneute Nutzung der Sperren, Fehlerpfad und sichtbare Fehlermeldung. Gesamt: 137 Tests bestanden; Lint/TypeScript bestanden. Browser-Abnahme eines echten Drag & Drop bleibt separat offen.

### F08 – Bereinigung und leerer Markt auf dem Handy

Nach dem Schreibstopp löschte der Benutzer den letzten LIDL-Artikel am Handy. Admin blendete LIDL aus, während dessen Amazon-Überschrift wegen des Schreibstopps bestehen blieb. Während der Adapter gestoppt war, wurden ausschließlich die nachgewiesene zusätzliche Weckgummis-ID und die nun leere LIDL-Überschrift entfernt. Vor jedem DELETE wurden alle aktiven IDs, Werte und Versionen mit dem gesicherten Stand verglichen; danach wurde genau die erwartete Restliste bestätigt. Der vom Benutzer gelöschte Artikel wurde nicht wiederhergestellt.

Das ursprüngliche Fehlerjournal ist gesichert; seine manuelle Auflösung berücksichtigt die spätere Benutzerlöschung ausdrücklich. Danach wurde der Adapter gestartet und wieder aktiviert. Direkte Prüfung: vier aktive Einträge (REWE-Überschrift und drei Artikel), Weckgummis einmal, LIDL entfernt, `info.lastError` leer. Die Reparaturbelege liegen unter `drag-drop-incident` neben dem Server-Repository. Das ist keine Sichtprüfung auf dem Handy.

## F09 – Fehlende Löschtaste in der Einkaufsliste

**Lokal umgesetzt, gebaut, geprüft und auf dem Server installiert:** Eine Löschtaste pro Artikel übermittelt die konkrete Amazon-ID. Der vorhandene Sortierplan entfernt diese ID und gegebenenfalls leere Marktüberschriften in einer gemeinsamen, persistent protokollierten Verarbeitung mit direkter Schlussprüfung. Artikelstamm und gleichnamige andere IDs bleiben erhalten. Gleichzeitiges Löschen/Verschieben wird vor dem ersten asynchronen Aufruf abgewehrt. Dry Run, Schreibstopp, unbekannte Listen und veraltete IDs erlauben keine Löschung. Keine automatische Wiederholung. Desktop-/Handy-Abnahme bleibt offen.

### Abschließender lokaler Nachweis für F08/F09

- Build und Tests in beiden Arbeitskopien: **144 bestanden, 0 fehlgeschlagen**; Lint/TypeScript bestanden.
- Paketprüfung auf dem Server: **70 bestanden, 0 fehlgeschlagen**.
- Installiertes Backend und aus dem ioBroker-Dateispeicher zurückgelesene Admin-Einstiegs-/Komponentendateien stimmen per SHA-256 mit dem geprüften Build überein.
- Adapter läuft, `control.enabled=true`, `info.lastError` leer, `info.sortTransaction={}`. Der automatische Lauf nach Neustart bestätigt vier aktive Einträge.
- History und beide Anleitungen ergänzt. Version unverändert 0.4.0; kein GitHub-/npm-Release. Tatsächliche Bedienung im Desktop-/Handy-Browser bleibt als Abnahme offen.

## F10 – Einkaufsliste stürzt beim Rendern ab (12.09.2026, 13:15 Uhr)

**Benutzerbefund:** Die benutzerdefinierte Einkaufsliste kann nicht angezeigt werden; `Cannot read properties of undefined (reading 'map')`. Die vorige Installation ist damit ausdrücklich nicht als erfolgreiche UI-Abnahme zu werten.

**Reproduktion:** Eine unvollständige Antwort ohne `lists` wurde ungeprüft als Ansicht gespeichert. `render()` rief darauf `view.lists.map()` auf und erzeugte exakt die gemeldete Ausnahme. Auch Antworten auf Verschieben, Löschen und Zurücksetzen wurden ungeprüft übernommen. Ohne gültige Ansicht fehlte zudem ein Weg zum erneuten Laden.

**Abgrenzung:** Eine direkte Anfrage über den tatsächlich installierten Admin-WebSocket-Client lieferte bei der Diagnose eine vollständige Ansicht mit drei Artikeln. Die konkrete Antwort bzw. Aufrufstelle des ursprünglichen Browserfehlers ist nicht aufgezeichnet; die Reproduktion belegt den fehlenden Schutz, aber nicht den ursprünglichen Auslöser.

**Lokale Korrektur:** Gemeinsame Strukturprüfung vor Übernahme jeder Ansicht; zusätzlicher Schutz beim Rendern; verständlicher Fehler und „Erneut laden“ statt Komponentenabsturz. Eine bereits geladene gültige Ansicht bleibt bei fehlerhafter Aktualisierung erhalten. Keine Ersatzdaten, die eine fehlgeschlagene Abfrage als leere Liste ausgeben. Fünf Regressionsfälle hinzugefügt; vier scheiterten vor der Änderung. Browser-Abnahme bleibt offen.

### F10 – Prüfergebnis und Installation

149 Tests bestanden, 0 fehlgeschlagen; Lint/TypeScript bestanden, jeweils lokal und auf dem Server. Ein zusätzlicher Lesetest verbindet den echten installierten Admin-WebSocket-Client mit dem Editor: vollständige Antwort mit drei Artikeln, drei gerenderte Artikelzeilen und drei Löschtasten. Das prüft den Komponentenbaum, nicht den Browser-DOM.

Die korrigierten Admin-Dateien sind einzeln in den ioBroker-Dateispeicher geschrieben und zurückgelesen worden; SHA-256 stimmt mit dem Build überein. Adapter läuft, aktuelles Fehlerfeld leer. Kein Backend-Neustart und keine Änderung an Einkaufsdaten. History und Anleitungen ergänzt. Tatsächlicher Auslöser der historischen Antwort und Browser-Abnahme weiterhin offen.

## Benutzerabnahme und Status von Issue #16 – 12.09.2026

Frank bestätigt nach der letzten lokalen Installation: „bisher keine weiteren fehler. alte fehler alle behoben.“ Damit sind die bislang gemeldeten Bedienungsfehler durch seine Rückmeldung als behoben abgenommen. Frühere Hinweise auf ausstehende Benutzerabnahme beschreiben den damaligen Prüfstand. Die unbekannte ursprüngliche Antwort bei F10 bleibt historisch unaufgeklärt; daraus folgt keine offene Reproduktion im aktuell abgenommenen Stand.

Issue #16 wurde erneut lesend geprüft: weiterhin offen, letzte Bot-Rückmeldung vom 12.09.2026, 09:25:55 UTC, unveränderte Beanstandungen E2004, E4048, E4050, E4051, E6034 und Vorschlag S0064. Alle sind im lokalen Quellstand korrigiert. Letzter lokaler Repository-Check: 0 Fehler, 1 Warnung W4001, 0 Vorschläge. Aufnahme-PR #6434 ist weiterhin offen. Die lokalen Korrekturen wurden noch nicht auf GitHub übertragen; daher kann der öffentliche Bot sie noch nicht bestätigen.
