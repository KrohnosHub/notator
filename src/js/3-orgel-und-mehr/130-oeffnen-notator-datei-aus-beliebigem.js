// ── Öffnen: .notator-Datei aus beliebigem Drive-Ordner ──
function ntDriveOpenBrowser(chain, pick) {
  showModal('☁ Aus Google Drive öffnen', 'Lade Ordner …', []);
  const body = document.getElementById('modal-body'), bEl = document.getElementById('modal-btns');
  bEl.style.flexDirection = ''; bEl.style.alignItems = '';
  bEl.innerHTML = '';
  const back = document.createElement('button'); back.className = 'b'; back.textContent = 'Zurück zur Bibliothek'; back.onclick = () => pick ? ntInsertFileShow() : gregLibShowModal();
  bEl.appendChild(back);
  const start = chain ? Promise.resolve(chain) : gdFolderChain(NOTATOR_GDRIVE_FOLDER_ID);
  start.then(ch => {
    const cur = ch[ch.length - 1];
    const q = encodeURIComponent("'" + cur.id + "' in parents and trashed = false and (mimeType = 'application/vnd.google-apps.folder' or name contains '.notator')");
    return gdFetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&orderBy=folder,name&pageSize=500&fields=files(id,name,mimeType,modifiedTime,appProperties)', {}, false)
      .then(r => r.json()).then(j => {
        body.innerHTML = '';
        const crumbs = document.createElement('div');
        crumbs.style.cssText = 'font-size:11px;margin-bottom:6px;display:flex;flex-wrap:wrap;gap:2px;align-items:center';
        ch.forEach((c, i) => {
          const a = document.createElement('a'); a.href = '#'; a.textContent = c.name;
          a.onclick = e => { e.preventDefault(); ntDriveOpenBrowser(ch.slice(0, i + 1), pick); };
          if (i) crumbs.appendChild(document.createTextNode(' › '));
          crumbs.appendChild(a);
        });
        body.appendChild(crumbs);
        const norm = x => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const files = (j.files || []).filter(f => f.mimeType === 'application/vnd.google-apps.folder' || /\.notator$/i.test(f.name));
        const inp = document.createElement('input'); inp.type = 'search'; inp.placeholder = '🔎 Suchen (in diesem Ordner und in ganz Drive) …';
        inp.style.cssText = 'width:100%;box-sizing:border-box;margin-bottom:6px;padding:6px 8px;font-size:14px;border:1px solid var(--parch3);border-radius:4px';
        body.appendChild(inp);
        const list = document.createElement('div');
        list.style.cssText = 'max-height:46vh;overflow-y:auto;border:1px solid var(--parch3);border-radius:4px';
        const open = f => { if (pick) { closeModal(); gdDownload(f.id, true).then(st => pick(st, gdTitleFromName(f.name))).catch(err => gregGst('Drive-Ladefehler: ' + err.message)); } else { closeModal(); gregLibLoadDrive(f); } };
        const mkRow = (f, extra) => {
          const isDir = f.mimeType === 'application/vnd.google-apps.folder';
          const b = document.createElement('button'); b.className = 'b';
          b.textContent = (isDir ? '📁 ' : '🎼 ') + (isDir ? f.name : gdTitleFromName(f.name)) + (isDir ? '' : '  —  ' + gregLibFormatDate(Date.parse(f.modifiedTime))) + (extra || '');
          b.style.cssText = 'display:block;width:100%;text-align:left;border:none;border-bottom:1px solid var(--parch3);border-radius:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
          b.onclick = isDir ? () => ntDriveOpenBrowser(ch.concat([{ id: f.id, name: f.name }]), pick) : () => open(f);
          return b;
        };
        const note = t => { const d = document.createElement('div'); d.style.cssText = 'font-size:11px;color:var(--ink2);padding:6px'; d.textContent = t; return d; };
        let seq = 0, timer = null;
        const render = () => {
          const q = norm(inp.value).trim(), words = q.split(/\s+/).filter(Boolean), my = ++seq;
          list.innerHTML = '';
          const shown = words.length ? files.filter(f => words.every(w => norm(f.name).includes(w))) : files;
          if (!shown.length && !words.length) list.appendChild(note('(keine Unterordner und keine .notator-Dateien)'));
          shown.forEach(f => list.appendChild(mkRow(f)));
          if (q.length >= 2) {
            const st = note('Suche in ganz Drive …'); list.appendChild(st);
            const w0 = words.map(w => "name contains '" + w.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'").join(' and ');
            gdFetch('https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(w0 + " and name contains '.notator' and trashed = false") + '&orderBy=name&pageSize=100&fields=files(id,name,mimeType,modifiedTime,appProperties)', {}, false)
              .then(r => r.json()).then(jj => {
                if (my !== seq) return; st.remove();
                const have = new Set(shown.map(f => f.id));
                const more = (jj.files || []).filter(f => !have.has(f.id) && /\.notator$/i.test(f.name));
                if (more.length) { const h = note('In anderen Ordnern gefunden:'); h.style.fontWeight = '600'; list.appendChild(h); more.forEach(f => list.appendChild(mkRow(f))); }
                else if (!shown.length) list.appendChild(note('Keine Treffer.'));
              }).catch(() => { if (my === seq) st.textContent = shown.length ? '' : 'Keine Treffer (Drive-Suche nicht möglich).'; });
          } else if (words.length && !shown.length) list.appendChild(note('Keine Treffer in diesem Ordner.'));
        };
        inp.oninput = () => { clearTimeout(timer); timer = setTimeout(render, 250); };
        render();
        body.appendChild(list);
      });
  }).catch(err => { body.textContent = 'Fehler: ' + err.message; });
}

function ntDriveFolderBrowser(ctx, chain) {
  const K = ntDestKeys(ctx);
  showModal(K.n ? '☁ Drive-Ordner für Notator-Dateien' : '☁ Drive-Ordner für PDFs', 'Lade Ordner …', []);
  const body = document.getElementById('modal-body'), bEl = document.getElementById('modal-btns');
  const start = chain ? Promise.resolve(chain)
    : ntPdfDriveFolderId(ctx).then(id => gdFolderChain(id));
  start.then(ch => {
    const cur = ch[ch.length - 1];
    const q = encodeURIComponent("'" + cur.id + "' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder'");
    return gdFetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&orderBy=name&pageSize=500&fields=files(id,name)', {}, false)
      .then(r => r.json()).then(j => {
        body.innerHTML = '';
        const crumbs = document.createElement('div');
        crumbs.style.cssText = 'font-size:11px;margin-bottom:6px;display:flex;flex-wrap:wrap;gap:2px;align-items:center';
        ch.forEach((c, i) => {
          const a = document.createElement('a'); a.href = '#'; a.textContent = c.name;
          a.onclick = e => { e.preventDefault(); ntDriveFolderBrowser(ctx, ch.slice(0, i + 1)); };
          if (i) crumbs.appendChild(document.createTextNode(' › '));
          crumbs.appendChild(a);
        });
        body.appendChild(crumbs);
        const list = document.createElement('div');
        list.style.cssText = 'max-height:45vh;overflow-y:auto;border:1px solid var(--parch3);border-radius:4px';
        if (!(j.files || []).length) list.innerHTML = '<div style="font-size:11px;color:var(--ink2);padding:6px">(keine Unterordner)</div>';
        (j.files || []).forEach(f => {
          const b = document.createElement('button'); b.className = 'b'; b.textContent = '📁 ' + f.name;
          b.style.cssText = 'display:block;width:100%;text-align:left;border:none;border-bottom:1px solid var(--parch3);border-radius:0';
          b.onclick = () => ntDriveFolderBrowser(ctx, ch.concat([{ id: f.id, name: f.name }]));
          list.appendChild(b);
        });
        body.appendChild(list);
        bEl.innerHTML = '';
        const mk = (t, fn, css) => { const b = document.createElement('button'); b.className = 'b'; b.textContent = t; b.onclick = fn; if (css) b.style.cssText = css; bEl.appendChild(b); };
        mk('✓ Diesen Ordner verwenden', () => {
          const p = ntPdfPrefs();
          p[K.folder] = { id: cur.id, path: ch.map(c => c.name).join(' › ') };
          ntPdfSavePrefs(p); ntPdfDialog(ctx);
        }, 'background:#3d6b35;color:#fff;border-color:#3d6b35');
        mk('+ Neuer Ordner', () => {
          const n = prompt('Name des neuen Ordners:'); if (!n || !n.trim()) return;
          gdFindOrCreateFolder(n.trim(), cur.id).then(id => ntDriveFolderBrowser(ctx, ch.concat([{ id, name: n.trim() }])))
            .catch(err => gregGst(err.message));
        });
        mk('Standard', () => { const p = ntPdfPrefs(); p[K.folder] = null; ntPdfSavePrefs(p); ntPdfDialog(ctx); });
        mk('Zurück', () => ntPdfDialog(ctx));
      });
  }).catch(err => { body.textContent = 'Fehler: ' + err.message; bEl.innerHTML = ''; const b = document.createElement('button'); b.className = 'b'; b.textContent = 'Zurück'; b.onclick = () => ntPdfDialog(ctx); bEl.appendChild(b); });
}

