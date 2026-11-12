// ── Autosave (sessionStorage) ─────────────────────────────────────
// Guards against the classic "hit F5, lose everything" accident: the app
// runs as a single local HTML file with no server/account behind it, so
// there's nowhere else a crash/reload/accidental-tab-close recovery could
// come from.
// Uses sessionStorage (not localStorage) DELIBERATELY: sessionStorage is
// scoped per TAB — it survives a reload/back-forward navigation of the
// SAME tab (exactly the "hit F5" accident this protects against), but a
// brand-new tab/window always starts with empty sessionStorage, even for
// the identical file/URL. This was changed from localStorage on user
// request (Runde 58): with localStorage, EVERY newly opened tab silently
// inherited whatever was last edited in ANY tab, which was unwanted —
// opening Notator fresh in a new tab should always start blank; only an
// actual reload of an already-open tab should restore its own last state.
// (Trade-off, accepted: closing a tab — not just reloading it — now also
// clears its autosave, unlike before. Given the primary purpose is
// reload-recovery, not cross-session persistence, this is the right
// default.)
// Bump NOTATOR_BUILD_ID every delivered version. This scopes the autosave
// key per-file: without it, reloading a DIFFERENT (older/newer) Notator
// build in the same tab would incorrectly restore a previous build's
// content (originally reported by user, Runde 56).
const NOTATOR_BUILD_ID = '400';
const NOTATOR_AUTOSAVE_KEY = 'notatorGregAutosave_v1_' + NOTATOR_BUILD_ID;

// Hinweis auf neue Version: offene Tabs/installierte App laufen sonst
// unbemerkt mit altem Stand weiter (Nutzerberichte 2026-10-10). Prüft beim
// Zurückkehren zur App und alle 15 Min.; «Neu laden» übernimmt das aktuelle
// Stück in die Wiederherstellung der neuen Version.
function ntCheckForUpdate() {
  if (!/^https?:/.test(location.protocol) || document.getElementById('nt-update-bar')) return;
  fetch(location.pathname.replace(/[^/]*$/, '') + 'index.html', { cache: 'no-store' }).then(r => r.ok ? r.text() : '').then(t => {
    const m = /NOTATOR_BUILD_ID = '(\d+)'/.exec(t);
    if (!m || +m[1] <= +NOTATOR_BUILD_ID || document.getElementById('nt-update-bar')) return;
    const newId = m[1];
    const bar = document.createElement('div');
    bar.id = 'nt-update-bar';
    bar.style.cssText = 'position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:3000;background:#2a4a6a;color:#fff;padding:8px 12px;border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,.4);font:13px system-ui,sans-serif;display:flex;gap:10px;align-items:center';
    bar.innerHTML = '<span>Neue Notator-Version verfügbar (Build ' + newId + ')</span>';
    const go = document.createElement('button'); go.className = 'b'; go.textContent = '↻ Neu laden'; go.style.cssText = 'font-size:12px;padding:3px 10px';
    go.onclick = () => ntUpdateReload(newId);
    const later = document.createElement('button'); later.className = 'b'; later.textContent = 'Später'; later.style.cssText = 'font-size:12px;padding:3px 8px';
    later.onclick = () => bar.remove();
    bar.appendChild(go); bar.appendChild(later);
    document.body.appendChild(bar);
  }).catch(() => {});
}
// Neu laden für die neue Version – nie mit Datenverlust (Nutzerbericht 2026-10-21):
// ungespeicherte Änderungen -> Rückfrage (zuerst in die Bibliothek speichern);
// in jedem Fall wird der aktuelle Stand vorher für die Wiederherstellung
// gesichert (unabhängig von der Build-Nummer, siehe gregTryRestoreAutosave).
function ntUpdateReload(newId) {
  { const ub = document.getElementById('nt-update-bar'); if (ub) ub.remove(); }
  const doReload = () => {
    try {
      const st = gregBuildStateObject();
      const rec = JSON.stringify({ savedAt: Date.now(), state: st, libId: gregLibCurrentId });
      sessionStorage.setItem('notatorGregAutosave_v1_' + newId, rec);
      sessionStorage.setItem(NOTATOR_AUTOSAVE_KEY, rec);
      sessionStorage.setItem('notatorForceRestore', '1');
      if (!window._ntMappeBusy) ntRecoveryWrite(st);
    } catch (e) {}
    window._ntReloadOk = true; // keine zusätzliche Browser-Warnung beim Verlassen
    location.reload();
  };
  if (window._ntMappeBusy || !ntIsDirty()) { doReload(); return; }
  showModal('⚠️ Ungespeicherte Änderungen', 'Das offene Stück hat Änderungen, die noch nicht gespeichert sind. Vor dem Neuladen in der Bibliothek speichern?\n\n(Der aktuelle Stand wird in jedem Fall für die Wiederherstellung nach dem Neuladen gesichert.)', [
    { label: '💾 Speichern und neu laden', fn: () => { closeModal(); gregLibSaveCurrent().then(ok => { if (ok) setTimeout(doReload, 300); else gregGst('Nicht gespeichert – Neuladen abgebrochen.'); }); } },
    { label: 'Ohne Speichern neu laden', fn: () => { closeModal(); doReload(); } },
    { label: 'Abbrechen', fn: () => closeModal() }
  ]);
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') ntCheckForUpdate(); });
setInterval(ntCheckForUpdate, 15 * 60 * 1000);
setTimeout(ntCheckForUpdate, 20000);

function gregAutosaveNow() {
  try {
    const state = gregBuildStateObject();
    if (!window._ntMappeBusy) ntRecoveryWrite(state);
    sessionStorage.setItem(NOTATOR_AUTOSAVE_KEY, JSON.stringify({ savedAt: Date.now(), state, libId: gregLibCurrentId }));
  } catch (err) {
    // Best-effort only — e.g. Safari private browsing throws on setItem,
    // or sessionStorage may be disabled/full. Silently skip; this must never
    // interrupt normal editing.
    console.warn('Autosave fehlgeschlagen:', err.message);
  }
}

