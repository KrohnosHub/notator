// ── Freitext ─────────────────────────────────────────────────────
const CL_SVGNS = 'http://www.w3.org/2000/svg';
function clTuneSvg(t) {
  const d = document.querySelector('#cl-score .cl-tune[data-tune="' + t + '"]');
  return d ? d.querySelector('svg') : null;
}
function clSvgPoint(svg, clientX, clientY) {
  const pt = svg.createSVGPoint(); pt.x = clientX; pt.y = clientY;
  const m = svg.getScreenCTM();
  return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
}
function clSvgHeight(svg) {
  const vb = svg.viewBox && svg.viewBox.baseVal;
  return (vb && vb.height) || parseFloat(svg.getAttribute('height')) || svg.getBBox().height;
}

function clDrawTexts() {
  document.querySelectorAll('#cl-score text.cl-text').forEach(n => n.remove());
  clState.texts.forEach(tx => {
    const svg = clTuneSvg(tx.t || 0) || clTuneSvg(0);
    if (!svg) return;
    const el = document.createElementNS(CL_SVGNS, 'text');
    el.setAttribute('class', 'cl-text');
    el.setAttribute('data-id', tx.id);
    el.setAttribute('x', tx.x); el.setAttribute('y', tx.y);
    el.setAttribute('font-family', '"Palatino Linotype", Palatino, serif');
    el.setAttribute('font-size', tx.size || 14);
    el.setAttribute('font-style', 'italic');
    el.setAttribute('font-weight', 'normal');
    el.setAttribute('fill', '#7a3b1e');
    el.setAttribute('stroke', 'none'); // abcjs-SVG-Wurzel hat stroke=currentColor
    el.style.cursor = 'move';
    el.style.userSelect = 'none';
    String(tx.text).split('\n').forEach((line, i) => {
      const sp = document.createElementNS(CL_SVGNS, 'tspan');
      sp.setAttribute('x', tx.x);
      if (i > 0) sp.setAttribute('dy', '1.2em');
      sp.textContent = line;
      el.appendChild(sp);
    });
    el.addEventListener('pointerdown', ev => clTextDragStart(ev, tx, el, svg));
    el.addEventListener('dblclick', ev => { ev.preventDefault(); clEditText(tx.id); });
    el.appendChild(document.createElementNS(CL_SVGNS, 'title')).textContent = 'Ziehen zum Verschieben · Doppelklick zum Bearbeiten/Löschen';
    svg.appendChild(el);
  });
}

function clTextDragStart(ev, tx, el, svg) {
  ev.preventDefault();
  const p0 = clSvgPoint(svg, ev.clientX, ev.clientY);
  const ox = tx.x, oy = tx.y;
  const h = clSvgHeight(svg);
  const vy = (svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.y) || 0;
  const w = (svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width) || parseFloat(svg.getAttribute('width')) || 800;
  let tw = 0; try { tw = el.getBBox().width; } catch (e) {}
  el.setPointerCapture && el.setPointerCapture(ev.pointerId);
  const move = e => {
    const p = clSvgPoint(svg, e.clientX, e.clientY);
    tx.x = Math.round(Math.max(2, Math.min(w - tw - 2, ox + p.x - p0.x)));
    tx.y = Math.round(Math.max(vy + 10, Math.min(vy + h - 4, oy + p.y - p0.y)));
    el.setAttribute('x', tx.x); el.setAttribute('y', tx.y);
    el.querySelectorAll('tspan').forEach(sp => sp.setAttribute('x', tx.x));
  };
  const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
}

function clAddText() {
  const text = window.prompt('Notiz eingeben (\\n für Zeilenumbruch):', '');
  if (!text || !text.trim()) return;
  // Mitte des sichtbaren Bereichs im passenden Stück-SVG
  const wrap = document.getElementById('cl-score-wrap');
  const r = wrap.getBoundingClientRect();
  const cy = r.top + Math.min(r.height / 2, 120), cx = r.left + Math.min(r.width / 2, 300);
  let t = 0, svg = clTuneSvg(0);
  document.querySelectorAll('#cl-score .cl-tune').forEach(d => {
    const b = d.getBoundingClientRect();
    if (cy >= b.top && cy <= b.bottom) { t = parseInt(d.getAttribute('data-tune'), 10); svg = d.querySelector('svg'); }
  });
  if (!svg) return;
  const p = clSvgPoint(svg, cx, cy);
  clState.texts.push({ id: 'ct' + Date.now(), t, x: Math.round(p.x), y: Math.round(p.y), text: text.replace(/\\n/g, '\n'), size: 14 });
  clDrawTexts();
}

function clEditText(id) {
  const tx = clState.texts.find(x => x.id === id);
  if (!tx) return;
  const v = window.prompt('Notiz bearbeiten (leer lassen = löschen, \\n = Zeilenumbruch):', tx.text.replace(/\n/g, '\\n'));
  if (v === null) return;
  if (!v.trim()) clState.texts = clState.texts.filter(x => x.id !== id);
  else tx.text = v.replace(/\\n/g, '\n');
  clDrawTexts();
}

