// ── «PDF lesen», geometrischer Teil (Build 408) ─────────────────────────
// Übertragung des Python-Prototyps tests/pdf-lesen/geometrie/ (geom.py, ocr.py, text_ki.py) nach JavaScript.
// Misst aus einem Seitenbild (Graustufen, ca. 300 dpi): Notensysteme, Notenköpfe → Tonhöhen, Schlüssel,
// Trennstriche, Initialen und die Tintengruppen der Textzeile; legt einen (von der KI gelesenen) Text auf die
// Noten und erzeugt je System eine GABC-Zeile. Neumenformen (Quilisma, Liqueszenz …) erkennt es nicht.
// Reine Rechenfunktionen ohne DOM – derselbe Code läuft im Browser und im Node-Test (tests/pdf-geometrie.test.js).
// Bilder: {w, h, a: Uint8Array} (Grauwerte 0–255); Masken: {w, h, a: Uint8Array} (1 = Tinte).

const PG_LET = 'abcdefghijklm';     // d = unterste Linie (Index 3), j = oberste (Index 9)
const PG_THR_LINES = 140;           // Grauwert-Schwelle für die Liniensuche
const PG_CLEF = 1.2, PG_WMIN = 0.6, PG_UNIT_GAP = 0.8;

// Python-Hilfen: round (Banker's Rounding), Median, lineare Interpolation mit Randbegrenzung
function pgRound(x) {
  const f = Math.floor(x), d = x - f;
  if (Math.abs(d - 0.5) < 1e-9) return (f % 2 === 0) ? f : f + 1;
  return Math.round(x);
}
function pgMedian(v) {
  if (!v.length) return NaN;
  const s = Array.from(v).sort((a, b) => a - b), n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}
function pgInterp(x, xs, ys) {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  let i = 1; while (xs[i] < x) i++;
  return ys[i - 1] + (ys[i] - ys[i - 1]) * (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
}
const pgInt = Math.trunc;

function pgMask(w, h) { return {w, h, a: new Uint8Array(w * h)}; }
function pgThreshold(img, thr) {
  const m = pgMask(img.w, img.h);
  for (let i = 0; i < img.a.length; i++) m.a[i] = img.a[i] < thr ? 1 : 0;
  return m;
}
// Ausschnitt wie numpy-Slicing m[y0:y1, x0:x1] (Grenzen werden begrenzt)
function pgCrop(m, y0, y1, x0, x1) {
  y0 = Math.max(0, Math.min(m.h, y0)); y1 = Math.max(y0, Math.min(m.h, y1));
  x0 = Math.max(0, Math.min(m.w, x0)); x1 = Math.max(x0, Math.min(m.w, x1));
  const r = pgMask(x1 - x0, y1 - y0);
  for (let y = 0; y < r.h; y++) r.a.set(m.a.subarray((y0 + y) * m.w + x0, (y0 + y) * m.w + x1), y * r.w);
  return r;
}
function pgRowMean(m) {
  const out = new Float64Array(m.h);
  for (let y = 0; y < m.h; y++) { let s = 0; for (let x = 0; x < m.w; x++) s += m.a[y * m.w + x]; out[y] = m.w ? s / m.w : 0; }
  return out;
}
function pgAnyRow(m, y, xa, xb) { for (let x = Math.max(0, xa); x < Math.min(m.w, xb); x++) if (m.a[y * m.w + x]) return true; return false; }

// Drehung um die Bildmitte, gegen den Uhrzeigersinn um ang Grad, bikubisch wie PIL Image.rotate(BICUBIC, a = -1), Rand weiss
function pgCubic(t) {
  const a = -1.0; t = Math.abs(t);              // PIL (Geometry.c) rechnet mit a = -1
  return t < 1 ? ((a + 2) * t - (a + 3)) * t * t + 1 : t < 2 ? (((t - 5) * t + 8) * t - 4) * a : 0;
}
function pgRotate(img, ang) {
  const r = ang * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  const w = img.w, h = img.h, cx = w / 2, cy = h / 2, out = {w, h, a: new Uint8Array(w * h)};
  const wx = new Float64Array(4), wy = new Float64Array(4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const xs = c * dx - s * dy + cx, ys = s * dx + c * dy + cy;     // Quellpunkt (Pixelmitten bei +0.5)
      if (xs < 0 || ys < 0 || xs >= w || ys >= h) { out.a[y * w + x] = 255; continue; }
      const fx = xs - 0.5, fy = ys - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy);
      for (let k = 0; k < 4; k++) { wx[k] = pgCubic(fx - (x0 - 1 + k)); wy[k] = pgCubic(fy - (y0 - 1 + k)); }
      let v = 0;
      for (let j = 0; j < 4; j++) {
        const yy = Math.min(h - 1, Math.max(0, y0 - 1 + j)); let row = 0;
        for (let k = 0; k < 4; k++) row += wx[k] * img.a[yy * w + Math.min(w - 1, Math.max(0, x0 - 1 + k))];
        v += wy[j] * row;
      }
      out.a[y * w + x] = v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
    }
  }
  return out;
}

// Otsu-Schwelle und Median der Grauwerte (über das Histogramm)
function pgOtsu(img) {
  const h = new Float64Array(256); for (let i = 0; i < img.a.length; i++) h[img.a[i]]++;
  let w = 0, m = 0, best = -1, arg = 0; const W = img.a.length; let M = 0;
  for (let i = 0; i < 256; i++) M += h[i] * i;
  for (let t = 0; t < 255; t++) {
    w += h[t]; m += h[t] * t;
    const wf = W - w; if (w <= 0 || wf <= 0) continue;
    const v = w * wf * Math.pow(m / w - (M - m) / wf, 2);
    if (v > best) { best = v; arg = t; }
  }
  return arg + 1;
}
function pgMedianGray(img) {
  const h = new Float64Array(256); for (let i = 0; i < img.a.length; i++) h[img.a[i]]++;
  const n = img.a.length; let acc = 0, lo = -1, hi = -1;
  for (let i = 0; i < 256; i++) {
    acc += h[i];
    if (lo < 0 && acc >= Math.floor((n - 1) / 2) + 1) lo = i;
    if (hi < 0 && acc >= Math.floor(n / 2) + 1) { hi = i; break; }
  }
  return n % 2 ? hi : (lo + hi) / 2;
}

// ── Notenlinien und Systeme ─────────────────────────────────────────────
function pgLineCands(dark, lo, hi) {
  const xa = pgInt(dark.w * lo), xb = pgInt(dark.w * hi), cnt = new Float64Array(dark.h);
  for (let y = 0; y < dark.h; y++) { let s = 0; for (let x = xa; x < xb; x++) s += dark.a[y * dark.w + x]; cnt[y] = s; }
  const top = Array.from(cnt).sort((a, b) => a - b).slice(-20);
  const peak = top.reduce((a, b) => a + b, 0) / top.length;
  const cl = [];
  for (let y = 0; y < dark.h; y++) {
    if (!(cnt[y] > 0.45 * peak)) continue;
    const last = cl.length ? cl[cl.length - 1] : null;
    if (last && y - last[last.length - 1] <= 2) last.push(y); else cl.push([y]);
  }
  return cl.filter(c => c.length <= 12).map(c => (c[0] + c[c.length - 1]) / 2);
}
// Systemgrösse relativ zum typischen Linienabstand der Seite (Build 423): Campion druckt die Antiphon fast doppelt so gross wie
// Psalmvers und Gloria (61 / 33 px, Salve sancta Parens). Abweichende Systeme gelten nur mit erkanntem Schlüssel (pgAnalysePage).
const PG_SYS_MIN = 0.45, PG_SYS_MAX = 2.2;
function pgGroup(lines) {
  const gaps = [];
  for (let i = 0; i + 1 < lines.length; i++) { const d = lines[i + 1] - lines[i]; if (d > 12 && d < (globalThis._pgNurPrototyp ? 60 : 100)) gaps.push(d); }
  gaps.sort((a, b) => a - b);
  if (!gaps.length) return {out: [], g: 0};
  let g = gaps[Math.floor(gaps.length / 2)];
  const out = [];
  // Ab Build 416 (nicht im Prototyp): typischer Abstand nur aus Vierergruppen mit gleichmässigem Abstand – Zeilen eines
  // Fliesstexts (englische Übersetzung neben den Noten, pdf.js) lieferten sonst viele kleine Abstände und verdrängten die Systeme
  if (!globalThis._pgNurPrototyp) {
    const ms = [];
    for (let i = 0; i + 3 < lines.length; i++) {
      const q = lines.slice(i, i + 4), m = (q[3] - q[0]) / 3;
      if (m > 12 && m < 100 && [0, 1, 2].every(k => Math.abs((q[k + 1] - q[k]) - m) < 0.15 * m)) ms.push(m);
    }
    if (ms.length) { ms.sort((a, b) => a - b); g = ms[Math.floor(ms.length / 2)]; }
  }
  // Ab Build 416 (nicht im Prototyp): jedes System nach seinem eigenen Linienabstand prüfen – kleinere Systeme auf derselben
  // Seite (Gloria Patri unter einem Introitus: 69–74 %) wichen sonst um mehr als 25 % vom Seitenwert ab und fielen weg.
  // Abweichende Systeme gelten nur mit erkanntem Schlüssel (pgAnalysePage) – so bleibt die handgeschriebene Zeile bei
  // Tu es Petrus (62 %, kein Schlüssel) draussen (Build 417; Build 416 hatte eine feste Grenze von 70 %).
  const own = !globalThis._pgNurPrototyp;
  let i = 0, fives = 0;
  while (i + 3 < lines.length) {
    const q = lines.slice(i, i + 4), m = (q[3] - q[0]) / 3;
    const ok = own ? m > PG_SYS_MIN * g && m < PG_SYS_MAX * g && [0, 1, 2].every(k => Math.abs((q[k + 1] - q[k]) - m) < 0.15 * m)
      : [0, 1, 2].every(k => Math.abs((q[k + 1] - q[k]) - g) < 0.25 * g);
    // Fünfliniensystem (moderne Noten, Build 425, nicht im Prototyp): fünfte Linie im gleichen Abstand ober- oder unterhalb
    if (ok && own && lines.some(l => Math.abs(l - (q[3] + m)) < 0.2 * m || Math.abs(l - (q[0] - m)) < 0.2 * m)) fives++;
    if (ok) { out.push(q); i += 4; } else i++;
  }
  // Seite mit überwiegend Fünfliniensystemen (Regina caeli mit Orgelsatz ergab sonst 16 «Systeme» mit Unsinn): kein Choral.
  // Pro Seite entschieden – eine einzelne Textzeile im Linienabstand unter einem System ist keine fünfte Linie (Puer natus).
  if (own && fives >= 2 && fives >= 0.6 * out.length) { globalThis._pgFuenfLinien = true; return {out: [], g}; }
  return {out, g};
}

