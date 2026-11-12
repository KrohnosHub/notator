// ── Greg PDF background ──────────────────────────────────────────
let _gregPdfDoc = null, _gregPdfPage = 1;

// Scans a rendered page canvas for individual chant staff systems (4
// roughly-evenly-spaced horizontal lines) and returns their vertical
// extent in that canvas's own pixel coordinates, each padded to include
// the lyric text underneath. This exists because sending a whole page as
// one image gives the AI very little effective resolution per neume —
// each system crop, cut out of that same render afterward (see
// gregCropCanvasBand), lets it actually see the fine
// vertical spacing between note positions instead of guessing from a
// handful of pixels.
//
// Detection approach: for each row, count how many pixels are "dark"
// (a proxy for ink). A staff line row has a MUCH higher dark-pixel count
// than a body-text row, since it's ink spread across most of the printed
// width rather than sparse letter shapes — this held up in practice even
// though these staff lines are thin/dashed rather than one solid stroke,
// where an earlier "longest continuous dark run" approach completely
// failed to find anything (validated both ways against real rendered
// pages before picking this one). Four such rows close together with
// roughly equal spacing = one staff. Gracefully returns [] if nothing
// matching that pattern is found (atypical layout, very light scan,
// etc.) — callers fall back to the whole-page image.
function gregDetectStaffBands(ctx, width, height) {
  const data = ctx.getImageData(0, 0, width, height).data;
  const darkThreshold = 150; // 0-255 grayscale
  const rowDarkCount = new Array(height).fill(0);
  let peakDarkCount = 0;
  for (let y = 0; y < height; y++) {
    let count = 0;
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x++) {
      const i = rowOffset + x * 4;
      const gray = (data[i] + data[i+1] + data[i+2]) / 3;
      if (gray < darkThreshold) count++;
    }
    rowDarkCount[y] = count;
    if (count > peakDarkCount) peakDarkCount = count;
  }
  // Adaptive threshold: a real staff-line row is close to this page's OWN
  // darkest row (staff lines are normally the single most ink-dense rows
  // on a chant page), rather than assuming a fixed fraction of the raw
  // page width — that fixed-fraction version was validated against one
  // rendering pipeline (poppler/pdftoppm) offline, but this app's actual
  // renderer (pdf.js + <canvas>) may rasterize thin/dashed lines with
  // different antialiasing, and a threshold tied to the page's own
  // observed peak adapts automatically either way.
  const darkCountThreshold = Math.max(width * 0.15, peakDarkCount * 0.55);

  // Cluster consecutive/near rows that clear the threshold into discrete lines
  const lines = [];
  let clusterStart = null, lastY = null;
  for (let y = 0; y < height; y++) {
    if (rowDarkCount[y] > darkCountThreshold) {
      if (lastY === null || y - lastY > 5) {
        if (clusterStart !== null) lines.push((clusterStart + lastY) / 2);
        clusterStart = y;
      }
      lastY = y;
    }
  }
  if (clusterStart !== null) lines.push((clusterStart + lastY) / 2);
  // NOTE (Runde 52): a page can also contain SINGLE-line "reciting tone"
  // staves — the plain monotone notation used for a versicle/response
  // (℣./℟.) that's commonly printed right after a strophic hymn (confirmed
  // on the actual "Audi benigne conditor" reference PDF: page 2 ends with
  // exactly this — one solid line per "Angelis suis"/"Ut custodiant" pair,
  // no 4-line staff at all). These lines clear the SAME ink-density
  // threshold as a real staff line (same visual weight), but there are
  // only 1 of them, not 4, so the grouping logic below correctly can't
  // form a staff out of them and leaves them unused — every early return
  // below now reports them via monotoneLineYs so the caller can react
  // (currently: stop that piece's system list before them, and let the
  // user know they weren't transcribed, rather than either silently
  // dropping them into an adjacent system's padding zone — the actual
  // observed failure mode, see gregLoadPDF — or mis-transcribing them as
  // if they were ordinary pitched notation, which they are not).
  if (lines.length < 4) return { bands: [], monotoneLineYs: lines.slice() };

  // Group lines into staves of 4 with consistent spacing.
  //
  // IMPORTANT, found via a real test render: a strict "4 consecutive
  // candidates, self-consistent gaps" grouping silently DROPS a staff
  // entirely if even ONE of its 4 lines fails to clear the ink-density
  // threshold — which happens specifically for the FIRST staff next to a
  // large drop-cap letter (the drop cap's own ink pattern can suppress one
  // line's row-count enough to fall short, without affecting the other 3
  // lines). Confirmed on an actual page: the strict version found only 7
  // of 8 real staves, always missing the one beside the drop cap.
  //
  // Fix: first estimate the page's typical line-to-line gap from ALL
  // plausible small gaps between candidates (robust even with a few
  // individual lines missing elsewhere), then template-match each
  // remaining candidate against 3 more expected positions at that gap —
  // accepting the group as a real staff if at least 3 of the 4 expected
  // positions have a matching candidate, and synthesizing the missing 4th
  // at its expected position. Verified this recovers all 8 staves on the
  // same test page.
  const smallGaps = [];
  for (let k = 1; k < lines.length; k++) {
    const g = lines[k] - lines[k-1];
    if (g > 5 && g < 80) smallGaps.push(g); // plausible single-line-gap range
  }
  if (!smallGaps.length) return { bands: [], monotoneLineYs: lines.slice() };
  smallGaps.sort((a, b) => a - b);
  const typicalGap = smallGaps[Math.floor(smallGaps.length / 2)]; // median, robust to outliers

  const used = new Array(lines.length).fill(false);
  const staves = [];
  for (let i = 0; i < lines.length; i++) {
    if (used[i]) continue;
    const base = lines[i];
    const slots = [base, null, null, null];
    const usedIdx = [i, -1, -1, -1];
    let foundCount = 1;
    for (let k = 1; k <= 3; k++) {
      const target = base + k * typicalGap;
      let bestIdx = -1, bestDist = typicalGap * 0.35;
      for (let j = i + 1; j < lines.length; j++) {
        if (used[j]) continue;
        const d = Math.abs(lines[j] - target);
        if (d < bestDist) { bestDist = d; bestIdx = j; }
      }
      if (bestIdx >= 0) { slots[k] = lines[bestIdx]; usedIdx[k] = bestIdx; foundCount++; }
      else slots[k] = target; // synthesize the missing line's expected position
    }
    if (foundCount >= 3) {
      staves.push({ top: slots[0], bottom: slots[3], gap: typicalGap });
      usedIdx.forEach(idx => { if (idx >= 0) used[idx] = true; });
    }
  }
  // Any line never claimed by a 4-line group is a monotoneLineYs candidate
  // (see note above) — collected here BEFORE the early-return below so a
  // page with staves but a lone trailing reciting-tone line still reports it.
  const monotoneLineYs = lines.filter((_, i) => !used[i]);
  if (!staves.length) return { bands: [], monotoneLineYs };
  staves.sort((a, b) => a.top - b.top); // template matching doesn't guarantee top-to-bottom order

  // Turn each staff into a padded SYSTEM band: some room above for
  // episema/ledger notes, and room below to include that system's own
  // lyric line — extending down to just before the next staff's top line,
  // or a fixed multiple of the line spacing for the last one on the page.
  // Also carry along the 4 individual staff-line Y positions themselves
  // (absolute, in this canvas's coordinates) — established academic OMR
  // approach for square notation (Vigliensoni & Burgoyne, "Automatic Pitch
  // Detection in Printed Square Notation", DDMAL/McGill) computes pitch
  // geometrically from a note's position relative to KNOWN staff-line
  // coordinates, rather than having a reader (human or model) re-locate
  // the lines by eye each time. We already know these coordinates exactly
  // from detection — passing them along lets the prompt state them as
  // plain numbers next to each image instead of asking the model to
  // re-estimate them purely visually.
  const bands = [];
  for (let s = 0; s < staves.length; s++) {
    const st = staves[s];
    const next = staves[s+1];
    const topPx = Math.max(0, st.top - st.gap * 2.2);
    let bottomPx = next
      ? Math.min(height, next.top - next.gap * 1.5)
      : Math.min(height, st.bottom + st.gap * 4.5);
    if (!next) {
      // Last staff on the page: the generous gap*4.5 padding below exists
      // to capture this system's OWN lyric line — but if a monotone
      // reciting-tone line (see above) sits in that same stretch, that
      // padding would instead sweep a completely different piece's
      // notation into THIS system's crop, which is exactly what produced
      // the observed bug (a trailing versicle silently appended onto the
      // last hymn verse with no piece boundary). Clip the padding to stop
      // just above the nearest such line instead.
      const monotoneBelow = monotoneLineYs.filter(y => y > st.bottom && y < st.bottom + st.gap * 8);
      if (monotoneBelow.length) bottomPx = Math.min(bottomPx, Math.min(...monotoneBelow) - st.gap * 0.8);
    }
    const lineYs = [st.top, st.top + st.gap, st.top + 2 * st.gap, st.bottom];
    bands.push({ topPx, bottomPx, lineYs });
  }
  return { bands, monotoneLineYs };
}

// Crops one system band out of an ALREADY-RENDERED page canvas — plain
// canvas-to-canvas copy (cheap, no PDF re-render). Earlier this called
// page.render() again for every single detected system (to get a
// genuinely higher-resolution re-render from the vector source), but that
// meant rendering the same PDF page up to a dozen-plus times over for a
// long multi-verse piece — and pdf.js may accumulate internal state
// (decoded fonts/glyphs, image caches) across repeated render() calls on
// the same page that doesn't get released until the page/document itself
// is destroyed, which lines up with a NEW "Out of Memory" crash appearing
// right after that per-band-re-render approach was introduced. Cropping
// from the single existing render (the page is rendered at a good
// resolution exactly once, same as before that change) avoids the
// repeated-render risk entirely, at the cost of not being able to push
// resolution quite as high per crop — a safer trade given a crash is far
// worse than merely-good-instead-of-great image detail.
function gregCropCanvasBand(sourceCanvas, topPx, bottomPx) {
  const w = sourceCanvas.width;
  const h = Math.ceil(bottomPx - topPx);
  if (h < 10) return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(sourceCanvas, 0, Math.round(topPx), w, h, 0, 0, w, h);
  const b64 = canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
  canvas.width = 0;
  canvas.height = 0;
  return b64;

}

// A Promise-based confirm dialog built on the existing showModal()
// infrastructure — used instead of the native window.confirm() for
// anything that can be reached after a slow async operation (like an API
// call). Native confirm() showed a real failure mode here: if the tab
// loses focus while the fetch is in flight (e.g. the person switches
// tabs/windows to do something else while waiting), Chrome/Edge silently
// SUPPRESS the dialog and confirm() just returns false immediately — which
// our code then read as "user declined", wrongly discarding a perfectly
// good 181-entry result. A custom in-page modal is just HTML/CSS, so it
// isn't subject to that browser-focus suppression rule at all.
function gregConfirmModal(title, body) {
  return new Promise(resolve => {
    showModal(title, body, [
      { label: 'Abbrechen', fn: () => { closeModal(); resolve(false); } },
      { label: 'Trotzdem laden', fn: () => { closeModal(); resolve(true); } }
    ]);
  });
}

// Modal-based "pick one of these pieces" dialog — replaces window.prompt()
// here for the same reason as gregConfirmModal: this runs after an async
// API call (piece detection), so a native prompt() risks the same silent
// tab-focus suppression.
function gregPickPieceModal(pieces) {
  return new Promise(resolve => {
    const body = 'Mehrere Stücke auf dieser Seite/diesen Seiten erkannt — welches soll geladen werden?';
    showModal('Stück wählen', body, []); // buttons filled in manually below for a one-per-line layout
    const bEl = document.getElementById('modal-btns');
    bEl.innerHTML = '';
    bEl.style.flexDirection = 'column';
    bEl.style.alignItems = 'stretch';
    pieces.forEach(p => {
      const unsupported = p.systems === 0; // single-line versicle/response, see Step A prompt
      const btn = document.createElement('button');
      btn.className = 'b';
      btn.style.textAlign = 'left';
      btn.style.margin = '2px 0';
      btn.textContent = p.index + ': Modus ' + p.mode + ' — ' + p.incipit + ' (S. ' + (p.pages||[1]).join(',') + ')' + (unsupported ? '  [0 Systeme erkannt — vermutlich falsch gezählt]' : '');
      if (unsupported) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
      } else {
        btn.onclick = () => { closeModal(); bEl.style.flexDirection = ''; bEl.style.alignItems = ''; resolve(p.index); };
      }
      bEl.appendChild(btn);
    });
    if (pieces.length > 1) {
      const allBtn = document.createElement('button');
      allBtn.className = 'b';
      allBtn.style.cssText = 'text-align:left;margin:2px 0 8px 0;background:#1a3a5a;color:#a0c0e0;border-color:#2a5a8a';
      allBtn.textContent = '📑 Alle ' + pieces.length + ' Stücke laden (je ein eigener Abschnitt)';
      allBtn.onclick = () => { closeModal(); bEl.style.flexDirection = ''; bEl.style.alignItems = ''; resolve('ALL'); };
      bEl.appendChild(allBtn);
      // zusammengehörige Teile (z.B. Graduale + Vers) als EIN Stück in einem Abschnitt
      const mergeBtn = document.createElement('button');
      mergeBtn.className = 'b';
      mergeBtn.style.cssText = 'text-align:left;margin:-4px 0 8px 0;background:#2a4a2a;color:#c0e0a0;border-color:#4a7a3a';
      mergeBtn.textContent = '🔗 Alle ' + pieces.length + ' als ein Stück laden (zusammen in einem Abschnitt)';
      mergeBtn.title = 'Für Teile, die fest zusammengehören (z.B. Graduale mit Vers «Vs.»)';
      mergeBtn.onclick = () => { closeModal(); bEl.style.flexDirection = ''; bEl.style.alignItems = ''; resolve('MERGE'); };
      bEl.appendChild(mergeBtn);
    }
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'b';
    cancelBtn.textContent = 'Abbrechen';
    cancelBtn.onclick = () => { closeModal(); bEl.style.flexDirection = ''; bEl.style.alignItems = ''; resolve(null); };
    bEl.appendChild(cancelBtn);
  });
}


// ════════════════════════════════════════════════════════════════════
// OMR-KORREKTUR-SCHICHT (deterministische Bildverarbeitung statt reiner
// Vision-Pixel-Ablesung fuer die Tonhoehen) — siehe eigenstaendiges Projekt
// omr_pipeline.py (Python-Prototyp/Referenz-Implementierung) und
// Session-Notizen NOTES_v20 bis NOTES_v28 in der Test-Bibliothek.
//
// Architektur (Nutzerentscheid): Vision liest wie bisher Silben, Neumentyp
// (= Notenzahl pro Silbe) und Text — das kann sie gut. Diese Schicht nutzt
// NUR die Notenzahl pro Silbe, um die exakte Tonhoehe GEOMETRISCH aus dem
// Systembild nachzurechnen und Visions eigene (fehleranfaelligere)
// Pixel-Ablesung der Tonhoehe zu ersetzen. Bei jedem Zweifel (Cluster-Zahl
// passt nicht zur Silbenzahl, Bild laedt nicht, Buchstabe ausserhalb a-m):
// Original unveraendert lassen — nie schlechter als reines Vision-Ergebnis.
//
// Bekannte Grenze (siehe omr_pipeline.py, Abschnitt "SESSION 9"): bei
// zusammengesetzten Neumen mit stark kalligraphisch verzierter Form
// (geschwungener Verbindungsstrich, Kerbe) oder bei zwei Notenkoepfen mit
// EXAKT identischem x (kein Versatz) kann die Tonhoehen-ERKENNUNG bzw. die
// Gesangs-REIHENFOLGE trotzdem falsch/vertauscht sein — das ist ein noch
// offener Forschungspunkt (Task #7), kein Bug dieser Implementierung.
//
// Alle Funktionsnamen sind mit "omr" praefixiert, um Namenskollisionen mit
// dem restlichen Notator-Code auszuschliessen.
// ════════════════════════════════════════════════════════════════════

function omrClusterByX(candidates, maxGap) {
  if (!candidates.length) return [];
  const byX = candidates.slice().sort((a, b) => a.x - b.x);
  const clusters = [];
  let cur = [byX[0]];
  for (let i = 1; i < byX.length; i++) {
    if (byX[i].x - cur[cur.length - 1].x <= maxGap) cur.push(byX[i]);
    else { clusters.push(cur); cur = [byX[i]]; }
  }
  clusters.push(cur);
  return clusters;
}

function omrClassifyNeumeOrder(resolvedNotes) {
  // Session 21 fix (echte Fixture-Bibliothek): bei EXAKT gleichem x (ein
  // Notenpaar, rein senkrecht uebereinander gedruckt, kein seitlicher
  // Versatz) ist reines x-Sortieren keine Entscheidung, sondern reiner
  // Zufall (Sortier-Stabilitaet der urspruenglichen Scan-Reihenfolge) --
  // konkret beobachtet: "flé(fg)" (ein senkrecht gestapeltes Podatus, gegen
  // die in Session 5/6 bereits pixelverifizierte Zeichenkette bestaetigt)
  // kam dabei als "gf" statt "fg" heraus. Ein Notenpaar OHNE seitlichen
  // Versatz ist in der Quadratnotation praktisch immer ein Podatus
  // (aufsteigend, UNTERE Note zuerst) -- eine echte Clivis (absteigend)
  // wird ueblicherweise gerade durch einen sichtbaren Versatz der zweiten
  // Note nach rechts UNTEN von der Podatus-Form unterschieden (siehe auch
  // die Faelle mit echtem x-Versatz weiter unten in dieser Funktion, die
  // bereits vorher korrekt funktionierten). Bei echtem x-Versatz (auch nur
  // 1-2px) bleibt das bisherige reine x-Sortieren unveraendert -- das war
  // in allen bisher bekannten Faellen bereits korrekt.
  return resolvedNotes.slice().sort((a, b) => {
    if (a.x !== b.x) return a.x - b.x;
    return b.y - a.y; // gleiches x: groesseres y (weiter unten) zuerst
  });
}

function omrYToGabcLetter(yAbs, line2Y, line3Y) {
  const halfStep = Math.abs(line2Y - line3Y) / 2.0;
  const gY = (line2Y + line3Y) / 2.0;
  const stepsFromG = Math.round((gY - yAbs) / halfStep);
  const idx = 6 + stepsFromG;
  const letters = "abcdefghijklmn";
  return (idx >= 0 && idx < letters.length) ? letters[idx] : null;
}

function omrGrayFromRGBA(imageData) {
  const { width, height, data } = imageData;
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) gray[p] = (data[i] + data[i + 1] + data[i + 2]) / 3;
  return { width, height, gray };
}

function omrCropGray(img, x0, y0, x1, y1) {
  const w = x1 - x0, h = y1 - y0;
  const out = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    const srcRow = (y + y0) * img.width, dstRow = y * w;
    for (let x = 0; x < w; x++) out[dstRow + x] = img.gray[srcRow + x0 + x];
  }
  return { width: w, height: h, gray: out };
}

function omrThresholdBinaryInv(img, thresh) {
  const { width, height, gray } = img;
  const bin = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i++) bin[i] = gray[i] < thresh ? 1 : 0;
  return { width, height, bin };
}

function omrRemoveThinLines(binimg, maxLineThickness = 4) {
  const { width, height, bin } = binimg;
  const out = new Uint8Array(bin);
  for (let col = 0; col < width; col++) {
    let row = 0;
    while (row < height) {
      if (out[row * width + col] === 0) { row++; continue; }
      const runStart = row;
      while (row < height && out[row * width + col] !== 0) row++;
      if (row - runStart <= maxLineThickness) for (let r = runStart; r < row; r++) out[r * width + col] = 0;
    }
  }
  return { width, height, bin: out };
}

