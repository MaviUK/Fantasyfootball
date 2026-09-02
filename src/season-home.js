import { supabase } from './lib/supabase.js'

let loading = false
let cache = null
let cacheAt = 0

const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))
const dateLabel = (value) => value ? new Date(value).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}) : 'TBA'
const timeLabel = (value) => value ? new Date(value).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : ''

async function loadData(){
  if(cache && Date.now()-cacheAt < 30000) return cache
  const [stateRes,fixturesRes,tableRes] = await Promise.all([
    supabase.rpc('get_my_game_state'),
    supabase.rpc('get_my_fixtures'),
    supabase.rpc('get_my_league_table'),
  ])
  if(stateRes.error) throw stateRes.error
  cache={state:stateRes.data,fixtures:fixturesRes.data||[],table:tableRes.data||{standings:[]}}
  cacheAt=Date.now()
  return cache
}

function resultScore(f){
  if(f.home_goals == null || f.away_goals == null) return ''
  return `${f.home_goals}–${f.away_goals}`
}

function renderDashboard(data){
  const host=document.querySelector('.club-hero')
  if(!host || host.dataset.seasonDashboard==='1') return
  const season=data.state?.season
  if(!season || season.status!=='active') return

  const club=data.state?.club
  const fixtures=[...(data.fixtures||[])].sort((a,b)=>new Date(a.scheduled_at)-new Date(b.scheduled_at))
  const now=Date.now()
  const next=fixtures.find(f=>f.status!=='completed' && f.status!=='simulated' && new Date(f.scheduled_at).getTime()>=now) || fixtures.find(f=>f.home_goals==null)
  const completed=fixtures.filter(f=>f.home_goals!=null && f.away_goals!=null)
  const recent=completed.slice(-5).reverse()
  const upcoming=fixtures.filter(f=>f.home_goals==null && (!next || f.id!==next.id)).slice(0,4)
  const standings=data.table?.standings||[]
  const me=standings.find(r=>r.is_my_club)

  host.dataset.seasonDashboard='1'
  host.classList.add('season-dashboard-hero')
  host.innerHTML=`
    <div class="season-next-match">
      <span class="eyebrow">Next fixture</span>
      <div class="season-fixture-line">
        <div><small>${esc(next?.venue==='home'?'HOME':'AWAY')}</small><strong>${esc(next?.opponent_name||'Fixture pending')}</strong></div>
        <div class="season-kickoff"><b>${esc(dateLabel(next?.scheduled_at))}</b><span>${esc(timeLabel(next?.scheduled_at))}</span></div>
      </div>
      <div class="season-deadline">Lineup deadline: <strong>${esc(next?.deadline_at ? `${dateLabel(next.deadline_at)} ${timeLabel(next.deadline_at)}` : 'TBA')}</strong>${next?.has_lineup?' · Lineup saved':' · Lineup not yet saved'}</div>
    </div>
    <div class="season-position-card">
      <span>League position</span>
      <strong>${me ? `${me.position}${me.position===1?'st':me.position===2?'nd':me.position===3?'rd':'th'}` : '—'}</strong>
      <small>${esc(data.table?.league?.name||'Premier Division')}</small>
    </div>`

  const grid=host.nextElementSibling
  if(grid?.classList.contains('dashboard-grid')){
    grid.classList.add('season-dashboard-grid')
    grid.innerHTML=`
      <article class="dashboard-card season-record-card"><span class="eyebrow">Season record</span><div class="record-strip"><div><strong>${me?.played||0}</strong><span>PLD</span></div><div><strong>${me?.won||0}</strong><span>W</span></div><div><strong>${me?.drawn||0}</strong><span>D</span></div><div><strong>${me?.lost||0}</strong><span>L</span></div><div><strong>${me?.points||0}</strong><span>PTS</span></div></div></article>
      <article class="dashboard-card"><span class="eyebrow">Goal difference</span><h3>${me ? (Number(me.goal_difference)>0?'+':'')+me.goal_difference : '0'}</h3><p>${me?.goals_for||0} scored · ${me?.goals_against||0} conceded</p></article>`
  }

  const oldSection=grid?.nextElementSibling
  if(oldSection?.classList.contains('section')){
    oldSection.classList.add('season-overview-section')
    oldSection.innerHTML=`
      <div class="season-overview-columns">
        <section class="season-panel"><div class="season-panel-head"><span class="eyebrow">Recent form</span><h2>Latest results</h2></div><div class="season-match-list">${recent.length?recent.map(f=>`<div><b class="form-${esc(f.result||'D')}">${esc(f.result||'D')}</b><span>${esc(f.opponent_name)}</span><strong>${esc(resultScore(f))}</strong></div>`).join(''):'<p class="season-empty">No results yet.</p>'}</div></section>
        <section class="season-panel"><div class="season-panel-head"><span class="eyebrow">Schedule</span><h2>Upcoming fixtures</h2></div><div class="season-match-list">${upcoming.length?upcoming.map(f=>`<div><small>${esc(dateLabel(f.scheduled_at))}</small><span>${esc(f.opponent_name)}</span><strong>${esc(f.venue==='home'?'H':'A')}</strong></div>`).join(''):'<p class="season-empty">No upcoming fixtures.</p>'}</div></section>
      </div>`
  }
}

async function enhance(){
  if(loading || !document.querySelector('.club-hero')) return
  loading=true
  try{ renderDashboard(await loadData()) }catch(e){ console.warn('Season dashboard unavailable',e) }finally{ loading=false }
}

const observer=new MutationObserver(()=>enhance())
observer.observe(document.documentElement,{childList:true,subtree:true})
setTimeout(enhance,0)
