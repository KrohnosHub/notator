# Notator – Stand Build 441 (25.11.2026)

Live: https://krohnoshub.github.io/notator/ (GitHub Pages, Repo KrohnosHub/notator). Arbeitsweise: `CLAUDE.md`;
Lehren, Entscheidungen von Matthias und exsurge-Eigenheiten: `docs/WISSEN.md`; Orgel-Begleitsatz: `docs/begleitsatz-regelwerk.md`.
Diese Datei gibt nur den Überblick; Einzelheiten stehen im Git-Log (`Build NNN: …`).

## Aufbau

- Code in `src/` (CSS, `body.html`, JS in `1-start/`, `2-choral/`, `3-orgel-und-mehr/`, `vendor/exsurge.js`); `python3 build.py` erzeugt `index.html`.
- Tests: `tests/gd-core.test.js`, `tests/silbentrennung.test.js`, `tests/pdf-geometrie.test.js`, `tests/begleitsatz.test.js`, `tests/visual/run.js` (Bildvergleich); GitHub Action «Tests» bei jedem Push.
- Content-Security-Policy mit Skript-Hashes (setzt `build.py`), keine Inline-Handler (`tools/handlers.py`).
- Google-Drive-Kern `shared/gd-core.js`, gemeinsam mit dem Schola-Planer.
- GregoBase über eigenen Proxy (Cloudflare Worker).

## Neu in Build 298–441 (Auszug)

