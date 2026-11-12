// ── Staff click handler ──────────────────────────────────────────
function gregHandleClick(svgEl, clientX, clientY) {
  if (!_gregScore || !_gregCtxtRef) return;
  const ctxt = _gregCtxtRef;
  const pt = svgEl.createSVGPoint();
  pt.x = clientX; pt.y = clientY;
  const svgP = pt.matrixTransform(svgEl.getScreenCTM().inverse());
  if (typeof ntPlay !== 'undefined' && ntPlay.pick === 'greg') {
    ntPlayFromChoralEntry(gregFindEntryAtNativePoint(_gregScore, gregEntries, svgP.x, svgP.y, ctxt));
    return;
  }

  // Clicking on an EXISTING note's glyph (or its lyric text underneath)
  // opens its entry in the editor panel instead of adding a new one — but
  // only when not in the middle of placing a multi-click neume
  // (_gregPending), where every click is meant to add the next note of
  // that neume instead. Uses a real bounding-box hit test (see
  // gregFindEntryAtNativePoint) rather than distance-to-a-single-anchor-
  // point, since a single-point/threshold check missed clicks on multi-note
  // neumes (Torculus, Podatus, etc.) whenever the click landed away from
  // the neume's anchor corner but still visibly on the glyph.
  // Blockbearbeitung: Bereich markieren / Ziel zum Verschieben
  if (window._gregBlockPick || window._gregBlockRange || ((window._gregShiftClick || window._gregCtrlClick) && !_gregPending)) {
    if (gregBlockNoteClick(gregFindEntryAtNativePoint(_gregScore, gregEntries, svgP.x, svgP.y, ctxt))) return;
  }
  if (!_gregPending && !window._gregForcePlace) {
    const entryIdx = gregFindEntryAtNativePoint(_gregScore, gregEntries, svgP.x, svgP.y, ctxt);
    if (entryIdx != null) { gregEditEntry(entryIdx); return; }
  }

  // Reaching here means we're about to place a new note (or continue a
  // pending multi-click neume) rather than open an existing entry. If some
  // OTHER entry's edit form was left open (without being saved), close it
  // now — otherwise its row snaps back to the collapsed view (gregRefreshList
  // already did that) but the red score highlight was left orphaned,
  // pointing at an entry that's no longer being edited.
  if (_gregEditingEntryIdx != null) gregCloseEditForm();
  // In der Anzeige keine neuen Noten setzen (versehentliches Tippen beim Spielen)
  { const pnl = document.getElementById('greg-panel'); if (pnl && pnl.classList.contains('greg-view')) return; }

  // Find closest line — compare to the staff ORIGIN (bounds.y), not the bbox
  // midpoint. The 4 staff lines always sit at fixed offsets (±si, ±3si) from
  // bounds.y regardless of content above/below, so bounds.y is the stable
  // geometric anchor. Using the bbox midpoint instead caused misattribution
  // on lines with little/no ledger content (e.g. a fresh empty line), since
  // their midpoint shifts relative to lines with notes above/below the staff.
  const lines = _gregScore.lines;
  if (!lines || !lines.length) return;
  let best = lines[0], bestDist = Infinity;
  for (const line of lines) {
    const dist = Math.abs(svgP.y - line.bounds.y);
    if (dist < bestDist) { bestDist = dist; best = line; }
  }

  // staffPosition: inside line group, y=0 is staff origin
  // line.bounds.y is the SVG y of line origin after layout
  const si = ctxt.staffInterval;
  const relY = svgP.y - best.bounds.y;
  const sp = Math.round(-relY / si);
  const gabcLetter = staffPosToGabc(sp);

  const neume = (document.getElementById('greg-neume-sel')||{value:'punctum'}).value;
  const nPitch = NEUME_PITCHES[neume] || 1;
  const _noSyl = !!(window._gregShiftClick || window._gregNoSylOnce) && !!gregTextQueue();
  if (_noSyl && !_gregPending) window._gregNoSylOnce = false;
  const _sylRaw = _noSyl ? '' : (document.getElementById('greg-syllable')||{value:''}).value;
  const syllable = _sylRaw.trim(); // Leerzeichen am Ende = Wortende (Nutzerwunsch 2026-10-22)
  // Unified Mora-Checkboxen (N1..N4, kein separater ".mora"-Hacken mehr,
  // 2026-08-10 Runde 2 -- Nutzerwunsch): welche Note die "letzte" ist,
  // hängt vom Neumentyp ab (nPitch) -- wie bei Quilisma/Episema oben
  // bereits etabliert, wird das anhand der Basis-Notenzahl bestimmt, nicht
  // dynamisch bei offenen Neumen (Climacus) nachjustiert, sobald mehr als
  // die Mindestzahl geklickt wird -- dieselbe bereits bestehende
  // Einschränkung wie bei Quilisma-/Episema-Position.
  const moraChecked = [1,2,3,4].filter(p => !!(document.getElementById('greg-mora-n'+p)||{}).checked);
  const mora = moraChecked.includes(nPitch);
  const moraExtra = moraChecked.filter(p => p < nPitch);
  const iktus = !!(document.getElementById('greg-iktus')||{}).checked;
  const iktusPos = (document.getElementById('greg-iktus-pos')||{value:''}).value;
  const episema = !!(document.getElementById('greg-episema')||{}).checked;
  const liquescent = !!(document.getElementById('greg-liquescent')||{}).checked;
  const oriscus = !!(document.getElementById('greg-oriscus')||{}).checked;
  const strophicus = !!(document.getElementById('greg-strophicus')||{}).checked;
  const pressus = !!(document.getElementById('greg-pressus')||{}).checked;
  const quilisma = !!(document.getElementById('greg-quilisma')||{}).checked;
  const quilismaPos = parseInt((document.getElementById('greg-quilisma-pos')||{value:'1'}).value) || 1;
  const accidental = _gregAccidental || null;
  const wordEnd = !_noSyl && (!!(document.getElementById('greg-wordend')||{}).checked || (/\s$/.test(_sylRaw) && !!syllable));
  const episemaPos = parseInt((document.getElementById('greg-episema-pos')||{value:'1'}).value) || 1;

  const isDescending = ['clivis','porrectus','climacus','puncta_inclinata','porrectus_flexus'].includes(neume);

  if (!_gregPending) {
    gregPush();
    if (nPitch === 1) {
      const ne = {type:'note', syllable, neume, pitches:[gregDefaultNoteCase(neume, 0, gabcLetter)], mora, moraExtra, iktus, iktusPos, episema, episemaPos, liquescent, oriscus, strophicus, pressus, quilisma, quilismaPos, accidental};
      if (wordEnd) ne.wordEnd = true;
      { const ap = parseInt((document.getElementById('greg-acc-pos')||{}).value); if (accidental && ap) ne.accidentalPos = ap; }
      gregEntries.push(ne);
      if (document.getElementById('greg-syllable')) document.getElementById('greg-syllable').value = '';
      _gregAccidental = null; // consume accidental
      gregInputConsumed();
      if (!syllable) gregSylAsk(gregEntries.length - 1);
      gregRefreshList();
    } else {
      _gregPending = {type:'note', syllable, neume, pitches:[gregDefaultNoteCase(neume, 0, gabcLetter)], mora, moraExtra, iktus, iktusPos, episema, episemaPos, liquescent, oriscus, strophicus, pressus, quilisma, quilismaPos, _need:nPitch};
      if (wordEnd) _gregPending.wordEnd = true;
      if (isDescending && nPitch > 1) gregGst(neume + ': höchste Note gewählt (' + gabcLetter + ') — jetzt tiefere Note(n) klicken');
      else gregUpdateStatus();
      gregRender();
    }
  } else {
    _gregPending.pitches.push(gregDefaultNoteCase(neume, _gregPending.pitches.length, gabcLetter));
    const reachedMin = _gregPending.pitches.length >= _gregPending._need;
    if (reachedMin && !NEUME_OPEN_ENDED.includes(neume)) {
      // Fixed-length neume (Podatus, Torculus, ...): finish immediately,
      // as before.
      gregFinishPendingNeume();
    } else {
      // Either still short of the minimum, or an open-ended neume
      // (Climacus) that has reached its minimum but can keep accepting
      // more clicks until the user explicitly finishes it (Enter key,
      // "Fertig"-button, or by picking a different neume).
      gregUpdateStatus();
      gregRender();
    }
  }
}

