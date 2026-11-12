#!/usr/bin/env node
/* Tests für shared/gd-core.js (ohne Abhängigkeiten): node tests/gd-core.test.js
   Google-Anmeldung, Drive und Speicher werden simuliert. Prüft auch, dass der Block in index.html aktuell ist. */
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert'), cp = require('child_process');
const root = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(root, 'shared/gd-core.js'), 'utf8');
let ok = 0, fail = 0;
const tests = [];
const test = (n, f) => tests.push([n, f]);

function env(opts) {
  opts = opts || {};
  const mk = () => { const d = {}; return { getItem: k => k in d ? d[k] : null, setItem: (k, v) => { d[k] = String(v); }, removeItem: k => { delete d[k]; }, _d: d }; };
  const ls = mk(), ss = mk();
  const calls = { init: [], request: [], fetch: [] };
  let answer = opts.answer || (() => ({ access_token: 'NEU', expires_in: 3600 }));
  const client = cfg => ({ cfg, callback: null, error_callback: null, requestAccessToken(o) { calls.request.push(o); const r = answer(o); if (r !== 'hang') Promise.resolve().then(() => this.callback(r)); } });
  const ctx = {
    console, Date, JSON, Promise, Object, String, Error, setTimeout: (f, ms) => (ms >= 12000 ? 0 : setTimeout(f, ms)),
    localStorage: ls, sessionStorage: ss,
    google: { accounts: { oauth2: { initTokenClient: cfg => { calls.init.push(cfg); return client(cfg); } } } },
    document: { createElement: () => ({}), head: { appendChild() {} } },
    fetch: (url, o) => { calls.fetch.push({ url, o }); const st = opts.status ? opts.status(url) : 200; return Promise.resolve({ status: st, ok: st < 400, json: () => Promise.resolve({ user: { emailAddress: 'a@b.ch' } }), text: () => Promise.resolve('Fehlertext') }); },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  ctx._cid = opts.cid === undefined ? 'CID-1' : opts.cid;
  const GD = vm.runInContext("gdCoreCreate({ clientId: () => _cid, scope: 'S', tokenKey: 'tk', hintKey: 'hk' })", ctx);
  return { GD, ctx, ls, ss, calls, setAnswer: f => { answer = f; } };
}
const put = (ls, token, inMs) => ls.setItem('tk', JSON.stringify({ token, exp: Date.now() + inMs }));
const tick = () => new Promise(r => setTimeout(r, 5));

test('cached: gültig nur bei mehr als 1 Min. Restlaufzeit', () => {
  const { GD, ls } = env();
  assert.equal(GD.cached(), null);
  put(ls, 'T', 30000); assert.equal(GD.cached(), null);
  put(ls, 'T', 120000); assert.equal(GD.cached(), 'T');
  assert.ok(GD.expiresIn() > 100000);
});
test('sessionStorage als Ausweichspeicher wird gelesen', () => {
  const { GD, ss } = env(); put(ss, 'S', 3600000); assert.equal(GD.cached(), 'S');
});
test('token: gespeicherten Token verwenden, ohne Google zu fragen', async () => {
  const { GD, ls, calls } = env(); put(ls, 'ALT', 3600000);
  assert.equal(await GD.token(true), 'ALT'); assert.equal(calls.request.length, 0);
});
test('token ohne interactive: Meldung «Nicht bei Google angemeldet»', async () => {
  const { GD } = env(); await assert.rejects(GD.token(false), /Nicht bei Google angemeldet/);
});
test('token ohne Client-ID: Meldung «noch nicht eingerichtet»', async () => {
  const { GD } = env({ cid: '' }); await assert.rejects(GD.token(true), /noch nicht eingerichtet/);
});
test('Anmeldung speichert Token, Konto-Hinweis und E-Mail', async () => {
  const { GD, ls, calls } = env();
  assert.equal(await GD.token(true), 'NEU');
  assert.equal(JSON.parse(ls.getItem('tk')).token, 'NEU');
  assert.deepEqual(calls.request, [{ prompt: '' }]);
  await tick(); assert.equal(ls.getItem('hk'), 'a@b.ch');
});
test('Konto-Hinweis mit E-Mail wird an Google übergeben', async () => {
  const { GD, ls, calls } = env(); ls.setItem('hk', 'x@y.ch');
  await GD.token(true); assert.equal(calls.init[0].hint, 'x@y.ch'); assert.equal(calls.init[0].scope, 'S');
});
test('silent: prompt «none»', async () => {
  const { GD, calls } = env(); await GD.token(true, { silent: true }); assert.deepEqual(calls.request, [{ prompt: 'none' }]);
});
test('gleichzeitige Anmeldungen teilen eine Anfrage', async () => {
  const { GD, calls } = env();
  const [a, b] = await Promise.all([GD.token(true), GD.token(true)]);
  assert.equal(a, 'NEU'); assert.equal(b, 'NEU'); assert.equal(calls.request.length, 1);
});
test('force erneuert trotz gültigem Token', async () => {
  const { GD, ls } = env(); put(ls, 'ALT', 3600000);
  assert.equal(await GD.token(true, { force: true }), 'NEU'); assert.equal(GD.cached(), 'NEU');
});
test('force: alter Token bleibt während und nach fehlgeschlagener Erneuerung erhalten', async () => {
  const e = env({ answer: () => ({ error: 'interaction_required' }) }); put(e.ls, 'ALT', 300000);
  const p = e.GD.token(true, { force: true });
  assert.equal(e.GD.cached(), 'ALT', 'während der Erneuerung');
  await assert.rejects(p, /Google-Anmeldung: interaction_required/);
  assert.equal(e.GD.cached(), 'ALT', 'nach dem Fehlschlag');
});
test('geänderte Client-ID baut den Google-Client neu auf', async () => {
  const e = env(); await e.GD.token(true, { force: true }); e.ctx._cid = 'CID-2'; await e.GD.token(true, { force: true });
  assert.deepEqual(e.calls.init.map(c => c.client_id), ['CID-1', 'CID-2']);
});
test('fetch: Token im Header', async () => {
  const { GD, ls, calls } = env(); put(ls, 'T', 3600000);
  await GD.fetch('https://x/files', { headers: { A: '1' } }, false);
  assert.deepEqual(calls.fetch[0].o.headers, { A: '1', Authorization: 'Bearer T' });
});
test('fetch 401: Token gelöscht, Meldung enthält «abgelaufen»', async () => {
  const { GD, ls } = env({ status: () => 401 }); put(ls, 'T', 3600000);
  await assert.rejects(GD.fetch('https://x', {}, false), /abgelaufen/); assert.equal(GD.cached(), null);
});
test('fetch 404: Meldung «Drive-Fehler 404: …» (Schola-Planer wertet das aus)', async () => {
  const { GD, ls } = env({ status: () => 404 }); put(ls, 'T', 3600000);
  await assert.rejects(GD.fetch('https://x', {}, false), /^Error: Drive-Fehler 404: Fehlertext$/);
});
test('index.html enthält die aktuelle gd-core-Fassung', () => {
  cp.execFileSync('python3', [path.join(root, 'tools/gd-core-sync.py'), '--check'], { stdio: 'pipe' });
});

(async () => {
  console.log('gd-core');
  for (const [n, f] of tests) {
    try { await f(); ok++; console.log('  ✓', n); } catch (e) { fail++; console.log('  ✗', n, '\n    ', e && e.message); }
  }
  console.log(`\n${ok} ok, ${fail} fehlgeschlagen`);
  process.exit(fail ? 1 : 0);
})();