- **PDF lesen (441):** zerfallene Notenköpfe auch ohne Notenlinie dazwischen (gesprenkelter Druck), wenn fast quadratisch und im System (Salve mater «pe»).
- **PDF lesen (440):** «⚠ prüfen» auch, wenn eine Strophenzeile nicht auf die Noten ihres Systems passt (Silbenzahl ≠ Notenplätze).
- **PDF lesen (439):** Titel = Textanfang, wenn kein passender Titel gedruckt ist (Proprien: «Introitus», Anlass → Untertitel); «⚠ prüfen» direkt über dem eigenen System statt im Text des vorigen Systems (bei Strophen mitten in deren Zeilen).
- **PDF lesen (438, Meldung Matthias):** Notenköpfe auf einer Notenlinie, die beim Entfernen der Linie in Stücke zerfallen, werden wieder als Note erkannt (Salve mater «trans», «ter»); Doppelstrich zwischen Kehrvers und Strophenbeginn, damit der Strophen-Assistent die Vorlage ab «1.» erkennt.
- **PDF lesen (437, Meldung Matthias zu Salve mater):** Titel und Untertitel über dem ersten System werden gelesen; Strophennummern («1.», «2.» …) werden gesetzt; liest die KI Strophenzeilen als Hauptzeilen, wird einmal neu gelesen; ein System, dessen linker Teil blass ist, wird nach links ergänzt (Salve mater «O Ma-rí-a», Pueri «portantes» +33 % Notenzahl).
- **PDF lesen (436):** Mehrere Strophen untereinander unter demselben System werden gelesen und als weitere Strophen übernommen (Tota pulchra 5, Attende 4, Salve mater 5).
- **PDF lesen (435):** «⚠ prüfen» rot und fett über dem System statt blassbraun auf der Textzeile (auf dem Handy übersehen, Meldung Matthias). Runde 17: Te Deum blind 91 % Notenzahl, 100 % Silben.
- **PDF lesen (434, Runde 16):** Modus auch links neben dem ersten System ohne Initiale (Ubi caritas «VI»); Teile eines ♭ gelten nicht mehr als Mora-Punkt; zweiter KI-Aufruf auch bei deutlich zu kurzer Zeile. Drei weitere Orgelsätze (Jesu dulcis, Kyrie XII, Victimae paschali) werden richtig abgewiesen (9 Gegenproben). Runde 16 (Stabat Mater, Venite ad me, Pueri «portantes»): Notenzahl 63 %, Tonhöhen 93 %, Silben 90 %.
- **PDF lesen (433, Runde 15):** erste Note direkt hinter dem Schlüssel wird in schmalem Satz nicht mehr verworfen (Inviolata: 5 Systeme richtig); ein ♭ dort wird nicht zur Note; doppelt geschriebene Initiale («OOmnes») bereinigt. Runde 15 blind → nachher: Notenzahl 60 → 67 %, Gruppierung exakt 40 → 60 %. Offen: hohle Notenköpfe (wahlweise Noten, Pueri Hebraeorum), senkrechte Abschlussstriche am Systemende (Inviolata).
- **PDF lesen (432, Runde 14):** Schatten vom Buchrücken gilt nicht mehr als Initiale (falsche Stückgrenze bei Tota pulchra); der Hals der ♭-Vorzeichnung direkt nach dem Schlüssel ist kein Trennstrich; Divisio-minima-Grenze für unscharfe Kopien nachjustiert (seit Build 430 bei den Trennstrichen nur Verbesserungen). Orgelsatz «Regina caeli» (moderne Noten) richtig abgewiesen. Runde 14 blind → nachher: Notenzahl 85 → 100 %, Silben 81 → 96 %, Stückgrenzen 50 → 100 %.
- **PDF lesen (431, Runde 13):** Linienlücke in der Seitenmitte gilt nicht mehr als Doppelseite (Ave maris stella); blasse Systeme werden mit hellerer Schwelle nachgesucht und mit beiden Schwellen vermessen; kleine Initialen (Asperges «A», Tu es Petrus «T»); ein Strich im Linienabstand neben dem System wird nicht mehr als Notenlinie genommen (Asperges: Tonhöhen in System 4 waren 2–3 Stufen zu tief); Unterlängen der Textzeile über dem System sind keine Divisio minima. Runde 13 blind → nachher: Notenzahl 43 → 70 %, Silben 64 → 82 %.
- **PDF lesen (430, Meldungen Matthias + Runden 11/12):** «Ps.», «Vs.»/℣ und ℟ erscheinen im Ergebnis (kursiv bzw. V/., R/.), «Ps.» hinter dem Doppelstrich; beim Laden «als ein Stück» kein zweiter Schlüssel vor dem Gloria, wenn er gleich ist; über das Systemende getrennte Wörter bleiben ein Wort. «⚠ prüfen» zusätzlich bei Silben ohne Noten (erfasst jetzt 45 % der fehlerhaften Systeme). Kurze Systeme mitten in der Zeile, bis 8 Silben je Textgruppe, zerfallene Trennstriche in blassen Kopien, Custos ≠ Mora, gedrehter Randtext, falsch verteilte KI-Zeilen («N+»), Ersatzweg für blasse/gestrichelte/schräge Linien (Conditor alme: 0 → 6 von 8 Systemen). Runde 11 blind → nachher: Notenzahl 79 → 95 %, Silben 80 → 97 %; Runde 12: 52 → 64 %, Silben 65 → 78 %.
- **PDF lesen (429):** zweiter Durchgang: jede Seite wird mit drei Helligkeitsschwellen gelesen, je Note entscheidet die Mehrheit; graue (gerasterte) Notenköpfe werden ergänzt. Wo die Durchgänge abweichen, setzt Notator eine Notiz «⚠ prüfen» (nicht im PDF). Modus: die KI liefert die Angabe über der Initiale wörtlich («2.», «HYMN I.», «Intr. 2.»), Notator rechnet um. Lässt die KI eine Textzeile aus, wird die Seite einmal nachgelesen. Silben ohne Vokal («Ma-tré-m-que») werden zusammengefügt; ♭ nach dem Schlüssel des ganzen Stücks; Virga abgeschaltet (mehr falsche als richtige). Über 30 Fälle: Notenzahl 71 → 74 %, Gruppierung exakt 55 → 61 %, Silben 88 → 91 %, Modus 69 → 81–84 %.
- **PDF lesen (428):** Bei moderner Notation erschien statt der Meldung «Fehler: Cannot read properties of undefined» – der Dialog wurde ohne Knöpfe aufgerufen. Behoben (Dialoge ohne Knopfangabe bekommen «OK»); Meldungen einfacher formuliert.
- **PDF lesen (427):** Fotokopien moderner Noten (Benedictus, Christus vincit – Meldung Matthias) werden jetzt erkannt: die fünfte Linie wird direkt im Bild gesucht (relativ zur Deutlichkeit der eigenen Linien) und mit Mehrheit der Systeme entschieden; Meldung zusätzlich als Dialog, kein KI-Aufruf. «PDF lesen» öffnet nur noch die Zeile mit dem API-Feld; die Dateiauswahl startet erst mit «PDF wählen».
- **PDF lesen, Runde 10 (426):** Bei PDFs mit moderner Notation (Fünfliniensysteme) erklärt die Statuszeile jetzt, dass nur Quadratnotation gelesen wird (geprüft mit drei Blättern aus dem Drive, kein KI-Aufruf). Runde 10 blind: Neumentyp 94 %, Silben 95 %.
- **PDF lesen, Runde 9 (425):** Fehlende Silbentrennungen der KI («cre-ásti», «VExíl») werden mit der Notator-Silbentrennung ergänzt; hat die KI zwei Zeilen in eine geschrieben (Zierinitiale über zwei Systeme), wird der Text aufgeteilt; Seiten mit Fünfliniensystemen (moderne Noten) liefern «Keine Notensysteme» statt Unsinn. Über alle 31 Fälle: Gruppierung exakt 51 → 57 %, Silben 87 → 89 %.
- **PDF lesen, Runde 8 (424):** Noten auf Hilfslinien über dem System werden gelesen (eine lange Hilfslinie galt als Textzeile); Noten ab «l» zählen nur mit Hilfslinie (Handschrift über dem System). Runde 8 blind: Notenzahl 92 %, Tonhöhen 99 %, Neumentyp 95 %.
- **PDF lesen, Runde 7 (423):** Systeme bis 2.2-mal grösser als der typische Linienabstand werden gefunden (Campion druckt Antiphonen fast doppelt so gross wie Psalmvers und Gloria; bei Salve sancta Parens fehlte der ganze Introitus). Runde 7: Notenzahl 52 → 78 %, Tonhöhen/Stück 87 → 99 %.
- **PDF lesen, Runde 6 (422):** Auswertung misst jetzt den Neumentyp je Silbe (Torculus/Porrectus …). Silben ohne Noten werden bei der Zuordnung stärker bestraft – verrutschte Zuordnungen erzeugten falsche Neumentypen (Neumentyp 91 → 93 %, Gruppierung exakt 43 → 50 %). F-Schlüssel ab 1.5 statt 1.9 Notenkopfbreiten (Liber-Hymnen). KI trennt das erste Wort nach der Initiale («SE-dé-bit»).
- **API-Key merken (421):** Neben dem API-Feld von «PDF lesen» ein Häkchen «merken»: Der Key bleibt im Browser gespeichert (pro Gerät einmal eingeben); mit gespeichertem Key öffnet «PDF lesen» direkt die Dateiauswahl. Häkchen weg = Key gelöscht.
- **PDF lesen, Gegenprobe 5 (420):** blind mit Build 419 (Mittit ad Virginem, Graduale Viderunt, Verbum caro): Notenzahl 80 %, Tonhöhen 98 %, Gruppierung 95 %. Daraus: ♭ direkt nach dem Schlüssel wird erkannt (über alle 22 Fälle ♭ gefunden 74 → 88 %, 96 % richtig).
- **PDF lesen, Gegenprobe 4 (418/419):** ♭ nur noch auf der b-Stufe des Schlüssels (handschriftliche «B»/«Es» waren falsche ♭; Treffsicherheit 62–80 → 97–100 %). Strophennummern, ℣ und «Ps.» liefert die KI jetzt mit; sie belegen ihre Textgruppe und werden danach entfernt (vorher verschob sich die Silbenzuordnung). Text hinter dem letzten Doppelstrich (rote Hinweise) trägt keine Silbe; dünne Handschrift-Striche gelten nicht als Divisio minima. Erster Fall mit F-Schlüssel (Dominus dixit) richtig. Build 418 wurde nur lokal gemessen und ist in 419 enthalten.
- **PDF lesen, Gegenprobe 3 (417):** Rorate caeli, Adorate Deum, Ad te levavi. Feiner Druck: Schlüssel etwas hinter dem Linienanfang wird gefunden; senkrechte Scannerstreifen gelten nicht mehr als Initiale; kleinere Gloria-Systeme (69 %) zählen, wenn ein Schlüssel erkannt wird. Gegenprobe 3: Notenzahl 38 → 58 %, Tonhöhen/Stück 36 → 94 %, Stückgrenzen 0 → 100 %.
- **PDF lesen, Doppelseiten (416):** zweite Gegenprobe (Media vita, Signum magnum, Vox clara) fand drei Lücken der Systemsuche: Doppelseiten (zwei Spalten) werden jetzt geteilt und jede Spalte für sich gelesen, kleinere Systeme auf derselben Seite (Gloria Patri) und kurze Systeme werden gefunden. Gegenprobe 2: Notenzahl 11 → 68 %, Tonhöhen/Stück 43 → 98 %; altes Testset unverändert.
- **PDF lesen, Gegenprobe (415):** zwei neue Testseiten (Parce Domine, Tu es Petrus) ohne Einstellen gemessen; die Paar-Regel aus 412 hielt dort Iktus-Striche für Noten (43 Zusatznoten). Jetzt muss der Notenrest ungefähr quadratisch sein: Gegenprobe Notenzahl 30 → 60 %, Testset 63 %.
- **PDF lesen, ♭ und tiefe Noten (414):** ♭ wird geometrisch erkannt (Testset in der App: 89 % gefunden, 80 % richtig); tiefe Noten direkt nach dem Schlüssel werden nicht mehr als Schlüssel verworfen. Notenzahl je System richtig: 66 %.
- **PDF lesen, Virga (413):** Hals am rechten Notenrand, der frei endet, wird als Virga übernommen (Testset: 20 % gefunden, keine Fehlmeldung). Iktus und Episem per Geometrie verworfen (zu viele Fehlmeldungen); Neumenformen per KI wegen der Kostengrenze (max. 0.10 USD/Seite) nicht umgesetzt.
- **PDF lesen, Notenzahl und Mora (412):** abgetrennte zweite Note senkrechter Paare (Clivis/Pes) wird nicht mehr als «zu klein» verworfen; Mora-Punkte werden erkannt. Testset in der App: Notenzahl je System richtig 63 % (vorher 31 %), Mora-Punkte 77 % gefunden.
- **PDF lesen, Modus (411):** die kleine Angabe über der Initiale («VIII», «5», «1.», «R. br. VI») wird im selben KI-Aufruf gelesen und als Annotation übernommen. Steht der Modus woanders (z. B. «Intr. I» neben dem System), bleibt er leer.
- **PDF lesen (410):** neue Erkennung ist Standard, der alte Vision-Weg (GABC je System per KI, OMR-Korrektur) ist entfernt; Schalter entfällt. `170-greg-pdf-background.js` von 2426 auf 523 Zeilen.
- **PDF lesen, neue Erkennung (409, Schalter «Neue Erkennung (Test)» in der API-Key-Zeile):** Seite mit 300 dpi, Tonhöhen/Schlüssel/Trennstriche/Initialen geometrisch, Text per KI (ein Aufruf je Seite, Sonnet 5.5), Stückgrenzen an den Initialen, GregoBase-Angebot wie bisher. Ca. 6 s und 0.01 USD pro Seite. Ohne Schalter läuft der bisherige Weg. Neumenformen fehlen noch.
- **PDF lesen, Geometrie (408):** Übertragung des Prototyps nach JavaScript (`src/js/2-choral/172-pdf-geometrie.js`): Systeme, Tonhöhen, Schlüssel, Trennstriche, Initialen, Textgruppen, Zuordnung Text → Noten. Noch nicht an der Oberfläche; Ergebnis auf dem Testset identisch mit Python, ca. 1 s pro Seite.
- **Silbentrennung (403):** automatische Trennung (Psalmton-Assistent, Strophen, «Text zuerst») nach Solesmes-Konvention: «be-ne-dí-cta», «San-ctus», «ó-mni-um», «no-stra»; eigener Test.
- **Strophen: Note ohne Silbe (404):** «~» im Strophentext gilt auch mitten im Wort («memori~ále»: Silbe davor mit «-», Note bleibt leer); in der Vorschau eine Note antippen setzt/entfernt «~».
- **Strophen-Nummern (405):** Beim erneuten Bearbeiten (Text untereinander) bleiben die Nummern «2.», «3.» … erhalten, auch wenn die Vorlage selbst keine «1.» trägt.
- **Strophen (406):** Schalter «Strophen nummerieren» im Assistenten (Wahl wird in der Vorlage gemerkt, bleibt auch beim Wechsel «Text untereinander» ↔ «eigene Noten» erhalten); Noten ohne Silbe (`~`) überleben den Layoutwechsel (`vsSkip`, bleibt Strophen-Platz); Nummer wird im Textfeld nicht mehr als «_» angezeigt.
- **Handy-Kopfleiste (407):** Anzeigegrösse (🔍 %) und ⚙ Einstellungen (Bildschirm wach halten …) stehen jetzt neben dem Vollbild-Knopf statt im «⋯»-Menü der Wiedergabe; «Seiten» auf dem Handy nur als Symbol (Platz).
- **Mappe (402):** Übersicht und Hinzufügen in einem Fenster, Choral und Orgel getrennt mit eigenem PDF, Orgel standardmässig mit Begleitsatz.
- **Begleitsatz (300, 401):** freie Akkordwahl, b/h-Vorschlag, Vorgaben überstehen Transposition; Schlussformel nach NOH, Vorhalte/Septakkorde, Griffweite ohne Pedal, eigene Tests.
- **Sicherheit und Aufbau (399–400):** gemeinsamer Drive-Kern, Content-Security-Policy, Aufteilung in `src/`.
- **PC-Oberfläche (377–387):** Seitenansicht (A4-Blatt mittig, Breite an den Rändern ziehbar, je Stück gespeichert) für Choral und Orgel;
  Leisten nach Aufgaben gruppiert (Datei/Ansicht/Wiedergabe, Neume/Silbe/Zeichen/Trennung/Struktur), «Freitext» heisst «Notiz».
