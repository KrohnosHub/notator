# Notator – Handoff Summary

## Projekt
Single-file HTML-App (`index.html`, ~370 KB) für klassische und gregorianische Notation.

## Deployment
- **GitHub Pages:** https://krohnoshub.github.io/notator/
- **Repo:** https://github.com/KrohnosHub/notator
- **Update-Prozess:** Neue `index.html` im Repo via „Add file → Upload files" ersetzen → ~1 Min. bis live
- **Lokal:** `python -m http.server 8080` (nur noch nötig falls offline gearbeitet wird)
- **PDF-KI:** Funktioniert direkt über HTTPS, kein lokaler Server mehr nötig

## Tabs
- **Noten-Editor**: klassischer Canvas-Editor (unverändert)
- **Greg-Editor**: visueller Gregorianik-Editor (Hauptentwicklungsfokus)
- **GABC-Eingabe**: Direkteingabe von GABC-Code → exsurge-Rendering

## Greg-Editor – Architektur
State: `gregEntries[]` → `gregBuildGABC()` → exsurge rendert live.

**Entry-Typen:** `note`, `divisio`, `special`, `textonly`, `directive`, `dropcapletter`, `comment`

**Note-Felder:** `{type, syllable, neume, pitches[], mora, iktus, episema, liquescent, oriscus, strophicus, pressus, accidental}`

**Neumen:** punctum, virga, virga_rev, quilisma, bistropha, tristropha, podatus, clivis, porrectus, salicus, torculus, scandicus, climacus

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

## Toolbar-Buttons (Greg-Editor)
| Button | Funktion |
|---|---|
| Undo | Letzten Schritt rückgängig |
| Neu | Alle Einträge löschen |
| ↩ GABC | Import-Panel öffnen/schliessen |
| PDF lesen | PDF-Import (Text-Extraktion oder Claude Vision) |
| ↓ PDF | SVG → Canvas → jsPDF export (weisser Hintergrund, 2× Qualität) |
| 💾 Speichern | Stück als `.notator`-Datei speichern (showSaveFilePicker / Fallback prompt) |
| 📂 Öffnen | `.notator`-Datei laden, alle Felder + Einträge wiederherstellen |

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
- Button „↩ GABC" öffnet einklappbares Panel mit Textarea
- Code einfügen → „Importieren" → `gregImportGABCString()` → Einträge in Liste
- GABC-Output unten: Kopier-Button direkt beim Textarea

## PDF-Import (Greg-Editor)
1. Text-Extraktion via PDF.js → GABC-Pattern-Suche
2. Falls kein Text: Seite als Canvas (scale 2.5) → Base64-JPEG → Claude Vision API (2 Calls: detect pieces → extract chosen piece)
- Modell: `claude-sonnet-4-6`
- Header: `x-api-key`, `anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access: true`
- API-Key-Feld in Toolbar (Passwort-Feld, nicht gespeichert)
- Über HTTPS (GitHub Pages) kein CORS-Problem mehr

## Hintergrund
- Greg-Editor und GABC-Eingabe: `background: #ffffff` (weiss, druckfertig)
- PDF-Export: weisser Hintergrund explizit via Canvas-Fill gesetzt

## Offene Punkte / bekannte Bugs
- Drop Cap `<sp>A</sp>()` – Bindestrich: exsurge-Verhalten (SingleSyllable → kein Connector), kein eigener Bug
- Clivis-Liqueszenz: Rendering durch exsurge korrekt wenn höchste Note zuerst geklickt
- Kommentare (Freitextfelder) als SVG-Overlay, Position via x/y% im Entry
- PDF-GABC-Extraktion: Qualität abhängig von Scan-Qualität; manuelle Nachbearbeitung nötig
- Repo ist public → URL öffentlich zugänglich; `.notator`-Dateien bleiben lokal

## Nutzer
Matthias (KrohnosHub), kommuniziert auf Deutsch, direkte knappe Antworten bevorzugt.
