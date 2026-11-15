// ── Titel / Untertitel der klassischen Fassung ─────────────────────
let _clHeadTimer = null;
function clHeadInput() {
  const ti = document.getElementById('cl-title'), su = document.getElementById('cl-subtitle');
  // Erste Änderung im Orgel-Tab koppelt die Fassung dauerhaft vom Choral ab.
  const c = clCfg(clSel);
  c.head = { title: ti ? ti.value : '', subtitle: su ? su.value : '' };
  if (clState[clMK()] && clSel === 0) clState[clMK()] = clApplyHeaderToAbc(clState[clMK()], c.head.title, c.head.subtitle);
  clSyncControls();
  clearTimeout(_clHeadTimer);
  _clHeadTimer = setTimeout(clRender, 300);
}
// Kopfzeile links/rechts: ab der ersten Änderung eigener Text (keine
// automatische Aktualisierung mehr, z.B. beim Transponieren).
function clSideInput() {
  const le = document.getElementById('cl-left'), ri = document.getElementById('cl-right');
  const c = clCfg(clSel);
  c.left = le ? le.value : '';
  c.right = ri ? ri.value : '';
  if (clState[clMK()] && clSel === 0) { const h = clEffectiveHead(0); clState[clMK()] = clApplyHeaderToAbc(clState[clMK()], h.title, h.subtitle, c.left, c.right); }
  clearTimeout(_clHeadTimer);
  _clHeadTimer = setTimeout(clRender, 300);
}

function clHeadFromChant() {
  if (!confirm('Titel, Untertitel und Kopfzeile wieder automatisch aus dem Choral übernehmen? Deine eigene Fassung wird dabei ersetzt.')) return;
  const c = clCfg(clSel);
  c.head = null; c.left = null; c.right = null;
  if (clState[clMK()] && clSel === 0) { const h = clChantHead(0); clState[clMK()] = clApplyHeaderToAbc(clState[clMK()], h.title, h.subtitle); }
  clRender();
}

function clToggleSource() {
  const p = document.getElementById('cl-src-panel');
  if (!p) return;
  const open = p.style.display === 'none';
  p.style.display = open ? 'flex' : 'none';
  setTimeout(clRender, 50);
}

function clApplySource() {
  const src = document.getElementById('cl-src');
  const msg = document.getElementById('cl-src-msg');
  if (!src || !window.ABCJS) return;
  clState[clMK()] = src.value;
  clRender();
  try {
    const tunes = ABCJS.parseOnly(src.value);
    const warn = [].concat(...tunes.map(t => t.warnings || []));
    if (msg) msg.textContent = warn.length ? warn.length + ' Hinweis(e): ' + String(warn[0]).replace(/<[^>]+>/g, '') : 'Übernommen.';
  } catch (e) { if (msg) msg.textContent = 'Fehler: ' + e.message; }
}

function clCurrentAbc() {
  return clState[clMK()] || (clLast && clLast.abc) || '';
}

// Grundname für Exporte (PDF, ABC, MusicXML, Teilen): Name der Notator-Datei
// (Bibliothekseintrag); sonst Titel des 1. Abschnitts bzw. des Stücks – nie der aktive Abschnitt
function ntFileBaseName() {
  let n = (window._ntFileTitle || '').trim();
  if (!n) { try { n = ntPieceTitle(gregBuildStateObject()); } catch (e) {} if (n === 'Unbenanntes Stück') n = ''; }
  if (!n && typeof clEffectiveHead === 'function') { try { n = (clEffectiveHead(0).title || '').trim(); } catch (e) {} }
  return (n || 'Stueck').replace(/\.(notator|pdf)$/i, '').replace(/[\\/:*?"<>|]+/g, '_');
}
function clFileBase() { return ntFileBaseName(); }

function clDownloadAbc() {
  const abc = clCurrentAbc();
  if (!abc) return;
  const blob = new Blob([abc], { type: 'text/vnd.abc;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = clFileBase() + '.abc'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Alte Akkord-Vorgaben (Schlüssel "Abschnitt:Nummer") auf Silbenanker umstellen
// Exporte für andere Notenprogramme (selten gebraucht -> ein Menü)
function clExportMenu(btn) {
  const old = document.getElementById('cl-export-pop');
  if (old) { old.remove(); return; }
  const d = document.createElement('div'); d.id = 'cl-export-pop';
  d.style.cssText = 'position:fixed;z-index:2600;background:#1a2414;border:1px solid #5a8a40;border-radius:3px;padding:6px;box-shadow:0 4px 14px rgba(0,0,0,.5);font:12px system-ui,sans-serif;display:flex;flex-direction:column;gap:4px;min-width:230px';
  const rc = btn.getBoundingClientRect();
  d.style.top = (rc.bottom + 4) + 'px'; d.style.left = Math.max(8, Math.min(rc.left, window.innerWidth - 246)) + 'px';
  const item = (label, title, fn) => { const b = document.createElement('button'); b.className = 'b'; b.textContent = label; b.title = title; b.style.cssText = 'text-align:left;font-size:12px;padding:5px 8px'; b.onclick = () => { d.remove(); fn(); }; d.appendChild(b); };
  item('↓ MusicXML (.musicxml)', 'MuseScore, Sibelius, Finale, Dorico …', () => clDownloadMusicXml());
  item('↓ ABC (.abc)', 'u.a. für MuseScore, EasyABC, abcjs', () => clDownloadAbc());
  document.body.appendChild(d);
  const close = e => { if (!d.contains(e.target) && e.target !== btn) { d.remove(); document.removeEventListener('pointerdown', close, true); } };
  setTimeout(() => document.addEventListener('pointerdown', close, true), 0);
}
function clMigrateOverrides(r) {
  const ov = clState.chordOverrides || {};
  if (!r || !r.models) return;
  const cur = new Set(), moved = new Set();
  r.models.forEach(m => (m.segs || []).forEach(sg => cur.add(sg.key)));
  r.models.forEach(m => (m.segs || []).forEach(sg => {
    if (ov[sg.key] != null) return;
    for (const k of (sg.legacyKeys || [])) if (ov[k] != null && k !== sg.key) { ov[sg.key] = ov[k]; moved.add(k); break; }
  }));
  moved.forEach(k => { if (!cur.has(k)) delete ov[k]; });
  Object.keys(ov).filter(k => /^\d+:\d+$/.test(k)).forEach(k => delete ov[k]);
}

