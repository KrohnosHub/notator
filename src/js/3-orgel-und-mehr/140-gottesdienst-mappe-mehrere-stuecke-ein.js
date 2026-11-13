// ── Gottesdienst-Mappe: mehrere Stücke -> ein PDF ───────────────────
// Eine Mappe = {title, subtitle, cover, newPage, items:[{ref:{src:'drive'|'local', id}, title, version}]}
// version: 'greg' (Choral) | 'cl' (Orgel) | 'clacc' (Orgel mit Begleitsatz)
// Erzeugung: jedes Stück wird kurz in den Editor geladen und mit den
// normalen PDF-Exporten gesetzt (Ergebnis wird nur eingesammelt), danach
// wird das ursprünglich offene Stück wiederhergestellt.
const NT_MAPPE_VERSIONS = { greg: 'Choral', cl: 'Orgel', clacc: 'Orgel + Begleitsatz' };
const NT_MAPPE_EXT = '.notatormappe';
function ntMappeCur() {
  let m = null; try { m = JSON.parse(localStorage.getItem('notatorMappeCur') || 'null'); } catch (e) {}
  return Object.assign({ title: '', subtitle: '', cover: true, newPage: true, items: [] }, m || {});
}
function ntMappeSetCur(m) { try { localStorage.setItem('notatorMappeCur', JSON.stringify(m)); } catch (e) {} }
function ntMappeLocalAll() { try { return JSON.parse(localStorage.getItem('notatorMappenLocal') || '{}') || {}; } catch (e) { return {}; } }

