# Orgel-Begleitsatz: Ist-Analyse und Regelwerk (Entwurf)

Stand: Build 398, 12.11.2026. Phase 1+2 des Konzepts «Orgel-Begleitsatz & PDF lesen», Teil A.
**Entwurf – noch nichts davon ist im Harmonisierer umgesetzt.** Zeilenangaben beziehen sich auf `index.html` Build 398.

Kennzeichnung: **[sicher]** = allgemeines Lehrbuchwissen · **[Vorschlag]** = mein Entwurf, zu entscheiden · **[unsicher]** = an Quelle zu prüfen, bevor es Regel wird.

## 1. Ist-Zustand: was heute gilt

| Bereich | Regel heute | Zeile |
|---|---|---|
| Modus | nur Leitertyp aus letztem Ton + Schlüssel-b (ionisch … lokrisch); kein authentisch/plagal, kein Tenor. Kopffeld `mode:` wird gelesen, aber nicht benutzt | 17008, 17023, 16832 |
| Abschnitte | möglicher Wechsel: Zeilenanfang, Wort-/Melismenbeginn, lange Note, Sprung ≥ kl. Terz, spätestens nach 4 Achteln, Schlusston; mind. 2 Achtel | 17596–17619 |
| Akkordvorrat | leitereigene Dur-/Molldreiklänge, Grundstellung oder Sextakkord; erster Melodieton muss Akkordton sein | 17171–17190 |
| b/h | lokale Leiter = Vorzeichnung + Alterationen im Abschnitt; andere b/h-Form als Zusatzkandidat (+2.5), wenn die Stufe im Abschnitt fehlt | 17174–17177, 17260–17263, 17282 |
| Lagen | B < T < A < tiefster Melodieton; A–T ≤ Oktave, T–B ≤ Duodezime, S–A ≤ Oktave (nur am 1. Ton); Grundton + Terz Pflicht; Quinte fehlt +0.8, Terzverdopplung +1.5; nur die 24 günstigsten Lagen je Akkord | 17192–17221 |
| Akkordkosten | Nebenton akkordfremd +0.6, langer Ton +6; Anfang nicht Finalis +1; Phrasenschluss nicht Finalis +2.5 (maior/finalis) bzw. +0.6 (minor); Schluss nicht Finalis +20; Sextakkord +1.2, am Phrasenschluss gesperrt | 17279–17293 |
| Übergang | Liegenlassen kostet 0.35–0.5, Quint-/Quartwechsel 0, Terz 0.15, Sekunde 0.45; Wechsel auf Einzelachtel +1.5; Bewegung A/T 0.15, B 0.08 je Halbton; Sprungzuschläge; gleichgerichtete Quint-/Oktavparallele +10 | 17336–17366 |
| nach Atemzeichen / Divisio minor | gleicher Akkord +3 (gleiche Lage) bzw. +1.2 | 17320 |
| Suche | dynamische Programmierung 1. Ordnung über die Abschnitte | 17305–17333 |
| Vorgaben | je Abschnitt Stufe, Lage oder freier Akkord, relativ zur Finalis; `legacyKeys` als Ausweichschlüssel | 17230–17242, 17265–17274 |

## 2. Schwächen (konkret)

