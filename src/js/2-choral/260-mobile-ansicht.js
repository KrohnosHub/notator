// ── Mobile-Ansicht (Schritt 3) ───────────────────────────────────────
// Skaliert die gerenderte Notation rein visuell (CSS transform) auf die
// Bildschirmbreite, statt die interne, für Layout-Stabilität sorgfältig
// austarierte Render-Breitenlogik (window._gregForcedCanvasWidth, siehe
// gregRenderAllSections-Kommentare) anzufassen — ein CSS-Transform
// skaliert alles (inkl. an Noten verankerter Freitext-Positionen) exakt
// gleich mit und kann daher nichts an der internen Positionierung
// verschieben. Wird per MutationObserver auf #greg-canvas-wrap ausgelöst
// (statt an jeder einzelnen Render-Aufrufstelle verdrahtet zu werden) —
// damit robust gegenüber Änderungen an der Render-Pipeline.
function gregIsMobileViewport() {
  return window.matchMedia('(max-width: 700px)').matches;
}

let _gregMobileScaleTimer = null;
function gregScheduleMobileScale() {
  clearTimeout(_gregMobileScaleTimer);
  _gregMobileScaleTimer = setTimeout(gregMobileApplyScale, 120);
}

(function ntTrackVh() {
  const set = () => { const h = window.innerHeight; if (h > 200) document.documentElement.style.setProperty('--nt-vh', Math.round(h) + 'px'); };
  set();
  window.addEventListener('resize', set);
  window.addEventListener('orientationchange', () => setTimeout(set, 300));
})();
function gregMobileApplyScale() {
  const outer = document.getElementById('greg-canvas-wrap');
  const sizer = document.getElementById('greg-mobile-scale-outer');
  const wrap = document.getElementById('greg-mobile-scale-wrap');
  if (!outer || !sizer || !wrap) return;
  if (!gregIsMobileViewport()) {
    wrap.style.transform = '';
    sizer.style.height = '';
    return;
  }
  // transform ändert die Layoutgrösse nicht -> ohne Zurücksetzen messen; Stile
  // nur bei Änderung schreiben (sonst löst der MutationObserver endlos neu aus –
  // Dauerlast auf dem Handy, Absturzgefahr; Nutzerbericht 2026-10-26)
  const naturalWidth = wrap.scrollWidth;
  const naturalHeight = wrap.scrollHeight;
  const available = outer.clientWidth;
  if (!naturalWidth || !available) return;
  const scale = Math.min(1, available / naturalWidth);
  const tf = 'scale(' + (Math.round(scale * 1000) / 1000) + ')', hh = Math.ceil(naturalHeight * scale) + 'px';
  if (wrap.style.transform !== tf) wrap.style.transform = tf;
  if (sizer.style.height !== hh) sizer.style.height = hh;
}

// Spiegelt den Titel in die Mobile-Leiste (dort ist #greg-input-panel mit
// dem echten Titelfeld ausgeblendet).
// Name der Notator-Datei (Bibliothekseintrag) – oben angezeigt statt des Abschnittstitels
function ntFileTitleRefresh(force) {
  const id = typeof gregLibCurrentId !== 'undefined' ? gregLibCurrentId : null;
  if (!force && window._ntFileTitleId === id) return;
  window._ntFileTitleId = id;
  if (id == null) { window._ntFileTitle = null; ntFileTitleShow(); return; }
  gregLibGet(id).then(r => { if (window._ntFileTitleId === id) { window._ntFileTitle = r ? r.title : null; ntFileTitleShow(); } }).catch(() => {});
}
function ntFileTitleShow() {
  const f = window._ntFileTitle;
  const sec = ((document.getElementById('greg-title') || {}).value || '').trim();
  const txt = '📄 ' + (f || 'Neu – nicht gespeichert');
  const tip = (f ? 'Datei: ' + f : 'Noch nicht in der Bibliothek gespeichert') + (sec && sec !== f ? '\nTitel (aktueller Abschnitt): ' + sec : '');
  ['greg-mobile-title', 'cl-vb-title'].forEach(id => { const el = document.getElementById(id); if (el) { el.textContent = txt; el.title = tip; } });
  ntTrashMarkTitles();
}
function gregMobileSyncTitle() {
  ntFileTitleRefresh();
  ntFileTitleShow();
  ntUpdateGbLinks();
}

// ── Herkunft GregoBase: Kopffeld «notator-gregobase: <id>» (wird beim Import
// gesetzt, mit dem Stück gespeichert und im GABC-Export mitgeführt) ──
function gregTagGregoBase(gabc, picked) {
  if (!picked || !picked.id) return gabc;
  const line = 'notator-gregobase: ' + picked.id + ';';
  gabc = gabc.replace(/^\s*notator-gregobase:.*$/mi, '');
  return gabc.indexOf('%%') >= 0 ? line + '\n' + gabc : line + '\n%%\n' + gabc;
}
function gregGbIds(withLabels) {
  const ids = [], labels = [];
  const add = (t, lab) => { const m = /notator-gregobase:\s*(\d+)/i.exec(t || ''); if (m && ids.indexOf(m[1]) < 0) { ids.push(m[1]); labels.push(lab || ''); } };
  if (window._gregMultiSection && typeof gregSections !== 'undefined' && gregSections.length > 1) {
    gregSections.forEach((sec, i) => {
      const ti = i === gregActiveIdx ? (document.getElementById('greg-title') || {}).value : sec.title;
      add(i === gregActiveIdx ? gregHdrExtra : sec.hdrExtra, 'Abschnitt ' + (i + 1) + (ti ? ' – ' + String(ti).slice(0, 40) : ''));
    });
  } else add(typeof gregHdrExtra !== 'undefined' ? gregHdrExtra : '');
  return withLabels ? { ids, labels } : ids;
}
// Mehrere GregoBase-Herkünfte: Klick öffnet eine Auswahl statt nur des ersten Links
function ntGbLinkClick(ev, a) {
  const { ids, labels } = gregGbIds(true);
  if (ids.length < 2) return true;
  ev.preventDefault(); ev.stopPropagation();
  let m = document.getElementById('nt-gb-menu');
  if (m) { const same = m._anchor === a; m.remove(); if (same) return false; }
  m = document.createElement('div'); m.id = 'nt-gb-menu'; m._anchor = a;
  m.style.cssText = 'position:fixed;z-index:10050;background:#142010;border:1px solid #6a8a50;border-radius:4px;box-shadow:0 4px 14px rgba(0,0,0,.5);padding:3px 0;font-size:12px;max-width:min(90vw,360px)';
  m.innerHTML = ids.map((id, i) => '<a href="https://gregobase.selapa.net/chant.php?id=' + id + '" target="_blank" rel="noopener" style="display:block;padding:5px 10px;color:#9cc8ff;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">↗ #' + id + (labels[i] ? ' · ' + ntEscAttr(labels[i]) : '') + '</a>').join('');
  document.body.appendChild(m);
  const rc = a.getBoundingClientRect();
  m.style.top = Math.round(rc.bottom + 3) + 'px';
  m.style.left = Math.round(Math.max(4, Math.min(window.innerWidth - m.offsetWidth - 4, rc.left))) + 'px';
  m.querySelectorAll('a').forEach(x => x.addEventListener('click', () => setTimeout(() => m.remove(), 0)));
  setTimeout(() => {
    const close = e => { if (!m.contains(e.target) && e.target !== a) { m.remove(); document.removeEventListener('pointerdown', close, true); } };
    document.addEventListener('pointerdown', close, true);
  }, 0);
  return false;
}
