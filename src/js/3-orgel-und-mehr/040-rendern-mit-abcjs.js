// ── 4. Rendern mit abcjs (inkl. verkleinerter Liqueszenz-Noten) ──
// Jedes Stück (X:-Block, = Abschnitt) bekommt ein eigenes SVG -- abcjs
// rendert in ein einzelnes Element sonst nur das erste Stück.
function clRenderAbc(el, abc, liqChars, staffwidth, onNoteClick, pbRanges) {
  if (!window.ABCJS) { el.textContent = 'Notensatz-Bibliothek (abcjs) nicht geladen – Internetverbindung prüfen.'; return []; }
  el.innerHTML = '';
  const starts = [];
  const re = /^X:/gm; let m;
  while ((m = re.exec(abc))) starts.push(m.index);
  if (!starts.length) starts.push(0);
  const all = [];
  starts.forEach((st, ti) => {
    const en = ti + 1 < starts.length ? starts[ti + 1] : abc.length;
    const part = abc.slice(st, en);
    const div = document.createElement('div');
    div.className = 'cl-tune';
    div.setAttribute('data-tune', ti);
    div.style.position = 'relative';
    el.appendChild(div);
    const tunes = ABCJS.renderAbc(div, part, {
      add_classes: true,
      clickListener: onNoteClick ? function(abcelem, tuneNumber, classes, analysis, drag, ev) { onNoteClick(st + (abcelem.startChar || 0), ev, st + (abcelem.endChar || abcelem.startChar || 0)); } : undefined,
      staffwidth: staffwidth || 740,
      paddingleft: 10, paddingright: 10, paddingbottom: 6, // unten wenig Rand: Abstand zum nächsten Abschnitt wie im Choral
      format: { titlefont: '"Palatino Linotype", Palatino, serif 18', subtitlefont: '"Palatino Linotype", Palatino, serif 13', composerfont: '"Palatino Linotype", Palatino, serif 11 italic', infofont: '"Palatino Linotype", Palatino, serif 11 italic', vocalfont: '"Palatino Linotype", Palatino, serif 13', annotationfont: '"Palatino Linotype", Palatino, serif 13' },
    });
    // Zeilen (abcjs-l<N>), in denen ein manueller Seitenumbruch beginnt (für Vorschau und PDF)
    div._pbLineNums = [];
    (pbRanges || []).forEach(r => {
      if (r.start < st || r.start >= en) return;
      const rs = r.start - st, re = r.end - st; let ln = null;
      tunes.forEach(t => (t.lines || []).forEach(line => (line.staff || []).forEach(sf => (sf.voices || []).forEach(v => v.forEach(elem => {
        if (ln != null || elem.el_type !== 'note' || elem.rest || !(elem.startChar < re && elem.endChar > rs)) return;
        (elem.abselem && elem.abselem.elemset || []).forEach(g => {
          if (ln != null || !g || !g.getAttribute) return;
          const m = String(g.getAttribute('class') || '').match(/abcjs-l(\d+)/); if (m) ln = +m[1];
        });
      })))));
      if (ln != null && div._pbLineNums.indexOf(ln) < 0) div._pbLineNums.push(ln);
    });
    const liq = new Set((liqChars || []).filter(c => c >= st && c < en).map(c => c - st));
    if (liq.size) {
      tunes.forEach(t => (t.lines || []).forEach(line => (line.staff || []).forEach(sf => (sf.voices || []).forEach(v => v.forEach(elem => {
        if (elem.el_type !== 'note' || elem.rest) return;
        let hit = false;
        liq.forEach(c => { if (c >= elem.startChar && c < elem.endChar) hit = true; });
        if (!hit || !elem.abselem || !elem.abselem.elemset) return;
        elem.abselem.elemset.forEach(g => {
          try {
            // um die Mitte des Notenkopfs verkleinern, nicht um die Mitte der
            // ganzen Gruppe (Hals/Balken) – sonst rutscht der Kopf auf eine
            // falsche Tonhöhe
            const heads = (g.classList && g.classList.contains('abcjs-notehead')) ? [g] : Array.from(g.querySelectorAll ? g.querySelectorAll('.abcjs-notehead') : []);
            if (!heads.length) return; // Hals, Fähnchen, Balken unverändert lassen
            // Nur den Notenkopf verkleinern, verankert an der Halsseite:
            // Tonhöhe bleibt, Hals und Balken bleiben angeschlossen.
            const stem = (g.querySelector && g.querySelector('.abcjs-stem')) ||
              elem.abselem.elemset.find(x => x.classList && x.classList.contains('abcjs-stem'));
            const sb = stem ? stem.getBBox() : null;
            heads.forEach(h => {
              const bb = h.getBBox();
              const cy = bb.y + bb.height / 2;
              const cx = sb ? ((sb.x + sb.width / 2) > (bb.x + bb.width / 2) ? bb.x + bb.width : bb.x) : bb.x + bb.width / 2;
              h.setAttribute('transform', 'translate(' + cx + ',' + cy + ') scale(0.7) translate(' + (-cx) + ',' + (-cy) + ')');
            });
          } catch (e) {}
        });
      })))));
    }
    const grand = /%%score/.test(part);
    div.querySelectorAll('svg').forEach(sv => { clPlaceLyricAnnotations(sv, grand); clSystemEndLines(sv); clTightenHeader(sv); });
    // abcjs fixiert die Höhe des Containers auf die ursprüngliche SVG-Höhe;
    // nach clTightenHeader ist das SVG niedriger -> sonst Leerraum zwischen
    // den Abschnitten (Höhe folgt jetzt dem SVG).
    div.style.height = 'auto';
    all.push(...tunes);
  });
  return all;
}

