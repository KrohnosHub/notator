# Bildvergleichstest (Vorschau)

Rendert die GABC-Stücke in `cases/` im Notator (lokal, ohne Netz) und vergleicht
das Notenblatt Pixel für Pixel mit den Referenzbildern in `baseline/`.

    node tests/visual/run.js           # vergleichen, Exitcode 1 bei Abweichung
    node tests/visual/run.js --update  # Referenzbilder neu schreiben (nach gewollter Änderung)

Bei Abweichung: `tests/visual/diff/bericht.html` (Referenz | Neu | Unterschied in Rot).
Neuer Testfall: `.gabc`-Datei in `cases/` ablegen, einmal mit `--update` laufen lassen.
Nur Playwright nötig. Referenzbilder sind an Chromium und die Schriften der Maschine
gebunden (in CI immer dieselbe Umgebung verwenden).
