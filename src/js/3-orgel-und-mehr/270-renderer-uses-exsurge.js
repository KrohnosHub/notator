// ── RENDERER: uses exsurge ─────────────────────────────────────────
let _exsurgeCtxt = null;
let _gregActiveScore = null; // most recently rendered ChantScore for the ACTIVE section — used to anchor comment/freetext positions to actual notes (see gregResolveAnchorPosition)
// Add padding around SVG content by expanding viewBox; returns topPad used
function addSvgPadding(svgEl, pad, neededTopPad, bottomPad) {
  try {
    let vb = svgEl.getAttribute('viewBox');
    let x, y, w, h;
    if (vb) {
      [x, y, w, h] = vb.split(/[\s,]+/).map(Number);
    } else {
      w = parseFloat(svgEl.getAttribute('width')) || 700;
      h = parseFloat(svgEl.getAttribute('height')) || 300;
      x = 0; y = 0;
    }
    // Use caller-supplied topPad (based on title/text height), minimum pad*2.5
    // Use exactly what caller needs; pad alone as safety floor
    // Leerraum unter der letzten Zeile abschneiden (exsurge reserviert dort
    // den Abstand zu einem nächsten System, das es nicht gibt) – sonst ist
    // der Abstand zum nächsten Abschnitt viel grösser als eingestellt.
    if (bottomPad !== undefined && bottomPad !== null) {
      try {
        const bb = svgEl.getBBox();
        if (bb && bb.height > 0 && (bb.y + bb.height) - y < h) h = Math.max(10, (bb.y + bb.height) - y);
      } catch (e) {}
    }
    // neededTopPad wird exakt übernommen (kein Mindestwert mehr: ohne Titel
    // soll ein Abschnitt dicht anschliessen können)
    const topPad = (neededTopPad !== undefined && neededTopPad !== null) ? Math.max(0, neededTopPad) : pad;
    const botPad = (bottomPad !== undefined && bottomPad !== null) ? Math.max(0, bottomPad) : pad;
    svgEl.setAttribute('viewBox', (x-pad)+' '+(y-topPad)+' '+(w+pad*2)+' '+(h+topPad+botPad));
    svgEl.setAttribute('width', w+pad*2);
    svgEl.setAttribute('height', h+topPad+botPad);
    // Wird das SVG per CSS (max-width) schmaler angezeigt als seine Breite
    // (Handy), darf die Höhe mitschrumpfen und der Inhalt oben anliegen –
    // sonst wird er vertikal zentriert und es entsteht oben Leerraum.
    svgEl.setAttribute('preserveAspectRatio', 'xMinYMin meet');
    svgEl.style.height = 'auto';
    return topPad;
  } catch(e) { return pad * 2.5; }
}

// Grössen pro Abschnitt: sec.sz = { staff, ann, lyric, drop, hspace, vspace, neume } (Werte der Regler).
const GREG_SZ_IDS = [['gs-staff', 'staff', 20], ['gs-ann', 'ann', 15], ['gs-lyric', 'lyric', 18], ['gs-drop', 'drop', 85], ['gs-hspace', 'hspace', 1], ['gs-vspace', 'vspace', 1], ['gs-neume', 'neume', 1.3]];
function gregSzRead() {
  const o = {};
  GREG_SZ_IDS.forEach(([id, k, def]) => { const el = document.getElementById(id); const v = el ? parseFloat(el.value) : def; o[k] = isFinite(v) ? v : def; });
  return o;
}
function gregSzWrite(o) {
  if (!o) return;
  GREG_SZ_IDS.forEach(([id, k]) => { const el = document.getElementById(id); if (el && isFinite(o[k])) el.value = o[k]; });
  const upd = (slId, valId, suffix, dec) => { const sl = document.getElementById(slId), vl = document.getElementById(valId); if (sl && vl) vl.textContent = parseFloat(sl.value).toFixed(dec) + suffix; };
  upd('gs-staff', 'gs-staff-v', 'pt', 1); upd('gs-ann', 'gs-ann-v', 'pt', 1); upd('gs-lyric', 'gs-lyric-v', 'pt', 1); upd('gs-drop', 'gs-drop-v', 'pt', 1);
  upd('gs-hspace', 'gs-hspace-v', '×', 2); upd('gs-vspace', 'gs-vspace-v', '×', 2); upd('gs-neume', 'gs-neume-v', '×', 2);
  _exsurgeCtxt = null;
}
function gregGetSizing(sec) {
  const src = (sec && sec.sz) || null;
  const v = (id, def) => { if (src) { const k = (GREG_SZ_IDS.find(x => x[0] === id) || [])[1]; return (k && isFinite(src[k])) ? +src[k] : def; } const el=document.getElementById(id); return el ? parseFloat(el.value) : def; };
  const staffPt = v('gs-staff', 20);
  return {
    staffScale:  1.0,                   // always 1.0 — glyphScaling stays constant
    staffPt:     staffPt,
    zoom:        staffPt / 20,          // CSS zoom factor: 20pt = reference (zoom=1)
    annSize:     v('gs-ann',   15),
    lyricSize:   v('gs-lyric', 18),
    dropSize:    v('gs-drop',  85),
    hSpace:      v('gs-hspace', 1.0),
    vSpace:      v('gs-vspace', 1.0),
    neumeScale:  v('gs-neume', 1.3),
    secGap:      (function() { const el = document.getElementById('gs-secgap'); return el ? parseFloat(el.value) : 16; })(),
  };
}

