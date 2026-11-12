// ── Desktop-Seitenansicht ("Papier") ──
// Choral: logische Blattbreite (bei 100 % Anzeigegrösse) inkl. 20 px Rand je Seite.
// 812 px ergibt eine Zeilenbreite von ca. 746 px = A4-Druckbreite des PDFs (1:1).
// null = Standard A4. Gespeichert je Stück (pageW); geräteunabhängig.
const GREG_PAPER_A4 = 812, CL_PAPER_A4 = 740, NT_PAPER_MIN = 420, NT_PAPER_MAX = 1700;
function ntPaperOn() { return !(typeof gregIsMobileViewport === 'function' && gregIsMobileViewport()); }
function gregPaperW() { return window._gregPageW || GREG_PAPER_A4; }
function gregPaperApply() {
  const on = ntPaperOn();
  document.body.classList.toggle('nt-paper', on);
  if (!on) return;
  const vs = gregVS(), st = document.documentElement.style;
  const w = Math.round(gregPaperW() * vs) + 'px', pad = Math.round(20 * vs) + 'px';
  if (st.getPropertyValue('--greg-paper-w') !== w) st.setProperty('--greg-paper-w', w);
  if (st.getPropertyValue('--greg-paper-pad') !== pad) st.setProperty('--greg-paper-pad', pad);
  const paper = document.getElementById('greg-mobile-scale-outer');
  if (paper) ntPaperHandles(paper, {
    getW: () => gregPaperW(), vs: () => gregVS(), a4: GREG_PAPER_A4,
    live: w2 => st.setProperty('--greg-paper-w', Math.round(w2 * gregVS()) + 'px'),
    commit: w2 => { window._gregPageW = Math.abs(w2 - GREG_PAPER_A4) < 4 ? null : w2; gregRender(); },
    reset: () => { window._gregPageW = null; gregRender(); gregGst('Seitenbreite: A4'); }
  });
}
// Ziehgriffe links/rechts am Blatt: Blatt ist mittig -> Breite ändert sich um 2 × Mausweg
function ntPaperHandles(paper, o) {
  paper._ntPaper = o;
  if (paper.querySelector(':scope > .nt-paper-h')) return;
  const lab = document.createElement('div'); lab.className = 'nt-paper-lab';
  ['l', 'r'].forEach(side => {
    const h = document.createElement('div'); h.className = 'nt-paper-h ' + side;
    h.title = 'Seitenbreite: ziehen zum Verbreitern/Verschmälern · Doppelklick = A4';
    h.addEventListener('dblclick', e => { e.preventDefault(); e.stopPropagation(); paper._ntPaper.reset(); });
    h.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      const P = paper._ntPaper, x0 = e.clientX, w0 = P.getW(), vs = P.vs() || 1;
      let w = w0;
      h.classList.add('on'); h.setPointerCapture(e.pointerId);
      const show = () => { lab.textContent = 'Breite ' + Math.round(w) + ' px' + (Math.abs(w - P.a4) < 4 ? ' · A4' : (w > P.a4 ? ' · breiter als A4 (kleiner im PDF)' : ' · schmaler als A4 (grösser im PDF)')); };
      show();
      const mv = ev => {
        const dx = (ev.clientX - x0) * (side === 'r' ? 1 : -1);
        w = Math.max(NT_PAPER_MIN * P.a4 / GREG_PAPER_A4, Math.min(NT_PAPER_MAX, w0 + 2 * dx / vs));
        if (Math.abs(w - P.a4) < 10) w = P.a4; // bei A4 einrasten
        P.live(w); show();
      };
      const up = () => {
        h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up);
        h.classList.remove('on');
        if (Math.round(w) !== Math.round(w0)) P.commit(Math.round(w));
      };
      h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
    });
    paper.appendChild(h);
  });
  paper.appendChild(lab);
}
window.addEventListener('resize', () => { try { gregPaperApply(); } catch (e) {} });

function gregEffectiveCanvasWidth() {
  if (window._gregForcedCanvasWidth) return window._gregForcedCanvasWidth;
  // Seitenansicht: Blattbreite; Korrektur, damit der Zeilenumbruch nicht von der Anzeigegrösse abhängt
  // (Zeilenbreite = (Breite - 80) / (Zoom × Anzeigegrösse) wie bisher bei 100 %)
  if (ntPaperOn()) {
    const p = document.getElementById('greg-mobile-scale-outer');
    if (p && p.clientWidth) return p.clientWidth + 80 * (1 - gregVS());
  }
  const el = document.getElementById('greg-canvas-wrap');
  return el ? el.clientWidth : null;
}

