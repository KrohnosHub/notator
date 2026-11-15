// ════════════════════════════════════════════════════════════════
//  GREG EDITOR — Click-on-SVG-staff input → GABC → exsurge
// ════════════════════════════════════════════════════════════════
let gregEntries = [], gregHistory = [], gregRedoHistory = [], gregClefVal = 'c3';
// Schlüssel aus dem Original, den die 4 Schlüssel-Knöpfe nicht abbilden (cb3 mit b, c2, f2, c3@f3 …)
var gregClefRaw = '';
var gregHdrExtra = ''; // unbekannte GABC-Kopffelder (mode, book, office-part …) – unverändert durchgereicht
// id of the library entry the currently open piece was loaded from/last
// saved to (null = never saved to the library yet in this session, so the
// next "In Bibliothek speichern" creates a new entry instead of updating).
let gregLibCurrentId = null;
let _gregScore = null, _gregCtxtRef = null, _gregPending = null;

// Schlüssel: alte Kurznamen (do/do4/fa/fa4, in gespeicherten Stücken) plus
// alle gabc-Schlüssel auf 4 Linien: c1–c4, f1–f4, jeweils auch mit b (cb3 …).
const GREG_CLEF_MAP = {'do':'c3','do4':'c4','fa':'f3','fa4':'f4'};
['c', 'f', 'cb', 'fb'].forEach(l => [1, 2, 3, 4].forEach(n => { GREG_CLEF_MAP[l + n] = l + n; }));
const NEUME_PITCHES = {
  punctum:1, virga:1, quilisma:1,
  podatus:2, clivis:2,
  torculus:3, porrectus:3, scandicus:3, climacus:3, salicus:3,
  // Extended
  apostropha:1, distropha:1, bivirga:1, trivirga:1,
  puncta_inclinata:3, pes_subpunctis:4, pes_quassus:2,
  torculus_resupinus:4, porrectus_flexus:4, scandicus_flexus:4,
  // Bistropha/Tristropha: free note choices (not locked to same pitch)
  bistropha:2, tristropha:3,
};

// Neumes in this list are not capped at their NEUME_PITCHES count -- that
// number is only the MINIMUM before the neume can be finished. Added
// 2026-08-10 for Climacus after surveying 45+ real GregoBase/Solesmes
// chants for genuine "virga + puncta inclinata" usage (see NOTES): almost
// every real-world occurrence has MORE than 2 trailing inclinata notes, and
// exsurge's own Climacus class already supports an arbitrary number of
// them (virgaAt(notes[0]).withInclinati(notes.slice(1))) -- only the
// click-editor's fixed 3-click limit was artificially capping it. See
// gregHandleClick (open-ended continuation) and gregFinishPendingNeume.
const NEUME_OPEN_ENDED = ['climacus'];

// Neume types whose legacy (manual/click-editor) formula in
// buildSingleNeumeGABC can carry a Quilisma modifier on one of their
// notes -- added 2026-08-10. Excludes types where a quilisma is not
// meaningful: single-note types (Quilisma already exists as its own
// dedicated neume), same-pitch-repeat types (Bistropha/Tristropha/
// Bivirga/Trivirga/Distropha), and Puncta Inclinata (already
// diamond-shaped, not compatible with the quilisma glyph).
const QUILISMA_APPLICABLE = ['podatus','clivis','salicus','torculus','porrectus',
  'scandicus','climacus','pes_subpunctis','pes_quassus',
  'torculus_resupinus','porrectus_flexus','scandicus_flexus'];

function staffPosToGabc(sp) {
  const code = sp + 6 + 97;
  return (code >= 97 && code <= 109) ? String.fromCharCode(code) : 'f';
}