function omrConnectedComponentsWithStats(binimg, connectivity = 8) {
  const { width, height, bin } = binimg;
  const labels = new Int32Array(width * height);
  const stats = [];
  let nextLabel = 1;
  const neighbors8 = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
  const neighbors4 = [[0,-1],[-1,0],[1,0],[0,1]];
  const neighbors = connectivity === 8 ? neighbors8 : neighbors4;
  const stack = new Int32Array(width * height);
  for (let start = 0; start < width * height; start++) {
    if (bin[start] === 0 || labels[start] !== 0) continue;
    const label = nextLabel++;
    let sp = 0;
    stack[sp++] = start;
    labels[start] = label;
    let minX = start % width, maxX = minX, minY = (start / width) | 0, maxY = minY, area = 0;
    while (sp > 0) {
      const idx = stack[--sp];
      const x = idx % width, y = (idx / width) | 0;
      area++;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      for (const [dx, dy] of neighbors) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const nidx = ny * width + nx;
        if (bin[nidx] !== 0 && labels[nidx] === 0) { labels[nidx] = label; stack[sp++] = nidx; }
      }
    }
    stats.push({ label, x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, area });
  }
  return { labels, width, height, stats };
}

function omrMatchNoteheads(img, template, bandBbox, threshold = 0.45) {
  const [x0, y0, x1, y1] = bandBbox;
  const band = omrCropGray(img, x0, y0, x1, y1);
  const bw = band.width, bh = band.height, tw = template.width, th = template.height;
  const tGray = template.gray;
  let tMean = 0;
  for (let i = 0; i < tGray.length; i++) tMean += tGray[i];
  tMean /= tGray.length;
  const tNorm = new Float64Array(tGray.length);
  let tSumSq = 0;
  for (let i = 0; i < tGray.length; i++) { tNorm[i] = tGray[i] - tMean; tSumSq += tNorm[i] * tNorm[i]; }
  const resW = bw - tw + 1, resH = bh - th + 1;
  const candidates = [];
  for (let by = 0; by < resH; by++) {
    for (let bx = 0; bx < resW; bx++) {
      let iSum = 0;
      for (let ty = 0; ty < th; ty++) {
        const rowOff = (by + ty) * bw + bx;
        for (let tx = 0; tx < tw; tx++) iSum += band.gray[rowOff + tx];
      }
      const iMean = iSum / (tw * th);
      let num = 0, iSumSq = 0;
      for (let ty = 0; ty < th; ty++) {
        const rowOff = (by + ty) * bw + bx;
        for (let tx = 0; tx < tw; tx++) {
          const iVal = band.gray[rowOff + tx] - iMean;
          num += iVal * tNorm[ty * tw + tx];
          iSumSq += iVal * iVal;
        }
      }
      const denom = Math.sqrt(iSumSq * tSumSq);
      const score = denom > 1e-9 ? num / denom : 0;
      if (score >= threshold) candidates.push({ score, x: bx, y: by });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const picked = [];
  const minDistX = tw * 0.6, minDistY = th * 0.55;
  for (const c of candidates) {
    let tooClose = false;
    for (const p of picked) if (Math.abs(c.x - p.x) < minDistX && Math.abs(c.y - p.y) < minDistY) { tooClose = true; break; }
    if (!tooClose) picked.push(c);
  }
  return picked.map(p => {
    const gx = p.x + tw / 2 + x0, gy = p.y + th / 2 + y0;
    const ink = omrMeasureLocalInk(img, gx, gy, tw, th);
    return { score: p.score, x: gx, y: gy, fillRatio: ink ? ink.fillRatio : null, maxRunWidth: ink ? ink.maxRunWidth : null };
  }).sort((a, b) => a.x - b.x);
}

function omrAutoDetectNoteheadGeometry(img, bandBbox, staffLines, fillThresh = 0.8) {
  const [x0, y0, x1, y1] = bandBbox;
  const band = omrCropGray(img, x0, y0, x1, y1);
  const binimg = omrThresholdBinaryInv(band, 200);
  const cleaned = omrRemoveThinLines(binimg, 4);
  const { stats } = omrConnectedComponentsWithStats(cleaned, 8);
  const gap = staffLines[1] - staffLines[0];
  const lo = 0.35 * gap, hi = 0.8 * gap;
  const cands = [];
  for (const s of stats) {
    const fillRatio = s.area / (s.w * s.h);
    if (s.w >= lo && s.w <= hi && s.h >= lo && s.h <= hi && s.w / s.h >= 0.6 && s.w / s.h <= 1.6 && fillRatio >= fillThresh) cands.push(s);
  }
  if (!cands.length) return null;
  const ws = cands.map(c => c.w).sort((a, b) => a - b);
  const hs = cands.map(c => c.h).sort((a, b) => a - b);
  const medW = ws[Math.floor(ws.length / 2)], medH = hs[Math.floor(hs.length / 2)];
  let best = cands[0], bestDist = Infinity;
  for (const c of cands) { const d = Math.abs(c.w - medW) + Math.abs(c.h - medH); if (d < bestDist) { bestDist = d; best = c; } }
  const template = omrCropGray(band, best.x, best.y, best.x + best.w, best.y + best.h);
  const fillRatio = best.area / (best.w * best.h);
  return { template, w: best.w, h: best.h, fillRatio, bbox: [x0 + best.x, y0 + best.y, x0 + best.x + best.w, y0 + best.y + best.h], nCandidates: cands.length };
}

// Task #7 (Skelett-/Kurvenanalyse): misst, wie "notenkopf-foermig" das
// Tinten-Muster in einem template-grossen Fenster um einen Kandidatenpunkt
// tatsaechlich aussieht -- unabhaengig vom Korrelations-Score. Eine Virga
// (Notenkopf + duenner Notenhals) kann am Notenhals einen zweiten,
// schwaecheren Korrelations-Treffer erzeugen, der score-maessig manchmal
// gar nicht so weit vom echten Notenkopf entfernt liegt -- aber ihr
// tatsaechliches Tinten-Fussabdruck (Fuellgrad, breiteste zusammenhaengende
// dunkle Zeile) bleibt IMMER weit unter dem eines echten, dicht gefuellten
// Notenkopfs. Das macht diese Unterscheidung ohne jede Kenntnis der
// erwarteten Gesamt-Notenzahl moeglich (siehe Kommentar in
// omrGlobalResolveNotes).
function omrMeasureLocalInk(img, x, y, tw, th) {
  const x0 = Math.round(x - tw / 2), y0 = Math.round(y - th / 2);
  const x1 = x0 + tw, y1 = y0 + th;
  if (x0 < 0 || y0 < 0 || x1 > img.width || y1 > img.height) return null;
  const win = omrCropGray(img, x0, y0, x1, y1);
  const binimg = omrThresholdBinaryInv(win, 200);
  let dark = 0;
  for (let i = 0; i < binimg.bin.length; i++) dark += binimg.bin[i];
  const fillRatio = dark / (tw * th);
  let maxRun = 0;
  for (let ry = 0; ry < th; ry++) {
    let run = 0;
    const rowOff = ry * tw;
    for (let rx = 0; rx < tw; rx++) {
      if (binimg.bin[rowOff + rx]) { run++; if (run > maxRun) maxRun = run; }
      else run = 0;
    }
  }
  return { fillRatio, maxRunWidth: maxRun };
}

function omrAutoFindNoteClusters(img, template, bandBbox, opts = {}) {
  const anchorThreshold = opts.anchorThreshold != null ? opts.anchorThreshold : 0.75;
  const fullThreshold = opts.fullThreshold != null ? opts.fullThreshold : 0.4;
  const padFactor = opts.padFactor != null ? opts.padFactor : 1.5;
  const tw = template.width;
  const maxGap = opts.maxGap != null ? opts.maxGap : Math.round(tw * 1.35);
  const anchors = omrMatchNoteheads(img, template, bandBbox, anchorThreshold);
  if (!anchors.length) return { clusters: [], anchorRange: null };
  const anchorMinX = Math.min(...anchors.map(a => a.x)), anchorMaxX = Math.max(...anchors.map(a => a.x));
  const pad = tw * padFactor;
  const full = omrMatchNoteheads(img, template, bandBbox, fullThreshold);
  const filtered = full.filter(c => c.x >= anchorMinX - pad && c.x <= anchorMaxX + pad);
  return { clusters: omrClusterByX(filtered, maxGap), anchorRange: [anchorMinX, anchorMaxX] };
}

function omrParseGabcSystemLine(line) {
  const tokens = [];
  const re = /([^\s(]*)\(([^)]*)\)/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    const text = m[1], pitches = m[2];
    const noteCount = (pitches.match(/[a-mA-M]/g) || []).length;
    if (text.length > 0) tokens.push({ type: 'note', text, pitches, noteCount, matchIndex: m.index, matchLength: m[0].length });
    else tokens.push({ type: 'bare', pitches, matchIndex: m.index, matchLength: m[0].length });
  }
  return tokens;
}

function omrReplacePitchesInLine(line, replacements) {
  const tokens = omrParseGabcSystemLine(line);
  const noteTokens = tokens.filter(t => t.type === 'note');
  let out = line;
  for (let i = noteTokens.length - 1; i >= 0; i--) {
    const newPitches = replacements[i];
    if (newPitches == null) continue;
    const t = noteTokens[i];
    out = out.slice(0, t.matchIndex) + t.text + '(' + newPitches + ')' + out.slice(t.matchIndex + t.matchLength);
  }
  return out;
}

function omrSubstituteLettersPreservingModifiers(original, newLetters) {
  let li = 0, out = '';
  for (const ch of original) {
    if (/[a-mA-M]/.test(ch)) { const nl = newLetters[li++]; out += (ch === ch.toUpperCase()) ? nl.toUpperCase() : nl; }
    else out += ch;
  }
  return out;
}

// Neue, SYSTEM-WEITE Aufloesung (Session 11): ersetzt die alte "Cluster-Zahl
// == Silben-Zahl"-Alles-oder-nichts-Pruefung. Vision's SILBENTRENNUNG ist oft
// falsch (z.B. "Cóndi" statt "Cón-di") — das aendert aber meist NICHT die
// Gesamt-Notenzahl im System. Darum: statt pro Silbe zu pruefen, wird die
// GESAMTZAHL erwarteter Noten (Summe ueber alle Silben-Tokens) gegen die
// Gesamtzahl erkannter Notenkoepfe im GANZEN System verglichen. Ueberschuss
// (= Konnektor-Artefakte bei zusammengesetzten Neumen) wird ueber alle
// Mehrfach-Cluster hinweg per niedrigstem Score entfernt (nie die y-Extreme
// eines Clusters, die sind fast sicher echte Noten). Die verbleibenden Punkte
// werden dann nur noch nach x-Position sortiert und der Reihe nach auf die
// Silben verteilt — robust auch wenn die Silben-TEXT-Grenzen falsch sind
// (die bleiben dann zwar weiterhin falsch, aber die Tonhoehen stimmen).
// Rueckgabe: { points, confidence } — confidence 0 = kein Ueberschuss (sicherste
// Stufe, gar keine Entfernung noetig), 1 = Tier-1-Entfernung allein ausreichend
// (sicher, positions-verifiziert), 2 = Tier-2 noetig (weniger sicher, siehe
// Kommentar unten). NULL bei Fehlschlag. Der Aufrufer soll unter ALLEN
// probierten Anker-Schwellen die mit der NIEDRIGSTEN confidence-Zahl waehlen,
// nicht einfach die erste passende — siehe Kommentar in omrCorrectSystemLine.
// Task #7: kombiniert den geometrischen Tinten-Fussabdruck eines Punkts
// (siehe omrMeasureLocalInk) mit seinem Korrelations-Score zu einem
// einzigen "wie sehr sieht das nach einem echten Notenkopf aus"-Wert.
// Faellt sauber auf reinen Score zurueck, wenn keine Geometrie-Messung
// vorliegt (z.B. synthetische Tests ohne echtes Bild dahinter) -- garantiert
// unveraendertes Verhalten fuer jeden bestehenden Test, der nur {x,y,score}
// kennt.
function omrNoteheadLikeness(p, geo) {
  if (p.fillRatio == null || !geo) return p.score;
  const templateFill = geo.fillRatio != null ? geo.fillRatio : 0.8;
  const fillLikeness = Math.min(1, p.fillRatio / templateFill);
  const widthLikeness = geo.w ? Math.min(1, (p.maxRunWidth || 0) / geo.w) : 1;
  // Geometrie dominiert bewusst (0.6+0.3=0.9) -- der Korrelations-Score
  // dient nur noch als kleiner Tie-Breaker (0.1), da genau der Score allein
  // eine Virga-Notenhals-Spitze fruehstens NICHT zuverlaessig von einem
  // echten zweiten Notenkopf unterscheiden konnte (siehe Kommentar unten).
  return fillLikeness * 0.6 + widthLikeness * 0.3 + p.score * 0.1;
}

function omrGlobalResolveNotes(clusters, totalExpected, geo) {
  const standard = omrGlobalResolveNotesCore(clusters, totalExpected, geo);
  // Zusaetzlicher, rein ADDITIVER Versuch (Session 21, gefunden ueber die
  // reale OMR-Fixture-Bibliothek): der Notenschluessel am Systemanfang kann
  // gelegentlich einen 3+-Punkte-Geister-Cluster erzeugen, bei dem KEINER
  // der Punkte eine echte Note ist -- Tier 1 oben schuetzt aber IMMER die
  // y-Extreme eines 3+-Clusters als "sicher real", was fuer einen Notenkopf-
  // Cluster korrekt ist, fuer einen Notenschluessel-Geister-Cluster aber
  // falsch. Symptom, konkret beobachtet: bei einem 3-Punkte-Geister-Cluster
  // am Anfang plus 2 GENUINE 2-Noten-Neumen im selben System reichte Tier 1
  // (nur 1 Punkt entfernbar) nicht aus, und Tier 2 entfernte faelschlich
  // aus den echten 2-Noten-Neumen statt aus dem Geister-Cluster.
  // Fix: zusaetzlich ausprobieren, was passiert, wenn der ALLERERSTE Cluster
  // (per Konstruktion von omrClusterByX in x-Reihenfolge, siehe dort) einen
  // Notenschluessel darstellt und KOMPLETT verworfen wird (nicht nur seine
  // Mitte). Nur wenn das eine bessere (niedrigere) confidence als der
  // Standardweg ergibt, wird es bevorzugt -- ein echter Notenschluessel
  // verschwindet damit spurlos; eine echte 3+-Noten-Neume am Systemanfang
  // bleibt dagegen unangetastet, weil deren komplettes Verwerfen der
  // GESAMTZAHL sonst die Rohtrefferzahl unter das Erwartete druecken wuerde
  // (excess < 0 fuer die uebrigen Cluster), was hier schlicht scheitert
  // (liefert null) und damit automatisch beim Standardweg bleibt.
  if (clusters.length >= 1 && clusters[0].length >= 3) {
    const withoutFirst = omrGlobalResolveNotesCore(clusters.slice(1), totalExpected, geo);
    if (withoutFirst && (!standard || withoutFirst.confidence < standard.confidence)) {
      return withoutFirst;
    }
  }
  return standard;
}

function omrGlobalResolveNotesCore(clusters, totalExpected, geo) {
  let totalRaw = 0;
  clusters.forEach(c => totalRaw += c.length);
  const excess = totalRaw - totalExpected;
  if (excess < 0) return null; // weniger Rohtreffer als benoetigt -> diese Schwelle scheitert
  if (excess === 0) return { points: clusters.flat(), confidence: 0 };

  // Session 12 — 2-STUFIGE Entfernung. Ein Cluster mit GENAU 2 Rohtreffern
  // ist strukturell mehrdeutig: entweder ein echtes 2-Noten-Neume
  // (Podatus/Clivis, BEIDE Punkte real) ODER eine "Virga rendert als 2
  // Korrelations-Peaks"-Situation (siehe omr_pipeline.py Session 8, Punkt 1
  // — dieselbe Mehrdeutigkeit war schon damals bekannt, wurde dort aber
  // ueber einen PER-SILBE expected_count geloest; hier fehlt dieses Wissen,
  // seit die Zaehlung system-weit statt pro Silbe laeuft). Ein erster
  // Versuch, den schwaecheren Punkt IMMER als gleichwertigen, rein
  // score-basierten Entfernungs-Kandidaten zu behandeln, verursachte eine
  // ECHTE Regression (bei einem Test mit echten Bilddaten wurde dadurch
  // eine echte 2-Noten-Neume faelschlich auf 1 Note reduziert, weil der
  // globale Score-Rang irrtuemlich dort zugriff, obwohl die sichere Tier-1-
  // Entfernung allein ausgereicht haette). Fix: 2-stufige Prioritaet —
  // Tier 1 (Mitte-Punkte von 3+-Clustern, positions-verifiziert, sicher)
  // wird IMMER zuerst genutzt; NUR wenn Tier 1 allein nicht ausreicht, wird
  // zusaetzlich in Tier 2 (schwaecherer Punkt von 2er-Clustern, weniger
  // sicher) gegriffen. So bleiben echte 2-Noten-Neumen unangetastet, solange
  // die Ueberschuss-Menge sich schon aus den sicheren 3+-Clustern erklaeren
  // laesst.
  const certain = [];
  const tier1Removable = [];
  const twoPointGroups = [];
  clusters.forEach((c) => {
    if (c.length <= 1) {
      certain.push(...c);
    } else if (c.length === 2) {
      const byLikeness = c.slice().sort((a, b) => omrNoteheadLikeness(b, geo) - omrNoteheadLikeness(a, geo));
      twoPointGroups.push({ strong: byLikeness[0], weak: byLikeness[1] });
    } else {
      const byY = c.slice().sort((a, b) => a.y - b.y);
      certain.push(byY[0], byY[byY.length - 1]);
      tier1Removable.push(...byY.slice(1, byY.length - 1));
    }
  });

  if (tier1Removable.length >= excess) {
    // Sicherer Fall: Tier 1 allein erklaert den Ueberschuss — jeden
    // 2er-Cluster unangetastet lassen (beide Punkte gelten als real).
    tier1Removable.sort((a, b) => a.score - b.score);
    const kept1 = tier1Removable.slice(excess);
    const twoPointPoints = twoPointGroups.flatMap(g => [g.strong, g.weak]);
    return { points: [...certain, ...twoPointPoints, ...kept1], confidence: 1 };
  }

  // Tier 1 allein reicht nicht — zusaetzlich in Tier 2 greifen (weniger
  // sicher, siehe Kommentar oben).
  const remainingExcess = excess - tier1Removable.length;
  const weakCandidates = twoPointGroups.map(g => g.weak);
  if (weakCandidates.length < remainingExcess) return null; // immer noch nicht genug -> Schwelle scheitert
  weakCandidates.sort((a, b) => omrNoteheadLikeness(a, geo) - omrNoteheadLikeness(b, geo));
  const keptWeak = weakCandidates.slice(remainingExcess);
  const strongPoints = twoPointGroups.map(g => g.strong);
  return { points: [...certain, ...strongPoints, ...keptWeak], confidence: 2 };
}

function omrComputeCorrectedPitchesFromOrderedList(orderedPoints, noteTokens, staffLines) {
  const sorted = orderedPoints.slice().sort((a, b) => a.x - b.x);
  let ptr = 0;
  return noteTokens.map((t) => {
    if (t.noteCount === 0) return null;
    if (ptr + t.noteCount > sorted.length) return null; // sollte bei korrektem Gesamt-Abgleich nicht vorkommen
    const group = sorted.slice(ptr, ptr + t.noteCount);
    ptr += t.noteCount;
    const ordered = omrClassifyNeumeOrder(group);
    const letters = ordered.map(c => omrYToGabcLetter(c.y, staffLines[1], staffLines[2]));
    if (letters.some(l => l == null)) return null;
    return omrSubstituteLettersPreservingModifiers(t.pitches, letters);
  });
}

// Laedt ein Base64-Bild (JPEG/PNG) ueber ein <img>+<canvas>, liefert
// ImageData wie von canvas.getContext('2d').getImageData().
function omrLoadImageFromBase64(b64, mediaType = 'image/jpeg') {
  return new Promise((resolve, reject) => {
    const imgEl = new Image();
    imgEl.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = imgEl.naturalWidth;
      canvas.height = imgEl.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgEl, 0, 0);
      try {
        resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
      } catch (e) {
        reject(e);
      } finally {
        canvas.width = 0; canvas.height = 0;
      }
    };
    imgEl.onerror = () => reject(new Error('Bild konnte nicht geladen werden'));
    imgEl.src = 'data:' + mediaType + ';base64,' + b64;
  });
}

