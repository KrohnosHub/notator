// ── Entry list ───────────────────────────────────────────────────
let _gregDragIdx = null;
let gregSelectedIndices = new Set(); // indices into gregEntries currently checked for bulk actions

function gregEntryLabel(e) {
  if (e.type==='divisio') return '<span style="color:#c8a060;font-weight:bold">'+e.div+'</span>';
  if (e.type==='special') return '<span style="color:#a06030">'+e.text+'</span>';
  if (e.type==='textonly') return '<span style="color:#c8a060">'+e.text+'</span> <span style="color:#6b8a60;font-size:8px">standalone</span>';
  if (e.type==='linebreak') return '<span style="font-size:11px;color:#6b8a60">⏎ Neue Notenlinie</span>';
  if (e.type==='raw') return '<span style="color:#c8a060">' + (e.label || e.gabc) + '</span> <span style="color:#6b8a60;font-size:8px">' + gregEscHtml(e.gabc) + '</span>';
  if (e.type==='dropcapletter') return '<span style="font-size:13px;font-weight:bold;color:#c0d890">'+e.text+'</span> <span style="color:#6b8a60;font-size:8px">Drop Cap (ohne Noten)</span>';
  if (e.type==='directive') return '<i style="color:#c8a060">'+e.text+'</i> <span style="color:#6b8a60;font-size:8px">kursiv</span>';
  if (e.type==='comment') return '<span style="color:#8b4513">&#128172; '+e.text+'</span>';
  const hmark = (e.hyphen && e.wordEnd === undefined) ? '<span style="color:#a8d878">-</span>' : '';
  const wemark = e.wordEnd ? '<span style="color:#c0a060" title="Wortende"> |</span>' : '';
  function fmtGroup(g) {
    const typeName = g.neumeType || g.neume;
    if (g.notes && g.notes.length) {
      const noteStr = g.notes.map(n => {
        let s = n.pitch;
        if (n.mora) s += '.';
        if (n.ictus) s += "'";
        if (n.episema) s += '_';
        if (n.liquescent) s += '~';
        return s;
      }).join('');
      return typeName + ' ' + noteStr;
    }
    return (g.neume||'') + ' ' + (g.pitches||[]).join('');
  }
  let neumeInfo = fmtGroup(e);
  if (e.extra && e.extra.length) {
    // Legacy support: older saved files may still have bundled extra[]
    // groups from a previous import format. Still displayed for safety,
    // though new imports no longer produce this structure.
    neumeInfo += e.extra.map(ex => ' + ' + fmtGroup(ex)).join('');
  }
  const isContinuation = !e.syllable && !e.hyphen;
  const sylDisplay = e.syllable
    ? (e.italic ? '<i>' + e.syllable + '</i>' : e.syllable)
    : (isContinuation ? '<span style="color:#5a7a50">↳</span>' : '—');
  return '<b style="color:#c0d890">'+sylDisplay+hmark+wemark+'</b><span style="color:#6b8a60;font-size:9px"> '+neumeInfo+'</span>';
}

// Tracks which single gregEntries[] index currently has its inline edit form
// open (or null). Used both to close any previously-open form when a
// different note is clicked/edited (see gregEditEntry) and to keep the
// score's red highlight in sync with it across re-renders.
let _gregEditingEntryIdx = null;

// Removes any red edit-highlight previously painted onto the score.
// «PDF lesen»: Zeile mit API-Key-Feld (gleiches, vom Browser als Kennwort
// merkbares Feld) und «PDF wählen» auf-/zuklappen – bleibt offen, bis man
// es schliesst (z.B. während man den Key in einem anderen Fenster holt).
function gregPdfReadRow(open) {
  const row = document.getElementById('greg-pdf-read-row');
  if (!row) return;
  const isOpen = row.style.display !== 'none';
  const want = open === undefined ? !isOpen : !!open;
  if (want && typeof gregSetMode === 'function' && window._gregMode !== 'details') gregSetMode('details');
  row.style.display = want ? 'flex' : 'none';
  if (want) { const k = document.getElementById('greg-api-key'); if (k && !k.value) setTimeout(() => k.focus(), 30); }
}
function gregClearEditHighlight() {
  const wrap = document.getElementById('greg-svg-wrap');
  const svgEl = wrap ? wrap.querySelector('svg') : null;
  if (!svgEl) return;
  svgEl.querySelectorAll('.greg-edit-highlight').forEach(node => {
    node.style.fill = '';
    node.style.stroke = '';
    node.classList.remove('greg-edit-highlight');
  });
}

