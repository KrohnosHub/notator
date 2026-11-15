// ── Text zuerst, Noten danach ──
// Text eingeben -> Silben trennen (bearbeitbar) -> jede gesetzte Neume
// bekommt automatisch die nächste Silbe (Wortende inklusive). Shift+Klick
// oder «ohne Silbe» setzt eine Neume ohne Silbe (Melisma).
function gregTextQueue() { return window._gregTextQ || null; }
function gregTextFirstShow() {
  showModal('📝 Text zuerst, Noten danach', '', []);
  const body = document.getElementById('modal-body');
  body.innerHTML =
    '<div style="font-size:12px;color:var(--ink2);line-height:1.45;margin-bottom:6px">1. Text eingeben oder einfügen · 2. «Silben trennen» · 3. Trennung prüfen und bei Bedarf korrigieren (Bindestriche) · 4. «Los» – danach bekommt jede Neume, die du setzt, automatisch die nächste Silbe.</div>' +
    '<textarea id="tf-text" rows="4" style="width:100%;box-sizing:border-box;font-size:15px;font-family:inherit" placeholder="z.B. Kýrie eléison. * Christe eléison."></textarea>' +
    '<div style="display:flex;gap:6px;align-items:center;margin:6px 0"><button class="b" id="tf-split">✂ Silben trennen</button><span style="font-size:11px;color:var(--ink2)">Akzente (Kýrie) helfen nicht bei der Trennung, werden aber übernommen.</span></div>' +
    '<textarea id="tf-syl" rows="4" style="width:100%;box-sizing:border-box;font-size:15px;font-family:inherit" placeholder="Ký-ri-e e-lé-i-son. * Chri-ste e-lé-i-son."></textarea>' +
    '<div style="font-size:11px;color:var(--ink2);margin-top:4px;line-height:1.4">Bindestrich = Silbengrenze, Leerzeichen = Wortende. Einzelne Zeichen wie <b>*</b>, <b>℣.</b>, <b>℟.</b> werden an ihrer Stelle automatisch eingefügt. Melismen: Neume mit <b>Shift+Klick</b> (oder Knopf «ohne Silbe») setzen – sie bekommt keine Silbe.</div>' +
    '<div id="tf-msg" style="font-size:11px;color:#a03020;min-height:14px"></div>';
  const tx = document.getElementById('tf-text'), sy = document.getElementById('tf-syl');
  const split = () => { sy.value = tx.value.split(/\n/).map(line => line.trim().split(/\s+/).filter(w => w).map(w => /[A-Za-zÀ-ÿǽǼæœÆŒ]/.test(w) ? ntPtSyllabify(w).join('-') : w).join(' ')).join('\n'); };
  document.getElementById('tf-split').onclick = split;
  const btns = document.getElementById('modal-btns');
  const mk = (l, fn) => { const b = document.createElement('button'); b.className = 'b'; b.textContent = l; b.onclick = fn; btns.appendChild(b); };
  mk('▶ Los', () => {
    if (!sy.value.trim() && tx.value.trim()) split();
    const q = gregTextParse(sy.value);
    if (!q.length) { document.getElementById('tf-msg').textContent = 'Kein Text.'; return; }
    closeModal();
    window._gregTextQ = { syls: q, pos: 0 };
    if (window._ntTab && window._ntTab !== 'greg') switchTab('greg');
    gregTextQueueFill();
  });
  mk('Abbrechen', () => closeModal());
  setTimeout(() => tx.focus(), 50);
}
function gregTextParse(txt) {
  const out = [];
  String(txt || '').split(/\s+/).filter(w => w).forEach(w => {
    if (/^(\*|†|\+)$/.test(w)) { out.push({ special: 'special', t: w === '+' ? '†' : w }); return; }
    if (/^(℣|℟|[VR]\/)\.?$/.test(w)) { out.push({ special: 'textonly', t: w.replace(/^V\//, '℣').replace(/^R\//, '℟') }); return; }
    const parts = w.split('-').filter(x => x);
    parts.forEach((t, i) => out.push({ t, we: i === parts.length - 1 }));
  });
  return out;
}
// Nächste Silbe ins Silbenfeld (Sonderzeichen unterwegs direkt einfügen)
function gregTextQueueFill() {
  const q = gregTextQueue(); if (!q) { gregTextQueueUi(); return; }
  let added = false;
  while (q.pos < q.syls.length && q.syls[q.pos].special) {
    const sp = q.syls[q.pos++]; gregPush();
    gregEntries.push(sp.special === 'special' ? { type: 'special', text: sp.t } : { type: 'textonly', text: sp.t });
    added = true;
  }
  if (added) gregRefreshList();
  const ls = document.getElementById('greg-syllable'), lw = document.getElementById('greg-wordend');
  if (q.pos >= q.syls.length) {
    window._gregTextQ = null;
    if (ls) ls.value = ''; if (lw) { lw.checked = false; lw._auto = false; }
    gregQuickbarSync(); gregTextQueueUi();
    gregGst('Text vollständig gesetzt ✓');
    return;
  }
  const c = q.syls[q.pos];
  if (ls) ls.value = c.t + (c.we ? ' ' : '');
  if (lw) { lw.checked = !!c.we; lw._auto = !!c.we; }
  gregQuickbarSync(); gregTextQueueUi();
}
function gregTextQueueStep(d) {
  const q = gregTextQueue(); if (!q) return;
  q.pos = Math.max(0, Math.min(q.syls.length, q.pos + d));
  if (d < 0) while (q.pos > 0 && q.syls[q.pos].special) q.pos--;
  gregTextQueueFill();
}
function gregTextQueueEnd() { window._gregTextQ = null; const ls = document.getElementById('greg-syllable'); if (ls) ls.value = ''; const lw = document.getElementById('greg-wordend'); if (lw) { lw.checked = false; lw._auto = false; } gregQuickbarSync(); gregTextQueueUi(); gregGst('Text-Modus beendet'); }
function gregTextNoSyl() { window._gregNoSylOnce = !window._gregNoSylOnce; gregTextQueueUi(); }
function gregTextQueueUi() {
  const q = gregTextQueue();
  document.querySelectorAll('.greg-tq').forEach(box => {
    if (!q) { box.style.display = 'none'; box.innerHTML = ''; return; }
    box.style.display = 'inline-flex';
    const c = q.syls[q.pos] || {}, nx = q.syls.slice(q.pos + 1, q.pos + 4).map(x => x.t + (x.we ? ' ' : '-')).join('');
    box.innerHTML = '<span title="Nächste Silbe aus dem Text">📝 <b style="font-size:15px;color:#f0e0a0">' + ntEscAttr(c.t || '') + (c.we ? '' : '-') + '</b> <span style="opacity:.6">' + ntEscAttr(nx) + '</span> (' + (q.pos + 1) + '/' + q.syls.length + ')</span>' +
      '<button class="b" data-tq="-1" title="Eine Silbe zurück">◀</button><button class="b" data-tq="1" title="Silbe überspringen">▶</button>' +
      '<button class="b" data-tq="nosyl" title="Nächste Neume ohne Silbe setzen (Melisma) – auch mit Shift+Klick"' + (window._gregNoSylOnce ? ' style="background:#5a3a20;color:#fff"' : '') + '>ohne Silbe</button>' +
      '<button class="b" data-tq="end" title="Text-Modus beenden">✕</button>';
    // keine Inline-Handler (CSP): Knöpfe nach dem Einsetzen verbinden
    box.querySelectorAll('[data-tq]').forEach(b => { const k = b.dataset.tq; b.onclick = () => { if (k === 'end') gregTextQueueEnd(); else if (k === 'nosyl') gregTextNoSyl(); else gregTextQueueStep(+k); }; });
  });
}
// Nach dem Setzen: war es die erwartete Silbe -> weiter zur nächsten
function gregTextQueueAfterPlace(e) {
  const q = gregTextQueue(); if (!q) return;
  const c = q.syls[q.pos];
  if (c && e && e.syllable === c.t) q.pos++;
  gregTextQueueFill();
}

// Silbenfelder: keine automatische Grossschreibung/Autokorrektur der Handy-Tastatur
function gregNoAutoCaps(el) { ['autocapitalize', 'autocorrect', 'autocomplete'].forEach(a => el.setAttribute(a, 'off')); el.spellcheck = false; }
// ── Silbe direkt unter der gesetzten Note eingeben ──
function gregAskSylOn() { try { return localStorage.getItem('notatorAskSyl') !== '0'; } catch (e) { return true; } }
function gregAskSylSet(on) { try { localStorage.setItem('notatorAskSyl', on ? '1' : '0'); } catch (e) {} const q = document.getElementById('greg-qb-ask'); if (q) q.checked = !!on; }
function gregSylAsk(i) { if (gregAskSylOn() && !gregTextQueue()) gregAfterRenderOnce(() => gregSylInlineOpen(i)); }
function gregSylInlineClose(commit) {
  const inp = document.getElementById('greg-syl-inline'); if (!inp) return;
  const f = inp._commit; inp._commit = null; inp.remove();
  if (commit && f) f();
}
function gregSylInlineOpen(i) {
  gregSylInlineClose(true);
  const e = gregEntries[i]; if (!e || e.type !== 'note') return;
  const r = gregEntryClientRect(i); if (!r) return;
  const inp = document.createElement('input');
  inp.id = 'greg-syl-inline'; inp.className = 'greg-syl-inline'; inp.type = 'text';
  gregNoAutoCaps(inp); inp.setAttribute('enterkeyhint', 'done');
  inp.value = e.syllable || ''; inp.placeholder = 'Silbe';
  inp.title = 'Silbe für diese Note – Leerzeichen am Ende = Wortende · Enter: übernehmen · Tab: weiter zur nächsten Note · Shift+Tab: zurück · Esc: überspringen';
  inp.style.left = Math.max(4, Math.min(r.left - 12, window.innerWidth - 140)) + 'px';
  inp.style.top = Math.max(4, Math.min(r.bottom + 6, window.innerHeight - 44)) + 'px';
  let changed = false;
  const commit = () => {
    const raw = inp.value, v = raw.trim();
    const we = /\s$/.test(raw) && !!v; // Leerzeichen am Ende = Wortende
    if (v !== (e.syllable || '') || (we && !e.wordEnd)) { gregPush(); e.syllable = v; if (we) e.wordEnd = true; changed = true; gregRefreshList(); }
  };
  inp._commit = commit;
  inp.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); gregSylInlineClose(true); }
    else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); gregSylInlineClose(false); }
    else if (ev.key === 'Tab') {
      ev.preventDefault();
      const dir = ev.shiftKey ? -1 : 1;
      let j = i + dir; while (j >= 0 && j < gregEntries.length && gregEntries[j].type !== 'note') j += dir;
      gregSylInlineClose(true);
      if (j >= 0 && j < gregEntries.length) { if (changed) gregAfterRenderOnce(() => gregSylInlineOpen(j)); else gregSylInlineOpen(j); }
    }
  });
  inp.addEventListener('blur', () => setTimeout(() => { if (document.getElementById('greg-syl-inline') === inp && document.activeElement !== inp) gregSylInlineClose(true); }, 150));
  document.body.appendChild(inp);
  inp.focus(); inp.select();
}

