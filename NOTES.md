# Notator – Handoff Summary

## Änderungsverlauf (neueste zuerst)
- **Build 172** (2026-07-19): Tooltips ergänzt (Undo, Redo, Neu, PDF lesen,
  PDF sichern).
- **Build 171** (2026-07-19): Neumen-Grid-Breite korrigiert (Button- und
  Label-Breite fest auf 45px statt variabel bis 54px) → zuverlässig 11
  Symbole/Zeile. GABC-Buttons (Importieren/Kopieren/.gabc) rechtsbündig
  gruppiert. Divisio- und Sonder-Zeile zu einer Zeile mit optischer
  Zweiteilung zusammengelegt. GABC-Import-Panel öffnet sich jetzt unterhalb
  statt oberhalb des Ausgabebereichs.
- **Build 170** (2026-07-19): `#greg-input-panel`-Breite 300px → 540px,
  damit die 22 Neumen-Symbole exakt 2 Zeilen à 11 ergeben (Rechnung:
  11×45px Button + 10×2px Gap + 16px Padding = 531px Minimum). Toolbar in
  2 feste Zeilen aufgeteilt (siehe Tabelle unten). GABC-Import-Button von
  der oberen Toolbar zum GABC-Ausgabebereich verschoben.

## Projekt
Single-file HTML-App (`index.html`, ~650 KB) für klassische und
gregorianische Notation.

## Deployment
- **GitHub Pages:** https://krohnoshub.github.io/notator/
- **Repo:** https://github.com/KrohnosHub/notator
- **Update-Prozess:** Neue `index.html` (umbenannte `Notator_XXX.html`) im
  Repo via „Add file → Upload files" ersetzen → ~1 Min. bis live. Diese
  `NOTES.md` bei grösseren Änderungen im selben Zug mit aktualisieren/
  hochladen.
- **Lokal:** `python -m http.server 8080` (nur noch nötig falls offline
  gearbeitet wird)
- **PDF-KI:** Funktioniert direkt über HTTPS, kein lokaler Server mehr nötig

## Build-ID (`NOTATOR_BUILD_ID`)
Jede ausgelieferte Version trägt eine eigene Build-ID (aktuell `172`), die
den lokalen Autosave-Speicher (localStorage) pro Version trennt — verhindert,
dass beim Öffnen einer neueren Datei versehentlich der Autosave-Stand einer
älteren Version geladen wird. Bei jedem Update hochzählen.

## Tabs
- **Noten-Editor**: klassischer Canvas-Editor (unverändert)
- **Greg-Editor**: visueller Gregorianik-Editor (Hauptentwicklungsfokus)
- **GABC-Eingabe**: Direkteingabe von GABC-Code → exsurge-Rendering

## Greg-Editor – Architektur
State: `gregEntries[]` → `gregBuildGABC()` → exsurge rendert live.

**Entry-Typen:** `note`, `divisio`, `special`, `textonly`, `directive`, `dropcapletter`, `comment`

**Note-Felder:** `{type, syllable, neume, pitches[], mora, iktus, episema, liquescent, oriscus, strophicus, pressus, accidental}`

**Neumen:** punctum, virga, quilisma, podatus, clivis, salicus, torculus,
porrectus, scandicus, climacus, bistropha, tristropha, apostropha,
distropha, bivirga, trivirga, puncta_inclinata, pes_subpunctis,
pes_quassus, torculus_resupinus, porrectus_flexus, scandicus_flexus
(22 Neumentypen, visuelle Auswahl als 2×11-Grid im Greg-Editor-Panel)

**Vorzeichen:** `accidental`: `'y'`=b♭, `'#'`=♯, `'n'`=♮ → in GABC als Suffix nach Pitch (z.B. `fy`)

**Wichtig Clivis/Porrectus/Climacus:** höchste Note zuerst klicken. Liqueszenz = letzter Ton als Grossbuchstabe in GABC.

