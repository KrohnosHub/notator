# Testset «PDF lesen»

Misst, wie gut Notator Quadratnoten-Scans in GABC umsetzt. Stand 15.11.2026:
5 Fälle mit 28 Systemen. Ergebnisse: `docs/pdf-lesen-plan.md`,
Abschnitt 5.

```
tests/pdf-lesen/
  evaluate.js              Vergleich + Streuung (Node ≥ 18, keine Abhängigkeiten)
  lesetest/                Lesetest ausserhalb von Notator (Schnitt, Lineale, Aufruf je System)
  geometrie/               Tonhöhen aus dem Bild messen, ohne KI (Prototyp, Python + numpy + Pillow + pdftoppm)
  run-playwright.js        Messlauf: steuert das unveränderte Notator, ruft die API auf
  cases/<fall>/scan.pdf    der Scan – liegt nur lokal, nicht im Repo (.gitignore)
  cases/<fall>/expected.json   erwartetes Ergebnis, von Hand geprüft
  cases/_vorlage/          Vorlage für expected.json (wird nicht ausgewertet)
  runs/<serie>/<fall>/run-01.json   erkanntes Ergebnis, ein Lauf je Datei
  runs/<serie>/_log-<fall>.json     Protokoll der API-Aufrufe (ohne Bilder)
```

## Aufruf

```
node tests/pdf-lesen/evaluate.js              # alle Fälle, alle Serien
node tests/pdf-lesen/evaluate.js --runs tests/pdf-lesen/runs/<serie>
node tests/pdf-lesen/evaluate.js --json bericht.json
node tests/pdf-lesen/evaluate.js --selftest   # prüft die Metriken selbst
```

`evaluate.js` ruft keine API auf. Ohne Läufe prüft es nur das Format des Testsets.

## Geometrischer Weg (kostenlos, nur Tonhöhen)

```
python3 tests/pdf-lesen/geometrie/geom.py [--series geom-v3] [--debug --work /pfad]
GEOM_OCR=0 python3 tests/pdf-lesen/geometrie/geom.py --series geom-v2   # ohne Texterkennung
GEOM_FULL=0 python3 tests/pdf-lesen/geometrie/geom.py --series geom-v1   # nur Tonhöhen
python3 tests/pdf-lesen/geometrie/diff.py geom-v2     # Soll/Ist je System nebeneinander
```

Misst Notenköpfe im Scan und leitet die Tonbuchstaben aus der Lage zu den vier
Linien ab; dazu Schlüssel, Trennstriche und ein Silbenraster (Wortgrenzen) aus
der Textzeile. Den Text liest Tesseract (`tesseract` mit Sprachpaket `lat`
muss installiert sein, z. B. `apt-get install tesseract-ocr tesseract-ocr-lat`);
fehlt es, sind die Silben Platzhalter (`x`). Keine API-Aufrufe. Die Aufteilung der Systeme auf Stücke übernimmt das Skript aus
`expected.json`. `--debug` schreibt je System ein Bild mit den Funden.
Ergebnisse: `docs/pdf-lesen-plan.md`, Abschnitte 7 bis 7.3.

### Text mit KI (kostenpflichtig, ca. 0.01 USD pro Seite)

```
GEOM_TEXT=dry  python3 tests/pdf-lesen/geometrie/geom.py --series tmp      # nur Bild + Kostenschätzung
GEOM_TEXT=mock python3 tests/pdf-lesen/geometrie/geom.py --series tmp      # Soll-Text statt KI (misst die Zuordnung)
NOTATOR_API_KEY=… GEOM_TEXT=ki python3 tests/pdf-lesen/geometrie/geom.py --series ki-s55-low --work /pfad
```

- Braucht `pip install anthropic`. Modell und Aufwand: `GEOM_KI_MODEL`
  (Standard `claude-sonnet-5-5`), `GEOM_KI_EFFORT` (Standard `low`).
- `GEOM_TEXT=cache` rechnet mit den gespeicherten Antworten aus `--work` neu (keine Kosten).
- Bild: `GEOM_KI_BOTTOM` (unterer Rand, Standard 1.6 Linienabstände), `GEOM_KI_SPLIT=0`
  (lange Zeilen nicht teilen), `GEOM_KI_LINE_H` (Zeilenhöhe, Standard 64 px).
- `--run N` schreibt `run-0N.json` (Wiederholungsläufe für die Streuung).
- `--work` erhält je Seite das gesendete Bild (`ki-<fall>.png`) und die
  Antwort (`ki-<fall>.json`).
- In der Cloud-Umgebung: Key als Umgebungsvariable `NOTATOR_API_KEY` in den
  Umgebungs-Einstellungen hinterlegen (nicht ins Repo). `ANTHROPIC_API_KEY`
  kommt dort leer an; das Skript liest ihn nur noch als Ersatz. Die Umgebung «notator»
  installiert Tesseract und das SDK beim Start.

## Messlauf (kostenpflichtig)

```
ANTHROPIC_API_KEY=… node tests/pdf-lesen/run-playwright.js \
    --case ave-maria-1 --series s55-medium \
    --model claude-sonnet-5-5 --effort medium \
    --max-usd 1.5 --ledger /pfad/kosten.json
```

- Braucht Playwright mit Chromium. Der Scan muss als `cases/<fall>/scan.pdf`
  lokal vorliegen.
