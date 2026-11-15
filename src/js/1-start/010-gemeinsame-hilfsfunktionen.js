// ── Gemeinsame Hilfsfunktionen (Dialog, Skript-Nachladen, Start) ─────
// (Der frühere Klick-Noten-Editor wurde in Build 230 entfernt; die
// klassische Fassung entsteht jetzt im Tab "Orgel (klassisch)".)
function showModal(title,body,btns){
  // Dialoge haben Vorrang: offenes Bearbeitungsfenster/Silbenfeld schliessen
  try { if (document.getElementById('greg-edit-pop')) { gregCloseEditForm(); gregRefreshListNoRender(); } gregSylInlineClose(true); } catch (e) {}
  document.getElementById('modal-title').textContent=title;
  // Text, nicht HTML: Titel aus geteilten Links (#n=, #song=), Drive oder GregoBase dürfen kein Markup einschleusen
  const mbP=document.createElement('p');mbP.style.cssText='font-size:12px;color:var(--ink2);white-space:pre-line';mbP.textContent=body==null?'':String(body);
  document.getElementById('modal-body').replaceChildren(mbP);
  const bEl=document.getElementById('modal-btns');bEl.innerHTML='';
  btns.forEach(b=>{
    const btn=document.createElement('button');
    btn.className='b';btn.textContent=b.label;
    btn.onclick=b.fn;bEl.appendChild(btn);
  });
  document.getElementById('modal-bg').classList.add('open');
}
function closeModal(){document.getElementById('modal-bg').classList.remove('open');}
document.getElementById('modal-bg').addEventListener('click',function(e){if(e.target===this)closeModal();});

function loadScript(src,cb){
  const s=document.createElement('script');s.src=src;
  s.onload=cb||null;document.head.appendChild(s);
}

window.addEventListener('DOMContentLoaded',()=>{
  loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',()=>{
    if(window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc=
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  });
  loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  setTimeout(() => switchTab('greg'), 100);
});
