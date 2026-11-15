// ── Ab Stelle abspielen ──
// Klick auf ▶| schaltet den Auswahlmodus ein; der nächste Klick auf eine
// Note startet dort. Choral: Wiedergabe ab dem angeklickten Eintrag (der
// aktive Abschnitt wird ab dort neu erzeugt, folgende Abschnitte danach).
// Orgel: Sprung an die Zeitposition der angeklickten Note.
function ntPlayPick(source) {
  if (ntPlay.pick === source) { ntPlay.pick = null; ntPlayPickUi(); ntPlayStatus(source, 'Abspielen ab Stelle abgebrochen.'); return; }
  ntPlayStop();
  ntPlay.pick = source; ntPlayPickUi();
  ntPlayStatus(source, 'Note anklicken, ab der abgespielt werden soll (nochmals ▶| = abbrechen)' + (source === 'greg' && window._gregMultiSection ? ' – bei mehreren Abschnitten zuerst den Abschnitt aktivieren' : ''));
}
function ntPlayPickUi() {
  document.querySelectorAll('.nt-pick-btn').forEach(b => {
    const on = ntPlay.pick === b.getAttribute('data-src');
    b.style.background = on ? '#c8a040' : ''; b.style.color = on ? '#000' : '';
  });
  const sc = document.getElementById('cl-score'); if (sc) sc.style.cursor = ntPlay.pick === 'cl' ? 'crosshair' : '';
}
function ntPlayStatus(source, msg) {
  const el = document.getElementById(source === 'cl' ? 'cl-status' : 'greg-status');
  if (el) el.textContent = msg; else gregGst(msg);
}
// Choral: Klick auf Eintrag idx des aktiven Abschnitts
function ntPlayFromChoralEntry(idx) {
  ntPlay.pick = null; ntPlayPickUi();
  if (idx == null || idx < 0) { ntPlayStatus('greg', 'Keine Note getroffen – nochmals ▶| und auf eine Note klicken.'); return; }
  // letzter Schlüsselwechsel vor der Stelle gilt weiter
  let clef = gregClefVal, clefRaw = gregClefRaw || '';
  for (let k = 0; k < idx; k++) { const e = gregEntries[k]; const m = e && e.type === 'raw' && /^\(([cf]b?[1-5](?:@[cf]b?[1-5])?)\)$/.exec(e.gabc || ''); if (m) { clef = m[1]; clefRaw = ''; } }
  const body = gregEntriesToBody(gregEntries.slice(idx), clef, clefRaw);
  let list = [{ gabc: body }];
  if (window._gregMultiSection && gregSections.length > 1 && !(ntPlay.sec >= 0 && ntPlay.sec === gregActiveIdx)) {
    const all = clCollectGabc();
    list = list.concat(all.slice(gregActiveIdx + 1));
  }
  ntPlayToggle('greg', { list });
}
// Orgel: Klick im Notenbild
function ntPlayOrganPickHandler(ev) {
  if (ntPlay.pick !== 'cl') return;
  ev.stopPropagation();
  if (!/^touch/.test(ev.type)) ev.preventDefault(); // sonst kein click auf Touch-Geräten
  if (ev.type !== 'click') return;
  let g = ev.target && ev.target.closest ? ev.target.closest('.abcjs-note') : null;
  if (!g) {
    // Klick neben den Notenkopf: nächstgelegene Note (max. 30 px)
    let best = null, bd = 30;
    document.querySelectorAll('#cl-score .abcjs-note').forEach(n => {
      const r = n.getBoundingClientRect();
      const dx = Math.max(r.left - ev.clientX, 0, ev.clientX - r.right), dy = Math.max(r.top - ev.clientY, 0, ev.clientY - r.bottom);
      const d = Math.hypot(dx, dy);
      if (d < bd) { bd = d; best = n; }
    });
    g = best;
  }
  let hit = null;
  if (g) (window._clTuneObjs || []).forEach((t, ti) => (t.lines || []).forEach(line => (line.staff || []).forEach(sf => (sf.voices || []).forEach(v => v.forEach(el => {
    if (hit || el.el_type !== 'note' || el.rest || !el.abselem || !el.abselem.elemset) return;
    if (el.abselem.elemset.some(x => x === g || (x.contains && x.contains(g)) || (g.contains && g.contains(x)))) hit = { ti, el };
  })))));
  ntPlay.pick = null; ntPlayPickUi();
  if (!hit) { ntPlayStatus('cl', 'Keine Note getroffen – nochmals ▶| und auf eine Note klicken.'); return; }
  ntPlayToggle('cl', { tune: hit.ti, el: hit.el });
}
['click', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'pointerdown', 'pointerup'].forEach(tp =>
  document.addEventListener(tp, ev => { if (ntPlay && ntPlay.pick === 'cl' && ev.target && ev.target.closest && ev.target.closest('#cl-score')) ntPlayOrganPickHandler(ev); }, true));