1. **Kein Modusbegriff** (17023): Modus I und II, III und IV usw. werden gleich behandelt; Tenor und modustypische Kadenzstufen fehlen. Die einzige «Kadenzregel» ist «Finalis-Akkord bevorzugt» (17286).
2. **Finalis = letzter Ton** (17008): falsch bei Stücken, die nicht auf der Finalis enden (Psalmton mit Differenz, Antiphon + Psalmvers, mehrteilige Abschnitte).
3. **Unruhe bei Rezitation**: Wechsel kostet nichts, Liegenlassen kostet (17347); spätestens alle 4 Achtel entsteht ein Abschnitt (17611); nach Atemzeichen wird ein Wechsel erzwungen (17320). Das widerspricht der Konzept-Regel «Rezitation mit liegendem Akkord». Im Test `rezitation8` wechselt der Satz mitten in der Rezitation nach e-Moll und zurück.
4. **Kadenz ohne Vorbereitung**: nur der Schlussakkord ist geregelt, nicht die Wendung davor (Penultima). In Modus III/IV ist immer e-Moll in Grundstellung erzwungen; F-Dur → e-Moll ist nur durch die Parallelenstrafe gebremst.
5. **Parallelen sind nur teuer, nicht verboten** (17363: +10), und nur zwischen letztem Melodieton des alten und erstem des neuen Abschnitts geprüft. Antiparallelen, Stimmüberschneidung und **Querstand** (b gegen h in verschiedenen Stimmen) werden nicht geprüft. Test `bh1`: B-Dur → e-Moll mit Querstand B/H und Tritonus im Bass.
6. **Spielbarkeit ohne Pedal**: T–B bis 19 Halbtöne erlaubt (17203), auch wenn kein Pedal gewählt ist – 15 von 25 Befunden im Testlauf sind linke-Hand-Griffe von 15–16 Halbtönen. Rechte Hand: nur der erste Melodieton wird gegen den Alt geprüft (17206), nicht die Spitze des Melismas.
7. **Vorauswahl der 24 Lagen** nach statischen Kosten (17218–17220) kann die stimmführungsmässig beste Lage abschneiden, bevor die Übergänge sie bewerten.
8. **Suche 1. Ordnung**: Pendeln (I–IV–I–IV) und harmonischer Rhythmus über mehr als zwei Abschnitte sind nicht bewertbar.
9. **Anfangsakkord** nur mit +1 an die Finalis gebunden (17284); Test `modus8` beginnt in C-Dur.
10. **Gewichte ohne Namen und Begründung**: rund 30 Zahlen im Code; keine Erklärung je Akkordwahl möglich.
11. **Notlösung Pausen** (17301), wenn keine Lage passt (Alt muss unter dem tiefsten Melodieton liegen, 17206) – bei tiefen Melodien mit grossem Ambitus möglich; bisher ohne Test mit echtem Material.

## 3. Regelwerk (Entwurf)

### 3.1 Modusprofile

Finalis, Tenor, Ambitus: **[sicher]**. Kadenzstufen: **[unsicher]** – übliche Angaben der Moduslehre, im Choral nicht durchgehend gültig; am Korpus zu prüfen. Akkorde: **[Vorschlag]**, in untransponierter Lage notiert.

| Modus | Finalis | Tenor | Ambitus | Kadenzstufen (Töne) | Hauptakkorde | Schlussakkord | Meiden / Vorsicht |
|---|---|---|---|---|---|---|---|
| I | D | A | D–d (C) | D, A, F | d, a, F, C, (g mit b) | d | h-vermindert; B-Dur nur mit b in der Melodie oder in deren Nähe |
| II | D | F | A–a | D, F, (C) | d, F, C, a | d | wie I; tiefe Lage → Alt-Spielraum eng |
| III | E | C (alt: H) | E–e | E, C, G, (A) | e, C, G, a | e (siehe 3.2) | F-Dur → e-Moll (Parallelen); h-vermindert |
| IV | E | A | H–h (C–c) | E, A, G, (D) | e, a, G, d, C | e (siehe 3.2) | wie III |
| V | F | C | F–f | F, C, A | F, C, a, d, (B mit b) | F | h-vermindert; Tritonus F–H im Bass |
| VI | F | A | C–c | F, A, (C, D) | F, d, a, C, (B) | F | wie V |
| VII | G | D | G–g | G, D, C | G, d, C, a, e | G | D-Dur (fis leiterfremd) |
| VIII | G | C | D–d | G, C, (D, F) | G, C, a, F, d | G | wie VII |

- Modusbestimmung **[Vorschlag]**: 1. Kopffeld `mode:` (wird bereits gelesen), 2. sonst Finalis + Ambitus (liegt die Melodie mehrheitlich über der Finalis und erreicht die Oktave → authentisch; reicht sie eine Quarte darunter → plagal), 3. im Menü überschreibbar. Transponierte Finales (A, H, C als Affinales) über die Intervallstruktur zuordnen.
- Der Tenor-Akkord ist der Akkord, der den Tenor als Grundton oder Quinte enthält (z. B. Modus VIII: C-Dur, Modus I: a-Moll oder d-Moll) – welcher bevorzugt wird, ist Traditionsfrage **[unsicher]**.

### 3.2 Kadenzen

**[Vorschlag]**, abhängig vom Entscheid «Begleittradition»:

