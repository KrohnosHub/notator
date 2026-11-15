// ── 5. Bedienoberfläche des Orgel-Tabs ───────────────────────────
const CL_ABCJS_URL = 'https://cdn.jsdelivr.net/npm/abcjs@6.7.1/dist/abcjs-basic-min.js';
// Zustand der klassischen Fassung (wird mit dem Stück gespeichert):
//  targetPc/octave: Transposition · manualAbc: von Hand bearbeiteter Notentext
//  width: Layoutbreite in px (null = an Fenster anpassen)
//  head: null = Titel/Untertitel folgen dem Choral; {title,subtitle} = eigene
//        Fassung (ab der ersten Änderung im Orgel-Tab, danach keine
//        automatische Übernahme mehr aus dem Choral)
//  texts: Freitexte [{id, t (Stück-Index), x, y, text, size}] in SVG-Koordinaten
//  accomp: Begleitsatz an/aus · chordOverrides: {Abschnitt: Akkordstufe rel. zur Finalis}
//  manualAbcAcc: handbearbeiteter Quelltext der Fassung MIT Begleitsatz
//  left/right: Kopfzeile links ("Ton 8") / rechts (Transpositionshinweis …);
//        null = automatisch, sonst eigener Text (auch leer = ausgeblendet)
var clState = { targetPc: null, octave: 0, manualAbc: null, width: null, head: null, left: null, right: null, texts: [] };
function clNormalizeState() {
  clState = Object.assign({ targetPc: null, octave: 0, manualAbc: null, manualAbcAcc: null, width: null, head: null, left: null, right: null, texts: [], accomp: true, pedal: false, flatToBar: true, chordOverrides: {}, chordBreaks: {}, lineBreaks: {} }, clState || {}); // b gilt standardmässig bis zur nächsten Divisio (Nutzerentscheid 2026-10-10) // Begleitsatz standardmässig an
  if (!Array.isArray(clState.texts)) clState.texts = [];
  if (!clState.chordOverrides || typeof clState.chordOverrides !== 'object') clState.chordOverrides = {};
  if (!clState.lineBreaks || typeof clState.lineBreaks !== 'object') clState.lineBreaks = {};
  if (!clState.pageBreaks || typeof clState.pageBreaks !== 'object') clState.pageBreaks = {};
}
// Handbearbeiteter Quelltext wird je Fassung (mit/ohne Begleitsatz) getrennt geführt
function clMK() { return clState.accomp ? 'manualAbcAcc' : 'manualAbc'; }
function clToggleAccomp() {
  clState.accomp = !clState.accomp;
  clRender();
}
function clToggleFlatScope() {
  clState.flatToBar = !clState.flatToBar;
  clRender();
}
function clTogglePedal() {
  clState.pedal = !clState.pedal;
  clRender();
}
let clLast = null;
let _clAbcjsLoading = false;

function clEnsureAbcjs(cb) {
  if (window.ABCJS) { cb(); return; }
  const el = document.getElementById('cl-score');
  if (el) el.textContent = 'Lade Notensatz-Bibliothek …';
  if (_clAbcjsLoading) { setTimeout(() => clEnsureAbcjs(cb), 200); return; }
  _clAbcjsLoading = true;
  const s = document.createElement('script');
  s.src = CL_ABCJS_URL;
  s.onload = () => { _clAbcjsLoading = false; cb(); };
  s.onerror = () => { _clAbcjsLoading = false; if (el) el.textContent = 'Notensatz-Bibliothek konnte nicht geladen werden (Internetverbindung?).'; };
  document.head.appendChild(s);
}

