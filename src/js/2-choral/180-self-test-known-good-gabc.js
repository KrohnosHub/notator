// ── Self-test: known-good GABC roundtrip cases ──────────────────
// Guards against regressions in gregImportGABCString()/gregEntriesToBody()
// — several of the bugs found across many rounds of testing (accidentals
// silently dropped mid-melisma, syllables lost before a bare divisio,
// wrong Punctum-inclinatum casing, word-boundary corruption...) would all
// have been caught immediately by a test like this instead of needing a
// user to notice a subtly wrong printout. Runs entirely against the SAME
// production code the app itself uses (not a separate reimplementation),
// using REAL GABC excerpts (including one full real chant, sourced from
// GregoBase) rather than invented test strings.
//
// Safe to run any time, including with a real document open: the current
// gregEntries/UI are saved before the test imports run and restored
// afterwards, so nothing in the open document is affected.
//
// Call from the browser console: gregSelfTest()
function gregSelfTest() {
  const savedEntries = JSON.parse(JSON.stringify(gregEntries));
  const results = [];

  function check(name, clef, gabcIn, expectedOut) {
    try {
      gregImportGABCString(gabcIn);
      const actualOut = gregEntriesToBody(gregEntries, clef).trim();
      const expected = (expectedOut || gabcIn).trim();
      results.push({name, pass: actualOut === expected, expected, actual: actualOut});
    } catch (err) {
      results.push({name, pass: false, error: err.message, expected: expectedOut || gabcIn, actual: '(Fehler)'});
    }
  }

  // Round 16: accidental after a "//" mid-melisma divider used to be
  // silently dropped on export (only openParts[0] was ever checked).
  check('Vorzeichen nach "//" mitten in der Melisma', 'c4',
    "cén(gf//ixgig//hffd;fg//ig//hhgh>)tur(f) (::)",
    "(c4) cén(gf)(ix)(gig//hf/fd)(;)(fg//ig//h/hgh>)tur(f) (::)");

  // Round 21: a syllable directly attached to a bare divisio (no notes of
  // its own) used to be silently dropped — the BAR_MAP import branch never
  // checked nt.lyrics.
  check('Silbe vor reiner Divisio ("C(;4)")', 'c3',
    "(c3) C(;4) D(f) (::)");

  // Round 8: Punctum inclinatum (capital letter) casing for pes_subpunctis
  // — real Source & Summit-generated GABC capitalizes BOTH subpunctis
  // notes, not just the last one.
  check('Pes-subpunctis-Gross/Kleinschreibung ("efED")', 'c4',
    "A(efED) (::)",
    "(c4) A(efED) (::)");

  // Round 3/4/5/6: hyphen-/word-boundary handling around an accidental
  // ("te" carries "ix") — this is the exact excerpt that exposed the
  // Round-6 glue:false bug (accidental group wrongly inserted a GABC word
  // break) as well as the earlier accidental-import bug. Note the
  // accidental is deliberately restructured into its own preceding group
  // ("(ix)te(g)" not "te(ixg)") — that's the correct, by-design output
  // (see Round 6), not a regression.
  check('Wortgrenzen um ein Vorzeichen herum ("Emitte")', 'c4',
    "℣.E(hg)mít(gh)te(ixg) Spí(h)ri(h)tum(h) (::)",
    "(c4) ℣.E(hg)mít(gh)(ix)te(g) Spí(h)ri(h)tum(h) (::)");

  // Full real chant (Alleluia "Emitte Spiritum tuum", Pentecost, sourced
  // from GregoBase via its Source & Summit editor link) — the single most
  // useful test in this whole set, since it exercises accidentals,
  // versicle markers ("<sp>V/</sp>"), "//"/"!" dividers, italic directive
  // text ("ij."), and ordinary multi-syllable words together in one piece.
  check('Vollständiger echter Chant (Alleluia Pfingsten)', 'c4',
    "(c4) AL(fd~)le(ef'g)lú(hgh){ia}.(ixhiHG'gf.0) <clear>*(,) <i>ij.</i>(ixhiHG'ge./ghGF'Ef_gffe.) (::) <sp>V/</sp>. E(h)mít(h)te(ixg'//ivHG'hffe.) (,) Spí(fh)ri(ghg'/hf)tum(e[ll:1]d~) tu(egF'D)um,(d.) (:) et(dc~) cre(f)a(ghg)bún(ixhiG'Eg./hiF'D//fffdgvFE.)(,)(df/h_f/!g_[oh:h]e/!fv.df!gvef~)tur :(e.) (:) et(f) re(f)no(f)vá(ef)bis(f) fá(ef'g)ci(gdgvFE)em(e.) (,) * ter(fd/ef!g'h)rae.(ixhiHG'gf.0) (,) (ixhiHG'ge./ghGF'Ef_gffe.) (::)",
    "(c4) AL(fd~)le(ef'g)lú(hgh)(ix){ia}.(hiHG'/gf.) (,) (ix)_ij._(hiHG'/ge./ghGF'E/f_gf/fe.) (::) V/. E(h)mít(h)(ix)te(g'//ivHG'/hf/fe.) (,) Spí(fh)ri(ghg'/hf)tum(e[ll:1]d~) tu(egF'D)um,(d.) (:) et(dc~) cre(f)a(ghg)(ix)bún(hiG'E/g./hiF'D//ff/fd/gvFE.)(,)(df/h_f/g_[oh:h]e/fv./df!gv/ef~)tur :(e.) (:) et(f) re(f)no(f)vá(ef)bis(f) fá(ef'g)ci(gd/gvFE)em(e.) (,) * ter(fd/ef!g'h)(ix)rae.(hiHG'/gf.) (,) (ix)(hiHG'/ge./ghGF'E/f_gf/fe.) (::)");

  // ── Orgelfassung (Choral → klassische Noten, Begleitsatz, MusicXML) ──
  // Reine Funktionstests am Konverter; das offene Stück bleibt unberührt.
  function ocheck(name, fn, expected) {
    try {
      const actual = String(fn());
      results.push({name: 'Orgel: ' + name, pass: actual === String(expected), expected: String(expected), actual});
    } catch (err) {
      results.push({name: 'Orgel: ' + name, pass: false, error: err.message, expected: String(expected), actual: '(Fehler)'});
    }
  }
  const clMel = (gabc, opts) => {
    const abc = clGabcToAbc([{gabc}], opts || {}).abc.split('\n');
    return abc[abc.findIndex(l => l.startsWith('K:')) + 1];
  };
  ocheck('Tonhöhen, Achtel, Mora, Melisma-Bogen', () => clMel("(c4) Ky(fg)ri(h.)e(h) (::)"), '(FG) A2 A |]');
  ocheck('b molle gilt bis Wortende', () => clMel("(c4) a(ixi)b(i) c(i) (::)"), '_B B =B |]');
  ocheck('b molle wahlweise bis Trennstrich', () => clMel("(c4) a(ixi)b(i) c(i) (,) d(i) (::)", {flatToBar: true}), '_B B B !breath!y =B |]');
  ocheck('Episema → Viertel (gedehnt), Divisio minima → Atemzeichen', () => clMel("(c4) Ky(f_)ri(gh~)e(h) (,) e(g'ih)le(f) (::)"), 'F2 (GA) A !breath!y (GBA) F |]');
  ocheck('Note vor Quilisma → Viertel', () => clMel("(c4) Ky(fgwh)e(h) (::)"), '(F2GA) A |]');
  ocheck('Modale Transposition a-äolisch → c (3 ♭)', () => {
    const r = clGabcToAbc([{gabc: "(c4) Ky(fg)ri(h.)e(h) (::)"}], {targetPc: 0});
    return r.info.sigFifths + ' ' + clMel("(c4) Ky(fg)ri(h.)e(h) (::)", {targetPc: 0});
  }, '-3 (AB) c2 c |]');
  const oTest = "(c4) Ky(f)ri(gxg)e(hg/hi.) * (,) e(ixi)le(h_g)i(hiH)son.(g.) (;) Chri(fgf)ste(e) e(gh)le(i)i(h!iwj)son.(g.) (:) Ky(hi)ri(j)e(ixihg) e(f)le(g)i(ff)son.(f.) (::)";
  ocheck('Begleitsatz: alle Abschnitte vierstimmig, Schluss auf Finalis', () => {
    const r = clGabcToAbc([{gabc: oTest}], {accomp: true});
    const segs = r.models[0].segs;
    const bad = segs.filter(sg => !sg.voicing || !sg.voicing.A || !sg.voicing.T || !sg.voicing.B ||
      sg.notes.reduce((a, n) => a + n.dur, 0) !== sg.pulses).length;
    const last = segs[segs.length - 1];
    return bad + ' ' + (clMod(last.voicing.B.D, 7) === clMod(last.notes[last.notes.length - 1].pitch.D, 7));
  }, '0 true');
  ocheck('MusicXML wohlgeformt, Stimmen gleich lang', () => {
    const out = [];
    [false, true].forEach(acc => {
      const xml = clBuildMusicXml(clGabcToAbc([{gabc: oTest}], {accomp: acc}).models);
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      if (doc.getElementsByTagName('parsererror').length) { out.push('parsererror'); return; }
      let mism = 0;
      Array.from(doc.getElementsByTagName('measure')).forEach(m => {
        const tot = {};
        Array.from(m.getElementsByTagName('note')).forEach(n => {
          const v = n.getElementsByTagName('voice')[0].textContent;
          tot[v] = (tot[v] || 0) + parseInt(n.getElementsByTagName('duration')[0].textContent, 10);
        });
        if (new Set(Object.values(tot)).size > 1) mism++;
      });
      out.push(doc.getElementsByTagName('measure').length + 'T/' + doc.getElementsByTagName('lyric').length + 'S/' + mism);
    });
    return out.join(' ');
  }, '3T/20S/0 3T/20S/0');

  // ── Begleitsatz-Verfeinerung, Bibliothek, Teilen (Build 234–237) ──
  ocheck('Akkordvorgabe bleibt nach Einfügen einer Silbe erhalten', () => {
    const g1 = "(c4) Ky(f)ri(gxg)e(hg/hi.) * (,) e(ixi)le(h_g)i(hiH)son.(g.) (;) Chri(fgf)ste(e) e(gh)le(i)i(h!iwj)son.(g.) (::)";
    const g2 = g1.replace('(c4) ', '(c4) Al(f)le(g) ');
    const nm = r => { const sg = r.models[0].segs.find(s => s.key.split('|')[1] === 'Chri'); return clChordName(sg.chord) + (sg.inv ? '/6' : ''); };
    const r1 = clGabcToAbc([{gabc: g1}], {accomp: true});
    const sg = r1.models[0].segs.find(s => s.key.split('|')[1] === 'Chri');
    const pick = r1.segInfo[sg.key].candidates.map(c => c.deg).find(d => d !== r1.segInfo[sg.key].current);
    const ov = {}; ov[sg.key] = {d: pick, i: 1};
    const a = nm(clGabcToAbc([{gabc: g1}], {accomp: true, chordOverrides: ov}));
    const b = nm(clGabcToAbc([{gabc: g2}], {accomp: true, chordOverrides: ov}));
    return (a === b) + ' ' + /\/6$/.test(a);
  }, 'true true');
  ocheck('Pedalsystem: ABC-Kopf und MusicXML mit 3 Systemen', () => {
    const r = clGabcToAbc([{gabc: oTest}], {accomp: true, pedal: true});
    return /%%score \{\(S A\) \| T\} B/.test(r.abc) + ' ' + /<staves>3<\/staves>/.test(clBuildMusicXml(r.models));
  }, 'true true');
  ocheck('Bibliothek: Suche ohne Akzente, Tags, Drive-Feldlänge', () => {
    const it = { title: 'Kýrie XVI', meta: ntMetaNorm({ genre: 'Kyrie', tags: 'Hochamt, Schola', txt: 'Ký-ri-e e-lé-i-son' }) };
    const f = (q, extra) => ntLibMatches(it, Object.assign({ q, season: '', genre: '', tag: '' }, extra || {}));
    const ap = ntMetaToAppProps({ tags: Array(60).fill('Tagname').join(',') });
    return [f('kyrie'), f('eleison') === false, f('schola'), f('', { tag: 'Hochamt' }), f('', { genre: 'Gloria' }) === false,
      new TextEncoder().encode(ap.tags).length <= 110].join(' ');
  }, 'true true true true true true');
  ocheck('Teilen: Link-Kodierung verlustfrei (Base64url)', () => {
    const bytes = new Uint8Array(300).map((_, i) => (i * 37) & 255);
    const back = ntUnB64url(ntB64url(bytes));
    return back.length === bytes.length && back.every((v, i) => v === bytes[i]) && !/[+/=]/.test(ntB64url(bytes));
  }, 'true');

  // 2026-10-05: Stern direkt vor einer Vorzeichen-Gruppe liess das ganze
  // Notenbild leer (exsurge "needsLayout"); alte Exporte ohne "()" einlesbar.
  // 2026-10-11: gestapelte Mora "dc.." = Mora auf beiden Noten (Nutzerentscheid);
  // die Rohform-Übernahme schrieb die erste Note ohne Punkt zurück.
  // 2026-10-13: Wortende nach silbenloser Notengruppe ging verloren ("A(f/g)B")
  check('Wortende nach silbenloser Gruppe ("le(g)(h) lu")', 'c4',
    "Al(f)le(g)(h) lu(f) (::)",
    "(c4) Al(f)le(g/h) lu(f) (::)");
  check('Gestapelte Mora ("am.(dc..)")', 'c4',
    "tu(fff) am.(dc..) (::)",
    "(c4) tu(fff) am.(d.c.) (::)");
  check('Stern vor Vorzeichen ("* (ix)lae")', 'c4',
    "li(h.) * (ix)lae(i)tá(h) (::)",
    "(c4) li(h.) *() (ix)lae(i)tá(h) (::)");

  // Restore whatever the user actually had open before running the test.
  gregEntries = savedEntries;
  gregRefreshList();

  const failed = results.filter(r => !r.pass);
  console.log('=== Notator-Selbsttest ===');
  results.forEach(r => {
    console.log((r.pass ? '✓' : '✗') + ' ' + r.name + (r.error ? (' — FEHLER: ' + r.error) : ''));
    if (!r.pass && !r.error) {
      console.log('    erwartet: ' + r.expected);
      console.log('    erhalten: ' + r.actual);
    }
  });
  const summary = failed.length
    ? (failed.length + ' von ' + results.length + ' Selbsttests fehlgeschlagen')
    : ('Alle ' + results.length + ' Selbsttests bestanden ✓');
  console.log(summary);
  gregGst(summary);
  gregShowSelfTestModal(summary, results);
  return {passed: results.length - failed.length, failed: failed.length, results};
}

function gregEscHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>]/g, function(c) {
    return c === '&' ? '&amp;' : (c === '<' ? '&lt;' : '&gt;');
  });
}

// Shows the Selbsttest result as an actual modal dialog (reusing the existing
// #modal-bg/#modal infrastructure) instead of only the easy-to-miss status
// bar line — pass/fail per case, and expected-vs-actual for any failures.
function gregShowSelfTestModal(summary, results) {
  const failed = results.filter(r => !r.pass);
  document.getElementById('modal-title').textContent = '🧪 Selbsttest-Resultat';
  let html = '<p style="font-size:12px;font-weight:bold;color:' + (failed.length ? '#e06060' : '#7ec850') + ';margin:0 0 8px 0">' + gregEscHtml(summary) + '</p>';
  html += '<div style="max-height:50vh;overflow-y:auto;font-size:10px;font-family:monospace;line-height:1.5">';
  results.forEach(function(r) {
    html += '<div style="padding:4px 0;border-bottom:1px solid rgba(255,255,255,.08)">';
    html += '<div style="color:' + (r.pass ? '#7ec850' : '#e06060') + '">' + (r.pass ? '✓' : '✗') + ' ' + gregEscHtml(r.name) + '</div>';
    if (!r.pass) {
      if (r.error) {
        html += '<div style="color:#e0a060;padding-left:14px;white-space:pre-wrap">Fehler: ' + gregEscHtml(r.error) + '</div>';
      } else {
        html += '<div style="color:#8ab0d0;padding-left:14px;white-space:pre-wrap">erwartet: ' + gregEscHtml(r.expected) + '</div>';
        html += '<div style="color:#8ab0d0;padding-left:14px;white-space:pre-wrap">erhalten: ' + gregEscHtml(r.actual) + '</div>';
      }
    }
    html += '</div>';
  });
  html += '</div>';
  document.getElementById('modal-body').innerHTML = html;
  const bEl = document.getElementById('modal-btns');
  bEl.innerHTML = '';
  const btn = document.createElement('button');
  btn.className = 'b';
  btn.textContent = 'Schliessen';
  btn.onclick = closeModal;
  bEl.appendChild(btn);
  document.getElementById('modal-bg').classList.add('open');
}

