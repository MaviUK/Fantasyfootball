import { useEffect, useMemo, useState } from 'react'
import { BadgePoundSterling, CalendarDays, ChevronRight, CircleDollarSign, Clock3, Shield, Sparkles, Trophy, Users } from 'lucide-react'
import { hasSupabaseConfig, supabase } from './lib/supabase.js'

const fallbackAuctions = [
  { id: '1', name: 'Alexander Isak', club: 'Newcastle', position: 'ATT', rating: 88, price: 950000000, ends_at: null },
  { id: '2', name: 'Cole Palmer', club: 'Chelsea', position: 'MD', rating: 87, price: 900000000, ends_at: null },
  { id: '3', name: 'William Saliba', club: 'Arsenal', position: 'CD', rating: 86, price: 700000000, ends_at: null },
]

const money = (pence = 0) => `£${(Number(pence) / 100000000).toFixed(1)}m`

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-icon"><Icon size={20} /></div>
      <div><span>{label}</span><strong>{value}</strong>{sub && <small>{sub}</small>}</div>
    </div>
  )
}

function AuctionCard({ auction }) {
  return (
    <article className="auction-card">
      <div className="player-head">
        <div className="avatar">{auction.position || 'P'}</div>
        <div className="player-copy">
          <span className="eyebrow">Day 1 auction</span>
          <h3>{auction.name || 'Player card'}</h3>
          <p>{auction.club || 'Historical player'} · {auction.position || '—'} · Rating {auction.rating || '—'}</p>
        </div>
      </div>
      <div className="auction-price">
        <span>Current price</span>
        <strong>{money(auction.price ?? auction.current_price_pence ?? auction.reserve_price_pence)}</strong>
      </div>
      <button className="primary-btn">View auction <ChevronRight size={18} /></button>
    </article>
  )
}

export default function App() {
  const [season, setSeason] = useState(null)
  const [auctions, setAuctions] = useState(fallbackAuctions)
  const [loading, setLoading] = useState(hasSupabaseConfig)

  useEffect(() => {
    if (!supabase) return

    async function load() {
      setLoading(true)
      const [{ data: seasonRows }, { data: auctionRows }] = await Promise.all([
        supabase.from('game_seasons').select('id,name,season_number,status,starts_at,first_match_at').order('season_number', { ascending: false }).limit(1),
        supabase.from('auctions').select('id,current_price_pence,reserve_price_pence,ends_at,stage,status,player_seasons(id,game_position,overall_rating,players(name),clubs(name))').eq('stage', 1).order('current_price_pence', { ascending: false }).limit(6),
      ])

      if (seasonRows?.[0]) setSeason(seasonRows[0])
      if (auctionRows?.length) {
        setAuctions(auctionRows.map((row) => ({
          ...row,
          name: row.player_seasons?.players?.name,
          club: row.player_seasons?.clubs?.name,
          position: row.player_seasons?.game_position,
          rating: row.player_seasons?.overall_rating,
          price: row.current_price_pence ?? row.reserve_price_pence,
        })))
      }
      setLoading(false)
    }

    load()
  }, [])

  const seasonName = season?.name || 'Season 1'
  const statusText = season?.status || 'Auction phase'
  const auctionCount = useMemo(() => auctions.length, [auctions])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">FF</div><div><strong>Fantasy Football</strong><span>Own history. Build a dynasty.</span></div></div>
        <nav>
          <a className="active" href="#dashboard"><Trophy size={18} /> Dashboard</a>
          <a href="#auctions"><CircleDollarSign size={18} /> Auctions</a>
          <a href="#squad"><Users size={18} /> Squad</a>
          <a href="#fixtures"><CalendarDays size={18} /> Fixtures</a>
          <a href="#league"><Shield size={18} /> League</a>
        </nav>
        <div className="sidebar-note"><Sparkles size={18} /><div><strong>2025/26 player pool</strong><span>537 unique historical player cards</span></div></div>
      </aside>

      <main>
        <header className="topbar">
          <div><span className="eyebrow">Premier Division · {seasonName}</span><h1>Build your club</h1><p>One human manager. Nineteen AI rivals. £100m to build a 17-player squad.</p></div>
          <button className="ghost-btn">Create your club</button>
        </header>

        <section className="stats-grid">
          <StatCard icon={BadgePoundSterling} label="Starting budget" value="£100.0m" sub="17-player squad" />
          <StatCard icon={Users} label="League places" value="19 / 20" sub="Your place is reserved" />
          <StatCard icon={Clock3} label="Season status" value={statusText} sub="28-day season cycle" />
          <StatCard icon={CircleDollarSign} label="Day 1 cards" value={loading ? '…' : auctionCount} sub="Featured auctions" />
        </section>

        <section className="hero-panel" id="dashboard">
          <div>
            <span className="eyebrow">Your journey starts here</span>
            <h2>Create a club, enter the Premier Division, then attack the auction.</h2>
            <p>The first four days are staged auctions. Every choice matters: spend on stars early, or protect your budget and build depth later.</p>
            <div className="hero-actions"><button className="primary-btn">Create club <ChevronRight size={18} /></button><button className="secondary-btn">How the season works</button></div>
          </div>
          <div className="season-path">
            {['Create club', 'Auction Days 1–4', 'Fixed price', '38 league rounds', 'Playoffs & rollover'].map((item, index) => (
              <div className="path-row" key={item}><span>{index + 1}</span><div><strong>{item}</strong><small>{index === 0 ? 'Claim the 20th Premier Division place' : 'Season 1 progression'}</small></div></div>
            ))}
          </div>
        </section>

        <section className="section" id="auctions">
          <div className="section-head"><div><span className="eyebrow">Live market</span><h2>Day 1 auction board</h2></div><button className="text-btn">View all 135 Day 1 cards <ChevronRight size={17} /></button></div>
          <div className="auction-grid">{auctions.map((auction) => <AuctionCard key={auction.id} auction={auction} />)}</div>
        </section>

        {!hasSupabaseConfig && <div className="config-banner">Frontend foundation is running in preview mode. Add the Supabase URL and anon key to enable live Season 1 data.</div>}
      </main>
    </div>
  )
}
