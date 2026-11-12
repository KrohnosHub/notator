// ── TAB SWITCHING (editor ↔ GABC) ──────────────────────────────────
// ══════════════════════════════════════════════════════════════
// ── KLASSISCHE ÜBERTRAGUNG (Choral → moderne Notation, ABC/abcjs) ──
// ══════════════════════════════════════════════════════════════
// Übertragungsregeln (recherchiert, Solesmes-Praxis, vgl. "Guide to
// Singing Chant", CC Watershed; WIMA-Einführung zur Übertragung):
//  - Grundwert Punctum = 1 Puls = Achtel (L:1/8), keine Taktart (M:none).
//  - Punctum mora (.) verdoppelt den Wert -> Viertel (.. -> +2).
//  - Wiederholte Töne gleicher Höhe ohne Trennung (Bi-/Tristropha,
//    Bi-/Trivirga, Pressus) = EIN Ton mit summierter Dauer (2/3 Pulse).
//  - Horizontales Episem = leichte Dehnung, KEINE Verdopplung -> Tenuto.
//  - Quilisma: die VORANGEHENDE Note wird leicht gedehnt -> Tenuto dort;
//    die Quilisma-Note selbst ist eine normale Note.
//  - Liqueszenz: kleine Note mit normalem Wert.
//  - b molle (x) gilt bis zum nächsten Trennstrich (Standard, opts.flatToBar)
//    bzw. streng nach Solesmes bis Wortende; y hebt auf.
//  - Divisio minima -> Atemzeichen, minor -> Taktstrich, maior ->
//    Doppelstrich, finalis -> Doppelstrich (am Schluss Schlussstrich).
//  - Noten einer Silbe werden gebalkt und bei Melisma mit Bogen verbunden.
// Tonhöhe: Do-Schlüssel-Linie = C, Fa-Schlüssel-Linie = F; Oktavlage wird
// automatisch so gewählt, dass die Melodie mittig im Violinschlüssel liegt.
// Transposition: Finalis (Schlusston) -> gewählter Zielgrundton, mit
// korrekter Buchstaben-Schreibung (Intervall aus Stufen + Halbtönen);
// Vorzeichnung = transponierte Ausgangsvorzeichnung (Modus bleibt erhalten).

const CL_LETTERS = ['C','D','E','F','G','A','B'];
const CL_NAT_PC  = [0,2,4,5,7,9,11];
const CL_FIFTHS  = [0,2,4,-1,1,3,5]; // Quintenzirkel-Position der Stammtöne
const CL_MODE_NAMES = ['ion','dor','phr','lyd','mix','aeo','loc'];
const CL_MODE_DE = ['ionisch','dorisch','phrygisch','lydisch','mixolydisch','äolisch','lokrisch'];

function clMod(a, n) { return ((a % n) + n) % n; }

// Diatonische Nummer D = Oktave*7 + Stufe (C=0 … B=6); pc = Tonhöhenklasse
function clPcOf(step, alt) { return clMod(CL_NAT_PC[clMod(step, 7)] + alt, 12); }

