// ── Teilen: Notator-Link (Stück im Link) oder nur PDF ───────────────
// Link: das Stück wird komprimiert in den Link-Anker (#n=…) geschrieben –
// kein Server, keine Anmeldung, nichts wird öffentlich abgelegt. Der
// Empfänger sieht das Stück in Notator in der Ansicht.
const NT_SHARE_BASE = 'https://krohnoshub.github.io/notator/';
function ntB64url(bytes) {
  let s = ''; const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function ntUnB64url(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '=';
  const bin = atob(str); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function ntStreamBytes(bytes, stream) {
  return new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer().then(b => new Uint8Array(b));
}
function ntShareEncode(state) {
  const json = new TextEncoder().encode(JSON.stringify(state)) // vollständig (weggelassene Felder würden beim Empfänger anders gedeutet);
  if (typeof CompressionStream === 'function') return ntStreamBytes(json, new CompressionStream('deflate-raw')).then(b => 'd' + ntB64url(b));
  return Promise.resolve('j' + ntB64url(json));
}
function ntShareDecode(code) {
  const kind = code[0], bytes = ntUnB64url(code.slice(1));
  const p = kind === 'd' ? ntStreamBytes(bytes, new DecompressionStream('deflate-raw')) : Promise.resolve(bytes);
  return p.then(b => JSON.parse(new TextDecoder().decode(b)));
}
function ntShareBase() {
  return /^https?:$/.test(location.protocol) && !/^(localhost|127\.)/.test(location.hostname) ? location.origin + location.pathname : NT_SHARE_BASE;
}
function ntShareState() {
  const st = gregBuildStateObject();
  delete st.canvasWidth;
  return st;
}

function ntShareShow(from) {
  const title = ntFileBaseName();
  const ctx = { from: from === 'cl' ? 'cl' : 'greg', title, pdfBlob: null, pdfName: null };
  ntShareDialog(ctx);
}

function ntShareDialog(ctx) {
  showModal('🔗 Teilen: ' + ctx.title, '', []);
  const body = document.getElementById('modal-body'), bEl = document.getElementById('modal-btns');
  bEl.style.flexDirection = ''; bEl.style.alignItems = '';
  const box = (html) => '<div style="border:1px solid var(--parch3);border-radius:4px;padding:8px;margin:6px 0;font-size:12px">' + html + '</div>';
  body.innerHTML =
    box('<b>🎼 Link zu Notator</b><br><span style="color:var(--ink2);font-size:11px">Der Empfänger öffnet das Stück direkt in Notator (Ansicht, ohne Anmeldung) und kann es abspielen, umschalten oder in seine Bibliothek übernehmen. Das Stück steckt im Link selbst – nichts wird öffentlich gespeichert.</span>' +
      '<div style="margin:6px 0">Öffnet als: <label><input type="radio" name="nt-sh-v" value="greg"' + (ctx.from === 'greg' ? ' checked' : '') + '> Choral</label> ' +
      '<label><input type="radio" name="nt-sh-v" value="cl"' + (ctx.from === 'cl' ? ' checked' : '') + '> Orgel</label></div>' +
      '<div style="display:flex;gap:4px;flex-wrap:wrap"><button class="b" id="nt-sh-link">Link erstellen</button></div>' +
      '<div id="nt-sh-linkout" style="margin-top:6px"></div>') +
    box('<b>🗂 Link für den Schola-Planer</b><br><span style="color:var(--ink2);font-size:11px">Google-Drive-Link der gespeicherten Notator-Datei. Im Schola-Planer unter «Gesänge» bei «🔗 Datei» einfügen – dann öffnet «Notator ↗» immer genau diese Datei.</span>' +
      '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px"><button class="b" id="nt-sh-plan">📋 Drive-Link kopieren</button></div>' +
      '<div id="nt-sh-planout" style="margin-top:6px;font-size:11px"></div>') +
    box('<b>📄 Nur PDF</b><br><span style="color:var(--ink2);font-size:11px">Der Empfänger bekommt nur die Noten als PDF, ohne Zugriff auf Notator.</span>' +
      '<div style="margin:6px 0">Fassung: <label><input type="radio" name="nt-sh-p" value="greg"' + (ctx.from === 'greg' ? ' checked' : '') + '> Choral</label> ' +
      '<label><input type="radio" name="nt-sh-p" value="cl"' + (ctx.from === 'cl' ? ' checked' : '') + '> Orgel' + (clState && clState.accomp ? ' (mit Begleitsatz)' : '') + '</label></div>' +
      '<div style="display:flex;gap:4px;flex-wrap:wrap"><button class="b" id="nt-sh-pdf">PDF erzeugen</button></div>' +
      '<div id="nt-sh-pdfout" style="margin-top:6px"></div>');
  const close = document.createElement('button'); close.className = 'b'; close.textContent = 'Schliessen'; close.onclick = () => closeModal(); bEl.appendChild(close);
  const linkOut = document.getElementById('nt-sh-linkout'), pdfOut = document.getElementById('nt-sh-pdfout');
  document.getElementById('nt-sh-plan').onclick = () => {
    const out = document.getElementById('nt-sh-planout');
    Promise.resolve(gregLibCurrentId ? gregLibGet(gregLibCurrentId) : null).then(rec => {
      if (!rec || !rec.driveId) { out.textContent = 'Dieses Stück ist noch nicht in Google Drive gespeichert. Zuerst «Speichern» → Bibliothek (mit Google-Anmeldung), dann hier nochmals.'; return; }
      const url = 'https://drive.google.com/file/d/' + rec.driveId + '/view';
      out.innerHTML = '<input type="text" readonly style="width:100%;box-sizing:border-box;font-size:11px;padding:3px" value="' + ntEscAttr(url) + '">';
      const inp = out.querySelector('input'); inp.onclick = () => inp.select();
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => { gregGst('Drive-Link kopiert.'); out.insertAdjacentHTML('beforeend', '<div>✓ Kopiert.</div>'); }).catch(() => { inp.select(); out.insertAdjacentHTML('beforeend', '<div>Zum Kopieren markiert – bitte manuell kopieren.</div>'); });
    }).catch(err => { out.textContent = 'Fehler: ' + err.message; });
  };
  const offer = (out, url, shareTitle) => {
    out.innerHTML = '<input type="text" readonly style="width:100%;box-sizing:border-box;font-size:11px;padding:3px" value="' + ntEscAttr(url) + '">' +
      '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px"><button class="b nt-copy">📋 Kopieren</button>' +
      (navigator.share ? '<button class="b nt-send">📤 Senden …</button>' : '') + '</div>';
    const inp = out.querySelector('input'); inp.onclick = () => inp.select();
    out.querySelector('.nt-copy').onclick = () => {
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => gregGst('Link kopiert.'))
        .catch(() => { inp.select(); document.execCommand('copy'); gregGst('Link kopiert.'); });
    };
    const sd = out.querySelector('.nt-send');
    if (sd) sd.onclick = () => navigator.share({ title: shareTitle, text: shareTitle, url }).catch(() => {});
  };
  document.getElementById('nt-sh-link').onclick = () => {
    const v = (body.querySelector('input[name=nt-sh-v]:checked') || {}).value || 'greg';
    ntShareEncode(ntShareState()).then(code => {
      const url = ntShareBase() + '#n=' + code + (v === 'cl' ? '&v=cl' : '');
      offer(linkOut, url, ctx.title + ' (Notator)');
      const len = document.createElement('div'); len.style.cssText = 'font-size:10px;color:var(--ink2);margin-top:2px';
      len.textContent = 'Linklänge: ' + url.length + ' Zeichen' + (url.length > 30000 ? ' – sehr lang, manche Messenger kürzen so lange Links. Dann besser PDF oder Datei senden.' : '');
      linkOut.appendChild(len);
    }).catch(err => { linkOut.textContent = 'Fehler: ' + err.message; });
  };
  document.getElementById('nt-sh-pdf').onclick = () => {
    const v = (body.querySelector('input[name=nt-sh-p]:checked') || {}).value || 'greg';
    const name = ntSanitizeName(v === 'cl' ? clFileBase() + '_Orgel' : ctx.title + '_Choral');
    pdfOut.textContent = 'PDF wird erstellt …';
    const prevTab = window._ntTab || 'greg';
    if (v === 'cl' && prevTab !== 'editor') switchTab('editor');
    const go = () => ntPdfRun(v, blob => {
      if (v === 'cl' && prevTab !== 'editor') switchTab(prevTab);
      ctx.pdfBlob = blob; ctx.pdfName = name;
      ntShareDialog(ctx);
    });
    if (v === 'cl') clEnsureAbcjs(() => setTimeout(go, 150)); else go();
  };
  if (ctx.pdfBlob) {
    const file = new File([ctx.pdfBlob], ctx.pdfName, { type: 'application/pdf' });
    const canFile = navigator.canShare && navigator.canShare({ files: [file] });
    pdfOut.innerHTML = '<div style="color:#3d6b35">✓ ' + ntEscAttr(ctx.pdfName) + ' (' + Math.round(ctx.pdfBlob.size / 1024) + ' KB)</div>' +
      '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">' +
      (canFile ? '<button class="b" id="nt-sh-pdfshare">📤 PDF senden …</button>' : '') +
      (gdConfigured() ? '<button class="b" id="nt-sh-pdfdrive">☁ Link über Google Drive</button>' : '') +
      '<button class="b" id="nt-sh-pdfdl">↓ Herunterladen</button></div><div id="nt-sh-pdflink" style="margin-top:6px"></div>';
    const ps = document.getElementById('nt-sh-pdfshare');
    if (ps) ps.onclick = () => navigator.share({ files: [file], title: ctx.pdfName }).catch(() => {});
    document.getElementById('nt-sh-pdfdl').onclick = () => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(ctx.pdfBlob); a.download = ctx.pdfName; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    };
    const pdr = document.getElementById('nt-sh-pdfdrive');
    if (pdr) pdr.onclick = () => {
      if (!confirm('Das PDF wird in Google Drive (PDF-Ordner) abgelegt und für «Jeder mit dem Link» lesbar freigegeben. Fortfahren?')) return;
      const out = document.getElementById('nt-sh-pdflink');
      out.textContent = 'Lade hoch …';
      gdGetToken(true).then(() => ntPdfDriveFolderId()).then(fid => gdUploadBlob(ctx.pdfName, ctx.pdfBlob, 'application/pdf', fid, null))
        .then(f => gdFetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(f.id) + '/permissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'reader', type: 'anyone' }) }, false)
          .then(() => f.webViewLink || ('https://drive.google.com/file/d/' + f.id + '/view')))
        .then(url => { offer(out, url, ctx.pdfName); gregGst('PDF in Drive freigegeben.'); })
        .catch(err => { out.textContent = 'Fehler: ' + err.message; });
    };
  }
}

