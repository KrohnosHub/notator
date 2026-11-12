// ── Bibliothek ordnen: Kategorien + freie Tags ──────────────────────
// Gespeichert im Stück (state.meta) und – für Suche ohne Herunterladen –
// zusätzlich als Drive-"appProperties" an der .notator-Datei.
const NT_SEASONS = ['Advent', 'Weihnachtszeit', 'Zeit im Jahreskreis', 'Fastenzeit', 'Karwoche / Triduum', 'Osterzeit', 'Pfingsten', 'Herrenfeste', 'Marienfeste', 'Heiligenfeste', 'Totenliturgie', 'Ganzes Jahr / Sonstiges'];
const NT_GENRES = ['Introitus', 'Kyrie', 'Gloria', 'Graduale', 'Alleluia', 'Tractus', 'Sequenz', 'Credo', 'Offertorium', 'Sanctus', 'Agnus Dei', 'Communio', 'Ite missa est', 'Antiphon', 'Marianische Antiphon', 'Hymnus', 'Psalm / Canticum', 'Responsorium', 'Sonstiges'];
const NT_NOH_URL = 'https://krohnoshub.github.io/notator/noh/';
var gregMeta = {};
var _libFilter = { q: '', season: '', genre: '', tag: '' };

function ntMetaNorm(m) {
  m = m || {};
  const tags = Array.isArray(m.tags) ? m.tags : String(m.tags || '').split(',');
  return { season: m.season || '', genre: m.genre || '', tags: tags.map(t => String(t).trim()).filter(Boolean), txt: m.txt || '' };
}
function ntUtf8Cut(str, maxBytes) {
  str = String(str || '');
  while (new TextEncoder().encode(str).length > maxBytes) str = str.slice(0, -1);
  return str;
}
function ntMetaToAppProps(m) {
  m = ntMetaNorm(m);
  return { season: ntUtf8Cut(m.season, 100), genre: ntUtf8Cut(m.genre, 100), tags: ntUtf8Cut(m.tags.join(','), 110), txt: ntUtf8Cut(m.txt, 110) };
}
function ntMetaFromAppProps(ap) { return ntMetaNorm(ap || {}); }
// Liedtext-Anfang des offenen Stücks (für die Suche)
function ntCurrentIncipit() {
  const g = (document.getElementById('greg-gabc-out') || {}).value || '';
  const body = g.indexOf('%%') >= 0 ? g.slice(g.indexOf('%%') + 2) : g;
  return body.replace(/\([^)]*\)/g, '').replace(/<[^>]+>/g, '').replace(/[*{}]/g, '').replace(/\s+/g, ' ').trim().slice(0, 90);
}

