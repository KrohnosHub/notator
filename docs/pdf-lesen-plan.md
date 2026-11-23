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

## 6. Lesetest ausserhalb von Notator (14./15.11.2026)

Frage: Erreicht Sonnet 5.5 mit sauber geschnittenen Systemen über 80 %
Tonhöhen bei höchstens 0.15 USD pro Seite? Dieselben 15 Systeme, ein Aufruf
je System, kurzer Prompt, strukturierte Ausgabe. Kosten gesamt 0.96 USD.
Skripte: `tests/pdf-lesen/lesetest/`.

| Variante | Tonhöhen je Stück | Silben | Trennstriche | Kosten pro Seite |
| --- | --- | --- | --- | --- |
| Sauberer Ausschnitt, `medium` | 41 % | 81 % | 50 % | 0.02 USD |
| Mit Linealen, `medium` | 61 % | 80 % | 43 % | 0.02 USD |
| Sauberer Ausschnitt, `high` | 67 % | 87 % | 64 % | 0.05 USD |
| Mit Linealen, `high` | 74 % | 84 % | 42 % | 0.07 USD |
| Mit Linealen, Schlüssel ausgeblendet, `high` | 74 % | 78 % | 42 % | 0.06 USD |
| Mit Linealen, Schlüssel ausgeblendet, Opus 5.5 `low` | 71 % | 80 % | 64 % | 0.05 USD |

«Lineale»: Ausschnitt vergrössert, gelbe Spalten mit den Tonbuchstaben a–m
zwischen den Notengruppen, feine Hilfslinien in den Zwischenräumen.

Je Stück (Tonhöhen, beste Sonnet-Variante): Salve mater 92 %, Ave Maria 70 %,
Surrexit 63 %.

Befund:

- **Kosten sind kein Problem mehr**: 0.02–0.07 USD pro Seite statt 0.15–0.69.
- **Die 80 % werden im Schnitt knapp verfehlt** (74–77 %) und hängen stark
  vom Druck ab: einfacher syllabischer Satz in klarem Druck über 90 %,
  zusammengesetzte Neumen, Vorzeichen oder schwacher Druck 60–70 %.
- Sauberer Schnitt und `high` bringen am meisten (29 % → 67 %), Lineale
  zusätzlich rund 7 Punkte. Das Ausblenden des Schlüssels bringt nichts.
- Die Notenzahl stimmt nur in 7–27 % der Systeme exakt: fast jedes System
  enthält mindestens eine zusätzliche oder fehlende Note.
- Einzelläufe schwanken: dieselbe Variante lag beim «Ave Maria» einmal bei
  67 %, einmal bei 40 %.

Nach der vereinbarten Regel (über 80 % bei höchstens 0.15 USD) ist das Ziel
nicht erreicht. Offen bleibt der rein geometrische Weg für die Tonhöhen
(Abschnitt 4), der keine API-Kosten hat, aber eigene Entwicklungsarbeit ist.

## 7. Geometrischer Weg: Tonhöhen aus dem Bild messen (15.11.2026)

Frage: Lassen sich die Tonhöhen ohne KI direkt aus dem Scan messen? Prototyp
`tests/pdf-lesen/geometrie/geom.py` (Python, numpy, Pillow, pdftoppm), Serie
`runs/geom-v1`. Dieselben 15 Systeme, keine API-Aufrufe, rund 3 s je Seite.

Ablauf: Seite mit 300 dpi rendern, Notenlinien und Schräglage wie im Lesetest
bestimmen (`lesetest/cut.py`), Linienlage je System lokal nachführen, alles
wegfiltern, was dünner ist als ein Notenkopf (Linien, Hälse, Trennstriche,
die meisten Vorzeichen und Punkte), verbleibende Tintenflecken als Notenköpfe
werten und aus ihrer Höhe den Buchstaben ableiten. Übereinander stehende
Noten (Podatus) und Schrägbalken (Porrectus) werden aus der Form des Flecks
zerlegt. Ausgeschlossen werden die Schlüsselzone am Zeilenanfang, der Custos
am Zeilenende und Textzeilen ober- und unterhalb.

| | Ave Maria | Salve mater | Surrexit | Gesamt |
| --- | --- | --- | --- | --- |
| Tonhöhen je Stück | 99 % | 92 % | 95 % | **95 %** |
| Notenzahl je System richtig | 3 von 4 | 3 von 7 | 1 von 4 | 47 % |
| Fehler (fehlend, zusätzlich, falsch) | 1 von 88 Noten | 8 von 97 | 5 von 93 | 14 von 278 |

Zum Vergleich: beste KI-Variante im Lesetest 74 %, Opus 5.5 in der
Notator-Pipeline 72 %. «Tonhöhen ausgerichtet» je System: 94 %.

Typische Fehlerbilder (alle 14 Fehler):

