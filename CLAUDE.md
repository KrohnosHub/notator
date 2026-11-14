# Notator – Hinweise für Claude

Notenprogramm für gregorianische Noten (PWA, GitHub Pages: https://krohnoshub.github.io/notator/).
Stand und Änderungsübersicht: `NOTES.md`, Details im Git-Log.

## Kommunikation
- Deutsch (Schweizer Schreibweise: «ss» statt «ß»), kurz und konkret. Unsicherheiten offen benennen.
- Vor grösseren Umbauten Vorgehen kurz vorschlagen und bestätigen lassen.

## Code liegt in src/ – index.html wird gebaut
- **Nie `index.html` direkt bearbeiten.** `python3 build.py` erzeugt sie aus `src/`; `python3 build.py --check` prüft.
- `src/shell.html` ist das Gerüst (Kopf, Meta, Skript-Tags). Jede Zeile `@@include PFAD@@` wird durch die Datei bzw. alle Dateien eines Ordners (nach Name sortiert) ersetzt – unverändert, ohne weitere Verarbeitung. Alle Skripte teilen sich weiterhin einen globalen Gültigkeitsbereich (klassische Skripte, keine Module).
- Aufbau:
  - `src/css/` – Stylesheets
  - `src/body.html` – HTML-Gerüst der Oberfläche
  - `src/js/1-start/` – gemeinsame Hilfsfunktionen (Dialog, Skript-Nachladen)
  - `src/js/2-choral/` – Choral-Editor, Import/Export, PDF-Erkennung, Bibliothek, Google Drive
  - `src/vendor/exsurge.js` – Notensatz-Bibliothek (nicht anfassen, ausser bewusst)
  - `src/js/3-orgel-und-mehr/` – Orgelfassung, Wiedergabe, Mappe, Strophen, Teilen, Renderer
- Neue Datei: im passenden Ordner mit Nummer einsortieren (z. B. `145-…js` zwischen 140 und 150); die Reihenfolge ist die Ausführungsreihenfolge.
- Wurde `index.html` doch direkt geändert (z. B. ein älterer Branch): `python3 tools/split.py` überträgt die Änderungen zurück nach `src/` (prüft Byte-Gleichheit).
- `shared/gd-core.js` (Google-Anmeldung, Token, Drive-Fehler) ist die Quelle auch für den Schola-Planer. Nur dort ändern, dann `python3 tools/gd-core-sync.py` (schreibt den Block in `src/js/2-choral/230-google-drive-ablage.js` und baut). Danach die Datei in den Schola-Planer kopieren (`src/gd-core.js`). Token-Schlüssel und Meldungstexte («abgelaufen», «Nicht bei Google», «Drive-Fehler <Status>») werden in beiden Apps ausgewertet.

## Jede Änderung = neuer Build (Vorsicht, main wird parallel weiterentwickelt)
1. **Vorher `git fetch origin main`** und auf dem neuesten Stand aufsetzen.
2. `NOTATOR_BUILD_ID` erhöhen (`src/js/2-choral/190-autosave.js`) **und** `CACHE` in `sw.js` (`notator-vNNN`) – beide höher als auf `origin/main`, nie doppelt.
3. `python3 build.py` (bei geänderten `data-on…`-Attributen vorher `python3 tools/handlers.py`)
4. Tests: `node tests/gd-core.test.js`, `node tests/begleitsatz.test.js` (Orgel-Begleitsatz; nach gewollter Änderung der Harmonisierung `--update`), `node tests/visual/run.js` (Bildvergleich des Notenbilds; nach gewollter Darstellungsänderung `--update`).
5. `python3 tools/check-version.py` prüft Build-Nummer und Cache gegen `origin/main`.
6. Kurz vor dem Mergen nochmals gegen den neuesten `main` prüfen; bei Kollision Nummern neu vergeben.
7. Commit-Titel: `Build NNN: Kurzbeschreibung`. Updates über Pull Requests.
Die GitHub Action «Tests» prüft bei jedem PR: Build aktuell, gd-core, Build-Nummer/Cache höher als auf dem Ziel-Branch, Bildvergleich gegen den Ziel-Branch (nur Hinweis, gewollte Änderungen erlaubt).

## Sicherheit
- Texte aus Links (`#n=`, `#song=`), Drive, GregoBase, PDFs sind fremde Daten: nie ungefiltert per `innerHTML` einsetzen. `showModal(title, body)` setzt `body` als Text; für Attribute `ntEscAttr` verwenden.
- Das Google-Token hat Vollzugriff auf Drive (`auth/drive`, nötig für das Konzept) und liegt im localStorage von `krohnoshub.github.io`, gemeinsam mit Schola-Planer und Gesangs-App: Script-Injection in einer dieser Apps gefährdet das ganze Drive.
- PDF.js nur mit `isEvalSupported: false` verwenden.
- **Content-Security-Policy** (Meta-Tag in `src/shell.html`): Inline-Skripte nur per Hash – `build.py` setzt die Hashes automatisch. Neue externe Hosts (Skripte, APIs, Bilder) bewusst in der passenden Direktive ergänzen, sonst blockiert der Browser sie (Konsole: «Refused to …»).
- **Keine Inline-Handler** (`onclick="…"`): In `src/body.html` stattdessen `data-onclick="…"` (bzw. `data-oninput` …) schreiben und `python3 tools/handlers.py` ausführen – das erzeugt `src/js/1-start/005-handler.js` (nicht von Hand ändern). In HTML-Strings im JS: Element nach dem Einsetzen per `el.onclick = …`/`addEventListener` verbinden.
- Kein `eval`, kein `new Function`, keine Strings in `setTimeout` (CSP).