// ── Verlustfreier Import (Gregorio-Abgleich 2026-10-10) ──────────────
// exsurge versteht nicht alle gabc-Zeichen bzw. Notators Eintragsmodell
// kennt nicht alle (Punctum cavum r, Linea R, Akzente r1–r5, Quadratum q,
// Fusion @, Initio debilis -, Liqueszenz-Richtung < >, Oriscus o0/o1,
// Inclinatum-Richtung G0–G2, kurze Episemen _0–_5, Klammern/Chorzeichen
// [..], Feinabstände /0 /[n], Custos, Schlüsselwechsel, z/Z). Darum wird die
// Notenschrift beim Einlesen zusätzlich selbst zerlegt und das Original je
// Note gemerkt; beim Speichern wird es wieder ausgegeben, solange die Note
// in Notator nicht verändert wurde.
function gregGabcRawTokens(body) {
  const notes = [], clefs = [], custos = [];
  const groupRe = /\(([^)]*)\)/g; let g;
  while ((g = groupRe.exec(body))) {
    const t = g[1]; let i = 0, sep = '', pre = '', last = null;
    while (i < t.length) {
      const c = t[i];
      if (c === '[') { const j = t.indexOf(']', i); const br = j < 0 ? t.slice(i) : t.slice(i, j + 1);
        if (last && !sep && !pre) last.suf += br; else pre += br; i = j < 0 ? t.length : j + 1; continue; }
      const clef = /^[cf]b?[1-5](@[cf]b?[1-5])?/.exec(t.slice(i));
      if (clef && (i === 0 || /[\s/!]/.test(t[i - 1])) && !/^[a-m]/i.test(t.slice(i + clef[0].length))) {
        clefs.push(clef[0]); i += clef[0].length; last = null; sep = ''; pre = ''; continue; }
      if (/[a-mA-M]/.test(c)) {
        const nx = t[i + 1] || '';
        if (nx === 'x' || nx === 'y' || nx === '#') { i += 2; if (t[i] === '?') i++; last = null; continue; } // Vorzeichen
        if (nx === '+') { custos.push(c + '+'); i += 2; last = null; continue; } // Custos
        let j = i + 1;
        while (j < t.length) {
          const d = t[j];
          if (/[vVwsoOrRq<>~.'_]/.test(d) || (/[0-9]/.test(d) && /[oO'_rRvVsSG0-9a-mA-M]/.test(t[j - 1]))) { j++; continue; }
          if (d === '[') { const k = t.indexOf(']', j); j = k < 0 ? t.length : k + 1; continue; }
          break;
        }
        last = { pitch: c.toLowerCase(), pre, suf: t.slice(i + 1, j), sep };
        notes.push(last); i = j; sep = ''; pre = ''; continue;
      }
      if (c === '/') { let j = i + 1; if (t[j] === '/') j++; else if (t[j] === '0') j++; else if (t[j] === '[') { const k = t.indexOf(']', j); j = k < 0 ? t.length : k + 1; }
        sep += t.slice(i, j); i = j; continue; }
      if (c === '!') { sep += '!'; i++; continue; }
      if (c === '-' || c === '@' || c === '{' || c === '}') { pre += c; i++; continue; }
      if (c === ' ') { i++; continue; }
      i++; sep = ''; pre = ''; last = null; // Divisio, z, Z, sonstiges
    }
  }
  return { notes, clefs, custos };
}
function gregRawNoteSig(n) {
  return [n.pitch, n.shape || 0, !!n.episema, !!n.ictus, n.ictusPos || '', !!n.liquescent, !!n.mora].join('|');
}