async function omrCorrectSystemLine(line, systemItem, opts = {}) {
  try {
    const tokens = omrParseGabcSystemLine(line);
    const noteTokens = tokens.filter(t => t.type === 'note');
    if (!noteTokens.length) return { line, applied: false, reason: 'keine Silben mit Noten' };
    if (systemItem.type !== 'crop' || !systemItem.lineYsInCrop) {
      return { line, applied: false, reason: 'kein Notensystem-Ausschnitt (Übersichtsbild statt Crop)' };
    }

    const imageData = await omrLoadImageFromBase64(systemItem.b64, 'image/jpeg');
    const img = omrGrayFromRGBA(imageData);
    const staffLines = systemItem.lineYsInCrop;
    const gap = staffLines[1] - staffLines[0];
    const y0 = Math.max(0, Math.round(staffLines[0] - gap * 0.6));
    const y1 = Math.min(img.height, Math.round(staffLines[3] + gap * 0.6));
    // Spalten-Grenze (Uebersetzungsspalte) bewusst NICHT angewendet: auf
    // einem einzelnen Systemausschnitt (statt der ganzen Seite mit
    // mehreren Systemen) ist die Erkennung unzuverlässig — siehe
    // omr_pipeline.py Docstring. Bekannte Einschraenkung fuer Dokumente
    // mit seitlicher Uebersetzungsspalte, siehe NOTES_v27.md.
    const band = [0, y0, img.width, y1];

    const geo = omrAutoDetectNoteheadGeometry(img, band, staffLines);
    if (!geo) {
      console.log('OMR-Diagnose: kein Notenkopf-Template gefunden. Bild ' + img.width + 'x' + img.height +
        ', Band [0,' + y0 + ',' + img.width + ',' + y1 + '], Notenlinien-Abstand=' + gap.toFixed(1) +
        ', staffLines=' + JSON.stringify(staffLines));
      return { line, applied: false, reason: 'kein Notenkopf-Template gefunden' };
    }

    // anchor_threshold ist dokumentabhaengig (siehe omr_pipeline.py, Session
    // 8/9) — mehrere Werte durchprobieren. Statt (wie bisher) die Cluster-
    // ANZAHL gegen die Silben-Token-Anzahl zu pruefen (scheitert bei falscher
    // Vision-Silbentrennung fuer das GANZE System), wird jetzt die GESAMT-
    // Notenzahl (Summe ueber alle Silben) gegen die Gesamtzahl erkannter
    // Notenkoepfe verglichen — siehe omrGlobalResolveNotes() (Session 11).
    //
    // WICHTIG (Session 12): ALLE Schwellen werden durchprobiert und die mit
    // der NIEDRIGSTEN confidence-Zahl gewaehlt (0=exakt, 1=Tier1 sicher,
    // 2=Tier2 noetig) — NICHT einfach die erste passende in aufsteigender
    // Reihenfolge. Grund: ein Clef-Geister-Cluster am Systemanfang besteht
    // manchmal selbst aus 3 Rohtreffern, aber KEINER davon ist real — bei
    // niedrigen Schwellen bleibt dieser Geister-Cluster im Bild und die
    // "y-Extreme von 3+-Clustern sind sicher echt"-Annahme geht dafuer
    // faelschlich auf (2 von 3 Geister-Punkten wuerden als "sicher real"
    // durchgehen). Eine HOEHERE Schwelle schliesst den Geister-Cluster
    // dagegen oft komplett aus (exakter Treffer, confidence=0) — das ist
    // dann immer die bessere Wahl, auch wenn eine niedrigere Schwelle
    // "zufaellig" auch eine (schlechtere) Loesung findet.
    const totalExpected = noteTokens.reduce((s, t) => s + t.noteCount, 0);
    const thresholdsToTry = opts.anchorThresholds || [0.7, 0.75, 0.8, 0.85, 0.9];
    let best = null; // { points, confidence, usedThreshold }
    const diagRows = [];
    for (const at of thresholdsToTry) {
      const r = omrAutoFindNoteClusters(img, geo.template, band, { anchorThreshold: at });
      const totalRaw = r.clusters.reduce((s, c) => s + c.length, 0);
      const resolved = omrGlobalResolveNotes(r.clusters, totalExpected, geo);
      diagRows.push({ anchorThreshold: at, nClusters: r.clusters.length, totalRaw, totalExpected, anchorRange: r.anchorRange, confidence: resolved ? resolved.confidence : null });
      if (resolved && (!best || resolved.confidence < best.confidence)) {
        best = { points: resolved.points, confidence: resolved.confidence, usedThreshold: at };
        if (resolved.confidence === 0) break; // exakter Treffer -- besser geht nicht, sofort abbrechen
      }
    }
    if (!best) {
      console.log('OMR-Diagnose (System nicht korrigiert): Bild ' + img.width + 'x' + img.height +
        ', Template ' + geo.w + 'x' + geo.h + ' (aus ' + geo.nCandidates + ' Kandidaten), ' +
        'Notenlinien-Abstand=' + gap.toFixed(1) + ', Silben-Tokens=' + noteTokens.length + ', erwartete Gesamt-Notenzahl=' + totalExpected + '.\n' +
        'Je Schwelle: ' + JSON.stringify(diagRows));
      return { line, applied: false, reason: `Keine Anker-Schwelle ergab die erwartete Gesamt-Notenzahl (${totalExpected})` };
    }

    const newPitchStrings = omrComputeCorrectedPitchesFromOrderedList(best.points, noteTokens, staffLines);
    const correctedLine = omrReplacePitchesInLine(line, newPitchStrings);
    // WICHTIG: die Korrektur ist NICHT chirurgisch — sie berechnet fuer JEDEN
    // Silben-Token im System unbedingt eine neue Tonhoehe aus der Geometrie,
    // unabhaengig davon, ob Visions urspruengliche Ablesung an dieser Stelle
    // schon richtig war. nRecomputed zaehlt daher immer praktisch alle Tokens
    // (sobald das System ueberhaupt angewendet wird) — das ist KEIN Mass
    // dafuer, wie viele Silben vorher falsch waren. nActuallyDifferent
    // zeigt zusaetzlich, bei wie vielen Tokens sich der Buchstabe von Visions
    // Original tatsaechlich unterscheidet (diagnostisch, siehe NOTES_v36.md).
    const nRecomputed = newPitchStrings.filter(p => p != null).length;
    const nActuallyDifferent = newPitchStrings.filter((p, idx) => p != null && p !== noteTokens[idx].pitches).length;
    return { line: correctedLine, applied: true, nChanged: nRecomputed, nActuallyDifferent, nTotal: noteTokens.length, usedThreshold: best.usedThreshold, confidence: best.confidence };
  } catch (e) {
    return { line, applied: false, reason: 'Fehler: ' + e.message };
  }
}

// Session 15 — MEHRFACH-ABGLEICH gegen bestaetigte Vision-Instabilitaet:
// ein Nutzertest zeigte, dass zwei Durchlaeufe DERSELBEN PDF-Datei nur in
// ca. 46% der Notenpositionen uebereinstimmten — Vision liest (trotz
// temperature=0) nicht zuverlaessig dieselbe Silben-Notenzahl bei jedem
// Aufruf. Eine vollstaendig geometrie-basierte Notenzaehlung (OMR bestimmt
// die Zahl komplett selbst, ohne Vision) wuerde auf dasselbe ungeloeste
// Problem treffen wie Task #7 (Virga-Doppeltreffer vs. echte 2-Noten-Neume
// laesst sich rein pixelbasiert nicht zuverlaessig unterscheiden, siehe
// omr_pipeline.py — 3 Ansaetze dafuer sind bereits gescheitert). Praktischer
// Kompromiss: Vision mehrfach unabhaengig aufrufen und die Gesamt-Notenzahl
// je System per Median-Konsens waehlen (siehe pickConsensusLine unten) —
// kein neues, unverifiziertes Geometrie-Heuristikproblem, sondern nutzt die
// Zufallsstreuung mehrerer echter Vision-Antworten aus, um Ausreisser
// herauszufiltern.
const VISION_EXTRACTION_REPEATS = 3;

async function runBatchAttempt(apiKeyLocal, batchBlocks, promptText, batchMaxTokens, batchLabel) {
  // Ein einzelner Vision-Extraktions-Durchlauf fuer einen Batch. Gibt ein
  // Array von (bereits von "System N:"-Label befreiten) Zeilen zurueck, eine
  // pro im Antworttext gefundenem System, in Reihenfolge — oder null bei
  // komplettem Fehlschlag dieses EINEN Durchlaufs.
  try {
    const batchResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'x-api-key':apiKeyLocal, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: batchMaxTokens,
        temperature: 0,
        messages: [{ role: 'user', content: [...batchBlocks, { type: 'text', text: promptText }] }]
      })
    });
    if (!batchResp.ok) {
      console.log(batchLabel + ' HTTP error', batchResp.status, await batchResp.text().catch(() => ''));
      return null;
    }
    const batchData = await batchResp.json();
    const batchFullText = (batchData.content || []).filter(x => x.type === 'text').map(x => x.text).join('').trim();
    const bMarker = batchFullText.indexOf('===GABC===');
    let usedLines = [];
    if (bMarker >= 0) {
      const batchLines = batchFullText.slice(bMarker + '===GABC==='.length).trim();
      usedLines = batchLines.split('\n');
    } else {
      usedLines = batchFullText.split('\n').filter(l => /^\s*System\s+#?\d+\s*:/i.test(l));
      if (usedLines.length) console.log(batchLabel + ': kein "===GABC==="-Marker, aber ' + usedLines.length + ' "System N:"-Zeile(n) im Fliesstext gefunden und übernommen.');
    }
    if (!usedLines.length) {
      console.log(batchLabel + ' response (no marker, no "System N:" lines found):', batchFullText);
      return null;
    }
    return usedLines.map(line => line.replace(/^\s*System\s+#?\d+\s*:\s*/i, '').trim()).filter(l => l);
  } catch (e) {
    console.log(batchLabel + ' error:', e.message);
    return null;
  }
}

function pickConsensusLine(candidateLines) {
  // candidateLines: GABC-Zeilen fuer DASSELBE System aus mehreren
  // unabhaengigen Vision-Durchlaeufen. Waehlt diejenige, deren GESAMT-
  // Notenzahl am naechsten am Median aller Kandidaten liegt — filtert damit
  // einen einzelnen Ausreisser-Durchlauf heraus, ohne dass die Silben-
  // Segmentierung zwischen den Kandidaten uebereinstimmen muss (das waere
  // fuer eine echte Silbe-fuer-Silbe-Abstimmung noetig, aber angesichts
  // unterschiedlicher Wort-/Silbentrennung zwischen Durchlaeufen nicht
  // robust genug umsetzbar).
  if (candidateLines.length === 1) return candidateLines[0];
  const withCounts = candidateLines.map(line => {
    const tokens = omrParseGabcSystemLine(line);
    const total = tokens.filter(t => t.type === 'note').reduce((s, t) => s + t.noteCount, 0);
    return { line, total };
  });
  const sortedTotals = withCounts.map(w => w.total).slice().sort((a, b) => a - b);
  const median = sortedTotals[Math.floor(sortedTotals.length / 2)];
  const exact = withCounts.filter(w => w.total === median);
  exact.sort((a, b) => b.line.length - a.line.length); // Tie-Break: ausfuehrlichere Zeile bevorzugen
  return exact[0].line;
}

// Orchestriert die Korrektur ueber ALLE Systeme eines Stuecks. lines und
// items muessen synchron sein (lines[i] gehoert zu items[i]). Bei jeder
// Diskrepanz (z.B. ein Batch hat weniger Zeilen geliefert als Systeme
// angefragt wurden) wird NICHTS korrigiert — siehe Sicherheitsprinzip oben.
async function omrCorrectAllSystems(lines, items, statusFn) {
  if (lines.length !== items.length) {
    if (statusFn) statusFn('OMR-Korrektur übersprungen: Zeilen-/System-Anzahl stimmt nicht überein (' + lines.length + ' vs. ' + items.length + ').');
    return lines;
  }
  const correctedLines = [];
  let nSystemsApplied = 0, nSyllablesChanged = 0, nSyllablesTotal = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const item = items[i];
    if (!line.trim() || !item) { correctedLines.push(line); continue; }
    const result = await omrCorrectSystemLine(line, item);
    correctedLines.push(result.line);
    if (result.applied) {
      nSystemsApplied++;
      nSyllablesChanged += result.nChanged;
      nSyllablesTotal += result.nTotal;
      // Session 15: Erfolg jetzt EBENFALLS geloggt (vorher nur Skip-Fälle) —
      // sonst ist aus der Konsole allein nicht unterscheidbar, ob die
      // Korrektur-Schicht ueberall erfolgreich lief oder komplett
      // uebersprungen wurde, was einen echten Nutzertest unnötig erschwerte.
      console.log('OMR-Korrektur für System ' + (i + 1) + ' angewendet: ' + result.nChanged + '/' + result.nTotal + ' Silben-Tonhöhen neu berechnet, davon ' + result.nActuallyDifferent + ' tatsächlich anders als Vision (Schwelle ' + result.usedThreshold + ', Sicherheitsstufe ' + result.confidence + ').');
    } else {
      console.log('OMR-Korrektur für System ' + (i + 1) + ' übersprungen: ' + result.reason);
    }
  }
  if (statusFn) {
    statusFn('OMR-Korrektur: ' + nSystemsApplied + ' von ' + lines.length + ' Systemen geometrisch nachgerechnet' +
      (nSystemsApplied ? ' (' + nSyllablesChanged + '/' + nSyllablesTotal + ' Silben-Tonhöhen angepasst)' : '') + '.');
  }
  return correctedLines;
}


// GregoBase's exported GABC header uses its OWN keys (mode/office-part/
// book/transcriber/...), none of which Notator's importer recognises (it
// only understands annotation:/notator-subtitle:/name:/drop-cap:). Maps the
// two the user wants surfaced: "mode" becomes the on-score annotation
// (e.g. "2"), "book" becomes the subtitle. "office-part" is deliberately
// ignored (not mapped to anything), per explicit request.
function gregMapGregoBaseHeaderFields(gabcStr) {
  if (!gabcStr.includes('%%')) return gabcStr;
  const si = gabcStr.indexOf('%%');
  const header = gabcStr.substring(0, si);
  const body = gabcStr.substring(si);
  const modeM = header.match(/^\s*mode\s*:\s*(.*?);?\s*$/im);
  const bookM = header.match(/^\s*book\s*:\s*(.*?);?\s*$/im);
  let extra = '';
  if (modeM && modeM[1].trim()) extra += 'annotation: ' + modeM[1].trim() + ';\n';
  if (bookM && bookM[1].trim()) extra += 'notator-subtitle: ' + bookM[1].trim() + ';\n';
  // GregoBase's plain gabc export never includes "drop-cap: auto" even when
  // the piece is printed with one (confirmed: this test piece's real page
  // clearly shows a decorative "A" opening "Audi", but the downloaded gabc
  // has no drop-cap header at all) — gregImportGABCString's bidirectional
  // toggle (see its own comment, Runde 61 fix) would otherwise explicitly
  // UNCHECK the box on every GregoBase import. Per explicit request, always
  // request a drop-cap for GregoBase imports; easy to uncheck by hand for
  // the rare piece that genuinely has none.
  extra += 'drop-cap: auto;\n';
  return header.trim() + '\n' + extra + body;
}