function ntMappeShow(opts) {
  opts = opts || {};
  const m = ntMappeCur();
  showModal('📑 Gottesdienst-Mappe', '', []);
  const body = document.getElementById('modal-body'), bEl = document.getElementById('modal-btns');
  bEl.style.flexDirection = ''; bEl.style.alignItems = '';
  const save = () => ntMappeSetCur(m);
  body.innerHTML =
    '<div style="display:flex;gap:6px;flex-wrap:wrap;font-size:12px">' +
    '<label style="flex:2 1 180px">Titel<br><input id="nt-mp-title" type="text" style="width:100%;box-sizing:border-box;font-size:13px;padding:3px" placeholder="z.B. Hochamt 12. Oktober" value="' + ntEscAttr(m.title) + '"></label>' +
    '<label style="flex:1 1 140px">Untertitel / Anlass<br><input id="nt-mp-sub" type="text" style="width:100%;box-sizing:border-box;font-size:13px;padding:3px" value="' + ntEscAttr(m.subtitle) + '"></label></div>' +
    '<div style="font-size:12px;margin:6px 0;display:flex;gap:12px;flex-wrap:wrap">' +
    '<label><input type="checkbox" id="nt-mp-cover"' + (m.cover ? ' checked' : '') + '> Deckblatt mit Inhalt</label>' +
    '<label><input type="checkbox" id="nt-mp-newpage"' + (m.newPage ? ' checked' : '') + '> Jedes Stück auf neuer Seite</label></div>' +
    '<div id="nt-mp-list" style="border:1px solid var(--parch3);border-radius:4px;padding:2px"></div>' +
    '<div id="nt-mp-add" style="margin-top:10px;border:1px solid var(--parch3);border-radius:4px;padding:4px">' +
    '<div style="font-size:12px;font-weight:bold;padding:2px 2px 4px;border-bottom:2px solid #3d6b35;margin-bottom:4px">➕ Stücke hinzufügen <span style="font-weight:normal;color:var(--ink2);font-size:11px">– grün = in der Mappe, nochmals tippen = entfernen</span></div>' +
    '<div id="nt-mp-add-body" style="font-size:11px;color:var(--ink2)">Lade Bibliothek …</div></div>';
  const bind = (id, key, prop) => { const el = document.getElementById(id); el.addEventListener(prop === 'checked' ? 'change' : 'input', () => { m[key] = el[prop]; save(); }); };
  bind('nt-mp-title', 'title', 'value'); bind('nt-mp-sub', 'subtitle', 'value');
  bind('nt-mp-cover', 'cover', 'checked'); bind('nt-mp-newpage', 'newPage', 'checked');
  const list = document.getElementById('nt-mp-list');
  // Gruppen: Choral | Orgel (inkl. Begleitsatz) – Reihenfolge je Gruppe, eigenes PDF je Gruppe
  const grpOf = it => it.version === 'greg' ? 'greg' : 'cl';
  const renderList = () => {
    list.innerHTML = '';
    if (!m.items.length) { list.innerHTML = '<div style="font-size:11px;color:var(--ink2);padding:6px">Noch keine Stücke – unten unter «Stücke hinzufügen» wählen.</div>'; return; }
    [['greg', '📜 Choral'], ['cl', '🎹 Orgel']].forEach(([g, label]) => {
      const idxs = m.items.map((it, i) => i).filter(i => grpOf(m.items[i]) === g);
      const h = document.createElement('div');
      h.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 4px 2px;font-size:12px;font-weight:bold;border-bottom:2px solid #3d6b35;margin-top:4px';
      const ht = document.createElement('span'); ht.style.flex = '1'; ht.textContent = label + ' (' + idxs.length + ')'; h.appendChild(ht);
      if (idxs.length) {
        const pb = document.createElement('button'); pb.className = 'b'; pb.textContent = '↓ PDF ' + (g === 'greg' ? 'Choral' : 'Orgel');
        pb.style.cssText = 'font-size:11px;padding:1px 7px;background:#3d6b35;color:#fff;border-color:#3d6b35';
        pb.onclick = () => { window._ntMappeFilter = g; ntPdfSave('mappe'); };
        h.appendChild(pb);
      }
      list.appendChild(h);
      if (!idxs.length) { const e = document.createElement('div'); e.style.cssText = 'font-size:11px;color:var(--ink2);padding:3px 6px'; e.textContent = '(keine)'; list.appendChild(e); return; }
      idxs.forEach((i, k) => {
        const it = m.items[i];
        const r = document.createElement('div');
        r.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;align-items:center;padding:3px 2px;border-bottom:1px solid var(--parch3)';
        const b = (t, fn, ttl, dis) => { const x = document.createElement('button'); x.className = 'b'; x.textContent = t; x.title = ttl || ''; x.disabled = !!dis; x.style.cssText = 'font-size:11px;padding:1px 5px'; x.onclick = fn; return x; };
        const swap = j => { const t = m.items[i]; m.items[i] = m.items[j]; m.items[j] = t; save(); renderList(); };
        // Titel vollständig (Umbruch); Bedienelemente rücken bei wenig Platz in eine zweite Zeile
        const t = document.createElement('span'); t.textContent = (k + 1) + '. ' + it.title + (it.ref.src === 'local' ? ' (nur lokal)' : '');
        t.style.cssText = 'flex:1 1 200px;font-size:12px;white-space:normal;overflow-wrap:anywhere;min-width:0';
        r.appendChild(t);
        const ctl = document.createElement('span'); ctl.style.cssText = 'display:flex;gap:3px;align-items:center;margin-left:auto';
        r.appendChild(ctl);
        ctl.appendChild(b('↑', () => swap(idxs[k - 1]), 'nach oben', k === 0));
        ctl.appendChild(b('↓', () => swap(idxs[k + 1]), 'nach unten', k === idxs.length - 1));
        const sel = document.createElement('select'); sel.className = 'b'; sel.style.cssText = 'font-size:11px';
        sel.innerHTML = Object.keys(NT_MAPPE_VERSIONS).map(v => '<option value="' + v + '"' + (v === it.version ? ' selected' : '') + '>' + NT_MAPPE_VERSIONS[v] + '</option>').join('');
        sel.onchange = () => { it.version = sel.value; save(); renderList(); if (renderAdd) renderAdd(); };
        ctl.appendChild(sel);
        ctl.appendChild(b('✕', () => { m.items.splice(i, 1); save(); renderList(); if (renderAdd) renderAdd(); }, 'aus der Mappe entfernen'));
        list.appendChild(r);
      });
    });
  };
  let renderAdd = null;
  renderList();
  // Stücke hinzufügen – im selben Fenster unter der Übersicht
  const addBody = document.getElementById('nt-mp-add-body');
  gregLibCollect(true).catch(() => gregLibCollect(false)).then(data => {
    if (!addBody.isConnected) return;
    addBody.innerHTML = ''; addBody.style.color = '';
    const fw = document.createElement('div'); addBody.appendChild(fw);
    const info = document.createElement('div'); info.style.cssText = 'font-size:11px;color:var(--ink2);margin:2px 0'; addBody.appendChild(info);
    const lib = document.createElement('div'); lib.style.cssText = 'max-height:50vh;overflow-y:auto'; addBody.appendChild(lib);
    const render = rebuild => {
      if (rebuild) { fw.innerHTML = ''; ntLibFilterBar(fw, data, render); }
      lib.innerHTML = '';
      info.textContent = data.mode !== 'drive' && data.driveOn ? 'Nicht mit Drive verbunden – nur lokale Stücke' : '';
      data.items.filter(it => ntLibMatches(it, _libFilter)).forEach(it => {
        const ref = it.kind === 'drive' ? { src: 'drive', id: it.file.id } : { src: 'local', id: it.id };
        const n = m.items.filter(x => x.ref.src === ref.src && x.ref.id === ref.id).length;
        const r = document.createElement('div'); r.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;align-items:center;padding:3px 0;border-bottom:1px solid var(--parch3)';
        const t = document.createElement('span'); t.style.cssText = 'flex:1 1 200px;font-size:12px;min-width:0;white-space:normal;overflow-wrap:anywhere';
        t.textContent = it.title + ([it.meta.genre, it.meta.season].filter(Boolean).length ? '  · ' + [it.meta.genre, it.meta.season].filter(Boolean).join(' · ') : '');
        if (n) { t.style.fontWeight = 'bold'; t.style.color = '#2a4a22'; }
        const ctl = document.createElement('span'); ctl.style.cssText = 'display:flex;gap:4px;margin-left:auto';
        // Knopf grün = diese Fassung ist in der Mappe; nochmals tippen = wieder entfernen
        const add = (v, label) => {
          const has = m.items.findIndex(x => x.ref.src === ref.src && x.ref.id === ref.id && x.version === v);
          const x = document.createElement('button'); x.className = 'b';
          x.textContent = (has >= 0 ? '✓ ' : '+ ') + label;
          x.title = has >= 0 ? NT_MAPPE_VERSIONS[v] + ' ist in der Mappe – tippen zum Entfernen' : 'Als ' + NT_MAPPE_VERSIONS[v] + ' hinzufügen';
          x.style.cssText = 'font-size:11px;padding:2px 6px' + (has >= 0 ? ';background:#3d6b35;color:#fff;border-color:#3d6b35;font-weight:bold' : '');
          x.onclick = () => {
            if (has >= 0) { m.items.splice(has, 1); gregGst('Entfernt: ' + it.title + ' (' + NT_MAPPE_VERSIONS[v] + ')'); }
            else { m.items.push({ ref, title: it.title, version: v }); gregGst('Zur Mappe hinzugefügt: ' + it.title + ' (' + NT_MAPPE_VERSIONS[v] + ')'); }
            save(); renderList(); render();
          };
          return x;
        };
        ctl.appendChild(add('greg', 'Choral')); ctl.appendChild(add('cl', 'Orgel')); ctl.appendChild(add('clacc', 'Begl.'));
        r.appendChild(t); r.appendChild(ctl);
        lib.appendChild(r);
      });
    };
    renderAdd = () => render(false);
    render(true);
    if (opts.focusAdd) document.getElementById('nt-mp-add').scrollIntoView({ block: 'start' });
  }).catch(err => { addBody.textContent = 'Bibliothek nicht ladbar: ' + err.message; });
  const mk = (t, fn, css, ttl) => { const x = document.createElement('button'); x.className = 'b'; x.textContent = t; if (css) x.style.cssText = css; if (ttl) x.title = ttl; x.onclick = fn; bEl.appendChild(x); return x; };
  mk('↓ PDF alle', () => {
    if (!m.items.length) { gregGst('Die Mappe ist leer.'); return; }
    window._ntMappeFilter = null; ntPdfSave('mappe');
  }, '', 'Ein PDF mit allen Stücken (Choral und Orgel) in der Reihenfolge der Mappe');
  mk('💾 Mappe speichern', () => ntMappeSaveAs());
  mk('📂 Mappen', () => ntMappeOpenList(), '', 'Gespeicherte Mappen öffnen');
  mk('Neu', () => { if (m.items.length && !confirm('Aktuelle Mappe leeren?')) return; ntMappeSetCur({ title: '', subtitle: '', cover: true, newPage: true, items: [] }); ntMappeShow(); });
  mk('← Bibliothek', () => gregLibShowModal());
  mk('Schliessen', () => closeModal());
}

