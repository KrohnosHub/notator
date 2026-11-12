// ── Verknüpfung zur Notenbibliothek (NOH) je Stück ──
// Lädt bei Bedarf die Daten der Notenbibliothek (noh/index.html: Orgelsätze,
// noh/choral.js: Choralbücher mit Zuordnung zu den Orgelsätzen) und sucht
// zum offenen Stück (je Abschnitt) passende Einträge über den Textanfang,
// bei mehrdeutigen Titeln zusätzlich über die Gattung (GregoBase office-part).
let _ntNohData = null;
function ntNohLoad() {
  if (_ntNohData) return _ntNohData;
  const get = (src, name) => { const m = src.match(new RegExp('^const ' + name + '\\s*=(.*)$', 'm')); return m ? JSON.parse(m[1].replace(/\/\*[^*]*\*\//g, '').trim().replace(/;$/, '')) : null; };
  _ntNohData = Promise.all([fetch(NT_NOH_URL + 'index.html').then(r => r.ok ? r.text() : ''), fetch(NT_NOH_URL + 'choral.js').then(r => r.ok ? r.text() : '')]).then(([h, c]) => {
    const d = { NOH: get(h, 'NOH') || [], FILES: get(h, 'NOH_FILES') || {}, BANDS: get(h, 'NOH_BANDS') || {}, CH: get(c, 'CHORAL') || [], CS: get(c, 'CHORAL_SRC') || {} };
    d.idx = {}; d.NOH.forEach((e, i) => { d.idx[e[0]] = i; });
    d.chN = d.CH.map(x => ntNohNorm(String(x[2]).split('.')[0]));
    d.nohN = d.NOH.map(e => ntNohNorm(e[1]));
    return d;
  }).catch(e => { _ntNohData = null; throw e; });
  return _ntNohData;
}
const ntNohNorm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/æ|œ|ae|oe/g, 'e').replace(/j/g, 'i').replace(/v/g, 'u').replace(/y/g, 'i').replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();
const NT_NOH_PART = { introitus: 'Introitus', graduale: 'Graduale', alleluia: 'Alleluia', alleluja: 'Alleluia', tractus: 'Tractus', sequentia: 'Sequenz', offertorium: 'Offertorium', communio: 'Communio', responsorium: 'Responsorium', antiphona: 'Antiphon', hymnus: 'Hymnus' };
function ntNohMatches(d, gabc, title) {
  const hdr = gabc.indexOf('%%') >= 0 ? gabc.slice(0, gabc.indexOf('%%')) : '';
  const body = gabc.indexOf('%%') >= 0 ? gabc.slice(gabc.indexOf('%%') + 2) : gabc;
  const txt = ntNohNorm(body.replace(/\([^)]*\)/g, '').replace(/<[^>]+>/g, '').replace(/[*{}]/g, ' ')).split(' ').slice(0, 10).join(' ');
  const part = NT_NOH_PART[ntNohNorm((/(^|\n)\s*office-part\s*:\s*([^;\n]*)/i.exec(hdr) || [])[2] || '')] || '';
  const tN = ntNohNorm(title);
  const pre = (a, b) => a && b && (a === b || a.startsWith(b + ' '));
  let ch = [];
  d.CH.forEach((x, j) => {
    const inc = d.chN[j]; if (!inc) return;
    if (pre(txt, inc) || (inc.split(' ').length >= 2 && pre(inc, txt)) || pre(tN, inc)) ch.push(j);
  });
  if (part && ch.some(j => d.CH[j][1] === part)) ch = ch.filter(j => d.CH[j][1] === part);
  const org = new Set();
  ch.forEach(j => { (d.CH[j][3] || []).forEach(n => org.add(n)); });
  if (!ch.length && txt.split(' ').length >= 3) {
    d.NOH.forEach((e, i) => { const n = d.nohN[i]; if (n.split(' ').length >= 3 && (pre(txt, n) || pre(n, txt.split(' ').slice(0, 4).join(' ')))) org.add(e[0]); });
  }
  return { ch: ch.slice(0, 4), org: [...org].slice(0, 6), q: (title || body.replace(/\([^)]*\)/g, '').trim().split(/\s+/).slice(0, 3).join(' ')).trim() };
}
function ntUpdateNohLinks() {
  const els = document.querySelectorAll('.nt-noh-piece');
  let list = []; try { list = clCollectGabc(); } catch (e) {}
  if (!list.length || !clHasNotes(list)) { els.forEach(a => a.style.display = 'none'); return Promise.resolve(); }
  return ntNohLoad().then(d => {
    const res = list.map(x => ntNohMatches(d, x.gabc, x.title));
    window._ntNohRes = { d, res, list };
    const any = res.some(m => m.ch.length || m.org.length);
    els.forEach(a => { a.style.display = any ? '' : 'none'; });
  }).catch(() => els.forEach(a => a.style.display = 'none'));
}
function ntNohPieceClick(ev, a) {
  ev.preventDefault(); ev.stopPropagation();
  const old = document.getElementById('nt-noh-menu'); if (old) { const same = old._a === a; old.remove(); if (same) return false; }
  const R = window._ntNohRes; if (!R) return false;
  const { d, res, list } = R;
  const m = document.createElement('div'); m.id = 'nt-noh-menu'; m._a = a;
  m.style.cssText = 'position:fixed;z-index:10050;background:#142010;border:1px solid #6a8a50;border-radius:4px;box-shadow:0 4px 14px rgba(0,0,0,.5);padding:4px 0;font-size:12px;max-width:min(94vw,420px);max-height:70vh;overflow:auto';
  const esc = ntEscAttr;
  const link = (href, label, sub) => '<a href="' + esc(href) + '" target="_blank" rel="noopener" style="display:block;padding:5px 10px;color:#9cc8ff;text-decoration:none">' + label + (sub ? '<br><span style="color:#8aa070;font-size:10px">' + esc(sub) + '</span>' : '') + '</a>';
  const head = t => '<div style="padding:5px 10px 2px;color:#e0c070;font-weight:bold;font-size:11px">' + esc(t) + '</div>';
  let h = '';
  res.forEach((r, k) => {
    if (!r.ch.length && !r.org.length) return;
    if (list.length > 1) h += head('Abschnitt ' + (k + 1) + (list[k].title ? ' – ' + list[k].title.slice(0, 40) : ''));
    r.org.forEach(n => { const i = d.idx[n]; if (i == null) return; const e = d.NOH[i]; const fid = d.FILES[e[0]] || d.BANDS[e[2]];
      h += link('https://drive.google.com/file/d/' + fid + '/view', '🎹 Orgelsatz NOH Nr. ' + e[0], e[1] + ' · Band ' + e[2]); });
    r.ch.forEach(j => { const c = d.CH[j];
      ['1961', '1955', '1926'].forEach(b => { const s = c[4] && c[4][b]; if (!s) return; const p = s[1][0]; if (!p) return;
        const up = [...new Set(s[1].map(x => x[1]))];
        const f = b === '1961' ? 'choral/1961/GR1961_p' + String(p[1]).padStart(4, '0') + '.pdf' : 'choral/' + b + '/' + s[2] + '#page=' + (up.indexOf(p[1]) + 1);
        h += link(NT_NOH_URL + f, '📜 Choral ' + (b === '1961' ? 'Graduale Romanum 1961' : (d.CS[b] ? d.CS[b].v : b)) + ', S. ' + p[0], c[2] + ' · ' + c[1] + (p[2] ? ' · ' + p[2] : '')); }); });
    h += link(NT_NOH_URL + '#q=' + encodeURIComponent(r.q), '🔎 In der Notenbibliothek suchen', '«' + r.q + '»');
  });
  m.innerHTML = h || '<div style="padding:6px 10px;color:#8aa070">Keine Einträge gefunden.</div>';
  document.body.appendChild(m);
  const rc = a.getBoundingClientRect();
  m.style.top = Math.round(rc.bottom + 3) + 'px';
  m.style.left = Math.round(Math.max(4, Math.min(window.innerWidth - m.offsetWidth - 4, rc.left))) + 'px';
  m.querySelectorAll('a').forEach(x => x.addEventListener('click', () => setTimeout(() => m.remove(), 0)));
  setTimeout(() => { const close = e => { if (!m.contains(e.target) && e.target !== a) { m.remove(); document.removeEventListener('pointerdown', close, true); } }; document.addEventListener('pointerdown', close, true); }, 0);
  return false;
}