// Alle Abschnitte als GABC einsammeln (aktiver Abschnitt = Live-Daten),
// samt Titel/Untertitel des Chorals.
// vis = true: ausgeblendete Abschnitte weglassen (Orgelansicht/-PDF); jedes
// Element trägt in .si seinen ursprünglichen Abschnittsindex (Einstellungen,
// Akkord-/Umbruch-Schlüssel). Sind alle ausgeblendet, wird nichts weggelassen.
function clCollectGabc(vis) {
  if (window._gregMultiSection && gregSections.length > 1) {
    if (typeof gregSectionFromUI === 'function') gregSectionFromUI();
    let l = gregSections.map((sec, i) => ({ gabc: gregBuildGABCFor(sec), title: sec.title || '', subtitle: sec.subtitle || '', si: i, hidden: !!sec.hidden }));
    if (vis && l.some(x => !x.hidden)) l = l.filter(x => !x.hidden);
    return l;
  }
  const t = (document.getElementById('greg-title') || { value: '' }).value;
  const st = (document.getElementById('greg-subtitle') || { value: '' }).value;
  return [{ gabc: gregBuildGABC(), title: t, subtitle: st, si: 0 }];
}
function clVisIdx() { return clCollectGabc(true).map(x => x.si); }

function clHasNotes(list) {
  return list.some(x => /\([^)]*[a-mA-M][^)]*\)/.test((x.gabc.split('%%').pop() || '').replace(/\((?:c|f)b?[1-5]\)/g, '')));
}

function clChantHead(i) {
  const l = clCollectGabc();
  const x = l[i || 0] || l[0];
  return { title: x.title || '', subtitle: x.subtitle || '' };
}
// Orgel-Einstellungen je Abschnitt: Abschnitt 1 = bisherige Felder von
// clState (kompatibel mit gespeicherten Stücken), weitere Abschnitte in
// clState.secs[Abschnitts-ID] (Grundton, Oktave, Titel, Untertitel, Kopfzeile).
let clSel = 0; // im Orgel-Tab gewählter Abschnitt
function clCfg(i) {
  i = i || 0;
  if (i === 0) return clState;
  const sec = (typeof gregSections !== 'undefined' && gregSections[i]) || null;
  const id = sec && sec.id ? sec.id : 'i' + i;
  if (!clState.secs || typeof clState.secs !== 'object') clState.secs = {};
  if (!clState.secs[id]) clState.secs[id] = { targetPc: null, octave: 0, head: null, left: null, right: null };
  return clState.secs[id];
}
function clSecCount() { return (window._gregMultiSection && typeof gregSections !== 'undefined' && gregSections.length > 1) ? gregSections.length : 1; }
function clEffectiveHead(i) {
  const c = clCfg(i);
  return c.head ? c.head : clChantHead(i);
}
// Import in einen Abschnitt: bei mehreren Abschnitten nur dessen Orgel-Einstellungen zurücksetzen
function ntResetOrganForImport() {
  if (clSecCount() > 1) {
    const i = typeof gregActiveIdx !== 'undefined' ? gregActiveIdx : 0;
    const c = clCfg(i); c.targetPc = null; c.octave = 0; c.head = null; c.left = null; c.right = null;
    return;
  }
  clState = {}; clNormalizeState(); clUndoReset();
}
// Grundton des gewählten Abschnitts auf alle Abschnitte übertragen
// (Oktave bleibt je Abschnitt; danach weiter einzeln änderbar)
function clTargetToAll() {
  const n = clSecCount(); if (n < 2) return;
  const tp = clCfg(clSel).targetPc;
  if (!clConfirmDropManual()) return;
  for (let i = 0; i < n; i++) clCfg(i).targetPc = tp;
  clRender();
  gregGst('Grundton für alle ' + n + ' Abschnitte übernommen' + (tp == null ? ' (Original)' : ''));
}
function clSelectSection(v) { clSel = Math.max(0, Math.min(clSecCount() - 1, parseInt(v, 10) || 0)); clFillTargetSelect(); clSyncControls(); }