- **Dateien (353, 373, 378–381, 393):** Speichern unter (wie in Word: danach in der neuen Datei weiter), Zuordnung zur Bibliotheksdatei bleibt
  nach dem Neuladen, Dateinamen beim Export aus dem Namen der Notator-Datei; Öffnen mit Drive vorrangig und Suche im Drive.
- **Abschnitte (370, 375–376):** ausblendbar (nicht im PDF, nicht in der Orgel; Wiedergabe unverändert); Dateiname oben statt Abschnittstitel.
- **Strophen und Vorlagen (347–356, 388–397):** Text unter gleicher Melodie oder eigene Noten je Strophe, Kehrvers (℟) nach jeder Strophe,
  Erkennung von «1.»/«2.»; Gloria-Patri-Vorlagen (Introitus 1–8, Psalmton); Blockbearbeitung (markieren, duplizieren, verschieben, löschen).
- **Psalmton-Assistent (365, 372, 374):** Schlüsselwahl, Text je Abschnitt, Ziel wählbar, Erklärung der Zeichen.
- **Eingabe (313–321, 371):** Bearbeitungsfenster direkt an der Note, Werkzeugleiste über dem Notenblatt, «Text zuerst, Noten danach»,
  Mora (Taste M), Vorzeichen vor einer bestimmten Note; Iktus/Episema/Modifier gelten nur für die eben gesetzte Neume.