// Eingehender Link (#n=…): Stück anzeigen, Anker danach entfernen
function ntShareCheckIncoming() {
  const h = location.hash || '';
  const m = h.match(/[#&]n=([A-Za-z0-9_-]+)/);
  if (!m) return;
  const toCl = /[#&]v=cl\b/.test(h);
  ntShareDecode(m[1]).then(state => {
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    gregApplyLoadedState(state);
    gregLibCurrentId = null;
    if (typeof gregRefreshList === 'function') gregRefreshList();
    gregMobileSetEditMode(false);
    gregRender();
    if (toCl) { switchTab('editor'); if (!clUi().view) clToggleView(); }
    const t = state.title || 'Stück';
    ntMarkClean();
    gregGst('Geteiltes Stück geöffnet: "' + t + '"');
    showModal('🔗 Geteiltes Stück', '«' + t + '» wurde mit dir geteilt und ist jetzt geöffnet.', [
      { label: '📚 In meine Bibliothek übernehmen', fn: () => { closeModal(); gregLibSaveCurrent(); } },
      { label: 'Ansehen', fn: () => closeModal() },
    ]);
  }).catch(err => gregGst('Geteilter Link ist ungültig oder unvollständig (' + err.message + ').'));
}
window.addEventListener('hashchange', ntShareCheckIncoming);

// Eingehender Link (#song=Titel), z. B. aus der NOH-Notenbibliothek: Greg-Editor öffnen und Titel in GregoBase suchen
function ntSongCheckIncoming() {
  const hs = location.hash || '';
  const m = hs.match(/[#&]song=([^&]+)/);
  const dm = hs.match(/[#&]drive=([\w-]+)/);
  if (!m && !dm) return;
  let title = '';
  if (m) { try { title = decodeURIComponent(m[1].replace(/\+/g, ' ')).trim(); } catch (e) { if (!dm) return; } }
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  if (!title && !dm) return;
  try { switchTab('greg'); } catch (e) {}
  window._ntIncomingHandled = true;
  ntOpenSongDriveFirst(title, dm ? dm[1] : '');
}
// Reihenfolge: 1. vorhandene Notator-Datei in Google Drive (Datei-ID oder Titelsuche), 2. GregoBase.
function ntOpenSongDriveFirst(title, driveId) {
  const normT = x => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
  const toGb = () => { if (title) gregImportSongFromGregoBase(title); else gregGst('Kein Titel im Link.'); };
  const search = () => {
    if (!title) { toGb(); return; }
    gregGst('Suche "' + title + '" in Google Drive …');
    gdList(false).then(files => {
      const words = x => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(Boolean);
      const t = normT(title), tw = words(title);
      const exact = files.filter(f => normT(gdTitleFromName(f.name)) === t);
      // Teiltreffer nur, wenn alle Wörter des gesuchten Titels als ganze Wörter im Dateinamen vorkommen
      // (so ist «Asperges I» kein Treffer für «Asperges II» und umgekehrt).
      const part = exact.length ? [] : files.filter(f => { const fw = words(gdTitleFromName(f.name)); return tw.length && tw.every(w => fw.includes(w)); });
      if (exact.length) { gregLibLoadDrive(exact[0], toGb); return; }
      if (part.length) {
        showModal('☁ Ähnliche Datei in Google Drive', 'Für "' + title + '" gibt es keine Datei mit genau diesem Namen. Mögliche Treffer in Drive:', [
          ...part.slice(0, 6).map(f => ({ label: '☁ ' + gdTitleFromName(f.name), fn: () => { closeModal(); gregLibLoadDrive(f, toGb); } })),
          { label: 'In GregoBase suchen', fn: () => { closeModal(); toGb(); } },
          { label: 'Schliessen', fn: closeModal }
        ]);
        return;
      }
      gregGst('Nicht in Google Drive gefunden – suche in GregoBase …');
      toGb();
    }).catch(err => { gregGst('Drive-Suche nicht möglich (' + err.message + ')'); toGb(); });
  };
  const withToken = () => {
    if (driveId) gregLibLoadDrive({ id: driveId, name: (title || 'Stück') + '.notator', modifiedTime: new Date().toISOString() }, search);
    else search();
  };
  if (!gdConfigured()) { toGb(); return; }
  if (gdHasToken()) { withToken(); return; }
  gregGst('Prüfe Google-Anmeldung …');
  gdTrySilent().then(tok => {
    if (tok) { withToken(); return; }
    showModal('☁ Google Drive', 'Für "' + (title || 'dieses Stück') + '" wird zuerst in deiner Notator-Ablage in Google Drive gesucht, danach in GregoBase. Dafür ist die Google-Anmeldung nötig (gilt etwa eine Stunde).', [
      { label: '☁ Anmelden und in Drive öffnen', fn: () => { closeModal(); gdGetToken(true).then(withToken).catch(err => { gregGst(err.message); toGb(); }); } },
      ...(title ? [{ label: 'Direkt in GregoBase suchen', fn: () => { closeModal(); toGb(); } }] : []),
      { label: 'Schliessen', fn: closeModal }
    ]);
  });
}
window.addEventListener('hashchange', ntSongCheckIncoming);

// ── Bildschirm wach halten (Screen Wake Lock) ───────────────────────
// Verhindert, dass das Tablet/Handy beim Notenlesen dunkel wird, solange
// Notator sichtbar ist. Standard: an auf Touchgeräten, aus am PC (pro Gerät umschaltbar über ☀).
// Der Browser gibt die Sperre beim Wechsel in eine andere App/Tab frei;
// beim Zurückkehren wird sie neu angefordert.
const ntWake = { lock: null };
function ntWakeSupported() { return 'wakeLock' in navigator; }
// Standard: an auf Tablet/Handy (Touch als Hauptzeiger), aus am PC; eine bewusste Wahl (☀) gilt pro Gerät.
function ntWakeDefault() { try { return window.matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } }
function ntWakePref() { try { const v = localStorage.getItem('notatorWake'); return v === null ? ntWakeDefault() : v === '1'; } catch (e) { return ntWakeDefault(); } }
function ntWakeUpdate() {
  document.querySelectorAll('.nt-wake-btn').forEach(b => {
    if (!ntWakeSupported()) { b.style.display = 'none'; return; }
    const on = !!ntWake.lock, want = ntWakePref();
    b.innerHTML = on ? '&#9728;&#xFE0E; an' : '&#9728;&#xFE0E; aus';
    b.style.background = on ? '#c09a30' : ''; b.style.color = on ? '#1a1209' : '';
    b.title = on ? 'Bildschirm bleibt an (tippen zum Abschalten)'
      : (want ? 'Bildschirm-wach-halten wird beim nächsten Tippen aktiviert' : 'Bildschirm darf ausgehen (tippen, damit er anbleibt)');
  });
}
function ntWakeAcquire() {
  if (!ntWakeSupported() || !ntWakePref() || ntWake.lock || ntWake.pending || document.visibilityState !== 'visible') return;
  ntWake.pending = true;
  navigator.wakeLock.request('screen').then(l => {
    ntWake.lock = l;
    l.addEventListener('release', () => { ntWake.lock = null; ntWakeUpdate(); });
  }).catch(() => {}).then(() => { ntWake.pending = false; ntWakeUpdate(); });
}
function ntWakeRelease() {
  const l = ntWake.lock; ntWake.lock = null;
  if (l) l.release().catch(() => {});
  ntWakeUpdate();
}
function ntWakeToggle() {
  const on = !ntWakePref();
  try { localStorage.setItem('notatorWake', on ? '1' : '0'); } catch (e) {}
  if (on) ntWakeAcquire(); else ntWakeRelease();
  gregGst(on ? 'Bildschirm bleibt an, solange Notator sichtbar ist.' : 'Bildschirm darf wieder ausgehen.');
  ntWakeUpdate();
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') ntWakeAcquire(); });
// manche Browser erlauben die Sperre erst nach einer Berührung
document.addEventListener('pointerdown', e => { if (!(e.target.closest && e.target.closest('.nt-wake-btn'))) ntWakeAcquire(); }, { passive: true });
document.addEventListener('DOMContentLoaded', () => { ntWakeUpdate(); ntWakeAcquire(); });

