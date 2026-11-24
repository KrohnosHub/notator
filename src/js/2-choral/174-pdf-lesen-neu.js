// ── «PDF lesen» (seit Build 410 der einzige Weg; eingeführt in Build 409 hinter einem Schalter) ─────────
// Ablauf je Seite: mit 300 dpi rendern → Geometrie (172-pdf-geometrie.js: Systeme, Tonhöhen, Schlüssel, Trennstriche,
// Initialen, Textgruppen) → Textzeilen als ein Bild → ein KI-Aufruf (Sonnet 5.5, effort low) liest den Text mit
// Silbentrennung → Text auf die Noten legen → GABC. Stückgrenzen: ein System mit Initiale beginnt ein neues Stück.
// Neumenformen (Quilisma, Liqueszenz, Oriscus, Episem …) erkennt dieser Weg noch nicht (Backlog, hohe Priorität).
// Einstieg: gregLoadPDF (170-greg-pdf-background.js) lädt das PDF und ruft pgPdfLesenNeu auf.

const PG_MODEL = 'claude-sonnet-5-5';
const PG_PRICE = [2.0, 10.0];            // USD je 1 Mio. Token (Eingabe, Ausgabe), Stand 11/2026
const PG_DPI = 300, PG_MAX_PAGES = 6, PG_LINE_H = 64, PG_BOTTOM = 1.6, PG_IMG_W = 1600;

const PG_PROMPT = 'The image shows numbered strips. Each strip is one line of Latin chant text, cut from under a staff of ' +
'square notation in a printed book. A strip may begin with a large (often decorated) initial letter, shown scaled ' +
'down at its left edge; it is the first letter of the strip\'s first word: write it directly before that word\'s ' +
'other letters, with no hyphen and no space (e.g. initial "S" + "Al-ve" -> "SAl-ve", initial "A" + "D cœnam" -> ' +
'"Ad cœ-nam"). The rest of that word is still divided into syllables as usual: initial "S" + "Edébit" -> "SE-dé-bit", ' +
'initial "R" + "ESURREXI" -> "RE-SUR-RE-XI".\n' +
'Every numbered strip is its own line: return exactly the text printed in that strip. Never move text from one ' +
'strip into another, even when a word or sentence continues on the next strip (keep the hyphen at the end of the ' +
'strip, e.g. strip 1 "... al-", strip 2 "le-lú-ia.").\n' +
'A long strip may be cut into two parts shown on consecutive rows; the second part is marked "N+" and continues ' +
'strip N on the same line. Return such a strip as one entry.\n\n' +
'Transcribe the text of every numbered strip exactly as printed:\n' +
'- Separate words with one space. Mark EVERY syllable boundary inside a word with "-". The print shows hyphens only ' +
'where notes separate the syllables; add the missing ones yourself with the usual syllable division of liturgical ' +
'Latin. Examples: printed "Surré-xit" -> "Sur-ré-xit", "appá-ru-it" -> "ap-pá-ru-it", "omnes" -> "o-mnes", ' +
'"benedícta" -> "be-ne-dí-cta", "GAUDEAMUS" -> "GAU-DE-A-MUS". Do not copy the spacing of the print: no space ' +
'after a hyphen inside a word ("Gló-ri- a" -> "Gló-ri-a").\n' +
'- A hyphen printed inside a word always counts, even where it differs from the rules below (some older books ' +
'print "díg-ni-or", "om-nes"; keep that).\n' +
'- Where nothing is printed, use the division of the Solesmes chant books: consonant groups ct, gn, mn, pt, ps, st, sc ' +
'and consonant + l/r go together to the next syllable ("San-ctus", "be-ne-dí-cta", "a-gnus", "ó-mni-um", "no-stra", ' +
'"Pa-tri"); x stays with the syllable before ("ex-sul-tá-te"). In "alleluia" the final "ia" is one syllable: ' +
'"Al-le-lú-ia".\n' +
'- Keep accents (á é í ó ú ý ǽ) and the ligatures æ œ exactly as printed. Keep punctuation (, . ; : ! ?) at the end of ' +
'its word; look closely to tell a comma (with a small tail below the line) from a full stop.\n' +
'- Leave out the asterisk * and crosses. Keep verse numbers (e.g. "2."), the signs ℣ ℟ and "Ps." as separate words ' +
'exactly where they are printed (they help to place the syllables and are removed afterwards).\n' +
'- If a strip contains no chant text, return an empty string for it.\n' +
'Return one entry per strip number 1..N.\n\n' +
'Rows labelled "M<n>" (if any) are not chant text: they show the small annotation printed above the initial letter of ' +
'strip n, usually the mode of the chant as a Roman or Arabic numeral, sometimes with other words (e.g. "VIII", "5", ' +
'"1.", "R. br. VI", "Ant. 7"). For each such row return in "modes" the mode as an Arabic number 1–8 ("VIII" -> "8", ' +
'"R. br. VI" -> "6"), or an empty string if no mode number is visible.';