async function gregSearchGregoBase(incipit, opts) {
  const loose = !!(opts && opts.loose);
  // CORRECTION (Session 17): an earlier version of this comment assumed
  // the CORS block only applied to file:// (a "null" origin). Real-world
  // testing from a proper http://localhost server showed the SAME
  // "blocked by CORS policy: No 'Access-Control-Allow-Origin' header"
  // error — gregobase.selapa.net simply never sends that header for ANY
  // foreign browser origin, not just file://. That's normal, correctly-
  // behaving CORS on their end (they never opted their pages into
  // cross-site JS fetches), not a bug and not something any client-side
  // code or "just use a real server" trick can work around directly.
  // The actual fix: Notator_starten.bat now launches notator_server.py
  // instead of plain `python -m http.server` — it serves the files AND
  // proxies these two GregoBase endpoints server-side (a Python-to-
  // GregoBase request is not a browser fetch, so CORS never applies to
  // it), returning the result to the page as an ordinary same-origin
  // request. A file:// page still can't reach even that proxy (no
  // server at all is running under file://), so the guard below stays.
  if (location.protocol === 'file:') {
    throw new Error('GregoBase-Abgleich übersprungen: Datei läuft als file:// (per Doppelklick geöffnet) — bitte über Notator_starten.bat starten (echter lokaler Server inkl. GregoBase-Proxy, nötig weil gregobase.selapa.net keine direkten Browser-Zugriffe von fremden Seiten erlaubt).');
  }
  const firstLetter = incipit.normalize('NFD').replace(/[\u0300-\u036f]/g, '')[0].toUpperCase();
  if (!/[A-Z]/.test(firstLetter)) return [];
  const gbProxyBase = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? '' : 'https://notator-gregobase-proxy.matthias-krohn.workers.dev';
  const resp = await fetch(gbProxyBase + '/_gregobase_incipit?letter=' + firstLetter);
  if (!resp.ok) throw new Error('GregoBase HTTP ' + resp.status);
  const html = await resp.text();
  const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const incipitNorm = norm(incipit);
  const matches = [];
  // Parsed via the browser's own HTML parser rather than a hand-written
  // regex — a hand-written regex has to guess the exact raw tag
  // structure (attribute order, quote style, whitespace), and an
  // earlier version of this that was built by eyeballing a markdown-
  // converted preview of the page (not the real HTML) turned out not
  // to match at all, silently returning zero matches for every real
  // search. DOMParser sidesteps that entirely: whatever the actual
  // markup is, the browser parses it the same way it would for
  // display, and querySelectorAll finds every real link reliably.
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const seenIds = new Set();
  doc.querySelectorAll('a[href*="chant.php?id="]').forEach(a => {
    const idMatch = (a.getAttribute('href') || '').match(/id=(\d+)/);
    if (!idMatch) return;
    const id = idMatch[1];
    if (seenIds.has(id)) return;
    const title = (a.textContent || '').trim();
    if (!title) return;
    // The source name typically follows the link as plain text in
    // parentheses, e.g. "</a> (Solesmes)" — walk a couple of sibling
    // nodes forward to find it, tolerant of whatever's actually there.
    let trailing = '';
    let node = a.nextSibling;
    for (let i = 0; i < 4 && node; i++, node = node.nextSibling) {
      trailing += node.textContent || '';
    }
    const srcMatch = trailing.match(/\(([^)]*)\)/);
    const source = srcMatch ? srcMatch[1] : '';
    let ok = norm(title).startsWith(incipitNorm) || incipitNorm.startsWith(norm(title));
    // Titel und Text-Incipit weichen oft ab (Satzzeichen, Zusatz in Klammern, z.B. Titel «Ave Maria (Salutatio Angelica)» für den Text
    // «Ave Maria, gratia plena…»): zusätzlich ohne Klammern/Satzzeichen wortweise vergleichen.
    if (!ok) {
      const cl = s => norm(s).replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
      const tc = cl(title), ic = cl(incipit);
      if (tc && ic) ok = tc === ic || (tc + ' ').startsWith(ic + ' ') || (ic + ' ').startsWith(tc + ' ') || tc.startsWith(ic);
    }
    let score = 0;
    if (!ok && loose) {
      // Ähnlichkeitssuche: gemeinsame Wörter (ab 4 Buchstaben, Wortanfang) zählen; erstes Wort zählt doppelt
      const toks = s => norm(s).replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w.length >= 4);
      const qt = toks(incipit), tt = toks(title);
      qt.forEach((w, i) => { if (tt.some(x => x.startsWith(w.slice(0, 5)) || w.startsWith(x.slice(0, 5)))) score += i === 0 ? 2 : 1; });
      ok = score > 0;
    }
    if (ok) {
      seenIds.add(id);
      matches.push({ id, title, source, score, url: 'https://gregobase.selapa.net/chant.php?id=' + id });
    }
  });
  // Sort by relevance instead of leaving GregoBase's raw page order (which
  // is alphabetical-by-letter, not by closeness to OUR incipit). This
  // matters especially when the incipit is short (a single word, or a
  // Vision-truncated one) — many unrelated titles can share just the
  // first word (e.g. "Audi" matches "Audiam Domine" AND "Audi benigne
  // Conditor" equally under plain startsWith). Exact normalized matches
  // first, then whichever title's length is CLOSEST to the incipit's own
  // length (a near-exact-length match is far more likely to be the same
  // piece than one that's much longer or, unusually, shorter).
  matches.sort((a, b) => {
    if (loose && (b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
    const an = norm(a.title), bn = norm(b.title);
    const aExact = an === incipitNorm ? 0 : 1;
    const bExact = bn === incipitNorm ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    return Math.abs(an.length - incipitNorm.length) - Math.abs(bn.length - incipitNorm.length);
  });
  console.log('GregoBase-Suche für "' + incipit + '" (Buchstabe ' + firstLetter + '): ' + matches.length + ' Treffer nach Relevanz sortiert.');
  // No cap here anymore — the modal itself paginates (see
  // gregPickGregoBaseMatchModal's GREG_GB_PAGE_SIZE) so a long list is
  // still browsable via "weitere Treffer laden" instead of silently
  // hiding genuine matches beyond a fixed count.
  return matches;
}

// Zusatzangaben je GregoBase-Treffer (Quelle/Buch mit Seite, Gattung, Modus)
// aus dem Kopf der GABC-Datei – über den vorhandenen Download-Proxy, einmal
// je Stück (zwischengespeichert).
const _gregGbInfoCache = {};
function gregGbInfo(id) {
  if (_gregGbInfoCache[id]) return _gregGbInfoCache[id];
  const gbProxyBase = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? '' : 'https://notator-gregobase-proxy.matthias-krohn.workers.dev';
  _gregGbInfoCache[id] = fetch(gbProxyBase + '/_gregobase_download?id=' + encodeURIComponent(id) + '&format=gabc&elem=1')
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
    .then(txt => {
      const head = txt.indexOf('%%') >= 0 ? txt.slice(0, txt.indexOf('%%')) : '';
      const info = {};
      head.split(/\r?\n/).forEach(l => { const m = l.match(/^\s*([a-z-]+)\s*:\s*(.*?)\s*;?\s*$/i); if (m) info[m[1].toLowerCase()] = m[2]; });
      info._gabc = txt;
      return info;
    })
    .catch(e => { delete _gregGbInfoCache[id]; return null; });
  return _gregGbInfoCache[id];
}

// Notenvorschau für einen GregoBase-Treffer: Anfang des Stücks (eine
// Zeile) mit exsurge selbst setzen – vollständig sichtbar (Linien, Noten,
// Text), unabhängig von Grösse/Auflösung des GregoBase-Bildes.
function gregGbPreviewInto(container, gabc) {
  return new Promise((resolve, reject) => {
    try {
      let body = gabc.indexOf('%%') >= 0 ? gabc.slice(gabc.indexOf('%%') + 2) : gabc;
      body = body.replace(/%[^\n]*/g, ' ').replace(/\s+/g, ' ').trim();
      // die ersten ~14 Silben/Gruppen
      const re = /[^()\s]*\([^)]*\)/g; let m, n = 0, end = 0;
      while ((m = re.exec(body)) && n < 15) { end = re.lastIndex; if (!/^\([cf]b?[1-5](@[cf]b?[1-5])?\)$/.test(m[0])) n++; }
      const snippet = body.slice(0, end);
      if (!/\(/.test(snippet)) { reject(new Error('leer')); return; }
      const ctxt = new exsurge.ChantContext();
      ctxt.lyricTextFont = "'Palatino Linotype', Palatino, serif";
      const mappings = exsurge.Gabc.createMappingsFromSource(ctxt, snippet);
      const score = new exsurge.ChantScore(ctxt, mappings, false);
      score.performLayoutAsync(ctxt, () => {
        score.layoutChantLines(ctxt, 4000, () => {
          container.innerHTML = score.createSvg(ctxt);
          const svg = container.querySelector('svg');
          if (!svg) { reject(new Error('kein SVG')); return; }
          try {
            // tatsächlich belegte Fläche (Noten + Text) – Linien enden sonst erst bei 4000
            let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
            const inv = svg.getScreenCTM().inverse();
            const toUser = (x, y) => { const p = svg.createSVGPoint(); p.x = x; p.y = y; return p.matrixTransform(inv); };
            svg.querySelectorAll('use, text, path').forEach(el => {
              if (el.closest('defs')) return;
              const r = el.getBoundingClientRect();
              if (!r.width && !r.height) return;
              const a = toUser(r.left, r.top), z = toUser(r.right, r.bottom);
              x1 = Math.min(x1, a.x); y1 = Math.min(y1, a.y); x2 = Math.max(x2, z.x); y2 = Math.max(y2, z.y);
            });
            if (isFinite(x1)) {
              svg.querySelectorAll('line').forEach(l => { l.setAttribute('x2', Math.min(parseFloat(l.getAttribute('x2')) || 0, x2 + 8)); });
              svg.setAttribute('viewBox', (x1 - 6) + ' ' + (y1 - 6) + ' ' + (x2 - x1 + 20) + ' ' + (y2 - y1 + 12));
            }
          } catch (e) {}
          svg.removeAttribute('width'); svg.removeAttribute('height');
          svg.style.cssText = 'display:block;width:100%;height:auto;max-height:90px';
          svg.setAttribute('preserveAspectRatio', 'xMinYMid meet');
          // feste Pixelhöhe statt height:auto (Seitenverhältnis-abhängige Höhe verrechnete sich im Button
          // → Folgeelemente ("Weitere Treffer laden") überlappten die letzte Vorschau)
          try {
            const vb = (svg.getAttribute('viewBox') || '').split(/\s+/).map(parseFloat);
            const w = container.clientWidth || container.getBoundingClientRect().width;
            if (vb.length === 4 && vb[2] > 0 && w > 0) { svg.style.height = Math.min(90, Math.max(20, Math.round(w * vb[3] / vb[2]))) + 'px'; svg.style.maxHeight = 'none'; }
          } catch (e) {}
          resolve();
        });
      });
    } catch (e) { reject(e); }
  });
}

function gregPickGregoBaseMatchModal(matches, incipit, noneBtnLabel, similar) {
  const GREG_GB_PAGE_SIZE = 8; // shown per page — matches the old hard cap, but more can be loaded on request
  return new Promise(resolve => {
    showModal(similar ? '📚 Ähnliche Stücke in GregoBase' : '📚 Treffer in GregoBase gefunden', (similar ? 'Keine exakte Übereinstimmung — dies sind ähnliche Stücke (gleiche Wörter im Titel). Bitte genau prüfen, ob es das gesuchte Stück ist. ' : '') + 'Für "' + incipit + '" wurden folgende Einträge in der öffentlichen GregoBase-Chorendatenbank gefunden — bei Übereinstimmung wird die dort bereits geprüfte GABC-Transkription direkt übernommen (zuverlässiger als Bilderkennung). Zum Prüfen anklicken, dann auswählen oder ablehnen.', []);
    const bEl = document.getElementById('modal-btns');
    bEl.style.flexDirection = 'column';
    bEl.style.alignItems = 'stretch';
    let shown = 0;
    const listEl = document.createElement('div');
    bEl.appendChild(listEl);
    const moreWrap = document.createElement('div');
    moreWrap.style.cssText = 'flex-shrink:0;position:relative;margin-top:6px';
    listEl.style.cssText = 'flex-shrink:0';
    bEl.appendChild(moreWrap);
    function renderMoreRow() {
      moreWrap.innerHTML = '';
      const remaining = matches.length - shown;
      if (remaining <= 0) return;
      const moreBtn = document.createElement('button');
      moreBtn.className = 'b';
      moreBtn.style.cssText = 'font-style:italic';
      moreBtn.textContent = 'Weitere ' + Math.min(remaining, GREG_GB_PAGE_SIZE) + ' von ' + remaining + ' Treffern laden…';
      moreBtn.onclick = () => { renderNextPage(); };
      moreWrap.appendChild(moreBtn);
    }
    function renderNextPage() {
      const page = matches.slice(shown, shown + GREG_GB_PAGE_SIZE);
      page.forEach(m => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:6px;margin:2px 0';
        const link = document.createElement('a');
        link.href = m.url; link.target = '_blank'; link.rel = 'noopener';
        link.textContent = '🔗';
        link.style.cssText = 'text-decoration:none;font-size:13px;flex-shrink:0';
        link.title = 'In GregoBase ansehen (neuer Tab)';
        const btn = document.createElement('button');
        btn.className = 'b';
        btn.style.cssText = 'flex:1;text-align:left;min-width:0';
        const t1 = document.createElement('div');
        t1.textContent = m.title + ' — ' + (m.source || 'unbekannte Fassung') + ' (#' + m.id + ')';
        const t2 = document.createElement('div');
        t2.style.cssText = 'font-size:10px;color:#5a7a40;margin-top:1px';
        t2.textContent = 'Quelle wird geladen …';
        // Notenvorschau: Anfang des Stücks, selbst gesetzt (Fallback: Bild von GregoBase, ganz eingepasst)
        const pv = document.createElement('div');
        pv.style.cssText = 'margin-top:3px;background:#fff;border-radius:2px;overflow:hidden;min-height:20px;max-width:100%;contain:paint';
        pv.textContent = '';
        const imgFallback = () => {
          pv.innerHTML = '';
          const img = document.createElement('img');
          img.src = 'https://gregobase.selapa.net/chant_img.php?id=' + encodeURIComponent(m.id);
          img.alt = ''; img.loading = 'lazy';
          img.style.cssText = 'display:block;width:100%;height:110px;object-fit:contain;object-position:left top';
          img.onerror = () => pv.remove();
          pv.appendChild(img);
        };
        btn.appendChild(t1); btn.appendChild(t2); btn.appendChild(pv);
        gregGbInfo(m.id).then(info => {
          if (!info) { t2.textContent = 'Quelle: nicht abrufbar'; imgFallback(); return; }
          if (info._gabc) gregGbPreviewInto(pv, info._gabc).catch(imgFallback); else imgFallback();
          m.book = info.book || ''; m.officePart = info['office-part'] || ''; m.mode = info.mode || '';
          const parts = ['Quelle: ' + (m.book || 'unbekannt')];
          if (m.officePart) parts.push(m.officePart);
          if (m.mode) parts.push('Modus ' + m.mode);
          t2.textContent = parts.join(' · ');
          btn.title = parts.join('\n');
        });
        btn.onclick = () => { closeModal(); bEl.style.flexDirection=''; bEl.style.alignItems=''; resolve(m); };
        row.style.alignItems = 'flex-start';
        row.appendChild(link); row.appendChild(btn);
        listEl.appendChild(row);
      });
      shown += page.length;
      renderMoreRow();
    }
    renderNextPage();
    const noneBtn = document.createElement('button');
    noneBtn.className = 'b';
    noneBtn.textContent = noneBtnLabel || 'Keine davon — mit Bilderkennung fortfahren';
    noneBtn.onclick = () => { closeModal(); bEl.style.flexDirection=''; bEl.style.alignItems=''; resolve(null); };
    bEl.appendChild(noneBtn);
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'b';
    cancelBtn.textContent = 'Abbrechen';
    cancelBtn.onclick = () => { closeModal(); bEl.style.flexDirection=''; bEl.style.alignItems=''; resolve('__CANCEL__'); };
    bEl.appendChild(cancelBtn);
  });
}

// Deutlich sichtbares Popup, wenn GregoBase nichts findet (statt nur Statuszeile)
function gregNoMatchModal(query, wasLoose, errMsg) {
  return new Promise(resolve => {
    const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    showModal(errMsg ? '⚠️ GregoBase nicht erreichbar' : '🔍 Keine Ergebnisse', '', []);
    document.getElementById('modal-body').innerHTML =
      '<p style="font-size:13px;margin:0 0 8px"><b>' + (errMsg ? esc(errMsg) : (wasLoose ? 'Auch keine ähnlichen Stücke in GregoBase gefunden.' : 'Keine Ergebnisse in GregoBase gefunden.')) + '</b></p>' +
      '<p style="font-size:12px;color:var(--ink2);margin:0 0 8px">Gesucht: „' + esc(query) + '“</p>' +
      '<input id="gb-retry-q" type="text" value="' + esc(query) + '" style="width:100%;box-sizing:border-box;margin-bottom:4px" placeholder="Anderen Titel / Textanfang eingeben">';
    const bEl = document.getElementById('modal-btns');
    bEl.innerHTML = '';
    const done = v => { closeModal(); resolve(v); };
    const mk = (label, fn) => { const b = document.createElement('button'); b.className = 'b'; b.textContent = label; b.onclick = fn; bEl.appendChild(b); };
    if (!errMsg && !wasLoose) mk('Ähnliche Stücke suchen', () => done({ type: 'loose', q: document.getElementById('gb-retry-q').value.trim() || query }));
    mk('Mit diesem Titel erneut suchen', () => done({ type: 'retry', q: document.getElementById('gb-retry-q').value.trim() || query }));
    mk('Schliessen', () => done({ type: 'close' }));
  });
}

