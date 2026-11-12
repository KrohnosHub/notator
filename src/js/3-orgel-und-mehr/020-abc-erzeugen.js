// ── 3. ABC erzeugen ───────────────────────────────────────────
function clAbcPitch(D, alt, accMark) {
  const oct = Math.floor(D / 7), L = CL_LETTERS[clMod(D, 7)];
  let acc = '';
  if (accMark) acc = alt === 0 ? '=' : alt > 0 ? '^'.repeat(alt) : '_'.repeat(-alt);
  let name;
  if (oct >= 5) name = L.toLowerCase() + "'".repeat(oct - 5);
  else name = L + ','.repeat(4 - oct);
  return acc + name;
}

function clAbcLen(p) {
  if (p === 1) return [''];
  if ([2, 3, 4, 6, 8, 12, 16].includes(p)) return [String(p)];
  const parts = []; let r = p;
  for (const v of [16, 12, 8, 6, 4, 3, 2, 1]) while (r >= v) { parts.push(v === 1 ? '' : String(v)); r -= v; }
  return parts;
}

function clAbcEscapeLyric(t) {
  return String(t).replace(/[\\_*|%-]/g, m => '\\' + m).replace(/\s+/g, '~');
}

// Unsichtbare Markerzeichen für die Platzierung notenloser Texte
const CL_MARK_SYL = '\u2060', CL_MARK_BAR = '\u200B';

// T:-Zeilen für Titel + (mehrzeiligen) Untertitel. abcjs zeigt die erste
// T:-Zeile als Titel, jede weitere als Untertitel.
// Lange Titel/Untertitel umbrechen (abcjs setzt jede T:-Zeile einzeilig und
// schneidet sonst am Rand ab). Zeichenzahl aus der Notenbreite geschätzt.
function clWrapText(t, maxChars) {
  const words = String(t).split(/\s+/).filter(Boolean), lines = [];
  let cur = '';
  words.forEach(w => {
    if (cur && (cur + ' ' + w).length > maxChars) { lines.push(cur); cur = w; }
    else cur = cur ? cur + ' ' + w : w;
  });
  if (cur) lines.push(cur);
  return lines;
}
function clAbcTitleLines(title, subtitle) {
  const clean = t => String(t || '').replace(/[\r\n]+/g, ' ').replace(/%/g, '\\%').trim();
  const sw = (typeof clScoreWidth === 'function' ? clScoreWidth() : 0) || 740;
  const subMax = Math.max(25, Math.floor(sw / 7.2)), titleMax = Math.max(15, Math.floor(sw / 10.5));
  // gemessen (wie im Choral), Schätzung als Rückfall
  const wrap = (t, px, maxC) => {
    try { if (typeof gregWordWrap === 'function') { const w = gregWordWrap(t, px + "px 'Palatino Linotype', Palatino, serif", sw - 40); if (w && w.length) return w; } } catch (e) {}
    return clWrapText(t, maxC);
  };
  let out = '';
  const subs = [];
  String(subtitle || '').split(/\n/).map(clean).filter(Boolean).forEach(l => subs.push(...wrap(l, 18, subMax)));
  const tls = clean(title) ? wrap(clean(title), 24, titleMax) : [];
  // abcjs: erste T:-Zeile = Titel, weitere T:-Zeilen = Untertitel (Fortsetzung eines sehr langen Titels erscheint als Untertitelzeile)
  if (tls.length) { out += 'T:' + tls[0] + '\n'; tls.slice(1).forEach(l => { out += 'T:' + l + '\n'; }); }
  else if (subs.length) out += 'T: \n';
  subs.forEach(l => { out += 'T:' + l + '\n'; });
  return out;
}

function clAbcSideLines(left, right) {
  const clean = t => String(t || '').replace(/[\r\n]+/g, ' ').replace(/%/g, '\\%').trim();
  let out = '';
  if (clean(left)) out += 'R:' + clean(left) + '\n';
  if (clean(right)) out += 'C:' + clean(right) + '\n';
  return out;
}

// Ersetzt die T:-Zeilen des ERSTEN Stücks in einem (ggf. von Hand
// bearbeiteten) ABC-Text durch neue Titel/Untertitel.
function clApplyHeaderToAbc(abc, title, subtitle, left, right) {
  const sides = (left !== undefined || right !== undefined);
  const tl = (clAbcTitleLines(title, subtitle) + (sides ? clAbcSideLines(left, right) : '')).replace(/\n$/, '');
  const lines = abc.split('\n');
  let tuneNo = 0;
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^X:/.test(l)) {
      tuneNo++; out.push(l);
      if (tuneNo === 1 && tl) out.push(tl); // nie eine Leerzeile einfügen (= Stückende in ABC)
      continue;
    }
    if (tuneNo === 1 && (/^T:/.test(l) || (sides && /^[RC]:/.test(l)))) continue;
    out.push(l);
  }
  return out.join('\n');
}