// Handy: ohne eigene Breite gilt 950 px (Nutzerwunsch 2026-10-19) -- das
// Notenbild wird auf die Bildschirmbreite eingepasst (nur Anzeige, PDF wie bisher).
const CL_MOBILE_DEFAULT_W = 950;
// Gilt auch, wenn das Stück eine (am Computer gespeicherte) Breite mitbringt; erst
// eine auf dem Handy von Hand eingestellte Breite übersteuert sie.
function clMobileDefaultW() { return (!window._clWidthTouched && !ntViewScale._override && typeof gregIsMobileViewport === 'function' && gregIsMobileViewport()) ? CL_MOBILE_DEFAULT_W : 0; }
function clScoreWidth() {
  const wrap = document.getElementById('cl-score-wrap');
  if (clMobileDefaultW()) return CL_MOBILE_DEFAULT_W;
  // Seitenansicht (Desktop): ohne gespeicherte Breite gilt A4
  if (ntPaperOn() && !clState.width) return CL_PAPER_A4;
  if (clState.width) {
    // Anpassen: gespeicherte Breite nur verwenden, wenn sie auf den Bildschirm passt
    // Ausnahme: Breite wurde auf diesem Gerät gerade von Hand eingestellt -> gilt (Anzeige wird eingepasst)
    if (window._clWidthTouched || !(ntFit('cl') && wrap && wrap.clientWidth > 0 && clState.width * ntViewScale('cl') + 60 > wrap.clientWidth - 24)) return clState.width;
  }
  // clientWidth enthält das Padding (2x12) des Wrappers; abcjs addiert
  // paddingleft/right (2x10) zur staffwidth -> Rest als Sicherheitsrand.
  const w = wrap ? wrap.clientWidth - 24 - 20 - 16 - (ntFit('cl') ? 6 : 0) : 740;
  const vs = ntViewScale('cl'); // kleiner -> mehr Noten pro Zeile
  return Math.max(280, Math.min(w / vs, 1100 / Math.min(vs, 1)));
}

function clBuild(extra) {
  let list = clCollectGabc(true);
  if (extra && extra.verseMode) list = list.map(x => Object.assign({}, x, { gabc: ntVerseExpandGabc(x.gabc, extra.verseMode) }));
  if (!clHasNotes(list)) return null;
  const sw = clScoreWidth();
  const headers = list.map(x => Object.assign({}, clEffectiveHead(x.si), { left: clCfg(x.si).left, right: clCfg(x.si).right }));
  const sectionOpts = list.map(x => ({ targetPc: clCfg(x.si).targetPc, octave: clCfg(x.si).octave || 0 }));
  return clGabcToAbc(list, { sectionOpts, targetPc: clState.targetPc, octave: clState.octave, charsPerLine: Math.max(10, Math.round(sw / 11.5)), headers, accomp: !!clState.accomp, pedal: !!clState.pedal, flatToBar: !!clState.flatToBar, chordOverrides: clState.chordOverrides, pageBreaks: clState.pageBreaks || {}, chordBreaks: clState.chordBreaks, lineBreaks: clState.lineBreaks, playRests: !!(extra && extra.playRests) });
}

function clFillTargetSelect() {
  const sel = document.getElementById('cl-target');
  if (!sel) return;
  const list = clCollectGabc();
  sel.innerHTML = '';
  if (!clHasNotes(list)) return;
  if (clSel >= list.length) clSel = 0;
  const lsec = list[clSel];
  const cfg = clCfg(clSel);
  const parsed = clParseGabc(lsec.gabc, { flatToBar: !!clState.flatToBar });
  const fin = clFinalis(parsed);
  const base = clBaseKeyFifths(lsec.gabc);
  const origPc = clPcOf(clMod(fin.D, 7), fin.alt);
  for (let k = 0; k < 12; k++) {
    const pc = clMod(origPc + k, 12);
    const t = clBestTarget(pc, fin, base);
    if (!t) continue;
    const o = document.createElement('option');
    o.value = pc;
    const sig = t.sigFifths === 0 ? 'ohne Vorz.' : Math.abs(t.sigFifths) + (t.sigFifths > 0 ? '♯' : '♭');
    o.textContent = clKeyName(t.step, t.alt) + ' ' + CL_MODE_DE[t.modeIdx] + ' (' + sig + ')' + (pc === origPc ? ' – Original' : '');
    if ((cfg.targetPc == null && pc === origPc) || cfg.targetPc === pc) o.selected = true;
    sel.appendChild(o);
  }
}