// Doppelseite / zwei Spalten (Build 416, nicht im Prototyp): x der Spaltengrenze oder null.
// Kriterium: In beiden Hälften liegen Systeme, und in der Seitenmitte gibt es eine Stelle, durch die (fast) keines läuft.
function pgColumnSplit(img) {
  if (globalThis._pgNurPrototyp) return null;
  const dark = pgThreshold(img, PG_THR_LINES), hw = pgInt(img.w / 2);
  const gL = pgGroup(pgLineCands(pgCrop(dark, 0, dark.h, 0, hw), 0.4, 0.6)).out;            // schmales Band: wenig Einfluss der Schräge
  const gR = pgGroup(pgLineCands(pgCrop(dark, 0, dark.h, hw, dark.w), 0.4, 0.6)).out;
  if (gL.length < 2 || gR.length < 2) return null;
  const qs = gL.concat(gR), xa = pgInt(0.4 * img.w), xb = pgInt(0.6 * img.w), cross = [];
  for (let x = xa; x < xb; x++) {
    let n = 0;
    for (const q of qs) {                          // Toleranz 0.3 Linienabstände: Schräge zwischen Messband und Mitte
      const tol = pgRound(0.3 * (q[3] - q[0]) / 3);
      if (q.every(yy => { const y = pgRound(yy); for (let r = Math.max(0, y - tol); r < Math.min(dark.h, y + tol + 1); r++) if (dark.a[r * dark.w + x]) return true; return false; })) n++;
    }
    cross.push(n);
  }
  const mn = Math.min(...cross);
  if (mn > 0.2 * qs.length) return null;
  const xs = []; cross.forEach((n, k) => { if (n === mn) xs.push(k); });
  return xa + xs[Math.floor(xs.length / 2)];
}
// GABC-Buchstaben der Tonstufe h/b für einen Schlüssel (beide Oktaven): c4 → i (b), c3 → g, c2 → e, f3 → d/k …
function pgBSteps(clef) {
  const m = /^([cf])b?([1-4])$/.exec(clef || '');
  if (!m) return '';
  const k = 'abcdefghijklm'.indexOf('dfhj'[+m[2] - 1]) + (m[1] === 'c' ? -1 : 3);   // b eine Stufe unter c bzw. drei über f
  return ['abcdefghijklm'[k - 7], 'abcdefghijklm'[k], 'abcdefghijklm'[k + 7]].filter(Boolean).join('');
}
// Graubild-Ausschnitt (Spalte)
function pgCropGray(img, x0, x1) {
  const w = x1 - x0, a = new Uint8Array(w * img.h);
  for (let y = 0; y < img.h; y++) a.set(img.a.subarray(y * img.w + x0, y * img.w + x1), y * w);
  return {w, h: img.h, a};
}
function pgStaves(img) {
  let dark = pgThreshold(img, PG_THR_LINES);
  const L = pgGroup(pgLineCands(dark, 0.25, 0.40)).out, R = pgGroup(pgLineCands(dark, 0.60, 0.75)).out;
  let ang = 0;
  let pairs = R.length ? L.map(l => [l, R.reduce((b, r) => Math.abs(r[0] - l[0]) < Math.abs(b[0] - l[0]) ? r : b, R[0])]) : [];
  pairs = pairs.filter(([l, r]) => Math.abs(r[0] - l[0]) < 30);
  if (pairs.length) {
    const dy = pgMedian(pairs.map(([l, r]) => r[0] - l[0]));
    ang = Math.atan2(dy, 0.35 * img.w) * 180 / Math.PI;
    if (Math.abs(ang) > 1e-6) { img = pgRotate(img, ang); dark = pgThreshold(img, PG_THR_LINES); }
  }
  const {out, g} = pgGroup(pgLineCands(dark, 0.30, 0.70));
  // Kurze Systeme (z. B. Schluss eines Stücks nur links, Build 416, nicht im Prototyp): auch links und rechts suchen
  if (!globalThis._pgNurPrototyp) {
    for (const [lo, hi] of [[0.05, 0.30], [0.70, 0.95]]) {
      for (const q of pgGroup(pgLineCands(dark, lo, hi)).out) {
        const m = (q[3] - q[0]) / 3;
        if (m > PG_SYS_MIN * g && m < PG_SYS_MAX * g && !out.some(o => q[0] < o[3] + m && o[0] < q[3] + m)) { q.side = true; out.push(q); }
      }
    }
    out.sort((a, b) => a[0] - b[0]);
  }
  const sts = [];
  let five = 0;
  for (const q of out) {
    const cnt = new Int32Array(dark.w);
    for (const yy of q) {
      const y = pgRound(yy);
      for (let x = 0; x < dark.w; x++) {
        for (let r = Math.max(0, y - 4); r < Math.min(dark.h, y + 5); r++) if (dark.a[r * dark.w + x]) { cnt[x]++; break; }
      }
    }
    let best = [0, 0], st0 = null, last = null;
    for (let x = 0; x < dark.w; x++) {
      if (cnt[x] < 4) continue;
      if (st0 === null) st0 = x;
      else if (x - last > 40) { if (last - st0 > best[1] - best[0]) best = [st0, last]; st0 = x; }
      last = x;
    }
    if (last !== null && last - st0 > best[1] - best[0]) best = [st0, last];
    const m = (q[3] - q[0]) / 3;
    // Fünfte Linie direkt im Bild prüfen (Build 427, nicht im Prototyp): eine Zeile im Linienabstand ober- oder unterhalb, die
    // fast die ganze Systembreite durchgehend bedeckt. Fotokopien moderner Noten (Benedictus, Christus vincit) liefern die fünfte
    // Linie oft nicht als Kandidat (schief, blass) – die Seitenregel in pgGroup griff dann nicht.
    if (!globalThis._pgNurPrototyp) {
      const cover = yc => { let bestC = 0;
        for (let y = pgRound(yc - 0.25 * m); y <= pgRound(yc + 0.25 * m); y++) {
          if (y < 2 || y >= dark.h - 2) continue;
          let hit = 0;
          for (let x = best[0]; x <= best[1]; x++) { for (let r = y - 1; r <= y + 1; r++) if (dark.a[r * dark.w + x]) { hit++; break; } }
          bestC = Math.max(bestC, hit / Math.max(1, best[1] - best[0] + 1));
        }
        return bestC; };
      // relativ zu den eigenen vier Linien: blasse Kopien haben auch blasse Linien; Textzeilen bedecken deutlich weniger
      const own = pgMedian(q.map(yy => cover(yy))), cv = Math.max(cover(q[3] + m), cover(q[0] - m));
      if (best[1] - best[0] > 4 * m && cv > 0.85 * own) five++;
    }
    sts.push({lines: q, x0: best[0], x1: best[1], odd: !globalThis._pgNurPrototyp && (!!q.side || m < 0.8 * g || m > 1.25 * g)});
  }
  // Mehrheit der Systeme mit fünf Linien: moderne Notation, keine Choralnoten (Meldung in 174). Einzelne Treffer kommen auch bei
  // Choral vor (Trennlinie unter dem letzten System, handgeschriebene Zeile darunter) – deshalb nur mit klarer Mehrheit.
  if (five && five > sts.length / 2) { globalThis._pgFuenfLinien = true; sts.length = 0; }
  return {img, sts, g, ang};
}

