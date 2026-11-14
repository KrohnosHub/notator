// ── Akkord per Klick ändern ──────────────────────────────────────
function clChordClick(absChar, ev, absEnd) {
  if (!clLast) return;
  // abcjs zählt vorangehende Leerzeichen/Bogenklammern "(" teils zur Note:
  // daher Überlappung des ganzen Noten-Textbereichs prüfen, nicht nur den Anfang.
  const end = Math.max(absEnd || 0, absChar + 1);
  const findR = arr => (arr || []).find(x => absChar >= x.start && absChar < x.end) || (arr || []).find(x => x.start < end && x.end > absChar);
  const lr = findR(clLast.sylRanges); // Silbe der Oberstimme (Zeilenumbruch)
  const r0 = clState.accomp ? findR(clLast.segRanges) : null;
  const inf0 = r0 && clLast.segInfo ? clLast.segInfo[r0.key] : null;
  if (!inf0 && !lr) return;
  clCloseChordMenu();
  if (!inf0) { clLineBreakMenu(lr, ev); return; }
  const r = r0, inf = inf0;
  const m = document.createElement('div');
  m.id = 'cl-chord-menu';
  m._t0 = Date.now();
  m.style.cssText = 'position:fixed;z-index:2600;background:#1a2414;border:1px solid #5a8a40;border-radius:3px;padding:6px;box-shadow:0 4px 14px rgba(0,0,0,.5);font:12px system-ui,sans-serif;color:#c0d890;min-width:170px';
  const x = (ev && ev.clientX) || 100, y = (ev && ev.clientY) || 100;
  m.style.left = Math.min(x + 6, window.innerWidth - 200) + 'px';
  m.style.top = Math.min(y + 6, window.innerHeight - 260) + 'px';
  const h = document.createElement('div');
  h.textContent = 'Akkord: ' + inf.currentName;
  h.style.cssText = 'font-weight:bold;margin-bottom:4px;color:#e0d4b0';
  m.appendChild(h);
  const mk = (label, onClick, active) => {
    const bt = document.createElement('button');
    bt.className = 'b'; bt.textContent = label;
    bt.style.cssText = 'display:block;width:100%;text-align:left;margin:2px 0;font-size:12px;padding:3px 6px' + (active ? ';background:#3d6b35;color:#fff' : '');
    // Touch: der vom Browser nachgereichte "click" der Berührung, die das
    // Menü geöffnet hat, landet sonst direkt auf einem Menüeintrag (Menü
    // erscheint unter dem Finger) -> wählt ungewollt einen Akkord und
    // schliesst das Menü sofort. Klicks kurz nach dem Öffnen ignorieren.
    bt.onclick = () => { if (Date.now() - m._t0 < 350) return; clCloseChordMenu(); onClick(); };
    m.appendChild(bt);
  };
  const cur = inf.ov || { d: null, i: null };
  const setOv = (d, i, x) => {
    (inf.legacyKeys || []).forEach(k => { if (k !== r.key) delete clState.chordOverrides[k]; });
    if (d == null && i == null && !x) delete clState.chordOverrides[r.key];
    else clState.chordOverrides[r.key] = x ? { d, i, x } : { d, i };
    clRender();
  };
  inf.candidates.forEach(c => mk(c.name, () => setOv(c.deg, cur.i), cur.d === c.deg && !cur.x));
  // Freie Wahl: jeder Dur-/Moll-Dreiklang (auch ausserhalb der Vorschläge)
  if (inf.fPc != null) {
    const more = document.createElement('details');
    more.style.cssText = 'margin:2px 0';
    if (cur.x) more.open = true;
    const sum = document.createElement('summary'); sum.textContent = 'Weitere Akkorde …'; sum.style.cssText = 'cursor:pointer;font-size:12px;padding:3px 2px;color:#e0d4b0';
    more.appendChild(sum);
    const grid = document.createElement('div'); grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-top:3px';
    const ROOTS = [[0, 0], [0, 1], [1, 0], [2, -1], [2, 0], [3, 0], [3, 1], [4, 0], [5, -1], [5, 0], [6, -1], [6, 0]]; // C Cis D Es E F Fis G As A B H
    ROOTS.forEach(([st, al]) => [false, true].forEach(minor => {
      const ch = clMakeChord(st, clPcOf(st, al), minor);
      const x = { d: clMod(st - inf.fStep, 7), s: clMod(clPcOf(st, al) - inf.fPc, 12), m: minor };
      const on = !!(inf.curPcs && inf.curPcs.join() === ch.pcs.join() && cur.x);
      const bt = document.createElement('button');
      bt.className = 'b'; bt.textContent = clChordName(ch);
      bt.style.cssText = 'font-size:11px;padding:3px 4px' + (on ? ';background:#3d6b35;color:#fff' : '');
      bt.onclick = () => { if (Date.now() - m._t0 < 350) return; clCloseChordMenu(); (inf.legacyKeys || []).forEach(k => { if (k !== r.key) delete clState.chordOverrides[k]; }); clState.chordOverrides[r.key] = { d: x.d, i: cur.i, x }; clRender(); };
      grid.appendChild(bt);
    }));
    more.appendChild(grid);
    m.appendChild(more);
  }
  mk('Akkord automatisch', () => setOv(null, cur.i), cur.d == null && !cur.x);
  const sep = document.createElement('div');
  sep.textContent = 'Lage';
  sep.style.cssText = 'font-weight:bold;margin:6px 0 2px;color:#e0d4b0;border-top:1px solid #3a4a30;padding-top:4px';
  m.appendChild(sep);
  mk('Grundstellung', () => setOv(cur.d, 0, cur.x), cur.i === 0);
  mk('Sextakkord', () => setOv(cur.d, 1, cur.x), cur.i === 1);
  mk('Lage automatisch' + (cur.i == null ? ' (' + (inf.inv ? 'Sextakkord' : 'Grundstellung') + ')' : ''), () => setOv(cur.d, null, cur.x), cur.i == null);
  mk('↺ Alles automatisch', () => setOv(null, null), !inf.overridden);
  // Akkordwechsel an der angetippten Melodienote setzen/entfernen
  const nt = r.note;
  if (nt) {
    const brk = clState.chordBreaks || (clState.chordBreaks = {});
    const setBrk = v => { if (v === null) delete brk[nt.anchor]; else brk[nt.anchor] = v; clRender(); };
    const sep2 = document.createElement('div');
    sep2.textContent = 'Akkordwechsel';
    sep2.style.cssText = 'font-weight:bold;margin:6px 0 2px;color:#e0d4b0;border-top:1px solid #3a4a30;padding-top:4px';
    m.appendChild(sep2);
    if (!nt.segStart) mk('✂ Neuer Akkord ab dieser Note', () => setBrk(nt.auto ? null : true));
    else if (nt.mergeable) mk('⤺ Akkord der vorigen Note weiterklingen', () => setBrk(nt.auto ? false : null));
    if (brk[nt.anchor] != null) mk('↺ Wechsel wie automatisch', () => setBrk(null));
  }
  if (lr) clLineBreakItems(m, mk, lr.lb);
  document.body.appendChild(m);
  ntPlacePopup(m, x, y);
  setTimeout(() => document.addEventListener('mousedown', clMenuOutside), 0);
}
// Zeilenumbruch vor der angetippten Silbe setzen/entfernen
function clLineBreakItems(m, mk, lb) {
  if (!lb || !lb.key) return;
  const sep = document.createElement('div');
  sep.textContent = 'Zeile';
  sep.style.cssText = 'font-weight:bold;margin:6px 0 2px;color:#e0d4b0;border-top:1px solid #3a4a30;padding-top:4px';
  m.appendChild(sep);
  const set = v => { const o = clState.lineBreaks || (clState.lineBreaks = {}); if (v == null) delete o[lb.key]; else o[lb.key] = v; clRender(); };
  const setPb = v => { const o = clState.pageBreaks || (clState.pageBreaks = {}); if (v) o[lb.key] = true; else delete o[lb.key]; clRender(); };
  if (lb.pb) {
    // Seitenumbruch erzwingt die neue Zeile – nur der Seitenumbruch ist hier änderbar
  } else if (!lb.want) {
    if (!lb.start) mk('⏎ Neue Zeile ab dieser Silbe', () => set(true));
  } else {
    mk('⤺ Zeilenumbruch hier entfernen', () => set(lb.chBrk ? false : null));
  }
  if (lb.set === false) mk('↺ Umbruch wie im Choral', () => set(null));
  mk(lb.pb ? '⤺ Seitenumbruch hier entfernen' : '⤓ Neue Seite ab dieser Silbe', () => setPb(!lb.pb));
}
function clLineBreakMenu(lr, ev) {
  const m = document.createElement('div');
  m.id = 'cl-chord-menu';
  m._t0 = Date.now();
  m.style.cssText = 'position:fixed;z-index:2600;background:#1a2414;border:1px solid #5a8a40;border-radius:3px;padding:6px;box-shadow:0 4px 14px rgba(0,0,0,.5);font:12px system-ui,sans-serif;color:#c0d890;min-width:170px';
  const x = (ev && ev.clientX) || 100, y = (ev && ev.clientY) || 100;
  m.style.left = Math.min(x + 6, window.innerWidth - 220) + 'px';
  m.style.top = Math.min(y + 6, window.innerHeight - 120) + 'px';
  const mk = (label, onClick) => {
    const bt = document.createElement('button');
    bt.className = 'b'; bt.textContent = label;
    bt.style.cssText = 'display:block;width:100%;text-align:left;margin:2px 0;font-size:12px;padding:3px 6px';
    bt.onclick = () => { if (Date.now() - m._t0 < 350) return; clCloseChordMenu(); onClick(); };
    m.appendChild(bt);
  };
  clLineBreakItems(m, mk, lr.lb);
  if (m.children.length <= 1) { const d = document.createElement('div'); d.textContent = 'Automatischer Umbruch (Breite)'; d.style.cssText = 'font-size:11px;color:#8aa070'; m.appendChild(d); }
  document.body.appendChild(m);
  ntPlacePopup(m, x, y);
  setTimeout(() => document.addEventListener('mousedown', clMenuOutside), 0);
}
// Kontextmenü vollständig im sichtbaren Bereich halten (Handy/Tablet):
// Grösse begrenzen (bei Bedarf scrollbar) und Position an den Rand schieben.
function ntPlacePopup(m, x, y) {
  const vv = window.visualViewport;
  const vw = vv ? vv.width : window.innerWidth, vh = vv ? vv.height : window.innerHeight;
  const ox = vv ? vv.offsetLeft : 0, oy = vv ? vv.offsetTop : 0;
  m.style.maxWidth = (vw - 16) + 'px'; m.style.maxHeight = (vh - 16) + 'px';
  m.style.overflowY = 'auto'; m.style.boxSizing = 'border-box';
  const w = m.offsetWidth, h = m.offsetHeight;
  let left = x + 6, top = y + 6;
  if (left + w > ox + vw - 8) left = Math.max(ox + 8, Math.min(x - w - 6, ox + vw - w - 8));
  if (top + h > oy + vh - 8) top = Math.max(oy + 8, oy + vh - h - 8);
  m.style.left = Math.max(ox + 8, left) + 'px'; m.style.top = Math.max(oy + 8, top) + 'px';
}
function clMenuOutside(e) { const m = document.getElementById('cl-chord-menu'); if (m && !m.contains(e.target)) clCloseChordMenu(); }
function clCloseChordMenu() {
  const m = document.getElementById('cl-chord-menu'); if (m) m.remove();
  document.removeEventListener('mousedown', clMenuOutside);
}
function clResetChords() {
  if (!Object.keys(clState.chordOverrides).length && !Object.keys(clState.chordBreaks || {}).length) return;
  if (!confirm('Alle von Hand gewählten Akkorde verwerfen und den Begleitsatz neu automatisch erzeugen?')) return;
  clState.chordOverrides = {}; clState.chordBreaks = {}; clRender();
}

