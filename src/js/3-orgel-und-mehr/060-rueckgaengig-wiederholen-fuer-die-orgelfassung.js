// ── Rückgängig/Wiederholen für die Orgelfassung ──
// Jede Darstellung (clRender) vergleicht den Orgelzustand mit dem zuletzt
// gesehenen; hat er sich geändert, kommt der alte Zustand auf den Stapel.
const _clUndo = { last: null, stack: [], redo: [] };
function clUndoReset() { window._clWidthTouched = false; _clUndo.last = null; _clUndo.stack = []; _clUndo.redo = []; }
function clUndoTrack() {
  if (window._ntMappeBusy) return;
  const sig = JSON.stringify(clState);
  if (_clUndo.last == null) { _clUndo.last = sig; return; }
  if (sig === _clUndo.last) return;
  _clUndo.stack.push(_clUndo.last); if (_clUndo.stack.length > 100) _clUndo.stack.shift();
  _clUndo.redo = []; _clUndo.last = sig;
}
function clUndoApply(from, to, msg) {
  if (!from.length) { gregGst(msg); return; }
  to.push(_clUndo.last);
  _clUndo.last = from.pop();
  clState = JSON.parse(_clUndo.last); clNormalizeState();
  clFillTargetSelect(); clRender();
  if (typeof gregScheduleAutosave === 'function') gregScheduleAutosave();
}
function clUndo() { clUndoApply(_clUndo.stack, _clUndo.redo, 'Orgel: nichts rückgängig zu machen'); }
function clRedo() { clUndoApply(_clUndo.redo, _clUndo.stack, 'Orgel: nichts zu wiederholen'); }
// Tastenkürzel: Strg/⌘+Z rückgängig, Strg/⌘+Y bzw. Strg/⌘+Umschalt+Z wiederholen
// (Choral oder Orgel, je nach Ansicht), Strg/⌘+S in die Bibliothek speichern.
document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  const k = (e.key || '').toLowerCase();
  if (k === 's') { e.preventDefault(); gregLibSaveCurrent(); return; }
  if (k !== 'z' && k !== 'y') return;
  const t = e.target, tag = t && t.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return; // Texteingabe: eigenes Rückgängig
  e.preventDefault();
  const redo = k === 'y' || e.shiftKey;
  if (window._ntTab === 'editor') { redo ? clRedo() : clUndo(); }
  else { redo ? gregRedo() : gregUndo(); }
});
function clRender() {
  clNormalizeState();
  clUndoTrack();
  try { clRenderInner(); }
  finally { if (_clUndo.last != null && !window._ntMappeBusy) _clUndo.last = JSON.stringify(clState); } // interne Anpassungen beim Setzen nicht als Änderung zählen
}
function clRenderInner() {
  if (typeof ntPlay !== 'undefined' && ntPlay.source === 'cl') ntPlayStop(); // Notenbild wird ersetzt
  clNormalizeState();
  const el = document.getElementById('cl-score');
  const info = document.getElementById('cl-info');
  clSyncControls();
  if (!el) return;
  let abc, liq = [];
  if (clState[clMK()]) {
    if (clState.accomp) clState[clMK()] = clState[clMK()].replace(/^%%score[^\n]*\n(?:V:[STAB] [^\n]*\n){4}/m, clAbcScoreHeader(!!clState.pedal));
    abc = clState[clMK()];
    if (info) info.innerHTML = '<span style="color:#e0a060">Von Hand bearbeitete Fassung</span> – „Aus Choral übernehmen“ erzeugt sie neu aus dem Choral (Handänderungen gehen dabei verloren).';
  } else {
    clLast = clBuild();
    if (!clLast) {
      el.innerHTML = '<div style="color:#6b5e3e;font:14px serif;padding:20px">Noch keine Noten vorhanden – zuerst im Choral-Editor ein Stück erfassen, laden oder importieren.</div>';
      if (info) info.textContent = '';
      return;
    }
    clMigrateOverrides(clLast);
    abc = clLast.abc; liq = clLast.liqChars;
    const inf = clLast.info;
    if (info) info.textContent = 'Schlusston ' + inf.finalisOrig + ' (' + inf.modeName + ')' +
      (inf.semitones ? ' → transponiert auf ' + inf.finalisTarget : '') + ' · Vorzeichnung: ' + inf.sigText +
      (clState.accomp ? ' · Begleitsatz: Akkord durch Klick auf eine Note ändern' : ' · Achtel = Grundschlag, Viertel = Mora/Tonwiederholung, Strich = Episem, kleine Note = Liqueszenz');
  }
  const src = document.getElementById('cl-src');
  if (src && document.activeElement !== src) src.value = abc;
  const sw = clScoreWidth();
  let vs = ntViewScale('cl');
  // Handy: kleinere Breite als der Bildschirm = weniger Noten pro Zeile, dafür
  // grösser – das Notenbild wird auf die Bildschirmbreite vergrössert (nur Anzeige)
  // Von Hand eingestellte Breite mit «An Seitenbreite anpassen»: breiter als der
  // Bildschirm = mehr Noten pro Zeile, verkleinert eingepasst (kein Seitwärts-Scrollen)
  const mobDef = clMobileDefaultW();
  if ((clState.width || mobDef) && !ntViewScale._override && (gregIsMobileViewport() || (ntFit('cl') && (window._clWidthTouched || ntPaperOn())))) {
    const wrap = document.getElementById('cl-score-wrap');
    const avail = wrap ? wrap.clientWidth - 24 : 0;
    const f = (avail - 40) / (sw * vs); // Ergebnis: sw*vs+40 = avail (kein Seitwärts-Scrollen)
    // Seitenansicht (PC): nie über die Fensterbreite vergrössern – das Blatt behält seine Breite,
    // nur ein zu breites Blatt wird mit «an Breite anpassen» verkleinert
    if (ntPaperOn() ? (f > 0 && f < 1) : (f > 1 || (f > 0 && f < 1 && (mobDef || (ntFit('cl') && window._clWidthTouched))))) vs *= f;
  }
  el.style.width = Math.round(sw * vs + 40) + 'px';
  window._clTuneObjs = clRenderAbc(el, abc, liq, sw, (!clState[clMK()] && clLast && !clUi().view) ? clChordClick : null,
    (!clState[clMK()] && clLast) ? (clLast.sylRanges || []).filter(r => r.lb && r.lb.pb) : []);
  if (vs !== 1) el.querySelectorAll('.cl-tune > svg').forEach(svg => {
    const w = parseFloat(svg.getAttribute('width')), h = parseFloat(svg.getAttribute('height'));
    if (!w || !h) return;
    if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.setAttribute('width', Math.round(w * vs)); svg.setAttribute('height', Math.round(h * vs));
  });
  clApplyUi();
  clSyncControls();
  clDrawTexts();
  if (ntPaperOn()) {
    document.body.classList.add('nt-paper');
    document.documentElement.style.setProperty('--cl-paper-w', parseInt(el.style.width, 10) + 'px');
    ntPaperHandles(el, {
      getW: () => clScoreWidth(), vs: () => ntViewScale('cl'), a4: CL_PAPER_A4,
      live: w2 => { el.style.width = Math.round(w2 * ntViewScale('cl') + 40) + 'px'; },
      commit: w2 => clSetWidth(w2),
      reset: () => { clWidthAuto(); gregGst('Seitenbreite: A4'); }
    });
  }
}

