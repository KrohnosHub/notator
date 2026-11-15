// ── MULTI-SECTION SYSTEM ─────────────────────────────────────
// ══════════════════════════════════════════════════════════════
// Design: the ACTIVE section always renders into the normal #greg-svg-wrap
// (full interactivity: click-to-add-note, GABC output, comments).
// All OTHER sections render as static preview SVGs above/below it.
// gregEntries / greg-title / etc. ALWAYS reflect the active section's data
// directly — no temporary swapping of UI fields.

let gregSections = [];      // array of section state objects
let gregActiveIdx = 0;      // index of active section

function gregMakeSection(id) {
  return {
    id: id || ('s' + Date.now() + Math.floor(Math.random()*1000)),
    entries: [],
    title: '', subtitle: '', annotation: '', commentary: '', hdrExtra: '', clefRaw: '',
    dropCap: false, dropCapLetter: '', // safer default (Runde 61) — a freshly added, not-yet-imported section shouldn't assume it wants a drop cap; the actual value is set correctly on import either way
    clef: 'do',
  };
}

// Capture current UI/editor state INTO gregSections[gregActiveIdx]
function gregSectionFromUI() {
  if (!window._gregMultiSection) return;
  const s = gregSections[gregActiveIdx];
  if (!s) return;
  s.entries       = gregEntries;
  s.title         = (document.getElementById('greg-title')||{value:''}).value;
  s.subtitle      = (document.getElementById('greg-subtitle')||{value:''}).value;
  s.annotation    = (document.getElementById('greg-annotation')||{value:''}).value;
  s.dropCap       = (document.getElementById('greg-dropcap')||{checked:true}).checked;
  s.dropCapLetter = (document.getElementById('greg-dropcap-letter')||{value:''}).value;
  s.clef          = Object.keys(GREG_CLEF_MAP).find(k => GREG_CLEF_MAP[k] === gregClefVal) || 'do';
  s.commentary    = (document.getElementById('greg-commentary')||{value:''}).value;
  s.initialLines  = (document.getElementById('greg-dropcap2')||{}).checked ? 2 : 1;
  s.hdrExtra      = gregHdrExtra;
  s.clefRaw       = gregClefRaw;
  s.sz            = gregSzRead();
}

// Load gregSections[idx] INTO the UI/editor state (becomes the live/active data)
function gregLoadSectionToUI(idx) {
  const s = gregSections[idx];
  if (!s) return;
  gregEntries = s.entries;
  const set = (id, v) => { const el=document.getElementById(id); if(el) el.value=v||''; };
  set('greg-title',         s.title);
  set('greg-subtitle',      s.subtitle);
  set('greg-annotation',    s.annotation);
  set('greg-dropcap-letter',s.dropCapLetter);
  const dcEl = document.getElementById('greg-dropcap');
  if (dcEl) dcEl.checked = s.dropCap !== false;
  set('greg-commentary',    s.commentary);
  { const d2 = document.getElementById('greg-dropcap2'); if (d2) d2.checked = s.initialLines === 2; }
  gregHdrExtra = s.hdrExtra || '';
  if (s.sz) gregSzWrite(s.sz); else s.sz = gregSzRead();
  gregSetClef(s.clef || 'do', true); // silent: no render here — caller renders once, after this returns
  gregClefRaw = s.clefRaw || ''; gregClefUi();
  gregRefreshListNoRender();
}

function gregSetActiveSection(idx) {
  if (idx === gregActiveIdx) return;
  clearTimeout(window._gregAT); clearTimeout(window._gregTT);
  clearTimeout(window._gregST); clearTimeout(window._gregRT);
  clearTimeout(window._gregSzT);
  gregSectionFromUI();      // save what we're leaving
  // The edit-highlight state (_gregEditingEntryIdx) is per-section — an
  // index that happened to be open in the OLD section's gregEntries is
  // meaningless in the NEW section's, but without clearing it here,
  // gregRenderActiveOnly's post-render call to gregHighlightEditingEntry()
  // would still apply it, lighting up whatever entry happens to sit at
  // that same index in the new section (if it's also a note entry) — even
  // though nothing is actually being edited there.
  gregCloseEditForm();
  gregActiveIdx = idx;
  gregLoadSectionToUI(idx); // load what we're entering (pure state, no render)
  gregRenderAllSections();  // exactly one render for the new state
}

