// ── Schwebendes Bearbeitungsfenster an der Note ──────────────────────
function gregEditPopRemove() { const p = document.getElementById('greg-edit-pop'); if (p) p.remove(); }
function gregEditPopCreate(i) {
  gregEditPopRemove(); gregSylInlineClose(false);
  const pop = document.createElement('div');
  pop.id = 'greg-edit-pop'; pop.className = 'greg-pop'; pop._idx = i;
  const e = gregEntries[i] || {};
  const hd = document.createElement('div'); hd.className = 'greg-pop-hd';
  const nNotes = gregEntries.slice(0, i + 1).filter(x => x.type === 'note').length;
  hd.textContent = e.type === 'note' ? 'Eintrag ' + (i + 1) + ' · Note ' + nNotes + (e.syllable ? ' · «' + e.syllable + '»' : '') : 'Eintrag ' + (i + 1);
  pop.appendChild(hd);
  if (e.type === 'note') {
    const pbRow = document.createElement('label'); pbRow.className = 'greg-pop-row';
    pbRow.style.cssText = 'font-size:11px;display:flex;align-items:center;gap:4px;cursor:pointer';
    pbRow.title = 'Im PDF beginnt vor der Notenzeile, in der diese Note steht, eine neue Seite';
    const pbCb = document.createElement('input'); pbCb.type = 'checkbox'; pbCb.checked = !!e.pb;
    pbCb.onchange = () => {
      gregPush(); if (pbCb.checked) e.pb = true; else delete e.pb;
      gregRender();
      gregGst(pbCb.checked ? 'Seitenumbruch vor der Zeile mit dieser Note gesetzt.' : 'Seitenumbruch entfernt.');
    };
    pbRow.appendChild(pbCb); pbRow.appendChild(document.createTextNode('⤓ Seitenumbruch vor dieser Zeile'));
    pop.appendChild(pbRow);
    // Zeilenumbruch vor dieser Note: fügt vor dem Eintrag einen {type:'linebreak'} ein bzw. entfernt ihn (wie ⏎ in der Eintragsliste)
    const lbRow = document.createElement('label'); lbRow.className = 'greg-pop-row';
    lbRow.style.cssText = 'font-size:11px;display:flex;align-items:center;gap:4px;cursor:pointer';
    lbRow.title = 'Vor dieser Note beginnt eine neue Notenzeile';
    const lbCb = document.createElement('input'); lbCb.type = 'checkbox';
    const ix = () => gregEntries.indexOf(e);
    lbCb.checked = ix() > 0 && gregEntries[ix() - 1].type === 'linebreak';
    lbCb.onchange = () => {
      const k = ix(); if (k < 0) return;
      gregPush();
      if (lbCb.checked) { if (!(k > 0 && gregEntries[k - 1].type === 'linebreak')) gregEntries.splice(k, 0, { type: 'linebreak' }); }
      else { let a = k; while (a > 0 && gregEntries[a - 1].type === 'linebreak') a--; gregEntries.splice(a, k - a); }
      const n = ix(); pop._idx = n;
      if (typeof _gregEditingEntryIdx !== 'undefined') _gregEditingEntryIdx = n;
      hd.textContent = 'Eintrag ' + (n + 1) + ' · Note ' + gregEntries.slice(0, n + 1).filter(x => x.type === 'note').length + (e.syllable ? ' · «' + e.syllable + '»' : '');
      gregRefreshListNoRender(); gregRender();
      gregGst(lbCb.checked ? 'Zeilenumbruch vor dieser Note gesetzt.' : 'Zeilenumbruch entfernt.');
    };
    lbRow.appendChild(lbCb); lbRow.appendChild(document.createTextNode('⏎ Zeilenumbruch vor dieser Note'));
    pop.appendChild(lbRow);
  }
  // Tasten im Fenster: Enter = übernehmen, Esc = abbrechen, Alt+←/→ = vorige/nächste Note
  pop.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && !ev.shiftKey && ev.target.tagName !== 'TEXTAREA') { ev.preventDefault(); if (pop._save) pop._save(); }
    else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); gregCloseEditForm(); gregRefreshListNoRender(); }
    else if (ev.altKey && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight')) { ev.preventDefault(); gregEditStep(pop._idx, ev.key === 'ArrowRight' ? 1 : -1); }
  });
  document.body.appendChild(pop);
  return pop;
}
function gregEditPopButtons(host, i, save) {
  host._btns = true;
  const cur = () => { const p = document.getElementById('greg-edit-pop'); return p && p._idx != null ? p._idx : i; }; // Index kann sich durch Zeilenumbruch-Option verschieben
  const bar = document.createElement('div'); bar.className = 'greg-pop-row greg-pop-btns';
  const mk = (txt, title, fn, cls) => { const b = document.createElement('button'); b.className = 'b' + (cls ? ' ' + cls : ''); b.textContent = txt; b.title = title; b.onclick = fn; bar.appendChild(b); return b; };
  mk('◀', 'Vorige Note (Alt+←) – Änderungen werden übernommen', () => gregEditStep(cur(), -1));
  mk('▶', 'Nächste Note (Alt+→) – Änderungen werden übernommen', () => gregEditStep(cur(), 1));
  mk('🗑 Löschen', 'Eintrag löschen (Entf)', () => { gregCloseEditForm(); gregPush(); gregEntries.splice(cur(), 1); gregRefreshList(); });
  const sp = document.createElement('span'); sp.style.flex = '1'; bar.appendChild(sp);
  mk('✕ Abbrechen', 'Schliessen ohne Übernehmen (Esc)', () => { gregCloseEditForm(); gregRefreshListNoRender(); });
  if (save) { save.textContent = '✓ Übernehmen'; save.title = 'Übernehmen (Enter)'; save.className = 'b greg-pop-ok'; save.style.cssText = ''; bar.appendChild(save); }
  host.appendChild(bar);
}
// Vorige/nächste Note: offene Änderungen übernehmen, dann dort öffnen
function gregEditStep(i, dir) {
  let j = i + dir;
  while (j >= 0 && j < gregEntries.length && gregEntries[j].type !== 'note') j += dir;
  if (j < 0 || j >= gregEntries.length) { gregGst(dir > 0 ? 'Keine weitere Note' : 'Keine vorige Note'); return; }
  const pop = document.getElementById('greg-edit-pop');
  const changed = pop && pop._save ? pop._save() : false;
  if (changed === false) gregEditEntry(j); // nichts geändert -> kein Neuzeichnen nötig
  else gregAfterRenderOnce(() => gregEditEntry(j));
}
// Notationselemente (SVG) eines Eintrags im aktuellen Notenbild
function gregEntryNotationEls(entryIdx) {
  if (entryIdx == null || !_gregScore || !_gregScore.notations) return [];
  const e = gregEntries[entryIdx];
  if (!e || e.type !== 'note' || !e.pitches || !e.pitches.length) return [];
  const wrap = document.getElementById('greg-svg-wrap');
  const svgEl = wrap ? wrap.querySelector('svg') : null;
  const ctxt = _gregCtxtRef;
  if (!svgEl || !ctxt) return [];
  const ordinalStart = gregCountNoteBearingNotations(gregEntriesToBody(gregEntries.slice(0, entryIdx), gregClefVal), ctxt);
  const ordinalEnd = gregCountNoteBearingNotations(gregEntriesToBody(gregEntries.slice(0, entryIdx + 1), gregClefVal), ctxt);
  if (ordinalStart == null || ordinalEnd == null || ordinalEnd <= ordinalStart) return [];
  const els = Array.from(svgEl.querySelectorAll('.ChantNotationElement')).filter(el => !/Clef|Custos/.test(el.getAttribute('class') || ''));
  const out = []; let ordinal = 0;
  for (let k = 0; k < _gregScore.notations.length; k++) {
    const nt = _gregScore.notations[k];
    if (!(nt.notes && nt.notes.length)) continue;
    if (ordinal >= ordinalStart && ordinal < ordinalEnd && els[k]) out.push(els[k]);
    ordinal++;
  }
  return out;
}
function gregEntryClientRect(i) {
  const els = gregEntryNotationEls(i);
  let r = null;
  els.forEach(el => { el.querySelectorAll('*').forEach(n => { const tg = (n.tagName || '').toLowerCase(); if (tg === 'text' || tg === 'tspan') return; const b = n.getBoundingClientRect(); if (!b.width && !b.height) return; r = r ? { left: Math.min(r.left, b.left), top: Math.min(r.top, b.top), right: Math.max(r.right, b.right), bottom: Math.max(r.bottom, b.bottom) } : { left: b.left, top: b.top, right: b.right, bottom: b.bottom }; }); });
  return r;
}
function gregEditPopPlace() {
  const pop = document.getElementById('greg-edit-pop');
  if (!pop) return;
  const i = pop._idx;
  let r = gregEntryClientRect(i);
  if (!r) { const row = document.querySelectorAll('#greg-entry-list [data-idx]')[i]; if (row) { const b = row.getBoundingClientRect(); r = { left: b.right + 8, top: b.top, right: b.right + 8, bottom: b.top }; } }
  const vw = window.innerWidth, vh = window.innerHeight, pw = pop.offsetWidth, ph = pop.offsetHeight;
  let x = r ? r.left - 20 : (vw - pw) / 2, y = r ? r.bottom + 34 : 80; // unter der Note, unterhalb der Textzeile
  if (r && y + ph > vh - 8) y = Math.max(8, r.top - ph - 10);              // kein Platz unten -> über der Note
  x = Math.max(8, Math.min(x, vw - pw - 8)); y = Math.max(8, Math.min(y, vh - ph - 8));
  pop.style.left = Math.round(x) + 'px'; pop.style.top = Math.round(y) + 'px';
}
// Einmalig nach dem nächsten fertigen Neuzeichnen ausführen
function gregAfterRenderOnce(fn) { (window._gregAfterRender = window._gregAfterRender || []).push(fn); clearTimeout(window._gregARTimer); window._gregARTimer = setTimeout(gregRunAfterRender, 1500); }
function gregRunAfterRender() { clearTimeout(window._gregARTimer); const q = window._gregAfterRender || []; window._gregAfterRender = []; q.forEach(f => { try { f(); } catch (e) { console.error(e); } }); }


