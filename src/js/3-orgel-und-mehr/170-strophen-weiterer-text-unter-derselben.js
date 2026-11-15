// ── Strophen: weiterer Text unter derselben Melodie ─────────────────
// Jede Note mit Silbe (Strophe 1) ist ein «Platz»; e.verses[k] = Silbe der
// Strophe k+2 auf diesem Platz («-» am Ende = Wort geht weiter).
function gregVerseSlots(entries) {
  return (entries || []).filter(e => e && e.type === 'note' && e.syllable && String(e.syllable).trim() && !/^[*†+]$/.test(String(e.syllable).trim()));
}
function gregVerseCount(entries) {
  const sl = gregVerseSlots(entries);
  let n = sl.reduce((m, e) => Math.max(m, Array.isArray(e.verses) ? e.verses.length : 0), 0);
  while (n > 0 && !sl.some(e => e.verses && e.verses[n - 1])) n--;
  return n;
}
// Strophentext (Eingabe) -> Silben je Platz. «-» trennt Silben selbst,
// «_» legt zwei Silben auf eine Note (Elision), «~» = Note ohne Silbe.
function gregVerseParse(text) {
  const out = [];
  const LET = /[A-Za-zÀ-ÿǽǼæœÆŒ]/;
  String(text || '').replace(/[\r\n]+/g, ' ').trim().split(/\s+/).filter(Boolean).forEach(w => {
    if (w === '~') { out.push({ t: '', cont: false }); return; }
    if (!LET.test(w)) { // reines Satzzeichen (z.B. «–») an die vorige Silbe hängen
      if (out.length) out[out.length - 1].t += (/^[,.;:!?]/.test(w) ? '' : ' ') + w;
      return;
    }
    w.split('_').filter(Boolean).forEach((ww, wi) => {
      const parts = LET.test(ww) ? ntPtSyllabify(ww) : [ww];
      parts.forEach((p, pi) => {
        if (wi > 0 && pi === 0 && out.length) { const l = out[out.length - 1]; l.t += ' ' + p; l.cont = parts.length > 1; l.elided = true; return; }
        out.push({ t: p, cont: pi < parts.length - 1 });
      });
    });
  });
  return out;
}
// Gespeicherte Strophe k -> Eingabetext (Silbentrennung nur, wo die automatische abweicht)
function gregVerseText(entries, k) {
  const sl = gregVerseSlots(entries);
  const words = []; let cur = null;
  sl.forEach(e => {
    let v = (e.verses && e.verses[k]) || '';
    const cont = /-$/.test(v); v = v.replace(/-$/, '').trim();
    if (!v) { if (cur) { words.push(cur); cur = null; } words.push(['~']); return; }
    v = v.replace(/\s+/g, '_');
    if (!cur) cur = [];
    cur.push(v);
    if (!cont) { words.push(cur); cur = null; }
  });
  if (cur) words.push(cur);
  return words.map(p => {
    if (p.length === 1) return p[0];
    const j = p.join('');
    if (/[_~]/.test(j)) return p.join('-');
    const a = ntPtSyllabify(j);
    return (a.length === p.length && a.every((x, i) => x === p[i])) ? j : p.join('-');
  }).join(' ');
}
function gregVerseApply(entries, k, parsed) {
  const sl = gregVerseSlots(entries);
  sl.forEach((e, i) => {
    if (!Array.isArray(e.verses)) e.verses = [];
    while (e.verses.length <= k) e.verses.push('');
    let v = '';
    if (i === sl.length - 1 && parsed.length > sl.length) v = parsed.slice(i).map(x => x.t).join(' '); // Überzählige an die letzte Note
    else if (parsed[i]) v = parsed[i].t + (parsed[i].cont && parsed[i].t ? '-' : '');
    e.verses[k] = v;
  });
}
function gregVerseRemove(entries, k) {
  (entries || []).forEach(e => { if (Array.isArray(e.verses)) { e.verses.splice(k, 1); if (!e.verses.some(Boolean)) delete e.verses; } });
}
// Silben [{t, cont}] -> Eingabetext (Trennung nur, wo die automatische abweicht)
function gregSylsToText(syls) {
  const words = []; let cur = null;
  syls.forEach(s => {
    const v = String(s.t || '').trim();
    if (!v) { if (cur) { words.push(cur); cur = null; } words.push(['~']); return; }
    if (!cur) cur = [];
    cur.push(v.replace(/\s+(?=\S*[A-Za-zÀ-ÿǽæœ])/g, '_'));
    if (!s.cont) { words.push(cur); cur = null; }
  });
  if (cur) words.push(cur);
  return words.map(p => {
    if (p.length === 1) return p[0];
    const j = p.join('');
    if (/[_~]/.test(j)) return p.join('-');
    const a = ntPtSyllabify(j);
    return (a.length === p.length && a.every((x, i) => x === p[i])) ? j : p.join('-');
  }).join(' ');
}
// Vorlage-Strophe bestimmen: 1. aktuelle Markierung, 2. gespeicherte Vorlage (e.vsTpl),
// 3. erkannter Strophenbeginn «1.», 4. ganzes Stück. Liefert Indexbereich a..b.
const NT_VS_NUM = /^\s*(\d+)\.\s*/;
// Ende der Strophe, die bei Index a beginnt: nächster Doppelstrich. Steht die Strophennummer als eigener Eintrag («1.») und gleich danach
// ein Doppelstrich (Nummer | Strophe), gehört dieser zum Strophenanfang und zählt nicht als Strophenende.
function gregVerseStanzaEnd(a) {
  const all = gregEntries; let j = a;
  if (all[a] && all[a].type !== 'note') {
    let k = a + 1; while (k < all.length && (all[k].vsCopy || all[k].type === 'linebreak')) k++;
    if (k < all.length && all[k].type === 'divisio' && all[k].div === '::') j = k + 1;
  }
  for (let i = j; i < all.length; i++) if (!all[i].vsCopy && all[i].type === 'divisio' && all[i].div === '::') return i;
  for (let i = all.length - 1; i >= 0; i--) if (!all[i].vsCopy) return i;
  return -1;
}
// Kehrvers = Anfang des Stücks (gleiche Silben und Töne wie die ersten Noten, z.B. «Sal-ve.» nach jeder Strophe von «Salve Mater»):
// Index der letzten Note des Kehrverses, der direkt nach Index b folgt, sonst -1.
function gregVerseRefrainEnd(b) {
  const all = gregEntries, nz = x => String(x || '').replace(/<[^>]*>/g, '').toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
  const key = e => nz(e.syllable) + '|' + (e.pitches || []).join('');
  const head = []; for (let i = 0; i < all.length && head.length < 40; i++) { const e = all[i]; if (e.vsCopy) continue; if (e.type === 'note' && nz(e.syllable)) head.push(key(e)); else if (e.type === 'divisio' && e.div === '::') break; }
  const seg = []; let last = -1;
  for (let i = b + 1; i < all.length; i++) { const e = all[i]; if (e.vsCopy) break; if (e.type === 'linebreak') continue; if (e.type === 'divisio' && e.div === '::') break; if (e.type === 'note') { seg.push(key(e)); last = i } else if (e.type !== 'special') return -1 }
  if (!seg.length || seg.length > head.length) return -1;
  return seg.every((k, i) => k === head[i]) ? last : -1;
}
function gregVerseTemplate() {
  const all = gregEntries;
  const lastNon = () => { for (let i = all.length - 1; i >= 0; i--) if (!all[i].vsCopy) return i; return -1; };
  const endFrom = a => gregVerseStanzaEnd(a) ;
  const sel = (typeof gregBlockIdx === 'function' ? gregBlockIdx() : []).filter(i => !all[i].vsCopy);
  // endet die Vorlage mit dem Kehrvers (Stück-Anfang nach dem Strophenende), wird dieser abgeschnitten
  const trim = (a, b) => { const se = gregVerseStanzaEnd(a); return (se > a && se < b && gregVerseRefrainEnd(se) >= b) ? se : b; };
  // beginnt die Vorlage direkt nach «1.» + Doppelstrich, gehört die Strophennummer zur Vorlage (dann bekommen die weiteren Strophen auch Nummern)
  const lead = a => {
    let k = a - 1; while (k >= 0 && all[k].type === 'linebreak') k--;
    if (k >= 1 && all[k].type === 'divisio' && all[k].div === '::') { const m = all[k - 1]; if (m && !m.vsCopy && (m.type === 'directive' || m.type === 'special' || m.type === 'textonly') && /^\s*1\.?\s*$/.test(m.text || '')) return k - 1; }
    return a;
  };
  if (sel.length > 1) return { a: lead(sel[0]), b: trim(sel[0], sel[sel.length - 1]), src: 'markierter Bereich' };
  const fl = []; all.forEach((e, i) => { if (e.vsTpl && !e.vsCopy) fl.push(i); });
  if (fl.length) return { a: lead(fl[0]), b: trim(fl[0], fl[fl.length - 1]), src: 'gespeicherte Vorlage' };
  for (let i = 0; i < all.length; i++) {
    const e = all[i]; if (e.vsCopy) continue;
    const isNum = (e.type === 'note' && NT_VS_NUM.test(e.syllable || '') && /^\s*1\./.test(e.syllable)) || ((e.type === 'directive' || e.type === 'special' || e.type === 'textonly') && /^\s*1\.?\s*$/.test(e.text || ''));
    if (isNum) return { a: i, b: endFrom(i), src: 'erkannt am «1.»' };
  }
  // keine «1.», aber eine «2.»: Vorlage = alles bis zum Doppelstrich davor
  const m2 = gregVerseMarkerIdx(2, 0);
  if (m2 > 0) {
    let b = m2 - 1; while (b > 0 && all[b].type === 'linebreak') b--;
    return { a: 0, b, src: 'erkannt vor «2.»' };
  }
  return { a: 0, b: lastNon(), src: 'ganzes Stück' };
}
function gregVerseTplInfo(t) {
  const ents = gregEntries.slice(t.a, t.b + 1).filter(e => !e.vsCopy);
  const first = ents[0];
  const numKind = first && first.type !== 'note' && /^\s*\d+\.?\s*$/.test(first.text || '') ? 'dir'
    : (gregVerseSlots(ents)[0] && NT_VS_NUM.test(gregVerseSlots(ents)[0].syllable) ? 'syl' : '');
  return { ents, numKind };
}
const gregVsStripNum = s => String(s || '').replace(NT_VS_NUM, '');
// Index des Strophenbeginns «n.» (Silbe «n. Text» oder eigenes Zeichen «n.») ab Index from
function gregVerseMarkerIdx(n, from) {
  const re = new RegExp('^\\s*' + n + '\\.');
  for (let i = from || 0; i < gregEntries.length; i++) {
    const e = gregEntries[i]; if (e.vsCopy) continue;
    if (e.type === 'note' && re.test(e.syllable || '')) return i;
    if ((e.type === 'directive' || e.type === 'special' || e.type === 'textonly') && new RegExp('^\\s*' + n + '\\.?\\s*$').test(e.text || '')) return i;
  }
  return -1;
}
// Von Hand angelegte Strophen («2. …», «3. …») nach der Vorlage finden: [{k, a, b}]
function gregVerseManualFind(tplEnd) {
  const out = []; let from = tplEnd + 1, prevEnd = tplEnd;
  for (let n = 2; n < 40; n++) {
    const m = gregVerseMarkerIdx(n, from); if (m < 0) break;
    let a = m; if (a > 0 && gregEntries[a - 1].type === 'linebreak') a--;
    const b = gregVerseStanzaEnd(m);
    // Kehrvers (Noten) zwischen dem vorigen Strophenende und der Nummer: wird mit entfernt (einmal bleibt er nach den Strophen stehen)
    let ra = a;
    const mid = gregEntries.slice(prevEnd + 1, a);
    if (mid.some(e => e.type === 'note') && !mid.some(e => e.type === 'divisio' && e.div === '::')) ra = prevEnd + 1;
    out.push({ k: n - 2, a, b, ra }); from = b + 1; prevEnd = b;
  }
  return out;
}
function gregVerseRangeText(a, b) {
  const sl = gregVerseSlots(gregEntries.slice(a, b + 1));
  return gregSylsToText(sl.map((e, i) => ({ t: (i === 0 ? gregVsStripNum(e.syllable) : String(e.syllable || '')).replace(/-$/, ''), cont: e.wordEnd === false || (e.wordEnd === undefined && !!e.hyphen) })));
}
// Strophe k aus vorhandenen Noten übernehmen: Bereich im Notenbild wählen
function gregVerseStrophePick(k) {
  if (window._gregVsSave) window._gregVsSave();
  closeModal();
  if (_gregEditingEntryIdx != null) gregCloseEditForm();
  gregSelectedIndices.clear();
  window._gregVsPickK = k; window._gregBlockPick = false; window._gregBlockRange = 1;
  gregUpdateBulkToolbar(); gregBlockSync(); gregRefreshListNoRender();
}
function gregVerseOwnTexts(entries) {
  const by = {};
  (entries || []).forEach(e => { if (e && e.vsCopy && !e.vsTail) (by[e.vsCopy] = by[e.vsCopy] || []).push(e); });
  return Object.keys(by).map(Number).sort((a, b) => a - b).map(n => gregSylsToText(gregVerseSlots(by[n]).map((e, i) => ({ t: (i === 0 ? gregVsStripNum(e.syllable) : String(e.syllable || '')).replace(/-$/, ''), cont: e.wordEnd === false || (e.wordEnd === undefined && !!e.hyphen) }))));
}
// Kopien der Vorlage-Strophe direkt nach der Vorlage einfügen (Vorlage = e.vsTpl)
function gregVerseOwnApply(drafts, numKind) {
  let a = -1, b = -1; gregEntries.forEach((e, i) => { if (e.vsTpl) { if (a < 0) a = i; b = i; } });
  if (a < 0) { a = 0; b = gregEntries.length - 1; }
  const base = gregEntries.slice(a, b + 1);
  // Kehrvers-Hinweis direkt nach der Vorlage (z.B. «℟. Roráte.»): kommt nach jeder Strophe wieder
  const RESP = /^\s*(℟|R\/\.?|<sp>R\/<\/sp>)/;
  let tail = [], tEnd = b;
  {
    const f = gregEntries[b + 1];
    const txt = f ? (f.type === 'note' ? f.syllable : f.text) : '';
    if (f && !f.vsCopy && RESP.test(txt || '')) {
      let j = b + 1;
      while (j < gregEntries.length && !gregEntries[j].vsCopy) { tEnd = j; if (gregEntries[j].type === 'divisio' && gregEntries[j].div === '::') break; j++; }
      tail = gregEntries.slice(b + 1, tEnd + 1);
    }
  }
  if (!tail.length) { // Kehrvers ohne ℟-Zeichen: gleiche Silben/Töne wie der Anfang des Stücks (z.B. «Sal-ve.»)
    const re = gregVerseRefrainEnd(b);
    if (re > b) { tEnd = re; tail = gregEntries.slice(b + 1, re + 1); }
  }
  let at = tEnd + 1;
  drafts.forEach((d, k) => {
    const n = k + 2, parsed = gregVerseParse(d);
    const off = gregEntries.reduce((m, e) => Math.max(m, typeof e.mappingIdx === 'number' ? e.mappingIdx : -1), -1) + 1;
    const copy = base.filter(e => e.type !== 'comment').map(e => { const c = JSON.parse(JSON.stringify(e)); if (typeof c.mappingIdx === 'number') c.mappingIdx += off; delete c.verses; delete c.vsTpl; c.vsCopy = n; return c; });
    const slots = gregVerseSlots(copy);
    slots.forEach((e, i) => {
      const v = (i === slots.length - 1 && parsed.length > slots.length) ? { t: parsed.slice(i).map(x => x.t).join(' '), cont: false } : parsed[i];
      e.syllable = (i === 0 && numKind === 'syl' ? n + '. ' : '') + (v ? v.t : '');
      const cont = !!(v && v.cont && v.t);
      e.hyphen = cont; e.wordEnd = !cont; e.italic = false;
      for (let j = copy.indexOf(e) + 1; j < copy.length && copy[j].type === 'note' && !String(copy[j].syllable || '').trim(); j++) copy[j].wordEnd = false;
    });
    if (numKind === 'dir') copy[0].text = n + '.';
    const ins = [];
    const prev = gregEntries[at - 1];
    if (prev && prev.type !== 'linebreak') ins.push({ type: 'linebreak', vsCopy: n });
    if (!numKind) ins.push({ type: 'directive', text: n + '.', vsCopy: n });
    ins.push(...copy);
    if (tail.length) {
      const off2 = off + 100000;
      tail.filter(e => e.type !== 'comment').forEach(e => { const c = JSON.parse(JSON.stringify(e)); if (typeof c.mappingIdx === 'number') c.mappingIdx += off2; delete c.verses; delete c.vsTpl; c.vsCopy = n; c.vsTail = true; ins.push(c); });
    }
    gregEntries.splice(at, 0, ...ins);
    at += ins.length;
  });
}
function gregVerseTplPick() {
  if (window._gregVsSave) window._gregVsSave();
  closeModal();
  if (_gregEditingEntryIdx != null) gregCloseEditForm();
  gregSelectedIndices.clear();
  window._gregVsPick = true; window._gregBlockPick = false; window._gregBlockRange = 1;
  gregUpdateBulkToolbar(); gregBlockSync(); gregRefreshListNoRender();
}
// Veraltete Markierungen aus früheren Läufen entfernen: eine «Kopie» (vsCopy) ohne eigene Noten ist keine echte Strophen-Kopie,
// sondern Rest einer Markierung (z.B. nur «2.» + Doppelstrich) – sie würde im Notenbild ausgeblendet und den Assistenten verwirren.
function gregVerseSanitize() {
  const by = {}; gregEntries.forEach(e => { if (e.vsCopy) (by[e.vsCopy] = by[e.vsCopy] || []).push(e); });
  let fixed = 0;
  Object.keys(by).forEach(n => { if (!by[n].some(e => e.type === 'note')) by[n].forEach(e => { delete e.vsCopy; delete e.vsTail; fixed++; }); });
  return fixed;
}
function gregVersesShow() {
  if (window._ntTab !== 'greg') switchTab('greg');
  if (gregVerseSanitize()) { gregRefreshList(); gregBlockSync(); }
  // Zustand nach einer Auswahl im Notenbild (Vorlage bzw. Strophe aus Noten) wiederherstellen
  const st = window._gregVsState || null; window._gregVsState = null;
  const pickK = window._gregVsPickK; window._gregVsPickK = null;
  let pickRange = null;
  if (pickK != null) { const ids = gregBlockIdx(); if (ids.length) pickRange = [ids[0], ids[ids.length - 1]]; gregSelectedIndices.clear(); gregBlockSync(); }
  const tpl = st && st.tpl && pickK != null ? st.tpl : gregVerseTemplate();
  const ti = gregVerseTplInfo(tpl);
  const slots = gregVerseSlots(ti.ents);
  if (!slots.length) { gregGst('Zuerst die Melodie mit dem Text der 1. Strophe erfassen.'); return; }
  const own0 = gregEntries.some(e => e.vsCopy);
  let mode = own0 ? 'own' : 'stack';
  let drafts = own0 ? gregVerseOwnTexts(gregEntries) : [];
  let manual = {}; // k -> [a, b]: Strophe k steht schon als eigene Noten im Stück
  if (!own0) {
    const n0 = gregVerseCount(ti.ents); for (let k = 0; k < n0; k++) drafts.push(gregVsStripNum(gregVerseText(ti.ents, k)));
    if (!n0) {
      const mf = gregVerseManualFind(tpl.b);
      if (mf.length) { mode = 'own'; drafts = mf.map(m => gregVerseRangeText(m.a, m.b)); mf.forEach(m => { manual[m.k] = [m.a, m.b, m.ra]; }); }
    }
  }
  if (st) { drafts = st.drafts; mode = st.mode; manual = st.manual || {}; }
  if (pickK != null && pickRange) {
    while (drafts.length <= pickK) drafts.push('');
    drafts[pickK] = gregVerseRangeText(pickRange[0], pickRange[1]);
    manual[pickK] = pickRange;
  }
  if (!ti.numKind && Object.keys(manual).some(k => gregVerseSlots(gregEntries.slice(manual[k][0], manual[k][1] + 1)).some((e, i) => i === 0 && NT_VS_NUM.test(e.syllable)))) ti.numKind = 'syl';
  if (!drafts.length) drafts.push('');
  window._gregVsSave = () => { window._gregVsState = { drafts: drafts.slice(), mode, manual, tpl }; };
  const multi = window._gregMultiSection && gregSections.length > 1;
  showModal('📜 Strophen' + (multi ? ' – Abschnitt ' + (gregActiveIdx + 1) : ''), '', []);
  const body = document.getElementById('modal-body');
  const mel = slots.map((e, i) => (i === 0 ? gregVsStripNum(e.syllable) : String(e.syllable)).replace(/[-_]$/, ''));
  const tplTxt = gregSylsToText(slots.map((e, i) => ({ t: (i === 0 ? gregVsStripNum(e.syllable) : String(e.syllable)).replace(/-$/, ''), cont: e.wordEnd === false || (e.wordEnd === undefined && !!e.hyphen) })));
  body.innerHTML =
    '<div style="font-size:12px;margin-bottom:6px;padding:5px 7px;border:1px solid #c8bfa0;border-radius:4px;background:#fffdf6;display:flex;gap:6px;align-items:flex-start;flex-wrap:wrap">' +
    '<div style="flex:1;min-width:180px"><b>Vorlage (1. Strophe)</b> <span style="color:var(--ink2)">– ' + ntEscAttr(tpl.src) + ', ' + slots.length + ' Noten mit Silbe</span><br>' +
    '<span style="font-style:italic">«' + ntEscAttr(tplTxt.length > 90 ? tplTxt.slice(0, 60) + ' … ' + tplTxt.slice(-25) : tplTxt) + '»</span></div>' +
    '<button class="b" id="vs-tpl" style="font-size:11px;padding:2px 7px" title="Im Notenbild erste und letzte Note der Vorlage-Strophe antippen">▭ Vorlage wählen …</button></div>' +
    '<div style="display:flex;gap:12px;flex-wrap:wrap;font-size:12px;margin-bottom:6px;padding:4px 6px;background:#f3eedd;border-radius:4px">' +
    '<label><input type="radio" name="vs-mode" value="stack"' + (mode === 'stack' ? ' checked' : '') + '> Text untereinander (gleiche Noten)</label>' +
    '<label><input type="radio" name="vs-mode" value="own"' + (mode === 'own' ? ' checked' : '') + '> eigene Noten je Strophe</label></div>' +
    '<div id="vs-intro" style="font-size:12px;line-height:1.45;margin-bottom:6px"></div>' +
    '<div style="font-size:11px;color:var(--ink2);margin-bottom:8px;line-height:1.4"><b>-</b> legt die Silbentrennung fest (Glo-ri-a) · <b>_</b> legt zwei Silben auf eine Note (tu_in) · <b>~</b> lässt eine Note ohne Silbe</div>' +
    '<div id="vs-list"></div>' +
    '<button class="b" id="vs-add" style="font-size:12px;margin-top:6px">+ Strophe hinzufügen</button>';
  document.getElementById('vs-tpl').onclick = gregVerseTplPick;
  const intro = () => {
    document.getElementById('vs-intro').innerHTML = mode === 'stack'
      ? 'Weitere Strophen stehen als Textzeilen unter den Noten der Vorlage. Ganzen Text der Strophe eingeben – Notator verteilt die Silben auf die <b>' + slots.length + ' Noten mit Silbe</b>' + (ti.numKind ? ' (Strophennummer wird ergänzt)' : '') + '.'
      : 'Jede Strophe bekommt eine eigene Kopie der Vorlage-Melodie (neue Zeile, mit Strophennummer) nach der Vorlage – folgt auf die Vorlage ein Kehrvers-Hinweis (℟. …), wird er nach jeder Strophe wiederholt. Der Text wird auf die <b>' + slots.length + ' Noten mit Silbe</b> verteilt; die Noten lassen sich danach einzeln anpassen.';
  };
  document.querySelectorAll('input[name="vs-mode"]').forEach(r => r.onchange = () => { mode = r.value; intro(); });
  intro();
  const list = document.getElementById('vs-list');
  const esc = s => ntEscAttr(s);
  const draw = () => {
    list.innerHTML = drafts.map((d, k) =>
      '<div style="border:1px solid #c8bfa0;border-radius:4px;padding:6px;margin-bottom:8px">' +
      '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap"><b style="font-size:13px">Strophe ' + (k + 2) + '</b><span class="vs-stat" data-k="' + k + '" style="font-size:11px;flex:1"></span>' +
      '<button class="b vs-pick" data-k="' + k + '" style="font-size:11px;padding:1px 6px" title="Diese Strophe steht schon mit eigenen Noten im Stück: erste und letzte Note antippen – der Text wird übernommen, die Noten werden bei der Umwandlung ersetzt">▭ aus Noten …</button>' +
      '<button class="b vs-del" data-k="' + k + '" style="font-size:11px;padding:1px 6px" title="Strophe entfernen">🗑</button></div>' +
      (manual[k] ? '<div style="font-size:11px;color:#2a5a8a;margin-bottom:3px">aus vorhandenen Noten (Einträge ' + (manual[k][0] + 1) + '–' + (manual[k][1] + 1) + ') – diese werden beim Übernehmen ersetzt</div>' : '') +
      '<textarea class="vs-txt" data-k="' + k + '" rows="3" autocapitalize="off" autocorrect="off" spellcheck="false" style="width:100%;box-sizing:border-box;font-size:14px;font-family:inherit" placeholder="Ganzer Text der Strophe ' + (k + 2) + '">' + esc(d) + '</textarea>' +
      '<div class="vs-prev" data-k="' + k + '" style="display:flex;flex-wrap:wrap;gap:3px;margin-top:4px;max-height:150px;overflow:auto"></div></div>').join('');
    list.querySelectorAll('.vs-txt').forEach(t => { t.oninput = () => { drafts[+t.dataset.k] = t.value; prev(+t.dataset.k); }; prev(+t.dataset.k); });
    list.querySelectorAll('.vs-del').forEach(b => b.onclick = () => {
      const k = +b.dataset.k; drafts.splice(k, 1);
      const m2 = {}; Object.keys(manual).forEach(x => { x = +x; if (x < k) m2[x] = manual[x]; else if (x > k) m2[x - 1] = manual[x]; }); manual = m2;
      draw();
    });
    list.querySelectorAll('.vs-pick').forEach(b => b.onclick = () => gregVerseStrophePick(+b.dataset.k));
  };
  const prev = k => {
    const p = gregVerseParse(drafts[k]);
    const box = list.querySelector('.vs-prev[data-k="' + k + '"]'), st = list.querySelector('.vs-stat[data-k="' + k + '"]');
    if (!box) return;
    const n = Math.max(mel.length, p.length);
    let h = '';
    for (let i = 0; i < n; i++) {
      const over = i >= mel.length, miss = i >= p.length;
      const t = miss ? '' : p[i].t + (p[i].cont && p[i].t ? '-' : '');
      h += '<span style="display:inline-flex;flex-direction:column;align-items:center;border:1px solid ' + (over || miss ? '#c0392b' : '#d8d0b8') + ';border-radius:3px;padding:0 3px;min-width:18px;background:' + (over ? '#fbe3df' : '#fffdf6') + '">' +
        '<span style="font-size:10px;color:#8a8270">' + (over ? '–' : esc(mel[i])) + '</span><span style="font-size:12px;color:' + (miss ? '#c0392b' : '#1a1a0a') + '">' + (miss ? '·' : esc(t || '~')) + '</span></span>';
    }
    box.innerHTML = p.length ? h : '';
    if (!drafts[k].trim()) { st.textContent = ''; return; }
    if (p.length === mel.length) { st.style.color = '#3d6b35'; st.textContent = '✓ ' + p.length + ' Silben passen'; }
    else if (p.length > mel.length) { st.style.color = '#c0392b'; st.textContent = '⚠ ' + p.length + ' Silben für ' + mel.length + ' Noten – Überzählige kommen auf die letzte Note'; }
    else { st.style.color = '#c0392b'; st.textContent = '⚠ ' + p.length + ' Silben für ' + mel.length + ' Noten – ' + (mel.length - p.length) + ' Noten ohne Silbe'; }
  };
  document.getElementById('vs-add').onclick = () => { drafts.push(''); draw(); const ts = list.querySelectorAll('.vs-txt'); if (ts.length) ts[ts.length - 1].focus(); };
  draw();
  const bEl = document.getElementById('modal-btns');
  const mk = (label, fn, css) => { const b = document.createElement('button'); b.className = 'b'; b.textContent = label; if (css) b.style.cssText = css; b.onclick = fn; bEl.appendChild(b); };
  mk('Abbrechen', () => { window._gregVsState = null; closeModal(); });
  mk('✓ Übernehmen', () => {
    // von Hand angelegte Strophen (aus Noten) werden zu Strophen-Kopien und dann ersetzt
    const tplSet0 = new Set(ti.ents);
    const marks = [];
    Object.keys(manual).forEach(k => { const [a, b, ra] = manual[k]; for (let i = (ra != null ? ra : a); i <= b && i < gregEntries.length; i++) if (!tplSet0.has(gregEntries[i])) marks.push([gregEntries[i], +k + 2, i < a]); });
    const hadVs = new Map(), hadTail = new Map(); marks.forEach(([e, n, tl]) => { hadVs.set(e, e.vsCopy); e.vsCopy = n; if (tl && !e.vsTail) { e.vsTail = true; hadTail.set(e, 1) } });
    gregEntries.forEach(e => { if (tplSet0.has(e)) e.vsTpl = true; });
    if ((own0 || marks.length) && gregVerseCopiesEdited() && !confirm('Die Noten der Strophen 2+ weichen von der Vorlage ab (von Hand geändert). Sie werden ' + (mode === 'own' ? 'durch Kopien der Vorlage ersetzt' : 'entfernt (Text kommt unter die Vorlage)') + ' – diese Abweichungen gehen verloren. Fortfahren?')) {
      hadVs.forEach((v, e) => { if (v) e.vsCopy = v; else delete e.vsCopy; });
      hadTail.forEach((v, e) => { delete e.vsTail; });
      return;
    }
    window._gregVsState = null;
    const keep = drafts.map(d => d.trim()).filter(Boolean);
    // Undo-Schnappschuss ohne die temporären Markierungen (vsCopy/vsTail der erkannten Strophen) aufnehmen
    const curVs = new Map(); hadVs.forEach((v, e) => curVs.set(e, [e.vsCopy, e.vsTail]));
    hadVs.forEach((v, e) => { if (v) e.vsCopy = v; else delete e.vsCopy; });
    hadTail.forEach((v, e) => { delete e.vsTail; });
    gregPush();
    curVs.forEach(([c, t], e) => { e.vsCopy = c; if (t) e.vsTail = t; });
    gregVersesApplyAll(mode, keep, ti, true);
    closeModal();
    gregGst(keep.length ? (keep.length + 1) + ' Strophen ' + (mode === 'own' ? 'mit eigenen Noten' : 'unter der Melodie') + ' – bitte im Notenbild prüfen.' : 'Weitere Strophen entfernt.');
  }, 'background:#3d6b35;color:#fff;border-color:#3d6b35');
}

