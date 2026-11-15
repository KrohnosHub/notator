// ── Wiedergabe (Choral + Orgel) ─────────────────────────────────────
// Klangerzeugung über den Synthesizer von abcjs (Klangbibliothek wird beim
// ersten Abspielen aus dem Netz geladen, danach vom Browser/Service Worker
// zwischengespeichert). Choral: die einstimmige Übertragung in Original-
// lage; Orgel: genau die angezeigte Fassung (inkl. Transposition und
// Begleitsatz) mit Mitlesen (gespielte Noten werden hervorgehoben).
// p >= 1000: «sanfte» Variante = Programm p-1000, leise Dynamik (Melodie mp,
// Begleitstimmen p) – imitiert eine leichte Registrierung (Flöten 8').
// Klangwahl nach Analyse der FluidR3-Samples (2026-10-13): «recorder» hat das
// Spektrum eines Gedackt 8′ (fast reiner Grundton, schwache 3. Teiltöne) und
// hält den Ton; «reed_organ» (Harmonium) setzt schnell an und hält ohne
// Abklingen; «church_organ» ist hell (Mixturen) und schwillt langsam an.
const NT_INSTRUMENTS = [{ p: 19, n: 'Orgel – volles Werk' }, { p: 1074, n: 'Orgel – sanft (Pfeifenorgel-Aufnahme)' }, { p: 1020, n: 'Orgel – ruhig (Harmonium)' }, { p: 52, n: 'Chor' }, { p: 73, n: 'Flöte' }, { p: 0, n: 'Klavier' }];
// Legato: jede Note klingt bis in die nächste hinein (kurzes Überlappen), damit
// der Ansatz des nächsten Samples die Lücke nicht hörbar macht («abgehackt»).
// Tonwiederholungen bleiben leicht abgesetzt, wie auf der Orgel.
function ntLegato(tracks, qpm, program) {
  if (program === 0) return; // Klavier: normaler Anschlag
  // Orgelklänge: Nachfolgeton setzt genau beim Ende ein, der alte klingt über
  // die (kurze) Ausklingzeit aus -> Überblendung ohne neuen «Anschlag»
  const ov = (program === 74 || program === 20 ? 0 : 0.09) * qpm / 240;
  const cut = 0.05 * qpm / 240;     // ~50 ms Absetzen bei Tonwiederholung
  tracks.forEach(tr => {
    const notes = tr.slice().sort((a, b) => a.start - b.start);
    notes.forEach((n, i) => {
      let nx = null;
      for (let k = i + 1; k < notes.length; k++) if (notes[k].start > n.start + 1e-6) { nx = notes[k]; break; }
      if (!nx || nx.start - n.end > 0.02) return; // Pause folgt: nicht verlängern
      const sameP = notes.some(m => m.start === nx.start && m.pitch === n.pitch);
      n.end = sameP ? Math.max(n.start + (n.end - n.start) * 0.5, nx.start - cut) : nx.start + ov;
    });
  });
}
const ntPlayProgram = instr => instr >= 1000 ? instr - 1000 : instr;
// Leise Dynamik in den Abspiel-Notentext einfügen (sanfte Registrierung)
function ntSoftenAbc(abc) {
  if (ntPlayPrefs().instr < 1000) return abc;
  return abc.split('\n').map(l => {
    if (/^\[V:S\]/.test(l)) return l.replace(/^\[V:S\]\s*/, '[V:S] !mp! ');
    if (/^\[V:[ATB]\]/.test(l)) return l.replace(/^(\[V:[ATB]\])\s*/, '$1 !p! ');
    // einstimmige Choral-Wiedergabe: Notenzeilen ohne Stimmangabe
    if (l && !/^[A-Za-z]:|^%|^\[V:/.test(l) && /[A-Ga-g]/.test(l)) return '!mp! ' + l;
    return l;
  }).join('\n');
}
const ntPlay = { synth: null, timer: null, state: 'stop', source: null, token: 0, ac: null, sec: -1 };
// Abschnittswahl für die Wiedergabe (nur bei mehreren Abschnitten sichtbar):
// -1 = alle Abschnitte nacheinander, sonst nur dieser Abschnitt.
function ntPlaySecCount() { return (window._gregMultiSection && typeof gregSections !== 'undefined' && gregSections.length > 1) ? gregSections.length : 1; }
function ntPlaySecUi() {
  const n = ntPlaySecCount();
  if (ntPlay.sec >= n) ntPlay.sec = -1;
  let titles = [];
  if (n > 1) { try { titles = clCollectGabc().map(x => x.title || ''); } catch (e) {} }
  const opts = n > 1 ? ['<option value="-1">Alle Abschnitte</option>'].concat(Array.from({ length: n }, (_, i) => '<option value="' + i + '">Abschnitt ' + (i + 1) + (titles[i] ? ' – ' + ntEscAttr(titles[i].slice(0, 24)) : '') + '</option>')).join('') : '';
  document.querySelectorAll('.nt-play-sec').forEach(sel => {
    sel.style.display = n > 1 ? '' : 'none';
    if (n > 1 && sel._k !== opts) { sel.innerHTML = opts; sel._k = opts; }
    if (n > 1) sel.value = String(ntPlay.sec);
  });
}
function ntPlaySecSet(v) { ntPlay.sec = parseInt(v, 10); if (isNaN(ntPlay.sec)) ntPlay.sec = -1; if (ntPlay.state !== 'stop') ntPlayStop(); ntPlaySecUi(); }

function ntPlayPrefs() {
  let p = null; try { p = JSON.parse(localStorage.getItem('notatorPlay') || 'null'); } catch (e) {}
  return Object.assign({ tempo: 150, instr: 19 }, p || {});
}
function ntPlaySavePrefs(p) { try { localStorage.setItem('notatorPlay', JSON.stringify(p)); } catch (e) {} }

function ntPlayUpdateButtons() {
  try { ntPlaySecUi(); } catch (e) {}
  document.querySelectorAll('.nt-play-btn').forEach(b => {
    const mine = ntPlay.source === b.getAttribute('data-src');
    b.innerHTML = (mine && ntPlay.state === 'play') ? '&#10074;&#10074;' : '&#9654;';
    b.title = (mine && ntPlay.state === 'play') ? 'Pause' : (mine && ntPlay.state === 'pause' ? 'Weiter abspielen' : 'Abspielen');
  });
}
function ntClearHighlight() {
  document.querySelectorAll('.nt-playing').forEach(el => el.classList.remove('nt-playing'));
}

function ntPlayStop() {
  ntPlay.token++;
  try { if (ntPlay.synth) ntPlay.synth.stop(); } catch (e) {}
  try { if (ntPlay.timer) ntPlay.timer.stop(); } catch (e) {}
  ntPlay.synth = null; ntPlay.timer = null; ntPlay.state = 'stop'; ntPlay.source = null;
  ntClearHighlight();
  ntPlayUpdateButtons();
}

// Audio muss im Klick selbst "entsperrt" werden (Handy-Browser) -- darum
// wird der AudioContext synchron hier angelegt, bevor geladen wird.