function gregImportGABCString(gabcStr, opts) {
  function cleanSyl(s) {
    s = s.replace(/<sp>ae<\/sp>/gi, 'æ');
    s = s.replace(/<sp>aé<\/sp>/gi, 'ǽ');
    s = s.replace(/<sp>oe<\/sp>/gi, 'œ');
    s = s.replace(/<sp>([^<]+)<\/sp>/gi, '$1');
    s = s.replace(/<\/?nlba>/gi, ''); // nlba: Gregorio-Umbruchsperre, ohne Gegenstück in exsurge
    // Standard gabc special-character tags for italic/bold/small-caps/
    // underline/colour/elision/euouae: Notator doesn't render distinct
    // styling for these (yet), so — same approach as <sp> above — strip the
    // tags and keep their plain inner text. Without this, a construct like
    // {<e>ae</e>} (elision mark, e.g. imported from GregoBase's "Culpae")
    // leaked through literally as "<e>ae</e>" in the rendered lyric.
    // <eu>...</eu> (added 2026-08-01, Runde 59) marks the "Euouae" formula
    // (seculorum Amen vowel-abbreviation "E u o u a e") per the gabc/
    // Gregorio spec — in GregorioTeX it controls line-breaking/spacing
    // around that text, a layout feature exsurge has no equivalent for, so
    // treating it the same as the other unsupported styling tags (strip,
    // keep the plain text) is the safest option here.
    // Seit 2026-10-10 stellt Notator <b>, <sc>, <ul>, <c>, <e> und die
    // Vokal-Markierung {..} selbst dar -> beim Einlesen erhalten (nur <i> und
    // <eu> werden weiterhin entfernt; <i> hat eigene Behandlung oben).
    s = s.replace(/<\/?(?:i|eu)>/gi, '');
    s = s.replace(/<clear>/gi, '');
    return s.trim();
  }

  let annotation = '', useDropCap = false, titleStr = '', subtitleStr = '', body = gabcStr;
  let commentaryStr = '', modeStr = '', modeDiff = '', bookStr = '', initialLines2 = false;
  const hdrExtraLines = [];
  if (gabcStr.includes('%%')) {
    const si = gabcStr.indexOf('%%');
    const hl = gabcStr.substring(0, si).trim().split('\n');
    body = gabcStr.substring(si + 2).trim();
    const annotationLines = [];
    for (const l of hl) {
      const m = l.match(/^([^:]+):\s*(.*)$/);
      if (!m) continue;
      const k = m[1].trim().toLowerCase(), v = m[2].trim().replace(/;$/,'');
      if (k === 'annotation') annotationLines.push(v);
      if (k === 'name') titleStr = v;
      if (k === 'notator-subtitle') subtitleStr = v.replace(/\\n/g, '\n');
      if (k === 'drop-cap' && v === 'auto') useDropCap = true;
      if (k === 'commentary') commentaryStr = v;
      if (k === 'notator-initial-lines') initialLines2 = (v === '2');
      if (k === 'mode') modeStr = v;
      if (k === 'mode-differentia') modeDiff = v;
      if (k === 'book') bookStr = v;
      // alle übrigen Kopffelder unverändert mitführen (verlustfreier Export)
      if (!/^(name|annotation|notator-subtitle|notator-initial-lines|drop-cap|commentary)$/.test(k) && !/^%/.test(k)) hdrExtraLines.push(l.trim().replace(/;?$/, ';'));
    }
    // Gregorio-Verhalten: ohne Annotation wird der Modus (+ Differentia) gesetzt
    if (!annotationLines.length && modeStr) annotationLines.push(modeStr + (modeDiff ? ' ' + modeDiff : ''));
    if (!subtitleStr && bookStr) subtitleStr = bookStr;
    annotation = annotationLines.join('\n');
  }

  const annEl = document.getElementById('greg-annotation');
  if (annEl) annEl.value = annotation;
  const dcEl = document.getElementById('greg-dropcap');
  // Bidirectional: explicitly UNCHECK when this piece has none, not just
  // check when it does. A one-directional "only ever set true" update
  // (the previous version of this line) meant the checkbox simply stayed
  // stuck checked from whatever the last-imported piece was — this was
  // the actual root cause of the Drop-Cap-on-Versikel bug (Runde 61).
  if (dcEl) dcEl.checked = useDropCap;
  if (titleStr) {
    const tEl = document.getElementById('greg-title');
    if (tEl) tEl.value = titleStr;
  }
  const subEl = document.getElementById('greg-subtitle');
  if (subEl) subEl.value = subtitleStr;
  const commEl = document.getElementById('greg-commentary');
  if (commEl) commEl.value = commentaryStr;
  const dc2El = document.getElementById('greg-dropcap2');
  if (dc2El) dc2El.checked = initialLines2;
  gregHdrExtra = hdrExtraLines.join('\n');

  const clefM = body.match(/\(([cf]b?[1-5](?:@[cf]b?[1-5])?)\)/);
  if (clefM) {
    if (/^[cf]b?[1-4]$/.test(clefM[1])) { gregClefRaw = ''; gregSetClef(clefM[1]); }
    else {
      // Doppelschlüssel (c3@f3) oder Schlüssel auf Linie 5 (5-Linien-System):
      // ersten Teil als Schlüssel wählen, Original unverändert weitergeben.
      const first = clefM[1].split('@')[0].replace(/5$/, '4');
      gregClefRaw = clefM[1];
      gregSetClef(first);
    }
  }

  // Maps exsurge's AccidentalType enum (Flat:-1, Natural:0, Sharp:1) back to
  // the GABC accidental letter used elsewhere in this file (x/y/#).
  function accidentalTypeToGabcLetter(t) {
    if (t === -1) return 'x';
    if (t === 0) return 'y';
    if (t === 1) return '#';
    return null;
  }

  function convertNote(n, accLetter) {
    return {
      pitch: staffPosToGabc(n.staffPosition),
      shape: n.shape || 0,
      shapeModifiers: n.shapeModifiers || 0,
      liquescent: !!(n.liquescent && n.liquescent !== 0),
      mora: !!(n.morae && n.morae.length > 0),
      ictus: !!n.ictus,
      // Ictus positionHint (1=Above, 2=Below, 0/undefined=exsurge default)
      // -- previously only `ictus: !!n.ictus` was captured, silently
      // discarding an explicit gabc "'1"/"'0" placement (added 2026-08-10,
      // see gregEditEntry's iktusPos prefill + buildSingleNeumeGABC).
      ictusPos: (n.ictus && n.ictus.positionHint === 1) ? 'above' : (n.ictus && n.ictus.positionHint === 2) ? 'below' : '',
      episema: !!(n.epismata && n.epismata.length > 0),
      accidental: accLetter || null
    };
  }

  function neumeTypeToLegacy(exsurgeType) {
    const map = {
      'Punctum':'punctum','Virga':'virga','Quilisma':'quilisma',
      'Podatus':'podatus','Clivis':'clivis','Salicus':'salicus',
      'Torculus':'torculus','Porrectus':'porrectus','Scandicus':'scandicus',
      'Climacus':'climacus','Bistropha':'bistropha','Tristropha':'tristropha',
      // Extended: map to the new precise types (now available in NEUME_DEFS)
      'Apostropha':'apostropha','Distropha':'distropha',
      'Bivirga':'bivirga','Trivirga':'trivirga',
      'PunctaInclinata':'puncta_inclinata',
      'PesSubpunctis':'pes_subpunctis','PesQuassus':'pes_quassus',
      'TorculusResupinus':'torculus_resupinus',
      'TorculusResupinusFlexus':'torculus_resupinus',
      'PorrectusFlexus':'porrectus_flexus',
      'SalicusFlexus':'salicus','ScandicusFlexus':'scandicus_flexus',
    };
    return map[exsurgeType] || 'punctum';
  }

  // `noGapBefore`: true if this notation should attach DIRECTLY to the
  // previous one with no visual gap (GABC '!' boundary), false if a normal
  // gap should appear before it (GABC '/' boundary, the default between
  // distinct neumes of the same syllable).
  function makeNeumeEntry(nt, syllable, hyphen, noGapBefore, italic, accLetter, accPitch) {
    const notes = (nt.notes || []).map((n, i) => convertNote(n, i === 0 ? accLetter : null));
    // Real-world gabc sources don't always follow exsurge's OWN native mora
    // convention (an independent dot placed directly after EACH note that
    // should carry one, e.g. "f.e."). Some sources (confirmed 2026-08-13:
    // GregoBase's "Signum magnum", e.g. "fe.." for a 2-note Clivis meant to
    // have mora on BOTH notes) instead stack multiple consecutive dots on
    // the LAST note. exsurge's own parser (createNoteFromData's "." case)
    // interprets that completely differently: N stacked dots on one note
    // become N separate, auto-offset (alternating above/below) Mora marks
    // on that SAME note alone -- a purely visual collision-avoidance device
    // -- never marks on the PRECEDING notes. Per explicit user decision: no
    // matter which convention a given source follows, Notator should still
    // recognize the INTENDED result (mora spread across notes) -- how it's
    // represented internally, and how it's re-exported (Notator always
    // re-emits the unambiguous "dot directly after each note" form, e.g.
    // "f.e.", not the original "fe.." spelling -- a deliberate choice for
    // round-trip stability, not a bug), is Notator's own affair. Detect: a
    // note whose RAW exsurge note carries 2+ stacked morae -- extend
    // "has mora" backward onto the (stacked-1) preceding notes too.
    (nt.notes || []).forEach((n, i) => {
      const stacked = (n.morae && n.morae.length) || 0;
      for (let back = 1; back < stacked && (i - back) >= 0; back++) {
        notes[i - back].mora = true;
      }
    });
    // Original-gabc je Note zuordnen (gleiche Reihenfolge wie im Quelltext)
    let sepRaw;
    notes.forEach((cn, i) => {
      for (let k = _rawNote; k < Math.min(_rawNote + 4, _raw.notes.length); k++) {
        if (_raw.notes[k].pitch === cn.pitch) {
          const rt = _raw.notes[k];
          // Rohform nur übernehmen, wenn sie zur Mora-Deutung passt: bei
          // gestapelten Morae ("dc..") erhält die vorangehende Note eine
          // Mora, die im Original-Suffix nicht steht -> normal ausgeben.
          if (rt.suf.indexOf('..') < 0 && (/\./.test(rt.suf) === !!cn.mora)) { cn.gabcPre = rt.pre; cn.gabcSuf = rt.suf; cn.gabcSig = gregRawNoteSig(cn); }
          if (i === 0) sepRaw = rt.sep;
          _rawNote = k + 1;
          break;
        }
      }
    });
    const typeName = nt.constructor.name.replace(/^_/, '');
    return {
      sepRaw: sepRaw || undefined,
      type: 'note',
      syllable: syllable || '',
      hyphen: !!hyphen,
      italic: !!italic,
      noGapBefore: !!noGapBefore,
      neumeType: typeName,
      notes,
      neume: neumeTypeToLegacy(typeName),
      pitches: notes.map(x => x.pitch),
      rawPitches: notes.map(x => x.pitch),
      mora: notes.some(x => x.mora),
      iktus: notes.some(x => x.ictus),
      episema: notes.some(x => x.episema),
      liquescent: notes.some(x => x.liquescent),
      oriscus: notes.some(x => x.shape === 5),
      strophicus: notes.some(x => x.shape === 4),
      pressus: false,
      accidental: accLetter || null,
      // The accidental's OWN staff position, as actually parsed from the
      // GABC (e.g. "ix" before an unrelated "g" note primes the I position,
      // not G) — kept separate from the note pitches so export doesn't have
      // to guess. Only set on import; click-editor entries fall back to
      // guessing from the note pitch itself (see emitParenGroup).
      accidentalPitch: accPitch || null
    };
  }

  const BAR_MAP = {
    'QuarterBar': ',', 'HalfBar': ';', 'FullBar': ':',
    'DoubleBar': '::', 'Divider': ':::'
  };
  // Map exsurge class names with size modifiers
  function getDivFromNotation(nt, cname) {
    if (BAR_MAP[cname] === undefined) return undefined;
    let div = BAR_MAP[cname];
    // Check for size modifier (e.g. ;4, ;3 = larger half-bar)
    if (nt.barDivision !== undefined && nt.barDivision > 1) div += nt.barDivision;
    return div;
  }

  gregPush();
  gregEntries = [];
  const tokens = [];
  const _raw = gregGabcRawTokens(body.replace(/(^|\s)\*(\s+)\(/g, '$1*()$2('));
  let _rawNote = 0, _rawClef = 0, _rawCustos = 0, _seenClef = false;

  const ctxt = new exsurge.ChantContext();
  ctxt.autoColor = false;
  let mappings;
  // Ältere Notator-Exporte schrieben "* (ix)lae…": Stern vor notenloser
  // Gruppe -> exsurge verliert die folgende Silbe. Als "*() (ix)…" lesen.
  body = body.replace(/(^|\s)\*(\s+)\(/g, '$1*()$2(');
  try {
    mappings = exsurge.Gabc.createMappingsFromSource(ctxt, body);
  } catch (e) {
    gregGst('GABC-Parse-Fehler: ' + e.message);
    return;
  }

  // Each individual exsurge notation becomes its OWN top-level sidebar
  // entry — never bundled into a parent's extra[] array. This keeps every
  // neume independently movable/editable and lets line breaks happen at
  // any neume boundary, matching how the click-editor itself builds entries.
  let prevTrailingSpace = 0; // trailingSpace of the previously emitted note-entry
  let mappingIdx = -1;
  let pendingAcc = null; // {letter, pitch} captured from a standalone Accidental notation, applied to the next real note-entry

  for (const m of mappings) {
    mappingIdx++;
    // Detect a bare leading "*" that exsurge strips from the lyric text
    // of a Directive-type (lyricType 4) bar notation with empty/short text,
    // by checking the raw source string for this mapping.
    const srcTrimmed = (m.source || '').trim();
    const hasLeadingAsterisk = /^\*/.test(srcTrimmed);
    let asteriskEmitted = false;
    // Reset per mapping -- see the glued-directive/italic handling below
    // (guards the srcTrimmed.includes('<i>') fallback from firing more
    // than once per mapping, so an <i> tag consumed by one syllable can't
    // also bleed onto later, unrelated syllables of the same mapping).
    let italicConsumedInMapping = false;

    for (const nt of (m.notations || [])) {
      const cname = nt.constructor.name.replace(/^_/, '');
      if (cname === 'DoClef' || cname === 'FaClef') {
        // erster Schlüssel = Kopfschlüssel; jeder weitere = Schlüsselwechsel im Stück
        const rc = _raw.clefs[_rawClef++];
        if (_seenClef && rc) {
          const clTxt = (nt.lyrics && nt.lyrics[0]) ? (nt.lyrics[0].gabcRaw || nt.lyrics[0].originalText || '') : '';
          tokens.push({type: 'raw', gabc: clTxt + '(' + rc + ')', label: '𝄢 Schlüsselwechsel ' + rc + (clTxt ? ' · ' + clTxt : '')});
        }
        _seenClef = true;
        continue;
      }
      if (cname === 'Virgula') { tokens.push({type: 'raw', gabc: '(`)', label: 'Virgula `'}); continue; }
      if (cname === 'ChantLineBreak') { tokens.push({type: 'linebreak', justify: !!nt.justify}); continue; }
      if (cname === 'Custos') {
        const rcu = _raw.custos[_rawCustos++];
        tokens.push({type: 'raw', gabc: rcu ? '(' + rcu + ')' : '(z0)', label: 'Custos'});
        continue;
      }

      // Standalone accidental (e.g. "ix" before a note): exsurge emits this
      // as its own notation with no notes of its own — remember it and
      // apply it to the very next real note-entry instead of dropping it.
      if (nt.isAccidental) {
        pendingAcc = {
          letter: accidentalTypeToGabcLetter(nt.accidentalType),
          pitch: staffPosToGabc(nt.staffPosition)
        };
        continue;
      }

      if (BAR_MAP[cname] !== undefined) {
        if (hasLeadingAsterisk && !asteriskEmitted) {
          tokens.push({type:'special', text: '*'});
          asteriskEmitted = true;
        }
        // A syllable can be attached directly to a bare divisio notation
        // with no notes of its own (e.g. "C(;4)" — text right before a
        // standalone bar line, used for things like a versicle letter).
        // This was previously never checked here, silently dropping that
        // text on import. Mark the divisio so the exporter glues it
        // directly back onto that syllable (no GABC space), matching the
        // original "C(;4)" rather than "C (;4)".
        let glueToPrevSpecial = false;
        if (nt.lyrics && nt.lyrics[0] && nt.lyrics[0].text) {
          tokens.push({type:'special', text: cleanSyl(nt.lyrics[0].text)});
          glueToPrevSpecial = true;
        }
        tokens.push({type:'divisio', div: getDivFromNotation(nt, cname), glueToPrevSpecial});
        continue;
      }

      if (!nt.notes || !nt.notes.length) {
        if (nt.lyrics && nt.lyrics[0] && nt.lyrics[0].text) {
          // exsurge distinguishes two very different zero-note cases that
          // both end up here, and export must NOT treat them the same way:
          //   - a standalone "text()" group (e.g. "<i>Ant.</i>()", used for
          //     a rubric like an antiphon label that needs its OWN spacing
          //     before the next real note) parses as its own "TextOnly"
          //     notation — must round-trip back out WITH the empty "()",
          //     or re-parsing merges it into the NEXT note's lyric instead
          //     (confirmed via a real exsurge parse test: dropping the "()"
          //     turned a correctly-standalone "Ant." into "Ant. U" sharing
          //     one notehead with "Ubi"'s first syllable).
          //   - bare text with NO parens at all (e.g. "<sp>V/</sp>." before
          //     a versicle) never reaches this branch as its own notation in
          //     the first place — exsurge already merges it into the next
          //     real note's lyric during parsing, so nothing to distinguish
          //     for that case; it flows through the normal note-token path.
          // Read originalText (falls back to .text if unset), NOT .text
          // directly -- since 2026-08-13's exsurge patch (generateSpansFromText
          // now recognizes <i>/</i> as italic markup, same as native "_") also
          // runs during PARSING (Lyric extends TextElement, whose constructor
          // calls generateSpansFromText immediately) it silently consumes
          // <i>/</i> out of .text at construction time, same as it already did
          // for native "_" -- so checking .text here would never see the tag
          // at all anymore. originalText is assigned directly from the raw
          // constructor argument, independent of that scan, so it still
          // reliably contains the literal <i>...</i> (mirrors the existing,
          // already-verified originalText-based nativeItalicMatch check below).
          const rawLyric = nt.lyrics[0].gabcRaw || nt.lyrics[0].originalText || nt.lyrics[0].text;
          // A TextOnly notation whose ENTIRE raw text is wrapped in <i>...</i>
          // (e.g. GregoBase's "<i>Ant.</i>()") is exactly the same concept as
          // Notator's own "ij."/"iij." buttons — italic, zero-note "Sonder"
          // text — which already has full support end-to-end under
          // type:'directive' (export wraps it in "<i>...</i>()" markup,
          // sidebar shows it in italic). Reuse that existing,
          // already-correct path instead of inventing separate italic
          // handling for 'textonly'.
          const italicWholeMatch = cname === 'TextOnly' ? rawLyric.match(/^<i>([\s\S]*)<\/i>$/i) : null;
          // gabc's OWN native italic syntax "_..._()" (what Notator itself
          // exports for type:'directive', see gregEntriesToBody) takes a
          // DIFFERENT path through exsurge than "<i>...</i>": the
          // underscores are consumed during parsing and leave no trace in
          // lyric.text (rawLyric above is already plain "Ant."), so the
          // <i>-based check above can never match it. Without this, a
          // "directive" entry re-imported a SECOND time (e.g. the user's
          // own previously-exported file, or a GregoBase file re-imported
          // twice) silently lost its italic styling and degraded to
          // type:'textonly'. lyric.originalText still retains the leading
          // "_" (confirmed via a real exsurge parse test), which is enough
          // to detect this case and route it through the same 'directive'
          // path as the <i> case.
          const nativeItalicMatch = !italicWholeMatch && cname === 'TextOnly' &&
            nt.lyrics[0].originalText && /^_/.test(nt.lyrics[0].originalText);
          if (italicWholeMatch) {
            tokens.push({type: 'directive', text: cleanSyl(italicWholeMatch[1])});
          } else if (nativeItalicMatch) {
            tokens.push({type: 'directive', text: cleanSyl(rawLyric)});
          } else {
            tokens.push({type: (cname === 'TextOnly' ? 'textonly' : 'special'), text: cleanSyl(rawLyric)});
          }
        } else if (hasLeadingAsterisk && !asteriskEmitted) {
          tokens.push({type:'special', text: '*'});
          asteriskEmitted = true;
        }
        continue;
      }

      const lyric = (nt.lyrics && nt.lyrics[0]) ? nt.lyrics[0] : null;
      // GABC '!' boundary -> attach directly, no gap. Detected as: the
      // PREVIOUS notation's trailingSpace was 0 (it used keepWithNext
      // with no extra spacing) AND this notation has no new lyric (i.e.
      // it's a melisma continuation, not a fresh syllable — gaps between
      // syllables are controlled separately via the hyphen/space logic).
      const hasNewLyric = !!(lyric && lyric.text);
      const noGapBefore = (prevTrailingSpace === 0) && !hasNewLyric;
      // GABC '//' boundary (wide gap, mid-melisma): same trailingSpace
      // magnitude as a real word-space (" "), but only a genuine "//" when
      // there is NO new lyric syllable here — a real word-space always
      // comes with a fresh syllable attached.
      const gapWide = !hasNewLyric && !noGapBefore &&
        prevTrailingSpace === ctxt.intraNeumeSpacing * 2;

      const accLetter = pendingAcc ? pendingAcc.letter : null;
      const accPitch = pendingAcc ? pendingAcc.pitch : null;
      pendingAcc = null;

      if (lyric && lyric.text) {
        if (hasLeadingAsterisk && !asteriskEmitted) {
          tokens.push({type:'special', text: '*'});
          asteriskEmitted = true;
        }
        const lyricType = lyric.lyricType;
        // Same originalText-vs-.text reasoning as rawLyric above (2026-08-13):
        // lyric.text has <i>/</i> already stripped by exsurge's own parse-time
        // call to generateSpansFromText, so every <i>-detection regex below
        // (gluedDirectiveMatch, the plain /<i>/ test) would silently never
        // match if read from .text. originalText is untouched by that scan.
        let rawText = lyric.gabcRaw || lyric.originalText || lyric.text;
        // Fix 2026-09-30 (Selbsttest "Alleluia Pfingsten", Nutzer-Report
        // "* * ter"): der führende "*" wurde oben bereits als eigener
        // 'special'-Eintrag übernommen -- exsurge lässt ihn aber (anders als
        // bei Directive-Notationen) im Silbentext stehen ("* ter"). Ohne
        // Abschneiden exportierte Notator den Stern darum doppelt.
        if (hasLeadingAsterisk) rawText = rawText.replace(/^\s*\*\s*/, '');
        let italic = false;
        // GLUED-DIRECTIVE FIX (2026-08-10): a source like GregoBase's
        // "<i>Ps.</i> Can(ehg)" (no "()" after the closing tag) has NO note
        // group of its own for "Ps.", so exsurge's OWN parser glues its
        // whole raw text onto the NEXT note-bearing syllable's lyric before
        // Notator ever sees it -- by the time we get here, rawText is
        // literally "<i>Ps.</i> Can", one single (wrong) lyric. Detect that
        // specific shape -- a COMPLETE <i>...</i> span followed by more
        // text -- and split it back into two separate entries: a proper
        // standalone 'directive' (exactly like the "Ant."/"ij." buttons
        // produce) for the italic part, and the REMAINING text as this
        // syllable's own (non-italic) lyric. Confirmed via real-world
        // "Signum magnum" GregoBase data: without this, "Ps." merges into
        // "Can", AND (see italicConsumedInMapping below) the italic flag
        // then also incorrectly bled onto "tá"/"te", the OTHER syllables
        // of "Cantáte" -- not just the merged one.
        const gluedDirectiveMatch = rawText.match(/^<i>([^<]+)<\/i>\s*(\S[\s\S]*)$/i);
        if (gluedDirectiveMatch) {
          tokens.push({type: 'directive', text: cleanSyl(gluedDirectiveMatch[1])});
          rawText = gluedDirectiveMatch[2];
          italicConsumedInMapping = true;
        }
        // exsurge's lyric.text can literally include the <i>...</i> wrapper
        // (it does not always strip it the way it strips e.g. <sp>); detect
        // and remove it here, keeping the italic flag separately so the
        // exporter can re-wrap it without doubling the tags.
        if (/<i>/.test(rawText)) {
          italic = true;
          rawText = rawText.replace(/<i>/gi, '').replace(/<\/i>/gi, '');
          italicConsumedInMapping = true;
        } else if (!italicConsumedInMapping && srcTrimmed.includes('<i>')) {
          // Fallback for the case where exsurge already stripped the tag
          // from THIS notation's own lyric.text (observed to happen
          // inconsistently) but the mapping's raw source still shows an
          // <i> somewhere in it. Only trusted once per mapping (see
          // italicConsumedInMapping) -- otherwise this same broad check
          // re-fires for every remaining syllable of a multi-syllable word
          // in the SAME mapping (e.g. "tá", "te" of "Cantáte"), incorrectly
          // italicizing all of them just because an unrelated earlier "<i>"
          // appeared anywhere in that mapping's source text.
          italic = true;
          italicConsumedInMapping = true;
        }
        const hyphen = (lyricType === 1 || lyricType === 2);
        const wordEnd = (lyricType === 3 || lyricType === 0); // EndingSyllable or SingleSyllable
        const entry = makeNeumeEntry(nt, cleanSyl(rawText), hyphen, false, italic, accLetter, accPitch);
        entry.mappingIdx = mappingIdx;
        entry.wordEnd = wordEnd;
        // weitere Strophen («a|b|c» im GABC)
        const _vl = (nt.lyrics || []).slice(1).filter(l => l && typeof l.lyricType === 'number' && !/Translation/.test(l.constructor.name));
        if (_vl.length) entry.verses = _vl.map(l => cleanSyl(l.originalText != null ? l.originalText : (l.text || '')).replace(/-$/, '') + ((l.lyricType === 1 || l.lyricType === 2) ? '-' : ''));
        tokens.push(entry);
      } else {
        const entry = makeNeumeEntry(nt, '', false, noGapBefore, false, accLetter, accPitch);
        entry.gapWide = gapWide;
        entry.mappingIdx = mappingIdx;
        // Notengruppe ohne Silbe am Wortende (z. B. "A(f)(g) B"): Wortgrenze
        // hier merken, sonst klebt das nächste Wort beim Export an ("A(f/g)B")
        // und wird als Silbe desselben Wortes (mit Bindestrich) gesetzt.
        const _mNotes = (m.notations || []).filter(x => x.notes && x.notes.length);
        if (_mNotes.length && _mNotes[_mNotes.length - 1] === nt) entry.wordEnd = true; // Mappings enden immer an einem Leerzeichen
        tokens.push(entry);
      }
      prevTrailingSpace = nt.trailingSpace;
    }
  }

  gregEntries = tokens;
  // Render immediately (no debounce) — the 200ms debounce in gregRefreshList()
  // exists for rapid-fire UI events (slider dragging etc.); a one-off import
  // has no such burst to coalesce, and debouncing it just means the editor
  // briefly still shows the PREVIOUS content for up to 200ms after import,
  // which is confusing if the user looks (or screenshots) right away.
  //
  // EXCEPT when the caller passes deferRender:true — used by the PDF-import
  // safety gate, which needs to inspect the REAL gregEntries.length (not a
  // fragile regex guess at how many note-groups a string contains) before
  // deciding whether it's safe to render at all. In that mode the caller is
  // responsible for calling gregRefreshListNoRender()+gregRender() itself
  // once it's satisfied the result is sane (or restoring the previous
  // gregEntries if not).
  if (opts && opts.deferRender) return;
  gregRefreshListNoRender();
  gregRender();
  gregGst('GABC importiert: ' + gregEntries.length + ' Einträge');
  setTimeout(ntGpOffer, 900);
  gregSelectedIndices.clear(); window._gregBlockPick = false; window._gregBlockRange = 0; gregBlockSync();
}

// Runde 65: zeigt/versteckt das Original-PDF-Seitenpanel + seine Ziehleiste.
// forceOpen=true/false erzwingt einen Zustand (z.B. beim automatischen
// Öffnen nach dem Laden); ohne Argument wird umgeschaltet (Klick auf den
// Toolbar-Knopf oder den Schliessen-Knopf im Panel selbst).
function gregToggleOriginalPdf(forceOpen) {
  const panel = document.getElementById('greg-pdf-panel');
  const handle = document.getElementById('greg-pdf-drag-handle');
  const toggleBtn = document.getElementById('greg-pdf-panel-toggle');
  if (!panel) return;
  const isOpen = panel.style.display === 'flex';
  const show = forceOpen !== undefined ? forceOpen : !isOpen;
  panel.style.display = show ? 'flex' : 'none';
  if (handle) handle.style.display = show ? 'block' : 'none';
  if (toggleBtn && _gregPdfDoc) toggleBtn.style.display = 'inline-block';
  gregPdfSheetSync();
  gregPdfDragInit();
}
// Handy: Blatt minimieren / aufklappen
function gregPdfSheet(min) {
  const panel = document.getElementById('greg-pdf-panel'); if (!panel) return;
  const on = min !== undefined ? !!min : !panel.classList.contains('pdf-min');
  panel.classList.toggle('pdf-min', on);
  gregPdfSheetSync();
}
function gregPdfSheetSync() {
  const panel = document.getElementById('greg-pdf-panel'); if (!panel) return;
  const open = panel.style.display === 'flex', min = panel.classList.contains('pdf-min');
  document.body.classList.toggle('pdf-sheet-open', open && !min);
  document.body.classList.toggle('pdf-sheet-min', open && min);
  const b = document.getElementById('greg-pdf-sheet-btn'); if (b) { b.textContent = min ? '▴' : '▾'; b.title = min ? 'Original wieder aufklappen' : 'Original minimieren (Kopfzeile ziehen = Höhe ändern)'; }
}
function gregPdfZoom(d) {
  window._gregPdfZoom = Math.max(1, Math.min(4, (window._gregPdfZoom || 1) * (d > 0 ? 1.5 : 1 / 1.5)));
  if (_gregPdfDoc) gregRenderPDFPage(_gregPdfPage);
}
// Handy: Kopfzeile des Blatts ziehen = Höhe ändern (ganz nach unten = minimieren)
function gregPdfDragInit() {
  const head = document.getElementById('greg-pdf-head'), panel = document.getElementById('greg-pdf-panel');
  if (!head || !panel || head._drag) return; head._drag = true;
  let st = null;
  head.addEventListener('touchstart', ev => {
    if (!gregIsMobileViewport() || ev.target.closest('button')) return;
    st = { y: ev.touches[0].clientY, h: panel.getBoundingClientRect().height, min: panel.classList.contains('pdf-min') };
  }, { passive: true });
  head.addEventListener('touchmove', ev => {
    if (!st) return; ev.preventDefault();
    const h = Math.max(60, Math.min(window.innerHeight * 0.88, st.h + (st.y - ev.touches[0].clientY)));
    if (st.min && h > 90) { panel.classList.remove('pdf-min'); st.min = false; }
    document.documentElement.style.setProperty('--pdf-h', Math.round(h) + 'px');
  }, { passive: false });
  head.addEventListener('touchend', () => {
    if (!st) return;
    const h = panel.getBoundingClientRect().height; st = null;
    if (h < 100) { gregPdfSheet(true); document.documentElement.style.setProperty('--pdf-h', '38vh'); }
    gregPdfSheetSync();
  });
}

async function gregRenderPDFPage(pageNum) {
  if (!_gregPdfDoc) return;
  const page = await _gregPdfDoc.getPage(pageNum);
  // Runde 65: PDF wird nicht mehr als 35%-Geisterbild HINTER der Notation
  // gerendert (weder Scan noch Notation waren so richtig lesbar), sondern in
  // voller Deckkraft im eigenen, ausklappbaren Seitenpanel #greg-pdf-panel.
  // Breite richtet sich entsprechend nach dem Panel statt nach
  // greg-canvas-wrap. Siehe gregToggleOriginalPdf().
  gregToggleOriginalPdf(true); // Panel automatisch öffnen, falls noch zu
  const panel = document.getElementById('greg-pdf-panel');
  const availW = (panel ? Math.max(panel.clientWidth - 32, 200) : 320) * (gregIsMobileViewport() ? (window._gregPdfZoom || 1) : 1);
  const vp0 = page.getViewport({scale: 1});
  const scale = availW / vp0.width;
  const vp = page.getViewport({scale});

  const cv = document.getElementById('greg-pdf-bg');
  cv.width = vp.width;
  cv.height = vp.height;
  cv.style.display = 'block';
  cv.style.height = vp.height + 'px';

  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, vp.width, vp.height);
  await page.render({canvasContext: ctx, viewport: vp}).promise;

  const nav = document.getElementById('greg-pdf-nav');
  if (nav) { nav.style.display = 'flex'; }
  const lbl = document.getElementById('greg-pdf-page-lbl');
  if (lbl) lbl.textContent = 'S. ' + pageNum + '/' + _gregPdfDoc.numPages;

  gregGst('PDF S.' + pageNum + '/' + _gregPdfDoc.numPages + ' im Original-Panel');
}

function gregPdfPage(delta) {
  if (!_gregPdfDoc) return;
  const next = Math.max(1, Math.min(_gregPdfDoc.numPages, _gregPdfPage + delta));
  if (next !== _gregPdfPage) { _gregPdfPage = next; gregRenderPDFPage(_gregPdfPage); }
}

function gregClearPDF() {
  _gregPdfDoc = null; _gregPdfPage = 1;
  const cv = document.getElementById('greg-pdf-bg');
  if (cv) { cv.style.display = 'none'; }
  const nav = document.getElementById('greg-pdf-nav');
  if (nav) { nav.style.display = 'none'; }
  gregToggleOriginalPdf(false);
  const toggleBtn = document.getElementById('greg-pdf-panel-toggle');
  if (toggleBtn) toggleBtn.style.display = 'none';
  gregGst('PDF entfernt');
}

function gregExportPDF() {
  const {jsPDF}=window.jspdf||{};
  if(!jsPDF){
    gregGst('jsPDF lädt…');
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',function(){
      gregGst('jsPDF geladen — nochmals klicken');
    });
    return;
  }

  gregGst('PDF wird erstellt…');

  // A4 dimensions (for page output only)
  const A4_W_MM = 210, A4_H_MM = 297;
  const PX_PER_MM = 96 / 25.4;
  const pageWpx = A4_W_MM * PX_PER_MM;
  const pageHpx = A4_H_MM * PX_PER_MM;
  const marginPx = 24;

  // Use the SAME layout width as the browser display, so line breaks and
  // note layout are identical to what the user sees on screen.
  // The assembled SVG is then scaled proportionally to fit A4.
  // Lock the width for this whole export the same way gregRenderAllSections()
  // does for an on-screen render pass — every section's PDF page uses the
  // SAME width measured once, up front, rather than each independently
  // re-measuring its own (possibly currently-inactive, scrollbar-affected)
  // box. This is also what makes the PDF match the CURRENTLY VISIBLE
  // on-screen layout: without it, the PDF could re-wrap lines slightly
  // differently than what's on screen at export time, throwing off both
  // the visual line breaks and any anchored freetext positions.
  const hadPermanentForcedWidthForPDF = !!window._gregForcedCanvasWidth;
  if (!hadPermanentForcedWidthForPDF) {
    // Einzelabschnitt: Breite des Notenblatts (Seitenansicht) statt des ganzen Arbeitsbereichs
    const activeContent = document.querySelector('.greg-sec-content');
    const measuredForPDF = activeContent ? activeContent.clientWidth : gregEffectiveCanvasWidth();
    if (measuredForPDF) window._gregForcedCanvasWidth = measuredForPDF;
  }

  const sz = gregGetSizing();   // Standard (Einzelabschnitt); Abschnitte nutzen ihre eigene Grösse (siehe renderGABCforPDF)
  const zoom = sz.zoom || 1;
  const canvasW = gregEffectiveCanvasWidth();
  // Bildschirm-Ansicht skaliert zusätzlich mit dem Ansichts-Zoom (🔍, gregVS):
  // Zeilenbreite = Canvas / (zoom × Ansichts-Zoom). Ohne diesen Faktor wurde das PDF
  // breiter/enger umbrochen als am Bildschirm (andere Zeilenumbrüche + Notengrösse).
  const viewZoom = zoom * (typeof gregVS === 'function' ? gregVS() : 1);
  const fallbackLayoutW = Math.max(canvasW ? (canvasW - 80) / viewZoom : 700, (typeof gregIsMobileViewport === 'function' && gregIsMobileViewport()) ? 140 : 400);
  // Per-section width lookup — matches gregRenderGABCInto/gregRenderSectionPreview's
  // own formula (section box content width - 20, same as what's ACTUALLY
  // visible on screen for that box) instead of one shared width for every
  // section, which didn't match narrower/wider individual section boxes.
  // A forced/saved canvas width (loaded document) takes priority, same as
  // on screen, so the PDF matches a re-opened document's layout too.
  function layoutWidthForSection(sec, vz) {
    vz = vz || viewZoom;
    if (!sec) return fallbackLayoutW;
    if (window._gregForcedCanvasWidth) return gregLayoutWidth(canvasW, vz);
    const secBox = document.getElementById('greg-secbox-' + sec.id);
    const secContent = secBox ? secBox.querySelector('.greg-sec-content') : null;
    return secContent ? gregLayoutWidth(secContent.clientWidth, vz) : fallbackLayoutW;
  }

  // Build list of {gabc, section-state} to render for PDF
  // We render each section fresh at targetW with zoom=1 context
  function buildPDFCtxt(sz) {
    const zoom = sz.zoom || 1;
    if (typeof exsurge === 'undefined') return null;
    const ctxt = new exsurge.ChantContext();
    const font = "'Crimson Text', 'Palatino Linotype', Georgia, serif";
    ctxt.lyricTextFont = font; ctxt.dropCapTextFont = font; ctxt.annotationTextFont = font;
    ctxt.autoColor = false;
    ctxt.glyphScaling       = (1/16) * (sz.neumeScale || 1);  // base scale × Neumen-Regler (zoom applied via CSS in browser, not here)
    ctxt.staffInterval      = ctxt.glyphPunctumWidth * ctxt.glyphScaling;
    ctxt.staffLineWeight    = Math.max(1, Math.round(ctxt.staffInterval / 8));
    ctxt.neumeLineWeight    = ctxt.staffLineWeight;
    // Text sizes: divide by zoom, matching the NATIVE (pre-zoom) units the
    // browser itself uses during layoutChantLines() (see gregRenderGABCInto:
    // lyricTextSize = sz.lyricSize/zoom there too). Using the raw slider
    // values directly here made text take up proportionally MORE native
    // space than in the browser whenever Staff Size != 20pt (zoom != 1),
    // which shifted line-wrap decisions — PDF wrapped earlier/later than
    // what's shown on screen for the same content.
    ctxt.lyricTextSize      = sz.lyricSize  / zoom;
    ctxt.dropCapTextSize    = sz.dropSize   / zoom;
    ctxt.annotationTextSize = sz.annSize    / zoom;
    ctxt.intraNeumeSpacing  = ctxt.staffInterval / 2 * sz.hSpace;
    ctxt.interSyllableSpacing = (ctxt.staffInterval * 2) * sz.hSpace;
    return ctxt;
  }

  // Collect all GABC strings to render
  let gabcList = [];
  if (window._gregMultiSection) {
    gregSectionFromUI();
    for (const sec of (gregSections || [])) {
      if (sec.hidden) continue; // ausgeblendeter Abschnitt: nicht im PDF
      const gabc = gregBuildGABCFor(sec);
      // NOT `sec.title || undefined` — an intentionally EMPTY title/subtitle
      // (e.g. a continuation section that shouldn't show its own heading)
      // must stay an empty string here. gregCalcTitlePad/gregRenderTitle
      // treat `undefined` as "no override, fall back to the live #greg-title
      // UI field" — turning "" into undefined made every section with a
      // blank title/subtitle silently pick up whichever section happened to
      // be ACTIVE (and thus showing in that live field) at export time.
      gabcList.push({gabc, sec,
        overrideTitle:    sec.title    || '',
        overrideSubtitle: sec.subtitle || '',
        overrideComm:     sec.commentary || ''});
    }
  } else {
    const title    = (document.getElementById('greg-title')||{value:''}).value;
    const subtitle = (document.getElementById('greg-subtitle')||{value:''}).value;
    gabcList.push({gabc: gregBuildGABC(), sec: null,
      overrideTitle:    title    || '',
      overrideSubtitle: subtitle || '',
      overrideComm:     (document.getElementById('greg-commentary')||{value:''}).value || ''});
  }

  if (!gabcList.length) { gregGst('Erst rendern'); return; }

  // Render each GABC to SVG at targetW
  const sections = [];
  let pending = gabcList.length;

  function renderGABCforPDF(gabcEntry, doneCallback) {
    const szS = gregGetSizing(gabcEntry.sec), zoomS = szS.zoom || 1;
    const ctxt = buildPDFCtxt(szS);
    if (!ctxt) { doneCallback(null); return; }
    let body = gabcEntry.gabc;
    let annText = null, useDropCap = false;
    if (body.includes('%%')) {
      const si = body.indexOf('%%');
      const hl = body.substring(0, si).trim().split('\n');
      annText = hl.filter(l => l.startsWith('annotation:')).map(l => l.replace('annotation:','').trim()).join('\n') || null;
      useDropCap = hl.some(l => /drop-cap:\s*auto/.test(l));
      body = body.substring(si + 2).trim();
    }
    if (!body || body === '(' + gregClefVal + ')') body = '(' + gregClefVal + ') (::)';
    const layoutW = layoutWidthForSection(gabcEntry.sec, zoomS * (typeof gregVS === 'function' ? gregVS() : 1));
    try {
      const mappings = exsurge.Gabc.createMappingsFromSource(ctxt, body);
      const score = new exsurge.ChantScore(ctxt, mappings, useDropCap);
      score.initialLines = gregInitialLinesOf(gabcEntry.gabc);
      if (annText) {
        const annArr = annText.split('\n').filter(Boolean);
        if (annArr.length > 0) score.annotation = new exsurge.Annotation(ctxt, annArr[annArr.length-1]);
      }
      score.performLayoutAsync(ctxt, function() {
        score.layoutChantLines(ctxt, layoutW, function() {
          const svg = score.createSvg(ctxt);
          // Mount in a hidden div so DOM APIs (getBoundingClientRect etc.) work
          const tmp = document.createElement('div');
          tmp.style.cssText = 'position:fixed;left:-9999px;top:-9999px;visibility:hidden';
          tmp.innerHTML = svg;
          document.body.appendChild(tmp);
          const svgEl = tmp.querySelector('svg');
          if (!svgEl) { document.body.removeChild(tmp); doneCallback(null); return; }
          gregNeutralizeRubricRed(svgEl);
          // Apply same title/annotation overlays as in browser render
          const savedCtxtRef = _gregCtxtRef;
          _gregCtxtRef = ctxt; // temporarily point to PDF ctxt for overlay functions
          const svgW = parseFloat(svgEl.getAttribute('width')) || layoutW;
          const _ext = gabcEntry.sec ? gregSecTitleExtra(gabcList.indexOf(gabcEntry), gabcEntry.overrideTitle, gabcEntry.overrideSubtitle) : 0;
          const neededPad = gregCalcTitlePad(svgW, gabcEntry.overrideTitle, gabcEntry.overrideSubtitle, gabcEntry.overrideComm, _ext);
          svgEl._topPad = addSvgPadding(svgEl, 32, neededPad, gregSecGap());
          svgEl._titleShift = _ext;
          gregRenderTitle(svgEl, gabcEntry.overrideTitle, gabcEntry.overrideSubtitle, gabcEntry.overrideComm);
          if (score._extraAnnotations && score._extraAnnotations.length)
            gregRenderExtraAnnotations(svgEl, score._extraAnnotations);
          _gregCtxtRef = savedCtxtRef;
          // Optionally burn 'comment' (freitext) entries into the PDF as
          // plain SVG <text> — they normally have "no GABC output" and are
          // shown only as an in-editor overlay, so by default they don't
          // appear in the PDF at all (handy for private notes-to-self).
          const printComments = !!(document.getElementById('greg-pdf-print-comments')||{}).checked;
          if (printComments) {
            // Same shared embedding function used on screen — guarantees
            // the PDF can't drift from what's currently shown, since it's
            // the exact same position-resolution code, not a parallel
            // reimplementation of it.
            const entriesForComments = gabcEntry.sec ? (gabcEntry.sec.entries || []) : gregEntries;
            gregEmbedCommentsIntoSvg(svgEl, entriesForComments, score, false);
          }
          // Collect each staff system's own vertical extent (top/bottom, in
          // this SVG's native pixel units) BEFORE serializing, so the PDF
          // page-break logic below can avoid ever slicing a page in the
          // middle of one — each system is wrapped in its own <g
          // class="chantLine"> by exsurge, one per line of music, so this
          // reads real layout data rather than guessing from pixel heights.
          let lineBoxes = [];
          try {
            lineBoxes = Array.from(svgEl.querySelectorAll('g.chantLine')).map(g => {
              const bb = g.getBBox();
              // getBBox() excludes the element's OWN transform — read the
              // group's translateY separately and add it back, otherwise
              // every line's box is measured as if it sat near the top of
              // the piece regardless of where it actually is.
              let ty = 0;
              try {
                const consolidated = g.transform && g.transform.baseVal && g.transform.baseVal.consolidate();
                if (consolidated) ty = consolidated.matrix.f;
              } catch (e2) { ty = 0; }
              return { top: bb.y + ty, bottom: bb.y + bb.height + ty };
            });
          } catch (e) { lineBoxes = []; }
          // Runde 65: CONFIRMED root cause of a page-break-through-content
          // regression (found via code review, not a guess) — when "Freitext
          // drucken" is on, gregEmbedCommentsIntoSvg() appends each comment's
          // <text> node directly onto the SVG ROOT (svgEl.appendChild(t)),
          // not nested inside its nearby system's own <g class="chantLine">
          // group. That means a comment's own vertical extent was NEVER
          // covered by any forbidden zone above — a page cut landing in what
          // looked like safe white space between two systems could still
          // slice straight through a freetext comment anchored there (this
          // is almost certainly what "Text3" being cut across a page
          // boundary was). No transform-offset correction needed here: these
          // <text> nodes are direct children of svgEl, so getBBox() already
          // returns coordinates in the same native space the chantLine boxes
          // above use.
          try {
            Array.from(svgEl.querySelectorAll('text.greg-comment-text')).forEach(function(t) {
              const bb = t.getBBox();
              lineBoxes.push({ top: bb.y, bottom: bb.y + bb.height });
            });
          } catch (e) { /* no-op — comment boxes are a defensive addition, never fatal to the export */ }
          // Build 256: getBBox() liefert SVG-Benutzerkoordinaten, das Bild
          // beginnt aber am oberen viewBox-Rand – und addSvgPadding() schiebt
          // diesen um den Titel-Abstand nach oben (viewBox-y negativ). Ohne
          // Umrechnung lagen alle Sperrzonen um diesen Betrag zu hoch →
          // Seitenumbruch mitten im System. Daher: in Bildkoordinaten umrechnen.
          try {
            const vbA = (svgEl.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
            if (vbA.length === 4 && vbA.every(isFinite)) {
              const hAttr = parseFloat(svgEl.getAttribute('height')) || vbA[3];
              const k = vbA[3] ? hAttr / vbA[3] : 1;
              lineBoxes = lineBoxes.map(z => ({ top: (z.top - vbA[1]) * k, bottom: (z.bottom - vbA[1]) * k }));
            }
          } catch (e) { /* Boxen unverändert lassen */ }
          // Sicherheitsrand: Hälse/Episeme ragen etwas über die Bounding-Box
          lineBoxes = lineBoxes.map(z => ({ top: z.top - 4, bottom: z.bottom + 4 }));
          const finalSvg = new XMLSerializer().serializeToString(svgEl);
          document.body.removeChild(tmp);
          doneCallback(finalSvg, lineBoxes, gregBreakLinesFor(gabcEntry.sec ? gabcEntry.sec.entries : gregEntries, gabcEntry.sec ? (GREG_CLEF_MAP[gabcEntry.sec.clef] || 'c3') : gregClefVal, gabcEntry.sec ? (gabcEntry.sec.clefRaw || '') : gregClefRaw, score, ctxt));
        });
      });
    } catch(e) { console.error('PDF render error:', e); doneCallback(null, []); }
  }

  const svgStrings = new Array(gabcList.length).fill(null);
  const svgLineBoxes = new Array(gabcList.length).fill(null);
  const svgBreaks = new Array(gabcList.length).fill(null);
  let completed = 0;
  if (!gabcList.length) { gregGst('Alle Abschnitte sind ausgeblendet – nichts für das PDF.'); if (window._ntPdfDeliver) window._ntPdfDeliver = null; return; }
  gabcList.forEach((entry, i) => {
    renderGABCforPDF(entry, function(svg, lineBoxes, brk) {
      if (svg) { svgStrings[i] = svg; svgLineBoxes[i] = lineBoxes || []; svgBreaks[i] = brk || []; }
      completed++;
      if (completed === gabcList.length) {
        const pairs = [];
        for (let i2 = 0; i2 < svgStrings.length; i2++) {
          if (svgStrings[i2]) {
            const sc2 = gabcList[i2].sec, br = (svgBreaks[i2] || []).slice();
            const first = br.indexOf(0); if (first >= 0) br.splice(first, 1); // Umbruch vor der 1. Zeile = vor dem Abschnitt (Titel bleibt bei seinen Noten)
            pairs.push({ svg: svgStrings[i2], lineBoxes: svgLineBoxes[i2] || [], pageBreakBefore: !!((sc2 && sc2.pb && i2 > 0) || first >= 0) && i2 > 0, breakLines: br });
          }
        }
        gregAssemblePdf(pairs, ntFileBaseName() + '_Choral.pdf');
      }
    });
  });
  // Width-reading for every section happens synchronously inside
  // renderGABCforPDF before it enters its own async layout chain, so it's
  // safe to release the transient lock here, synchronously, right after
  // kicking off all of them.
  if (!hadPermanentForcedWidthForPDF) window._gregForcedCanvasWidth = null;

}

