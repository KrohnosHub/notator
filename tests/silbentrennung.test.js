// Prüft ntPtSyllabify (src/js/3-orgel-und-mehr/160-psalmton-assistent.js) gegen die Solesmes-Konvention (docs/WISSEN.md, 4a).
// Aufruf: node tests/silbentrennung.test.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../src/js/3-orgel-und-mehr/160-psalmton-assistent.js'), 'utf8');
const start = src.indexOf('const NT_PT_ACUTE'), end = src.indexOf('\n}\n', src.indexOf('function ntPtSyllabify')) + 2;
const ctx = {}; vm.createContext(ctx);
vm.runInContext(src.slice(start, end).replace('const NT_PT_ACUTE', 'var NT_PT_ACUTE') + '\nthis.f = ntPtSyllabify;', ctx);
const cases = {
  'benedícta': 'be-ne-dí-cta', 'Sanctus': 'San-ctus', 'frúctus': 'frú-ctus', 'ómnium': 'ó-mni-um', 'omnes': 'o-mnes',
  'nostra': 'no-stra', 'Patri': 'Pa-tri', 'agnus': 'a-gnus', 'redémptor': 're-dém-ptor', 'ipse': 'i-pse',
  'Christe': 'Chri-ste', 'réspice': 'ré-spi-ce', 'exsultáte': 'ex-sul-tá-te', 'excélsis': 'ex-cél-sis',
  'monstra': 'mon-stra', 'abstíne': 'ab-stí-ne', 'transgrédi': 'trans-gré-di', 'Israël': 'Is-ra-ël',
  'Dóminus': 'Dó-mi-nus', 'glória': 'gló-ri-a', 'lacrimárum': 'la-cri-má-rum', 'sæculórum': 'sæ-cu-ló-rum',
  'eius': 'e-ius', 'quóniam': 'quó-ni-am', 'sanguis': 'san-guis', 'littera': 'lit-te-ra', 'adjútor': 'ad-jú-tor',
  'sancta': 'san-cta', 'perféctum': 'per-fé-ctum', 'cognósce': 'co-gnó-sce', 'Glo-ri-a': 'Glo-ri-a',
};
let bad = 0;
for (const [w, want] of Object.entries(cases)) {
  const got = ctx.f(w).join('-');
  if (got !== want) { bad++; console.log('FALSCH  ' + w + ': ' + got + '  (erwartet ' + want + ')'); }
}
console.log(bad ? bad + ' von ' + Object.keys(cases).length + ' falsch' : 'Alle ' + Object.keys(cases).length + ' Wörter richtig getrennt.');
process.exitCode = bad ? 1 : 0;
