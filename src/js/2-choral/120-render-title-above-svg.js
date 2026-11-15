// ── Render title above SVG ───────────────────────────────────────
// Call this BEFORE addSvgPadding so we can set the right topPad.
// Returns the required topPad value.
function gregInitialLinesOf(g) { return /(^|\n)\s*notator-initial-lines:\s*2/i.test(String(g || '').split('%%')[0]) ? 2 : 1; }
// Folgeabschnitt mit Titel/Untertitel: ca. 0.5 cm mehr Abstand zum vorigen
// Abschnitt (Nutzerwunsch 2026-10-14); ohne Titel bleibt der Abschnittsabstand.
const GREG_SEC_TITLE_EXTRA = 19;
function gregSecTitleExtra(idx, title, subtitle) {
  return (idx > 0 && (String(title || '').trim() || String(subtitle || '').trim())) ? GREG_SEC_TITLE_EXTRA : 0;
}
function gregSecGap() { const el = document.getElementById('gs-secgap'); const v = el ? parseFloat(el.value) : 16; return isFinite(v) ? Math.max(0, v) : 16; }
function gregCommentaryText(overrideComm) {
  return (overrideComm !== undefined ? overrideComm : (document.getElementById('greg-commentary')||{value:''}).value || '').trim();
}
function gregCalcTitlePad(svgW, overrideTitle, overrideSubtitle, overrideComm, extraTop) {
  const title    = (overrideTitle !== undefined ? overrideTitle : (document.getElementById('greg-title')||{value:''}).value).trim();
  const bodyText = (overrideSubtitle !== undefined ? overrideSubtitle : (document.getElementById('greg-subtitle')||{value:''}).value);
  const comm     = gregCommentaryText(overrideComm);
  const ctxt = _gregCtxtRef;
  const si = ctxt ? ctxt.staffInterval : 12;
  const fs    = si * 3.5;
  const subFs = Math.round(fs * 0.5);
  const subLineH = subFs * 1.4;
  const pad = 32;
  const textW = svgW - 2 * pad; // usable width for wrapping
  if (!title && !bodyText.trim() && !comm) return gregSecGap(); // kein Titel: nur der einstellbare Abschnittsabstand

  let totalH = 2 + (extraTop || 0); // top margin inside padding (+ Zusatzabstand Folgeabschnitt)
  if (comm) totalH += subFs * 1.3; // Kommentarzeile rechts über dem System
  if (title) totalH += fs * 1.1 * gregWordWrap(title, fs + "px 'Crimson Text', Palatino, serif", textW - 30).length;

  if (bodyText.trim()) {
    const subGap = 6;
    const rawLines = bodyText.split('\n');
    let wrappedCount = 0;
    const fontStr = subFs + 'px Palatino, serif';
    rawLines.forEach(function(rl) {
      const wl = gregWordWrap(rl || ' ', fontStr, textW);
      wrappedCount += wl.length;
    });
    totalH += subGap + wrappedCount * subLineH;
  }

  const gap = 25; // ~0.65cm above staff
  return Math.max(totalH + gap, pad);
}

function gregRenderTitle(svgEl, overrideTitle, overrideSubtitle, overrideComm) {
  const title    = (overrideTitle !== undefined ? overrideTitle : (document.getElementById('greg-title')||{value:''}).value).trim();
  const bodyText = (overrideSubtitle !== undefined ? overrideSubtitle : (document.getElementById('greg-subtitle')||{value:''}).value);
  const comm     = gregCommentaryText(overrideComm);
  if (!title && !bodyText.trim() && !comm) return;
  if (!svgEl) return;

  const ctxt = _gregCtxtRef;
  const si   = ctxt ? ctxt.staffInterval : 12;
  const fs    = si * 3.5;
  const subFs = Math.round(fs * 0.5);
  const subLineH = subFs * 1.4;
  const subGap   = 6;
  const ns  = 'http://www.w3.org/2000/svg';
  const vb  = svgEl.getAttribute('viewBox');
  const [vx, vy0, vw] = vb ? vb.split(/[\s,]+/).map(Number) : [0, 0, 700];
  const vy = vy0 + (svgEl._titleShift || 0); // Zusatzabstand über dem Titel (Folgeabschnitt)
  const topPad = svgEl._topPad || (32 * 2.5);
  const pad  = 32;
  // Detect left edge of second chant line from SVG staff lines
  const titleX = gregGetContentLeftX(svgEl, vx, pad);
  const textW  = vw - pad - (titleX - vx);
  const fontStr = subFs + 'px Palatino, serif';

  // Title baseline: fixed just below top of padding area
  const titleY = vy + 2 + fs; // small top margin + font ascent

  // Remove previous overlays
  svgEl.querySelectorAll('.greg-title-overlay').forEach(e => e.remove());
  const g = document.createElementNS(ns, 'g');
  g.setAttribute('class', 'greg-title-overlay');

  // Langer Titel: automatisch auf mehrere Zeilen umbrechen (statt rechts abzuschneiden)
  const titleLines = title ? gregWordWrap(title, fs + "px 'Crimson Text', Palatino, serif", textW) : [];
  titleLines.forEach(function(tl, ti) {
    const txt = document.createElementNS(ns, 'text');
    txt.setAttribute('x', String(titleX));
    txt.setAttribute('y', String(titleY + ti * fs * 1.1));
    txt.setAttribute('text-anchor', 'start');
    txt.setAttribute('font-family', "'Crimson Text', Palatino, serif");
    txt.setAttribute('font-size', String(fs));
    txt.setAttribute('fill', '#1a1a0a');
    txt.textContent = tl;
    g.appendChild(txt);
  });
  const titleExtraH = Math.max(0, titleLines.length - 1) * fs * 1.1;

  if (bodyText.trim()) {
    let curY = (title ? titleY + titleExtraH + fs * 0.15 + subGap : vy + 2) + subFs;
    const rawLines = bodyText.split('\n');
    rawLines.forEach(function(rl) {
      const wlines = gregWordWrap(rl || '', fontStr, textW);
      wlines.forEach(function(line) {
        const stxt = document.createElementNS(ns, 'text');
        stxt.setAttribute('x', String(titleX));
        stxt.setAttribute('y', String(curY));
        stxt.setAttribute('text-anchor', 'start');
        stxt.setAttribute('font-family', "'Crimson Text', Palatino, serif");
        stxt.setAttribute('font-size', String(subFs));
        stxt.setAttribute('fill', '#2a2a1a');
        stxt.textContent = line;
        g.appendChild(stxt);
        curY += subLineH;
      });
    });
  }

  if (comm) {
    // Gregorio «commentary»: rechtsbündig, kursiv, knapp über dem ersten System
    const ctx = document.createElementNS(ns, 'text');
    ctx.setAttribute('x', String(vx + vw - pad));
    ctx.setAttribute('y', String(vy + topPad - 6));
    ctx.setAttribute('text-anchor', 'end');
    ctx.setAttribute('font-family', "'Crimson Text', Palatino, serif");
    ctx.setAttribute('font-style', 'italic');
    ctx.setAttribute('font-size', String(Math.round(subFs * 0.9)));
    ctx.setAttribute('fill', '#2a2a1a');
    ctx.setAttribute('class', 'greg-commentary');
    ctx.textContent = comm;
    g.appendChild(ctx);
  }

  svgEl.appendChild(g);
}

