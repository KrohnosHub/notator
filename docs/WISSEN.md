# Notator – gesammeltes Wissen (Lehren, Entscheidungen, Hintergründe)

Ergänzt `CLAUDE.md` (Arbeitsablauf, Sicherheit) und `NOTES.md` (Änderungsübersicht).
Hier steht, was sich nicht aus dem Code ablesen lässt: Lehren aus Fehlern, Entscheidungen von Matthias
und Eigenheiten von exsurge. Stand: Build 401, 16.11.2026. **Neue Erkenntnisse und Entscheidungen hier
nachtragen** (kurz, mit Datum oder Build), damit alle Sitzungen – claude.ai und Claude Code – denselben Stand haben.

## 1. Zusammenarbeit mit Matthias

- Deutsch, Schweizer Schreibweise, per Du; kurz und konkret, keine Floskeln.
- Sinnvoll selbst entscheiden statt unnötig nachzufragen; **vor grösseren Features** Vorgehen kurz vorschlagen.
  Bei Gestaltungsfragen gern Varianten visuell zeigen, bevor umgesetzt wird.
- Unsicherheiten offen benennen; klar trennen zwischen «getestet», «nur im Code gelesen» und «muss im Browser geprüft werden».
- Matthias nutzt Notator als installierte App auf dem **Android-Handy** (PWA), im Browser am **PC** und auf dem
  **Tablet an der Orgel** (zusammen mit NOH-Notenbibliothek und Schola-Planer; Bildschirm soll wach bleiben).
  Fehlermeldungen kommen meist als Handy-Screenshot.
- «Funktioniert nicht» nach einem Update: zuerst prüfen, ob die neue Version schon geladen ist
  (Build-Nummer; Service-Worker-Cache – App ggf. zweimal neu laden). Ist schon mehrfach vorgekommen.

## 2. Testlehren

- **Einlesen ≠ Darstellen.** exsurge hat getrennte Pfade für das Parsen und das Rendern. Dass ein Text oder Tag
  das Parsen übersteht, beweist nichts über die Darstellung (Beispiel: `<sp>` kennt nur Notators Import,
  der Renderer gab ihn wörtlich aus). Jede Änderung an GABC-Erzeugung oder Notensatz im **echten Notenbild** prüfen
  (`tests/visual/run.js`, Playwright-Screenshot oder PDF).
- **Abweichung in der Datenstruktur ≠ sichtbarer Fehler.** Ein «Fix» für eine nur im Datenmodell sichtbare
  Abweichung hat schon einmal einen echten Darstellungsfehler erzeugt. Erst den sichtbaren Fehler belegen.
- **Synthetische Testbilder reichen für «PDF lesen» nicht.** Auflösung, Ausschnitt und Linienabstand echter
  PDF-Seiten weichen ab. Bei der Bilderkennung früh Diagnose-Logs einbauen und echte Konsolenausgaben von
  Matthias holen. `gregGst()` schreibt nur in die Statuszeile, nicht in die Konsole – ein leeres Konsolen-Log beweist nichts.
- Nach einer Nutzermeldung nicht nur die gemeldete Stelle flicken, sondern alle gleichartigen Stellen systematisch prüfen.
- Playwright-Tests: Beim Start öffnet sich nach ca. 2 s die Bibliothek – warten, dann `closeModal()`.
  `page.evaluate` nie auf einen unbeendeten Promise warten lassen (hängt); in `() => { … }` einwickeln.
  PDF-Erzeugung lässt sich mit lokal eingebundenem jsPDF und `window._ntCollect` (Seitenbilder abfangen) prüfen.

## 3. exsurge: Eigenheiten und Notator-Patches (`src/vendor/exsurge.js`)

- Notator-eigene Patches: `patchDividerLeadingSpace` (Abstand vor Divisio), `patchTextOnlyTrailingSpace`
  (notenlose Direktiven wie *Ant.*, *Ps.*, *ij.* nur mit kleinem Folgeabstand statt Wortabstand),
  `patchNeumeFinalNoteBoundsForSpacing` (Mora/Episem/Iktus auf einer **nicht letzten** Note blähte den Abstand zur
  Folgeneume auf), `patchAnnotationDropCapSpacing`; `ChantLineBreak`: `this.justify = false` (keine gedehnte Zeile
  vor erzwungenem Umbruch); Strophen: nach mehrzeiligem Text (`lastMulti`) landet einzeiliger Text wie «Amen» auf der untersten Zeile.
- `<i>…</i>` wird intern wie `_…_` als Kursiv behandelt (exsurge kannte nur `_`). Folge: `lyric.text` verliert
  die Tags schon beim Parsen – für die Erkennung `lyric.originalText` lesen.
- exsurge färbt «V/.», «R/.», «A/.» fest rot → `gregNeutralizeRubricRed()` setzt nach dem Rendern auf Schwarz.
- Direktiven immer als `<i>Ant.</i>() Silbe(…)` exportieren (mit `()` und Leerzeichen). Ohne `()` verschmilzt
  der Text mit der Folgesilbe, und die Silbenzentrierung (`findVowelSegment`, Vokalpriorität a, e, i, o, u – nicht
  von links) setzt die Neume über die Direktive.
