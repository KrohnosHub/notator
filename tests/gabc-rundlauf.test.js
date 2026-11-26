// GABC-Rundlauf (Build 443): Import → Export → Import → Export muss stabil sein, und bekannte Problemfälle
// dürfen nichts verlieren. Prüft alle Soll-Stücke aus tests/pdf-lesen/cases/*/expected.json (rund 60 echte
// Choralstücke) und eine Liste gezielter Fälle.
//
//   node tests/gabc-rundlauf.test.js
//
// Nur Playwright nötig. Externe Netzzugriffe werden blockiert.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');

// [Eingabe, erwartete Ausgabe nach dem Export (ohne Kopf)]
const FAELLE = [
  // Silben ohne Noten mitten im Wort blieben früher nicht beisammen («A() do() ré() mus.()»)
  ['(c4) A()do()ré()mus.() Gló(d)ri(f)a(h)', '(c4) A()do()ré()mus.() Gló(d)ri(f)a(h)'],
  ['(c4) glo()ri(f)a() (::)', '(c4) glo()ri(f)a() (::)'],
  // Silbe an einer reinen Vorzeichen-Gruppe: exsurge verlor das ganze Wort (Notator-Patch in exsurge.js)
  ['(c4) a(f) vé(ix)(i)runt(h.) o(g)', '(c4) a(f) (ix)vé(i)runt(h.) o(g)'],
  ['(c4) a(f) Sán(h_)(ix)cte(g.) o(g)', '(c4) a(f) Sán(h_)(ix)cte(g.) o(g)'],
  // Bivirga/Trivirga/Distropha: exsurge gab der zweiten Note die Tonhöhe «g», der Rohtext verschob Noten auf Nachbarsilben (Build 444)
  ['(c4) le(gvv) a(g) b(hvvv) d(jss) e(fsss.) f(hvv.) g(g)', '(c4) le(gvv) a(g) b(hvvv) d(jss) e(fsss.) f(hvv.) g(g)'],
  // Neumenschrift nach «|» und [alt:…] in der Gruppe sind keine Noten (Build 444)
  ['(c3) VI(d|ta) runt(fh~|pe~) Te([alt:Tonus solemnis.]e) su(d|vi)am.(cd/efe.|/toS2hhpp2) (,)', '(c3) VI(d) runt(fh~) Te(e) su(d)am.(cd/efe.) (,)'],
  // ℣ am Trennstrich, Text über dem System ohne Silbe, Gruppe mit Leerzeichen (Build 444)
  ['(c4) ia.(f) <sp>V/</sp>.(::) Cap(f)', '(c4) ia.(f) <sp>V/</sp>.(::) Cap(f)'],
  ['(c4) a(e) (::) <alt>Hic genuflectitur</alt>() Te(e)', '(c4) a(e) (::) <alt>Hic genuflectitur</alt>() Te(e)'],
  ['(c4) a(e) <i>Chorus repetit</i>( ) At(e)', '(c4) a(e) <i>Chorus repetit</i>() At(e)'],
  // getrennte notenlose Wörter bleiben getrennt
  ['(c4) Ant.() Ps.() <i>Ant.</i>() ij.()', '(c4) Ant.() Ps.() <i>Ant.</i>() ij.()'],
];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.route(/^https?:\/\//, r => r.abort());
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForTimeout(2500);
  await p.evaluate(() => { try { closeModal(); } catch (e) { /* kein Dialog */ } });

  const stuecke = [];
  const cdir = path.join(ROOT, 'tests/pdf-lesen/cases');
  for (const c of fs.readdirSync(cdir)) {
    const f = path.join(cdir, c, 'expected.json');
    if (!fs.existsSync(f)) continue;
    (JSON.parse(fs.readFileSync(f, 'utf8')).pieces || []).forEach((pc, i) => {
      if (pc.systems) stuecke.push([c + '#' + i, '(' + (pc.clef || 'c4') + ') ' + pc.systems.join('\n')]);
    });
  }

  const res = await p.evaluate(([faelle, stuecke]) => {
    const norm = s => s.replace(/^[\s\S]*?%%\s*/, '').replace(/\s+/g, ' ').trim();
    const rund = g => { gregImportGABCString('%%\n' + g, {deferRender: true}); return norm(gregBuildGABC()); };
    const out = {faelle: [], instabil: []};
    for (const [ein, soll] of faelle) { const ist = rund(ein); out.faelle.push([ein, soll, ist]); }
    for (const [id, g] of stuecke) {
      const a = rund(g), c = rund(a);
      if (a !== c) {
        let i = 0; while (i < a.length && a[i] === c[i]) i++;
        out.instabil.push([id, a.slice(Math.max(0, i - 50), i + 30), c.slice(Math.max(0, i - 50), i + 30)]);
      }
    }
    return out;
  }, [FAELLE, stuecke]);
  await b.close();

  let fehler = 0;
  for (const [ein, soll, ist] of res.faelle) {
    if (ist === soll) console.log('ok      ' + ein);
    else { fehler++; console.log('FEHLER  ' + ein + '\n        erwartet: ' + soll + '\n        erhalten: ' + ist); }
  }
  for (const [id, a, c] of res.instabil) { fehler++; console.log('INSTABIL ' + id + '\n        1. Runde: …' + a + '\n        2. Runde: …' + c); }
  if (errs.length) { fehler += errs.length; console.log('Seitenfehler: ' + errs.join(' | ')); }
  console.log(stuecke.length + ' Stücke stabil geprüft, ' + res.faelle.length + ' gezielte Fälle.');
  console.log(fehler ? fehler + ' Fehler' : 'Alles ok.');
  process.exit(fehler ? 1 : 0);
})();
