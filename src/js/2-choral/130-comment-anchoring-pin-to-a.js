// ── Comment ("Freitext") anchoring: pin to a NOTE, not a page % ─────────
// Earlier versions stored a comment's position as a % of the page. That's
// fundamentally fragile: the % only maps back to the same VISUAL spot if
// the chant re-wraps onto exactly the same lines every time it's rendered,
// which isn't guaranteed (different active/inactive rendering paths,
// different window sizes on reopening a saved file, etc.) — years of
// whack-a-mole bugs traced back to this. Comments are now anchored to a
// specific NOTE (by its ordinal position among all note-bearing entries)
// plus a small (dx, dy) fine-offset in the SVG's own native coordinate
// units. Wherever that note ends up — different line, different section
// box, different PDF layout — the comment moves with it, which also
// matches how people actually use these (as a label pointing at a
// specific spot in the music). Legacy %-based comments (comment.x/y,
// no anchorNoteIdx) still render via the old formula as a fallback.

// Counts note-bearing entries up to (not including) index `uptoIdx` in an
// entries array (default: the whole array) — this ordinal count IS the
// anchor id. Divisios/comments/specials don't interrupt the count, they're
// simply skipped, same on both the "store anchor" and "resolve anchor" side.
function gregCountNoteEntries(entries, uptoIdx) {
  const end = (uptoIdx == null) ? entries.length : uptoIdx;
  let n = 0;
  for (let i = 0; i < end && i < entries.length; i++) {
    const e = entries[i];
    if (e.type === 'note' && e.pitches && e.pitches.length) n++;
  }
  return n;
}

// Inverse of gregCountNoteEntries: given the ordinal index of a note-bearing
// entry (0-based, matching gregResolveAnchorPosition/gregFindNearestNoteOrdinal's
// numbering), returns its actual index within `entries`. Used to jump from
// "the note the user clicked on" back to "which row in the entry list is
// that".
function gregOrdinalToEntryIndex(entries, ordinal) {
  let n = 0;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.type === 'note' && e.pitches && e.pitches.length) {
      if (n === ordinal) return i;
      n++;
    }
  }
  return null;
}

// Resolves an ordinal note index to its absolute {x,y} position in the
// SVG's native (viewBox) coordinate space, using a rendered ChantScore.
function gregResolveAnchorPosition(score, anchorNoteIdx) {
  if (!score || !score.notations || !score.lines || anchorNoteIdx == null) return null;
  let n = 0, foundIdx = -1;
  for (let i = 0; i < score.notations.length; i++) {
    const nt = score.notations[i];
    if (nt.notes && nt.notes.length) {
      if (n === anchorNoteIdx) { foundIdx = i; break; }
      n++;
    }
  }
  if (foundIdx === -1) {
    // anchor index out of range (e.g. notes were deleted since) — clamp to the last note
    for (let i = 0; i < score.notations.length; i++)
      if (score.notations[i].notes && score.notations[i].notes.length) foundIdx = i;
  }
  if (foundIdx === -1) return null;
  const nt = score.notations[foundIdx];
  let line = null;
  for (const l of score.lines) {
    if (foundIdx >= l.notationsStartIndex && foundIdx < l.notationsStartIndex + l.numNotationsOnLine) { line = l; break; }
  }
  if (!line) return null;
  return { x: (line.bounds.x || 0) + nt.bounds.x, y: (line.bounds.y || 0) + nt.bounds.y };
}

// Finds the gregEntries[] index of the note-bearing entry whose rendered
// glyph — or lyric text underneath it — contains the given native-
// coordinate point (px, py; already transformed via
// svgEl.getScreenCTM().inverse(), same space as notation.bounds). Unlike a
// single-anchor-point distance check, this tests the notation's actual
// bounding box (nt.bounds spans the FULL neume shape, since exsurge unions
// every glyph piece into it via addVisualizer — see e.g. a 3-note Torculus,
// whose bounds cover all three noteheads, not just the first). A generous
// band is added below the box to also catch the lyric syllable rendered
// underneath, so clicking the text opens the same entry too. Returns null
// if the point falls in genuinely empty staff space.
function gregFindEntryAtNativePoint(score, entries, px, py, ctxt) {
  if (!score || !score.notations || !score.lines) return null;
  const si = (ctxt && ctxt.staffInterval) ? ctxt.staffInterval : 10;
  const pad = si * 0.35;
  const lyricBand = si * 3; // covers the syllable text rendered below the staff
  let ordinal = -1, bestIdx = null, bestArea = Infinity;
  for (let i = 0; i < score.notations.length; i++) {
    const nt = score.notations[i];
    const isNote = !!(nt.notes && nt.notes.length);
    if (isNote) ordinal++;
    if (!isNote) continue;
    let line = null;
    for (const l of score.lines) {
      if (i >= l.notationsStartIndex && i < l.notationsStartIndex + l.numNotationsOnLine) { line = l; break; }
    }
    if (!line) continue;
    const bx = (line.bounds.x || 0) + nt.bounds.x;
    const by = (line.bounds.y || 0) + nt.bounds.y;
    const bw = nt.bounds.width || 0;
    const bh = nt.bounds.height || 0;
    const rx = bx - pad, ry = by - pad, rw = bw + pad * 2, rh = bh + pad * 2 + lyricBand;
    if (px >= rx && px <= rx + rw && py >= ry && py <= ry + rh) {
      const area = rw * rh;
      if (area < bestArea) { bestArea = area; bestIdx = ordinal; } // smallest matching glyph wins on overlap
    }
  }
  if (bestIdx == null) return null;
  return gregOrdinalToEntryIndex(entries, bestIdx);
}

