// ── Einfügemarke (Build 448, Wunsch Matthias) ──────────────────────
// Neue Elemente (Noten per Klick, Trennstriche, ij./Ps./℣, Zeilenumbruch) landeten immer am Ende des Stücks und mussten danach
// in der Eintragsliste verschoben werden. Jetzt gibt es eine Einfügemarke:
//   - im Fenster einer Note «⇤ davor» / «danach ⇥» (gregInsSet)
//   - Tippen auf eine freie Stelle zwischen zwei Neumen setzt die Note dort ein (gregInsAtPoint, aus gregHandleClick)
// gregAddEntries() fügt an der Marke ein und rückt sie weiter; ohne Marke wird wie bisher angehängt.
// Eingefügte Noten gelten als neue Einträge (mit der Silbe aus dem Silbenfeld), genau wie am Ende hinzugefügte.
window._gregInsAt = null;          // Index in gregEntries; null = am Ende anhängen

function gregInsAt() {
  const a = window._gregInsAt;
  if (a == null) return null;
  if (!(a >= 0 && a <= gregEntries.length)) { window._gregInsAt = null; return null; }
  return a;
}
// Note-tragende Einträge (wie gregOrdinalToEntryIndex zählt) vor Index i
function gregNoteOrdinalBefore(i) { return gregEntryToOrdinal(gregEntries, i); }   // Notengruppen davor (Build 450: genau gezählt)
// Fügt Einträge an der Marke ein (oder hängt an) und gibt den Index des ersten zurück. Notizen (comment) sind über die
// Notennummer verankert – bei eingefügten Noten werden die Anker dahinter mitverschoben.
function gregAddEntries(...items) {
  window._gregLastAdded = items[items.length - 1];
  const at = gregInsAt();
  if (at == null || at >= gregEntries.length) {
    gregEntries.push(...items);
    if (at != null) window._gregInsAt = gregEntries.length;   // Marke am Ende bleibt am Ende
    return gregEntries.length - items.length;
  }
  const nNotes = items.reduce((t, e) => t + gregEntryNotationCount(e), 0);
  if (nNotes) {
    const ord = gregNoteOrdinalBefore(at);
    gregEntries.forEach(c => { if (c.type === 'comment' && typeof c.anchorNoteIdx === 'number' && c.anchorNoteIdx >= ord) c.anchorNoteIdx += nNotes; });
  }
  gregEntries.splice(at, 0, ...items);
  window._gregInsAt = at + items.length;
  gregInsStatus();
  return at;
}
function gregInsLabel(at) {
  for (let k = at - 1; k >= 0; k--) { const e = gregEntries[k]; if (e.type === 'note' && e.syllable) return 'nach «' + e.syllable + '»'; }
  return 'am Anfang';
}
function gregInsStatus() {
  const at = gregInsAt();
  if (at == null || at >= gregEntries.length) return;
  gregGst('Einfügen ' + gregInsLabel(at) + ' (Eintrag ' + (at + 1) + ') – neue Noten, Trennstriche usw. kommen hierhin. Esc oder «⇥ ans Ende» = wieder am Ende.');
}
function gregInsSet(idx) {
  window._gregInsAt = Math.max(0, Math.min(idx, gregEntries.length));
  gregInsStatus();
  if (typeof gregRender === 'function') gregRender();
}
function gregInsClear(silent) {
  if (window._gregInsAt == null) return;
  window._gregInsAt = null;
  if (!silent) gregGst('Neue Elemente kommen wieder ans Ende.');
  if (typeof gregRender === 'function') gregRender();
}

// Tippen auf eine freie Stelle im Notenbild: Einfügeposition aus der waagrechten Lage zwischen den Neumen der Zeile.
// Gibt einen Eintragsindex zurück oder null (= rechts der letzten Note des Stücks: wie bisher anhängen).
function gregInsAtPoint(score, line, x) {
  if (!score || !line) return null;
  const a = line.notationsStartIndex, b = a + line.numNotationsOnLine;
  let ord = 0; for (let i = 0; i < a; i++) { const nt = score.notations[i]; if (nt.notes && nt.notes.length) ord++; }
  let prevOrd = null, nextOrd = null, barBetween = false, lastNoteOrdAll = -1;
  for (let i = 0; i < score.notations.length; i++) { const nt = score.notations[i]; if (nt.notes && nt.notes.length) lastNoteOrdAll++; }
  let o = ord;
  for (let i = a; i < b; i++) {
    const nt = score.notations[i], cx = (line.bounds.x || 0) + nt.bounds.x + (nt.bounds.width || 0) / 2;
    const isNote = !!(nt.notes && nt.notes.length);
    if (isNote) {
      if (cx < x) { prevOrd = o; barBetween = false; }
      else if (nextOrd == null) nextOrd = o;
      o++;
    } else if (cx < x && prevOrd != null && nextOrd == null && nt.constructor && /Divisio|Bar|DoubleBar|Virgula/i.test(nt.constructor.name)) barBetween = true;
  }
  if (nextOrd == null && prevOrd === lastNoteOrdAll) return null;          // hinter der letzten Note des Stücks: anhängen
  if (prevOrd != null && !barBetween) { const ei = gregOrdinalToEntryIndex(gregEntries, prevOrd); return ei == null ? null : ei + 1; }
  if (nextOrd != null) { const ei = gregOrdinalToEntryIndex(gregEntries, nextOrd); return ei == null ? null : ei; }
  if (prevOrd != null) {                                                    // nach einem Trennstrich am Zeilenende
    let ei = gregOrdinalToEntryIndex(gregEntries, prevOrd); if (ei == null) return null;
    ei++; while (ei < gregEntries.length && gregEntries[ei].type === 'divisio') ei++;
    return ei;
  }
  return null;
}

