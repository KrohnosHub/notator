#!/usr/bin/env node
// Messlauf fuer «PDF lesen»: steuert das UNVERAENDERTE Notator (index.html)
// mit Playwright, faengt die API-Aufrufe ab und schreibt die Ergebnisse im
// Format von tests/pdf-lesen/README.md.
//
// ACHTUNG: ruft die kostenpflichtige Claude-API auf. Nur mit Freigabe starten.
//
//   ANTHROPIC_API_KEY=… NODE_USE_ENV_PROXY=1 node tests/pdf-lesen/run-playwright.js \
//       --case <fall> --series <name> [--model <id>] [--effort low|medium|high] \
//       [--max-usd 1.5] [--ledger <datei>] [--pdfjs <ordner>] [--dump <ordner>]
//
//   --model   ohne Angabe: Aufrufe gehen unveraendert durch (Build wie er ist).
//             Mit Angabe werden die Aufrufe unterwegs umgeschrieben: Modell
//             ersetzt, temperature entfernt, max_tokens auf 16000, effort gesetzt.
//   --ledger  Datei mit den aufgelaufenen Kosten ueber mehrere Aufrufe;
//             zusammen mit --max-usd die Kostenbremse.
//   --pdfjs   Ordner mit pdf.min.js und pdf.worker.min.js (3.11.174), falls das
//             CDN nicht erreichbar ist.
//   --dump    Ordner fuer die Systemausschnitte (JPEG) und Seitenbilder.
//
// Je Lauf entstehen drei Serien:
//   runs/<serie>/<fall>/run-01.json            Endergebnis nach Geometrie
//   runs/<serie>-vor-geometrie/<fall>/…        Konsens vor der Geometrie
//   runs/<serie>-roh/<fall>/run-01..03.json    die einzelnen Durchlaeufe
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const REPO = path.resolve(ROOT, '..', '..');

// USD je Mio. Tokens (Ein-/Ausgabe), Stand Claude-API-Referenz 03.11.2026.
const PRICES = {
  'claude-sonnet-4-6': [3, 15],
  'claude-sonnet-5-5': [2, 10],
  'claude-opus-5-5': [4, 20],
  'claude-fable-5-2': [8, 40],
};

function args(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) o[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  return o;
}

function costOf(model, usage) {
  const p = PRICES[model];
  if (!p || !usage) return 0;
  const inTok = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
  return (inTok * p[0] + (usage.output_tokens || 0) * p[1]) / 1e6;
}

