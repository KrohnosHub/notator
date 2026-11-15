// Lesetest ausserhalb von Notator: ein Aufruf je System, strukturierte Ausgabe.
const fs=require('fs'),path=require('path');
const [,, S, variant, series, model, effort, maxUsd, only] = process.argv;
const REPO='/home/user/notator/tests/pdf-lesen';
const PR={'claude-sonnet-5-5':[2,10],'claude-opus-5-5':[4,20]};
const info=JSON.parse(fs.readFileSync(S+'/systems.json','utf8'));
const ledF=S+'/ledger.json'; const led=fs.existsSync(ledF)?JSON.parse(fs.readFileSync(ledF)):{usd:0,calls:0};
const BASE=`This image shows ONE system (one line of music) of Gregorian chant in square notation on a 4-line staff, with its lyrics underneath. Transcribe it into GABC: each syllable followed by its notes in parentheses, e.g. Ký(fg)ri(g)e(f.) e(g)lé(h)i(gf)son.(g.)

Pitch letters are purely positional: bottom staff line = d, space above = e, 2nd line = f, space = g, 3rd line = h, space = i, top line = j; below the staff c, b, a; above the staff k, l, m. Ignore the clef at the left edge and the small custos at the right edge; do not transcribe them.

Notes: write every note head, in singing order. Two heads stacked vertically = lower one first. A descending pair joined by a stroke = upper first. Small diamond notes are notes too. A dot after a note = "." after its letter. A flat sign is not a note: write it as the letter of its position followed by x (e.g. ix) just before the note it affects.

Text: syllables of one word are written back to back without space or hyphen; separate words with a space. Keep accents and punctuation as printed. If several lines of text are printed, use only the first line under the staff. A large initial letter belongs to the first syllable. A melisma on one syllable goes into one parenthesis.

Bar lines between syllables as separate tokens: (,) short tick at the top line, (;) half bar, (:) full bar, (::) double bar. The right edge of the image is not a bar.`;
const RULER=`

The image has been enlarged and prepared to make pitches easy to read: yellow ruler columns are inserted at the edges and between segments, with a red tick and letter for every pitch position (a to m). Thin light-blue horizontal lines run through the space positions c, e, g, i and k; the black staff lines are d, f, h and j. Read each note head's letter off the nearest ruler. The rulers and blue lines are not part of the music.`;
const schema={type:'object',properties:{gabc:{type:'string'}},required:['gabc'],additionalProperties:false};
(async()=>{
  const key=process.env.ANTHROPIC_API_KEY; let tot={i:0,o:0,usd:0,ms:0};
  for(const c of Object.keys(info)){ if(only&&only!==c) continue;
    const exp=JSON.parse(fs.readFileSync(`${REPO}/cases/${c}/expected.json`,'utf8'));
    const n=exp.pieces[0].systems.length, lines=[], log=[]; const t0=Date.now(); let u={i:0,o:0,usd:0};
    for(let k=0;k<n;k++){
      if(led.usd>=parseFloat(maxUsd)){ console.log('Kostenbremse'); process.exit(3); }
      const f=`${S}/${variant}-${info[c][k].file}`;
      const body={model,max_tokens:16000,output_config:{effort,format:{type:'json_schema',schema}},
        messages:[{role:'user',content:[{type:'image',source:{type:'base64',media_type:'image/png',data:fs.readFileSync(f).toString('base64')}},{type:'text',text:BASE+(variant==='B'||variant==='D'?RULER:'')+(variant==='C'||variant==='D'?'\n\nThe clef at the start of the staff has been blanked out; the first thing you see on the staff is already a note (or a flat sign).':'')}]}]};
      const t=Date.now();
      const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},body:JSON.stringify(body)});
      const d=await r.json(); const ms=Date.now()-t;
      if(r.status!==200){ console.log('HTTP',r.status,JSON.stringify(d).slice(0,300)); process.exit(2); }
      const us=d.usage, usd=(us.input_tokens*PR[model][0]+us.output_tokens*PR[model][1])/1e6;
      led.usd+=usd; led.calls++; fs.writeFileSync(ledF,JSON.stringify(led)); u.i+=us.input_tokens;u.o+=us.output_tokens;u.usd+=usd;
      let g=''; if(d.stop_reason==='end_turn'){ try{ g=JSON.parse(d.content.filter(b=>b.type==='text').map(b=>b.text).join('')).gabc; }catch(e){} }
      lines.push(g.replace(/\s+/g,' ').trim()); log.push({system:k+1,stop_reason:d.stop_reason,usage:us,ms,usd:+usd.toFixed(5)});
      console.log(c,k+1,d.stop_reason,us.input_tokens+'/'+us.output_tokens,(ms/1000).toFixed(1)+'s','$'+usd.toFixed(4),'|',lines[k].slice(0,110));
    }
    const pieces=exp.pieces.map((p,i)=>i===0?{incipit:p.incipit,mode:p.mode,clef:p.clef,hasDropCap:p.hasDropCap,systems:lines}:{incipit:p.incipit,mode:p.mode,systems:new Array(p.systemCount||0).fill('')});
    const dir=`${REPO}/runs/${series}/${c}`; fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(dir+'/run-01.json',JSON.stringify({model,effort,pipeline:'Lesetest ausserhalb von Notator: sauber geschnittene Systeme, 1 Aufruf je System, strukturierte Ausgabe'+((variant==='C'||variant==='D')?', Schluessel ausgeblendet':'')+(variant==='B'||variant==='D'?', vergroessert mit Linealen und Hilfslinien':', Bild unveraendert')+'. Schluessel, Modus, Incipit und Stueckgrenzen aus dem Soll uebernommen (hier nicht gemessen).',case:c,pieces,usage:{input_tokens:u.i,output_tokens:u.o,costUsd:+u.usd.toFixed(4)},durationMs:Date.now()-t0},null,2)+'\n');
    fs.writeFileSync(`${REPO}/runs/${series}/_log-${c}.json`,JSON.stringify(log,null,2)+'\n');
    tot.usd+=u.usd;
  }
  console.log('Summe $'+tot.usd.toFixed(3),'| Ledger $'+led.usd.toFixed(3));
})();