// PDF-Seite mit 300 dpi als Graustufenbild (L = 0.299 R + 0.587 G + 0.114 B, wie PIL)
async function pgRenderPageGray(pdfDoc, pageNo) {
  const page = await pdfDoc.getPage(pageNo);
  const vp = page.getViewport({scale: PG_DPI / 72});
  const cv = document.createElement('canvas');
  cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
  const ctx = cv.getContext('2d', {willReadFrequently: true});
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
  await page.render({canvasContext: ctx, viewport: vp}).promise;
  const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
  const g = new Uint8Array(cv.width * cv.height);
  for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
  const img = {w: cv.width, h: cv.height, a: g};
  cv.width = cv.height = 0;                                   // Speicher sofort freigeben (Handy)
  return img;
}

// Ausschnitt eines Graustufenbilds als Canvas
function pgGrayCanvas(img, x0, y0, x1, y1) {
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
  x1 = Math.min(img.w, Math.floor(x1)); y1 = Math.min(img.h, Math.floor(y1));
  const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d'), id = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = (y0 + y < img.h && x0 + x < img.w) ? img.a[(y0 + y) * img.w + x0 + x] : 255, k = (y * w + x) * 4;
    id.data[k] = id.data[k + 1] = id.data[k + 2] = v; id.data[k + 3] = 255;
  }
  ctx.putImageData(id, 0, 0);
  return cv;
}
function pgScaled(src, w, h) {
  const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w)); cv.height = Math.max(1, Math.round(h));
  const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.drawImage(src, 0, 0, cv.width, cv.height);
  return cv;
}
// Lange Zeile an der hellsten Spalte (Wortlücke) im mittleren Drittel teilen
function pgSplitStrip(cv, maxw) {
  const w = cv.width, h = cv.height, d = cv.getContext('2d').getImageData(0, 0, w, h).data, col = new Float64Array(w);
  for (let x = 0; x < w; x++) { let s = 0; for (let y = 0; y < h; y++) s += 255 - d[(y * w + x) * 4]; col[x] = s; }
  const lo = Math.floor(w / 3), hi = Math.floor(2 * w / 3);
  let cut = lo, best = Infinity;
  for (let x = lo; x < hi; x++) { let s = 0; for (let k = -7; k <= 7; k++) s += col[Math.min(w - 1, Math.max(0, x + k))]; if (s < best) { best = s; cut = x; } }
  const part = (a, b) => { const p = document.createElement('canvas'); p.width = b - a; p.height = h; p.getContext('2d').drawImage(cv, a, 0, b - a, h, 0, 0, b - a, h); return p.width > maxw ? pgScaled(p, maxw, h * maxw / p.width) : p; };
  return [part(0, cut), part(cut, w)];
}

