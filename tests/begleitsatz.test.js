#!/usr/bin/env node
// Notator – Tests für den Orgel-Begleitsatz. Aufruf: node tests/begleitsatz.test.js
// Ohne Abhängigkeiten. Lädt die Harmonisierungsfunktionen unverändert aus
// index.html (Abschnitt «const CL_LETTERS» bis vor «4. Rendern mit abcjs»)
// in eine vm-Sandbox und prüft das Ergebnis von clHarmonize.
//
//   node tests/begleitsatz.test.js            Prüfen (Exit 1 bei Fehler)
//   node tests/begleitsatz.test.js --update   Schnappschuss tests/begleitsatz-golden.json neu schreiben
//   node tests/begleitsatz.test.js --verbose  jeden Befund einzeln ausgeben
//   node tests/begleitsatz.test.js --strict   auch Befunde (Regelverstösse) zählen als Fehler
//
// Drei Stufen:
//   FEHLER   Invarianten, die der heutige Code garantiert (Aufbau der Akkorde,
//            Stimmkreuzung, Abstände, Ambitus, Schlussakkord) + Schnappschuss.
//   BEFUND   Regelverstösse, die der heutige Code nur über Kosten vermeidet
//            oder gar nicht kennt (Parallelen, Querstand, Griffweite …).
//            Die Anzahl je Stück steht im Schnappschuss: mehr = Fehler.
//   INFO     Kennzahlen (Akkordwechsel-Dichte usw.).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const GOLDEN = path.join(__dirname, 'begleitsatz-golden.json');
const args = process.argv.slice(2);
const UPDATE = args.includes('--update'), VERBOSE = args.includes('--verbose'), STRICT = args.includes('--strict');

// ── Code aus index.html laden ───────────────────────────────────
function loadHarmonizer() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const a = html.indexOf("const CL_LETTERS = ['C'");
  const b = html.indexOf('// ── 4. Rendern mit abcjs');
  if (a < 0 || b < 0 || b < a) throw new Error('Begleitsatz-Code in index.html nicht gefunden (Marken geändert?)');
  // const/let der obersten Ebene sind in vm nicht am Kontextobjekt sichtbar ->
  // die gebrauchten Namen am Ende ausdrücklich exportieren.
  const names = ['clGabcToAbc', 'clHarmonize', 'clParseGabc', 'clSemi', 'clPcOf', 'clMod', 'clChordName', 'clGermanNote', 'clTransCost', 'clSegChords', 'clVoicings', 'clOvParse', 'clOvLookup', 'clMakeChord'];
  const src = html.slice(a, b) + '\n;globalThis.__cl = {' + names.join(',') + '};';
  const ctx = vm.createContext({ console });
  vm.runInContext(src, ctx, { filename: 'index.html#begleitsatz' });
  const build = (html.match(/NOTATOR_BUILD_ID = '(\d+)'/) || [])[1] || '?';
  return { ctx, cl: ctx.__cl, build };
}

// Harmonisiert ein GABC und liefert die Abschnitte (segs) samt Kontext, so wie
// clGabcToAbc sie an clHarmonize übergibt (Abfangen über die globale Bindung).
function harmonize(env, gabc, opts) {
  const captured = [];
  const orig = env.ctx.clHarmonize;
  env.ctx.clHarmonize = function (segs, hctx) { orig(segs, hctx); captured.push({ segs, hctx }); };
  let res;
  try { res = env.cl.clGabcToAbc([{ gabc }], Object.assign({ accomp: true }, opts || {})); }
  finally { env.ctx.clHarmonize = orig; }
  if (captured.length !== 1) throw new Error('clHarmonize ' + captured.length + '× aufgerufen (erwartet 1×)');
  return { segs: captured[0].segs, hctx: captured[0].hctx, res };
}

// ── Hilfen ──────────────────────────────────────────────────────
const NOTE_DE = ['C', 'Cis', 'D', 'Es', 'E', 'F', 'Fis', 'G', 'As', 'A', 'B', 'H'];
const semiName = s => NOTE_DE[((s % 12) + 12) % 12] + (Math.floor(s / 12));
// Grenzen der Stimmen wie in clVoicings (diatonische Nummer D = Oktave*7 + Stufe)
const RANGE = { B: [14, 29], T: [19, 33], A: [23, 38] };
// Griffweite einer Hand in Halbtönen (Dezime = 16 gilt als Obergrenze, Oktave = 12 bequem)
const HAND_MAX = 12;

