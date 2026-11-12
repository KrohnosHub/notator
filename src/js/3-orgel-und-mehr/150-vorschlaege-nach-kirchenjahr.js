// ── Vorschläge nach Kirchenjahr ──────────────────────────────────
// Bestimmt für ein Datum die Zeit im Kirchenjahr (heutiger Kalender, wie die
// Einordnung der Bibliothek) und den Tag im Kalender von 1962 (wie die
// Notenbibliothek/Graduale 1961). Vorschläge: Stücke der eigenen Bibliothek
// mit passender Einordnung + Orgelsätze der Notenbibliothek für diesen Tag.
function ntEaster(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
    mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, mo - 1, da);
}
function ntLitDay(date) {
  const D = x => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const d = D(date), y = d.getFullYear(), day = 86400000;
  const diff = (a, b) => Math.round((a - b) / day);
  const add = (x, n) => new Date(x.getFullYear(), x.getMonth(), x.getDate() + n);
  const sunday = d.getDay() === 0, dm = d.getDate() + '.' + (d.getMonth() + 1) + '.';
  const E = ntEaster(y), e = diff(d, E);
  const xmas = new Date(y, 11, 25), adv4 = add(xmas, -(xmas.getDay() || 7)), adv1 = add(adv4, -21), ck = add(adv1, -7);
  const jan6 = new Date(y, 0, 6), bapt = add(jan6, 7 - jan6.getDay() || 7);
  const seasons = new Set(); let of = '', ef = [];
  // heutiger Kalender
  if (d >= adv1 && d < xmas) { seasons.add('Advent'); of = sunday ? (diff(d, adv1) / 7 + 1) + '. Adventssonntag' : 'Advent'; }
  else if (d >= xmas || d <= bapt) { seasons.add('Weihnachtszeit'); of = dm === '25.12.' ? 'Weihnachten' : dm === '6.1.' ? 'Erscheinung des Herrn' : +d === +bapt ? 'Taufe des Herrn' : 'Weihnachtszeit'; }
  else if (e >= -46 && e < -7) { seasons.add('Fastenzeit'); of = e === -46 ? 'Aschermittwoch' : sunday ? ((e + 42) / 7 + 1) + '. Fastensonntag' : 'Fastenzeit'; }
  else if (e >= -7 && e < 0) { seasons.add('Karwoche / Triduum'); of = ({ '-7': 'Palmsonntag', '-3': 'Gründonnerstag', '-2': 'Karfreitag', '-1': 'Karsamstag / Osternacht' })[e] || 'Karwoche'; }
  else if (e >= 0 && e < 49) { seasons.add('Osterzeit'); of = e === 0 ? 'Ostersonntag' : e === 39 ? 'Christi Himmelfahrt' : sunday ? (e / 7 + 1) + '. Sonntag der Osterzeit' : 'Osterzeit'; if (e === 39) seasons.add('Herrenfeste'); }
  else if (e === 49 || e === 50) { seasons.add('Pfingsten'); of = e === 49 ? 'Pfingstsonntag' : 'Pfingstmontag'; }
  else {
    seasons.add('Zeit im Jahreskreis');
    const n = d < E ? 1 + Math.floor(diff(d, bapt) / 7) : 34 - Math.floor(diff(ck, d) / 7);
    of = sunday ? n + '. Sonntag im Jahreskreis' : (n) + '. Woche im Jahreskreis';
    if (e === 56) { of = 'Dreifaltigkeitssonntag'; seasons.add('Herrenfeste'); }
    if (e === 60) { of = 'Fronleichnam'; seasons.add('Herrenfeste'); }
    if (+d === +ck) { of = 'Christkönigssonntag'; seasons.add('Herrenfeste'); }
  }
  const fix = { '1.1.': ['Marienfeste', 'Hochfest der Gottesmutter Maria'], '6.1.': ['Herrenfeste'], '2.2.': ['Herrenfeste', 'Darstellung des Herrn'], '19.3.': ['Heiligenfeste', 'Hl. Josef'],
    '25.3.': ['Marienfeste', 'Verkündigung des Herrn'], '24.6.': ['Heiligenfeste', 'Geburt Johannes des Täufers'], '29.6.': ['Heiligenfeste', 'Petrus und Paulus'], '6.8.': ['Herrenfeste', 'Verklärung des Herrn'],
    '15.8.': ['Marienfeste', 'Mariä Aufnahme in den Himmel'], '8.9.': ['Marienfeste', 'Mariä Geburt'], '14.9.': ['Herrenfeste', 'Kreuzerhöhung'], '7.10.': ['Marienfeste', 'Unsere Liebe Frau vom Rosenkranz'],
    '1.11.': ['Heiligenfeste', 'Allerheiligen'], '2.11.': ['Totenliturgie', 'Allerseelen'], '8.12.': ['Marienfeste', 'Mariä Empfängnis'], '26.12.': ['Heiligenfeste', 'Hl. Stephanus'] }[dm];
  if (fix) { seasons.add(fix[0]); if (fix[1]) of = fix[1] + (of && of !== fix[1] && !/Weihnachts|Advent$|Jahreskreis$|Osterzeit$|Fastenzeit$/.test(of) ? ' (' + of + ')' : ''); }
  // Kalender 1962 (Notenbibliothek)
  const epi1 = add(jan6, 7 - jan6.getDay() || 7);
  if (d >= adv1 && d < xmas && sunday) ef.push((diff(d, adv1) / 7 + 1) + '. Adventssonntag');
  else if (e === -63) ef.push('Septuagesima'); else if (e === -56) ef.push('Sexagesima'); else if (e === -49) ef.push('Quinquagesima');
  else if (e === -46) ef.push('Aschermittwoch');
  else if (e >= -42 && e <= -21 && sunday) ef.push(((e + 42) / 7 + 1) + '. Fastensonntag');
  else if (e === -14) ef.push('Passionssonntag', '5. Fastensonntag', 'Dominica de Passione');
  else if (e === -7) ef.push('Palmsonntag');
  else if (e === 0) ef.push('Ostersonntag', 'Ostern'); else if (e === 1) ef.push('Ostermontag');
  else if (e === 7) ef.push('Weisser Sonntag (1. Sonntag nach Ostern)', 'Weisser Sonntag (Osteroktav)');
  else if (e >= 14 && e <= 35 && sunday) ef.push((e / 7 + 1) + '. Sonntag nach Ostern');
  else if (e === 39) ef.push('Christi Himmelfahrt'); else if (e === 42) ef.push('Sonntag nach Himmelfahrt');
  else if (e === 49) ef.push('Pfingstsonntag', 'Pfingsten'); else if (e === 50) ef.push('Pfingstmontag');
  else if (e === 56) ef.push('Dreifaltigkeitssonntag', 'Dreifaltigkeit', '1. Sonntag nach Pfingsten');
  else if (e === 60) ef.push('Fronleichnam');
  else if (e > 56 && d < adv1 && sunday) { const n = (e - 49) / 7; ef.push(n + '. Sonntag nach Pfingsten'); if (diff(adv1, d) === 7) ef.push('24. und letzter Sonntag nach Pfingsten'); }
  else if (sunday && d >= epi1 && e < -63) { const n = diff(d, epi1) / 7 + 1; ef.push(n + '. Sonntag nach Epiphanie'); if (n === 1) ef.push('Fest der Heiligen Familie', 'Heilige Familie', 'Sonntag in der Epiphanieoktav'); }
  if (sunday && d.getMonth() === 9 && d.getDate() > 24) ef.push('In festo Domino nostro Jesu Christi Regis', 'Christkoenigsfest');
  return { date: d, of, seasons: [...seasons], ef, dm };
}
function ntSuggestShow(dateStr) {
  const today = new Date(); const next = new Date(today.getFullYear(), today.getMonth(), today.getDate() + ((7 - today.getDay()) % 7));
  const iso = x => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  const ds = dateStr || iso(next);
  const [yy, mm, dd] = ds.split('-').map(Number);
  const L = ntLitDay(new Date(yy, mm - 1, dd));
  showModal('📅 Vorschläge nach Kirchenjahr', '', []);
  const body = document.getElementById('modal-body'), bEl = document.getElementById('modal-btns');
  bEl.style.flexDirection = ''; bEl.style.alignItems = '';
  const wd = L.date.toLocaleDateString('de-CH', { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' });
  body.innerHTML = '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12px"><label>Datum <input type="date" id="nt-sg-date" value="' + ds + '" style="font-size:13px"></label></div>' +
    '<div style="margin:6px 0 2px;font-size:14px"><b>' + ntEscAttr(wd + ' – ' + L.of) + '</b></div>' +
    '<div style="font-size:11px;color:var(--ink2)">Kirchenjahr: ' + ntEscAttr(L.seasons.join(', ')) + (L.ef.length ? ' · Kalender 1962: ' + ntEscAttr(L.ef[0]) : '') + '</div>' +
    '<div id="nt-sg-lib" style="margin-top:8px"><div style="font-size:11px;color:var(--ink2)">Lade Bibliothek …</div></div>' +
    '<div id="nt-sg-noh" style="margin-top:8px"></div>';
  document.getElementById('nt-sg-date').onchange = ev => ntSuggestShow(ev.target.value);
  const mk = (label, fn, css, title) => { const b = document.createElement('button'); b.className = 'b'; b.textContent = label; if (css) b.style.cssText = css; if (title) b.title = title; b.onclick = fn; return b; };
  bEl.appendChild(mk('📑 Mappe für diesen Tag', () => {
    const m = ntMappeCur();
    if (!m.items.length || confirm('Die aktuelle Mappe «' + (m.title || 'ohne Titel') + '» enthält schon Stücke. Titel und Untertitel für diesen Tag übernehmen?')) {
      m.title = m.title && m.items.length ? m.title : 'Gottesdienst ' + L.date.toLocaleDateString('de-CH');
      m.subtitle = L.of; ntMappeSetCur(m);
    }
    ntMappeShow();
  }, '', 'Mappe öffnen und Titel/Untertitel für diesen Tag setzen'));
  bEl.appendChild(mk('Schliessen', () => closeModal()));
  const h4 = t => '<div style="font-weight:bold;font-size:12px;margin:4px 0 2px">' + t + '</div>';
  // eigene Bibliothek
  gregLibCollect(true).catch(() => gregLibCollect(false)).then(data => {
    const box = document.getElementById('nt-sg-lib'); if (!box) return;
    const hit = data.items.filter(it => L.seasons.indexOf(it.meta.season) >= 0);
    const gi = g => { const i = NT_GENRES.indexOf(g); return i < 0 ? 99 : i; };
    hit.sort((a, b) => gi(a.meta.genre) - gi(b.meta.genre) || a.title.localeCompare(b.title, 'de'));
    const untagged = data.items.filter(it => !it.meta.season).length;
    box.innerHTML = h4('Aus deiner Bibliothek (' + hit.length + ')');
    if (!hit.length) box.innerHTML += '<div style="font-size:11px;color:var(--ink2)">Keine Stücke mit passender Einordnung.' + (untagged ? ' ' + untagged + ' Stück(e) sind noch nicht eingeordnet (🏷 im Öffnen-Dialog).' : '') + '</div>';
    const m = ntMappeCur();
    hit.forEach(it => {
      const ref = it.kind === 'drive' ? { src: 'drive', id: it.file.id } : { src: 'local', id: it.id };
      const r = document.createElement('div'); r.style.cssText = 'display:flex;gap:4px;align-items:center;margin:2px 0';
      const t = mk(it.title + (it.meta.genre ? '  · ' + it.meta.genre : ''), () => { closeModal(); if (it.kind === 'drive') gregLibLoadDrive(it.file); else gregLibLoadEntry(it.id); }, 'flex:1;text-align:left;min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:12px', 'Öffnen');
      r.appendChild(t);
      ['greg', 'cl', 'clacc'].forEach(v => r.appendChild(mk('+ ' + ({ greg: 'Choral', cl: 'Orgel', clacc: 'Begl.' })[v], ev => { m.items.push({ ref, title: it.title, version: v }); ntMappeSetCur(m); ev.target.textContent = '✓'; }, 'font-size:10px;padding:1px 5px', 'Als ' + NT_MAPPE_VERSIONS[v] + ' zur Mappe hinzufügen')));
      box.appendChild(r);
    });
  });
  // Notenbibliothek (Kalender 1962)
  const nbox = document.getElementById('nt-sg-noh');
  ntNohLoad().then(d => {
    let T = null;
    return fetch(NT_NOH_URL + 'index.html').then(r => r.text()).then(h => {
      const mt = h.match(/^const NOH_TAGS\s*=(.*)$/m); T = mt ? JSON.parse(mt[1].replace(/;\s*$/, '')) : null;
      if (!T || !nbox.isConnected) return;
      const want = new Set(L.ef.map(x => x.toLowerCase()));
      const fis = new Set(); T.fest.forEach((f, fi) => { const fl = f.toLowerCase(); if (want.has(fl) || fl.startsWith(L.dm + ' ')) fis.add(fi); });
      const rows = [];
      d.NOH.forEach(e => { const t = T.t[String(e[0])]; if (t && fis.has(t[3])) rows.push({ e, art: t[0] >= 0 ? T.art[t[0]] : '' }); });
      const ai = a => { const i = ['Asperges', 'Vidi aquam', 'Introitus', 'Kyrie', 'Gloria', 'Graduale', 'Alleluia', 'Tractus', 'Sequenz', 'Credo', 'Offertorium', 'Sanctus', 'Agnus', 'Communio', 'Ite missa est'].indexOf(a); return i < 0 ? 99 : i; };
      rows.sort((a, b) => ai(a.art) - ai(b.art));
      let html = h4('Orgelsätze aus der Notenbibliothek (' + rows.length + ')');
      if (!rows.length) html += '<div style="font-size:11px;color:var(--ink2)">Für diesen Tag keine Einträge' + (L.ef.length ? ' (gesucht: ' + ntEscAttr(L.ef.join(' / ')) + ')' : '') + '.</div>';
      rows.slice(0, 40).forEach(({ e, art }) => {
        const fid = d.FILES[e[0]] || d.BANDS[e[2]];
        html += '<div style="display:flex;gap:4px;align-items:center;margin:2px 0;font-size:12px"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + ntEscAttr((art ? art + ': ' : '') + e[1]) + ' <span style="color:#8a7a50;font-size:10px">NOH ' + e[0] + '</span></span>' +
          '<a class="b" style="font-size:10px;padding:1px 6px;text-decoration:none" target="_blank" rel="noopener" href="https://drive.google.com/file/d/' + fid + '/view">PDF</a>' +
          '<button class="b" style="font-size:10px;padding:1px 6px" data-gb="' + ntEscAttr(e[1].split(' ').slice(0, 4).join(' ')) + '" title="Choral in GregoBase suchen und in Notator öffnen">Notator</button></div>';
      });
      html += '<div style="margin-top:4px"><a target="_blank" rel="noopener" href="' + NT_NOH_URL + '#q=' + encodeURIComponent(L.ef[0] || L.of) + '" style="font-size:11px">🔎 In der Notenbibliothek suchen</a></div>';
      nbox.innerHTML = html;
      nbox.querySelectorAll('button[data-gb]').forEach(b => b.onclick = () => { closeModal(); gregImportSongFromGregoBase(b.getAttribute('data-gb')); });
    });
  }).catch(() => { if (nbox) nbox.innerHTML = '<div style="font-size:11px;color:var(--ink2)">Notenbibliothek nicht erreichbar (offline?).</div>'; });
}