- **Handy (298–308, 328–335, 352, 366–369, 385):** Werkzeugleiste über den Noten, Zwei-Finger-Zoom, Neume per Tippen setzen, Grundgrösse
  halbiert, Original-PDF als Blatt unten, Orgel standardmässig 950 px eingepasst; zwei Endlosschleifen (Tab-Absturz) behoben.
- **Orgel (301–312, 344–345, 386, 398):** Menü einklappbar, Beschriftungen unter Trennstrichen (V/., ij., Ps. …) richtig platziert,
  Breite frei wählbar; PDF ohne kurzes Vergrössern der Anzeige.
- **Bibliothek (324–327, 340):** Kirchenjahr-/Gattungsfilter mit automatischer Einordnung; gelöschte Drive-Dateien ausgeblendet und beim Öffnen gewarnt.
- **Übriges:** PDF lesen – erkannte Teile als ein Stück laden (364); Schlüssel wechseln mit «Melodie beibehalten» (365);
  Speichern/Export werden quittiert, Fehler nicht mehr stumm (346); GregoBase-Suche auch bei abweichendem Titel (382).

## Laufende Arbeit

- **PDF lesen neu (Prototyp ausserhalb der App, seit 16.11.2026 in `main`):** Testset mit Soll-GABC (`tests/pdf-lesen/`, Scans nur lokal),
  Tonhöhen geometrisch, Text per KI je Seite (Sonnet 5.5, 89 % Silben); Plan und Messungen in `docs/pdf-lesen-plan.md`. Nächster Schritt: Einbau in Notator.