// ── Morphologie (Strich-Kerne, wie geom.py _erode1/_dilate1) ────────────
function pgLine1(m, k, axis, erode) {
  // erode: out[i] = UND über a[i-d], dilate: out[i] = ODER über a[i+d], d = -(k//2) … k-k//2-1; ausserhalb = 0
  const out = pgMask(m.w, m.h), lo = -Math.floor(k / 2), hi = k - Math.floor(k / 2) - 1;
  const n = axis === 1 ? m.w : m.h, cnt = axis === 1 ? m.h : m.w;
  const pre = new Int32Array(n + 1);
  for (let j = 0; j < cnt; j++) {
    const at = i => axis === 1 ? m.a[j * m.w + i] : m.a[i * m.w + j];
    pre[0] = 0; for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + at(i);
    for (let i = 0; i < n; i++) {
      let a, b, v;
      if (erode) { a = i - hi; b = i - lo; v = (a >= 0 && b < n && pre[b + 1] - pre[a] === b - a + 1) ? 1 : 0; }
      else { a = Math.max(0, i + lo); b = Math.min(n - 1, i + hi); v = pre[b + 1] - pre[a] > 0 ? 1 : 0; }
      if (axis === 1) out.a[j * m.w + i] = v; else out.a[i * m.w + j] = v;
    }
  }
  return out;
}
function pgOpening(m, kw, kh) {
  const e = pgLine1(pgLine1(m, kw, 1, true), kh, 0, true);
  return pgLine1(pgLine1(e, kw, 1, false), kh, 0, false);
}

// Zusammenhangskomponenten (8er-Nachbarschaft), lauflängenbasiert. Gibt Liste von Läufen [y, x0, x1] je Komponente.
function pgComponents(m) {
  const parent = [];
  const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const runs = []; let prev = [];
  for (let y = 0; y < m.h; y++) {
    const cur = []; let x = 0; const row = y * m.w;
    while (x < m.w) {
      if (!m.a[row + x]) { x++; continue; }
      const x0 = x; while (x < m.w && m.a[row + x]) x++; const x1 = x - 1;
      let lab = null;
      for (const [px0, px1, pl] of prev) {
        if (px0 <= x1 + 1 && px1 >= x0 - 1) {
          const r = find(pl);
          if (lab === null) lab = r; else if (r !== lab) parent[r] = lab;
        }
      }
      if (lab === null) { lab = parent.length; parent.push(lab); }
      cur.push([x0, x1, lab]); runs.push([y, x0, x1, lab]);
    }
    prev = cur;
  }
  const comps = new Map();
  for (const [y, x0, x1, lab] of runs) {
    const r = find(lab);
    if (!comps.has(r)) comps.set(r, []);
    comps.get(r).push([y, x0, x1]);
  }
  return Array.from(comps.values());
}
function pgBox(runs) {
  let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity;
  for (const [y, a, b] of runs) { if (y < y0) y0 = y; if (y > y1) y1 = y; if (a < x0) x0 = a; if (b > x1) x1 = b; }
  return [x0, y0, x1, y1];
}

// ── Lokale Linienlage (Restschräge, Wellen im Scan) ─────────────────────
function pgLineOffsets(dark, st, g) {
  const q = st.lines, x0 = st.x0, x1 = st.x1, step = pgInt(2 * g), half = pgInt(3 * g);
  const thick = [];
  let centers = [];
  for (let c = x0 + half; c < x1 - half + 1; c += step) centers.push(c);
  if (!centers.length) centers = [Math.floor((x0 + x1) / 2)];
  const mid = Math.floor(centers.length / 2);
  const order = centers.slice(mid).concat(centers.slice(0, mid).reverse());
  const est = new Map();
  for (const cx of order) {
    const nb = [cx - step, cx + step].filter(c => est.has(c)).map(c => est.get(c));
    let last = nb.length ? nb[0] : 0.0;
    const ds = [];
    for (const y of q) {
      const yc = y + last, r = pgInt(0.3 * g), lo = pgRound(yc) - r;
      const xa = Math.max(0, cx - half), xb = Math.min(dark.w, cx + half);
      if (lo < 0 || xb <= xa) continue;
      const rows = Math.min(2 * r + 1, dark.h - lo); if (rows <= 0) continue;
      const cnt = []; let mx = 0;
      for (let k = 0; k < rows; k++) { let s = 0; for (let x = xa; x < xb; x++) s += dark.a[(lo + k) * dark.w + x]; cnt.push(s); if (s > mx) mx = s; }
      if (mx < 0.4 * (xb - xa)) continue;
      const top = []; let t5 = 0;
      cnt.forEach((v, k) => { if (v > 0.7 * mx) top.push(k); if (v > 0.5 * mx) t5++; });
      ds.push(lo + top.reduce((a, b) => a + b, 0) / top.length - y); thick.push(t5);
    }
    if (ds.length) last = pgMedian(ds);
    est.set(cx, last);
  }
  const xs = Array.from(est.keys()).sort((a, b) => a - b), offs = xs.map(x => est.get(x));
  const t = thick.length ? pgMedian(thick) : 0.1 * g;
  return {off: x => pgInterp(x, xs, offs), t};
}