// Rote Einfügemarke im Notenbild (nach jedem Zeichnen, aus gregRender)
function gregInsMarkDraw(svgEl, score) {
  if (!svgEl) return;
  svgEl.querySelectorAll('.greg-ins-mark').forEach(n => n.remove());
  const at = gregInsAt();
  if (at == null || at >= gregEntries.length || !score || !score.lines) return;
  const si = (typeof _gregCtxtRef !== 'undefined' && _gregCtxtRef && _gregCtxtRef.staffInterval) || 10;
  const ord = gregNoteOrdinalBefore(at);             // Notengruppen davor
  const posOf = n => { let k = -1;
    for (let i = 0; i < score.notations.length; i++) { const nt = score.notations[i]; if (!(nt.notes && nt.notes.length)) continue; k++;
      if (k === n) { const line = score.lines.find(l => i >= l.notationsStartIndex && i < l.notationsStartIndex + l.numNotationsOnLine); return line ? {line, nt, i} : null; } }
    return null; };
  let x, line;
  const prev = ord > 0 ? posOf(ord - 1) : null, next = posOf(ord);
  const divAfterPrev = gregEntries.slice(0, at).reverse().findIndex(e => e.type === 'note') > 0 &&
    gregEntries.slice(0, at).reverse().slice(0, gregEntries.slice(0, at).reverse().findIndex(e => e.type === 'note')).some(e => e.type === 'divisio');
  if (prev && !(next && divAfterPrev && next.line === prev.line)) {
    line = prev.line; x = (line.bounds.x || 0) + prev.nt.bounds.x + (prev.nt.bounds.width || 0) + 0.6 * si;
  } else if (next) { line = next.line; x = (line.bounds.x || 0) + next.nt.bounds.x - 0.6 * si; }
  else return;
  const y0 = line.bounds.y - 4.5 * si, y1 = line.bounds.y + 4.5 * si;
  const ns = 'http://www.w3.org/2000/svg', r = document.createElementNS(ns, 'rect');
  r.setAttribute('class', 'greg-ins-mark');
  r.setAttribute('x', (x - 1.2).toFixed(1)); r.setAttribute('y', y0.toFixed(1));
  r.setAttribute('width', '2.4'); r.setAttribute('height', (y1 - y0).toFixed(1));
  r.setAttribute('fill', '#d0281e'); r.setAttribute('opacity', '0.85'); r.style.pointerEvents = 'none';
  svgEl.appendChild(r);
}

// Neumentyp aus dem Tonverlauf (Build 448): wird beim Übernehmen gesetzt, wenn die Tonzahl nicht mehr zum gewählten Typ passt –
// vorher fiel z. B. eine im Feld «Töne» ergänzte zweite Note eines Punctum beim Speichern stillschweigend weg.
function gregNeumeFromPitches(ps) {
  const p = (ps || []).map(c => 'abcdefghijklm'.indexOf(String(c).toLowerCase()));
  const d = p.slice(1).map((v, i) => Math.sign(v - p[i])).join('');
  if (p.length === 1) return 'punctum';
  return ({'1': 'podatus', '-1': 'clivis',
    '1-1': 'torculus', '-11': 'porrectus', '11': 'scandicus', '-1-1': 'climacus',
    '11-1': 'scandicus_flexus', '1-11': 'torculus_resupinus', '-11-1': 'porrectus_flexus', '1-1-1': 'pes_subpunctis'})[d]
    || (/^(-1)+$/.test(d) ? 'climacus' : null);
}
function gregNeumeFits(neume, n) {
  if (typeof NEUME_OPEN_ENDED !== 'undefined' && NEUME_OPEN_ENDED.includes(neume)) return n >= (NEUME_PITCHES[neume] || 1);
  return (NEUME_PITCHES[neume] || 1) === n;
}
