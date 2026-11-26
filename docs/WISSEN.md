# Notator – gesammeltes Wissen (Lehren, Entscheidungen, Hintergründe)

Ergänzt `CLAUDE.md` (Arbeitsablauf, Sicherheit) und `NOTES.md` (Änderungsübersicht).
Hier steht, was sich nicht aus dem Code ablesen lässt: Lehren aus Fehlern, Entscheidungen von Matthias
und Eigenheiten von exsurge. Stand: Build 402, 16.11.2026. **Neue Erkenntnisse und Entscheidungen hier
nachtragen** (kurz, mit Datum oder Build), damit alle Sitzungen – claude.ai und Claude Code – denselben Stand haben.

## 1. Zusammenarbeit mit Matthias

- Deutsch, Schweizer Schreibweise, per Du; kurz und konkret, keine Floskeln.
- Sinnvoll selbst entscheiden statt unnötig nachzufragen; **vor grösseren Features** Vorgehen kurz vorschlagen.
  Bei Gestaltungsfragen gern Varianten visuell zeigen, bevor umgesetzt wird.
- Unsicherheiten offen benennen; klar trennen zwischen «getestet», «nur im Code gelesen» und «muss im Browser geprüft werden».
- Matthias nutzt Notator als installierte App auf dem **Android-Handy** (PWA), im Browser am **PC** und auf dem
  **Tablet an der Orgel** (zusammen mit NOH-Notenbibliothek und Schola-Planer; Bildschirm soll wach bleiben).
  Fehlermeldungen kommen meist als Handy-Screenshot.
- «Funktioniert nicht» nach einem Update: zuerst prüfen, ob die neue Version schon geladen ist
  (Build-Nummer; Service-Worker-Cache – App ggf. zweimal neu laden). Ist schon mehrfach vorgekommen.

## 2. Testlehren

- **Einlesen ≠ Darstellen.** exsurge hat getrennte Pfade für das Parsen und das Rendern. Dass ein Text oder Tag
  das Parsen übersteht, beweist nichts über die Darstellung (Beispiel: `<sp>` kennt nur Notators Import,
  der Renderer gab ihn wörtlich aus). Jede Änderung an GABC-Erzeugung oder Notensatz im **echten Notenbild** prüfen
  (`tests/visual/run.js`, Playwright-Screenshot oder PDF).
- **Abweichung in der Datenstruktur ≠ sichtbarer Fehler.** Ein «Fix» für eine nur im Datenmodell sichtbare
  Abweichung hat schon einmal einen echten Darstellungsfehler erzeugt. Erst den sichtbaren Fehler belegen.
- **Synthetische Testbilder reichen für «PDF lesen» nicht.** Auflösung, Ausschnitt und Linienabstand echter
  PDF-Seiten weichen ab. Bei der Bilderkennung früh Diagnose-Logs einbauen und echte Konsolenausgaben von
  Matthias holen. `gregGst()` schreibt nur in die Statuszeile, nicht in die Konsole – ein leeres Konsolen-Log beweist nichts.
- Nach einer Nutzermeldung nicht nur die gemeldete Stelle flicken, sondern alle gleichartigen Stellen systematisch prüfen.
- Playwright-Tests: Beim Start öffnet sich nach ca. 2 s die Bibliothek – warten, dann `closeModal()`.
  `page.evaluate` nie auf einen unbeendeten Promise warten lassen (hängt); in `() => { … }` einwickeln.
  PDF-Erzeugung lässt sich mit lokal eingebundenem jsPDF und `window._ntCollect` (Seitenbilder abfangen) prüfen.

## 3. exsurge: Eigenheiten und Notator-Patches (`src/vendor/exsurge.js`)

- Notator-eigene Patches: `patchDividerLeadingSpace` (Abstand vor Divisio), `patchTextOnlyTrailingSpace`
  (notenlose Direktiven wie *Ant.*, *Ps.*, *ij.* nur mit kleinem Folgeabstand statt Wortabstand),
  `patchNeumeFinalNoteBoundsForSpacing` (Mora/Episem/Iktus auf einer **nicht letzten** Note blähte den Abstand zur
  Folgeneume auf), `patchAnnotationDropCapSpacing`; `ChantLineBreak`: `this.justify = false` (keine gedehnte Zeile
  vor erzwungenem Umbruch); Strophen: nach mehrzeiligem Text (`lastMulti`) landet einzeiliger Text wie «Amen» auf der untersten Zeile.
- **Build 443:** `createMappingFromWord` gab bei einer Silbe, deren Gruppe nur ein Vorzeichen enthält («vé(ix)(i)runt»), statt eines
  ChantMapping ein Array zurück – das ganze Wort fehlte im Notenbild und im Import (Media vita, GregoBase-Schreibweise). Notator-Patch:
  Silbe an die nächste Gruppe weitergeben. TextOnly-Notationen haben in exsurge immer `lyricType` 0 – ob eine notenlose Silbe zum Wort
  gehört, erkennt der Export am gleichen `mappingIdx` (ein Mapping je Wort).
- **Build 444 (exsurge-Patches):** In `createNoteFromData` erzeugte das zweite «v»/«s» («hvv», «gss») eine neue Note ohne Tonhöhe
  (Standard = «g») – jetzt übernimmt sie die Tonhöhe der ersten. In `createMappingFromWord` wird Neumenschrift nach «|» (nabc) und
  «[alt:…]» aus der Gruppe entfernt und «( )» wie «()» behandelt.
- `<i>…</i>` wird intern wie `_…_` als Kursiv behandelt (exsurge kannte nur `_`). Folge: `lyric.text` verliert
  die Tags schon beim Parsen – für die Erkennung `lyric.originalText` lesen.
- exsurge färbt «V/.», «R/.», «A/.» fest rot → `gregNeutralizeRubricRed()` setzt nach dem Rendern auf Schwarz.
- Direktiven immer als `<i>Ant.</i>() Silbe(…)` exportieren (mit `()` und Leerzeichen). Ohne `()` verschmilzt
  der Text mit der Folgesilbe, und die Silbenzentrierung (`findVowelSegment`, Vokalpriorität a, e, i, o, u – nicht
  von links) setzt die Neume über die Direktive.
- `ij.`, `iij.`, `Ps.` usw. dürfen nie einen Bindestrich zur Folgesilbe bekommen.
- Neumen: Salicus ist eine **3-Noten**-Figur (Oriscus auf der mittleren Note, `fgoh`); Scandicus ohne angehängtes `v`;
  Climacus beliebig lang (`NEUME_OPEN_ENDED`, «Fertig»/Enter schliesst ab).