// ── Notenköpfe ─────────────────────────────────────────────────────────
function pgAnalyseStaff(dark, st, g, ref) {
  const q = st.lines, x0 = st.x0, x1 = st.x1;
  const gl = (q[3] - q[0]) / 3, hs = gl / 2;
  const {off, t: lt} = pgLineOffsets(dark, st, gl);
  const top = Math.max(0, pgInt(q[0] - 2.2 * gl)), bot = Math.min(dark.h, pgInt(q[3] + 1.9 * gl));
  const xa = Math.max(0, x0 - pgInt(0.3 * gl)), xb = Math.min(dark.w, x1 + pgInt(0.3 * gl));
  const reg = pgCrop(dark, top, bot, xa, xb);
  const kh = Math.max(pgRound(lt) + 3, pgRound(0.17 * gl)), kw = Math.max(kh, pgRound(0.2 * gl));
  const op = pgOpening(reg, kw, kh);
  const dens = pgRowMean(reg);
  const minR = (a, b) => { let m = Infinity; for (let i = a; i < b; i++) m = Math.min(m, dens[i]); return m; };
  let ylo = bot, yhi = top;
  // Textzeile = mindestens 4 Zeilen dicht; ab Build 424 (nicht im Prototyp) oberhalb mindestens 0.3 Linienabstände hoch: eine lange
  // Hilfslinie über dem System (Mittit ad Virginem, Noten l/m) galt sonst als Textzeile, und die Noten darauf fielen weg.
  const tw = globalThis._pgNurPrototyp ? 4 : Math.max(4, pgRound(0.3 * gl));
  for (let y = pgInt(q[3] + 0.6 * gl) - top; y < reg.h - 3; y++) if (minR(y, y + 4) > 0.12) { ylo = top + y; break; }   // unten unverändert (Text dicht unter dem System)
  for (let y = pgInt(q[0] - 0.6 * gl) - top; y > tw - 1; y--) if (minR(y - tw + 1, y + 1) > 0.12) { yhi = top + y; break; }
  const blobs = [];
  for (const runs of pgComponents(op)) {
    const [bx0, by0, bx1, by1] = pgBox(runs);
    let area = 0; for (const r of runs) area += r[2] - r[1] + 1;
    const sw = bx1 - bx0 + 1, sh = by1 - by0 + 1, sub = new Uint8Array(sw * sh);
    for (const [y, a, b] of runs) for (let x = a; x <= b; x++) sub[(y - by0) * sw + x - bx0] = 1;
    blobs.push({x0: bx0 + xa, x1: bx1 + xa, y0: by0 + top, y1: by1 + top, area, sub, sw, sh});
  }
  const inner = blobs.filter(b => b.y0 > q[0] - 1.6 * gl && b.y1 < q[3] + 1.2 * gl && x0 + 1.5 * gl < b.x0 && b.x1 < x1 - 0.8 * gl);
  const sizes = inner.map(b => [b.area, b.x1 - b.x0 + 1]);
  if (!ref) return {sizes, gl};
  const [aref, wref] = ref;
  const stepOf = (x, y) => (q[3] + off(x) - y) / hs;
  let notes = [];
  const accepted = [], small = [];
  for (const b of blobs) {
    const w = b.x1 - b.x0 + 1, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    // Schlüsselzone: Ein Schlüssel liegt nie unter der untersten Linie – tiefere Noten dort gelten (Build 414, nicht im Prototyp)
    const belowClef = !globalThis._pgNurPrototyp && stepOf(cx, cy) < -0.5;
    const why = (b.x0 < x0 + PG_CLEF * gl && !belowClef) ? 'Schlüsselzone'             // Schlüssel am Zeilenanfang
      : (b.y0 <= top + 1 || b.y1 >= bot - 2) ? 'Streifenrand'            // ragt aus dem Streifen: Text, Titel
      : cx > x1 - 0.5 * gl ? 'Zeilenende'                                 // Custos / Schlussstrich
      : (cy > ylo - 0.1 * gl || cy < yhi + 0.1 * gl) ? 'Textzeile'       // liegt in einer Textzeile
      : (w < PG_WMIN * wref || b.area < 0.45 * aref) ? 'klein' : '';      // Punkte, Reste, Flecken
    if (why === 'klein' && b.area >= 0.15 * aref && b.y1 - b.y0 + 1 >= 0.22 * gl) small.push(b);
    if (why) { pgDiag(why, b, st); continue; }
    b.wref = wref; accepted.push(b);
    notes = notes.concat(pgSplitBlob(b, gl, hs, stepOf));
  }
  // Senkrechtes Notenpaar (z. B. Clivis, Pes mit Verbindungsstrich): Das Öffnen trennt die zweite Note oft nur als
  // schmalen Rest ab, der als «klein» verworfen würde. Ein solcher Rest zählt als Note, wenn er direkt über oder unter
  // einem anerkannten Notenkopf liegt (waagrecht überlappend, Lücke ≤ 0.35 Linienabstand) und mindestens eine Stufe
  // höher oder tiefer sitzt. (Build 412; nicht im Python-Prototyp)
  for (const b of (globalThis._pgNurPrototyp ? [] : small)) {
    const cy = (b.y0 + b.y1) / 2, cx = (b.x0 + b.x1) / 2;
    if (cy > q[3] + 0.9 * gl || cy < q[0] - 1.6 * gl) continue;           // Textzeile/Titel, keine Note
    // Notenrest ist ungefähr quadratisch; ein Iktus-Strich ist schmal und doppelt so hoch (Gegenprobe Parce Domine, Build 415)
    const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
    if (bw < 0.23 * gl || bw > 0.4 * gl || bh / bw < 0.85 || bh / bw > 1.7) continue;
    const nb = accepted.find(a => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) >= 0.3 * (b.x1 - b.x0 + 1)
      && Math.max(a.y0 - b.y1, b.y0 - a.y1) <= 0.35 * gl && Math.abs((a.y0 + a.y1) / 2 - cy) >= 0.7 * hs);
    if (!nb) continue;
    // Lesereihenfolge: der Rest gehört hinter seinen Nachbarn (Clivis: obere, dann untere Note; Pes: untere, dann obere)
    const x = Math.max(cx, (nb.x0 + nb.x1) / 2 + 0.25 * gl);
    notes.push({x, y: cy, p: stepOf(cx, cy), kind: 'pair', w: b.x1 - b.x0 + 1, xa: b.x0, xb: b.x1});
    pgDiag('als Paar-Note übernommen', b, st);
  }
  notes.sort((a, b) => a.x - b.x);
  const merged = [];                                               // Bruchstücke derselben Note zusammenfassen
  for (const n of notes) {
    const m = merged.length ? merged[merged.length - 1] : null;
    if (m && n.kind === 'note' && m.kind === 'note' && Math.abs(n.p - m.p) < 0.7
        && n.xa - m.xb < 0.25 * wref && n.xb - m.xa + 1 <= 1.35 * wref) {
      const wa = m.w, wb = n.w;
      m.y = (m.y * wa + n.y * wb) / (wa + wb); m.p = (m.p * wa + n.p * wb) / (wa + wb);
      m.xb = n.xb; m.x = (m.xa + m.xb) / 2; m.w = wa + wb;
    } else merged.push(n);
  }
  notes = merged;
  const ordered = [];
  for (let i = 0; i < notes.length;) {                            // übereinander: von unten nach oben
    let j = i + 1;
    while (j < notes.length && notes[j].x - notes[i].x < 0.22 * gl) j++;
    ordered.push(...notes.slice(i, j).sort((a, b) => b.y - a.y));
    i = j;
  }
  const out = [];
  for (const n of ordered) {
    const p = pgRound(n.p);
    if (p < -3 || p > 9) continue;
    n.letter = PG_LET[p + 3]; out.push(n);
  }
  // Noten auf/über der ersten Hilfslinie oben (Stufe ≥ 8: l, m) brauchen eine Hilfslinie, die seitlich über den Notenkopf
  // hinausreicht (Build 424, nicht im Prototyp): sonst ist es Handschrift über dem System (Akkordbuchstaben, Terribilis)
  if (!globalThis._pgNurPrototyp) {
    const hasLedger = n => {
      const yL = pgRound(q[3] + off(n.x) - 8 * hs) - top, r = Math.max(1, pgRound(lt));
      const side = (xa0, xb0) => { let hit = 0, all = 0;
        for (let x = pgRound(xa0) - xa; x <= pgRound(xb0) - xa; x++) { if (x < 0 || x >= reg.w) continue; all++;
          for (let y = Math.max(0, yL - r); y <= Math.min(reg.h - 1, yL + r); y++) if (reg.a[y * reg.w + x]) { hit++; break; } }
        return all && hit / all > 0.6; };
      return side(n.x + 0.6 * wref, n.x + 0.9 * wref) || side(n.x - 0.9 * wref, n.x - 0.6 * wref);
    };
    for (let i = out.length - 1; i >= 0; i--) if (pgRound(out[i].p) >= 8 && !hasLedger(out[i])) { pgDiag('über dem System ohne Hilfslinie', {x0: out[i].x, x1: out[i].x, y0: out[i].y, y1: out[i].y, area: 0}, st); out.splice(i, 1); }
  }
  st._ctx = {top, bot, xa, xb, op, reg, stepOf, ylo, blobs, gl, wref, off, lt};
  if (!globalThis._pgNurPrototyp) { pgMarkMoras(st, out); pgMarkVirga(st, out); pgMarkFlats(st, out); }           // Test gegen den Python-Prototyp: ohne Ergänzungen
  return {notes: out, gl};
}

// Diagnose: verworfene Tintenflecken sammeln, falls globalThis._pgDiag ein Array ist (Konsole/Test), sonst nichts tun
function pgDiag(why, b, st) {
  if (Array.isArray(globalThis._pgDiag)) globalThis._pgDiag.push({why, x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1, area: b.area, staff: st.lines[0]});
}

// ♭ (Build 414, nicht im Prototyp): dünner Hals oben, hohler Bauch unten, links vor einer Note. Im Bild ohne Notenlinien
// zerfällt das Zeichen an der Linie in Teile; übereinanderliegende Teile mit gleichem linken Rand werden zusammengesetzt.
// Setzt n.flat = Tonbuchstabe des Bauchs bei der ersten Note rechts davon.
function pgMarkFlats(st, notes) {
  const c = st._ctx, gl = c.gl, q = st.lines;
  const y0 = Math.max(0, Math.round(q[0] - 1.6 * gl) - c.top), y1 = Math.min(c.reg.h, Math.round(q[3] + 1.0 * gl) - c.top);
  const win = pgCrop(c.reg, y0, y1, 0, c.reg.w);
  for (let x = 0; x < win.w; x++) {                                  // Notenlinien ausblenden
    const o = c.off(x + c.xa);
    for (const L of q) {
      const yl = L + o - c.top - y0;
      for (let y = Math.max(0, Math.floor(yl - c.lt / 2 - 1)); y <= Math.min(win.h - 1, Math.ceil(yl + c.lt / 2 + 1)); y++) win.a[y * win.w + x] = 0;
    }
  }
  const parts = pgComponents(win).map(r => { const b = pgBox(r); return {b, runs: r}; })
    .filter(p => p.b[2] - p.b[0] + 1 <= 0.8 * gl && p.b[3] - p.b[1] + 1 <= 2.4 * gl);
  parts.sort((a, b) => a.b[1] - b.b[1]);
  const used = new Set();
  for (let i = 0; i < parts.length; i++) {
    if (used.has(i)) continue;
    let runs = parts[i].runs.slice(), box = parts[i].b.slice();
    for (let j = i + 1; j < parts.length; j++) {                     // darunterliegende Teile mit gleichem linken Rand
      const b = parts[j].b;
      if (used.has(j) || Math.abs(b[0] - box[0]) > 0.15 * gl || b[1] - box[3] > c.lt + 0.25 * gl) continue;
      runs = runs.concat(parts[j].runs); box = [Math.min(box[0], b[0]), box[1], Math.max(box[2], b[2]), Math.max(box[3], b[3])]; used.add(j);
    }
    const w = box[2] - box[0] + 1, h = box[3] - box[1] + 1;
    if (h < 0.9 * gl || h > 2.3 * gl || w < 0.28 * gl || w > 0.75 * gl) continue;
    const gx = box[0] + c.xa;
    // Build 420: nur noch 0.5 statt PG_CLEF Linienabstände sperren – ein ♭ direkt nach dem Schlüssel (Systemanfang, Verbum caro)
    // fiel sonst weg; der Schlüssel selbst besteht die Formprüfung nicht, und ♭ gilt nur auf der b-Stufe (Build 418)
    if (gx < st.x0 + 0.5 * gl) continue;
    const rowW = new Array(h).fill(0); let area = 0;
    for (const [y, a, b] of runs) { rowW[y - box[1]] += b - a + 1; area += b - a + 1; }
    const top = rowW.slice(0, Math.floor(0.4 * h)), bot = rowW.slice(Math.floor(0.55 * h));
    if (!top.length || !bot.length || Math.max(...top) > 0.25 * gl || Math.max(...bot) < 0.3 * gl) continue;   // oben Hals, unten Bauch
    if (area / (w * h) > 0.5) continue;                               // hohl, kein Notenkopf
    const belly = []; rowW.forEach((v, k) => { if (k >= 0.4 * h && v >= 0.25 * gl) belly.push(k); });
    if (!belly.length) continue;
    const by = box[1] + y0 + c.top + (belly[0] + belly[belly.length - 1]) / 2, bx = (box[0] + box[2]) / 2 + c.xa;
    const p = pgRound(c.stepOf(bx, by));
    if (p < -3 || p > 9) continue;
    const next = notes.find(n => n.x > box[2] + c.xa - 0.1 * gl && n.x < box[2] + c.xa + 1.8 * gl);
    if (next && !next.flat) next.flat = PG_LET[p + 3];
  }
}