- **Fehlende Note** (8): am Zeilenende in der Custos-Zone abgeschnitten
  («Surrexit», System 1, im Bild geprüft); übrige Fälle nicht einzeln
  geprüft, vermutlich blass oder hohl gedruckte Notenköpfe und Noten nahe am
  Schlüssel. [Annahme]
- **Zusätzliche Note** (6): Rest eines b-Vorzeichens als Note gelesen
  («Surrexit», System 3) und kleine Flecken über den Linien («Salve mater»,
  System 1), beides im Bild geprüft; die übrigen nicht einzeln geprüft.
- **Falsche Höhe** (0).
- Nie aufgetreten: eine ganze Folge um eine Stufe verschoben. Wo ein
  Notenkopf gefunden wird, stimmt seine Höhe fast immer.

Einschätzung:

- **Über 80 % scheinen erreichbar**, bei 0 USD für die Tonhöhen. Das ist der
  erste Weg, der das Ziel klar erfüllt.
- **Die 95 % sind zu günstig gemessen** (Nachtrag: die Gegenprobe in 7.1
  bestätigt den Wert). Die Stellgrössen (Tintenschwelle,
  Mindestgrösse, Breite der Schlüsselzone) wurden an denselben 15 Systemen
  eingestellt, an denen gemessen wird. Auf neuen Scans ist weniger zu
  erwarten; wie viel weniger, ist nicht gemessen.
- **Empfindlich auf die Tintenschwelle:** mit fester Schwelle 150 statt der
  automatisch bestimmten (rund 200) fällt der Wert auf 83 %, weil hohl
  gedruckte Notenköpfe zerfallen. Gegen die Auflösung ist das Ergebnis stabil
  (200 bis 400 dpi: 94–96 %).
- **Die drei Fälle sind einfach:** fast nur Einzelnoten, Podatus, Clivis,
  Climacus. Kein Porrectus (Schrägbalken-Code ungetestet), kein Quilisma,
  keine Liqueszenzen, kein Fa-Schlüssel, kein Schlüsselwechsel. Für
  melismatische Stücke (Gradualien, Alleluia) gilt die Zahl nicht.
- **Nicht gelöst und nicht gemessen:** Text, Silbenzuordnung, Schlüssel,
  Trennstriche, Mora-Punkte, Vorzeichen als solche, Stückgrenzen. Die
  Aufteilung der Systeme auf Stücke stammt hier aus dem Soll. Die
  Platzhalter-Gruppierung nach Abständen trifft die Neumen-Gruppen zu 93 %
  (ganze Zeile exakt: 40 %); das hilft später beim Zuordnen der Silben.
- Das Soll ist weiterhin nur grob bestätigt. Einzelne «Fehler» können Fehler
  im Soll sein; geprüft habe ich das nicht.

Vorschlag für den nächsten Schritt: zuerst 3 bis 5 weitere Scans messen, ohne
am Prototyp zu drehen (darunter ein melismatisches Stück und ein
Fa-Schlüssel). Hält der Wert über 85 %, die Tonhöhen geometrisch bestimmen
und die KI nur noch Text, Schlüssel und Trennstriche lesen lassen, mit der
gemessenen Notenfolge als Vorgabe im Prompt.

### 7.1 Gegenprobe auf neuen Scans (15.11.2026)

Zwei weitere Scans aus dem Drive, gemessen mit dem **unveränderten** Prototyp
(Stand Abschnitt 7, keine Stellgrösse angefasst). Beide sind anspruchsvoller
als die ersten drei: Quilisma, Liqueszenzen, Climacus, längere Melismen.

| | Systeme | Noten | Tonhöhen je Stück | Fehler |
| --- | --- | --- | --- | --- |
| Gaudeamus omnes (Introitus Allerheiligen) | 8 | 190 | 96 % | 9 |
| Salve Regina 1 (SR 480, feierlich) | 9 | 231 | 97 % | 7 |
| alle fünf Fälle | 28 | 699 | **96 %** | 30 |

Damit ist der wichtigste Vorbehalt aus Abschnitt 7 entkräftet: der Wert hält
auf Scans, an denen nichts eingestellt wurde. Die Fehler sind dieselben wie
zuvor (einzelne fehlende oder zusätzliche Noten, keine falschen Höhen in
Folge). «Notenzahl je System exakt richtig» bleibt bei 47 %: im Schnitt eine
Korrektur je System.

Einschränkungen: Das Soll stammt aus Ihren Notator-Dateien (GregoBase), die
Systemgrenzen habe ich nach den Textanfängen im Scan gesetzt, nichts davon
ist Note für Note geprüft. Beim «Gaudeamus» weichen die letzten zwei Systeme
(Schluss des Gloria Patri, zwei «E u o u a e») von der Vorlage ab und sind
nicht gewertet. Vier weitere geholte Scans blieben aussen vor: zwei sind
Orgelsatz in moderner Notation («Jesu dulcis memoria», «Regina caeli SR 479»),
zu zweien («Adoremus in aeternum», «Pueri Hebraeorum») fand ich keine
Notator-Datei als Soll. Weiterhin fehlen Fa-Schlüssel, Schlüsselwechsel und
Mehrseiter.

