function enhanceLineup(){
 const page=document.querySelector('.lineup-page'); if(!page||page.dataset.pitchSelector==='1')return;
 const pitch=page.querySelector('.football-pitch'),columns=page.querySelector('.lineup-columns'),available=page.querySelector('.available-section'); if(!pitch||!columns||!available)return;
 page.dataset.pitchSelector='1'; page.classList.add('pitch-first-lineup');
 const toolbar=document.createElement('div'); toolbar.className='team-picker-toolbar'; toolbar.innerHTML='<div><b>Pick your XI on the pitch</b><small>Tap any player to replace them</small></div><button type="button" class="open-squad">Squad</button>';
 pitch.parentElement.insertBefore(toolbar,pitch);
 const sheet=document.createElement('div'); sheet.className='squad-picker-sheet'; sheet.innerHTML='<button type="button" class="sheet-backdrop" aria-label="Close squad"></button><section><header><div><b>Select player</b><small>Choose Start or Bench</small></div><button type="button" class="sheet-close">×</button></header><div class="sheet-content"></div></section>';
 document.body.appendChild(sheet); sheet.querySelector('.sheet-content').appendChild(available);
 const open=(pos='')=>{sheet.classList.add('open');document.body.classList.add('picker-open');sheet.dataset.position=pos;const title=sheet.querySelector('header b');title.textContent=pos?`Replace ${pos} player`:'Select player'; filter(pos)};
 const close=()=>{sheet.classList.remove('open');document.body.classList.remove('picker-open');sheet.dataset.position='';filter('')};
 const filter=(pos)=>{sheet.querySelectorAll('.available-lineup-list .lineup-player').forEach(row=>{const p=row.querySelector('.avatar')?.textContent?.trim();row.hidden=!!pos&&p!==pos})};
 toolbar.querySelector('.open-squad').onclick=()=>open(); sheet.querySelector('.sheet-close').onclick=close; sheet.querySelector('.sheet-backdrop').onclick=close;
 pitch.addEventListener('click',e=>{const card=e.target.closest('.pitch-player.filled');if(!card)return;const pos=card.querySelector('span')?.textContent?.trim();open(pos)});
 sheet.addEventListener('click',e=>{const start=e.target.closest('.lineup-actions button:first-child');if(start)setTimeout(close,80)});
 const benchCol=columns.querySelectorAll('.lineup-column')[1]; if(benchCol){benchCol.classList.add('bench-strip');const head=benchCol.querySelector('.lineup-column-head');if(head){const b=document.createElement('button');b.type='button';b.className='bench-add';b.textContent='+ Add substitute';b.onclick=()=>open();head.appendChild(b)}}
 const xiCol=columns.querySelectorAll('.lineup-column')[0]; if(xiCol)xiCol.classList.add('xi-management');
 const obs=new MutationObserver(()=>{if(!document.body.contains(page)){sheet.remove();obs.disconnect();return} if(sheet.classList.contains('open'))filter(sheet.dataset.position||'')});obs.observe(page,{childList:true,subtree:true});
}
new MutationObserver(enhanceLineup).observe(document.documentElement,{childList:true,subtree:true});
enhanceLineup();