// Virga (Build 413, nicht im Python-Prototyp): dünner Strich am rechten Rand des Kopfs nach unten, der frei endet
// (endet er an einer anderen Note, ist es ein Verbindungsstrich). Setzt n.virga. Iktus und Episem wurden ebenso versucht,
// aber verworfen: zu viele Fehlmeldungen (Linienreste, Hilfslinien, Hälse; Plan 7.18).
function pgMarkVirga(st, notes) {
  const c = st._ctx, gl = c.gl, reg = c.reg;
  notes.forEach((n, i) => {
    if (n.kind === 'bar') return;
    const xb = n.xb !== undefined ? n.xb : n.x + 0.25 * gl;      // ungefiltert gemessen, Linien zählen als Tinte
    {
      const bx0 = Math.round(xb - 0.15 * gl) - c.xa, bx1 = Math.round(xb + 0.12 * gl) - c.xa, bw = bx1 - bx0 + 1;
      let y = Math.round(n.y + 0.3 * gl) - c.top, len = 0, thin = 0;
      if (bx0 >= 0 && bx1 < reg.w) {
        for (; y < reg.h; y++) {
          let k = 0; for (let x = bx0; x <= bx1; x++) k += reg.a[y * reg.w + x];
          if (!k) break;
          len++; if (k <= 0.6 * bw) thin++;
        }
        const end = n.y + 0.3 * gl + len;
        if (len >= 0.6 * gl && thin >= 0.5 * len && len <= 2.2 * gl
            && !notes.some((m, j) => j !== i && Math.abs(m.x - xb) < 0.6 * gl && m.y > n.y + 0.3 * gl && m.y < end + 0.35 * gl)) n.virga = true;
      }
    }
  });
}

// Mora-Punkte (Build 412, nicht im Python-Prototyp): kleiner, kompakter Punkt rechts neben einem Notenkopf, in gleicher
// Höhe oder im Zwischenraum darüber. Gesucht im ungefilterten Bild, Notenlinien ausgeblendet. Setzt n.mora = true.
function pgMarkMoras(st, notes) {
  const c = st._ctx, gl = c.gl, q = st.lines, reg = c.reg;
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i], xr = n.xb !== undefined ? n.xb : n.x + 0.25 * gl;
    const wx0 = Math.round(xr + 0.03 * gl) - c.xa, wx1 = Math.round(xr + 0.85 * gl) - c.xa;
    const wy0 = Math.round(n.y - 0.8 * gl) - c.top, wy1 = Math.round(n.y + 0.35 * gl) - c.top;
    if (wx0 < 0 || wy0 < 0 || wx1 > reg.w || wy1 > reg.h) continue;
    const win = pgCrop(reg, wy0, wy1, wx0, wx1);
    for (let x = 0; x < win.w; x++) {                                  // Notenlinien ausblenden
      const ox = c.off(x + wx0 + c.xa);
      for (const L of q) {
        const yl = L + ox - c.top - wy0;
        for (let y = Math.max(0, Math.floor(yl - c.lt / 2 - 1)); y <= Math.min(win.h - 1, Math.ceil(yl + c.lt / 2 + 1)); y++) win.a[y * win.w + x] = 0;
      }
    }
    for (const runs of pgComponents(win)) {
      const [x0, y0, x1, y1] = pgBox(runs), w = x1 - x0 + 1, h = y1 - y0 + 1;
      if (w < 0.12 * gl || h < 0.12 * gl || w > 0.5 * gl || h > 0.5 * gl) continue;               // kein Punkt
      if (x0 === 0 && runs.some(([y, a]) => a === 0 && wx0 > 0 && reg.a[(y + wy0) * reg.w + wx0 - 1])) continue;   // hängt an der Note
      if (Math.max(w, h) / Math.min(w, h) > 1.8) continue;                                        // Strich (Episem, Iktus)
      let area = 0; for (const r of runs) area += r[2] - r[1] + 1;
      if (area / (w * h) < 0.5) continue;
      const cx = (x0 + x1) / 2 + wx0 + c.xa;
      if (notes.some((m, j) => j !== i && Math.abs(m.x - cx) < 0.3 * gl)) continue;              // gehört zu einer anderen Note
      n.mora = true; break;
    }
  }
}

function pgSplitBlob(b, gl, hs, stepOf) {
  const {sub, sw, sh} = b, wref = b.wref;
  const cols = [];
  for (let x = 0; x < sw; x++) {
    let a = -1, z = -1;
    for (let y = 0; y < sh; y++) if (sub[y * sw + x]) { if (a < 0) a = y; z = y; }
    if (a >= 0) cols.push([x, a, z]);
  }
  let done = [];
  for (const c of cols) {
    if (done.length) {
      const t = done[done.length - 1], [, pa, pc] = t[t.length - 1];
      if (Math.abs((c[1] + c[2]) / 2 - (pa + pc) / 2) < 0.16 * gl && Math.abs((c[2] - c[1]) - (pc - pa)) < 0.3 * gl) { t.push(c); continue; }
    }
    done.push([c]);
  }
  if (!done.some(t => t.length >= 0.5 * wref)) done = [cols];
  const res = [];
  for (const t of done) {
    const ws = t.length;
    if (ws < 0.5 * wref) continue;
    const mids = t.map(c => (c[1] + c[2]) / 2), hts = t.map(c => c[2] - c[1] + 1);
    const n3 = Math.max(1, Math.floor(ws / 4));
    const cs = pgMedian(mids.slice(0, n3)), ce = pgMedian(mids.slice(-n3)), hmed = pgMedian(hts);
    const X = i => b.x0 + t[i < 0 ? t.length + i : i][0], Y = v => b.y0 + v;
    if (Math.abs(ce - cs) > 0.8 * hs && ws > 2.4 * wref) {         // Schrägbalken: Anfang und Ende
      const xa = X(0) + 0.2 * gl, xb = X(-1) - 0.2 * gl;
      res.push({x: xa, y: Y(cs), p: stepOf(xa, Y(cs)), kind: 'bar'});
      res.push({x: xb, y: Y(ce), p: stepOf(xb, Y(ce)), kind: 'bar'});
      continue;
    }
    let xm = (X(0) + X(-1)) / 2;
    const ytop = pgMedian(t.map(c => c[1])), ybot = pgMedian(t.map(c => c[2]));
    const nstack = pgRound(hmed / hs);
    if (nstack >= 2 && hmed > 0.8 * gl) {
      let ink = 0; for (const c of t) for (let y = c[1]; y <= c[2]; y++) ink += sub[y * sw + c[0]];
      if (ink / hts.reduce((a, v) => a + v, 0) < 0.8) { pgDiag('hohl', {x0: b.x0 + t[0][0], x1: b.x0 + t[t.length - 1][0], y0: b.y0, y1: b.y0 + sh, area: 0}, {lines: [0]}); continue; }
      const nh = 0.45 * gl;
      for (const yy of [ybot - nh / 2, ytop + nh / 2]) res.push({x: xm, y: Y(yy), p: stepOf(xm, Y(yy)), kind: 'stack'});
      continue;
    }
    const n = ws > 1.5 * wref ? pgRound(ws / wref) : 1;           // mehrere aneinander stossende Noten
    for (let k = 0; k < n; k++) {
      const part = t.slice(Math.floor(k * ws / n), Math.floor((k + 1) * ws / n));
      const d5 = Math.floor(part.length / 5);
      let core = part.slice(d5, part.length - d5); if (!core.length) core = part;
      const ym = pgMedian(core.map(c => (c[1] + c[2]) / 2));
      const xa = b.x0 + part[0][0], xb = b.x0 + part[part.length - 1][0];
      xm = (xa + xb) / 2;
      res.push({x: xm, y: Y(ym), p: stepOf(xm, Y(ym)), kind: 'note', w: part.length, xa, xb});
    }
  }
  return res;
}

// ── Schlüssel und Trennstriche ──────────────────────────────────────────
function pgFindClef(st) {
  const c = st._ctx, gl = c.gl, q = st.lines, x0 = st.x0;
  // Build 417 (nicht im Prototyp): 0.9 statt 0.6 – in feinem Druck beginnen die Linien deutlich vor dem Schlüssel (Rorate)
  const bl = c.blobs.filter(b => b.x0 < x0 + (globalThis._pgNurPrototyp ? 0.6 : 0.9) * gl && b.x1 > x0 - 0.2 * gl
    && b.y0 > q[0] - 1.4 * gl && b.y1 < q[3] + 1.4 * gl && b.area > 0.3 * c.wref * c.wref);
  if (!bl.length) return '';
  const ya = Math.min(...bl.map(b => b.y0)), yb = Math.max(...bl.map(b => b.y1));
  const xa = Math.min(...bl.map(b => b.x0)), xb = Math.max(...bl.map(b => b.x1));
  const sub = pgCrop(c.op, ya - c.top, yb - c.top + 1, xa - c.xa, xb - c.xa + 1);
  const rows = []; let tot = 0, wsum = 0, mx = 0;
  for (let y = 0; y < sub.h; y++) { let s = 0; for (let x = 0; x < sub.w; x++) s += sub.a[y * sub.w + x]; rows.push(s); tot += s; wsum += s * y; if (s > mx) mx = s; }
  let ym = ya + wsum / Math.max(1, tot);
  // Do-Schlüssel: zwei Blöcke, die Linie läuft durch die Lücke dazwischen
  const rs = []; let s0 = -1;
  for (let y = 0; y <= rows.length; y++) {
    const on = y < rows.length && rows[y] > 0.15 * Math.max(1, mx);
    if (on && s0 < 0) s0 = y;
    if (!on && s0 >= 0) { if (y - s0 >= 0.2 * gl) rs.push([s0, y - 1]); s0 = -1; }
  }
  if (rs.length >= 2) {
    const big = rs.slice().sort((a, b) => (b[1] - b[0]) - (a[1] - a[0])).slice(0, 2).sort((a, b) => a[0] - b[0]);
    ym = ya + (big[0][1] + big[1][0]) / 2;
  }
  const p = c.stepOf((xa + xb) / 2, ym);
  const line = Math.floor(p / 2 + 0.5) + 1;
  if (line < 1 || line > 4) return '';
  // F-Schlüssel: 1.76–1.96 Notenkopfbreiten, C-Schlüssel 0.66–1.18 (alle Testfälle, Build 422; vorher Grenze 1.9 = Prototyp)
  return ((xb - xa) > (globalThis._pgNurPrototyp ? 1.9 : 1.5) * c.wref ? 'f' : 'c') + line;
}

