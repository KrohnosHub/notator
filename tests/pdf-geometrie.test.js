// Tests für src/js/2-choral/172-pdf-geometrie.js («PDF lesen», geometrischer Teil).
// Aufruf: node tests/pdf-geometrie.test.js
//  1. Silben- und Notenzuordnung gegen die Ergebnisse des Python-Prototyps (36 Systeme, tests/pdf-geometrie-fixtures.json)
//  2. Synthetisches Notenbild: Linien, Notenköpfe, Trennstrich – Tonhöhen und Strich müssen erkannt werden
//  3. Nur lokal, falls die Scans vorliegen (tests/pdf-lesen/cases/*/scan.pdf, pdftoppm, python3 mit numpy/Pillow):
//     ganze Seiten gegen tests/pdf-lesen/geometrie/dump.py
const fs = require('fs'), vm = require('vm'), path = require('path'), cp = require('child_process'), os = require('os');
// runInThisContext statt eigenem Kontext: Typed Arrays aus fremden Kontexten machen V8 hier um ein Vielfaches langsamer
vm.runInThisContext(fs.readFileSync(path.join(__dirname, '../src/js/2-choral/172-pdf-geometrie.js'), 'utf8'));
vm.runInThisContext(fs.readFileSync(path.join(__dirname, '../src/js/2-choral/174-pdf-lesen-neu.js'), 'utf8'));
let bad = 0, ok = 0;
const check = (cond, msg) => { if (cond) ok++; else { bad++; console.log('FEHLER  ' + msg); } };

// 1. Zuordnung Text → Tintengruppen → Noten
const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'pdf-geometrie-fixtures.json'), 'utf8'));
globalThis._pgNurPrototyp = true;                  // Vergleich mit dem Prototyp: ohne die Ergänzungen ab Build 412 (z. B. Build 422: Strafe leere Silbe)
for (const f of fx) {
  const staff = {gl: f.gl, dropcap: f.dropcap, x0: 0, x1: 0,
    notes: f.notes.map(([x, letter]) => ({x, letter})), bars: f.bars.map(([x, type]) => ({x, type})),
    chunks: f.chunks.map(([x0, x1, hyphen]) => ({x0, x1, hyphen}))};
  const got = pgStaffGabc(staff, f.text);
  check(got === f.gabc, f.case + ' System ' + f.staff + '\n   erhalten: ' + got + '\n   erwartet: ' + f.gabc);
}

globalThis._pgNurPrototyp = false;

// 1b. Neue Erkennung (174): Stückgrenzen an Initialen, fremder Text bereinigt, GABC mit Schlüssel und Schlussstrich
(function () {
  const mk = (dropcap, clef, text) => ({page: 1, text: pgSafeText(text), staff: {dropcap, clef, gl: 30, x0: 0, x1: 300,
    notes: [{x: 10, letter: 'f'}, {x: 100, letter: 'g'}], bars: [], chunks: [{x0: 0, x1: 60, hyphen: false}, {x0: 90, x1: 150, hyphen: false}]}});
  const items = [mk([0, 0, 9, 9], 'c4', 'SAl-ve Re-gí-na'), mk(null, 'c4', 'ma-ter (mi) {x}'), mk([0, 0, 9, 9], 'c3', 'A-ve <b>Ma</b>')];
  items[0].mode = '5';
  check(items[1].text === 'ma-ter mi x', 'pgSafeText entfernt GABC-Zeichen: ' + items[1].text);
  const ps = pgPieces(items);
  check(ps.length === 2 && ps[0].systems === 2 && ps[1].systems === 1, 'pgPieces: Stückgrenze an der Initiale');
  check(ps[0].mode === '5' && ps[1].mode === '?', 'pgPieces: Modus ' + ps[0].mode + ' / ' + ps[1].mode);
  check(ps[0].incipit === 'SAlve Regína mater mi x' && ps[1].clef === 'c3', 'pgPieces: Incipit/Schlüssel ' + ps[0].incipit + ' / ' + ps[1].clef);
  const g = pgPieceGabc(ps[0], true);
  check(/^annotation: 5\ndrop-cap: auto\n%%\n\n\(c4\) /.test(g) && /\(::\)$/.test(g) && !/[{}<>]/.test(g), 'pgPieceGabc: ' + g);
})();

