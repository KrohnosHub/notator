// ── Tastenkürzel (PC/Tablet) ──
function gregShiftEntryPitch(i, d) {
  const e = gregEntries[i]; if (!e || e.type !== 'note') return false;
  const sh = ch => { if (!ch) return ch; const lo = String(ch).toLowerCase(); const c = lo.charCodeAt(0) + d; if (c < 97 || c > 109) return null; const n = String.fromCharCode(c); return ch === lo ? n : n.toUpperCase(); };
  const all = [].concat(e.pitches || [], e.rawPitches || [], (e.notes || []).map(n => n.pitch), e.accidentalPitch ? [e.accidentalPitch] : []);
  if (all.some(p => sh(p) === null)) { gregGst('Tonhöhe ausserhalb des Notensystems'); return false; }
  gregPush();
  if (e.pitches) e.pitches = e.pitches.map(sh);
  if (e.rawPitches) e.rawPitches = e.rawPitches.map(sh);
  (e.notes || []).forEach(n => { const keep = n.gabcSuf !== undefined && n.gabcSig === gregRawNoteSig(n); n.pitch = sh(n.pitch); if (keep) n.gabcSig = gregRawNoteSig(n); });
  if (e.accidentalPitch) e.accidentalPitch = sh(e.accidentalPitch);
  gregRefreshList();
  return true;
}
// Alle Noten des Abschnitts um d Stufen verschieben (gleicher Ablauf wie Pfeil hoch/runter bei einer Note)
function gregShiftAllPitches(d) {
  const sh = ch => { if (!ch) return ch; const lo = String(ch).toLowerCase(); const c = lo.charCodeAt(0) + d; if (c < 97 || c > 109) return null; const n = String.fromCharCode(c); return ch === lo ? n : n.toUpperCase(); };
  const notes = gregEntries.filter(e => e.type === 'note');
  if (notes.some(e => [].concat(e.pitches || [], e.rawPitches || [], (e.notes || []).map(n => n.pitch), e.accidentalPitch ? [e.accidentalPitch] : []).some(p => sh(p) === null))) return false;
  notes.forEach(e => {
    if (e.pitches) e.pitches = e.pitches.map(sh);
    if (e.rawPitches) e.rawPitches = e.rawPitches.map(sh);
    (e.notes || []).forEach(n => { const keep = n.gabcSuf !== undefined && n.gabcSig === gregRawNoteSig(n); n.pitch = sh(n.pitch); if (keep) n.gabcSig = gregRawNoteSig(n); });
    if (e.accidentalPitch) e.accidentalPitch = sh(e.accidentalPitch);
  });
  return true;
}
// Schlüssel wechseln: wahlweise Melodie beibehalten (Noten wandern mit, Tonhöhen bleiben gleich)
function gregClefChange(v) {
  const old = gregClefVal;
  const sel = document.getElementById('greg-clef-sel');
  const hasNotes = gregEntries.some(e => e.type === 'note' && e.pitches && e.pitches.length);
  const d = ntGpDoIdx(v) - ntGpDoIdx(old);
  const flatDiff = /^[cf]b/.test(v) !== /^[cf]b/.test(old);
  if (!hasNotes || old === v || (!d && !flatDiff)) { gregClefRaw = ''; gregSetClef(v); return; }
  if (sel) sel.value = old;
  showModal('Schlüssel ändern', 'Neuer Schlüssel: ' + v + ' (bisher ' + old + ').\n\n«Melodie beibehalten» verschiebt alle Noten mit, sodass die Tonhöhen gleich bleiben – das Notenbild steht dann nur höher oder tiefer im System.\n«Nur Schlüssel» lässt die Noten an ihrem Platz; die Melodie klingt dann anders.', [
    { label: '♫ Melodie beibehalten', fn: () => {
      closeModal(); gregPush();
      if (d && !gregShiftAllPitches(d)) { gregHistory.pop(); gregGst('Geht nicht: einige Noten lägen ausserhalb des Notensystems.'); return; }
      gregClefRaw = ''; gregSetClef(v); gregRefreshList();
      gregGst('Schlüssel ' + v + ' – Noten um ' + Math.abs(d) + ' Stufe(n) ' + (d > 0 ? 'nach oben' : 'nach unten') + ' verschoben, Melodie unverändert.');
    } },
    { label: 'Nur Schlüssel', fn: () => { closeModal(); gregClefRaw = ''; gregSetClef(v); } },
    { label: 'Abbrechen', fn: () => closeModal() }
  ]);
}
function gregShortcutHelp() {
  showModal('⌨ Tastenkürzel (Choral)',
    'Neume wählen:  1 Punctum · 2 Virga · 3 Quilisma · P Podatus · C Clivis · T Torculus · R Porrectus · S Scandicus · K Climacus · L Salicus · I Puncta inclinata\n' +
    'Trennstriche:  ,  minima · ;  minor · :  maior · :: (zweimal :) Doppelstrich\n' +
    'Vorzeichen für die nächste Note:  B  b · #  Kreuz · N  Auflösung\n' +
    'Leertaste:  Wortende für die nächste Neume (oder Leerzeichen am Ende der Silbe tippen)\n' +
    'M:  Mora auf der letzten Note der nächsten Neume (wird nach dem Setzen zurückgesetzt)\n' +
    'Text zuerst: Shift+Klick setzt eine Neume ohne Silbe (Melisma)\n\n' +
    '← / →  vorige / nächste Note bearbeiten\n' +
    'Shift + ↑ / ↓  gewählte Note einen Ton höher / tiefer\n' +
    'Entf  gewählten Eintrag löschen · Enter  Silbe der gewählten Note bearbeiten · Esc  schliessen\n' +
    'Strg+Z / Strg+Y  rückgängig / wiederholen · Strg+S  speichern\n\n' +
    'Im Bearbeitungsfenster: Enter übernehmen · Esc abbrechen · Alt+← / Alt+→ vorige / nächste Note\n' +
    'Im Silbenfeld unter der Note: Enter übernehmen · Tab nächste Note · Shift+Tab vorige · Esc überspringen\n\n' +
    '(Nur am PC/Tablet, nicht während der Eingabe in ein Textfeld.)',
    [{ label: 'OK', fn: () => closeModal() }]);
}
document.addEventListener('keydown', ev => {
  if (ev.ctrlKey || ev.metaKey || (ev.altKey && !/^Arrow/.test(ev.key))) return;
  const panel = document.getElementById('greg-panel');
  if (!panel || panel.style.display === 'none' || panel.classList.contains('greg-view')) return;
  if (gregIsMobileViewport()) return;
  const t = ev.target, tag = t && t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
  const mb = document.getElementById('modal-bg'); if (mb && mb.classList.contains('open')) return;
  const pop = document.getElementById('greg-edit-pop');
  const sel = pop ? pop._idx : null;
  const k = ev.key;
  const lk = (k || '').toLowerCase();
  const done = () => { ev.preventDefault(); ev.stopPropagation(); };
  if (k === '?') { done(); gregShortcutHelp(); return; }
  if (k === 'Escape' && pop) { done(); gregCloseEditForm(); gregRefreshListNoRender(); return; }
  if (k === 'ArrowLeft' || k === 'ArrowRight') {
    const dir = k === 'ArrowRight' ? 1 : -1;
    done();
    if (sel != null) { gregEditStep(sel, dir); return; }
    const idxs = gregEntries.map((e, n) => e.type === 'note' ? n : -1).filter(n => n >= 0);
    if (idxs.length) gregEditEntry(dir > 0 ? idxs[0] : idxs[idxs.length - 1]);
    return;
  }
  if ((k === 'ArrowUp' || k === 'ArrowDown') && ev.shiftKey && sel != null) {
    done();
    if (gregShiftEntryPitch(sel, k === 'ArrowUp' ? 1 : -1)) { gregCloseEditForm(); gregAfterRenderOnce(() => gregEditEntry(sel)); }
    return;
  }
  if ((k === 'Delete' || k === 'Backspace') && sel != null) { done(); gregCloseEditForm(); gregPush(); gregEntries.splice(sel, 1); gregRefreshList(); gregGst('Eintrag gelöscht (Strg+Z = rückgängig)'); return; }
  if (k === 'Enter' && sel != null && pop._focus) { done(); pop._focus.focus(); if (pop._focus.select) pop._focus.select(); return; }
  if (ev.altKey) return;
  if (GREG_KEY_NEUMES[lk] && !ev.shiftKey) { done(); gregSelectNeume(GREG_KEY_NEUMES[lk]); return; }
  if (lk === 'm') { done(); const n = (NEUME_PITCHES[(document.getElementById('greg-neume-sel')||{}).value] || 1); const m = document.getElementById('greg-mora-n' + Math.min(4, n)); if (m && !m.disabled) { m.checked = !m.checked; gregQuickbarSync(); gregGst('Mora auf der letzten Note der nächsten Neume: ' + (m.checked ? 'an' : 'aus')); } return; }
  if (lk === 'b') { done(); gregSetAccidental('x'); return; }
  if (lk === 'n') { done(); gregSetAccidental('y'); return; }
  if (k === '#') { done(); gregSetAccidental('#'); return; }
  if (k === ' ') { done(); const w = document.getElementById('greg-wordend'); if (w) { w.checked = !w.checked; gregQuickbarSync(); gregGst('Wortende für die nächste Neume: ' + (w.checked ? 'an' : 'aus')); } return; }
  if (k === ',' || k === ';') { done(); gregAddDiv(k); return; }
  if (k === ':') {
    done();
    const last = gregEntries[gregEntries.length - 1];
    if (last && last.type === 'divisio' && last.div === ':' && Date.now() - (window._gregColonAt || 0) < 900) { gregPush(); last.div = '::'; gregRefreshList(); window._gregColonAt = 0; }
    else { gregAddDiv(':'); window._gregColonAt = Date.now(); }
    return;
  }
}, true);

// Komfort: grössere Bedienelemente (Standard am PC/Tablet)
function gregComfortOn() { let v = null; try { v = localStorage.getItem('notatorComfort'); } catch (e) {} return v === null ? !gregIsMobileViewport() : v === '1'; }
function gregComfortApply() { document.body.classList.toggle('nt-comfort', gregComfortOn()); }
function gregComfortToggle() { try { localStorage.setItem('notatorComfort', gregComfortOn() ? '0' : '1'); } catch (e) {} gregComfortApply(); gregGst('Grosse Bedienelemente: ' + (gregComfortOn() ? 'an' : 'aus')); }

function gregSetClef(v, silent) {
  gregClefVal = GREG_CLEF_MAP[v] || (/^[cf]b?[1-4]$/.test(v || '') ? v : 'c3');
  gregClefUi();
  if (!silent) gregRender();
}
function gregClefUi() {
  const sel = document.getElementById('greg-clef-sel'); if (sel) sel.value = gregClefVal;
  const raw = document.getElementById('greg-clef-raw');
  if (raw) raw.textContent = (typeof gregClefRaw !== 'undefined' && gregClefRaw && gregClefRaw !== gregClefVal) ? 'Original: ' + gregClefRaw : '';
}