function pgFindBars(st) {
  const c = st._ctx, gl = c.gl, q = st.lines, x0 = st.x0;
  const ra = Math.max(0, pgInt(q[0] - 0.9 * gl) - c.top), rb = pgInt(q[3] + 0.9 * gl) - c.top;
  const reg = pgCrop(c.reg, ra, rb, 0, c.reg.w);
  const k = Math.max(5, pgRound(0.55 * gl));
  const v = pgLine1(pgLine1(reg, k, 0, true), k, 0, false);           // nur senkrechte Läufe ≥ 0.55 Linienabstand
  const near = pgLine1(pgLine1(pgCrop(c.op, ra, rb, 0, c.op.w), 2 * pgInt(0.3 * gl) + 1, 1, false), 2 * pgInt(0.15 * gl) + 1, 0, false);
  let bars = [];
  for (const runs of pgComponents(v)) {
    const [bx0, by0, bx1, by1] = pgBox(runs);
    if (bx1 - bx0 + 1 > 0.35 * gl) continue;                          // zu breit: Initiale, Notenstapel
    const cx = (bx0 + bx1) / 2 + c.xa;
    if (cx < x0 + PG_CLEF * gl) continue;
    let tot = 0, hit = 0;
    for (const [y, a, b] of runs) { tot += b - a + 1; for (let x = a; x <= b; x++) hit += near.a[y * near.w + x]; }
    if (hit > 0.25 * tot) continue;                                    // hängt an einem Notenkopf: Hals
    const m = pgInt(0.3 * gl), g2 = 2;
    let asym = 0;
    for (let y = by0; y <= by1; y++) {
      const l = pgAnyRow(reg, y, Math.max(0, bx0 - m), Math.max(0, bx0 - g2)), r = pgAnyRow(reg, y, bx1 + g2 + 1, bx1 + m + 1);
      if (l !== r) asym++;
    }
    if ((by1 - by0 + 1) < 1.4 * gl && asym / (by1 - by0 + 1) > 0.4) continue;   // b-Vorzeichen, Custos
    const L = (by1 - by0 + 1) / gl, pm = c.stepOf(cx, (by0 + by1) / 2 + ra + c.top);
    let t;
    if (L >= 2.5) t = ':';
    else if (L >= 1.4 && pm > 0.5 && pm < 5.5) t = ';';
    else if (L >= 0.5 && L < 1.4 && pm >= 4.5) t = ',';
    else continue;
    // Build 419 (nicht im Prototyp): eine Divisio minima endet knapp über der obersten Linie; ein Strich, der über den
    // Suchbereich (0.9 Linienabstände) hinausragt, ist Handschrift (Akkordzeichen über dem System, Dominus dixit)
    if (t === ',' && by0 <= 1 && !globalThis._pgNurPrototyp) continue;
    // … ebenso ein kurzer Strich unter 0.07 Linienabständen mittlerer Breite: gedruckte Divisio minima 0.09–0.21, Feder/Bleistift dünner
    if (t === ',' && !globalThis._pgNurPrototyp && tot / (by1 - by0 + 1) < 0.05 * gl) continue;
    bars.push({x: cx, type: t});
  }
  bars.sort((a, b) => a.x - b.x);
  const out = [];
  for (const b of bars) {
    const l = out[out.length - 1];
    if (l && b.x - l.x < 0.8 * gl) { if (b.type === ':' && (l.type === ':' || l.type === '::')) l.type = '::'; continue; }
    out.push(b);
  }
  return out;
}

// ── Textzeile und Initiale ──────────────────────────────────────────────
function pgTextTop(dark, st, gl) {
  const q = st.lines, xa = pgInt(st.x0), xb = pgInt(st.x1);
  const ya = pgInt(q[3] + 0.6 * gl), yb = Math.min(dark.h, pgInt(q[3] + 5 * gl));
  const dens = pgRowMean(pgCrop(dark, ya, yb, xa, xb));
  const k = Math.max(4, pgInt(0.3 * gl));
  for (let y = 0; y < dens.length - k; y++) {
    let mn = Infinity; for (let i = y; i < y + k; i++) mn = Math.min(mn, dens[i]);
    if (mn > 0.07) { while (y > 0 && dens[y - 1] > 0.02) y--; return ya + y; }
  }
  return null;
}

function pgDropcapBox(dark, st, gl, others) {
  const q = st.lines, yt0 = pgTextTop(dark, st, gl);
  const yt = yt0 !== null && yt0 !== 0 ? yt0 : pgInt(q[3] + 2 * gl);
  const xa = Math.max(0, pgInt(st.x0 - 16 * gl)), xb = pgInt(st.x0 - 0.1 * gl);
  const ya = Math.max(0, pgInt(q[0] - 3.5 * gl)), yb = pgInt(Math.min(dark.h, yt + 2.5 * gl));
  if (xb - xa < gl) return null;
  const blocked = [];
  for (const o of others || []) {
    if (o === st) continue;
    const og = (o.lines[3] - o.lines[0]) / 3;
    blocked.push([o.x0 - xa, o.lines[0] - og - ya, o.x1 - xa, o.lines[3] + 2.5 * og - ya]);
  }
  const inOther = b => blocked.some(r => b[0] < r[2] && r[0] < b[2] && b[1] < r[3] && r[1] < b[3]);
  const ybx = pgInt(Math.min(dark.h, yb + 6 * gl));                    // grosse Zier-Initialen reichen ins nächste System
  let best = null; const boxes = [];
  for (const runs of pgComponents(pgCrop(dark, ya, ybx, xa, xb))) {
    const b = pgBox(runs); boxes.push(b);
    // Build 417 (nicht im Prototyp): mindestens 0.6 Linienabstände breit – senkrechte Scannerstreifen am Rand sind keine Initiale
    const narrow = !globalThis._pgNurPrototyp && b[2] - b[0] + 1 < 0.6 * gl;
    if (b[1] < yb - ya && b[3] - b[1] >= 2.5 * gl && !narrow && !inOther(b) && (!best || b[3] - b[1] > best[3] - best[1])) best = b.slice();
  }
  if (!best) return null;
  // Verzierte Initialen bestehen aus mehreren Teilen: alle grösseren Teile dazunehmen, die den Kasten berühren
  const m = 0.3 * gl, mv = 1.5 * gl;
  for (let grown = true; grown;) {
    grown = false;
    for (const b of boxes) {
      if (Math.max(b[3] - b[1], b[2] - b[0]) < 0.3 * gl || inOther(b)) continue;
      if (b[0] > best[2] + m || b[2] < best[0] - m || b[1] > best[3] + mv || b[3] < best[1] - mv) continue;
      if (b[3] < best[1] && b[3] - b[1] < 1.2 * gl) continue;          // kleine Angabe darüber (Modus «VIII», «5»)
      const nb = [Math.min(best[0], b[0]), Math.min(best[1], b[1]), Math.max(best[2], b[2]), Math.max(best[3], b[3])];
      if (nb.some((v, i) => v !== best[i])) { best = nb; grown = true; }
    }
  }
  const pad = pgInt(0.3 * gl);
  return [xa + best[0] - pad, ya + best[1] - pad, xa + best[2] + pad, ya + best[3] + pad];
}