// Textzeilen aller Systeme einer Seite als ein Bild (Initiale links vor ihre Zeile). Gibt {b64, n}.
function pgStripsImage(page) {
  const parts = [];
  page.staves.forEach((st, k) => {
    if (st.textTop === null) return;
    const gl = st.gl;
    let c = pgGrayCanvas(page.img, st.x0 - 0.5 * gl, st.textTop - 0.35 * gl, st.x1 + 0.5 * gl, st.textTop + PG_BOTTOM * gl);
    if (st.dropcap) {
      const [a, b, x, y] = st.dropcap, ini = pgGrayCanvas(page.img, a, b, x, y);
      const iw = ini.width * c.height / ini.height, gap = Math.floor(0.6 * gl);
      const both = document.createElement('canvas'); both.width = Math.round(iw) + gap + c.width; both.height = c.height;
      const bc = both.getContext('2d'); bc.fillStyle = '#fff'; bc.fillRect(0, 0, both.width, both.height);
      bc.imageSmoothingQuality = 'high'; bc.drawImage(ini, 0, 0, iw, c.height); bc.drawImage(c, Math.round(iw) + gap, 0);
      c = both;
    }
    c = pgScaled(c, c.width * PG_LINE_H / c.height, PG_LINE_H);
    if (st.modeBox) {                                              // Modus-Angabe über der Initiale als eigene Zeile «M<n>»
      const [a, b, x, y] = st.modeBox, m = pgGrayCanvas(page.img, a, b, x, y);
      parts.push(['M' + (k + 1), pgScaled(m, m.width * PG_LINE_H / m.height, PG_LINE_H)]);
    }
    if (c.width > PG_IMG_W - 70) pgSplitStrip(c, PG_IMG_W - 70).forEach(p => parts.push([k + 1, p]));
    else parts.push([k + 1, c]);
  });
  const H = parts.reduce((s, [, p]) => s + p.height + 10, 10);
  const cv = document.createElement('canvas'); cv.width = PG_IMG_W; cv.height = H;
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, H);
  ctx.font = '12px sans-serif'; ctx.textBaseline = 'middle';
  let y = 10, prev = null;
  for (const [n, p] of parts) {
    ctx.fillStyle = '#000'; ctx.fillText(String(n) + (n === prev ? '+' : ''), 8, y + p.height / 2);
    if (n !== prev) { ctx.strokeStyle = '#b4b4b4'; ctx.beginPath(); ctx.moveTo(0, y - 5); ctx.lineTo(PG_IMG_W, y - 5); ctx.stroke(); }
    ctx.drawImage(p, 60, y); y += p.height + 10; prev = n;
  }
  return {b64: cv.toDataURL('image/png').split(',')[1], n: page.staves.length};
}

// Ein KI-Aufruf je Seite: Text je System und Modus je Initiale. Gibt {lines, modes: {n: '1'…'8'}, usage}.
async function pgReadText(apiKey, b64, n) {
  const row = (key, type) => ({type: 'array', items: {type: 'object', properties: {n: {type: 'integer'}, [key]: {type}},
    required: ['n', key], additionalProperties: false}});
  const schema = {type: 'object', properties: {lines: row('text', 'string'), modes: row('mode', 'string')},
    required: ['lines', 'modes'], additionalProperties: false};
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true'},
    body: JSON.stringify({model: PG_MODEL, max_tokens: 8000,
      output_config: {effort: 'low', format: {type: 'json_schema', schema}},
      messages: [{role: 'user', content: [
        {type: 'image', source: {type: 'base64', media_type: 'image/png', data: b64}},
        {type: 'text', text: PG_PROMPT + '\nN = ' + n}]}]})
  });
  if (!resp.ok) {
    let msg = ''; try { msg = (await resp.json()).error.message; } catch (e) { /* kein JSON */ }
    throw new Error('KI-Fehler ' + resp.status + (msg ? ': ' + msg : ''));
  }
  const r = await resp.json();
  if (r.stop_reason === 'refusal') throw new Error('KI hat die Anfrage abgelehnt');
  if (r.stop_reason === 'max_tokens') throw new Error('KI-Antwort abgeschnitten');
  const text = (r.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  const got = {}, modes = {}, ans = JSON.parse(text);
  for (const e of (ans.lines || [])) got[e.n] = String(e.text || '');
  for (const e of (ans.modes || [])) { const m = /[1-8]/.exec(String(e.mode || '')); if (m) modes[e.n] = m[0]; }
  const u = r.usage || {};
  return {lines: Array.from({length: n}, (_, k) => got[k + 1] || ''), modes,
    usage: {input: u.input_tokens || 0, output: u.output_tokens || 0, usd: ((u.input_tokens || 0) * PG_PRICE[0] + (u.output_tokens || 0) * PG_PRICE[1]) / 1e6}};
}

