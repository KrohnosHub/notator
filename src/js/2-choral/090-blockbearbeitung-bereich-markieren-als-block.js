// ── Blockbearbeitung: Bereich markieren, als Block löschen / duplizieren / verschieben ──
// Auswahl = gregSelectedIndices (wie die Kästchen in der Eintragsliste).
// Bereich: «▭ Bereich» und zwei Noten antippen, Shift+Klick (Bereich) bzw.
// Strg/Cmd+Klick (einzeln) auf Noten oder Shift+Klick auf die Kästchen.
function gregBlockIdx() { return Array.from(gregSelectedIndices).filter(i => i < gregEntries.length).sort((a, b) => a - b); }
function gregBlockSetRange(a, b) {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  for (let i = lo; i <= hi; i++) gregSelectedIndices.add(i);
}
function gregBlockClone(ids) {
  const off = gregEntries.reduce((m, e) => Math.max(m, typeof e.mappingIdx === 'number' ? e.mappingIdx : -1), -1) + 1;
  return ids.map(i => gregEntries[i]).filter(e => e && e.type !== 'comment').map(e => {
    const c = JSON.parse(JSON.stringify(e));
    if (typeof c.mappingIdx === 'number') c.mappingIdx += off;
    delete c.vsCopy; delete c.vsTpl;
    return c;
  });
}
function gregBlockSelectNew(at, n) { gregSelectedIndices.clear(); for (let i = at; i < at + n; i++) gregSelectedIndices.add(i); window._gregSelAnchor = at; }
function gregBlockDuplicate(where) {
  const ids = gregBlockIdx(); if (!ids.length) return;
  if (_gregEditingEntryIdx != null) gregCloseEditForm();
  gregPush();
  const cp = gregBlockClone(ids);
  const at = where === 'end' ? gregEntries.length : ids[ids.length - 1] + 1;
  gregEntries.splice(at, 0, ...cp);
  gregBlockSelectNew(at, cp.length);
  gregRefreshList(); gregBlockSync();
  gregGst(cp.length + ' Einträge als Block dupliziert ' + (where === 'end' ? 'ans Ende' : 'direkt danach') + ' – die Kopie ist markiert.');
}
function gregBlockDelete() {
  const ids = gregBlockIdx(); if (!ids.length) return;
  if (ids.length > 1 && !confirm(ids.length + ' Einträge löschen?')) return;
  if (_gregEditingEntryIdx != null) gregCloseEditForm();
  gregPush();
  ids.slice().reverse().forEach(i => gregEntries.splice(i, 1));
  gregSelectedIndices.clear();
  gregRefreshList(); gregBlockSync();
  gregGst(ids.length + ' Einträge gelöscht (↩ macht es rückgängig).');
}
// Block vor Position «target» (Index im aktuellen Stück) einsetzen
function gregBlockMoveTo(target) {
  const ids = gregBlockIdx(); if (!ids.length) return;
  if (ids.indexOf(target - 1) >= 0 && ids.indexOf(target) >= 0) { gregGst('Ziel liegt im markierten Block.'); return; }
  if (_gregEditingEntryIdx != null) gregCloseEditForm();
  gregPush();
  const blk = ids.map(i => gregEntries[i]);
  ids.slice().reverse().forEach(i => gregEntries.splice(i, 1));
  const t = Math.max(0, Math.min(gregEntries.length, target - ids.filter(i => i < target).length));
  gregEntries.splice(t, 0, ...blk);
  gregBlockSelectNew(t, blk.length);
  window._gregBlockPick = false;
  gregRefreshList(); gregBlockSync();
  gregGst(blk.length + ' Einträge als Block verschoben.');
}
function gregBlockPickAt(idx) {
  if (idx == null) { gregGst('Keine Note getroffen – eine Note antippen (der Block kommt danach).'); return; }
  gregBlockMoveTo(idx + 1);
}
// Klick/Tippen auf eine vorhandene Note im Notenbild (true = verarbeitet)
function gregBlockNoteClick(idx) {
  if (window._gregBlockPick) { gregBlockPickAt(idx); return true; }
  if (window._gregBlockRange) {
    if (idx == null) { gregGst('Eine Note antippen.'); return true; }
    if (window._gregBlockRange === 1) { gregSelectedIndices.clear(); gregSelectedIndices.add(idx); window._gregSelAnchor = idx; window._gregBlockRange = 2; }
    else {
      gregBlockSetRange(window._gregSelAnchor, idx); window._gregBlockRange = 0;
      if (window._gregVsPick || window._gregVsPickK != null) { window._gregVsPick = false; setTimeout(gregVersesShow, 60); }
    }
    gregUpdateBulkToolbar(); gregBlockSync(); gregRefreshListNoRender();
    return true;
  }
  if (idx == null) return false;
  if (window._gregShiftClick) {
    const a = window._gregSelAnchor != null ? window._gregSelAnchor : (_gregEditingEntryIdx != null ? _gregEditingEntryIdx : idx);
    if (_gregEditingEntryIdx != null) gregCloseEditForm();
    gregBlockSetRange(a, idx); window._gregSelAnchor = a;
    gregUpdateBulkToolbar(); gregBlockSync(); gregRefreshListNoRender();
    return true;
  }
  if (window._gregCtrlClick) {
    if (gregSelectedIndices.has(idx)) gregSelectedIndices.delete(idx); else gregSelectedIndices.add(idx);
    window._gregSelAnchor = idx;
    gregUpdateBulkToolbar(); gregBlockSync(); gregRefreshListNoRender();
    return true;
  }
  return false;
}
function gregBlockRangeStart() {
  if (_gregEditingEntryIdx != null) gregCloseEditForm();
  window._gregBlockPick = false;
  window._gregBlockRange = window._gregBlockRange ? 0 : 1;
  gregBlockSync();
}
function gregBlockCancel() { window._gregBlockPick = false; window._gregBlockRange = 0; gregSelectedIndices.clear(); gregUpdateBulkToolbar(); gregBlockSync(); gregRefreshListNoRender(); }
function gregBlockButtons(bar, small) {
  const css = small ? 'font-size:9px;padding:1px 5px' : 'font-size:12px;padding:3px 8px';
  const mk = (t, title, fn, extra) => { const b = document.createElement('button'); b.className = 'b'; b.textContent = t; b.title = title; b.style.cssText = css + (extra || ''); b.onclick = ev => { ev.stopPropagation(); fn(); }; bar.appendChild(b); return b; };
  mk('⧉ danach', 'Markierte Einträge als Block kopieren und direkt nach dem Block einfügen', () => gregBlockDuplicate('after'));
  mk('⧉ ans Ende', 'Markierte Einträge als Block kopieren und am Ende ' + (window._gregMultiSection && gregSections.length > 1 ? 'des Abschnitts' : 'des Stücks') + ' einfügen', () => gregBlockDuplicate('end'));
  mk('⇅ Verschieben', 'Block verschieben: danach die Note antippen, nach der er stehen soll', () => { window._gregBlockPick = true; window._gregBlockRange = 0; gregBlockSync(); });
  if (window._gregMultiSection && gregSections.length > 1) mk('⇄ Abschnitt', 'In einen anderen Abschnitt verschieben', () => gregBulkMoveToSection());
  mk('✕ Löschen', 'Markierte Einträge löschen', () => gregBlockDelete(), ';background:#5a1a1a;color:#f0c0c0;border-color:#7a2a2a');
}
// schwebende Leiste über dem Notenbild + Markierung im Notenbild
function gregBlockSync() {
  let bar = document.getElementById('greg-block-bar');
  const n = gregBlockIdx().length;
  const show = window._ntTab === 'greg' && (n || window._gregBlockRange || window._gregBlockPick);
  const rb = document.getElementById('greg-qb-range');
  if (rb) { rb.style.background = window._gregBlockRange ? '#2a5a8a' : ''; rb.style.color = window._gregBlockRange ? '#fff' : ''; }
  if (!show) { if (bar) bar.remove(); gregBlockHighlight(); return; }
  if (!bar) {
    bar = document.createElement('div'); bar.id = 'greg-block-bar';
    bar.style.cssText = 'position:fixed;left:50%;bottom:40px;transform:translateX(-50%);z-index:2300;background:#1a2a3a;color:#d8e8f8;padding:6px 8px;border-radius:6px;border:1px solid #3a5a7a;box-shadow:0 4px 14px rgba(0,0,0,.45);font:13px system-ui,sans-serif;display:flex;gap:5px;align-items:center;flex-wrap:wrap;justify-content:center;max-width:96vw';
    document.body.appendChild(bar);
  }
  bar.innerHTML = '';
  const lab = document.createElement('span'); lab.style.cssText = 'margin-right:4px';
  bar.appendChild(lab);
  const mk = (t, fn, extra) => { const b = document.createElement('button'); b.className = 'b'; b.textContent = t; b.style.cssText = 'font-size:12px;padding:3px 8px' + (extra || ''); b.onclick = ev => { ev.stopPropagation(); fn(); }; bar.appendChild(b); return b; };
  if (window._gregBlockRange) {
    const what = window._gregVsPick ? 'der Vorlage-Strophe' : window._gregVsPickK != null ? 'von Strophe ' + (window._gregVsPickK + 2) : 'des Bereichs';
    lab.textContent = window._gregBlockRange === 1 ? '▭ Erste Note ' + what + ' antippen' : '▭ Letzte Note ' + what + ' antippen';
    mk('Abbrechen', () => { window._gregBlockRange = 0; const vs = window._gregVsPick || window._gregVsPickK != null; window._gregVsPick = false; if (vs) { gregSelectedIndices.clear(); } gregBlockSync(); if (vs) { const k = window._gregVsPickK; window._gregVsPickK = null; gregVersesShow(); } });
  } else if (window._gregBlockPick) {
    lab.textContent = '⇅ ' + n + ' Einträge: Note antippen, nach der der Block stehen soll';
    mk('an den Anfang', () => gregBlockMoveTo(0));
    mk('ans Ende', () => gregBlockMoveTo(gregEntries.length));
    mk('Abbrechen', () => { window._gregBlockPick = false; gregBlockSync(); });
  } else {
    lab.textContent = '▭ ' + n + ' markiert';
    gregBlockButtons(bar, false);
    mk('✕', () => gregBlockCancel(), ';padding:3px 7px').title = 'Auswahl aufheben (Esc)';
  }
  gregBlockHighlight();
}
function gregBlockHighlight() {
  const wrap = document.getElementById('greg-svg-wrap');
  const svgEl = wrap ? wrap.querySelector('svg') : null;
  if (!svgEl) return;
  svgEl.querySelectorAll('.greg-blocksel').forEach(el => el.classList.remove('greg-blocksel'));
  const ids = gregBlockIdx(); if (!ids.length || !_gregScore || !_gregScore.notations) return;
  const els = Array.from(svgEl.querySelectorAll('.ChantNotationElement')).filter(el => !/Clef|Custos/.test(el.getAttribute('class') || ''));
  const noteEls = [];
  for (let k = 0; k < _gregScore.notations.length; k++) { const nt = _gregScore.notations[k]; if (nt.notes && nt.notes.length && els[k]) noteEls.push(els[k]); }
  const noteEntries = []; gregEntries.forEach((e, i) => { if (e.type === 'note' && e.pitches && e.pitches.length) noteEntries.push(i); });
  const sel = new Set(ids);
  if (noteEntries.length === noteEls.length) noteEntries.forEach((i, k) => { if (sel.has(i)) noteEls[k].classList.add('greg-blocksel'); });
  else ids.slice(0, 80).forEach(i => gregEntryNotationEls(i).forEach(el => el.classList.add('greg-blocksel')));
}
document.addEventListener('keydown', ev => {
  if (ev.key !== 'Escape' || window._ntTab !== 'greg') return;
  if (document.getElementById('modal-bg') && document.getElementById('modal-bg').classList.contains('open')) return;
  if (window._gregBlockPick || window._gregBlockRange) { window._gregBlockPick = false; window._gregBlockRange = 0; window._gregVsPick = false; window._gregVsPickK = null; window._gregVsState = null; gregBlockSync(); }
  else if (gregSelectedIndices.size) gregBlockCancel();
});