## Neu in Build 286–297

- **286** Abschnitte einzeln abspielen; Orgel-Einstellungen (Grundton, Oktave, Titel, Kopfzeile) je Abschnitt; Auswahl bei mehreren GregoBase-Links.
- **287** Orgel-Zeilenumbrüche: aus dem Choral (⏎) übernommen, per Klick setzen/entfernen.
- **288–289** Abstand vor Folgeabschnitt mit Titel; Note vor Quilisma/Episem als Viertel notiert.
- **290–291** Leisten aufgeräumt (Datei-Aktionen links, ⋮-Menü, Exportieren-Menü, API-Key-Zeile bei «PDF lesen», Handy-⋯-Menü).
- **292–293** Import/Öffnen ersetzt alle Abschnitte (Rückfrage, leerer Abschnitt = einfügen).
- **294** Link zur Notenbibliothek im Kopf.
- **295** Schutz vor Datenverlust (Rückfrage, Warnung beim Schliessen, Wiederherstellung aus localStorage), Orgel rückgängig/wiederholen, Strg+Z/Y/S; alter GABC-Tab entfernt.
- **296** Grundton für alle Abschnitte; Mappe mit Seitenzahlen + Inhaltsverzeichnis; NOH-Verknüpfung je Stück (📚 NOH ▾); Anfangston (♩); Psalmton-Assistent (Tondaten aus jgabc, gemeinfrei).
- **297** Vorschläge nach Kirchenjahr (heutiger Kalender für die eigene Bibliothek, Kalender 1962 für die Notenbibliothek).