// Ältere GregoBase-Importe (vor Build 284) haben die Nummer noch nicht: am
// GregoBase-Kopf (transcriber/office-part/book …) erkennen und die Nummer im
// Hintergrund ermitteln – Kandidaten mit gleichem Titelanfang laden und die
// Tonfolge vergleichen. Treffer wird ins Stück übernommen (Kopffeld).
let _ntGbResolveKey = null;
function ntGbPitchSig(gabc) {
  const body = String(gabc || '').split('%%').pop();
  let sig = '';
  (body.match(/\(([^)]*)\)/g) || []).forEach(g => { if (/^\([cf]b?[1-5]/.test(g)) return; sig += g.slice(1, -1).replace(/\[[^\]]*\]/g, '').replace(/[^a-mA-M]/g, '').toLowerCase(); });
  return sig;
}
async function ntGbResolve() {
  if (gregGbIds().length || location.protocol === 'file:') return;
  const hx = typeof gregHdrExtra !== 'undefined' ? gregHdrExtra : '';
  if (!/(^|\n)\s*(transcriber|office-part|book)\s*:/i.test(hx)) return;
  const mySig = ntGbPitchSig(gregBuildGABC());
  if (mySig.length < 6) return;
  const key = mySig.slice(0, 80);
  if (_ntGbResolveKey === key) return;
  _ntGbResolveKey = key;
  // Titelanfang: erstes Wort des Textes (GregoBase-Titel = Textanfang)
  const firstSyl = (gregEntries.find(e => e.type === 'note' && e.syllable) || {}).syllable || '';
  let word = '';
  for (const e of gregEntries) { if (e.type !== 'note' || !e.syllable) continue; word += e.syllable; if (e.wordEnd !== false) break; }
  word = (word || firstSyl).replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (!word) return;
  let matches = [];
  try { matches = await gregSearchGregoBase(word, {}); } catch (e) { return; }
  const want = (/(^|\n)\s*office-part\s*:\s*([^;\n]*)/i.exec(hx) || [])[2];
  let best = null;
  for (const m of matches.slice(0, 40)) {
    const info = await gregGbInfo(m.id);
    if (!info || !info._gabc) continue;
    if (want && info['office-part'] && info['office-part'].trim().toLowerCase() !== want.trim().toLowerCase()) continue;
    const sig = ntGbPitchSig(info._gabc);
    let k = 0; const n = Math.min(sig.length, mySig.length, 120);
    while (k < n && sig[k] === mySig[k]) k++;
    const score = k / Math.max(1, Math.min(n, 120));
    if (score >= 0.95 && (!best || score > best.score)) best = { id: m.id, score };
    if (best && best.score === 1) break;
  }
  if (!best || gregGbIds().length) return;
  gregHdrExtra = (gregHdrExtra ? gregHdrExtra + '\n' : '') + 'notator-gregobase: ' + best.id + ';';
  if (typeof gregAutosaveNow === 'function') try { gregAutosaveNow(); } catch (e) {}
  ntUpdateGbLinks();
  gregGst('GregoBase-Herkunft erkannt: #' + best.id + ' (Link oben neben dem Titel; wird beim nächsten Speichern im Stück abgelegt)');
}
function ntUpdateGbLinks() {
  clearTimeout(window._ntNohT); window._ntNohT = setTimeout(() => { ntUpdateNohLinks().catch(() => {}); }, 600);
  try { if (typeof ntPlaySecUi === 'function') ntPlaySecUi(); } catch (e) {}
  const ids = gregGbIds();
  if (!ids.length) { clearTimeout(window._ntGbResT); window._ntGbResT = setTimeout(() => { ntGbResolve().catch(() => {}); }, 1500); }
  document.querySelectorAll('.nt-gb-link').forEach(a => {
    if (!ids.length) { a.style.display = 'none'; return; }
    a.style.display = '';
    a.href = 'https://gregobase.selapa.net/chant.php?id=' + ids[0];
    a.textContent = '↗ GregoBase #' + ids[0] + (ids.length > 1 ? ' +' + (ids.length - 1) : '');
    a.textContent = ids.length > 1 ? '↗ GregoBase (' + ids.length + ') ▾' : a.textContent;
    a.title = ids.length > 1 ? 'Mehrere GregoBase-Stücke – klicken zur Auswahl' : 'In GregoBase öffnen (neuer Tab)';
  });
}