// Fremder Text (KI-Antwort) → nur Zeichen, die im GABC als Silbentext unbedenklich sind
function pgSafeText(t) { return String(t || '').replace(/[()[\]{}<>%|\\]/g, ' ').replace(/\s+/g, ' ').trim(); }

// Die KI hat zwei Zeilen in eine geschrieben und die nächste leer gelassen (grosse Zierinitiale über zwei Systeme, Vexilla
// Regis; Build 425): den Text nach der Breite der Textgruppen beider Systeme an einer Silbengrenze aufteilen.
function pgRepairMerged(lines, staves) {
  const width = st => (st.chunks || []).reduce((s, c) => s + c.x1 - c.x0, 0);
  for (let k = 0; k + 1 < staves.length; k++) {
    if (!String(lines[k] || '').trim() || String(lines[k + 1] || '').trim() || (staves[k + 1].chunks || []).length < 3) continue;
    const w0 = width(staves[k]), w1 = width(staves[k + 1]);
    if (!w0 || !w1) continue;
    const syl = [];                                               // [Text, beginnt Wort]
    pgResyllabify(lines[k]).trim().split(/\s+/).forEach(w => w.split('-').filter(x => x).forEach((p, i) => syl.push([p, i === 0])));
    const tot = syl.reduce((s, x) => s + x[0].length, 0), goal = tot * w0 / (w0 + w1);
    let acc = 0, cut = 1, best = Infinity;
    for (let i = 0; i < syl.length; i++) { acc += syl[i][0].length; if (Math.abs(acc - goal) < best && i + 1 < syl.length) { best = Math.abs(acc - goal); cut = i + 1; } }
    const join = arr => arr.map((x, i) => (i && x[1] ? ' ' : i ? '-' : '') + x[0]).join('');
    lines[k] = join(syl.slice(0, cut)) + (syl[cut] && !syl[cut][1] ? '-' : '');
    lines[k + 1] = join(syl.slice(cut).map((x, i) => i ? x : [x[0], true]));
    console.log('PDF lesen (neu): Zeilen ' + (k + 1) + '/' + (k + 2) + ' aufgeteilt (KI hatte sie zusammengezogen)');
  }
}
// Systeme (über alle Seiten) zu Stücken: ein System mit Initiale beginnt ein neues Stück
function pgPieces(items) {
  const pieces = [];
  for (const it of items) {
    if (!pieces.length || it.staff.dropcap) pieces.push({index: pieces.length + 1, mode: '?', incipit: '', pages: [], items: [], systems: 0});
    const p = pieces[pieces.length - 1];
    p.items.push(it); p.systems++; if (!p.pages.includes(it.page)) p.pages.push(it.page);
  }
  for (const p of pieces) {
    const words = p.items.map(it => it.text).join(' ').replace(/-/g, '').split(/\s+/).filter(w => /\p{L}/u.test(w) && !PG_SIGN_RE.test(w));
    p.incipit = words.slice(0, 5).join(' ').replace(/[,.;:!?]+$/, '') || '(ohne Text)';
    p.hasDropCap = !!p.items[0].staff.dropcap;
    p.mode = p.items[0].mode || '?';                               // Modus über der Initiale des ersten Systems
    const cl = p.items.map(it => it.staff.clef).filter(c => c), cnt = {};
    cl.forEach(c => { cnt[c] = (cnt[c] || 0) + 1; });
    p.clef = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || 'c4';
  }
  return pieces;
}
function pgPieceGabc(p, withHeader) {
  const lines = p.items.map(it => pgStaffGabc(it.staff, it.text) || '').filter(l => l.trim());
  let body = '(' + p.clef + ') ' + lines.join('\n');
  if (!/\(::\)\s*$/.test(body)) body += ' (::)';
  return withHeader ? pgGabcHeader(p) + body : body;
}
function pgGabcHeader(p) {
  return (/^[1-8]$/.test(p.mode) ? 'annotation: ' + p.mode + '\n' : '') + (p.hasDropCap ? 'drop-cap: auto\n' : '') + '%%\n\n';
}

