// ── Notator-Datei als neuen Abschnitt (bzw. mehrere) an das offene Stück anhängen ──
function ntSectionsFromState(state) {
  const cp = o => JSON.parse(JSON.stringify(o));
  const fresh = () => 's' + Date.now() + Math.floor(Math.random() * 100000);
  if (state.multiSection && state.sections && state.sections.length) {
    return state.sections.map((sec, i) => Object.assign(cp(sec), { id: fresh() + '_' + i, sz: Object.assign({}, sec.sz || state.sz || gregSzRead()) }));
  }
  const n = gregMakeSection(fresh());
  n.entries = cp(state.entries || []);
  n.title = state.title || ''; n.subtitle = state.subtitle || ''; n.annotation = state.annotation || '';
  n.commentary = state.commentary || ''; n.hdrExtra = state.hdrExtra || ''; n.clefRaw = state.clefRaw || '';
  n.dropCap = state.dropCap !== false; n.dropCapLetter = state.dropCapLetter || '';
  n.initialLines = state.initialLines === 2 ? 2 : 1; n.clef = state.clef || 'do';
  n.sz = Object.assign({}, state.sz || gregSzRead());
  return [n];
}
function ntInsertState(state, label) {
  if (!state || (!state.entries && !state.sections)) { gregGst('Keine gültige Notator-Datei.'); return; }
  const secs = ntSectionsFromState(state);
  if (typeof gregFixDoubleAsterisk === 'function') secs.forEach(sc => gregFixDoubleAsterisk(sc.entries));
  gregPush();
  gregAddSection();                       // legt leeren neuen Abschnitt an (und schaltet ggf. auf Mehr-Abschnitt-Modus)
  { const w = document.getElementById('greg-svg-wrap'), os = document.getElementById('greg-svg-original-slot'); if (w && os && w.parentElement !== os) os.appendChild(w); } // Zeichenfläche nicht mit der Box des ersetzten leeren Abschnitts entfernen
  const at = gregSections.length - 1;     // der leere neue Abschnitt wird durch den Dateiinhalt ersetzt
  gregSections.splice(at, 1, ...secs);
  gregActiveIdx = at;
  gregLoadSectionToUI(at);
  gregRenderAllSections();
  gregGst('«' + label + '» als ' + (secs.length > 1 ? secs.length + ' Abschnitte' : 'Abschnitt ' + (at + 1)) + ' eingefügt.');
}
function ntInsertFileShow() {
  const driveOn = typeof gdConfigured === 'function' && gdConfigured();
  showModal('📎 Notator-Datei als Abschnitt einfügen', 'Der Inhalt wird als neuer Abschnitt am Ende des offenen Stücks angehängt. Die Quelldatei bleibt unverändert.', []);
  const body = document.getElementById('modal-body'), bEl = document.getElementById('modal-btns');
  bEl.style.flexDirection = ''; bEl.style.alignItems = '';
  bEl.innerHTML = '';
  const mk = (label, fn) => { const b = document.createElement('button'); b.className = 'b'; b.textContent = label; b.onclick = fn; bEl.appendChild(b); };
  mk('💻 Vom Gerät …', () => {
    const useState = (f) => f.text().then(t => { closeModal(); ntInsertState(JSON.parse(t), f.name.replace(/\.(notator|json)$/i, '')); }).catch(err => gregGst('Datei nicht lesbar: ' + err.message));
    if (window.showOpenFilePicker) {
      window.showOpenFilePicker({ multiple: false, types: [{ description: 'Notator-Datei', accept: { 'application/json': ['.notator', '.json'] } }] })
        .then(hs => hs[0].getFile()).then(useState).catch(err => { if (err && err.name !== 'AbortError') gregGst('Fehler: ' + err.message); });
    } else {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.notator,.json';
      inp.onchange = () => { if (inp.files[0]) useState(inp.files[0]); }; inp.click();
    }
  });
  if (driveOn) mk('☁ Aus Drive-Ordner …', () => gdGetToken(true).then(() => ntDriveOpenBrowser(null, (st, nm) => ntInsertState(st, nm))).catch(err => gregGst(err.message)));
  mk('Abbrechen', () => closeModal());
  body.innerHTML = '<input id="nt-ins-q" type="search" placeholder="Bibliothek durchsuchen …" style="width:100%;box-sizing:border-box;font-size:13px;padding:4px;margin-bottom:6px">' +
    '<div id="nt-ins-list" style="max-height:45vh;overflow-y:auto;border:1px solid var(--parch3);border-radius:4px"></div>';
  const list = document.getElementById('nt-ins-list'), q = document.getElementById('nt-ins-q');
  gregLibList().then(items => {
    const draw = () => {
      const f = q.value.trim().toLowerCase();
      list.innerHTML = '';
      const sel = items.filter(it => !f || String(it.title || '').toLowerCase().includes(f)).sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'de'));
      if (!sel.length) list.innerHTML = '<div style="font-size:11px;color:var(--ink2);padding:6px">(keine Treffer in der lokalen Bibliothek)</div>';
      sel.slice(0, 200).forEach(it => {
        const b = document.createElement('button'); b.className = 'b'; b.textContent = '🎼 ' + (it.title || '(ohne Titel)');
        b.style.cssText = 'display:block;width:100%;text-align:left;border:none;border-bottom:1px solid var(--parch3);border-radius:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
        b.onclick = () => gregLibGet(it.id).then(rec => { closeModal(); ntInsertState(rec && rec.state, it.title); }).catch(err => gregGst('Fehler: ' + err.message));
        list.appendChild(b);
      });
    };
    q.oninput = draw; draw();
  }).catch(err => { list.textContent = 'Fehler: ' + err.message; });
}