function gregAddSection() {
  clearTimeout(window._gregAT); clearTimeout(window._gregTT);
  clearTimeout(window._gregST); clearTimeout(window._gregRT);
  clearTimeout(window._gregSzT);
  gregCloseEditForm(); // see gregSetActiveSection: editing state is per-section
  if (!window._gregMultiSection) {
    // First time: migrate current single-section content into Section 1
    const first = gregMakeSection();
    first.entries       = gregEntries;
    first.title         = (document.getElementById('greg-title')||{value:''}).value;
    first.subtitle      = (document.getElementById('greg-subtitle')||{value:''}).value;
    first.annotation    = (document.getElementById('greg-annotation')||{value:''}).value;
    first.dropCap       = (document.getElementById('greg-dropcap')||{checked:true}).checked;
    first.dropCapLetter = (document.getElementById('greg-dropcap-letter')||{value:''}).value;
    first.clef          = Object.keys(GREG_CLEF_MAP).find(k => GREG_CLEF_MAP[k] === gregClefVal) || 'do';
    first.commentary    = (document.getElementById('greg-commentary')||{value:''}).value;
    first.initialLines  = (document.getElementById('greg-dropcap2')||{}).checked ? 2 : 1;
    first.hdrExtra      = gregHdrExtra;
    first.clefRaw       = gregClefRaw;
    first.sz            = gregSzRead();
    gregSections = [first];
    gregActiveIdx = 0;
    gregEnableMultiSection(); // sets display toggles AND window._gregMultiSection
  } else {
    gregSectionFromUI();
  }
  const newSec = gregMakeSection();
  newSec.sz = gregSzRead();   // neuer Abschnitt startet mit der Grösse des bisherigen
  gregSections.push(newSec);
  gregActiveIdx = gregSections.length - 1;
  gregLoadSectionToUI(gregActiveIdx);
  gregRenderAllSections();
  gregGst('Abschnitt ' + gregSections.length + ' erstellt');
}

function gregCloseSection(idx) {
  if (!window._gregMultiSection || gregSections.length <= 1) return;
  if (!confirm('Abschnitt ' + (idx+1) + ' wirklich löschen?')) return;
  clearTimeout(window._gregAT); clearTimeout(window._gregTT);
  clearTimeout(window._gregST); clearTimeout(window._gregRT);
  clearTimeout(window._gregSzT);
  gregCloseEditForm(); // see gregSetActiveSection: editing state is per-section
  gregSections.splice(idx, 1);
  const realSvgWrap = document.getElementById('greg-svg-wrap');
  if (gregSections.length === 1) {
    // Back to single-section mode
    gregLoadSectionToUI(0);
    window._gregMultiSection = false;
    gregActiveIdx = 0;
    // Move the real svg-wrap BACK to its original parent slot before wiping the
    // sections container — never destroy it via innerHTML='' while it lives inside.
    const secContainer = document.getElementById('greg-sections-container');
    const originalSlot = document.getElementById('greg-svg-original-slot');
    if (originalSlot && realSvgWrap && realSvgWrap.parentElement !== originalSlot) {
      originalSlot.appendChild(realSvgWrap);
    }
    if (originalSlot) originalSlot.style.display = '';
    if (secContainer) { secContainer.style.display = 'none'; secContainer.innerHTML = ''; }
    if (realSvgWrap) realSvgWrap.style.display = 'block';
    gregRender();
  } else {
    if (gregActiveIdx >= gregSections.length) gregActiveIdx = gregSections.length - 1;
    else if (idx < gregActiveIdx) gregActiveIdx--;
    gregLoadSectionToUI(gregActiveIdx);
    // Detach the real svg-wrap before wiping stale section boxes, then let
    // gregRenderAllSections re-attach it to the correct (new) active box.
    // NICHT aus dem Dokument lösen (sonst findet gregRenderAllSections #greg-svg-wrap nicht mehr
    // und bricht ab -> leeres weisses Notenblatt, Nutzerbericht 2026-11-04): zurück in den
    // (ausgeblendeten) Originalplatz, gregRenderAllSections hängt ihn in den aktiven Abschnitt.
    { const slot = document.getElementById('greg-svg-original-slot'); if (realSvgWrap && slot && realSvgWrap.parentElement !== slot) slot.appendChild(realSvgWrap); }
    const secContainer = document.getElementById('greg-sections-container');
    if (secContainer) secContainer.innerHTML = '';
    gregRenderAllSections();
  }
}