### 7.2 Schlüssel, Trennstriche, Silbenraster (15.11.2026)

Serie `runs/geom-v2`, weiterhin ohne API. Die Tonhöhen sind gegenüber
`geom-v1` unverändert. Anders als 7.1 wurden diese Teile an allen fünf Fällen
entwickelt; es gibt dafür keine Gegenprobe.

| Messgrösse | geom-v1 | geom-v2 | Wie |
| --- | --- | --- | --- |
| Schlüssel | – | 5 von 5 | Lage der Tintenflecken am Zeilenanfang, Mehrheit über die Systeme |
| Trennstriche | – | 76 % (Strichfolge exakt in 18 von 32 Systemen) | senkrechte dünne Striche, die an keinem Notenkopf hängen; Typ aus der Länge |
| Wortgrenzen | 49 % | 73 % | Tintengruppen der ersten Textzeile; Trennstrich am Gruppenende = Wort geht weiter |
| Neumen-Gruppierung | 81 % | 81 % | Lücke zwischen Noten oder neue Textgruppe darunter |

- **Schlüssel:** alle fünf Fälle sind Do-Schlüssel auf der vierten Linie. Die
  Unterscheidung Do/Fa (über die Breite) ist eingebaut, aber ungetestet.
  Schlüsselwechsel und b im Schlüssel werden nicht erkannt.
- **Trennstriche:** Hauptfehler sind verwechselte Typen (ganzer Strich als
  halber gelesen, Doppelstrich als einfacher) und einzelne übersehene oder
  zusätzliche Viertelstriche. «Salve mater» zieht den Schnitt (43 %); dort
  ist auch das Soll unsicher.
- **Silbenraster:** Silben, die im Druck ohne Lücke stehen («festum»), lassen
  sich aus dem Bild allein nicht trennen. Dafür braucht es den gelesenen Text.
- **Nicht umgesetzt:** Mora-Punkte, Vorzeichen als solche (sie werden nur
  ausgefiltert), Episeme, Neumenformen, Stückgrenzen.

**Text:** bleibt offen. Ohne Texterkennung geht es nicht, und beide Wege
waren in dieser Sitzung gesperrt: Die lokale Installation von Tesseract (OCR,
kostenlos) wurde von der Umgebung abgelehnt, ein API-Key liegt nicht vor.
Der geometrische Teil liefert aber bereits, was ein Textleser braucht: die
Textzeile je System als schmalen Ausschnitt und die Zahl der Notengruppen
darüber. Vorschlag: entweder Tesseract mit lateinischem Sprachpaket freigeben
(0 USD) oder ein KI-Aufruf je Seite nur für die Textzeilen (geschätzt unter
0.02 USD pro Seite, nicht gemessen). [Annahme]

### 7.3 Text mit Tesseract (15.11.2026)

Serie `runs/geom-v3`: wie `geom-v2`, dazu liest Tesseract 5.3 (Sprachpaket
`lat`, lokal, 0 USD) die erste Textzeile unter jedem System
(`geometrie/ocr.py`). Ablauf: Textzeile suchen und ausschneiden, lesen,
Wörter an den gedruckten Trennstrichen und mit einer einfachen lateinischen
Silbentrennung in Silben teilen, Initiale separat lesen, dann die
Notengruppen per dynamischer Programmierung den Silben zuordnen (Lage unter
der Silbe, Strafe für Silben ohne Note). Dauer rund 5 s pro Seite.

| Messgrösse | geom-v2 | geom-v3 | zum Vergleich: KI-Lesetest (Abschnitt 6) |
| --- | --- | --- | --- |
| Silben (mit Akzenten) | 0 % | **58 %** | 78–87 % |
| Silben ohne Akzente und Satzzeichen | 0 % | 68 % | – |
| Wortgrenzen | 73 % | **85 %** | – |
| Neumen-Gruppierung | 81 % | 74 % | – |
| Tonhöhen je Stück, Trennstriche, Schlüssel | unverändert: 96 %, 76 %, 5 von 5 | | |

Je Fall (Silben mit / ohne Akzente): Gaudeamus 77 / 81 %, Surrexit 70 / 78 %,
Ave Maria 51 / 64 %, Salve Regina 50 / 69 %, Salve mater 42 / 50 %.

Nebenbei verbessert: Der Schlüssel wird jetzt über die Lücke zwischen den
beiden Blöcken des Do-Schlüssels bestimmt. Vorher lag der Schätzwert bei
einigen Systemen genau zwischen zwei Linien, und das Ergebnis hing vom Zufall
ab (beim «Surrexit» c3 oder c4).

Befund:

- **Tesseract reicht für den Text nicht.** 58 % der Silben stimmen,
  deutlich weniger als die KI im Lesetest (78–87 %). Typische Fehler:
  verwechselte Buchstaben in alten Schriften («Ccor» statt «cór», «Í rá-ctus»
  statt «frúc-tus»), fehlende oder falsche Akzente, Punkt statt Komma,
  Trennstrich als Punkt gelesen. Am schlechtesten beim «Salve mater»
  (Druck von 1906).
- **Wortgrenzen** profitieren trotzdem (85 %), weil Tesseract die
  Wortabstände zuverlässig findet.
- **Neumen-Gruppierung sinkt** von 81 auf 74 %: falsch gelesene oder
  zusätzliche Silben ziehen Noten zu sich. Ohne guten Text ist die reine
  Abstandsgruppierung besser.
- **Initialen:** Das «A» (Ave) und «S» (Salve) werden erkannt, das grosse
  Zier-«G» (Gaudeamus) nicht; dann fehlt der Buchstabe.
- **Silbentrennung:** Wörter ohne gedruckten Trennstrich («benedicta») teilt
  eine Regel. Die Soll-Dateien folgen nicht einheitlich einer Konvention
  («díc-ta» im Ave, «San-ctó» im Gaudeamus); das kostet einige Punkte, die
  kein Lesefehler sind.
- Versucht und ohne nennenswerte Wirkung: 1-, 2- oder 3-fache Vergrösserung,
  Binarisieren vor dem Lesen (±2 Punkte). Das genauere Modell
  `tessdata_best` liess sich nicht laden (Netzwerk gesperrt); ob es spürbar
  besser wäre, ist offen.

Folgerung: Die geometrische Seite (Tonhöhen, Schlüssel, Trennstriche,
Silbenraster) ist gut genug für den Einbau. Für den Text ist Tesseract die
schwächere Wahl. Vorschlag: ein KI-Aufruf je Seite, der nur die Textzeilen
liest. Geometrie und Notengruppen dienen dabei als Vorgabe, und die
Zuordnung aus diesem Prototyp wird wiederverwendet. Dafür braucht es einen
API-Key; Kosten geschätzt unter 0.02 USD pro Seite. [Annahme, nicht gemessen]

### 7.4 Text mit KI, vorbereitet (15.11.2026)

`geometrie/text_ki.py`, aufgerufen über `GEOM_TEXT=ki|dry|mock` in `geom.py`.
Ein Aufruf je Seite: alle Textzeilen der Seite (je System die erste Zeile
unter den Linien, dazu die Initiale) untereinander in einem Bild, nummeriert.
Die KI gibt je Zeile den Text mit Silbentrennung zurück (strukturierte
Ausgabe). Die Silben werden dann auf die Tintengruppen der Textzeile gelegt
(dynamische Programmierung über die Breiten) und die Noten wie in 7.3
zugeordnet. Tesseract ist dafür nicht nötig.

Ohne API-Key gemessen:

- **Trockenlauf** (`dry`): Bildgrösse 1600 × 430 bis 880 px, geschätzt
  1400–2300 Eingabe- und 450–700 Ausgabe-Token je Seite, also **0.007–0.012
  USD pro Seite mit Sonnet 5.5** (Haiku 5.5 etwa 20-mal billiger). Die
  Ausgabe-Token bei `effort: low` sind geschätzt. [Annahme]