// Gleiche Regeln wie runBatchAttempt in index.html (Zeilen 5922–5936).
function parseBatchText(full) {
  const marker = full.indexOf('===GABC===');
  let lines;
  if (marker >= 0) lines = full.slice(marker + '===GABC==='.length).trim().split('\n');
  else lines = full.split('\n').filter(l => /^\s*System\s+#?\d+\s*:/i.test(l));
  return { hadMarker: marker >= 0, lines: lines.map(l => l.replace(/^\s*System\s+#?\d+\s*:\s*/i, '').trim()).filter(l => l) };
}

const textOf = data => (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
const promptOf = body => {
  const c = (body.messages && body.messages[0] && body.messages[0].content) || [];
  return c.filter(b => b.type === 'text').map(b => b.text).join('\n');
};

async function main() {
  const a = args(process.argv.slice(2));
  if (!a.case || !a.series) { console.error('Aufruf: --case <fall> --series <name> [--model …] [--effort …] [--max-usd …]'); return 2; }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { console.error('ANTHROPIC_API_KEY fehlt.'); return 2; }
  const caseDir = path.join(ROOT, 'cases', a.case);
  const expectedFile = path.join(caseDir, 'expected.json');
  const scanName = fs.existsSync(expectedFile) ? (JSON.parse(fs.readFileSync(expectedFile, 'utf8')).scan || 'scan.pdf') : 'scan.pdf';
  const scan = path.join(caseDir, scanName);
  if (!fs.existsSync(scan)) { console.error('Scan fehlt: ' + scan); return 2; }
  const maxUsd = a['max-usd'] ? parseFloat(a['max-usd']) : Infinity;
  const ledgerFile = a.ledger || null;
  const ledger = ledgerFile && fs.existsSync(ledgerFile) ? JSON.parse(fs.readFileSync(ledgerFile, 'utf8')) : { usd: 0, calls: 0 };
  const saveLedger = () => { if (ledgerFile) fs.writeFileSync(ledgerFile, JSON.stringify(ledger)); };

  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const consoleLines = [];
  page.on('console', m => consoleLines.push(m.text().slice(0, 600)));
  page.on('pageerror', e => consoleLines.push('PAGEERROR ' + e.message));

  // Zustand des Laufs
  const calls = [];            // Protokoll aller API-Aufrufe (ohne Bilder)
  let stepA = null;            // erkannte Stuecke
  const pieces = [];           // je verarbeitetem Stueck: { clef, attempts: {sysNr: [zeile je Durchlauf]}, omr }
  let cur = null;
  let stopped = null;
  const usage = { input_tokens: 0, output_tokens: 0, costUsd: 0 };
  let dumpN = 0;

  if (a.pdfjs) {
    await page.route('**/pdf.js/3.11.174/pdf.min.js', r => r.fulfill({ path: path.join(a.pdfjs, 'pdf.min.js'), contentType: 'application/javascript' }));
    await page.route('**/pdf.js/3.11.174/pdf.worker.min.js', r => r.fulfill({ path: path.join(a.pdfjs, 'pdf.worker.min.js'), contentType: 'application/javascript' }));
  }

  await page.route('https://api.anthropic.com/**', async route => {
    const req = route.request();
    const body = JSON.parse(req.postData() || '{}');
    const prompt = promptOf(body);
    const kind = /List each separate chant PIECE/.test(prompt) ? 'pieces' : /Compare the clef glyph/.test(prompt) ? 'clef' : /Transcribe systems #/.test(prompt) ? 'gabc' : 'other';
    if (stopped || ledger.usd >= maxUsd) {
      stopped = stopped || 'Kostenbremse erreicht (' + ledger.usd.toFixed(2) + ' USD)';
      return route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: { type: 'budget_guard', message: stopped } }) });
    }
    const sent = Object.assign({}, body);
    if (a.model) {
      sent.model = a.model;
      delete sent.temperature;
      sent.max_tokens = 16000;
      if (a.effort) sent.output_config = Object.assign({}, sent.output_config, { effort: a.effort });
    }
    if (a.dump) {
      fs.mkdirSync(a.dump, { recursive: true });
      const imgs = (body.messages[0].content || []).filter(b => b.type === 'image');
      imgs.forEach((im, i) => {
        const ext = im.source.media_type === 'image/png' ? 'png' : 'jpg';
        fs.writeFileSync(path.join(a.dump, a.case + '-' + String(++dumpN).padStart(3, '0') + '-' + kind + '-' + (i + 1) + '.' + ext), Buffer.from(im.source.data, 'base64'));
      });
    }
    const t0 = Date.now();
    let status = 0, data = null, raw = '';
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(sent),
      });
      status = resp.status;
      raw = await resp.text();
      try { data = JSON.parse(raw); } catch (e) { data = null; }
    } catch (e) {
      raw = JSON.stringify({ error: { type: 'network', message: String(e.message || e) } });
      status = 599;
    }
    const ms = Date.now() - t0;
    const u = (data && data.usage) || null;
    const usd = costOf(sent.model, u);
    ledger.usd += usd; ledger.calls++; saveLedger();
    if (u) { usage.input_tokens += u.input_tokens || 0; usage.output_tokens += u.output_tokens || 0; usage.costUsd += usd; }
    const text = data ? textOf(data) : '';
    const rec = { n: calls.length + 1, kind, model: sent.model, status, ms, stop_reason: data && data.stop_reason, usage: u, usd: +usd.toFixed(5), images: (body.messages[0].content || []).filter(b => b.type === 'image').length, text: text.slice(0, 4000) };
    if (status !== 200) rec.error = raw.slice(0, 500);
    calls.push(rec);

    if (status === 200) {
      if (kind === 'pieces') {
        try { const m = text.match(/\[[\s\S]*\]/); stepA = m ? JSON.parse(m[0]) : []; } catch (e) { stepA = []; }
      } else if (kind === 'clef') {
        const m = text.match(/\b(Do|Fa)\b[\s\S]{0,25}?\bLINE\s*([1-4])\b/i);
        cur = { clef: m ? (/do/i.test(m[1]) ? 'c' : 'f') + m[2] : 'c3', clefParsed: !!m, attempts: {}, omr: null };
        pieces.push(cur);
      } else if (kind === 'gabc' && cur) {
        const m = prompt.match(/Transcribe systems #(\d+) through #(\d+)/);
        const from = parseInt(m[1], 10), to = parseInt(m[2], 10);
        const parsed = parseBatchText(text);
        rec.batch = [from, to]; rec.hadMarker = parsed.hadMarker; rec.nLines = parsed.lines.length;
        for (let s = from; s <= to; s++) (cur.attempts[s] = cur.attempts[s] || []).push(parsed.lines[s - from] || '');
      }
    }
    process.stdout.write('  ' + String(rec.n).padStart(2) + ' ' + kind.padEnd(6) + ' ' + status + ' ' + (rec.stop_reason || '-').padEnd(10) + ' ' + (u ? (u.input_tokens + '/' + u.output_tokens).padEnd(12) : ''.padEnd(12)) + ' ' + (ms / 1000).toFixed(1) + 's  $' + ledger.usd.toFixed(3) + '\n');
    return route.fulfill({ status, contentType: 'application/json', body: raw });
  });

  await page.exposeFunction('__omrRecord', rec => { if (cur) cur.omr = rec; });
  const t0 = Date.now();
  await page.goto('file://' + path.join(REPO, 'index.html'));
  await page.waitForFunction(() => !!window.pdfjsLib, null, { timeout: 30000 });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    // Dialoge und GregoBase umgehen: alle Stuecke lesen, nichts nachfragen.
    window.gregPickPieceModal = async () => 'ALL';
    window.gregImportTargetChoice = async () => 'section';
    window.ntConfirmDiscard = async () => true;
    window.gregConfirmModal = async () => true;
    window.gregSearchGregoBase = async () => [];
    const omr = window.omrCorrectAllSystems;
    window.omrCorrectAllSystems = async function (lines, items, statusFn) {
      const out = await omr(lines, items, statusFn);
      try { await window.__omrRecord({ before: lines.slice(), after: out.slice(), nItems: items.length }); } catch (e) {}
      return out;
    };
    const load = window.gregLoadPDF;
    window.__done = false;
    window.gregLoadPDF = async function (input) { try { return await load(input); } finally { window.__done = true; } };
    document.getElementById('greg-api-key').value = 'abgefangen-kein-echter-key';
  });
  await page.setInputFiles('#greg-pdf-in', scan);
  await page.waitForFunction(() => window.__done === true, null, { timeout: 30 * 60 * 1000 });
  const status = await page.evaluate(() => (document.getElementById('greg-status') || {}).textContent || '');
  const durationMs = Date.now() - t0;
  await browser.close();

  // Ergebnisse schreiben
  const processed = (stepA || []).filter(p => p.systems !== 0);
  const meta = k => {
    const p = processed[k] || (stepA || [])[k] || {};
    return { incipit: p.incipit || '', mode: p.mode == null ? '' : String(p.mode), hasDropCap: p.hasDropCap === true || p.hasDropCap === 'true', systemsDetected: p.systems };
  };
  const base = { model: a.model || (calls[0] && calls[0].model) || '', effort: a.effort || null, pipeline: 'index.html unverändert' + (a.model ? ', Aufrufe umgeschrieben (Modell, ohne temperature, max_tokens 16000' + (a.effort ? ', effort ' + a.effort : '') + ')' : ''), case: a.case };
  const write = (series, file, obj) => {
    const d = path.join(ROOT, 'runs', series, a.case);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, file), JSON.stringify(obj, null, 2) + '\n');
  };
  const sysNums = p => Object.keys(p.attempts).map(Number).sort((x, y) => x - y);
  const maxRep = Math.max(0, ...pieces.flatMap(p => Object.values(p.attempts).map(v => v.length)));

  write(a.series, 'run-01.json', Object.assign({}, base, {
    stage: 'Endergebnis nach Geometrie',
    pieces: pieces.map((p, k) => Object.assign(meta(k), { clef: p.clef, systems: p.omr ? p.omr.after : [] })),
    usage: { input_tokens: usage.input_tokens, output_tokens: usage.output_tokens, costUsd: +usage.costUsd.toFixed(4) },
    durationMs,
  }));
  write(a.series + '-vor-geometrie', 'run-01.json', Object.assign({}, base, {
    stage: 'Konsens vor Geometrie',
    pieces: pieces.map((p, k) => Object.assign(meta(k), { clef: p.clef, systems: p.omr ? p.omr.before : [] })),
  }));
  for (let r = 0; r < maxRep; r++) {
    write(a.series + '-roh', 'run-0' + (r + 1) + '.json', Object.assign({}, base, {
      stage: 'Einzeldurchlauf ' + (r + 1),
      pieces: pieces.map((p, k) => Object.assign(meta(k), { clef: p.clef, systems: sysNums(p).map(s => p.attempts[s][r] || '') })),
    }));
  }
  const logDir = path.join(ROOT, 'runs', a.series);
  fs.writeFileSync(path.join(logDir, '_log-' + a.case + '.json'), JSON.stringify({ base, status, stopped, stepA, pieces: pieces.map(p => ({ clef: p.clef, clefParsed: p.clefParsed, omr: p.omr })), calls, console: consoleLines.filter(l => /OMR|Clef|Batch|System|Stück|GregoBase|PAGEERROR|Seite/.test(l)).slice(0, 200) }, null, 2) + '\n');

  console.log('Status in Notator: ' + status);
  console.log('Stücke: ' + (stepA ? stepA.length : 0) + ' erkannt, ' + pieces.length + ' verarbeitet · Aufrufe: ' + calls.length + ' · ' + usage.input_tokens + '/' + usage.output_tokens + ' Tokens · $' + usage.costUsd.toFixed(3) + ' · ' + (durationMs / 1000).toFixed(0) + ' s' + (stopped ? ' · ABGEBROCHEN: ' + stopped : ''));
  return stopped ? 3 : 0;
}

main().then(c => { process.exitCode = c; }, e => { console.error('Fehler: ' + (e && e.stack || e)); process.exitCode = 2; });
