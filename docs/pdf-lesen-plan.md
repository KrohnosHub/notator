# «PDF lesen» – Analyse, Testset, Migrationsplan

Stand 12.11.2026, Build 398. Phase 1+2 von Teil B des Konzepts, ergänzt um
eine erste Messung (Abschnitt 5). Konzept:
«Notator: Orgel-Begleitsatz & PDF lesen». `index.html` wurde nicht geändert.
Zeilenangaben beziehen sich auf `index.html` in Build 398.

Kennzeichnung: **[Code]** = im Code gelesen · **[Doku]** = aus der
Claude-API-Referenz (Stand 03.11.2026) · **[Annahme]** = nicht gemessen.

## 1. Pipeline heute

| Schritt | Wo | Was |
| --- | --- | --- |
| 0 Text-PDF | 6396–6408 | Enthält das PDF GABC als Text, wird es direkt importiert, ohne KI. |
| 1 Rendern | 6444–6524 | Max. 6 Seiten, Zielbreite 2600/2200/1700 px (≤2 / ≤4 / >4 Seiten), JPEG 0.9. |
| 2 Systeme schneiden | 5071–5224, 5241 | Zeilen mit viel Tinte = Notenlinien; 4 Linien mit gleichem Abstand = System (3 von 4 genügen). Ausschnitt in **voller Seitenbreite**, Linien-Y je Ausschnitt gespeichert. Einzelne Linien = Rezitationston, wird nur gemeldet. |
| 3 Stücke erkennen (Step A) | 6537–6584 | 1 Aufruf mit allen Seitenbildern → JSON-Liste (Index, Modus, Incipit, Seiten, Systemzahl, Initiale). `max_tokens` 1500. |
| 4 Systeme zuteilen | 6598–6620 | Alle Ausschnitte in einer Liste; jedes Stück bekommt der Reihe nach so viele, wie Step A gezählt hat. |
| 5 Auswahl | 6622–6645 | Dialog: ein Stück, alle, oder zusammenfassen. |
| 6 GregoBase | 6694–6754 | Suche nach Incipit **vor** der Bilderkennung; Treffer nur nach Bestätigung, dann Import statt Lesen. |
| 7 Schlüssel | 7016–7115 | 1 Aufruf: zwei gerenderte Referenz-Schlüssel + vergrösserter Ausschnitt + erstes System → `CLEF: Do LINE 3`. `max_tokens` 300. Pixel-Messung nur noch Diagnose. |
| 8 GABC je System | 7136–7237, 5901–5963 | Batches zu 2 Systemen, je 3 Durchläufe (`VISION_EXTRACTION_REPEATS`). Prompt ca. 12 800 Zeichen. Je System gewinnt die Zeile mit der Median-Notenzahl. `max_tokens` 2000. |
| 9 Geometrie | 5796–5883, 5969–6000 | Notenköpfe per Template suchen; stimmt die Gesamtzahl mit der gelesenen überein, werden **alle** Tonhöhen des Systems aus den Y-Positionen neu berechnet. |
| 10 Zusammenbau | 7275–7378 | Schlüssel voranstellen, `(::)` anhängen, Initiale erzwingen, Warnung bei Wiederholungen, Sperre ab 200 Einträgen. |

Aufrufe je Stück: 1 (Step A, je PDF) + 1 (Schlüssel) + 3 × ⌈Systeme/2⌉.
Ein Stück mit 8 Systemen = 14 Aufrufe.

### Fehlerbehandlung

- HTTP-Fehler: Step A bricht mit «KI-Fehler <Status>» ab (6572); der Schlüssel
  fällt still auf Do/Linie 3 zurück (7016, 7115); ein Batch-Durchlauf wird
  verworfen und nur in der Konsole protokolliert (5917–5920).
- Kein Wiederholen bei 429/529, kein Timeout.
- `stop_reason` wird an keiner der drei Stellen gelesen.
- Scheitern alle 3 Durchläufe eines Batches, wird abgebrochen und nur der
  Anfang geladen (7217–7220, 7244–7246).

### Schwachstellen

Nach vermuteter Wirkung geordnet. Keine davon ist gemessen – dafür ist das
Testset da.

1. **Bild und Koordinaten passen vermutlich nicht zusammen.** Ausschnitte
   sind bis 2600 px breit (5242, 6457). Sonnet 4.6 verarbeitet Bilder bis
   1568 px Kantenlänge [Doku]; grössere werden verkleinert. Der Prompt nennt
   die Linien-Y aber in Originalpixeln (6791–6793). [Annahme: nicht
   nachgemessen; würde einen Teil der Lesefehler erklären.]