// Parses a GABC body (mapping-only, no layout needed) and counts how many
// resulting notations actually carry notes — i.e. how many real neume
// glyphs it would render as. Used to find the exact notation-index
// boundary belonging to one gregEntries item by re-parsing prefixes of the
// SAME entries array with the SAME production function (gregEntriesToBody)
// that built the score currently on screen, so it can't drift out of sync
// with it (a naive "count note-type entries before this one" guess did
// drift for entries carrying e.extra[]-bundled legacy sub-groups).
//
// IMPORTANT, learned the hard way: entries that GLUE into the same run
// (continuation entries with no syllable of their own, sharing a
// mappingIdx — see gregEntriesToBody) still each get their OWN separate
// rendered notation; gluing only affects the GABC source's word/hyphen
// formatting, not how many Neume objects come out of it. An earlier
// version of this function grouped a whole run together before counting,
// which wrongly lit up an entire melisma (every continuation note of a
// multi-part run) when only ONE of its entries was actually being edited.
// Per-entry (not per-run) counting is correct in the normal case; it only
// needs to span more than one real notation for genuine e.extra[] bundles.
function gregCountNoteBearingNotations(gabcBody, ctxt) {
  try {
    const mappings = exsurge.Gabc.createMappingsFromSource(ctxt, gabcBody || '()');
    let count = 0;
    for (const m of mappings) {
      for (const nt of (m.notations || [])) {
        if (nt.notes && nt.notes.length) count++;
      }
    }
    return count;
  } catch (err) {
    return null;
  }
}

// Colors every glyph piece of the notation(s) belonging to
// gregEntries[entryIdx] red, so it's obvious at a glance which note(s) on
// the score the currently-open editor row corresponds to (normally exactly
// one notation; only spans more for a legacy e.extra[]-bundled entry).
// Individual glyph pieces (noteheads, connecting stems/lines) each carry
// their own explicit fill in the real renderer (unlike the static palette
// icons) and must be recolored one by one rather than via CSS inheritance
// from a single wrapping element. Lyric text is deliberately left in its
// normal color — the request was specifically about highlighting the notes.
// Called both immediately when an entry is opened for editing AND on every
// fresh score re-render (via gregRenderActiveOnly), so the highlight always
// matches whatever is currently open, even after unrelated edits elsewhere
// force a re-render.
//
// IMPORTANT, learned the hard way: `_gregScore.notations` is NOT the same
// set of elements as the rendered DOM's `.ChantNotationElement` list. The
// STARTING clef is parsed as part of the notations but then spliced back
// out into `score.startingClef` (see exsurge's ChantScore.updateNotations)
// — it still renders in the DOM (same CSS class) but has no entry in the
// array. On top of that, every line break adds a Custos (end of the
// previous line) AND a repeated clef (start of the next line) to the DOM,
// again with no array counterpart. Indexing `els[i]` by the notations
// array's own index `i` — which seemed reasonable and even checked out for
// the FIRST couple of notations in isolated testing — silently drifts by
// one extra element per clef/custos encountered, which is exactly why the
// very first note highlighted the clef instead, and later notes drifted
// further still. Fix: filter the DOM element list down to ONLY elements
// whose class isn't a Clef/Custos before indexing by array position —
// verified index-for-index identical to `_gregScore.notations` afterwards
// (checked with a real layout+render in a Node/jsdom harness).
function gregHighlightEditingEntry(entryIdx) {
  gregClearEditHighlight();
  if (entryIdx == null || !_gregScore || !_gregScore.notations) return;
  const e = gregEntries[entryIdx];
  if (!e || e.type !== 'note' || !e.pitches || !e.pitches.length) return;
  const wrap = document.getElementById('greg-svg-wrap');
  const svgEl = wrap ? wrap.querySelector('svg') : null;
  if (!svgEl) return;
  const ctxt = _gregCtxtRef;
  if (!ctxt) return;

  const ordinalStart = gregCountNoteBearingNotations(gregEntriesToBody(gregEntries.slice(0, entryIdx), gregClefVal), ctxt);
  const ordinalEnd = gregCountNoteBearingNotations(gregEntriesToBody(gregEntries.slice(0, entryIdx + 1), gregClefVal), ctxt);
  if (ordinalStart == null || ordinalEnd == null || ordinalEnd <= ordinalStart) return;

  const els = Array.from(svgEl.querySelectorAll('.ChantNotationElement'))
    .filter(el => !/Clef|Custos/.test(el.getAttribute('class') || ''));
  const paintRed = node => {
    node.style.fill = '#d21f1f';
    node.style.stroke = '#d21f1f';
    node.classList.add('greg-edit-highlight');
  };
  let ordinal = 0;
  for (let i = 0; i < _gregScore.notations.length; i++) {
    const nt = _gregScore.notations[i];
    if (!(nt.notes && nt.notes.length)) continue;
    if (ordinal >= ordinalStart && ordinal < ordinalEnd) {
      const target = els[i];
      if (target) {
        paintRed(target);
        target.querySelectorAll('*').forEach(node => {
          const tag = node.tagName ? node.tagName.toLowerCase() : '';
          if (tag === 'text' || tag === 'tspan') return; // leave the lyric syllable in its normal color
          paintRed(node);
        });
      }
    }
    ordinal++;
  }
}

