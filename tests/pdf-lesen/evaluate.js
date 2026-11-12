#!/usr/bin/env node
// Bewertungs-Werkzeug fuer «PDF lesen» (Notator) — ohne Abhaengigkeiten.
//
// Vergleicht erkanntes GABC (Laeufe) mit dem erwarteten GABC (Testset) und
// misst die Streuung ueber Wiederholungslaeufe. Format: siehe README.md.
//
//   node tests/pdf-lesen/evaluate.js                    alle Faelle, alle Laeufe
//   node tests/pdf-lesen/evaluate.js --runs <ordner>    nur eine Lauf-Serie
//   node tests/pdf-lesen/evaluate.js --json <datei>     Bericht zusaetzlich als JSON
//   node tests/pdf-lesen/evaluate.js --selftest         Selbsttest der Metriken
//
// Dieses Skript ruft KEINE API auf und veraendert keine Dateien ausser --json.
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const CASES_DIR = path.join(ROOT, 'cases');
const RUNS_DIR = path.join(ROOT, 'runs');

// ── GABC einer Systemzeile zerlegen ─────────────────────────────────────
// Bewusst dieselbe Grundregel wie omrParseGabcSystemLine in index.html
// (Text direkt vor einer Klammer = Silbe, leere Klammer davor = Trennstrich
// o. Ae.), aber strenger beim Zaehlen: Vorzeichen (ix, iy, i#), Custos (z0,
// j+) und Schluessel (c3, f3, cb3) sind KEINE Noten.