// Finalizes the neume currently being built via multiple staff clicks
// (_gregPending) and adds it to gregEntries. Used both for the automatic
// finish of fixed-length neumes (once their required click count is
// reached) and for the explicit finish of open-ended neumes like Climacus
// (see NEUME_OPEN_ENDED) once their minimum has been met.
function gregFinishPendingNeume() {
  if (!_gregPending) return;
  const e = _gregPending; delete e._need;
  e.accidental = _gregAccidental || null;
  { const ap = parseInt((document.getElementById('greg-acc-pos')||{}).value); if (e.accidental && ap) e.accidentalPos = ap; }
  gregEntries.push(e);
  if (!e.syllable) gregSylAsk(gregEntries.length - 1);
  if (document.getElementById('greg-syllable')) document.getElementById('greg-syllable').value = '';
  _gregAccidental = null;
  _gregPending = null;
  gregInputConsumed();
  gregRefreshList();
}
// Nach dem Setzen einer Neume: einmalige Angaben zurücksetzen (Wortende,
// Vorzeichen-Knöpfe nicht mehr hervorgehoben).
function gregInputConsumed() {
  const we = document.getElementById('greg-wordend'); if (we) { we.checked = false; we._auto = false; }
  if (gregTextQueue()) setTimeout(() => gregTextQueueAfterPlace(gregEntries[gregEntries.length - 1]), 0);
  // Mora gilt nur für die eben gesetzte Neume (Nutzerwunsch 2026-10-22)
  [1,2,3,4].forEach(p => { const m = document.getElementById('greg-mora-n' + p); if (m) m.checked = false; });
  // ebenso Iktus, Episema und Modifier (Liqueszenz, Oriscus, Strophicus, Pressus, Quilisma) – Nutzerwunsch 2026-11-04
  ['greg-iktus', 'greg-episema', 'greg-liquescent', 'greg-oriscus', 'greg-strophicus', 'greg-pressus', 'greg-quilisma'].forEach(id => {
    const c = document.getElementById(id); if (c && c.checked) { c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  const ap = document.getElementById('greg-acc-pos'); if (ap) { ap.value = ''; ap.style.display = 'none'; }
  ['x','#','y'].forEach(a => { document.querySelectorAll(`button[onclick="gregSetAccidental('${a}')"]`).forEach(btn => { btn.style.background = ''; btn.style.color = ''; }); });
  gregQuickbarSync();
}

// Cancels a neume currently being built via multiple staff clicks, discarding
// any notes already placed for it. Bound to Escape (see keydown listener
// below) -- mainly useful for open-ended neumes (Climacus), which no longer
// finish themselves automatically once their minimum click count is reached.
function gregCancelPendingNeume() {
  if (!_gregPending) return;
  _gregPending = null;
  gregUpdateStatus();
  gregRender();
}

// Enter finishes an open-ended pending neume (Climacus) once its minimum
// click count is reached -- mirrors the "Fertig" button. Escape cancels
// any pending multi-click neume outright. Both are no-ops without a
// _gregPending, so this listener stays silent everywhere else in the app;
// the INPUT/SELECT guard keeps it from hijacking Enter in text fields
// (e.g. the syllable box) or a Select dropdown.
document.addEventListener('keydown', e => {
  if (!_gregPending) return;
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
  if (e.key === 'Enter') {
    if (NEUME_OPEN_ENDED.includes(_gregPending.neume) && _gregPending.pitches.length >= _gregPending._need) {
      e.preventDefault();
      gregFinishPendingNeume();
    }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    gregCancelPendingNeume();
  }
});