// Clears the editing state (used by the edit form's Save/Cancel buttons so
// the red highlight disappears the instant the form closes, rather than
// waiting for the next debounced re-render).
function gregCloseEditForm() {
  _gregEditingEntryIdx = null;
  gregEditPopRemove();
  gregClearEditHighlight();
}

// Nach dem Öffnen (fertig aufgebautes Formular) den Eintrag in der Liste
// sichtbar machen – bei Klick auf eine Note im Notenbild lag er sonst oft
// ausserhalb des sichtbaren Bereichs.
function gregRevealEditRow(i) {
  requestAnimationFrame(() => {
    const el = document.getElementById('greg-entry-list');
    const row = el && el.querySelectorAll('[data-idx]')[i];
    if (!row) return;
    // nur die Liste scrollen, nicht die ganze Seite
    let sc = row.parentElement;
    while (sc && sc !== document.body && !(sc.scrollHeight > sc.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
    if (!sc || sc === document.body) { row.scrollIntoView({ block: 'center' }); return; }
    const r = row.getBoundingClientRect(), c = sc.getBoundingClientRect();
    if (r.top < c.top + 4 || r.bottom > c.bottom - 4)
      sc.scrollTo({ top: sc.scrollTop + (r.top - c.top) - Math.max(8, (c.height - Math.min(r.height, c.height)) / 2), behavior: 'smooth' });
  });
}
function gregEditEntry(i) {
  gregEditEntryInner(i);
  gregRevealEditRow(i);
}
function gregEditEntryInner(i) {
  const e = gregEntries[i];
  if (!e) return;
  // Close any other entry's edit form first (rebuilds all rows back to
  // their default collapsed view), so only ONE entry is ever in edit mode
  // at a time — previously, clicking a different note left earlier edit
  // forms open in the list, which was confusing (see PrintScreen).
  gregRefreshListNoRender();
  _gregEditingEntryIdx = i;
  // Build a small inline edit form based on type
  const el = document.getElementById('greg-entry-list');
  if (!el) return;
  const rows = el.querySelectorAll('[data-idx]');
  const row = rows[i];
  if (!row) return;
  // Bearbeitungsfenster schwebt direkt an der Note (Nutzerwunsch 2026-10-22);
  // die Zeile in der Liste wird nur markiert.
  row.style.background = '#2a4a1a';
  row.style.borderColor = '#6bc06b';
  const host = gregEditPopCreate(i);

  if (e.type === 'note') {
    const inp = (tag,w,val,ph,tt) => {
      const el=document.createElement('input'); el.type='text';
      el.value=val||''; el.placeholder=ph||''; el.title=tt||'';
      el.style.cssText='width:'+w+'px;font-size:9px;background:#0a1406;color:#c0d890;border:1px solid #3a4a30;padding:1px 3px;outline:none';
      return el;
    };
    const chk = (lbl,checked,tt) => {
      const wrap=document.createElement('label');
      wrap.style.cssText='font-size:9px;color:#a8d878;display:flex;align-items:center;gap:1px';
      wrap.title=tt||'';
      const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=!!checked;
      wrap.appendChild(cb); wrap.appendChild(document.createTextNode(lbl));
      return {wrap, cb};
    };

    // Neume selector
    const neuSel = document.createElement('select');
    neuSel.style.cssText='font-size:9px;background:#0a1406;color:#a8d878;border:1px solid #3a4a30;outline:none;padding:1px';
    ['punctum','virga','quilisma','podatus','clivis','salicus','torculus','porrectus','scandicus','climacus','bistropha','tristropha','apostropha','distropha','bivirga','trivirga','puncta_inclinata','pes_subpunctis','pes_quassus','torculus_resupinus','porrectus_flexus','scandicus_flexus'].forEach(v=>{
      const o=document.createElement('option'); o.value=v; o.textContent=v;
      if(v===e.neume) o.selected=true; neuSel.appendChild(o);
    });
    const sylI = inp('input',170, e.syllable,'Silbe');
    sylI.className = 'greg-pop-syl'; gregNoAutoCaps(sylI);
    const pitI = inp('input',80,(e.pitches||[]).join(''),'Töne','GABC a-m; Grossbuchstabe = Punctum inclinatum (Raute), z.B. efED');
    // Accidental
    const accSel = document.createElement('select');
    accSel.id = 'greg-edit-acc';
    accSel.style.cssText='font-size:9px;background:#0a1406;color:#a8d878;border:1px solid #3a4a30;outline:none;padding:1px';
    [['','—'],['x','b♭'],['#','♯'],['y','♮']].forEach(([v,l])=>{ // GABC: x=flat, y=natural
      const o=document.createElement('option'); o.value=v; o.textContent=l;
      if(v===(e.accidental||'')) o.selected=true; accSel.appendChild(o);
    });
    // Vorzeichen auf welcher Note (z.B. b auf der 2. Note einer Clivis)
    const accPosSel = document.createElement('select');
    accPosSel.title = 'Vorzeichen vor welcher Note (z.B. b auf der 2. Note einer Clivis)';
    accPosSel.style.cssText = 'font-size:9px;background:#0a1406;color:#a8d878;border:1px solid #3a4a30;outline:none;padding:1px';
    const accPos0 = gregAccPosOf(e);
    function fillAccPos() {
      const cur = accPosSel.value || (accPos0 ? String(accPos0) : (e.accidentalPitch ? 'p:' + e.accidentalPitch : '1'));
      const n = Math.max(1, pitI.value.split('').filter(c=>c.toLowerCase()>='a'&&c.toLowerCase()<='m').length);
      accPosSel.innerHTML = '';
      for (let k = 1; k <= Math.max(n, 1); k++) { const o = document.createElement('option'); o.value = String(k); o.textContent = 'auf N' + k; accPosSel.appendChild(o); }
      if (!accPos0 && e.accidentalPitch) { const o = document.createElement('option'); o.value = 'p:' + e.accidentalPitch; o.textContent = 'Linie ' + e.accidentalPitch; accPosSel.appendChild(o); }
      accPosSel.value = [...accPosSel.options].some(o => o.value === cur) ? cur : '1';
      accPosSel.style.display = (accSel.value && n > 1) || (accSel.value && !accPos0 && e.accidentalPitch) ? '' : 'none';
    }
    accSel.addEventListener('change', fillAccPos);
    pitI.addEventListener('input', fillAccPos);
    fillAccPos();
    // Mora (.): unified N1..N4 model (2026-08-10, Runde 2 -- Nutzerwunsch:
    // "der Standard-Mora-Hacken sollte ganz verschwinden, stattdessen
    // Mora N1/N2/N3 gesetzt werden"). No separate ".mora"/"letzte Note"
    // toggle anymore -- mora on the LAST note is simply the checkbox for
    // that note's own position, exactly like any earlier note. Internally
    // still maps onto the existing e.mora (last position) + e.moraExtra
    // (earlier positions) fields on save -- buildSingleNeumeGABC's r(i)/
    // dot logic is completely untouched, only this UI layer changed.
    // Pre-filled from e.moraExtra if already explicitly set by THIS edit
    // form on a previous save, else from e.notes (precise import data:
    // which note positions carry n.mora===true) -- e.g. "fecit"'s Clivis,
    // imported with mora on BOTH notes, now correctly shows N1 AND N2
    // checked, not just N2.
    //
    // IMPORTANT: e.mora alone is NOT a reliable "already explicitly set by
    // the user" signal -- makeNeumeEntry() ALWAYS sets it on import
    // (`mora: notes.some(x => x.mora)`, never undefined), so checking
    // `e.mora !== undefined` here would incorrectly treat every freshly
    // imported entry as "already handled" and only ever show the LAST
    // note's mora, silently discarding earlier notes' mora on the very
    // first open+save. e.moraExtra, by contrast, is ONLY ever set by this
    // same save handler below -- never by import -- so its presence is a
    // reliable signal that e.mora/e.moraExtra (not e.notes) are the
    // authoritative, already-consolidated source.
    let initMora = [];
    if (e.moraExtra !== undefined) {
      const noteCount = (e.pitches||[]).length || 1;
      if (e.mora) initMora.push(noteCount);
      e.moraExtra.forEach(p => initMora.push(p));
    } else if (e.notes && e.notes.length) {
      e.notes.forEach((n,i) => { if (n.mora) initMora.push(i + 1); });
    }
    const moraW = document.createElement('span');
    moraW.style.cssText = 'font-size:9px;color:#a8d878;display:inline-flex;align-items:center;gap:2px';
    moraW.title = 'Mora (.) auf einer oder mehreren Noten dieses Neumes -- pro Note einzeln wählbar (z.B. beide Noten eines Podatus/einer Clivis)';
    moraW.appendChild(document.createTextNode('Mora (.):'));
    const moraCbs = [1,2,3,4].map(p => {
      const lbl = document.createElement('label');
      lbl.style.cssText = 'display:inline-flex;align-items:center;gap:1px';
      const cb = document.createElement('input'); cb.type='checkbox'; cb.checked = initMora.includes(p);
      lbl.appendChild(cb); lbl.appendChild(document.createTextNode('N'+p));
      moraW.appendChild(lbl);
      return cb;
    });
    // Enabled range tracks the ACTUAL note count currently shown in the
    // "Töne" field (not just the neume type's nominal count) so it stays
    // correct even if the user edits pitches directly before saving.
    function updateMoraVis(){
      const noteCount = pitI.value.split('').filter(c=>c.toLowerCase()>='a'&&c.toLowerCase()<='m').length || (NEUME_PITCHES[neuSel.value]||1);
      moraCbs.forEach((cb,idx) => {
        const enabled = (idx + 1) <= noteCount;
        cb.disabled = !enabled;
        cb.closest('label').style.opacity = enabled ? '1' : '0.35';
        if (!enabled) cb.checked = false;
      });
    }
    neuSel.addEventListener('change', updateMoraVis);
    pitI.addEventListener('input', updateMoraVis);
    updateMoraVis();
    const {wrap:iktW,cb:iktI}=chk("Iktus (')",e.iktus,"Iktus (')");
    // Iktus position selector -- pre-filled from e.iktusPos if already
    // set, else from e.notes[0].ictusPos (precise import data). Without
    // this, opening+saving an imported entry with an explicit gabc "'1"/
    // "'0" position silently reset it to exsurge's own per-neume default
    // (usually the visible bug: an ictus rendered below instead of above).
    let initIktusPos = e.iktusPos || '';
    if (!initIktusPos && e.notes && e.notes.length) {
      const iNote = e.notes.find(n => n.ictus);
      if (iNote && iNote.ictusPos) initIktusPos = iNote.ictusPos;
    }
    const iktPosSel = document.createElement('select');
    iktPosSel.title = 'Iktus-Position: oben oder unten erzwingen';
    iktPosSel.style.cssText = 'font-size:9px;background:#0a1406;color:#a8d878;border:1px solid #3a4a30;outline:none;padding:1px';
    [['','Standard'],['above','oben'],['below','unten']].forEach(([v,t])=>{
      const o=document.createElement('option');o.value=v;o.textContent=t;
      if(initIktusPos===v) o.selected=true;
      iktPosSel.appendChild(o);
    });
    const {wrap:liqW,cb:liqI}=chk('Liq.',e.liquescent,'Liqueszenz');
    const {wrap:orisW,cb:orisI}=chk('Orisc.',e.oriscus,'Oriscus');
    const {wrap:strW,cb:strI}=chk('Stroph.',e.strophicus,'Strophicus');
    const {wrap:presW,cb:presI}=chk('Pres.',e.pressus,'Pressus');
    // Quilisma checkbox + position selector -- pre-filled from
    // e.quilisma/e.quilismaPos if already set (previously edited), else
    // derived from e.notes (precise import data), so simply opening and
    // re-saving an imported entry that has a quilisma note doesn't
    // silently destroy it. Necessary because e.pitches (used by the
    // "Töne" field above) is ALWAYS plain lowercase letters with no shape
    // info at all (see convertNote/makeNeumeEntry: pitch comes purely
    // from staffPosToGabc(n.staffPosition), never from n.shape) -- so the
    // Töne field can never show or preserve a quilisma on its own.
    let initQuilisma = !!e.quilisma, initQuilismaPos = e.quilismaPos || 1;
    if (e.quilisma === undefined && e.notes && e.notes.length) {
      const qIdx = e.notes.findIndex(n => n.shape === 3); // 3 = NoteShape.Quilisma
      if (qIdx >= 0) { initQuilisma = true; initQuilismaPos = qIdx + 1; }
    }
    const {wrap:quilW,cb:quilI}=chk('Quilisma',initQuilisma,'Quilisma: gezackte Verzierungsnote (steht in echten Neumen meist auf einer Note VOR einem Aufstieg)');
    const quilPosW = document.createElement('span');
    quilPosW.style.cssText = 'font-size:9px;color:#6b8a60;display:inline-flex;align-items:center;gap:2px';
    const quilPosSel = document.createElement('select');
    quilPosSel.title = 'Quilisma-Position: auf welcher Note';
    quilPosSel.style.cssText = 'font-size:9px;background:#0a1406;color:#a8d878;border:1px solid #3a4a30;outline:none;padding:1px';
    [['1','N1'],['2','N2'],['3','N3'],['4','N4']].forEach(([v,t])=>{
      const o=document.createElement('option');o.value=v;o.textContent=t;
      if(String(initQuilismaPos)===v) o.selected=true;
      quilPosSel.appendChild(o);
    });
    function updateQuilPosVis(){
      const applicable = QUILISMA_APPLICABLE.includes(neuSel.value);
      quilPosW.style.display = (quilI.checked && applicable) ? 'inline-flex' : 'none';
    }
    neuSel.addEventListener('change', updateQuilPosVis);
    quilI.addEventListener('change', updateQuilPosVis);
    quilPosW.appendChild(document.createTextNode('auf'));
    quilPosW.appendChild(quilPosSel);
    updateQuilPosVis();
    // Word-end marker (No-Hyphen mode): marks this as last syllable of a word
    const weW = document.createElement('label');
    weW.style.cssText = 'font-size:9px;color:#c0a060;display:inline-flex;align-items:center;gap:2px;cursor:pointer';
    weW.title = 'Wortende: nach dieser Silbe folgt ein neues Wort (nur in "Keine Bindest." Modus relevant)';
    const weI = document.createElement('input'); weI.type='checkbox'; weI.checked=!!e.wordEnd;
    weW.appendChild(weI); weW.appendChild(document.createTextNode('Wortende'));
    const {wrap:epW,cb:epI}=chk('Episema (_)',e.episema,'Episema');
    // Episema position selector for multi-note neumes
    const epPosW = document.createElement('span');
    epPosW.style.cssText = 'font-size:9px;color:#6b8a60;display:inline-flex;align-items:center;gap:2px';
    const epPosSel = document.createElement('select');
    epPosSel.title = 'Episema-Position: auf welcher Note';
    epPosSel.style.cssText = 'font-size:9px;background:#0a1406;color:#a8d878;border:1px solid #3a4a30;outline:none;padding:1px';
    [['1','N1'],['2','N2'],['3','N3']].forEach(([v,t])=>{
      const o=document.createElement('option');o.value=v;o.textContent=t;
      if(String(e.episemaPos||1)===v) o.selected=true;
      epPosSel.appendChild(o);
    });
    const multiNoteNeumeTypes=['torculus','porrectus','scandicus','climacus','torculus_resupinus','porrectus_flexus','scandicus_flexus'];
    function updateEpPosVis(){
      const isMulti=multiNoteNeumeTypes.includes(neuSel.value);
      epPosW.style.display=isMulti?'inline-flex':'none';
    }
    neuSel.addEventListener('change',updateEpPosVis);
    epPosW.appendChild(document.createTextNode('auf'));
    epPosW.appendChild(epPosSel);
    updateEpPosVis();
    const save=document.createElement('button');
    save.textContent='✓'; save.style.cssText='font-size:9px;padding:0 4px;background:#1e4a1e;color:#6bc06b;border:1px solid #3a6a3a;cursor:pointer;border-radius:2px';
    save.onclick=()=>{
      gregPush();
      e.neume=neuSel.value;
      e.syllable=sylI.value;
      // Preserve the case exactly as typed — per GABC/Gregorio convention a
      // capitalized pitch letter means "punctum inclinatum" (diamond-shaped
      // note) vs. the normal punctum quadratum for lowercase. Previously
      // this field was force-lowercased on save, silently discarding any
      // shape distinction the user typed and always falling back to
      // whatever fixed per-neume-type pattern buildSingleNeumeGABC's legacy
      // switch happened to hardcode — e.g. there was no way to mark just
      // ONE note of a manually-built neume as an apostropha/inclinatum.
      e.pitches=pitI.value.split('').filter(c=>c.toLowerCase()>='a'&&c.toLowerCase()<='m');
      if(!e.pitches.length) e.pitches=['f'];
      e.accidental=accSel.value||null;
      if (e.accidental && !/^p:/.test(accPosSel.value)) {
        const ap = parseInt(accPosSel.value) || 1;
        // Nur ändern, wenn die Position wirklich anders ist als die bisherige
        // (importierte Vorzeichen-Tonhöhe bleibt sonst unverändert erhalten)
        if (ap !== accPos0) { e.accidentalPos = ap; delete e.accidentalPitch; }
      }
      if (!e.accidental) { delete e.accidentalPos; delete e.accidentalPitch; }
      // Derive e.mora (last note) / e.moraExtra (earlier notes) from the
      // unified N1..N4 checkbox set -- "last" is whichever position equals
      // the just-updated e.pitches.length, so buildSingleNeumeGABC's
      // existing dot/r(i) logic (unchanged) keeps working exactly as before.
      { const moraOn = [1,2,3,4].filter((p,idx)=>moraCbs[idx].checked);
        e.mora = moraOn.includes(e.pitches.length);
        e.moraExtra = moraOn.filter(p => p < e.pitches.length); }
      e.iktus=iktI.checked; e.iktusPos=iktPosSel.value; e.episema=epI.checked;
      e.episemaPos=parseInt(epPosSel.value)||1;
      e.liquescent=liqI.checked; e.oriscus=orisI.checked;
      e.strophicus=strI.checked; e.pressus=presI.checked;
      e.quilisma=quilI.checked; e.quilismaPos=parseInt(quilPosSel.value)||1;
      // Always store an explicit boolean here (never `undefined`). Storing
      // `undefined` for an unchecked box used to silently ERASE a real,
      // explicit `wordEnd:false` that GABC import had set for a mid-word
      // syllable — the moment ANY entry's edit panel was opened and saved
      // (even without touching this checkbox), that entry could lose its
      // explicit word-boundary information and fall through to the
      // click-editor-only "assume same word" default in gregEntriesToBody's
      // endRun(), which is wrong for a genuine word-final imported syllable
      // (hyphen after a word-end syllable that shouldn't have one, and/or a
      // missing space before the next real word).
      e.wordEnd=weI.checked;
      // Manual edit invalidates any precise per-note data this entry may
      // have carried from a GABC import (e.notes/e.neumeType/e.extra/
      // e.rawPitches) — those would otherwise silently override the fields
      // just edited above, since buildSingleNeumeGABC prefers e.notes (and,
      // within its legacy fallback, e.rawPitches) over e.pitches when
      // present. Concretely: editing pitches/neume type on an imported entry
      // updated e.pitches correctly, but left a stale e.rawPitches from
      // import in place — buildSingleNeumeGABC's legacy path reads
      // e.rawPitches||e.pitches, so it kept emitting the OLD raw pitches
      // instead of the newly typed ones (e.g. a puncta_inclinata retyped to
      // "gfe" still exported as "GGG" from leftover rawPitches:['g','g','g']).
      delete e.notes;
      delete e.neumeType;
      delete e.extra;
      delete e.rawPitches;
      gregCloseEditForm();
      gregRefreshList();
    };
    const lbl = n => { const s=document.createElement('span'); s.textContent=n; s.style.cssText='font-size:9px;color:#6b8a60'; return s; };
    // Gleicher Aufbau und gleiche Bezeichnungen wie die Eingabe links
    const grp = (title, nodes) => { const d = document.createElement('div'); d.className = 'greg-pop-row'; if (title) { const t = document.createElement('span'); t.className = 'greg-pop-lbl'; t.textContent = title; d.appendChild(t); } nodes.forEach(n => d.appendChild(n)); host.appendChild(d); };
    grp('Silbe', [sylI, weW]);
    grp('Neume', [neuSel, lbl(' Töne:'), pitI]);
    grp('', [moraW, iktW, iktPosSel, epW, epPosW]);
    grp('Vorzeichen', [accSel, accPosSel]);
    grp('Modifier', [liqW, orisW, strW, presW, quilW, quilPosW]);
    // Nur Silbe/Wortende geändert -> nur diese übernehmen (genaue Notendaten
    // aus dem Import bleiben erhalten); ohne Änderung nur schliessen.
    sylI.addEventListener('input', () => { if (/\S\s$/.test(sylI.value) && !weI.checked) { weI.checked = true; weI._auto = true; } else if (!/\s$/.test(sylI.value) && weI._auto) { weI.checked = false; weI._auto = false; } });
    const fullSave = save.onclick;
    let musicDirty = false, textDirty = false;
    host.addEventListener('input', ev => { if (ev.target === sylI || ev.target === weI) textDirty = true; else musicDirty = true; });
    host.addEventListener('change', ev => { if (ev.target === sylI || ev.target === weI) textDirty = true; else musicDirty = true; });
    save.onclick = () => {
      if (/\s$/.test(sylI.value)) { if (sylI.value.trim()) weI.checked = true; sylI.value = sylI.value.trim(); }
      if (musicDirty) { fullSave(); return true; }
      if (textDirty) { gregPush(); e.syllable = sylI.value; e.wordEnd = weI.checked; gregCloseEditForm(); gregRefreshList(); return true; }
      gregCloseEditForm(); gregRefreshListNoRender(); return false;
    };
    host._save = save.onclick;
    host._focus = sylI;
    gregEditPopButtons(host, i, save);
  } else if (e.type === 'divisio') {
    const sel = document.createElement('select');
    sel.style.cssText = 'font-size:9px;background:#0a1406;color:#c8a060;border:1px solid #3a4a30;outline:none;padding:1px';
    const divOptions = [',',';',':','::',';1',';2',';3',';4',';5',';6'];
    if (e.div && !divOptions.includes(e.div)) divOptions.push(e.div); // preserve unknown/imported values (e.g. custom size digit) instead of silently discarding them
    divOptions.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;if(v===e.div)o.selected=true;sel.appendChild(o);});
    const save = document.createElement('button');
    save.textContent='✓'; save.style.cssText='font-size:9px;padding:0 4px;background:#1e4a1e;color:#6bc06b;border:1px solid #3a6a3a;cursor:pointer;border-radius:2px';
    save.onclick=()=>{gregPush();e.div=sel.value;gregCloseEditForm();gregRefreshList();};
    host._save = save.onclick; host._focus = sel;
    [document.createTextNode('Divisio: '),sel].forEach(n=>host.appendChild(n));
    gregEditPopButtons(host, i, save);
  } else if (e.type === 'textonly' || e.type === 'special' || e.type === 'directive') {
    const ti = document.createElement('input');
    ti.value = e.text||'';
    ti.style.cssText='width:60px;font-size:9px;background:#0a1406;color:#c0d890;border:1px solid #3a4a30;padding:1px 3px;outline:none';
    const save=document.createElement('button');
    save.textContent='✓'; save.style.cssText='font-size:9px;padding:0 4px;background:#1e4a1e;color:#6bc06b;border:1px solid #3a6a3a;cursor:pointer;border-radius:2px';
    ti.style.width = '200px';
    save.onclick=()=>{gregPush();e.text=ti.value;gregCloseEditForm();gregRefreshList();};
    host._save = save.onclick; host._focus = ti;
    [document.createTextNode('Text: '),ti].forEach(n=>host.appendChild(n));
    gregEditPopButtons(host, i, save);
  }

  if (!host._btns) gregEditPopButtons(host, i, null); // übrige Eintragsarten: nur Navigation/Abbrechen

  // Immediately highlight this entry's note(s) red on the score (don't wait
  // for the next debounced re-render — the SVG is already showing, so the
  // visual feedback should be instant when the edit form opens).
  gregHighlightEditingEntry(i);
  gregEditPopPlace();
}