// Stück als Notator-Datei speichern: gleicher Dialog (Gerät oder Google Drive)
function ntNotatorSave() {
  const title = ntFileBaseName(); // Name der Notator-Datei, sonst Titel des 1. Abschnitts
  const p = ntPdfPrefs();
  ntLoadLocalDir().then(() => ntPdfDialog({ kind: 'notator', name: ntSanitizeName(title, '.notator'), dest: p.destNotator || 'lib' }));
}

function ntPdfDialog(ctx) {
  const pr = ntPdfPrefs();
  const K = ntDestKeys(ctx), ext = K.n ? '.notator' : '.pdf';
  const driveOn = typeof gdConfigured === 'function' && gdConfigured();
  if (!driveOn && ctx.dest === 'drive') ctx.dest = 'local';
  showModal(K.n ? '💾 Speichern unter …' : '↓ PDF speichern', '', []);
  if (K.n && ctx.dest !== 'local' && ctx.dest !== 'drive' && ctx.dest !== 'lib') ctx.dest = 'local';
  const body = document.getElementById('modal-body');
  const localTxt = ntFsSupported()
    ? (_ntPdfLocalDir ? 'Speicherdialog öffnet im Ordner «' + ntEscAttr(_ntPdfLocalDir.name) + '»' : 'Speicherdialog öffnet im Ordner «Dokumente» (Standard)')
    : 'Download-Ordner des Browsers (auf diesem Gerät nicht änderbar)';
  const row = (val, label, sub, btn) =>
    '<label style="display:flex;gap:8px;align-items:flex-start;padding:6px;border:1px solid var(--parch3);border-radius:4px;margin:4px 0;cursor:pointer">' +
    '<input type="radio" name="nt-pdf-dest" value="' + val + '"' + (ctx.dest === val ? ' checked' : '') + (val === 'drive' && !driveOn ? ' disabled' : '') + ' style="margin-top:3px">' +
    '<span style="flex:1;font-size:12px"><b>' + label + '</b><br><span style="color:var(--ink2);font-size:11px">' + sub + '</span></span>' + (btn || '') + '</label>';
  body.innerHTML =
    '<label style="font-size:12px;display:block;margin-bottom:6px">Dateiname<br><input id="nt-pdf-name" type="text" value="' + ntEscAttr(ctx.name) + '" style="width:100%;box-sizing:border-box;font-size:13px;padding:4px"></label>' +
    (K.n ? row('lib', '📚 Neues Stück in der Bibliothek', 'Eigener Eintrag (Drive + lokale Kopie); du arbeitest danach in dieser Kopie weiter, das Original bleibt unverändert', '') : '') +
    row('local', K.n ? '💻 Datei auf diesem Gerät (.notator)' : '💻 Auf diesem Gerät', localTxt,
      ntFsSupported() ? '<button class="b" id="nt-pdf-localdir" style="font-size:11px;padding:2px 6px">Standard ändern</button>' : '') +
    row('drive', K.n ? '☁ Drive-Ordner (.notator-Datei)' : '☁ Google Drive', driveOn ? 'Ordner: ' + ntEscAttr(ntDrivePathText(pr[K.folder], K.n)) : 'Google Drive ist nicht eingerichtet',
      driveOn ? '<button class="b" id="nt-pdf-drivedir" style="font-size:11px;padding:2px 6px">Ordner ändern</button>' : '') +
    (K.n ? '' : '<label style="font-size:12px;display:flex;gap:6px;align-items:center;margin-top:6px">Druckqualität ' +
      '<select id="nt-pdf-dpi" style="font-size:12px">' + NT_PDF_DPI_OPTS.map(d => '<option value="' + d + '"' + (d === ntPdfDpi() ? ' selected' : '') + '>' + d + ' dpi' +
        ({150: ' – klein', 200: ' – Bildschirm', 300: ' – Druck (Standard)', 400: ' – sehr scharf'})[d] + '</option>').join('') + '</select></label>');
  // Freitext mitdrucken: derselbe Schalter wie neben «↓ PDF» (auf dem Handy nur hier sichtbar)
  const ftSrc = document.getElementById(ctx.kind === 'cl' ? 'cl-pdf-print-texts' : ctx.kind === 'greg' ? 'greg-pdf-print-comments' : '');
  if (ftSrc && !K.n) {
    const lab = document.createElement('label'); lab.style.cssText = 'font-size:12px;display:flex;gap:6px;align-items:center;margin-top:6px';
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = ftSrc.checked; cb.onchange = () => { ftSrc.checked = cb.checked; };
    lab.appendChild(cb); lab.appendChild(document.createTextNode(' Notizen mitdrucken')); body.appendChild(lab);
  }
  const bEl = document.getElementById('modal-btns');
  const ok = document.createElement('button'); ok.className = 'b'; ok.textContent = 'Speichern';
  ok.style.cssText = 'background:#3d6b35;color:#fff;border-color:#3d6b35';
  const cancel = document.createElement('button'); cancel.className = 'b'; cancel.textContent = 'Abbrechen';
  bEl.appendChild(ok); bEl.appendChild(cancel);
  const nameEl = document.getElementById('nt-pdf-name');
  const sync = () => { ctx.name = nameEl.value; const r = body.querySelector('input[name=nt-pdf-dest]:checked'); if (r) ctx.dest = r.value; };
  cancel.onclick = () => closeModal();
  const ld = document.getElementById('nt-pdf-localdir');
  if (ld) ld.onclick = e => {
    e.preventDefault(); sync();
    window.showDirectoryPicker({ id: 'notator-pdf', mode: 'readwrite', startIn: _ntPdfLocalDir || 'documents' }).then(h => {
      _ntPdfLocalDir = h; ctx.dest = 'local';
      return ntKv('readwrite', st => st.put(h, 'pdfDir'));
    }).then(() => ntPdfDialog(ctx)).catch(() => {});
  };
  const dd = document.getElementById('nt-pdf-drivedir');
  if (dd) dd.onclick = e => {
    e.preventDefault(); sync(); ctx.dest = 'drive';
    gdGetToken(true).then(() => ntDriveFolderBrowser(ctx)).catch(err => gregGst(err.message));
  };
  ok.onclick = () => {
    sync();
    const name = ntSanitizeName(ctx.name, ext);
    const p = ntPdfPrefs(); p[K.dest] = ctx.dest;
    const dpiEl = document.getElementById('nt-pdf-dpi'); if (dpiEl) p.dpi = +dpiEl.value;
    ntPdfSavePrefs(p);
    const what = K.n ? 'Gespeichert' : 'PDF gespeichert';
    // Bibliothek – und der Drive-Ordner der Bibliothek selbst (dort liegen die Bibliotheks-
    // dateien): wie «Speichern unter» in Word/Excel: neue Datei, danach in ihr weiterarbeiten,
    // das Original bleibt auf dem Stand der letzten Speicherung. Gleicher Name = normal speichern.
    const libFolder = (() => { const f = ntPdfPrefs()[K.folder]; return !f || !f.id || f.id === NOTATOR_GDRIVE_FOLDER_ID; })();
    if (K.n && (ctx.dest === 'lib' || (ctx.dest === 'drive' && libFolder))) {
      const nm = name.replace(/\.notator$/i, '').trim();
      closeModal();
      if (!nm) return;
      if (gregLibCurrentId != null && nm.toLowerCase() === String(window._ntFileTitle || '').trim().toLowerCase()) gregLibSaveCurrent();
      else gregLibSaveAsName(nm);
      return;
    }
    // Speichern unter (.notator auf Drive/Gerät) mit neuem Namen: danach im Stück unter diesem
    // Namen weiterarbeiten (neuer Bibliothekseintrag), wie «Speichern unter» in anderen Programmen
    const nmN = name.replace(/\.notator$/i, '').trim();
    const renameAfter = K.n && nmN && nmN.toLowerCase() !== String(window._ntFileTitle || '').trim().toLowerCase();
    const afterN = () => { if (renameAfter) setTimeout(() => gregLibSaveAsName(nmN), 50); };
    if (ctx.dest === 'drive') {
      // Anmeldung im Klick (Popup), danach Datei erzeugen und hochladen
      gdGetToken(true).then(() => {
        closeModal();
        ntPdfRun(ctx.kind, blob => { const r = ntPdfToDrive(blob, name, ctx); Promise.resolve(r).then(afterN); return r; });
      }).catch(err => gregGst('Google Drive: ' + err.message));
    } else if (ntFsSupported()) {
      const opts = { suggestedName: name, types: [K.n ? { description: 'Notator-Datei', accept: { 'application/json': ['.notator'] } } : { description: 'PDF-Dokument', accept: { 'application/pdf': ['.pdf'] } }] };
      opts.startIn = _ntPdfLocalDir || 'documents';
      window.showSaveFilePicker(opts).then(h => {
        closeModal();
        ntPdfRun(ctx.kind, blob => h.createWritable().then(w => w.write(blob).then(() => w.close()))
          .then(() => { gregGst(what + ': ' + h.name); afterN(); }).catch(err => gregGst('Speichern fehlgeschlagen: ' + err.message)));
      }).catch(err => { if (err && err.name !== 'AbortError') gregGst('Speichern fehlgeschlagen: ' + err.message); });
    } else {
      closeModal();
      ntPdfRun(ctx.kind, blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        gregGst((K.n ? 'Heruntergeladen: ' : 'PDF heruntergeladen: ') + name);
        afterN();
      });
    }
  };
}

function ntPdfRun(kind, deliver) {
  if (kind === 'notator') { const st = gregBuildStateObject(); ntMarkClean(st); deliver(new Blob([JSON.stringify(st, null, 2)], { type: 'application/json' })); return; }
  const t0 = Date.now(); window._ntPdfBusy = t0;
  window._ntPdfDeliver = blob => { window._ntPdfBusy = 0; return deliver(blob); };
  // Läuft die Erzeugung ohne Ergebnis ins Leere, nicht stumm bleiben
  setTimeout(() => { if (window._ntPdfBusy === t0) { window._ntPdfBusy = 0; ntToast('PDF-Erzeugung hat kein Ergebnis geliefert – es wurde nichts gespeichert. Bitte nochmals versuchen.', 'err'); } }, 90000);
  try { if (kind === 'cl') clExportPDF(); else if (kind === 'mappe') ntMappeBuild(); else gregExportPDF(); }
  catch (e) { window._ntPdfBusy = 0; ntToast('PDF-Fehler: ' + e.message + ' – es wurde nichts gespeichert.', 'err'); }
}