function analyse(env, fx) {
  const { cl } = env;
  const { segs, hctx } = harmonize(env, fx.gabc, fx.opts);
  const errors = [], findings = [], info = {};
  const err = (rule, i, msg) => errors.push({ rule, seg: i, msg });
  const fnd = (rule, i, msg) => findings.push({ rule, seg: i, msg });
  const mel = sg => sg.notes.map(n => cl.clSemi(n.pitch.D, n.pitch.alt));
  const pc = n => cl.clPcOf(cl.clMod(n.pitch.D, 7), n.pitch.alt);

  if (!segs.length) err('leer', 0, 'keine Abschnitte');
  segs.forEach((sg, i) => {
    const v = sg.voicing, ch = sg.chord, m = mel(sg);
    if (!ch || !v || !v.A) { fnd('pause-statt-akkord', i, 'kein spielbarer Akkord (Notlösung Pausen)'); return; }
    const S0 = m[0], A = v.A.s, T = v.T.s, B = v.B.s;
    // Akkordaufbau
    const third = cl.clMod(ch.pcs[1] - ch.pcs[0], 12), fifth = cl.clMod(ch.pcs[2] - ch.pcs[0], 12);
    if (fifth !== 7 || (third !== 3 && third !== 4)) err('dreiklang', i, 'kein Dur-/Molldreiklang: ' + ch.pcs.join(','));
    if (!ch.pcs.includes(pc(sg.notes[0]))) err('melodieton-im-akkord', i, 'erster Melodieton nicht im Akkord ' + cl.clChordName(ch));
    [A, T, B].forEach((s, k) => { if (!ch.pcs.includes(cl.clMod(s, 12))) err('akkordfremd', i, 'ATB'[k] + ' ' + semiName(s) + ' nicht in ' + cl.clChordName(ch)); });
    const pcs4 = [S0, A, T, B].map(s => cl.clMod(s, 12));
    if (!pcs4.includes(ch.pcs[0])) err('grundton-fehlt', i, cl.clChordName(ch));
    if (!pcs4.includes(ch.pcs[1])) err('terz-fehlt', i, cl.clChordName(ch));
    if (cl.clMod(B, 12) !== ch.pcs[sg.inv ? 1 : 0]) err('bass-lage', i, 'Bass passt nicht zur Lage inv=' + sg.inv);
    if (sg.inv !== 0 && sg.inv !== 1) err('lage', i, 'unerwartete Lage ' + sg.inv);
    // Stimmkreuzung / Abstände / Ambitus
    if (!(B < T && T < A)) err('stimmkreuzung', i, 'B<T<A verletzt: ' + [B, T, A].map(semiName).join(' '));
    if (A >= Math.min(...m)) err('alt-ueber-melodie', i, 'Alt ' + semiName(A) + ' ≥ tiefster Melodieton ' + semiName(Math.min(...m)));
    if (S0 - A > 12) err('abstand-s-a', i, 'S–A > Oktave');
    if (A - T > 12) err('abstand-a-t', i, 'A–T > Oktave');
    if (T - B > 19) err('abstand-t-b', i, 'T–B > Duodezime');
    ['A', 'T', 'B'].forEach(k => { const D = v[k].D; if (D < RANGE[k][0] || D > RANGE[k][1]) err('ambitus', i, k + ' ausserhalb ' + RANGE[k].join('–') + ': D=' + D); });
    // Phrasenschluss in Grundstellung (ohne Vorgabe)
    const isLast = i === segs.length - 1;
    const phraseEnd = isLast || ['maior', 'finalis', 'minor'].includes(sg.endBar);
    if (phraseEnd && sg.inv) err('schluss-sextakkord', i, 'Sextakkord am Phrasenschluss');
    // Schlussakkord
    if (isLast) {
      if (ch.root !== hctx.finalisStep) err('schlussakkord', i, 'Schlussakkord ' + cl.clChordName(ch) + ' nicht auf der Finalis');
      if (cl.clMod(B, 12) !== hctx.finalisPc) err('schlussakkord-bass', i, 'Bass am Schluss nicht Finalis');
    }
    // BEFUNDE innerhalb des Abschnitts
    const rh = Math.max(...m) - A; // rechte Hand: Melodie + Alt
    if (rh > HAND_MAX) fnd('griff-rechts', i, 'rechte Hand ' + rh + ' Halbtöne (Alt ' + semiName(A) + ', Spitze ' + semiName(Math.max(...m)) + ')');
    if (T - B > HAND_MAX) fnd('griff-links-ohne-pedal', i, 'linke Hand T–B ' + (T - B) + ' Halbtöne (nur mit Pedal spielbar)');
    if (!pcs4.includes(ch.pcs[2])) fnd('quinte-fehlt', i, cl.clChordName(ch));
    if (pcs4.filter(x => x === ch.pcs[1]).length > 1) fnd('terzverdopplung', i, cl.clChordName(ch));
    sg.notes.slice(1).forEach(n => { if (n.dur >= 2 && !ch.pcs.includes(pc(n))) fnd('langer-ton-akkordfremd', i, cl.clGermanNote(cl.clMod(n.pitch.D, 7), n.pitch.alt) + ' gegen ' + cl.clChordName(ch)); });
    if (phraseEnd && !isLast && sg.endBar !== 'minor' && ch.root !== hctx.finalisStep) fnd('binnenschluss-nicht-finalis', i, 'Divisio ' + sg.endBar + ' auf ' + cl.clChordName(ch));
  });

  // Übergänge
  let changes = 0, held = 0;
  for (let i = 1; i < segs.length; i++) {
    const p = segs[i - 1], c = segs[i];
    if (!p.chord || !c.chord || !p.voicing.A || !c.voicing.A) continue;
    const pm = mel(p), cm = mel(c);
    const P = [pm[pm.length - 1], p.voicing.A.s, p.voicing.T.s, p.voicing.B.s];
    const C = [cm[0], c.voicing.A.s, c.voicing.T.s, c.voicing.B.s];
    const names = 'SATB';
    const overBar = !!p.endBar && p.endBar !== 'minima';
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
      const d1 = cl.clMod(P[a] - P[b], 12), d2 = cl.clMod(C[a] - C[b], 12);
      const ma = C[a] - P[a], mb = C[b] - P[b];
      if (ma === 0 || mb === 0) continue;
      if (d1 === d2 && (d1 === 0 || d1 === 7)) {
        const kind = d1 === 0 ? 'oktav' : 'quint';
        if (Math.sign(ma) === Math.sign(mb)) fnd(kind + 'parallele' + (overBar ? '-ueber-divisio' : ''), i, names[a] + '/' + names[b] + ' ' + semiName(P[a]) + '-' + semiName(P[b]) + ' → ' + semiName(C[a]) + '-' + semiName(C[b]));
        else fnd('anti' + kind + 'parallele', i, names[a] + '/' + names[b]);
      }
    }
    // Stimmüberschneidung: Stimme springt über den vorigen Ton der Nachbarstimme
    for (let a = 0; a < 3; a++) if (C[a + 1] > P[a] || C[a] < P[a + 1]) fnd('stimmueberschneidung', i, names[a] + '/' + names[a + 1]);
    // Querstand: gleiche Stufe, verschiedene Alteration in verschiedenen Stimmen
    const tones = (sg, m) => [{ D: sg.notes[m === 'last' ? sg.notes.length - 1 : 0].pitch.D, alt: sg.notes[m === 'last' ? sg.notes.length - 1 : 0].pitch.alt }, sg.voicing.A, sg.voicing.T, sg.voicing.B];
    const tp = tones(p, 'last'), tc = tones(c, 'first');
    tp.forEach((x, a) => tc.forEach((y, b) => { if (a !== b && cl.clMod(x.D, 7) === cl.clMod(y.D, 7) && x.alt !== y.alt) fnd('querstand', i, names[a] + ' ' + cl.clGermanNote(x.D, x.alt) + ' → ' + names[b] + ' ' + cl.clGermanNote(y.D, y.alt)); }));
    // Sprünge
    const dB = Math.abs(C[3] - P[3]);
    if (dB > 12) fnd('bass-sprung-ueber-oktave', i, dB + ' Halbtöne');
    if (dB === 6) fnd('bass-tritonus', i, semiName(P[3]) + ' → ' + semiName(C[3]));
    [1, 2].forEach(k => { const d = Math.abs(C[k] - P[k]); if (d > 7) fnd('mittelstimme-sprung', i, names[k] + ' ' + d + ' Halbtöne'); });
    const same = p.chord.pcs.join() === c.chord.pcs.join();
    if (same) held++; else changes++;
    if (!same && c.pulses <= 1) fnd('wechsel-auf-einzelachtel', i, cl.clChordName(c.chord));
  }
  const pulses = segs.reduce((a, s) => a + s.pulses, 0);
  info.abschnitte = segs.length; info.pulse = pulses; info.wechsel = changes; info.liegen = held;
  info.pulseJeAkkord = +(pulses / (changes + 1)).toFixed(2);
  info.sextakkorde = segs.filter(s => s.inv).length;

  // Schnappschuss (heutiges Verhalten): Akkord, Lage, Stimmen je Abschnitt
  const snap = segs.map(sg => !sg.chord || !sg.voicing.A ? '–' :
    cl.clChordName(sg.chord) + (sg.inv ? '6' : '') + ' ' + [sg.voicing.A.s, sg.voicing.T.s, sg.voicing.B.s].map(semiName).join('/'));
  const counts = {};
  findings.forEach(f => { counts[f.rule] = (counts[f.rule] || 0) + 1; });
  return { errors, findings, info, snap, counts, abc: null };
}

