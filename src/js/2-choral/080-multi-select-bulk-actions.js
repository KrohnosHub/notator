// ── Multi-select bulk actions ────────────────────────────────────
// Shows/hides the bulk-action toolbar above the entry list and (re)builds
// its buttons based on the current selection. Called whenever a checkbox
// is toggled, and once after every full list re-render (which also prunes
// selected indices that no longer exist, e.g. after entries were deleted
// or reordered by something else).
function gregUpdateBulkToolbar() {
  // Prune indices beyond the current entries length (defensive — e.g. if
  // gregEntries shrank via some other action while a selection was active).
  gregSelectedIndices.forEach(idx => { if (idx >= gregEntries.length) gregSelectedIndices.delete(idx); });

  const bar = document.getElementById('greg-bulk-toolbar');
  if (typeof gregBlockSync === 'function') gregBlockSync();
  if (!bar) return;
  const n = gregSelectedIndices.size;
  if (n === 0) { bar.style.display = 'none'; bar.innerHTML = ''; return; }
  bar.style.flexWrap = 'wrap';

  bar.style.display = 'flex';
  bar.innerHTML = '';

  const label = document.createElement('span');
  label.textContent = n + ' ausgewählt';
  label.style.cssText = 'font-size:9px;color:#8ab0d0;flex:1';
  bar.appendChild(label);

  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'Auswahl aufheben';
  clearBtn.style.cssText = 'font-size:9px;padding:1px 5px;background:#1a2a3a;color:#8ab0d0;border:1px solid #3a5a6a;border-radius:2px;cursor:pointer';
  clearBtn.onclick = () => { gregSelectedIndices.clear(); gregRefreshList(); };
  bar.appendChild(clearBtn);

  gregBlockButtons(bar, true);
}

function gregBulkDelete() {
  if (!gregSelectedIndices.size) return;
  if (!window.confirm(gregSelectedIndices.size + ' Einträge löschen?')) return;
  gregPush();
  // Remove from HIGHEST index to LOWEST so earlier indices stay valid as we go.
  Array.from(gregSelectedIndices).sort((a,b)=>b-a).forEach(idx => gregEntries.splice(idx, 1));
  gregSelectedIndices.clear();
  gregRefreshList();
  gregGst('Gelöscht');
}

function gregBulkMoveToSection() {
  if (!window._gregMultiSection || gregSections.length <= 1 || !gregSelectedIndices.size) return;

  const others = gregSections
    .map((s, idx) => ({s, idx}))
    .filter(o => o.idx !== gregActiveIdx);
  if (!others.length) return;

  const listText = others.map(o => {
    const label = (o.s.title || o.s.subtitle || '(ohne Titel)').substring(0, 40);
    return (o.idx + 1) + ': ' + label;
  }).join('\n');
  const answer = window.prompt(
    gregSelectedIndices.size + ' Einträge in welchen Abschnitt verschieben?\n' + listText + '\n\nAbschnitt-Nummer eingeben:',
    String(others[0].idx + 1)
  );
  if (answer === null) return;
  const targetPos = parseInt(answer, 10);
  const target = others.find(o => (o.idx + 1) === targetPos);
  if (!target) { gregGst('Ungültige Abschnitt-Nummer'); return; }

  gregPush();
  // Highest index first, same reasoning as gregBulkDelete.
  const indices = Array.from(gregSelectedIndices).sort((a,b)=>b-a);
  indices.forEach(idx => {
    const entry = gregEntries[idx];
    if (!entry) return;
    gregEntries.splice(idx, 1);
    if (entry.type === 'comment') {
      const lastNoteIdx = gregCountNoteEntries(target.s.entries) - 1;
      entry.anchorNoteIdx = lastNoteIdx >= 0 ? lastNoteIdx : null;
      entry.dx = 0; entry.dy = -30;
      delete entry.x; delete entry.y;
    }
    target.s.entries.push(entry);
  });
  gregSelectedIndices.clear();
  gregRefreshList();
  gregGst('Verschoben nach Abschnitt ' + (target.idx + 1));
}

