// Messlauf für «PDF lesen» in Notator (Build 409+): lädt index.html,
// liest cases/<fall>/scan.pdf über die echte Oberfläche (pdf.js) und schreibt runs/<serie>/<fall>/run-NN.json.
//   node tests/pdf-lesen/run-neu-playwright.js --series NAME [--run N] [--case FALL] [--mock DIR]
// --mock DIR: statt der API die gespeicherten KI-Antworten DIR/ki-<fall>.json verwenden (kostenlos).
// Ohne --mock: echter Aufruf, Key aus NOTATOR_API_KEY (Kosten ca. 0.01 USD pro Seite).
// --live DIR: echter Aufruf, aber über curl (TLS über die CA-Bündel der Umgebung) statt aus dem Browser; die Antworten
//   werden als DIR/ki-<fall>.json gespeichert und taugen danach für --mock.
// --set NAME[,NAME]: globale Schalter setzen (z. B. _pgEinDurchgang).
// --pdfjs DIR: pdf.js (3.11.174, Ordner build/ aus dem npm-Paket pdfjs-dist) lokal statt vom CDN, falls cdnjs gesperrt ist.
const fs = require('fs'), path = require('path'), { chromium } = require('playwright');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = __dirname, series = arg('--series', 'neu-tmp'), run = +arg('--run', 1), mock = arg('--mock', null), live = arg('--live', null), pdfjs = arg('--pdfjs', null);
const cases = arg('--case', null) ? [arg('--case')] : fs.readdirSync(path.join(ROOT, 'cases')).filter(c => !c.startsWith('_') && fs.existsSync(path.join(ROOT, 'cases', c, 'scan.pdf'))
  && (!mock || fs.existsSync(path.join(mock, 'ki-' + c + '.json'))));
