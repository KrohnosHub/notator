# Notator – Stand Build 406 (22.11.2026)

Live: https://krohnoshub.github.io/notator/ (GitHub Pages, Repo KrohnosHub/notator). Arbeitsweise: `CLAUDE.md`;
Lehren, Entscheidungen von Matthias und exsurge-Eigenheiten: `docs/WISSEN.md`; Orgel-Begleitsatz: `docs/begleitsatz-regelwerk.md`.
Diese Datei gibt nur den Überblick; Einzelheiten stehen im Git-Log (`Build NNN: …`).

## Aufbau

- Code in `src/` (CSS, `body.html`, JS in `1-start/`, `2-choral/`, `3-orgel-und-mehr/`, `vendor/exsurge.js`); `python3 build.py` erzeugt `index.html`.
- Tests: `tests/gd-core.test.js`, `tests/silbentrennung.test.js`, `tests/begleitsatz.test.js`, `tests/visual/run.js` (Bildvergleich); GitHub Action «Tests» bei jedem Push.
- Content-Security-Policy mit Skript-Hashes (setzt `build.py`), keine Inline-Handler (`tools/handlers.py`).
- Google-Drive-Kern `shared/gd-core.js`, gemeinsam mit dem Schola-Planer.
- GregoBase über eigenen Proxy (Cloudflare Worker).

## Neu in Build 298–403 (Auszug)

- **Silbentrennung (403):** automatische Trennung (Psalmton-Assistent, Strophen, «Text zuerst») nach Solesmes-Konvention: «be-ne-dí-cta», «San-ctus», «ó-mni-um», «no-stra»; eigener Test.
- **Strophen: Note ohne Silbe (404):** «~» im Strophentext gilt auch mitten im Wort («memori~ále»: Silbe davor mit «-», Note bleibt leer); in der Vorschau eine Note antippen setzt/entfernt «~».
- **Strophen-Nummern (405):** Beim erneuten Bearbeiten (Text untereinander) bleiben die Nummern «2.», «3.» … erhalten, auch wenn die Vorlage selbst keine «1.» trägt.
- **Strophen (406):** Schalter «Strophen nummerieren» im Assistenten (Wahl wird in der Vorlage gemerkt, bleibt auch beim Wechsel «Text untereinander» ↔ «eigene Noten» erhalten); Noten ohne Silbe (`~`) überleben den Layoutwechsel (`vsSkip`, bleibt Strophen-Platz); Nummer wird im Textfeld nicht mehr als «_» angezeigt.
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

- Alleluja-Vorlagen (wie Gloria Patri): recherchiert, zurückgestellt.
- Schriftart der Initiale (Drop-Cap) wählbar machen (Idee 08/2026, nicht priorisiert).
- Teilen: sehr lange Stücke ergeben lange Links (Alleluia ≈ 2600 Zeichen).
- Zurückgelegt (Gregorio-Vergleich, optional): **NABC** (adiastematische St.-Galler/Laon-Neumen über dem System) und **TeX-/Gregorio-Export**.
  Verworfen: Chorzeichen, Klammern, Polyphonie, 2/5 Linien, Doppelschlüssel-Anzeige.
