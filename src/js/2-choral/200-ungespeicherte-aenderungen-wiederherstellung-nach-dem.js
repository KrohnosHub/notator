// ── Ungespeicherte Änderungen / Wiederherstellung nach dem Schliessen ──
// Grundlage ist ein Prüfwert über den Stückzustand beim letzten Speichern,
// Öffnen oder Importieren. Weicht der aktuelle Zustand ab, gilt das Stück als
// «ungespeichert»: Rückfrage vor Neu/Öffnen/Import, Warnung beim Schliessen
// und eine Sicherungskopie in localStorage (übersteht auch das Schliessen).
const NT_RECOVERY_KEY = 'notatorRecovery_v1';
let _ntBaseSig = null;
function ntHash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + ':' + str.length; }
function ntStateHasContent(st) {
  return !!st && ((st.entries && st.entries.some(e => e && e.type === 'note')) || (st.multiSection && st.sections && st.sections.some(x => (x.entries || []).some(e => e && e.type === 'note'))));
}
function ntStateSig(st) {
  const c = Object.assign({}, st); delete c.canvasWidth; delete c.secGap;
  if (c.meta) { c.meta = Object.assign({}, c.meta); delete c.meta.txt; }
  return ntHash(JSON.stringify(c));
}
function ntMarkClean(st) {
  try { _ntBaseSig = ntStateSig(st || gregBuildStateObject()); sessionStorage.setItem('notatorBaseSig', _ntBaseSig); } catch (e) {}
  try { localStorage.removeItem(NT_RECOVERY_KEY); } catch (e) {}
}
function ntIsDirty(st) {
  try { st = st || gregBuildStateObject(); return ntStateHasContent(st) && ntStateSig(st) !== _ntBaseSig; } catch (e) { return false; }
}
// Rückfrage vor dem Verwerfen ungespeicherter Änderungen -> Promise<boolean>
function ntConfirmDiscard(what) {
  if (window._ntMappeBusy || !ntIsDirty()) return Promise.resolve(true);
  return new Promise(resolve => {
    showModal('⚠️ Ungespeicherte Änderungen', 'Das offene Stück hat Änderungen, die noch nicht gespeichert sind.' + (what ? '\n' + what : ''), [
      { label: '💾 Zuerst speichern', fn: () => { closeModal(); resolve(false); gregLibSaveCurrent(); } },
      { label: 'Verwerfen und fortfahren', fn: () => { closeModal(); resolve(true); } },
      { label: 'Abbrechen', fn: () => { closeModal(); resolve(false); } }
    ]);
  });
}
// Bibliothekseintrag nach Neuladen/Wiederherstellen wieder zuordnen – sonst fragt
// «Speichern» nach einem neuen Titel und legt eine zweite Datei an (Nutzerbericht 2026-11-04)
function ntPieceTitle(state) {
  const s0 = state && state.sections && state.sections[0];
  return ((s0 && s0.title) || (state && state.title) || 'Unbenanntes Stück').trim() || 'Unbenanntes Stück';
}
function ntRestoreLibId(id) {
  if (id == null || typeof gregLibGet !== 'function') return;
  gregLibCurrentId = id;
  gregLibGet(id).then(r => { if (!r && gregLibCurrentId === id) gregLibCurrentId = null; }).catch(() => {});
}
function ntRecoveryWrite(st) {
  try {
    if (ntIsDirty(st)) localStorage.setItem(NT_RECOVERY_KEY, JSON.stringify({ savedAt: Date.now(), state: st, libId: gregLibCurrentId }));
    else localStorage.removeItem(NT_RECOVERY_KEY);
  } catch (e) {}
}
window.addEventListener('beforeunload', e => {
  try { gregAutosaveNow(); } catch (err) {}
  if (ntIsDirty() && !window._ntReloadOk) { e.preventDefault(); e.returnValue = ''; }
});
// Start: Prüfwert aus dieser Sitzung übernehmen (Neuladen) oder leeres Blatt
// als «gespeichert» werten; ggf. Wiederherstellung nach dem Schliessen anbieten.
function ntInitDirtyTracking(restoredFromSession) {
  let base = null; try { base = sessionStorage.getItem('notatorBaseSig'); } catch (e) {}
  if (restoredFromSession && base) _ntBaseSig = base; else if (!restoredFromSession) ntMarkCleanKeepRecovery();
  if (restoredFromSession) return;
  let rec = null; try { rec = JSON.parse(localStorage.getItem(NT_RECOVERY_KEY) || 'null'); } catch (e) {}
  if (!rec || !ntStateHasContent(rec.state) || /[#&](n|song)=/.test(location.hash || '')) return;
  const when = new Date(rec.savedAt || Date.now()).toLocaleString('de-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const t = (rec.state.title || (rec.state.sections && rec.state.sections[0] && rec.state.sections[0].title) || 'Unbenanntes Stück');
  const bar = document.createElement('div'); bar.id = 'nt-recovery-bar';
  bar.style.cssText = 'position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:3000;background:#6a4a1a;color:#fff;padding:8px 12px;border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,.4);font:13px system-ui,sans-serif;display:flex;gap:10px;align-items:center;flex-wrap:wrap;max-width:calc(100vw - 24px);box-sizing:border-box';
  const sp = document.createElement('span'); sp.textContent = 'Nicht gespeicherter Stand gefunden: «' + t + '» (' + when + ')'; bar.appendChild(sp);
  const go = document.createElement('button'); go.className = 'b'; go.textContent = '↺ Wiederherstellen'; go.style.cssText = 'font-size:12px;padding:3px 10px';
  go.onclick = () => { bar.remove(); gregApplyLoadedState(rec.state); gregLibCurrentId = null; ntRestoreLibId(rec.libId); gregRefreshList(); gregRender(); gregGst('Nicht gespeicherten Stand wiederhergestellt – bitte speichern.'); gregScheduleAutosave(); };
  const no = document.createElement('button'); no.className = 'b'; no.textContent = 'Verwerfen'; no.style.cssText = 'font-size:12px;padding:3px 8px';
  no.onclick = () => { bar.remove(); try { localStorage.removeItem(NT_RECOVERY_KEY); } catch (e) {} };
  bar.appendChild(go); bar.appendChild(no); document.body.appendChild(bar);
}
function ntMarkCleanKeepRecovery() { try { _ntBaseSig = ntStateSig(gregBuildStateObject()); sessionStorage.setItem('notatorBaseSig', _ntBaseSig); } catch (e) {} }

// Debounced wrapper — called from gregRender(), which itself already runs
// after most edits (some already debounced upstream, some not), so this
// keeps sessionStorage writes to roughly once per pause in activity rather
// than on every single click/keystroke.
function gregScheduleAutosave() {
  if (window._ntMappeBusy) return; // Mappe-Erzeugung lädt Stücke nur vorübergehend
  clearTimeout(window._gregAutosaveT);
  window._gregAutosaveT = setTimeout(gregAutosaveNow, 500);
}

// Called once on startup (see the Greg-Editor init block below). If a
// previous autosave exists, restores it silently and reports it in the
// status line — restoring is the safe default since there's no separate
// "session" concept here; the alternative (staying blank after an
// accidental reload) is exactly the problem this exists to prevent.
// Explicitly opening a different file (gregLoadPiece) or starting over
// (gregClear) naturally overwrites the autosave on the next
// gregScheduleAutosave() call, so it never traps the user on old content.
function gregTryRestoreAutosave() {
  // Nur beim Neuladen / Zurück im selben Tab: ein neu geöffneter (oder vom
  // Browser kopierter) Tab startet leer (Nutzerwunsch 2026-10-21).
  let force = false; try { force = sessionStorage.getItem('notatorForceRestore') === '1'; sessionStorage.removeItem('notatorForceRestore'); } catch (e) {}
  try { const nav = performance.getEntriesByType('navigation')[0]; if (!force && nav && nav.type !== 'reload' && nav.type !== 'back_forward') return false; } catch (e) {}
  let raw;
  try {
    // Neuester Zwischenstand dieses Tabs – auch aus einer anderen Build-Nummer
    // (nach «Neue Version» oder wenn der Browser noch die alte Version liefert)
    let best = null;
    for (let k = 0; k < sessionStorage.length; k++) {
      const key = sessionStorage.key(k);
      if (!/^notatorGregAutosave_v1_/.test(key)) continue;
      const v = sessionStorage.getItem(key); let t = 0;
      try { t = (JSON.parse(v) || {}).savedAt || 0; } catch (e) {}
      if (!best || t > best.t) best = { t, v };
    }
    raw = best ? best.v : null;
  } catch (err) { return false; }
  if (!raw) return false;
  try {
    const saved = JSON.parse(raw);
    const state = saved && saved.state;
    if (!state || !state.entries || !Array.isArray(state.entries)) return;
    const hasContent = state.entries.length > 0 ||
      (state.multiSection && state.sections && state.sections.some(s => s.entries && s.entries.length > 0));
    if (!hasContent) return false; // nothing worth restoring — leave the blank sheet as-is
    gregApplyLoadedState(state);
    gregRefreshList();
    ntRestoreLibId(saved.libId);
    const when = saved.savedAt ? new Date(saved.savedAt).toLocaleTimeString('de-CH', {hour:'2-digit', minute:'2-digit'}) : '';
    gregGst('Letzter Stand automatisch wiederhergestellt' + (when ? ' (' + when + ' Uhr)' : '') + ' — bei Bedarf über "Neu" oder "Öffnen" verwerfen');
    return true;
  } catch (err) {
    console.warn('Autosave-Wiederherstellung fehlgeschlagen:', err.message);
  }
  return false;
}