// Schritt 4: Bearbeiten/Ansicht-Umschalter für die Mobile-Ansicht — zeigt
// entweder die skalierte Notation (Ansicht) oder die Eingabespalte auf
// voller Breite (Bearbeiten: Neumen-Grid, Eintragsliste, GABC-Import,
// GregoBase, PDF-Lesen — dieselben Bedienelemente wie am PC, nur ohne
// Nebeneinander-Layout, das auf dem Handy keinen Platz hat).
// Modus: «view» (nur Noten) · «edit» (Noten + Werkzeugleiste) · «details»
// (zusätzlich Seitenleiste mit Stück/Einträge/GABC; Handy: statt der Noten)
function gregSetMode(mode) {
  const panel = document.getElementById('greg-panel'); if (!panel) return;
  const mob = gregIsMobileViewport();
  const wasView = panel.classList.contains('greg-view'), wasSide = !panel.classList.contains('greg-noside');
  panel.classList.toggle('greg-view', mode === 'view');
  panel.classList.toggle('greg-mobile-qb', mode !== 'view');
  panel.classList.toggle('greg-mobile-edit', mob && mode === 'details');
  panel.classList.toggle('greg-noside', !mob && mode === 'edit');
  document.querySelectorAll('#greg-mode .b').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
  window._gregMode = mode;
  if (mode === 'view' || (mob && mode === 'edit')) gregScheduleMobileScale();
  const sideNow = !panel.classList.contains('greg-noside') && mode !== 'view';
  if (!mob && (wasView !== (mode === 'view') || wasSide !== sideNow) && typeof gregRender === 'function') setTimeout(gregRender, 60);
  if (!mob) { try { localStorage.setItem('notatorGregMode', mode); localStorage.setItem('notatorGregView', mode === 'view' ? 'view' : 'edit'); } catch (e) {} }
  if (mode === 'view') { gregCloseEditForm && gregCloseEditForm(); }
  // Details öffnen: immer mit dem Reiter «Stück» beginnen
  if (mode === 'details' && window._gregLastMode !== 'details' && typeof gregSideTab === 'function') gregSideTab('piece');
  // Handy: in «Details» ist das Notenbild ausgeblendet – dort gesetzte Abschnitte haben keine
  // Breite (sehr schmaler Umbruch). Beim Zurückwechseln mit der richtigen Breite neu setzen.
  if (mob && window._gregLastMode === 'details' && mode !== 'details' && typeof gregRender === 'function') setTimeout(gregRender, 60);
  window._gregLastMode = mode;
}
function gregMobileSetEditMode(on) {
  if (!on) { gregSetMode('view'); return; }
  let m = 'edit'; if (!gregIsMobileViewport()) { try { m = localStorage.getItem('notatorGregMode') || 'details'; } catch (e) {} if (m === 'view') m = 'details'; }
  gregSetMode(m);
}
function gregMobileToggleEditMode() { gregSetMode((window._gregMode || 'view') === 'view' ? 'edit' : 'view'); }
function gregMobileDetails(on) { gregSetMode(on ? 'details' : 'edit'); }
function gregSideToggle(force) { const on = force !== undefined ? !!force : (window._gregMode !== 'edit'); gregSetMode(on ? 'edit' : 'details'); }
// Datei-Menü (Kopfleiste Choral und Orgel)
function ntFileMenu(btn) {
  const old = document.getElementById('nt-file-pop'); if (old) { old.remove(); return; }
  const d = document.createElement('div'); d.id = 'nt-file-pop';
  d.style.cssText = 'position:fixed;z-index:2600;background:#1a2414;border:1px solid #5a8a40;border-radius:4px;padding:6px;box-shadow:0 4px 14px rgba(0,0,0,.5);font:13px system-ui,sans-serif;display:flex;flex-direction:column;gap:3px;min-width:230px';
  const r = btn.getBoundingClientRect();
  d.style.top = (r.bottom + 4) + 'px'; d.style.left = Math.max(6, Math.min(r.left, window.innerWidth - 250)) + 'px';
  const toGreg = () => { if (window._ntTab && window._ntTab !== 'greg') switchTab('greg'); };
  const item = (label, title, fn) => { const b = document.createElement('button'); b.className = 'b'; b.textContent = label; b.title = title; b.style.cssText = 'text-align:left;font-size:13px;padding:6px 10px'; b.onclick = () => { d.remove(); fn(); }; d.appendChild(b); };
  const sep = () => { const h = document.createElement('div'); h.style.cssText = 'border-top:1px solid #3a4a30;margin:2px 0'; d.appendChild(h); };
  // aufklappbare Untergruppe (▸) – auf dem Handy ohne zweites Fenster
  const group = (label, title, build) => {
    const h = document.createElement('button'); h.className = 'b'; h.textContent = '▸ ' + label; h.title = title; h.style.cssText = 'text-align:left;font-size:13px;padding:6px 10px';
    const box = document.createElement('div'); box.style.cssText = 'display:none;flex-direction:column;gap:3px;padding-left:14px';
    h.onclick = () => { const open = box.style.display === 'none'; box.style.display = open ? 'flex' : 'none'; h.textContent = (open ? '▾ ' : '▸ ') + label; };
    d.appendChild(h); d.appendChild(box);
    const keep = d; build((l, t, fn) => { const b = document.createElement('button'); b.className = 'b'; b.textContent = l; b.title = t; b.style.cssText = 'text-align:left;font-size:13px;padding:6px 10px'; b.onclick = () => { keep.remove(); fn(); }; box.appendChild(b); });
  };
  const tab = window._ntTab === 'classic' ? 'cl' : 'greg';
  item('✚ Neues Stück', 'Neues, leeres Stück (bei ungespeicherten Änderungen wird nachgefragt)', () => ntNewPiece());
  item('📂 Öffnen · Bibliothek …', 'Stück aus der Bibliothek, einem Drive-Ordner oder vom Gerät öffnen', () => gregLibShowModal());
  item('💾 Speichern unter …', 'Unter neuem Namen speichern: als neues Stück in der Bibliothek, als .notator-Datei auf dem Gerät oder in einem Drive-Ordner (das Original bleibt unverändert)', () => ntNotatorSave());
  sep();
  group('📥 Importieren', 'Noten aus GregoBase, PDF, GABC oder einer anderen Notator-Datei übernehmen', add => {
    add('🎵 Aus GregoBase …', 'Nach Titel oder GregoBase-ID suchen und importieren', () => gregImportSongFromGregoBase());
    add('📄 PDF lesen (KI) …', 'Noten aus einem PDF per KI-Bilderkennung einlesen', () => { toGreg(); gregSetMode('details'); gregPdfReadRow(true); });
    add('✍ GABC einfügen …', 'GABC-Quelltext einfügen und importieren', () => { toGreg(); gregSetMode('details'); gregSideTab('gabc'); const pnl = document.getElementById('greg-gabc-import-panel'); if (pnl && pnl.style.display === 'none') gregToggleGABCImport(); });
    add('📎 Notator-Datei als Abschnitt einfügen …', 'Inhalt einer anderen Notator-Datei (Bibliothek, Gerät oder Drive) als neuen Abschnitt an dieses Stück anhängen', () => { toGreg(); ntInsertFileShow(); });
  });
  group('↓ Exportieren', 'PDF, GABC oder Teilen-Link', add => {
    add('↓ PDF …', 'Als PDF speichern (Gerät oder Google Drive)', () => ntPdfSave(tab));
    add('⬇ GABC-Datei', 'Choral als .gabc-Datei herunterladen (für Gregorio u.a.)', () => gregDownloadGABC());
    if (tab === 'cl' && typeof clExportMenu === 'function') add('⬇ Orgel: ABC / MusicXML …', 'Orgelfassung für andere Notenprogramme exportieren', () => clExportMenu(btn));
    add('🔗 Teilen …', 'Link zu Notator oder nur PDF', () => ntShareShow(tab));
  });
  sep();
  item('📑 Mappe …', 'Gottesdienst-Mappe: mehrere Stücke zu einem PDF', () => ntMappeShow());
  document.body.appendChild(d);
  const close = e => { if (!d.contains(e.target) && e.target !== btn && !btn.contains(e.target)) { d.remove(); document.removeEventListener('pointerdown', close, true); } };
  setTimeout(() => document.addEventListener('pointerdown', close, true), 0);
}
// «✚ Einfügen»: Assistenten, die das offene Stück bearbeiten (Bearbeiten-Leiste)
function ntInsertMenu(btn) {
  const old = document.getElementById('nt-ins-pop'); if (old) { old.remove(); return; }
  const d = document.createElement('div'); d.id = 'nt-ins-pop';
  d.style.cssText = 'position:fixed;z-index:2600;background:#1a2414;border:1px solid #5a8a40;border-radius:4px;padding:6px;box-shadow:0 4px 14px rgba(0,0,0,.5);font:13px system-ui,sans-serif;display:flex;flex-direction:column;gap:3px;min-width:230px';
  const r = btn.getBoundingClientRect();
  d.style.top = Math.min(r.bottom + 4, window.innerHeight - 260) + 'px'; d.style.left = Math.max(6, Math.min(r.left, window.innerWidth - 250)) + 'px';
  const item = (label, title, fn) => { const b = document.createElement('button'); b.className = 'b'; b.textContent = label; b.title = title; b.style.cssText = 'text-align:left;font-size:13px;padding:6px 10px'; b.onclick = () => { d.remove(); if (window._ntTab !== 'greg') switchTab('greg'); fn(); }; d.appendChild(b); };
  item('♫ Psalmton-Assistent …', 'Psalmverse auf einen Psalmton setzen', () => ntPsalmToneShow());
  item('✝ Gloria Patri …', 'Ausgeschriebenes Gloria Patri (Introitus oder Psalmton) einfügen bzw. «E u o u a e» ersetzen', () => ntGloriaPatriShow());
  item('📜 Strophen …', 'Weitere Strophen: Text untereinander oder eigene Noten je Strophe', () => gregVersesShow());
  item('⇄ Strophen-Anordnung wechseln', 'Text untereinander ⇄ eigene Noten je Strophe', () => gregVersesSwitchLayout());
  item('📝 Text zuerst, Noten danach …', 'Text eingeben – jede gesetzte Neume bekommt die nächste Silbe', () => gregTextFirstShow());
  document.body.appendChild(d);
  const close = e => { if (!d.contains(e.target) && e.target !== btn && !btn.contains(e.target)) { d.remove(); document.removeEventListener('pointerdown', close, true); } };
  setTimeout(() => document.addEventListener('pointerdown', close, true), 0);
}
// Seitenleiste: Reiter «Stück» · «Einträge» · «GABC»; Eingabefelder für das
// Notensetzen liegen nur noch in der Werkzeugleiste (versteckt hier als Zustand)
function gregSideRestructure() {
  const P = document.getElementById('greg-input-panel'); if (!P || P._restructured) return;
  P._restructured = true;
  const kids = Array.from(P.children);
  const by = fn => kids.find(fn);
  const back = by(e => e.classList.contains('greg-details-back'));
  const undoRow = by(e => e.querySelector && e.querySelector('#greg-pdf-read-btn'));
  const pdfRow = document.getElementById('greg-pdf-read-row');
  const secRow = by(e => e.querySelector && e.querySelector('button[data-onclick="gregAddSection()"]'));
  const kopf = document.getElementById('greg-kopf-hdr').parentElement;
  const sizing = document.getElementById('greg-sizing-panel').parentElement;
  const neu = document.getElementById('greg-neume-sel').closest('#greg-input-panel > div');
  const divRow = by(e => e.querySelector && e.querySelector('button[data-onclick="gregAddDiv(\',\')"]'));
  const modRow = by(e => e.querySelector && e.querySelector('#greg-liquescent'));
  const entries = document.getElementById('greg-entries-wrap');
  const gabcOut = document.getElementById('greg-gabc-out').parentElement;
  const gabcImp = document.getElementById('greg-gabc-import-panel');
  const hidden = document.createElement('div'); hidden.id = 'greg-side-hidden';
  [undoRow, neu, divRow, modRow].forEach(e => e && hidden.appendChild(e));
  const tabs = document.createElement('div'); tabs.className = 'greg-side-tabs';
  const mkTab = (key, label) => { const b = document.createElement('button'); b.className = 'b'; b.dataset.tab = key; b.textContent = label; b.onclick = () => gregSideTab(key); tabs.appendChild(b); const c = document.createElement('div'); c.className = 'greg-side-tab'; c.dataset.tab = key; return c; };
  const tSt = mkTab('piece', 'Stück'), tEn = mkTab('entries', 'Einträge'), tGa = mkTab('gabc', 'GABC');
  // «Original» (PDF-Vorlage) bleibt im Reiter Stück erreichbar
  const orig = document.getElementById('greg-pdf-panel-toggle'); if (orig) { const w = document.createElement('div'); w.style.cssText = 'padding:4px 8px'; w.appendChild(orig); tSt.appendChild(w); }
  [kopf, sizing].forEach(e => e && tSt.appendChild(e));
  if (secRow) secRow.remove(); // «+ Abschnitt» steht jetzt in der Bearbeiten-Leiste (mehr ▾, neben «⏎ Linie»)
  tEn.appendChild(entries); entries.style.flex = '1';
  [gabcOut, gabcImp].forEach(e => e && tGa.appendChild(e));
  const gta = document.getElementById('greg-gabc-out'); if (gta) gta.style.height = '50vh';
  P.innerHTML = '';
  [back, pdfRow, tabs, tSt, tEn, tGa, hidden].forEach(e => e && P.appendChild(e));
  if (!P.style.width || P.style.width === '540px') P.style.width = '360px';
  let t = 'piece'; // Standard: immer «Stück»
  gregSideTab(t);
}
function gregSideTab(key) {
  document.querySelectorAll('.greg-side-tabs .b').forEach(b => b.classList.toggle('on', b.dataset.tab === key));
  document.querySelectorAll('.greg-side-tab').forEach(c => c.classList.toggle('on', c.dataset.tab === key));
  try { localStorage.setItem('notatorSideTab', key); } catch (e) {}
}
// Statuszeile rechts: Einträge · gespeichert/ungespeichert · Drive
function gregStatusRight() {
  const el = document.getElementById('greg-status-right'); if (!el) return;
  let n = 0; try { n = (window._gregMultiSection && typeof gregSections !== 'undefined' && gregSections.length > 1) ? gregSections.reduce((a, sec, i) => a + ((i === gregActiveIdx ? gregEntries : sec.entries) || []).length, 0) : gregEntries.length; } catch (e) { n = gregEntries.length; }
  let dirty = false; try { dirty = ntIsDirty(); } catch (e) {}
  let drive = ''; try { drive = gdConfigured() ? (gdHasToken() ? ' · ☁ Drive' : ' · ☁ nicht verbunden') : ''; } catch (e) {}
  el.innerHTML = n + ' Einträge · ' + (dirty ? '<span style="color:#e0b060">● ungespeichert</span>' : '<span style="color:#8bc070">✓ gespeichert</span>') + drive;
}
setInterval(gregStatusRight, 1500);
// Dateiname oben aktuell halten (Speichern, Speichern unter, Umbenennen, Öffnen)
setInterval(() => { try { window._ntFtTick = (window._ntFtTick || 0) + 1; ntFileTitleRefresh(window._ntFtTick % 4 === 0); } catch (e) {} }, 1500);
// Handy: Höhe des Notenbereichs nachführen (Abschnitte werden zeitversetzt gesetzt)
setInterval(() => { try { if (gregIsMobileViewport() && window._ntTab === 'greg') gregMobileApplyScale(); } catch (e) {} }, 1500);
function gregQbSignsToggle(force) {
  const qb = document.getElementById('greg-quickbar'); if (!qb) return;
  const on = force !== undefined ? !!force : !qb.classList.contains('signs-open'); qb.classList.toggle('signs-open', on);
  try { localStorage.setItem('notatorQbSigns', on ? '1' : '0'); } catch (e) {}
  const b = document.getElementById('greg-qb-signs-btn'); if (b) b.textContent = on ? 'Zeichen ▴' : 'Zeichen ▾';
}
// PC/Tablet: Seitenleiste ausblenden, Werkzeugleiste bleibt
function gregSideToggle(force) {
  const panel = document.getElementById('greg-panel'); if (!panel) return;
  const on = force !== undefined ? !!force : !panel.classList.contains('greg-noside');
  panel.classList.toggle('greg-noside', on);
  const b = document.getElementById('greg-qb-side-btn'); if (b) b.textContent = on ? '◧ Seitenleiste zeigen' : '◧ Seitenleiste';
  try { localStorage.setItem('notatorNoSide', on ? '1' : '0'); } catch (e) {}
  if (force === undefined) setTimeout(gregRender, 60);
}