// Gemeinsame PDF-Erzeugung (A4, Seitenumbruch nie mitten durch ein
// Notensystem) -- herausgelöst aus gregExportPDF, damit der Choral- UND der
// Orgel-Tab exakt dieselbe Ausgabe nutzen. pairList: [{svg: <SVG-String>,
// lineBoxes: [{top,bottom}, ...] in SVG-Koordinaten}].
function gregAssemblePdf(pairList, filename) {
  // Mappe: Inhalte nur einsammeln, nicht als eigenes PDF ausgeben
  if (window._ntCollect) { const c = window._ntCollect; window._ntCollect = null; c(pairList); return; }
  const {jsPDF} = window.jspdf || {};
  const A4_W_MM = 210, A4_H_MM = 297;
  const PX_PER_MM = 96 / 25.4;
  const pageWpx = A4_W_MM * PX_PER_MM;
  const pageHpx = A4_H_MM * PX_PER_MM;
  const marginPx = 24;
  // Auflösung des Rasterbilds im PDF (dpi). Früher fest ca. 192 dpi mit
  // zweifacher Neuskalierung (unschärfer). Jetzt wird jedes Bild direkt in
  // Zielauflösung gerendert.
  const pdfDpi = ntPdfDpi();
  const pdfScale = pdfDpi / 96;
  const pdfTargetW = pageWpx - marginPx * 2;
  function svgStringToCanvas(svgStr, cb) {
    const tmp = document.createElement('div');
    tmp.innerHTML = svgStr;
    const svgEl = tmp.querySelector('svg');
    if (!svgEl) { cb(null,0,0); return; }
    const w = parseFloat(svgEl.getAttribute('width')) || 800;
    const h = parseFloat(svgEl.getAttribute('height')) || 400;
    const ns='http://www.w3.org/2000/svg';
    // Bug (2026-07-22, Nutzerbericht per Screenshot): das "Vorsänger-V"
    // (aus "V/." — exsurge rendert das automatisch mit font-family:'Exsurge
    // Characters', siehe gregNeutralizeRubricRed()-Kommentar oben) erschien
    // im PDF-Export als schlichtes "V" statt im dekorativen Glyph, obwohl es
    // auf dem Bildschirm korrekt aussah. Ursache: @font-face für 'Exsurge
    // Characters' wird von insertFontsInDoc() nur in <style id="exsurge-fonts">
    // im HAUPT-document.head registriert — das serialisierte SVG hier wird
    // aber als EIGENSTÄNDIGES Blob/Image geladen (siehe img.src=url unten),
    // das keinen Zugriff auf document.head des Hauptdokuments hat, also
    // fällt der Browser beim Rastern für dieses <text> auf eine Standard-
    // schrift zurück, die für 'V' einfach ein normales V zeigt. Fix: dieselbe
    // @font-face-Regel zusätzlich direkt IN dieses SVG einbetten (das Blob
    // bringt sie dann selbst mit), statt sie nur global zu registrieren.
    const fontStyleSrc = document.getElementById('exsurge-fonts');
    if (fontStyleSrc && fontStyleSrc.textContent) {
      const styleEl = document.createElementNS(ns, 'style');
      styleEl.textContent = fontStyleSrc.textContent;
      const defsEl = document.createElementNS(ns, 'defs');
      defsEl.appendChild(styleEl);
      svgEl.insertBefore(defsEl, svgEl.firstChild);
    }
    const bg=document.createElementNS(ns,'rect');
    bg.setAttribute('x',0); bg.setAttribute('y',0);
    bg.setAttribute('width',w); bg.setAttribute('height',h);
    bg.setAttribute('fill','#ffffff');
    bg.setAttribute('stroke','none'); // abcjs-SVGs vererben stroke=currentColor -> sonst schwarzer Rahmen im PDF
    svgEl.insertBefore(bg, svgEl.firstChild);
    const svgStr2='<?xml version="1.0" encoding="UTF-8"?>'+new XMLSerializer().serializeToString(svgEl);
    const blob=new Blob([svgStr2],{type:'image/svg+xml;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const img=new Image();
    img.onload=()=>{
      const canvas=document.createElement('canvas');
      // direkt in Zielauflösung – aber unter der Canvas-Grenze mobiler Browser
      // (iOS: max. ~16,7 Mio. Pixel je Canvas), sonst bleibt das Bild leer.
      const scale = Math.max(0.5, Math.min(pdfScale * pdfTargetW / w, Math.sqrt(16.0e6 / (w * h)), 16000 / h));
      canvas.width=w*scale; canvas.height=h*scale;
      const cx=canvas.getContext('2d');
      cx.scale(scale,scale); cx.fillStyle='#ffffff';
      cx.fillRect(0,0,w,h); cx.drawImage(img,0,0,w,h);
      URL.revokeObjectURL(url); cb(canvas,w,h);
    };
    img.onerror=()=>{URL.revokeObjectURL(url); cb(null,0,0);};
    img.src=url;
  }

  (function assemblePDF(pairList) {
    if (!pairList.length) { gregGst('PDF-Fehler: keine Inhalte'); return; }
    const canvases = [];
    let ci = 0;
    function nextCanvas() {
      if (ci >= pairList.length) { buildPages(); return; }
      svgStringToCanvas(pairList[ci].svg, function(canvas, w, h) {
        const pr = pairList[ci];
        if (canvas) canvases.push({canvas, w, h, lineBoxes: pr.lineBoxes || [], pageBreakBefore: !!pr.pageBreakBefore, breakLines: pr.breakLines || [], itemIdx: pr.itemIdx, cover: !!pr.cover, tocRows: pr.tocRows || null});
        ci++; nextCanvas();
      });
    }

    function buildPages() {
      if (!canvases.length) { gregGst('PDF-Fehler'); return; }
      const targetW = pageWpx - marginPx * 2; // A4 content width for output scaling
      const scaledSections = canvases.map(s => {
        const scale = targetW / s.w;
        return { canvas: s.canvas, scale, w: targetW, h: s.h * scale, lineBoxes: s.lineBoxes || [], pageBreakBefore: s.pageBreakBefore, breakLines: s.breakLines || [], itemIdx: s.itemIdx, cover: s.cover, tocRows: s.tocRows };
      });
      const totalH = scaledSections.reduce((sum, s) => sum + s.h, 0);
      // Kein grosser Gesamt-Streifen mehr (Browser begrenzen die Canvas-Höhe,
      // lange Mappen wären sonst abgeschnitten): jede Seite wird direkt aus
      // den Einzelbildern der Abschnitte zusammengesetzt.
      const stripScale = pdfScale;
      const forcedBreaks = [];
      // Global list of "forbidden zones" — each individual staff system's
      // own vertical span, mapped into this strip's coordinate space (each
      // section's own lineBoxes scaled by that section's own scale factor,
      // then offset by where that section starts in the stacked strip). A
      // page break must never fall inside one of these — that's exactly
      // what previously produced a break in the middle of a staff+text line.
      const forbiddenZones = [];
      let y = 0;
      for (const s of scaledSections) {
        s.y0 = y;
        if (s.pageBreakBefore && y > 0.5) forcedBreaks.push(y);
        (s.breakLines || []).slice().sort((a, b) => a - b).forEach(li => { const lb = s.lineBoxes[li]; if (lb) forcedBreaks.push(y + lb.top * s.scale); });
        // Titel/Kopf gehört zur ersten Zeile: der Bereich oberhalb davon darf kein Umbruchpunkt sein
        // (sonst bleibt der Titel allein am Seitenende und die Noten beginnen auf der nächsten Seite)
        let minTop = Infinity; s.lineBoxes.forEach(lb => { if (lb.top < minTop) minTop = lb.top; });
        for (const lb of s.lineBoxes) {
          forbiddenZones.push({ top: y + (lb.top === minTop ? Math.min(0, lb.top) : lb.top) * s.scale, bottom: y + lb.bottom * s.scale });
        }
        y += s.h;
      }
      const contentHpx = pageHpx - marginPx * 2;
      // Build variable-height page slices: start from a naive fixed-height
      // cut, then if it lands inside a forbidden zone, pull it back to that
      // zone's own top edge instead — so that whole system (staff + its
      // lyric line) moves to the next page rather than being sliced through.
      // A short fallback guards against a pathological single system taller
      // than a full page (would otherwise never advance).
      const pageSlices = [];
      let cursor = 0;
      const EPS = 0.5;
      while (cursor < totalH - EPS) {
        let end = Math.min(cursor + contentHpx, totalH);
        const fb = forcedBreaks.find(b => b > cursor + EPS && b < end - EPS);
        if (fb) end = fb;
        else for (const z of forbiddenZones) {
          if (z.top > cursor + EPS && end > z.top + EPS && end < z.bottom - EPS) {
            end = z.top;
            break;
          }
        }
        if (end <= cursor + EPS) end = Math.min(cursor + contentHpx, totalH); // pathological fallback
        pageSlices.push({ start: cursor, end });
        cursor = end;
      }
      const pageCount = Math.max(1, pageSlices.length);
      // Mappe: Seitenzahlen unten (ausser Deckblatt) und im Inhaltsverzeichnis
      const isMappe = scaledSections.some(s => s.itemIdx != null);
      const pageOf = yy => pageSlices.findIndex(ps => yy >= ps.start - EPS && yy < ps.end - EPS);
      const itemPage = {};
      scaledSections.forEach(s => { if (s.itemIdx != null && itemPage[s.itemIdx] == null) itemPage[s.itemIdx] = pageOf(s.y0 + 1) + 1; });
      const hasCover = scaledSections.length && scaledSections[0].cover;
      const pdf = new jsPDF({orientation: 'portrait', unit: 'mm', format: 'a4'});
      for (let p = 0; p < pageSlices.length; p++) {
        if (p > 0) pdf.addPage();
        const sliceYpx = pageSlices[p].start;
        const sliceHpx = pageSlices[p].end - pageSlices[p].start;
        if (sliceHpx <= 0) continue;
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = targetW * stripScale;
        pageCanvas.height = sliceHpx * stripScale;
        const pctx = pageCanvas.getContext('2d');
        pctx.fillStyle = '#ffffff';
        pctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        for (const s of scaledSections) {
          const a = Math.max(sliceYpx, s.y0), b = Math.min(sliceYpx + sliceHpx, s.y0 + s.h);
          if (b - a <= 0.01) continue;
          const k = s.canvas.height / s.h; // Pixel im Abschnittsbild je Ausgabe-px
          pctx.drawImage(s.canvas, 0, (a - s.y0) * k, s.canvas.width, (b - a) * k,
                         0, (a - sliceYpx) * stripScale, targetW * stripScale, (b - a) * stripScale);
        }
        const png = pageCanvas.toDataURL('image/png');
        const marginMm = marginPx / PX_PER_MM;
        const wMm = targetW / PX_PER_MM;
        const hMm = sliceHpx / PX_PER_MM;
        // Seite explizit weiss hinterlegen: manche (mobile) PDF-Betrachter
        // zeigen transparente Bereiche sonst dunkel an.
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, A4_W_MM, A4_H_MM, 'F');
        pdf.addImage(png, 'PNG', marginMm, marginMm, wMm, hMm, undefined, 'FAST'); // FAST = Flate-Kompression (sonst mehrere MB je Seite)
        if (isMappe) {
          pdf.setTextColor(0, 0, 0); pdf.setFont('times', 'normal');
          if (!(p === 0 && hasCover)) { pdf.setFontSize(10); pdf.text(String(p + 1), A4_W_MM / 2, A4_H_MM - 7, { align: 'center' }); }
          if (p === 0 && hasCover && scaledSections[0].tocRows) {
            const cs = scaledSections[0];
            pdf.setFontSize(Math.round(14 * cs.scale * 0.75));
            cs.tocRows.forEach(row => {
              const pg = itemPage[row.idx]; if (!pg) return;
              pdf.text(String(pg), marginMm + row.x * cs.scale / PX_PER_MM, marginMm + (cs.y0 - sliceYpx + row.y * cs.scale) / PX_PER_MM, { align: 'right' });
            });
          }
        }
      }
      const deliver = window._ntPdfDeliver; window._ntPdfDeliver = null;
      if (deliver) { gregGst('PDF erstellt (' + pageCount + ' Seite' + (pageCount>1?'n':'') + ') – wird gespeichert …'); deliver(pdf.output('blob')); return; }
      pdf.save(filename || 'notator.pdf');
      gregGst('PDF exportiert (' + pageCount + ' Seite' + (pageCount>1?'n':'') + ')');
    }
    nextCanvas();
  })(pairList);
}


// Shared plain-text-file download helper (used for .gabc exports below).
// Simple Blob+anchor-click download — no save dialog, matches how the PDF
// export already behaves (jsPDF's own .save() triggers an immediate
// download the same way).
function gregDownloadTextAsFile(text, filename) {
  const blob = new Blob([text], {type: 'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function gregCopyGABC() {
  const txt = document.getElementById('greg-gabc-out').value;
  navigator.clipboard.writeText(txt).then(()=>gregGst('Kopiert')).catch(()=>{
    // Fallback: select text
    const el = document.getElementById('greg-gabc-out');
    el.removeAttribute('readonly');
    el.select();
    document.execCommand('copy');
    el.setAttribute('readonly','');
    gregGst('Kopiert');
  });
}

function gregDownloadGABC() {
  const txt = document.getElementById('greg-gabc-out').value;
  if (!txt) { gregGst('Nichts zu exportieren'); return; }
  const title = ntFileBaseName();
  const filename = title.replace(/[^a-zA-Z0-9äöüÄÖÜ_ -]/g, '_') + '.gabc';
  gregDownloadTextAsFile(txt, filename);
  gregGst('Gespeichert: ' + filename);
}