function ntMetaDialog(title, meta, allTags, onSave, onCancel) {
  meta = ntMetaNorm(meta);
  showModal('🏷 Einordnen: ' + title, '', []);
  const body = document.getElementById('modal-body');
  const opt = (list, cur) => '<option value="">– keine –</option>' + list.map(x => '<option' + (x === cur ? ' selected' : '') + '>' + ntEscAttr(x) + '</option>').join('');
  body.innerHTML =
    '<label style="display:block;font-size:12px;margin:4px 0">Kirchenjahr<br><select id="nt-meta-season" style="width:100%;font-size:13px;padding:3px">' + opt(NT_SEASONS, meta.season) + '</select></label>' +
    '<label style="display:block;font-size:12px;margin:4px 0">Gattung<br><select id="nt-meta-genre" style="width:100%;font-size:13px;padding:3px">' + opt(NT_GENRES, meta.genre) + '</select></label>' +
    '<label style="display:block;font-size:12px;margin:4px 0">Tags (mit Komma trennen)<br><input id="nt-meta-tags" list="nt-meta-taglist" type="text" value="' + ntEscAttr(meta.tags.join(', ')) + '" style="width:100%;box-sizing:border-box;font-size:13px;padding:4px" placeholder="z.B. Hochamt, Schola, Kyrie XVI"></label>' +
    '<datalist id="nt-meta-taglist">' + (allTags || []).map(t => '<option value="' + ntEscAttr(t) + '">').join('') + '</datalist>' +
    ((allTags || []).length ? '<div style="font-size:11px;margin-top:4px;display:flex;flex-wrap:wrap;gap:3px">' + allTags.map(t => '<button class="b nt-tagadd" style="font-size:10px;padding:1px 6px" data-t="' + ntEscAttr(t) + '">+ ' + ntEscAttr(t) + '</button>').join('') + '</div>' : '');
  body.querySelectorAll('.nt-tagadd').forEach(b => b.onclick = () => {
    const inp = document.getElementById('nt-meta-tags');
    const cur = inp.value.split(',').map(x => x.trim()).filter(Boolean);
    const t = b.getAttribute('data-t');
    if (!cur.includes(t)) cur.push(t);
    inp.value = cur.join(', ');
  });
  const bEl = document.getElementById('modal-btns');
  bEl.style.flexDirection = ''; bEl.style.alignItems = '';
  const ok = document.createElement('button'); ok.className = 'b'; ok.textContent = 'Übernehmen';
  ok.style.cssText = 'background:#3d6b35;color:#fff;border-color:#3d6b35';
  const ca = document.createElement('button'); ca.className = 'b'; ca.textContent = 'Abbrechen';
  bEl.appendChild(ok); bEl.appendChild(ca);
  ok.onclick = () => onSave(ntMetaNorm({ season: document.getElementById('nt-meta-season').value, genre: document.getElementById('nt-meta-genre').value, tags: document.getElementById('nt-meta-tags').value, txt: meta.txt }));
  ca.onclick = () => (onCancel ? onCancel() : closeModal());
}

// Einordnen des gerade offenen Stücks
function gregEditCurrentMeta() {
  gregLibCollect(false).then(r => r.allTags).catch(() => []).then(tags => {
    ntMetaDialog((document.getElementById('greg-title') || {}).value || 'Aktuelles Stück', gregMeta, tags, m => {
      gregMeta = m; closeModal();
      gregScheduleAutosave();
      gregGst('Einordnung gesetzt – wird beim nächsten Speichern in die Bibliothek übernommen.');
    });
  });
}

// Alle Bibliotheks-Einträge (Drive + nur lokal) als einheitliche Liste.
// withDrive: Drive abfragen (nur wenn angemeldet; lädt vorher ausstehende Änderungen hoch)
function gregLibCollect(withDrive) {
  const driveOn = gdConfigured(), signed = driveOn && gdHasToken();
  const fromLocal = l => ({ kind: 'local', id: l.id, title: l.title, date: l.updatedAt || l.savedAt, meta: ntMetaNorm(l.meta), local: l,
    badge: driveOn && (l.pending || !l.driveId) ? '⏫ nicht in Drive' : '' });
  const finish = (items, extra) => {
    const tags = {};
    items.forEach(it => it.meta.tags.forEach(t => { tags[t] = 1; }));
    return Object.assign({ items, allTags: Object.keys(tags).sort((a, b) => a.localeCompare(b, 'de')) }, extra || {});
  };
  if (!withDrive || !signed) {
    return gregLibList().then(locals => finish(locals.filter(l => !l.driveGone).map(fromLocal), { mode: 'local', driveOn, signed }));
  }
  return gregLibSyncPending(false).then(sync => Promise.all([gdList(false), gregLibList()]).then(res => {
    const files = res[0], locals = res[1];
    const items = files.map(f => {
      const loc = locals.find(l => l.driveId === f.id);
      return { kind: 'drive', file: f, title: gdTitleFromName(f.name), date: Date.parse(f.modifiedTime),
        meta: f.appProperties ? ntMetaFromAppProps(f.appProperties) : ntMetaNorm(loc && loc.meta), local: loc || null,
        badge: loc && loc.pending ? '⏫ lokale Änderung' : '' };
    });
    // Lokale Kopien, deren Drive-Datei gelöscht (Papierkorb) oder weg ist: ausblenden und merken
    locals.forEach(l => { if (!l.driveId) return; const gone = !files.some(f => f.id === l.driveId);
      if (!!l.driveGone !== gone) gregLibGet(l.id).then(r => { if (r) { r.driveGone = gone; return gregLibPut(r); } }).catch(() => {}); l.driveGone = gone; });
    locals.filter(l => !l.driveId).forEach(l => items.push(fromLocal(l)));
    return finish(items, { mode: 'drive', driveOn, signed, sync, driveCount: files.length });
  }));
}