| Stelle | Regel |
|---|---|
| Divisio finalis / Schluss | Finalis-Akkord in Grundstellung, Finalis im Bass (wie heute). Penultima bevorzugt: Stufe eine Quarte/Quinte entfernt (plagal: IV → I; modal: VII → I, z. B. C → d, F → G) |
| Divisio maior | Schluss der Melodie auf Finalis → wie Schluss. Schluss auf Tenor oder anderer Kadenzstufe → Akkord mit diesem Ton als Grundton oder Quinte (Halbschluss), nicht in die Finalis zwingen |
| Divisio minor | kein Kadenzzwang; Grundstellung bevorzugt, Akkord darf über die Divisio liegen bleiben |
| Divisio minima / Atemzeichen | Akkord bleibt liegen (heute: Wechsel erzwungen, Zeile 17320 – Nutzervorgabe vom Oktober, **bitte bestätigen oder ändern**) |
| Modus III/IV, Schluss | Varianten: (a) e-Moll, Penultima a-Moll oder d-Moll in Gegenbewegung; (b) leere Quinte E–H; (c) E-Dur (leiterfremdes Gis, tonal gefärbt). Heute immer (a). **Entscheid nötig**; welche Variante in Solesmes-Sätzen bzw. NOH überwiegt, ist **[unsicher]** und am Material zu zählen |

### 3.3 Psalmtöne und Rezitation

- Erkennung **[Vorschlag]**: ≥ 4 Silben in Folge auf demselben Ton = Rezitation; oder Stück stammt aus dem Psalmton-Assistenten (Kennzeichen im Kopf).
- Rezitation: ein Akkord liegt, keine Zwangsabschnitte alle 4 Achtel, kein Wechsel nach Atemzeichen.
- Wechsel nur an Initium (→ Tenor-Akkord), Flexa, Mediatio (Akzentsilbe), Terminatio (Akzentsilbe, Schlusston).
- Schlussakkord bei Differenzen, die nicht auf der Finalis enden **[unsicher]**: Akkord der Differenz oder Finalis-Akkord der Antiphon – Praxis je nach Begleitbuch verschieden; **Entscheid nötig**.

### 3.4 b/h-Regel

- Geltung des ♭ in der Melodie bleibt wie heute (bis Divisio, Schalter «Solesmes: bis Wortende») **[bestehender Nutzerentscheid]**.
- Neu **[Vorschlag]**: Der Satz verwendet in einem Abschnitt und im Abschnitt davor/danach nie die andere Form derselben Stufe in einer anderen Stimme (Querstand-Verbot, harte Regel).
- Akkorde mit b (B-Dur, g-Moll) ohne b in der Melodie: nur in Modus I/II/V/VI und nur, wenn bis zur nächsten Divisio kein h in der Melodie steht **[Vorschlag]**; heute pauschal +2.5.
- Tritonus-Schritt im Bass (F–H, B–E) meiden.

### 3.5 Stimmführung

| Regel | heute | Entwurf |
|---|---|---|
| Quint-/Oktavparallelen (gleichgerichtet) | +10 | hart verboten innerhalb einer Phrase; über Divisio maior/finalis erlaubt |
| Antiparallelen | – | Aussenstimmen: meiden (Kosten) |
| Stimmkreuzung | hart | hart (bleibt) |
| Stimmüberschneidung | – | Kosten |
| Querstand | – | hart (siehe 3.4) |
| Terzverdopplung | +1.5 | bleibt; im Sextakkord milder **[unsicher]** |
| Vorhalte, Durchgänge in Mittelstimmen, Septakkorde | nicht möglich | **offener Entscheid** – erst nach Antwort entwerfen |

### 3.6 Spielbarkeit

**[Vorschlag]**; Grenzwerte bitte an der eigenen Hand bestätigen.

- Ohne Pedal: linke Hand T–B ≤ Oktave (12), ausnahmsweise None/Dezime (≤ 16) mit Kosten. Mit Pedal: T frei bis Duodezime über dem Bass (wie heute).
- Rechte Hand: höchster Melodieton des Abschnitts minus Alt ≤ Oktave; sonst Alt in die linke Hand (dann gilt links A–B ≤ Oktave) – braucht dreistimmige Lagen als Alternative.
- Pedal: Grundtöne bevorzugt, Sextakkord nur stufenweise erreicht und verlassen, Sprünge ≤ Quinte bevorzugt, keine Wechsel auf Einzelachteln.
- Ambitus Orgel: Bass nicht unter C (heute C2 = Grenze, gut).

## 4. Architektur (Skizze, nicht umgesetzt)

- `CL_MODES` als Datentabelle (3.1), `CL_W` als benannte Gewichte mit Kommentar; harte Regeln als Filter, weiche als Kosten.
- Kosten liefern Teilbeträge mit Etikett → Begründung im Akkordmenü («Halbschluss auf Tenor, Modus VIII»).
- Vorgabenformat und `legacyKeys` unverändert; durch Tests abgesichert.

