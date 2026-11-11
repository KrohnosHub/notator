// Bildvergleichstest (Vorschau): rendert die GABC-Stücke in tests/visual/cases/
// im Notator und vergleicht Screenshots des Notenbereichs mit tests/visual/baseline/.
//
//   node tests/visual/run.js           vergleichen (Exitcode 1 bei Abweichung)
//   node tests/visual/run.js --update  Referenzbilder neu schreiben
//
// Nur Playwright nötig (keine weiteren Pakete). Externe Netzzugriffe werden blockiert,
// damit Ergebnisse nicht von CDN/Drive abhängen. Abweichungen: diff/<fall>.png
// (rot = geänderte Pixel) und ein Bericht diff/bericht.html.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DIR = __dirname;
const CASES = path.join(DIR, 'cases'), BASE = path.join(DIR, 'baseline'), DIFF = path.join(DIR, 'diff');
const UPDATE = process.argv.includes('--update');
const TOL = 0.00002; // erlaubter Anteil abweichender Pixel (Render ist lokal deterministisch; Spielraum für Kantenglättung)

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
function serve() {
  return new Promise(res => {
    const s = http.createServer((q, r) => {
      let p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
      if (!p.startsWith(ROOT)) { r.writeHead(403); return r.end(); }
      if (p.endsWith('/')) p += 'index.html';
      fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); r.end(d); } });
    }).listen(0, () => res(s));
  });
}

// Pixelvergleich im Browser (Canvas), liefert Anteil abweichender Pixel und ein Diff-Bild
async function compare(page, aB64, bB64) {
  return page.evaluate(async ([a, b]) => {
    const load = src => new Promise((ok, err) => { const i = new Image(); i.onload = () => ok(i); i.onerror = err; i.src = 'data:image/png;base64,' + src; });
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    const w = Math.max(ia.width, ib.width), h = Math.max(ia.height, ib.height);
    const px = img => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h); };
    const da = px(ia), db = px(ib);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    const out = x.createImageData(w, h); let bad = 0;
    for (let i = 0; i < da.data.length; i += 4) {
      const d = Math.abs(da.data[i] - db.data[i]) + Math.abs(da.data[i + 1] - db.data[i + 1]) + Math.abs(da.data[i + 2] - db.data[i + 2]);
      if (d > 48) { bad++; out.data[i] = 220; out.data[i + 1] = 30; out.data[i + 2] = 30; out.data[i + 3] = 255; }
      else { const g = 255 - (255 - da.data[i]) * 0.25; out.data[i] = out.data[i + 1] = out.data[i + 2] = g; out.data[i + 3] = 255; }
    }
    x.putImageData(out, 0, 0);
    return { ratio: bad / (w * h), sizeChanged: ia.width !== ib.width || ia.height !== ib.height, diff: c.toDataURL('image/png').split(',')[1] };
  }, [aB64, bB64]);
}

(async () => {
  const srv = await serve();
  const url = 'http://localhost:' + srv.address().port + '/index.html';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 2000 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => typeof gregImportGABCString === 'function');
  await page.waitForTimeout(800);

  fs.mkdirSync(BASE, { recursive: true });
  fs.rmSync(DIFF, { recursive: true, force: true });
  const results = [];
  for (const f of fs.readdirSync(CASES).filter(n => n.endsWith('.gabc')).sort()) {
    const name = f.replace(/\.gabc$/, '');
    const gabc = fs.readFileSync(path.join(CASES, f), 'utf8');
    await page.evaluate(g => { try { switchTab('greg'); } catch (e) {} gregImportGABCString(g); if (typeof gregRender === 'function') gregRender(); }, gabc);
    await page.waitForTimeout(600);
    await page.evaluate(() => document.fonts && document.fonts.ready);
    const shot = await page.locator('#greg-mobile-scale-outer').screenshot({ animations: 'disabled' });
    const bp = path.join(BASE, name + '.png');
    if (UPDATE || !fs.existsSync(bp)) { fs.writeFileSync(bp, shot); results.push({ name, status: 'neu' }); continue; }
    const r = await compare(page, fs.readFileSync(bp).toString('base64'), shot.toString('base64'));
    const ok = !r.sizeChanged && r.ratio <= TOL;
    if (!ok) {
      fs.mkdirSync(DIFF, { recursive: true });
      fs.writeFileSync(path.join(DIFF, name + '.png'), Buffer.from(r.diff, 'base64'));
      fs.writeFileSync(path.join(DIFF, name + '.neu.png'), shot);
    }
    results.push({ name, status: ok ? 'ok' : 'abweichung', ratio: r.ratio, sizeChanged: r.sizeChanged });
  }
  await browser.close(); srv.close();

  for (const r of results) console.log((r.status === 'ok' ? '✓ ' : r.status === 'neu' ? '+ ' : '✗ ') + r.name + (r.ratio != null ? '  (' + (r.ratio * 100).toFixed(3) + ' % Pixel' + (r.sizeChanged ? ', Grösse geändert' : '') + ')' : '  (Referenz geschrieben)'));
  if (errors.length) console.log('JS-Fehler auf der Seite:\n  ' + errors.join('\n  '));
  const bad = results.filter(r => r.status === 'abweichung');
  if (bad.length) {
    const rows = bad.map(r => `<h2>${r.name} – ${(r.ratio * 100).toFixed(3)} %</h2><div class=g><figure><img src="../baseline/${r.name}.png"><figcaption>Referenz</figcaption></figure><figure><img src="${r.name}.neu.png"><figcaption>Neu</figcaption></figure><figure><img src="${r.name}.png"><figcaption>Unterschied (rot)</figcaption></figure></div>`).join('');
    fs.writeFileSync(path.join(DIFF, 'bericht.html'), `<!doctype html><meta charset=utf-8><title>Notator Bildvergleich</title><style>body{font:14px system-ui;margin:16px}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}img{width:100%;border:1px solid #ccc}figure{margin:0}</style><h1>Abweichungen</h1>${rows}`);
    console.log('\n' + bad.length + ' Abweichung(en) – siehe tests/visual/diff/bericht.html');
  }
  process.exit(bad.length || errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