const BAR_RE = /^(?:::|:\??|;[1-8]?|,[_0]?|`|\^)$/; // (,) (;) (:) (::) inkl. Varianten
const CLEF_RE = /^(?:c|f)b?[1-4]$/;

function notesOf(pitchField) {
  let s = pitchField
    .replace(/\[[^\]]*\]/g, '')   // [ob:...] u. Ae.
    .replace(/z0/g, '')            // automatischer Custos
    .replace(/[a-m]\+/g, '');      // gesetzter Custos
  const accidentals = (s.match(/[a-m][xy#]/g) || []).length;
  s = s.replace(/[a-m][xy#]/g, '');
  const letters = (s.match(/[a-mA-M]/g) || []).map(c => c.toLowerCase());
  const moras = (s.match(/\./g) || []).length;
  return { letters, accidentals, moras };
}

function normText(t, stripAccents) {
  let s = t.replace(/<[^>]*>/g, '').replace(/[{}]/g, '').toLowerCase().trim();
  if (stripAccents) s = s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/æ/g, 'ae').replace(/œ/g, 'oe');
  return s;
}

function parseSystemLine(line) {
  const out = {
    syllables: [],      // Text je Silbe (normalisiert, mit Akzenten)
    syllablesPlain: [], // ohne Akzente/Satzzeichen
    groups: [],         // Notenzahl je Silbe (Neumen-Gruppierung)
    notes: [],          // alle Tonhoehen in Lesereihenfolge (a–m)
    bars: [],           // Trennstriche in Reihenfolge
    wordStarts: [],     // je Silbe: beginnt ein neues Wort?
    clefs: [],          // im Text gefundene Schluessel
    accidentals: 0,
    moras: 0,
  };
  const re = /([^\s(]*)\(([^)]*)\)/g;
  let m, prevEnd = 0;
  while ((m = re.exec(line)) !== null) {
    const text = m[1], field = m[2];
    const gapBefore = line.slice(prevEnd, m.index);
    prevEnd = m.index + m[0].length;
    if (CLEF_RE.test(field)) { out.clefs.push(field); continue; }
    if (!text && BAR_RE.test(field)) { out.bars.push(field.replace(/[?_0-8]/g, '')); continue; }
    const n = notesOf(field);
    out.accidentals += n.accidentals;
    out.moras += n.moras;
    if (!text && !n.letters.length) continue; // leere/unbekannte Klammer
    out.syllables.push(normText(text, false));
    out.syllablesPlain.push(normText(text, true).replace(/[^a-z0-9]/g, ''));
    out.groups.push(n.letters.length);
    out.notes.push(...n.letters);
    out.wordStarts.push(out.syllables.length === 1 || /\s/.test(gapBefore));
  }
  return out;
}

// ── Vergleichsmasse ─────────────────────────────────────────────────────

function editDistance(a, b) {
  const n = a.length, m = b.length;
  if (!n) return m;
  if (!m) return n;
  let prev = new Array(m + 1), cur = new Array(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;
  for (let i = 1; i <= n; i++) {
    cur[0] = i;
    for (let j = 1; j <= m; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    [prev, cur] = [cur, prev];
  }
  return prev[m];
}

// Aehnlichkeit zweier Folgen, 0..1 (1 = identisch). Zwei leere Folgen = 1.
function similarity(a, b) {
  const max = Math.max(a.length, b.length);
  return max === 0 ? 1 : 1 - editDistance(a, b) / max;
}

// Anteil gleicher Eintraege an gleicher POSITION (ohne Ausrichtung) — das
// strenge Mass hinter der bekannten «46 %»-Beobachtung: eine einzige
// eingefuegte Note verschiebt alles dahinter.
function positional(a, b) {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  let same = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] === b[i]) same++;
  return same / max;
}

// Gruppengrenzen als Positionen in der Notenfolge; F1 der Grenzen.
function boundaryF1(groupsExp, groupsAct) {
  const cuts = g => { const s = new Set(); let c = 0; for (let i = 0; i < g.length - 1; i++) { c += g[i]; s.add(c); } return s; };
  const e = cuts(groupsExp), a = cuts(groupsAct);
  if (!e.size && !a.size) return 1;
  let hit = 0;
  a.forEach(x => { if (e.has(x)) hit++; });
  const p = a.size ? hit / a.size : 0, r = e.size ? hit / e.size : 0;
  return p + r ? (2 * p * r) / (p + r) : 0;
}

function compareSystem(expLine, actLine) {
  const e = parseSystemLine(expLine || ''), a = parseSystemLine(actLine || '');
  return {
    expectedNotes: e.notes.length,
    actualNotes: a.notes.length,
    noteCountOk: e.notes.length === a.notes.length,
    noteCountDiff: a.notes.length - e.notes.length,
    pitch: similarity(e.notes, a.notes),            // Tonhoehen, ausgerichtet
    pitchPositional: positional(e.notes, a.notes),  // Tonhoehen, positionsgenau
    grouping: similarity(e.groups, a.groups),       // Notenzahl je Silbe
    groupingExact: e.groups.join(',') === a.groups.join(','),
    groupBoundaryF1: boundaryF1(e.groups, a.groups),
    syllables: similarity(e.syllables, a.syllables),
    syllablesPlain: similarity(e.syllablesPlain, a.syllablesPlain),
    wordBreaks: similarity(e.wordStarts, a.wordStarts),
    bars: similarity(e.bars, a.bars),
    morasOk: e.moras === a.moras,
    missing: !actLine,
  };
}

const normIncipit = s => normText(String(s || ''), true).replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const normMode = s => {
  const t = String(s == null ? '' : s).trim().toUpperCase();
  const roman = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8 };
  return roman[t] ? String(roman[t]) : t;
};

// Stuecke werden in Reihenfolge verglichen (Stueck k erwartet <-> Stueck k
// erkannt). Stueckgrenzen = Anzahl Stuecke und Systemzahl je Stueck.
function compareCase(expected, run) {
  const ePieces = expected.pieces || [], aPieces = run.pieces || [];
  const pieces = [];
  const systems = [];
  for (let k = 0; k < Math.max(ePieces.length, aPieces.length); k++) {
    const ep = ePieces[k], ap = aPieces[k];
    if (!ep) { pieces.push({ index: k + 1, extra: true }); continue; }
    const eSys = ep.systems || [], aSys = (ap && ap.systems) || [];
    pieces.push({
      index: k + 1,
      missing: !ap,
      incipitOk: !!ap && normIncipit(ap.incipit) === normIncipit(ep.incipit),
      modeOk: !!ap && normMode(ap.mode) === normMode(ep.mode),
      clefOk: !!ap && String(ap.clef || '').toLowerCase() === String(ep.clef || '').toLowerCase(),
      dropCapOk: !!ap && (ep.hasDropCap == null || !!ap.hasDropCap === !!ep.hasDropCap),
      systemCountOk: eSys.length === aSys.length,
      expectedSystems: eSys.length,
      actualSystems: aSys.length,
    });
    for (let s = 0; s < eSys.length; s++) {
      systems.push(Object.assign({ piece: k + 1, system: s + 1 }, compareSystem(eSys[s], aSys[s])));
    }
  }
  return {
    pieceCountOk: ePieces.length === aPieces.length,
    expectedPieces: ePieces.length,
    actualPieces: aPieces.length,
    pieces,
    systems,
  };
}

// ── Zusammenfassen ──────────────────────────────────────────────────────

const mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const share = (xs, f) => (xs.length ? xs.filter(f).length / xs.length : null);
function stdev(xs) {
  if (xs.length < 2) return null;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) * (x - m), 0) / (xs.length - 1));
}

function summarize(comparisons) {
  const sys = comparisons.flatMap(c => c.systems);
  const pcs = comparisons.flatMap(c => c.pieces).filter(p => !p.extra);
  return {
    systems: sys.length,
    noteCountOk: share(sys, s => s.noteCountOk),
    pitch: mean(sys.map(s => s.pitch)),
    pitchPositional: mean(sys.map(s => s.pitchPositional)),
    grouping: mean(sys.map(s => s.grouping)),
    groupingExact: share(sys, s => s.groupingExact),
    syllables: mean(sys.map(s => s.syllables)),
    syllablesPlain: mean(sys.map(s => s.syllablesPlain)),
    wordBreaks: mean(sys.map(s => s.wordBreaks)),
    bars: mean(sys.map(s => s.bars)),
    systemsMissing: share(sys, s => s.missing),
    pieces: pcs.length,
    pieceCountOk: share(comparisons, c => c.pieceCountOk),
    systemCountOk: share(pcs, p => p.systemCountOk),
    clefOk: share(pcs, p => p.clefOk),
    incipitOk: share(pcs, p => p.incipitOk),
    modeOk: share(pcs, p => p.modeOk),
  };
}

// Streuung: paarweiser Vergleich der Laeufe untereinander (ohne Blick auf
// das erwartete Ergebnis) je System.
function spread(runs) {
  const perSystem = [];
  const nPieces = Math.max(...runs.map(r => (r.pieces || []).length), 0);
  for (let k = 0; k < nPieces; k++) {
    const nSys = Math.max(...runs.map(r => ((r.pieces || [])[k] ? (r.pieces[k].systems || []).length : 0)), 0);
    for (let s = 0; s < nSys; s++) {
      const parsed = runs.map(r => parseSystemLine((((r.pieces || [])[k] || {}).systems || [])[s] || ''));
      const pairPos = [], pairAligned = [];
      for (let i = 0; i < parsed.length; i++) for (let j = i + 1; j < parsed.length; j++) {
        pairPos.push(positional(parsed[i].notes, parsed[j].notes));
        pairAligned.push(similarity(parsed[i].notes, parsed[j].notes));
      }
      const counts = parsed.map(p => p.notes.length);
      perSystem.push({
        piece: k + 1, system: s + 1,
        agreementPositional: mean(pairPos),
        agreementAligned: mean(pairAligned),
        noteCounts: counts,
        noteCountStable: new Set(counts).size === 1,
        identical: new Set(parsed.map(p => p.notes.join('') + '|' + p.groups.join(','))).size === 1,
      });
    }
  }
  return {
    runs: runs.length,
    systems: perSystem.length,
    agreementPositional: mean(perSystem.map(s => s.agreementPositional)),
    agreementAligned: mean(perSystem.map(s => s.agreementAligned)),
    noteCountStable: share(perSystem, s => s.noteCountStable),
    identical: share(perSystem, s => s.identical),
    perSystem,
  };
}

function usageTotals(runs) {
  const t = { input_tokens: 0, output_tokens: 0, durationMs: 0, costUsd: 0, n: 0 };
  runs.forEach(r => {
    const u = r.usage || {};
    if (!r.usage && r.durationMs == null) return;
    t.n++;
    t.input_tokens += u.input_tokens || 0;
    t.output_tokens += u.output_tokens || 0;
    t.costUsd += u.costUsd || 0;
    t.durationMs += r.durationMs || 0;
  });
  return t.n ? t : null;
}

// ── Dateien lesen ───────────────────────────────────────────────────────

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { throw new Error(path.relative(ROOT, file) + ': ' + e.message); }
}
const dirs = d => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).filter(x => x.isDirectory() && !x.name.startsWith('_')).map(x => x.name).sort() : []);

function loadCases() {
  return dirs(CASES_DIR).filter(id => fs.existsSync(path.join(CASES_DIR, id, 'expected.json')))
    .map(id => ({ id, expected: readJson(path.join(CASES_DIR, id, 'expected.json')) }));
}

function loadRuns(seriesDir, caseId) {
  const d = path.join(seriesDir, caseId);
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter(f => /\.json$/.test(f)).sort().map(f => Object.assign({ _file: f }, readJson(path.join(d, f))));
}

function validateExpected(c) {
  const problems = [];
  const e = c.expected;
  if (!Array.isArray(e.pieces) || !e.pieces.length) problems.push('keine pieces');
  (e.pieces || []).forEach((p, i) => {
    if (!p.incipit) problems.push('Stueck ' + (i + 1) + ': incipit fehlt');
    if (!/^(c|f)b?[1-4]$/.test(p.clef || '')) problems.push('Stueck ' + (i + 1) + ': clef fehlt/ungueltig (' + p.clef + ')');
    if (!Array.isArray(p.systems) || !p.systems.length) problems.push('Stueck ' + (i + 1) + ': systems fehlt');
    (p.systems || []).forEach((line, s) => {
      const parsed = parseSystemLine(line);
      if (!parsed.notes.length) problems.push('Stueck ' + (i + 1) + ' System ' + (s + 1) + ': keine Noten erkannt');
      if (parsed.clefs.length) problems.push('Stueck ' + (i + 1) + ' System ' + (s + 1) + ': Schluessel gehoert ins Feld clef, nicht in die Zeile');
      if ((line.match(/\(/g) || []).length !== (line.match(/\)/g) || []).length) problems.push('Stueck ' + (i + 1) + ' System ' + (s + 1) + ': Klammern nicht paarig');
    });
  });
  return problems;
}

// ── Ausgabe ─────────────────────────────────────────────────────────────

const pct = x => (x == null ? '   –' : (x * 100).toFixed(0).padStart(3) + '%');

function printSummary(title, s) {
  console.log('\n' + title);
  console.log('  Verglichen (über alle Läufe): ' + s.systems + ' Systeme, ' + s.pieces + ' Stücke');
  console.log('  Notenzahl je System richtig     ' + pct(s.noteCountOk));
  console.log('  Tonhöhen-Treffer (ausgerichtet) ' + pct(s.pitch) + '   positionsgenau ' + pct(s.pitchPositional));
  console.log('  Neumen-Gruppierung              ' + pct(s.grouping) + '   exakt ' + pct(s.groupingExact));
  console.log('  Silben                          ' + pct(s.syllables) + '   ohne Akzente ' + pct(s.syllablesPlain));
  console.log('  Wortgrenzen                     ' + pct(s.wordBreaks));
  console.log('  Trennstriche                    ' + pct(s.bars));
  console.log('  Schlüssel                       ' + pct(s.clefOk));
  console.log('  Stückgrenzen: Anzahl Stücke     ' + pct(s.pieceCountOk) + '   Systemzahl je Stück ' + pct(s.systemCountOk));
  console.log('  Incipit                         ' + pct(s.incipitOk) + '   Modus ' + pct(s.modeOk));
  if (s.systemsMissing) console.log('  Fehlende Systeme                ' + pct(s.systemsMissing));
}

function main(argv) {
  if (argv.includes('--selftest')) return selftest();
  const arg = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
  const cases = loadCases();
  if (!cases.length) {
    console.log('Keine Testfälle unter ' + path.relative(process.cwd(), CASES_DIR) + '/ gefunden (siehe README.md).');
    return 0;
  }
  let bad = 0;
  cases.forEach(c => validateExpected(c).forEach(p => { bad++; console.log('FEHLER im Testset ' + c.id + ': ' + p); }));
  if (bad) return 2;
  const nSys = cases.reduce((n, c) => n + c.expected.pieces.reduce((m, p) => m + p.systems.length, 0), 0);
  console.log('Testset: ' + cases.length + ' Fall/Fälle, ' + nSys + ' Systeme — Format in Ordnung.');

  const only = arg('--runs');
  const series = only ? [path.resolve(only)] : dirs(RUNS_DIR).map(d => path.join(RUNS_DIR, d));
  if (!series.length) { console.log('Keine Läufe unter runs/ — nichts zu vergleichen.'); return 0; }

  const report = { generatedAt: new Date().toISOString(), series: [] };
  series.forEach(dir => {
    const name = path.basename(dir);
    const comparisons = [], spreads = [], allRuns = [], perCase = [];
    cases.forEach(c => {
      const runs = loadRuns(dir, c.id);
      if (!runs.length) { perCase.push({ id: c.id, runs: 0 }); return; }
      const cmp = runs.map(r => compareCase(c.expected, r));
      comparisons.push(...cmp);
      allRuns.push(...runs);
      const sp = runs.length > 1 ? spread(runs) : null;
      if (sp) spreads.push(sp);
      perCase.push({ id: c.id, runs: runs.length, perRun: cmp.map((x, i) => Object.assign({ file: runs[i]._file }, summarize([x]))), spread: sp, detail: cmp });
    });
    if (!comparisons.length) { console.log('\n' + name + ': keine Läufe zu den Testfällen.'); return; }
    const summary = summarize(comparisons);
    printSummary('── ' + name + ' (' + allRuns.length + ' Läufe, ' + perCase.filter(p => p.runs).length + '/' + cases.length + ' Fälle) ──', summary);
    const pitchPerRun = perCase.flatMap(p => (p.perRun || []).map(r => r.pitch)).filter(x => x != null);
    let spreadSummary = null;
    if (spreads.length) {
      const all = spreads.flatMap(s => s.perSystem);
      spreadSummary = {
        agreementPositional: mean(all.map(s => s.agreementPositional)),
        agreementAligned: mean(all.map(s => s.agreementAligned)),
        noteCountStable: share(all, s => s.noteCountStable),
        identical: share(all, s => s.identical),
        pitchStdevAcrossRuns: stdev(pitchPerRun),
      };
      console.log('  Streuung über Wiederholungsläufe (Läufe untereinander):');
      console.log('    Notenpositionen gleich        ' + pct(spreadSummary.agreementPositional) + '   ausgerichtet ' + pct(spreadSummary.agreementAligned));
      console.log('    Notenzahl stabil              ' + pct(spreadSummary.noteCountStable) + '   System identisch ' + pct(spreadSummary.identical));
    } else {
      console.log('  Streuung: nur 1 Lauf je Fall — nicht messbar.');
    }
    const usage = usageTotals(allRuns);
    if (usage) {
      console.log('  Aufwand: ' + usage.input_tokens + ' Eingabe- / ' + usage.output_tokens + ' Ausgabe-Tokens, ' +
        (usage.costUsd ? '$' + usage.costUsd.toFixed(2) + ', ' : '') + (usage.durationMs / 1000).toFixed(0) + ' s (' + usage.n + ' Läufe mit Angaben)');
    }
    perCase.filter(p => !p.runs).forEach(p => console.log('  (kein Lauf für ' + p.id + ')'));
    report.series.push({ name, summary, spread: spreadSummary, usage, cases: perCase });
  });

  const out = arg('--json');
  if (out) { fs.writeFileSync(out, JSON.stringify(report, null, 2)); console.log('\nBericht geschrieben: ' + out); }
  return 0;
}

// ── Selbsttest (erfundene Mini-Beispiele, nur zum Pruefen der Metriken) ─

function selftest() {
  let fails = 0;
  const ok = (name, cond) => { if (!cond) fails++; console.log((cond ? 'ok   ' : 'FAIL ') + name); };
  const near = (a, b) => Math.abs(a - b) < 1e-9;

  const p = parseSystemLine('Ký(fg)ri(g)e(f.) (,) e(g)lé(h)i(gf)son(g.) (::)');
  ok('Silben', p.syllables.join('|') === 'ký|ri|e|e|lé|i|son');
  ok('Noten', p.notes.join('') === 'fggfghgfg');
  ok('Gruppen', p.groups.join(',') === '2,1,1,1,1,2,1');
  ok('Trennstriche', p.bars.join(' ') === ', ::');
  ok('Wortgrenzen', p.wordStarts.join(',') === 'true,false,false,true,false,false,false');
  ok('Mora', p.moras === 2);

  const q = parseSystemLine('(c4) A(ixi)men(hG~F) (z0) x(j+)');
  ok('Schluessel ist keine Note', q.clefs[0] === 'c4' && q.notes.join('') === 'ihgf');
  ok('Vorzeichen zaehlt nicht als Note', q.accidentals === 1 && q.groups[0] === 1);
  ok('Custos zaehlt nicht als Note', q.groups.join(',') === '1,3,0');

  const same = compareSystem('A(f)men(gh)', 'A(f)men(gh)');
  ok('identisch = 100 %', same.pitch === 1 && same.groupingExact && same.syllables === 1 && same.noteCountOk);

  const pitchOff = compareSystem('A(f)men(gh)', 'A(f)men(gi)');
  ok('eine falsche Tonhoehe', near(pitchOff.pitch, 2 / 3) && pitchOff.noteCountOk && pitchOff.groupingExact);

  const extra = compareSystem('A(f)men(gh) al(h)le(g)', 'A(ff)men(gh) al(h)le(g)');
  ok('Zusatznote: Notenzahl falsch', !extra.noteCountOk && extra.noteCountDiff === 1);
  ok('Zusatznote: ausgerichtet 5/6, positionsgenau 2/6', near(extra.pitch, 5 / 6) && near(extra.pitchPositional, 2 / 6));

  const merged = compareSystem('Cón(f)di(e)tor(f.)', 'Cóndi(fe)tor(f.)');
  ok('verschmolzene Silben: Noten gleich, Gruppierung nicht', merged.pitch === 1 && !merged.groupingExact && merged.syllables < 1);

  const accent = compareSystem('Cón(f)di(e)', 'Con(f)di(e)');
  ok('Akzent: streng falsch, ohne Akzente richtig', accent.syllables === 0.5 && accent.syllablesPlain === 1);

  const bars = compareSystem('a(f) (;) b(g) (::)', 'a(f) (,) b(g) (::)');
  ok('Trennstrich-Typ', bars.bars === 0.5);

  const expected = { pieces: [{ incipit: 'Audi benígne', mode: 'II', clef: 'f3', systems: ['A(f)men(gh)', 'a(g)'] }, { incipit: 'Angelis suis', mode: '', clef: 'c4', systems: ['An(h)'] }] };
  const run = { pieces: [{ incipit: 'Audi benigne', mode: '2', clef: 'c3', systems: ['A(f)men(gh)'] }] };
  const cc = compareCase(expected, run);
  ok('Stueckzahl falsch erkannt', !cc.pieceCountOk && cc.pieces[1].missing);
  ok('Incipit/Modus tolerant, Schluessel streng', cc.pieces[0].incipitOk && cc.pieces[0].modeOk && !cc.pieces[0].clefOk);
  ok('fehlendes System zaehlt als 0 %', cc.systems[1].missing && cc.systems[1].pitch === 0 && !cc.pieces[0].systemCountOk);

  const sp = spread([{ pieces: [{ systems: ['a(fg)b(h)'] }] }, { pieces: [{ systems: ['a(fg)b(h)'] }] }, { pieces: [{ systems: ['a(f)b(h)'] }] }]);
  ok('Streuung: 3 Laeufe, einer weicht ab', sp.systems === 1 && !sp.perSystem[0].noteCountStable && near(sp.agreementPositional, (1 + 1 / 3 + 1 / 3) / 3));

  console.log(fails ? '\n' + fails + ' Test(s) fehlgeschlagen.' : '\nAlle Tests bestanden.');
  return fails ? 1 : 0;
}

module.exports = { parseSystemLine, compareSystem, compareCase, spread, summarize, similarity, positional };

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (e) { console.error('Fehler: ' + e.message); process.exitCode = 2; }
}