// 2. Synthetisches System: 4 Linien (Abstand 39 px), Do-Schlüssel auf Linie 4, Noten d f h e, Trennstrich, Text darunter
(function () {
  const W = 2480, H = 700, img = {w: W, h: H, a: new Uint8Array(W * H).fill(255)};
  const rect = (x0, y0, x1, y1) => { for (let y = Math.round(y0); y < Math.round(y1); y++) for (let x = Math.round(x0); x < Math.round(x1); x++) img.a[y * W + x] = 0; };
  const gl = 39, top = 250, x0 = 300, x1 = 2200, lineY = k => top + k * gl;       // k = 0 oben … 3 unten
  for (let k = 0; k < 4; k++) rect(x0, lineY(k) - 1, x1, lineY(k) + 2);
  rect(x0 + 5, lineY(0) - 0.45 * gl, x0 + 22, lineY(0) - 0.08 * gl);                 // Do-Schlüssel: zwei Blöcke um Linie 1 (oben)
  rect(x0 + 5, lineY(0) + 0.08 * gl, x0 + 22, lineY(0) + 0.45 * gl);
  const pitches = ['d', 'f', 'h', 'e', 'g', 'j'];                                    // d = unterste Linie, j = oberste
  const yOf = p => lineY(3) - ('defghij'.indexOf(p)) * gl / 2;
  pitches.forEach((p, i) => { const cx = x0 + 200 + i * 220; rect(cx - 10, yOf(p) - 8, cx + 10, yOf(p) + 8); });
  rect(x0 + 200 + 6 * 220 - 2, lineY(0) - 2, x0 + 200 + 6 * 220 + 2, lineY(3) + 2);  // Trennstrich über alle Linien
  for (let i = 0; i < 6; i++) rect(x0 + 180 + i * 220, lineY(3) + 2 * gl, x0 + 230 + i * 220, lineY(3) + 2.6 * gl);   // «Text»
  const r = pgAnalysePage(img);
  check(r.staves.length === 1, 'synthetisch: 1 System erwartet, gefunden ' + r.staves.length);
  if (r.staves.length) {
    const s = r.staves[0];
    check(s.notes.map(n => n.letter).join('') === pitches.join(''), 'synthetisch: Tonhöhen ' + s.notes.map(n => n.letter).join('') + ' statt ' + pitches.join(''));
    check(s.bars.length === 1 && s.bars[0].type === ':', 'synthetisch: Trennstrich ' + JSON.stringify(s.bars));
    check(s.clef === 'c4', 'synthetisch: Schlüssel ' + s.clef + ' statt c4');
    check(s.chunks.length === 6, 'synthetisch: Textgruppen ' + s.chunks.length + ' statt 6');
  }
})();

function pgEdit(a, b) {
  let prev = Array.from({length: b.length + 1}, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
// 3. Echte Seiten gegen den Python-Prototyp (nur wenn alles lokal vorhanden ist)
(function () {
  const casesDir = path.join(__dirname, 'pdf-lesen/cases');
  const cases = fs.existsSync(casesDir) ? fs.readdirSync(casesDir).filter(c => fs.existsSync(path.join(casesDir, c, 'scan.pdf'))) : [];
  const has = cmd => { try { cp.execSync(cmd, {stdio: 'ignore'}); return true; } catch (e) { return false; } };
  if (!cases.length || !has('pdftoppm -v') || !has('python3 -c "import numpy, PIL"')) { console.log('Echte Seiten: übersprungen (keine Scans oder Werkzeuge)'); return; }
  globalThis._pgNurPrototyp = true;                // nur der übertragene Prototyp, ohne die Ergänzungen ab Build 412
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-'));
  for (const c of cases) {
    const base = path.join(tmp, c);
    cp.execFileSync('pdftoppm', ['-r', '300', '-f', '1', '-l', '1', '-singlefile', '-gray', path.join(casesDir, c, 'scan.pdf'), base]);
    cp.execFileSync('python3', [path.join(__dirname, 'pdf-lesen/geometrie/dump.py'), base + '.pgm', base + '.json'], {stdio: 'ignore'});
    const ref = JSON.parse(fs.readFileSync(base + '.json', 'utf8'));
    const b = fs.readFileSync(base + '.pgm'), hd = b.slice(0, 20).toString().split(/\s+/), w = +hd[1], h = +hd[2];
    const r = pgAnalysePage({w, h, a: new Uint8Array(b.buffer, b.byteOffset + b.length - w * h, w * h).slice()});
    check(r.staves.length === ref.staves.length, c + ': Systeme ' + r.staves.length + ' statt ' + ref.staves.length);
    r.staves.forEach((s, k) => {
      const p = ref.staves[k]; if (!p) return;
      // Höchstens eine Note bzw. Textgruppe Unterschied gilt als Hinweis: Rundungs-Grenzfälle der Bilddrehung (ad-te-levavi,
      // Build 417: Python trennt ein Notenpaar, JS verwirft den Rest als «klein» – in der App fängt die Paar-Regel ihn auf)
      const js = s.notes.map(n => n.letter).join(''), ed = pgEdit(js, p.letters);
      if (ed === 1) console.log('Hinweis ' + c + ' System ' + (k + 1) + ': 1 Note Unterschied (' + js + ' / ' + p.letters + ')');
      check(ed <= 1, c + ' System ' + (k + 1) + ': Noten weichen ab');
      check(s.clef === p.clef, c + ' System ' + (k + 1) + ': Schlüssel ' + s.clef + ' statt ' + p.clef);
      check(s.bars.map(x => x.type).join('') === p.bars.map(x => x[1]).join(''), c + ' System ' + (k + 1) + ': Trennstriche weichen ab');
      check(!!s.dropcap === !!p.dropcap, c + ' System ' + (k + 1) + ': Initiale weicht ab');
      if (Math.abs(s.chunks.length - p.chunks.length) === 1) console.log('Hinweis ' + c + ' System ' + (k + 1) + ': Textgruppen ' + s.chunks.length + ' statt ' + p.chunks.length);
      check(Math.abs(s.chunks.length - p.chunks.length) <= 1, c + ' System ' + (k + 1) + ': Textgruppen ' + s.chunks.length + ' statt ' + p.chunks.length);
    });
  }
  fs.rmSync(tmp, {recursive: true, force: true});
  globalThis._pgNurPrototyp = false;
})();

console.log(bad ? bad + ' Fehler, ' + ok + ' ok' : 'Alle ' + ok + ' Prüfungen bestanden.');
process.exitCode = bad ? 1 : 0;