## Neu in Build 227–237

- **227 Wiedergabe**, **228 PWA**, **229 MusicXML**, **230 Aufräumen** (siehe Git-Log).
- **231 Anzeigegrösse (🔍)** für Choral/Orgel, nur Bildschirm.
- **232 PDF speichern:** Ziel Gerät (Speicherdialog mit Standardordner, wo
  der Browser es kann) oder Google Drive (Standard Notator › PDF, änderbar).
- **233** Bibliothek/Öffnen/Song importieren in der oberen Leiste.
- **234 Begleitsatz:** Akkordvorgaben an Silbenanker gebunden (überstehen
  Einfügen/Löschen anderer Silben; alte Vorgaben werden migriert), Lage
  Grundstellung/Sextakkord wählbar, Pedal als eigenes System zuschaltbar
  (auch im MusicXML).
- **235 Bibliothek ordnen:** Kirchenjahr, Gattung, freie Tags (state.meta +
  Drive-appProperties), Suche (Titel, Textanfang, Tags; ohne Akzente) und Filter.
- **236 Gottesdienst-Mappe:** Stücke aus der Bibliothek, Fassung je Stück
  (Choral / Orgel / Orgel + Begleitsatz), Reihenfolge, Deckblatt mit Inhalt,
  jedes Stück auf neuer Seite; speicherbar (lokal + Drive Notator › Mappen).
  PDF-Bilder jetzt komprimiert (vorher mehrere MB je Seite).