## 5. Quellen, die für die [unsicher]-Punkte nötig sind

Aus dem Gedächtnis genannt, **nicht nachgeschlagen**; Verfügbarkeit und Rechtslage (gemeinfrei?) sind vor Gebrauch zu prüfen.

- Nova Organi Harmonia (Lemmens-Institut Mecheln) – liegt als NOH-Bibliothek bereits vor; Referenzsätze und Zählung der Kadenzformen je Modus.
- Solesmes-Richtung: Henri Potiron, Traité/Leçons d'accompagnement du chant grégorien; Giulio Bas, Méthode d'accompagnement du chant grégorien.
- Deutschsprachig: Max Springer, Die Kunst der Choralbegleitung; Dominicus Johner, Neue Schule des gregorianischen Choralgesangs (Moduslehre).
- Flor Peeters, Méthode pratique pour l'accompagnement du chant grégorien.
- Psalmtöne: Liber Usualis / Antiphonale Monasticum (Tondaten im Code bereits aus jgabc).

## 6. Offene Entscheide (vor jeder Änderung am Harmonisierer)

1. Massgebende Begleittradition (Solesmes-Stil, NOH, eigene Praxis).
2. Nur Dreiklänge, oder Vorhalte, oder auch Septakkorde.
3. Quelle der Referenzsätze (gemeinfreie Begleitbücher, eigene Sätze, beides).
4. Akkordwechsel nach Atemzeichen: beibehalten (Vorgabe Oktober) oder liegen lassen.
5. Schluss in Modus III/IV: e-Moll, leere Quinte oder E-Dur.
6. Schlussakkord bei Psalmton-Differenzen.
7. Griffweite ohne Pedal: Oktave oder Dezime.

### Entscheide vom 12.11.2026 (Matthias)

- Zu 2: Septakkorde (und damit auch Vorhalte) sind erlaubt.
- Zu 4: Nach Atemzeichen/Divisio grundsätzlich immer ein Akkordwechsel (Klarheit für die Sänger, wann es weitergeht). Gilt auch bei Rezitation; 3.2/3.3 sind entsprechend anzupassen.
- Zu 5 und 6: «was gebräuchlich ist» – noch nicht belegt; am Referenzmaterial auszuzählen.
- Zu 7: ohne Pedal Oktave als Regel, Dezime in Ausnahmefällen (mit Kosten).
- Offen: 1 (Tradition) und 3 (Referenzsätze).

## 7. Pilot NOH: «Tu es Petrus» (Communio VI, NOH 1163)

Aus dem Scan gelesen (14.11.2026), **Aussenstimmen und Kadenzen sicher, Mittelstimmen stellenweise unsicher; von Matthias gegenzuprüfen**. Vorzeichnung 1 ♯, Finalis G (Modus VI einen Ton höher).

| Stelle | Akkord (Bass) | Beobachtung |
|---|---|---|
| ædi-**fi**- | D-Dur | |
| -**cá-bo** | e-Moll | Tenor und Bass im Einklang; Alt liegt |
| Viertelstrich vor «Ecclésiam» | e-Moll bleibt, Bass übergebunden | **kein Wechsel am Strich**, Wechsel erst auf «-clé-» |
| Ec-**clé**- | G-Dur als Sextakkord (H im Bass) | |
| -si-**am** | C-Dur | |
| **me**- | G-Dur Sextakkord → Grundstellung | Finalis im Tenor liegt die ganze Schlussphrase |
| -**am.** | G-Dur, Quartvorhalt c → h im Alt, ohne Quinte | Schluss: I⁶ – IV – I⁶ – I mit Vorhalt 4–3 |

Erste Zeile (unsicherer gelesen): Beginn mit Sextakkord, «Petrus» schliesst auf D-Dur (Halbschluss), danach lange e-Moll-Fläche; Septakkorde (a-Moll mit G) kommen vor.

Folgerungen (ein Stück, **keine Statistik**):
- Akkorde wechseln langsam (meist Halbe), Mittelstimmen gehen stufenweise, viele Überbindungen.
- Sextakkorde, Septakkorde und Vorhalte sind normal – deckt sich mit Entscheid 2.
- Am Viertelstrich bleibt der Akkord hier liegen – **widerspricht Entscheid 4** (immer Wechsel). Der Entscheid geht vor; beim Vergleich mit NOH sind solche Stellen auszunehmen.
- Schlussakkord ohne Quinte, Terz im Alt; die plagale Wendung IV – I ist hier die Kadenz.

## 8. Auswertung NOH: 23 Schlusskadenzen (14.11.2026)