(async () => {
  const browser = await chromium.launch();
  for (const c of cases) {
    const page = await browser.newPage(); const t0 = Date.now(); let usage = {input_tokens: 0, output_tokens: 0}, call = 0;
    // Doppelseiten (Build 416) lesen jede Spalte mit eigenem KI-Aufruf: Antwort k ≥ 2 liegt in ki-<fall>-<k>.json
    const kiFile = (dir, k) => path.join(dir, 'ki-' + c + (k > 1 ? '-' + k : '') + '.json');
    page.on('console', m => { if (/PDF lesen \(neu\)/.test(m.text())) console.log('   ', m.text().slice(0, 160)); });
    if (pdfjs) await page.route('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/*', route =>
      route.fulfill({status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(pdfjs, path.basename(new URL(route.request().url()).pathname)))}));
    if (live) {
      fs.mkdirSync(live, {recursive: true});
      await page.route('https://api.anthropic.com/**', async route => {
        const req = route.request(), tmp = path.join(live, '_req.json');
        fs.writeFileSync(tmp, req.postData());
        const hdr = req.headers(), args = ['-sS', req.url(), '--data-binary', '@' + tmp];
        for (const h of ['content-type', 'x-api-key', 'anthropic-version', 'anthropic-dangerous-direct-browser-access']) if (hdr[h]) args.push('-H', h + ': ' + hdr[h]);
        const body = require('child_process').execFileSync('curl', args, {maxBuffer: 1 << 24}).toString();
        const r = JSON.parse(body);
        if (r.content) {
          const ans = JSON.parse(r.content.filter(b => b.type === 'text').map(b => b.text).join(''));
          const u = {input_tokens: r.usage.input_tokens, output_tokens: r.usage.output_tokens};
          usage = {input_tokens: usage.input_tokens + u.input_tokens, output_tokens: usage.output_tokens + u.output_tokens};
          fs.writeFileSync(kiFile(live, ++call), JSON.stringify({model: r.model, lines: (() => { const a = []; ans.lines.forEach(e => { a[e.n - 1] = e.text; }); return Array.from(a, t => t || ''); })(), modes: ans.modes || [], verses: ans.verses || [],
            usage: {...u, costUsd: (u.input_tokens * 2 + u.output_tokens * 10) / 1e6}}, null, 1));
        }
        await route.fulfill({status: 200, contentType: 'application/json', body});
      });
    }
    if (mock) {
      await page.route('https://api.anthropic.com/**', async route => {
        const body = JSON.parse(route.request().postData()); const n = +(/N = (\d+)/.exec(body.messages[0].content[1].text) || [0, 0])[1];
        const f = kiFile(mock, ++call);
        // Zweiter Aufruf derselben Seite (Build 429: fehlende Zeile nochmals lesen) ohne gespeicherte Antwort: wie der erste antworten
        const ki = JSON.parse(fs.readFileSync(fs.existsSync(f) ? f : kiFile(mock, call - 1), 'utf8'));
        if (ki.lines.length !== n) console.log('    Achtung: ' + n + ' Systeme angefragt, gespeicherte Antwort hat ' + ki.lines.length);
        usage = {input_tokens: usage.input_tokens + ki.usage.input_tokens, output_tokens: usage.output_tokens + ki.usage.output_tokens};
        await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({type: 'message', stop_reason: 'end_turn',
          content: [{type: 'text', text: JSON.stringify({lines: ki.lines.map((t, k) => ({n: k + 1, text: t})), modes: ki.modes || [], verses: ki.verses || []})}],
          usage: {input_tokens: ki.usage.input_tokens, output_tokens: ki.usage.output_tokens}})});
      });
    }
    // --set NAME[,NAME]: globale Schalter vor dem Laden setzen (z. B. _pgEinDurchgang = ohne zweiten Durchgang, Build 429)
    if (arg('--set', null)) await page.addInitScript(names => { for (const n of names.split(',')) globalThis[n] = true; }, arg('--set'));
    await page.goto('file://' + path.resolve(ROOT, '../../index.html'));
    await page.waitForTimeout(2500);
    await page.evaluate(() => { try { closeModal(); } catch (e) {} });
    await page.evaluate(k => { document.getElementById('greg-api-key').value = k; }, process.env.NOTATOR_API_KEY || 'sk-test');
    await page.setInputFiles('#greg-pdf-in', path.join(ROOT, 'cases', c, 'scan.pdf'));
    await page.waitForFunction(() => window._pgLetzteErkennung || /Fehler|Keine Notenlinien|moderne Noten/.test((document.getElementById('greg-status') || {}).textContent || ''), null, {timeout: 180000});
    // Stückwahl: alle Stücke getrennt übernehmen (falls der Dialog erscheint)
    await page.waitForTimeout(500);
    const all = await page.$('#modal-btns button:has-text("Stücke laden")'); if (all && await all.isVisible()) await all.click();
    const res = await page.evaluate(() => window._pgLetzteErkennung || null);
    if (!res) { console.log(c + ': kein Ergebnis'); await page.close(); continue; }
    const out = {model: mock ? 'gespeichert (' + mock + ')' : 'claude-sonnet-5-5' + (live ? ' (über curl)' : ''), effort: 'low', pipeline: 'Notator, neue Erkennung (pdf.js, 172/174)',
      pieces: res.pieces.map(p => ({incipit: p.incipit, mode: p.mode === '?' ? '' : p.mode, clef: p.clef, hasDropCap: p.hasDropCap, systems: p.systems, unsure: p.unsure, verses: p.verses})),
      usage: {...usage, costUsd: res.usd}, durationMs: Date.now() - t0};
    const d = path.join(ROOT, 'runs', series, c); fs.mkdirSync(d, {recursive: true});
    fs.writeFileSync(path.join(d, 'run-' + String(run).padStart(2, '0') + '.json'), JSON.stringify(out, null, 1));
    console.log(c + ': ' + res.pieces.length + ' Stück(e), ' + res.pieces.reduce((s, p) => s + p.systems.length, 0) + ' Systeme, ' + Math.round((Date.now() - t0) / 1000) + ' s');
    await page.close();
  }
  await browser.close();
})();
