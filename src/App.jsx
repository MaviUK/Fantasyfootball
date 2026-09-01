import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./lib/supabase.js";

const money = (p) => `£${(Number(p || 0) / 100000000).toFixed(1)}m`;
const name = (a) => a.player_seasons?.players?.full_name || "Player";
const position = (a) => a.player_seasons?.game_position || "—";
const left = (date) => {
  if (!date) return "Starts after first bid";
  const seconds = Math.max(0, Math.floor((new Date(date) - Date.now()) / 1000));
  if (!seconds) return "Ended";
  return seconds >= 3600
    ? `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

function AuthScreen() {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function auth(mode) {
    setBusy(true);
    setMessage("");
    const result =
      mode === "signup"
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
    setMessage(
      result.error?.message ||
        (mode === "signup"
          ? "Account created. Check your email if required."
          : "Signed in."),
    );
    setBusy(false);
  }
  return (
    <div className="app-shell single-screen">
      <main>
        <section className="hero-panel auth-panel">
          <div>
            <span className="eyebrow">Manager account</span>
            <h1>Enter Fantasy Football</h1>
            <p>
              Build a club from unique player-season cards and compete across
              the history of English football.
            </p>
            <div className="form-stack">
              <label>
                Email
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  minLength="6"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            </div>
            <div className="hero-actions">
              <button
                className="primary-btn"
                disabled={busy || !email || password.length < 6}
                onClick={() => auth("signin")}
              >
                {busy ? "Please wait…" : "Sign in"}
              </button>
              <button
                className="secondary-btn"
                disabled={busy || !email || password.length < 6}
                onClick={() => auth("signup")}
              >
                Create account
              </button>
            </div>
          </div>
        </section>
        {message && <div className="config-banner">{message}</div>}
      </main>
    </div>
  );
}

function ClubSetup({ onCreated }) {
  const [clubName, setClubName] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function createClub(e) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc("create_my_game_club", {
      p_name: clubName.trim(),
    });
    setMessage(
      error?.message || "Club created — welcome to the Premier Division.",
    );
    setBusy(false);
    if (!error) await onCreated();
  }
  return (
    <div className="app-shell single-screen">
      <main>
        <section className="hero-panel auth-panel">
          <form onSubmit={createClub}>
            <span className="eyebrow">Club creation</span>
            <h1>Name your club</h1>
            <p>
              This is the name other managers will see in auctions, fixtures and
              league tables.
            </p>
            <div className="form-stack">
              <label>
                Club name
                <input
                  required
                  minLength="2"
                  maxLength="40"
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  placeholder="e.g. Gavin Athletic"
                />
              </label>
            </div>
            <button className="primary-btn" disabled={busy}>
              {busy ? "Creating…" : "Create club"}
            </button>
          </form>
        </section>
        {message && <div className="config-banner">{message}</div>}
      </main>
    </div>
  );
}

function AuctionCard({
  auction: a,
  clubId,
  value,
  setValue,
  placeBid,
  busy,
  open,
  history,
  toggleHistory,
  watched,
  toggleWatch,
  availablePence,
}) {
  const p = a.player_seasons,
    leading = a.current_winner_club_id === clubId,
    ended =
      a.status === "ended" || (a.ends_at && new Date(a.ends_at) <= new Date());
  const minimum = a.current_winner_club_id
    ? Number(a.current_price_pence) + Number(a.min_increment_pence)
    : Number(a.reserve_price_pence);
  const proposed = value === "" ? minimum : Math.round(Number(value) * 100);
  const maximum = Number(availablePence) + (leading ? Number(a.current_price_pence || 0) : 0);
  const belowMinimum = value !== "" && proposed < minimum;
  const overBudget = proposed > maximum;
  const invalid = belowMinimum || overBudget;
  const quickBid = increase => setValue(String(Math.max(minimum, Number(a.current_price_pence || a.reserve_price_pence) + increase) / 100));
  return (
    <article
      className={`auction-card${leading ? " is-winning" : ""}${ended ? " is-ended" : ""}`}
    >
      <button
        className={`watch-btn${watched ? " active" : ""}`}
        onClick={toggleWatch}
        aria-label={`${watched ? "Remove" : "Add"} ${name(a)} ${watched ? "from" : "to"} watchlist`}
        title={watched ? "Remove from watchlist" : "Add to watchlist"}
      >
        {watched ? "★" : "☆"}
      </button>
      <div className="player-head">
        <div className="avatar">{position(a)}</div>
        <div className="player-copy">
          <span className="eyebrow">
            {leading
              ? "● You are winning"
              : ended
                ? "Auction ended"
                : watched
                  ? "★ Watching"
                  : "Day 1"}
          </span>
          <h3>{name(a)}</h3>
          <p>
            {p?.clubs?.name} · {position(a)} · Rating {p?.overall_rating || "—"}
          </p>
        </div>
      </div>
      <div className="auction-price">
        <div>
          <span>Current price</span>
          <strong>
            {money(a.current_price_pence || a.reserve_price_pence)}
          </strong>
        </div>
        <small className={`timer${ended ? " ended" : ""}`}>
          {left(a.ends_at)}
        </small>
      </div>
      <label className="bid-label">
        Your bid
        <input
          aria-label={`Bid for ${name(a)}`}
          type="number"
          step="10000"
          min={minimum / 100}
          disabled={ended || a.status !== "live"}
          placeholder={`Minimum £${(minimum / 100).toLocaleString()}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <div className="quick-bids"><span>Quick bid</span><button type="button" disabled={ended || a.status !== "live"} onClick={() => quickBid(50000000)}>+£0.5m</button><button type="button" disabled={ended || a.status !== "live"} onClick={() => quickBid(100000000)}>+£1m</button><button type="button" disabled={ended || a.status !== "live"} onClick={() => setValue(String(minimum / 100))}>Minimum</button></div>
      {belowMinimum && (
        <small className="field-error">Minimum bid is {money(minimum)}</small>
      )}
      {overBudget && <small className="field-error">Your maximum available bid is {money(maximum)}</small>}
      <div className="hero-actions">
        <button
          className="primary-btn"
          disabled={busy || invalid || ended || a.status !== "live"}
          onClick={placeBid}
        >
          {busy
            ? "Placing…"
            : a.status === "live" && !ended
              ? "Place bid"
              : ended
                ? "Auction ended"
                : "Not live yet"}
        </button>
        <button className="secondary-btn" onClick={toggleHistory}>
          {open ? "Hide history" : "Bid history"}
        </button>
      </div>
      {open && (
        <div className="bid-history">
          <strong>Recent bids</strong>
          {history.length ? (
            history.slice(0, 6).map((h, i) => (
              <div key={`${h.created_at || i}-${h.amount_pence}`}>
                <span>
                  {h.is_my_bid
                    ? "Your bid"
                    : h.bid_type === "ai"
                      ? "AI manager"
                      : "Other manager"}
                  {h.is_current_winner ? " · leading" : ""}
                </span>
                <b>{money(h.amount_pence)}</b>
              </div>
            ))
          ) : (
            <p>No bids yet.</p>
          )}
        </div>
      )}
    </article>
  );
}