// Strophen neu anordnen: mode 'stack' (Text untereinander) oder 'own' (eigene Noten)
function gregVersesApplyAll(mode, keep, ti, noPush) {
  if (!noPush) gregPush();
  const tplSet = new Set(ti.ents);
  gregEntries.forEach(e => { if (tplSet.has(e)) e.vsTpl = true; else delete e.vsTpl; });
  gregEntries = gregEntries.filter(e => !e.vsCopy);
  gregEntries.forEach(e => { if (e.verses) delete e.verses; });
  const tplEnts = gregEntries.filter(e => e.vsTpl);
  if (mode === 'own') gregVerseOwnApply(keep, ti.numKind);
  else keep.forEach((d, k) => {
    const p = gregVerseParse(d);
    if (ti.numKind && p.length) p[0].t = (k + 2) + '. ' + p[0].t;
    gregVerseApply(tplEnts, k, p);
  });
  // Kehrvers nach der Vorlage (z.B. «Sal-ve.»): erscheint nach jeder Strophe → in jeder Strophenzeile denselben Text unter den Noten setzen
  if (mode !== 'own' && keep.length && tplEnts.length) {
    const tb = gregEntries.lastIndexOf(tplEnts[tplEnts.length - 1]);
    let re = gregVerseRefrainEnd(tb);
    if (re < 0) { const f = gregEntries[tb + 1], tx = f ? (f.type === 'note' ? f.syllable : f.text) : ''; if (f && /^\s*(℟|R\/\.?|<sp>R\/<\/sp>)/.test(tx || '')) { let j = tb + 1; while (j < gregEntries.length) { if (gregEntries[j].type === 'divisio' && gregEntries[j].div === '::') break; re = j; j++; } } }
    // «℟.» vor dem Kehrvers (Vorsänger/Antwort): in Strophe 1 steht es als eigener Eintrag, in den anderen Zeilen wird es dem Text vorangestellt
    let hasResp = false;
    for (let q = tb; q >= 0 && q > tb - 4; q--) { const x = gregEntries[q]; if (x.type === 'divisio') continue; hasResp = (x.type === 'special' || x.type === 'textonly' || x.type === 'directive') && /^\s*(℟|R\/\.?)/.test(x.text || ''); break; }
    let firstRef = true;
    for (let i = tb + 1; i <= re; i++) {
      const e = gregEntries[i]; if (e.type !== 'note' || !String(e.syllable || '').trim()) continue;
      const v = String(e.syllable).replace(/-$/, '') + ((e.hyphen && e.wordEnd !== true) ? '-' : '');
      e.verses = keep.map(() => (hasResp && firstRef ? 'R/. ' : '') + v); firstRef = false;
    }
  }
  gregSelectedIndices.clear();
  gregRefreshList(); gregBlockSync();
}
// Wurden Noten in den Strophen-Kopien von Hand geändert?
function gregVerseCopiesEdited() {
  const sig = arr => arr.filter(e => e.type === 'note').map(e => (e.pitches || []).join('') + (e.neume || '')).join('|');
  const tpl = sig(gregEntries.filter(e => e.vsTpl && !e.vsCopy));
  const by = {};
  gregEntries.forEach(e => { if (e.vsCopy && !e.vsTail) (by[e.vsCopy] = by[e.vsCopy] || []).push(e); });
  return Object.keys(by).some(n => sig(by[n]) !== tpl);
}
// Schnellwechsel zwischen «Text untereinander» und «eigene Noten» (Texte bleiben erhalten)
function gregVersesSwitchLayout() {
  if (window._ntTab !== 'greg') switchTab('greg');
  gregVerseSanitize();
  const own = gregEntries.some(e => e.vsCopy);
  const ti = gregVerseTplInfo(gregVerseTemplate());
  let texts;
  if (own) texts = gregVerseOwnTexts(gregEntries);
  else { texts = []; const n = gregVerseCount(ti.ents); for (let k = 0; k < n; k++) texts.push(gregVsStripNum(gregVerseText(ti.ents, k))); }
  texts = texts.map(t => t.trim()).filter(t => t && t.replace(/[~\s]/g, ''));
  if (!texts.length) { gregGst('Noch keine weiteren Strophen – zuerst unter «📜 Strophen …» erfassen.'); return; }
  if (own && gregVerseCopiesEdited() && !confirm('Die Noten der Strophen 2+ wurden von Hand geändert – beim Wechsel auf «Text untereinander» gehen diese Änderungen verloren. Fortfahren?')) return;
  gregVersesApplyAll(own ? 'stack' : 'own', texts, ti);
  gregGst((texts.length + 1) + ' Strophen jetzt ' + (own ? 'als Text untereinander (gleiche Noten)' : 'mit eigenen Noten') + ' – ↩ macht es rückgängig.');
}