// Eigenständiger "Song importieren"-Button (Runde 2026-09-29, Nutzerwunsch):
// bisher war der GregoBase-Abgleich nur ein Zwischenschritt innerhalb von
// "PDF lesen" (gregLoadPDF) -- dafür musste immer erst ein PDF ausgewählt
// werden, nur damit der Titel daraus gelesen und bei GregoBase abgefragt
// wird. Diese Funktion macht genau den GregoBase-Teil (Titel eingeben ->
// suchen -> Treffer bestätigen -> GABC laden -> importieren) direkt
// aufrufbar, ganz ohne PDF. Nutzt bewusst dieselben, aus gregLoadPDF
// herausgelösten Hilfsfunktionen (gregSearchGregoBase/
// gregMapGregoBaseHeaderFields/gregPickGregoBaseMatchModal) statt eigener
// Kopien, damit ein künftiger Fix an der GregoBase-Anbindung automatisch
// für beide Wege gilt.
async function gregImportSongFromGregoBase(preset) {
  // preset (String): Titel direkt suchen, ohne Eingabefenster (z. B. aus der NOH-Bibliothek via #song=…)
  const incipit = (typeof preset === 'string' && preset.trim()) ? preset.trim() : (window.prompt('Titel / Textanfang (Incipit) oder GregoBase-ID (z.B. 1143 oder #1143 oder GregoBase-Link):', '') || '').trim();
  if (!incipit) return;
  // GregoBase-ID direkt: «1143», «#1143», «ID 1143» oder Link …chant.php?id=1143
  const idM = /^(?:#|id\s*:?\s*)?(\d{1,6})$/i.exec(incipit) || /gregobase[^\s]*[?&]id=(\d+)/i.exec(incipit);
  try {
    let query = incipit, loose = false, picked = null;
    if (idM) picked = { id: idM[1], title: '#' + idM[1], source: 'GregoBase' };
    else gregGst('Suche "' + incipit + '" in GregoBase…');
    for (let guard = 0; guard < 8 && !picked; guard++) {
      let matches = [], err = '';
      try { matches = await gregSearchGregoBase(query, { loose }); } catch (e) { err = e.message || String(e); }
      if (matches.length) {
        picked = await gregPickGregoBaseMatchModal(matches, query, 'Keine davon — abbrechen', loose);
        break;
      }
      const act = await gregNoMatchModal(query, loose, err);
      if (act.type === 'loose') { query = act.q; loose = true; gregGst('Suche ähnliche Stücke zu "' + query + '"…'); continue; }
      if (act.type === 'retry') { query = act.q; loose = false; gregGst('Suche "' + query + '" in GregoBase…'); continue; }
      gregGst('Kein GregoBase-Treffer für "' + query + '".');
      return;
    }
    if (!picked || picked === '__CANCEL__') { gregGst('Abgebrochen.'); return; }
    gregGst('Lade GABC von GregoBase (#' + picked.id + ')…');
    const gbProxyBase = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? '' : 'https://notator-gregobase-proxy.matthias-krohn.workers.dev';
    const dlResp = await fetch(gbProxyBase + '/_gregobase_download?id=' + picked.id + '&format=gabc&elem=1');
    if (!dlResp.ok) throw new Error('Download HTTP ' + dlResp.status);
    let gbGabc = (await dlResp.text()).trim();
    if (!gbGabc || (idM && !/\(/.test(gbGabc))) { gregGst(idM ? 'GregoBase-ID #' + picked.id + ' nicht gefunden.' : 'GregoBase-Download war leer.'); return; }
    if (idM) { const nm = /^\s*name\s*:\s*(.*?);?\s*$/mi.exec(gbGabc); if (nm && nm[1]) picked.title = nm[1]; }
    gbGabc = gregTagGregoBase(gregMapGregoBaseHeaderFields(gbGabc), picked);
    const target = await gregImportTargetChoice();
    if (!target) { gregGst('Abgebrochen.'); return; }
    if (target === 'new' && !(await ntConfirmDiscard())) { gregGst('Abgebrochen.'); return; }
    const previousEntries = gregEntries;
    const prevSections = target === 'new' ? gregCollapseSections() : null;   // neues Stück ersetzt auch die weiteren Abschnitte des alten
    gregImportGABCString(gbGabc, { deferRender: true });
    if (typeof clState !== 'undefined') ntResetOrganForImport(); // neues Stück: Orgel-Einstellungen auf Standard (Begleitsatz an)
    if (gregEntries.length > 400) { // gleiche Sicherheitsgrenze wie beim PDF-Weg
      const proceed = await gregConfirmModal('⚠️ Ungewöhnlich viele Einträge', 'Der GregoBase-Download ergibt ' + gregEntries.length + ' Einträge — ungewöhnlich viel. Trotzdem laden?');
      if (!proceed) { gregEntries = previousEntries; gregRestoreSections(prevSections); gregGst('Abgebrochen.'); return; }
    }
    gregRefreshListNoRender();
    gregRender();
    if (target === 'new') { gregLibCurrentId = null; setTimeout(() => ntMarkClean(), 50); }
    gregGst('Aus GregoBase geladen: "' + picked.title + '" (' + picked.source + ', #' + picked.id + ') — ' + gregEntries.length + ' Einträge. Bitte trotzdem gegenprüfen.');
  } catch (err) {
    gregGst('GregoBase-Fehler: ' + err.message);
    console.error('gregImportSongFromGregoBase:', err);
  }
}

async function gregLoadPDF(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';
  if (!window.pdfjsLib) { gregGst('PDF.js nicht geladen'); return; }
  gregGst('PDF wird geladen…');
  const ab = await file.arrayBuffer();
  try {
    // isEvalSupported:false – Schutz vor CVE-2024-4367 (Codeausführung über präparierte Schriften in PDF.js < 4.2.67)
    _gregPdfDoc = await pdfjsLib.getDocument({data: ab, isEvalSupported: false}).promise;
    _gregPdfPage = 1;
    // Handy: gleich zu den Noten wechseln (Original unten als einblendbares Blatt)
    if (gregIsMobileViewport() && window._gregMode === 'details') gregSetMode('edit');

    // Step 1: Try text extraction (works for text-PDFs with embedded GABC)
    let allText = '';
    for (let p = 1; p <= _gregPdfDoc.numPages; p++) {
      const page = await _gregPdfDoc.getPage(p);
      const tc = await page.getTextContent();
      allText += tc.items.map(i => i.str).join(' ') + '\n';
    }
    const gabcFound = gregExtractGABC(allText);
    if (gabcFound) {
      gregGst('GABC-Text gefunden — lade in Editor…');
      setTimeout(() => gregImportGABCString(gabcFound), 200);
      return;
    }


    const apiKey = (document.getElementById('greg-api-key')||{value:''}).value.trim();
    if (!apiKey) {
      gregPdfReadRow(true);
      gregGst('Bitte API-Key eingeben (Feld «API-Key» unter der Werkzeugleiste) und das PDF nochmals wählen');
      return;
    }

    // Detect how many pieces are on the page(s) first, then let user choose
    gregGst('Analysiere PDF (' + _gregPdfDoc.numPages + ' Seite(n))…');

    // Render page(s) for analysis. Multiple safety measures here after an
    // "Out of Memory" crash — and importantly, that crash was confirmed to
    // happen even on a genuinely short 2-page PDF, so the page-count cap
    // below (still worth having, for actual large scanned books) wasn't
    // the whole story: the Round-30 resolution bump (up to 4x/3400px) was
    // simply too aggressive as a default. A "Fehlercode: Out of Memory"
    // page is Chrome's renderer process being killed outright — that's a
    // hard OS/browser memory ceiling, not a JS exception we could ever
    // catch and recover from, so staying comfortably under it is the only
    // real fix; there's no graceful fallback once it happens.
    // 1) Cap how many pages actually get rendered/sent to the AI — a
    //    single chant piece (even a long multi-verse hymn) essentially
    //    never spans more than a handful of pages; anything beyond that is
    //    almost certainly a scanned book, and blindly processing all of it
    //    is both memory-risky and not what "read this piece" means anyway.
    // 2) Resolution dialed back to a more conservative default than Round
    //    30's (2000px/1700px/1400px instead of 3400/2600/1900, scale
    //    capped at 3x instead of 4x) — still noticeably sharper than the
    //    original pre-Round-30 baseline (2.5x/2400px) for the common
    //    1-2 page case, but without the same memory spike.
    // 3) A short yield after each page gives the browser an actual chance
    //    to reclaim the previous canvas's memory before allocating the
    //    next one, instead of potentially overlapping if GC hasn't run yet.
    const MAX_PDF_PAGES_FOR_AI = 6;
    const totalPages = _gregPdfDoc.numPages;
    const pagesToProcess = Math.min(totalPages, MAX_PDF_PAGES_FOR_AI);
    // NOTE on resolution history: Round 32 dialed this down out of caution
    // after an "Out of Memory" crash, but Round 33 found the actual cause
    // was a runaway EXTRACTION result (739 entries silently rendered),
    // not the PDF page image step itself — which, per the most recent
    // test, rendered fine at these sizes without crashing. Since that real
    // cause is now independently guarded against (see the note-group count
    // gate below), it's safe to raise resolution again here in the
    // interest of actually giving the model enough pixel detail to read
    // small, closely-spaced square notation — accuracy was still poor at
    // the very conservative Round-32 sizes.
    const targetWidth = pagesToProcess <= 2 ? 2600 : pagesToProcess <= 4 ? 2200 : 1700;
    if (totalPages > MAX_PDF_PAGES_FOR_AI) {
      gregGst('PDF hat ' + totalPages + ' Seiten — nur die ersten ' + MAX_PDF_PAGES_FOR_AI + ' werden analysiert (ein einzelnes Stück braucht praktisch nie mehr).');
    }
    // pageImages: one whole-page overview per page, at a moderate resolution
    // — used for Step A (piece detection: reading a title/incipit doesn't
    // need per-neume precision) and as a fallback if system-band detection
    // below doesn't find anything usable on a given page.
    const pageImages = []; // [{ b64, width, height, vp0Width, vp0Height }]
    // systemCropsByPage[p] = array of per-system high-res crops for page p,
    // in top-to-bottom order — used for Step C (extraction), where precise
    // neume/pitch reading actually needs the detail.
    const systemCropsByPage = {};
    // Pages where gregDetectStaffBands found single-line "reciting tone"
    // material (versicle/response, see that function's comment) that
    // wasn't turned into a system crop — surfaced to the user below so a
    // silently-skipped versicle doesn't look like it was just forgotten.
    let anyMonotoneLinesFound = false;
    for (let p = 1; p <= pagesToProcess; p++) {
      const page = await _gregPdfDoc.getPage(p);
      const vp0 = page.getViewport({scale: 1});
      const scale = Math.min(3, targetWidth / vp0.width);
      const vp = page.getViewport({scale});
      const offscreen = document.createElement('canvas');
      offscreen.width = vp.width;
      offscreen.height = vp.height;
      const octx = offscreen.getContext('2d');
      await page.render({canvasContext: octx, viewport: vp}).promise;
      pageImages.push({ b64: offscreen.toDataURL('image/jpeg', 0.9).split(',')[1], width: vp.width, height: vp.height });

      // Detect individual staff-system bands on THIS page (using the same
      // render we already have, no extra cost) and crop each one out of
      // THIS SAME canvas — see gregDetectStaffBands / gregCropCanvasBand.
      // Falls back to nothing (handled below via the whole-page image) if
      // detection doesn't find a clean set of 4-line staves, e.g. for an
      // atypical layout.
      try {
        const { bands: bandsPx, monotoneLineYs } = gregDetectStaffBands(octx, offscreen.width, offscreen.height);
        if (monotoneLineYs && monotoneLineYs.length) {
          anyMonotoneLinesFound = true;
          console.log('Seite ' + p + ': ' + monotoneLineYs.length + ' einzeilige(s) Rezitationston-System(e) erkannt (nicht transkribiert): ' + JSON.stringify(monotoneLineYs));
        }
        if (bandsPx.length) {
          const crops = [];
          for (const band of bandsPx) {
            const cropB64 = gregCropCanvasBand(offscreen, band.topPx, band.bottomPx);
            if (cropB64) {
              // Staff-line Y's were computed in the SOURCE canvas's
              // coordinates — re-express them relative to this crop's own
              // top so the prompt can state them as "N pixels from the top
              // of THIS image" (what the model actually sees).
              const lineYsInCrop = band.lineYs.map(y => Math.round(y - band.topPx));
              crops.push({ b64: cropB64, lineYsInCrop, cropHeight: Math.round(band.bottomPx - band.topPx) });
            }
          }
          systemCropsByPage[p] = crops;
        }
      } catch (bandErr) {
        console.warn('Notensystem-Erkennung fehlgeschlagen für Seite ' + p + ':', bandErr.message);
      }

      // Explicitly release this canvas's pixel buffer right away instead of
      // waiting for GC to eventually notice it's unreferenced — with many
      // pages in a row, that lag is exactly what let memory pile up.
      offscreen.width = 0;
      offscreen.height = 0;
      await new Promise(r => setTimeout(r, 0)); // yield so the browser can actually reclaim it
    }
    const totalKB = pageImages.reduce((s,p)=>s+p.b64.length,0)/1024;
    const totalCrops = Object.values(systemCropsByPage).reduce((s,arr)=>s+arr.length,0);
    gregGst('Bilder (' + Math.round(totalKB) + ' KB Übersicht' + (totalCrops ? ', ' + totalCrops + ' Notensystem-Ausschnitte' : '') + ') — erkenne Stücke…');
    if (anyMonotoneLinesFound) {
      gregGst('Hinweis: einzeilige Rezitationston-Notation erkannt (z.B. Versikel/Responsorium wie "℣. Angelis suis") — diese Notationsart wird noch nicht unterstützt und NICHT automatisch transkribiert. Bitte danach von Hand ergänzen.');
    }
    await gregRenderPDFPage(1);

    const imageBlocks = pageImages.map(p => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: p.b64 } }));

    // Step A: Detect pieces across ALL pages

    const detectResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500, // raised from 600 in Runde 57: the extra hasDropCap judgment pushed some responses past the old cap, truncating the JSON mid-array and silently triggering the single-piece fallback (mode "?") — this is a real, previously-seen failure mode, not a hypothetical one
        temperature: 0, // Runde 63: default temperature (1.0) let identical PDF pages produce noticeably different piece/mode/drop-cap readings across separate runs — greedy decoding removes this sampling noise (doesn't guarantee correctness, but removes randomness as a variable)
        messages: [{
          role: 'user',
          content: [
            ...imageBlocks,
            { type: 'text', text: `These ${pageImages.length} image(s) are page(s) of Gregorian chant scores (one piece may continue across several pages).
List each separate chant PIECE across all the page(s) shown. For each piece give:
- Its number/index (1, 2, ...)
- The mode/annotation number, ONLY if this piece has one of its own. A hymn's mode/tone number is often printed SMALL, off to the side of its first system rather than directly above the music — e.g. a label like "Hymn. II" in the margin/corner, or a plain digit/Roman numeral near the start; look specifically there, not just at the music itself, and give your single best-guess reading (e.g. "2" or "II") rather than "?". BUT a versicle/response (℣./℟.) normally has NO mode/tone number of its own in the print — don't guess one, don't reuse the hymn's own number for it, and don't default to "1" just to fill the field; use an empty string "" for its mode in that case. Only fall back to a placeholder guess for a piece that would normally carry its own number (a hymn, an antiphon, etc.) but where the print is unclear.
- The incipit: the OPENING PHRASE of the text, several words long (roughly up to the first comma or 4-6 words, whichever comes first) — e.g. "Audi benigne Conditor", NOT just its first single word ("Audi"). This is used as a search key against an external chant catalog, so it must be specific enough to distinguish this piece from other pieces that happen to start with the same first word.
- Which page(s) it appears on (1-based, e.g. [1] or [1,2])
- The total number of staff systems (lines of music) that belong to it, counting every system from its own incipit through its own final double bar. Count CAREFULLY, one system at a time, in the order they appear across the page(s) — this number is the ONLY way multiple pieces sharing the same page get split apart correctly later (piece 1 gets the first N systems, piece 2 gets the next M, and so on in that same top-to-bottom order); an off-by-one here misassigns a whole system to the wrong piece.
- Whether THIS piece begins with a large decorative drop-cap initial letter (a big ornamental capital, noticeably taller than the surrounding print, replacing the piece's very first letter) — true or false. Judge each piece by its OWN actual opening, don't assume: many hymns have one, but a short versicle/response directly underneath usually does NOT — look at what's really printed at that piece's own start, not at whether the piece above it had one.

IMPORTANT: a strophic hymn — one melody engraved once (or once per verse) with several NUMBERED verses of Latin text (1., 2., 3., ...), possibly with an English translation alongside — is ONE piece, not several. Only count it as multiple pieces if they are genuinely different chants (different incipit/title).

IMPORTANT: a hymn is very often followed directly underneath by a short VERSICLE AND RESPONSE pair (marked with ℣. and ℟., or "V." and "R.") — e.g. "℣. Angelis suis Deus mandavit / ℟. Ut custodiant te...". This is a DIFFERENT, separate piece from the hymn above it (different text, different chant) even though it has no decorative drop-cap or title of its own — list it as its own piece with its OWN correct system count (do not merge its systems into the hymn's count, and do not assign it 0). It IS still normal 4-line-staff notation like everything else here, just with an unusual musical feature: most or all of its notes sit on the exact SAME line (a monotone reciting tone) rather than moving up and down — that's expected and correct for this kind of text, not a sign you've miscounted or misread anything.

Your ENTIRE response must be ONLY the JSON array below — no reasoning, no explanation, no markdown code fences, nothing before or after it. Respond ONLY as JSON array, e.g.: [{"index":1,"mode":"2","incipit":"Alleluia","pages":[1],"systems":6,"hasDropCap":true},{"index":2,"mode":"IV","incipit":"Alleluia","pages":[1,2],"systems":9,"hasDropCap":false}]
Here is a THIRD example showing a hymn immediately followed by its versicle/response, to make both the empty-mode rule AND the drop-cap rule concrete (this is the common case, not a rare edge case — apply it every time this pattern appears): [{"index":1,"mode":"II","incipit":"Audi benigne Conditor","pages":[1],"systems":13,"hasDropCap":true},{"index":2,"mode":"","incipit":"Angelis suis Deus","pages":[2],"systems":2,"hasDropCap":false}] — note piece 2's mode is the empty string "" (NOT "II" copied from piece 1), piece 2's hasDropCap is false (a versicle/response typically has neither its own mode number nor its own drop-cap in print, even when the hymn right above it has both), and BOTH incipits are several words long, not truncated to a single word.` }
          ]
        }]
      })
    });
    if (!detectResp.ok) { gregGst('KI-Fehler ' + detectResp.status); return; }
    const detectData = await detectResp.json();
    let pieces = [];
    try {
      const detectText = (detectData.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('').trim();
      const jsonMatch = detectText.match(/\[[\s\S]*\]/);
      if (jsonMatch) pieces = JSON.parse(jsonMatch[0]);
    } catch(e) { pieces = []; }

    if (pieces.length === 0) {
      gregGst('Keine Stücke erkannt — versuche direkte Extraktion');
      pieces = [{index:1, mode:'?', incipit:'Stück 1', pages:pageImages.map((_,i)=>i+1)}];
    }

    // Build ONE global ordered list of every detected system (or whole
    // page, where band detection found nothing) across ALL pages, then
    // give each piece a [startIdx, endIdx) slice into it based on
    // cumulative system counts. This replaces slicing per-piece by "which
    // pages does it appear on" — that approach worked fine for excluding
    // a LATER piece's systems from an EARLIER piece (Runde 47/49), but had
    // no way to make a LATER piece SKIP OVER an earlier piece's trailing
    // systems on a page they share: piece 2 would just grab page 2's
    // systems starting from the TOP, re-capturing piece 1's tail end
    // instead of piece 2's own content (confirmed via "Alle Stücke laden"
    // — Section 2 turned out to just be piece 1's continuation again).
    // Cumulative offsets fix both directions at once from the same data.
    const allSystemItems = [];
    for (let pn = 1; pn <= pageImages.length; pn++) {
      const crops = systemCropsByPage[pn];
      if (crops && crops.length) {
        crops.forEach(c => allSystemItems.push({ type: 'crop', b64: c.b64, lineYsInCrop: c.lineYsInCrop, cropHeight: c.cropHeight }));
      } else if (imageBlocks[pn-1]) {
        allSystemItems.push({ type: 'wholepage', b64: imageBlocks[pn-1].source.data });
      }
    }
    {
      let cursor = 0;
      pieces.slice().sort((a,b) => a.index - b.index).forEach(p => {
        p._startIdx = cursor;
        // 0 is a valid, EXPLICIT count (used for a trailing single-line
        // versicle/response the detection prompt is told not to count as
        // real systems, see Step A prompt) and must NOT fall through to
        // "unknown -> take everything remaining", or a versicle entry
        // would swallow every system after it.
        const count = (typeof p.systems === 'number' && p.systems >= 0 && isFinite(p.systems)) ? p.systems : null;
        p._endIdx = count != null ? Math.min(allSystemItems.length, cursor + count) : allSystemItems.length;
        cursor = p._endIdx;
      });
    }

    // Step B: Let user choose which piece to extract
    let chosenIdx = 1;
    let loadAllPieces = false;
    if (pieces.length > 1) {
      const picked = await gregPickPieceModal(pieces);
      if (picked == null) { gregGst('Abgebrochen'); return; }
      if (picked === 'ALL') loadAllPieces = true;
      else if (picked === 'MERGE') {
        // alle erkannten Teile zu einem Stück zusammenfassen: ein Systembereich, ein Abschnitt
        const srt = pieces.slice().sort((a, b) => a.index - b.index);
        const first = srt[0];
        const merged = Object.assign({}, first, {
          index: first.index,
          _startIdx: Math.min(...srt.map(p => p._startIdx)),
          _endIdx: Math.max(...srt.map(p => p._endIdx)),
          systems: srt.reduce((a, p) => a + (typeof p.systems === 'number' ? p.systems : 0), 0) || first.systems,
          pages: Array.from(new Set([].concat(...srt.map(p => p.pages || [])))).sort((a, b) => a - b),
          _merged: srt.map(p => p.index)
        });
        pieces.splice(0, pieces.length, merged);
        chosenIdx = merged.index;
      }
      else chosenIdx = picked;
    }

    // Everything from the GregoBase lookup through the final import is
    // wrapped in this local function, parameterized by which piece to
    // process — originally this all ran once inline, but "load all
    // pieces" needs to run it once per piece (into a separate section
    // each time) instead of duplicating the whole pipeline.
    async function gregProcessOnePiece(chosen) {
    // Tracks whether this piece actually ended up with imported content —
    // returned to the caller so "load all pieces" can tell a genuinely
    // empty/failed piece apart from a successful one instead of just
    // counting every call as "loaded" regardless of outcome (a real bug:
    // an empty section from a failed extraction was silently counted as
    // success, see Runde 53 report of an empty "Abschnitt 2").
    let _pieceSucceeded = false;

    // Normalize hasDropCap to a real boolean. Root cause of the Runde-58
    // report (Versikel "Angelis" also got a decorative "A" it shouldn't
    // have): the Step-A model's JSON sometimes emits "hasDropCap": "false"
    // as a STRING rather than the unquoted boolean false — a non-empty
    // string is truthy in JS, so every `chosen.hasDropCap ? ... : ...`
    // check below silently treated that piece as if it DID have a drop
    // cap. Coercing once here, up front, makes every later check safe
    // regardless of which form the model used.
    chosen.hasDropCap = (chosen.hasDropCap === true || chosen.hasDropCap === 'true');
    // Runde 59: the model still judged hasDropCap=true for the versicle
    // piece despite an explicit worked example showing it false (confirmed
    // by the rendered "V" drop-cap in the user's test — the versicle
    // marker itself got grabbed as the drop-cap letter). Rather than trust
    // one more isolated visual judgment, correlate it with a signal we
    // ALREADY know is reliable this round: mode is intentionally left ""
    // ONLY for a versicle/response (Runde 55 fix, user-confirmed working).
    // Both are the same hymn-only print convention, so force them to
    // agree instead of asking the model to get two independent judgments
    // right at once.
    if (chosen.mode === '') chosen.hasDropCap = false;

    // ── GregoBase lookup ─────────────────────────────────────────────
    // Try a database match BEFORE doing any AI image recognition at all:
    // GregoBase (gregobase.selapa.net) is a large, human-transcribed and
    // human-corrected public GABC repository (~20'000 chants) — for
    // standard/published repertoire (very likely for something like this
    // hymn), an exact match there is essentially perfect data, far more
    // reliable than anything a vision model can extract from a photo. This
    // NEVER imports automatically — it only ever offers matches for the
    // person to confirm (with a link to the actual GregoBase page to
    // verify), exactly as requested; declining or finding no matches falls
    // straight through to the normal image-recognition pipeline below.

    try {
      console.log('GregoBase-Abgleich für Stück ' + chosen.index + ' ("' + chosen.incipit + '") gestartet…');
      gregGst('Suche "' + chosen.incipit + '" in GregoBase…');
      const gbMatches = await gregSearchGregoBase(chosen.incipit);
      if (gbMatches.length) {
        console.log('GregoBase: ' + gbMatches.length + ' Treffer angezeigt, warte auf Auswahl des Nutzers…');
        const picked = await gregPickGregoBaseMatchModal(gbMatches, chosen.incipit);
        if (picked === '__CANCEL__') {
          console.log('GregoBase: Nutzer hat komplett abgebrochen (weder Import noch Bilderkennung) für Stück ' + chosen.index + '.');
          gregGst('Abgebrochen.');
          return _pieceSucceeded;
        }
        if (picked) {
          console.log('GregoBase: Nutzer wählte #' + picked.id + ' ("' + picked.title + '", ' + picked.source + ') — starte Download…');
          gregGst('Lade GABC von GregoBase (#' + picked.id + ')…');
          const gbProxyBase = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? '' : 'https://notator-gregobase-proxy.matthias-krohn.workers.dev';
          const dlResp = await fetch(gbProxyBase + '/_gregobase_download?id=' + picked.id + '&format=gabc&elem=1');
          if (!dlResp.ok) throw new Error('Download HTTP ' + dlResp.status);
          let gbGabc = (await dlResp.text()).trim();
          console.log('GregoBase: Download erhalten, ' + gbGabc.length + ' Zeichen GABC.');
          if (gbGabc) {
            // GregoBase's own header fields (mode/office-part/book/...) use
            // different keys than Notator's own annotation/subtitle
            // convention, so none of them are picked up by gregImportGABCString
            // as-is (only "annotation:"/"notator-subtitle:"/"name:" are
            // recognised there). Per explicit request: show "mode" as the
            // on-score annotation (ignore "office-part" entirely), and put
            // "book" into the subtitle field.
            gbGabc = gregTagGregoBase(gregMapGregoBaseHeaderFields(gbGabc), picked);
            const target = await gregImportTargetChoice();
            if (!target) { gregGst('Abgebrochen.'); return _pieceSucceeded; }
            if (target === 'new' && !(await ntConfirmDiscard())) { gregGst('Abgebrochen.'); return _pieceSucceeded; }
            const previousEntries = gregEntries;
            const prevSections = target === 'new' ? gregCollapseSections() : null;
            gregImportGABCString(gbGabc, { deferRender: true });
    if (typeof clState !== 'undefined') ntResetOrganForImport(); // neues Stück: Orgel-Einstellungen auf Standard (Begleitsatz an)
            console.log('GregoBase: Import ergab ' + gregEntries.length + ' Einträge.');
            if (gregEntries.length > 400) { // sanity cap even for a trusted source — a malformed/huge download shouldn't render blindly either
              const proceed = await gregConfirmModal('⚠️ Ungewöhnlich viele Einträge', 'Der GregoBase-Download ergibt ' + gregEntries.length + ' Einträge — ungewöhnlich viel. Trotzdem laden?');
              if (!proceed) { gregEntries = previousEntries; gregRestoreSections(prevSections); gregGst('Abgebrochen.'); console.log('GregoBase: Import vom Nutzer abgelehnt (zu viele Einträge).'); return _pieceSucceeded; }
            }
            gregRefreshListNoRender();
            gregRender();
            if (target === 'new') { gregLibCurrentId = null; setTimeout(() => ntMarkClean(), 50); }
            gregGst('Aus GregoBase geladen: "' + picked.title + '" (' + picked.source + ', #' + picked.id + ') — ' + gregEntries.length + ' Einträge. Bitte trotzdem gegenprüfen.');
            console.log('GregoBase: erfolgreich geladen, Bilderkennung wird übersprungen.');
            _pieceSucceeded = true;
            return _pieceSucceeded; // done — skip the whole AI image-recognition pipeline below
          } else {
            console.log('GregoBase: Download war leer — falle durch zur Bilderkennung.');
          }
        } else {
          console.log('GregoBase: Nutzer hat "Keine davon" gewählt oder Dialog abgebrochen — fahre mit Bilderkennung fort.');
        }
      } else {
        console.log('GregoBase: keine Treffer für "' + chosen.incipit + '".');
        gregGst('Kein GregoBase-Treffer für "' + chosen.incipit + '" — fahre mit Bilderkennung fort…');
      }
    } catch (gbErr) {
      console.warn('GregoBase-Suche fehlgeschlagen (fahre mit Bilderkennung fort):', gbErr.message);
    }

    gregGst('Extrahiere Stück ' + chosen.index + ' (Modus ' + chosen.mode + ', "' + chosen.incipit + '")…');

    // ── Batched extraction ──────────────────────────────────────────
    // Earlier versions sent ALL of a piece's systems (up to 13+) in one
    // giant call with a "show your work" prompt. In practice this kept
    // running out of its token budget before finishing (a long piece's
    // worth of per-system reasoning is a lot to fit even in 8000 tokens),
    // and — more importantly — gave the model a huge, open-ended task in
    // which it kept reopening settled questions (which clef line, is this
    // two voices) partway through, burning the budget on that instead of
    // content. Splitting into several small batches (a handful of systems
    // each) keeps every individual call's task small enough to actually
    // finish, and contains any one call's confusion to just its own batch
    // instead of derailing the whole piece.
    //
    // Slice this piece's own systems out of the global list using its
    // precomputed cumulative offset range (see above) — correctly skips
    // over any OTHER piece's systems before or after it, even ones on the
    // same shared page.
    const systemItems = allSystemItems.slice(chosen._startIdx, chosen._endIdx);
    if (!systemItems.length) { gregGst('Keine Bilder für dieses Stück gefunden.'); console.error('Stück "' + chosen.incipit + '": leerer Systembereich (_startIdx=' + chosen._startIdx + ', _endIdx=' + chosen._endIdx + ') — Step-A-Systemzahl vermutlich falsch.'); return _pieceSucceeded; }
    // Second, independent line of defense against a page-boundary leak:
    // the system-count field above depends on the detection call correctly
    // counting across a possibly-complex shared page, which isn't
    // guaranteed. Separately, give every batch the incipits of every OTHER
    // detected piece, so even a batch made ENTIRELY of another piece's
    // systems (with none of the chosen piece's own content in it to
    // compare against) still has enough information to recognize "this
    // text doesn't belong here" and refuse it, rather than needing an
    // in-context comparison it can't make.
    const otherIncipits = pieces.filter(p => p.index !== chosen.index && !(chosen._merged || []).includes(p.index)).map(p => p.incipit).filter(Boolean);

    function gregSystemItemToBlocks(item, label) {
      if (item.type === 'crop') {
        const ordinal = n => n === 2 ? '2nd' : n === 3 ? '3rd' : n + 'th';
        const linesDesc = item.lineYsInCrop.map((y, i) => (i === 0 ? 'topmost' : i === 3 ? 'bottommost' : ordinal(i+1) + '-from-top') + ' staff line at pixel row y=' + y).join(', ');
        return [
          { type: 'text', text: `Image for ${label} below (height ${item.cropHeight}px). Its 4 staff lines sit at these EXACT pixel rows, measured from the top edge of this image: ${linesDesc}. These correspond, top-to-bottom, to LINE 4, LINE 3, LINE 2, LINE 1 (LINE 1 = physical bottom line, LINE 4 = physical top line). Use these numbers directly to judge each note's line/space instead of estimating by eye.` },
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: item.b64 } }
        ];
      }
      return [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: item.b64 } }];
    }

    const REFERENCE_MATERIAL = `Neume shapes (square notation): Punctum = single solid square note head. Virga = square note head with a thin stem down its right side (one note). Podatus = two note heads stacked vertically, BOTTOM note first then TOP. Clivis = two note heads joined by a short diagonal wedge, TOP note first then lower. Torculus = three notes low-high-low, one continuous shape. Porrectus = a curved/slanted stroke between two notes then a third note head (low-high-low). Climacus = a descending row of notes, each smaller after the first. A dot beside a note head = mora, written "." after that note's pitch letter.

IMPORTANT — this is monophonic chant: exactly ONE melodic line, never two simultaneous voices on the same staff. Multi-note neumes (podatus, clivis, torculus...) are sung one note after another in sequence, not simultaneously — never split a system into "upper voice"/"lower voice" or transcribe only one of them; read every note head of every neume in sequence and put them all in that syllable's one parenthesis.

IMPORTANT — a versicle/response (marked ℣./℟. in the text) is normally a RECITING TONE: nearly every syllable sits on the exact same line, one plain square after another with almost no melodic movement, until a short closing flourish on the last word or two. If the text you're given starts with ℣. or ℟., expect long runs of the SAME pitch letter in a row — that is correct and expected for this kind of text, not a sign of a misreading; don't second-guess it or start varying pitches to make it look more "musical".`;

    // Renders one of our own exsurge clef glyphs (the exact shapes this
    // app itself draws) to a small reference image, so the clef-detection
    // call below can visually COMPARE the system's clef against a known
    // example instead of matching a verbal description. This replaces an
    // earlier "F-clef often has two dots" description, which was simply
    // wrong for this notation style (that's the MODERN 5-line-staff F-clef
    // — confirmed via research) and likely why Fa clefs kept getting
    // misread as Do. The real, confirmed distinguishing feature: the Fa
    // clef glyph is nearly TWICE as wide as the Do clef (it's visually the
    // Do-clef shape plus an extra square block attached on the left) —
    // both exact glyph widths pulled directly from this app's own Glyphs
    // data and cross-checked (Do=100 units wide, Fa=193.75).
    function gregRenderClefReferenceImage(pathD, label) {
      return new Promise(resolve => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 -220 240 400"><rect width="100%" height="100%" fill="white"/><path fill="black" d="${pathD}"/><text x="-15" y="160" font-size="28" fill="black">${label}</text></svg>`;
        const svgB64 = btoa(unescape(encodeURIComponent(svg)));
        const imgEl = new Image();
        imgEl.onload = () => {
          const c = document.createElement('canvas');
          c.width = 240; c.height = 400;
          const cctx = c.getContext('2d');
          cctx.fillStyle = 'white'; cctx.fillRect(0, 0, 240, 400);
          cctx.drawImage(imgEl, 0, 0, 240, 400);
          resolve(c.toDataURL('image/png').split(',')[1]);
        };
        imgEl.onerror = (e) => { console.warn('Clef reference image render failed for', label, e); resolve(null); };
        imgEl.src = 'data:image/svg+xml;base64,' + svgB64;
      });
    }
    const DO_CLEF_PATH_D = "M0 98.406V-97.688C0-118 5.99-134.275 17.97-146.516c11.978-12.24 27.603-18.36 46.874-18.36 10.937 0 19.53 3.126 25.78 9.376s9.376 14.583 9.376 25v107.813l-6.25-5.47c-4.167-3.645-10.287-7.42-18.36-11.327-8.072-3.907-16.796-5.86-26.17-5.86-11.46 0-21.486 4.427-30.08 13.282-8.593 8.854-12.89 19.53-12.89 32.03s4.297 23.308 12.89 32.423c8.594 9.115 18.62 13.672 30.08 13.672 9.374 0 18.098-1.822 26.17-5.468 8.073-3.646 14.193-7.292 18.36-10.938l6.25-6.25V132c0 9.896-3.125 18.1-9.375 24.61-6.25 6.51-14.844 9.765-25.78 9.765-19.272 0-34.897-6.25-46.876-18.75C5.99 135.125 0 118.72 0 98.405z";
    const FA_CLEF_PATH_D = "M85.156-32v193.75c0 9.375-1.562 14.323-4.687 14.844-1.564 0-2.605-.52-3.126-1.563-.52-1.04-.782-2.603-.78-4.686V56.28c-8.335-8.332-19.793-12.5-34.376-12.5-17.71 0-31.77 3.907-42.188 11.72V-32c0-18.23 14.193-27.344 42.578-27.344 28.385 0 42.578 9.115 42.578 27.344zM98.438 93V-92.156c0-19.27 5.73-34.896 17.187-46.875 11.458-11.98 26.562-17.97 45.313-17.97 10.937 0 19.14 2.865 24.61 8.594 5.467 5.73 8.202 13.542 8.202 23.437v103.126l-5.47-4.687c-3.645-3.647-9.374-7.293-17.186-10.94-7.813-3.645-15.886-5.467-24.22-5.468-11.978 0-22.004 4.167-30.077 12.5-8.073 8.334-12.11 18.36-12.11 30.08 0 11.717 4.037 22.004 12.11 30.858s18.1 13.28 30.078 13.28c8.333 0 16.406-1.822 24.22-5.468 7.81-3.645 13.54-7.03 17.186-10.156l5.47-5.468V125.81c0 9.896-2.865 17.84-8.594 23.83-5.73 5.988-13.802 8.983-24.22 8.983-18.75 0-33.853-6.12-45.31-18.36-11.46-12.24-17.19-27.994-17.19-47.265z";

    // Known width/height ratio of each clef glyph, computed directly from
    // this app's own Glyphs bounding boxes (Do: 100×331.25, Fa: 193.75×
    // 333.6 — see the "DoClef"/"FaClef" entries in the embedded exsurge.js
    // Glyphs data). Do and Fa are nearly the SAME height but very
    // different WIDTH, so this ratio is a large (~0.30 vs ~0.58), scale-
    // independent fingerprint for telling them apart — see
    // gregMeasureClefWidthRatio below.
    const DO_CLEF_WH_RATIO = 100 / 331.251;
    const FA_CLEF_WH_RATIO = 193.752 / 333.595;

    // Combined clef-crop analysis: (1) a deterministic pixel width/height
    // measurement as an independent cross-check on the vision-model
    // comparison below, and (2) a tightly-cropped, magnified close-up of
    // just the clef to send the model alongside the two reference glyphs.
    //
    // Runde 51 shipped (1) alone, scanning for ink starting at the crop's
    // left edge (x=0). Runde 52 testing against the actual reference PDF
    // (Audi_benigne_conditor.pdf) exposed why that stayed unreliable: a
    // print commonly has a small mode/hymn-number label ("Hymn. II") AND
    // a large decorative drop-cap letter sitting at the SAME height as
    // the clef, to its left, inside the SAME cropped band (crops keep the
    // page's full width) — a plain left-to-right scan hits both of those
    // before ever reaching the real clef, and (confirmed on the real
    // page) can even produce a width/height ratio that looks plausible
    // enough to be mistaken for one of the two known clef ratios. Neither
    // is tall enough to reliably trip the old "touches both crop edges"
    // drop-cap guard either.
    //
    // Fix: locate where the STAFF ITSELF begins in x first, using the
    // same idea as gregDetectStaffBands but looking for a long (>=20px)
    // continuous dark run at each of the 4 known line rows — real staff
    // lines are long uninterrupted strokes, while label/drop-cap text at
    // that same height is made of short, separated letter strokes, so
    // this reliably finds the staff's own left edge regardless of
    // whatever text sits further left (verified against the real page:
    // all 4 lines agreed on ~the same start x, while individual letter
    // strokes of "Hymn. II" and the "A" drop-cap never produced a run
    // anywhere near 20px). The clef sits right at/after that x — both the
    // pixel measurement and the close-up crop now start searching there
    // instead of at x=0.
    //
    // NOTE, found via the same real-page test: even with that fix, a
    // clean pixel ratio isn't always achievable — this particular font's
    // hook shape has a thin "waist" (visible opening where the staff line
    // passes through) that can read as a false gap and split the glyph,
    // and on a lower-fidelity scan the measured ratio can land close to
    // the midpoint between the two known reference ratios. The confidence
    // margin already in place (see the reconciliation code below) is what
    // keeps that honest — an inconclusive measurement abstains rather
    // than forcing a guess. The close-up crop (2) exists specifically to
    // give the MODEL a real shot at this even when the pixel math can't
    // resolve it: a magnified, isolated view of just the clef makes "is
    // there a solid block to the left of the loop" a much easier visual
    // question than reading it off the full system image.
    function gregAnalyzeClefCrop(b64, cropHeight, lineYsInCrop) {
      return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
          try {
            const c = document.createElement('canvas');
            c.width = img.naturalWidth; c.height = img.naturalHeight;
            const cctx = c.getContext('2d');
            cctx.drawImage(img, 0, 0);
            const fullW = c.width;
            const data = cctx.getImageData(0, 0, fullW, c.height).data;
            const darkThreshold = 150;
            const isDark = (x, y) => {
              const i = (y * fullW + x) * 4;
              return (data[i] + data[i + 1] + data[i + 2]) / 3 < darkThreshold;
            };

            // Estimate the staff's line-to-line gap from the known line
            // rows (needed to size the search/crop windows below).
            let gap = 40;
            if (lineYsInCrop && lineYsInCrop.length >= 2) {
              const diffs = [];
              for (let k = 1; k < lineYsInCrop.length; k++) diffs.push(Math.abs(lineYsInCrop[k] - lineYsInCrop[k-1]));
              gap = diffs.reduce((a,b)=>a+b,0) / diffs.length || 40;
            }

            // Find the staff's own left starting edge (see comment above).
            let staffStartX = null;
            if (lineYsInCrop) {
              for (const lyRaw of lineYsInCrop) {
                const y = Math.round(lyRaw);
                if (y < 0 || y >= c.height) continue;
                let run = 0, runStart = -1;
                for (let x = 0; x < fullW; x++) {
                  if (isDark(x, y)) {
                    if (run === 0) runStart = x;
                    run++;
                    if (run >= 20) { if (staffStartX === null || runStart < staffStartX) staffStartX = runStart; break; }
                  } else run = 0;
                }
              }
            }
            if (staffStartX === null) staffStartX = 0; // fall back to old behavior if lines weren't supplied/found

            const scanFrom = Math.max(0, Math.round(staffStartX - gap * 0.3));
            const scanWidth = Math.min(fullW - scanFrom, 700);

            const colInk = new Array(scanWidth).fill(0);
            for (let xi = 0; xi < scanWidth; xi++) {
              let cnt = 0;
              const x = scanFrom + xi;
              for (let y = 0; y < c.height; y++) if (isDark(x, y)) cnt++;
              colInk[xi] = cnt;
            }
            const glyphColThreshold = Math.max(6, c.height * 0.12);
            const GAP_RUN = 15;
            const blobs = [];
            let inBlob = false, blobStart = 0, gapCount = 0;
            for (let xi = 0; xi < scanWidth; xi++) {
              const above = colInk[xi] >= glyphColThreshold;
              if (above) {
                if (!inBlob) { inBlob = true; blobStart = xi; }
                gapCount = 0;
              } else if (inBlob) {
                gapCount++;
                if (gapCount >= GAP_RUN) { blobs.push([blobStart, xi - gapCount]); inBlob = false; gapCount = 0; }
              }
            }
            if (inBlob) blobs.push([blobStart, scanWidth - 1]);

            let pixelMeasure = null;
            let chosen = null;
            for (const [bx0, bx1] of blobs) {
              let minY = Infinity, maxY = -Infinity;
              for (let xi = bx0; xi <= bx1; xi++) {
                const x = scanFrom + xi;
                for (let y = 0; y < c.height; y++) {
                  if (isDark(x, y)) { if (y < minY) minY = y; if (y > maxY) maxY = y; }
                }
              }
              const touchesTop = minY <= 2, touchesBottom = maxY >= c.height - 3;
              if (touchesTop && touchesBottom) continue; // likely a drop cap — try the next blob
              chosen = { widthPx: bx1 - bx0, heightPx: maxY - minY };
              break;
            }
            if (chosen && chosen.heightPx >= 10) {
              pixelMeasure = { ratio: chosen.widthPx / chosen.heightPx, widthPx: chosen.widthPx, heightPx: chosen.heightPx, blobCount: blobs.length, staffStartX };
            }

            // Build the magnified close-up crop: from just before the
            // staff's own start to comfortably past the widest plausible
            // clef (Fa is the wider of the two), full crop height, scaled
            // up 3x so a small glyph is actually legible to the model.
            const closeupX0 = Math.max(0, Math.round(staffStartX - gap * 0.5));
            const closeupW = Math.min(fullW - closeupX0, Math.round(gap * 4.5));
            let closeupB64 = null;
            if (closeupW > 10) {
              const cc = document.createElement('canvas');
              const zoom = 3;
              cc.width = closeupW * zoom; cc.height = c.height * zoom;
              const ccx = cc.getContext('2d');
              ccx.imageSmoothingEnabled = false;
              ccx.fillStyle = 'white'; ccx.fillRect(0, 0, cc.width, cc.height);
              ccx.drawImage(c, closeupX0, 0, closeupW, c.height, 0, 0, cc.width, cc.height);
              closeupB64 = cc.toDataURL('image/png').split(',')[1];
              cc.width = 0; cc.height = 0;
            }

            resolve({ pixelMeasure, closeupB64 });
          } catch (e) {
            console.warn('Clef crop analysis failed:', e.message);
            resolve({ pixelMeasure: null, closeupB64: null });
          }
        };
        img.onerror = () => resolve({ pixelMeasure: null, closeupB64: null });
        img.src = 'data:image/jpeg;base64,' + b64;
      });
    }

    // Step 1: determine the clef ONCE, in its own tiny focused call, using
    // only the first system — kept entirely separate from the batches
    // below specifically so "which line is the clef on" can never
    // resurface mid-batch the way it kept doing when it shared a call
    // with everything else.
    let clefLine = 3, clefIsDo = true;
    try {
      const [doRefB64, faRefB64, clefCropAnalysis] = await Promise.all([
        gregRenderClefReferenceImage(DO_CLEF_PATH_D, 'Do-clef'),
        gregRenderClefReferenceImage(FA_CLEF_PATH_D, 'Fa-clef'),
        systemItems[0].type === 'crop'
          ? gregAnalyzeClefCrop(systemItems[0].b64, systemItems[0].cropHeight, systemItems[0].lineYsInCrop)
          : Promise.resolve({ pixelMeasure: null, closeupB64: null })
      ]);
      const pixelMeasure = clefCropAnalysis.pixelMeasure;
      const clefCloseupB64 = clefCropAnalysis.closeupB64;
      if (pixelMeasure) console.log('Clef pixel measurement: ' + JSON.stringify(pixelMeasure) + ' — reference ratios: Do≈' + DO_CLEF_WH_RATIO.toFixed(3) + ', Fa≈' + FA_CLEF_WH_RATIO.toFixed(3));
      else console.log('Clef pixel measurement: unavailable (no crop for first system, or no clear blob found) — relying on model only.');
      const refBlocks = [];
      console.log('Clef reference images rendered: ' + JSON.stringify({ doRefB64: !!doRefB64, faRefB64: !!faRefB64, clefCloseupB64: !!clefCloseupB64 }));
      if (doRefB64) refBlocks.push(
        { type: 'text', text: 'Reference image A — this is exactly what a Do/C-clef looks like:' },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: doRefB64 } }
      );
      if (faRefB64) refBlocks.push(
        { type: 'text', text: 'Reference image B — this is exactly what a Fa/F-clef looks like. Notice it is NOTICEABLY WIDER than the Do-clef above (roughly double) — visually it is the Do-clef shape plus an extra small square block attached on its left side. (This is the correct chant/square-notation Fa-clef shape — NOT the modern 2-dot F-clef used in ordinary 5-line staff notation, which looks completely different and does not apply here.)' },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: faRefB64 } }
      );
      // Magnified, isolated close-up of just the clef (see
      // gregAnalyzeClefCrop) — added because judging relative width across
      // two separate, differently-scaled images (the reference glyphs vs.
      // the full system image) proved unreliable in practice; a zoomed
      // crop of ONLY the clef, shown right next to the same-style
      // reference glyphs, turns it into a much more direct visual match.
      const clefQuestionBlocks = clefCloseupB64
        ? [
            { type: 'text', text: 'Close-up of ONLY the clef from the real system below (magnified, isolated from the rest of the staff):' },
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: clefCloseupB64 } },
            { type: 'text', text: 'Now here is the actual system that close-up was taken from, for the staff-line position:' },
            ...gregSystemItemToBlocks(systemItems[0], 'the first system of a chant piece')
          ]
        : [
            { type: 'text', text: 'Now here is the actual system to identify the clef in:' },
            ...gregSystemItemToBlocks(systemItems[0], 'the first system of a chant piece')
          ];
      const clefResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'x-api-key':apiKey, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 300,
          temperature: 0, // Runde 63: see rationale at the Step-A call above — same determinism fix applied to all three API call sites
          messages: [{
            role: 'user',
            content: [
              ...refBlocks,
              ...clefQuestionBlocks,
              { type: 'text', text: `Compare the clef glyph (use the close-up if one was given above, it's clearer than the full system) against Reference images A and B above: is it noticeably narrow (matches A, Do-clef) or noticeably wider with that extra block on the left (matches B, Fa-clef)? Also state which of the 4 staff lines it sits on, using the given pixel coordinates from the full system image. Respond with ONLY one line, exactly in this format, nothing else: "CLEF: Do LINE 3" (substituting Do/Fa and 1-4 as appropriate). Do not discuss the mode, the expected final pitch, or anything else.` }
            ]
          }]
        })
      });
      if (clefResp.ok) {
        const clefData = await clefResp.json();
        const clefText = (clefData.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('').trim();
        console.log('Clef detection raw response:', clefText);
        // The original regex required "Do"/"Fa" immediately (whitespace
        // only) before "LINE" — matching only the EXACT example format
        // given in the prompt. Any real-world deviation (e.g. "Fa-clef,"
        // or "Fa clef on") failed to match, and failure fell through
        // SILENTLY to the hardcoded Do/LINE-3 default below — which is
        // very likely why the clef "always" came out as Do/c3 regardless
        // of what the model actually determined: a parsing bug wearing
        // the costume of a recognition bug. Loosened to tolerate a short
        // run of extra words in between, and logs the raw response either
        // way so a future mismatch is visible instead of silent.
        const m = clefText.match(/\b(Do|Fa)\b[\s\S]{0,25}?\bLINE\s*([1-4])\b/i);
        if (m) {
          clefIsDo = /do/i.test(m[1]);
          clefLine = parseInt(m[2]);
        } else {
          console.warn('Clef detection: could not parse expected format, falling back to Do/LINE 3 default.');
        }
      }
      // Pixel measurement is now DIAGNOSTIC-ONLY, not authoritative — see
      // Runde 52 real-world test: on the actual reference PDF the vision
      // model (helped by the close-up crop above) correctly said "Fa",
      // but this pixel measurement confidently produced ratio=0.182 (an
      // undermeasurement — the hook's thin waist still splits the glyph
      // even after the x-start fix) and WRONGLY OVERRODE the model's
      // correct answer back to "Do". A confidence-margin threshold only
      // guards against an UNCERTAIN measurement forcing a bad override —
      // it does nothing when the measurement is confidently wrong, which
      // is exactly what happened. Overriding a demonstrably-working
      // signal (the close-up crop) with a demonstrably-unreliable one is a
      // net loss, so this no longer changes clefIsDo — it's kept purely so
      // a future console log still shows both signals side by side for
      // manual comparison if Fa detection acts up again.
      if (pixelMeasure) {
        const distDo = Math.abs(pixelMeasure.ratio - DO_CLEF_WH_RATIO);
        const distFa = Math.abs(pixelMeasure.ratio - FA_CLEF_WH_RATIO);
        const pixelSaysDo = distDo < distFa;
        console.log('Clef pixel vs model (diagnostic only, no longer overrides): ' + JSON.stringify({ pixelRatio: pixelMeasure.ratio.toFixed(3), pixelSaysDo, modelSaysDo: clefIsDo }));
      }
    } catch(e) { /* keep the LINE 3 Do-clef default below on any failure */ }

    // KEY INSIGHT from comparing a real extraction against the original
    // print (Runde 46): GABC note letters are PURELY POSITIONAL — bottom
    // line is ALWAYS d, 2nd line f, 3rd line h, top line j, regardless of
    // clef. The clef only determines solfège/sounding pitch, which matters
    // for the header's clef code (c3/c4/f3/f4) but NOT for reading note
    // letters off the staff. The previous prompts' solfège lookup tables
    // ("Do=h Re=i ...") sent the model on a needless detour (position →
    // solfège → letter) with error potential at each hop; the direct rule
    // (position → letter) has no hops at all. The clef code itself is now
    // determined by the dedicated mini-call above and written into the
    // body by US — batches are told to never emit any clef token.
    const clefCode = (clefIsDo ? 'c' : 'f') + clefLine;
    const clefLabel = (clefIsDo ? 'Do' : 'Fa') + '-clef on LINE ' + clefLine;
    gregGst('Schlüssel erkannt: ' + clefLabel + ' (' + clefCode + ') — extrahiere Systeme…');

    // Step 2: batch the systems into small groups and extract each batch
    // with its own small, focused call. 4 systems/batch keeps every call's
    // task (and its "show your work" output) short enough to reliably
    // finish inside a modest token budget.
    const BATCH_SIZE = 2; // reduced from 4 in Runde 62 — the larger batch was triggering long step-by-step narration that burned the whole token budget before ever reaching the output (confirmed via console log), not a token-limit problem per se; a smaller per-call task reduces that incentive
    const batches = [];
    for (let i = 0; i < systemItems.length; i += BATCH_SIZE) batches.push(systemItems.slice(i, i + BATCH_SIZE));

    let combinedBody = '';
    let anyBatchFailed = false;
    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      const startSysNum = b * BATCH_SIZE + 1;
      gregGst('Extrahiere Systeme ' + startSysNum + '–' + (startSysNum + batch.length - 1) + ' von ~' + systemItems.length + '…');
      const isFirstBatch = b === 0;
      const batchBlocks = [];
      batch.forEach((item, k) => batchBlocks.push(...gregSystemItemToBlocks(item, 'system #' + (startSysNum + k))));

      const dropCapNote = isFirstBatch
        ? (chosen.hasDropCap
            ? `\n\nThis piece's known incipit is "${chosen.incipit}". It begins with a large decorative drop-cap letter beside/above the first system, NOT included in this image — if system #1's visible text seems to be missing a leading letter compared to the known incipit (e.g. incipit "Audi" but you see "U-di,"), that missing initial letter is just the drop cap; reconstruct the true first syllable by prepending it (here: first syllable "Au", with whatever notes belong to that first visible neume group).`
            : `\n\nThis piece's known incipit is "${chosen.incipit}". It does NOT have a decorative drop-cap letter — transcribe the visible first syllable literally, exactly as shown, without assuming any initial letter is missing.`)
        : '';
      const otherIncipitsNote = otherIncipits.length
        ? `\n\nOther, DIFFERENT pieces detected elsewhere on the same page(s) begin with: ${otherIncipits.map(t => '"' + t + '"').join(', ')}. If ANY system given to you here starts with one of THESE words instead of continuing "${chosen.incipit}", that system (and everything after it) belongs to one of those other pieces, not this one — exclude it entirely, do not transcribe it, and stop your output at that point. This applies even if every single system in this batch turns out to be from another piece — output nothing for this batch in that case (just the marker with an empty body) rather than transcribing it anyway.`
        : '';

      const promptText = `Transcribe systems #${startSysNum} through #${startSysNum + batch.length - 1} of a Gregorian chant piece (mode ${chosen.mode}, incipit "${chosen.incipit}") into GABC syllable(pitch) notation. These are consecutive systems from the middle of a longer piece — just transcribe what's shown, in order.${dropCapNote}${otherIncipitsNote}

NOTE LETTERS ARE PURELY POSITIONAL — the letter depends only on WHERE the note head sits on the staff, nothing else (not the clef, not the mode, not the melody):
  bottom line = d | space above it = e | 2nd line = f | space = g | 3rd line = h | space = i | top line = j
  below the staff: space just under the bottom line = c, then b, a. Above the staff: space just over the top line = k, then l, m.
That is the complete rule. Do NOT think about the clef, solfège (Do/Re/Mi), or what pitch "sounds right" — none of that changes the letter. Do not write any clef token like (c3) or (c4); the clef is handled separately.

${REFERENCE_MATERIAL}

For EACH system given here, output EXACTLY ONE line, in this format and nothing more:
  System N: syllable1(pitches1)syllable2(pitches2) syllable3(pitches3) ...
Example: System 5: Ký(fg)ri(g)e(f.) (,) e(g)lé(h)i(gf)son(g.)
(Note the example: "Kýrie" is ONE word, so its three syllables Ký/ri/e are written back-to-back with NO space between them — only the closing ")" of one and the opening of the next syllable's text. "eléison" is a second, separate word, so there IS a space before it. Getting this wrong (spacing out every syllable, e.g. "Ký(fg) ri(g) e(f.)") makes the importer treat each syllable as its own one-syllable word, which prints a visible gap in the MIDDLE of "Kyrie" — a real, previously-seen bug.)
Rules:
  - The FIRST characters of your entire reply must be "System ${startSysNum}:" — no preamble, no restating the staff-line coordinates back, no sentence like "Let me analyze..." or "Looking at the image...", not even one. Go straight from the image to pitch letters — this line IS your answer.
  - Do not narrate your reasoning anywhere in the response: no "let me", "looking at", "I can see", "the note appears to be", no re-deriving the pixel-to-letter table back at the model, no self-correction language ("wait", "actually", "let me reconsider", "hmm"). If you catch yourself about to write a sentence instead of a "System N: ..." line, stop and write the line instead — a confident single pass beats a narrated, careful one, and an unfinished narration that never reaches the answer is a complete failure, worse than an imperfect but complete guess.
  - Write each system's line ONCE. Do not revisit or rewrite a system once written — no "wait", "let me re-check", "actually". A best-effort single pass beats a perfect-but-incomplete one.
  - Use the given pixel coordinates for each image directly: compare each note head's pixel row to the 4 given staff-line values. Getting the NUMBER of notes on a syllable right matters just as much as getting the pitch right — undercounting (missing a real second note head and writing only one letter) is EXACTLY AS WRONG as overcounting (inventing a second note that isn't there), so do not default to "just write one letter" as a safe fallback. Judge the count from the shape's WIDTH, not just from a single glance: a syllable carrying ONE note is roughly as wide as a single plain notehead square; a syllable carrying TWO joined/stacked notes (Podatus, Clivis, and similar compound neumes) is noticeably WIDER or TALLER than that — look for either a second distinct notehead-sized bump (possibly overlapping or connected by a short stroke to the first), or a shape whose vertical extent clearly spans more than one note head's height. If the glyph for a syllable looks distinctly bigger (wider or taller) than the plain single noteheads elsewhere in the same system, that is your cue to look again for a second note rather than settling for one.
  - SPACING IS SEMANTIC, read it carefully off the printed lyrics: two syllables of the SAME word get written back-to-back with NO space between them ("Au(hi)di(g)" for the two syllables of "Audi"); a space is used ONLY between two separate words ("di(g) be(gh)" — "di" ends one word, "be" starts the next). Copy the word breaks exactly as printed below the staff (hyphens in the print mark a syllable break WITHIN a word — no space in your output there either; a plain space in the print is a real word break — use a space there).
  - A SEPARATE, common failure mode from the spacing rule above: don't collapse two DISTINCT syllables of a multi-syllable word into a single merged token just because they're close together and each carries only one or two notes. Every printed syllable (whether joined by a hyphen or simply printed edge-to-edge under its own note group) gets its OWN parenthesis — e.g. "Cón(f)di(e)tor,(f.)" (three syllables: Cón/di/tor), never "Cóndi(fe)tor,(f.)" (wrongly fusing the first two into one). If you see a hyphen between two syllable fragments, that IS two syllables, full stop — never merge them onto one note group even if the shape above them looks like a single small neume; count the note heads under EACH fragment separately and give each fragment its own "text(pitches)" group. When in doubt, prefer splitting a word into more (rather than fewer) syllable groups if the print shows more than one distinct piece of text under a stretch of notes.
  - Write syllables as plain text WITHOUT leading or trailing hyphen characters ("ri(f)um(f.)", never "-ri(f)-um(f.)") — the hyphen character itself is never written, word-vs-syllable spacing (previous rule) is what encodes it instead.
  - PRESERVE every accent mark exactly as printed (á é í ó ú, or a similar stress mark over a vowel) — write "Cónditor" not "Conditor", "benígne" not "benigne". These marks are printed on many multi-syllable words in texts like this one and are part of a faithful transcription, not optional decoration — if you can see a mark over a vowel, include it on that syllable; don't drop it even if you're also unsure of a note.
  - PRESERVE every comma and period printed IN THE LYRICS TEXT ITSELF exactly as printed, e.g. write "Audi," with its comma attached to the syllable it belongs to, and a period at a genuine sentence end ("Amen."). This text-level punctuation is a completely SEPARATE thing from the bar-line marks in the music staff described below — a comma printed under the staff next to a word does NOT by itself mean there is a bar mark in the music at that spot (see the bar-line rule below); don't let the presence of one make you invent the other. Judge each independently: transcribe the text punctuation straight from the lyrics line, and judge a bar mark only from an actual mark you can see in the staff itself.
  - If a verse number (e.g. "2.", "3.") appears near a bar, add it as its own bare token, e.g. "...um.(g.) (;) 2. Scru(f)..." — never merged into the next syllable.
  - Bar lines — three types, and a SEPARATE thing from any comma/period printed in the lyrics text (see above; don't use text punctuation as your reason for adding or skipping one). For all three: don't invent one where the staff is genuinely plain, but DO check carefully rather than assuming absence — actively scan the space just above/between the note heads at each phrase break for a short vertical stroke, INCLUDING the small, easy-to-miss comma tick (it is the shortest and subtlest of the three, and commas are common in a hymn like this — don't let "I don't see an obvious tall mark" become "there's nothing here" without specifically checking for a short one too). Only count it as a bar if you can point to an actual stroke in the staff; the comma/period in the printed text is never that reason by itself. This check is a required SILENT visual step, separate from the "no narration" rule above — that rule only bans WRITING OUT your reasoning in the reply, it does not mean skipping the check itself; look at every phrase break before finalizing the line, you just never describe having done so. A system that runs several phrases (several commas/periods in the printed lyrics, or simply more than a few words) but comes out with ZERO bar marks anywhere in your answer is a strong warning sign that you defaulted to "none" without truly checking each break — go back over every phrase boundary in such a system specifically before settling on zero.
    (a) VERSE BOUNDARIES are structurally expected to have a bar, almost always a DOUBLE bar (::), typically right before a printed verse number ("2.", "3.", ...) or at the very end of the piece. If you see a verse number coming up, actively look for this double bar just before it and include it. The piece's OWN final bar (after its last word, e.g. after "Amen.") also gets a double bar — don't stop transcribing one token early and leave it off.
    (b) Mid-verse (no verse number nearby), judge which of the three types with ONE simple geometric test: compare the mark's own TOP and BOTTOM pixel-row to the 4 given staff-line pixel coordinates (topmost = line 1, bottom = line 4). Pixel-measured ground truth from real examples in this exact print shows comma and semicolon differ in BOTH where they START and where they END — not just "how deep" one mark goes:
        (,)=quarter bar/comma: SHORT. Starts clearly ABOVE line 1 and dips down into the staff, stopping at or just past the HALFWAY point of the gap between line 1 and line 2 (never reaching as far down as line 2 itself). Confined entirely to the top of the staff — total length is roughly one line-gap or less.
        (;)=half bar/semicolon: LONG, and positioned LOWER at BOTH ends than a comma — this is the key visual tell, not just "goes deeper". Its TOP starts around the MIDDLE of the gap between line 1 and line 2 (notably NOT above line 1 — if a stroke's top is above line 1, it is almost certainly a comma, not a semicolon), then crosses line 2 and line 3 completely, and its BOTTOM stops around the MIDDLE of the gap between line 3 and line 4, leaving a clearly visible band of white space between the stroke's lower end and line 4 itself. This is the MOST COMMON mid-verse mark by far — a long stroke centered on the staff (not touching line 1 above, not touching line 4 below) is a semicolon, even if it looks "tall".
        (:)=full bar/colon: a stroke reaching all the way down to line 4, touching or crossing it with NO white gap in between. Only use this when the stroke visibly merges with the bottom line itself. A semicolon's lower end can look deceptively close to line 4 at a glance — before calling something a colon, confirm there is no visible white space separating the stroke's end from line 4; if there is any gap at all, it is a semicolon, not a colon. This is a rare mark — don't default to it just because a stroke looks long; a long stroke that stops short of line 4 is still a semicolon (see above).
        In short: short tick confined to the top of the staff (above line 1 down to mid gap-1/2) → comma. Long stroke centered on the staff, from mid gap-1/2 down to mid gap-3/4, with visible white space above it (below line 1) and below it (above line 4) → semicolon. Stroke actually touching line 4 with no gap → colon.
        IMPORTANT — do not use the printed lyrics text as a clue here: the English/Latin translation text sometimes carries its own prose punctuation (a period, comma, or even a literal ":" character) that is completely INDEPENDENT of which bar (or whether any bar at all) appears in the music staff above it — e.g. a printed ":" in the text is NOT evidence of a music colon. Judge the bar type only from the mark's own pixel geometry in the staff, exactly as described above.
    Do not count a note's own stem, a neume's connecting stroke, or the plain closing tick at the staff's own right edge as a bar — a real bar is a mark with nothing else attached to it, standing alone between two syllables.
    The very RIGHT EDGE of each image is simply where the print's line breaks, NOT a bar — never output any bar token for the end of an image (this exact mistake ruined a previous attempt).
  - If ANY of these systems shows a different incipit / a new heading / a clear visual gap indicating a DIFFERENT piece (not "${chosen.incipit}"), STOP at that point — output only the systems up to there, then the marker below, and note in one short line after the marker that the piece ended early.
  - If an image starts/ends mid-word (crop boundary), just transcribe what's visible.

After all ${batch.length} system lines, output the line "===GABC===" on its own, followed by ONLY those system lines (one per line, nothing else, no markdown fences) and nothing after.`;

      const batchMaxTokens = Math.min(4000, Math.max(2000, batch.length * 500)); // raised from 3000/1200/400 in Runde 61 — reinstating the full bar-line rules (Runde 60) risked the same truncation failure mode already seen once with Step A's token cap

      // Session 15 — MEHRFACH-ABGLEICH: statt einem einzelnen Vision-Aufruf
      // pro Batch werden jetzt VISION_EXTRACTION_REPEATS (3) unabhängige
      // Durchläufe gemacht und die Gesamt-Notenzahl je System per
      // Median-Konsens gewählt (siehe pickConsensusLine weiter oben) — ein
      // Nutzertest bestätigte, dass ein EINZELNER Durchlauf bei diesem Modell
      // trotz temperature=0 nicht zuverlässig dieselbe Silben-Notenzahl
      // liefert (2 Durchläufe derselben Datei stimmten nur in ~46% der
      // Notenpositionen überein). Kostet 3x mehr API-Zeit pro Batch, dafür
      // deutlich stabilere Ergebnisse.
      const attempts = [];
      for (let rep = 0; rep < VISION_EXTRACTION_REPEATS; rep++) {
        gregGst('Extrahiere Systeme ' + startSysNum + '–' + (startSysNum + batch.length - 1) + ' von ~' + systemItems.length + '… (Durchlauf ' + (rep + 1) + '/' + VISION_EXTRACTION_REPEATS + ' für Stabilitäts-Abgleich)');
        const label = 'Batch ' + (b + 1) + ' Durchlauf ' + (rep + 1) + '/' + VISION_EXTRACTION_REPEATS;
        const result = await runBatchAttempt(apiKey, batchBlocks, promptText, batchMaxTokens, label);
        if (result) attempts.push(result);
      }

      if (!attempts.length) {
        anyBatchFailed = true;
        break; // kein einziger Durchlauf hat funktioniert -- stop, wie bisher
      }

      // Pro System-POSITION innerhalb dieses Batches die Kandidaten aus allen
      // erfolgreichen Durchläufen einsammeln (positionsbasiert -- setzt
      // voraus, dass jeder Durchlauf seine "System N:"-Zeilen in derselben
      // Reihenfolge liefert, was der bestehende Prompt so vorschreibt) und
      // die Konsens-Zeile wählen.
      const nSystemsInBatch = batch.length;
      for (let si = 0; si < nSystemsInBatch; si++) {
        const candidates = attempts.map(a => a[si]).filter(l => l != null);
        if (!candidates.length) continue; // keiner der Durchläufe hatte an dieser Stelle eine Zeile
        const chosen = candidates.length > 1 ? pickConsensusLine(candidates) : candidates[0];
        combinedBody += chosen + '\n';
        if (candidates.length > 1 && new Set(candidates).size > 1) {
          console.log('System ' + (startSysNum + si) + ': ' + candidates.length + ' Durchläufe verglichen, Konsens gewählt: "' + chosen + '"');
        }
      }
    }

    if (!combinedBody.trim()) {
      gregGst('Extraktion fehlgeschlagen: keine Systeme erfolgreich erkannt. Details in der Konsole — bitte erneut versuchen.');
      console.error('Stück "' + chosen.incipit + '": Extraktion lieferte leeren combinedBody (' + batches.length + ' Batch(es) versucht, anyBatchFailed=' + anyBatchFailed + ') — siehe die "Batch N ..." Logzeilen oben für den genauen Fehler pro Batch.');
      return _pieceSucceeded;
    }
    if (anyBatchFailed) {
      gregGst('Hinweis: nicht alle Systeme konnten extrahiert werden — nur der erfolgreiche Anfangsteil wird geladen.');
    }

    // OMR-Korrektur-Schicht (Task #12/#13): combinedBody hat an dieser
    // Stelle genau eine Zeile pro erfolgreich extrahiertem System, in
    // derselben Reihenfolge wie systemItems — bevor die Zeilen unten zu
    // EINEM body-String verschmolzen werden, hier noch pro System die
    // Tonhoehen geometrisch nachrechnen (Vision behaelt Silben/Text/
    // Notenzahl, nur die Buchstaben a-m koennen sich aendern). Nutzt NUR
    // die ersten Zeilen, die zu echten (erfolgreich extrahierten)
    // systemItems gehoeren — bei anyBatchFailed ist combinedBody kuerzer
    // als systemItems, darum wird hier auf die tatsaechliche Zeilenzahl
    // zugeschnitten.
    try {
      const rawLines = combinedBody.split('\n').filter(l => l.trim());
      const itemsForLines = systemItems.slice(0, rawLines.length);
      const correctedLines = await omrCorrectAllSystems(rawLines, itemsForLines, gregGst);
      combinedBody = correctedLines.join('\n') + '\n';
    } catch (e) {
      console.log('OMR-Korrektur-Schicht übersprungen (Fehler): ' + e.message);
    }

    // Assemble the final body OURSELVES: strip any clef tokens the model
    // may still have emitted despite instructions (the clef comes from the
    // dedicated detection call, not from the batches — a batch's guessed
    // (c3) overriding the properly detected clef is exactly what put the
    // wrong clef in the header last time), strip leading hyphens on
    // syllables (print hyphenation artifacts like "-ri(f)"), and prepend
    // the detected clef code once at the start. Also guarantee exactly one
    // final double bar at the very end.
    let body = combinedBody
      .replace(/\((?:c|f)b?[1-4]\)\s*/g, '')       // any clef tokens anywhere
      .replace(/(^|\s)-+(?=[A-Za-zÀ-ÿ])/g, '$1');  // leading hyphens before syllables
    body = '(' + clefCode + ') ' + body.trim();
    if (!/\(::\)\s*$/.test(body)) body += ' (::)';
    // Force the drop-cap letter to match the known incipit rather than
    // trusting the model to have prepended it into the first syllable's
    // text itself — exsurge's auto drop-cap glyph is always just the first
    // character of the first transcribed syllable, so any slip there (e.g.
    // transcribing the visible remainder "U-di," as syllable "U" instead of
    // reconstructing "Au") shows up directly as the wrong big letter. Only
    // touch it when a drop cap is actually expected and the transcribed
    // syllable doesn't already start with the right letter, so a correct
    // model answer is left untouched.
    if (chosen.hasDropCap && chosen.incipit) {
      const expectedFirst = chosen.incipit.trim().charAt(0);
      const dropCapM = body.match(/^(\([^)]*\)\s*)([^\s(]+)(\()/);
      if (expectedFirst && dropCapM && dropCapM[2].charAt(0).toLowerCase() !== expectedFirst.toLowerCase()) {
        body = dropCapM[1] + expectedFirst + dropCapM[2] + dropCapM[3] + body.slice(dropCapM[0].length);
      }
    }
    const cleaned = 'annotation: ' + chosen.mode + '\n' + (chosen.hasDropCap ? 'drop-cap: auto\n' : '') + '%%\n\n' + body;

    if (cleaned && cleaned.includes('(')) {
      // Safety net for the exact bug reported: a large chunk of the LYRICS
      // (ignoring note codes, punctuation, case) appearing anywhere else
      // strongly suggests the model duplicated a run of text rather than
      // continuing to read — warn instead of silently importing it. This
      // is a heads-up, not a hard block: a short genuinely-repeated refrain
      // (e.g. "* ij." Amen repeats) is normal and won't trip the length
      // threshold used here.
      //
      // NOTE, upgraded after a real case slipped through: the original
      // version only checked whether the text's own first ~30% repeated
      // later — good for catching "the whole piece got duplicated" but
      // blind to a SMALL duplication in the MIDDLE of an otherwise long,
      // correct transcription (e.g. one syllable-run repeated right at a
      // batch boundary) — the required matching window was tied to total
      // text length, so a short local repeat was always too small to
      // trigger it. Now scans for ANY repeated run of a fixed minimum
      // length anywhere in the text, not just from the start.
      const lyricsOnly = cleaned.replace(/\([^)]*\)/g, ' ').replace(/[^a-zA-Z ]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
      let duplicateWarning = '';
      const REPEAT_MIN_LEN = 24; // chars of lyric text — long enough to not false-positive on short common words repeating naturally
      if (lyricsOnly.length > REPEAT_MIN_LEN * 2) {
        const seen = new Set();
        for (let i = 0; i + REPEAT_MIN_LEN <= lyricsOnly.length && !duplicateWarning; i += 4) { // step 4 for speed, fine-grained enough
          const chunk = lyricsOnly.substr(i, REPEAT_MIN_LEN);
          if (seen.has(chunk)) { duplicateWarning = ' ⚠️ Möglicherweise wurde ein Teil doppelt erkannt — bitte mit der Quelle vergleichen!'; break; }
          seen.add(chunk);
        }
      }

      // HARD gate against a much more dangerous failure mode found after
      // the fact: the model can fall into a degenerate repetition loop and
      // keep generating near-duplicate note-groups until it hits the
      // token limit — one real case produced 739 entries for what should
      // have been ~20. Simply IMPORTING that (and gregImportGABCString
      // renders IMMEDIATELY as part of importing) is what actually crashes
      // the browser with "Out of Memory".
      //
      // A rough regex count of "(...)" groups in the raw text — the
      // original version of this check — turned out to be an unreliable
      // proxy: it's counting parentheses in a STRING, not what
      // gregImportGABCString's actual parser will turn that string into,
      // and those can differ a lot, especially for messy input. Instead,
      // parse for real via gregImportGABCString(cleaned, {deferRender:true})
      // — this populates gregEntries (and header fields) WITHOUT rendering
      // yet — then check the true gregEntries.length before ever calling
      // gregRender(). If it's unreasonably high, restore whatever was
      // there before and ask the user, so a render only ever happens once
      // we're confident it won't be on a runaway result.
      { const target = await gregImportTargetChoice(); if (!target) { gregGst('Abgebrochen.'); return; } if (target === 'new' && !(await ntConfirmDiscard())) { gregGst('Abgebrochen.'); return; } if (target === 'new') gregCollapseSections(); }
      const previousEntries = gregEntries;
      gregImportGABCString(cleaned, {deferRender: true});
      const realEntryCount = gregEntries.length;
      const SANE_MAX_ENTRIES = 200; // generously above what any single real chant piece needs (raised from 150 in Runde 54: a real 176-entry piece tripped the old threshold unnecessarily)
      if (realEntryCount > SANE_MAX_ENTRIES) {
        console.log('GABC response (parsed but not rendered — checking with user):', cleaned);
        const proceed = await gregConfirmModal(
          '⚠️ Ungewöhnlich viele Einträge',
          'Die extrahierte GABC ergibt ungewöhnlich viele Einträge (' + realEntryCount + ') ' +
          'für ein einzelnes Stück — das deutet auf einen Fehler hin (Wiederholungsschleife), ' +
          'und ein Rendern könnte den Browser-Tab zum Absturz bringen ("Out of Memory").\n\n' +
          'Falls dieses Stück tatsächlich so lang ist (z.B. viele Strophen), ist das kein Fehler — ' +
          'sonst brich lieber ab und versuche es erneut.\n\nTrotzdem laden?'
        );
        if (!proceed) {
          gregEntries = previousEntries; // restore — nothing was rendered yet, so this fully undoes the attempt
          gregGst('Import abgebrochen (' + realEntryCount + ' Einträge erkannt). Details in der Konsole.');
          return _pieceSucceeded;
        }
      }

      // Now safe to actually render — either the count was reasonable, or
      // the user explicitly confirmed anyway.
      gregRefreshListNoRender();
      gregRender();
      gregGst('GABC importiert: ' + gregEntries.length + ' Einträge' + duplicateWarning + ' — bitte mit dem Original vergleichen und korrigieren');
      _pieceSucceeded = true;
    } else {
      gregGst('Extraktion unvollständig: ' + cleaned.substring(0,80));
      console.error('Stück "' + chosen.incipit + '": kein "===GABC==="-Marker in der Modell-Antwort gefunden — siehe "GABC response" Logzeile oben.');
    }
    return _pieceSucceeded;
    } // end gregProcessOnePiece

    if (loadAllPieces) {
      let loadedCount = 0;
      const failedIncipits = [];
      for (let i = 0; i < pieces.length; i++) {
        if (pieces[i].systems === 0) {
          gregGst('"' + pieces[i].incipit + '" übersprungen (0 Systeme erkannt).');
          failedIncipits.push(pieces[i].incipit + ' (0 Systeme)');
          continue;
        }
        if (loadedCount > 0) gregAddSection(); // switches gregEntries to a fresh empty section
        gregGst('Lade Stück ' + (i+1) + '/' + pieces.length + ': "' + pieces[i].incipit + '"…');
        try {
          const ok = await gregProcessOnePiece(pieces[i]);
          // A piece that returns false (extraction failed / nothing
          // imported) still leaves behind the empty section gregAddSection
          // just created — that's intentional (lets the user see exactly
          // which piece failed and retry/fill it manually instead of it
          // silently vanishing), but it must NOT count as "loaded" in the
          // summary below, which is what made a failed piece look
          // successful in Runde 53 (an empty "Abschnitt 2" with no
          // indication anything had gone wrong).
          if (ok) {
            loadedCount++;
          } else {
            failedIncipits.push(pieces[i].incipit);
            // gregProcessOnePiece only calls gregRender() on its OWN success
            // path — a failed/empty piece leaves the just-added empty
            // section un-rendered, so render explicitly here for that case.
            gregRenderAllSections();
          }
        } catch (pieceErr) {
          console.error('Fehler bei Stück ' + pieces[i].index + ' ("' + pieces[i].incipit + '"):', pieceErr);
          failedIncipits.push(pieces[i].incipit + ' (Fehler: ' + pieceErr.message + ')');
          gregRenderAllSections(); // same reasoning as above — the error path never reached gregProcessOnePiece's own render call
        }
        // Runde 63: REMOVED the unconditional gregRenderAllSections() that
        // used to sit here after EVERY piece (successful or not) — root cause
        // of the recurring "riesiger Weissraum zwischen Abschnitten" bug
        // finally found: gregProcessOnePiece() already calls gregRender()
        // internally on its own success path (see the `gregRender();` right
        // after the SANE_MAX_ENTRIES check inside gregProcessOnePiece), which
        // in multi-section mode dispatches to gregRenderAllSections() itself.
        // Calling it AGAIN immediately after, unconditionally, fired a SECOND
        // full async re-layout pass (performLayoutAsync/layoutChantLines is
        // chunked via setTimeout, not instant) of the just-deactivated,
        // often large, previous section while the first pass's own async
        // layout for that same section was potentially still in flight —
        // two overlapping passes each measuring/releasing the shared
        // per-pass width lock (window._gregForcedCanvasWidth) at slightly
        // different, unpredictable moments. The render-token guard prevents
        // a stale result from ever being PAINTED, but not the wasted/racy
        // width measurement itself, which is the most likely source of the
        // section ending up laid out against an inconsistent width and
        // leaving a large blank gap. Only the two paths that genuinely never
        // render on their own (piece failed / threw) now trigger a render
        // here — the common success path renders exactly once, from inside
        // gregProcessOnePiece.
      }
      gregGst(loadedCount + ' Stück(e) geladen' + (failedIncipits.length ? ', ' + failedIncipits.length + ' fehlgeschlagen (' + failedIncipits.join(', ') + ')' : '') + '.');
    } else {
      const chosen = pieces.find(p=>p.index===chosenIdx) || pieces[0];
      await gregProcessOnePiece(chosen);
    }
    if (gregIsMobileViewport() && window._gregMode !== 'edit') gregSetMode('edit');
  } catch(e) {
    gregGst('Fehler: ' + e.message);
    console.error(e);
  }
}

function gregExtractGABC(text) {
  // Try to find GABC header+body (annotation:\n%%\nbody)
  const headerMatch = text.match(/annotation\s*:.*?%%([\s\S]+?)(?=annotation\s*:|$)/i);
  if (headerMatch) return headerMatch[0].trim();

  // Try to find GABC body: starts with (c3), (c4), (f3), (f4)
  const bodyMatch = text.match(/\(([cf]b?[1-4])\)([\s\S]+?)(?=\(\s*[cf]b?[1-4]\s*\)|$)/);
  if (bodyMatch) return bodyMatch[0].trim();

  // Look for any text containing GABC note patterns like (fg) (g) etc.
  const notePattern = /\w*\([a-m]+[.'_,;:!wvxyz0-9/\\~]*\)/;
  if (notePattern.test(text)) {
    // Extract lines that look like GABC
    const lines = text.split(/\n/);
    const gabcLines = lines.filter(l => (l.match(/\([a-m]/g)||[]).length >= 2);
    if (gabcLines.length > 0) return gabcLines.join(' ').trim();
  }
  return null;
}