## Exsurge-Integration
- Bundle als IIFE (240 KB) inline
- `performLayoutAsync` (nicht `performLayout`)
- Aktive Patches nach Bundle-Ende:
  - Patch 1: Annotation/Drop Cap Y-Offset (`staffInterval × 0.6`)
  - Patch 2: Divider `leadingSpace` (verhindert Noten-Kleben vor Trennstrich)
  - `positionNotationElement`: berücksichtigt `curr.leadingSpace`
- `addSvgPadding(svgEl, pad, neededTopPad)`: ViewBox-Erweiterung dynamisch
  - `neededTopPad` wird von `gregCalcTitlePad()` berechnet (vor dem Render-Aufruf)
  - Minimum: `pad` (32px); kein künstliches `pad*2.5`-Minimum mehr
- GABC-Preprocessing: `<clear>` entfernen, `<sp>V/</sp>` → ℣, `<sp>R/</sp>` → ℟
- Header-Parsing: `annotation:`, `drop-cap: auto`, `name:` → auf Score-Objekt gesetzt
- **Drop Cap:** `drop-cap: auto` lässt exsurge automatisch den ersten
  Buchstaben des Lyrics-Texts als Initiale nehmen (`generateDropCap()`).
  Für den Sonderfall, dass die gedruckte Zierinitiale vom ersten gesungenen
  Buchstaben abweicht, gibt es im Greg-Editor zusätzlich ein manuelles
  Buchstaben-Feld + „+DC"-Button (fügt einen notenlosen `X()`-Eintrag ein).

## Titel & Text über Notenlinie
- **Titel:** Feld „Titel" → rendert als SVG-Text, linksbündig, Schriftgrösse `si * 3.5`
- **Text:** Feld „Text" (früher „Untertitel") → Schriftgrösse `fs * 0.5`, Zeilenumbrüche via `\n`
- **Auto-Wrap:** `gregWordWrap()` via `canvas.measureText()` – bricht automatisch bei SVG-Breite um
- **Positionierung:**
  - Titel: fix bei `vy + 2 + fs` (direkt unter Padding-Oberkante)
  - Text: folgt nach Titel, Zeilenabstand `subFs * 1.4`
  - Einzug: `gregGetContentLeftX()` liest x-Position der zweiten Notenzeile aus SVG-Staff-Lines
  - Notenlinie rückt dynamisch nach unten je nach Textumfang
- **`gregCalcTitlePad(svgW)`:** Berechnet benötigten `topPad` vor `addSvgPadding`; gap = 10px über Staff

## Layout — Eingabe-Panel (Greg-Editor)
- `#greg-input-panel`-Breite: **540px** (per Drag-Handle zwischen 200px und
  `window.innerWidth-300px` verstellbar, Default 540px). Diese Breite ist
  bewusst so gewählt, dass das Neumen-Grid exakt 2 Zeilen à 11 Symbole
  ergibt (11×45px Button + 10×2px Gap + 16px Padding = 531px Minimum, 540px
  gewählt für etwas Puffer). Neumen-Buttons haben eine FESTE Breite von
  45px (Button UND Label-Span identisch begrenzt) — bei Änderungen an
  Neumenanzahl/-benennung diese Rechnung neu prüfen.
- Toolbar in 2 feste Zeilen (siehe Tabelle unten).

## Toolbar-Buttons (Greg-Editor)

**Zeile 1:**

| Button/Feld | Funktion |
|---|---|
| ↩ Undo | Letzte Aktion rückgängig machen |
| ↪ Redo | Rückgängig gemachte Aktion wiederherstellen |
| ✕ Neu | Neues, leeres Stück beginnen (aktuelles Stück wird verworfen) |
| 📂 Öffnen | Stück aus `.notator`-Datei laden |
| 📄 PDF lesen | Noten aus PDF per KI-Bilderkennung einlesen |
| API-Key-Feld | Anthropic API-Key für PDF-Bilderkennung (wird nicht gespeichert) |

**Zeile 2:**