// Introitus-Gloria-Patri je Modus (Graduale, vollständig ausgeschrieben; Quelle: GregoBase «Gloria Patri I–VIII»), alt = weitere Schlüsse (E u o u a e)
const NT_GP_INTROIT = {"1":{"c":"c4","g":"Gló(f)ri(gh)a(h) Pa(h)tri,(h) et(h) Fí(h)li(h)o,(h.) (,) et(h) Spi(h)rí(hj)tu(h)i(h) San(hg~)cto.(gh..) *(:) Sic(gf)ut(gh) e(h)rat(h) in(h) prin(h)cí(h)pi(h)o,(h.) (,) et(h) nunc,(hj) et(h) sem(hg~)per,(gh..) (:) et(gf) in(gh) sǽ(h)cu(h)la(h) sæ(h)cu(hjh)ló(g')rum.(f) A(fff)men.(d.)","alt":[["h","hjh","g'","f","fg","h."],["h","hjh","g'","f","fff","dc/df.."],["h","hjh","g","f","f!gh","hgg"],["h","hjh","g","f","f!gh","h"]]},"2":{"c":"f3","g":"Gló(e)ri(fe)a(eh) Pa(h)tri,(h) et(h) Fí(h)li(h)o,(h.) (,) et(h) Spi(h)rí(hg)tu(hi)i(i) San(hi)cto.(h.) *(:) Sic(hf)ut(fh) e(h)rat(h) in(h) prin(h)cí(h)pi(h)o,(h.) (,) et(hg) nunc,(hi) et(i) sem(hi)per,(h.) (:) et(hf) in(fh) sǽ(h)cu(h)la(h) sæ(h')cu(i)ló(hf)rum.(h) A(ge)men.(fgf.)","alt":[]},"3":{"c":"c4","g":"Gló(g)ri(hj)a(j) Pa(j)tri,(j) et(j) Fí(j)li(j)o,(j.) (,) et(j) Spi(j)rí(k)tu(j)i(j) San(ih~)cto.(jjj) *(:) Sic(ig)ut(hj) e(j)rat(j) in(j) prin(j)cí(j)pi(j)o,(j.) (,) et(j) nunc,(k) et(j) sem(ih~)per,(jjj) (:) et(ig) in(hj) sǽ(j)cu(j)la(j) sæ(j)cu(jji)ló(hg)rum.(h') A(i)men.(gh..)","alt":[["j","jji","hg","h","i","g"]]},"4":{"c":"c4","g":"Gló(hg)ri(gh)a(h) Pa(h)tri,(h) et(h) Fí(h)li(h)o,(h.) (,) et(h) Spi(h)rí(hg)tu(gi)i(i) San(hi)cto.(h.) *(:) Sic(hg)ut(gh) e(h)rat(h) in(h) prin(h)cí(h)pi(h)o,(h.) (,) et(hg) nunc,(gi) et(i) sem(hi)per,(h.) (:) et(hg) in(gh) sǽ(h)cu(h)la(h) sæ(h)cu(h)ló(gf)rum.(gh) A(g)men.(e.)","alt":[["h","h","gf","gh","g","egff"]]},"5":{"c":"c3","g":"Gló(d)ri(f)a(h) Pa(h)tri,(h) et(h) Fí(h)li(h)o,(h.) (,) et(h) Spi(h)rí(h)tu(h)i(i) San(i)cto.(h.) *(:) Sic(f)ut(h) e(h)rat(h) in(h) prin(h)cí(h)pi(h)o,(h.) (,) et(h) nunc,(h) et(i) sem(i)per,(h.) (:) et(f) in(h) sǽ(h)cu(h)la(h) sæ(h)cu(h)ló(i)rum.(g) A(h)men.(f.)","alt":[["h","h","i","g","h","fefvEDe."]]},"6":{"c":"c4","g":"Gló(fg)ri(gf)a(gh) Pa(h)tri,(h) et(h) Fí(h)li(h)o,(h.) (,) et(h) Spi(g)rí(ixi)tu(h)i(h) San(g)cto.(f.) *(:) Sic(f)ut(gh) e(h)rat(h) in(h) prin(h)cí(h)pi(h)o,(h.) (,) et(g) nunc,(ixi) et(h) sem(g)per,(f.) (:) et(f) in(gh) sǽ(hj)cu(g)la(f) sæ(f')cu(g)ló(fd)rum.(f') A(g)men.(f.)","alt":[["f'","g","fd","f'","g","f'/ghg."]]},"7":{"c":"c3","g":"Gló(ehg)ri(hi)a(i) Pa(i)tri,(i) et(i) Fí(i)li(i)o,(i.) (,) et(i) Spi(i)rí(ik)tu(j)i(j) San(ji~)cto.(ij..) *(:) Sic(ig)ut(hi) e(i)rat(i) in(i) prin(i)cí(i)pi(i)o,(i.) (,) et(i) nunc,(ik) et(j) sem(ji~)per,(ij..) (:) et(ig) in(hi) sǽ(i)cu(i)la(i) sæ(i)cu(i!jwk)ló(i')rum.(h) A(hhh)men.(fe..)","alt":[["i","ij/kj","i","h","hhhg","fe!iv"]]},"8":{"c":"c4","g":"Gló(g)ri(hg)a(gj) Pa(j)tri,(j) et(j) Fí(j)li(j)o,(j.) (,) et(j) Spi(j)rí(ji)tu(jk)i(k) San(jk)cto.(j.) *(:) Sic(jh)ut(hj) e(j)rat(j) in(j) prin(j)cí(j)pi(j)o,(j.) (,) et(ji) nunc,(jk) et(k) sem(jk)per,(j.) (:) et(jh) in(hj) sǽ(j)cu(j)la(j) sæ(j)cu(jji)ló(gh)rum.(ji) A(h)men.(g.)","alt":[["j","jji","gh","ji","h","ghd___/ffg."]]}};