// Modus-Angabe über der Initiale («VIII», «5», «1.»): kleine Teile direkt über dem Initialkasten, ohne Linien/Text
// anderer Systeme. Gibt [x0, y0, x1, y1] (Seitenkoordinaten, mit Rand) oder null. (Nicht Teil des Python-Prototyps.)
function pgModeBox(dark, st, gl, dc, others) {
  if (!dc) return null;
  const xa = Math.max(0, pgInt(dc[0] - gl)), xb = Math.min(dark.w, pgInt(dc[2] + gl));
  const ya = Math.max(0, pgInt(dc[1] - 3 * gl)), yb = Math.min(dark.h, pgInt(dc[1] + 0.6 * gl));
  if (xb - xa < gl || yb - ya < gl) return null;
  const blocked = [[st.x0 - 0.2 * gl - xa, st.lines[0] - gl - ya, st.x1 - xa, st.lines[3] + 2.5 * gl - ya]];   // eigenes System (Schlüssel)
  for (const o of others || []) {
    if (o === st) continue;
    const og = (o.lines[3] - o.lines[0]) / 3;
    blocked.push([o.x0 - xa, o.lines[0] - og - ya, o.x1 - xa, o.lines[3] + 2.5 * og - ya]);
  }
  let box = null;
  for (const runs of pgComponents(pgCrop(dark, ya, yb, xa, xb))) {
    const b = pgBox(runs), h = b[3] - b[1] + 1, w = b[2] - b[0] + 1;
    if (h < 0.15 * gl || h > 1.5 * gl || w > 3 * gl) continue;                 // Staub oder Teil der Initiale/Text
    if (b[3] + ya > dc[1] + 0.25 * gl) continue;                               // reicht in die Initiale hinein
    if (blocked.some(r => b[0] < r[2] && r[0] < b[2] && b[1] < r[3] && r[1] < b[3])) continue;
    box = box ? [Math.min(box[0], b[0]), Math.min(box[1], b[1]), Math.max(box[2], b[2]), Math.max(box[3], b[3])] : b.slice();
  }
  if (!box) return null;
  const pad = pgInt(0.3 * gl);
  return [xa + box[0] - pad, ya + box[1] - pad, xa + box[2] + pad, ya + box[3] + pad];
}

// Tintengruppen der ersten Textzeile (Lücke ≥ 0.2 Linienabstand trennt), mit «endet auf Trennstrich»
function pgTextChunks(dark, st, gl) {
  const yt = pgTextTop(dark, st, gl);
  if (yt === null) return [];
  const xa = Math.max(0, pgInt(st.x0 - 0.5 * gl)), xb = Math.min(dark.w, pgInt(st.x1 + 0.5 * gl));
  let band = pgCrop(dark, pgInt(yt), Math.min(dark.h, pgInt(yt + 1.3 * gl)), xa, xb);
  let dens = pgRowMean(band), yb = dens.length;
  for (let y = pgInt(0.5 * gl); y < dens.length; y++) if (dens[y] < 0.01) { yb = y; break; }
  band = pgCrop(band, 0, yb, 0, band.w); dens = dens.slice(0, yb);
  if (!band.h || !band.w) return [];
  const dmax = Math.max(...dens), body = [];
  dens.forEach((d, i) => { if (d > 0.5 * dmax) body.push(i); });
  const bt = body[0], bb = body[body.length - 1];
  const runs = []; let s0 = -1;
  for (let x = 0; x <= band.w; x++) {
    let on = false;
    if (x < band.w) for (let y = 0; y < band.h; y++) if (band.a[y * band.w + x]) { on = true; break; }
    if (on && s0 < 0) s0 = x;
    if (!on && s0 >= 0) { runs.push([s0, x - 1]); s0 = -1; }
  }
  const groups = [];
  for (const [a, b] of runs) {
    const g = groups[groups.length - 1];
    if (g && a - g[g.length - 1][1] < 0.2 * gl) g.push([a, b]); else groups.push([[a, b]]);
  }
  const out = [];
  for (const g of groups) {
    const [a, b] = g[g.length - 1];
    let r0 = -1, r1 = -1;
    for (let y = 0; y < band.h; y++) if (pgAnyRow(band, y, a, b + 1)) { if (r0 < 0) r0 = y; r1 = y; }
    let hy = false;
    if (r0 >= 0) {
      const h = r1 - r0 + 1, mid = (r0 + r1) / 2;
      hy = h < 0.22 * gl && bt + 0.15 * (bb - bt) < mid && mid < bb - 0.15 * (bb - bt) && (b - a) < 0.6 * gl;
    }
    if (g.length === 1 && hy) { if (out.length) out[out.length - 1].hyphen = true; continue; }
    const x1 = hy && g.length > 1 ? g[g.length - 2][1] : g[g.length - 1][1];   // Trennstrich nicht zur Breite zählen
    out.push({x0: g[0][0] + xa, x1: x1 + xa, hyphen: hy});
  }
  return out;
}

// ── Text auf Tintengruppen und Noten legen ──────────────────────────────
const PG_SIGN_RE = /^(\d+\.?|[℣℟]\.?|[VR]\/\.?|Ps\.)$/i;
// Silbengrenzen, die die KI ausgelassen hat («cre-ásti», «úncti», «VExíl»), nach der Notator-Silbentrennung ergänzen
// (Build 425, nicht im Prototyp). Gedruckte bzw. gelieferte Bindestriche bleiben; nur Teile mit ≥ 2 Vokalgruppen werden geteilt.
function pgResyllabify(text) {
  if (globalThis._pgNurPrototyp || typeof ntPtSyllabify !== 'function') return text;
  return String(text || '').split(/(\s+)/).map(w => {
    if (/^\s*$/.test(w) || PG_SIGN_RE.test(w)) return w;
    const parts = w.split('-');
    return parts.map((part, pi) => {
      const m = /^([^\p{L}]*)([\p{L}]*)([^\p{L}]*)$/u.exec(part);
      if (!m || m[2].length < 3) return part;
      // «san-guis»: gu vor Vokal nach n ist ein Konsonant – mit dem n davor trennen lassen
      const prevN = pi > 0 && /n$/i.test(parts[pi - 1]) && /^gu[aeiouyáéíóúý]/i.test(m[2]);
      const syl = prevN ? ntPtSyllabify('n' + m[2]).map((x, k) => k ? x : x.slice(1)).filter(x => x) : ntPtSyllabify(m[2]);
      // «saé-cu-la», «caé-lum»: Akzent auf dem e des Diphthongs æ (Satzgewohnheit) – nicht «sa-é» trennen
      for (let k = syl.length - 2; k >= 0; k--) if (/[aoAO]$/.test(syl[k]) && /^[éÉ]/.test(syl[k + 1])) syl.splice(k, 2, syl[k] + syl[k + 1]);
      return syl.length > 1 ? m[1] + syl.join('-') + m[3] : part;
    }).join('-');
  }).join('');
}
function pgCleanLine(t) { return String(t || '').trim().replace(/-\s+(?=\S)/g, '-'); }

function pgSyllablesFromChunks(text, chunks, gl, dropcap) {
  const syls = [];
  for (const w of text.split(/\s+/)) {
    // Build 419: Strophennummern, ℣ ℟ und «Ps.» liefert die KI mit – sie belegen ihre Textgruppe und werden danach entfernt
    if (!globalThis._pgNurPrototyp && PG_SIGN_RE.test(w)) { syls.push({text: w, word: true, wend: true, sign: true, n: w.length}); continue; }
    if (!/\p{L}/u.test(w)) continue;
    const parts = w.split('-').filter(p => p);
    parts.forEach((p, k) => syls.push({text: p, word: k === 0, wend: k === parts.length - 1,
      n: p.replace(/[^\p{L}\p{N}_]/gu, '').length || 1}));
  }
  if (!syls.length) return [];
  if (dropcap && syls[0].n > 0) syls[0].n -= 1;                       // erster Buchstabe steht als Initiale ausserhalb
  const S = syls.length, C = chunks.length;
  if (C === 0) return null;
  const cw = chunks.reduce((s, c) => s + c.x1 - c.x0, 0) / Math.max(1, syls.reduce((s, x) => s + x.n, 0));
  const INF = 1e18, L = 4, SKIP = 1.0;
  const f = Array.from({length: S + 1}, () => new Array(C + 1).fill(INF));
  const bk = Array.from({length: S + 1}, () => new Array(C + 1).fill(null));
  f[0][0] = 0;
  if (syls[0].n === 0) { f[1][0] = 0; bk[1][0] = ['drop']; }        // Initiale ist eine ganze Silbe («A-ve»)
  for (let i = 0; i <= S; i++) {
    for (let j = 0; j <= C; j++) {
      if (f[i][j] >= INF) continue;
      if (j < C && f[i][j] + SKIP < f[i][j + 1]) { f[i][j + 1] = f[i][j] + SKIP; bk[i][j + 1] = ['skip', i, j]; }
      if (j >= C) continue;
      const c = chunks[j], w = c.x1 - c.x0;
      for (let r = 1; r <= L && i + r <= S; r++) {
        const run = syls.slice(i, i + r);
        const est = cw * run.reduce((s, x) => s + x.n, 0);
        let cost = Math.abs(w - est) / Math.max(cw * 2.5, 1e-6);
        cost += 2.0 * run.slice(1).filter(x => x.word).length;          // Gruppe über eine Wortgrenze
        if (c.hyphen && run[r - 1].wend) cost += 0.5;
        if (!c.hyphen && !run[r - 1].wend) cost += 0.3;
        if (f[i][j] + cost < f[i + r][j + 1]) { f[i + r][j + 1] = f[i][j] + cost; bk[i + r][j + 1] = ['take', i, j, r]; }
      }
    }
  }
  let j = 0;
  for (let jj = 1; jj <= C; jj++) if (f[S][jj] + SKIP * (C - jj) < f[S][j] + SKIP * (C - j)) j = jj;
  let i = S; const assign = new Map();
  while (i > 0 || j > 0) {
    const b = bk[i][j];
    if (!b) break;
    if (b[0] === 'drop') break;
    if (b[0] === 'skip') { i = b[1]; j = b[2]; continue; }
    assign.set(b[2], [b[1], b[3]]); i = b[1]; j = b[2];
  }
  for (const [cj, [pi, r]] of assign) {
    const c = chunks[cj], run = syls.slice(pi, pi + r), tot = run.reduce((s, x) => s + x.n, 0);
    let pos = 0;
    for (const s of run) {
      s.x = c.x0 + (c.x1 - c.x0) * pos / Math.max(1, tot);
      s.x1 = c.x0 + (c.x1 - c.x0) * (pos + s.n) / Math.max(1, tot); pos += s.n;
    }
  }
  syls.forEach((s, k) => {                                              // Silben ohne Gruppe zwischen die Nachbarn
    if (s.x !== undefined) return;
    let left = chunks[0].x0 - gl;
    for (let q = k - 1; q >= 0; q--) if (syls[q].x !== undefined) { left = syls[q].x1; break; }
    s.x = left + 0.1 * gl; s.x1 = s.x + 0.5 * gl;
  });
  return syls.map(s => ({text: s.text, x: s.x, x1: s.x1, word: s.word, sign: !!s.sign}));
}