function ntPlayToggle(source, from) {
  if (ntPlay.pick) { ntPlay.pick = null; ntPlayPickUi(); }
  if (!from && ntPlay.source === source && ntPlay.state === 'play') {
    try { ntPlay.synth.pause(); } catch (e) {}
    try { if (ntPlay.timer) ntPlay.timer.pause(); } catch (e) {}
    ntPlay.state = 'pause'; ntPlayUpdateButtons(); return;
  }
  if (!from && ntPlay.source === source && ntPlay.state === 'pause') {
    try { ntPlay.synth.resume(); } catch (e) {}
    try { if (ntPlay.timer) ntPlay.timer.start(); } catch (e) {}
    ntPlay.state = 'play'; ntPlayUpdateButtons(); return;
  }
  ntPlayStop();
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { gregGst('Wiedergabe wird von diesem Browser nicht unterstützt.'); return; }
  if (!ntPlay.ac || ntPlay.ac.state === 'closed') ntPlay.ac = new AC();
  try { ntPlay.ac.resume(); } catch (e) {}
  ntPlay.source = source; ntPlay.state = 'play'; ntPlayUpdateButtons();
  const token = ntPlay.token;
  clEnsureAbcjs(() => {
    if (token !== ntPlay.token) return;
    if (!ABCJS.synth || !ABCJS.synth.supportsAudio()) { gregGst('Wiedergabe wird von diesem Browser nicht unterstützt.'); ntPlayStop(); return; }
    try { ABCJS.synth.registerAudioContext(ntPlay.ac); } catch (e) {}
    let tunes = [];
    if (source === 'cl') {
      tunes = (window._clTuneObjs || []).map(t => ({ obj: t, highlight: true }));
      // Automatisch erzeugte Fassung: zum Abspielen eine Variante mit
      // Atempausen an den Divisiones (unsichtbar) erzeugen; die Hervorhebung
      // läuft weiter im sichtbaren Notenbild (Zuordnung Note für Note).
      let startEl = from && from.el ? from.el : null;
      if (!clState[clMK()]) {
        try {
          const pb = clBuild({ playRests: true });
          const parts = pb ? pb.abc.split(/(?=^X:)/m).filter(x => x.trim()) : [];
          // Strophen untereinander: jede Strophe abspielen (Zuordnung zur sichtbaren Note über die Wiederholung)
          const gl = clCollectGabc(true), split = b => b ? b.abc.split(/(?=^X:)/m).filter(x => x.trim()) : [];
          const hasV = gl.some(x => ntVerseReps(x.gabc) > 1);
          const partsF = hasV ? split(clBuild({ playRests: true, verseMode: 'full' })) : null;
          const partsP = hasV ? split(clBuild({ playRests: true, verseMode: 'prefix' })) : null;
          if (parts.length === tunes.length) {
            tunes = tunes.map((t, ti) => {
              let idxMap = null, src = parts[ti];
              const reps = gl[ti] ? ntVerseReps(gl[ti].gabc) : 1;
              const preHas = gl[ti] && clHasNotes([{ gabc: ntVerseExpandGabc(gl[ti].gabc, 'prefix') }]);
              const preOk = !preHas || (partsP && partsP.length === parts.length && partsP[ti]);
              if (reps > 1 && partsF && partsF.length === parts.length && preOk) {
                try {
                  const o0 = ABCJS.renderAbc('*', ntSoftenAbc(parts[ti]))[0], o1 = ABCJS.renderAbc('*', ntSoftenAbc(partsF[ti]))[0];
                  const n0 = ntPlayMelody(o0).length, n1 = ntPlayMelody(o1).length, s0 = preHas ? ntPlayMelody(ABCJS.renderAbc('*', ntSoftenAbc(partsP[ti]))[0]).length : 0;
                  const L = (n1 - n0) / (reps - 1);
                  if (L > 0 && Number.isInteger(L)) {
                    src = partsF[ti];
                    idxMap = k => k < s0 ? k : k < s0 + reps * L ? s0 + ((k - s0) % L) : k - (reps - 1) * L;
                  }
                } catch (e) {}
              }
              const objs = ABCJS.renderAbc('*', ntSoftenAbc(src));
              if (!objs || !objs[0]) return t;
              const map = ntPlayNoteMap(objs[0], t.obj, idxMap);
              const out = { obj: objs[0], highlight: true, map };
              if (startEl && from.tune === ti) {
                // sichtbare Note -> startChar in der Abspiel-Fassung
                map.forEach((els, c) => { if (out.startChar == null && startEl.abselem.elemset.some(x => els.indexOf(x) >= 0)) out.startChar = c; });
                if (out.startChar == null && map._mel && startEl.abselem) {
                  // Unterstimme mitten in einer Melodienote: letzte Melodienote links davon
                  let kk = -1; map._mel.V.forEach((v, k) => { if (v.abselem && v.abselem.x <= startEl.abselem.x + 1) kk = k; });
                  if (kk >= 0 && map._mel.P[kk]) out.startChar = map._mel.P[kk].startChar;
                }
              }
              return out;
            });
          }
        } catch (e) { console.warn('Wiedergabe mit Pausen nicht möglich:', e); }
      }
      if (from && from.tune != null) {
        if (tunes[from.tune] && tunes[from.tune].startChar == null) tunes[from.tune].startChar = startEl.startChar;
        const vt = clVisIdx().indexOf(ntPlay.sec);
        tunes = (ntPlay.sec >= 0 && ntPlaySecCount() > 1 && from.tune === vt) ? [tunes[from.tune]] : tunes.slice(from.tune);
      } else if (ntPlay.sec >= 0 && ntPlaySecCount() > 1) {
        const vt = clVisIdx().indexOf(ntPlay.sec);
        tunes = tunes[vt] ? [tunes[vt]] : [];
      }
    } else {
      let list = from && from.list ? from.list : clCollectGabc();
      list = list.map(x => Object.assign({}, x, { gabc: ntVerseExpandGabc(x.gabc, 'full') }));
      if (!from && ntPlay.sec >= 0 && ntPlaySecCount() > 1) list = list[ntPlay.sec] ? [list[ntPlay.sec]] : [];
      if (!clHasNotes(list)) { gregGst('Keine Noten zum Abspielen.'); ntPlayStop(); return; }
      const r = clGabcToAbc(list, { targetPc: null, octave: 0, accomp: false, charsPerLine: 400, playRests: true, flatToBar: (typeof clState === 'undefined' || clState.flatToBar !== false) });
      r.abc.split(/(?=^X:)/m).filter(x => x.trim()).forEach(part => {
        const objs = ABCJS.renderAbc('*', ntSoftenAbc(part));
        if (objs && objs[0]) tunes.push({ obj: objs[0], highlight: false });
      });
    }
    if (!tunes.length) { gregGst('Keine Noten zum Abspielen.'); ntPlayStop(); return; }
    ntPlayRun(tunes, 0, token);
  });
}

