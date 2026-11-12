// ── Anzeige-Skalierung (🔍) für Choral und Orgel ──
// Nur Bildschirm: kleiner = mehr Noten pro Zeile (Neu-Umbruch), PDF und
// gespeichertes Stück bleiben unverändert. Pro Gerät gespeichert.
function ntViewScale(src) {
  if (ntViewScale._override) return 1;
  let o = null; try { o = JSON.parse(localStorage.getItem('notatorViewScale') || 'null'); } catch (e) {}
  const v = o && o[src];
  if (typeof v === 'number' && v >= 0.15 && v <= 3) return v;
  // Handy: Choral standardmässig grösser (Neumen lassen sich so besser setzen)
  return (src === 'greg' && typeof gregIsMobileViewport === 'function' && gregIsMobileViewport()) ? NT_MOBILE_GREG_SCALE : 1;
}
const NT_MOBILE_GREG_SCALE = 0.5;
// Basis für die %-Anzeige: Handy-Choral 100 % = Skalierung 0,5 (Nutzerwunsch 2026-10-28)
function ntVsBase(src) { return (src === 'greg' && typeof gregIsMobileViewport === 'function' && gregIsMobileViewport()) ? NT_MOBILE_GREG_SCALE : 1; }
// einmalig: alte Handy-Einstellung verwerfen, damit die neue Grundgrösse gilt
try {
  if (!localStorage.getItem('notatorVsMig2') && window.matchMedia && matchMedia('(max-width: 700px)').matches) {
    const o = JSON.parse(localStorage.getItem('notatorViewScale') || 'null');
    if (o && 'greg' in o) { delete o.greg; localStorage.setItem('notatorViewScale', JSON.stringify(o)); }
  }
  localStorage.setItem('notatorVsMig2', '1');
} catch (e) {}
// Orgel: «An Seitenbreite anpassen» – ein gespeicherter, breiterer Zeilenumbruch
// (clState.width) wird am Bildschirm ignoriert, sobald er nicht auf die Seite
// passt (kein Seitwärts-Scrollen). Standard: ein auf dem Handy, sonst aus.
// PDF/Druck (ntViewScale._override) bleibt unverändert.
function ntFit(src) {
  if (ntViewScale._override) return false;
  let o = null; try { o = JSON.parse(localStorage.getItem('notatorViewScale') || 'null'); } catch (e) {}
  const f = o && o.fit && o.fit[src];
  return typeof f === 'boolean' ? f : (typeof gregIsMobileViewport === 'function' && gregIsMobileViewport());
}
function ntSetFit(src, on) {
  let o = null; try { o = JSON.parse(localStorage.getItem('notatorViewScale') || 'null'); } catch (e) {}
  o = o || {}; o.fit = o.fit || {}; o.fit[src] = !!on;
  try { localStorage.setItem('notatorViewScale', JSON.stringify(o)); } catch (e) {}
  if (src === 'greg') gregRender(); else clRender();
}
let _ntVsTimer = null;
function ntSetViewScale(src, v) {
  let o = null; try { o = JSON.parse(localStorage.getItem('notatorViewScale') || 'null'); } catch (e) {}
  o = o || {}; o[src] = Math.round(v * 100) / 100;
  try { localStorage.setItem('notatorViewScale', JSON.stringify(o)); } catch (e) {}
  ntViewScaleUpdateButtons();
  clearTimeout(_ntVsTimer);
  _ntVsTimer = setTimeout(() => { if (src === 'greg') gregRender(); else clRender(); }, 180);
}
// Zwei-Finger-Zoom nur im Notenbereich (die Seite selbst zoomt nicht mehr,
// Menüs bleiben gleich gross): Vorschau per CSS, danach neu setzen
function ntPinchZoom(areaId, previewId, src) {
  const area = document.getElementById(areaId); if (!area || area._pinch) return;
  area._pinch = true;
  let st = null;
  const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  area.addEventListener('touchstart', ev => {
    if (ev.touches.length !== 2) return;
    const pv = document.getElementById(previewId); if (!pv) return;
    const r = pv.getBoundingClientRect();
    const cx = (ev.touches[0].clientX + ev.touches[1].clientX) / 2 - r.left, cy = (ev.touches[0].clientY + ev.touches[1].clientY) / 2 - r.top;
    st = { d0: dist(ev.touches), s0: ntViewScale(src), f: 1, pv };
    pv.style.transformOrigin = cx + 'px ' + cy + 'px';
    ev.preventDefault();
  }, { passive: false });
  area.addEventListener('touchmove', ev => {
    if (!st || ev.touches.length !== 2) return;
    ev.preventDefault();
    const bs = ntVsBase(src), lim = v => Math.max(0.4 * bs, Math.min(3 * bs, v));
    st.f = lim(st.s0 * dist(ev.touches) / st.d0) / st.s0;
    st.pv.style.transform = 'scale(' + st.f + ')';
  }, { passive: false });
  const end = () => {
    if (!st) return;
    const bs = ntVsBase(src), s1 = Math.round(st.s0 * st.f / bs * 20) / 20 * bs, pv = st.pv; st = null;
    if (Math.abs(s1 - ntViewScale(src)) < 0.04) { pv.style.transform = ''; return; }
    ntSetViewScale(src, s1);
    setTimeout(() => { pv.style.transform = ''; }, 450); // nach dem Neusetzen
  };
  area.addEventListener('touchend', ev => { if (ev.touches.length < 2) end(); });
  area.addEventListener('touchcancel', end);
}
function ntViewScaleUpdateButtons() {
  document.querySelectorAll('.nt-zoom-btn').forEach(b => { b.innerHTML = '&#128269; ' + Math.round(ntViewScale(b.getAttribute('data-src')) / ntVsBase(b.getAttribute('data-src')) * 100) + '%'; });
}
function ntViewScalePop(btn) {
  const old = document.getElementById('nt-vs-pop');
  if (old) { const same = old._btn === btn; old.remove(); if (same) return; }
  const src = btn.getAttribute('data-src');
  const d = document.createElement('div');
  d.id = 'nt-vs-pop'; d._btn = btn;
  d.style.cssText = 'position:fixed;z-index:2600;background:#1a2414;border:1px solid #5a8a40;border-radius:3px;padding:8px 10px;box-shadow:0 4px 14px rgba(0,0,0,.5);font:12px system-ui,sans-serif;color:#c0d890;display:flex;align-items:center;gap:8px;width:min(300px,calc(100vw - 16px));box-sizing:border-box';
  const r = btn.getBoundingClientRect();
  d.style.top = Math.min(r.bottom + 4, window.innerHeight - 60) + 'px';
  d.style.left = Math.max(8, Math.min(r.left - 120, window.innerWidth - 308)) + 'px';
  if (src === 'greg' && gregIsMobileViewport()) {
    // Handy-Choral: Breite in px statt Grösse in %. Zeilenbreite = (Feldbreite − 20) / (Zoom × Anzeigegrösse) – gleiche Wirkung wie bisher,
    // nur als Breite ausgedrückt: kleiner = weniger Noten pro Zeile, dafür grösser (nur Bildschirm, PDF unverändert).
    const wrapEl = document.getElementById('greg-canvas-wrap');
    const boxW = () => Math.max(100, (wrapEl ? wrapEl.clientWidth : 360));
    const zm = () => { try { return gregGetSizing().zoom || 1; } catch (e) { return 1; } };
    const toW = vs => Math.round((boxW() - 20) / (zm() * vs));
    const toVs = w => (boxW() - 20) / (zm() * w);
    const defW = Math.round(toW(NT_MOBILE_GREG_SCALE) / 10) * 10;
    const MIN = 300, MAX = 1700;
    const cw = Math.max(MIN, Math.min(MAX, toW(ntViewScale('greg'))));
    d.style.flexWrap = 'wrap';
    d.title = 'Breite = Zeilenbreite des Notenbilds: kleiner = weniger Noten pro Zeile, dafür grösser. Nur Bildschirm, PDF unverändert.';
    d.innerHTML = '<span>Breite</span><button class="b" data-w="-20" style="font-size:11px;padding:3px 8px">&minus;</button>' +
      '<input type="range" min="' + MIN + '" max="' + MAX + '" step="10" value="' + cw + '" style="flex:1;min-width:0;accent-color:#5a8a40;height:28px">' +
      '<button class="b" data-w="20" style="font-size:11px;padding:3px 8px">+</button>' +
      '<span class="v" style="min-width:52px;text-align:right">' + cw + ' px</span><button class="b" data-w="0" style="font-size:11px;padding:3px 6px" title="Zurück auf die Standardbreite">Auto</button>';
    document.body.appendChild(d);
    const ri = d.querySelector('input'), rv = d.querySelector('.v');
    const apply = w => { w = Math.max(MIN, Math.min(MAX, Math.round(w))); ri.value = w; rv.textContent = w + ' px'; ntSetViewScale('greg', toVs(w)); };
    ri.oninput = () => apply(+ri.value);
    d.querySelectorAll('button').forEach(b => b.onclick = () => { const dv = +b.dataset.w; if (dv) apply(+ri.value + dv); else { ri.value = defW; rv.textContent = defW + ' px'; ntSetViewScale('greg', NT_MOBILE_GREG_SCALE); } });
    const close0 = e => { if (!d.contains(e.target) && e.target !== btn && !btn.contains(e.target)) { d.remove(); document.removeEventListener('pointerdown', close0); } };
    setTimeout(() => document.addEventListener('pointerdown', close0), 0);
    return;
  }
  const base = ntVsBase(src);
  const cur = Math.round(ntViewScale(src) / base * 100);
  d.innerHTML = '<span>Grösse</span><input type="range" min="40" max="' + (gregIsMobileViewport() ? 300 : 160) + '" step="5" value="' + cur + '" style="flex:1;min-width:0;accent-color:#5a8a40;height:28px">' +
    '<span class="v" style="min-width:36px;text-align:right">' + cur + '%</span><button class="b" style="font-size:11px;padding:3px 6px" title="Zurück auf 100 %">100%</button>';
  if (ntPaperOn() && src !== 'cl') {
    // Choral: Breitenregler in px wie bei der Orgel (−/Regler/+/A4); Breite = logische Blattbreite, bestimmt Zeilenumbruch und Druckgrösse
    const row = document.createElement('div');
    row.style.cssText = 'flex-basis:100%;display:flex;align-items:center;gap:6px';
    row.title = 'Seitenbreite: bestimmt Zeilenumbruch und Notengrösse im PDF (breiter = kleinere Noten, mehr pro Zeile). A4 = Standard.';
    row.innerHTML = '<span>Breite</span><button class="b" data-w="-20" style="font-size:11px;padding:2px 7px" title="Schmaler (weniger Noten pro Zeile)">&minus;</button>' +
      '<input type="range" min="' + NT_PAPER_MIN + '" max="' + NT_PAPER_MAX + '" step="10" style="flex:1;min-width:0;accent-color:#5a8a40;height:28px">' +
      '<button class="b" data-w="20" style="font-size:11px;padding:2px 7px" title="Breiter (mehr Noten pro Zeile)">+</button>' +
      '<span class="wv" style="min-width:48px;text-align:right"></span><button class="b" data-w="0" style="font-size:11px;padding:2px 6px" title="Zurück auf A4">A4</button>';
    const ri = row.querySelector('input'), rv = row.querySelector('.wv');
    const show = w => { ri.value = w; rv.textContent = Math.round(w) + ' px'; };
    show(gregPaperW());
    const live = w => document.documentElement.style.setProperty('--greg-paper-w', Math.round(w * gregVS()) + 'px');
    const commit = w => { w = Math.max(NT_PAPER_MIN, Math.min(NT_PAPER_MAX, Math.round(w))); window._gregPageW = Math.abs(w - GREG_PAPER_A4) < 4 ? null : w; show(gregPaperW()); gregRender(); };
    ri.oninput = () => { rv.textContent = ri.value + ' px'; live(+ri.value); };
    ri.onchange = () => commit(+ri.value);
    row.querySelectorAll('button').forEach(b => b.onclick = () => { const dv = +b.dataset.w; commit(dv ? gregPaperW() + dv : GREG_PAPER_A4); if (!dv) gregGst('Seitenbreite: A4'); });
    d.style.flexWrap = 'wrap';
    d.appendChild(row);
  } else if (ntPaperOn()) {
    const pb = document.createElement('button'); pb.className = 'b';
    pb.style.cssText = 'font-size:11px;padding:3px 6px;flex-basis:100%';
    const isA4 = src === 'cl' ? !clState.width : !window._gregPageW;
    pb.textContent = isA4 ? '▭ Seitenbreite: A4 (am Blattrand ziehen zum Ändern)' : '▭ Seitenbreite auf A4 zurücksetzen';
    pb.title = 'Die Seitenbreite bestimmt Zeilenumbruch und Notengrösse im PDF. Ändern: Griff links/rechts am Notenblatt ziehen; Doppelklick auf den Griff = A4.';
    pb.onclick = () => { if (src === 'cl') clWidthAuto(); else { window._gregPageW = null; gregRender(); } d.remove(); gregGst('Seitenbreite: A4'); };
    d.style.flexWrap = 'wrap';
    d.appendChild(pb);
  }
  if (src === 'cl') {
    const fl = document.createElement('label');
    fl.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:11px;white-space:nowrap;cursor:pointer';
    fl.title = 'Notenblatt auf Bildschirmbreite umbrechen, damit nicht seitwärts gescrollt werden muss (PDF unverändert)';
    fl.innerHTML = '<input type="checkbox"' + (ntFit('cl') ? ' checked' : '') + ' style="accent-color:#5a8a40"> an Breite anpassen';
    fl.querySelector('input').onchange = e => ntSetFit('cl', e.target.checked);
    d.style.flexWrap = 'wrap';
    d.appendChild(fl);
  }
  document.body.appendChild(d);
  const inp = d.querySelector('input'), val = d.querySelector('.v');
  inp.oninput = () => { val.textContent = inp.value + '%'; ntSetViewScale(src, parseInt(inp.value, 10) / 100 * base); };
  d.querySelector('button').onclick = () => { inp.value = 100; inp.oninput(); };
  const close = e => { if (!d.contains(e.target) && e.target !== btn && !btn.contains(e.target)) { d.remove(); document.removeEventListener('pointerdown', close); } };
  setTimeout(() => document.addEventListener('pointerdown', close), 0);
}
document.addEventListener('DOMContentLoaded', ntViewScaleUpdateButtons);