function gregRenderGABCInto(gabc, wrap, cb) {
  if (!wrap) return;
  const renderToken = (wrap._renderToken = (wrap._renderToken || 0) + 1);
  const ctxt = getExsurgeCtxt();
  if (!ctxt) return;
  _gregCtxtRef = ctxt;

  let body = gabc, annText = null, useDropCap = false;
  if (gabc.includes('%%')) {
    const si = gabc.indexOf('%%');
    const hl = gabc.substring(0, si).trim().split('\n');
    body = gabc.substring(si+2).trim();
    const annLines = [];
    for (const l of hl) {
      const m = l.match(/^([^:]+):\s*(.*)$/);
      if (!m) continue;
      const k = m[1].trim().toLowerCase(), v = m[2].trim().replace(/;$/,'');
      if (k==='annotation') annLines.push(v);
      if (k==='drop-cap' && v==='auto') useDropCap = true;
    }
    annText = annLines.join('\n');
    // Only consult the shared checkbox in single-section (classic) mode —
    // in multi-section mode it's stale global UI state left over from
    // whichever section was imported/edited last, not this section's own
    // intent (Runde 60 fix: this leaked a hymn's drop cap onto its
    // versicle every time, even though the versicle's own GABC header
    // was already correctly written without one).
    if (!useDropCap && !window._gregMultiSection && (document.getElementById('greg-dropcap')||{}).checked) useDropCap = true;
  }
  if (!body || body === '(' + gregClefVal + ')') body = '(' + gregClefVal + ') (::)';

  try {
    const mappings = exsurge.Gabc.createMappingsFromSource(ctxt, body);
    const score = new exsurge.ChantScore(ctxt, mappings, useDropCap);
    score.initialLines = gregInitialLinesOf(gabc);
    const annArr = annText ? annText.split('\n').filter(Boolean) : [];
    if (annArr.length > 0) {
      score.annotation = new exsurge.Annotation(ctxt, annArr[annArr.length - 1]);
      score._extraAnnotations = annArr.slice(0, -1);
    }
    const zoom = (ctxt._zoom || 1) * gregVS();
    // In multi-section mode the active section's svg-wrap is nested inside
    // its own section box (with its own padding), NOT a direct child of
    // greg-canvas-wrap — using greg-canvas-wrap's full width here computed
    // a layout wider than what's actually visually available in the box,
    // so line-wrap decisions didn't match what the box's own border ends
    // up constraining it to. Match gregRenderSectionPreview's own width
    // formula (container.clientWidth - 20) for consistency. A forced/saved
    // canvas width (see gregEffectiveCanvasWidth) takes priority over live
    // measurements in both branches, for reproducible re-opened layouts.
    const canvasW = gregEffectiveCanvasWidth();
    let width;
    if (window._gregMultiSection && gregSections && gregSections[gregActiveIdx]) {
      const secBox = document.getElementById('greg-secbox-' + gregSections[gregActiveIdx].id);
      const secContent = secBox ? secBox.querySelector('.greg-sec-content') : null;
      width = window._gregForcedCanvasWidth ? gregLayoutWidth(canvasW, zoom)
            : secContent ? gregLayoutWidth(secContent.clientWidth, zoom)
                          : Math.max(canvasW ? (canvasW - 80) / zoom : 700, 400);
    } else {
      width = Math.max(canvasW ? (canvasW - 80) / zoom : 700, gregIsMobileViewport() ? 140 : 400);
    }
    score.performLayoutAsync(ctxt, function() {
      score.layoutChantLines(ctxt, width, function() {
        if (wrap._renderToken !== renderToken) return; // superseded by a newer render
        _gregScore = score;
        const svg = score.createSvg(ctxt);
        wrap.innerHTML = svg;
        const svgEl = wrap.querySelector('svg');
        if (svgEl) {
          gregNeutralizeRubricRed(svgEl);
          const zoom = (ctxt._zoom || 1) * gregVS();
          const nativeW = parseFloat(svgEl.getAttribute('width')) || width;
          // First apply padding and title at native scale
          svgEl.style.cssText = 'background:transparent;display:block;cursor:crosshair;';
          const _ext = window._gregMultiSection ? gregSecTitleExtra(gregActiveIdx, (document.getElementById('greg-title') || {}).value, (document.getElementById('greg-subtitle') || {}).value) : 0;
          const neededPad = gregCalcTitlePad(nativeW, undefined, undefined, undefined, _ext);
          const _topPad = addSvgPadding(svgEl, 32, neededPad, window._gregMultiSection ? gregSecGap() : 32);
          svgEl._topPad = _topPad; svgEl._titleShift = _ext;
          gregRenderTitle(svgEl);
          if (score._extraAnnotations && score._extraAnnotations.length) gregRenderExtraAnnotations(svgEl, score._extraAnnotations);
          // Apply zoom: scale SVG via width/height attrs (viewBox keeps coordinate space)
          if (zoom !== 1) {
            const finalW = parseFloat(svgEl.getAttribute('width')) || nativeW;
            const finalH = parseFloat(svgEl.getAttribute('height')) || 200;
            const vb = svgEl.getAttribute('viewBox') || ('0 0 '+finalW+' '+finalH);
            svgEl.setAttribute('viewBox', vb);
            svgEl.setAttribute('width',  String(Math.round(finalW * zoom)));
            svgEl.setAttribute('height', String(Math.round(finalH * zoom)));
          }
          svgEl.style.cssText = 'background:transparent;display:block;cursor:crosshair;max-width:100%;height:auto;';
        }
        if (cb) cb(svgEl, score);
      });
    });
  } catch(err) { gregGst('Fehler: '+err.message); console.error(err); }
}

