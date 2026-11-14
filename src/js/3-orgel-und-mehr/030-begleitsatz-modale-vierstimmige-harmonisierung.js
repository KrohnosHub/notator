// ── 6. Begleitsatz: modale, vierstimmige Harmonisierung ────────────
// Regeln (modale Choralbegleitung, vgl. Solesmes/Nova Organi Harmonia):
//  - nur leitereigene Dur-/Molldreiklänge (keine verminderten/übermässigen,
//    keine Leittonalterationen); ein b der Melodie gilt auch für den Satz
//  - Akkordwechsel nur an Schwerpunkten: Wortanfang, Beginn eines Melismas,
//    nach einem Trennstrich/Atemzeichen, spätestens alle 8 Pulse
//  - der Akkord muss den ersten Melodieton des Abschnitts enthalten; übrige
//    Melodietöne dürfen Durchgänge sein (lange Töne sollten passen)
//  - Schlussakkord auf der Finalis in Grundstellung, Phrasenschlüsse in
//    Grundstellung, Sextakkorde sonst sparsam
//  - Stimmführung: kleinste Bewegung, keine Stimmkreuzung, Alt immer unter
//    der Melodie, Abstände S–A/A–T höchstens Oktave, keine Quint-/
//    Oktavparallelen; liegende Töne werden übergebunden
//  - Schlussformel nach Nova Organi Harmonia (Build 401, Auswertung in
//    docs/begleitsatz-regelwerk.md, Abschnitt 8): vor dem Schlussakkord
//    Quartvorhalt 4–3 in einer Mittelstimme, davor bevorzugt der Moll-
//    Septakkord der 5. Stufe (Septime bleibt als Vorhalt liegen); nie
//    Leittonalteration. Phrygische Schlüsse (Modus III/IV): Moll-Akkord eine
//    Quarte über der Finalis (Finalis = Quinte)
//  - Spielbarkeit: ohne Pedal linke Hand höchstens Dezime (über Oktave nur
//    ausnahmsweise), rechte Hand möglichst Oktave; kein Querstand
// Optimierung per dynamischer Programmierung über alle Abschnitte.
const CL_DE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'H'];
function clSemi(D, alt) { return Math.floor(D / 7) * 12 + CL_NAT_PC[clMod(D, 7)] + alt; }
function clGermanNote(step, alt) {
  step = clMod(step, 7);
  const b = CL_DE_NAMES[step];
  if (alt === 0) return b;
  if (alt > 0) return b + 'is'.repeat(alt);
  if (alt === -1) return step === 6 ? 'B' : step === 2 ? 'Es' : step === 5 ? 'As' : b + 'es';
  return b + 'eses';
}
function clChordName(ch) {
  const n = clGermanNote(ch.root, ch.alts[0]);
  if (ch.kind === 'sus') return n + ' (Quartvorhalt)';
  return (ch.minor ? n.toLowerCase() + '-Moll' : n + '-Dur') + (ch.kind === '7' ? '⁷' : '');
}

// Akkordkandidaten eines Abschnitts (Dreiklang auf jeder Stufe der lokalen Leiter)
function clSegChords(seg, keyAlt, onlyFirst) {
  // Lokale Leiter: Vorzeichnung + Alterationen der Melodie in diesem Abschnitt;
  // der erste (tragende) Melodieton hat Vorrang (z.B. H und B im selben Abschnitt).
  const scale = keyAlt.slice();
  if (!onlyFirst) seg.notes.forEach(n => { scale[clMod(n.pitch.D, 7)] = n.pitch.alt; });
  // tragender Ton: sonst der erste, im Schlussabschnitt der letzte (seg.anc) –
  // ein Schluss wie «a g» wird als Vorhalt über dem Schlussakkord begleitet
  const s0 = seg.notes[seg.anc || 0].pitch;
  scale[clMod(s0.D, 7)] = s0.alt;
  const out = [];
  for (let r = 0; r < 7; r++) {
    const steps = [r, clMod(r + 2, 7), clMod(r + 4, 7)];
    const alts = steps.map(st => scale[st]);
    const pcs = steps.map((st, i) => clPcOf(st, alts[i]));
    const third = clMod(pcs[1] - pcs[0], 12), fifth = clMod(pcs[2] - pcs[0], 12);
    if (fifth !== 7 || (third !== 3 && third !== 4)) continue;
    if (!pcs.includes(clPcOf(clMod(s0.D, 7), s0.alt))) continue;
    out.push({ root: r, steps, alts, pcs, minor: third === 3 });
  }
  if (!out.length && !onlyFirst) return clSegChords(seg, keyAlt, true);
  return out;
}

// Zusatzakkorde der Schlussformel (leitereigen, nur Grundstellung):
//  'sus' = Grundton–Quarte–Quinte (Quartvorhalt vor dem Schlussakkord),
//  '7'   = Moll-Septakkord. need = Pflichttöne, dis = dissonanter Ton (wird
//  nicht verdoppelt, liegt nie in der Melodie und löst sich abwärts auf).
function clCadenceChord(seg, keyAlt, root, kind) {
  const scale = keyAlt.slice();
  seg.notes.forEach(n => { scale[clMod(n.pitch.D, 7)] = n.pitch.alt; });
  const steps = (kind === 'sus' ? [0, 3, 4] : [0, 2, 4, 6]).map(x => clMod(root + x, 7));
  const alts = steps.map(st => scale[st]);
  const pcs = steps.map((st, i) => clPcOf(st, alts[i]));
  const iv = pcs.map(x => clMod(x - pcs[0], 12)).join();
  if (iv !== (kind === 'sus' ? '0,5,7' : '0,3,7,10')) return null;
  const dis = kind === 'sus' ? 1 : 3;
  const s0 = seg.notes[0].pitch, s0pc = clPcOf(clMod(s0.D, 7), s0.alt);
  if (!pcs.includes(s0pc) || s0pc === pcs[dis]) return null;
  return { root: steps[0], steps, alts, pcs, minor: kind === '7', kind, dis, need: kind === 'sus' ? [0, 1] : [0, 1, 3] };
}