// Finds the ordinal index of the note-bearing notation nearest to a given
// native-coordinate point — used to (re-)anchor a comment after it's
// dragged to a new spot.
function gregFindNearestNoteOrdinal(score, nativeX, nativeY) {
  if (!score || !score.notations || !score.lines) return null;
  let bestOrdinal = null, bestDist = Infinity, n = 0;
  for (let i = 0; i < score.notations.length; i++) {
    const nt = score.notations[i];
    if (!(nt.notes && nt.notes.length)) continue;
    let line = null;
    for (const l of score.lines) {
      if (i >= l.notationsStartIndex && i < l.notationsStartIndex + l.numNotationsOnLine) { line = l; break; }
    }
    if (line) {
      const ax = (line.bounds.x || 0) + nt.bounds.x;
      const ay = (line.bounds.y || 0) + nt.bounds.y;
      const d = Math.hypot(ax - nativeX, ay - nativeY);
      if (d < bestDist) { bestDist = d; bestOrdinal = n; }
    }
    n++;
  }
  return bestOrdinal;
}

// Computes the CSS pixel {left, top} (relative to svgEl's offsetParent) for
// a comment div, plus the current native->CSS scale factors (needed when
// converting a drag delta back into native units for re-saving). Falls
// back to the legacy %-of-page formula for older comments that don't have
// an anchorNoteIdx yet.
// Embeds comment ("Freitext") entries directly INSIDE the given <svg> as
// native SVG <text> elements, positioned in the SAME coordinate system as
// the notes themselves (native viewBox units, via gregResolveAnchorPosition
// — identical to how the PDF export already embeds them). This replaces an
// earlier HTML-div-overlay approach that computed CSS pixel positions via
// svgEl.offsetWidth/Height/Left/Top: those DOM measurements kept turning
// out to differ subtly between the active section's DOM structure
// (#greg-svg-wrap wrapping the <svg>) and a static preview's structure (the
// <svg> is a direct child of the section box) — and no amount of chasing
// individual discrepancies (container size, padding offsets, render
// timing, page width...) fully eliminated the resulting position drift
// across many rounds. Embedding directly in the SVG's own coordinate
// system sidesteps the whole class of bug: the exact same <text> element,
// at the exact same native (x,y), looks IDENTICAL wherever that SVG is
// displayed, because there's no separate overlay-positioning step left to
// disagree with it.
function gregEmbedCommentsIntoSvg(svgEl, entries, score, interactive) {
  if (!svgEl) return;
  svgEl.querySelectorAll('.greg-comment-text').forEach(t => t.remove());
  const svgNS = 'http://www.w3.org/2000/svg';
  (entries || []).forEach(function(e) {
    if (e.type !== 'comment') return;
    const anchor = (e.anchorNoteIdx != null) ? gregResolveAnchorPosition(score, e.anchorNoteIdx) : null;
    let x, y;
    if (anchor) {
      x = anchor.x + (e.dx || 0);
      y = anchor.y + (e.dy || 0);
    } else {
      // Legacy fallback for comments saved before note-anchoring existed
      const vb = (svgEl.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
      const vbOk = vb.length === 4 && vb.every(n => !isNaN(n));
      const vbMinX = vbOk ? vb[0] : 0, vbMinY = vbOk ? vb[1] : 0;
      const vbW = (vbOk && vb[2]) || parseFloat(svgEl.getAttribute('width')) || 700;
      const vbH = (vbOk && vb[3]) || parseFloat(svgEl.getAttribute('height')) || 300;
      x = vbMinX + (e.x || 10) / 100 * vbW;
      y = vbMinY + (e.y || 10) / 100 * vbH;
    }
    const t = document.createElementNS(svgNS, 'text');
    t.setAttribute('class', 'greg-comment-text');
    // Clamp inside the visible viewBox — mainly a safety net for legacy
    // (pre-anchoring) comments whose % position could be garbage data from
    // an old buggy version; a properly anchored position should already
    // be within the score's own bounds.
    const vbc = (svgEl.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
    const vbcOk = vbc.length === 4 && vbc.every(n => !isNaN(n));
    const cMinX = vbcOk ? vbc[0] : 0, cMinY = vbcOk ? vbc[1] : 0;
    const cW = (vbcOk && vbc[2]) || parseFloat(svgEl.getAttribute('width')) || 700;
    const cH = (vbcOk && vbc[3]) || parseFloat(svgEl.getAttribute('height')) || 300;
    x = Math.min(Math.max(x, cMinX + 4), cMinX + cW - 4);
    y = Math.min(Math.max(y, cMinY + 4), cMinY + cH - 4);
    t.setAttribute('x', x.toFixed(2));
    t.setAttribute('y', y.toFixed(2));
    t.setAttribute('font-family', "'Crimson Text', 'Palatino Linotype', Georgia, serif");
    t.setAttribute('font-size', '14');
    t.setAttribute('font-style', 'italic');
    t.setAttribute('fill', '#8b4513');
    t.textContent = e.text;

    if (interactive) {
      t.style.cursor = 'move';
      t.style.userSelect = 'none';
      t.addEventListener('click', function(ev) { ev.stopPropagation(); });

      t.addEventListener('dblclick', function(ev) {
        ev.stopPropagation();
        const newText = window.prompt('Text bearbeiten:', e.text);
        if (newText !== null) {
          gregPush();
          e.text = newText;
          t.textContent = newText;
          gregRefreshList();
        }
      });

      // Drag directly in SVG-space: convert mouse events to the svg's own
      // coordinate system via its screen transform matrix (the standard,
      // robust way to do this — no CSS box-model math involved at all).
      // On release, re-anchor to whichever note ends up nearest the drop
      // point, storing only a small (dx, dy) fine-offset from that note.
      t.addEventListener('mousedown', function(ev) {
        if (ev.button !== 0) return;
        ev.preventDefault();
        ev.stopPropagation();
        const ctm = svgEl.getScreenCTM();
        if (!ctm) return;
        const inv = ctm.inverse();
        const pt = svgEl.createSVGPoint();
        function toSvgCoords(clientX, clientY) {
          pt.x = clientX; pt.y = clientY;
          const p = pt.matrixTransform(inv);
          return {x: p.x, y: p.y};
        }
        const startPointer = toSvgCoords(ev.clientX, ev.clientY);
        const startX = parseFloat(t.getAttribute('x'));
        const startY = parseFloat(t.getAttribute('y'));
        function onMove(e2) {
          const cur = toSvgCoords(e2.clientX, e2.clientY);
          t.setAttribute('x', (startX + (cur.x - startPointer.x)).toFixed(2));
          t.setAttribute('y', (startY + (cur.y - startPointer.y)).toFixed(2));
        }
        function onUp() {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          const finalX = parseFloat(t.getAttribute('x'));
          const finalY = parseFloat(t.getAttribute('y'));
          const nearest = gregFindNearestNoteOrdinal(score, finalX, finalY);
          if (nearest != null) {
            const anchorPos = gregResolveAnchorPosition(score, nearest);
            e.anchorNoteIdx = nearest;
            e.dx = anchorPos ? finalX - anchorPos.x : 0;
            e.dy = anchorPos ? finalY - anchorPos.y : 0;
            delete e.x; delete e.y; // drop legacy % fields once anchored
          }
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    } else {
      t.style.pointerEvents = 'none';
    }

    svgEl.appendChild(t);
  });
}


function gregInsertDropCapLetter() {
  const letterEl = document.getElementById('greg-dropcap-letter');
  const letter = letterEl ? letterEl.value.trim() : '';
  if (!letter) { gregGst('Bitte einen Buchstaben eingeben'); return; }
  gregPush();
  // In GABC: uppercase letter followed by () = standalone drop cap without notes
  gregEntries.push({type:'dropcapletter', text: letter.toUpperCase()});
  _gregPending = null;
  if (letterEl) letterEl.value = '';
  gregRefreshList();
  gregGst('Drop Cap "' + letter.toUpperCase() + '" eingefügt — nächster Eintrag beginnt die Melodie');
}

function gregInsertVers() {
  // ℣. is a standalone TextOnly element in GABC: ℣.()
  gregPush();
  gregEntries.push({type:'textonly', text:'℣.'});
  _gregPending = null;
  gregRefreshList();
  gregGst('℣. als eigenständiges Element eingefügt');
}

function gregInsertResp() {
  gregPush();
  gregEntries.push({type:'textonly', text:'℟.'});
  _gregPending = null;
  gregRefreshList();
  gregGst('℟. als eigenständiges Element eingefügt');
}
// Text ohne Noten auf der Textzeile (GABC «Text()»), z.B. «Roráte.» nach ℟.
function gregInsertTextOnly() {
  const sy = document.getElementById('greg-syllable');
  let t = sy && sy.value.trim() ? sy.value.trim() : (window.prompt('Text ohne Noten (erscheint in der Textzeile):', '') || '').trim();
  if (!t) return;
  t = t.replace(/[()]/g, '');
  gregPush();
  gregEntries.push({type:'textonly', text: t});
  if (sy) sy.value = '';
  _gregPending = null;
  gregRefreshList();
  gregGst('Text ohne Noten eingefügt: «' + t + '»');
}