- Mora: `fe..` (zwei Punkte nach der letzten Note, GregoBase-Schreibweise) wird als Mora auf **beiden** Noten gelesen,
  exportiert wird die eindeutige Form `f.e.`.
- Ein «*» mit Leerzeichen danach ist ein normales Zeichen, kein Fett-Markup.

## 4. GregoBase und Quellen

- Zugriff über den eigenen Proxy `notator-gregobase-proxy.matthias-krohn.workers.dev` (GregoBase erlaubt keine fremden
  Browser-Origins). Download braucht `format=gabc&elem=1`.
- Kopffelder: `mode` → Annotation, `book` → Untertitel, `office-part` bewusst ignoriert; GregoBase-Importe mit `drop-cap: auto`.
- **Melodie aus GregoBase übernehmen ist meist sicher, Text und Satzzeichen nicht:** Bei einer Vorlage aus einer anderen
  Ausgabe jede Silbe samt Komma, Punkt, æ usw. gegen das Ziel-PDF prüfen (Text-Extraktion), bevor ein Stück als fertig gilt.
- **GregoBase-Akzente weichen vom Druck ab:** Viele Drucke (z. B. Liber Usualis) setzen Akzente auch bei Zweisilbern
  (máter, nóstra, Jésum) und drucken «æ»; GregoBase lässt diese Akzente weg und schreibt «ae» (geprüft am Salve Regina, 15.11.2026).
- Psalmtöne aus jgabc (gemeinfrei); Gloria-Patri-Vorlagen aus GregoBase («Gloria Patri I–VIII»).

## 4a. Silbentrennung (Latein)

- **Regel (festgelegt 15.11.2026, an den Scans des PDF-lesen-Testsets geprüft):** Ein **gedruckter Trennstrich gilt immer**.
  Wo keiner gedruckt ist, gilt die **Solesmes-Konvention**: Konsonantengruppen (ct, mn, pt, gn, st, Konsonant + l/r) gehen ganz
  zur nächsten Silbe – «be-ne-dí-cta», «dí-ctus», «frú-ctus», «San-ctus», «ó-mni-um», «no-stra», «a-gnus»; ebenso sc, ps.
  x bleibt vorne («ex-sul-tá-te»); in «alleluia» ist «ia» eine Silbe («Al-le-lú-ia»).
  Belege im Druck: Graduale «re-ctos», «sol-e-mni-tá-te»; Liber Usualis «bene-dí-ctum».
- **Build 447 (26.11.2026):** `ntPtSyllabify` an rund 12 000 Wörtern (Soll des Testsets + 430 GregoBase-Dateien) geprüft. Korrigiert:
  «quia» blieb ungetrennt (i nach qu galt als konsonantisch) → «qui-a»; «aé/oé» = æ/œ mit Akzent → «saé-cu-la», «praé-mi-um»;
  «-ael» am Wortende getrennt → «Is-ra-el», «Mi-cha-el»; x zwischen Vokalen geht zur nächsten Silbe («Sur-ré-xit», «du-xit» – so im
  Testset gedruckt), nur die Vorsilbe «ex-» behält es («ex-áu-di», «ex-ér-ci-tus»); «Sic-ut» (Build 430); â ê î ô û sind Vokale.
  Bewusst nicht geändert: Vorsilben («Ad-o-ré-mus», «in-i-mí-ci», «sub-le-vá-mus») – die Drucke trennen uneinheitlich; restliche
  Abweichungen (7 %) sind überwiegend klassische statt Solesmes-Trennung in GregoBase («om-nes», «Sanc-tus»).
- Ausnahme: Drucke mit klassischer Trennung (Cantus Mariales 1906: «díg-ni-or», «om-nes») – dort folgt das Soll dem Druck.
- **Fehlender Trennstrich heisst nicht «keine Silbengrenze»** (geklärt August 2026): Ältere Drucke setzen Trennstriche unvollständig,
  z. B. Liber Usualis, Hymnus «Audi benigne Conditor»: gedruckt «Cóndi-tor» (GregoBase und Notengruppen: Cón-di-tor),
  «confi-téntibus» = ein Trennstrich für fünf Silben. Verlässlich ist die **Aufteilung der Notengruppen** über dem Text.
- Umgesetzt in Build 403 (16.11.2026, Auftrag Matthias): `ntPtSyllabify` (`src/js/3-orgel-und-mehr/160-psalmton-assistent.js`;
  Psalmton-Assistent, Strophen, «Text zuerst») gibt den längsten zulässigen Silbenanfang einer Konsonantengruppe an die
  nächste Silbe; Prüfung mit `tests/silbentrennung.test.js` (31 Wörter). Gesetzte Bindestriche im Text haben weiterhin Vorrang.

## 4b. PDF lesen (Stand Testset, 15.11.2026)

- Neuaufbau als Prototyp ausserhalb der App (Plan, Messungen und Soll-Fälle: `docs/pdf-lesen-plan.md`, `tests/pdf-lesen/`; Scans nur lokal, aus dem Drive holen).
- Tonhöhen, Schlüssel und Trennstriche geometrisch; Text per KI, ein Aufruf je Seite.
- **Modell für den Text: Sonnet 5.5** (`effort: low`): nach den Verbesserungen 89 % Silben (3 Läufe, kaum Streuung; Stand 7.11),
  ca. 0.01 USD je Seite – so gut wie Opus 5.5 mit dem früheren Ablauf, bei halben Kosten (Opus mit dem neuen Ablauf
  nicht gemessen). Der anfängliche Akzent-Vorsprung von Opus lag an Fehlern im Soll (GregoBase-Akzente) und an
  Kommas, nicht am Modell (`docs/pdf-lesen-plan.md` 7.8–7.10). Haiku 5.5 ist schlechter als Tesseract.
- **Initialen** können zwei Systeme hoch und breiter als erwartet sein (Zier-«G» Gaudeamus) und stehen auch mitten auf
  der Seite (Hymnus-«A»): bei jedem System suchen; im KI-Bild links vor die Zeile setzen. Im Prompt verlangen, dass jede
  nummerierte Zeile für sich bleibt – sonst zieht Sonnet gelegentlich Zeilen zusammen.
- **Bildausschnitt grosszügig:** Der Textstreifen muss unten Unterlängen und Kommaschwänze enthalten, sonst werden
  Kommas als Punkte gelesen – das sieht aus wie ein Lesefehler der KI. Lange Zeilen teilen statt verkleinern.