2. **Widerspruch im Prompt.** Bildtext: oberste Linie = LINE 4, unterste =
   LINE 1 (6793). Trennstrich-Regel: «topmost = line 1, bottom = line 4»
   (7185). Die ganze Trennstrich-Geometrie (7186–7189) zählt also andersherum
   als der Rest.
3. **Konsens zählt nur.** `pickConsensusLine` wählt nach Gesamt-Notenzahl
   (5943–5963). Über Tonhöhen, Silben, Trennstriche wird nicht abgestimmt. Bei
   2 Kandidaten gewinnt die grössere Zahl (Index `floor(2/2)`), bei Gleichstand
   die längere Zeile.
4. **Zuordnung nach Position.** Die Antwort wird zeilenweise gelesen, das
   Etikett «System N:» entfernt statt ausgewertet (5936). Lässt ein Durchlauf
   ein System aus, verrutschen alle folgenden: im Konsens (7229) und bei der
   Geometrie, die dann Zeile i gegen das Bild i+1 rechnet (7259–7261).
5. **Hinweiszeile wird als Notenzeile gelesen.** Der Prompt verlangt nach dem
   Marker eine kurze Zeile «piece ended early» (7193); der Parser nimmt jede
   Zeile nach dem Marker als System (5926–5927, 5936).
6. **Doppelte Ausgabe.** Das Modell soll die Zeilen schreiben, dann
   `===GABC===`, dann dieselben Zeilen nochmals (7196): doppelte Ausgabe-Tokens
   und zwei Fassungen, die sich unterscheiden können.
7. **Abgeschnittene Antworten bleiben unbemerkt.** Ohne `stop_reason` wird
   eine bei `max_tokens` abgeschnittene Zeile wie eine vollständige behandelt.
8. **Step A zählt Systeme, die es nicht gibt.** Der Prompt verlangt für
   Versikel eine eigene Systemzahl und nennt sie «normale 4-Linien-Notation»
   (6564); einzeilige Systeme werden aber nicht ausgeschnitten (6494–6498).
   Folgt danach ein weiteres Stück, verschiebt sich dessen Bereich (6609–6619).
9. **Schlüssel nur am ersten System.** Kein Schlüsselwechsel im Stück; jeder
   Fehler ergibt still `c3` (7016, 7092, 7115).
10. **Geometrie überschreibt alles oder nichts.** Bei passender Notenzahl
    werden alle Tonhöhen ersetzt, auch auf Sicherheitsstufe 2 (5869–5879).
    Virga-Doppeltreffer gegen echte Zwei-Noten-Neume bleibt ungelöst
    (5702–5720). `omrYToGabcLetter` kann `n` liefern (5394); GABC kennt a–m.
11. **Prompt für ein Modell ohne Denkphase.** Grosse Teile verbieten
    lautes Überlegen (7173–7175) und verlangen zugleich stille Prüfschritte
    (7183). Auf Modellen mit Denkphase überflüssig bis hinderlich [Doku].
12. Kleinigkeiten: Rückfall `mode: '?'` landet als `annotation: ?` im Stück
    (6583, 7296); `return;` ohne Wert (7347); irreführende Meldung «kein
    Marker» (7377); der Selbsttest (7488) prüft Import/Export, nicht die
    Erkennung.

## 2. Testset und Bewertung

Gebaut: `tests/pdf-lesen/` mit `evaluate.js`, Formatbeschreibung
(`README.md`) und Vorlage. Selbsttest: 20 Prüfungen bestanden
(`node tests/pdf-lesen/evaluate.js --selftest`).

- **Einheit ist das gedruckte System**: eine GABC-Zeile je System, Schlüssel
  und Stückdaten getrennt. So lassen sich Notenzahl, Tonhöhen, Gruppierung,
  Silben, Trennstriche je System und Schlüssel, Stückzahl, Systemzahl je Stück
  auswerten.
- **Zwei Tonhöhen-Masse**: ausgerichtet (eine fehlende Note kostet eine
  Stelle) und positionsgenau (verschiebt alles dahinter). Das zweite
  entspricht am ehesten den bekannten 46 %; die damalige Zählweise ist nicht
  dokumentiert.
- **Streuung**: Läufe einer Serie untereinander, ohne Blick auf das Soll.
- **Serie** = Modell + Aufwand + Pipeline-Variante; mehrere Läufe je Fall.

Noch offen:

- **Läufe erzeugen.** Die Bildvorbereitung (pdf.js, Systemschnitt) läuft nur
  im Browser. Zwei Wege, beide brauchen einen API-Key und Ihre Zustimmung:
  - (a) Export-Knopf in Notator, der Ausschnitte, Linien-Y und Rohzeilen je
    System als JSON speichert. Kleiner Eingriff in `index.html`, erst nach der
    Begleitsatz-Session.
  - (b) Playwright steuert Notator mit dem Scan und liest die Zwischenstände
    aus. Kein Eingriff in `index.html`, aber langsamer. Empfehlung für den
    ersten Messlauf.
- **Schlüsselwechsel im Stück** im Format (heute Formatfehler).
- **Scans**: siehe Fragen am Schluss.

Zusammensetzung wie im Konzept: 30–50 Systeme aus 10–15 Scans. Zusätzlich
nötig: mindestens 3 Stücke, die **nicht** in GregoBase stehen (sonst misst man
nur die Suche), und 2–3 Seiten mit mehreren Stücken (Stückgrenzen).

## 3. Migration auf ein aktuelles Modell

Alle Angaben [Doku]. Drei Aufrufstellen: 5907, 6537, 7056.

| | Sonnet 4.6 (heute) | Sonnet 5.5 | Opus 5.5 | Fable 5.2 |
| --- | --- | --- | --- | --- |
| Modell-ID | `claude-sonnet-4-6` | `claude-sonnet-5-5` | `claude-opus-5-5` | `claude-fable-5-2` |
| Preis Ein-/Ausgabe je Mio. Tokens | $3 / $15 | $2 / $10 | $4 / $20 | $8 / $40 |
| `temperature` | erlaubt | 400 bei Nicht-Standardwert | 400 | 400 |
| Denkphase | aus, wenn nicht gesetzt | immer an | immer an | immer an |
| Aufwand, Standard | – | `high` | `medium` | `high` empfohlen |
| Bild, max. Kantenlänge | 1568 px | 2576 px | 2576 px | 2576 px |
| Strukturierte Ausgabe | nicht aufgeführt | ja | ja | ja |

Pflicht (sonst Fehler oder stiller Schaden):

1. **`temperature` entfernen**, an allen drei Stellen. Wiederholbarkeit kommt
   danach nur noch aus Konsens und festen Vorgaben.
2. **`max_tokens` anheben.** Die Grenze gilt für Denkphase **und** Antwort
   zusammen. 300 (Schlüssel) und 1500 (Step A) würden die Antwort abschneiden.
   Richtwert ohne Streaming: 16 000.
3. **`stop_reason` prüfen**, bevor der Text gelesen wird:
   - `max_tokens` → Durchlauf ungültig, einmal mit höherer Grenze wiederholen.
   - `refusal` → HTTP 200 mit leerem oder halbem Inhalt; Durchlauf ungültig,
     Meldung an den Nutzer. Bei Choralscans unwahrscheinlich, aber möglich.
   - sonst `end_turn`.
4. **Bildbreite auf ≤ 2576 px** begrenzen (heute bis 2600) oder die Linien-Y
   mitskalieren. Damit entfällt Schwachstelle 1.
5. **Modell-ID und Aufwand als Konstanten** an einer Stelle statt dreimal.

Empfohlen:

6. **Strukturierte Ausgabe** über `output_config.format` (`json_schema`)
   statt Marker und Regex:
   - Step A: Liste der Stücke (ersetzt 6576–6579 und die String-Booleans, 6669).
   - Schlüssel: `{ "clef": "do"|"fa", "line": 1–4 }` (ersetzt 7087).
   - GABC: `{ "systems": [{ "number": n, "gabc": "…", "otherPiece": bool }] }`.
     Behebt Schwachstellen 4, 5, 6.
   - Schema-Grenzen: jedes Objekt braucht `additionalProperties: false`; kein
     `minimum`/`maximum`, also Linie als `enum`.
   - Auf Sonnet 4.6 nicht als unterstützt aufgeführt: der Vergleich «alt gegen
     neu» läuft für 4.6 mit dem heutigen Marker.
7. **Aufwand je Schritt** über `output_config.effort`, Startwerte für die
   Messung [Annahme]: Step A `low`, Schlüssel `low`, GABC `medium`, Nachlesen
   strittiger Systeme `high`. Opus 5.5 hat `medium` als Standard, also immer
   ausdrücklich setzen.
8. **Prompts entschlacken**: Verbote des lauten Überlegens, die
   Marker-Anweisung und die Wiederholung der Zeilen streichen; Widerspruch der
   Linien-Nummern beheben. Nur gegen das Testset, nicht nach Gefühl.