// Früher eigenes Fenster; jetzt im Mappen-Fenster integriert
function ntMappePicker() { ntMappeShow({ focusAdd: true }); }

// Speichern: lokal immer, zusätzlich in Drive (Notator › Mappen), wenn angemeldet
function ntMappeSaveAs() {
  const m = ntMappeCur();
  const name = (prompt('Name der Mappe:', m.title || 'Mappe') || '').trim();
  if (!name) return;
  if (!m.title) m.title = name;
  ntMappeSetCur(m);
  const all = ntMappeLocalAll(); all[name] = Object.assign({}, m, { savedAt: Date.now() });
  try { localStorage.setItem('notatorMappenLocal', JSON.stringify(all)); } catch (e) {}
  if (!gdConfigured()) { gregGst('Mappe "' + name + '" gespeichert (in diesem Browser).'); ntMappeShow(); return; }
  gdGetToken(true).then(() => gdFindOrCreateFolder('Mappen', NOTATOR_GDRIVE_FOLDER_ID)).then(fid => {
    const fname = name.replace(/[\\/:*?"<>|]+/g, '_') + NT_MAPPE_EXT;
    const q = encodeURIComponent("'" + fid + "' in parents and trashed = false and name = '" + fname.replace(/'/g, "\\'") + "'");
    return gdFetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id)', {}, false).then(r => r.json()).then(j => {
      const blob = new Blob([JSON.stringify(m, null, 2)], { type: 'application/json' });
      return gdUploadBlob(fname, blob, 'application/json', fid, (j.files || [])[0] && j.files[0].id);
    });
  }).then(() => { gregGst('Mappe "' + name + '" in Google Drive gespeichert (Notator › Mappen).'); ntMappeShow(); })
    .catch(err => { gregGst('Mappe lokal gespeichert, Drive: ' + err.message); ntMappeShow(); });
}

function ntMappeOpenList() {
  showModal('📂 Gespeicherte Mappen', 'Lade …', []);
  const body = document.getElementById('modal-body'), bEl = document.getElementById('modal-btns');
  const back = document.createElement('button'); back.className = 'b'; back.textContent = 'Zurück'; back.onclick = () => ntMappeShow(); bEl.appendChild(back);
  const local = ntMappeLocalAll();
  const open = mp => { ntMappeSetCur(Object.assign({ title: '', subtitle: '', cover: true, newPage: true, items: [] }, mp)); ntMappeShow(); };
  const show = driveFiles => {
    body.innerHTML = '';
    const names = {};
    (driveFiles || []).forEach(f => { names[f.name.replace(new RegExp(NT_MAPPE_EXT.replace('.', '\\.') + '$'), '')] = { f }; });
    Object.keys(local).forEach(n => { names[n] = Object.assign(names[n] || {}, { l: local[n] }); });
    const keys = Object.keys(names).sort((a, b) => a.localeCompare(b, 'de'));
    if (!keys.length) { body.innerHTML = '<p style="font-size:12px">Noch keine Mappen gespeichert.</p>'; return; }
    keys.forEach(n => {
      const e = names[n];
      const r = document.createElement('div'); r.style.cssText = 'display:flex;gap:4px;margin:2px 0';
      const ob = document.createElement('button'); ob.className = 'b'; ob.style.cssText = 'flex:1;text-align:left';
      ob.textContent = '📑 ' + n + (e.f ? '' : '  (nur in diesem Browser)');
      ob.onclick = () => {
        if (!e.f) { open(e.l); return; }
        gdFetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(e.f.id) + '?alt=media', {}, true).then(r => r.json()).then(open)
          .catch(err => { if (e.l) open(e.l); else gregGst('Mappe nicht ladbar: ' + err.message); });
      };
      const del = document.createElement('button'); del.className = 'b'; del.textContent = '🗑'; del.style.cssText = 'color:#c0605a;font-size:11px';
      del.onclick = () => {
        if (!confirm('Mappe "' + n + '" löschen?' + (e.f ? '\n(Drive: in den Papierkorb)' : ''))) return;
        const all = ntMappeLocalAll(); delete all[n]; try { localStorage.setItem('notatorMappenLocal', JSON.stringify(all)); } catch (x) {}
        (e.f ? gdTrash(e.f.id, true) : Promise.resolve()).then(() => ntMappeOpenList()).catch(err => gregGst(err.message));
      };
      r.appendChild(ob); r.appendChild(del); body.appendChild(r);
    });
  };
  if (gdConfigured() && gdHasToken()) {
    gdFindOrCreateFolder('Mappen', NOTATOR_GDRIVE_FOLDER_ID).then(fid => {
      const q = encodeURIComponent("'" + fid + "' in parents and trashed = false and name contains '" + NT_MAPPE_EXT + "'");
      return gdFetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id,name)', {}, false).then(r => r.json());
    }).then(j => show(j.files)).catch(() => show(null));
  } else show(null);
}