Quelle: die 19 hochgeladenen PDFs (`tests/korpus/noh/`), Daten in `tests/korpus/noh-kadenzen.json`.
Gelesen sind nur **Schlüsse** (Stück-, Vers- und Amen-Schlüsse), keine Binnenkadenzen. Schlussakkord und Bass sind gut lesbar; der vorletzte Klang und die Mittelstimmen sind weniger sicher. 21 von 23 gelten als sicher, 2 sind ausgenommen (siehe unten). Stichprobe klein und ungleich verteilt (Modus VIII: 6, I: 5, IV: 3, VII: 2, II/V/VI: je 1–2, III: 0) – **Tendenz, kein Beweis**.

### Befunde

| Merkmal | Anzahl (von 21) |
|---|---|
| Schlussakkord in Grundstellung | 21 |
| Schlussakkord vollständig (mit Quinte) | 16; ohne Quinte 2; Finalis als Quinte 3 |
| **Quartvorhalt 4–3** vor dem Schlussakkord (meist im Tenor) | 15 |
| Vorletzter Klang: **Moll-Septakkord auf der 5. Stufe** (z. B. c-Moll⁷ → F-Dur, a-Moll⁷ → d-Moll); seine Septime wird zum Vorhalt | 8–9 |
| Vorletzter Klang: Dur-Akkord einen Ganzton unter der Finalis (F → G, C → D), oft als Sextakkord | 2 |
| Vorletzter Klang: 4. Stufe (plagal) | 3 |
| Vorletzter Klang: 6. Stufe (B → d, Es → g) | 2 |
| Leittonalteration (Dur-Dominante) | 0 |

### Antworten auf die offenen Entscheide

- **Entscheid 5 (Schluss Modus III/IV):** In allen drei Sätzen im Modus IV (Gloria, Sanctus, Agnus der Messe I) steht am Schluss **weder e-Moll noch E-Dur, sondern der Moll-Akkord eine Quarte über der Finalis** – die Finalis ist Quinte des Schlussakkords (untransponiert: Melodie endet auf E, Akkord a-Moll). Ein weiterer Satz mit phrygischem Schluss (Introitus S. 324, Modus nicht bezeichnet) macht es gleich. Für **Modus III fehlt ein Beleg**: der einzige Kandidat (Communio «Dico autem vobis», Überschrift «III») endet in meiner Lesung melodisch auf G mit G-Dur, was nicht zu Modus III passt – ungeklärt, bitte am Original prüfen.
- **Entscheid 6 (Psalmton-Schlüsse):** Vier Gloria-Patri-Schlüsse gelesen. Drei enden auf der Finalis → Finalis-Akkord. Einer (Gaudeamus, Modus I) endet melodisch auf F → trotzdem d-Moll, F ist Terz. Regel-Vorschlag: Schlusston der Differenz als Akkordton des Finalis-Akkords nehmen, wenn er dazu passt. Für Differenzen, deren Schlusston **nicht** in den Finalis-Akkord passt (z. B. Ton I auf G oder A), gibt es **keinen Beleg**.
- **Entscheid 2 (Septakkorde/Vorhalte):** durch das Material klar gestützt.

### Vorschlag für die Schlussformel (ersetzt 3.2, Zeile «Divisio finalis»)

1. Schlussakkord: Finalis im Bass, Grundstellung, vollständig. Modus IV (und vorläufig III): Moll-Akkord eine Quarte über der Finalis, Finalis als Quinte.
2. Davor Quartvorhalt 4–3 in einer Mittelstimme, wenn die Melodie am Schluss mindestens zwei Pulse auf der Finalis oder einem Akkordton liegt; sonst ohne Vorhalt.
3. Vorletzter Klang nach Priorität: Moll-Septakkord auf der 5. Stufe (Septime wird liegend zum Vorhalt) → Dur-Akkord unter der Finalis → 4. Stufe. Massgebend ist, welcher zu den Melodietönen passt.
4. Nie Leittonalteration.

### Ausgenommen / offen

- `0912` Dico autem vobis: Modusangabe und gelesener Schluss widersprechen sich.
- `1171a` Agnus Dei I: Bass (d-Moll) sicher, Oberstimme unscharf.
- Nicht gelesen: Versschlüsse in 0728 und 1112, 1145 (Gaudens gaudebo) ganz, alle Binnenkadenzen (Divisio maior/minor). Die Binnenkadenzen wären der nächste Schritt für Entscheid 4 und die Halbschluss-Regel.