// ── Einzeltests ohne Stück (Vorgaben, Kleinigkeiten) ────────────
function unitTests(env) {
  const { cl } = env, out = [];
  const t = (name, fn) => { try { const r = fn(); out.push({ name, pass: r === true, msg: r === true ? '' : String(r) }); } catch (e) { out.push({ name, pass: false, msg: e.message }); } };
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b) || 'ist ' + JSON.stringify(a) + ', erwartet ' + JSON.stringify(b);
  t('clOvParse: alte Form (Zahl)', () => eq(cl.clOvParse(3), { d: 3, i: null }));
  t('clOvParse: neue Form', () => eq(cl.clOvParse({ d: 2, i: 1 }), { d: 2, i: 1, x: null }));
  t('clOvParse: leer', () => eq(cl.clOvParse(undefined), null));
  t('clOvLookup: aktueller Schlüssel vor legacyKeys', () => eq(cl.clOvLookup({ a: 1, b: 2 }, { key: 'a', legacyKeys: ['b'] }), 1));
  t('clOvLookup: legacyKeys als Ausweichschlüssel', () => eq(cl.clOvLookup({ b: 2 }, { key: 'a', legacyKeys: ['x', 'b'] }), 2));
  t('clMakeChord: B-Dur = B–D–F', () => { const c = cl.clMakeChord(6, 10, false); return eq([c.steps, c.alts, c.pcs], [[6, 1, 3], [-1, 0, 0], [10, 2, 5]]); });
  t('clChordName: deutsche Namen', () => eq([cl.clChordName(cl.clMakeChord(6, 10, false)), cl.clChordName(cl.clMakeChord(6, 11, true))], ['B-Dur', 'h-Moll']));
  // Vorgabe Stufe: erster Abschnitt auf Stufe der Finalis+2 (falls Kandidat)
  t('Vorgabe (Stufe) wird befolgt, Rest bleibt harmonisierbar', () => {
    const g = "(c4) Tes(d)ti(f)mó(h)ni(h)um(hg) (::)";
    const base = harmonize(env, g);
    const sg = base.segs[0];
    const other = sg.candidates.find(c => c.root !== sg.chord.root);
    if (!other) return 'kein zweiter Kandidat';
    const deg = cl.clMod(other.root - base.hctx.finalisStep, 7);
    const ov = {}; ov[sg.key] = { d: deg, i: null };
    const r2 = harmonize(env, g, { chordOverrides: ov });
    return r2.segs[0].chord.root === other.root || 'Vorgabe nicht befolgt';
  });
  t('Vorgabe über legacyKeys (Migration) wird gefunden', () => {
    const g = "(c4) Tes(d)ti(f)mó(h)ni(h)um(hg) (::)";
    const base = harmonize(env, g);
    const sg = base.segs[0];
    const other = sg.candidates.find(c => c.root !== sg.chord.root);
    if (!other) return 'kein zweiter Kandidat';
    const ov = {}; ov[sg.legacyKeys[0]] = cl.clMod(other.root - base.hctx.finalisStep, 7); // alte Form: Zahl
    const r2 = harmonize(env, g, { chordOverrides: ov });
    return r2.segs[0].chord.root === other.root || 'Vorgabe über legacyKey nicht befolgt';
  });
  t('Transposition ändert die Stufenfolge nicht', () => {
    const g = "(c4) Tes(d)ti(f)mó(h)ni(h)um(hg) (,) mo(h)di(g) pri(f)mi(d.) (::)";
    const deg = r => r.segs.map(s => cl.clMod(s.chord.root - r.hctx.finalisStep, 7) + (s.inv ? 'i' : '')).join(' ');
    return eq(deg(harmonize(env, g, { targetPc: 4 })), deg(harmonize(env, g)));
  });
  return out;
}

