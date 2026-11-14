// ── Vorschau beim Platzieren (Schatten der Note + Tonbuchstabe) ──
function gregGhostRemove(svgEl) { const g = (svgEl || document).querySelector('#greg-ghost'); if (g) g.remove(); }
// Touch (Handy/Tablet): Finger auf der Notenlinie zeigt den Schatten samt
// Hilfslinie über die ganze Zeile und Tonbuchstaben oberhalb des Fingers;
// Loslassen setzt die Neume genau dort. Ausserhalb der Notenlinien scrollt
// der Finger wie gewohnt.
const GREG_AIM_DX = 56; // px: Schatten erscheint links neben dem Finger, dort wird gesetzt
function gregTouchAim(svgEl) {
  // Kurz tippen = Neume an der Fingerstelle setzen (wie Mausklick);
  // wischen = scrollen; gedrückt halten (ca. 0,3 s) = Zielen mit Schatten
  // links neben dem Finger, Loslassen setzt dort (Nutzerwunsch 2026-10-26).
  let aim = null, hold = null;
  const pt = (x, y) => { const p = svgEl.createSVGPoint(); p.x = x; p.y = y; return p.matrixTransform(svgEl.getScreenCTM().inverse()); };
  const cancelHold = () => { if (hold) { clearTimeout(hold.timer); hold = null; } };
  svgEl.style.webkitTouchCallout = 'none'; svgEl.style.userSelect = 'none'; svgEl.style.webkitUserSelect = 'none';
  svgEl.addEventListener('contextmenu', ev => { if (aim || hold) ev.preventDefault(); });
  svgEl.addEventListener('touchstart', ev => {
    aim = null; cancelHold();
    if (ev.touches.length !== 1 || !_gregScore || !_gregCtxtRef) return;
    const panel = document.getElementById('greg-panel'); if (!panel || panel.classList.contains('greg-view')) return;
    if (typeof ntPlay !== 'undefined' && ntPlay.pick === 'greg') return;
    const t = ev.touches[0], Q = pt(t.clientX, t.clientY);
    if (!_gregPending && gregFindEntryAtNativePoint(_gregScore, gregEntries, Q.x, Q.y, _gregCtxtRef) != null) return; // bestehende Note: Tippen öffnet sie
    const si = _gregCtxtRef.staffInterval, lines = _gregScore.lines || [];
    if (!lines.some(ln => Math.abs(Q.y - ln.bounds.y) < si * 4.5)) return;
    hold = { x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY };
    hold.timer = setTimeout(() => {
      if (!hold) return;
      aim = { x: hold.x - GREG_AIM_DX, y: hold.y }; hold = null;
      gregGhostShow(svgEl, pt(aim.x, aim.y), true);
      try { navigator.vibrate && navigator.vibrate(15); } catch (e) {}
    }, 300);
  }, { passive: true });
  svgEl.addEventListener('touchmove', ev => {
    if (hold) {
      const t = ev.touches[0];
      if (ev.touches.length !== 1 || Math.hypot(t.clientX - hold.x0, t.clientY - hold.y0) > 8) cancelHold(); // wischen -> scrollen
      else { hold.x = t.clientX; hold.y = t.clientY; }
      return;
    }
    if (!aim) return;
    if (ev.touches.length !== 1) { aim = null; gregGhostRemove(svgEl); return; }
    ev.preventDefault();
    const t = ev.touches[0]; aim = { x: t.clientX - GREG_AIM_DX, y: t.clientY };
    gregGhostShow(svgEl, pt(aim.x, aim.y), true);
  }, { passive: false });
  svgEl.addEventListener('touchend', ev => {
    cancelHold(); // kurzer Tipp: normaler Klick setzt an der Fingerstelle
    if (!aim) return;
    ev.preventDefault();
    const a = aim; aim = null;
    gregGhostRemove(svgEl);
    window._gregForcePlace = true; // gezielt gesetzt: auch über einer bestehenden Note eine neue setzen
    try { gregHandleClick(svgEl, a.x, a.y); } finally { window._gregForcePlace = false; }
  }, { passive: false });
  svgEl.addEventListener('touchcancel', () => { cancelHold(); aim = null; gregGhostRemove(svgEl); });
}
function gregGhostShow(svgEl, svgP, touch) {
  if ((gregIsMobileViewport() && !touch) || !_gregScore || !_gregCtxtRef) return;
  const panel = document.getElementById('greg-panel'); if (panel && panel.classList.contains('greg-view')) { gregGhostRemove(svgEl); return; }
  const lines = _gregScore.lines; if (!lines || !lines.length) return;
  let best = lines[0], bd = Infinity;
  for (const ln of lines) { const d = Math.abs(svgP.y - ln.bounds.y); if (d < bd) { bd = d; best = ln; } }
  const si = _gregCtxtRef.staffInterval;
  const sp = Math.round(-(svgP.y - best.bounds.y) / si);
  const letter = staffPosToGabc(sp);
  if (sp + 6 < 0 || sp + 6 > 12) { gregGhostRemove(svgEl); return; }
  const y = best.bounds.y - sp * si;
  const NS = 'http://www.w3.org/2000/svg';
  let g = svgEl.querySelector('#greg-ghost');
  if (!g) {
    g = document.createElementNS(NS, 'g'); g.id = 'greg-ghost'; g.setAttribute('pointer-events', 'none');
    const r = document.createElementNS(NS, 'rect'); r.setAttribute('fill', '#2a6ac0'); r.setAttribute('fill-opacity', '0.45'); r.setAttribute('rx', si * 0.15);
    const t = document.createElementNS(NS, 'text'); t.setAttribute('fill', '#2a6ac0'); t.setAttribute('font-family', 'system-ui,sans-serif'); t.setAttribute('font-weight', 'bold');
    const l = document.createElementNS(NS, 'line'); l.setAttribute('stroke', '#2a6ac0'); l.setAttribute('stroke-opacity', '0.5'); l.setAttribute('stroke-dasharray', '3 3');
    g.appendChild(l); g.appendChild(r); g.appendChild(t); svgEl.appendChild(g);
  }
  const [l, r, t] = g.childNodes;
  const w = si * 1.9, h = si * 1.7;
  r.setAttribute('x', svgP.x - w / 2); r.setAttribute('y', y - h / 2); r.setAttribute('width', w); r.setAttribute('height', h);
  l.setAttribute('x1', svgP.x - w * 1.6); l.setAttribute('x2', svgP.x + w * 1.6); l.setAttribute('y1', y); l.setAttribute('y2', y);
  l.style.display = (sp % 2 === 0) ? 'none' : ''; // Zwischenraum: Hilfsstrich zeigt die Höhe
  if (touch) { // Finger verdeckt die Stelle: Hilfslinie über die ganze Zeile
    const vb = svgEl.viewBox && svgEl.viewBox.baseVal;
    l.setAttribute('x1', vb ? vb.x : 0); l.setAttribute('x2', vb ? vb.x + vb.width : svgP.x + 400);
    l.style.display = ''; l.setAttribute('stroke-width', si * 0.25);
  } else l.setAttribute('stroke-width', 1);
  const nd = NEUME_DEFS.find(n => n.val === (document.getElementById('greg-neume-sel') || {}).value) || NEUME_DEFS[0];
  const step = _gregPending ? ' · Ton ' + (_gregPending.pitches.length + 1) + '/' + (_gregPending._need || '') : '';
  t.textContent = letter + '  ' + nd.label + step;
  if (touch) { t.setAttribute('text-anchor', 'end'); t.setAttribute('x', svgP.x + w * 0.6); t.setAttribute('y', y - si * 3.2); t.setAttribute('font-size', si * 2.4); } // links über dem Schatten, nicht unter dem Finger
  else { t.setAttribute('text-anchor', 'start'); t.setAttribute('x', svgP.x + w * 0.9); t.setAttribute('y', y - h * 0.7); t.setAttribute('font-size', si * 1.7); }
}