// Note (1-basiert), vor der das Vorzeichen steht: gespeichert, aus der
// importierten Tonhöhe abgeleitet oder wie bisher geschätzt (Clivis: 1. Note,
// sonst 2. Note bei mehrtönigen Neumen).
function gregAccPosOf(e) {
  const ps = (e.pitches || []).map(x => String(x).toLowerCase());
  if (e.accidentalPos) return e.accidentalPos;
  if (e.accidentalPitch) { const k = ps.indexOf(String(e.accidentalPitch).toLowerCase()); return k >= 0 ? k + 1 : 0; }
  return ps.length > 1 && e.neume !== 'clivis' ? 2 : 1;
}
function buildSingleNeumeGABC(e) {
  // ── New path: use precise per-note data if available ──────────
  if (e.notes && e.notes.length) {
    // NoteShapeModifiers constants (from exsurge):
    // Ascending=1, Descending=2, Liquescent=4, Cavum=8, ...
    const SM_ASCENDING  = 1;
    const SM_DESCENDING = 2;
    // Accidentals are NOT emitted here — emitParenGroup() always prepends a
    // standalone accidental group ("(ix)(hi)" GABC convention) before
    // calling this function, for single- AND multi-note neumes alike, using
    // the accidental's own captured staff position (which can differ from
    // this neume's note pitches, e.g. "ix" priming I before an unrelated
    // "g" note).
    return e.notes.map((n, i) => {
      // Original-gabc der Note, solange unverändert (siehe gregGabcRawTokens)
      if (n.gabcSuf !== undefined && n.gabcSig === gregRawNoteSig(n)) {
        const pc = (n.shape === 2) ? n.pitch.toUpperCase() : n.pitch;
        return (n.gabcPre || '') + pc + n.gabcSuf;
      }
      // ix prefix (ascending quilisma/oriscus variant) = shapeModifiers & Ascending
      let prefix = '';
      if (n.shapeModifiers) {
        if (n.shapeModifiers & SM_ASCENDING)  prefix = 'i';
        // > (descending modifier) not represented in GABC pitch notation
      }
      let s = prefix;
      // Pitch: Inclinatum (shape 2) = uppercase
      const pitchChar = (n.shape === 2) ? n.pitch.toUpperCase() : n.pitch;
      s += pitchChar;
      // Shape suffixes
      if (n.shape === 1) s += 'v';       // Virga
      else if (n.shape === 3) s += 'w';  // Quilisma
      else if (n.shape === 4) s += 's';  // Stropha
      else if (n.shape === 5) s += 'o';  // Oriscus
      if (n.episema)    s += '_';
      if (n.ictus)      s += "'" + (n.ictusPos === 'above' ? '1' : n.ictusPos === 'below' ? '0' : '');
      if (n.liquescent) s += '~';
      if (n.mora)       s += '.';
      return s;
    }).join('');
  }

  // ── Legacy fallback path: old 13-type guess-based reconstruction
  //    (used for entries created via the click-editor before this
  //    change, or hand-built entries without e.notes). ──────────────
  const rp = e.rawPitches || e.pitches;
  const dot = e.mora?'.':'';
  // Ictus position suffix ('1'=above, '0'=below, none=exsurge's own
  // per-neume default) -- added 2026-08-10, see convertNote's
  // n.ictusPos capture and gregEditEntry's "oben/unten" dropdown.
  const ik = e.iktus ? ("'" + (e.iktusPos === 'above' ? '1' : e.iktusPos === 'below' ? '0' : '')) : '';
  const ep = e.episema?'_':'';
  const liq = e.liquescent, oris = e.oriscus, stroph = e.strophicus, pres = e.pressus;

  function lastMod(note) {
    if (liq)    return note + '~';
    if (oris)   return note + 'o';
    if (stroph) return note + 's';
    if (pres)   return note + '~';
    return note;
  }
  // Quilisma modifier ('w'): applied generically here (not per switch-case
  // below) so every legacy neume type that can sensibly carry one
  // (QUILISMA_APPLICABLE, e.g. Podatus/Torculus/Climacus...) supports it on
  // any one note, via e.quilisma + e.quilismaPos (1-based note index) --
  // mirrors e.episema/e.episemaPos. Added 2026-08-10: fixes Quilisma being
  // silently unrepresentable (and thus destroyed on save) for any manually
  // edited or click-built multi-note neume. Deliberately excludes neume
  // types with their OWN dedicated 'w' handling (e.g. case 'quilisma'
  // below already appends its own 'w') to avoid a doubled "ww".
  const quilismaHere = (i) => e.quilisma && e.quilismaPos && (e.quilismaPos - 1) === i && QUILISMA_APPLICABLE.includes(e.neume);
  // Extra mora positions ('.' on notes OTHER than the last): e.moraExtra
  // is an array of 1-based note indices, added 2026-08-10 alongside the
  // existing e.mora/dot (which still always covers the LAST note, exactly
  // as before -- unchanged, zero regression risk). Real gabc convention
  // for "mora on a non-final note" is the dot placed right after THAT
  // note's own pitch letter (e.g. "g.h" = mora on g, not h) -- which is
  // exactly what embedding it into r(i) produces. Confirmed real-world
  // need: e.g. a 2-note Podatus/Clivis where BOTH notes carry a mora, not
  // just the last one.
  const moraExtra = e.moraExtra || [];
  const moraExtraHere = (i) => moraExtra.includes(i + 1) && (i + 1) !== rp.length;
  const r = (i) => {
    let p = rp[i] || rp[0] || 'a';
    if (quilismaHere(i)) p += 'w';
    if (moraExtraHere(i)) p += '.';
    return p;
  };
  // Case-forcing variant of r(i): re-applies gregDefaultNoteCase's shape
  // rule (punctum inclinatum = capitalized pitch letter) EVERY time GABC
  // is built, instead of relying on the letter case already being correct
  // in rp/e.pitches. Fixes a real bug (2026-09-29, user report): rp comes
  // from e.pitches, which the entry-edit form (gregEditEntry) always reads
  // and writes back as PLAIN lowercase letters (its "Töne" text field has
  // no per-note shape control) -- so opening a pes_subpunctis/puncta_
  // inclinata entry and saving it WITHOUT any change silently lost the
  // capitalization, degrading the shape on next render (a Pes Subpunctis
  // "ijIH" turned into plain "ijih", which exsurge then auto-classifies as
  // an unrelated Torculus+Punctum shape -- confirmed via real GABC
  // round-trip test, see notator_workflow_rules). Using gregDefaultNoteCase
  // here instead of a separate hardcoded rule keeps creation-time and
  // export-time casing as ONE single source of truth.
  const rc = (i) => {
    let p = gregDefaultNoteCase(e.neume, i, rp[i] || rp[0] || 'a');
    if (quilismaHere(i)) p += 'w';
    if (moraExtraHere(i)) p += '.';
    return p;
  };

  // Accidentals are NOT emitted inline here — emitParenGroup() always
  // prepends a standalone accidental group ("(ix)(hi)" GABC convention)
  // before calling this function, for every neume type alike.
  switch(e.neume) {
    case 'punctum':    return lastMod(r(0)) + ep + ik + dot;
    case 'virga':      return r(0) + 'v' + ep + ik + dot;
    case 'quilisma':   return r(0) + 'w' + dot;
    case 'podatus':    return r(0) + lastMod(r(1)) + ep + ik + dot;
    case 'clivis':     return r(0) + lastMod(r(1)) + ep + ik + dot;
    // Salicus is intrinsically a 3-note figure (per exsurge's own Salicus
    // class, which directly indexes notes[0..2] — and per real chant
    // notation): punctum, then an ASCENDING note marked oriscus ('o'
    // suffix — this is what exsurge's parser state machine keys off to
    // even recognise the group as a Salicus at all, see podatusState ->
    // salicusState transition, requires prevNote.shape===Oriscus), then a
    // third, highest note that exsurge's Salicus.performLayout always
    // draws as a virga regardless of any suffix on it. A 2-note "salicus"
    // is not a distinct neume at all — 2 ascending notes are always parsed
    // back as a plain Podatus (found+fixed 2026-07-22, see notator_workflow_rules).
    case 'salicus':    return r(0) + r(1) + 'o' + r(2) + ep + ik + dot;
    case 'torculus':   {
      const epos = e.episemaPos || 3;
      return r(0) + (epos===1?ep:'') + r(1) + (epos===2?ep:'') + lastMod(r(2)) + (epos===3?ep:'') + ik + dot;
    }
    case 'porrectus':  {
      const epos = e.episemaPos || 1;
      return r(0) + (epos===1?ep:'') + r(1) + lastMod(r(2)) + (epos===3?ep:'') + ik + dot;
    }
    case 'scandicus':  {
      const epos = e.episemaPos || 3;
      // NOTE (fixed 2026-08-01, Runde 59): no trailing 'v' on the third note.
      // A 'v' here forces exsurge's Scandicus to render as "podatus + virga"
      // (see its own performLayout comment) instead of the correct/expected
      // "punctum + podatus" -- plain ascending notes already classify as a
      // Scandicus on their own (podatusState -> scandicusState), no 'v' modifier needed.
      return r(0) + (epos===1?ep:'') + r(1) + (epos===2?ep:'') + lastMod(r(2)) + (epos===3?ep:'') + dot;
    }
    case 'climacus':   {
      // Virga on the first note, then an arbitrary number (>=2) of
      // trailing puncta-inclinata-shaped notes -- uncapped 2026-08-10,
      // see NEUME_OPEN_ENDED comment. Falls back to a 2-note tail if
      // rp has only 3 entries total (unchanged old behaviour).
      let s = r(0) + 'v';
      const n = rp.length;
      for (let i = 1; i < n; i++) s += (i === n - 1) ? lastMod(r(i)) : r(i);
      return s + ep + dot;
    }
    case 'bistropha':  return r(0) + 's' + r(1) + 's' + dot;
    case 'tristropha': return r(0) + 's' + r(1) + 's' + r(2) + 's' + dot;
    // Extended neume types
    case 'apostropha':         return r(0) + 's' + dot;
    case 'distropha':          return r(0) + r(0) + dot;
    case 'bivirga':            return r(0) + 'v' + r(0) + 'v' + dot;
    case 'trivirga':           return r(0) + 'v' + r(0) + 'v' + r(0) + 'v' + dot;
    case 'puncta_inclinata':   return rc(0) + rc(1) + rc(2) + dot;
    // Pes subpunctis = Podatus (r0,r1, normal punctum shape) + subpunctis
    // (r2,r3, punctum inclinatum shape = capitalized pitch letter, per GABC
    // convention: "a capitalized pitch letter represents a punctum
    // inclinatum"). Both subpunctis notes get capitalized, not just the
    // last one — verified against a real GABC source re-imported from
    // Source & Summit ("efED": lowercase Podatus e-f, then BOTH trailing
    // subpunctis notes E-D capitalized). Uses rc() (not r()) so this stays
    // correct even after an edit-form save, see rc's own comment above.
    case 'pes_subpunctis':     return r(0) + r(1) + rc(2) + rc(3) + dot;
    case 'pes_quassus':        return r(0) + 'o' + r(1) + dot;
    case 'torculus_resupinus': return r(0) + r(1) + r(2) + r(3) + dot;
    case 'porrectus_flexus':   return r(0) + r(1) + r(2) + r(3) + dot;
    case 'scandicus_flexus':   return r(0) + r(1) + r(2) + r(3) + dot;
    default:           return lastMod(r(0)) + dot;
  }
}

