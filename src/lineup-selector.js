function enhanceLineup(){
 const page=document.querySelector('.lineup-page'); if(!page||page.dataset.pitchSelector==='1')return;
 const pitch=page.querySelector('.football-pitch'),columns=page.querySelector('.lineup-columns'),available=page.querySelector('.available-section'); if(!pitch||!columns||!available)return;
 page.dataset.pitchSelector='1'; page.classList.add('pitch-first-lineup');
 const toolbar=document.createElement('div'); toolbar.className='team-picker-toolbar'; toolbar.innerHTML='<div><b>Pick your XI on the pitch</b><small>Tap any player to replace them</small></div><button type="button" class="open-squad">Squad</button>';
 pitch.parentElement.insertBefore(toolbar,pitch);
 const sheet=document.createElement('div'); sheet.className='squad-picker-sheet'; sheet.innerHTML='<button type="button" class="sheet-backdrop" aria-label="Close squad"></button><section><header><div><b>Select player</b><small>Choose Start or Bench</small></div><button type="button" class="sheet-close">×</button></header><div class="sheet-content"></div></section>';
 document.body.appendChild(sheet); sheet.querySelector('.sheet-content').appendChild(available);
 const xiCol=columns.querySelectorAll('.lineup-column')[0]; if(xiCol)xiCol.classList.add('xi-management');
 const rows=()=>[...sheet.querySelectorAll('.available-lineup-list .lineup-player')];
 const filter=(pos)=>{rows().forEach(row=>{const p=row.querySelector('.avatar')?.textContent?.trim();row.style.display=pos&&p!==pos?'none':''})};
 const normalise=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
 const rowName=row=>normalise(row?.querySelector('strong')?.textContent);
 const findStarterRow=(pos,playerName)=>{
   const wanted=normalise(playerName);
   return [...(xiCol?.querySelectorAll('.lineup-player')||[])].find(row=>{
     const rowPos=row.querySelector('.avatar')?.textContent?.trim();
     const current=rowName(row);
     return rowPos===pos&&(current===wanted||current.endsWith(wanted)||wanted.endsWith(current));
   });
 };
 const findAvailableRow=(pos,playerName)=>{
   const wanted=normalise(playerName);
   return rows().find(row=>{
     const rowPos=row.querySelector('.avatar')?.textContent?.trim();
     const current=rowName(row);
     return rowPos===pos&&(current===wanted||current.endsWith(wanted)||wanted.endsWith(current));
   });
 };
 const open=(pos='',playerName='')=>{sheet.dataset.position=pos;sheet.dataset.playerName=playerName;filter(pos);sheet.querySelector('header b').textContent=pos?`Replace ${pos} player`:'Select player';sheet.querySelector('header small').textContent=pos?`Only ${pos} players are eligible`:'Choose Start or Bench';sheet.classList.add('open');document.body.classList.add('picker-open')};
 const close=()=>{sheet.classList.remove('open');document.body.classList.remove('picker-open');sheet.dataset.position='';sheet.dataset.playerName='';filter('')};
 toolbar.querySelector('.open-squad').onclick=()=>open(); sheet.querySelector('.sheet-close').onclick=close; sheet.querySelector('.sheet-backdrop').onclick=close;
 pitch.addEventListener('click',e=>{const card=e.target.closest('.pitch-player.filled');if(!card)return;const pos=card.querySelector('span')?.textContent?.trim();const playerName=card.querySelector('strong')?.textContent?.trim()||'';open(pos,playerName)});
 sheet.addEventListener('click',e=>{
   const start=e.target.closest('.lineup-actions button:first-child');
   if(!start)return;
   if(sheet.dataset.swapBypass==='1'){sheet.dataset.swapBypass='';setTimeout(close,80);return}
   const pos=sheet.dataset.position||'',outgoingName=sheet.dataset.playerName||'';
   if(!pos||!outgoingName){setTimeout(close,80);return}
   const chosenRow=start.closest('.lineup-player'),chosenName=chosenRow?.querySelector('strong')?.textContent?.trim()||'';
   const outgoing=findStarterRow(pos,outgoingName),removeButton=outgoing?.querySelector('.lineup-remove');
   if(!removeButton||!chosenName){return}
   e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
   removeButton.click();
   let tries=0;
   const completeSwap=()=>{
     tries++;
     const freshRow=findAvailableRow(pos,chosenName);
     const freshStart=freshRow?.querySelector('.lineup-actions button:first-child');
     if(freshStart){sheet.dataset.swapBypass='1';freshStart.click();return}
     if(tries<12)setTimeout(completeSwap,50);else sheet.dataset.swapBypass='';
   };
   setTimeout(completeSwap,40);
 },true);
 const benchCol=columns.querySelectorAll('.lineup-column')[1]; if(benchCol){benchCol.classList.add('bench-strip');const head=benchCol.querySelector('.lineup-column-head');if(head){const b=document.createElement('button');b.type='button';b.className='bench-add';b.textContent='+ Add substitute';b.onclick=()=>open();head.appendChild(b)}}
 const obs=new MutationObserver(()=>{if(!document.body.contains(page)){sheet.remove();obs.disconnect();return} if(sheet.classList.contains('open'))filter(sheet.dataset.position||'')});obs.observe(page,{childList:true,subtree:true});
}
new MutationObserver(enhanceLineup).observe(document.documentElement,{childList:true,subtree:true});
enhanceLineup();