// abcjs lässt zwischen Kopfbereich (Titel/Untertitel/Kopfzeile) und dem
// ersten Notensystem sehr viel Luft (~80 px). Der Kopfblock wird darum nach
// unten an die Musik herangerückt (Abstand CL_HEADER_GAP) und der frei
// gewordene Streifen oben per viewBox abgeschnitten. Die Musik selbst behält
// ihre Koordinaten (wichtig für Freitext-Positionen und PDF-Seitenumbruch).
const CL_HEADER_GAP = 24; // px, ergibt im PDF ca. 0,6–0,9 cm je nach Breite
function clTightenHeader(svg) {
  const meta = svg.querySelector('g.abcjs-meta-top');
  if (!meta) return;
  let hb;
  try { const b = meta.getBBox(); if (!b.height) return; hb = b.y + b.height; } catch (e) { return; }
  let top = Infinity;
  Array.from(svg.children).forEach(c => {
    if (c === meta || /^(style|title|defs)$/i.test(c.tagName)) return;
    try { const b = c.getBBox(); if (b.height || b.width) top = Math.min(top, b.y); } catch (e) {}
  });
  if (!isFinite(top)) return;
  const delta = Math.floor(top - hb - CL_HEADER_GAP);
  if (delta <= 2) return;
  const w = parseFloat(svg.getAttribute('width')) || svg.getBoundingClientRect().width;
  const h = parseFloat(svg.getAttribute('height')) || svg.getBoundingClientRect().height;
  meta.setAttribute('transform', 'translate(0,' + delta + ')');
  svg.setAttribute('viewBox', '0 ' + delta + ' ' + w + ' ' + (h - delta));
  svg.setAttribute('width', w);
  svg.setAttribute('height', h - delta);
}