// Zurück in den Ein-Abschnitt-Modus, ohne den aktiven Abschnitt neu zu rendern (Build 292):
// wird gebraucht, wenn ein neues Stück geladen/importiert wird -- sonst blieben die Abschnitte des
// alten Stücks stehen und der Import landete unsichtbar im aktiven Abschnitt. Gibt die bisherigen
// Abschnitte zurück (zum Wiederherstellen), oder null, wenn nur einer vorhanden war.
function gregCollapseSections() {
  if (!window._gregMultiSection && gregSections.length <= 1) { gregSections = []; gregActiveIdx = 0; return null; }
  clearTimeout(window._gregAT); clearTimeout(window._gregTT);
  clearTimeout(window._gregST); clearTimeout(window._gregRT);
  clearTimeout(window._gregSzT);
  gregCloseEditForm();
  let prev = null;
  if (window._gregMultiSection) { try { gregSectionFromUI(); } catch (e) {} prev = { sections: gregSections, idx: gregActiveIdx }; }
  gregSections = []; gregActiveIdx = 0; window._gregMultiSection = false;
  const realSvgWrap = document.getElementById('greg-svg-wrap');
  const secContainer = document.getElementById('greg-sections-container');
  const originalSlot = document.getElementById('greg-svg-original-slot');
  if (originalSlot && realSvgWrap && realSvgWrap.parentElement !== originalSlot) originalSlot.appendChild(realSvgWrap);
  if (originalSlot) originalSlot.style.display = '';
  if (secContainer) { secContainer.style.display = 'none'; secContainer.innerHTML = ''; }
  if (realSvgWrap) realSvgWrap.style.display = 'block';
  return prev;
}
function gregRestoreSections(prev) {
  if (!prev) return;
  gregSections = prev.sections; gregActiveIdx = prev.idx;
  gregLoadSectionToUI(gregActiveIdx);
  const realSvgWrap = document.getElementById('greg-svg-wrap');
  if (realSvgWrap && realSvgWrap.parentElement) realSvgWrap.parentElement.removeChild(realSvgWrap);
  gregEnableMultiSection();
  gregRenderAllSections();
}

// Import (GregoBase / PDF) bei mehreren Abschnitten: leerer aktiver Abschnitt
// -> dort einfügen (Arbeitsweise «+ Abschnitt», dann importieren); sonst
// fragen: neues Stück (alle Abschnitte ersetzen) oder nur diesen Abschnitt.
function gregImportTargetChoice() {
  if (!window._gregMultiSection || gregSections.length <= 1) return Promise.resolve('new');
  if (!gregEntries.some(e => e.type === 'note')) return Promise.resolve('section');
  return new Promise(resolve => {
    showModal('Stück mit ' + gregSections.length + ' Abschnitten',
      'Das offene Stück hat ' + gregSections.length + ' Abschnitte. Wie soll der neue Gesang übernommen werden?\n\n«Neues Stück» ersetzt alle Abschnitte (vorher speichern, falls nötig).', [
      { label: '✚ Neues Stück', fn: () => { closeModal(); resolve('new'); } },
      { label: 'Nur Abschnitt ' + (gregActiveIdx + 1) + ' ersetzen', fn: () => { closeModal(); resolve('section'); } },
      { label: 'Abbrechen', fn: () => { closeModal(); resolve(null); } }
    ]);
  });
}
function gregEnableMultiSection() {
  const svgWrapParent = document.getElementById('greg-svg-wrap').parentElement;
  const secContainer = document.getElementById('greg-sections-container');
  // nur den Original-Platz ausblenden – liegt die Zeichenfläche schon in einer Abschnitts-Box, darf diese nicht versteckt werden
  if (svgWrapParent && svgWrapParent.id === 'greg-svg-original-slot') svgWrapParent.style.display = 'none';
  if (secContainer) secContainer.style.display = 'block';
  window._gregMultiSection = true;
}