function gregRefreshListNoRender() {
  const el = document.getElementById('greg-entry-list');
  if (el) {
    el.innerHTML = '';
    gregEntries.forEach((e, i) => {
      const row = document.createElement('div');
      row.setAttribute('data-idx', i);
      row.draggable = true;
      row.style.cssText = 'display:flex;align-items:center;gap:3px;padding:2px 3px;background:#0e1a0a;border:1px solid #2a3820;border-radius:2px;font-size:10px;color:#a8d878;margin-bottom:1px;cursor:grab';
      // Multi-select checkbox
      const selCb = document.createElement('input');
      selCb.type = 'checkbox';
      selCb.checked = gregSelectedIndices.has(i);
      selCb.style.cssText = 'flex-shrink:0;cursor:pointer';
      selCb.title = 'Für Mehrfachaktion auswählen';
      selCb.title = 'Für Mehrfachaktion auswählen (Shift+Klick = ganzer Bereich ab dem zuletzt gewählten)';
      selCb.onclick = (ev) => {
        ev.stopPropagation();
        if (ev.shiftKey && window._gregSelAnchor != null && window._gregSelAnchor < gregEntries.length) {
          gregBlockSetRange(window._gregSelAnchor, i);
          gregRefreshListNoRender();
        } else {
          if (selCb.checked) gregSelectedIndices.add(i); else gregSelectedIndices.delete(i);
          window._gregSelAnchor = i;
        }
        gregUpdateBulkToolbar();
      };
      row.addEventListener('click', ev => { if (window._gregBlockPick) { ev.stopPropagation(); ev.preventDefault(); gregBlockPickAt(i); } }, true);
      // Drag handle
      const dh = document.createElement('span');
      dh.textContent='⠿'; dh.style.cssText='color:#3a5a30;cursor:grab;font-size:11px;line-height:1;flex-shrink:0';
      dh.title='Ziehen zum Verschieben';
      // Label
      const lbl = document.createElement('span');
      lbl.innerHTML = gregEntryLabel(e);
      lbl.style.flex='1';
      // Edit button
      const editBtn = document.createElement('button');
      editBtn.textContent='✎'; editBtn.title='Bearbeiten';
      editBtn.style.cssText='font-size:9px;padding:0 3px;background:#1a2e10;color:#6b9a6b;border:1px solid #3a5a30;border-radius:2px;cursor:pointer;flex-shrink:0';
      editBtn.onclick=(ev)=>{ev.stopPropagation();gregEditEntry(i);};
      // Insert-linebreak-here button: inserts a forced line break
      // immediately BEFORE this entry, so the break can happen at any
      // single note (not just at syllable boundaries).
      const breakBtn = document.createElement('button');
      breakBtn.textContent='⏎'; breakBtn.title='Zeilenumbruch vor dieser Note einfügen';
      breakBtn.style.cssText='font-size:9px;padding:0 3px;background:#1a2a3a;color:#6b9ac0;border:1px solid #3a5a6a;border-radius:2px;cursor:pointer;flex-shrink:0';
      breakBtn.onclick=(ev)=>{
        ev.stopPropagation();
        gregPush();
        gregEntries.splice(i, 0, {type:'linebreak'});
        gregRefreshList();
      };
      // Delete button
      const delBtn = document.createElement('button');
      delBtn.textContent='✕'; delBtn.title='Löschen';
      delBtn.style.cssText='font-size:9px;padding:0 3px;background:#3a1010;color:#c05050;border:1px solid #6a2020;border-radius:2px;cursor:pointer;flex-shrink:0';
      delBtn.onclick=(ev)=>{ev.stopPropagation();gregPush();gregEntries.splice(i,1);gregRefreshList();};

      // Duplicate button — inserts a deep copy right after this entry.
      // Handy for repeating patterns (e.g. a bistropha chain) without
      // re-clicking every note by hand.
      const dupBtn = document.createElement('button');
      dupBtn.textContent='⧉'; dupBtn.title='Eintrag duplizieren';
      dupBtn.style.cssText='font-size:9px;padding:0 3px;background:#10283a;color:#60a0c0;border:1px solid #205a6a;border-radius:2px;cursor:pointer;flex-shrink:0';
      dupBtn.onclick=(ev)=>{
        ev.stopPropagation();
        gregPush();
        const copy = JSON.parse(JSON.stringify(e));
        gregEntries.splice(i+1, 0, copy);
        gregRefreshList();
      };

      // Move-to-other-section button — only relevant/shown once there's
      // more than one section to move something TO. Exists because "💬 Text"
      // (and every other add-entry action) always adds to whichever section
      // is currently ACTIVE — easy to click while the wrong section is
      // active, especially with several sections open at once.
      let moveBtn = null;
      if (window._gregMultiSection && gregSections.length > 1) {
        moveBtn = document.createElement('button');
        moveBtn.textContent='⇄'; moveBtn.title='In anderen Abschnitt verschieben';
        moveBtn.style.cssText='font-size:9px;padding:0 3px;background:#2a1a3a;color:#b090d0;border:1px solid #5a3a7a;border-radius:2px;cursor:pointer;flex-shrink:0';
        moveBtn.onclick=(ev)=>{ev.stopPropagation();gregMoveEntryToSection(i);};
      }

      // DnD events
      row.addEventListener('dragstart', (ev)=>{
        _gregDragIdx=i; row.style.opacity='0.4';
        ev.dataTransfer.effectAllowed='move';
      });
      row.addEventListener('dragend', ()=>{ row.style.opacity='1'; _gregDragIdx=null; });
      row.addEventListener('dragover', (ev)=>{ ev.preventDefault(); row.style.borderColor='#6bc06b'; });
      row.addEventListener('dragleave', ()=>{ row.style.borderColor='#2a3820'; });
      row.addEventListener('drop', (ev)=>{
        ev.preventDefault(); row.style.borderColor='#2a3820';
        if (_gregDragIdx===null || _gregDragIdx===i) return;
        gregPush();
        const moved = gregEntries.splice(_gregDragIdx,1)[0];
        const targetIdx = _gregDragIdx<i ? i-1 : i;
        gregEntries.splice(targetIdx,0,moved);
        gregRefreshList();
      });

      row.appendChild(selCb); row.appendChild(dh); row.appendChild(lbl); row.appendChild(breakBtn); row.appendChild(editBtn);
      row.appendChild(dupBtn);
      if (moveBtn) row.appendChild(moveBtn);
      row.appendChild(delBtn);
      el.appendChild(row);
    });
    el.scrollTop = el.scrollHeight;
  }
  gregUpdateBulkToolbar();
}