// ── Anzeige/Bearbeiten, Menü, (geräte-lokal gespeichert) ──
function clUi() {
  let u = null; try { u = JSON.parse(localStorage.getItem('notatorClUi') || 'null'); } catch (e) {}
  if (!u) u = { view: gregIsMobileViewport(), menu: !gregIsMobileViewport() };
  if (u.lvl == null) u.lvl = gregIsMobileViewport() ? 1 : 2; // Menü im Bearbeiten: 2 voll, 1 kompakt, 0 aus
  return u;
}
function clSaveUi(u) { try { localStorage.setItem('notatorClUi', JSON.stringify(u)); } catch (e) {} }
function clApplyUi() {
  const u = clUi(), p = document.getElementById('classic-panel');
  if (!p) return;
  p.classList.toggle('cl-view', !!u.view);
  p.classList.toggle('cl-menu-collapsed', !!u.view || u.lvl === 0); // Anzeige = ohne Menü
  p.classList.toggle('cl-menu-compact', !u.view && u.lvl === 1);
  const mb = document.getElementById('cl-mode-btn'), nb = document.getElementById('cl-menu-btn');
  if (mb) mb.innerHTML = u.view ? '&#9998;<span class="nt-lbl"> Bearbeiten</span>' : '&#128065;<span class="nt-lbl"> Anzeige</span>';
  if (nb) {
    nb.style.display = u.view ? 'none' : '';
    nb.innerHTML = (u.lvl === 2 ? '&#9776;' : u.lvl === 1 ? '&#9776;&#189;' : '&#9776;&#8230;') + '<span class="nt-lbl"> Menü: ' + ['aus', 'kompakt', 'voll'][u.lvl] + '</span>';
    nb.title = 'Menü ' + ['ausgeblendet', 'kompakt', 'voll'][u.lvl] + ' – tippen: ' + ['voll', 'aus', 'kompakt'][u.lvl];
    nb.style.background = u.lvl === 2 ? '' : '#6a5a30'; nb.style.color = u.lvl === 2 ? '' : '#fff';
  }
  ntFileTitleRefresh(); ntFileTitleShow();
  ntUpdateGbLinks();
}
function clToggleView() { const u = clUi(); u.view = !u.view; if (!u.view) u.menu = true; clSaveUi(u); clApplyUi(); clRender(); }
function clToggleMenu() { const u = clUi(); u.lvl = u.lvl === 2 ? 1 : u.lvl === 1 ? 0 : 2; clSaveUi(u); clApplyUi(); if (!clState.width) clRender(); }