function clCleanText(t) {
  return String(t || '')
    .replace(/<alt>[\s\S]*?<\/alt>/gi, '').replace(/<v>[\s\S]*?<\/v>/gi, '')
    .replace(/\[[^\]]*\]/g, '') // Übersetzung [..] gehört nicht in die Orgel-Textzeile
    .replace(/<\/?(?:i|b|ul|c|sc|tt|v|e|nlba|clear|pr|alt|eu)[^>]*>/gi, '')
    .replace(/<sp>([^<]*)<\/sp>/gi, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── 1. GABC parsen ──────────────────────────────────────────────
// Ergebnis: { title, annotation, mode, events[] }
// events: {k:'note', D, alt, dur, ten, liq, quil, sylStart, text, wordEnd, hyphen}
//         {k:'bar', t:'minima'|'minor'|'maior'|'finalis'}
//         {k:'text', text}   (Silbe ohne Noten, z.B. "iij.", "Ant.", "*")
const CL_MARK_ONLY_RE = /^\s*(?:(?:[VR]\s*\/|[℣℟])\.?|i{1,3}j\.|Ps\.|Ant\.|\*)\s*$/;
const CL_VR_RE = /^\s*(?:[VR]\s*\/|[℣℟])/;
function clParseGabc(gabc, popts) {
  const flatToBar = !!(popts && popts.flatToBar); // ♭ gilt bis zum nächsten Trennstrich statt bis Wortende
  const out = { title: '', subtitle: '', annotation: '', mode: '', events: [] };
  let body = gabc;
  const hdrSplit = gabc.match(/^([\s\S]*?)\n?%%\s*\n?([\s\S]*)$/);
  if (hdrSplit && /:/.test(hdrSplit[1])) {
    body = hdrSplit[2];
    hdrSplit[1].split(/\n/).forEach(line => {
      const m = line.match(/^\s*([\w-]+)\s*:\s*(.*?);?\s*$/);
      if (!m) return;
      const key = m[1].toLowerCase(), val = m[2];
      if (key === 'name') out.title = clCleanText(val);
      else if (key === 'notator-subtitle') out.subtitle = val.replace(/\\n/g, '\n');
      else if (key === 'annotation') out.annotation = out.annotation ? out.annotation + ' ' + val : val;
      else if (key === 'mode') out.mode = val;
    });
  }
  body = body.replace(/%[^\n]*/g, ''); // Kommentare

  // Schlüssel-Zustand
  let clefType = 'c', clefLine = 3, clefFlat = false;
  const clefD = () => (clefType === 'c' ? 4 * 7 + 0 : 4 * 7 + 3) - (clefType === 'f' ? 7 : 0);
  const letterIdx = ch => ch.toLowerCase().charCodeAt(0) - 97; // a=0 … m=12
  const DofLetter = ch => clefD() + (letterIdx(ch) - (1 + 2 * clefLine));

  let activeAcc = {};       // D -> alt  (b molle / Auflösung / Kreuz)
  const accReset = () => { activeAcc = {}; };
  const altFor = D => {
    if (D in activeAcc) return activeAcc[D];
    if (clefFlat && clMod(D, 7) === 6) return -1; // Schlüssel mit b (cb3/cb4)
    return 0;
  };

  let pendingText = '';        // notenlose Silbe, wird der nächsten Silbe vorangestellt
  let pendingTextHyphen = false;
  let lastNoteEv = null;

  const groupRe = /([^()]*)\(([^)]*)\)/g;
  let m, firstGroup = true;
  const sylls = [];
  while ((m = groupRe.exec(body))) { const vp = m[1].split('|'); sylls.push({ raw: vp[0], notes: m[2], verses: vp.length > 1 ? vp.slice(1) : null }); }

  // Wortgrenzen: Silbe beginnt neues Wort, wenn ihr Text mit Leerraum
  // beginnt (oder erste Silbe). Wortende = nächste Silbe beginnt neues Wort.
  sylls.forEach((s, i) => {
    s.newWord = firstGroup || /^\s/.test(s.raw) || s.raw === '';
    firstGroup = false;
    s.text = clCleanText(s.raw);
  });
  for (let i = 0; i < sylls.length; i++) {
    // nächste Silbe MIT Text bestimmt, ob das Wort weitergeht
    let j = i + 1;
    while (j < sylls.length && !sylls[j].text && sylls[j].raw === '') j++;
    sylls[i].wordContinues = j < sylls.length && sylls[j].text !== '' && !/^\s/.test(sylls[j].raw);
  }

  sylls.forEach(s => {
    if (s.text && s.newWord && !flatToBar) accReset();
    const n = s.notes;
    let i = 0;
    let sylNotesStart = true;
    let sepSinceLast = true;     // Trennung zum vorigen Ton (für Tonwiederholungs-Verschmelzung)
    let prevInGroup = null;
    let hadNote = false;
    const textHere = s.text;

    const startSyllableIfNeeded = ev => {
      if (!sylNotesStart) return;
      sylNotesStart = false;
      if (textHere || pendingText) {
        let txt = textHere;
        if (pendingText) txt = pendingText + (pendingTextHyphen ? '-' : ' ') + textHere;
        pendingText = '';
        ev.sylStart = true;
        ev.text = txt;
        ev.hyphen = s.wordContinues;
        if (s.verses && textHere) ev.verses = s.verses.map(v => { const t = clCleanText(String(v).replace(/-\s*$/, '')); return { text: t, hyphen: /-\s*$/.test(v) }; });
      }
    };

    while (i < n.length) {
      const c = n[i];
      const rest = n.slice(i);
      // Schlüssel
      const cm = rest.match(/^(c|f)(b?)([1-5])(?:@[cf]b?[1-5])?/); // Doppelschlüssel: erster Teil gilt
      if (cm && (i === 0 || /[\s:;,]/.test(n[i - 1]))) {
        clefType = cm[1]; clefFlat = cm[2] === 'b'; clefLine = parseInt(cm[3], 10);
        i += cm[0].length; continue;
      }
      // Divisiones
      const dm = rest.match(/^(::|:|;|,|`)(\??'?[0-9]*)/);
      if (dm) {
        const t = dm[1] === '::' ? 'finalis' : dm[1] === ':' ? 'maior' : dm[1] === ';' ? 'minor' : 'minima';
        if (textHere && !hadNote && sylNotesStart) { out.events.push({ k: 'text', bar: true, text: pendingText ? pendingText + ' ' + textHere : textHere }); pendingText = ''; sylNotesStart = false; }
        else if (pendingText) { out.events.push({ k: 'text', text: pendingText }); pendingText = ''; } // notenloser Text vor dem Strich (z.B. "Ende()" oder "te.()") nicht verlieren
        out.events.push({ k: 'bar', t });
        accReset();
        sepSinceLast = true; prevInGroup = null;
        i += dm[0].length; continue;
      }
      // Klammer-Attribute [..]
      if (c === '[') { const e = n.indexOf(']', i); i = e < 0 ? n.length : e + 1; continue; }
      if (c === '/' || c === ' ') { sepSinceLast = true; i++; continue; }
      if (c === '!') { i++; continue; }
      if (c === 'z' || c === 'Z') {
        i++;
        if (n[i] === '0') { i++; continue; } // z0 = nur Custos, kein Umbruch
        if (n[i] === '+' || n[i] === '-') i++;
        out.events.push({ k: 'brk' }); // Zeilenumbruch im Choral (gilt standardmässig auch für die Orgel)
        continue;
      }
      if (/[a-mA-M]/.test(c)) {
        const nx = n[i + 1] || '';
        // Vorzeichen-Deklaration (z.B. "ix" = b auf i)
        if (nx === 'x' || nx === 'y' || nx === '#') {
          const D = DofLetter(c);
          activeAcc[D] = nx === 'x' ? -1 : nx === '#' ? 1 : 0;
          i += 2;
          while (n[i] === '?' || n[i] === '#' && nx === '#') i++;
          continue;
        }
        if (nx === '+') { i += 2; continue; } // Custos
        // Note mit Modifikatoren
        const D = DofLetter(c);
        let j = i + 1;
        let mora = 0, ten = false, liq = false, quil = false, strophaLike = false;
        while (j < n.length) {
          const d = n[j];
          if (d === '.') { mora++; j++; }
          else if (d === '_') { ten = true; j++; while (/[0-5]/.test(n[j] || '')) j++; }
          else if (d === "'") { j++; while (/[01]/.test(n[j] || '')) j++; }
          else if (d === '~' || d === '<' || d === '>') { liq = true; j++; }
          else if (d === 'w' || d === 'W') { quil = true; j++; }
          else if (d === 's' || d === 'v' || d === 'V') { strophaLike = true; j++; }
          else if (/[oOrRq=@\-]/.test(d)) { j++; while (/[0-9]/.test(n[j] || '')) j++; }
          else if (/[0-9]/.test(d)) { j++; }
          else if (d === '[') { const e = n.indexOf(']', j); j = e < 0 ? n.length : e + 1; }
          else break;
        }
        i = j;
        const alt = altFor(D);
        // Tonwiederholung ohne Trennung -> verschmelzen (Stropha, Pressus, Bivirga)
        if (prevInGroup && !sepSinceLast && prevInGroup.D === D && prevInGroup.alt === alt && !prevInGroup.liq) {
          prevInGroup.dur += 1 + mora;
          if (ten) prevInGroup.ten = true;
          if (liq) prevInGroup.liq = true;
          sepSinceLast = false;
          continue;
        }
        // Note vor dem Quilisma wird gedehnt – auch über die Silbengrenze
        // hinweg (nicht über einen Trennstrich: dann ist das letzte Ereignis ein Strich)
        if (quil) {
          const pv = out.events[out.events.length - 1];
          if (pv && pv.k === 'note') { pv.ten = true; pv.preQuil = true; }
        }
        const ev = { k: 'note', D, alt, dur: 1 + mora, ten, liq };
        startSyllableIfNeeded(ev);
        out.events.push(ev);
        prevInGroup = ev; lastNoteEv = ev; hadNote = true;
        sepSinceLast = false;
        continue;
      }
      i++; // unbekanntes Zeichen überspringen
    }
    // Silbe ganz ohne Noten und ohne Divisio -> an nächste Silbe hängen
    // (Rubriken wie <i>Ant.</i> bleiben eigenständige Beschriftung; eine
    // gewöhnliche notenlose Silbe -- z.B. das elidierte "i" in "e-lé-i-son"
    // -- wird dem Text der nächsten Silbe vorangestellt.)
    if (!hadNote && sylNotesStart && textHere) {
      if (/<i>|<sp>/i.test(s.raw)) {
        out.events.push({ k: 'text', text: pendingText ? pendingText + ' ' + textHere : textHere }); pendingText = '';
      } else {
        pendingText = pendingText ? pendingText + (pendingTextHyphen ? '-' : ' ') + textHere : textHere;
        pendingTextHyphen = s.wordContinues;
      }
    }
    if (!s.wordContinues && hadNote && !flatToBar) accReset();
  });
  if (pendingText) out.events.push({ k: 'text', text: pendingText }); // notenloser Text ganz am Schluss
  return out;
}

// ── 2. Transposition ──────────────────────────────────────────
// Intervall = (diatonische Stufen d, Halbtöne semi) von Finalis -> Ziel.
function clSpellTranspose(D, alt, d, semi) {
  const nD = D + d;
  const natDiff = (Math.floor(nD / 7) * 12 + CL_NAT_PC[clMod(nD, 7)]) - (Math.floor(D / 7) * 12 + CL_NAT_PC[clMod(D, 7)]);
  return { D: nD, alt: alt + (semi - natDiff) };
}

function clFinalis(parsed) {
  for (let i = parsed.events.length - 1; i >= 0; i--) {
    const e = parsed.events[i];
    if (e.k === 'note') return { D: e.D, alt: e.alt };
  }
  return { D: 4 * 7 + 1, alt: 0 };
}

// Tonart-Info zur Finalis inkl. Ausgangsvorzeichnung (0 oder 1 b bei cb-Schlüssel)
function clBaseKeyFifths(gabc) {
  const body = gabc.includes('%%') ? gabc.slice(gabc.indexOf('%%') + 2) : gabc;
  const m = body.match(/\(\s*(c|f)(b?)[1-5]/);
  return m && m[2] === 'b' ? -1 : 0;
}

function clModeIndex(finalisStep, baseFifths) {
  // Tonika der Dur-Tonart mit dieser Vorzeichnung
  const tonicStep = baseFifths === -1 ? 3 : 0; // F oder C
  return clMod(finalisStep - tonicStep, 7);
}

function clKeyName(step, alt) {
  return CL_LETTERS[clMod(step, 7)] + (alt > 0 ? '♯'.repeat(alt) : alt < 0 ? '♭'.repeat(-alt) : '');
}

// Liefert für eine Ziel-Tonhöhenklasse die beste Schreibweise des Zielgrundtons
// (Vorzeichnung mit höchstens 7, möglichst wenigen Vorzeichen).
function clBestTarget(targetPc, finalis, baseFifths) {
  const modeIdx = clModeIndex(clMod(finalis.D, 7), baseFifths);
  const modeFifthOffset = CL_FIFTHS[clMod(finalis.D, 7)] + 7 * finalis.alt - baseFifths; // Finalis relativ zur Vorzeichnung
  let best = null;
  for (let step = 0; step < 7; step++) {
    for (let alt = -2; alt <= 2; alt++) {
      if (clPcOf(step, alt) !== targetPc) continue;
      const finFifths = CL_FIFTHS[step] + 7 * alt;
      const sigFifths = finFifths - modeFifthOffset; // Vorzeichnung (+ = ♯, − = ♭)
      if (Math.abs(sigFifths) > 7) continue;
      const score = Math.abs(sigFifths) * 10 + Math.abs(alt) * 3 + (sigFifths > 0 ? 1 : 0);
      if (!best || score < best.score) best = { step, alt, sigFifths, score, modeIdx };
    }
  }
  return best;
}