| Button/Feld | Funktion |
|---|---|
| 💾 Speichern | Stück als `.notator`-Datei speichern |
| ↓ PDF | Aktuelles Stück als PDF sichern |
| Freitext drucken | Checkbox: Kommentar-Overlays im PDF-Export mit ausdrucken |
| 🧪 Selbsttest | Regressionstests laufen lassen (GABC Import/Export gegen bekannt-korrekte Fälle) |
| + Abschnitt | Neuen Abschnitt hinzufügen |

**GABC-Ausgabebereich** (unten im Panel, rechtsbündige Button-Gruppe neben
dem Textfeld): ↩ Importieren (öffnet Ausklapp-Panel darunter) · 📋 Kopieren
· ↓ .gabc (als Datei speichern).

## Speichern / Laden (`.notator`-Format)
```json
{
  "version": "1.1",
  "title": "...",
  "subtitle": "...",
  "annotation": "II",
  "dropCap": true,
  "dropCapLetter": "V",
  "clef": "do",
  "entries": [ ... ]
}
```
- Speichern: `showSaveFilePicker` (Chrome/Edge) mit freier Ordner- und Namenwahl; Fallback: `prompt()` + Download-Ordner
- Laden: FileReader → JSON.parse → State restore; vorheriger State ins Undo-Stack

## GABC-Import
- Button „↩ Importieren" (jetzt beim GABC-Ausgabebereich, nicht mehr in
  der oberen Toolbar) öffnet ein Panel mit Textarea darunter
- Code einfügen → „Importieren" → `gregImportGABCString()` → Einträge in Liste
- GABC-Output darüber: Kopier- und Download-Button direkt daneben

## PDF-Import (Greg-Editor)
1. Text-Extraktion via PDF.js → GABC-Pattern-Suche
2. Falls kein Text: Seite als Canvas (scale 2.5) → Base64-JPEG → Claude Vision API (2 Calls: detect pieces → extract chosen piece)
- Modell: `claude-sonnet-4-6`
- Header: `x-api-key`, `anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access: true`
- API-Key-Feld in Toolbar (Passwort-Feld, nicht gespeichert)
- Über HTTPS (GitHub Pages) kein CORS-Problem mehr
- **Bekannte Einschränkung (2026-07):** Wiederholte Durchläufe derselben
  PDF können unterschiedliche UND jeweils fehlerhafte Ergebnisse liefern
  (in Tests: von 18 geprüften Silben je nur 2-3 korrekt, manche Fehler in
  mehreren Durchläufen identisch — deutet auf systematische statt rein
  zufällige Fehllese-Tendenz bei bestimmten Notenformen hin). Deshalb
  paralleles Projekt: eine deterministische, klassische Bildverarbeitungs-
  Pipeline (`omr_pipeline.py`, separates Python-Tool, nicht Teil dieser
  App) als Alternative/Gegenprobe, siehe interne Projektnotizen.

## Hintergrund
- Greg-Editor und GABC-Eingabe: `background: #ffffff` (weiss, druckfertig)
- PDF-Export: weisser Hintergrund explizit via Canvas-Fill gesetzt

## Offene Punkte / bekannte Bugs
- Drop Cap `<sp>A</sp>()` – Bindestrich: exsurge-Verhalten (SingleSyllable → kein Connector), kein eigener Bug
- Clivis-Liqueszenz: Rendering durch exsurge korrekt wenn höchste Note zuerst geklickt
- Kommentare (Freitextfelder) als SVG-Overlay, Position via x/y% im Entry
- PDF-GABC-Extraktion: Qualität abhängig von Scan-Qualität; manuelle Nachbearbeitung nötig (siehe "Bekannte Einschränkung" oben)
- Repo ist public → URL öffentlich zugänglich; `.notator`-Dateien bleiben lokal

## Nutzer
Matthias (KrohnosHub), kommuniziert auf Deutsch, direkte knappe Antworten bevorzugt.