// ── Lauf ────────────────────────────────────────────────────────
function main() {
  const env = loadHarmonizer();
  const fixtures = require('./begleitsatz-fixtures.js');
  const golden = fs.existsSync(GOLDEN) ? JSON.parse(fs.readFileSync(GOLDEN, 'utf8')) : null;
  const next = { build: env.build, pieces: {} };
  let fails = 0, nFind = 0;
  console.log('Notator Begleitsatz-Tests (index.html Build ' + env.build + ')\n');

  console.log('Einzeltests');
  unitTests(env).forEach(r => { if (!r.pass) fails++; console.log('  ' + (r.pass ? 'ok    ' : 'FEHLER') + ' ' + r.name + (r.msg ? ' – ' + r.msg : '')); });

  console.log('\nStücke');
  const total = {};
  fixtures.forEach(fx => {
    let r;
    try { r = analyse(env, fx); } catch (e) { fails++; console.log('  FEHLER ' + fx.id + ' – Ausnahme: ' + e.message); return; }
    next.pieces[fx.id] = { snap: r.snap, counts: r.counts };
    const g = golden && golden.pieces[fx.id];
    const msgs = [];
    r.errors.forEach(e => msgs.push('FEHLER ' + e.rule + ' @' + e.seg + ': ' + e.msg));
    if (!UPDATE) {
      if (!g) msgs.push('FEHLER kein Schnappschuss (node tests/begleitsatz.test.js --update)');
      else {
        if (JSON.stringify(g.snap) !== JSON.stringify(r.snap)) {
          const k = r.snap.findIndex((x, i) => x !== g.snap[i]);
          msgs.push('FEHLER Schnappschuss weicht ab (Abschnitt ' + (k < 0 ? g.snap.length : k) + ': war «' + g.snap[k] + '», ist «' + r.snap[k] + '»)');
        }
        Object.keys(r.counts).forEach(rule => { const was = (g.counts || {})[rule] || 0; if (r.counts[rule] > was) msgs.push('FEHLER mehr Befunde «' + rule + '»: ' + was + ' → ' + r.counts[rule]); });
      }
    }
    if (STRICT) r.findings.forEach(f => msgs.push('FEHLER (strict) ' + f.rule + ' @' + f.seg + ': ' + f.msg));
    const bad = msgs.length > 0;
    if (bad) fails++;
    nFind += r.findings.length;
    Object.keys(r.counts).forEach(k => { total[k] = (total[k] || 0) + r.counts[k]; });
    const cs = Object.keys(r.counts).sort().map(k => k + '×' + r.counts[k]).join(', ');
    console.log('  ' + (bad ? 'FEHLER' : 'ok    ') + ' ' + fx.id.padEnd(15) + ' ' + String(r.info.abschnitte).padStart(3) + ' Abschn., ' + r.info.wechsel + ' Wechsel/' + r.info.liegen + ' liegen, ' + r.info.pulseJeAkkord + ' Pulse/Akkord' + (cs ? '  | Befunde: ' + cs : ''));
    msgs.forEach(m => console.log('         ' + m));
    if (VERBOSE) { console.log('         ' + r.snap.join(' | ')); r.findings.forEach(f => console.log('         Befund ' + f.rule + ' @' + f.seg + ': ' + f.msg)); }
  });

  console.log('\nBefunde gesamt: ' + nFind + (nFind ? '  (' + Object.keys(total).sort().map(k => k + '×' + total[k]).join(', ') + ')' : ''));
  if (UPDATE) { fs.writeFileSync(GOLDEN, JSON.stringify(next, null, 1) + '\n'); console.log('Schnappschuss geschrieben: tests/begleitsatz-golden.json'); }
  console.log(fails ? '\n' + fails + ' FEHLER' : '\nAlles ok.');
  process.exit(fails ? 1 : 0);
}
main();
