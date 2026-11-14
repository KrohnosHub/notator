# Tests

```
node tests/begleitsatz.test.js            # prüfen (Exit 1 bei Fehler)
node tests/begleitsatz.test.js --verbose  # Akkordfolge und jeden Befund zeigen
node tests/begleitsatz.test.js --update   # Schnappschuss tests/begleitsatz-golden.json neu schreiben
node tests/begleitsatz.test.js --strict   # auch Befunde zählen als Fehler
```

Keine Abhängigkeiten (nur Node). Der Begleitsatz-Code wird unverändert aus
`index.html` geladen (von `const CL_LETTERS` bis vor `4. Rendern mit abcjs`).

- **FEHLER**: Invarianten des heutigen Codes (Dreiklang, Melodieton im Akkord,
  Stimmkreuzung, Abstände, Ambitus, Schlussakkord auf der Finalis, Vorgaben
  samt `legacyKeys`) und Abweichung vom Schnappschuss.
- **BEFUND**: Regelverstösse, die heute nur über Kosten oder gar nicht
  vermieden werden (Parallelen, Querstand, Stimmüberschneidung, Griffweite,
  Sprünge). Die Anzahl je Stück steht im Schnappschuss; mehr als dort = Fehler.

Nach einer **gewollten** Änderung am Harmonisierer: `--verbose` ansehen, dann
`--update` und `begleitsatz-golden.json` mit committen.

`begleitsatz-fixtures.js` enthält vorerst nur selbst geschriebene Übungsmelodien, keine
echten Gesänge. Regelwerk und offene Entscheide: `docs/begleitsatz-regelwerk.md`.