// Moves gregEntries[entryIdx] (the entry the user is looking at in the
// ACTIVE section's list) into a DIFFERENT section, chosen from a list of
// all OTHER sections (works with any number of sections, not just 2).
// Exists mainly to recover from adding a comment/freetext while the wrong
// section happened to be active — see gregAddComment/"💬 Text": every
// add-entry action always targets whichever section is currently active,
// which is easy to get wrong when several sections are open.
function gregMoveEntryToSection(entryIdx) {
  if (!window._gregMultiSection || gregSections.length <= 1) return;
  const entry = gregEntries[entryIdx];
  if (!entry) return;

  const others = gregSections
    .map((s, idx) => ({s, idx}))
    .filter(o => o.idx !== gregActiveIdx);
  if (!others.length) return;

  const listText = others.map(o => {
    const label = (o.s.title || o.s.subtitle || '(ohne Titel)').substring(0, 40);
    return (o.idx + 1) + ': ' + label;
  }).join('\n');
  const answer = window.prompt(
    'In welchen Abschnitt verschieben?\n' + listText + '\n\nAbschnitt-Nummer eingeben:',
    String(others[0].idx + 1)
  );
  if (answer === null) return;
  const targetPos = parseInt(answer, 10);
  const target = others.find(o => (o.idx + 1) === targetPos);
  if (!target) { gregGst('Ungültige Abschnitt-Nummer'); return; }

  gregPush();
  gregEntries.splice(entryIdx, 1);

  // A comment's anchorNoteIdx/dx/dy only mean something relative to the
  // section it was resolved against — reset to a sensible default in the
  // TARGET section (same as a brand-new comment) rather than carrying over
  // numbers that would point at an unrelated note there, or worse, at
  // nothing at all.
  if (entry.type === 'comment') {
    const lastNoteIdx = gregCountNoteEntries(target.s.entries) - 1;
    entry.anchorNoteIdx = lastNoteIdx >= 0 ? lastNoteIdx : null;
    entry.dx = 0; entry.dy = -30;
    delete entry.x; delete entry.y;
  }
  target.s.entries.push(entry);

  gregRefreshList();
  gregGst('Verschoben nach Abschnitt ' + (target.idx + 1) + (entry.type === 'comment' ? ' — Position dort ggf. per Ziehen anpassen' : ''));
}

