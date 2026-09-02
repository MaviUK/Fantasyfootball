import { supabase } from './lib/supabase.js'

const fmt = (d) => new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(d))
let modal

function eventText(e){const p=e.player_name?` · ${e.player_name}`:'';return `${e.minute}′ ${String(e.event_type||'event').replaceAll('_',' ')}${p}`}
function playerRows(players,type){const rows=(players||[]).filter(p=>p.slot_type===type);return rows.length?rows.map(p=>`<div class="league-lineup-player"><span class="league-pos">${p.game_position||'—'}</span><strong>${p.player_name}</strong><small>${p.season_label||''} · ${Math.round(Number(p.overall_rating||0))}</small></div>`).join(''):'<p class="league-lineup-empty">No players available.</p>'}
function lineupCard(club){return `<section class="league-lineup-club"><h4>${club.name}</h4><h5>Starting XI</h5><div class="league-lineup-list">${playerRows(club.players,'starter')}</div><h5>Substitutes</h5><div class="league-lineup-list subs">${playerRows(club.players,'bench')}</div></section>`}
async function loadLineups(id,container){container.innerHTML='<p>Loading lineups…</p>';const {data,error}=await supabase.rpc('get_league_fixture_lineups',{p_fixture_id:id});if(error){container.innerHTML=`<p>${error.message}</p>`;return}container.innerHTML=`<div class="league-lineups">${lineupCard(data.home_club)}${lineupCard(data.away_club)}</div>`}
async function openCentre(id){
  const {data,error}=await supabase.rpc('get_league_match_centre',{p_fixture_id:id});
  if(error)return alert(error.message);
  const f=data.fixture,s=data.simulation,ev=data.events||[];
  modal.querySelector('.league-browser-body').innerHTML=`<button class="league-back">← All matches</button><div class="league-centre"><small>${data.is_live?`LIVE · ${data.live_minute}′`:'FULL TIME'} · ROUND ${f.round_number}</small><h2>${f.home_club_name} <b>${s?`${s.home_goals} – ${s.away_goals}`:'–'}</b> ${f.away_club_name}</h2><div class="league-centre-tabs"><button class="active" data-tab="match">Match</button><button data-tab="lineups">Lineups</button></div><div class="league-tab-panel" data-panel="match">${s?`<div class="league-stats"><span>${s.home_possession}% <b>Possession</b> ${s.away_possession}%</span><span>${s.home_shots} <b>Shots</b> ${s.away_shots}</span><span>${s.home_shots_on_target} <b>On target</b> ${s.away_shots_on_target}</span><span>${s.home_xg} <b>xG</b> ${s.away_xg}</span><span>${s.home_fouls} <b>Fouls</b> ${s.away_fouls}</span></div>`:'<p>Simulation is not available yet.</p>'}<h3>Match timeline</h3><div class="league-events">${ev.length?ev.map(e=>`<div>${eventText(e)}</div>`).join(''):'<p>No events to show.</p>'}</div></div><div class="league-tab-panel" data-panel="lineups" hidden></div></div>`;
  modal.querySelector('.league-back').onclick=loadMatches;
  const tabs=[...modal.querySelectorAll('.league-centre-tabs button')];tabs.forEach(btn=>btn.onclick=()=>{tabs.forEach(x=>x.classList.toggle('active',x===btn));modal.querySelectorAll('.league-tab-panel').forEach(p=>p.hidden=p.dataset.panel!==btn.dataset.tab);if(btn.dataset.tab==='lineups'){const panel=modal.querySelector('[data-panel="lineups"]');if(!panel.dataset.loaded){panel.dataset.loaded='1';loadLineups(id,panel)}}});
}
async function loadMatches(){
  const body=modal.querySelector('.league-browser-body');body.innerHTML='<p>Loading league matches…</p>';
  const {data,error}=await supabase.rpc('get_my_league_fixtures');if(error){body.innerHTML=`<p>${error.message}</p>`;return}
  const groups=(data||[]).reduce((a,f)=>((a[f.round_number]??=[]).push(f),a),{});
  body.innerHTML=Object.entries(groups).map(([round,fs])=>`<section class="league-round"><h3>Round ${round}</h3>${fs.map(f=>`<button class="league-game${f.is_my_match?' mine':''}" data-id="${f.id}"><span>${fmt(f.scheduled_at)}</span><strong>${f.home_club_name}</strong><b>${f.is_live?'LIVE':f.home_goals==null?'v':`${f.home_goals} – ${f.away_goals}`}</b><strong>${f.away_club_name}</strong><em>${f.is_live?'Watch live':f.home_goals==null?'Upcoming':'Match report'} →</em></button>`).join('')}</section>`).join('');
  body.querySelectorAll('.league-game').forEach(b=>b.onclick=()=>openCentre(b.dataset.id));
}
function openBrowser(){
  if(!modal){modal=document.createElement('div');modal.className='league-browser-backdrop';modal.innerHTML='<div class="league-browser"><button class="league-browser-close">×</button><header><small>PREMIER DIVISION</small><h2>League Matches</h2><p>Every fixture, live match and result.</p></header><div class="league-browser-body"></div></div>';document.body.append(modal);modal.querySelector('.league-browser-close').onclick=()=>modal.remove(),modal.addEventListener('click',e=>{if(e.target===modal)modal.remove()})}
  document.body.append(modal);loadMatches();
}
function install(){
  const nav=document.querySelector('.side-nav, nav');if(!nav||nav.querySelector('.all-league-matches-btn'))return;
  const b=document.createElement('button');b.className='all-league-matches-btn';b.textContent='League Matches';b.onclick=openBrowser;nav.append(b);
}
new MutationObserver(install).observe(document.documentElement,{childList:true,subtree:true});install();
