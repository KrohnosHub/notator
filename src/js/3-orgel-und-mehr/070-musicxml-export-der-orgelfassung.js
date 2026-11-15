// ── MusicXML-Export der Orgelfassung (für MuseScore, Sibelius, Finale …) ──
// Erzeugt aus demselben internen Modell wie die Notenanzeige (nicht aus dem
// ABC-Text): eine Stimme Melodie mit Text, bei Begleitsatz zusätzlich Alt
// (System 1) sowie Tenor/Bass (System 2). Ohne Taktart (senza misura); ein
// "Takt" reicht jeweils bis zum nächsten Trennstrich.
function clXmlEsc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

const CL_XML_TYPES = { 1: ['eighth', 0], 2: ['quarter', 0], 3: ['quarter', 1], 4: ['half', 0], 6: ['half', 1], 8: ['whole', 0], 12: ['whole', 1] };
function clXmlSplit(p) {
  const out = []; let r = p;
  for (const v of [12, 8, 6, 4, 3, 2, 1]) while (r >= v) { out.push(v); r -= v; }
  return out;
}
function clXmlPitch(n) {
  const step = CL_LETTERS[clMod(n.D, 7)], oct = Math.floor(n.D / 7);
  return '<pitch><step>' + step + '</step>' + (n.alt ? '<alter>' + n.alt + '</alter>' : '') + '<octave>' + oct + '</octave></pitch>';
}
// Eine (ggf. übergebundene) Note bzw. Pause schreiben.
// o: {pitch|null, dur, voice, staff, stem, cue, tieStartLast, tieStopFirst, notationsFirst, notationsLast, lyric, artic}
function clXmlNote(o) {
  const parts = clXmlSplit(o.dur);
  let x = '';
  parts.forEach((d, i) => {
    const first = i === 0, last = i === parts.length - 1;
    const t = CL_XML_TYPES[d];
    const tieStop = (!first) || (first && o.tieStopFirst);
    const tieStart = (!last) || (last && o.tieStartLast);
    x += '<note>' + (o.pitch ? clXmlPitch(o.pitch) : '<rest/>') + '<duration>' + d + '</duration>';
    if (o.pitch && tieStop) x += '<tie type="stop"/>';
    if (o.pitch && tieStart) x += '<tie type="start"/>';
    x += '<voice>' + o.voice + '</voice><type' + (o.cue ? ' size="cue"' : '') + '>' + t[0] + '</type>' + (t[1] ? '<dot/>' : '');
    if (o.pitch && o.stem) x += '<stem>' + o.stem + '</stem>';
    if (o.staff) x += '<staff>' + o.staff + '</staff>';
    let nots = '';
    if (o.pitch && tieStop) nots += '<tied type="stop"/>';
    if (o.pitch && tieStart) nots += '<tied type="start"/>';
    if (first && o.notationsFirst) nots += o.notationsFirst;
    if (last && o.notationsLast) nots += o.notationsLast;
    if (first && o.artic) nots += '<articulations>' + o.artic + '</articulations>';
    if (nots) x += '<notations>' + nots + '</notations>';
    if (first && o.lyric) x += o.lyric;
    x += '</note>';
  });
  return x;
}