// Note als GABC: ♭ davor, Buchstabe, Virga, Mora
function pgNoteGabc(n) { return (n.flat ? n.flat + 'x' : '') + n.letter + (n.virga ? 'v' : '') + (n.mora ? '.' : ''); }

// GABC-Zeile: Notengruppen (Lücke > 0.8 Linienabstand) per dynamischer Programmierung monoton auf die Silben verteilen
function pgToGabcText(notes, bars, syls, gl) {
  if (!syls || !syls.length) return null;
  const units = [];
  for (const n of notes) {
    const u = units[units.length - 1];
    if (u && n.x - u[u.length - 1].x <= PG_UNIT_GAP * gl) u.push(n); else units.push([n]);
  }
  const S = syls.length, U = units.length;
  const a = syls.map(s => s.x - 0.4 * gl), b = a.map((v, i) => i + 1 < S ? a[i + 1] : 1e9);
  a[0] = -1e9;
  const cost = (j, i) => { const x = units[j][0].x; return (a[i] <= x && x < b[i]) ? 0 : Math.min(Math.abs(x - a[i]), Math.abs(x - b[i])) / gl; };
  // Strafe je Silbe ohne Noten: 4 statt 0.8 (Build 422, nicht im Prototyp). Mit 0.8 war es oft «billiger», Silben leer zu
  // lassen, als eine Note knapp ausserhalb der geschätzten Silbengrenze zuzuordnen – dann verrutschte die Zuordnung, und aus
  // Punctum/Clivis wurden falsche Neumentypen (Resurrexi, Ave Maria). Über alle Fälle besser, keiner schlechter.
  const P = globalThis._pgNurPrototyp ? 0.8 : 4, INF = 1e18, groups = syls.map(() => []);
  if (U) {
    const f = Array.from({length: U}, () => new Array(S).fill(INF)), bk = Array.from({length: U}, () => new Array(S).fill(-1));
    for (let i = 0; i < S; i++) f[0][i] = cost(0, i) + P * i;
    for (let j = 1; j < U; j++) {
      let M = INF, Mk = -1;
      for (let i = 0; i < S; i++) {
        let cand = f[j - 1][i], ci = i;
        if (Mk >= 0 && M + P * (i - 1) < cand) { cand = M + P * (i - 1); ci = Mk; }
        f[j][i] = cand + cost(j, i); bk[j][i] = ci;
        if (f[j - 1][i] - P * i < M) { M = f[j - 1][i] - P * i; Mk = i; }
      }
    }
    let end = 0;
    for (let i = 1; i < S; i++) if (f[U - 1][i] + P * (S - 1 - i) < f[U - 1][end] + P * (S - 1 - end)) end = i;
    let i = end;
    for (let j = U - 1; j >= 0; j--) { groups[i] = units[j].concat(groups[i]); if (j > 0) i = bk[j][i]; }
  }
  let toks = syls.map((s, i) => [groups[i].length ? groups[i][0].x : s.x, i, s.text + '(' + groups[i].map(pgNoteGabc).join('') + ')', s.word]);
  let m = -1e9;
  toks = toks.map(t => { m = Math.max(m, t[0]); return [m, t[1], t[2], t[3]]; });
  toks = toks.concat(bars.map(bb => [bb.x, 1e6, '(' + bb.type + ')', true]));
  toks.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  let out = '';
  toks.forEach((t, i) => { out += (i && (t[3] || t[2][0] === '(' || toks[i - 1][2][0] === '(') ? ' ' : '') + t[2]; });
  return out;
}

// ── Ganze Seite ─────────────────────────────────────────────────────────
// img: Graustufenbild der Seite (~300 dpi). Gibt {img (entzerrt), staves: [{lines, x0, x1, gl, notes, bars, clef,
// dropcap, chunks}], gap, angle, thr}.
function pgAnalysePage(img) {
  const sv = pgStaves(img);
  const thr = pgInt((pgOtsu(sv.img) + pgMedianGray(sv.img)) / 2);
  const dark = pgThreshold(sv.img, thr), sts = sv.sts, g = sv.g;
  let sizes = [];
  // Ab Build 416 (nicht im Prototyp): Notenkopfgrössen relativ zum Linienabstand des Systems, damit kleinere Systeme
  // auf derselben Seite nicht als «zu klein» verworfen werden
  const rel = !globalThis._pgNurPrototyp, glOf = st => (st.lines[3] - st.lines[0]) / 3;
  const normal = sts.filter(st => !st.odd);                 // abweichende Systeme verfälschen die Grösse nicht (Build 417)
  for (const st of normal.length ? normal : sts) {
    const k = rel ? glOf(st) : 1;
    sizes = sizes.concat(pgAnalyseStaff(dark, st, g, null).sizes.map(([a, w]) => [a / (k * k), w / k]));
  }
  const ref0 = sizes.length ? [pgMedian(sizes.map(s => s[0])), pgMedian(sizes.map(s => s[1]))] : rel ? [0.2, 0.45] : [0.2 * g * g, 0.45 * g];
  const refOf = st => { const k = rel ? glOf(st) : 1; return [ref0[0] * k * k, ref0[1] * k]; };
  const dcs = [];
  for (const st of sts) {
    let d = pgDropcapBox(dark, st, (st.lines[3] - st.lines[0]) / 3, sts);
    if (d && dcs.some(p => p && d[0] < p[2] && p[0] < d[2] && d[1] < p[3] && p[1] < d[3])) d = null;   // Teil einer schon gefundenen
    dcs.push(d);
  }
  const staves = sts.map((st, k) => {
    const {notes, gl} = pgAnalyseStaff(dark, st, g, refOf(st));
    return {lines: st.lines, x0: st.x0, x1: st.x1, gl, notes, bars: pgFindBars(st), clef: pgFindClef(st), odd: st.odd,
      dropcap: dcs[k], modeBox: pgModeBox(dark, st, gl, dcs[k], sts), textTop: pgTextTop(dark, st, gl), chunks: pgTextChunks(dark, st, gl)};
  }).filter(s => !s.odd || s.clef);      // abweichend grosses oder nur am Rand gefundenes System: nur mit Schlüssel (Build 417)
  // ♭ nur auf der b-Stufe des Schlüssels (Build 418, nicht im Prototyp): alle Fehlfunde der Gegenproben lagen anderswo
  // (handschriftliche Akkordbuchstaben «B»/«Es», Bleistift), alle richtigen auf dieser Stufe
  if (!globalThis._pgNurPrototyp) for (const s of staves) {
    if (!pgBSteps(s.clef)) continue;
    for (const n of s.notes) if (n.flat && !pgBSteps(s.clef).includes(n.flat)) delete n.flat;
  }
  return {img: sv.img, staves, gap: g, angle: sv.ang, thr};
}

// GABC-Zeile eines Systems aus dem gelesenen Text (Silben mit «-», Wörter mit Leerzeichen)
function pgStaffGabc(staff, text) {
  const t = pgResyllabify(pgCleanLine(text));
  // Build 419 (nicht im Prototyp): Textgruppen rechts vom letzten Schlussstrich und von der letzten Note tragen keine Silbe
  // (roter Hinweis «rep. Alleluja» bei Surrexit, den die KI weglässt)
  let chunks = staff.chunks;
  if (!globalThis._pgNurPrototyp && staff.notes.length) {
    const end = Math.max(...staff.notes.map(n => n.x), ...staff.bars.filter(b => b.type === '::').map(b => b.x));
    if (staff.bars.some(b => b.type === '::' && b.x >= end - 1)) chunks = chunks.filter(c => c.x0 <= end + 0.5 * staff.gl);
  }
  let syls = pgSyllablesFromChunks(t, chunks, staff.gl, !!staff.dropcap);
  if (syls === null) {                                                   // keine Textgruppen: gleichmässig verteilen
    const parts = [];
    t.split(/\s+/).filter(w => /\p{L}/u.test(w)).forEach(w => w.split('-').filter(p => p).forEach((p, k) => parts.push({text: p, word: k === 0})));
    const span = staff.x1 - staff.x0;
    syls = parts.map((p, i) => ({text: p.text, word: p.word, x: staff.x0 + span * i / Math.max(1, parts.length), x1: 0}));
  }
  syls = syls.filter(x => !x.sign);                                      // Strophennummer, ℣, Ps.: nur für die Zuordnung
  if (!syls.length) syls = [{text: '', x: staff.x0, x1: staff.x0, word: true}];
  return pgToGabcText(staff.notes, staff.bars, syls, staff.gl);
}