// Deckblatt als SVG (Breite = Satzspiegel, Höhe = 1 Seite)
function ntMappeCoverSvg(m) {
  const W = 746, H = 1075;
  const esc = clXmlEsc;
  let y = 330;
  let s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
    '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#fff" stroke="none"/>' +
    '<g font-family="Palatino Linotype, Palatino, Georgia, serif" fill="#000" stroke="none">' +
    '<text x="' + W / 2 + '" y="260" font-size="34" text-anchor="middle">' + esc(m.title || 'Mappe') + '</text>';
  if (m.subtitle) s += '<text x="' + W / 2 + '" y="300" font-size="18" font-style="italic" text-anchor="middle">' + esc(m.subtitle) + '</text>';
  s += '<line x1="' + (W / 2 - 120) + '" y1="' + y + '" x2="' + (W / 2 + 120) + '" y2="' + y + '" stroke="#000" stroke-width="0.8"/>';
  y += 60;
  s += '<text x="120" y="' + y + '" font-size="15" font-weight="bold">Inhalt</text>';
  s += '<text x="' + (W - 120) + '" y="' + y + '" font-size="11" font-style="italic" text-anchor="end">Seite</text>';
  y += 30;
  const rows = [];
  m.items.forEach((it, i) => {
    if (y > H - 40) return;
    s += '<text x="120" y="' + y + '" font-size="14">' + (i + 1) + '.  ' + esc(it.title) + '</text>' +
      '<text x="' + (W - 160) + '" y="' + y + '" font-size="11" font-style="italic" text-anchor="end">' + esc(NT_MAPPE_VERSIONS[it.version] || '') + '</text>';
    rows.push({ idx: i, x: W - 120, y }); // Seitenzahl wird beim Zusammensetzen des PDF ergänzt
    y += 24;
  });
  ntMappeCoverSvg._rows = rows;
  return s + '</g></svg>';
}

