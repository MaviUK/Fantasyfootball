import { supabase } from './lib/supabase.js'
import './live-match.css'

let currentFixture=null, timer=null, loading=false
const esc=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const label=(e)=>({goal:'GOAL!',save:'Save',shot:'Shot',foul:'Foul',yellow:'Yellow card',yellow_card:'Yellow card',red:'Red card',red_card:'Red card',injury:'Injury',substitution:'Substitution',half_time:'Half time',full_time:'Full time',kickoff:'Kick off'}[e]||String(e||'Match event').replaceAll('_',' '))

async function renderLive(){
 if(!currentFixture)return
 const {data,error}=await supabase.rpc('get_live_match_centre',{p_fixture_id:currentFixture})
 const root=document.querySelector('.live-match-overlay');if(!root)return
 if(error){root.innerHTML=`<div class="live-match-shell"><button class="live-close">×</button><div class="live-panel">${esc(error.message)}</div></div>`;root.querySelector('button').onclick=closeLive;return}
 const f=data.fixture,m=data.simulation,events=data.events||[],minute=Number(data.live_minute||0),pct=Math.min(100,minute/90*100)
 if(!m){root.innerHTML=`<div class="live-match-shell"><div class="live-match-top"><span class="live-pill">Preparing match</span><button class="live-close">×</button></div><div class="live-score"><strong>${esc(f.home_club_name)}</strong><b>0–0</b><strong>${esc(f.away_club_name)}</strong></div><div class="live-clock">${minute}'</div><p class="live-ft">The match engine is preparing the fixed simulation. This screen will update automatically.</p></div>`;root.querySelector('button').onclick=closeLive;return}
 const stats=[['Possession',m.home_possession,m.away_possession,'%'],['Shots',m.home_shots,m.away_shots,''],['On target',m.home_shots_on_target,m.away_shots_on_target,''],['xG',m.home_xg,m.away_xg,''],['Corners',m.home_corners,m.away_corners,''],['Fouls',m.home_fouls,m.away_fouls,'']]
 root.innerHTML=`<div class="live-match-shell"><div class="live-match-top"><span class="live-pill">${data.is_live?'● LIVE':'FULL TIME'} · Round ${f.round_number}</span><button class="live-close" aria-label="Close">×</button></div><div class="live-score"><strong>${esc(f.home_club_name)}</strong><b>${m.home_goals}–${m.away_goals}</b><strong>${esc(f.away_club_name)}</strong></div><div class="live-clock">${data.is_live?minute+"'":'FT'}</div><div class="live-progress"><i style="width:${pct}%"></i></div><div class="live-grid"><section class="live-panel"><h3>Live match stats</h3>${stats.map(x=>`<div class="live-stat"><strong>${x[1]??0}${x[3]}</strong><span>${x[0]}</span><strong>${x[2]??0}${x[3]}</strong></div>`).join('')}</section><section class="live-panel"><h3>Commentary</h3>${events.length?events.slice().reverse().map(e=>`<div class="live-event"><b>${e.minute}'</b><div><strong>${esc(label(e.event_type))}</strong><small>${esc(e.player_name||'Team event')}${e.related_player_name?' · '+esc(e.related_player_name):''}</small></div></div>`).join(''):'<div class="live-empty">The match is underway. Key events will appear here.</div>'}</section></div><p class="live-ft">${data.is_live?'The result is already fixed by the match engine and is being revealed over 10 real-time minutes.':'Match complete. The final result and statistics are now available.'}</p></div>`
 root.querySelector('.live-close').onclick=closeLive
}
function closeLive(){currentFixture=null;clearInterval(timer);timer=null;document.querySelector('.live-match-overlay')?.remove()}
async function openLive(id){currentFixture=id;document.body.insertAdjacentHTML('beforeend','<div class="live-match-overlay"><div class="live-match-shell"><div class="live-panel">Loading live match…</div></div></div>');await renderLive();timer=setInterval(renderLive,5000)}

async function install(){
 if(loading||document.querySelector('.live-watch-btn'))return;loading=true
 const {data}=await supabase.rpc('get_my_fixtures');loading=false;if(!data?.length)return
 const now=Date.now(),live=data.find(f=>{const k=new Date(f.scheduled_at).getTime();return now>=k&&now<k+600000})
 if(!live)return
 const target=document.querySelector('.next-fixture-copy')||document.querySelector('.season-next-copy')||document.querySelector('.club-hero>div')
 if(!target)return
 const b=document.createElement('button');b.className='live-watch-btn';b.textContent='Watch Live';b.onclick=()=>openLive(live.id);target.appendChild(b)
}
const observer=new MutationObserver(()=>install());observer.observe(document.documentElement,{childList:true,subtree:true});setInterval(install,10000);install()