// Strophentext einer Silbe für GABC: Klammern/Trenner/Markup entfernen, «-» am Ende = Wort geht weiter
function gregVerseEsc(v) {
  return String(v || '').replace(/[()|{}\[\]*_^%<>]/g, '').replace(/\s+/g, ' ').trim();
}
function gregEntriesToBody(entries, clefGabc, clefRaw) {
  // Strophennummer + Doppelstrich + (Zeilenumbruch) + Noten: Der Doppelstrich gehört ans Ende der vorhergehenden Zeile, die Nummer
  // mit den Noten auf die neue Zeile. Bei untereinander gesetzten Strophen wird die Nummer (wie «2.», «3.» …) in die erste Silbe
  // gesetzt, damit «1.» an derselben Stelle steht wie die anderen Nummern.
  {
    const isNum = x => x && (x.type === 'directive' || x.type === 'special' || x.type === 'textonly') && /^\s*\d+\.?\s*$/.test(x.text || '');
    const isResp = x => x && (x.type === 'directive' || x.type === 'special' || x.type === 'textonly') && /^\s*(℟|R\/\.?)\s*$/.test(x.text || '');
    const isMark = x => isNum(x) || isResp(x);
    let moved = null;
    if (entries.some(x => x && (x.type === 'linebreak' || isNum(x) || (Array.isArray(x.verses) && x.syllable)))) {
      const out = []; let ch = false;
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        if (isMark(e)) {
          let j = i + 1, lb1 = 0; while (j < entries.length && entries[j].type === 'linebreak') { lb1++; j++; }
          const dv = entries[j];
          if (dv && dv.type === 'divisio' && dv.div === '::') {
            let k = j + 1, lb2 = 0; while (k < entries.length && entries[k].type === 'linebreak') { lb2++; k++; }
            const nx = entries[k], lbs = lb1 + lb2;
            if (nx && nx.type === 'note' && (isNum(e) || lbs)) {
              const preLB = out.length && out[out.length - 1].type === 'linebreak';
              if (preLB) out.pop();
              out.push(Object.assign({}, dv, { glueToPrevSpecial: false })); // steht jetzt hinter den Noten der vorigen Zeile, nicht mehr hinter der Marke
              if (preLB || lbs) out.push({ type: 'linebreak' });
              if (Array.isArray(nx.verses) && nx.syllable) out.push(Object.assign({}, nx, { startsWord: true, syllable: (isNum(e) ? String(e.text).trim().replace(/\.?$/, '.') : 'R/.') + ' ' + nx.syllable }));
              else { out.push(e); out.push(nx); }
              i = k; ch = true; continue;
            }
          }
        }
        if (e.type === 'linebreak' && out.length && isMark(out[out.length - 1])) {
          const n = out.pop();
          if (!(out.length && out[out.length - 1].type === 'linebreak')) out.push(e);
          out.push(n); ch = true; continue;
        }
        // «℟.» + Doppelstrich + Kehrvers-Noten mit Strophentexten: ℟ als Silbenvorsatz (wie in den übrigen Strophenzeilen), damit es direkt vor dem Kehrvers steht
        if (e.type === 'note' && Array.isArray(e.verses) && e.syllable && out.length >= 2) {
          const d = out[out.length - 1], r = out[out.length - 2];
          if (d.type === 'divisio' && d.div === '::' && (r.type === 'special' || r.type === 'textonly' || r.type === 'directive') && /^\s*(℟|R\/\.?)\s*$/.test(r.text || '')) {
            out.splice(out.length - 2, 2, Object.assign({}, d, { glueToPrevSpecial: false })); // ℟ entfernen, Doppelstrich bleibt
            out.push(Object.assign({}, e, { startsWord: true, syllable: 'R/. ' + e.syllable })); ch = true; continue;
          }
        }
        out.push(e);
      }
      if (ch) moved = out;
    }
    if (moved) entries = moved;
  }
  if (clefRaw === undefined) clefRaw = (entries === gregEntries && clefGabc === gregClefVal) ? gregClefRaw : '';
  if (clefRaw) clefGabc = clefRaw;
  // WICHTIG (Session 21, per echtem Rendering-Test widerlegt): ein
  // frueherer Versuch, ein Silben-"/" beim Export in <sp>/</sp> zu
  // escapen (um es vor exsurges Schraegstrich-Verschlucken bei einem
  // erneuten Import zu schuetzen), wurde hier bewusst wieder entfernt.
  // Grund: <sp>...</sp> ist KEINE exsurge-Rendering-Funktion -- exsurge
  // kennt dieses Tag beim Parsen ueberhaupt nicht (kein einziges
  // Vorkommen von "sp>" in der ganzen Bibliothek) und zeigt es beim
  // RENDERN darum als LITERALEN Text an ("V<sp>/</sp>." statt "V/.").
  // <sp> wird nur von Notators eigenem cleanSyl() beim IMPORT einmalig
  // interpretiert und entfernt -- die von gregEntriesToBody erzeugte
  // GABC-Zeichenkette wird aber direkt an exsurge zum RENDERN
  // weitergereicht (kein erneuter cleanSyl-Durchlauf dazwischen), darum
  // brach das Escapen die sichtbare Notenausgabe. Ein bare "/" ausserhalb
  // von <sp> wird von exsurge beim Parsen ohnehin schon verschluckt
  // (lyric.text verliert es), UND ZWAR SCHON BEIM ALLERERSTEN RENDERN --
  // das war folglich nie sichtbar unterschiedlich (die Notenausgabe zeigt
  // so oder so nur "V." ohne Schraegstrich). Die reine TEXT-Roundtrip-
  // Stabilitaet (Export-Text exakt gleich nach zweitem Reimport) ist damit
  // zwar nicht mehr 100% garantiert, aber das betrifft nur die interne
  // GABC-Zeichenkette, nie das tatsaechlich gerenderte Notenbild.
  const frags = [{text: '(' + clefGabc + ')', glue: false}];
  // Weitere Strophen (Text unter gleicher Melodie): e.verses = ['Silbe Str. 2', 'Silbe Str. 3', …]
  const verseN = entries.reduce((m, e) => Math.max(m, e && e.type === 'note' && e.syllable && Array.isArray(e.verses) ? e.verses.length : 0), 0);
  let runVerses = null;
  // Strophen untereinander: erste Silbe jeder Phrase (Stückanfang, nach Zeilenumbruch/Teilstrich) mit dem 1. Buchstaben unter der Note
  // verankern ({x}-Zentrierung), damit alle Strophen an derselben Stelle beginnen statt je nach Silbenlänge zentriert verschoben
  let atPhraseStart = true, runPhraseStart = false;
  const leftMark = t => { const m = /^(\s*(?:\d+\.|R\/\.)\s*)?([^\s{}<>_|]*?)([A-Za-zÀ-ÿ])/.exec(t); if (!m || m[2] || /[<>_{}]/.test(t)) return t; const i = m[0].length - 1; return t.slice(0, i) + '{' + t[i] + '}' + t.slice(i + 1); };

  let prevRunHyphen = false;
  let inRun = false;
  let runEmittedSyllable = false;
  let runSyllable = '', runItalic = false, runHyphenForThisRun = false, runWordEnd = undefined;
  let runMappingIdx = null; // mappingIdx of the entry that started the current run
  let openParts = [];
  let openGroupGlue = false;
  let lastWasLinebreak = false;

  // Lookahead: does the next 'note' entry after index i (skipping any
  // divisio tokens in between) have an EMPTY syllable AND belong to the
  // SAME original exsurge mapping group as the run currently in progress?
  // Both conditions are required — an empty syllable alone isn't enough,
  // since a standalone trailing melisma (its own mapping, after a divisio)
  // also has empty syllable text but must NOT be glued to the previous word.
  function nextNoteContinuesRun(fromIdx, expectedMappingIdx) {
    for (let j = fromIdx + 1; j < entries.length; j++) {
      const t = entries[j].type;
      if (t === 'divisio') continue;
      if (t === 'note') {
        return !entries[j].syllable && entries[j].mappingIdx === expectedMappingIdx;
      }
      return false;
    }
    return false;
  }

  function emitParenGroup() {
    if (!openParts.length) return;
    let sylText = '';
    if (!runEmittedSyllable) {
      sylText = runItalic ? '_' + runSyllable + '_' : runSyllable;
      if (verseN && runSyllable && Array.isArray(runVerses)) {
        if (runPhraseStart && !runItalic) sylText = leftMark(sylText);
        for (let k = 0; k < verseN; k++) { const vt = gregVerseEsc(runVerses && runVerses[k]); sylText += '|' + (runPhraseStart ? leftMark(vt) : vt); }
      }
      runEmittedSyllable = true;
    }

    // Split the run into segments at every part carrying an accidental —
    // GABC requires an accidental to be its own standalone group
    // immediately before the note(s) it affects (matches convention
    // "(ix)(hi)" rather than "(hixi)", which would break the neume state
    // machine). Previously only openParts[0] was ever checked, so an
    // accidental on a LATER part of a multi-part melisma run (e.g. one
    // that appears after a "//" divider, mid-syllable) was silently
    // dropped — the data was captured correctly on import
    // (entry.accidental), it just never made it back out through export.
    let sylAttached = false;
    let firstFragEmitted = false;
    let segmentParts = [];

    function flushSegment() {
      if (!segmentParts.length) return;
      const gabcParts = segmentParts.map((p, i) => {
        const g = buildSingleNeumeGABC(p.e);
        if (i === 0) return g;
        // Feinabstand aus dem Original (/0, /[n]) beibehalten
        if (!p.noGapBefore && !p.gapWide && p.e.sepRaw && /^\/(0|\[-?[\d.]+\])$/.test(p.e.sepRaw)) return p.e.sepRaw + g;
        return (p.noGapBefore ? '!' : (p.gapWide ? '//' : '/')) + g;
      });
      const syl = sylAttached ? '' : sylText;
      sylAttached = true;
      const glue = firstFragEmitted ? true : openGroupGlue;
      firstFragEmitted = true;
      frags.push({text: syl + '(' + gabcParts.join('') + ')', glue});
      segmentParts = [];
    }

    function pushAccidentalGroup(e) {
      let accPitch = e.accidentalPitch;
      if (!accPitch && e.accidentalPos && e.pitches && e.pitches[e.accidentalPos - 1]) {
        // Vorzeichen gezielt vor einer bestimmten Note (z.B. b auf der 2. Note einer Clivis)
        accPitch = String(e.pitches[e.accidentalPos - 1]).toLowerCase();
      }
      if (!accPitch) {
        // No stored accidental pitch (e.g. click-editor entry, or legacy
        // data): fall back to guessing from the neume's own note pitches.
        let accPitchIdx = 0;
        if (e.pitches && e.pitches.length > 1) {
          accPitchIdx = 1;
          if (e.neume === 'clivis') accPitchIdx = 0;
        }
        accPitch = (e.pitches && e.pitches[accPitchIdx]) || (e.pitches && e.pitches[0]);
      }
      if (!accPitch) return;
      const glue = firstFragEmitted ? true : openGroupGlue;
      firstFragEmitted = true;
      frags.push({text: '(' + accPitch + e.accidental + ')', glue});
    }

    for (const p of openParts) {
      if (p.e.accidental) {
        flushSegment(); // emit whatever came before this accidental as its own group first
        pushAccidentalGroup(p.e);
      }
      segmentParts.push(p);
    }
    flushSegment(); // emit the trailing (or, if no accidentals at all, the only) segment

    openParts = [];
  }

  function endRun() {
    emitParenGroup();
    inRun = false;
    // Word boundary logic:
    // - wordEnd=true → next entry starts a new word → GABC space (glue=false)
    // - wordEnd=false → next entry continues same word → no GABC space (glue=true)
    // - For imported GABC: hyphen=true means within-word (glue=true), hyphen=false=word-end
    // - wordEnd overrides hyphen if explicitly set
    if (runWordEnd !== undefined) {
      // Explicitly set: wordEnd=true → word boundary, wordEnd=false → same word
      prevRunHyphen = !runWordEnd;
    } else if (runHyphenForThisRun) {
      // Import flag: hyphen=true = within-word → glue
      prevRunHyphen = true;
    } else {
      // No explicit wordEnd set (click-editor) AND hyphen=false:
      // Default to WITHIN-WORD (glue=true) so notes don't get word spacing.
      // The user must explicitly set wordEnd=true on the last syllable of each word.
      prevRunHyphen = true;
    }
    runEmittedSyllable = false;
    runSyllable = ''; runItalic = false; runHyphenForThisRun = false; runWordEnd = undefined;
    runMappingIdx = null;
  }

  for (let idx = 0; idx < entries.length; idx++) {
    const e = entries[idx];
    if (e.type === 'note') {
      const continuesCurrentRun = inRun && !e.syllable && e.mappingIdx === runMappingIdx;
      if (!continuesCurrentRun) {
        if (inRun) endRun();
        runSyllable = e.syllable; runItalic = e.italic; runHyphenForThisRun = e.hyphen; runWordEnd = e.wordEnd;
        runVerses = e.verses || null;
        runPhraseStart = atPhraseStart; atPhraseStart = false;
        runMappingIdx = e.mappingIdx;
        runEmittedSyllable = false;
        inRun = true;
        openParts = [{e, noGapBefore:false}];
        openGroupGlue = prevRunHyphen && !e.startsWord;
      } else {
        openParts.push({e, noGapBefore: !!e.noGapBefore, gapWide: !!e.gapWide});
        if (e.wordEnd === true) runWordEnd = true; // Wortende nach silbenloser Gruppe ("A(f)(g) B")
      }
      lastWasLinebreak = false;
      continue;
    }

    if (e.type === 'divisio') {
      const midMelisma = inRun && nextNoteContinuesRun(idx, runMappingIdx);
      if (!midMelisma) atPhraseStart = true;
      const glueDivisio = (inRun && midMelisma) || !!e.glueToPrevSpecial;
      emitParenGroup();
      frags.push({text: '(' + e.div + ')', glue: glueDivisio, div: true});
      if (midMelisma) {
        openGroupGlue = true;
      } else if (inRun) {
        endRun();
      }
      lastWasLinebreak = false;
      continue;
    }

    if (inRun) endRun();
    if (e.type === 'special')        { frags.push({text: e.text, glue:false, special: true}); }
    else if (e.type === 'textonly')  { frags.push({text: e.text + '()', glue:false}); }
    // Exported as gabc's <i>...</i> HTML-style italic markup rather than
    // the native "_..._()" underscore syntax (changed 2026-08-10, per
    // user request): real-world sources (GregoBase, Source&Summit, ...)
    // universally use <i>...</i>, and Notator's own import already
    // recognizes it as the PRIMARY match (italicWholeMatch in
    // gregImportGABCString) -- so this round-trips correctly and produces
    // text that looks like what a Notator user would see when comparing
    // against those external sources. The native "_..._()" import path
    // (nativeItalicMatch) is kept for backward compatibility with already
    // -exported older .gabc files and other native-gabc sources.
    //
    // Trailing "()" (2026-08-10 Runde 2, REVERTED 2026-08-13 Runde 3 --
    // see below): briefly tried dropping "()" whenever a note-bearing
    // entry followed directly, to match GregoBase's literal parenless
    // source spelling ("<i>Ps.</i> Cán(...)"). That relies on exsurge's
    // own "bare text glues onto the next note" behaviour -- which merges
    // the directive's raw characters INTO the same lyric string as the
    // following real syllable for RENDERING purposes, not just for
    // Notator's own import bookkeeping. exsurge centers a lyric
    // horizontally under its note by searching that merged string for its
    // first vowel (Latin.findVowelSegment, checked in FIXED PRIORITY order
    // a/e/i/o/u -- not left-to-right by position) -- so whenever the
    // directive's own text happens to contain whichever vowel wins that
    // priority search (confirmed via real testing: "Ant." always does, "a"
    // is checked first; "iij." does too whenever the following syllable's
    // first vowel is only "i"/"o"/"u", checked after "a"/"e"), the WHOLE
    // note group visually shifts left onto the directive text itself
    // instead of the real word -- exactly the "notes sit above Ant./iij.,
    // not above the real syllable" bug reported 2026-08-13. "Ps."/"ij."
    // happened to look fine only by coincidence (their own text has no
    // vowel, or the following word's higher-priority vowel wins first).
    //
    // FIRST attempt (2026-08-13, Runde 3) was to keep "()" but glue it
    // (NO gabc space) directly onto the following word, reasoning that
    // exsurge's Gabc.splitWords() only treats a space as a WORD boundary
    // when it follows ")" -- so gluing would keep everything as one
    // compact gabc "word" while __syllablesRegex still split it into two
    // independent Lyric objects internally. That part was correct, but
    // it turned out to be solving a problem that didn't exist: per
    // exsurge's OWN spacing code (checked directly, not guessed), the gap
    // AFTER a notation is controlled entirely by that notation's own
    // `trailingSpace` property -- `ctxt.interSyllableSpacing` (the
    // "real" inter-word constant) is computed but never actually READ
    // anywhere else in the whole library, i.e. dead/unused. Whether two
    // notations sit in the same gabc "word" or in separate ones makes
    // NO visual difference at all. The true cause of "Ps./Ant. floats
    // with too much space around it" is that TextOnly's `trailingSpace`
    // is never explicitly set during parsing (stays at exsurge's -1
    // sentinel), which the generic layout fallback then resolves to
    // `ctxt2.intraNeumeSpacing * 4` -- a FULL word-gap-sized default,
    // regardless of gluing. Real fix (2026-08-13, Runde 4): a dedicated
    // exsurge patch shrinks TextOnly's own trailingSpace directly (see
    // patchTextOnlyTrailingSpace below, same proven technique as the
    // existing patchDividerLeadingSpace for barlines) -- so the gabc text
    // itself is free to go back to matching the real S&S/GregoBase source
    // convention exactly: "()" WITH a normal space before the next word
    // (as requested), with the tight visual spacing handled purely at the
    // rendering layer instead.
    else if (e.type === 'directive') { frags.push({text: '<i>' + e.text + '</i>()', glue:false}); prevRunHyphen = false; /* folgende Noten nie ins gleiche Wort ziehen (sonst «ij.-») */ }
    else if (e.type === 'dropcapletter') { frags.push({text: '<sp>' + e.text + '</sp>()', glue:false}); }
    else if (e.type === 'comment')   { /* no GABC output */ }
    else if (e.type === 'linebreak') { frags.push({text: e.justify ? '(z)' : '(Z)', glue:false}); lastWasLinebreak = true; continue; }
    else if (e.type === 'raw') { frags.push({text: e.gabc, glue:false}); }
    lastWasLinebreak = false;
  }
  if (inRun) endRun();

  if (lastWasLinebreak) frags.push({text:'(,)', glue:false});

  let body = '';
  frags.forEach((f, i) => {
    if (i === 0) { body = f.text; return; }
    let t = f.text;
    // Sonderzeichen (z.B. "*") direkt vor einer Notengruppe OHNE eigenen
    // Text (z.B. Vorzeichen "(ix)lae"): als "*()" ausgeben -- sonst hängt
    // exsurge den Stern an eine notenlose Gruppe und das ganze Notenbild
    // bleibt leer (Fehler "needsLayout", Nutzerbericht 2026-10-05).
    const nx = frags[i + 1];
    if (f.special && nx && !nx.div && !nx.glue && /^\(/.test(nx.text)) t += '()';
    body += (f.glue ? '' : ' ') + t;
  });
  return body.trim();
}