- **237 Teilen:** Notator-Link mit eingebettetem Stück (#n=…, deflate +
  base64url; öffnet beim Empfänger die Ansicht, Choral oder Orgel) oder nur
  PDF (Senden über das Teilen-Menü des Geräts, Download oder Drive-Link
  «Jeder mit dem Link»).

## Neu in Build 238–261

- **253–255 Gregorio-Abgleich:** verlustfreier GABC-Import/-Export (Rohformen,
  Sonderschlüssel, Virgula, Custos, alle Kopffelder), Übersetzung `[..]`,
  `<alt>`, Textauszeichnung `<b> <sc> <c> <ul> <e>`; Kopffelder commentary
  (oben rechts), mode/mode-differentia (Annotation), book (Untertitel).
- **254/258 b-Regel:** ♭ gilt standardmässig bis zur nächsten Divisio
  (Nutzerentscheid); Solesmes-Regel (bis Wortende) per Schalter im Orgelteil.
- **256** PDF-Seitenumbruch nie im System (Sperrzonen in Bildkoordinaten).
- **257** Drive-Upload prüft Zielordner (Papierkorb → Standardordner + Hinweis).
- **259** PDF-Druckqualität wählbar (150–400 dpi, Standard 300); Banner
  «Neue Version» mit Übernahme des offenen Stücks.
- **260** Abschnittsabstand einstellbar; kein Leerraum bei Abschnitten ohne Titel.
- **261** Zweizeilige Initiale (Option «2-zeilig», Kopffeld `notator-initial-lines: 2`).

## NOH-Notenbibliothek

- Liegt unter `noh/` (https://krohnoshub.github.io/notator/noh/), gepflegt im Chat
  «Digitale Musiknotenbibliothek erstellen». Knopf «In Notator» öffnet
  `../#song=Titel` → Notator sucht den Titel direkt in GregoBase.
- Der Notator-Service-Worker (Bereich /notator/) deckt noh/ mit ab
  (Netz zuerst, Kopie im Cache); offline wird für noh/ nie index.html ersetzt.

## Offen / Ideen

- «PDF lesen», Neumenformen: Mora (412), ♭ (414) geometrisch; Virga (413) seit 429 abgeschaltet.
- «PDF lesen», offen nach Runde 15: hohle Notenköpfe werden nicht erkannt; senkrechter Abschlussstrich am Systemende in schmalem Satz gilt als Trennstrich (eine pauschale Regel würde 37 echte Striche am Zeilenende löschen); Modus links vom ersten System ohne Initiale; Strophen untereinander – nur die erste wird gelesen. Quilisma, Liqueszenz, Oriscus, Rhombus, Iktus, Episem
  werden nicht erkannt – per KI zu teuer (Kostengrenze 0.10 USD/Seite, Entscheid Matthias 23.11.2026), geometrisch bisher
  zu unzuverlässig. Nacharbeit von Hand.
- «PDF lesen», Notenzahl: nach Build 412 noch 7–8 fehlende und ~13 zusätzliche Noten auf 32 Systemen (Tiefe Noten nahe dem Text,
  Druckflecken, Custos am Zeilenende, Teile verzierter Neumen; beim Salve mater weicht zudem das Soll vom Druck ab).
  Custos per Tonhöhe (= erste Note des nächsten Systems) erkennen versucht: entfernt echte Schlussnoten, verworfen.
- Alleluja-Vorlagen (wie Gloria Patri): recherchiert, zurückgestellt.
- Schriftart der Initiale (Drop-Cap) wählbar machen (Idee 08/2026, nicht priorisiert).
- Teilen: sehr lange Stücke ergeben lange Links (Alleluia ≈ 2600 Zeichen).
- Zurückgelegt (Gregorio-Vergleich, optional): **NABC** (adiastematische St.-Galler/Laon-Neumen über dem System) und **TeX-/Gregorio-Export**.
  Verworfen: Chorzeichen, Klammern, Polyphonie, 2/5 Linien, Doppelschlüssel-Anzeige.
