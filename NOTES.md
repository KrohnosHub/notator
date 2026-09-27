# Session 64 (2026-09-26): Notator_208.html — Original-PDF als ausklappbares Seitenpanel statt Geister-Hintergrund

Nutzer meldete: beim "PDF lesen" (Gregorianisch-Modus) wurde das Original-PDF
bisher nur als schwaches Geisterbild HINTER der neu erzeugten Notation
angezeigt — dadurch war weder der Scan noch die Notation richtig lesbar.
Wunsch: eine zusätzliche Option, das Original direkt (z.B. als aufklappbare
Seitenleiste) zu sehen.

## Ist-Zustand vor dieser Änderung

`gregRenderPDFPage()` rendert die aktuelle PDF-Seite per pdf.js auf eine
Canvas `#greg-pdf-bg`, die absolut positioniert bei `opacity:0.35` direkt
hinter `#greg-svg-wrap` liegt (beide im selben Kästchen `#greg-svg-original-
slot` gestapelt). Wird automatisch bei JEDEM echten "PDF lesen"-Lauf
aufgerufen (Zeile `await gregRenderPDFPage(1);` kurz vor dem Schritt-A-
Vision-Aufruf), nicht nur bei manueller Nutzung. Zusätzlich setzte diese
Funktion bisher `#greg-svg-wrap`s `min-height` auf die volle PDF-Seiten-
höhe (Ursache des in Session 63/Runde 64 gefundenen und dort nur
downstream gepatchten "riesiger Weissraum"-Bugs in `gregRenderAllSections`).

## Entscheidung (mit Nutzer abgestimmt, 3 Rückfragen)

1. Die 35%-Geister-Canvas wird komplett entfernt (nicht nur ergänzt).
2. Neues Panel erscheint RECHTS, ausklappbar, mit eigener Ziehleiste
   analog zur bestehenden zwischen GABC-Editor und Noten-Editor
   (`#greg-drag-handle`/`#greg-input-panel`).
3. Panel öffnet sich automatisch, sobald eine PDF-Seite gerendert wird
   (also auch beim automatischen Vision-Lauf) — manuell schliess-/wieder
   einblendbar über einen neuen Toolbar-Knopf.

## Umsetzung (Runde 65)

- Neue Funktion `gregToggleOriginalPdf(forceOpen)`: zeigt/versteckt
  `#greg-pdf-panel` + `#greg-pdf-drag-handle`, zeigt den Toolbar-
  Wiedereinblend-Knopf `#greg-pdf-panel-toggle` sobald ein PDF geladen ist.
  `forceOpen` optional (true/false erzwingt Zustand, ohne Argument =
  umschalten).
- `#greg-pdf-bg`-Canvas aus `#greg-svg-original-slot` entfernt und in das
  neue `#greg-pdf-panel` verschoben — rendert jetzt in voller Deckkraft,
  Breite richtet sich nach der Panel-Breite statt nach `greg-canvas-wrap`.
- `#greg-pdf-nav` (Seiten-◀/▶ + Label) unverändert wiederverwendet, nur
  räumlich ins neue Panel-Header verschoben (gleiche IDs, keine JS-Änderung
  an der Nav-Logik nötig).
- `gregRenderPDFPage()` ruft jetzt `gregToggleOriginalPdf(true)` auf
  (Auto-Öffnen) und setzt KEIN `min-height` auf `#greg-svg-wrap` mehr —
  entfernt die Ursache des Session-63/Runde-64-Weissraum-Bugs an der
  Wurzel (der defensive Fix in `gregRenderAllSections` bleibt trotzdem als
  Sicherheitsnetz bestehen, kostet nichts).
- `gregClearPDF()` schliesst das Panel jetzt vollständig und versteckt auch
  den Toolbar-Wiedereinblend-Knopf.
- Neue, zu `#greg-drag-handle` analoge Ziehleisten-Logik für
  `#greg-pdf-drag-handle` (Vorzeichen umgekehrt, da Panel rechts von seiner
  Ziehleiste liegt statt links) — rendert die PDF-Seite nach Grössen-
  änderung neu (debounced), damit sie zur neuen Panel-Breite passt.

## Verifikation

- Syntax-Check aller 7 `<script>`-Blöcke: grün.
- `gregToggleOriginalPdf` per echter Extraktion aus der Datei in Node gegen
  eine simulierte Klick-Abfolge getestet (Mock-DOM, kein jsdom nötig für
  diese reine Zustandslogik): Start zu → Auto-Öffnen(true) → manuell
  schliessen → manuell wieder öffnen (Toolbar-Knopf) → `gregClearPDF`-
  Szenario (forceOpen=false) — alle 5 Zustände exakt wie erwartet
  (`flex`/`none` an Panel + Ziehleiste, Toolbar-Knopf sichtbar sobald PDF
  geladen).
- **Nicht möglich:** das tatsächliche visuelle Ergebnis im Browser (Panel-
  Breite, Ziehleisten-Gefühl, ob das automatische Neurendern beim Resize
  ruckelt) — wie üblich hängt volles Rendering in dieser Sandbox. Bitte im
  Browser testen.

## Codeänderungen (Notator_208.html, ersetzt Notator_207.html)

- HTML: `#greg-pdf-panel` + `#greg-pdf-drag-handle` neu (rechts neben
  `#greg-canvas-wrap`), `#greg-pdf-bg`-Canvas dorthin verschoben,
  `#greg-pdf-nav` dorthin verschoben, neuer Toolbar-Knopf
  `#greg-pdf-panel-toggle` neben "PDF lesen".
- JS: `gregToggleOriginalPdf` neu; `gregRenderPDFPage`, `gregClearPDF`
  angepasst (kein min-height-Hack mehr, Panel-Steuerung); neue
  Ziehleisten-IIFE für `#greg-pdf-drag-handle`.
- Kommentar bei `gregRenderAllSections()` (Runde-64-Fund) aktualisiert:
  weist jetzt darauf hin, dass die Ursache seit Runde 65 an der Quelle
  entfernt ist, die dortige defensive Klausel aber bleibt.
- Build-ID 207→208.

## Offen

Echter Browser-Test durch den Nutzer steht aus (Panel-Optik, Resize-
Verhalten, automatisches Öffnen beim "PDF lesen").