9. **Rückfall bei Ablehnung** (`fallbacks: "default"`, Beta-Header
   `server-side-fallback-2026-07-01`): von der Referenz als Standard
   empfohlen. Bei Sonnet 5.5 deckt er nur zwei Kategorien ab. Ob der
   Beta-Header beim Direktaufruf aus dem Browser funktioniert, ist ungeprüft.
10. **Prompt-Cache** für die 3 Durchläufe: Bilder und Prompt sind identisch,
    Durchlauf 2 und 3 könnten sie verbilligt lesen. [Annahme: Mindestgrösse
    und Wirkung nicht geprüft.]

Zu beachten:

- Die neuen Modelle zählen denselben Text als ca. 30 % mehr Tokens als
  Sonnet 4.6, und hochaufgelöste Bilder kosten bis ca. 3× mehr Bild-Tokens
  (bis ca. 4784 je Bild). Der tiefere Preis von Sonnet 5.5 kann dadurch
  aufgezehrt werden. Kosten je Seite werden im Testlauf gemessen, nicht
  geschätzt.
- Fable 5.2: einzelne Antworten können Minuten dauern; verlangt 30 Tage
  Datenaufbewahrung. Nur als Obergrenze im Vergleich.
- `anthropic-version: 2023-06-01` kann bleiben. Der Wechsel auf `2026-10-21`
  ist ein eigener Schritt und hier nicht untersucht.

Reihenfolge der Messung (jede Zeile = eine Serie, 3 Läufe je Fall):

1. Sonnet 4.6, Build 398 unverändert → Ausgangswert.
2. Sonnet 5.5, nur Pflichtänderungen 1–5.
3. Sonnet 5.5 mit strukturierter Ausgabe und entschlacktem Prompt.
4. Opus 5.5 und Fable 5.2 mit der Pipeline aus 3.
5. Bestes Modell mit den Pipeline-Varianten aus Abschnitt 4.

## 4. Pipeline-Ideen aus dem Konzept

| Idee | Urteil | Begründung |
| --- | --- | --- |
| Schlüssel geometrisch vorgeben | Nein | Die Pixelmessung war am Referenz-PDF sicher und falsch (7095–7108). Als Diagnose behalten. |
| Notenzahl geometrisch fest vorgeben | Nein, als Vorgabe | Virga-Doppeltreffer ist rein pixelbasiert ungelöst; laut Kommentar drei gescheiterte Ansätze (5885–5898). Eine falsche feste Zahl zwingt das Modell zu Fehlern. |
| Notenzahl als Bereich und Prüfstein | Ja, testen | Die Template-Suche liefert je Schwelle eine Rohzahl (5849–5858). Spanne als Hinweis mitgeben; weicht das Gelesene ab, System als strittig markieren. |
| Kandidaten-Liste statt freies Lesen | Testen, grösster möglicher Gewinn | Dem Modell die gefundenen Notenkopf-Positionen nummeriert geben; es entscheidet nur «echt oder Artefakt» und «welche Silbe». Tonhöhen kommen dann ganz aus der Geometrie. [Annahme, ungeprüft.] |
| Nur strittige Systeme neu lesen | Ja | 2 Durchläufe statt 3; der dritte nur bei Uneinigkeit, mit höherem Aufwand und den abweichenden Lesarten als Eingabe. Spart bis ein Drittel der Aufrufe. Uneinigkeit feiner messen als heute: Notenzahl je Silbe, nicht nur Gesamtzahl. |
| GregoBase: vergleichen statt lesen | Ja, höchster Nutzen | Der Import bei Treffer existiert schon (6694–6754). Neu wäre die Prüfung, ob der Treffer zur gescannten Ausgabe passt: Systemzahl und Notenzahl je System aus der Geometrie gegen das GregoBase-GABC. |

Grenzen:

- Übereinstimmende Durchläufe können gemeinsam falsch liegen. Das Testset
  zeigt, wie oft Einigkeit auch Richtigkeit bedeutet; davon hängt ab, ob
  «nur Strittiges nachlesen» trägt.
- GregoBase hilft nur beim Standard-Repertoire und hängt am Incipit aus
  Step A und am Proxy.

## 5. Erste Messung (12.11.2026)

Drei Fälle, 15 Systeme, je ein Pipeline-Lauf pro Modell. Jeder Lauf enthält
drei Einzeldurchläufe je System; daraus stammt die Streuung. Kosten gesamt
3.37 USD.

