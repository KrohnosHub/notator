// ── App-Installation (PWA) ──
let _ntInstallEvt = null;
window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault(); _ntInstallEvt = e;
  const b = document.getElementById('nt-install-btn'); if (b) b.style.display = '';
});
window.addEventListener('appinstalled', function() {
  _ntInstallEvt = null; const b = document.getElementById('nt-install-btn'); if (b) b.style.display = 'none';
  gregGst('Notator wurde als App installiert.');
});
function ntInstall() {
  if (!_ntInstallEvt) { alert('Im Browser-Menü „Zum Startbildschirm hinzufügen“ bzw. „App installieren“ wählen.'); return; }
  _ntInstallEvt.prompt();
  _ntInstallEvt.userChoice.finally(function() { _ntInstallEvt = null; const b = document.getElementById('nt-install-btn'); if (b) b.style.display = 'none'; });
}
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', function() { navigator.serviceWorker.register('./sw.js').catch(function(err) { console.warn('Service Worker nicht registriert:', err); }); });
}

function ntFsElement() { return document.fullscreenElement || document.webkitFullscreenElement || document.querySelector('.nt-pseudo-fs'); }
function ntAfterFs() {
  const fs = ntFsElement();
  let ex = document.getElementById('nt-fs-exit');
  if (fs) {
    if (!ex) { ex = document.createElement('button'); ex.id = 'nt-fs-exit'; ex.textContent = '✕ Vollbild beenden'; ex.onclick = ntExitFullscreen; }
    fs.appendChild(ex);
  } else if (ex) ex.remove();
  setTimeout(function() {
    const cp = document.getElementById('classic-panel');
    if (cp && cp.style.display !== 'none' && typeof clRender === 'function') clRender();
    const gp = document.getElementById('greg-panel');
    if (gp && gp.style.display !== 'none') { if (!gregIsMobileViewport() && typeof gregRender === 'function') gregRender(); gregScheduleMobileScale(); }
  }, 150);
}
function ntExitFullscreen() {
  const ps = document.querySelector('.nt-pseudo-fs');
  if (ps) { ps.classList.remove('nt-pseudo-fs'); ntAfterFs(); return; }
  const ex = document.exitFullscreen || document.webkitExitFullscreen;
  if (ex) ex.call(document);
}
function ntToggleFullscreen(id) {
  if (ntFsElement()) { ntExitFullscreen(); return; }
  const el = document.getElementById(id);
  if (!el) return;
  const pseudo = function() { el.classList.add('nt-pseudo-fs'); ntAfterFs(); };
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) { pseudo(); return; }
  try { const pr = req.call(el); if (pr && pr.catch) pr.catch(pseudo); } catch (e) { pseudo(); }
}
document.addEventListener('fullscreenchange', ntAfterFs);
document.addEventListener('webkitfullscreenchange', ntAfterFs);

function clOpen() {
  clNormalizeState();
  const cs = document.getElementById('cl-status'); if (cs) cs.textContent = '';
  clApplyUi();
  clEnsureAbcjs(() => { clFillTargetSelect(); clRender(); });
}

function clRegenerate() {
  if (clState[clMK()] && !confirm('Die von Hand bearbeitete Fassung wird durch eine neu aus dem Choral erzeugte ersetzt. Fortfahren?')) return;
  clState[clMK()] = null;
  clFillTargetSelect();
  clRender();
}

function clConfirmDropManual() {
  if (!clState[clMK()]) return true;
  if (!confirm('Grundton/Oktave neu setzen erzeugt die Noten neu aus dem Choral – deine Handänderungen im Quelltext gehen dabei verloren. Fortfahren?')) return false;
  clState[clMK()] = null;
  return true;
}

function clSetTarget(v) {
  if (!clConfirmDropManual()) { clFillTargetSelect(); return; }
  clCfg(clSel).targetPc = parseInt(v, 10);
  clRender();
}

function clSetOctave(delta) {
  if (!clConfirmDropManual()) return;
  const c = clCfg(clSel);
  c.octave = Math.max(-2, Math.min(2, (c.octave || 0) + delta));
  clRender();
}

// ── Layoutbreite (steuert Zeilenumbruch UND Druckgrösse: das PDF skaliert
//    die Seite auf A4-Breite, d.h. breiter = kleinere Noten, mehr pro Zeile)
let _clWidthTimer = null;
function clSetWidth(v) {
  window._clWidthTouched = true; // Nutzer stellt die Breite bewusst ein -> nicht durch «Anpassen» übersteuern
  clState.width = Math.max(400, Math.min(1600, parseInt(v, 10) || 740)); // Regler 500–1300 px, Ziehen am Blatt 400–1600 px
  if (ntPaperOn() && Math.abs(clState.width - CL_PAPER_A4) < 4) clState.width = null; // = A4
  clSyncControls();
  clearTimeout(_clWidthTimer);
  _clWidthTimer = setTimeout(clRender, 120);
}
function clWidthStep(dv) { clSetWidth(clScoreWidth() + dv); }
function clWidthAuto() { clState.width = null; window._clWidthTouched = false; clRender(); }