// opt.pedal: Bass im Pedal -> Tenor darf bis zur Duodezime über dem Bass liegen
function clVoicings(seg, ch, inv, opt, relaxed) {
  const pedal = !!(opt && opt.pedal);
  const melS = seg.notes.map(n => clSemi(n.pitch.D, n.pitch.alt));
  const anc = seg.notes[seg.anc || 0].pitch;
  const s0 = melS[seg.anc || 0], minMel = Math.min(...melS), maxMel = Math.max(...melS);
  const need = ch.need || [0, 1];
  const tone = D => { const st = clMod(D, 7); const i = ch.steps.indexOf(st); return i < 0 ? null : { D, alt: ch.alts[i], i, s: clSemi(D, ch.alts[i]) }; };
  const bassStep = ch.steps[inv];
  const res = [];
  const sIdx = ch.pcs.indexOf(clPcOf(clMod(anc.D, 7), anc.alt));
  for (let bD = 14; bD <= 29; bD++) {
    if (clMod(bD, 7) !== bassStep) continue;
    const B = tone(bD); if (!B) continue;
    for (let tD = 19; tD <= 33; tD++) {
      const T = tone(tD); if (!T || T.s <= B.s || T.s - B.s > 19) continue;
      for (let aD = 23; aD <= 38; aD++) {
        const A = tone(aD); if (!A || A.s <= T.s || A.s - T.s > 12) continue;
        if (A.s >= minMel || s0 - A.s > 12) continue;
        const idx = [sIdx, A.i, T.i, B.i];
        if (need.some(x => !idx.includes(x))) continue;
        if (ch.dis != null && idx.filter(x => x === ch.dis).length > 1) continue;
        let c = 0;
        if (!ch.kind && !idx.includes(2)) c += 0.8;
        if (ch.kind !== 'sus' && idx.filter(x => x === 1).length > 1) c += 1.5;
        // Griffweite: linke Hand (ohne Pedal) Oktave, Dezime nur ausnahmsweise;
        // rechte Hand: höchster Melodieton des Abschnitts über dem Alt
        const lh = T.s - B.s;
        if (!pedal) { if (lh > 16 && !relaxed) continue; if (lh > 12) c += 1 + 0.15 * (lh - 12); }
        if (maxMel - A.s > 12) c += 0.25 * (maxMel - A.s - 12);
        c += 0.04 * Math.abs(s0 - A.s - 5);
        c += 0.02 * Math.abs(T.s - (A.s + B.s) / 2);
        res.push({ A, T, B, c });
      }
    }
  }
  // ohne Pedal keine spielbare Lage -> Griffweite ausnahmsweise freigeben
  if (!res.length && !pedal && !relaxed) return clVoicings(seg, ch, inv, opt, true);
  res.sort((a, b) => a.c - b.c);
  // mehr Kandidaten, damit die Stimmführung (Übergangskosten) wählen kann
  return res.slice(0, 24);
}

// Stimmen-Kopf des Begleitsatzes: 2 Systeme (Manual) oder Orgelsatz mit Pedal
function clAbcScoreHeader(pedal) {
  return pedal
    ? '%%score {(S A) | T} B\nV:S clef=treble stem=up\nV:A clef=treble stem=down\nV:T clef=bass\nV:B clef=bass nm="Ped."\n'
    : '%%score {(S A) | (T B)}\nV:S clef=treble stem=up\nV:A clef=treble stem=down\nV:T clef=bass stem=up\nV:B clef=bass stem=down\n';
}
// Vorgabe zu einem Abschnitt: aktueller Schlüssel, sonst frühere Schlüsselformen
function clOvLookup(ovs, sg) {
  if (!ovs || !sg) return undefined;
  if (ovs[sg.key] != null) return ovs[sg.key];
  for (const k of (sg.legacyKeys || [])) if (ovs[k] != null) return ovs[k];
  return undefined;
}
// Akkord-Vorgabe lesen: alte Form = Zahl (Stufe), neu {d: Stufe|null, i: 0|1|null}
function clOvParse(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number') return { d: v, i: null };
  if (typeof v === 'object') return { d: v.d != null ? v.d : null, i: v.i != null ? v.i : null, x: v.x || null };
  return null;
}
// segs: [{notes:[{pitch,dur}], pulses, endBar, final, key}]
// ctx: {keyAlt, finalisStep, overrides:{key: degree}}
// Beliebiger Dur-/Moll-Dreiklang (freie Akkordwahl): Grundton als Stufe +
// Tonhöhenklasse, Terz/Quinte richtig benannt (z.B. B-Dur = B–D–F)
function clMakeChord(rootStep, rootPc, minor) {
  const steps = [clMod(rootStep, 7), clMod(rootStep + 2, 7), clMod(rootStep + 4, 7)];
  const pcs = [clMod(rootPc, 12), clMod(rootPc + (minor ? 3 : 4), 12), clMod(rootPc + 7, 12)];
  const alts = steps.map((st, i) => { let a = clMod(pcs[i] - CL_NAT_PC[st], 12); if (a > 6) a -= 12; return a; });
  return { root: steps[0], steps, alts, pcs, minor: !!minor, free: true };
}
function clHarmonize(segs, ctx) {
  if (!segs.length) return;
  // Schlussakkord: Finalis-Akkord; phrygisch (Halbton über der Finalis, Modus
  // III/IV): Moll-Akkord eine Quarte höher, die Finalis ist dessen Quinte.
  const fS = ctx.finalisStep, nLast = segs.length - 1;
  const phryg = clMod(clPcOf(clMod(fS + 1, 7), ctx.keyAlt[clMod(fS + 1, 7)]) - clPcOf(fS, ctx.keyAlt[fS]), 12) === 1;
  const finalRoot = phryg ? clMod(fS + 3, 7) : fS;
  ctx.finalRoot = finalRoot;
  const states = segs.map((seg, si) => {
    seg.anc = si === nLast ? seg.notes.length - 1 : 0;
    let chords = clSegChords(seg, ctx.keyAlt);
    // Kommt die b/h-Stufe in der Melodie dieses Abschnitts nicht vor, sind
    // auch Akkorde mit der anderen Form möglich (z.B. B-Dur/g-Moll in D-dorisch)
    // – als Vorschlag im Menü; automatisch nur bei klarem Vorteil (Zusatzkosten).
    if (ctx.bVar && !seg.notes.some(n => clMod(n.pitch.D, 7) === ctx.bVar.step)) {
      const ka = ctx.keyAlt.slice(); ka[ctx.bVar.step] = ctx.bVar.alt;
      clSegChords(seg, ka).forEach(c => { if (c.steps.includes(ctx.bVar.step) && !chords.some(x => x.pcs.join() === c.pcs.join())) { c.alt2 = true; chords.push(c); } });
    }
    seg.candidates = chords;
    const ov = clOvParse(clOvLookup(ctx.overrides, seg));
    if (ov && ov.x && ctx.finalisPc != null) {
      // frei gewählter Akkord (auch ausserhalb der Vorschläge), relativ zur Finalis gespeichert -> transponierbar
      chords = [clMakeChord(ctx.finalisStep + ov.x.d, ctx.finalisPc + ov.x.s, ov.x.m)];
    } else if (ov && ov.d != null) {
      const want = clMod(ctx.finalisStep + ov.d, 7);
      const f = chords.filter(c => c.root === want);
      if (f.length) chords = f;
    }
    const forcedInv = ov && ov.i != null ? ov.i : null;
    // Schlussformel (nur ohne Vorgabe, innerhalb der Schlussphrase): Quartvorhalt
    // direkt vor dem Schlussakkord, Moll-Septakkord der 5. Stufe davor
    if (!ov && !seg.endBar && nLast >= 1 && (si === nLast - 1 || (si === nLast - 2 && !segs[nLast - 1].endBar))) {
      const add = (c, bonus) => { if (c) { c.bonus = bonus; chords = chords.concat([c]); } };
      if (si === nLast - 1) add(clCadenceChord(seg, ctx.keyAlt, finalRoot, 'sus'), 1.2);
      add(clCadenceChord(seg, ctx.keyAlt, clMod(finalRoot + 4, 7), '7'), si === nLast - 1 ? 0.8 : 0.6);
    }
    const isLast = si === segs.length - 1;
    const phraseEnd = isLast || seg.endBar === 'maior' || seg.endBar === 'finalis' || seg.endBar === 'minor';
    const st = [];
    chords.forEach(ch => {
      let hc = 0;
      const chordPcs = ch.pcs;
      seg.notes.forEach((n, ni) => { if (ni !== seg.anc && !chordPcs.includes(clPcOf(clMod(n.pitch.D, 7), n.pitch.alt))) hc += n.dur >= 2 ? 6 : 0.6; });
      if (ch.alt2) hc += 2.5; // andere b/h-Form: nur Vorschlag, automatisch selten
      if (ch.kind) hc -= ch.bonus;
      if (isLast && ch.root !== finalRoot) hc += 20;
      if (si === 0 && ch.root !== ctx.finalisStep) hc += 1;
      // Phrasenschluss an Doppel-/Schlussstrich: Finalis-Akkord deutlich bevorzugt
      if (phraseEnd && !isLast && ch.root !== finalRoot) hc += (seg.endBar === 'minor' ? 0.6 : 2.5);
      const invs = ch.kind ? [0] : forcedInv != null ? [forcedInv] : [0, 1];
      invs.forEach(inv => {
        if (inv && phraseEnd && forcedInv == null) return;
        let vs = clVoicings(seg, ch, inv, ctx);
        vs.forEach(v => st.push({ ch, inv, v, cost: hc + v.c + (inv && forcedInv == null ? 1.2 : 0) }));
      });
    });
    if (!st.length && forcedInv != null) {
      // gewünschte Lage hier nicht spielbar -> automatisch
      chords.forEach(ch => [0, 1].forEach(inv => clVoicings(seg, ch, inv, ctx).forEach(v => st.push({ ch, inv, v, cost: v.c + 5 }))));
    }
    if (!st.length) {
      // Notlösung (z.B. Melodie ausserhalb der Stimmlagen): Pausen statt Akkord,
      // damit die Optimierung über die übrigen Abschnitte nicht abbricht.
      st.push({ ch: null, inv: 0, v: { A: null, T: null, B: null, c: 0 }, cost: 30 });
    }
    return st;
  });
  // DP
  const best = states.map(st => st.map(() => ({ cost: Infinity, prev: -1 })));
  states[0].forEach((s, i) => { best[0][i].cost = s.cost; });
  for (let k = 1; k < segs.length; k++) {
    const pSeg = segs[k - 1], cSeg = segs[k];
    const spPrev = clSemi(pSeg.notes[pSeg.notes.length - 1].pitch.D, pSeg.notes[pSeg.notes.length - 1].pitch.alt);
    const sCur = clSemi(cSeg.notes[0].pitch.D, cSeg.notes[0].pitch.alt);
    states[k].forEach((s, i) => {
      let bc = Infinity, bp = -1;
      states[k - 1].forEach((p, j) => {
        const pc = best[k - 1][j].cost;
        if (pc === Infinity) return;
        let t = pc + clTransCost(p, s, spPrev, sCur, cSeg, pSeg);
        // nach Atemzeichen/Viertelstrich hält die Orgel durch -> danach ein
        // hörbar anderer Akkord, damit klar ist, dass es weitergeht
        if ((pSeg.endBar === 'minima' || pSeg.endBar === 'minor') && p.ch && s.ch && p.ch.root === s.ch.root) t += (p.inv === s.inv ? 3 : 1.2);
        if (t < bc) { bc = t; bp = j; }
      });
      best[k][i].cost = bc + s.cost; best[k][i].prev = bp;
    });
  }
  let k = segs.length - 1;
  let bi = -1, bv = Infinity;
  best[k].forEach((b, i) => { if (b.cost < bv) { bv = b.cost; bi = i; } });
  for (; k >= 0 && bi >= 0; k--) {
    const s = states[k][bi];
    segs[k].chord = s.ch; segs[k].inv = s.inv; segs[k].voicing = s.v;
    bi = best[k][bi].prev;
  }
}