function gregBuildGABC() {
  const ann = (document.getElementById('greg-annotation')||{value:''}).value.trim();
  const dc = (document.getElementById('greg-dropcap')||{checked:false}).checked;
  const title = (document.getElementById('greg-title')||{value:''}).value.trim();
  const subtitle = (document.getElementById('greg-subtitle')||{value:''}).value;
  let header = '';
  if (title) header += 'name: ' + title + '\n';
  const comm = (document.getElementById('greg-commentary')||{value:''}).value.trim();
  if (comm) header += 'commentary: ' + comm + ';\n';
  if (gregHdrExtra) header += gregHdrExtra + '\n';
  if (subtitle.trim()) {
    // Custom (non-standard) header field — GABC allows arbitrary "key: value" header
    // lines; we round-trip it ourselves on import. Encode newlines as \\n escape.
    header += 'notator-subtitle: ' + subtitle.replace(/\n/g, '\\n') + '\n';
  }
  if (ann) {
    // Support multi-line annotations (newline-separated)
    ann.split('\n').filter(Boolean).forEach(function(line) {
      header += 'annotation: ' + line + '\n';
    });
  }
  if (dc)  header += 'drop-cap: auto\n';
  if (dc && (document.getElementById('greg-dropcap2')||{}).checked) header += 'notator-initial-lines: 2\n';
  const body = gregEntriesToBody(gregEntries, gregClefVal);
  return header ? header + '%%\n' + body : body;
}

