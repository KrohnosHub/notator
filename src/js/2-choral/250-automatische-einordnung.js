// ── Automatische Einordnung (Kirchenjahr + Gattung) ──────────────────
// Aus Titel, Liedtext-Anfang und GABC-Kopf (office-part) – füllt nur leere
// Felder, eigene Einordnungen bleiben unangetastet (Nutzerwunsch 2026-10-25).
// Kyriale (Graduale Romanum): nur Messen mit eindeutiger Zeit/Festart einer Zeit zuordnen, sonst «Ganzes Jahr»
const NT_KYRIALE = { 1: 'Osterzeit', 2: 'Ganzes Jahr / Sonstiges', 3: 'Ganzes Jahr / Sonstiges', 4: 'Ganzes Jahr / Sonstiges', 5: 'Ganzes Jahr / Sonstiges', 6: 'Ganzes Jahr / Sonstiges', 7: 'Ganzes Jahr / Sonstiges', 8: 'Ganzes Jahr / Sonstiges', 9: 'Marienfeste', 10: 'Marienfeste', 11: 'Zeit im Jahreskreis', 12: 'Ganzes Jahr / Sonstiges', 13: 'Ganzes Jahr / Sonstiges', 14: 'Ganzes Jahr / Sonstiges', 15: 'Ganzes Jahr / Sonstiges', 16: 'Zeit im Jahreskreis', 17: 'Fastenzeit', 18: 'Fastenzeit' };
const NT_KYRIALE_NAMES = [[/lux et origo/, 1], [/fons bonitatis/, 2], [/deus sempiterne/, 3], [/cunctipotens/, 4], [/magnae deus/, 5], [/rex genitor/, 6], [/rex splendens/, 7], [/de angelis/, 8], [/cum [ij]ubilo/, 9], [/alme pater/, 10], [/orbis factor/, 11], [/pater cuncta/, 12], [/stelliferi/, 13], [/dominator deus/, 15], [/deus genitor alme/, 18]];
// [Muster, Kirchenjahr, Gattung (optional)] – erster Treffer gilt
const NT_AUTO_RULES = [
  [/requiem|dies irae|libera me|lux aeterna|in paradisum|domine [ij]esu christe|absolve|subvenite|pro defunctis|totenmesse/, 'Totenliturgie'],
  [/alma redemptoris/, 'Advent', 'Marianische Antiphon'],
  [/ave regina caelorum|ave regina coelorum/, 'Fastenzeit', 'Marianische Antiphon'],
  [/regina caeli|regina coeli/, 'Osterzeit', 'Marianische Antiphon'],
  [/salve regina/, 'Zeit im Jahreskreis', 'Marianische Antiphon'],
  [/ad te levavi/, 'Advent', 'Introitus'], [/ecce virgo concipiet/, 'Advent', 'Communio'], [/vox clara/, 'Advent', 'Hymnus'], [/conditor alme|creator alme siderum/, 'Advent', 'Hymnus'],
  [/ostende nobis/, 'Advent', 'Alleluia'], [/rorate.*\(sr/, 'Advent', 'Antiphon'], [/mittit ad virginem/, 'Advent', 'Sequenz'], [/rorate|veni,? veni,? emmanuel|veni emmanuel|populus sion|gaudete|prope est dominus|missus est gabriel|veni domine/, 'Advent'],
  [/puer natus est nobis|dominus dixit ad me/, 'Weihnachtszeit', 'Introitus'], [/in splendoribus/, 'Weihnachtszeit', 'Communio'], [/hodie christus natus/, 'Weihnachtszeit', 'Antiphon'],
  [/verbum caro/, 'Weihnachtszeit', 'Responsorium'], [/[ij]esu redemptor omnium|christe redemptor omnium|a solis ortus|puer natus in bethlehem|resonet in laudibus|adeste fideles/, 'Weihnachtszeit', 'Hymnus'],
  [/puer natus|viderunt omnes|lux fulgebit|dies sanctificatus|ecce advenit|reges tharsis|vidimus stellam|omnes de saba|weihnacht|epiphan/, 'Weihnachtszeit'],
  [/christus factus est/, 'Karwoche / Triduum', 'Graduale'], [/vexilla regis|crux fidelis|pange lingua gloriosi (?!corporis)|lauream certaminis/, 'Karwoche / Triduum', 'Hymnus'],
  [/ubi caritas|popule meus|ecce lignum|hosanna filio|gloria,? laus|pueri hebraeorum|nos autem gloriari|mandatum novum|karwoche|karfreitag|palm/, 'Karwoche / Triduum'],
  [/media vita/, 'Fastenzeit', 'Responsorium'], [/parce domine|attende domine/, 'Fastenzeit', 'Antiphon'], [/audi benigne|ex more docti/, 'Fastenzeit', 'Hymnus'],
  [/invocabit|reminiscere|oculi mei|laetare [ij]erusalem|iudica me|misereris omnium|cor contritum|emendemus|fastenzeit/, 'Fastenzeit'],
  [/surrexit dominus vere/, 'Osterzeit', 'Responsorium'], [/vidi aquam/, 'Osterzeit', 'Antiphon'], [/victimae paschali/, 'Osterzeit', 'Sequenz'], [/ad cenam agni|ad coenam agni|aurora lucis|o filii et filiae/, 'Osterzeit', 'Hymnus'],
  [/surrexit|haec dies|resurrexi|pascha nostrum|terra tremuit|christus resurgens|ostern|paschal/, 'Osterzeit'],
  [/veni creator/, 'Pfingsten', 'Hymnus'], [/veni sancte spiritus/, 'Pfingsten', 'Sequenz'], [/spiritus domini|factus est repente|emitte spiritum|confirma hoc|pfingst|pentecost/, 'Pfingsten'],
  [/lauda sion/, 'Herrenfeste', 'Sequenz'], [/[ij]esu dulcis memoria|sacris solemniis|pange lingua gloriosi corporis/, 'Herrenfeste', 'Hymnus'], [/cibavit eos|dignus est agnus|christus vincit|in nomine [ij]esu/, 'Herrenfeste'],
  [/signum magnum/, 'Marienfeste', 'Introitus'], [/gaudeamus.*mariae/, 'Marienfeste', 'Introitus'], [/ave maris stella|salve mater|inviolata|ave maria stella/, 'Marienfeste', 'Hymnus'],
  [/sub tuum|beata viscera|assumpta est|salve sancta parens|ave maria|maria|marien/, 'Marienfeste'],
  [/gaudeamus.*sanctorum|sanctorum omnium/, 'Heiligenfeste', 'Introitus'], [/beati mundo corde/, 'Heiligenfeste', 'Communio'], [/timete dominum/, 'Heiligenfeste', 'Alleluia'],
  [/^gaudeamus\b/, 'Heiligenfeste', 'Introitus'], [/tu es petrus|iustus ut palma|[ij]ustus ut palma|os [ij]usti|iste confessor|ecce sacerdos|sacerdos et pontifex|gaudeamus/, 'Heiligenfeste'],
  [/tantum ergo|o salutaris|adoro te/, 'Ganzes Jahr / Sonstiges', 'Hymnus', 'Eucharistie'], [/adoremus in aeternum/, 'Ganzes Jahr / Sonstiges', 'Antiphon', 'Eucharistie'],
  [/adorate deum/, 'Zeit im Jahreskreis', 'Introitus'], [/da pacem|laetetur cor|omnes gentes/, 'Zeit im Jahreskreis'],
  [/asperges/, 'Ganzes Jahr / Sonstiges', 'Antiphon'], [/te deum/, 'Ganzes Jahr / Sonstiges', 'Hymnus'], [/credo/, 'Ganzes Jahr / Sonstiges', 'Credo'], [/magnificat|benedictus dominus deus/, 'Ganzes Jahr / Sonstiges', 'Psalm / Canticum']
];
const NT_OFFICE_PART = { 'in': 'Introitus', 'introitus': 'Introitus', 'gr': 'Graduale', 'graduale': 'Graduale', 'al': 'Alleluia', 'alleluia': 'Alleluia', 'tr': 'Tractus', 'tractus': 'Tractus', 'se': 'Sequenz', 'sequentia': 'Sequenz', 'of': 'Offertorium', 'offertorium': 'Offertorium', 'co': 'Communio', 'communio': 'Communio', 'an': 'Antiphon', 'antiphona': 'Antiphon', 'hy': 'Hymnus', 'hymnus': 'Hymnus', 're': 'Responsorium', 'rb': 'Responsorium', 'responsorium': 'Responsorium', 'responsorium breve': 'Responsorium', 'ps': 'Psalm / Canticum', 'psalmus': 'Psalm / Canticum', 'canticum': 'Psalm / Canticum' };
function ntRoman(r) { const v = { i: 1, v: 5, x: 10, l: 50 }; let n = 0; r = r.toLowerCase(); for (let k = 0; k < r.length; k++) { const a = v[r[k]], b = v[r[k + 1]] || 0; n += a < b ? -a : a; } return n; }
function ntAutoClassify(title, txt, hdr) {
  const norm = x => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/æ/g, 'ae').replace(/œ/g, 'oe').replace(/\s+/g, ' ');
  const t = norm(title), all = norm(title + ' ' + (txt || ''));
  const out = { season: '', genre: '', tags: [] };
  // Gattung: Teile des Ordinariums aus dem Titel, sonst office-part, sonst Titelwörter
  const ord = [[/\bkyrie\b/, 'Kyrie'], [/\bgloria\b(?! ?(laus|patri))/, 'Gloria'], [/\bsanctus\b/, 'Sanctus'], [/\bagnus\b/, 'Agnus Dei'], [/ite,? missa|benedicamus/, 'Ite missa est'], [/\bcredo\b/, 'Credo']];
  const om = ord.find(x => x[0].test(t));
  if (om) out.genre = om[1];
  const op = /office-part\s*:\s*([^;\n]+)/i.exec(hdr || '');
  if (!out.genre && op) out.genre = NT_OFFICE_PART[norm(op[1]).trim()] || '';
  if (!out.genre) {
    const gw = [[/introitus/, 'Introitus'], [/graduale/, 'Graduale'], [/tractus/, 'Tractus'], [/sequenz|sequentia|dies irae/, 'Sequenz'], [/offertorium/, 'Offertorium'], [/communio/, 'Communio'], [/hymnus/, 'Hymnus'], [/responsorium/, 'Responsorium'], [/\bantiphon/, 'Antiphon'], [/^allelu[ij]a|allelu[ij]a$/, 'Alleluia'], [/libera me/, 'Responsorium'], [/absolve/, 'Tractus'], [/lux aeterna/, 'Communio'], [/domine [ij]esu christe/, 'Offertorium']].find(x => x[0].test(t));
    if (gw) out.genre = gw[1];
  }
  // Kirchenjahr: Messordinarium nach Kyriale-Nummer/-Name
  let mass = 0;
  const mm = /\b(?:messe|missa|mass)\s+([ivxl]+)\b/.exec(t); if (mm) mass = ntRoman(mm[1]);
  if (!mass) { const nm = NT_KYRIALE_NAMES.find(x => x[0].test(t)); if (nm && (om || /messe|missa|mass/.test(t))) mass = nm[1]; }
  if (/requiem|pro defunctis/.test(t)) mass = 0;
  out.mass = mass;
  if (mass && NT_KYRIALE[mass]) { out.season = NT_KYRIALE[mass]; if (mass === 17 || mass === 18) out.tags.push('Advent'); }
  for (const r of NT_AUTO_RULES) {
    if (!r[0].test(all)) continue;
    if (!out.season) out.season = r[1];
    if (!out.genre && r[2]) out.genre = r[2];
    if (r[3] && out.tags.indexOf(r[3]) < 0) out.tags.push(r[3]);
    if (out.season && out.genre) break;
  }
  return out;
}
// Leere Felder automatisch füllen (gibt die geänderten Einträge zurück)
function ntLibAutoProposals(items) {
  const res = [];
  items.forEach(it => {
    const st = it.local && it.local.state;
    const hdr = st ? (st.hdrExtra || '') + '\n' + ((st.sections || []).map(x => x.hdrExtra || '').join('\n')) : '';
    const c = ntAutoClassify(it.title, it.meta.txt, hdr);
    const m = ntMetaNorm(Object.assign({}, it.meta));
    let ch = false;
    // Korrektur der ersten automatischen Zuordnung (Build 326): Messen II/III waren «Herrenfeste», IV «Heiligenfeste»
    const OLD = { 2: 'Herrenfeste', 3: 'Herrenfeste', 4: 'Heiligenfeste' };
    if (c.mass && OLD[c.mass] && m.season === OLD[c.mass] && c.season !== m.season) { m.season = c.season; ch = true; }
    if (!m.season && c.season) { m.season = c.season; ch = true; }
    if (!m.genre && c.genre) { m.genre = c.genre; ch = true; }
    c.tags.forEach(tg => { if (m.tags.indexOf(tg) < 0 && ch) m.tags.push(tg); });
    if (ch) res.push({ it, m });
  });
  return res;
}
function ntLibAutoApply(props, onDone) {
  let ok = 0, fail = 0, k = 0;
  const step = () => {
    if (k >= props.length) { onDone(ok, fail); return; }
    const p = props[k++];
    gregGst('Einordnen ' + k + '/' + props.length + ': ' + p.it.title);
    ntLibSaveMeta(p.it, p.m, false).then(() => { ok++; step(); }).catch(() => { fail++; step(); });
  };
  step();
}

