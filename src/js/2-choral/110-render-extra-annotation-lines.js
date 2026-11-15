// ── Render extra annotation lines (multiple annotation: headers) ──
function gregRenderExtraAnnotations(svgEl, extraLines) {
  if (!extraLines || !extraLines.length) return;
  const ctxt = _gregCtxtRef;
  const si = ctxt ? ctxt.staffInterval : 12;
  const ns = 'http://www.w3.org/2000/svg';
  svgEl.querySelectorAll('.greg-extra-ann').forEach(e => e.remove());

  const annFs = ctxt ? ctxt.annotationTextSize : si * 1.4;
  const lineH = annFs * 1.4;

  // Find exsurge annotation by class (exsurge sets class="annotation ...")
  let annX, annTopY;
  // Find the annotation text element - it has class starting with "annotation"
  // In exsurge SVG, it's a <text> element directly or inside a transformed <g>
  const exAnnEl = svgEl.querySelector('text[class^="annotation"], text[class*=" annotation"]');
  let annAnchor = 'start';
  if (exAnnEl) {
    // Position aus den SVG-Attributen (+ translate der Eltern) – funktioniert
    // auch, wenn die Notenansicht gerade ausgeblendet ist (z. B. Handy-Details),
    // wo getBoundingClientRect nur Nullen liefert.
    annX = parseFloat(exAnnEl.getAttribute('x') || 0);
    annTopY = parseFloat(exAnnEl.getAttribute('y') || 0);
    annAnchor = exAnnEl.getAttribute('text-anchor') || 'start';
    if ((exAnnEl.getAttribute('dominant-baseline') || '') !== 'hanging') annTopY -= annFs * 0.8;
    for (let n = exAnnEl.parentNode; n && n !== svgEl && n.getAttribute; n = n.parentNode) {
      const tr = n.getAttribute('transform') || '';
      const m = /translate\(\s*([-\d.e]+)[\s,]*([-\d.e]+)?/.exec(tr);
      if (m) { annX += parseFloat(m[1]) || 0; annTopY += parseFloat(m[2]) || 0; }
    }
  } else {
    // Fallback from viewBox
    const vb = svgEl.getAttribute('viewBox');
    const [vx, vy] = vb ? vb.split(/[\s,]+/).map(Number) : [0, 0];
    const topPad = svgEl._topPad || 80;
    annX = vx + 36;
    annTopY = vy + topPad - si * 3;
  }

  const g = document.createElementNS(ns, 'g');
  g.setAttribute('class', 'greg-extra-ann');

  // lineH: use annFs * 1.15 (tight, font-size-proportional, not 1.4×)
  const tightLineH = annFs * 1.15; // tight: one font-size gap between annotation lines
  extraLines.forEach(function(line, i) {
    // Place just above exsurge annotation, tight spacing
    const topY = annTopY - (extraLines.length - i) * tightLineH;
    const txt = document.createElementNS(ns, 'text');
    txt.setAttribute('x', String(annX));
    txt.setAttribute('y', String(topY));
    txt.setAttribute('dominant-baseline', 'hanging');
    txt.setAttribute('text-anchor', annAnchor);
    txt.setAttribute('font-family', ctxt ? ctxt.annotationTextFont : 'serif');
    txt.setAttribute('font-size', String(annFs));
    txt.setAttribute('fill', '#1a1a0a');
    txt.textContent = line;
    g.appendChild(txt);
  });
  svgEl.appendChild(g);
}

// ── Word-wrap helper using canvas measureText ────────────────────
function gregWordWrap(text, fontStr, maxWidth) {
  const c = document.createElement('canvas');
  const cx = c.getContext('2d');
  cx.font = fontStr;
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (cx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

// ── Detect left x of chant content (aligns with second staff line) ──
function gregGetContentLeftX(svgEl, vx, pad) {
  try {
    // Find all horizontal STAFF lines (y1 === y2) — explicitly exclude ledgerLine
    // elements, which are also horizontal but belong to individual notes above/below
    // the staff and would otherwise be mistaken for a "second chant line".
    const lines = Array.from(svgEl.querySelectorAll('line.staffLine'));
    const linesFiltered = lines.length ? lines : Array.from(svgEl.querySelectorAll('line')).filter(l => {
      const y1 = parseFloat(l.getAttribute('y1'));
      const y2 = parseFloat(l.getAttribute('y2'));
      const cls = l.getAttribute('class') || '';
      return Math.abs(y1 - y2) < 1 && !cls.includes('ledger'); // horizontal, not a ledger line
    });
    const linesUse = linesFiltered;
    if (linesUse.length === 0) return vx + pad;
    // Group by y-position (cluster within 50px = same staff system)
    const ys = linesUse.map(l => parseFloat(l.getAttribute('y1')));
    const minY = Math.min(...ys);
    // Find lines NOT in first staff system (y > minY + 50)
    const line2 = linesUse.filter(l => parseFloat(l.getAttribute('y1')) > minY + 50);
    if (line2.length > 0) {
      const x1s = line2.map(l => parseFloat(l.getAttribute('x1')));
      return Math.min(...x1s);
    }
    // Fallback: use first line's x1 (single-line piece)
    const x1s = linesUse.map(l => parseFloat(l.getAttribute('x1')));
    return Math.min(...x1s);
  } catch(e) { return vx + pad; }
}

