// ── Save / Load piece ────────────────────────────────────────────
// Builds the full serializable state object — shared by the manual
// "Speichern" (.notator download) and the sessionStorage autosave, so both
// stay in sync automatically as the format evolves.
function gregBuildStateObject() {
  const title   = (document.getElementById('greg-title')||{value:''}).value;
  const subtitle= (document.getElementById('greg-subtitle')||{value:''}).value;
  const ann     = (document.getElementById('greg-annotation')||{value:''}).value;
  const dc      = (document.getElementById('greg-dropcap')||{checked:false}).checked;
  const dcLetter= (document.getElementById('greg-dropcap-letter')||{value:''}).value;

  // Determine active clef key from GREG_CLEF_MAP (reverse lookup)
  const clefKey = Object.keys(GREG_CLEF_MAP).find(k => GREG_CLEF_MAP[k] === gregClefVal) || 'do';

  const hasSections = window._gregMultiSection && gregSections.length > 1;
  if (hasSections) gregSectionFromUI();
  // Save the current page width so re-opening this file reproduces the
  // exact same line-wrapping (and thus the same visual layout) regardless
  // of the browser window size at load time — without this, a document
  // opened in a differently-sized window can re-wrap onto a different
  // number of lines, which also throws off any freetext ("comment") entry
  // positions saved as a % of the page.
  // Seitenbreite (logisch, geräteunabhängig); canvasWidth für ältere Versionen
  const pageW = window._gregPageW || undefined;
  const canvasWidth = gregPaperW();
  return {
    version: '1.2',
    multiSection: hasSections,
    sections: hasSections ? JSON.parse(JSON.stringify(gregSections)) : null,
    title, subtitle, annotation: ann,
    dropCap: dc, dropCapLetter: dcLetter,
    clef: clefKey,
    clefRaw: gregClefRaw || undefined,
    commentary: (document.getElementById('greg-commentary')||{value:''}).value || undefined,
    hdrExtra: gregHdrExtra || undefined,
    secGap: gregSecGap(),
    sz: gregSzRead(),
    initialLines: (document.getElementById('greg-dropcap2')||{}).checked ? 2 : undefined,
    canvasWidth,
    pageW,
    entries: JSON.parse(JSON.stringify(gregEntries)),
    classic: (typeof clState !== 'undefined') ? JSON.parse(JSON.stringify(clState)) : null,
    meta: Object.assign(ntMetaNorm(gregMeta), { txt: ntCurrentIncipit() || ntMetaNorm(gregMeta).txt })
  };
}

function gregSavePiece() {
  const title = ntFileBaseName();
  const state = gregBuildStateObject();
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], {type: 'application/json'});
  const suggestedName = (title.trim() || 'unbenannt').replace(/[^a-zA-Z0-9äöüÄÖÜ_ -]/g, '_') + '.notator';

  // Use File System Access API (Chrome/Edge) for real save dialog
  if (window.showSaveFilePicker) {
    window.showSaveFilePicker({
      suggestedName,
      types: [{ description: 'Notator-Datei', accept: { 'application/json': ['.notator'] } }]
    }).then(function(fh) {
      return fh.createWritable().then(function(w) {
        return w.write(blob).then(function() { return w.close(); });
      }).then(function() {
        gregGst('Gespeichert: ' + fh.name);
      });
    }).catch(function(err) {
      if (err.name !== 'AbortError') gregGst('Speicherfehler: ' + err.message);
    });
  } else {
    // Fallback: prompt for filename, save to Downloads
    const name = prompt('Dateiname:', suggestedName);
    if (name === null) return; // cancelled
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name.endsWith('.notator') ? name : name + '.notator'; a.click();
    URL.revokeObjectURL(url);
    gregGst('Gespeichert: ' + a.download);
  }
}

// Applies a previously-built state object (see gregBuildStateObject) back
// into the live app — shared by the manual "Öffnen" (.notator file) and by
// the sessionStorage autosave restore, so both stay in sync automatically.
// closeEditFormFirst: also called from the autosave path, where no edit
// form can possibly be open yet (nothing has rendered), so it's optional.
// Bereinigt Stücke, die vor Build 219 mit dem Doppel-Stern-Fehler
// importiert und gespeichert wurden ('special' "*" + Silbe "* ter").
function gregFixDoubleAsterisk(entries) {
  if (!Array.isArray(entries)) return;
  for (let i = 0; i < entries.length - 1; i++) {
    const a = entries[i], b = entries[i + 1];
    if (a && a.type === 'special' && (a.text || '').trim() === '*' && b && b.type === 'note' && /^\s*\*\s*/.test(b.syllable || '')) {
      b.syllable = b.syllable.replace(/^\s*\*\s*/, '');
    }
  }
}