- `ij.`, `iij.`, `Ps.` usw. dürfen nie einen Bindestrich zur Folgesilbe bekommen.
- Neumen: Salicus ist eine **3-Noten**-Figur (Oriscus auf der mittleren Note, `fgoh`); Scandicus ohne angehängtes `v`;
  Climacus beliebig lang (`NEUME_OPEN_ENDED`, «Fertig»/Enter schliesst ab).
- Mora: `fe..` (zwei Punkte nach der letzten Note, GregoBase-Schreibweise) wird als Mora auf **beiden** Noten gelesen,
  exportiert wird die eindeutige Form `f.e.`.
- Ein «*» mit Leerzeichen danach ist ein normales Zeichen, kein Fett-Markup.

## 4. GregoBase und Quellen

- Zugriff über den eigenen Proxy `notator-gregobase-proxy.matthias-krohn.workers.dev` (GregoBase erlaubt keine fremden
  Browser-Origins). Download braucht `format=gabc&elem=1`.
- Kopffelder: `mode` → Annotation, `book` → Untertitel, `office-part` bewusst ignoriert; GregoBase-Importe mit `drop-cap: auto`.
- **Melodie aus GregoBase übernehmen ist meist sicher, Text und Satzzeichen nicht:** Bei einer Vorlage aus einer anderen
  Ausgabe jede Silbe samt Komma, Punkt, æ usw. gegen das Ziel-PDF prüfen (Text-Extraktion), bevor ein Stück als fertig gilt.
- Psalmtöne aus jgabc (gemeinfrei); Gloria-Patri-Vorlagen aus GregoBase («Gloria Patri I–VIII»).

## 5. Entscheidungen von Matthias (gelten, bis er sie ändert)

Allgemein
- Ablage: Google Drive (Liturgie › Notator) ist die Hauptablage, die Browser-Kopie nur Offline-Zwischenspeicher; Anmeldung per Google-OAuth.
- Vorrang: Handy-Tauglichkeit und Teilen mit anderen; Hauptnutzer ist Matthias selbst.
- **Speichern unter** wie in Word/Excel: danach arbeitet man in der neuen Datei, das Original bleibt auf dem letzten
  Speicherstand. Neue Abschnitte ändern nie den Dateinamen.
- Vorgeschlagene Dateinamen (PDF, ABC, MusicXML, Teilen) kommen vom **Namen der Notator-Datei**, nie vom aktiven Abschnitt.
- Gelöschte Drive-Dateien (Papierkorb) erscheinen nicht in der Bibliothek; beim Öffnen Warnung und rote Markierung.
- «Freitext» heisst «Notiz» (standardmässig nicht im PDF).

Choral
- ♭ gilt standardmässig bis zur nächsten Divisio (Solesmes-Regel per Schalter).
- Ausgeblendete Abschnitte fehlen in Anzeige, Choral-PDF, Orgelansicht und Orgel-PDF; die Wiedergabe bleibt unverändert.
- PC: Seitenansicht – Blatt in A4-Breite mittig, Breite an den Blatträndern ziehbar, je Stück gespeichert;
  bestehende Stücke behalten ihre Breite. Bildschirm und PDF haben dieselben Zeilenumbrüche. Handy unverändert.
- Handy: frühere 50 % Anzeigegrösse = neue 100 %.
- Strophen: Text untereinander unter derselben Melodie oder eigene Noten je Strophe, umschaltbar.
- Alleluja-Vorlagen (wie Gloria Patri): recherchiert, **zurückgestellt** (GR 1961: rund 300 Allelujas, 170 Melodien,
  51 mehrfach; häufigste Typen Modus II «Dies sanctificatus», VIII «Dominus in Sina», IV «Ascendit Deus»).

Orgel
- Orgelfassung: Melodie in Achteln, Transposition nach Finalis; **Begleitsatz standardmässig an** (Regelwerk: `docs/begleitsatz-regelwerk.md`).
- Die Orgelfassung hat eigenen Titel/Untertitel, sobald bearbeitet – nie zurück in den Choral synchronisiert.
- Mappe: Choral und Orgel getrennt mit eigenem PDF; Orgel standardmässig **mit Begleitsatz, ohne eigenes Pedalsystem**.

## 6. Umfeld

- NOH-Notenbibliothek liegt im selben Repo unter `noh/` (eigener Chat «Digitale Musiknotenbibliothek erstellen»); Notator und NOH verlinken sich.
- Schola-Planer und Gesangs-App laufen auf derselben Origin `krohnoshub.github.io` und teilen das Google-Token (siehe Sicherheit in `CLAUDE.md`).

## 7. Veraltet – nicht mehr anwenden

Aus der Zeit vor GitHub Pages stammen: versionierte Dateien `Notator_XXX.html`, die «Test-Bibliothek» mit Archiv-Ordner,
`Notator_starten.bat`/`notator_server.py` (lokaler GregoBase-Proxy), Upload über die GitHub-Weboberfläche und
Syntax-Checks per `new Function`. Heute: `src/` + `build.py`, Pull Requests, CSP. Der Teil «Session 64» in `NOTES.md` ist ebenfalls historisch.