function clTransCost(p, s, spPrev, sCur, cSeg, pSeg) {
  // Ziel (2026-10-12, «klingt holprig»): ruhigere Begleitung – Akkord eher
  // liegen lassen, Wechsel bevorzugt im Quint-/Quartabstand, kleine Schritte
  // in Alt/Tenor, keine grossen Bass-Sprünge, kein Wechsel auf kurzer Einzelnote.
  let c = 0;
  if (!p.ch || !s.ch) return 2;
  const pv = p.v, cv = s.v;
  if (!pv.A || !cv.A) return 2;
  const sameVoicing = pv.A.s === cv.A.s && pv.T.s === cv.T.s && pv.B.s === cv.B.s;
  // Wechsel sind erwünscht (Nutzervorgabe): Liegenlassen kostet etwas, Wechsel
  // im Quint-/Quartabstand nichts, Terz wenig, Sekunde etwas mehr.
  if (p.ch.root === s.ch.root) c += p.inv === s.inv ? (sameVoicing ? 0.35 : 0.5) : 0.4;
  else {
    const iv = clMod(s.ch.root - p.ch.root, 7);
    c += (iv === 3 || iv === 4) ? 0 : (iv === 2 || iv === 5) ? 0.15 : 0.45;
    if (cSeg && cSeg.pulses <= 1) c += 1.5; // Akkordwechsel auf kurzer Einzelnote wirkt unruhig
  }
  const P = [spPrev, pv.A.s, pv.T.s, pv.B.s], C = [sCur, cv.A.s, cv.T.s, cv.B.s];
  const dA = Math.abs(C[1] - P[1]), dT = Math.abs(C[2] - P[2]), dB = Math.abs(C[3] - P[3]);
  c += 0.15 * (dA + dT) + 0.08 * dB;
  if (dA > 5) c += 0.8;
  if (dT > 5) c += 0.8;
  if (dB > 7) c += 1.2;
  if (dB > 12) c += 2;
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    const d1 = clMod(P[i] - P[j], 12), d2 = clMod(C[i] - C[j], 12);
    const mi = C[i] - P[i], mj = C[j] - P[j];
    if (d1 === d2 && (d1 === 0 || d1 === 7) && mi !== 0 && mj !== 0 && Math.sign(mi) === Math.sign(mj)) c += 10;
  }
  // Dissonanz (Quarte des Vorhalts, Septime): bleibt liegen oder löst sich
  // stufenweise abwärts auf; sie wird nicht angesprungen.
  const VO = ['A', 'T', 'B'];
  if (p.ch.dis != null) VO.forEach(v => {
    if (clMod(pv[v].s, 12) !== p.ch.pcs[p.ch.dis]) return;
    const d = cv[v].s - pv[v].s;
    if (!(d === 0 || d === -1 || d === -2)) c += 8;
  });
  if (s.ch.dis != null) VO.forEach(v => {
    if (clMod(cv[v].s, 12) === s.ch.pcs[s.ch.dis] && Math.abs(cv[v].s - pv[v].s) > 2) c += 0.5;
  });
  // Querstand: dieselbe Stufe in verschiedenen Stimmen mit anderem Vorzeichen (b gegen h)
  if (pSeg && cSeg) {
    const pm = pSeg.notes[pSeg.notes.length - 1].pitch, cm = cSeg.notes[0].pitch;
    const PT = [pm, pv.A, pv.T, pv.B], CT = [cm, cv.A, cv.T, cv.B];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      if (i !== j && clMod(PT[i].D, 7) === clMod(CT[j].D, 7) && PT[i].alt !== CT[j].alt) c += 4;
    }
  }
  return c;
}