function gregToggleKopf() {
  const p = document.getElementById('greg-kopf-panel');
  if (!p) return;
  const open = p.style.display === 'none';
  p.style.display = open ? 'flex' : 'none';
  const hdr = document.getElementById('greg-kopf-hdr');
  if (hdr) hdr.innerHTML = '&#9998; Kopf-Bereich ' + (open ? '▾' : '▸');
}

function gregToggleSizing() {
  const p = document.getElementById('greg-sizing-panel');
  if (!p) return;
  const open = p.style.display === 'none' || p.style.display === '';
  p.style.display = open ? 'grid' : 'none';
  const hdr = document.querySelector('[data-onclick="gregToggleSizing()"]');
  if (hdr) hdr.textContent = (open ? '▾ ' : '▸ ') + 'Schriftgrössen & Abstände';
}

function gregToggleNeumes() {
  const grid = document.getElementById('greg-neume-grid');
  const hint = document.getElementById('greg-neume-hint');
  const hdr  = document.getElementById('greg-neume-hdr');
  if (!grid) return;
  const open = grid.style.display === 'none';
  grid.style.display = open ? 'flex' : 'none';
  if (hint) hint.style.display = open ? '' : 'none';
  if (hdr)  hdr.textContent = (open ? '▾' : '▸') + ' Neumen';
}

function gregApplySizing() {
  // Update labels
  const upd = (slId, valId, suffix, dec) => {
    const sl = document.getElementById(slId), vl = document.getElementById(valId);
    if (sl && vl) vl.textContent = parseFloat(sl.value).toFixed(dec !== undefined ? dec : (parseFloat(sl.step) < 1 ? 1 : 0)) + suffix;
  };
  upd('gs-staff',  'gs-staff-v',  'pt', 1);
  upd('gs-ann',    'gs-ann-v',    'pt', 1);
  upd('gs-lyric',  'gs-lyric-v',  'pt', 1);
  upd('gs-drop',   'gs-drop-v',   'pt', 1);
  upd('gs-hspace', 'gs-hspace-v', '×',  2);
  upd('gs-vspace', 'gs-vspace-v', '×',  2);
  upd('gs-neume',  'gs-neume-v',  '×',  2);
  upd('gs-secgap', 'gs-secgap-v', 'px', 0);
  // Reset context so new values are picked up
  _exsurgeCtxt = null;
  clearTimeout(window._gregSzT);
  window._gregSzT = setTimeout(gregRender, 200);
}

function gregApplySizingLinked() {
  // When staff size changes, proportionally update ann/lyric/drop
  // Ratios derived from defaults (at 20pt staff size): ann=15/20=0.75, lyric=18/20=0.9, drop=85/20=4.25
  const staffEl = document.getElementById('gs-staff');
  if (!staffEl) return;
  const staffPt = parseFloat(staffEl.value);
  const setSlider = (id, val, min, max) => {
    const el = document.getElementById(id);
    if (el) el.value = Math.min(max, Math.max(min, val));
  };
  setSlider('gs-ann',   staffPt * 0.75,   4,  30);
  setSlider('gs-lyric', staffPt * 0.9,    6,  40);
  setSlider('gs-drop',  staffPt * 4.25,  20, 150);
  gregApplySizing();
}

// Builds a brand-new, fully independent ChantContext from the current
// sizing settings. Factored out of getExsurgeCtxt() so that other call
// sites needing their OWN private ctxt instance (see gregRenderSectionPreview)
// don't have to share the cached singleton.
function gregBuildExsurgeCtxtFromSizing(sz) {
  if (typeof exsurge === 'undefined' || !exsurge.ChantContext) return null;
  const ctxt = new exsurge.ChantContext();
  const font = "'Crimson Text', 'Palatino Linotype', Georgia, serif";
  ctxt.lyricTextFont      = font;
  ctxt.dropCapTextFont    = font;
  ctxt.annotationTextFont = font;
  ctxt.autoColor          = false;
  ctxt.glyphScaling       = (1/16) * sz.staffScale * (sz.neumeScale || 1);
  ctxt.staffInterval      = ctxt.glyphPunctumWidth * ctxt.glyphScaling;
  ctxt.staffLineWeight    = Math.max(1, Math.round(ctxt.staffInterval / 8));
  ctxt.neumeLineWeight    = ctxt.staffLineWeight;
  const zoom = sz.zoom || 1;
  ctxt.lyricTextSize      = sz.lyricSize  / zoom;
  ctxt.dropCapTextSize    = sz.dropSize   / zoom;
  ctxt.annotationTextSize = sz.annSize    / zoom;
  ctxt.intraNeumeSpacing  = ctxt.staffInterval / 2 * sz.hSpace;
  ctxt.interSyllableSpacing = (ctxt.staffInterval * 2) * sz.hSpace;
  ctxt._vSpaceScale = sz.vSpace;
  ctxt._zoom = zoom;
  return ctxt;
}

function getExsurgeCtxt() {
  if (_exsurgeCtxt) return _exsurgeCtxt;
  if (typeof exsurge === 'undefined' || !exsurge.ChantContext) {
    gst('Fehler: exsurge.js nicht geladen — Seite neu laden');
    return null;
  }
  try {
    const sz = gregGetSizing();
    _exsurgeCtxt = gregBuildExsurgeCtxtFromSizing(sz);
    return _exsurgeCtxt;
  } catch (e) {
    gst('exsurge-Init-Fehler: ' + e.message);
    console.error('exsurge init failed:', e);
    return null;
  }
}

function gst(t) { const e=document.getElementById('gabc-status'); if(e) e.textContent=t; }