// Render ALL sections: active one goes into the real interactive #greg-svg-wrap
// (moved into its slot in the section list), others render as static previews.
function gregRenderAllSections() {
  if (!window._gregMultiSection) return;
  const container = document.getElementById('greg-sections-container');
  if (!container) return;

  gregSectionFromUI(); // make sure active section's latest data is captured

  // Remove stale section divs (sections that no longer exist)
  const validIds = gregSections.map(s => 'greg-secbox-' + s.id);
  Array.from(container.children).forEach(function(child) {
    if (!validIds.includes(child.id)) child.remove();
  });

  const realSvgWrap = document.getElementById('greg-svg-wrap');
  // Runde 64: CONFIRMED root cause of the recurring "riesiger Weissraum"
  // bug, found via live DevTools measurement — #greg-svg-wrap used to carry
  // a min-height that gregRenderPDFPage() set to match the loaded PDF
  // page's pixel height, for the old "PDF als Geisterbild hinter der
  // Notation"-Darstellung. That min-height was only ever reset in
  // gregClearPDF() — never when this shared node got reused as the ACTIVE
  // section's wrap in multi-section mode, forcing the active section's box
  // to at least the PDF page's height regardless of its own content.
  // Runde 65: gregRenderPDFPage() sets this min-height nowhere anymore at
  // all (the PDF now renders full-opacity in its own side panel instead of
  // behind #greg-svg-wrap), which removes the root cause at the source —
  // this unconditional clear stays in place regardless, as a zero-cost
  // safety net.
  realSvgWrap.style.minHeight = '0';

  // Measure a width ONCE, up front, and use it for EVERY section rendered
  // in this pass (active + all previews) — without this, the browser's own
  // scrollbar toggling on/off as content re-renders (a section's box can be
  // a different height active vs. inactive, which can flip a vertical
  // scrollbar and shift the available horizontal width by its width,
  // ~15px) could make different sections in the SAME pass measure slightly
  // different widths, changing where the SAME chant re-wraps depending on
  // whether its section happens to be active or not right now — the root
  // cause behind freetext position drift across many previous rounds: the
  // drift symptom itself kept getting fixed, but this per-render width
  // instability kept re-creating a fresh case of it afterwards. A loaded
  // file's explicitly saved canvasWidth (gregSavePiece/gregLoadPiece)
  // still takes priority — only fill in a transient lock if nothing more
  // permanent already applies.
  const hadPermanentForcedWidth = !!window._gregForcedCanvasWidth;
  if (!hadPermanentForcedWidth) {
    const firstContent = container.querySelector('.greg-sec-content');
    const measured = (firstContent && firstContent.clientWidth)
      || (document.getElementById('greg-canvas-wrap')||{}).clientWidth;
    if (measured) window._gregForcedCanvasWidth = measured;
  }

  gregSections.forEach(function(sec, idx) {
    let box = document.getElementById('greg-secbox-' + sec.id);
    if (!box) {
      box = document.createElement('div');
      box.id = 'greg-secbox-' + sec.id;
      box.style.cssText = 'position:relative;width:100%;margin-bottom:20px;border:3px solid transparent;border-radius:3px;box-sizing:border-box;transition:border-color .15s';
      // Handle bar
      const handle = document.createElement('div');
      handle.className = 'greg-sec-handle';
      handle.style.cssText = 'height:20px;background:#eee5d0;border-bottom:1px solid #d0c8b0;cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:0 8px;font-size:10px;color:#665;user-select:none;border-radius:2px 2px 0 0';
      const label = document.createElement('span');
      label.style.cssText = 'cursor:grab';
      label.textContent = '↕ Abschnitt ' + (idx + 1);
      const closeBtn = document.createElement('span');
      closeBtn.textContent = '✕';
      closeBtn.title = 'Abschnitt schliessen';
      closeBtn.style.cssText = 'cursor:pointer;color:#a05050;font-weight:bold;padding:0 4px';
      closeBtn.onclick = function(e) {
        e.stopPropagation();
        const curIdx = gregSections.findIndex(s2 => s2.id === sec.id);
        gregCloseSection(curIdx);
      };
      const pbBtn = document.createElement('span');
      pbBtn.className = 'greg-sec-pb';
      pbBtn.style.cssText = 'cursor:pointer;padding:0 6px;margin-left:auto;margin-right:8px;border:1px solid #c0b898;border-radius:3px;font-size:10px';
      pbBtn.onclick = function(e) {
        e.stopPropagation();
        const curIdx = gregSections.findIndex(s2 => s2.id === sec.id);
        const sc = gregSections[curIdx]; if (!sc) return;
        gregPush(); sc.pb = !sc.pb;
        gregRenderAllSections();
        gregGst(sc.pb ? 'Abschnitt ' + (curIdx + 1) + ' beginnt auf einer neuen Seite.' : 'Seitenumbruch vor Abschnitt ' + (curIdx + 1) + ' entfernt.');
      };
      const hideBtn = document.createElement('span');
      hideBtn.className = 'greg-sec-hide';
      hideBtn.style.cssText = 'cursor:pointer;padding:0 6px;margin-right:8px;border:1px solid #c0b898;border-radius:3px;font-size:10px';
      hideBtn.onclick = function(e) {
        e.stopPropagation();
        const curIdx = gregSections.findIndex(s2 => s2.id === sec.id);
        const sc = gregSections[curIdx]; if (!sc) return;
        gregPush(); sc.hidden = !sc.hidden;
        gregRenderAllSections(); if (typeof gregScheduleAutosave === 'function') gregScheduleAutosave();
        gregGst(sc.hidden ? 'Abschnitt ' + (curIdx + 1) + ' ausgeblendet – erscheint nicht im PDF und nicht in der Orgel.' : 'Abschnitt ' + (curIdx + 1) + ' wieder eingeblendet.');
      };
      handle.appendChild(label);
      handle.appendChild(pbBtn);
      handle.appendChild(hideBtn);
      handle.appendChild(closeBtn);
      handle.addEventListener('mousedown', function(e) {
        if (e.target === closeBtn) return;
        gregStartSectionDrag(e, box, sec);
      });
      handle.addEventListener('click', function(e) {
        if (e.target === closeBtn) return;
        const curIdx = gregSections.findIndex(s2 => s2.id === sec.id);
        gregSetActiveSection(curIdx);
      });
      box.appendChild(handle);

      const content = document.createElement('div');
      content.className = 'greg-sec-content';
      content.style.cssText = 'position:relative;width:100%;min-height:60px;padding:10px;background:#fff';
      box.appendChild(content);

      container.appendChild(box);
    }

    const curIdx = gregSections.findIndex(s2 => s2.id === sec.id);
    box.style.borderColor = (curIdx === gregActiveIdx) ? '#4fa832' : 'transparent';
    box.querySelector('.greg-sec-handle span').textContent = '↕ Abschnitt ' + (curIdx + 1);
    { const pbB = box.querySelector('.greg-sec-pb');
      if (pbB) {
        pbB.style.display = curIdx === 0 ? 'none' : '';
        pbB.textContent = sec.pb ? '⤓ Neue Seite ✓' : '⤓ Neue Seite';
        pbB.style.background = sec.pb ? '#c8e0b8' : 'transparent';
        pbB.title = 'Seitenumbruch vor diesem Abschnitt (PDF beginnt hier eine neue Seite)';
      } }
    { const hB = box.querySelector('.greg-sec-hide');
      if (hB) {
        hB.textContent = sec.hidden ? '🙈 ausgeblendet' : '👁';
        hB.style.marginLeft = curIdx === 0 ? 'auto' : '';
        hB.style.background = sec.hidden ? '#e8c8a8' : 'transparent';
        hB.title = sec.hidden ? 'Abschnitt ist ausgeblendet (nicht im PDF, nicht in der Orgel) – tippen zum Einblenden' : 'Abschnitt ausblenden (bleibt gespeichert, erscheint nicht im PDF und nicht in der Orgel)';
      } }
    box.style.opacity = sec.hidden ? '0.85' : '';

    const content = box.querySelector('.greg-sec-content');
    content.style.display = sec.hidden ? 'none' : '';

    if (curIdx === gregActiveIdx) {
      // Move the REAL interactive svg-wrap into this box.
      // Invalidate any pending preview-render for this div FIRST — if this box
      // was a static preview a moment ago, an async performLayoutAsync/layoutChantLines
      // callback may still be in flight and would otherwise land later and call
      // content.innerHTML = svg, destroying the just-appended realSvgWrap (its own
      // render-token guard only protects against newer PREVIEW renders, not against
      // a transition to active mode, which uses a separate code path).
      content._renderToken = (content._renderToken || 0) + 1;
      content.innerHTML = '';
      content.appendChild(realSvgWrap);
      realSvgWrap.style.display = 'block';
      gregRenderActiveOnly(); // raw render path, fully interactive — NOT gregRender() (would recurse)
    } else {
      // Static preview render
      gregRenderSectionPreview(sec, content);
    }
  });

  // Only a transient, per-pass lock (see above) — release it so a genuine
  // window resize before the NEXT render pass is still picked up. A
  // permanent one (loaded from a file) is left untouched.
  if (!hadPermanentForcedWidth) window._gregForcedCanvasWidth = null;
}