function gregRefreshList() {
  gregRefreshListNoRender();
  clearTimeout(window._gregRT);
  window._gregRT = setTimeout(gregRender, 200);
}

function gregPush() {
  gregHistory.push(JSON.stringify(gregEntries));
  // Cap the undo stack — a long editing session could otherwise pile up
  // hundreds of full JSON snapshots with no ceiling at all, which adds up
  // over time and is unnecessary: nobody realistically needs 100+ levels
  // of undo, and this removes one more contributor to overall memory
  // pressure (relevant after the PDF-import "Out of Memory" investigation).
  if (gregHistory.length > 100) gregHistory.shift();
  gregRedoHistory = [];
}
function gregAddDiv(d) { gregPush(); gregEntries.push({type:'divisio',div:d}); _gregPending=null; gregRefreshList(); }
function gregAddSpecial(t) { gregPush(); gregEntries.push({type:'special',text:t}); _gregPending=null; gregRefreshList(); }
function gregAddLinebreak() {
  gregPush();
  gregEntries.push({type:'linebreak'});
  _gregPending=null;
  gregRefreshList();
}
function gregUndo() {
  if(!gregHistory.length) { gregGst('Nichts rückgängig zu machen'); return; }
  gregRedoHistory.push(JSON.stringify(gregEntries));
  gregEntries = JSON.parse(gregHistory.pop());
  _gregPending = null;
  gregRefreshList();
  gregRender();
}
function gregRedo() {
  if(!gregRedoHistory.length) { gregGst('Nichts zu wiederholen'); return; }
  gregHistory.push(JSON.stringify(gregEntries));
  gregEntries = JSON.parse(gregRedoHistory.pop());
  _gregPending = null;
  gregRefreshList();
  gregRender();
}
function gregClear() {
  // Resets only the CURRENTLY ACTIVE section (works the same whether in
  // single-section mode or multi-section mode — gregEntries/UI fields
  // always represent the active section).
  gregPush();
  gregEntries = [];
  _gregPending = null;
  const set = (id, v) => { const el=document.getElementById(id); if(el) el.value=v; };
  const setChk = (id, v) => { const el=document.getElementById(id); if(el) el.checked=v; };
  set('greg-title', '');
  set('greg-subtitle', '');
  set('greg-annotation', '');
  set('greg-commentary', '');
  setChk('greg-dropcap2', false);
  gregHdrExtra = ''; gregClefRaw = '';
  set('greg-dropcap-letter', '');
  setChk('greg-dropcap', true);
  gregSetClef('do');
  if (!window._gregMultiSection && typeof clState !== 'undefined') { clState = {}; clNormalizeState(); gregMeta = {}; clUndoReset(); } // neues Stück: Orgel-Standard (Begleitsatz an)
  gregRefreshList();
  if (window._gregMultiSection) gregSectionFromUI();
  gregRender();
  gregGst('Abschnitt zurückgesetzt');
}


