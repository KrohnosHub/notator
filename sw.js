// Notator Service Worker – macht die App installierbar und offline nutzbar.
// Strategie:
//  - App selbst (index.html): Netz zuerst, damit neue Versionen sofort
//    ankommen; ohne Netz die zuletzt geladene Version aus dem Cache.
//  - Bibliotheken von CDNs (abcjs, jsPDF, pdf.js) und Orgelklänge: aus dem
//    Cache, im Hintergrund aktualisiert.
//  - Google-Anmeldung/Drive, GregoBase-Proxy, KI-Schnittstelle: nie cachen.
const CACHE = 'notator-v33';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'];
const CDN_HOSTS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'paulrosen.github.io'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    // Netz zuerst, Cache als Rückfall
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' && !/\/noh\//.test(url.pathname) ? caches.match('./index.html') : undefined))));
    // (NOH-Notenbibliothek liegt unter noh/ im selben Bereich: wird mitgecacht,
    //  bekommt offline aber nie die Notator-Seite als Ersatz.)
    return;
  }
  if (CDN_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open(CACHE).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
  }
  // alles andere (Google, GregoBase-Proxy, KI) geht unverändert ans Netz
});