- **Probelauf mit dem Soll-Text statt der KI-Antwort** (`mock`): misst, wie
  gut die Zuordnung ist, wenn die KI fehlerfrei liest. Silben 93 %,
  Wortgrenzen 91 %, Neumen-Gruppierung 74 % (mit Tesseract-Wortlage statt
  Tintengruppen: 64 %). Die Silben bleiben unter 100 %, weil das Soll bei
  Melismen leere Silben führt («Á(ixdh')(iv)»). Die Gruppierung begrenzen vor
  allem fehlende oder zusätzliche Noten aus der Tonhöhenerkennung.

### 7.5 Text mit KI, gemessen (15.11.2026)

Serie `runs/ki-s55-low`: wie 7.4, mit echtem Aufruf (Sonnet 5.5, `effort:
low`, ein Aufruf je Seite). Key aus der Umgebungsvariable `NOTATOR_API_KEY`
der Cloud-Umgebung «notator». Tonhöhen, Schlüssel und Trennstriche sind
gegenüber `geom-v3` unverändert.

| Messgrösse | geom-v3 (Tesseract) | ki-s55-low | mock (Soll-Text, 7.4) |
| --- | --- | --- | --- |
| Silben (mit Akzenten) | 58 % | **76 %** | 93 % |
| Silben ohne Akzente und Satzzeichen | 68 % | **86 %** | – |
| Wortgrenzen | 85 % | **90 %** | 91 % |
| Neumen-Gruppierung | 74 % | 72 % | 74 % |
| Kosten / Dauer (5 Seiten) | 0 USD / 23 s | **0.037 USD** / 31 s | – |

Je Fall (Silben mit / ohne Akzente, Gruppierung): Surrexit 96 / 96 / 77 %,
Ave Maria 81 / 86 / 89 %, Gaudeamus 80 / 81 / 69 %, Salve mater
80 / 93 / 75 %, Salve Regina 59 / 81 / 64 %.

Gemessene Token je Seite: 1570–2500 Eingabe, 230–420 Ausgabe, also
0.005–0.009 USD pro Seite (etwas unter der Schätzung aus 7.4). Antwortzeit
3–4 s pro Seite.

Befund:

- Die KI liest den Text deutlich besser als Tesseract (+18 Punkte Silben),
  die Lücke zum fehlerfreien Text (mock) beträgt noch 17 Punkte.
- Beim Salve Regina liegt der Abstand mit/ohne Akzente bei 22 Punkten:
  Fehler sind dort vor allem Akzente und Satzzeichen, nicht Buchstaben.
  Ob der Druck die Akzente anders setzt als das Soll (GregoBase-Fassung),
  ist nicht geprüft.
- Beim Salve mater gibt die KI Satzzeichen wie «Sal-ve ma-ter..» und
  «(Rep.)» zurück; das drückt die Silben-mit-Akzenten-Werte.
- Die Gruppierung bleibt bei rund 72 %; sie hängt an den Tonhöhen-Funden
  (fehlende/zusätzliche Noten), nicht am Text.
- Nur ein Lauf je Fall: Streuung nicht gemessen.

Scans dafür: aus dem Drive geholt, nur lokal (nicht im Repo).

### 7.6 Vergleich mit Haiku 5.5 (15.11.2026)

Serie `runs/ki-h55-low`: gleicher Ablauf und gleiche Bilder wie 7.5, Modell
`claude-haiku-5-5`.

| Messgrösse | Tesseract | Haiku 5.5 | Sonnet 5.5 |
| --- | --- | --- | --- |
| Silben (mit Akzenten) | 58 % | 48 % | **76 %** |
| Silben ohne Akzente | 68 % | 53 % | **86 %** |
| Wortgrenzen | 85 % | 73 % | **90 %** |
| Neumen-Gruppierung | 74 % | 56 % | 72 % |
| Kosten (5 Seiten) | 0 | 0.002 USD | 0.037 USD |

Je Fall (Silben mit / ohne Akzente): Salve mater 78 / 90 %, Surrexit 52 / 52 %,
Gaudeamus 50 / 51 %, Salve Regina 31 / 39 %, Ave Maria 26 / 27 %.

Befund: **Haiku ist schlechter als Tesseract.** Typische Fehler aus den
Antworten:
- Text rutscht in andere Streifen: beim Ave Maria steht der Rest des Stücks
  im 3. Streifen, der 4. bleibt leer. Damit sitzen ganze Systeme falsch.
- Silbentrennung fehlt oft («Dóminus», «Máter», «Alle-lú-ia»).
- Initiale und Wortanfang falsch zusammengesetzt («-ve», «D coenam»).

Folgerung: Für den Text Sonnet 5.5 nehmen. Bei rund 0.007 USD pro Seite
lohnt sich die Ersparnis mit Haiku nicht.

### 7.7 Opus 5.5 und Streuung bei Sonnet 5.5 (15.11.2026)

Serie `runs/ki-o55-low`: wie 7.5 mit `claude-opus-5-5` (1 Lauf). Dazu in
`runs/ki-s55-low` zwei weitere Sonnet-Läufe (`geom.py --run 2|3`), also
3 Läufe je Fall.

| Messgrösse | Sonnet 5.5, 3 Läufe | Opus 5.5, 1 Lauf |
| --- | --- | --- |
| Silben (mit Akzenten) | 76 / 75 / 76 % | **81 %** |
| Silben ohne Akzente | 86 / 85 / 85 % | 86 % |
| Wortgrenzen | 90 / 90 / 89 % | 89 % |
| Neumen-Gruppierung | 72 / 73 / 72 % | 73 % |
| Kosten pro Seite | **ca. 0.007 USD** | ca. 0.015 USD |

Je Fall (Silben mit Akzenten, Sonnet Läufe 1–3 → Opus): Ave Maria
81/81/82 → 82, Gaudeamus 80/79/72 → 82, Salve mater 80/74/89 → 80,
Salve Regina 59/59/58 → 72, Surrexit 96/100/96 → 100.

Befund:

- **Sonnet ist über alle Fälle stabil** (±1 Punkt). Einzelne Fälle
  schwanken stärker: Salve mater 74–89 %, Gaudeamus 72–80 %.
- **Opus liegt 5 Punkte höher**, mehr als die Streuung von Sonnet. Der
  Gewinn kommt fast ganz vom Salve Regina (72 statt 59 %) und dort von den
  Akzenten. Ohne Akzente sind beide Modelle gleich (86 %). Von Opus gibt es
  nur einen Lauf; seine Streuung ist nicht gemessen.
- Ob die Akzente beim Salve Regina im Druck wirklich so stehen wie im Soll
  (GregoBase-Fassung), ist weiterhin nicht geprüft. Wenn das Soll dort
  abweicht, ist der Vorsprung von Opus kleiner.

Folgerung: Opus liest Akzente etwas besser, kostet aber das Doppelte. Die
Kosten bleiben in beiden Fällen klein (unter 0.02 USD pro Seite). Die Wahl
hängt davon ab, wie wichtig richtige Akzente sind; Buchstaben und
Silbentrennung liest Sonnet gleich gut.

### 7.8 Salve Regina: Akzente und Satzzeichen geprüft (15.11.2026)

Scan bei 300 dpi gegen Soll und KI-Antworten verglichen.

- **Das Soll ist bei den Akzenten falsch.** Der Druck setzt Akzente auch bei
  zweisilbigen Wörtern (máter, nóstra, sálve, Hévæ, flén-tes, válle, íllos,
  tú-os, Jésum, frúctum, véntris, tú-i, nó-bis, clémens, pí-a, dúlcis,
  Vírgo) und druckt «æ» (ricórdiæ, Hévæ). Das Soll (GregoBase) lässt diese
  Akzente weg und schreibt «ae». Beide Modelle lesen die Akzente richtig
  und werden dafür gleich bestraft.
- **Der Abstand Opus – Sonnet kommt nicht von den Akzenten.** Mit einem an
  den Druck angepassten Soll (nur im Arbeitsordner, nicht im Repo): Sonnet
  72 / 74 / 73 %, Opus 83 % (Silben mit Akzenten).
- Ursachen des Abstands:
  - **Kommas:** Der Druck hat Kommas («Al-ve, *Re-gí- na, máter»). Sonnet
    liest sie in allen 3 Läufen als Punkte, Opus als Kommas. Im KI-Bild sind
    die Textzeilen auf 64 px Höhe verkleinert (`LINE_H`); dabei geht der
    Kommaschwanz fast verloren. Ob Opus das Komma sieht oder aus dem
    bekannten Text ergänzt, ist offen.
  - **Initiale:** Sonnet gibt «S-Al-ve» zurück (Initiale als eigene Silbe),
    Opus richtig «SAl-ve». Das verschiebt beim Sonnet die Silben im ersten
    System.
  - Sonnet trennt «éxsu», «válle» nicht; Opus schon.
  - Opus lässt dafür zwei Akzente weg, die gedruckt sind («Vi-ta», «pi-a»);
    Sonnet hat sie richtig.

Folgerung: Der Vorsprung von Opus ist echt, kommt aber von Satzzeichen,
Initiale und Silbentrennung, nicht von den Akzenten. Zwei Ansätze für
Sonnet, nicht getestet: grössere Textstreifen (`LINE_H` höher) gegen die
verlorenen Kommas, und im Prompt klarer sagen, dass die Initiale ohne
Trennstrich vor das erste Wort gehört.

### 7.9 Soll korrigiert, Textstreifen und Prompt verbessert (15.11.2026)

**Soll:** `salve-regina-1/expected.json` hat jetzt die gedruckten Akzente und
«æ» (20 Stellen, siehe 7.8). Bei den anderen 4 Fällen stimmen Akzente und
«æ» in allen Wörtern, die beide Modelle erkannt haben, mit dem Soll überein
(automatischer Abgleich gegen die KI-Antworten; Wörter, die keine KI richtig
las, sind damit nicht geprüft).

**Ursache der verlorenen Kommas:** nicht die Verkleinerung allein, sondern
der Ausschnitt. Er endete 1.25 Linienabstände unter dem Textanfang und schnitt
Unterlängen und Kommaschwänze ab («Re-gí», «ergo»). Änderungen in
`geometrie/text_ki.py`:

- Unterer Rand 1.6 Linienabstände (`GEOM_KI_BOTTOM`). Beim Salve mater
  ragt die nächste Strophe trotzdem nicht hinein (Sichtprüfung).
- Lange Zeilen werden an einer Wortlücke in zwei Teile geteilt («N» und
  «N+» übereinander) statt auf 1530 px Breite verkleinert
  (`GEOM_KI_SPLIT=0` schaltet das ab). Das Bild bleibt 1600 px breit.
- Prompt: Initiale ohne Trennstrich vor das erste Wort; Komma und Punkt
  genau unterscheiden; jede Silbengrenze selbst setzen, mit Beispielen;
  Trennregeln der Choralbücher (ct, gn, mn, pt, ps; «Al-le-lú-ia»).
- Nachbearbeitung: Leerzeichen nach einem Trennstrich im Wort werden
  entfernt («Gló-ri- a» → «Gló-ri-a»).
- `GEOM_TEXT=cache` rechnet mit den gespeicherten KI-Antworten aus `--work`
  neu (kein Aufruf, keine Kosten).

Alle Werte gegen das korrigierte Soll (Silben mit / ohne Akzente,
Wortgrenzen):

| Serie | Silben | ohne Akzente | Wortgrenzen | Gruppierung | Kosten 5 Seiten |
| --- | --- | --- | --- | --- | --- |
| `ki-s55-low` (alt, 3 Läufe) | 80 % | 85 % | 90 % | 73 % | 0.037 USD |
| `ki-o55-low` (alt, Opus, 1 Lauf) | 84 % | 86 % | 89 % | 73 % | 0.073 USD |
| `ki-s55-low-v2` (Ausschnitt + Teilung, 3 Läufe) | 82 % | 83 % | 88 % | 71 % | 0.040 USD |
| **`ki-s55-low-v3`** (dazu Prompt, 3 Läufe) | **85 %** | **87 %** | **90 %** | 73 % | **0.043 USD** |

Je Fall in v3 (Silben, 3 Läufe): Ave Maria 83/83/83, Gaudeamus 81/81/81,
Salve mater 89/89/89, Salve Regina 85/83/82, Surrexit 93/93/93.

Befund:

- **Sonnet mit v3 ist so gut wie Opus mit dem alten Ablauf** (85 gegen
  84 %) und kostet die Hälfte. Opus mit v3 ist nicht gemessen.
- Die Läufe streuen kaum noch (je Fall höchstens 3 Punkte).
- v2 allein brachte wenig: Mit dem schärferen Bild übernahm Sonnet die
  gedruckten Trennstriche wörtlich und trennte ungetrennte Wörter nicht mehr
  («Surré-xit», «omnes»). Erst die Beispiele im Prompt (v3) beheben das.
- Restfehler sind grossteils Trennkonvention, nicht Lesefehler: Das Soll
  trennt uneinheitlich («díc-ta», «Sánc-ta» im Ave Maria, «San-ctó» im
  Gaudeamus). Die neue Regel trifft das eine und verfehlt das andere; dazu
  zwei Ausreisser («AVE» ungetrennt, «Sá-ncta»).
- Weiter offen: Die Zier-Initiale «G» (Gaudeamus) und die Hymnus-Initiale
  «A» (Surrexit, 2. Stück) erkennt das Skript nicht; dann fehlt der
  Buchstabe.

### 7.10 Trennkonvention festgelegt (15.11.2026)

Geprüft an den Scans, wo der Druck Konsonantengruppen mit Trennstrich zeigt:

- Gaudeamus (Graduale): «re-ctos», «sol-e-mni-tá-te»; Salve Regina (Liber
  Usualis): «bene-dí-ctum», «o-sténde». Die Gruppe geht ganz zur nächsten
  Silbe: **Solesmes-Konvention «be-ne-dí-cta», «San-ctus», «ó-mni-um»,
  «no-stra».**
- Salve mater (Cantus Mariales 1906) trennt dagegen klassisch: «díg-ni-or»,
  «om-nes». Dort folgt das Soll dem Druck.

Regel für Soll und Prompt: **ein gedruckter Trennstrich gilt immer; wo
keiner gedruckt ist, gilt die Solesmes-Konvention.**

Geändert: Ave Maria (dí-cta, dí-ctus, frú-ctus, Sán-cta, nó-strae; im Druck
ohne Trennstrich), Salve Regina («o-stén-de» nach dem Druck), Prompt in
`text_ki.py` (gedruckter Trennstrich hat Vorrang, Solesmes-Regel mit
Beispielen). Gaudeamus und Surrexit hatten keine Abweichungen.

| Serie (gegen das neue Soll) | Silben | ohne Akzente | Wortgrenzen | Gruppierung |
| --- | --- | --- | --- | --- |
| `ki-s55-low-v3` | 87 % | 88 % | 90 % | 73 % |
| **`ki-s55-low-v4`** (Prompt mit Vorrang-Regel, 3 Läufe) | **88 %** | **89 %** | **90 %** | 74 % |

Je Fall in v4 (Silben, 3 Läufe): Ave Maria 98/97/100, Surrexit 100/100/100,
Salve mater 89/89/89 («díg-ni-or», «om-nes» bleiben wie gedruckt),
Salve Regina 85/81/86, Gaudeamus 80/77/78. Kosten 0.043 USD für 5 Seiten.

Nebenbefund: Notator selbst (`ntPtSyllabify` in
`src/js/3-orgel-und-mehr/160-psalmton-assistent.js`, genutzt von
Psalmton-Assistent, Strophen und «Text zuerst») trennt «díc-ta»,
«Sanc-tus», weil ct, mn, pt, ps dort nicht als Gruppe gelten. Das weicht
von der Solesmes-Konvention ab; in Build 403 angeglichen (16.11.2026).

### 7.11 Initialen auf allen Systemen (16.11.2026)

Vorher fehlten das Zier-«G» (Gaudeamus) und die Hymnus-Initiale «A» (Surrexit,
2. Stück). Ursachen und Änderungen (`geometrie/ocr.py`, `geom.py`, `text_ki.py`):

- Das «G» ist rund 12 Linienabstände hoch und breiter als das Suchfenster
  (9 Linienabstände); Bogen und Fuss hingen nur ausserhalb des Fensters
  zusammen. Fenster jetzt 16 Linienabstände breit und nach unten bis ins
  nächste System; alle grösseren Teile, die den Kasten berühren, werden
  dazugenommen. Teile, die in Linien oder Text eines anderen Systems liegen,
  und kleine Angaben darüber (Modus «VIII», «5», «1.») nicht.
- Initialen werden bei **jedem** System gesucht; ein Teil einer schon
  gefundenen Initiale zählt nicht als neue.
- Im KI-Bild steht die Initiale jetzt verkleinert **links vor ihrer Zeile**
  statt als eigener Streifen 0. Prompt entsprechend, dazu: jede nummerierte
  Zeile bleibt für sich (ohne diesen Satz zog Sonnet in einzelnen Läufen
  mehrere Zeilen in eine zusammen – Surrexit fiel einmal auf 16 %).

| Serie | Silben | ohne Akzente | Wortgrenzen | Gruppierung |
| --- | --- | --- | --- | --- |
| `ki-s55-low-v4` | 88 % | 89 % | 90 % | 74 % |
| **`ki-s55-low-v5`** (3 Läufe) | **89 %** | **90 %** | **90 %** | 74 % |

Je Fall (Silben): Ave Maria 100/100/97, Surrexit 98/91/91, Salve mater
92/92/92, Salve Regina 86/86/86, Gaudeamus 81/79/83 (mit «GAU-DE-A-MUS»).
Kosten 0.043 USD für 5 Seiten.

### 7.12 JavaScript-Fassung (Build 408, 23.11.2026)

`src/js/2-choral/172-pdf-geometrie.js` überträgt Geometrie, Initialen, Textgruppen und die Zuordnung Text → Noten
aus `geom.py`, `ocr.py` und `text_ki.py`. Vergleich auf den 5 Scans mit `geometrie/dump.py`: alle 36 Systeme gleich
(Noten, Schlüssel, Trennstriche, Initialen, Textgruppen, GABC); mit den gespeicherten KI-Antworten von v5
(`runs/js-geo-v1`) dieselben Werte wie `ki-s55-low-v5`. Rund 1 s pro Seite in Node.
Wichtig war die bikubische Drehung mit a = −1 wie in PIL: mit a = −0.5 kippten einzelne Notenköpfe
(Notenzahl 41 statt 47 %, Trennstriche 71 statt 76 %).

### 7.13 In Notator, hinter Schalter (Build 409, 23.11.2026)

`src/js/2-choral/174-pdf-lesen-neu.js`: Seite mit pdf.js bei 300 dpi rendern, Geometrie (172), Textstreifen-Bild
im Browser (Canvas), ein Aufruf je Seite, Stückgrenzen an den Initialen, GregoBase-Angebot und Import wie bisher.
Messlauf über die echte Oberfläche mit den gespeicherten KI-Antworten von v5 (`runs/js-app-mock`, kostenlos):

| | Prototyp (pdftoppm, `js-geo-v1`) | App (pdf.js, `js-app-mock-sollteilung`) |
| --- | --- | --- |
| Tonhöhen je Stück | 96 % | 96 % |
| Silben / Wortgrenzen | 89 % / 90 % | 89 % / 91 % |
| Notenzahl je System richtig | 47 % | 31 % |
| Trennstriche | 76 % | 69 % |
| Dauer pro Seite | – | ca. 6 s |

- Zum Vergleich mit derselben Stückaufteilung wie im Soll ausgewertet (`-sollteilung`). Mit der eigenen Aufteilung
  (`js-app-mock`) setzt die App beim Gaudeamus die Grenze an das «G» des Gloria Patri (Initiale im Druck); das Soll
  führt dort eine behelfsmässige Grenze zwei Systeme später – daher dort schlechtere Werte. Bei den anderen 4 Fällen
  stimmen Stückzahl und Systemzahl.
- Notenzahl und Trennstriche: pdf.js glättet das eingebettete Scanbild anders als pdftoppm. Offener Punkt.

### 7.14 Standard (Build 410, 23.11.2026)

Nach dem Test durch Matthias: neue Erkennung ist der einzige Weg, der alte (Vision je System, OMR-Korrektur,
`run-playwright.js`) ist entfernt. Messlauf über die Oberfläche (`runs/js-app-410`) identisch mit Build 409.

## Offene Fragen

1. Soll-GABC der drei Fälle prüfen (`tests/pdf-lesen/cases/*/expected.json`).
2. Weitere Fälle: Fa-Schlüssel, Schlüsselwechsel, Mehrseiter und Stücke
   ausserhalb GregoBase fehlen noch.
3. Dürfen die Scans ins Repo? Bisher liegen sie nur lokal.
4. Nächster Schritt: Systemschnitt reparieren (Eingriff in `index.html`, nach
   der Begleitsatz-Session) oder zuerst die Lese-Varianten ausserhalb von
   Notator testen?
