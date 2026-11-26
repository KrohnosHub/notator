// Einfügen an beliebiger Stelle (Build 448): Einfügemarke, Notizanker, Neumentyp aus dem Tonverlauf,
// Export ergänzter Töne. Aufruf: node tests/einfuegen.test.js (nur Playwright nötig)
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.route(/^https?:\/\//, r => r.abort());
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await p.waitForTimeout(2500);
  const res = await p.evaluate(() => {
    const out = [];
    const ok = (name, cond, info) => out.push([name, !!cond, info || '']);
    const seq = () => gregEntries.map(e => e.type === 'note' ? (e.syllable || '·') + '(' + e.pitches.join('') + ')' : e.type === 'divisio' ? '(' + e.div + ')' : e.type).join(' ');
    gregImportGABCString('%%\n(c4) a(f) b(g) c(h) (::)', {deferRender: true});
    gregEntries.push({type: 'comment', text: 'N', anchorNoteIdx: 2});               // Notiz an «c»
    window._gregInsAt = null;
    gregAddEntries({type: 'divisio', div: ';'});
    ok('ohne Marke am Ende', /\(::\) \(;\)$/.test(seq().replace(/ comment/, '')), seq());
    gregEntries.pop();
    gregInsSet(1);                                                                   // nach «a»
    gregAddEntries({type: 'note', syllable: 'x', neume: 'punctum', pitches: ['j']});
    gregAddEntries({type: 'note', syllable: 'y', neume: 'punctum', pitches: ['i']});
    ok('Marke rückt weiter', seq().startsWith('a(f) x(j) y(i) b(g)'), seq());
    ok('Notizanker mitverschoben', gregEntries.find(e => e.type === 'comment').anchorNoteIdx === 4, gregEntries.find(e => e.type === 'comment').anchorNoteIdx);
    gregInsClear(true);
    ok('Marke aufgehoben', window._gregInsAt === null);
    ok('Neumentyp aus Verlauf', gregNeumeFromPitches(['g', 'h']) === 'podatus' && gregNeumeFromPitches(['h', 'g', 'h']) === 'porrectus' &&
      gregNeumeFromPitches(['f', 'g', 'f']) === 'torculus' && gregNeumeFromPitches(['h', 'g', 'f', 'e']) === 'climacus');
    gregEntries = [{type: 'note', syllable: 'a', neume: 'punctum', pitches: ['f', 'g'], wordEnd: true}];
    ok('ergänzte Töne nicht verloren', /a\(fg\)/.test(gregBuildGABC()), gregBuildGABC().replace(/^[\s\S]*?%%\s*/, ''));
    return out;
  });
  await b.close();
  let bad = 0;
  for (const [n, pass, info] of res) { if (!pass) bad++; console.log((pass ? 'ok      ' : 'FEHLER  ') + n + (pass ? '' : '  ' + info)); }
  if (errs.length) { bad += errs.length; console.log('Seitenfehler: ' + errs.join(' | ')); }
  console.log(bad ? bad + ' Fehler' : 'Alles ok.');
  process.exit(bad ? 1 : 0);
})();