function clBuildMusicXml(models) {
  if (!models || !models.length) return null;
  const accomp = models.some(m => m.accomp);
  const pedal = accomp && models.some(m => m.pedal);
  const m0 = models[0];
  let measures = [];
  let mNo = 0;
  models.forEach((m, ti) => {
    const units = [].concat(...m.lines);
    // Wortanfänge bestimmen (für Silbentrennung im Liedtext)
    let prevHyphen = false;
    units.forEach(u => { if (u.kind === 'syl' && u.text) { u._wordStart = !prevHyphen; prevHyphen = !!u.hyphen; } });
    let cur = null;
    const newMeasure = () => { cur = { s: [], low: { A: [], T: [], B: [] }, dur: 0, dirs: '', bar: null, ti, first: !measures.some(x => x.ti === ti) }; measures.push(cur); };
    newMeasure();
    let pendingDir = '';
    units.forEach((u, ui) => {
      const annXml = (u.ann || []).length ? '<direction placement="below"><direction-type><words>' + clXmlEsc(u.ann.join(' ')) + '</words></direction-type>' + (accomp ? '<staff>1</staff>' : '') + '</direction>' : '';
      if (u.kind === 'syl') {
        if (annXml) cur.s.push(annXml);
        u.notes.forEach((nt, k) => {
          const multi = u.notes.length > 1;
          let lyric = '';
          if (k === 0 && u.text) {
            const syl = u._wordStart ? (u.hyphen ? 'begin' : 'single') : (u.hyphen ? 'middle' : 'end');
            lyric = '<lyric number="1"><syllabic>' + syl + '</syllabic><text>' + clXmlEsc(u.text) + '</text></lyric>';
          }
          cur.s.push(clXmlNote({
            pitch: nt.pitch, dur: nt.dur, voice: 1, staff: accomp ? 1 : 0, stem: accomp ? 'up' : null, cue: !!nt.liq,
            notationsFirst: (multi && k === 0) ? '<slur type="start" number="1"/>' : '',
            notationsLast: (multi && k === u.notes.length - 1) ? '<slur type="stop" number="1"/>' : '',
            artic: nt.ten ? '<tenuto/>' : '', lyric,
          }));
          cur.dur += nt.dur;
          if (accomp && nt._seg && nt._seg.notes[0] === nt) {
            const sg = nt._seg, vc = sg.voicing || {};
            ['A', 'T', 'B'].forEach(v => {
              const n = vc[v] || null;
              const nn = sg.next && sg.next.voicing && sg.next.voicing[v];
              const tie = !!(n && sg.tieNext && nn && nn.D === n.D && nn.alt === n.alt);
              const prevTie = !!(n && sg._tiedFromPrev && sg._tiedFromPrev[v]);
              if (tie) { sg.next._tiedFromPrev = sg.next._tiedFromPrev || {}; sg.next._tiedFromPrev[v] = true; }
              cur.low[v].push(clXmlNote({
                pitch: n, dur: sg.pulses, voice: v === 'A' ? 2 : v === 'T' ? 3 : 4, staff: v === 'A' ? 1 : (v === 'B' && pedal ? 3 : 2),
                stem: pedal ? (v === 'A' ? 'down' : null) : (v === 'T' ? 'up' : 'down'), tieStartLast: tie, tieStopFirst: prevTie,
              }));
            });
          }
        });
      } else if (u.kind === 'bar') {
        if (annXml) cur.s.push(annXml);
        if (u.t === 'minima' && !u.final) {
          // Atemzeichen an die letzte Melodienote hängen
          for (let i = cur.s.length - 1; i >= 0; i--) {
            if (cur.s[i].indexOf('<note>') === 0) {
              const lastNoteStart = cur.s[i].lastIndexOf('<note>');
              let seg = cur.s[i].slice(lastNoteStart);
              seg = seg.indexOf('<notations>') >= 0 ? seg.replace('<notations>', '<notations><articulations><breath-mark/></articulations>')
                : seg.replace(/(<\/staff>|<\/stem>|<\/type>|<dot\/>)(?![\s\S]*(<\/staff>|<\/stem>|<\/type>|<dot\/>))/, '$1<notations><articulations><breath-mark/></articulations></notations>');
              cur.s[i] = cur.s[i].slice(0, lastNoteStart) + seg;
              break;
            }
          }
          return;
        }
        cur.bar = u.final ? 'light-heavy' : (u.t === 'minor' ? 'regular' : 'light-light');
        if (ui < units.length - 1) newMeasure();
      } else if (u.kind === 'ann' && annXml) {
        cur.s.push(annXml);
      }
    });
    if (!cur.dur && !cur.s.length) measures.pop();
    else if (!cur.bar) cur.bar = 'light-heavy';
  });

  // Ausgabe
  let body = '';
  measures.forEach((ms, i) => {
    mNo++;
    body += '<measure number="' + mNo + '"' + (ms.dur ? '' : ' implicit="yes"') + '>';
    if (i === 0 || ms.first) {
      const mm = models[ms.ti];
      body += (i > 0 ? '<print new-system="yes"/>' : '') + '<attributes>';
      if (i === 0) body += '<divisions>2</divisions>';
      body += '<key><fifths>' + mm.sigFifths + '</fifths></key><time print-object="no"><senza-misura/></time>';
      if (i === 0) {
        if (accomp) body += '<staves>' + (pedal ? 3 : 2) + '</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef>' + (pedal ? '<clef number="3"><sign>F</sign><line>4</line></clef>' : '');
        else body += '<clef><sign>G</sign><line>2</line></clef>';
      }
      body += '</attributes>';
      if (i > 0 && mm.title) body += '<direction placement="above"><direction-type><words font-weight="bold" font-size="12">' + clXmlEsc(mm.title) + '</words></direction-type></direction>';
    }
    body += ms.s.join('');
    if (accomp && ms.dur) {
      ['A', 'T', 'B'].forEach(v => { body += '<backup><duration>' + ms.dur + '</duration></backup>' + ms.low[v].join(''); });
    }
    if (ms.bar && ms.bar !== 'regular') body += '<barline location="right"><bar-style>' + ms.bar + '</bar-style></barline>';
    body += '</measure>';
  });

  const credit = (txt, just, valign, size, y) => txt ? '<credit page="1"><credit-words default-x="' + (just === 'left' ? 70 : just === 'right' ? 1130 : 600) + '" default-y="' + y + '" justify="' + just + '" valign="' + valign + '" font-size="' + size + '">' + clXmlEsc(txt) + '</credit-words></credit>' : '';
  const subs = String(m0.subtitle || '').split('\n').filter(Boolean);
  let credits = credit(m0.title, 'center', 'top', 22, 1640);
  subs.forEach((s, k) => { credits += credit(s, 'center', 'top', 13, 1590 - k * 22); });
  credits += credit(m0.left, 'left', 'bottom', 10, 1530) + credit(m0.right, 'right', 'bottom', 10, 1530);

  return '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' +
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n' +
    '<score-partwise version="3.1">' +
    '<work><work-title>' + clXmlEsc(m0.title || 'Unbenanntes Stück') + '</work-title></work>' +
    '<identification><encoding><software>Notator</software><encoding-date>' + new Date().toISOString().slice(0, 10) + '</encoding-date></encoding></identification>' +
    '<defaults><page-layout><page-height>1697</page-height><page-width>1200</page-width></page-layout></defaults>' +
    credits +
    '<part-list><score-part id="P1"><part-name>' + (accomp ? 'Orgel' : 'Melodie') + '</part-name></score-part></part-list>' +
    '<part id="P1">' + body + '</part></score-partwise>\n';
}

function clDownloadMusicXml() {
  const list = clCollectGabc();
  if (!clHasNotes(list)) { gregGst('Keine Noten vorhanden.'); return; }
  const r = clBuild();
  if (!r || !r.models) return;
  const xml = clBuildMusicXml(r.models);
  if (!xml) return;
  if (clState[clMK()]) gregGst('Hinweis: Handänderungen im Quelltext sind im MusicXML nicht enthalten (Export aus der automatisch erzeugten Fassung).');
  const blob = new Blob([xml], { type: 'application/vnd.recordare.musicxml+xml;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = clFileBase() + (clState.accomp ? '_Orgel' : '') + '.musicxml'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