function gregStartSectionDrag(e, box, sec) {
  const container = document.getElementById('greg-sections-container');
  const startX = e.clientX, startY = e.clientY;
  const DRAG_THRESHOLD = 5; // px — distinguishes a real drag from a plain click
  let dragging = false;

  function onMove(ev) {
    if (!dragging) {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (Math.sqrt(dx*dx + dy*dy) < DRAG_THRESHOLD) return; // still just a click, not a drag
      // Threshold crossed: NOW actually engage drag mode
      dragging = true;
      ev.preventDefault();
      document.body.style.cursor = 'grabbing';
      box.style.opacity = '0.6';
    }
    // Find which box we're hovering over
    const boxes = Array.from(container.children);
    const hoverBox = boxes.find(b => {
      const r = b.getBoundingClientRect();
      return ev.clientY >= r.top && ev.clientY <= r.bottom && b !== box;
    });
    if (hoverBox) {
      const r = hoverBox.getBoundingClientRect();
      const before = ev.clientY < r.top + r.height/2;
      if (before) container.insertBefore(box, hoverBox);
      else container.insertBefore(box, hoverBox.nextSibling);
    }
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    if (!dragging) return; // plain click — never engaged drag mode, nothing to do here;
                            // the handle's own 'click' listener handles section switching
    document.body.style.cursor = '';
    box.style.opacity = '';
    // Rebuild gregSections order from DOM order
    gregSectionFromUI();
    const activeId = gregSections[gregActiveIdx].id;
    const domOrder = Array.from(container.children).map(b => b.id.replace('greg-secbox-',''));
    gregSections.sort((a,b) => domOrder.indexOf(a.id) - domOrder.indexOf(b.id));
    gregActiveIdx = gregSections.findIndex(s => s.id === activeId);
    gregRenderAllSections();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

// Render a NON-active section as a static (non-interactive) preview
function gregRenderSectionPreview(sec, container) {
  // Fully self-contained: never touches global UI fields (greg-title etc.),
  // so it cannot race with the active section's live editing. Title/subtitle
  // are passed as explicit parameters to gregCalcTitlePad/gregRenderTitle.
  // Render-token guard: if this container gets a newer render request before
  // this async one finishes, the stale result is discarded (last-call-wins).
  const renderToken = (container._renderToken = (container._renderToken || 0) + 1);
  // A PRIVATE ctxt instance, not the shared getExsurgeCtxt() singleton.
  // ChantContext carries mutable per-parse/per-layout state (e.g.
  // activeClef, updated while exsurge walks through a score's notations)
  // that isn't meant to be shared between unrelated scores rendering at
  // the same time. Previously all sections' previews reused the SAME ctxt
  // object as the active section; since preview rendering is async and can
  // interleave with the active section's own async render, one section's
  // in-progress parse/layout could observe (and even leave behind) another
  // section's activeClef — this is what caused wrong custos pitches at the
  // end of an UNRELATED, already-finished section's lines right after
  // adding/importing notes into a different section.
  const sz = gregGetSizing(sec);
  const ctxt = gregBuildExsurgeCtxtFromSizing(sz);
  if (!ctxt) return;

  // Build GABC purely from sec.entries (without touching gregEntries/gregClefVal)
  const gabc = gregBuildGABCFor(sec);

  let body = gabc, annText = null, useDropCap = !!sec.dropCap;
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
  }
  const clefGabc = GREG_CLEF_MAP[sec.clef] || 'c3';
  if (!body || body === '(' + clefGabc + ')') body = '(' + clefGabc + ') (::)';

  try {
    const mappings = exsurge.Gabc.createMappingsFromSource(ctxt, body);
    const score = new exsurge.ChantScore(ctxt, mappings, useDropCap);
    score.initialLines = gregInitialLinesOf(gabc);
    const annArr = annText ? annText.split('\n').filter(Boolean) : [];
    if (annArr.length > 0) {
      score.annotation = new exsurge.Annotation(ctxt, annArr[annArr.length - 1]);
      score._extraAnnotations = annArr.slice(0, -1);
    }
    const zoom = (sz.zoom || 1) * gregVS(); // inkl. Anzeige-Skalierung (nur Bildschirm)
    const layoutWidth = gregLayoutWidth(window._gregForcedCanvasWidth || container.clientWidth, zoom);
    // Capture sec's own title/subtitle as local consts — immune to later UI changes
    const secTitle = sec.title || '';
    const secSubtitle = sec.subtitle || '';
    score.performLayoutAsync(ctxt, function() {
      score.layoutChantLines(ctxt, layoutWidth, function() {
        if (container._renderToken !== renderToken) return; // a newer render superseded this one
        container._pbScore = score; container._pbCtxt = ctxt;
        const svg = score.createSvg(ctxt);
        container.innerHTML = svg;
        const svgEl = container.querySelector('svg');
        if (svgEl) {
          gregNeutralizeRubricRed(svgEl);
          const nativeW = parseFloat(svgEl.getAttribute('width')) || layoutWidth;
          svgEl.style.cssText = 'background:transparent;display:block;pointer-events:none;';
          const _ext = gregSecTitleExtra(gregSections.indexOf(sec), secTitle, secSubtitle);
          const neededPad = gregCalcTitlePad(nativeW, secTitle, secSubtitle, sec.commentary || '', _ext);
          const _topPad = addSvgPadding(svgEl, 32, neededPad, gregSecGap());
          svgEl._topPad = _topPad; svgEl._titleShift = _ext;
          gregRenderTitle(svgEl, secTitle, secSubtitle, sec.commentary || '');
          if (score._extraAnnotations && score._extraAnnotations.length) gregRenderExtraAnnotations(svgEl, score._extraAnnotations);
          // Apply zoom after all overlays
          if (zoom !== 1) {
            const finalW = parseFloat(svgEl.getAttribute('width')) || nativeW;
            const finalH = parseFloat(svgEl.getAttribute('height')) || 200;
            const vb = svgEl.getAttribute('viewBox') || ('0 0 '+finalW+' '+finalH);
            svgEl.setAttribute('viewBox', vb);
            svgEl.setAttribute('width',  String(Math.round(finalW * zoom)));
            svgEl.setAttribute('height', String(Math.round(finalH * zoom)));
          }
          svgEl.style.cssText = 'background:transparent;display:block;pointer-events:none;max-width:100%;height:auto;';
        }
        // Comments are embedded directly into the svg's own coordinate
        // system (see gregEmbedCommentsIntoSvg) — no longer sensitive to
        // WHEN this happens relative to padding/zoom, since addSvgPadding
        // only ever widens the viewBox around existing content, it never
        // moves/transforms it, and the zoom step only touches the
        // width/height display attributes, not the viewBox coordinates
        // notes (and now comments) are positioned in.
        gregEmbedCommentsIntoSvg(svgEl, sec.entries, score, false);
      });
    });
  } catch(err) { console.error('Section preview render error:', err); }
}

// Build GABC string for an arbitrary section object, without touching global state
function gregBuildGABCFor(sec) {
  const ann = (sec.annotation || '').trim();
  const dc = !!sec.dropCap;
  const title = (sec.title || '').trim();
  const clefGabc = GREG_CLEF_MAP[sec.clef] || 'c3';
  let header = '';
  if (title) header += 'name: ' + title + '\n';
  if ((sec.commentary || '').trim()) header += 'commentary: ' + sec.commentary.trim() + ';\n';
  if (sec.hdrExtra) header += sec.hdrExtra + '\n';
  if (ann) ann.split('\n').filter(Boolean).forEach(function(line) { header += 'annotation: ' + line + '\n'; });
  if (dc) header += 'drop-cap: auto\n';
  if (dc && sec.initialLines === 2) header += 'notator-initial-lines: 2\n';
  const body = gregEntriesToBody(sec.entries, clefGabc, sec.clefRaw || '');
  return header ? header + '%%\n' + body : body;
}

// Public entry point: ALWAYS call this (not gregRenderActiveOnly) after any
// edit to entries/title/subtitle/annotation/etc. Dispatches to the correct
// path depending on single- vs multi-section mode. This is the single fix
// point for the bug where direct gregRender() calls (from input listeners,
// click handler, undo/redo, etc.) bypassed gregRenderAllSections() and left
// gregSections[] stale / inactive previews un-refreshed in multi-section mode.
// exsurge hardcodes ANY occurrence of "V/.", "R/.", "A/." (any letter case)
// inside a lyric to a special glyph font PLUS red fill (#f00) — see the
// library's own generateSpansFromText markup scanner. This is completely
// independent of ctxt.autoColor (which Notator sets false everywhere) and
// cannot be configured; it's a fixed, deliberate library convention for the
// traditional two-colour "rubric red" printing style. Our reference material
// (GregoBase / Solesmes reprints used throughout this project) prints these
// in plain black, so override just the colour after rendering — keep the
// nicer "Exsurge Characters" glyph, only force it back to Notator's normal
// ink black (#1a1a0a, matching gregRenderTitle/gregRenderExtraAnnotations).
function gregNeutralizeRubricRed(svgEl) {
  if (!svgEl) return;
  svgEl.querySelectorAll('[style*="Exsurge Characters"]').forEach(function(el) {
    if ((el.getAttribute('style') || '').indexOf('#f00') >= 0) {
      el.style.fill = '#1a1a0a';
    }
  });
}

// Anzeige-Skalierung (🔍-Regler): nur Bildschirm, nicht PDF/gespeichertes Stück
function gregVS() { return typeof ntViewScale === 'function' ? ntViewScale('greg') : 1; }

function gregRender() {
  try { gregPaperApply(); } catch (e) { console.warn(e); }
  if (window._gregMultiSection) gregRenderAllSections();
  else gregRenderActiveOnly();
  if (typeof ntRefreshOrganIfVisible === 'function') ntRefreshOrganIfVisible();
  gregScheduleAutosave();
}

function gregRenderActiveOnly() {
  // Renders the ACTIVE section's data (gregEntries + UI fields directly) into
  // the real interactive #greg-svg-wrap. Called directly by gregRenderAllSections
  // for the active slot (never call gregRender() from there — infinite loop).
  const gabc = gregBuildGABC();
  const outEl = document.getElementById('greg-gabc-out');
  if (outEl) outEl.value = gabc;
  const wrap = document.getElementById('greg-svg-wrap');
  gregRenderGABCInto(gabc, wrap, function(svgEl, score) {
    if (svgEl) {
      _gregActiveScore = score;
      gregEmbedCommentsIntoSvg(svgEl, gregEntries, score, true);
      // NOTE: no manual zoom-division here. svgEl.getScreenCTM() (used inside
      // gregHandleClick) already maps real client/screen pixels to native
      // viewBox units, correctly accounting for the width/height-vs-viewBox
      // zoom scale applied above — pre-dividing clientX/Y by zoom here used
      // to double-apply that compensation, which silently broke click
      // accuracy (both for placing new notes and for click-to-edit) at any
      // Staff Size other than the 20pt/zoom=1 default.
      svgEl.onclick = function(ev) {
        window._gregShiftClick = !!ev.shiftKey; // Shift+Klick: Neume ohne Silbe (Melisma) / auf Note: Bereich markieren
        window._gregCtrlClick = !!(ev.ctrlKey || ev.metaKey); // Strg/Cmd+Klick auf Note: einzeln markieren
        gregGhostRemove(svgEl);
        try { gregHandleClick(svgEl, ev.clientX, ev.clientY); } finally { window._gregShiftClick = false; window._gregCtrlClick = false; }
      };
      svgEl.onmousemove = function(ev) {
        const pt = svgEl.createSVGPoint();
        pt.x = ev.clientX; pt.y = ev.clientY;
        const svgP = pt.matrixTransform(svgEl.getScreenCTM().inverse());
        if (_gregPending) { svgEl.style.cursor = 'crosshair'; gregGhostShow(svgEl, svgP); return; }
        const hit = gregFindEntryAtNativePoint(_gregScore, gregEntries, svgP.x, svgP.y, _gregCtxtRef);
        svgEl.style.cursor = (hit != null) ? 'pointer' : 'crosshair';
        if (hit != null) gregGhostRemove(svgEl); else gregGhostShow(svgEl, svgP);
      };
      svgEl.onmouseleave = function() { gregGhostRemove(svgEl); };
      gregTouchAim(svgEl);
      // Re-apply (or clear) the red edit-highlight on the freshly rendered
      // SVG, since a full re-render replaces all elements — without this,
      // an open edit form's highlight would silently vanish the next time
      // ANYTHING triggers a re-render (e.g. editing a different entry).
      gregHighlightEditingEntry(_gregEditingEntryIdx);
      gregEditPopPlace();
      gregBlockHighlight();
      gregRunAfterRender();
    }
    gregUpdateStatus();
  });
}

// Core render: renders a GABC string into a target div, using CURRENT UI field values
// (title/subtitle/annotation/dropcap) — always reflects whatever is presently loaded
// (single-section mode, or the active section in multi-section mode).
// Returns the width to lay out chant notation at: the width saved in a
// loaded .notator file (window._gregForcedCanvasWidth), if present, so a
// re-opened document re-wraps identically to how it looked when saved
// regardless of the current browser window size — otherwise the live
// #greg-canvas-wrap element's actual width.
// Eine Formel für Bildschirm (aktiv/Vorschau) und PDF – sonst brechen Abschnitte je nach Zustand anders um.
function gregLayoutWidth(boxW, totalZoom) {
  return Math.max((boxW - 20) / totalZoom, (typeof gregIsMobileViewport === 'function' && gregIsMobileViewport()) ? 140 : 300);
}

