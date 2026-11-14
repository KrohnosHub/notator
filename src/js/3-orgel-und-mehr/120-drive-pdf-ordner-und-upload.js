// ── Drive: PDF-Ordner und Upload ──
function gdFindOrCreateFolder(name, parentId) {
  const q = encodeURIComponent("'" + parentId + "' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder' and name = '" + name.replace(/'/g, "\\'") + "'");
  return gdFetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id,name)', {}, false)
    .then(r => r.json()).then(j => {
      if (j.files && j.files[0]) return j.files[0].id;
      return gdFetch('https://www.googleapis.com/drive/v3/files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }) }, false).then(r => r.json()).then(x => x.id);
    });
}
function gdFolderInfo(id) {
  return gdFetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) + '?fields=id,name,parents', {}, false).then(r => r.json());
}
// Pfad (Wurzel -> Ordner) als [{id,name}]
function gdFolderChain(id) {
  const chain = [];
  const step = (fid, n) => gdFolderInfo(fid).then(f => {
    const isRoot = !f.parents || !f.parents.length;
    chain.unshift({ id: f.id, name: isRoot ? 'Meine Ablage' : f.name });
    if (!isRoot && n < 12) return step(f.parents[0], n + 1);
  });
  return step(id, 0).then(() => chain).catch(() => chain.length ? chain : [{ id: id, name: '…' }]);
}
function ntPdfDriveFolderId(ctx) {
  const K = ntDestKeys(ctx);
  const f = ntPdfPrefs()[K.folder];
  const dflt = () => K.n ? Promise.resolve(NOTATOR_GDRIVE_FOLDER_ID) : gdFindOrCreateFolder(NT_PDF_DRIVE_DEFAULT_SUB, NOTATOR_GDRIVE_FOLDER_ID);
  if (f && f.id) {
    // Gewählten Ordner prüfen: gelöscht (Papierkorb) oder nicht mehr erreichbar
    // -> Upload würde unbemerkt im Papierkorb landen. Dann auf Standard zurück.
    return gdFetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(f.id) + '?fields=id,trashed', {}, false)
      .then(r => r.json())
      .catch(e => { const m = /Drive-Fehler (\d+)/.exec((e && e.message) || ''); return { error: { code: m ? +m[1] : 0 } }; })
      .then(j => {
        if (j && j.id && !j.trashed) return f.id;
        const gone = j && (j.trashed || (j.error && (j.error.code === 404 || j.error.code === 403)));
        if (!gone) return f.id; // Prüfung nicht möglich (Netz o.ä.) -> wie bisher versuchen
        const p = ntPdfPrefs(); p[K.folder] = null; ntPdfSavePrefs(p);
        ctx._folderFallback = (f.path || 'gewählter Ordner');
        return dflt();
      });
  }
  if (K.n) return Promise.resolve(NOTATOR_GDRIVE_FOLDER_ID);
  return gdFindOrCreateFolder(NT_PDF_DRIVE_DEFAULT_SUB, NOTATOR_GDRIVE_FOLDER_ID);
}
function gdUploadBlob(name, blob, mime, parentId, existingId, appProps) {
  const meta = existingId ? { name } : { name, parents: [parentId], mimeType: mime };
  if (appProps) meta.appProperties = appProps;
  const boundary = 'notatorpdf' + Date.now();
  const body = new Blob(['--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) +
    '\r\n--' + boundary + '\r\nContent-Type: ' + mime + '\r\n\r\n', blob, '\r\n--' + boundary + '--'], { type: 'multipart/related; boundary=' + boundary });
  const url = 'https://www.googleapis.com/upload/drive/v3/files' + (existingId ? '/' + encodeURIComponent(existingId) : '') + '?uploadType=multipart&fields=id,name,webViewLink';
  return gdFetch(url, { method: existingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body }, false).then(r => r.json());
}
function ntPdfToDrive(blob, name, ctx) {
  const K = ntDestKeys(ctx);
  const mime = K.n ? 'application/json' : 'application/pdf';
  const appProps = K.n ? ntMetaToAppProps(Object.assign(ntMetaNorm(gregMeta), { txt: ntCurrentIncipit() })) : null;
  gregGst(K.n ? 'Speichere in Google Drive …' : 'Lade PDF in Google Drive hoch …');
  return ntPdfDriveFolderId(ctx).then(folderId => {
    const q = encodeURIComponent("'" + folderId + "' in parents and trashed = false and name = '" + name.replace(/'/g, "\\'") + "'");
    return gdFetch('https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id,name)', {}, false).then(r => r.json()).then(j => {
      const same = (j.files || [])[0];
      let existing = null, finalName = name;
      if (same) {
        if (confirm('In diesem Drive-Ordner gibt es bereits "' + name + '". Überschreiben?\n(Abbrechen = als neue Datei mit Datum speichern)')) existing = same.id;
        else finalName = name.replace(/\.(pdf|notator)$/i, '') + ' (' + new Date().toLocaleString('de-CH').replace(/[\\/:*?"<>|]+/g, '-') + ')' + (K.n ? '.notator' : '.pdf');
      }
      return gdUploadBlob(finalName, blob, mime, folderId, existing, appProps).then(f => {
        // Nachprüfen: Datei wirklich im Zielordner, nicht im Papierkorb, Grösse stimmt
        if (!f || !f.id) throw new Error('Drive hat keine Datei-ID geliefert');
        return gdFetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(f.id) + '?fields=id,name,size,trashed,parents', {}, false).then(r => r.json()).then(m => {
          if (m.trashed) throw new Error('Datei liegt im Papierkorb');
          if (m.parents && m.parents.length && m.parents.indexOf(folderId) < 0) throw new Error('Datei liegt in einem anderen Ordner');
          if (m.size != null && Number(m.size) !== blob.size) throw new Error('Grösse in Drive (' + m.size + ' B) weicht ab (' + blob.size + ' B)');
          f.size = blob.size; return f;
        });
      });
    });
  }).then(f => {
    gregGst((K.n ? 'In Google Drive gespeichert und geprüft: ' : 'PDF in Google Drive gespeichert und geprüft: ') + f.name + ' (' + Math.round(f.size / 1024) + ' KB, ' + ntDrivePathText(ntPdfPrefs()[K.folder], K.n).replace(' (Standard)', '') + ')'
      + (ctx && ctx._folderFallback ? ' – Hinweis: «' + ctx._folderFallback + '» existiert nicht mehr, darum im Standardordner gespeichert.' : ''));
  }).catch(err => gregGst('Drive-Upload fehlgeschlagen: ' + err.message));
}

// Einfacher Ordner-Browser für Google Drive (ohne Google-Picker / API-Schlüssel)
// ── Öffnen: lokale Datei (mit Startordner, wo der Browser es kann) ──
function ntOpenLocalFile(_ok) {
  if (!_ok && ntIsDirty()) { ntConfirmDiscard().then(ok => { if (ok) ntOpenLocalFile(true); }); return; }
  if (window.showOpenFilePicker) {
    const opts = { id: 'notator-open', multiple: false, types: [{ description: 'Notator-Datei', accept: { 'application/json': ['.notator', '.json'] } }] };
    try { opts.startIn = _ntPdfLocalDir || 'documents'; } catch (e) {}
    window.showOpenFilePicker(opts).then(hs => hs[0].getFile()).then(f => {
      closeModal(); gregLoadPiece({ files: [f], value: '' });
    }).catch(err => { if (err && err.name !== 'AbortError') document.getElementById('greg-load-in').click(); });
  } else {
    closeModal();
    document.getElementById('greg-load-in').click();
  }
}