| | Sonnet 4.6, Build 398 | Sonnet 5.5, `medium` | Opus 5.5, `medium` |
| --- | --- | --- | --- |
| Tonhöhen je Stück (ohne Systemschnitt) | 36 % | 29 % | **72 %** |
| Tonhöhen je System, ausgerichtet | 30 % | 20 % | **59 %** |
| Notenzahl je System richtig | 7 % | 20 % | **47 %** |
| Neumen-Gruppierung | 67 % | 62 % | **86 %** |
| Silben | 55 % | 55 % | 65 % |
| Trennstriche | 14 % | 37 % | 64 % |
| Schlüssel | 1 von 3 | 3 von 3 | 3 von 3 |
| Systemzahl je Stück richtig | 2 von 4 | 3 von 4 | 3 von 4 |
| Streuung: Notenpositionen gleich | 42 % | 39 % | 62 % |
| Kosten für 3 Seiten | 0.74 USD | 0.45 USD | 2.08 USD |
| Dauer für 3 Seiten | 353 s | 105 s | 743 s |

Was die Messung zeigt:

- **Der Ausgangswert ist tief.** Sonnet 4.6 trifft rund ein Drittel der
  Tonhöhen. Die Streuung von 42 % bestätigt die bekannten ca. 46 %.
- **Sonnet 5.5 allein löst es nicht.** Mit unveränderter Pipeline liest es
  Schlüssel und Stückgrenzen richtig, die Tonhöhen aber nicht besser. Nur
  `medium` gemessen; `high` ist offen.
- **Opus 5.5 liest etwa doppelt so gut**, kostet aber knapp das Dreifache von
  Sonnet 4.6 und braucht doppelt so lange. 72 % reichen nicht für einen
  Import ohne Nacharbeit.
- **Der Systemschnitt ist eine eigene Fehlerquelle** (neu, in Abschnitt 1
  nicht erkannt). Bei 2 von 3 Scans schneidet `gregDetectStaffBands` falsch:
  - «Salve mater»: 8 Ausschnitte statt 7 Systeme. Drei enthalten nur
    Liedtext, die Systeme 6 und 7 fehlen ganz, und der Text jedes Systems
    landet im Ausschnitt des nächsten.
  - «Surrexit»: das erste Hymnus-System wird mitten durch die Notenlinien in
    zwei Ausschnitte geteilt.
  - Ursache vermutlich: Textzeilen zählen als «Linien» und verfälschen den
    geschätzten Linienabstand (5146–5153, 5200–5221). [Annahme]
- **Die geometrische Korrektur greift selten**: bei 4 bis 5 von 19 Ausschnitten
  je Serie, beim «Ave Maria» nie (kein brauchbares Notenkopf-Template).
- **Kein Lauf brach technisch ab**: überall `end_turn`, Marker immer vorhanden.
  In 1 bis 3 Batches je Serie stimmte aber die Zeilenzahl nicht mit der Zahl
  der Systeme überein (Schwachstelle 4).
- **Sonnet 4.6 erzählt trotz Verbot** («I'll analyze each system carefully…»)
  und verbraucht dafür Ausgabe-Tokens.

Folgerung für die Reihenfolge: zuerst den Systemschnitt reparieren, dann die
Eingabe für das Lesen verbessern (Hilfslinien oder Kandidaten-Liste,
Abschnitt 4), erst danach das Modell festlegen. Ein Modellwechsel allein
bringt mit der heutigen Pipeline wenig.

Grenzen dieser Messung:

- 15 Systeme sind wenig; Unterschiede von wenigen Prozentpunkten sagen nichts.
- Das Soll stammt aus Ihren Notator-Dateien (GregoBase-Fassungen), von mir
  auf die gedruckten Systeme verteilt und nur stichprobenweise gegen den Scan
  geprüft. Trennstriche bei «Salve mater» sind unsicher.
- GregoBase war im Test abgeschaltet. Alle drei Stücke stehen dort; im echten
  Gebrauch wären sie importiert statt gelesen worden.
- Fable 5.2 wurde aus Kostengründen nicht gemessen.
- Pflichtänderung 4 (Bildbreite) war hier ohne Wirkung: die Ausschnitte sind
  1833 px breit. Für Sonnet 4.6 werden sie auf 1568 px verkleinert
  (Faktor 0.86); die im Prompt genannten Pixelzeilen stimmen dort also nicht.

## Offene Fragen

1. Soll-GABC der drei Fälle prüfen (`tests/pdf-lesen/cases/*/expected.json`).
2. Weitere Fälle: Fa-Schlüssel, Schlüsselwechsel, Mehrseiter und Stücke
   ausserhalb GregoBase fehlen noch.
3. Dürfen die Scans ins Repo? Bisher liegen sie nur lokal.
4. Nächster Schritt: Systemschnitt reparieren (Eingriff in `index.html`, nach
   der Begleitsatz-Session) oder zuerst die Lese-Varianten ausserhalb von
   Notator testen?