function clSyncControls() {
  const ab = document.getElementById('cl-accomp-btn');
  if (ab) { ab.innerHTML = clState.accomp ? '&#127929; Begleitsatz: an' : '&#127929; Begleitsatz: aus'; ab.style.background = clState.accomp ? '#2a4a6a' : ''; ab.style.color = clState.accomp ? '#fff' : ''; }
  const fb = document.getElementById('cl-flat-btn');
  if (fb) { fb.innerHTML = clState.flatToBar ? '♭ gilt bis Trennstrich' : '♭ gilt bis Wortende (Solesmes)'; fb.style.background = clState.flatToBar ? '' : '#6a4a2a'; fb.style.color = clState.flatToBar ? '' : '#fff'; }
  const pb = document.getElementById('cl-pedal-btn');
  if (pb) { pb.style.display = clState.accomp ? '' : 'none'; pb.innerHTML = clState.pedal ? 'Pedal: eigenes System' : 'Pedal: im Bass-System'; pb.style.background = clState.pedal ? '#2a4a6a' : ''; pb.style.color = clState.pedal ? '#fff' : ''; }
  // Abschnittswahl (nur bei mehreren Abschnitten)
  const nSec = clSecCount();
  if (clSel >= nSec) clSel = 0;
  const sw = document.getElementById('cl-sec-wrap'), ss = document.getElementById('cl-sec-sel');
  if (sw) sw.style.display = nSec > 1 ? 'flex' : 'none';
  const ta = document.getElementById('cl-target-all'); if (ta) ta.style.display = nSec > 1 ? '' : 'none';
  if (ss && nSec > 1) {
    const list = clCollectGabc();
    const want = list.map((x, i) => (i + 1) + (x.title ? ' – ' + x.title.slice(0, 30) : '')).join('|');
    if (ss._k !== want) { ss.innerHTML = list.map((x, i) => '<option value="' + i + '">Abschnitt ' + (i + 1) + (x.title ? ' – ' + ntEscAttr(x.title.slice(0, 30)) : '') + '</option>').join(''); ss._k = want; }
    ss.value = String(clSel);
  }
  const cfg = clCfg(clSel);
  const octEl = document.getElementById('cl-oct');
  if (octEl) octEl.textContent = (cfg.octave > 0 ? '+' : '') + (cfg.octave || 0);
  const wr = document.getElementById('cl-width');
  const wv = document.getElementById('cl-width-val');
  const w = clScoreWidth();
  if (wr && document.activeElement !== wr) wr.value = w;
  if (wv) wv.textContent = w + ' px';
  const wa = document.getElementById('cl-width-auto');
  if (wa) { const au = !clState.width; wa.style.background = au ? '#3d6b35' : ''; wa.style.color = au ? '#fff' : ''; wa.title = au ? 'Breite passt sich automatisch ans Fenster an' : 'Breite wieder automatisch ans Fenster anpassen'; }
  const h = clEffectiveHead(clSel);
  const ti = document.getElementById('cl-title'), su = document.getElementById('cl-subtitle');
  if (ti && document.activeElement !== ti) ti.value = h.title || '';
  if (su && document.activeElement !== su) su.value = h.subtitle || '';
  const inf = clLast && ((clLast.infos && clLast.infos[clSel]) || clLast.info);
  const le = document.getElementById('cl-left'), ri = document.getElementById('cl-right');
  if (le && document.activeElement !== le) le.value = cfg.left != null ? cfg.left : ((inf && inf.autoLeft) || '');
  if (ri && document.activeElement !== ri) ri.value = cfg.right != null ? cfg.right : ((inf && inf.autoRight) || '');
  const hs = document.getElementById('cl-head-state');
  if (hs) hs.textContent = (cfg.head ? 'eigene Fassung (unabhängig vom Choral)' : 'wird vom Choral übernommen') + (nSec > 1 ? ' · gilt für Abschnitt ' + (clSel + 1) : '');
}

