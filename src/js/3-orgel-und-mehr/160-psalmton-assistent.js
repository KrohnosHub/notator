// ── Psalmton-Assistent ───────────────────────────────────────────
// Setzt Psalmverse (oder Cantica) auf einen gregorianischen Psalmton.
// Tondaten (Mediante, feierliche Mediante, Endungen) aus dem gemeinfreien
// Projekt jgabc von Benjamin Bloomfield (github.com/bbloomf/jgabc,
// psalmtone.js, «Unlicense»). Schreibweise je Halbvers: Töne durch
// Leerzeichen getrennt; «r» = Rezitationston (beliebig viele Silben),
// «'» = Akzentsilbe, sonst genau eine Silbe; Töne vor dem ersten «r» = Initium.
const NT_PSALM_TONES = {"1.":{"c":"c4","m":"f gh hr 'ixi hr 'g hr h.","s":"f gh hr hg ixgi h hr 'hg gh..","e":{"D":"hr g f 'gh gr gvFED.","D-":"hr g f 'g gr gvFED.","D2":"hr g f gr 'gf d.","f":"hr g f 'gh gr gf..","g":"hr g f 'gh gr g.","g2":"hr g f 'g gr ghg.","g3":"hr g f 'g gr g.","a":"hr g f 'g hr h.","a2":"hr g f 'g gr gh..","a3":"hr g f 'gh gr gh.."}},"2.":{"c":"f3","m":"e f hr 'i hr h.","s":"e fe eh hr hg hi i 'hi hr h.","e":{"":"hr g 'e fr f."}},"3.":{"c":"c4","m":"g hj jr 'k jr jr 'ih j.","s":"g hj jr 'jk jr jr 'ih hj..","e":{"b":"jr h 'j jr i.","a":"jr h 'j jr ih..","a2":"jr ji hi 'h gr gh..","g":"jr ji hi 'h gr g.","g2":"jr h j i 'h gr g."}},"4.":{"c":"c4","m":"h gh hr g h 'i hr h.","s":"h gh hr hg gi i 'hi hr h.","e":{"g":"hr 'h gr g.","E":"hr g h ih gr 'gf e."}},"4. alt":{"c":"c3","m":"i hi ir h i 'j ir i.","s":"i hi ir ih hj j 'ij ir i.","e":{"c":"ir 'i hr h.","A":"ir h i j 'h fr f.","A*":"ir h i j 'h fr fg..","d":"ir h i j 'h ir i."}},"5.":{"c":"c3","m":"d f hr 'i hr h.","s":"d f hr i 'i hr h.","e":{"":"hr 'i gr 'h fr f."}},"6.":{"c":"c4","m":"f gh hr 'ixi hr 'g hr h.","s":"f gh hr hg ixgi h hr 'hg gh..","e":{"":"hr f gh 'g fr f."}},"7.":{"c":"c3","m":"hg hi ir 'k jr 'i jr j.","s":"ehg hi ir 'ik jr jr 'ji ij..","e":{"a":"ir 'j ir 'h hr gf..","b":"ir 'j ir 'h hr g.","c":"ir 'j ir 'h hr gh..","c2":"ir 'j ir 'h hr ih..","d":"ir 'j ir 'h hr gi.."}},"8.":{"c":"c4","m":"g h jr 'k jr j.","s":"g hg gj jr ji jk k 'jk jr j.","e":{"G":"jr i j 'h gr g.","G*":"jr i j 'h gr gh..","c":"jr h j 'k jr j."}},"per.":{"c":"c4","m":"ixhi hr g ixi h 'g fr f.","e":{"":"gr d 'f fr ed.."}},"in dir. romanus":{"c":"c3","m":"hr g f 'h hr h.","e":{"":"hr 'h fr f."}}};
const NT_PT_ACUTE = /[áéíóúýǽÁÉÍÓÚÝǼ]/;
// Silbentrennung: Bindestriche im Text haben Vorrang, sonst einfache
// Regeln für Latein (Diphthonge ae/oe/au, qu/gu, Muta cum liquida).
function ntPtSyllabify(word) {
  if (word.indexOf('-') > 0) return word.split('-').filter(x => x);
  const lw = word.toLowerCase();
  const VOW = 'aeiouyáéíóúýàèìòùǽæœäöüëï';
  const isV = i => {
    const c = lw[i]; if (!c || VOW.indexOf(c) < 0) return false;
    const nxtV = lw[i + 1] && VOW.indexOf(lw[i + 1]) >= 0;
    if (c === 'u' && i > 0 && (lw[i - 1] === 'q' || (lw[i - 1] === 'g' && i > 1 && lw[i - 2] === 'n')) && nxtV) return false; // qu, ngu
    if (c === 'i' && nxtV && (i === 0 || (i > 0 && VOW.indexOf(lw[i - 1]) >= 0))) return false; // konsonantisches i (iam, eius)
    return true;
  };
  const nuc = [];
  for (let i = 0; i < lw.length; i++) {
    if (!isV(i)) continue;
    let e = i;
    const two = lw.slice(i, i + 2).normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (/^(ae|oe|au)$/.test(two) && isV(i + 1) && !NT_PT_ACUTE.test(lw[i + 1]) && 'ëïüö'.indexOf(lw[i + 1]) < 0) e = i + 1; // Trema = getrennt (Is-ra-ël)
    nuc.push([i, e]); i = e;
  }
  if (nuc.length <= 1) return [word];
  const cuts = [];
  for (let k = 0; k < nuc.length - 1; k++) {
    const a = nuc[k][1] + 1, b = nuc[k + 1][0];
    const cl = lw.slice(a, b).replace(/[^a-z]/g, '');
    let cut;
    if (b - a <= 1) cut = b - a === 0 ? b : a;
    else {
      const last2 = lw.slice(b - 2, b);
      cut = (/^[bcdfgpt][lr]$/.test(last2) || /^(ch|ph|th|gn|qu|gu)$/.test(last2) || (b - a === 2 && /^s[tpc]$/.test(last2))) ? b - 2 : b - 1; // kirchenlateinisch: a-gnus, ex-quí-ro, Chri-ste, ré-spi-ce
      if (cl === 'x') cut = a;
    }
    cuts.push(cut);
  }
  const out = []; let p = 0;
  cuts.forEach(c => { out.push(word.slice(p, c)); p = c; });
  out.push(word.slice(p));
  return out.filter(x => x);
}
// Halbvers -> Silbenliste mit Akzent (Akut im Text; sonst 2-silbig: 1. Silbe,
// mehrsilbig: vorletzte; Einsilbler unbetont)
function ntPtSyllables(text) {
  const syls = [];
  text.trim().split(/\s+/).filter(w => /[A-Za-zÀ-ÿǽǼæœÆŒ]/.test(w)).forEach(w => {
    const parts = ntPtSyllabify(w);
    let acc = parts.findIndex(x => NT_PT_ACUTE.test(x));
    if (acc < 0) acc = parts.length === 2 ? 0 : parts.length >= 3 ? parts.length - 2 : -1;
    parts.forEach((t, i) => syls.push({ t, acc: i === acc, wordStart: i === 0, wordEnd: i === parts.length - 1 }));
  });
  return syls;
}
function ntPtParse(pattern) {
  return pattern.trim().split(/\s+/).map(tok => {
    const accent = tok[0] === "'"; let t = accent ? tok.slice(1) : tok;
    const open = /r$/.test(t); // «r» ist kein Notenbuchstabe (a–m): Rezitationston
    if (open) t = t.replace(/r$/, '');
    return { notes: t, accent, open };
  });
}
// Einen Halbvers setzen: Initium vorn, Kadenz von hinten, Rest auf dem Rezitationston
function ntPtApply(syls, pattern, withIntonation) {
  const toks = ntPtParse(pattern);
  const firstOpen = toks.findIndex(t => t.open);
  const inton = firstOpen > 0 ? toks.slice(0, firstOpen) : [];
  const cad = toks.slice(firstOpen >= 0 ? firstOpen : 0);
  const notes = new Array(syls.length).fill(null);
  let pos = syls.length - 1;
  for (let k = cad.length - 1; k >= 1 && pos >= 0; k--) {
    const tk = cad[k];
    if (tk.open) {
      const prev = cad[k - 1];
      if (prev && prev.accent) { while (pos >= 0 && !syls[pos].acc) { notes[pos] = tk.notes; pos--; } }
      continue;
    }
    notes[pos] = tk.notes; pos--;
  }
  const tenor = cad[0] ? cad[0].notes : 'h';
  let start = 0;
  if (withIntonation) inton.forEach((tk, i) => { if (i <= pos) { notes[i] = tk.notes; start = i + 1; } });
  for (let i = start; i <= pos; i++) notes[i] = tenor;
  return { notes, tenor };
}
function ntPtGabcSyls(syls, notes) {
  let out = '';
  syls.forEach((s, i) => { out += (s.wordStart && i > 0 ? ' ' : '') + s.t.replace(/[()]/g, '') + '(' + (notes[i] || 'h') + ')'; });
  return out;
}
function ntPtFlexNote(tenor, clef) {
  // Flexa: eine Stufe unter dem Rezitationston, kleine Terz, wenn darunter ein Halbton liegt (wie jgabc)
  const ci = (clef[0] === 'f' ? 6 : 1) + parseInt(clef.slice(-1), 10) * 2;
  const tn = ((parseInt(tenor[0], 36) - 10) + 16 - ci) % 8;
  return String.fromCharCode(tenor.charCodeAt(0) - ((tn === 0 || tn === 3) ? 2 : 1));
}
function ntPsalmToneGabc(o) {
  const T = NT_PSALM_TONES[o.tone]; if (!T) throw new Error('Unbekannter Psalmton');
  const term = T.e[o.ending] != null ? T.e[o.ending] : T.e[Object.keys(T.e)[0]];
  const med = o.solemn && T.s ? T.s : T.m;
  const lines = o.text.split(/\n/).map(l => l.replace(/^\s*\d+[.)]?\s*/, '').trim()).filter(l => l);
  if (o.gloria) lines.push('Glória Patri, et Fílio, * et Spirítui San-cto.', 'Sicut erat in princípio, et nunc, et semper, * et in sǽcula sæculórum. Amen.');
  if (!lines.length) throw new Error('Kein Text');
  const verses = lines.map((l, vi) => {
    const parts = l.split('*');
    if (parts.length < 2) throw new Error('Vers ' + (vi + 1) + ': Stern * für die Mitte fehlt');
    let first = parts[0], flex = null;
    const fx = first.split(/[†+]/);
    if (fx.length > 1) { flex = fx[0]; first = fx.slice(1).join(' '); }
    const into = vi === 0 || o.everyIntonation;
    let g = '';
    const medT = ntPtParse(med); const tenor = (medT.find(t => t.open) || { notes: 'h' }).notes;
    if (flex && flex.trim()) {
      const fs = ntPtSyllables(flex);
      const fn = ntPtFlexNote(tenor, T.c);
      const r = ntPtApply(fs, (into ? med.split(/\s+/).slice(0, Math.max(0, medT.findIndex(t => t.open))).join(' ') + ' ' : '') + tenor + 'r \'' + tenor + ' ' + fn + 'r ' + fn + '.', into);
      g += ntPtGabcSyls(fs, r.notes) + ' †(,) ';
    }
    const ms = ntPtSyllables(first);
    g += ntPtGabcSyls(ms, ntPtApply(ms, med, into && !flex).notes) + ' *(:) ';
    const ts = ntPtSyllables(parts.slice(1).join(' '));
    g += ntPtGabcSyls(ts, ntPtApply(ts, term, false).notes) + ' (::)';
    return g;
  });
  const ann = o.tone.replace(/\.$/, '').replace(/^per$/, 'per.') + (o.ending ? ' ' + o.ending : '');
  // anderer Schlüssel: dieselbe Melodie in anderer Lage im System
  const clef = o.clef && o.clef !== T.c ? o.clef : T.c;
  const body = clef === T.c ? verses.join(' (z)\n') : ntGpShiftGabc(verses.join(' (z)\n'), ntGpDoIdx(clef) - ntGpDoIdx(T.c));
  return 'name: ' + (o.title || 'Psalm') + ';\nannotation: ' + ann + ';\nmode: ' + o.tone.replace(/\..*$/, '') + ';\n%%\n(' + clef + ') ' + body;
}
function ntPsalmSecKey() {
  const multi = window._gregMultiSection && gregSections.length > 1;
  return (multi && gregSections[gregActiveIdx] ? gregSections[gregActiveIdx].id : 'single') + '@' + (typeof gregLibCurrentId !== 'undefined' && gregLibCurrentId != null ? gregLibCurrentId : '-');
}
// Wohin mit dem gesetzten Psalmvers? Leerer Abschnitt: direkt hinein; sonst Auswahl
function ntPsalmTargetChoice() {
  if (!gregEntries.some(e => e.type === 'note')) return Promise.resolve('section');
  const multi = window._gregMultiSection && gregSections.length > 1;
  const nm = multi ? 'Abschnitt ' + (gregActiveIdx + 1) : 'dem Stück';
  return new Promise(resolve => {
    showModal('♫ Psalmvers einfügen', 'Wohin soll der Psalmvers?', [
      { label: '➕ Als neuen Abschnitt anfügen', fn: () => { closeModal(); resolve('newsec'); } },
      { label: '↧ Ans Ende von ' + nm, fn: () => { closeModal(); resolve('append'); } },
      { label: '⟲ ' + (multi ? 'Abschnitt ' + (gregActiveIdx + 1) : 'Stück') + ' ersetzen', fn: () => { closeModal(); resolve(multi ? 'section' : 'new'); } },
      ...(multi ? [{ label: '✚ Neues Stück', fn: () => { closeModal(); resolve('new'); } }] : []),
      { label: 'Abbrechen', fn: () => { closeModal(); resolve(null); } }
    ]);
  });
}
function ntPsalmToneShow() {
  let p = {}; try { p = JSON.parse(localStorage.getItem('notatorPsalmTone') || '{}'); } catch (e) {}
  // Text und Titel nur im selben Abschnitt vorschlagen (pro Abschnitt ein eigener Psalmvers)
  const secKey = ntPsalmSecKey();
  if (p.secKey !== secKey) { p.text = ''; p.title = ''; }
  showModal('♫ Psalmton-Assistent', '', []);
  const body = document.getElementById('modal-body');
  const tones = Object.keys(NT_PSALM_TONES);
  body.innerHTML =
    '<div style="display:flex;gap:8px;flex-wrap:wrap;font-size:12px;align-items:center">' +
    '<label>Ton <select id="pt-tone" style="font-size:13px">' + tones.map(t => '<option' + (t === (p.tone || '8.') ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></label>' +
    '<label>Endung <select id="pt-end" style="font-size:13px"></select></label>' +
    '<label title="Schlüssel des Ergebnisses: «wie Psalmton» = übliche Lage dieses Tons; ein anderer Schlüssel schreibt dieselbe Melodie höher/tiefer ins System (z.B. wie in deiner Vorlage)">Schlüssel <select id="pt-clef" style="font-size:13px"><option value="">wie Psalmton</option>' + ['c1', 'c2', 'c3', 'c4', 'f2', 'f3', 'f4'].map(c => '<option' + (c === p.clef ? ' selected' : '') + '>' + c + '</option>').join('') + '</select></label>' +
    '<label>Titel <input id="pt-title" type="text" value="' + ntEscAttr(p.title || '') + '" placeholder="z.B. Psalm 109" style="font-size:13px;width:150px"></label></div>' +
    '<div style="display:flex;gap:12px;flex-wrap:wrap;font-size:12px;margin:6px 0">' +
    '<label><input type="checkbox" id="pt-every"' + (p.every ? ' checked' : '') + '> Initium in jedem Vers (Canticum)</label>' +
    '<label><input type="checkbox" id="pt-solemn"' + (p.solemn ? ' checked' : '') + '> feierliche Mediante (Magnificat/Benedictus)</label>' +
    '<label><input type="checkbox" id="pt-gloria"' + (p.gloria ? ' checked' : '') + '> Gloria Patri anhängen</label></div>' +
    '<textarea id="pt-text" rows="9" style="width:100%;box-sizing:border-box;font-size:13px;font-family:inherit" placeholder="Ein Vers pro Zeile, Mitte mit *, Flexa mit †, z.B.\nDixit Dóminus Dómino méo: * Sede a déxtris méis.\nDonec ponam inimícos túos, * scabéllum pédum tuórum.">' + ntEscAttr(p.text || '') + '</textarea>' +
    '<div style="font-size:11px;color:var(--ink2);margin:4px 0;line-height:1.5">' +
    '<b>Zeichen im Text:</b><br>' +
    '• <b>Zeilenumbruch</b> = neuer Vers (jeder Vers eine Zeile; eine Versnummer am Zeilenanfang wird ignoriert)<br>' +
    '• <b>*</b> = Mitte des Verses (Mediante) – in <b>jedem</b> Vers nötig: <i>Dixit Dóminus Dómino meo: * Sede a dextris meis.</i><br>' +
    '• <b>†</b> oder <b>+</b> = Flexa (Atempause im ersten Halbvers, Ton sinkt kurz), nur bei langen Versen: <i>Donec ponam inimícos tuos † scabéllum pedum tuórum: * …</i><br>' +
    '• <b>´</b> Akut = betonte Silbe (Dóminus) – bestimmt, wo die Kadenzen ansetzen. Ohne Akut: zweisilbige Wörter auf der 1. Silbe, längere auf der vorletzten betont.<br>' +
    '• <b>-</b> Bindestrich = Silbentrennung selbst festlegen (Herr-lich-keit), sonst automatisch (Latein).<br>' +
    'Gloria Patri und Intonation (Initium) setzt der Assistent selbst – Häkchen oben. Ergebnis bitte prüfen.</div>' +
    '<div id="pt-msg" style="font-size:11px;color:#a03020;min-height:14px"></div>';
  const fillEnd = () => {
    const T = NT_PSALM_TONES[document.getElementById('pt-tone').value];
    const es = Object.keys(T.e);
    document.getElementById('pt-end').innerHTML = es.map(e => '<option' + (e === p.ending ? ' selected' : '') + ' value="' + ntEscAttr(e) + '">' + (e || '–') + '</option>').join('');
    document.getElementById('pt-solemn').disabled = !T.s;
  };
  fillEnd();
  document.getElementById('pt-tone').onchange = fillEnd;
  const bEl = document.getElementById('modal-btns');
  const mk = (label, fn, css) => { const b = document.createElement('button'); b.className = 'b'; b.textContent = label; if (css) b.style.cssText = css; b.onclick = fn; bEl.appendChild(b); };
  mk('Abbrechen', () => closeModal());
  mk('♫ Noten setzen', async () => {
    const o = { tone: document.getElementById('pt-tone').value, ending: document.getElementById('pt-end').value, title: document.getElementById('pt-title').value.trim(),
      everyIntonation: document.getElementById('pt-every').checked, solemn: document.getElementById('pt-solemn').checked && !document.getElementById('pt-solemn').disabled,
      gloria: document.getElementById('pt-gloria').checked, text: document.getElementById('pt-text').value, clef: document.getElementById('pt-clef').value };
    let gabc;
    try { gabc = ntPsalmToneGabc(o); } catch (e) { document.getElementById('pt-msg').textContent = e.message; return; }
    closeModal();
    if (window._ntTab !== 'greg') switchTab('greg');
    const target = await ntPsalmTargetChoice();
    if (!target) return;
    if (target === 'new' && !(await ntConfirmDiscard())) return;
    if (target === 'new' && typeof gregCollapseSections === 'function') gregCollapseSections();
    gregPush();
    if (target === 'newsec') { gregAddSection(); gregImportGABCString(gabc); }
    else if (target === 'append') {
      // ans Ende des aktiven Abschnitts, im Schlüssel dieses Abschnitts
      const T = NT_PSALM_TONES[o.tone], src = o.clef && o.clef !== T.c ? o.clef : T.c;
      let body = gabc.slice(gabc.indexOf('%%') + 2).replace(/^\s*\([cf]b?[1-5]\)\s*/, '');
      body = ntGpShiftGabc(body, ntGpDoIdx(gregClefVal) - ntGpDoIdx(src));
      const ne = gregGabcToEntries('(' + gregClefVal + ') ' + body);
      const last = gregEntries[gregEntries.length - 1];
      if (last && last.type !== 'divisio') gregEntries.push({ type: 'divisio', div: '::', glueToPrevSpecial: false });
      gregEntries.push({ type: 'linebreak' }, ...ne);
      gregRefreshList();
    }
    else gregImportGABCString(gabc);
    if (target === 'new' && typeof clState !== 'undefined') ntResetOrganForImport();
    try { localStorage.setItem('notatorPsalmTone', JSON.stringify({ tone: o.tone, ending: o.ending, title: o.title, every: o.everyIntonation, solemn: o.solemn, gloria: o.gloria, text: o.text, clef: o.clef, secKey: ntPsalmSecKey() })); } catch (e) {}
    gregGst('Psalmton ' + o.tone + (o.ending ? ' ' + o.ending : '') + ' gesetzt – bitte Silbentrennung und Akzente prüfen.');
  }, 'background:#3d6b35;color:#fff;border-color:#3d6b35');
}

