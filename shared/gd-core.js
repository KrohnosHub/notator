/* gd-core v1 – gemeinsamer Google-Drive-Kern für Notator und Schola-Planer.
   QUELLE: KrohnosHub/notator, shared/gd-core.js. Nur dort bearbeiten, dann:
     Notator:      python3 tools/gd-core-sync.py        (schreibt den Block in index.html)
     Schola-Planer: src/gd-core.js durch diese Datei ersetzen, python3 build.py
   Beide Apps laufen auf krohnoshub.github.io und teilen Token und Konto-Hinweis
   (gleiche Schlüssel im localStorage): eine Anmeldung gilt für beide.
   Meldungstexte nicht ändern, ohne die Apps zu prüfen: dort wird auf
   «abgelaufen», «Nicht bei Google» und «Drive-Fehler <Status>» geprüft. */
function gdCoreCreate(o) {
  const TK = o.tokenKey, HK = o.hintKey;
  let client = null, clientId = '', gis = null, pending = null;
  const read = () => {
    for (const st of ['localStorage', 'sessionStorage']) {
      try { const t = JSON.parse(window[st].getItem(TK) || 'null'); if (t && t.token) return t; } catch (e) {}
    }
    return null;
  };
  // Gültiger Token (noch mind. 1 Min.) oder null
  const cached = () => { const t = read(); return t && t.exp > Date.now() + 60000 ? t.token : null; };
  // Restlaufzeit in ms (-1: kein Token)
  const expiresIn = () => { const t = read(); return t ? t.exp - Date.now() : -1; };
  const hint = () => { try { return localStorage.getItem(HK) || ''; } catch (e) { return ''; } };
  const clear = () => { for (const st of ['localStorage', 'sessionStorage']) { try { window[st].removeItem(TK); } catch (e) {} } };
  function store(token, expiresInSec) {
    const v = JSON.stringify({ token, exp: Date.now() + (expiresInSec || 3600) * 1000 });
    try { localStorage.setItem(TK, v); } catch (e) { try { sessionStorage.setItem(TK, v); } catch (e2) {} }
    // Konto merken: beim nächsten Mal ohne Kontoauswahl (und evtl. still) anmelden
    try { localStorage.setItem(HK, localStorage.getItem(HK) || '1'); } catch (e) {}
    fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j && j.user && j.user.emailAddress) { try { localStorage.setItem(HK, j.user.emailAddress); } catch (e) {} } })
      .catch(() => {});
  }
  function loadGis() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (gis) return gis;
    gis = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { gis = null; reject(new Error('Google-Anmeldung nicht erreichbar (offline?)')); };
      document.head.appendChild(s);
    });
    return gis;
  }
  // interactive: darf ein Google-Fenster öffnen (nur aus einer Nutzeraktion heraus).
  // opts.silent: ohne Kontoauswahl/Rückfrage (prompt 'none', kurze Wartezeit).
  // opts.force: gespeicherten Token nicht verwenden, sondern erneuern – der alte
  //   bleibt bis zum Erfolg gespeichert (andere Tabs/Apps sehen nie «abgemeldet»).
  function token(interactive, opts) {
    opts = opts || {};
    if (!opts.force) { const c = cached(); if (c) return Promise.resolve(c); }
    if (!interactive) return Promise.reject(new Error('Nicht bei Google angemeldet'));
    const cid = String(o.clientId() || '').trim();
    if (!cid) return Promise.reject(new Error('Google Drive ist noch nicht eingerichtet (Client-ID fehlt)'));
    if (pending) return pending; // laufende Anmeldung teilen
    const p = loadGis().then(() => new Promise((resolve, reject) => {
      if (!client || clientId !== cid) {
        const cfg = { client_id: cid, scope: o.scope, callback: () => {} };
        const h = hint(); if (h.indexOf('@') > 0) cfg.hint = h;
        client = google.accounts.oauth2.initTokenClient(cfg); clientId = cid;
      }
      client.callback = r => {
        if (r.error) { reject(new Error('Google-Anmeldung: ' + r.error)); return; }
        store(r.access_token, r.expires_in); resolve(r.access_token);
      };
      client.error_callback = e => reject(new Error('Google-Anmeldung abgebrochen' + (e && e.type ? ' (' + e.type + ')' : '')));
      client.requestAccessToken({ prompt: opts.silent ? 'none' : '' });
      setTimeout(() => reject(new Error('Google-Anmeldung: keine Antwort (Popup blockiert?)')), opts.silent ? 12000 : 90000);
    }));
    pending = p;
    const done = () => { if (pending === p) pending = null; };
    p.then(done, done);
    return p;
  }
  // fetch mit Token; 401 → Token löschen, sonst Fehler mit Status und Textanfang
  function api(url, opts, interactive) {
    return token(interactive).then(t => {
      const op = Object.assign({}, opts || {});
      op.headers = Object.assign({}, op.headers || {}, { Authorization: 'Bearer ' + t });
      return fetch(url, op).then(r => {
        if (r.status === 401) { clear(); throw new Error('Google-Anmeldung abgelaufen – bitte neu anmelden'); }
        if (!r.ok) return r.text().then(tx => { throw new Error('Drive-Fehler ' + r.status + ': ' + tx.slice(0, 160)); });
        return r;
      });
    });
  }
  // Nach geänderter Client-ID: Google-Client neu aufbauen
  const reset = () => { client = null; clientId = ''; };
  return { cached, expiresIn, hint, clear, store, loadGis, token, fetch: api, reset };
}
