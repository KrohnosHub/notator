// ── Gloria Patri: Vorlagen und Ersatz der gekürzten Fassung (E u o u a e) ──
function ntGpDoIdx(clef) { const m = /^([cf])b?([1-5])/.exec(clef || 'c4') || ['', 'c', '4']; const n = +m[2]; return m[1] === 'c' ? 1 + 2 * n : 4 + 2 * n; }
function ntGpShiftNotes(notes, k) {
  if (!k || /^[cf]b?[1-5]$/.test(notes)) return notes;
  let out = '', br = 0;
  for (const ch of notes) {
    if (ch === '[') br++; else if (ch === ']') br--;
    if (!br && /[a-mA-M]/.test(ch)) {
      const up = ch < 'a';
      const c2 = String.fromCharCode(97 + Math.max(0, Math.min(12, ch.toLowerCase().charCodeAt(0) - 97 + k)));
      out += up ? c2.toUpperCase() : c2;
    } else out += ch;
  }
  return out;
}
function ntGpShiftGabc(g, k) { return k ? g.replace(/\(([^)]*)\)/g, (m0, n) => '(' + ntGpShiftNotes(n, k) + ')') : g; }
function ntGpKey(notes) { return String(notes || '').replace(/\[[^\]]*\]/g, '').replace(/[^a-mA-M]/g, '').toLowerCase(); }
const NT_GP_DIV = /^(?:[,;:`]|::)[0-9?']*$|^$/;
// Silben (Text + Noten) einer GABC-Folge; notenlose Gruppen hängen an der vorigen Silbe
function ntGpUnits(body) {
  const units = []; const re = /([^()]*)\(([^)]*)\)/g; let m;
  while ((m = re.exec(body))) {
    const t = m[1].trim(), n = m[2];
    if (/^[cf]b?[1-5]$/.test(n)) continue;
    if (!t && units.length && !NT_GP_DIV.test(n) && !units[units.length - 1].div) { units[units.length - 1].n += ')(' + n; continue; }
    units.push({ t, n, div: NT_GP_DIV.test(n) });
  }
  return units;
}
// die letzten 6 Silben (sæ-cu-ló-rum A-men) einer GABC-Folge durch andere Noten ersetzen
function ntGpReplaceEnd(body, six) {
  if (!six || six.length !== 6) return body;
  const re = /([^()]*)\(([^)]*)\)/g; const hits = []; let m;
  while ((m = re.exec(body))) if (m[1].trim() && !NT_GP_DIV.test(m[2])) hits.push({ i: m.index + m[1].length, len: m[2].length + 2 });
  const last = hits.slice(-6); if (last.length < 6) return body;
  for (let j = 5; j >= 0; j--) {
    const old = body.slice(last[j].i + 1, last[j].i + last[j].len - 1);
    if (ntGpKey(old) === ntGpKey(six[j])) continue; // gleiche Töne: Schreibweise der Vorlage behalten
    body = body.slice(0, last[j].i) + '(' + six[j] + ')' + body.slice(last[j].i + last[j].len);
  }
  return body;
}
function ntGpModeFromAnnotation(a) {
  const R = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8 };
  const toks = String(a || '').replace(/\./g, ' ').split(/\s+/).filter(Boolean);
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i].toLowerCase();
    const n = /^[1-8]$/.test(t) ? +t : R[t];
    if (n) return { mode: n, ending: toks[i + 1] && /^[a-gA-G][0-9*]?$/.test(toks[i + 1]) ? toks[i + 1] : '' };
  }
  return { mode: 0, ending: '' };
}
// Gekürzte Fassung im Stück finden: «E u o u a e» (+ davor ggf. «Gló-ri-a Pa-tri.»)
function ntGpFind(entries) {
  const slots = [];
  entries.forEach((e, i) => { if (e && e.type === 'note' && e.syllable && String(e.syllable).trim()) slots.push(i); });
  const norm = s => String(s || '').replace(/<[^>]*>/g, '').toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
  for (let k = slots.length - 6; k >= 0; k--) {
    const sy = slots.slice(k, k + 6).map(i => norm(entries[i].syllable));
    if (sy.join('') !== 'euouae' || !sy.every(x => x.length === 1)) continue;
    let end = slots[k + 5];
    while (end + 1 < entries.length && entries[end + 1].type === 'note' && !String(entries[end + 1].syllable || '').trim()) end++;
    const units = ntGpUnits(gregEntriesToBody(entries.slice(slots[k], end + 1), gregClefVal)).filter(u => u.t);
    const res = { euStart: slots[k], euEnd: end, six: units.length === 6 ? units.map(u => u.n) : null, start: slots[k], gp: null };
    // «Gló-ri-a Pa-tri.» unmittelbar davor (Introitus)
    if (k >= 5) {
      const gp = slots.slice(k - 5, k);
      if (gp.map(i => norm(entries[i].syllable)).join('') === 'gloriapatri') {
        let ok = true; for (let i = gp[4] + 1; i < slots[k]; i++) { const t = entries[i].type; if (!(t === 'divisio' || t === 'linebreak' || (t === 'note' && !String(entries[i].syllable || '').trim()))) ok = false; }
        if (ok) {
          let s = gp[0];
          if (s > 0 && entries[s - 1].type === 'special' && /^(V\/|℣)/.test(entries[s - 1].text || '')) s--;
          const gu = ntGpUnits(gregEntriesToBody(entries.slice(gp[0], gp[4] + 1), gregClefVal)).filter(u => u.t);
          res.start = s; res.gp = gu.length === 5 ? gu.map(u => u.n) : null;
        }
      }
    }
    return res;
  }
  return null;
}
function ntGpIsIntroit(found) {
  const ann = (document.getElementById('greg-annotation') || {}).value || '';
  const t = ((document.getElementById('greg-title') || {}).value || '') + ' ' + ann;
  return !!(found && found.gp) || /\b(Intr|Introitus|Introit)\b/i.test(t);
}
// Introitus: Vorlage des Modus in den Schlüssel des Stücks setzen
function ntGpIntroitBody(mode, clef, k, six) {
  const T = NT_GP_INTROIT[String(mode)]; if (!T) throw new Error('Kein Modus');
  let g = ntGpShiftGabc(T.g, k);
  if (six) g = ntGpReplaceEnd(g, six);
  return g + ' (::)';
}
function ntGpIntroitShift(mode, clef, found) {
  const T = NT_GP_INTROIT[String(mode)]; const base = ntGpDoIdx(clef) - ntGpDoIdx(T.c);
  if (!found || (!found.gp && !found.six)) return base;
  const tu = ntGpUnits(T.g).filter(u => u.t && !u.div);
  const ends = [tu.slice(-6).map(u => u.n)].concat(T.alt);
  let best = base, bs = -1;
  for (let k = -7; k <= 7; k++) {
    let s = 0;
    if (found.gp) found.gp.forEach((n, i) => { if (ntGpKey(n) === ntGpKey(ntGpShiftNotes(tu[i].n, k))) s += 2; });
    if (found.six) s += Math.max(...ends.map(e => e.reduce((a, n, i) => a + (ntGpKey(ntGpShiftNotes(n, k)) === ntGpKey(found.six[i]) ? 1 : 0), 0)));
    if (s > bs || (s === bs && Math.abs(k - base) < Math.abs(best - base))) { bs = s; best = k; }
  }
  return best;
}
// Antiphon: Psalmton (Offizium), beide Verse
function ntGpOfficeBody(tone, ending, clef, six) {
  const T = NT_PSALM_TONES[tone]; if (!T) throw new Error('Unbekannter Psalmton');
  let g = ntPsalmToneGabc({ tone, ending, text: '', gloria: true, title: 'Gloria Patri' });
  g = g.slice(g.indexOf('%%') + 2).replace(/^\s*\([cf]b?[1-5]\)\s*/, '').replace(/\(z\)/g, ' ').replace(/\s+/g, ' ').trim();
  g = ntGpShiftGabc(g, ntGpDoIdx(clef) - ntGpDoIdx(T.c));
  if (six) g = ntGpReplaceEnd(g, six);
  return g;
}
// Psalmton + Endung aus dem «E u o u a e» des Stücks bestimmen
function ntGpMatchOffice(six, clef, mode) {
  let best = null;
  Object.keys(NT_PSALM_TONES).forEach(tone => {
    const tm = parseInt(tone, 10);
    Object.keys(NT_PSALM_TONES[tone].e).forEach(end => {
      let units;
      try { units = ntGpUnits(ntGpOfficeBody(tone, end, clef, null)).filter(u => u.t && !u.div); } catch (e) { return; }
      const last = units.slice(-6);
      let s = 0; last.forEach((u, i) => { if (six && ntGpKey(u.n) === ntGpKey(six[i])) s += 2; else if (six && ntGpKey(u.n)[0] === ntGpKey(six[i])[0]) s += 1; });
      if (mode && tm === mode) s += 3;
      if (!best || s > best.s) best = { tone, ending: end, s };
    });
  });
  return best;
}
// GABC-Fragment -> Notator-Einträge (ohne das offene Stück zu verändern)
function gregGabcToEntries(gabcWithClef) {
  const ids = ['greg-annotation', 'greg-title', 'greg-subtitle', 'greg-commentary'], cks = ['greg-dropcap', 'greg-dropcap2'];
  const sv = ids.map(i => { const e = document.getElementById(i); return e ? e.value : null; });
  const sc = cks.map(i => { const e = document.getElementById(i); return e ? e.checked : null; });
  const saved = { entries: gregEntries, hdr: gregHdrExtra, clefVal: gregClefVal, clefRaw: gregClefRaw, hist: gregHistory.length };
  let out = [];
  try { gregImportGABCString(gabcWithClef, { deferRender: true }); out = gregEntries; }
  finally {
    gregEntries = saved.entries; gregHdrExtra = saved.hdr; gregClefRaw = saved.clefRaw; gregSetClef(saved.clefVal, true);
    gregHistory.length = Math.min(gregHistory.length, saved.hist);
    ids.forEach((i, k) => { const e = document.getElementById(i); if (e && sv[k] !== null) e.value = sv[k]; });
    cks.forEach((i, k) => { const e = document.getElementById(i); if (e && sc[k] !== null) e.checked = sc[k]; });
  }
  const off = gregEntries.reduce((m, e) => Math.max(m, typeof e.mappingIdx === 'number' ? e.mappingIdx : -1), -1) + 1;
  out.forEach(e => { if (typeof e.mappingIdx === 'number') e.mappingIdx += off; });
  return out;
}
function ntGpPreview(container, body) {
  try {
    const ctxt = new exsurge.ChantContext();
    ctxt.lyricTextFont = "'Crimson Text', 'Palatino Linotype', Georgia, serif";
    const mappings = exsurge.Gabc.createMappingsFromSource(ctxt, '(' + gregClefVal + ') ' + body);
    const score = new exsurge.ChantScore(ctxt, mappings, false);
    const w = Math.max(240, (container.clientWidth || 600) - 16);
    score.performLayoutAsync(ctxt, () => score.layoutChantLines(ctxt, w, () => {
      container.innerHTML = score.createSvg(ctxt);
      const svg = container.querySelector('svg');
      if (svg) { svg.style.display = 'block'; svg.style.margin = '4px 8px'; svg.style.maxWidth = 'calc(100% - 16px)'; }
    }));
  } catch (e) { container.textContent = 'Vorschau nicht möglich: ' + e.message; }
}
function ntGloriaPatriShow() {
  if (window._ntTab !== 'greg') switchTab('greg');
  { const gb = document.getElementById('nt-gp-bar'); if (gb) gb.remove(); }
  const found = ntGpFind(gregEntries);
  const ann = ntGpModeFromAnnotation((document.getElementById('greg-annotation') || {}).value || '');
  const clef = gregClefVal;
  let kind = ntGpIsIntroit(found) ? 'in' : 'an';
  const om = found && found.six ? ntGpMatchOffice(found.six, clef, ann.mode) : null;
  showModal('✝ Gloria Patri', '', []);
  const body = document.getElementById('modal-body');
  const tones = Object.keys(NT_PSALM_TONES);
  body.innerHTML =
    (found ? '<div style="font-size:12px;background:#fff6d8;border:1px solid #e0c070;border-radius:4px;padding:5px 7px;margin-bottom:6px">Im Stück steht die gekürzte Fassung (' + (found.gp ? '«Glória Patri.» + ' : '') + '«E u o u a e»). Sie kann durch die ausgeschriebene Fassung ersetzt werden.</div>' : '') +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;font-size:12px;align-items:center;margin-bottom:6px">' +
    '<label><input type="radio" name="gp-kind" value="in"' + (kind === 'in' ? ' checked' : '') + '> Introitus</label>' +
    '<label><input type="radio" name="gp-kind" value="an"' + (kind === 'an' ? ' checked' : '') + '> Antiphon (Psalmton)</label></div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;font-size:12px;align-items:center">' +
    '<label id="gp-mode-w">Modus <select id="gp-mode" style="font-size:13px">' + [1, 2, 3, 4, 5, 6, 7, 8].map(n => '<option value="' + n + '">' + n + '</option>').join('') + '</select></label>' +
    '<label id="gp-tone-w">Ton <select id="gp-tone" style="font-size:13px">' + tones.map(t => '<option>' + t + '</option>').join('') + '</select></label>' +
    '<label>Schluss <select id="gp-end" style="font-size:13px;max-width:60vw"></select></label></div>' +
    (found ? '<div style="font-size:12px;margin-top:6px"><label><input type="radio" name="gp-where" value="replace" checked> gekürzte Fassung ersetzen</label> &nbsp; <label><input type="radio" name="gp-where" value="append"> am Ende anfügen</label></div>' :
      '<div style="font-size:11px;color:var(--ink2);margin-top:6px">Wird am Ende ' + ((window._gregMultiSection && gregSections.length > 1) ? 'von Abschnitt ' + (gregActiveIdx + 1) + ' ' : 'des Stücks ') + 'angefügt.</div>') +
    '<div id="gp-prev" style="margin-top:8px;border:1px solid #d8d0b8;border-radius:4px;min-height:60px;overflow:hidden;background:#fff"></div>' +
    '<div id="gp-info" style="font-size:11px;color:var(--ink2);margin-top:4px;line-height:1.4"></div>';
  const $ = id => document.getElementById(id);
  $('gp-mode').value = String(ann.mode || (om ? parseInt(om.tone, 10) : 0) || 1);
  if (om && om.s >= 8) $('gp-tone').value = om.tone; else if (ann.mode) { const t = tones.find(x => parseInt(x, 10) === ann.mode); if (t) $('gp-tone').value = t; }
  let cur = null;
  const fillEnd = () => {
    const k = document.querySelector('input[name="gp-kind"]:checked').value;
    $('gp-mode-w').style.display = k === 'in' ? '' : 'none';
    $('gp-tone-w').style.display = k === 'an' ? '' : 'none';
    const opts = [];
    if (found && found.six) opts.push(['piece', 'wie im Stück (E u o u a e)']);
    if (k === 'in') {
      const T = NT_GP_INTROIT[$('gp-mode').value];
      opts.push(['0', 'Standard']);
      T.alt.forEach((a, i) => opts.push(['a' + i, 'Variante ' + (i + 1) + ' (… ' + a.slice(-2).join(' ') + ')']));
    } else {
      Object.keys(NT_PSALM_TONES[$('gp-tone').value].e).forEach(e => opts.push(['e:' + e, e || 'Standard']));
    }
    $('gp-end').innerHTML = opts.map(o => '<option value="' + ntEscAttr(o[0]) + '">' + ntEscAttr(o[1]) + '</option>').join('');
    if (k === 'an' && !(found && found.six)) {
      const want = om && om.tone === $('gp-tone').value ? om.ending : ann.ending;
      if (want != null && [...$('gp-end').options].some(o => o.value === 'e:' + want)) $('gp-end').value = 'e:' + want;
    }
    upd();
  };
  const upd = () => {
    const k = document.querySelector('input[name="gp-kind"]:checked').value;
    const ev = $('gp-end').value;
    let six = null, g = '', info = '';
    try {
      if (k === 'in') {
        const mode = +$('gp-mode').value, T = NT_GP_INTROIT[mode];
        const sh = ntGpIntroitShift(mode, clef, found);
        if (ev === 'piece') six = found.six;
        else if (ev[0] === 'a') six = T.alt[+ev.slice(1)].map(n => ntGpShiftNotes(n, sh));
        g = ntGpIntroitBody(mode, clef, sh, six);
        info = 'Introitus-Psalmton ' + mode + ' (Graduale Romanum, ausgeschrieben).' + (ev === 'piece' ? ' Schluss «sæculórum. Amen» wie im Stück.' : '');
      } else {
        const tone = $('gp-tone').value;
        const end = ev === 'piece' ? (om && om.tone === tone ? om.ending : Object.keys(NT_PSALM_TONES[tone].e)[0]) : ev.slice(2);
        if (ev === 'piece') six = found.six;
        g = ntGpOfficeBody(tone, end, clef, six);
        info = 'Psalmton ' + tone + (end ? ' ' + end : '') + ' (Offizium), beide Verse.' + (ev === 'piece' ? ' Schluss wie im Stück' + (om && om.tone === tone && om.s >= 10 ? ' (passt zur Endung ' + om.ending + ')' : '') + '.' : '');
      }
    } catch (e) { info = e.message; }
    cur = g;
    $('gp-info').textContent = info + ' Bitte im Notenbild prüfen.';
    if (g) ntGpPreview($('gp-prev'), g);
  };
  document.querySelectorAll('input[name="gp-kind"]').forEach(r => r.onchange = fillEnd);
  $('gp-mode').onchange = fillEnd; $('gp-tone').onchange = fillEnd; $('gp-end').onchange = upd;
  fillEnd();
  const bEl = document.getElementById('modal-btns');
  const mk = (label, fn, css) => { const b = document.createElement('button'); b.className = 'b'; b.textContent = label; if (css) b.style.cssText = css; b.onclick = fn; bEl.appendChild(b); };
  mk('Abbrechen', () => closeModal());
  mk('✝ Einfügen', () => {
    if (!cur) return;
    const ne = gregGabcToEntries('(' + clef + ') ' + cur);
    if (!ne.length) { $('gp-info').textContent = 'Fehler beim Umwandeln.'; return; }
    const where = found ? document.querySelector('input[name="gp-where"]:checked').value : 'append';
    gregPush();
    if (where === 'replace') {
      gregEntries.splice(found.start, found.euEnd - found.start + 1, ...ne);
      // doppelten Schlussstrich direkt danach vermeiden
      const after = found.start + ne.length;
      if (gregEntries[after] && gregEntries[after].type === 'divisio' && gregEntries[after].div === '::' && ne[ne.length - 1].type === 'divisio') gregEntries.splice(after, 1);
    } else {
      const last = gregEntries[gregEntries.length - 1];
      if (last && last.type !== 'divisio') gregEntries.push({ type: 'divisio', div: '::', glueToPrevSpecial: false });
      gregEntries.push(...ne);
    }
    closeModal();
    gregRefreshList();
    gregGst('Gloria Patri eingefügt (' + ne.length + ' Einträge) – bitte prüfen.');
  }, 'background:#3d6b35;color:#fff;border-color:#3d6b35');
}
// Automatischer Hinweis nach Import/Öffnen: gekürzte Fassung gefunden
function ntGpOffer() {
  try {
    if (window._ntTab !== 'greg' || document.getElementById('nt-gp-bar')) return;
    const f = ntGpFind(gregEntries); if (!f) return;
    const title = ((document.getElementById('greg-title') || {}).value || '').trim();
    let no = []; try { no = JSON.parse(localStorage.getItem('notatorGpNo') || '[]'); } catch (e) {}
    if (title && no.indexOf(title) >= 0) return;
    const bar = document.createElement('div');
    bar.id = 'nt-gp-bar';
    bar.style.cssText = 'position:fixed;left:50%;bottom:44px;transform:translateX(-50%);z-index:2400;background:#5a4a20;color:#fff;padding:8px 12px;border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,.4);font:13px system-ui,sans-serif;display:flex;gap:8px;align-items:center;flex-wrap:wrap;max-width:94vw';
    bar.innerHTML = '<span>Gloria Patri ist nur gekürzt (E u o u a e) notiert.</span>';
    const b1 = document.createElement('button'); b1.className = 'b'; b1.textContent = '✝ Ausschreiben …'; b1.style.cssText = 'font-size:12px;padding:3px 10px';
    b1.onclick = () => { bar.remove(); ntGloriaPatriShow(); };
    const b2 = document.createElement('button'); b2.className = 'b'; b2.textContent = 'Nein'; b2.style.cssText = 'font-size:12px;padding:3px 8px';
    b2.onclick = () => { bar.remove(); if (title) { no.push(title); try { localStorage.setItem('notatorGpNo', JSON.stringify(no.slice(-200))); } catch (e) {} } };
    bar.appendChild(b1); bar.appendChild(b2);
    document.body.appendChild(bar);
    setTimeout(() => { if (bar.isConnected) bar.remove(); }, 20000);
  } catch (e) {}
}