// Einstellungen (Tempo, Instrument) als kleines Aufklappfeld
// Handy: «⋯» neben ▶/■ – ab Stelle, Abschnitt, Tempo/Klang, wach halten, Grösse
function ntPlayMore(btn) {
  const old = document.getElementById('nt-pm-pop');
  if (old) { old.remove(); return; }
  const src = btn.getAttribute('data-src');
  const d = document.createElement('div'); d.id = 'nt-pm-pop';
  d.style.cssText = 'position:fixed;z-index:2600;background:#1a2414;border:1px solid #5a8a40;border-radius:3px;padding:6px;box-shadow:0 4px 14px rgba(0,0,0,.5);font:13px system-ui,sans-serif;color:#c0d890;display:flex;flex-direction:column;gap:5px;min-width:220px';
  const rc = btn.getBoundingClientRect();
  d.style.top = (rc.bottom + 4) + 'px'; d.style.right = Math.max(8, window.innerWidth - rc.right) + 'px';
  const item = (label, fn) => { const b = document.createElement('button'); b.className = 'b'; b.innerHTML = label; b.style.cssText = 'text-align:left;font-size:13px;padding:7px 10px'; b.onclick = () => { d.remove(); setTimeout(() => fn(), 0); }; d.appendChild(b); };
  if (ntPlaySecCount() > 1) {
    const sel = document.querySelector('.nt-play-sec[data-src="' + src + '"]');
    ntPlaySecUi();
    if (sel) {
      const s2 = document.createElement('select');
      s2.innerHTML = sel.innerHTML; s2.value = String(ntPlay.sec);
      s2.style.cssText = 'font-size:13px;padding:5px;background:#0a1406;color:#c0d890;border:1px solid #4a6a30';
      s2.onchange = () => ntPlaySecSet(s2.value);
      d.appendChild(s2);
    }
  }
  item('&#9654;&#8739; Ab Stelle abspielen …', () => ntPlayPick(src));
  item('&#9834; Tempo und Klang', () => ntPlaySettings(btn));
  item('&#9728;&#xFE0E; Bildschirm wach halten: ' + (ntWakePref() ? 'an' : 'aus'), () => ntWakeToggle());
  item('&#128269; Anzeigegrösse', () => ntViewScalePop(btn));
  document.body.appendChild(d);
  d.style.right = ''; d.style.left = Math.max(8, Math.min(rc.left, window.innerWidth - d.offsetWidth - 8)) + 'px';
  const close = e => { if (!d.contains(e.target) && e.target !== btn) { d.remove(); document.removeEventListener('pointerdown', close, true); } };
  setTimeout(() => document.addEventListener('pointerdown', close, true), 0);
}
function ntPlaySettings(btn) {
  const old = document.getElementById('nt-play-pop');
  if (old) { old.remove(); return; }
  const p = ntPlayPrefs();
  const d = document.createElement('div');
  d.id = 'nt-play-pop';
  d.style.cssText = 'position:fixed;z-index:2600;background:#1a2414;border:1px solid #5a8a40;border-radius:3px;padding:8px 10px;box-shadow:0 4px 14px rgba(0,0,0,.5);font:12px system-ui,sans-serif;color:#c0d890;display:flex;flex-direction:column;gap:6px;min-width:200px';
  const r = btn.getBoundingClientRect();
  d.style.top = Math.min(r.bottom + 4, window.innerHeight - 120) + 'px';
  d.style.left = Math.max(4, Math.min(r.left - 120, window.innerWidth - 220)) + 'px';
  d.innerHTML = '<label style="display:flex;align-items:center;gap:6px">Tempo ♪ <input id="nt-pp-tempo" type="range" min="60" max="300" step="10" value="' + p.tempo + '" style="flex:1;accent-color:#5a8a40"> <span id="nt-pp-tv">' + p.tempo + '</span></label>' +
    '<label style="display:flex;align-items:center;gap:6px">Klang <select id="nt-pp-instr" style="flex:1;font-size:12px;background:#0a1406;color:#c0d890;border:1px solid #3a4a30">' +
    NT_INSTRUMENTS.map(x => '<option value="' + x.p + '"' + (x.p === p.instr ? ' selected' : '') + '>' + x.n + '</option>').join('') + '</select></label>' +
    '<span style="font-size:10px;color:#8b9a70">Änderungen gelten ab dem nächsten Start.</span>';
  document.body.appendChild(d);
  d.querySelector('#nt-pp-tempo').oninput = e => { p.tempo = parseInt(e.target.value, 10); d.querySelector('#nt-pp-tv').textContent = p.tempo; ntPlaySavePrefs(p); };
  d.querySelector('#nt-pp-instr').onchange = e => { p.instr = parseInt(e.target.value, 10); ntPlaySavePrefs(p); };
  setTimeout(() => document.addEventListener('mousedown', function h(e) { if (!d.contains(e.target) && e.target !== btn) { d.remove(); document.removeEventListener('mousedown', h); } }), 0);
}

// ── Vollbild für die Notenfläche (Choral und Orgel) ──