// Verschiebt Unter-Beschriftungen (iij., ij., Ant. …) auf die Grundlinie
// der Textzeile desselben Systems und gibt ihnen dieselbe Schrift wie der
// gesungene Text -- so stehen sie wie im Choralsatz direkt im Text.
// Systemende ohne Trennstrich: gestrichelter Strich über alle Systeme der
// Zeile (übliche Satzpraxis, wenn eine Phrase über den Zeilenumbruch läuft –
// gestrichelter oder gar kein Strich; gestrichelt bleibt er von den
// durchgezogenen Strichen der Divisiones unterscheidbar). abcjs kennt keinen
// gestrichelten Taktstrich, darum nachträglich ins SVG gezeichnet.
function clSystemEndLines(svg) {
  const ns = 'http://www.w3.org/2000/svg';
  const lineOf = el => { const m = String(el.getAttribute('class') || '').match(/abcjs-l(\d+)/); return m ? m[1] : null; };
  const bbox = el => { try { return el.getBBox(); } catch (e) { return null; } };
  const staves = {};
  svg.querySelectorAll('.abcjs-staff').forEach(st => {
    const l = lineOf(st); const b = bbox(st); if (l === null || !b || !b.width) return;
    const o = staves[l] || (staves[l] = { x2: 0, y1: Infinity, y2: -Infinity });
    o.x2 = Math.max(o.x2, b.x + b.width); o.y1 = Math.min(o.y1, b.y); o.y2 = Math.max(o.y2, b.y + b.height);
  });
  Object.keys(staves).forEach(l => {
    const o = staves[l];
    let endsWithBar = false;
    svg.querySelectorAll('.abcjs-bar.abcjs-l' + l).forEach(bEl => { const b = bbox(bEl); if (b && b.x + b.width >= o.x2 - 3) endsWithBar = true; });
    if (endsWithBar) return;
    const ln = document.createElementNS(ns, 'line');
    ln.setAttribute('x1', o.x2 - 0.5); ln.setAttribute('x2', o.x2 - 0.5);
    ln.setAttribute('y1', o.y1); ln.setAttribute('y2', o.y2);
    ln.setAttribute('stroke', '#000'); ln.setAttribute('stroke-width', '0.8');
    ln.setAttribute('stroke-dasharray', '3,2');
    ln.setAttribute('class', 'cl-sysend');
    svg.appendChild(ln);
  });
}

function clPlaceLyricAnnotations(svg, grand) {
  const lineOf = el => { const m = String(el.getAttribute('class') || '').match(/abcjs-l(\d+)/); return m ? m[1] : null; };
  const lyricsByLine = {}, barsByLine = {};
  svg.querySelectorAll('text.abcjs-lyric').forEach(t => {
    const l = lineOf(t); if (l === null || !t.textContent.trim()) return;
    (lyricsByLine[l] = lyricsByLine[l] || []).push(t);
  });
  svg.querySelectorAll('.abcjs-bar').forEach(bEl => {
    const l = lineOf(bEl); if (l === null) return;
    (barsByLine[l] = barsByLine[l] || []).push(bEl);
  });
  const bbox = el => { try { return el.getBBox(); } catch (e) { return null; } };
  const setX = (a, x, anchor) => {
    a.setAttribute('x', x); a.setAttribute('text-anchor', anchor);
    a.querySelectorAll('tspan').forEach(sp => { if (sp.hasAttribute('x')) sp.setAttribute('x', x); });
  };
  svg.querySelectorAll('text.abcjs-annotation').forEach(a => {
    const l = lineOf(a);
    const lys = l !== null ? lyricsByLine[l] : null;
    if (!lys || !lys.length) return;
    const ly = lys[0];
    const y = ly.getAttribute('y');
    a.setAttribute('y', y);
    a.querySelectorAll('tspan').forEach(sp => { if (sp.hasAttribute('y')) sp.setAttribute('y', y); });
    ['font-family', 'font-size', 'font-weight'].forEach(k => { if (ly.getAttribute(k)) a.setAttribute(k, ly.getAttribute(k)); });
    a.setAttribute('font-style', 'normal');
    a.setAttribute('dominant-baseline', ly.getAttribute('dominant-baseline') || 'auto');
    const txt = a.textContent || '';
    const ab = bbox(a); if (!ab) return;
    if (txt.indexOf(CL_MARK_SYL) >= 0) {
      // direkt vor die nächste Silbe rechts davon
      let best = null;
      lys.forEach(t => { const tb = bbox(t); if (tb && tb.x >= ab.x - 2 && (!best || tb.x < best.x)) best = tb; });
      if (best) setX(a, best.x - 5, 'end');
    } else if (txt.indexOf(CL_MARK_BAR) >= 0) {
      // mittig unter den nächsten Trennstrich rechts davon
      let best = null;
      (barsByLine[l] || []).forEach(bEl => { const bb = bbox(bEl); if (bb && bb.x >= ab.x - 2 && (!best || bb.x < best.x)) best = bb; });
      // Im Orgelsatz läuft der Taktstrich durch die Textzeile -> Text
      // rechtsbündig direkt vor den Strich statt mittig darunter.
      if (best) { if (grand) setX(a, best.x - 4, 'end'); else setX(a, best.x + best.width / 2, 'middle'); }
    }
  });
}

