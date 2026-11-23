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
- **Custos** lässt sich nicht an der Tonhöhe erkennen (oft wiederholt die Melodie den Ton ohnehin); in manchen Drucken sieht er
  aus wie eine Note. Versuch verworfen (Build 414).
- API-Key in der Cloud-Umgebung als `NOTATOR_API_KEY` hinterlegen: `ANTHROPIC_API_KEY` kommt dort leer an.

## 5. Entscheidungen von Matthias (gelten, bis er sie ändert)

Allgemein
- Ablage: Google Drive (Liturgie › Notator) ist die Hauptablage, die Browser-Kopie nur Offline-Zwischenspeicher; Anmeldung per Google-OAuth.
- Vorrang: Handy-Tauglichkeit und Teilen mit anderen; Hauptnutzer ist Matthias selbst.
- **Speichern unter** wie in Word/Excel: danach arbeitet man in der neuen Datei, das Original bleibt auf dem letzten
  Speicherstand. Neue Abschnitte ändern nie den Dateinamen.
- Vorgeschlagene Dateinamen (PDF, ABC, MusicXML, Teilen) kommen vom **Namen der Notator-Datei**, nie vom aktiven Abschnitt.
- Gelöschte Drive-Dateien (Papierkorb) erscheinen nicht in der Bibliothek; beim Öffnen Warnung und rote Markierung.
- «Freitext» heisst «Notiz» (standardmässig nicht im PDF).

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