// opts: { targetPc (0-11 oder null = Original), octave (int), charsPerLine, headers:[{title,subtitle}],
//         accomp (bool: Begleitsatz), chordOverrides ({segKey: Stufe relativ zur Finalis}) }
// liefert { abc, liqChars:[startChar...], info }
var NT_LB_PAD = 11.5; // Platzhalterbreite je Breiteneinheit des Zeilenumbruchs (px)
function clGabcToAbc(gabcList, opts) {
  opts = opts || {};
  const tunes = [];
  const liqChars = [];
  const segRanges = []; // Klickbereiche je Begleitsatz-Abschnitt {start,end,key}
  const sylRanges = []; // Klickbereiche je Silbe (Oberstimme) für Zeilenumbrüche {start,end,lb}
  const segInfo = {};   // key -> {candidates:[{deg,name}], current, currentName}
  const models = [];    // internes Modell je Abschnitt (für MusicXML-Export)
  let abcAll = '';
  let info = null;
  // Transposition je Abschnitt (eigener Grundton/Oktave pro Abschnitt möglich:
  // opts.sectionOpts[si] = {targetPc, octave}; sonst opts.targetPc/opts.octave)
  const firstParsed = clParseGabc(gabcList[0].gabc, opts);
  const infos = [];
  let fin, origPc, targetPc, tgt, d, semi, sigFifths, keyAlt, keyTonic, abcKey, bVar;
  const computeT = (parsedX, gabcX, tpc) => {
    fin = clFinalis(parsedX);
    const baseFifths = clBaseKeyFifths(gabcX);
    origPc = clPcOf(clMod(fin.D, 7), fin.alt);
    targetPc = (tpc === null || tpc === undefined) ? origPc : tpc;
    tgt = clBestTarget(targetPc, fin, baseFifths) || { step: clMod(fin.D, 7), alt: fin.alt, sigFifths: baseFifths, modeIdx: clModeIndex(clMod(fin.D, 7), baseFifths) };
    d = clMod(tgt.step - clMod(fin.D, 7), 7);
    semi = clMod(clPcOf(tgt.step, tgt.alt) - origPc, 12);
    // Aufwärts vs. abwärts: kleinste Bewegung wählen (Oktave korrigiert Auto-Oktave ohnehin)
    if (d > 3) { d -= 7; semi -= 12; }
    sigFifths = tgt.sigFifths;
    // Tonart-Vorzeichnung pro Stufe
    keyAlt = [0, 0, 0, 0, 0, 0, 0];
    const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6], FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3];
    if (sigFifths > 0) for (let k = 0; k < sigFifths; k++) keyAlt[SHARP_ORDER[k]] = 1;
    if (sigFifths < 0) for (let k = 0; k < -sigFifths; k++) keyAlt[FLAT_ORDER[k]] = -1;
    keyTonic = clKeyName(tgt.step, tgt.alt);
    // Choral-«b» (h/b ist im Choral wählbar): Stufe im Zielton und die jeweils
    // andere Form (b statt h bzw. h statt b) für zusätzliche Akkordvorschläge
    { const bs = clMod(6 + d, 7); bVar = { step: bs, alt: keyAlt[bs] + (baseFifths < 0 ? 1 : -1) }; }
    // K: bewusst als Dur-Tonart mit identischer Vorzeichnung (nicht als
    // Modusname) -- so ist garantiert, dass die von abcjs gezeichnete
    // Vorzeichnung exakt der hier berechneten (keyAlt) entspricht.
    abcKey = ['Cb','Gb','Db','Ab','Eb','Bb','F','C','G','D','A','E','B','F#','C#'][sigFifths + 7];
    return {
      finalisOrig: clKeyName(clMod(fin.D, 7), fin.alt),
      finalisTarget: keyTonic,
      modeName: CL_MODE_DE[tgt.modeIdx],
      sigFifths,
      sigText: sigFifths === 0 ? 'keine Vorzeichen' : Math.abs(sigFifths) + (sigFifths > 0 ? '♯' : '♭'),
      semitones: semi,
      targetPc, origPc,
    };
  };
  const secOpt = si => (opts.sectionOpts && opts.sectionOpts[si]) || {};
  const secTpc = si => (secOpt(si).targetPc !== undefined ? secOpt(si).targetPc : opts.targetPc);
  const secOct = si => (secOpt(si).octave !== undefined ? secOpt(si).octave : opts.octave) || 0;
  info = computeT(firstParsed, gabcList[0].gabc, secTpc(0));

  gabcList.forEach((sec, si) => {
    const ki = sec.si != null ? sec.si : si; // Schlüssel-Index (ursprünglicher Abschnitt)
    const parsed = si === 0 ? firstParsed : clParseGabc(sec.gabc, opts);
    const secInfo = si === 0 ? info : computeT(parsed, sec.gabc, secTpc(si));
    infos.push(secInfo);
    const notes = parsed.events.filter(e => e.k === 'note').map(e => clSpellTranspose(e.D, e.alt, d, semi));
    // Auto-Oktave: Mittelwert möglichst nahe an H4 (Mitte Violinschlüssel)
    let shift = 0;
    if (notes.length) {
      const avg = notes.reduce((a, n) => a + n.D, 0) / notes.length;
      shift = Math.round((4 * 7 + 6 - avg) / 7) * 7;
    }
    shift += 7 * secOct(si);
    // Silben-Einheiten bilden
    const units = []; // {music:'', lyrics:[], isBreakOk, width}
    let cur = null;
    let pendingAnn = [], pendingFree = [];
    let pendingBrk = false;
    let ni = 0;
    const flush = () => { if (cur) { units.push(cur); cur = null; } };
    parsed.events.forEach((e, idx) => {
      if (e.k === 'note') {
        const tp = notes[ni++];
        const pitch = { D: tp.D + shift, alt: tp.alt };
        if (e.sylStart || !cur || cur.kind !== 'syl') {
          flush();
          cur = { kind: 'syl', notes: [], text: e.sylStart ? e.text : null, verses: e.sylStart ? (e.verses || null) : null, hyphen: !!e.hyphen, ann: pendingAnn.concat(pendingFree), chBrk: pendingBrk };
          pendingAnn = []; pendingFree = []; pendingBrk = false;
        }
        // Wiedergabe (opts.playRests): Episem und Note vor Quilisma gedehnt
        // (mindestens 2 Achtel); das Notenbild zeigt dafür das Tenuto-Zeichen.
        // (Dehnung erst nach der Harmonisierung, siehe "Wiedergabe-Fassung" unten,
        // damit Akkorde in Wiedergabe und Notenbild gleich sind)
        // Episem / Note vor Quilisma: im Notenbild wie in der Wiedergabe als
        // Viertel (mind. 2 Achtel) – das Tenuto-Zeichen allein war unter
        // Balken/Bogen kaum sichtbar (Nutzerwunsch 2026-10-14).
        const lng = (e.ten || e.preQuil) && !e.liq && e.dur < 2;
        cur.notes.push({ pitch, oD: e.D, dur: lng ? 2 : e.dur, ten: e.ten, liq: e.liq, pq: !!e.preQuil, lng });
      } else if (e.k === 'bar') {
        flush();
        // Notenloser Text vor dem Strich (z.B. «℟. Roráte.»): bleibt an seiner
        // Stelle in der Textzeile vor dem Strich. Nur kurze Zeichen (V/., ℟.,
        // iij., Ps., Ant., *) wandern wie Strich-Beschriftungen hinter den Strich.
        { const free = pendingFree.filter(t => !CL_MARK_ONLY_RE.test(t)), marks = pendingFree.filter(t => CL_MARK_ONLY_RE.test(t));
          // Beschriftungen eines früheren Strichs ohne Silbe dazwischen (_bar gesetzt) vs. die dieses Strichs
          const prevAnn = pendingAnn._bar ? pendingAnn : [], curAnn = pendingAnn._bar ? [] : pendingAnn;
          if (prevAnn.length || free.length) units.push({ kind: 'ann', free: true, ann: prevAnn.concat(free) });
          pendingAnn = curAnn.concat(marks); pendingFree = []; }
        // Beschriftungen unter einem Trennstrich (V/., R/., iij., ij., *, Ps.,
        // Ant. …) stehen in der Orgelfassung hinter dem Strich, direkt vor der
        // ersten Silbe des folgenden Abschnitts und wandern bei einem
        // Zeilenumbruch mit dieser Silbe mit (Nutzerwunsch 2026-10-20/21).
        // Folgt keine Silbe mehr (Schluss), bleiben sie unter dem Strich.
        const bu = { kind: 'bar', t: e.t, ann: [] };
        units.push(bu);
        if (pendingAnn.length) { pendingAnn._bar = bu; }
      } else if (e.k === 'text') {
        if (e.bar) pendingAnn.push(e.text); else pendingFree.push(e.text);
      } else if (e.k === 'brk') {
        flush(); // nächste Silbe beginnt eine neue Zeile
        pendingBrk = true;
      }
    });
    flush();
    if (pendingAnn.length && !pendingFree.length && pendingAnn._bar && units.indexOf(pendingAnn._bar) === units.length - 1) pendingAnn._bar.ann = pendingAnn; // Schluss: unter dem letzten Strich
    else if (pendingAnn.length || pendingFree.length) units.push({ kind: 'ann', free: true, ann: pendingAnn.concat(pendingFree) });
    // V/. am Ende einer Silbe (z.B. "ia. V/." vor dem Doppelstrich) ebenfalls
    // abtrennen und vor die erste Silbe des nächsten Abschnitts setzen.
    units.forEach((u, k) => {
      if (u.kind !== 'syl' || !u.text) return;
      const mm = /^(.*\S)\s+((?:[VR]\s*\/|[℣℟])\.?|i{1,3}j\.|Ps\.|Ant\.)\s*$/.exec(u.text);
      if (!mm) return;
      const nx = units.slice(k + 1).find(x => x.kind === 'syl');
      if (!nx || !units.slice(k + 1, units.indexOf(nx)).some(x => x.kind === 'bar')) return;
      u.text = mm[1]; nx.ann = [mm[2]].concat(nx.ann || []);
    });
    // letzte Divisio am Ende -> Schlussstrich
    for (let k = units.length - 1; k >= 0; k--) {
      if (units[k].kind === 'bar') { units[k].final = true; break; }
      if (units[k].kind === 'syl') { units.push({ kind: 'bar', t: 'finalis', final: true, ann: [] }); break; }
    }

    // Zeilen umbrechen. Feste Umbrüche: aus dem Choral (⏎) oder in der Orgel
    // gesetzt (opts.lineBreaks[Silbenanker] = true: Umbruch, false: Choral-
    // Umbruch hier nicht übernehmen). Anker = vorige|eigene|nächste Silbe,
    // übersteht Einfügen/Löschen anderer Silben.
    const lbOpt = opts.lineBreaks || {};
    const pbOpt = opts.pageBreaks || {};   // Seitenumbruch ab dieser Silbe (erzwingt auch eine neue Zeile)
    const sylU = units.filter(x => x.kind === 'syl');
    const lbT = x => x ? String(x.text == null ? '~' : x.text).replace(/[|#:]/g, '') : '^';
    const lbSeen = {};
    sylU.forEach((u, k) => {
      const a = lbT(sylU[k - 1]) + '|' + lbT(u) + '|' + lbT(sylU[k + 1]);
      lbSeen[a] = (lbSeen[a] || 0) + 1;
      u.lbKey = ki + ':' + a + (lbSeen[a] > 1 ? '#' + lbSeen[a] : '');
      const v = lbOpt[u.lbKey];
      u.pbWant = !!pbOpt[u.lbKey];
      u.lbWant = v === true || (!!u.chBrk && v !== false) || u.pbWant;
    });
    const cap = opts.charsPerLine || 60;
    const lines = [];
    let line = [], w = 0;
    units.forEach((u, k) => {
      let uw = 0;
      if (u.kind === 'syl') uw = Math.max(u.notes.reduce((a, n) => a + (n.dur >= 2 ? 2.2 : 1.8), 0), Math.max((u.text || '').length, ...(u.verses || []).map(v => (v.text || '').length + 1)) * 0.9) + 1;
      else if (u.kind === 'ann') uw = (u.ann || []).join(' ').length * 0.9 + 1;
      else uw = u.t === 'minima' ? 1 : 2;
      if (u.kind === 'syl' && line.some(x => x.kind === 'syl') && (u.lbWant || w + uw > cap)) {
        line._w = w; line._forced = !!u.lbWant && w + uw <= cap; // fester Umbruch vor vollem Zeilenende
        lines.push(line); line = []; w = 0;
      }
      line.push(u); w += uw;
    });
    if (line.length) { line._w = w; lines.push(line); }
    lines.forEach(ln => { const f = ln.find(x => x.kind === 'syl'); if (f) f.lbStart = true; });
    // iij./ij. gehören zur vorigen Anrufung: beginnt die neue Zeile direkt nach
    // dem Strich, bleiben sie am Ende der vorigen Zeile vor dem Strich (Nutzerwunsch 2026-10-23)
    for (let li = 1; li < lines.length; li++) {
      const first = lines[li][0], prevLn = lines[li - 1], lastU = prevLn[prevLn.length - 1];
      if (!first || first.kind !== 'syl' || !first.ann || !first.ann.length || !lastU || lastU.kind !== 'bar') continue;
      const keep = first.ann.filter(t => /^\s*i{1,3}j\.\s*$/.test(t));
      if (!keep.length) continue;
      first.ann = first.ann.filter(t => keep.indexOf(t) < 0);
      lastU.ann = (lastU.ann || []).concat(keep);
    }

    // Begleitsatz: Abschnitte (Akkordwechsel an Schwerpunkten) bilden + harmonisieren
    const segs = [];
    if (opts.accomp) {
      let cur = null, prevHyphen = false;
      // Schlusston einer Phrase (vor Divisio minor/maior/finalis oder am Ende)
      // bekommt einen eigenen Akkord, wenn er lang ist oder das Stück beendet
      // -- nur so kann der Schluss auf dem Finalis-Akkord stehen.
      const flat = [].concat(...lines);
      for (let q = 0; q < flat.length; q++) {
        const u = flat[q];
        if (u.kind !== 'syl') continue;
        let r = q + 1; while (r < flat.length && flat[r].kind === 'ann') r++;
        const nx = flat[r];
        const endsHere = !nx || (nx.kind === 'bar' && nx.t !== 'minima');
        if (endsHere) { const ln = u.notes[u.notes.length - 1]; if (ln.dur >= 2 || !nx || nx.final) ln._cadence = true; }
      }
      // Schlüssel je Abschnitt = Silbenanker (vorige|eigene|nächste Silbe,
      // Notenposition in der Silbe, Tonhöhe) statt laufender Nummer -> eine
      // Akkordwahl bleibt beim Einfügen/Löschen anderer Silben erhalten.
      const sylUnits = flat.filter(x => x.kind === 'syl');
      const sylTxt = x => x ? String(x.text == null ? '~' : x.text).replace(/[|#:]/g, '') : '^';
      const anchorSeen = {}, noteSeen = {};
      const brk = opts.chordBreaks || {};
      let lastNt = null;
      lines.forEach((ln, li) => {
        let lineStart = true;
        ln.forEach(u => {
          if (u.kind === 'bar') { if (cur) { cur.endBar = u.t; cur.final = !!u.final; } cur = null; lastNt = null; return; }
          if (u.kind !== 'syl') return;
          const wordStart = !!u.text && !prevHyphen;
          const ui = sylUnits.indexOf(u);
          u.notes.forEach((nt, k) => {
            // Anker jeder Note (über alle Noten eindeutig) -> Schlüssel für
            // Abschnitts-Akkorde und für von Hand gesetzte Akkordwechsel.
            // Tonhöhe im Anker = Choral-Tonhöhe (nicht transponiert), damit
            // Akkordvorgaben einen Wechsel von Grundton/Oktave überstehen.
            // Alter Anker (transponierte Tonhöhe, bis Build 299) bleibt als Ausweichschlüssel.
            const a0 = sylTxt(sylUnits[ui - 1]) + '|' + sylTxt(u) + '|' + sylTxt(sylUnits[ui + 1]) + '|' + k + '|';
            const a = a0 + 'o' + nt.oD, aOld = a0 + nt.pitch.D;
            noteSeen[a] = (noteSeen[a] || 0) + 1;
            noteSeen['~' + aOld] = (noteSeen['~' + aOld] || 0) + 1;
            nt._anchor = ki + ':' + a + (noteSeen[a] > 1 ? '#' + noteSeen[a] : '');
            nt._anchorOld = ki + ':' + aOld + (noteSeen['~' + aOld] > 1 ? '#' + noteSeen['~' + aOld] : '');
            if (brk[nt._anchor] == null && brk[nt._anchorOld] != null) { brk[nt._anchor] = brk[nt._anchorOld]; delete brk[nt._anchorOld]; }
            const hard = !cur || lineStart; // Anfang / neue Zeile: immer neuer Akkord
            // Mögliche Akkordwechsel (2026-10-13, Nutzervorgabe): ein Akkord dauert
            // mindestens 2 Achtel; Wechsel bevorzugt an Wort-/Melismenbeginn, auf
            // Vierteln und längeren Noten, nach Sprüngen (ab kleiner Terz), am
            // Phrasenschluss und spätestens nach 4 Achteln. Ob tatsächlich
            // gewechselt wird, entscheidet die Harmonisierung (gleicher Akkord = liegen lassen).
            // Achtel direkt vor einer längeren Note: lieber als Durchgang zum
            // vorigen Akkord nehmen und auf der langen Note wechseln
            if (!hard && nt.dur >= 2 && cur && cur.pulses === 1 && cur.notes.length === 1 && segs.length >= 2 && brk[cur.key] !== true) {
              const pv = segs[segs.length - 2];
              if (pv && !pv.endBar && pv.line === cur.line && pv === segs[segs.length - 2]) {
                const mv = cur.notes[0]; pv.notes.push(mv); pv.pulses += mv.dur; mv._seg = pv; segs.pop(); cur = pv;
              }
            }
            const leap = lastNt ? Math.abs(clSemi(nt.pitch.D, nt.pitch.alt) - clSemi(lastNt.pitch.D, lastNt.pitch.alt)) : 0;
            const auto = hard || (cur.pulses >= 2 && ((k === 0 && (wordStart || u.notes.length > 1)) || nt.dur >= 2 || leap >= 3 || cur.pulses >= 4 || nt._cadence));
            const boundary = hard || brk[nt._anchor] === true || (auto && brk[nt._anchor] !== false);
            nt._mergeable = !hard;
            nt._autoBoundary = auto;
            if (boundary) {
              let oa = aOld; anchorSeen[oa] = (anchorSeen[oa] || 0) + 1;
              if (anchorSeen[oa] > 1) oa += '#' + anchorSeen[oa];
              cur = { notes: [], pulses: 0, line: li, key: nt._anchor, legacyKeys: [nt._anchorOld, ki + ':' + oa, ki + ':' + segs.length] }; segs.push(cur);
            }
            cur.notes.push(nt); cur.pulses += nt.dur; nt._seg = cur;
            lineStart = false; lastNt = nt;
          });
          if (u.text) prevHyphen = !!u.hyphen;
        });
      });
      const finalisPc = clPcOf(tgt.step, keyAlt[clMod(tgt.step, 7)]);
      clHarmonize(segs, { keyAlt, finalisStep: tgt.step, finalisPc, bVar, pedal: !!opts.pedal, overrides: opts.chordOverrides || {} });
      segs.forEach((sg, i) => {
        const nx = segs[i + 1];
        sg.tieNext = !!(nx && !sg.endBar && nx.line === sg.line);
        sg.next = nx;
        segInfo[sg.key] = {
          candidates: (sg.candidates || []).map(c => ({ deg: clMod(c.root - tgt.step, 7), name: clChordName(c) })),
          current: sg.chord ? clMod(sg.chord.root - tgt.step, 7) : null,
          currentName: sg.chord ? clChordName(sg.chord) + (sg.inv ? ' (Sextakkord)' : '') : '',
          inv: sg.inv || 0,
          fStep: tgt.step, fPc: finalisPc,
          curPcs: sg.chord ? sg.chord.pcs.slice() : null, curFree: !!(sg.chord && sg.chord.free),
          ov: clOvParse(clOvLookup(opts.chordOverrides, sg)),
          legacyKeys: sg.legacyKeys || [],
          overridden: clOvLookup(opts.chordOverrides, sg) != null,
        };
      });
    }

    // Wiedergabe-Fassung (opts.playRests): Episem und Note vor Quilisma gedehnt;
    // an Atemzeichen und Viertelstrich setzt die Orgel nicht ab, sondern hält
    // den letzten Ton/Akkord über die Pause (2 Achtel). Erst NACH der
    // Harmonisierung, damit die Akkorde dieselben bleiben wie im Notenbild.
    if (opts.playRests) {
      lines.forEach(ln => ln.forEach((u, ui) => {
        if (u.kind === 'syl') u.notes.forEach(nt => {
          if ((nt.ten || nt.pq) && !nt.liq && nt.dur < 2) { const add = 2 - nt.dur; nt.dur += add; if (nt._seg) nt._seg.pulses += add; }
        });
        // Atemzeichen/Viertelstrich: ganz durchhalten (2 Achtel); halber Strich
        // (2 Achtel): 1 halten + 1 Pause; ganzer Strich im Stück (3): 2 halten + 1 Pause
        if (u.kind === 'bar' && !u.final) {
          const hold = (u.t === 'minima' || u.t === 'minor') ? 2 : u.t === 'maior' ? 1 : 2;
          let pv = null;
          for (let k = ui - 1; k >= 0 && !pv; k--) if (ln[k].kind === 'syl' && ln[k].notes.length) pv = ln[k];
          if (pv) {
            const nt = pv.notes[pv.notes.length - 1]; nt.dur += hold; if (nt._seg) nt._seg.pulses += hold;
            u._held = true; u._rest = (u.t === 'minima' || u.t === 'minor') ? 0 : 1;
          }
        }
      }));
    }

    // ABC-Text
    let head = 'X:' + (si + 1) + '\n';
    const hdr = (opts.headers && opts.headers[si]) || null;
    const title = hdr ? (hdr.title || '') : (sec.title || parsed.title || '');
    const subtitle = hdr ? (hdr.subtitle || '') : (sec.subtitle !== undefined ? sec.subtitle : parsed.subtitle) || '';
    head += clAbcTitleLines(title, subtitle);
    // Kopfzeile unter dem (Unter-)Titel: links (R:) z.B. "Ton 8", rechts
    // (C:) z.B. Transpositionshinweis -- abcjs setzt beide auf EINE Zeile
    // (links-/rechtsbündig), damit kollidieren sie nie mit Titel/Noten.
    const ann = (parsed.annotation || '').trim().replace(/;/g, '');
    const autoLeft = ann ? 'Ton ' + ann : '';
    const autoRight = (targetPc !== origPc) ? 'transponiert ' + secInfo.finalisOrig + ' → ' + secInfo.finalisTarget : '';
    const left = (hdr && hdr.left != null) ? hdr.left : autoLeft;
    const right = (hdr && hdr.right != null) ? hdr.right : autoRight;
    secInfo.autoLeft = autoLeft; secInfo.autoRight = autoRight;
    head += clAbcSideLines(left, right);
    models.push({ title, subtitle, left, right, sigFifths, accomp: !!opts.accomp, pedal: !!(opts.accomp && opts.pedal), lines, segs });
    head += 'M:none\nL:1/8\n';
    if (opts.accomp) head += clAbcScoreHeader(!!opts.pedal);
    head += 'K:' + abcKey + ' clef=treble\n';
    let body = '';
    lines.forEach(ln => {
      let music = '';
      // Strophen: lyrs[0] = Haupttext, lyrs[k] = Strophe k+1; Platzhalter gehen an alle Zeilen
      const nVerse = ln.reduce((mx, u) => Math.max(mx, u.verses ? u.verses.length : 0), 0);
      const lyrs = Array.from({ length: nVerse + 1 }, () => []);
      let lastVerseU = -1; ln.forEach((u, ui) => { if (u.verses) lastVerseU = ui; });
      const lyr = { push: x => lyrs.forEach(a => a.push(x)) };
      let measureAcc = {}; // "D" -> alt (Zeilenanfang = neue Messung)
      let lastLyricLen = 0;
      const low = { A: '', T: '', B: '' }, lowAcc = { A: {}, T: {}, B: {} }, lowRanges = { A: [], T: [], B: [] }, sRanges = [], lbRanges = [];
      const spacerOnly = str => (String(str).replace(/"[^"]*"/g, '').match(/y\d*/g) || []).map(x => ' ' + x).join('');
      const addLow = str => { if (opts.accomp) ['A', 'T', 'B'].forEach(v => { low[v] += str; }); };
      const emitLow = (sg) => {
        const vc = sg.voicing || {};
        ['A', 'T', 'B'].forEach(v => {
          const n = vc[v];
          if (!n) { low[v] += ' x' + (sg.pulses > 1 ? sg.pulses : ''); return; }
          const key = String(n.D);
          const shown = key in lowAcc[v] ? lowAcc[v][key] : keyAlt[clMod(n.D, 7)];
          const needAcc = shown !== n.alt;
          if (needAcc) lowAcc[v][key] = n.alt;
          const nn = sg.next && sg.next.voicing && sg.next.voicing[v];
          const tie = sg.tieNext && nn && nn.D === n.D && nn.alt === n.alt;
          const parts = clAbcLen(sg.pulses);
          const start = low[v].length + 1;
          low[v] += ' ' + parts.map((pp, pi) => clAbcPitch(n.D, n.alt, needAcc && pi === 0) + pp).join('-') + (tie ? '-' : '');
          lowRanges[v].push({ s: start, e: low[v].length, key: sg.key });
        });
      };
      // letzter Trennstrich der Zeile: nichts mehr dahinter setzen, damit er
      // direkt am Zeilenende steht (sonst endet die Zeile mit Leerraum nach dem Strich)
      let lastBarIdx = -1; ln.forEach((u, ui) => { if (u.kind === 'bar') lastBarIdx = ui; });
      const tailAfterBarEmpty = lastBarIdx >= 0 && ln.slice(lastBarIdx + 1).every(u => u.kind === 'ann');
      ln.forEach((u, ui) => {
        const barAtLineEnd = tailAfterBarEmpty && ui === lastBarIdx;
        // Notenlose Texte (iij., Ant., * ...) als Unter-Beschriftung auf einem
        // unsichtbaren Platzhalter; clPlaceLyricAnnotations() schiebt sie nach
        // dem Rendern exakt auf die Grundlinie der Textzeile.
        // Platzhalterbreite (abcjs: y<n>, ca. 8 px je Einheit) so gross, dass
        // der Text weder mit der vorigen noch der folgenden Silbe kollidiert
        // (Silbentext steht mittig unter seiner Note).
        // Position wie im Choralsatz: vor einer Silbe (z.B. "Ant.") steht der
        // Text direkt links vor dem Silbentext; vor einem Trennstrich (z.B.
        // "iij.") mittig unter dem Strich. Die Art wird per unsichtbarem
        // Markerzeichen an clPlaceLyricAnnotations() übergeben.
        const annJoined = (u.ann || []).join(' ').replace(/"/g, "'").replace(/~/g, ' ');
        let annTxt = '', annAfter = '';
        if (annJoined) {
          const tw = annJoined.length * 7.5;
          if (u.kind === 'syl') {
            annTxt = '"@0,0' + CL_MARK_SYL + annJoined + '"y' + Math.max(1, Math.round((tw + 12) / 8));
          } else if (u.kind === 'ann' && u.free) {
            // freier Text in der Textzeile: steht an seiner eigenen Stelle
            annTxt = '"@0,0' + annJoined + '"y' + Math.max(1, Math.round((tw + 14) / 8));
          } else {
            const px = tw / 2 + lastLyricLen * 4 + 6;
            annTxt = '"@0,0' + CL_MARK_BAR + annJoined + '"y' + Math.max(1, Math.round(px / 8));
            annAfter = ' y' + Math.max(1, Math.round((tw / 2 + 6) / 8));
          }
        }
        if (u.kind === 'syl') {
          music += ' ';
          if (annTxt) { music += annTxt + ' '; addLow(spacerOnly(annTxt)); lyr.push('*'); } // abcjs vergibt «*» auch an Platzhalter (y)
          const multi = u.notes.length > 1;
          if (multi) music += '(';
          const sylStartPos = music.length;
          u.notes.forEach((nt, k) => {
            if (opts.accomp && nt._seg && nt._seg.notes[0] === nt) emitLow(nt._seg);
            const noteStart = music.length;
            const key = String(nt.pitch.D);
            const shown = key in measureAcc ? measureAcc[key] : keyAlt[clMod(nt.pitch.D, 7)];
            const needAcc = shown !== nt.pitch.alt;
            if (needAcc) measureAcc[key] = nt.pitch.alt;
            const parts = clAbcLen(nt.dur);
            nt._np = parts.length; // übergebundene Teilnoten belegen in abcjs je eine Textsilbe
            let s = '';
            if (nt.ten && !nt.lng) s += '!tenuto!';
            parts.forEach((p, pi) => {
              if (pi > 0) s += '-';
              const pitchStr = clAbcPitch(nt.pitch.D, nt.pitch.alt, needAcc && pi === 0);
              if (nt.liq && pi === 0) nt._liqOffset = music.length + s.length;
              s += pitchStr + p;
            });
            music += s;
            if (nt._seg) sRanges.push({ s: noteStart, e: music.length, key: nt._seg.key, note: { anchor: nt._anchor, segStart: nt._seg.notes[0] === nt, mergeable: !!nt._mergeable, auto: !!nt._autoBoundary } });
          });
          if (multi) music += ')';
          lbRanges.push({ s: sylStartPos, e: music.length, lb: { key: u.lbKey, start: !!u.lbStart, want: !!u.lbWant, chBrk: !!u.chBrk, set: lbOpt[u.lbKey], pb: !!u.pbWant } });
          // Lyrics: erste Note = Silbe, weitere Noten = "_" (Silbe gehalten)
          // Text nach den Strophen (z.B. «Amen») auf der untersten Strophenzeile
          const toLast = nVerse > 0 && !u.verses && ln.indexOf(u) > lastVerseU;
          lyrs.forEach((arr, vi) => {
            const vt = toLast ? (vi === nVerse ? u.text : '') : vi === 0 ? u.text : (u.verses && u.verses[vi - 1] ? u.verses[vi - 1].text : '');
            const vh = toLast ? (vi === nVerse && u.hyphen) : vi === 0 ? u.hyphen : !!(u.verses && u.verses[vi - 1] && u.verses[vi - 1].hyphen);
            if (vt) arr.push(clAbcEscapeLyric(vt) + (vh ? '-' : ''));
            else arr.push('*');
            for (let k = 0; k < u.notes.length; k++) {
              if (k > 0) arr.push(vh || !vt ? '*' : '_');
              for (let q = 1; q < (u.notes[k]._np || 1); q++) arr.push('*'); // Bindebogen-Fortsetzung: Silbe nicht verschieben
            }
          });
          u._notesRef = u.notes;
          lastLyricLen = u.notes.length > 1 ? 0 : (u.text || '').length;
        } else if (u.kind === 'bar') {
          if (annTxt) { music += ' ' + annTxt; addLow(spacerOnly(annTxt)); lyr.push('*'); }
          // Wiedergabe (opts.playRests): Divisiones als unsichtbare Pausen
          // (x), damit nicht über die Atempause hinweggespielt wird.
          // Dauer in Achteln: minima 2, minor 2, maior 2, finalis 3.
          const pr = opts.playRests && !u.final ? (u._held ? (u._rest || 0) : (({ minima: 2, minor: 2, maior: 2 })[u.t] || 3)) : 0;
          if (u.t === 'minima' && !u.final) { music += pr ? ' !breath!x' + pr : ' !breath!y'; addLow(pr ? ' x' + pr : ' y'); lyr.push('*'); }
          else {
            if (pr) { const xr = ' x' + (pr > 1 ? pr : ''); music += xr; addLow(xr); lyr.push('*'); }
            const bs = ' ' + (u.final ? '|]' : u.t === 'minor' ? '|' : '||');
            music += bs; measureAcc = {}; addLow(bs);
            lowAcc.A = {}; lowAcc.T = {}; lowAcc.B = {};
          }
          if (annAfter && !u.final && !barAtLineEnd) { music += annAfter; addLow(annAfter); lyr.push('*'); }
        } else if (u.kind === 'ann') {
          music += ' ' + annTxt; addLow(spacerOnly(annTxt)); lyr.push('*');
        }
      });
      // Fester Zeilenumbruch (Choral ⏎ / Orgel): abcjs würde die kurze Zeile auf
      // die ganze Breite ziehen – unsichtbarer Platzhalter am Ende hält die Noten
      // in normalem Abstand, der Rest der Notenlinie bleibt leer.
      if (ln._forced && ln._w < cap * 0.85) {
        const pad = ' y' + Math.max(1, Math.round((cap - ln._w) * NT_LB_PAD));
        music += pad; addLow(pad); lyr.push('*');
      }
      const sPrefix = opts.accomp ? '[V:S] ' : '';
      const lead = music.length - music.trimStart().length;
      const lineStart = abcAll.length + head.length + body.length + sPrefix.length - lead;
      ln.forEach(u => (u._notesRef || []).forEach(nt => { if (nt._liqOffset !== undefined) liqChars.push(lineStart + nt._liqOffset); }));
      sRanges.forEach(r => segRanges.push({ start: lineStart + r.s, end: lineStart + r.e, key: r.key, note: r.note }));
      lbRanges.forEach(r => sylRanges.push({ start: lineStart + r.s, end: lineStart + r.e, lb: r.lb }));
      body += sPrefix + music.trim() + '\n';
      lyrs.forEach(a => { body += 'w: ' + a.join(' ') + '\n'; });
      if (opts.accomp) {
        ['A', 'T', 'B'].forEach(v => {
          const pre = '[V:' + v + '] ';
          const ld = low[v].length - low[v].trimStart().length;
          const base = abcAll.length + head.length + body.length + pre.length - ld;
          lowRanges[v].forEach(r => segRanges.push({ start: base + r.s, end: base + r.e, key: r.key }));
          body += pre + (low[v].trim() || 'y') + '\n';
        });
      }
    });
    abcAll += head + body + '\n';
  });
  return { abc: abcAll, liqChars, info, infos, segRanges, sylRanges, segInfo, models };
}