function ntLibMatches(it, f) {
  if (f.season && it.meta.season !== f.season) return false;
  if (f.genre && it.meta.genre !== f.genre) return false;
  if (f.tag && !it.meta.tags.includes(f.tag)) return false;
  if (f.q) {
    const hay = (it.title + ' ' + it.meta.txt + ' ' + it.meta.tags.join(' ') + ' ' + it.meta.genre + ' ' + it.meta.season).toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
    const words = f.q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/\s+/).filter(Boolean);
    if (!words.every(w => hay.includes(w))) return false;
  }
  return true;
}

// Filterleiste (Suche, Kirchenjahr, Gattung, Tag) – auch von der Mappe genutzt
function ntLibFilterBar(container, data, onChange) {
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px';
  const sel = (key, label, list, counts) => {
    const s = document.createElement('select');
    s.className = 'b'; s.style.cssText = 'font-size:11px;max-width:150px;flex:1 1 100px';
    s.innerHTML = '<option value="">' + label + '</option>' + list.map(x => '<option value="' + ntEscAttr(x) + '"' + (x === _libFilter[key] ? ' selected' : '') + '>' + ntEscAttr(x) + (counts ? ' (' + (counts[x] || 0) + ')' : '') + '</option>').join('');
    s.onchange = () => { _libFilter[key] = s.value; onChange(); };
    return s;
  };
  const q = document.createElement('input');
  q.type = 'search'; q.placeholder = '🔍 Suche (Titel, Text, Tag)'; q.value = _libFilter.q;
  q.style.cssText = 'flex:2 1 160px;font-size:12px;padding:3px 5px;min-width:0';
  q.oninput = () => { _libFilter.q = q.value; onChange(); };
  bar.appendChild(q);
  const used = k => Array.from(new Set(data.items.map(it => it.meta[k]).filter(Boolean)));
  const ug = NT_GENRES.filter(x => used('genre').includes(x));
  // Kirchenjahr: immer alle Zeiten anbieten (mit Anzahl der zugeordneten Stücke)
  const sc = {}; data.items.forEach(it => { if (it.meta.season) sc[it.meta.season] = (sc[it.meta.season] || 0) + 1; });
  bar.appendChild(sel('season', 'Kirchenjahr: alle', NT_SEASONS, sc));
  if (ug.length) bar.appendChild(sel('genre', 'Gattung: alle', ug));
  if (data.allTags.length) bar.appendChild(sel('tag', 'Tag: alle', data.allTags));
  const r = document.createElement('button'); r.className = 'b'; r.textContent = '✕ Filter'; r.style.cssText = 'font-size:11px'; r.title = 'Suche und Filter zurücksetzen';
  r.onclick = () => { _libFilter = { q: '', season: '', genre: '', tag: '' }; onChange(true); };
  bar.appendChild(r);
  container.appendChild(bar);
  return q;
}

// Einordnung (Kirchenjahr/Gattung/Tags) eines Bibliothekseintrags speichern
function ntLibSaveMeta(it, m, interactive) {
  let p;
  if (it.kind === 'drive') {
    p = gdFetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(it.file.id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appProperties: ntMetaToAppProps(m) }) }, !!interactive).then(() => {
      if (it.local) return gregLibGet(it.local.id).then(rec => { if (rec && rec.state) { rec.state.meta = m; rec.meta = m; return gregLibPut(rec); } });
    });
  } else {
    p = gregLibGet(it.id).then(rec => { if (!rec) return; rec.state = rec.state || {}; rec.state.meta = m; rec.meta = m; rec.pending = true; return gregLibPut(rec); });
  }
  const curId = it.local ? it.local.id : it.id;
  if (gregLibCurrentId != null && gregLibCurrentId === curId) gregMeta = m;
  it.meta = m;
  return p;
}