function ClubHome({ season, club, auctions, onOpenAuctions }) {
  const winning = auctions.filter((a) => a.current_winner_club_id === club.id);
  const positions = ["GK", "DEF", "MID", "FWD"].map((label) => ({
    label,
    count: winning.filter((a) => position(a) === label).length,
  }));
  const committed = Number(club.reserved_pence || 0);
  const budget = Number(club.budget_pence || 0);
  const commitmentPercent = budget
    ? Math.min(100, Math.round((committed / budget) * 100))
    : 0;
  const nextEvent = season?.first_match_at || season?.starts_at;

  return (
    <>
      <section className="club-hero">
        <div>
          <span className="eyebrow">Club headquarters</span>
          <h2>Your season starts here</h2>
          <p>
            Build a balanced 17-player squad before the first match deadline.
            Each player-season card is unique, so once another club owns it, it
            is gone.
          </p>
          <button className="primary-btn" onClick={onOpenAuctions}>
            Enter auction room
          </button>
        </div>
        <div className="deadline-card">
          <span>First match</span>
          <strong>
            {nextEvent
              ? new Date(nextEvent).toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })
              : "To be announced"}
          </strong>
          <small>
            {nextEvent
              ? new Date(nextEvent).toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Fixture time pending"}
          </small>
        </div>
      </section>
      <section className="dashboard-grid">
        <article className="dashboard-card">
          <span className="eyebrow">Auction progress</span>
          <h3>
            {winning.length} potential signing{winning.length === 1 ? "" : "s"}
          </h3>
          <p>Players you currently lead the bidding for.</p>
          <div className="position-balance">
            {positions.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </article>
        <article className="dashboard-card">
          <span className="eyebrow">Budget control</span>
          <h3>{money(budget - committed)} available</h3>
          <p>{money(committed)} is currently committed to leading bids.</p>
          <div className="budget-track">
            <span style={{ width: `${commitmentPercent}%` }} />
          </div>
          <small>{commitmentPercent}% of budget committed</small>
        </article>
      </section>
      <section className="section">
        <div className="section-head">
          <div>
            <span className="eyebrow">Current targets</span>
            <h2>Winning bids</h2>
          </div>
          <button className="text-btn" onClick={onOpenAuctions}>
            View all auctions →
          </button>
        </div>
        {winning.length ? (
          <div className="target-list">
            {winning.slice(0, 5).map((a) => (
              <div key={a.id}>
                <span className="mini-position">{position(a)}</span>
                <div>
                  <strong>{name(a)}</strong>
                  <small>
                    {a.player_seasons?.clubs?.name} · Rating{" "}
                    {a.player_seasons?.overall_rating || "—"}
                  </small>
                </div>
                <b>{money(a.current_price_pence || a.reserve_price_pence)}</b>
                <span className="timer">{left(a.ends_at)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>You are not leading any auctions yet.</strong>
            <span>Enter the auction room to begin building your squad.</span>
            <button className="primary-btn" onClick={onOpenAuctions}>
              Browse players
            </button>
          </div>
        )}
      </section>
    </>
  );
}

function ProvisionalSquad({ club, auctions, onOpenAuctions }) {
  const players = auctions.filter(a => a.current_winner_club_id === club.id)
  const goalkeepers = players.filter(a => position(a) === "GK")
  const outfield = players.filter(a => position(a) !== "GK")
  const totalCost = players.reduce((sum, a) => sum + Number(a.current_price_pence || a.reserve_price_pence || 0), 0)
  const slots = [
    { label: "Goalkeepers", players: goalkeepers, required: 2 },
    { label: "Outfield players", players: outfield, required: 15 },
  ]

  return <section className="squad-page"><div className="squad-heading"><div><span className="eyebrow">Provisional squad</span><h2>Build your 17</h2><p>These are players you currently lead the bidding for. They only become permanent squad members when their auctions close.</p></div><button className="primary-btn" onClick={onOpenAuctions}>Find players</button></div><div className="squad-progress"><div><span>Total players</span><strong>{players.length}<small>/17</small></strong><div className="squad-track"><i style={{ width: `${Math.min(100, players.length / 17 * 100)}%` }} /></div></div><div><span>Goalkeepers</span><strong>{goalkeepers.length}<small>/2</small></strong><div className="squad-track"><i style={{ width: `${Math.min(100, goalkeepers.length / 2 * 100)}%` }} /></div></div><div><span>Outfield</span><strong>{outfield.length}<small>/15</small></strong><div className="squad-track"><i style={{ width: `${Math.min(100, outfield.length / 15 * 100)}%` }} /></div></div><div><span>Provisional cost</span><strong>{money(totalCost)}</strong><small>Current leading bids</small></div></div>{slots.map(group => <div className="squad-group" key={group.label}><div className="section-head"><div><span className="eyebrow">{group.players.length} of {group.required}</span><h3>{group.label}</h3></div></div><div className="squad-list">{group.players.map(a => <article key={a.id}><div className="avatar">{position(a)}</div><div className="squad-player"><strong>{name(a)}</strong><span>{a.player_seasons?.clubs?.name} · Rating {a.player_seasons?.overall_rating || "—"}</span></div><div className="squad-bid"><span>Leading bid</span><strong>{money(a.current_price_pence || a.reserve_price_pence)}</strong></div><div className="provisional-badge">Provisional</div></article>)}{Array.from({ length: Math.max(0, group.required - group.players.length) }, (_, index) => <button className="empty-squad-slot" key={`empty-${index}`} onClick={onOpenAuctions}><span>+</span><div><strong>Empty slot</strong><small>Find a {group.label === "Goalkeepers" ? "goalkeeper" : "player"}</small></div></button>)}</div></div>)}</section>
}

function LineupPlanner({ club, season, auctions, onOpenAuctions }) {
  const players = auctions.filter(a => a.current_winner_club_id === club.id)
  const [starters, setStarters] = useState(() => { try { return JSON.parse(localStorage.getItem("fantasy-lineup-starters") || "[]") } catch { return [] } })
  const [bench, setBench] = useState(() => { try { return JSON.parse(localStorage.getItem("fantasy-lineup-bench") || "[]") } catch { return [] } })
  const [lineupMessage, setLineupMessage] = useState("")
  const playerIds = players.map(a => a.id)
  const startingPlayers = starters.map(id => players.find(a => a.id === id)).filter(Boolean)
  const benchPlayers = bench.map(id => players.find(a => a.id === id)).filter(Boolean)
  const availablePlayers = players.filter(a => !starters.includes(a.id) && !bench.includes(a.id))
  const startGoalkeepers = startingPlayers.filter(a => position(a) === "GK").length
  const startOutfield = startingPlayers.length - startGoalkeepers
  const benchGoalkeepers = benchPlayers.filter(a => position(a) === "GK").length
  const benchOutfield = benchPlayers.length - benchGoalkeepers
  const lineupComplete = startingPlayers.length === 11 && startGoalkeepers === 1 && benchPlayers.length === 6 && benchGoalkeepers === 1

  useEffect(() => { const validStarters = starters.filter(id => playerIds.includes(id)), validBench = bench.filter(id => playerIds.includes(id)); if (validStarters.length !== starters.length) setStarters(validStarters); if (validBench.length !== bench.length) setBench(validBench) }, [auctions])
  useEffect(() => { localStorage.setItem("fantasy-lineup-starters", JSON.stringify(starters)) }, [starters])
  useEffect(() => { localStorage.setItem("fantasy-lineup-bench", JSON.stringify(bench)) }, [bench])

  function assign(a, destination) {
    const goalkeeper = position(a) === "GK"
    if (destination === "start" && (startingPlayers.length >= 11 || goalkeeper && startGoalkeepers >= 1 || !goalkeeper && startOutfield >= 10)) return setLineupMessage(goalkeeper ? "The starting XI can only contain one goalkeeper." : "The starting XI already has ten outfield players.")
    if (destination === "bench" && (benchPlayers.length >= 6 || goalkeeper && benchGoalkeepers >= 1 || !goalkeeper && benchOutfield >= 5)) return setLineupMessage(goalkeeper ? "The bench can only contain one goalkeeper." : "The bench already has five outfield players.")
    setStarters(current => destination === "start" ? [...current.filter(id => id !== a.id), a.id] : current.filter(id => id !== a.id))
    setBench(current => destination === "bench" ? [...current.filter(id => id !== a.id), a.id] : current.filter(id => id !== a.id))
    setLineupMessage("")
  }

  function remove(id) { setStarters(current => current.filter(item => item !== id)); setBench(current => current.filter(item => item !== id)); setLineupMessage("") }
  const PlayerRow = ({ a, selected }) => <article className="lineup-player"><div className="avatar">{position(a)}</div><div><strong>{name(a)}</strong><small>{a.player_seasons?.clubs?.name} · Rating {a.player_seasons?.overall_rating || "—"}</small></div>{selected ? <button className="lineup-remove" onClick={() => remove(a.id)}>Remove</button> : <div className="lineup-actions"><button onClick={() => assign(a, "start")}>Start</button><button onClick={() => assign(a, "bench")}>Bench</button></div>}</article>

  return <section className="lineup-page"><div className="lineup-heading"><div><span className="eyebrow">Daily team selection</span><h2>Pick your team</h2><p>Select one goalkeeper and ten outfield starters, plus one goalkeeper and five outfield substitutes.</p></div><div className={`lineup-status${lineupComplete ? " complete" : ""}`}><span>{lineupComplete ? "✓ Lineup ready" : `${startingPlayers.length + benchPlayers.length}/17 selected`}</span><small>{season?.first_match_at ? `Deadline ${new Date(season.first_match_at).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : "Deadline to be announced"}</small></div></div>{lineupMessage && <div className="lineup-warning">{lineupMessage}</div>}{players.length < 17 && <div className="lineup-notice"><div><strong>Your provisional squad is not complete.</strong><span>You can plan with current winning bids and fill the remaining positions as you sign players.</span></div><button className="secondary-btn" onClick={onOpenAuctions}>Find players</button></div>}<div className="lineup-columns"><div className="lineup-column"><div className="lineup-column-head"><div><span className="eyebrow">Starting XI</span><h3>{startingPlayers.length}/11</h3></div><small>{startGoalkeepers}/1 GK · {startOutfield}/10 outfield</small></div><div className="lineup-list">{startingPlayers.map(a => <PlayerRow key={a.id} a={a} selected />)}{Array.from({ length: Math.max(0, 11 - startingPlayers.length) }, (_, i) => <div className="lineup-empty" key={i}>Empty starting position</div>)}</div></div><div className="lineup-column"><div className="lineup-column-head"><div><span className="eyebrow">Substitutes</span><h3>{benchPlayers.length}/6</h3></div><small>{benchGoalkeepers}/1 GK · {benchOutfield}/5 outfield</small></div><div className="lineup-list">{benchPlayers.map(a => <PlayerRow key={a.id} a={a} selected />)}{Array.from({ length: Math.max(0, 6 - benchPlayers.length) }, (_, i) => <div className="lineup-empty" key={i}>Empty substitute position</div>)}</div></div></div><div className="available-section"><div className="section-head"><div><span className="eyebrow">Unselected</span><h3>Available squad players</h3></div><span className="results-count">{availablePlayers.length} available</span></div>{availablePlayers.length ? <div className="available-lineup-list">{availablePlayers.map(a => <PlayerRow key={a.id} a={a} />)}</div> : <div className="empty-state"><strong>No unselected players.</strong><span>Remove a player from the XI or bench to change your selection.</span></div>}</div></section>
}

export default function App() {
  const [session, setSession] = useState(null),
    [authReady, setAuthReady] = useState(false),
    [state, setState] = useState(null),
    [auctions, setAuctions] = useState([]),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState(""),
    [bid, setBid] = useState({}),
    [bidding, setBidding] = useState(null),
    [tick, setTick] = useState(0),
    [selected, setSelected] = useState(null),
    [history, setHistory] = useState([]),
    [query, setQuery] = useState(""),
    [positionFilter, setPositionFilter] = useState("ALL"),
    [show, setShow] = useState("all"),
    [sort, setSort] = useState("ending"),
    [view, setView] = useState("home"),
    [watchlist, setWatchlist] = useState(() => {
      try {
        return JSON.parse(localStorage.getItem("fantasy-watchlist") || "[]");
      } catch {
        return [];
      }
    });
  const selectedRef = useRef(null),
    clubRef = useRef(null),
    auctionsRef = useRef([]);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  useEffect(() => {
    clubRef.current = state?.club || null;
  }, [state?.club]);
  useEffect(() => {
    auctionsRef.current = auctions;
  }, [auctions]);
  useEffect(() => {
    localStorage.setItem("fantasy-watchlist", JSON.stringify(watchlist));
  }, [watchlist]);
  async function refresh(activeSession = session) {
    setLoading(true);
    const { data, error } = await supabase.rpc(
      activeSession ? "get_my_game_state" : "get_public_season_state",
    );
    if (error) setMessage(error.message);
    setState(data);
    if (activeSession) {
      const { data: items, error: auctionError } = await supabase
        .from("auctions")
        .select(
          "id,stage,status,reserve_price_pence,current_price_pence,current_winner_club_id,ends_at,min_increment_pence,player_seasons!inner(game_position,overall_rating,players!inner(full_name),clubs!inner(name))",
        )
        .eq("stage", 1)
        .in("status", ["scheduled", "live"])
        .order("current_price_pence", { ascending: false })
        .limit(100);
      if (auctionError) setMessage(auctionError.message);
      setAuctions(items || []);
    }
    setLoading(false);
  }
  async function loadHistory(id, force = false) {
    if (!force && selectedRef.current === id) {
      setSelected(null);
      setHistory([]);
      return;
    }
    setSelected(id);
    const { data, error } = await supabase.rpc("get_auction_bid_history", {
      p_auction_id: id,
    });
    if (error) setMessage(error.message);
    setHistory(data || []);
  }
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
      refresh(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, next) => {
      setSession(next);
      setTimeout(() => refresh(next), 0);
    });
    const timer = setInterval(() => setTick((x) => x + 1), 1000);
    const channel = supabase
      .channel("auction-room")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "auctions" },
        (payload) => {
          setAuctions((old) =>
            old
              .map((a) =>
                a.id === payload.new.id ? { ...a, ...payload.new } : a,
              )
              .filter((a) => ["scheduled", "live"].includes(a.status)),
          );
          const clubId = clubRef.current?.id;
          if (
            clubId &&
            payload.old.current_winner_club_id === clubId &&
            payload.new.current_winner_club_id !== clubId
          ) {
            const player = auctionsRef.current.find(
              (a) => a.id === payload.new.id,
            );
            setMessage(
              `You have been outbid on ${player ? name(player) : "a watched player"}.`,
            );
          }
          if (
            clubId &&
            (payload.old.current_winner_club_id === clubId ||
              payload.new.current_winner_club_id === clubId)
          )
            setTimeout(() => refresh(true), 0);
          if (selectedRef.current === payload.new.id)
            setTimeout(() => loadHistory(payload.new.id, true), 0);
        },
      )
      .subscribe();
    return () => {
      listener.subscription.unsubscribe();
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, []);
  async function placeBid(a) {
    const minimum = a.current_winner_club_id
        ? Number(a.current_price_pence) + Number(a.min_increment_pence)
        : Number(a.reserve_price_pence),
      amount =
        bid[a.id] === undefined || bid[a.id] === ""
          ? minimum
          : Math.round(Number(bid[a.id]) * 100);
    setBidding(a.id);
    setMessage("");
    const { error } = await supabase.rpc("place_my_auction_bid", {
      p_auction_id: a.id,
      p_amount_pence: amount,
    });
    setMessage(
      error?.message || `Bid of ${money(amount)} placed on ${name(a)}.`,
    );
    if (!error) {
      setBid((current) => ({ ...current, [a.id]: "" }));
      await refresh(true);
      if (selected === a.id) await loadHistory(a.id, true);
    }
    setBidding(null);
  }
  function toggleWatch(id) {
    setWatchlist((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }
  const visible = useMemo(
    () =>
      auctions.filter((a) => {
        const q = query.trim().toLowerCase();
        return (
          (!q ||
            name(a).toLowerCase().includes(q) ||
            (a.player_seasons?.clubs?.name || "").toLowerCase().includes(q)) &&
          (positionFilter === "ALL" || position(a) === positionFilter) &&
          (show === "all" ||
            (show === "winning" &&
              a.current_winner_club_id === state?.club?.id) ||
            (show === "live" && a.status === "live") ||
            (show === "watched" && watchlist.includes(a.id)))
        );
      }).sort((a, b) => {
        if (sort === "price-low") return Number(a.current_price_pence || a.reserve_price_pence) - Number(b.current_price_pence || b.reserve_price_pence);
        if (sort === "price-high") return Number(b.current_price_pence || b.reserve_price_pence) - Number(a.current_price_pence || a.reserve_price_pence);
        if (sort === "rating") return Number(b.player_seasons?.overall_rating || 0) - Number(a.player_seasons?.overall_rating || 0);
        if (sort === "name") return name(a).localeCompare(name(b));
        return new Date(a.ends_at || "9999-12-31") - new Date(b.ends_at || "9999-12-31");
      }),
    [auctions, query, positionFilter, show, sort, state?.club?.id, watchlist, tick],
  );
  if (!authReady)
    return <div className="loading-screen">Loading Fantasy Football…</div>;
  if (!session) return <AuthScreen />;
  if (loading && !state)
    return <div className="loading-screen">Loading your club…</div>;
  if (!state?.club) return <ClubSetup onCreated={() => refresh(true)} />;
  const { season, club } = state;
  const available =
    Number(club.budget_pence || 0) - Number(club.reserved_pence || 0);
  const winning = auctions.filter(
    (a) => a.current_winner_club_id === club.id,
  ).length;
  return (
    <div className="app-shell single-screen">
      <main>
        <header className="topbar">
          <div>
            <span className="eyebrow">
              Premier Division · {season?.name || "Season 1"}
            </span>
            <h1>{club.name}</h1>
            <p>
              {view === "home"
                ? "Club headquarters"
                : view === "squad"
                  ? "Provisional 17-player squad"
                  : view === "lineup"
                    ? "Starting XI and substitutes"
                  : "Day 1 auction room · prices update live"}
            </p>
          </div>
          <button className="ghost-btn" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </header>
        <nav className="club-nav" aria-label="Club navigation">
          <button
            className={view === "home" ? "active" : ""}
            onClick={() => setView("home")}
          >
            Club Home
          </button>
          <button
            className={view === "auctions" ? "active" : ""}
            onClick={() => setView("auctions")}
          >
            Auctions <span>{auctions.length}</span>
          </button>
          <button
            className={view === "squad" ? "active" : ""}
            onClick={() => setView("squad")}
          >
            My Squad <span>{winning}/17</span>
          </button>
          <button
            className={view === "lineup" ? "active" : ""}
            onClick={() => setView("lineup")}
          >
            Lineup
          </button>
        </nav>
        <section className="stats-grid">
          <div className="stat-card">
            <div>
              <span>Budget</span>
              <strong>{money(club.budget_pence)}</strong>
            </div>
          </div>
          <div className="stat-card">
            <div>
              <span>Available</span>
              <strong>{money(available)}</strong>
              <small>{money(club.reserved_pence)} committed</small>
            </div>
          </div>
          <div className="stat-card">
            <div>
              <span>Winning bids</span>
              <strong>{winning}</strong>
              <small>Across current auctions</small>
            </div>
          </div>
          <div className="stat-card">
            <div>
              <span>Day 1 cards</span>
              <strong>{auctions.length}</strong>
              <small>Prices update live</small>
            </div>
          </div>
        </section>
        {view === "home" ? (
          <ClubHome
            season={season}
            club={club}
            auctions={auctions}
            onOpenAuctions={() => setView("auctions")}
          />
        ) : view === "squad" ? (
          <ProvisionalSquad club={club} auctions={auctions} onOpenAuctions={() => setView("auctions")} />
        ) : view === "lineup" ? (
          <LineupPlanner club={club} season={season} auctions={auctions} onOpenAuctions={() => setView("auctions")} />
        ) : (
          <section className="section">
            <div className="section-head">
              <div>
                <span className="eyebrow">Player market</span>
                <h2>Live auctions</h2>
              </div>
              <span className="results-count">
                {visible.length} player{visible.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="auction-toolbar">
              <input
                type="search"
                placeholder="Search player or historical club"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select
                aria-label="Filter by position"
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
              >
                <option value="ALL">All positions</option>
                {["GK", "DEF", "MID", "FWD"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <select aria-label="Sort auctions" value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="ending">Ending soon</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
                <option value="rating">Highest rating</option>
                <option value="name">Player name</option>
              </select>
              <div className="segmented">
                <button
                  className={show === "all" ? "active" : ""}
                  onClick={() => setShow("all")}
                >
                  All
                </button>
                <button
                  className={show === "live" ? "active" : ""}
                  onClick={() => setShow("live")}
                >
                  Live
                </button>
                <button
                  className={show === "winning" ? "active" : ""}
                  onClick={() => setShow("winning")}
                >
                  Winning
                </button>
                <button
                  className={show === "watched" ? "active" : ""}
                  onClick={() => setShow("watched")}
                >
                  Watched{watchlist.length ? ` (${watchlist.length})` : ""}
                </button>
              </div>
            </div>
            {loading ? (
              <div className="empty-state">Refreshing auctions…</div>
            ) : visible.length ? (
              <div className="auction-grid">
                {visible.map((a) => (
                  <AuctionCard
                    key={a.id}
                    auction={a}
                    clubId={club.id}
                    value={bid[a.id] ?? ""}
                    setValue={(value) =>
                      setBid((current) => ({ ...current, [a.id]: value }))
                    }
                    placeBid={() => placeBid(a)}
                    busy={bidding === a.id}
                    open={selected === a.id}
                    history={history}
                    toggleHistory={() => loadHistory(a.id)}
                    watched={watchlist.includes(a.id)}
                    toggleWatch={() => toggleWatch(a.id)}
                    availablePence={available}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <strong>No auctions match those filters.</strong>
                <span>Try viewing all positions or clearing your search.</span>
              </div>
            )}
          </section>
        )}
        {message && (
          <div className="config-banner toast" role="status">
            <span>{message}</span>
            <button onClick={() => setMessage("")} aria-label="Dismiss message">
              ×
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