function gregGst(t) { const e=document.getElementById('greg-status'); if(e) e.textContent=t; const c=document.getElementById('cl-status'); if(c) c.textContent=t; try { ntStatusToast(t); } catch (x) {} }
// Build 346: Speichern/Exportieren immer sichtbar quittieren (Meldung ganz unten, Fehler bleiben stehen bis Tippen)
let _ntToastEl = null, _ntToastTimer = null;
function ntToast(msg, kind) {
  if (!_ntToastEl) {
    _ntToastEl = document.createElement('div'); _ntToastEl.id = 'nt-toast';
    _ntToastEl.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:100000;padding:10px 14px calc(10px + env(safe-area-inset-bottom));font:13px/1.35 system-ui,sans-serif;color:#fff;text-align:center;cursor:pointer;display:none;box-shadow:0 -2px 8px rgba(0,0,0,.35)';
    _ntToastEl.onclick = () => { _ntToastEl.style.display = 'none'; };
    document.body.appendChild(_ntToastEl);
  }
  const err = kind === 'err';
  _ntToastEl.style.background = err ? '#a8322d' : '#3d6b35';
  _ntToastEl.textContent = (err ? '✕ ' : '✓ ') + msg + (err ? '  (Tippen zum Schliessen)' : '');
  _ntToastEl.style.display = 'block';
  clearTimeout(_ntToastTimer);
  if (!err) _ntToastTimer = setTimeout(() => { _ntToastEl.style.display = 'none'; }, 7000);
}
function ntStatusToast(t) {
  t = String(t || '');
  if (/Fehler|fehlgeschlagen|abgelaufen|nicht erreichbar|nicht möglich|keine Noten/i.test(t)) ntToast(t, 'err');
  else if (/gespeichert|exportiert|hochgeladen/i.test(t)) ntToast(t, 'ok');
}
// Unerwartete Fehler während der PDF-Erzeugung nicht verschlucken
window.addEventListener('error', ev => { if (window._ntPdfBusy) { window._ntPdfBusy = 0; ntToast('PDF-Fehler: ' + (ev.message || 'unbekannt') + ' – es wurde nichts gespeichert.', 'err'); } });
window.addEventListener('unhandledrejection', ev => { if (window._ntPdfBusy) { window._ntPdfBusy = 0; ntToast('PDF-Fehler: ' + ((ev.reason && ev.reason.message) || ev.reason || 'unbekannt') + ' – es wurde nichts gespeichert.', 'err'); } });

// ══════════════════════════════════════════════════════════════