function gregMobileInit() {
  const canvasWrap = document.getElementById('greg-canvas-wrap');
  if (canvasWrap && window.MutationObserver) {
    new MutationObserver(function(recs) {
      // eigene Grössenanpassung, Schatten, Werkzeugleiste: kein Neuberechnen nötig
      const sizer = document.getElementById('greg-mobile-scale-outer'), wrp = document.getElementById('greg-mobile-scale-wrap'), qb = document.getElementById('greg-quickbar');
      const relevant = recs.some(r => !(r.target === sizer || r.target === wrp || (qb && qb.contains(r.target)) || (r.target.closest && r.target.closest('#greg-ghost')) || (r.type === 'childList' && [...r.addedNodes, ...r.removedNodes].every(n => n.id === 'greg-ghost'))));
      if (!relevant) return;
      gregScheduleMobileScale();
      gregMobileSyncTitle();
    }).observe(canvasWrap, { childList: true, subtree: true, attributes: true });
  }
  const titleEl = document.getElementById('greg-title');
  if (titleEl) titleEl.addEventListener('input', gregMobileSyncTitle);
  window.addEventListener('resize', gregScheduleMobileScale);
  window.addEventListener('orientationchange', gregScheduleMobileScale);
  gregMobileSyncTitle();
  // Ansicht/Bearbeiten: Handy startet in der Anzeige, PC im zuletzt gewählten Modus (Standard: Bearbeiten)
  let gv = null; try { gv = localStorage.getItem('notatorGregView'); } catch (e) {}
  gregSideRestructure();
  if (gregIsMobileViewport()) gregSetMode('view');
  else { let m = null; try { m = localStorage.getItem('notatorGregMode'); } catch (e) {} gregSetMode(m || (gv === 'view' ? 'view' : 'details')); }
  try { if (localStorage.getItem('notatorQbSigns') === '1') gregQbSignsToggle(true); } catch (e) {}
  gregScheduleMobileScale();
  // Landet man auf dem Handy auf einer leeren Seite (kein Autosave aus
  // einer vorherigen Sitzung), gleich die Bibliotheksliste zeigen statt
  // eines leeren Editors — auf dem PC bleibt das Verhalten unverändert.
  // Nicht bei eingehendem Link (#song=… / #drive=… / #n=…): dort öffnet ntSongCheckIncoming das Stück.
  const incomingLink = /[#&](song|drive|n)=/.test(location.hash || '');
  if (gregIsMobileViewport() && gregEntries.length === 0 && !incomingLink) {
    setTimeout(function() {
      const open = document.getElementById('modal-bg') && document.getElementById('modal-bg').classList.contains('open');
      if (gregEntries.length === 0 && !open && !window._ntIncomingHandled) gregLibShowModal();
    }, 400);
  }
}

function gregToggleGABCImport() {
  const panel = document.getElementById('greg-gabc-import-panel');
  const visible = panel.style.display !== 'none';
  panel.style.display = visible ? 'none' : 'block';
  if (!visible) {
    const ta = document.getElementById('greg-gabc-import-in');
    ta.value = '';
    ta.focus();
  }
}

function gregImportFromPanel() {
  const ta = document.getElementById('greg-gabc-import-in');
  const code = ta.value.trim();
  if (!code) { gregGst('Kein GABC-Code eingegeben'); return; }
  try {
    gregImportGABCString(code);
    document.getElementById('greg-gabc-import-panel').style.display = 'none';
    ta.value = '';
    gregGst('GABC importiert — ' + gregEntries.length + ' Einträge');
    gregRefreshList();
  } catch(e) {
    gregGst('Import-Fehler: ' + e.message);
  }
}

// ── Drag resize ──────────────────────────────────────────────────
(function(){
  let dr=false,sx=0,sw=0;
  document.addEventListener('pointerdown',function(e){
    if(e.target.id!=='greg-drag-handle')return;
    dr=true;sx=e.clientX;sw=document.getElementById('greg-input-panel').offsetWidth;
    document.body.style.cursor='col-resize';document.body.style.userSelect='none';e.preventDefault();
  });
  document.addEventListener('pointermove',function(e){
    if(!dr)return;
    document.getElementById('greg-input-panel').style.width=Math.max(200,Math.min(sw+(e.clientX-sx),window.innerWidth-300))+'px';
    clearTimeout(window._gregDRT);window._gregDRT=setTimeout(gregRender,120);
  });
  const _up = function(){
    if(!dr)return;dr=false;document.body.style.cursor='';document.body.style.userSelect='';gregRender();
  };
  document.addEventListener('pointerup', _up);
  document.addEventListener('pointercancel', _up);
})();

// Runde 65: Ziehleiste für das neue Original-PDF-Seitenpanel (rechts) — analog
// zur bestehenden greg-drag-handle-Logik oben, nur mit umgekehrtem Vorzeichen
// (Panel liegt rechts von seiner Ziehleiste, nicht links).
(function(){
  let dr=false,sx=0,sw=0;
  document.addEventListener('pointerdown',function(e){
    if(e.target.id!=='greg-pdf-drag-handle')return;
    dr=true;sx=e.clientX;sw=document.getElementById('greg-pdf-panel').offsetWidth;
    document.body.style.cursor='col-resize';document.body.style.userSelect='none';e.preventDefault();
  });
  document.addEventListener('pointermove',function(e){
    if(!dr)return;
    document.getElementById('greg-pdf-panel').style.width=Math.max(200,Math.min(sw+(sx-e.clientX),window.innerWidth-400))+'px';
    if (_gregPdfDoc) { clearTimeout(window._gregPdfDRT); window._gregPdfDRT=setTimeout(()=>gregRenderPDFPage(_gregPdfPage),120); }
  });
  const _up = function(){
    if(!dr)return;dr=false;document.body.style.cursor='';document.body.style.userSelect='';
  };
  document.addEventListener('pointerup', _up);
  document.addEventListener('pointercancel', _up);
})();

// ── Init ─────────────────────────────────────────────────────────
setTimeout(function(){
  document.getElementById('greg-annotation')?.addEventListener('input',()=>{clearTimeout(window._gregAT);window._gregAT=setTimeout(gregRender,500);});
  document.getElementById('greg-title')?.addEventListener('input',()=>{clearTimeout(window._gregTT);window._gregTT=setTimeout(gregRender,500);});
  document.getElementById('greg-subtitle')?.addEventListener('input',()=>{clearTimeout(window._gregST);window._gregST=setTimeout(gregRender,500);});
  document.getElementById('greg-commentary')?.addEventListener('input',()=>{clearTimeout(window._gregST);window._gregST=setTimeout(gregRender,500);});
  document.getElementById('greg-dropcap-letter')?.addEventListener('keydown',e=>{if(e.key==='Enter')gregInsertDropCapLetter();});
  document.getElementById('greg-dropcap')?.addEventListener('change',gregRender);
  // Neume grid (visual picker)
  gregComfortApply();
  gregBuildNeumeGrid();
  gregUpdateMoraUI();
  ntPinchZoom('greg-canvas-wrap', 'greg-mobile-scale-outer', 'greg');
  ntPinchZoom('cl-score-wrap', 'cl-score', 'cl');
  // Bearbeitungsfenster folgt der Note beim Scrollen
  document.getElementById('greg-canvas-wrap')?.addEventListener('scroll', () => { gregEditPopPlace(); gregSylInlineClose(true); }, { passive: true });
  window.addEventListener('resize', () => gregEditPopPlace());
  const _restored = gregTryRestoreAutosave(); // before the initial render, so it renders the restored content (if any)
  try { ntInitDirtyTracking(_restored); } catch (e) { console.warn(e); }
  setTimeout(gregRender,200);
  setTimeout(() => { if (typeof ntShareCheckIncoming === 'function') ntShareCheckIncoming(); }, 900); // geteilter Link (#n=…)
  setTimeout(() => { if (typeof ntSongCheckIncoming === 'function') ntSongCheckIncoming(); }, 1000); // Titel-Link (#song=…)
  setTimeout(gregMobileInit,700); // nach Autosave-Restore + erstem Render
},500);