- **JS-Fassung (Build 408):** `src/js/2-choral/172-pdf-geometrie.js`, Funktionen `pg…`. Muss sich wie der Python-Prototyp
  verhalten (Test `tests/pdf-geometrie.test.js`). Stolperstellen beim Übertragen: PIL dreht bikubisch mit **a = −1**
  (nicht −0.5) – sonst kippen einzelne Notenköpfe; Python rundet .5 zur geraden Zahl (`pgRound`); im Node-Test
  `vm.runInThisContext` statt eigenem `vm`-Kontext, sonst wird die Bildverarbeitung rund 100-mal langsamer.
- **In der App:** `src/js/2-choral/174-pdf-lesen-neu.js` (Build 409 hinter Schalter, seit Build 410 der einzige Weg;
  Entscheid Matthias 23.11.2026). Der alte Vision-Weg ist entfernt (im Git-Verlauf bis Build 409).
  Stückgrenze = System mit Initiale. Messlauf über die echte
  Oberfläche: `tests/pdf-lesen/run-neu-playwright.js` (`--mock DIR` mit gespeicherten KI-Antworten = kostenlos;
  `--pdfjs DIR`, wenn cdnjs gesperrt ist – in der Cloud-Umgebung der Fall).
- **Modus (Build 411):** nur die Angabe direkt über der Initiale (`pgModeBox`): als Zeile «M<n>» ins KI-Bild, Antwortfeld
  `modes`. Testset: 4 von 7 Stücken richtig; bei Gaudeamus und Salve Regina steht dort keine Angabe.
- **Notenzahl (Build 412, 23.11.2026):** Hauptursache fehlender Noten war die zweite Note senkrechter Paare (Clivis/Pes):
  Das Öffnen des Bildes trennt sie nur als schmalen Rest ab, der als «zu klein» verworfen wurde. Jetzt gilt ein solcher Rest
  direkt über/unter einem Notenkopf als Note, gelesen **nach** seinem Nachbarn. Pauschal kleinere Mindestgrössen schaden
  (mehr Zusatznoten und falsche Tonhöhen). Der Rückstand der App (pdf.js) gegenüber pdftoppm kam von demselben Effekt.
  Diagnose: `globalThis._pgDiag = []` sammelt verworfene Flecken mit Grund. `globalThis._pgNurPrototyp = true` schaltet
  die Ergänzungen ab (Vergleich mit dem Python-Prototyp im Test).
- **Soll-Fassungen und Zeichen:** GregoBase-Soll lässt teils Mora-Punkte weg (Salve mater: keine), Bewertung zählt dort
  richtige Funde als falsch. `[ll:1]`, `[oh:h]` u. ä. in GABC sind keine Noten.
- **Kostengrenze (Entscheid Matthias 23.11.2026):** «PDF lesen» darf höchstens **0.10 USD pro Seite** kosten. Neumenformen
  per KI (Opus ≈ 0.25 USD/Seite, Sonnet ≈ 0.13 USD und ungenau, Versuch 7.17) lohnen sich nicht, weil ohnehin keine
  100 % erreicht werden – nur geometrisch (kostenlos) erkennen; Rest von Hand.
- **Neumenformen (Stand Build 413):** geometrisch erkannt werden Mora-Punkte (77 % gefunden, 80 % richtig) und Virga
  (frei endender Hals rechts; 20 % gefunden, keine Fehlmeldung). Iktus und Episem geometrisch versucht und verworfen
  (Linienreste, Hilfslinien und Hälse sehen gleich aus: 7–18 % richtig). Lieber ein Zeichen weglassen als falsch setzen.
- **♭ (Build 414):** im Bild ohne Notenlinien zerfällt das Zeichen an der Linie in Hals und Bauch – Teile mit gleichem linken
  Rand wieder zusammensetzen (Lücke bis Liniendicke + 0.25 Linienabstand). Tonhöhe aus dem Bauch, gehört zur nächsten Note.
- **Gegenprobe (Build 415, 23.11.2026):** Regeln, die nur am Testset entstehen, überprüfen. Auf zwei neuen Seiten
  (Parce Domine, Tu es Petrus; `cases/`) hielt die Paar-Regel Iktus-Striche (schmal, doppelt so hoch wie breit) für Noten.
  Seither: Notenrest 0.23–0.40 Linienabstände breit, Höhe/Breite 0.85–1.7. Eine Regel «Note im ♭-Kasten entfernen»
  half der Gegenprobe, schadete aber dem Testset (falsche ♭ entfernen echte Noten) – verworfen.
  Neue Testseiten: Scans im Drive-Ordner über «Notator», Soll aus der gleichnamigen `.notator`-Datei im Unterordner
  (in Notator laden, `gregBuildGABC()`, auf die gedruckten Systeme verteilen, Akzente nach dem Druck). Achtung: gleicher
  Name heisst nicht gleiches Stück (Ostende nobis: Antiphon im Scan, Alleluja in der Datei), Orgelsätze sind keine Quadratnotation.
- **Gegenprobe 2 (Build 416, 23.11.2026):** Systemsuche hatte drei Annahmen, die das Testset nie verletzte: eine Spalte je Seite,
  ein Linienabstand je Seite (±25 %), Systeme reichen über die Seitenmitte. Seither: Doppelseite teilen, wenn in der Mitte (40–60 %)
  eine Stelle liegt, durch die fast kein System läuft (`pgColumnSplit`; Toleranz 0.3 Linienabstände wegen Schräge); Linienabstand je
  System (70–160 % des Seitenwerts – die handgeschriebene Zeile bei Tu es Petrus hat 62 %, das gedruckte Gloria bei Signum magnum 74 %);
  zusätzlich links/rechts nach Linien suchen. Typischer Abstand nur aus gleichmässigen Vierergruppen: pdf.js liefert Textzeilen
  (englische Übersetzung) als Linienkandidaten, die den Median verdarben – mit pdftoppm trat das nicht auf, also immer **in der App** messen.
  Ein Druck mit gleichem Titel kann eine andere Melodie haben (Vox clara: dominikanisch c4 im Scan, monastisch c3 in der Datei) – Soll dann vom Druck ablesen.
- **Gegenprobe 3 (Build 417, 23.11.2026):** Feste Grössengrenzen brechen beim nächsten Druck (Gloria-Systeme mit 69 % fielen
  unter die 70 % aus Build 416). Besser ein Merkmal: abweichend grosse oder nur am Rand gefundene Systeme gelten nur mit erkanntem
  Schlüssel – und sie dürfen die typische Notenkopfgrösse der Seite nicht mitbestimmen (sonst wurde bei Tu es Petrus ein Fleck zur Note).
  In feinem Druck beginnen die Linien bis 0.6 Linienabstände vor dem Schlüssel (Suchfenster jetzt 0.9). Senkrechte Scannerstreifen
  am Rand sind keine Initiale (Mindestbreite 0.6 Linienabstände). Vergleich mit Build 416: alle älteren Fälle unverändert.
  Der Prototyp-Vergleich (`tests/pdf-geometrie.test.js`) lässt seither 1 Note/Textgruppe Unterschied je System als Hinweis zu
  (Rundungs-Grenzfall bei ad-te-levavi).
