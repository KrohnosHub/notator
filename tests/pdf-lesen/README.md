# Testset «PDF lesen»

Misst, wie gut Notator Quadratnoten-Scans in GABC umsetzt. Stand: Gerüst –
**noch keine Scans, noch keine Läufe**.

```
tests/pdf-lesen/
  evaluate.js              Vergleich + Streuung (Node ≥ 18, keine Abhängigkeiten)
  cases/<fall>/scan.pdf    der Scan (oder scan-1.png, scan-2.png …)
  cases/<fall>/expected.json   erwartetes Ergebnis, von Hand geprüft
  cases/_vorlage/          Vorlage für expected.json (wird nicht ausgewertet)
  runs/<serie>/<fall>/run-01.json   erkanntes Ergebnis, ein Lauf je Datei
```

## Aufruf

```
node tests/pdf-lesen/evaluate.js              # alle Fälle, alle Serien
node tests/pdf-lesen/evaluate.js --runs tests/pdf-lesen/runs/<serie>
node tests/pdf-lesen/evaluate.js --json bericht.json
node tests/pdf-lesen/evaluate.js --selftest   # prüft die Metriken selbst
```

Das Skript ruft keine API auf. Ohne Läufe prüft es nur das Format des Testsets.

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
