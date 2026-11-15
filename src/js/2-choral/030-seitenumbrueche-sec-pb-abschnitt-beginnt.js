// ── Seitenumbrüche: sec.pb = Abschnitt beginnt auf neuer Seite; entry.pb = neue Seite vor der Zeile, in der diese Note steht ──
function gregNoteLineIndex(score, ordinal) {
  if (!score || !score.notations || !score.lines || ordinal == null) return null;
  let n = 0;
  for (let i = 0; i < score.notations.length; i++) {
    const nt = score.notations[i];
    if (!(nt.notes && nt.notes.length)) continue;
    if (n === ordinal) {
      for (let li = 0; li < score.lines.length; li++) { const l = score.lines[li]; if (i >= l.notationsStartIndex && i < l.notationsStartIndex + l.numNotationsOnLine) return li; }
      return null;
    }
    n++;
  }
  return null;
}
// Zeilenindizes (im Layout von `score`), vor denen ein manueller Umbruch gesetzt ist
function gregBreakLinesFor(entries, clefGabc, clefRaw, score, ctxt) {
  const out = [];
  (entries || []).forEach((e, i) => {
    if (!e || e.type !== 'note' || !e.pb || !e.pitches || !e.pitches.length) return;
    const ord = gregCountNoteBearingNotations(gregEntriesToBody(entries.slice(0, i), clefGabc, clefRaw || ''), ctxt);
    const li = ord == null ? null : gregNoteLineIndex(score, ord);
    if (li != null && out.indexOf(li) < 0) out.push(li);
  });
  return out.sort((a, b) => a - b);
}
function gregPagePreviewOn() { try { return localStorage.getItem('ntPagePrev') === '1'; } catch (e) { return false; } }
function gregPagePreviewToggle() {
  const on = !gregPagePreviewOn();
  try { localStorage.setItem('ntPagePrev', on ? '1' : '0'); } catch (e) {}
  gregPageMarksUi();
  gregPageMarksRedraw();
  gregGst(on ? 'Seitenumbruch-Vorschau an (ungefähre Lage der PDF-Seiten).' : 'Seitenumbruch-Vorschau aus.');
}
function gregPageMarksUi() {
  document.querySelectorAll('.nt-pgprev-btn').forEach(b => { const on = gregPagePreviewOn(); b.style.background = on ? '#3d6b35' : ''; b.style.color = on ? '#fff' : ''; });
}
function gregPageMarksRedraw() {
  document.querySelectorAll('.greg-pgmark').forEach(m => m.remove());
  gregPageMarksUi();
  if (!gregPagePreviewOn()) return;
  const items = [];
  const organ = !!window._ntTab && window._ntTab !== 'greg';
  if (organ) {
    Array.from(document.querySelectorAll('#cl-score .cl-tune')).forEach((d, ti) => {
      const svg = d.querySelector('svg'); if (!svg) return;
      const groups = {};
      svg.querySelectorAll('[class*="abcjs-l"]').forEach(n => {
        const m = String(n.getAttribute('class') || '').match(/abcjs-l(\d+)/); if (!m) return;
        const b = n.getBoundingClientRect(); if (!b.width && !b.height) return;
        const z = groups[m[1]] || (groups[m[1]] = { top: Infinity, bottom: -Infinity });
        z.top = Math.min(z.top, b.top); z.bottom = Math.max(z.bottom, b.bottom);
      });
      const keys = Object.keys(groups);
      const secPb = !!(window._gregMultiSection && gregSections.length > 1 && gregSections[ti] && gregSections[ti].pb);
      items.push({ svg, host: d, abs: keys.map(k => groups[k]), brk: (d._pbLineNums || []).map(n => keys.indexOf(String(n))).filter(i => i >= 0), pb: secPb && ti > 0 });
    });
  } else if (window._gregMultiSection && gregSections.length) {
    gregSections.forEach((sec, i) => {
      const box = document.getElementById('greg-secbox-' + sec.id);
      const content = box && box.querySelector('.greg-sec-content');
      const svg = content && content.querySelector('svg');
      if (!svg || sec.hidden) return;
      const act = i === gregActiveIdx;
      items.push({ svg, host: content, entries: act ? gregEntries : sec.entries, clef: GREG_CLEF_MAP[sec.clef] || 'c3', clefRaw: sec.clefRaw || '',
        score: act ? _gregScore : content._pbScore, ctxt: act ? _gregCtxtRef : content._pbCtxt, pb: !!sec.pb && i > 0 });
    });
  } else {
    const wrap = document.getElementById('greg-svg-wrap'), svg = wrap && wrap.querySelector('svg');
    if (svg) items.push({ svg, host: document.getElementById('greg-svg-original-slot') || wrap.parentElement, entries: gregEntries, clef: gregClefVal, clefRaw: gregClefRaw, score: _gregScore, ctxt: _gregCtxtRef, pb: false });
  }
  if (!items.length) return;
  const PX_PER_MM = 96 / 25.4, targetW = 210 * PX_PER_MM - 48, contentH = 297 * PX_PER_MM - 48, EPS = 0.5;
  let y = 0; const zones = [], forced = [];   // forced: {y}
  items.forEach(it => {
    const r = it.svg.getBoundingClientRect();
    it.r = r; it.k = r.width ? targetW / r.width : 1; it.y0 = y; it.h = r.height * it.k;
    const raw = it.abs || Array.from(it.svg.querySelectorAll('g.chantLine')).map(g => { const b = g.getBoundingClientRect(); return { top: b.top, bottom: b.bottom }; });
    const lines = raw.map(b => ({ top: (b.top - r.top) * it.k - 4, bottom: (b.bottom - r.top) * it.k + 4 }));
    if (it.pb && y > 0.5) forced.push(y);
    let brk = it.brk || []; if (!it.abs) { try { brk = gregBreakLinesFor(it.entries, it.clef, it.clefRaw, it.score, it.ctxt); } catch (e) {} }
    brk.forEach(li => { if (li === 0) { if (y > 0.5) forced.push(y); } else if (lines[li]) forced.push(y + lines[li].top); });
    { let mt = Infinity; lines.forEach(z => { if (z.top < mt) mt = z.top; });
      lines.forEach(z => zones.push({ top: y + (z.top === mt ? Math.min(0, z.top) : z.top), bottom: y + z.bottom })); }
    y += it.h;
  });
  const totalH = y, breaks = [];
  let cursor = 0;
  while (cursor < totalH - EPS) {
    let end = Math.min(cursor + contentH, totalH);
    const fb = forced.find(b => b > cursor + EPS && b < end - EPS);
    let manual = false;
    if (fb) { end = fb; manual = true; }
    else for (const z of zones) { if (z.top > cursor + EPS && end > z.top + EPS && end < z.bottom - EPS) { end = z.top; break; } }
    if (end <= cursor + EPS) end = Math.min(cursor + contentH, totalH);
    if (end < totalH - EPS) breaks.push({ y: end, manual });
    cursor = end;
  }
  breaks.forEach((b, n) => {
    const it = items.find(x => b.y >= x.y0 - EPS && b.y < x.y0 + x.h - EPS) || items[items.length - 1];
    const hr = it.host.getBoundingClientRect();
    const top = (it.r.top - hr.top) + Math.max(0, (b.y - it.y0)) / it.k;
    const m = document.createElement('div');
    m.className = 'greg-pgmark';
    m.style.cssText = 'position:absolute;left:0;right:0;top:' + Math.round(top - 3) + 'px;height:0;border-top:2px ' + (b.manual ? 'solid #c0392b' : 'dashed #2a7ab8') + ';pointer-events:none;z-index:5';
    const lb = document.createElement('span');
    lb.textContent = 'Seite ' + (n + 2) + (b.manual ? ' · manuell' : '');
    lb.style.cssText = 'position:absolute;right:4px;top:2px;font:10px system-ui,sans-serif;color:' + (b.manual ? '#c0392b' : '#2a7ab8') + ';background:rgba(255,255,255,.85);padding:0 4px;border-radius:2px';
    m.appendChild(lb);
    it.host.appendChild(m);
  });
}
(function() {
  let t = null;
  const kick = () => { clearTimeout(t); t = setTimeout(() => { try { gregPageMarksRedraw(); } catch (e) { console.warn('pagemarks', e); } }, 300); };
  const start = () => {
    const w = document.getElementById('greg-canvas-wrap'); if (!w || w._pgObs) return;
    const mkObs = () => new MutationObserver(ms => {
      if (!gregPagePreviewOn()) return;
      if (ms.every(m => Array.from(m.addedNodes).concat(Array.from(m.removedNodes)).every(n => n.classList && n.classList.contains('greg-pgmark')))) return;
      kick();
    });
    const obs = mkObs(); obs.observe(w, { childList: true, subtree: true });
    w._pgObs = obs;
    const cs = document.getElementById('cl-score'); if (cs) mkObs().observe(cs, { childList: true, subtree: true });
    window.addEventListener('resize', kick);
    gregPageMarksUi(); if (gregPagePreviewOn()) kick();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})();