- **Gegenprobe 4 (Build 418/419, 23.11.2026):** Handschriftliche Akkordbuchstaben über den Systemen sind auf vielen Blättern
  von Matthias (Campion, Vox clara, Dominus dixit): «B», «Es» ergaben falsche ♭, Federstriche falsche Divisiones minimae.
  Seither ♭ nur auf der b-Stufe des Schlüssels (`pgBSteps`, beide Oktaven) und Divisio minima nur ab 0.05 Linienabständen
  mittlerer Strichbreite (gedruckt 0.09–0.21; die Regel spart netto 5 von 63 Trennstrich-Fehlern, kostet aber einzelne feine
  echte Striche). Was die KI auf Anweisung weglässt (Strophennummer, ℣, Ps.), steht trotzdem als Tinte im Bild und verschob die
  Silbenzuordnung – deshalb liefert die KI diese Zeichen jetzt mit (`PG_SIGN_RE`), sie dienen nur der Zuordnung. Eine Regel
  «Textgruppen links der ersten Note weglassen» war falsch: dort steht auch echter Text ohne eigene Noten («Ma-» in Salve mater).
  Neusatz-Drucke (Surrexit) und GR-Satz mit F-Schlüssel werden fast fehlerfrei gelesen; schwierig bleiben blasse, handbeschriebene Scans.
