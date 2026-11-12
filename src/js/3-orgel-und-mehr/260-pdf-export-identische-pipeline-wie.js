// ── PDF-Export: identische Pipeline wie beim Choral (gregAssemblePdf) ──
function clExportPDF() {
  const {jsPDF} = window.jspdf || {};
  if (!jsPDF) {
    gregGst('jsPDF lädt…');
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', function() { clExportPDF(); });
    return;
  }
  // Auf schmalen Bildschirmen (Handy) mit automatischer Breite würde das
  // PDF die Bildschirmbreite übernehmen (riesige Noten, viele Seiten).
  // Dann für den Export einmalig in Standard-Druckbreite neu setzen.
  // Ebenso bei verkleinerter/vergrösserter Anzeige: PDF immer in Originalgrösse.
  // Handy-Standardbreite (950): PDF in derselben Breite wie am Bildschirm (Nutzerwunsch 2026-10-26).
  const mobDef = clMobileDefaultW();
  // Ebenso, wenn «An Seitenbreite anpassen» die gespeicherte Breite am Bildschirm übersteuert.
  if (!clExportPDF._printPass && (mobDef || ntViewScale('cl') !== 1 || (!clState.width && clScoreWidth() < 700) || (clState.width && clScoreWidth() !== clState.width))) {
    const oldW = clState.width;
    // PDF-Breite = die am Bildschirm tatsächlich verwendete Zeilenbreite (gleiche Zeilenumbrüche
    // und Notengrösse wie in Notator); nur bei automatischer, sehr schmaler Breite Standard 740.
    const shownW = clScoreWidth();
    if (mobDef) clState.width = mobDef;
    else if (clState.width && shownW !== clState.width) clState.width = Math.round(shownW);
    else if (!clState.width && shownW < 700) clState.width = 740;
    // Anzeige einfrieren: Druckdurchgang ausserhalb des sichtbaren Bereichs rendern,
    // solange zeigt eine Kopie das bisherige Notenbild (kein kurzes Vergrössern)
    const sc = document.getElementById('cl-score');
    let frz = null;
    if (sc && sc.parentNode) {
      const cs = getComputedStyle(sc);
      frz = sc.cloneNode(true); frz.removeAttribute('id');
      frz.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
      ['width', 'background', 'padding', 'margin', 'minHeight', 'boxShadow', 'color'].forEach(k => { frz.style[k] = cs[k]; });
      frz.style.pointerEvents = 'none';
      sc.parentNode.insertBefore(frz, sc.nextSibling);
      sc.style.position = 'absolute'; sc.style.left = '-30000px'; sc.style.top = '0';
    }
    const unfreeze = () => { if (sc) { sc.style.position = sc.style.left = sc.style.top = ''; } if (frz) frz.remove(); };
    clExportPDF._printPass = true; ntViewScale._override = true;
    clRender();
    try { clExportPDF(); } finally { clExportPDF._printPass = false; ntViewScale._override = false; clState.width = oldW; setTimeout(() => { try { clRender(); } finally { unfreeze(); } }, 50); }
    return;
  }
  const printTexts = !!(document.getElementById('cl-pdf-print-texts') || {}).checked;
  const tunesEls = Array.from(document.querySelectorAll('#cl-score .cl-tune'));
  const pairs = [];
  tunesEls.forEach((d, ti) => {
    const svg = d.querySelector('svg');
    if (!svg) return;
    // Zeilen-Zonen (Notensystem + Text) -> Seitenumbruch nie mittendurch
    const zones = {};
    svg.querySelectorAll('[class*="abcjs-l"]').forEach(n => {
      const m = String(n.getAttribute('class') || '').match(/abcjs-l(\d+)/);
      if (!m) return;
      try {
        const bb = n.getBBox();
        if (!bb.height && !bb.width) return;
        const z = zones[m[1]] || (zones[m[1]] = { top: Infinity, bottom: -Infinity });
        z.top = Math.min(z.top, bb.y); z.bottom = Math.max(z.bottom, bb.y + bb.height);
      } catch (e) {}
    });
    const vy0 = (svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.y) || 0;
    const zKeys = Object.keys(zones).filter(k => isFinite(zones[k].top));
    const lineBoxes = zKeys.map(k => zones[k]);
    let brkIdx = (d._pbLineNums || []).map(n => zKeys.indexOf(String(n))).filter(i => i >= 0).sort((a, b) => a - b);
    const secPb = !!(window._gregMultiSection && gregSections.length > 1 && gregSections[ti] && gregSections[ti].pb);
    const startNew = ti > 0 && (secPb || brkIdx.indexOf(0) >= 0);
    brkIdx = brkIdx.filter(i => i > 0);
    if (printTexts) svg.querySelectorAll('text.cl-text').forEach(t => { try { const bb = t.getBBox(); lineBoxes.push({ top: bb.y, bottom: bb.y + bb.height }); } catch (e) {} });
    lineBoxes.forEach(z => { z.top -= vy0; z.bottom -= vy0; });
    const clone = svg.cloneNode(true);
    clone.querySelectorAll('text.cl-text').forEach(t => { if (!printTexts) t.remove(); else { t.setAttribute('fill', '#000'); t.querySelectorAll('title').forEach(x => x.remove()); } });
    const vb = svg.viewBox && svg.viewBox.baseVal;
    const w = parseFloat(svg.getAttribute('width')) || (vb && vb.width) || svg.getBoundingClientRect().width;
    const h = parseFloat(svg.getAttribute('height')) || (vb && vb.height) || svg.getBoundingClientRect().height;
    clone.setAttribute('width', w); clone.setAttribute('height', h);
    // weisser Hintergrund über die komplette viewBox (inkl. versetztem Ursprung)
    const bgr = document.createElementNS(CL_SVGNS, 'rect');
    bgr.setAttribute('x', (vb && vb.x) || 0); bgr.setAttribute('y', (vb && vb.y) || 0);
    bgr.setAttribute('width', w); bgr.setAttribute('height', h);
    bgr.setAttribute('fill', '#ffffff'); bgr.setAttribute('stroke', 'none');
    clone.insertBefore(bgr, clone.firstChild);
    clone.setAttribute('color', '#000000'); clone.setAttribute('style', 'color:#000;background:#fff');
    clone.setAttribute('xmlns', CL_SVGNS);
    pairs.push({ svg: new XMLSerializer().serializeToString(clone), lineBoxes, pageBreakBefore: startNew, breakLines: brkIdx });
  });
  if (!pairs.length) { gregGst('PDF: keine Noten vorhanden'); return; }
  gregGst('PDF wird erstellt…');
  gregAssemblePdf(pairs, clFileBase() + '_Orgel.pdf');
}