// GregoBase-Abgleich wie im bisherigen Weg: nur anbieten, nie automatisch. Gibt true, wenn aus GregoBase geladen wurde.
async function pgTryGregoBase(p) {
  try {
    gregGst('Suche "' + p.incipit + '" in GregoBase…');
    const matches = await gregSearchGregoBase(p.incipit);
    if (!matches.length) return false;
    const picked = await gregPickGregoBaseMatchModal(matches, p.incipit);
    if (picked === '__CANCEL__') return 'cancel';
    if (!picked) return false;
    gregGst('Lade GABC von GregoBase (#' + picked.id + ')…');
    const base = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? '' : 'https://notator-gregobase-proxy.matthias-krohn.workers.dev';
    const r = await fetch(base + '/_gregobase_download?id=' + picked.id + '&format=gabc&elem=1');
    if (!r.ok) throw new Error('Download HTTP ' + r.status);
    const g = (await r.text()).trim();
    if (!g) return false;
    gregImportGABCString(gregTagGregoBase(gregMapGregoBaseHeaderFields(g), picked), {deferRender: true});
    gregGst('Aus GregoBase geladen: "' + picked.title + '" (' + picked.source + ', #' + picked.id + ') — bitte trotzdem gegenprüfen.');
    return true;
  } catch (e) {
    console.warn('GregoBase-Suche fehlgeschlagen (fahre mit der Erkennung fort):', e.message);
    return false;
  }
}