- **Gegenprobe 5 (Build 420, 23.11.2026):** ♭ am Systemanfang direkt nach dem Schlüssel (Antiphonale Monasticum, Gaudeamus)
  fiel in die Schlüsselzone – die Sperrzone für ♭ ist jetzt 0.5 statt 1.2 Linienabstände. Zwei Soll-Dateien des Testsets hatten
  diese ♭ nicht (Gaudeamus «no,», Surrexit «tu-i») – nachgetragen. **Soll-Lehre:** GregoBase schreibt Phrasenenden teils als Iktus +
  Episem («f'_»), wo der Druck einen Mora-Punkt hat (Cantus selecti, Mittit) – vermeintliche Fehlfunde erst am Druck prüfen.
  Bei schwer lesbaren Vorlagen (blass, handbeschrieben, melismatisch) lieber den Fall weglassen oder auf den sicher ablesbaren
  Teil zuschneiden, als ein unsicheres Soll zu messen.
- **Neumentypen (Runde 6, Build 422, 24.11.2026; Hinweis Matthias: «Porrectus statt Torculus»):** `evaluate.js` meldet jetzt
  den Neumentyp je Silbe und die häufigsten Verwechslungen. Bei richtiger Notenzahl stimmt der Verlauf fast immer (99–100 %); falsche
  Typen entstehen fast nur durch fehlende/zusätzliche Noten und durch verrutschte Silbenzuordnung. Die Reihenfolge abgetrennter
  Notenreste («hinter den Nachbarn», Build 412) ist in den Testdrucken richtig: «übereinander = von unten nach oben» machte
  13 Clivis zu Pes – verworfen. Silben ohne Noten kosten bei der Zuordnung jetzt 4 statt 0.8. F-Schlüssel 1.76–1.96, C-Schlüssel
  0.66–1.18 Notenkopfbreiten (Grenze 1.5). Soll-Quelle für neue Testseiten: GregoBase (`gregobase.selapa.net` in der
  Cloud-Umgebung freigegeben; Index über `incipit.php?letter=X`, Download `download.php?id=N&format=gabc&elem=1`).
- **Runde 7 (Build 423, 24.11.2026):** Systemgrössen auf einer Seite können sich fast verdoppeln (Campion: Antiphon 61 px,
  Psalmvers/Gloria 33 px Linienabstand) – erlaubt sind jetzt 45–220 % des typischen Abstands (`PG_SYS_MIN/MAX`), Abstände bis 100 px;
  abweichende Systeme (unter 80 % oder über 125 %) gelten weiter nur mit erkanntem Schlüssel. Prototyp-Vergleich: 1 Trennstrich
  Unterschied je System gilt als Hinweis (Grenzfall auf der Liber-Seite Terribilis, schon vor Build 423).
- **Runde 8 (Build 424, 24.11.2026):** Die «– Choral.pdf»-Dateien im Drive sind Campion-Scans (pdf-lib), keine Notator-Exporte;
  teils vereinfachte Melodien (Soll dann vom Druck). Über dem System: eine lange Hilfslinie war dicht genug, um als Textzeile zu
  gelten – oberhalb braucht eine Textzeile jetzt 0.3 Linienabstände Höhe; unterhalb unverändert (sonst Text als Noten, Ave Maria).
  Noten ab Stufe l brauchen eine seitlich überstehende Hilfslinie (sonst Handschrift). Neumentyp-Fehler sind über alle 28 Fälle
  weiter v. a. fehlende/überzählige Einzelnoten an Silbengrenzen, nicht vertauschte Reihenfolge.
- **Runde 9 (Build 425, 24.11.2026):** Viele falsche Neumentypen kamen von ausgelassenen Silbentrennungen der KI (zwei Neumen auf
  einer Silbe). `pgResyllabify` teilt nur Wortteile mit ≥ 2 Vokalgruppen per `ntPtSyllabify`; Ausnahmen: «saé-cu-la/caé-lum»
  (æ mit Akzent bleibt beisammen), «san-guis» (gu nach n). `pgRepairMerged`: Zeile leer und Vorzeile übervoll → nach Breite der
  Textgruppen teilen. Fünfliniensysteme: pro Seite entscheiden (≥ 60 % der Systeme mit fünfter Linie) – eine Textzeile im Linienabstand
  unter einem System hatte bei Puer natus sonst ein System gelöscht. Bleistiftnotizen neben dem Schlüssel können ihn als F-Schlüssel
  erscheinen lassen; fürs Stück zählt die Mehrheit der Systeme.
- **Runde 10 (Build 426, 24.11.2026):** Gerasterte (graue) Notenköpfe werden von pdf.js hell dargestellt; die zweite Note einer
  Clivis zerfällt dann zu einem 10×10-px-Rest (O gloriosa). Eine Regel «Rest rechts tiefer neben einem Notenkopf = Note» half dort,
  erzeugte aber in 11 älteren Fällen Zusatznoten (Notenzahl 73 → 65 %) – verworfen. Offene Richtung: Schwelle/Schliessen für helle
  Notenköpfe statt Regel für Reste. Moderne Noten (Puer natus, Dies irae, Regina caeli mit Orgelsatz) werden sauber abgewiesen.
- **Bilanz Runden 6–10 (Builds 422–426):** über alle 33 Fälle Notenzahl 70 → 72 %, Gruppierung exakt 43 → 57 %, Neumentyp je Silbe
  91 → 93 % (bei richtiger Notenzahl stimmt der Verlauf zu 99 %), Silben 89 %, Schlüssel 100 %. Torculus/Porrectus-Verwechslungen:
  1 von 782 Neumen im ganzen Testset.
- **Moderne Noten (Build 427, Meldung Matthias 24.11.2026):** Bei schiefen, blassen Fotokopien fehlt die fünfte Linie unter den
  Linienkandidaten, und oft wird nur ein einziges System gefunden – die Seitenregel aus Build 425 (≥ 2 Systeme) griff nicht. Jetzt
  wird die fünfte Linie im Bild gesucht: Bedeckung der Zeile im Linienabstand ≥ 85 % der Bedeckung der eigenen Linien. Einzelne
  Treffer gibt es auch bei Choral (Trennlinie unter dem letzten System bei Virgo Dei Genitrix, Handschriftzeile bei Tu es Petrus) –
  deshalb gilt die Seite nur bei klarer Mehrheit als moderne Notation. Wunsch Matthias: Dateiauswahl erst über «PDF wählen».
- **Build 428 (24.11.2026):** Der Dialog aus Build 427 stürzte ab (`showModal(title, body)` ohne Knopfliste → `btns.forEach`); der App-Test hatte nur den Dialogtext geprüft, nicht die Statuszeile danach. Lehre: bei Meldungs-Tests auch auf `pageerror`/Konsolenfehler achten. `showModal` setzt jetzt «OK», wenn keine Knöpfe angegeben sind.
- **Zweiter Durchgang (Build 429, 24.11.2026, Auftrag Matthias):** Testscans und KI-Antworten liegen nur in der Cloud-Umgebung einer
  Sitzung – in einer neuen Sitzung aus dem Drive neu holen (Ordner `1na4i6KGlePisA8ENF0tQU6mOdrBnd_PO`, Quelle steht in `expected.json`
  unter `source`; zugeschnittene Fälle per CropBox mit pypdf nachschneiden). «Audi benigne», «Viderunt» und «Surrexit/Ad cenam» liessen
  sich nicht eindeutig wiederfinden (fehlen in der Messung). Abstimmung über drei Schwellen (Hauptschwelle ±18): Hauptnote bleibt bei
  2 von 3; ergänzt wird nur, was der **helle** Durchgang an der Stelle eines verworfenen «kleinen» Rests sieht (graue Köpfe,
  O gloriosa +22 %), nicht über der obersten Linie (Akkordbuchstaben). Funde nur der Zusatzdurchgänge ohne Rest waren Striche.
  Breitenregeln trennen echte und falsche Ergänzungen nicht (beide 0.5–0.7 der Kopfbreite). Markierung «⚠ prüfen»: 70 % der
  markierten Systeme haben einen Notenfehler (unmarkiert 37 %), erfasst aber nur gut ein Drittel der Fehler.
  **Modus:** Die KI rechnete «2.», «HYMN I.», «Intr. 2.» nicht um und lieferte leer – jetzt wörtlich liefern lassen, umrechnen in
  `pgModeFromText`. Modus links neben dem ersten System ohne Initiale (Ubi caritas «VI») und kleine Initialen (Tu es Petrus) offen.
  **Virga** abgeschaltet (`globalThis._pgVirga` schaltet ein): 12 % gefunden, 39 % richtig; strengere Halslänge machte es schlechter.
  **Mock-Läufe:** Die KI lässt manchmal eine Zeile aus; gespeicherte Antworten müssen die Zeilennummer behalten (früher verschob
  sich danach alles). Für Vergleiche immer beide Fassungen mit denselben gespeicherten Antworten messen (Mock gegen Mock).
- **Build 430 (25.11.2026, Meldungen Matthias, Runden 11–12):** Keine «⚠ prüfen»-Notizen auf dem Handy war kein Fehler: bei sauberen
  Campion-Drucken sind sich die drei Durchgänge fast immer einig. Deshalb markieren jetzt auch Silben ohne Noten (verrutschte Zuordnung).
  «Ps.», «Vs.», ℣, ℟ bleiben als Anweisung im GABC (`pgSignDirective`; Auswertung ignoriert sie), Strophennummern nicht. Zeichen dürfen nie
  mit dem Folgewort eine Textgruppe teilen (sonst verschob «℣. In» die ganze Zeile); eine Textgruppe kann bis 8 Silben tragen («tri-bulati-óne»).
  Lehren: kurze Systeme stehen auch zwischen Rand und Mitte; in unscharfen Kopien zerfallen Trennstriche in Stücke (zusammensetzen);
  ein Custos am Zeilenende sah wie ein Mora-Punkt aus; gedrehter Randtext rechts vom System zog Silben an sich (Textgruppen > 3 Linienabstände
  rechts der letzten Note zählen nicht); die KI schlägt die Fortsetzungszeile «N+» manchmal der nächsten Zeile zu (zu kurze + zu lange
  Zeile → nach Breite neu verteilen). Ersatzweg nur bei 0 Systemen: Schräge per Projektion, Schwelle 200, Linienschwelle 0.25, System
  auch aus 3 von 4 Linien – die fünf Blätter mit moderner Notation werden weiter abgewiesen. «Sic-ut» ist die Trennung der Choralbücher.
- **Runde 13 (Build 431, 25.11.2026):** Manche Drucke setzen jedes System in zwei Hälften – alle Linien haben in der Mitte eine schmale Lücke;
  ein Bundsteg ist mindestens 1.5 Linienabstände breit. Auf blassen Seiten fehlen einzelne Linien nur in einem Teil der Seite: Nachsuche
  mit Schwelle 200 und 3-von-4-Linien, solche Systeme nur mit Schlüssel; Ausdehnung mit beiden Schwellen messen (längere gilt). Eine
  Linie im Linienabstand neben dem System (Strich unter der Übersetzung) kann als Notenlinie genommen werden: aussen ist die Seite ohne
  Tinte zwischen den Linien. Grössere Lücken in den Linien zuzulassen half Asperges, schob aber bei Gaudeamus das System in die
  Zierinitiale – verworfen. Echte Divisio minima endet unten bei Stufe 4.9–5.1, Unterlängen der Textzeile darüber bei ≥ 5.8.
- **Runde 14 (Build 432, 25.11.2026):** Ein fast vollflächig schwarzer, hoher Fleck links vom System ist der Schatten vom Buchrücken,
  keine Initiale (Füllgrad > 0.75 bei > 4 Linienabständen). Der Hals der ♭-Vorzeichnung direkt nach dem Schlüssel (≥ 1.4 Linienabstände)
  wurde als Trennstrich gelesen – vor der ersten Note gibt es keinen Trennstrich. Divisio minima endet unten bei Stufe ≤ 5.75 (unscharfe
  Kopien), Unterlängen der Textzeile darüber bei ≥ 5.84. **Mess-Lehre:** `cmp.py` muss auch die Trennstriche vergleichen – eine Regel
  (Hals-Test ohne schmale Flecken) änderte die Trennstriche in fast allen Fällen, ohne dass Noten/Silben sich rührten. Soll für Tota pulchra
  aus der eigenen Lesung, am Druck mit eingeblendeten Linien geprüft (100 % dort nur bedingt aussagekräftig).
- **Runde 15 (Build 433, 25.11.2026):** In schmalem Satz steht die erste Note innerhalb der festen Schlüsselzone (1.2 Linienabstände) –
  rechten Rand des Schlüssels aus den Flecken am Systemanfang bestimmen (Suchfenster 0.9 wie `pgFindClef`, sonst fallen Schlüsselteile in
  feinem Druck heraus); ein ♭ direkt hinter dem Schlüssel darf dabei nicht zur Note werden. 37 von 304 Soll-Systemen enden mit einem
  echten Trennstrich – Abschlussstriche am Systemende lassen sich nicht pauschal streichen.
- **Runde 16 (Build 434, 25.11.2026):** Modus links vom ersten System ohne Initiale (`pgModeBoxLeft`, nur oberstes nicht abweichendes System).
  ♭ vor den Mora-Punkten suchen und deren Fläche ausschliessen (Stabat Mater: ♭-Teil als Mora der Vornote). Die Systembreite mit 3 von 4
  Linien auf heller Schwelle zu messen half Pueri «portantes», liess das System aber in Textspalten laufen (Inviolata) – verworfen.
  Ein grosser Buchstabe in der Textzeile unter dem Systemanfang («D» bei Psalm 23) ist keine Initiale. Gegenproben für moderne Notation
  liegen nur im Scratchpad der Sitzung (9 Blätter aus dem Drive: Benedictus, Christus vincit, Dies irae, Ite missa est, Puer natus,
  Regina caeli simplex, Jesu dulcis, Kyrie XII, Victimae paschali) – vor jedem Build prüfen.
- **Versuch feineres Öffnen (25.11.2026, verworfen):** Schlanke, gerasterte Notenköpfe (Rorate caeli) zerfallen beim Öffnen in
  10×10-px-Reste. Kleinerer Kern für alle Systeme: Notenzahl 75 → 64 % (Linienreste werden Noten); als vierter Durchgang nur an Stellen
  verworfener Reste: 75 → 71 %, auch auf Systeme mit vielen Resten beschränkt noch 73 %. Rorate bleibt offen.
- **Runde 17 (25.11.2026, ohne Code-Änderung):** Te Deum (einfacher Ton, Webausdruck mit Akkorden) blind 91 % Notenzahl, 100 % Silben.
  Veni Sancte Spiritus war ein Orgelsatz (10. Gegenprobe, abgewiesen). Popule meus (Doppelseite mit je zwei kurzen Systemen
  nebeneinander, «Hagios | Sanctus») ist als Fall ohne Soll abgelegt – nebeneinanderstehende Systeme werden nicht getrennt (offen).
- **Build 435 (25.11.2026):** «⚠ prüfen»-Notizen (`pgUnsure`) werden rot/fett gezeichnet und 110 Einheiten über dem Anker gesetzt;
  bei −30 lagen sie in der Handy-Ansicht auf der Textzeile und waren blassbraun kaum zu sehen.
- **Strophen untereinander (Build 436, 25.11.2026, Auftrag Matthias):** `pgVerseLines` sucht unter der ersten Textzeile weitere
  Textzeilen gleicher Höhe (Zeilendichte, bis 1.6 Linienabstände vor dem nächsten **nicht abweichenden** System – sechs Strophenzeilen
  ergaben bei Tota pulchra sonst ein Schein-System). Sie kommen als Zeilen «N.k» (k = Strophe) ins KI-Bild, Antwortfeld `verses`;
  geteilte lange Zeilen («N.k+») muss der Prompt ausdrücklich erklären, sonst lieferte Sonnet bei Salve mater gar keine Strophen.
  `pgApplyVerses` verteilt die Silben je System auf die Noten-Plätze (`gregVerseSlots`/`gregVerseApply`); passt die Platzzahl nicht
  zum Stück, werden keine Strophen übernommen. Fehlen Noten (Geometrie), landen überzählige Silben auf dem letzten Platz des Systems.
  Strophentext wird nicht ausgewertet (kein Soll); Mock-Läufe ohne `verses` bleiben unverändert.
- **Build 437 (25.11.2026, Meldung Matthias: Salve mater auf dem Handy schlecht, Titel fehlt):** Die KI antwortet nicht immer gleich:
  in einem von vier Läufen setzte sie die Strophenzeilen «4.2», «4.3» als Hauptzeilen der Systeme 5 und 6 ein (Beschriftung «N.k» sah
  aus wie eine Strophennummer). Seither heissen die Reihen «4b», «4c» …, und beginnt eine Hauptzeile unter einem System mit weiteren
  Textzeilen mit «2.»–«9.», wird einmal neu gelesen (stimmige Antwort gewinnt). Strophennummern werden wie bei der Handnummerierung
  vor die erste Silbe gesetzt (`NT_VS_NUM`). **Titel:** Bereich über dem ersten System eines Stücks als Reihe «T<n>» (bis 9 Linienabstände,
  nicht über das vorige System hinaus); KI liefert Titel ohne Nummer («393. SALVE MATER» → «Salve Mater») und Untertitel («In hon. B.M.V.»),
  Kopfzeilen `name:`/`notator-subtitle:`. **Systemanfang:** Beginnt ein System > 3 Linienabstände rechts vom typischen Anfang, links
  mit heller Schwelle und 3 von 4 Linien nachsuchen (nur bis zum typischen Anfang, nicht vollflächig) – die Linien waren dort blass und
  leicht gebogen. «1.-6.» als Zeichen (`PG_SIGN_RE`) verschlechterte die Zuordnung bei Tota pulchra – verworfen. Ob die Kehrvers-Wiederholung
  auf dem Handy-Screenshot dieselbe Ursache hatte, ist nicht belegt (die KI-Antwort von dort liegt nicht vor).
- **Build 438 (25.11.2026, Meldung Matthias):** Eine Silbe ohne Note («trans») ist im Strophen-Assistenten kein Platz – die weiteren
  Strophen lassen sich dort nicht zuordnen. Ursache war eine fehlende Note: blasse Notenköpfe **auf** einer Notenlinie zerfallen beim
  Entfernen der Linie in 2–3 Stücke, die einzeln als «klein» wegfallen. Jetzt gelten übereinanderliegende Stücke, die eine Notenlinie
  trennt, zusammen als Note, wenn sie notenkopfgross sind (0.35–0.8 × 0.45–0.85 Linienabstände, Fläche ≥ 0.3 Kopffläche); ein drittes
  Stück daneben wird angefügt. Dieselbe Regel ohne Linie dazwischen (zerfallene Köpfe in sprenkligem Druck, «sú-pe-ris») erzeugte
  Zusatznoten in Dominus dixit und Justorum animae (−25 %) – verworfen. Vor dem ersten System mit Strophen steht jetzt ein Doppelstrich,
  wenn das System davor ohne Trennstrich endet (Kehrvers-Wiederholung | Strophe; der Assistent erkennt «1.» nach Doppelstrich als Vorlagenbeginn).
- **Build 439 (25.11.2026):** Titel-Lesung an 8 Stücken live geprüft: Lieder/Hymnen richtig («Tota pulchra», «Attende, Domine»,
  «Stabat Mater»); bei Proprien liefert die KI Gattung («Introitus. I.») oder Anlass («In ipsa ecclesia dedicata») – passt kein Wort
  (≥ 4 Buchstaben) des gelesenen Titels zu den ersten 8 Textwörtern oder fehlt er, wird der Textanfang bis zum ersten Satzzeichen
  (max. 4 Wörter, über Systemgrenzen zusammengesetzt, Initial-Grossbuchstaben normalisiert) Titel und das Gelesene Untertitel.
  **«⚠ prüfen»:** `dy −110` von der Note aus lag im Textbereich des **vorigen** Systems – bei Strophen mitten in deren Zeilen. Jetzt
  `lineTop − 32` (oberer Rand des eigenen Systems, `gregResolveAnchorPosition` liefert `lineTop`), am PC und in der Handy-Ansicht geprüft.
- **Build 440 (25.11.2026):** Systeme, deren Strophenzeile mehr/weniger Silben hat als Notenplätze, bekommen «⚠ prüfen» (am Systemende;
  in Salve mater, Tota pulchra, Attende waren diese Systeme schon markiert). **Grenze Conditor alme:** zwei Systeme fehlen, weil die
  Notenlinien dort im Scan nur noch als Pünktchen erscheinen (keine Zeilenspitze in der Projektion, auch nicht mit Schwelle 200) – die
  Notenköpfe sind deutlich. Ein System aus Notenköpfen statt Linien zu erschliessen wäre möglich, aber ein grösserer Umbau (offen).
  Gaudeamus: niedrige Werte sind vor allem ein Messartefakt (Gloria Patri als eigenes Stück mit Initiale, Soll als ein Stück).
- **Build 441 (25.11.2026):** Die in Build 438 verworfene Variante «Stücke ohne Linie dazwischen» geht mit zwei Bedingungen: Höhe ≤ 1.2 × Breite
  und Mitte innerhalb des Systems (±0.3 Linienabstände). Die Fehlfunde in Dominus dixit/Justorum animae waren 1.3–1.4-mal so hoch wie
  breit (♭-Teile, Striche über dem System), echte Köpfe 1.0–1.05. Mock-Messung: nur Salve mater +1 %, sonst unverändert; Gegenproben abgewiesen.
- **Build 442 (25.11.2026):** Der obere Hals eines ♭ wurde als Note eine Stufe über dem Bauch gelesen («Sán(h)cte(jix…)», Media vita, 6×).
  Eine Note im ♭-Kasten wird jetzt entfernt, aber **nur genau eine Stufe über dem Bauch** – die allgemeine Regel «Note im ♭-Kasten
  entfernen» (Build 415) hatte echte Noten gekostet, damals noch mit vielen falschen ♭ (vor der b-Stufen-Regel aus Build 418).
  Mock-Messung: Media vita +30 %, Inviolata +12 % Notenzahl, keine Verluste; gesamt 75 → 77 %, Tonhöhen 95 → 96 %.
- **GABC-Rundlauf (Build 443, 26.11.2026):** `tests/gabc-rundlauf.test.js` importiert/exportiert alle Soll-Stücke zweimal; vorher waren
  62 von 63 stabil (Media vita verlor «vé…runt»). Gewollte Vereinheitlichungen beim Export: «ed..» → «e.d.», «/» zwischen Neumenteilen,
  ♭ als eigene Gruppe vor der Silbe («(ix)á(i)»).
- **GregoBase-Stichprobe (Build 444, 26.11.2026):** 150 zufällige GregoBase-Dateien importiert/exportiert (Skript nur im Scratchpad):
  vorher 34 auffällig, danach 14 – der Rest sind TeX-Befehle in `<v>…</v>` («\greheightstar», «\textcolor»), die Notator bewusst
  nicht darstellt, und Kopfzeilen. Rohform-Zerlegung (`gregGabcRawTokens`) muss sich genau wie exsurge verhalten (eine Rohnote je
  exsurge-Note), sonst verschiebt sich die Zuordnung «Original-gabc je Note» auf die Nachbarsilben. Alte gespeicherte Rohformen mit
  «vv»/«ss» werden beim Export ignoriert.
- **Build 445 (26.11.2026):** Zweite GregoBase-Stichprobe (277 Dateien): verbleibende Abweichungen sind TeX in `<v>…</v>`, Kopfzeilen und
  seltene Trennstrich-Schreibweisen («rí(c:)a», «sti,(i)* (,)»), bei denen sich nur der Abstand einmal ändert. Orgelfassung (`clGabcToAbc`,
  mit/ohne Begleitsatz) und Choral-Notenbild für 150 Dateien ohne Absturz bzw. leeres Bild; eingebauter Selbsttest 20/20.
- **Build 446 (26.11.2026):** Zwei Noten übereinander (Pes/Clivis in einem Fleck) erst ab 0.9 statt 0.8 Linienabständen Höhe – ein an der
  Linie hängender Einzelkopf (Attende, ~0.85) wurde sonst zu zwei Noten. 0.95 brachte Attende +50 %, kostete aber Ad te levavi – 0.9 ohne Verluste.
- **Build 448 (26.11.2026):** Bisher hängte jede Eingabe ans Ende an (`gregEntries.push`); jetzt zentral über `gregAddEntries`
  (`055-einfuegemarke.js`), das auch Notiz-Anker (`anchorNoteIdx`, Notennummer) hinter der Einfügestelle mitverschiebt. Notengruppe ↔
  Eintrag ist 1:1 (der Import zerlegt Melismen in einzelne Einträge), darauf beruht die Position beim Tippen zwischen Neumen.
  Gefundener Fehler: Der ältere Export (`buildSingleNeumeGABC`, ohne `e.notes`) gab nur so viele Töne aus, wie der Neumentyp vorsieht –
  ein im Feld «Töne» zu einem Punctum ergänzter Ton fiel weg. Jetzt passt sich der Typ beim Übernehmen an (`gregNeumeFromPitches`),
  und überzählige Töne werden angehängt statt verworfen.
- **Custos** lässt sich nicht an der Tonhöhe erkennen (oft wiederholt die Melodie den Ton ohnehin); in manchen Drucken sieht er
  aus wie eine Note. Versuch verworfen (Build 414).
- API-Key in der Cloud-Umgebung als `NOTATOR_API_KEY` hinterlegen: `ANTHROPIC_API_KEY` kommt dort leer an.

## 5. Entscheidungen von Matthias (gelten, bis er sie ändert)

Allgemein
- **Einfügen (Entscheid 26.11.2026, Build 448):** Neue Elemente kommen an die Einfügemarke («⇤ davor»/«danach ⇥» im Notenfenster) oder an
  die getippte Stelle zwischen zwei Neumen; ohne Marke und rechts der letzten Note wie bisher ans Ende. Eingefügte Noten gelten als
  **neue Einträge** (Silbe aus dem Silbenfeld), wie am Ende hinzugefügte. Töne einer bestehenden Silbe ergänzt man im bestehenden
  Eintrag («Töne per Klick» oder Feld «Töne»).
- Ablage: Google Drive (Liturgie › Notator) ist die Hauptablage, die Browser-Kopie nur Offline-Zwischenspeicher; Anmeldung per Google-OAuth.
- Vorrang: Handy-Tauglichkeit und Teilen mit anderen; Hauptnutzer ist Matthias selbst.
- **Speichern unter** wie in Word/Excel: danach arbeitet man in der neuen Datei, das Original bleibt auf dem letzten
  Speicherstand. Neue Abschnitte ändern nie den Dateinamen.
- Vorgeschlagene Dateinamen (PDF, ABC, MusicXML, Teilen) kommen vom **Namen der Notator-Datei**, nie vom aktiven Abschnitt.
- Gelöschte Drive-Dateien (Papierkorb) erscheinen nicht in der Bibliothek; beim Öffnen Warnung und rote Markierung.
- «Freitext» heisst «Notiz» (standardmässig nicht im PDF).
- API-Key für «PDF lesen» (Wunsch Matthias 24.11.2026, Build 421): im API-Feld per Häkchen «merken» im localStorage
  (`notator-anthropic-api-key`), nicht im Drive und nicht in Notator-Dateien. Gleiches Risiko wie das Google-Token (gemeinsame Origin).

Choral
- ♭ gilt standardmässig bis zur nächsten Divisio (Solesmes-Regel per Schalter).
- Ausgeblendete Abschnitte fehlen in Anzeige, Choral-PDF, Orgelansicht und Orgel-PDF; die Wiedergabe bleibt unverändert.
- PC: Seitenansicht – Blatt in A4-Breite mittig, Breite an den Blatträndern ziehbar, je Stück gespeichert;
  bestehende Stücke behalten ihre Breite. Bildschirm und PDF haben dieselben Zeilenumbrüche. Handy unverändert.
- Handy: frühere 50 % Anzeigegrösse = neue 100 %.
- Strophen: Text untereinander unter derselben Melodie oder eigene Noten je Strophe, umschaltbar.
- Alleluja-Vorlagen (wie Gloria Patri): recherchiert, **zurückgestellt** (GR 1961: rund 300 Allelujas, 170 Melodien,
  51 mehrfach; häufigste Typen Modus II «Dies sanctificatus», VIII «Dominus in Sina», IV «Ascendit Deus»).

Orgel
- Orgelfassung: Melodie in Achteln, Transposition nach Finalis; **Begleitsatz standardmässig an** (Regelwerk: `docs/begleitsatz-regelwerk.md`).
- Die Orgelfassung hat eigenen Titel/Untertitel, sobald bearbeitet – nie zurück in den Choral synchronisiert.
- Mappe: Choral und Orgel getrennt mit eigenem PDF; Orgel standardmässig **mit Begleitsatz, ohne eigenes Pedalsystem**.

## 6. Umfeld

- NOH-Notenbibliothek liegt im selben Repo unter `noh/` (eigener Chat «Digitale Musiknotenbibliothek erstellen»); Notator und NOH verlinken sich.
- Schola-Planer und Gesangs-App laufen auf derselben Origin `krohnoshub.github.io` und teilen das Google-Token (siehe Sicherheit in `CLAUDE.md`).

- Vergleichbare Programme (Recherche 17.08.2026): Gregorio/GregorioTeX (Textcode → PDF via LaTeX), Illuminare Score Editor
  (Web, Textcode mit Vorschau, kein Offline-Modus), Square Note und Chant Tools (Apps fürs Lesen/Abspielen, kein echter Editor).
  Alleinstellung von Notator: Neumen per Klick setzen sowie GregoBase-Anbindung und «PDF lesen» aus gedruckten Büchern;
  die Forschung zur Notenerkennung zielt auf mittelalterliche Handschriften, nicht auf moderne Drucke.

## 7. Veraltet – nicht mehr anwenden

Aus der Zeit vor GitHub Pages stammen: versionierte Dateien `Notator_XXX.html`, die «Test-Bibliothek» mit Archiv-Ordner,
`Notator_starten.bat`/`notator_server.py` (lokaler GregoBase-Proxy), Upload über die GitHub-Weboberfläche und
Syntax-Checks per `new Function`. Heute: `src/` + `build.py`, direkte Pushes nach `main` (siehe `CLAUDE.md`), CSP.