function gregApplyLoadedState(state) {
  gregCloseEditForm();
  gregSelectedIndices.clear(); window._gregBlockPick = false; window._gregBlockRange = 0;
  window._ntTrashedOpen = false;
  if (state) {
    // Seitenbreite des Stücks übernehmen (ältere Dateien: gespeicherte Notenbreite; Handy-Breiten < 600 ignorieren)
    { const pw = +state.pageW || ((+state.canvasWidth >= 600) ? +state.canvasWidth : 0); window._gregPageW = (pw && Math.abs(pw - GREG_PAPER_A4) >= 4) ? Math.max(NT_PAPER_MIN, Math.min(NT_PAPER_MAX, Math.round(pw))) : null; }
    gregFixDoubleAsterisk(state.entries);
    (state.sections || []).forEach(sec => gregFixDoubleAsterisk(sec && sec.entries));
  }
  if (typeof clState !== 'undefined') { clState = Object.assign({}, (state && state.classic) || {}); clNormalizeState(); clUndoReset(); }
  gregMeta = ntMetaNorm(state && state.meta);
  { const sg = document.getElementById('gs-secgap'); if (sg) { sg.value = (state && isFinite(state.secGap)) ? state.secGap : 16; const sv = document.getElementById('gs-secgap-v'); if (sv) sv.textContent = Math.round(sg.value) + 'px'; } }
  // NOTE: this file may contain a saved `canvasWidth` from an older
  // version's "remember the page width" feature — deliberately IGNORED
  // here now. That feature was superseded by the render-pass-local
  // width lock in gregRenderAllSections()/gregExportPDF() (keeps ALL
  // sections in ONE pass consistent with each other and with the PDF,
  // released again immediately after), and by anchoring freetext to
  // actual notes instead of a page percentage — neither of which needs
  // a permanently forced width anymore. Permanently forcing it here
  // instead made the whole page rigid: it no longer adapted when the
  // browser window / note-sheet width was resized, even right after
  // opening a file.

  // Restore entries
  if (state.multiSection && state.sections && state.sections.length > 1) {
    // Multi-section file
    { const baseSz = state.sz || gregSzRead(); state.sections.forEach(sc => { if (sc && !sc.sz) sc.sz = Object.assign({}, baseSz); }); }
    gregSections = state.sections;
    gregActiveIdx = 0;
    gregLoadSectionToUI(0);
    gregEnableMultiSection();
    setTimeout(gregRenderAllSections, 200);
  } else {
    if (state.sz) gregSzWrite(state.sz);
    gregCollapseSections();   // war vorher ein Mehr-Abschnitt-Stück offen, dessen Abschnitte entfernen
    gregEntries = state.entries;
    // Restore UI fields — only for single-section files. For multi-section
    // files these top-level state.title/subtitle/annotation/dropCap fields
    // just mirror whichever section happened to be ACTIVE at save time
    // (gregSavePiece reads them straight from the live UI inputs) — they
    // are NOT a per-section-1 record. Applying them here unconditionally
    // used to overwrite the correct values gregLoadSectionToUI(0) had
    // just restored a moment ago with e.g. section 2's title/subtitle
    // whenever section 2 was active when the file was saved.
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };
    set('greg-title',         state.title);
    set('greg-subtitle',      state.subtitle);
    set('greg-annotation', state.annotation||'');
    set('greg-dropcap-letter',state.dropCapLetter);
    setChk('greg-dropcap',    state.dropCap !== false);
    // Clef: multi-section files already got the correct PER-SECTION clef
    // from gregLoadSectionToUI(0) above — this top-level state.clef is
    // the same "whatever was active at save time" leftover as the text
    // fields above, so it must stay scoped to the single-section case too.
    if (state.clef) gregSetClef(state.clef);
    gregClefRaw = state.clefRaw || ''; gregClefUi();
    set('greg-commentary', state.commentary);
    { const d2 = document.getElementById('greg-dropcap2'); if (d2) d2.checked = state.initialLines === 2; }
    gregHdrExtra = state.hdrExtra || '';
  }
}

function gregLoadPiece(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const raw = e.target.result;
      // "Öffnen" loads a previously-saved Notator project (JSON). A raw
      // JSON.parse error on the wrong file type (most commonly someone's
      // source PDF, picked by mistake) produces a cryptic message like
      // '"%PDF-1.4 ..." is not valid JSON' that reads as if something in
      // Notator itself broke — check for that specific case first and say
      // plainly what happened instead.
      if (/^\s*%PDF-/.test(raw)) {
        gregGst('"' + file.name + '" ist eine PDF-Datei, keine Notator-Projektdatei — dafür oben "PDF lesen" verwenden, nicht "Öffnen".');
        return;
      }
      const state = JSON.parse(raw);
      if (!state.entries || !Array.isArray(state.entries)) throw new Error('Ungültiges Format');
      gregPush(); // allow undo back to previous state
      gregApplyLoadedState(state);
      input.value = ''; // reset so same file can be loaded again
      gregRefreshList();
      gregGst('Geladen: ' + (state.title || file.name) + ' (' + gregEntries.length + ' Einträge)');
      ntMarkClean();
      gregScheduleAutosave(); // the autosave should reflect THIS file from now on, not the old content
    } catch(err) {
      gregGst('Ladefehler: "' + file.name + '" ist keine gültige Notator-Projektdatei. (' + err.message + ')');
    }
  };
  reader.readAsText(file);
}