// Einstieg aus gregLoadPDF (API-Key vorhanden, kein eingebettetes GABC)
async function pgPdfLesenNeu(pdfDoc, apiKey) {
  const t0 = Date.now();
  const pages = Math.min(pdfDoc.numPages, PG_MAX_PAGES);
  if (pdfDoc.numPages > PG_MAX_PAGES) gregGst('PDF hat ' + pdfDoc.numPages + ' Seiten — nur die ersten ' + PG_MAX_PAGES + ' werden gelesen.');
  const items = []; let usd = 0;
  for (let pg = 1; pg <= pages; pg++) {
    gregGst('PDF lesen: Seite ' + pg + '/' + pages + ' – Notenlinien und Noten…');
    await new Promise(r => setTimeout(r, 30));                       // Statuszeile zeichnen lassen
    const full = await pgRenderPageGray(pdfDoc, pg);
    // Doppelseite: jede Spalte für sich lesen (Build 416), links vor rechts
    const split = pgColumnSplit(full), cols = split ? [pgCropGray(full, 0, split), pgCropGray(full, split, full.w)] : [full];
    for (const img of cols) {
      const page = pgAnalysePage(img);
      console.log('PDF lesen (neu), Seite ' + pg + (split ? ' (Spalte ' + (img === cols[0] ? 1 : 2) + ')' : '') + ': ' + page.staves.length + ' Systeme, Schräge ' + page.angle.toFixed(2) + '°, Linienabstand ' + page.gap + ' px, Schwelle ' + page.thr);
      if (!page.staves.length) continue;
      gregGst('PDF lesen: Seite ' + pg + '/' + pages + ' – Text lesen (KI)…');
      const strips = pgStripsImage(page);
      const res = await pgReadText(apiKey, strips.b64, strips.n);
      usd += res.usage.usd;
      console.log('PDF lesen (neu), Seite ' + pg + ': KI ' + res.usage.input + '/' + res.usage.output + ' Token, ' + res.usage.usd.toFixed(4) + ' USD', res.lines);
      pgRepairMerged(res.lines, page.staves);
      page.staves.forEach((st, k) => items.push({page: pg, staff: st, text: pgSafeText(res.lines[k]), mode: res.modes[k + 1] || ''}));
      page.img = null;
    }
  }
  if (!items.length) { gregGst('Keine Notensysteme gefunden (Notenlinien nicht erkannt).'); return; }
  const pieces = pgPieces(items);
  // Für Diagnose und den Messlauf (tests/pdf-lesen/run-neu-playwright.js): Ergebnis je Stück und System
  window._pgLetzteErkennung = {usd, pieces: pieces.map(p => ({incipit: p.incipit, mode: p.mode, clef: p.clef, hasDropCap: p.hasDropCap,
    systems: p.items.map(it => pgStaffGabc(it.staff, it.text) || '')}))};
  let choice = pieces[0].index;
  if (pieces.length > 1) {
    choice = await gregPickPieceModal(pieces);
    if (choice == null) { gregGst('Abgebrochen.'); return; }
  }
  const chosen = choice === 'ALL' || choice === 'MERGE' ? pieces : [pieces.find(p => p.index === choice) || pieces[0]];
  const target = await gregImportTargetChoice();
  if (!target) { gregGst('Abgebrochen.'); return; }
  if (target === 'new' && !(await ntConfirmDiscard())) { gregGst('Abgebrochen.'); return; }
  if (target === 'new') gregCollapseSections();
  const previousEntries = gregEntries;
  let gabc = null, loaded = 0;
  if (choice === 'MERGE') {
    gabc = pgGabcHeader(pieces[0]) + chosen.map(p => pgPieceGabc(p, false)).join('\n');
    gregImportGABCString(gabc, {deferRender: true}); loaded = 1;
  } else {
    for (const p of chosen) {
      if (loaded > 0) gregAddSection();
      const gb = await pgTryGregoBase(p);
      if (gb === 'cancel') { gregGst('Abgebrochen.'); if (!loaded) { gregEntries = previousEntries; } break; }
      if (!gb) gregImportGABCString(pgPieceGabc(p, true), {deferRender: true});
      loaded++;
      if (gregEntries.length > 200 && !(await gregConfirmModal('⚠️ Ungewöhnlich viele Einträge', 'Das Ergebnis hat ' + gregEntries.length + ' Einträge — ungewöhnlich viel für ein Stück. Trotzdem laden?'))) {
        gregEntries = previousEntries; gregGst('Abgebrochen.'); return;
      }
    }
  }
  if (!loaded) return;
  if (typeof clState !== 'undefined' && typeof ntResetOrganForImport === 'function') ntResetOrganForImport();
  gregRefreshListNoRender();
  gregRender();
  if (target === 'new') { gregLibCurrentId = null; setTimeout(() => ntMarkClean(), 50); }
  gregGst('PDF lesen: ' + loaded + ' Stück(e), ' + items.length + ' Systeme, ' + Math.round((Date.now() - t0) / 1000) + ' s, ca. ' + usd.toFixed(3) +
    ' USD. Neumenformen (Quilisma, Liqueszenz …) fehlen noch — bitte mit dem Original vergleichen.');
}
