// ── PDF speichern: Ziel wählen (dieses Gerät oder Google Drive) ─────
// Ablauf: Klick auf "↓ PDF" -> Dialog (Dateiname, Ziel) -> im Klick selbst
// Speicherdialog bzw. Google-Anmeldung öffnen (Browser verlangen dafür eine
// Nutzeraktion) -> PDF erzeugen -> gregAssemblePdf übergibt das fertige PDF
// an window._ntPdfDeliver statt es direkt herunterzuladen.
// Voreinstellungen pro Gerät: letztes Ziel + Drive-Ordner (localStorage),
// lokaler Standardordner als Ordner-Handle (IndexedDB, nur Chrome/Edge am PC).
const NT_PDF_PREF = 'notatorPdfSave';
const NT_PDF_DRIVE_DEFAULT_SUB = 'PDF';
let _ntPdfLocalDir = null; // FileSystemDirectoryHandle oder null

// Früherer Ordner "Liturgie › Notator-PDF" (2026-10-10 aufgelöst, Inhalt nach
// Notator bzw. Notator › PDF verschoben) -> gespeicherte Wahl auf Standard zurück.
const NT_OLD_PDF_FOLDER = '1Nx5MKl20eDdB50xcbq3sifNvAt6ylFpN';
function ntPdfPrefs() {
  let p = null; try { p = JSON.parse(localStorage.getItem(NT_PDF_PREF) || 'null'); } catch (e) {}
  p = Object.assign({ dest: 'local', driveFolder: null }, p || {});
  ['driveFolder', 'driveFolderNotator'].forEach(k => {
    const f = p[k];
    if (f && (f.id === NT_OLD_PDF_FOLDER || /Notator-PDF\s*$/.test(f.path || ''))) p[k] = null;
  });
  return p;
}
// PDF-Auflösung (dpi), pro Gerät gespeichert
const NT_PDF_DPI_OPTS = [150, 200, 300, 400];
function ntPdfDpi() { const v = +(window._ntPdfDpi || (ntPdfPrefs().dpi)); return NT_PDF_DPI_OPTS.includes(v) ? v : 300; }
function ntPdfSavePrefs(p) { try { localStorage.setItem(NT_PDF_PREF, JSON.stringify(p)); } catch (e) {} }
function ntFsSupported() { return typeof window.showSaveFilePicker === 'function' && typeof window.showDirectoryPicker === 'function'; }

function ntKv(mode, fn) {
  return new Promise((resolve, reject) => {
    const rq = indexedDB.open('NotatorSettingsDB', 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
    rq.onerror = () => reject(rq.error);
    rq.onsuccess = () => {
      const tx = rq.result.transaction('kv', mode), st = tx.objectStore('kv');
      const r = fn(st);
      tx.oncomplete = () => resolve(r && r.result);
      tx.onerror = () => reject(tx.error);
    };
  });
}
function ntLoadLocalDir() {
  if (!ntFsSupported()) return Promise.resolve(null);
  return ntKv('readonly', st => st.get('pdfDir')).then(h => (_ntPdfLocalDir = h || null)).catch(() => null);
}

function ntEscAttr(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function ntSanitizeName(n, ext) {
  ext = ext || '.pdf';
  n = String(n || '').trim().replace(/[\\/:*?"<>|]+/g, '_') || 'Stueck';
  return n.toLowerCase().endsWith(ext) ? n : n.replace(/\.(pdf|notator)$/i, '') + ext;
}
function ntDrivePathText(f, isNot) { return f && f.path ? f.path : (isNot ? 'Notator – Bibliothek (Standard)' : 'Notator › ' + NT_PDF_DRIVE_DEFAULT_SUB + ' (Standard)'); }
// Ziel-Einstellungen getrennt für PDF und Notator-Datei (.notator)
function ntDestKeys(ctx) { const n = ctx && ctx.kind === 'notator'; return { n, dest: n ? 'destNotator' : 'dest', folder: n ? 'driveFolderNotator' : 'driveFolder' }; }

// kind: 'greg' | 'cl'
function ntPdfSave(kind) {
  window._ntPdfDeliver = null;
  const base = kind === 'cl' ? clFileBase() + '_Orgel'
    : kind === 'mappe' ? (ntMappeCur().title || 'Mappe') + (window._ntMappeFilter === 'greg' ? '_Choral' : window._ntMappeFilter === 'cl' ? '_Orgel' : '')
    : ntFileBaseName() + '_Choral';
  ntLoadLocalDir().then(() => ntPdfDialog({ kind, name: ntSanitizeName(base), dest: ntPdfPrefs().dest }));
}