// Ordnet die Noten einer Abspiel-Fassung (mit zusätzlichen Pausen) den
// Noten im sichtbaren Notenbild zu: gleiche Reihenfolge je Stimme, Pausen
// zählen nicht. Ergebnis: startChar (Abspiel-Fassung) -> SVG-Elemente.
function ntPlayMelody(obj) {
  const out = [];
  (obj.lines || []).forEach(line => {
    const sf = (line.staff || [])[0]; const v = sf && sf.voices && sf.voices[0];
    (v || []).forEach(el => {
      if (el.el_type !== 'note' || el.rest) return;
      const p = el.pitches && el.pitches[0];
      if (p && p.endTie) return; // Fortsetzung einer Bindung
      out.push(el);
    });
  });
  return out;
}
// Strophen (Text untereinander) zum Abspielen ausschreiben: der Bereich mit
// «Silbe|Strophe 2|…» wird für jede Strophe wiederholt. mode 'full' = ganzes
// Stück mit Wiederholungen, 'prefix' = nur der Teil vor den Strophen.
function ntVerseExpandGabc(g, mode) {
  const i = g.indexOf('%%'); const head = i >= 0 ? g.slice(0, i + 2) : ''; const body = i >= 0 ? g.slice(i + 2) : g;
  const re = /([^()]*)\(([^)]*)\)/g; const gs = []; let m;
  while ((m = re.exec(body))) gs.push({ s: m.index, e: re.lastIndex, t: m[1] });
  const vi = []; gs.forEach((x, k) => { if (x.t.indexOf('|') >= 0) vi.push(k); });
  if (!vi.length) return g;
  const f = vi[0], l = vi[vi.length - 1];
  let endG = l; for (let k = l + 1; k < gs.length; k++) { if (gs[k].t.trim()) break; endG = k; }
  const a = gs[f].s, b = gs[endG].e;
  if (mode === 'prefix') return head + body.slice(0, a);
  const region = body.slice(a, b);
  const reps = 1 + vi.reduce((mx, k) => Math.max(mx, gs[k].t.split('|').length - 1), 0);
  const copies = [];
  for (let r = 0; r < reps; r++) copies.push(region.replace(/([^()]*)\(/g, (m0, t) => (t.indexOf('|') >= 0 ? (t.match(/^\s*/)[0] + (t.trim().split('|')[r] || '')) : t) + '('));
  return head + body.slice(0, a) + copies.join(' ') + body.slice(b);
}
function ntVerseReps(g) {
  let n = 1; (g.match(/([^()]*)\(/g) || []).forEach(t => { n = Math.max(n, t.split('|').length); }); return n;
}
function ntPlayNoteMap(playObj, visObj, idxMap) {
  // Zuordnung über die Melodie (Oberstimme): k-te Melodienote der
  // Abspiel-Fassung <-> k-te Melodienote im Notenbild. Hervorgehoben wird
  // alles, was im Notenbild mit dieser Melodienote zusammen anschlägt.
  // (Die Unterstimmen können in der Abspiel-Fassung anders gebunden/geteilt
  // sein – eine Zuordnung Note für Note pro Stimme lief dort auseinander.)
  const melody = obj => {
    const out = [];
    (obj.lines || []).forEach(line => {
      const sf = (line.staff || [])[0]; const v = sf && sf.voices && sf.voices[0];
      (v || []).forEach(el => {
        if (el.el_type !== 'note' || el.rest) return;
        const p = el.pitches && el.pitches[0];
        if (p && p.endTie && !p.startTie) return; // Fortsetzung einer Bindung
        if (p && p.endTie && p.startTie) return;
        out.push(el);
      });
    });
    return out;
  };
  const P = melody(playObj), V = melody(visObj), map = new Map();
  let visEvents = [];
  try { visEvents = (new ABCJS.TimingCallbacks(visObj, { qpm: 60 }).noteTimings || []).filter(e => e.type === 'event'); } catch (e) {}
  const groupFor = el => {
    const ev = visEvents.find(e => (e.startCharArray || [e.startChar]).indexOf(el.startChar) >= 0);
    const els = [];
    if (ev && ev.elements) ev.elements.forEach(g => (g || []).forEach(x => els.push(x)));
    if (!els.length && el.abselem && el.abselem.elemset) el.abselem.elemset.forEach(x => els.push(x));
    return els;
  };
  P.forEach((el, k) => { const vk = idxMap ? idxMap(k) : k; if (V[vk]) map.set(el.startChar, groupFor(V[vk])); });
  map._mel = { P, V };
  return map;
}

// Anfangston: erster Ton des Stücks (Choral) bzw. erster Akkord samt
// Melodieton (Orgel mit Begleitsatz) in der eingestellten Tonart, ca. 2 s lang.
function ntPlayStartTone(src) {
  let list = []; try { list = clCollectGabc(); } catch (e) {}
  if (!list.length || !clHasNotes(list)) { gregGst('Keine Noten vorhanden.'); return; }
  const multi = list.length > 1;
  let k = ntPlay.sec >= 0 && ntPlay.sec < list.length ? ntPlay.sec : 0;
  if (src === 'greg' && multi && ntPlay.sec < 0 && typeof gregActiveIdx !== 'undefined') k = gregActiveIdx;
  let model = null;
  try {
    if (src === 'cl' && !clState[clMK()]) { const r = clBuild(); const vk = clVisIdx().indexOf(k); model = r && r.models[vk >= 0 ? vk : 0]; }
    else { const r = clGabcToAbc([list[k]], { targetPc: null, octave: 0, accomp: false, charsPerLine: 400, flatToBar: clState.flatToBar !== false }); model = r && r.models[0]; }
  } catch (e) { console.warn(e); }
  let first = null;
  (model && model.lines || []).some(ln => ln.some(u => { if (u.kind === 'syl' && u.notes && u.notes.length) { first = u.notes[0]; return true; } return false; }));
  if (!first) { gregGst('Anfangston nicht ermittelbar.'); return; }
  const pitches = [clAbcPitch(first.pitch.D, first.pitch.alt, true)];
  const vc = src === 'cl' && clState.accomp && first._seg && first._seg.voicing;
  if (vc) ['A', 'T', 'B'].forEach(v => { if (vc[v]) pitches.push(clAbcPitch(vc[v].D, vc[v].alt, true)); });
  const abc = 'X:1\nM:none\nL:1/8\nK:C\n' + (pitches.length > 1 ? '[' + pitches.join('') + ']' : pitches[0]) + '6|]\n';
  ntPlayStop();
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { gregGst('Wiedergabe wird von diesem Browser nicht unterstützt.'); return; }
  if (!ntPlay.ac || ntPlay.ac.state === 'closed') ntPlay.ac = new AC();
  try { ntPlay.ac.resume(); } catch (e) {}
  ntPlay.source = 'tone'; ntPlay.state = 'play';
  const token = ntPlay.token;
  clEnsureAbcjs(() => {
    if (token !== ntPlay.token) return;
    try { ABCJS.synth.registerAudioContext(ntPlay.ac); } catch (e) {}
    const objs = ABCJS.renderAbc('*', abc);
    if (objs && objs[0]) ntPlayRun([{ obj: objs[0], highlight: false }], 0, token);
  });
}
function ntPlayRun(tunes, i, token) {
  if (token !== ntPlay.token) return;
  if (i >= tunes.length) { ntPlayStop(); gregGst('Wiedergabe beendet.'); return; }
  const pref = ntPlayPrefs();
  const qpm = Math.max(20, Math.round(pref.tempo / 2)); // Tempo-Angabe in Achteln/min
  const synth = new ABCJS.synth.CreateSynth();
  ntPlay.synth = synth;
  gregGst('Lade Klänge …');
  synth.init({
    audioContext: ntPlay.ac,
    visualObj: tunes[i].obj,
    // «Orgel – sanft»: Samples einer echten Pfeifenorgel (VSCO 2 CE, leise
    // Registrierung), aufbereitet in sf/ (siehe sf/LIESMICH.txt)
    options: { program: ntPlayProgram(pref.instr), qpm,
      soundFontUrl: pref.instr === 1074 ? new URL('sf/', location.href).href : undefined,
      fadeLength: pref.instr === 1074 ? 150 : pref.instr >= 1000 ? 50 : undefined, /* Aufnahme: kurzer natürlicher Ausklang */
      sequenceCallback: tr => { try { ntLegato(tr, qpm, ntPlayProgram(pref.instr)); } catch (e) {} }, onEnded: () => { if (token === ntPlay.token && ntPlay.state !== 'pause') { ntClearHighlight(); ntPlayRun(tunes, i + 1, token); } } }, // pause() löst ebenfalls onEnded aus
  }).then(() => synth.prime()).then(() => {
    if (token !== ntPlay.token) return;
    // Startposition (Ab Stelle abspielen, Orgel): Zeit der gewählten Note
    let startSec = 0;
    if (tunes[i].startChar != null) {
      try {
        const tc = new ABCJS.TimingCallbacks(tunes[i].obj, { qpm });
        const evn = (tc.noteTimings || []).find(e => e.type === 'event' && (e.startCharArray || [e.startChar]).indexOf(tunes[i].startChar) >= 0);
        if (evn) startSec = Math.max(0, evn.milliseconds / 1000);
      } catch (e) {}
      if (startSec > 0) synth.seek(startSec, 'seconds');
    }
    if (tunes[i].highlight) {
      ntPlay.timer = new ABCJS.TimingCallbacks(tunes[i].obj, {
        qpm,
        eventCallback: ev => {
          if (!ev) { ntClearHighlight(); return; }
          if (tunes[i].map) {
            const els = [];
            (ev.startCharArray || [ev.startChar]).forEach(c => (tunes[i].map.get(c) || []).forEach(el => els.push(el)));
            if (!els.length && ev.type !== 'end') return; // nur Unterstimmen wechseln: Hervorhebung stehen lassen
            ntClearHighlight();
            els.forEach(el => { if (el && el.classList) el.classList.add('nt-playing'); });
            return;
          }
          ntClearHighlight();
          if (!ev.elements) return;
          ev.elements.forEach(group => (group || []).forEach(el => { if (el && el.classList) el.classList.add('nt-playing'); }));
        },
      });
      if (startSec > 0) ntPlay.timer.start(startSec, 'seconds'); else ntPlay.timer.start();
    }
    synth.start();
    gregGst('Wiedergabe' + (tunes.length > 1 ? ' (Abschnitt ' + (i + 1) + ' von ' + tunes.length + ')' : '') + ' – ' + ((NT_INSTRUMENTS.find(x => x.p === pref.instr) || {}).n || '') + ', ♪ = ' + pref.tempo);
  }).catch(err => {
    if (token !== ntPlay.token) return;
    gregGst('Wiedergabe nicht möglich: ' + (err && err.message ? err.message : err) + ' (Klänge werden beim ersten Mal aus dem Internet geladen)');
    ntPlayStop();
  });
}