let _clResizeTimer = null;
window.addEventListener('resize', () => {
  const p = document.getElementById('classic-panel');
  if (!p || p.style.display === 'none' || clState.width) return;
  clearTimeout(_clResizeTimer);
  _clResizeTimer = setTimeout(clRender, 250);
});

function switchTab(tab) {
  if (tab === 'gabc') tab = 'greg'; // eigener GABC-Tab entfällt (GABC-Feld steht im Choral)
  window._ntTab = tab;
  if (typeof ntPlayStop === 'function') ntPlayStop();
  if (typeof gregBlockSync === 'function') setTimeout(gregBlockSync, 0);
  const clp=document.getElementById('classic-panel');
  if(clp) clp.style.display='none';
  const grp=document.getElementById('greg-panel');
  const be=document.getElementById('tab-editor');
  const bgr=document.getElementById('tab-greg');
  if(grp) grp.style.display='none';
  [be,bgr].forEach(x => { if (x) { x.classList.remove('nt-tab-on'); x.style.background=''; x.style.color=''; } });
  if(tab==='greg'){
    if(grp) grp.style.cssText='display:flex;flex:1;overflow:hidden;flex-direction:column';
    if(bgr) bgr.classList.add('nt-tab-on');
    setTimeout(gregRender, 150);
  } else {
    // Klassische Orgel-Fassung (abcjs-Notensatz)
    if(clp) clp.style.cssText='display:flex;flex:1;overflow:hidden;flex-direction:column;background:#1a2414';
    be.classList.add('nt-tab-on');
    clOpen();
  }
}