function ntMappeLoadState(ref) {
  if (ref.src === 'local') return gregLibGet(ref.id).then(rec => { if (!rec || !rec.state) throw new Error('lokales Stück nicht gefunden'); return rec.state; });
  const viaLocal = () => gregLibFindByDriveId(ref.id).then(rec => { if (!rec || !rec.state) throw new Error('Stück nicht in Drive erreichbar und keine lokale Kopie'); return rec.state; });
  if (!gdConfigured() || !gdHasToken()) return viaLocal();
  return gdDownload(ref.id, false).catch(viaLocal);
}

// Setzt alle Stücke und übergibt das fertige PDF an window._ntPdfDeliver
function ntMappeBuild() {
  const m0 = ntMappeCur(), flt = window._ntMappeFilter || null; window._ntMappeFilter = null;
  // Teil-Mappe: nur Choral bzw. nur Orgel (inkl. Begleitsatz); Titel bekommt den Zusatz
  const m = flt ? Object.assign({}, m0, { items: m0.items.filter(it => flt === 'greg' ? it.version === 'greg' : it.version !== 'greg'),
    subtitle: [m0.subtitle, flt === 'greg' ? 'Choral' : 'Orgel'].filter(Boolean).join(' · ') }) : m0;
  const deliver = window._ntPdfDeliver; window._ntPdfDeliver = null;
  const snapshot = gregBuildStateObject();
  const savedLibId = gregLibCurrentId, savedTab = window._ntTab || 'greg';
  const savedForced = window._gregForcedCanvasWidth;
  const allPairs = [];
  window._ntMappeBusy = true;
  const progress = t => { showModal('📑 Mappe wird erstellt', t, []); };
  const restore = () => {
    window._gregForcedCanvasWidth = savedForced;
    gregApplyLoadedState(snapshot);
    gregLibCurrentId = savedLibId;
    window._ntMappeBusy = false;
    switchTab(savedTab);
    if (typeof gregRefreshList === 'function') gregRefreshList();
    gregRender();
  };
  if (m.cover) allPairs.push({ svg: ntMappeCoverSvg(m), lineBoxes: [], pageBreakBefore: false, cover: true, tocRows: ntMappeCoverSvg._rows });
  let i = 0;
  const next = () => {
    if (i >= m.items.length) {
      restore(); closeModal();
      if (allPairs.length <= (m.cover ? 1 : 0)) { gregGst('Mappe: keine Stücke setzbar.'); return; }
      window._ntPdfDeliver = deliver;
      gregAssemblePdf(allPairs, (m.title || 'Mappe') + (flt === 'greg' ? '_Choral' : flt === 'cl' ? '_Orgel' : '') + '.pdf');
      return;
    }
    const it = m.items[i];
    progress('Stück ' + (i + 1) + ' von ' + m.items.length + ': ' + it.title + ' (' + NT_MAPPE_VERSIONS[it.version] + ') …');
    ntMappeLoadState(it.ref).then(state => new Promise((resolve, reject) => {
      gregApplyLoadedState(state);
      if (typeof gregRefreshList === 'function') gregRefreshList();
      const collect = pairs => {
        const firstPiece = !allPairs.some(x => !x.cover);
        const itemIdx = i;
        pairs.forEach((p, k) => allPairs.push(Object.assign({}, p, { itemIdx, pageBreakBefore: (k === 0 && (m.newPage || (m.cover && firstPiece))) || (k > 0 && !!p.pageBreakBefore) })));
        resolve();
      };
      if (it.version === 'greg') {
        switchTab('greg');
        window._gregForcedCanvasWidth = 900;
        setTimeout(() => { window._ntCollect = collect; try { gregExportPDF(); } catch (e) { window._ntCollect = null; reject(e); } }, 250);
      } else {
        clState.accomp = it.version === 'clacc';
        switchTab('editor');
        clEnsureAbcjs(() => setTimeout(() => {
          try { window._ntCollect = collect; ntViewScale._override = true; clState.width = clState.width || 740; clRender(); clExportPDF(); }
          catch (e) { window._ntCollect = null; reject(e); }
          finally { ntViewScale._override = false; }
        }, 200));
      }
      // Sicherheitsnetz, falls ein Export nichts liefert
      setTimeout(() => { if (window._ntCollect === collect) { window._ntCollect = null; reject(new Error('Zeitüberschreitung')); } }, 20000);
    })).then(() => { i++; next(); }).catch(err => {
      gregGst('Mappe: "' + it.title + '" übersprungen (' + err.message + ')');
      i++; next();
    });
  };
  next();
}