function gregUpdateEpisemaUI() {
  const epCb = document.getElementById('greg-episema');
  const epPos = document.getElementById('greg-episema-pos');
  if (!epCb || !epPos) return;
  const multiNoteNeumes = ['torculus','porrectus','scandicus','climacus','torculus_resupinus','porrectus_flexus','scandicus_flexus'];
  const neuSel = document.getElementById('greg-neume-sel');
  const curNeume = neuSel ? neuSel.value : '';
  epPos.style.display = (epCb.checked && multiNoteNeumes.includes(curNeume)) ? 'inline-block' : 'none';
}

// Shows/hides the "auf Note N" position dropdown for the top-toolbar
// Quilisma checkbox, depending on whether it's checked and the currently
// selected neume type can actually carry a quilisma (see
// QUILISMA_APPLICABLE). Called on checkbox change AND whenever the neume
// selection changes (see gregBuildNeumeGrid's button onclick).
function gregUpdateQuilismaUI() {
  const cb = document.getElementById('greg-quilisma');
  const w = document.getElementById('greg-quilisma-pos-w');
  if (!cb || !w) return;
  const curNeume = (document.getElementById('greg-neume-sel')||{value:''}).value;
  w.style.display = (cb.checked && QUILISMA_APPLICABLE.includes(curNeume)) ? 'inline-flex' : 'none';
}

// Enables/disables the 4 top-toolbar Mora checkboxes (N1..N4) depending on
// how many notes the currently selected neume type has (NEUME_PITCHES) --
// e.g. a 2-note Podatus only offers N1/N2, N3/N4 are disabled+unchecked so
// a stale checked box from a previously selected longer neume can't leak
// a mora onto a nonexistent note. Called on neume-selection change (see
// gregBuildNeumeGrid) AND once on initial page load.
function gregUpdateMoraUI() {
  setTimeout(() => { if (typeof gregQuickbarSync === 'function') gregQuickbarSync(); }, 0);
  const curNeume = (document.getElementById('greg-neume-sel')||{value:'punctum'}).value;
  const nPitch = NEUME_PITCHES[curNeume] || 1;
  [1,2,3,4].forEach(p => {
    const cb = document.getElementById('greg-mora-n'+p);
    if (!cb) return;
    const enabled = p <= nPitch;
    cb.disabled = !enabled;
    if (!enabled) cb.checked = false;
    cb.closest('label').style.opacity = enabled ? '1' : '0.35';
  });
}

// Shows/hides the "oben/unten" position dropdown for the top-toolbar
// Iktus checkbox. Unlike Quilisma, Iktus can sit on any neume type
// (including single notes), so no neume-type gating is needed here.
function gregUpdateIktusUI() {
  const cb = document.getElementById('greg-iktus');
  const w = document.getElementById('greg-iktus-pos-w');
  if (!cb || !w) return;
  w.style.display = cb.checked ? 'inline-flex' : 'none';
}

function gregUpdateStatus() {
  const finishBtn = document.getElementById('greg-finish-open-neume');
  if (_gregPending) {
    const rem = _gregPending._need - _gregPending.pitches.length;
    const openEnded = NEUME_OPEN_ENDED.includes(_gregPending.neume);
    const canFinish = openEnded && rem <= 0;
    if (canFinish) {
      gregGst('Neume ' + _gregPending.neume + ': ' + _gregPending.pitches.join('-') + ' bisher — weiter klicken für mehr Noten, oder [Enter]/"Fertig" zum Abschliessen');
    } else {
      gregGst('Neume ' + _gregPending.neume + ': noch ' + rem + ' Ton/Töne klicken (' + _gregPending.pitches.join('-') + ' bisher)');
    }
    if (finishBtn) finishBtn.style.display = canFinish ? 'inline-block' : 'none';
  } else {
    gregGst(gregEntries.length ? gregEntries.length + ' Einträge — Neume/Silbe wählen, klicken' : 'Neume wählen, Silbe eingeben, dann auf Notenlinie klicken');
    if (finishBtn) finishBtn.style.display = 'none';
  }
}

// Default note-shape casing per GABC/Gregorio convention ("a capitalized
// pitch letter represents a punctum inclinatum"): applied automatically at
// creation time so newly-drawn neumes look right out of the box, but the
// letter case is then just plain data the user can freely override
// afterwards in the entry's "Töne" field — buildSingleNeumeGABC's legacy
// path always emits pitches verbatim, it no longer forces case per neume
// type itself.
function gregDefaultNoteCase(neume, idx, letter) {
  if (neume === 'puncta_inclinata') return letter.toUpperCase(); // all 3 notes
  if (neume === 'pes_subpunctis' && idx >= 2) return letter.toUpperCase(); // the 2 subpunctis notes (after the podatus)
  if (neume === 'climacus' && idx >= 1) return letter.toUpperCase(); // all notes after the initial virga
  return letter;
}

