// ── Speichern-Menü (in beiden Abschnitten gleich) ──
// «⋮ Mehr» oben rechts: administrative Funktionen (Version, Selbsttest, Aktualisieren)
function ntMoreMenu(btn) {
  const old = document.getElementById('nt-more-pop');
  if (old) { old.remove(); return; }
  const d = document.createElement('div');
  d.id = 'nt-more-pop';
  d.style.cssText = 'position:fixed;z-index:2600;background:#1a2414;border:1px solid #5a8a40;border-radius:3px;padding:6px;box-shadow:0 4px 14px rgba(0,0,0,.5);font:12px system-ui,sans-serif;display:flex;flex-direction:column;gap:4px;min-width:230px';
  const r = btn.getBoundingClientRect();
  d.style.top = (r.bottom + 4) + 'px';
  d.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
  const info = document.createElement('div');
  info.style.cssText = 'color:#c0d890;padding:2px 4px 6px;border-bottom:1px solid #3a4a30;line-height:1.5';
  const standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
  info.innerHTML = '<b>Notator</b> · Build ' + NOTATOR_BUILD_ID + '<br><span style="color:#8aa070;font-size:11px">' + (standalone ? 'als App installiert' : 'im Browser') + (navigator.onLine === false ? ' · offline' : '') + '</span>';
  d.appendChild(info);
  const item = (label, title, fn) => { const b = document.createElement('button'); b.className = 'b'; b.textContent = label; b.title = title; b.style.cssText = 'text-align:left;font-size:12px;padding:5px 8px';
    b.onclick = () => { d.remove(); fn(); }; d.appendChild(b); };
  item('↻ Nach neuer Version suchen', 'Prüft, ob eine neuere Notator-Version online ist', () => ntCheckForUpdateManual());
  item((gregComfortOn() ? '☑' : '☐') + ' Grosse Bedienelemente (Komfort)', 'Grössere Schrift, Felder und Kästchen im Choral-Editor', () => gregComfortToggle());
  item((gregAskSylOn() ? '☑' : '☐') + ' Silbe nach dem Setzen abfragen', 'Nach dem Setzen einer Neume ohne Silbe erscheint unter der Note ein Silbenfeld', () => { gregAskSylSet(!gregAskSylOn()); gregGst('Silbe nach dem Setzen abfragen: ' + (gregAskSylOn() ? 'an' : 'aus')); });
  item('⌨ Tastenkürzel', 'Übersicht der Tastenkürzel im Choral-Editor (PC/Tablet)', () => gregShortcutHelp());
  item('🧪 Selbsttest', 'Regressionstests (GABC-Import/-Export, Orgelfassung) – das offene Stück bleibt unverändert', () => { if (window._ntTab !== 'greg' && typeof switchTab === 'function') switchTab('greg'); gregSelfTest(); });
  document.body.appendChild(d);
  const close = e => { if (!d.contains(e.target) && e.target !== btn) { d.remove(); document.removeEventListener('pointerdown', close, true); } };
  setTimeout(() => document.addEventListener('pointerdown', close, true), 0);
}
function ntCheckForUpdateManual() {
  if (!/^https?:/.test(location.protocol)) { gregGst('Versionsprüfung nur online möglich.'); return; }
  fetch(location.pathname.replace(/[^/]*$/, '') + 'index.html', { cache: 'no-store' }).then(r => r.ok ? r.text() : '').then(t => {
    const m = /NOTATOR_BUILD_ID = '(\d+)'/.exec(t);
    if (m && +m[1] > +NOTATOR_BUILD_ID) ntCheckForUpdate();
    else alert('Notator ist aktuell (Build ' + NOTATOR_BUILD_ID + ').');
  }).catch(() => alert('Versionsprüfung nicht möglich (offline?).'));
}
function ntSaveMenu(btn) {
  const old = document.getElementById('nt-save-pop');
  if (old) { const same = old._btn === btn; old.remove(); if (same) return; }
  const d = document.createElement('div');
  d.id = 'nt-save-pop'; d._btn = btn;
  d.style.cssText = 'position:fixed;z-index:2600;background:#1a2414;border:1px solid #5a8a40;border-radius:3px;padding:6px;box-shadow:0 4px 14px rgba(0,0,0,.5);font:12px system-ui,sans-serif;display:flex;flex-direction:column;gap:4px;min-width:220px';
  const r = btn.getBoundingClientRect();
  d.style.top = Math.min(r.bottom + 4, window.innerHeight - 130) + 'px';
  d.style.left = Math.max(8, Math.min(r.right - 230, window.innerWidth - 238)) + 'px';
  const item = (label, title, fn) => { const b = document.createElement('button'); b.className = 'b'; b.textContent = label; b.title = title; b.style.cssText = 'text-align:left;font-size:12px;padding:5px 8px';
    b.onclick = () => { d.remove(); fn(); }; d.appendChild(b); };
  item('📚 In Bibliothek speichern', 'In die Bibliothek (Google Drive, Ordner Notator) – mit lokaler Kopie für offline', () => gregLibSaveCurrent());
  item('💾 Speichern unter …', 'Unter neuem Namen speichern: als neues Stück in der Bibliothek, als .notator-Datei auf dem Gerät oder in einem Drive-Ordner (das Original bleibt unverändert)', () => ntNotatorSave());
  item('🏷 Einordnen …', 'Kirchenjahr, Gattung und Tags für die Bibliothek', () => gregEditCurrentMeta());
  document.body.appendChild(d);
  const close = e => { if (!d.contains(e.target) && e.target !== btn && !btn.contains(e.target)) { d.remove(); document.removeEventListener('pointerdown', close); } };
  setTimeout(() => document.addEventListener('pointerdown', close), 0);
}
// Wird ein Stück geladen/importiert, während die Orgelansicht offen ist,
// diese gleich mitaktualisieren (Laden ist aus beiden Abschnitten möglich).
let _ntOrganRefreshT = null;
function ntRefreshOrganIfVisible() {
  if (window._ntTab !== 'editor' || window._ntMappeBusy || typeof clOpen !== 'function') return;
  clearTimeout(_ntOrganRefreshT);
  _ntOrganRefreshT = setTimeout(() => { if (window._ntTab === 'editor' && !window._ntMappeBusy) { clOpen(); } }, 250);
}

