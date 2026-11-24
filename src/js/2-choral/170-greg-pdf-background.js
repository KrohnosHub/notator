// ── «PDF lesen»: PDF laden, Dialoge, GregoBase ──────────────────────
// Seit Build 410 gibt es nur noch die neue Erkennung (174-pdf-lesen-neu.js: Geometrie aus 172-pdf-geometrie.js
// und ein KI-Aufruf je Seite für den Text). Der frühere Weg (Vision-KI liest GABC je System, OMR-Korrektur)
// ist entfernt; er steht im Git-Verlauf (bis Build 409).
let _gregPdfDoc = null, _gregPdfPage = 1;

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

    // PDF mit eingebettetem GABC-Text (z. B. aus Notator oder Gregorio exportiert): direkt übernehmen
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

    const apiKey = (document.getElementById('greg-api-key') || {value: ''}).value.trim() || ntApiKeySaved();
    ntApiKeyChanged();                                            // «merken» angehakt: aktuellen Key speichern
    if (!apiKey) {
      gregPdfReadRow(true);
      gregGst('Bitte API-Key eingeben (Feld «API-Key» unter der Werkzeugleiste) und das PDF nochmals wählen');
      return;
    }
    await gregRenderPDFPage(1);                                   // Original-Panel zeigt die erste Seite
    await pgPdfLesenNeu(_gregPdfDoc, apiKey);
    if (gregIsMobileViewport() && window._gregMode !== 'edit') gregSetMode('edit');
  } catch (e) {
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