- Ohne `--model` gehen die Aufrufe unverändert durch (Build wie er ist). Mit
  `--model` werden sie unterwegs umgeschrieben: Modell ersetzt, `temperature`
  entfernt, `max_tokens` 16000, `effort` gesetzt. `index.html` bleibt unberührt.
- GregoBase wird übersprungen, bei mehreren Stücken werden alle gelesen.
- `--max-usd` mit `--ledger` ist die Kostenbremse über mehrere Aufrufe hinweg.
- Ein Lauf schreibt drei Serien: `<serie>` (Endergebnis), `<serie>-vor-geometrie`
  (Konsens vor der Tonhöhen-Korrektur) und `<serie>-roh` (die 3 einzelnen
  Durchläufe als Wiederholungsläufe, daraus die Streuung).
- Der API-Key gehört in die Umgebung, nie in eine Datei im Repo.

## Erwartetes Ergebnis (`expected.json`)

Vorlage: `cases/_vorlage/expected.json`. Pflicht je Stück: `incipit`, `clef`
(`c1`–`c4`, `f1`–`f4`, `cb3` …) und `systems`.

- `systems`: **eine GABC-Zeile je gedrucktem Notensystem**, in Lesereihenfolge.
  Der Zeilenumbruch des Drucks ist die Einheit, an der gemessen wird.
- Schlüssel steht im Feld `clef`, nicht in der Zeile. Wechselt der Schlüssel im
  Stück, bleibt der neue Schlüssel als `(c3)` an seiner Stelle in der Zeile; das
  meldet das Skript vorerst als Formatfehler (offener Punkt, siehe Plan).
- Silben eines Worts ohne Leerzeichen (`Ký(fg)ri(g)e(f.)`), Wörter mit
  Leerzeichen, Akzente wie gedruckt.
- Trennstriche als eigene Klammer: `(,)` `(;)` `(:)` `(::)`.
- Custos am Zeilenende weglassen oder als `(z0)` / `(j+)` – zählt nicht als Note.
- `mode`: wie gedruckt (`II` und `2` gelten als gleich), leer wenn keiner
  gedruckt ist.
- Stück ohne Soll-GABC: statt `systems` nur `systemCount` angeben; geprüft
  werden dann Stückgrenze und Systemzahl.
- `checkedBy` / `checkedOn`: wer das GABC gegen den Scan geprüft hat. GABC aus
  GregoBase stammt oft aus einer anderen Ausgabe – nie ungeprüft übernehmen.

## Lauf (`run-NN.json`)

Gleicher Aufbau wie `expected.json`, nur das Erkannte, plus Angaben zum Lauf:

```json
{
  "model": "claude-sonnet-5-5",
  "effort": "medium",
  "pipeline": "Build 398 + Beschreibung der Variante",
  "pieces": [{ "incipit": "…", "mode": "2", "clef": "c4", "hasDropCap": true, "systems": ["…", "…"] }],
  "usage": { "input_tokens": 0, "output_tokens": 0, "costUsd": 0 },
  "durationMs": 0
}
```

Wichtig: `systems` enthält die Zeilen **vor** dem Zusammenfügen zum Stück, ein
Eintrag je System. Fehlt ein System, bleibt sein Platz als leerer String `""`.
Eine Serie (`runs/<serie>/`) = eine Kombination aus Modell, Aufwand und
Pipeline-Variante; mehrere Dateien je Fall = Wiederholungsläufe.

## Messgrössen

| Messgrösse | Bedeutung |
| --- | --- |
| Notenzahl je System | Anteil Systeme mit exakt richtiger Gesamtzahl Noten |
| Tonhöhen-Treffer (ausgerichtet) | 1 − Editierdistanz/Länge der Tonhöhenfolge; eine fehlende Note kostet genau eine Stelle |
| Tonhöhen je Stück | alle Systeme eines Stücks als eine Folge; unabhängig davon, wie die Seite geschnitten wurde |
| Tonhöhen positionsgenau | gleiche Tonhöhe an gleicher Stelle; eine fehlende Note verschiebt alles dahinter |
| Neumen-Gruppierung | Folge «Noten je Silbe», ausgerichtet; «exakt» = ganze Folge stimmt |
| Silben | Silbentext mit Akzenten; daneben ohne Akzente und Satzzeichen |
| Wortgrenzen | wo ein neues Wort beginnt |
| Trennstriche | Folge der Trennstriche inkl. Typ |
| Schlüssel | Feld `clef` je Stück, exakt |
| Stückgrenzen | Anzahl Stücke je Scan und Systemzahl je Stück |
| Streuung | Läufe einer Serie untereinander verglichen, ohne Blick auf das Soll |

Die bekannte Zahl «46 % Übereinstimmung zwischen zwei Läufen» entspricht am
ehesten «Notenpositionen gleich» in der Streuung. Wie sie damals genau gezählt
wurde, ist im Code nicht dokumentiert.

Nicht gemessen (noch): Tonhöhe von Vorzeichen, Neumenformen (Quilisma,
Liqueszenz, Episem), Mora-Punkte je Note (nur Gesamtzahl je System).

## Scans

Keine Scans ohne geklärte Rechte ins Repo. Das Repo ist vermutlich öffentlich
(GitHub Pages, nicht geprüft); Alternative ist ein privater Ordner, der lokal nach `cases/` kopiert
wird.