function ntLibAutoRun(manual) { if (window._ntLibAutoRun) window._ntLibAutoRun(manual); }
function gregLibShowModal() {
  const driveOn = gdConfigured();
  const signed = driveOn && gdHasToken();
  showModal('📂 Öffnen · Bibliothek',
    driveOn ? 'Gesänge in Google Drive (Liturgie › Notator). Eine lokale Kopie bleibt im Browser für den Offline-Betrieb.'
            : 'Google Drive ist noch nicht eingerichtet – Stücke werden vorerst nur in diesem Browser gespeichert.', []);
  const bEl = document.getElementById('modal-btns');
  bEl.style.flexDirection = 'column';
  bEl.style.alignItems = 'stretch';
  bEl.innerHTML = '';
  if (driveOn) gdLoadGis().catch(function() {});

  const mkBtn = function(label, onClick, css, title) {
    const b = document.createElement('button');
    b.className = 'b'; b.textContent = label; if (css) b.style.cssText = css; if (title) b.title = title;
    b.onclick = onClick; return b;
  };
  const topRow = document.createElement('div');
  topRow.className = 'nt-lib-row';
  topRow.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px';
  const openRow = document.createElement('div');
  openRow.className = 'nt-lib-row';
  openRow.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px';
  openRow.appendChild(mkBtn('✚ Neues Stück', function() { closeModal(); ntNewPiece(); }, '', 'Neues, leeres Stück beginnen (bei ungespeicherten Änderungen wird nachgefragt)'));
  if (driveOn) openRow.appendChild(mkBtn('☁ Anderer Drive-Ordner …', function() {
    gdGetToken(true).then(function() { ntDriveOpenBrowser(); }).catch(function(err) { gregGst(err.message); });
  }, 'background:#3d6b35;color:#fff;border-color:#3d6b35', '.notator-Datei aus einem beliebigen Ordner in Google Drive öffnen (mit Suche)'));
  openRow.appendChild(mkBtn('💻 Vom Gerät öffnen …', function() { ntOpenLocalFile(); }, '', 'Nur wenn nötig: lokale Datei (Achtung: kann von Drive abweichen – Drive ist die zentrale Ablage)'));
  bEl.appendChild(openRow);
  topRow.appendChild(mkBtn('💾 Aktuelles Stück speichern', function() { gregLibSaveCurrent(); }));
  topRow.appendChild(mkBtn('📑 Mappe', function() { ntMappeShow(); }, '', 'Gottesdienst-Mappe: mehrere Stücke zu einem PDF'));
  topRow.appendChild(mkBtn('🪄 Automatisch einordnen', function() { ntLibAutoRun(true); }, '', 'Kirchenjahr und Gattung für alle Stücke ohne Einordnung automatisch setzen (aus Titel, Text und GregoBase-Angaben) – eigene Einordnungen bleiben unverändert'));
  topRow.appendChild(mkBtn('📅 Vorschläge nach Kirchenjahr', function() { ntSuggestShow(); }, '', 'Für einen Sonntag oder ein Fest passende Stücke aus deiner Bibliothek und der Notenbibliothek'));
  topRow.appendChild(mkBtn('🔎 In NOH-Notenbibliothek suchen', function() {
    // Suchbegriff: Titel des offenen Stücks (NOH wertet #q=… aus); leer = Startseite
    const t = ((document.getElementById('greg-title') || {}).value || '').trim();
    window.open(NT_NOH_URL + (t ? '#q=' + encodeURIComponent(t) : ''), '_blank', 'noopener');
  }, '', 'NOH-Notenbibliothek in neuem Tab öffnen – sucht nach dem Titel des offenen Stücks'));
  if (driveOn && !signed) topRow.appendChild(mkBtn('🔑 Mit Google Drive verbinden', function() {
    gdGetToken(true).then(function() { gregLibShowModal(); }).catch(function(err) { gregGst(err.message); });
  }, 'background:#2a4a6a;color:#fff;border-color:#2a4a6a'));
  if (driveOn) {
    const a = document.createElement('a');
    a.href = 'https://drive.google.com/drive/folders/' + NOTATOR_GDRIVE_FOLDER_ID; a.target = '_blank'; a.rel = 'noopener';
    a.textContent = '↗ Ordner in Drive'; a.style.cssText = 'font-size:11px;align-self:center;margin-left:4px';
    topRow.appendChild(a);
  }
  bEl.appendChild(topRow);
  // Handy: kurze Beschriftungen, 3 Spalten -> alles ohne Scrollen sichtbar
  if (gregIsMobileViewport()) {
    const SHORT = [[/^✚ Neues/, '✚ Neu'], [/^💻 Vom Gerät/, '💻 Vom Gerät'], [/^☁ Anderer Drive/, '☁ Drive-Ordner'], [/^💾 Aktuelles/, '💾 Speichern'], [/^📑 Mappe/, '📑 Mappe'], [/^📅 Vorschläge/, '📅 Kirchenjahr'], [/^🪄 Automatisch/, '🪄 Einordnen'], [/^🔎 In NOH/, '🔎 NOH-Suche'], [/^🔑 Mit Google/, '🔑 Drive verbinden']];
    [openRow, topRow].forEach(row => row.querySelectorAll('button').forEach(btn => { const m = SHORT.find(x => x[0].test(btn.textContent)); if (m) { if (!btn.title) btn.title = btn.textContent; btn.textContent = m[1]; } }));
    const merged = document.createElement('div'); merged.className = 'nt-lib-row nt-lib-row3';
    [openRow, topRow].forEach(row => { while (row.firstChild) merged.appendChild(row.firstChild); row.remove(); });
    merged.style.cssText = 'margin-bottom:8px';
    bEl.insertBefore(merged, bEl.firstChild);
  }

  const filterWrap = document.createElement('div');
  bEl.appendChild(filterWrap);
  const status = document.createElement('div');
  status.style.cssText = 'font-size:11px;color:var(--ink2);margin-bottom:4px';
  bEl.appendChild(status);
  const listEl = document.createElement('div');
  listEl.style.cssText = 'max-height:46vh;overflow-y:auto';
  bEl.appendChild(listEl);

  let data = null, statusBase = '';
  const metaLine = m => [m.season, m.genre].filter(Boolean).join(' · ') + (m.tags.length ? (m.season || m.genre ? ' · ' : '') + m.tags.map(t => '#' + t).join(' ') : '');
  const editMeta = it => {
    ntMetaDialog(it.title, it.meta, data.allTags, m => {
      m.txt = it.meta.txt;
      const p = ntLibSaveMeta(it, m, true);
      p.then(() => { gregGst('Einordnung gespeichert: ' + it.title); gregLibShowModal(); })
        .catch(err => { gregGst('Fehler: ' + err.message); gregLibShowModal(); });
    }, () => gregLibShowModal());
  };
  const render = function(rebuildFilters) {
    if (rebuildFilters) { filterWrap.innerHTML = ''; ntLibFilterBar(filterWrap, data, render); }
    listEl.innerHTML = '';
    const shown = data.items.filter(it => ntLibMatches(it, _libFilter));
    status.textContent = statusBase;
    const fAct = [_libFilter.q && ('«' + _libFilter.q + '»'), _libFilter.season, _libFilter.genre, _libFilter.tag && ('Tag ' + _libFilter.tag)].filter(Boolean);
    if (fAct.length || shown.length !== data.items.length) {
      // Filter aktiv: deutlich anzeigen, mit einem Klick wieder alle Stücke
      const fb = document.createElement('div');
      fb.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:4px;padding:4px 6px;background:#f3e2b8;border:1px solid #d0a040;border-radius:4px;color:#5a3a10;font-size:12px';
      fb.innerHTML = '<span>Filter: <b>' + ntEscAttr(fAct.join(' · ') || '–') + '</b> – ' + shown.length + ' von ' + data.items.length + ' angezeigt</span>';
      const all = document.createElement('button'); all.className = 'b'; all.textContent = '✕ Alle ' + data.items.length + ' anzeigen';
      all.onclick = () => { _libFilter = { q: '', season: '', genre: '', tag: '' }; render(true); };
      fb.appendChild(all); status.appendChild(fb);
    }
    if (!data.items.length) { listEl.innerHTML = '<p style="font-size:11px;color:var(--ink2)">' + (data.mode === 'drive' ? 'Der Drive-Ordner ist noch leer.' : 'Noch keine Stücke gespeichert.') + '</p>'; return; }
    if (!shown.length) { listEl.innerHTML = '<p style="font-size:11px;color:var(--ink2)">Keine Treffer für diesen Filter.</p>'; return; }
    shown.forEach(function(it) {
      const r = document.createElement('div');
      r.style.cssText = 'display:flex;align-items:center;gap:4px;margin:2px 0';
      const ob = mkBtn('', function() { if (it.kind === 'drive') gregLibLoadDrive(it.file); else gregLibLoadEntry(it.id); }, 'flex:1;text-align:left;min-width:0');
      const t = document.createElement('div'); t.textContent = it.title + '  —  ' + gregLibFormatDate(it.date);
      t.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      if (it.badge) { const s = document.createElement('span'); s.textContent = '  ' + it.badge; s.style.cssText = 'font-size:10px;color:#a06030'; t.appendChild(s); }
      ob.appendChild(t);
      const ml = metaLine(it.meta);
      if (ml) { const d = document.createElement('div'); d.textContent = ml; d.style.cssText = 'font-size:10px;color:#5a7a40;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'; ob.appendChild(d); }
      r.appendChild(ob);
      r.appendChild(mkBtn('🏷', function() { editMeta(it); }, 'font-size:11px;padding:2px 5px', 'Einordnen (Kirchenjahr, Gattung, Tags)'));
      if (it.kind === 'drive') {
        r.appendChild(mkBtn('✎', function() { gregLibRenameDrive(it.file); }, 'font-size:11px;padding:2px 5px', 'Umbenennen'));
        r.appendChild(mkBtn('🗑', function() { gregLibDeleteDrive(it.file); }, 'font-size:11px;padding:2px 5px;color:#c0605a', 'Löschen'));
      } else {
        r.appendChild(mkBtn('✎', function() { gregLibRenameEntry(it.id, it.title); }, 'font-size:11px;padding:2px 5px', 'Umbenennen'));
        r.appendChild(mkBtn('🗑', function() { gregLibDeleteEntryConfirm(it.id, it.title); }, 'font-size:11px;padding:2px 5px;color:#c0605a', 'Löschen'));
      }
      listEl.appendChild(r);
    });
  };

  // Automatische Einordnung: leere Felder (Kirchenjahr/Gattung) füllen
  const autoRun = function(manual) {
    if (!data) { gregGst('Bibliothek wird noch geladen …'); return; }
    if (driveOn && !signed && manual) { gregGst('Zuerst mit Google Drive verbinden.'); return; }
    const props = ntLibAutoProposals(data.items);
    window._ntAutoClassDone = true;
    if (!props.length) { if (manual) gregGst('Alle Stücke sind bereits eingeordnet (oder nicht erkennbar).'); return; }
    statusBase += ' · ordne ' + props.length + ' Stück(e) ein …'; render(false);
    ntLibAutoApply(props, (ok, fail) => {
      const open = document.getElementById('modal-bg').classList.contains('open') && document.getElementById('modal-title').textContent.indexOf('Bibliothek') >= 0;
      gregGst(ok + ' Stück(e) automatisch eingeordnet' + (fail ? ', ' + fail + ' fehlgeschlagen' : '') + ' – bei Bedarf mit 🏷 korrigieren');
      if (open) { statusBase = statusBase.replace(/ · ordne .*$/, '') + ' · ' + ok + ' automatisch eingeordnet'; render(true); }
    });
  };
  window._ntLibAutoRun = autoRun;
  status.textContent = signed ? 'Lade Liste aus Google Drive …' : '';
  gregLibCollect(true).then(function(d) {
    data = d;
    if (d.mode === 'drive') statusBase = d.driveCount + ' Gesang/Gesänge in Google Drive' + (d.sync && d.sync.total ? ' · ' + d.sync.ok + ' von ' + d.sync.total + ' lokalen Änderung(en) hochgeladen' : '');
    else statusBase = driveOn ? 'Nicht mit Google Drive verbunden – angezeigt werden die lokalen Kopien.' : '';
    render(true);
    // einmal pro Sitzung von selbst (nur leere Felder; nicht ohne Drive-Anmeldung)
    if (!window._ntAutoClassDone && (d.mode === 'drive' || !driveOn)) autoRun(false);
  }).catch(function(err) {
    gregLibCollect(false).then(function(d) {
      data = d; statusBase = 'Google Drive nicht erreichbar (' + err.message + ') – angezeigt werden die lokalen Kopien.'; render(true);
    });
  });

  const bottom = document.createElement('div');
  bottom.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;margin-top:8px';
  bottom.appendChild(mkBtn('⬇ Export (JSON)', function() { gregLibExportAll(); }, 'font-size:11px'));
  bottom.appendChild(mkBtn('⬆ Import (JSON)', function() { document.getElementById('greg-lib-import-in').click(); }, 'font-size:11px'));
  bottom.appendChild(mkBtn('⚙ Drive einrichten', function() { gdSetupDialog(); }, 'font-size:11px', 'Google-Client-ID eintragen/ändern'));
  bottom.appendChild(mkBtn('Schliessen', function() { closeModal(); bEl.style.flexDirection = ''; bEl.style.alignItems = ''; }, 'margin-left:auto'));
  bEl.appendChild(bottom);
}

