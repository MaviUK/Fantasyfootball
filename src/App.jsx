import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./lib/supabase.js";

const money = (p) => `£${(Number(p || 0) / 100000000).toFixed(1)}m`;
const name = (a) => a.player_seasons?.players?.full_name || "Player";
const compactName = (a) => {
  const fullName = name(a);
  if (fullName.length <= 18) return fullName;
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : fullName;
};
const position = (a) => a.player_seasons?.game_position || "—";
const positionLabel = (a) => ({ GK: "Goalkeeper", CD: "Defender", MD: "Midfielder", ATT: "Forward" })[position(a)] || position(a);
const left = (date) => {
  if (!date) return "Starts after first bid";
  const seconds = Math.max(0, Math.floor((new Date(date) - Date.now()) / 1000));
  if (!seconds) return "Ended";
  return seconds >= 3600
    ? `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};
const auctionStageStart = (season, stage) => season?.[`auction_day${stage}_start`];
const auctionStageState = (season, stage) => {
  const start = auctionStageStart(season, stage);
  const end = stage < 4 ? auctionStageStart(season, stage + 1) : season?.fixed_price_start;
  const now = Date.now();
  if (!start || now < new Date(start).getTime()) return "upcoming";
  if (!end || now < new Date(end).getTime()) return "live";
  return "complete";
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
  removeBid,
  busy,
  removing,
  open,
  history,
  toggleHistory,
  watched,
  toggleWatch,
  availablePence,
  onProfile,
}) {
  const p = a.player_seasons,
    leading = a.current_winner_club_id === clubId,
    ended =
      a.status === "ended" || (a.ends_at && new Date(a.ends_at) <= new Date());
  const minimum = a.current_winner_club_id
    ? Number(a.current_price_pence) + Number(a.min_increment_pence)
    : Number(a.reserve_price_pence);
  const proposed = value === "" ? minimum : Math.round(Number(value) * 100);
  const maximum =
    Number(availablePence) + (leading ? Number(a.current_price_pence || 0) : 0);
  const belowMinimum = value !== "" && proposed < minimum;
  const overBudget = proposed > maximum;
  const invalid = belowMinimum || overBudget;
  const quickBid = (increase) =>
    setValue(
      String(
        Math.max(
          minimum,
          Number(a.current_price_pence || a.reserve_price_pence) + increase,
        ) / 100,
      ),
    );
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
                  : `Day ${a.stage}`}
          </span>
          <h3>{name(a)}</h3>
          <p>
            {p?.clubs?.name} · {p?.season_label || "Season unknown"} · {positionLabel(a)} · Rating {p?.overall_rating || "—"}
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
      <div className="quick-bids">
        <span>Quick bid</span>
        <button
          type="button"
          disabled={ended || a.status !== "live"}
          onClick={() => quickBid(50000000)}
        >
          +£0.5m
        </button>
        <button
          type="button"
          disabled={ended || a.status !== "live"}
          onClick={() => quickBid(100000000)}
        >
          +£1m
        </button>
        <button
          type="button"
          disabled={ended || a.status !== "live"}
          onClick={() => setValue(String(minimum / 100))}
        >
          Minimum
        </button>
      </div>
      {belowMinimum && (
        <small className="field-error">Minimum bid is {money(minimum)}</small>
      )}
      {overBudget && (
        <small className="field-error">
          Your maximum available bid is {money(maximum)}
        </small>
      )}
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
      {leading && !ended && a.status === "live" && (
        <button
          type="button"
          className="remove-bid-btn"
          disabled={removing || busy}
          onClick={removeBid}
        >
          {removing ? "Removing bid…" : "Remove my bid"}
        </button>
      )}
      <button className="profile-link" onClick={() => onProfile(p.id)}>View full player profile →</button>
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

function PlayerProfile({ data, loading, error, onClose }) {
  const attributes = data?.simulation_attributes || {};
  const components = data?.rating_components || {};
  const meters = Object.entries(attributes).filter(([, value]) => Number.isFinite(Number(value))).slice(0, 8);
  const ratingParts = Object.entries(components).filter(([, value]) => Number.isFinite(Number(value))).slice(0, 6);
  const historicalStats = data ? [
    ["Apps", data.appearances], ["Starts", data.starts], ["Minutes", data.minutes], ["Goals", data.goals], ["Assists", data.assists],
    ...(data.game_position === "GK" ? [["Clean sheets", data.clean_sheets], ["Saves", data.saves], ["Conceded", data.goals_conceded]] : [["Yellow", data.yellow_cards], ["Red", data.red_cards]]),
  ] : [];
  return (
    <div className="profile-backdrop" onClick={onClose}>
      <section className="player-profile" role="dialog" aria-modal="true" aria-label="Player profile" onClick={(e) => e.stopPropagation()}>
        <button className="profile-close" onClick={onClose} aria-label="Close player profile">×</button>
        {loading ? <div className="profile-loading">Loading player profile…</div> : error ? <div className="profile-error"><strong>Could not load this player.</strong><span>{error}</span></div> : data && <>
          <header className="profile-hero">
            <div className="profile-rating"><strong>{Math.round(Number(data.overall_rating || 0))}</strong><span>{data.game_position}</span></div>
            <div><span className="eyebrow">{data.season_label} · {data.competition_name}</span><h2>{data.full_name}</h2><p>{data.club_name} · {data.historical_position || data.game_position}{data.age ? ` · Age ${data.age}` : ""}{data.nationality_code ? ` · ${data.nationality_code}` : ""}</p></div>
            <div className="profile-value"><span>Card value</span><strong>{money(data.market_value_pence)}</strong><small>{Math.round(Number(data.data_confidence || 0) * 100)}% data confidence</small></div>
          </header>
          <div className="profile-body">
            <div className="profile-main">
              <div className="profile-section-title"><span className="eyebrow">Historical season</span><h3>{data.season_label} performance</h3></div>
              <div className="profile-stat-grid">{historicalStats.map(([label, value]) => <div key={label}><span>{label}</span><strong>{Number(value || 0).toLocaleString()}</strong></div>)}</div>
              {!!meters.length && <><div className="profile-section-title"><span className="eyebrow">Match engine</span><h3>Simulation attributes</h3></div><div className="attribute-list">{meters.map(([label, value]) => <div key={label}><div><span>{label.replaceAll("_", " ")}</span><strong>{Math.round(Number(value))}</strong></div><i><b style={{ width: `${Math.min(100, Number(value))}%` }} /></i></div>)}</div></>}
            </div>
            <aside className="profile-sidebar">
              <span className="eyebrow">Fantasy career</span><h3>Current game record</h3>
              <div className="game-record"><div><strong>{data.game_stats.appearances}</strong><span>Apps</span></div><div><strong>{data.game_stats.goals}</strong><span>Goals</span></div><div><strong>{data.game_stats.assists}</strong><span>Assists</span></div><div><strong>{data.game_stats.average_rating || "—"}</strong><span>Avg rating</span></div></div>
              {!!ratingParts.length && <div className="rating-breakdown"><h4>Rating breakdown</h4>{ratingParts.map(([label, value]) => <div key={label}><span>{label.replaceAll("_", " ")}</span><b>{Number(value).toFixed(1)}</b></div>)}</div>}
              <div className="profile-fitness"><div><span>Stamina</span><strong>{Math.round(Number(data.stamina_rating || 0))}</strong></div><div><span>Injury risk</span><strong>{Math.round(Number(data.injury_proneness || 0))}</strong></div></div>
            </aside>
          </div>
        </>}
      </section>
    </div>
  );
}

function ClubHome({ season, club, auctions, onOpenAuctions }) {
  const winning = auctions.filter((a) => a.current_winner_club_id === club.id);
  const positions = ["GK", "CD", "MD", "ATT"].map((label) => ({
    label,
    display: { GK: "GK", CD: "DEF", MD: "MID", ATT: "ATT" }[label],
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
                <span>{item.display}</span>
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

function ProvisionalSquad({ players, onOpenAuctions, onProfile }) {
  const goalkeepers = players.filter((a) => position(a) === "GK");
  const outfield = players.filter((a) => position(a) !== "GK");
  const totalCost = players.reduce(
    (sum, a) =>
      sum + Number(a.current_price_pence || a.reserve_price_pence || 0),
    0,
  );
  const slots = [
    { label: "Goalkeepers", players: goalkeepers, required: 2 },
    { label: "Outfield players", players: outfield, required: 15 },
  ];

  return (
    <section className="squad-page">
      <div className="squad-heading">
        <div>
          <span className="eyebrow">Provisional squad</span>
          <h2>Your squad</h2>
          <p>
            Permanent signings and auctions you currently lead, with live
            availability for your next match.
          </p>
        </div>
        <button className="primary-btn" onClick={onOpenAuctions}>
          Find players
        </button>
      </div>
      <div className="squad-progress">
        <div>
          <span>Total players</span>
          <strong>
            {players.length}
            <small>/17</small>
          </strong>
          <div className="squad-track">
            <i
              style={{
                width: `${Math.min(100, (players.length / 17) * 100)}%`,
              }}
            />
          </div>
        </div>
        <div>
          <span>Goalkeepers</span>
          <strong>
            {goalkeepers.length}
            <small>/2</small>
          </strong>
          <div className="squad-track">
            <i
              style={{
                width: `${Math.min(100, (goalkeepers.length / 2) * 100)}%`,
              }}
            />
          </div>
        </div>
        <div>
          <span>Outfield</span>
          <strong>
            {outfield.length}
            <small>/15</small>
          </strong>
          <div className="squad-track">
            <i
              style={{
                width: `${Math.min(100, (outfield.length / 15) * 100)}%`,
              }}
            />
          </div>
        </div>
        <div>
          <span>Provisional cost</span>
          <strong>{money(totalCost)}</strong>
          <small>Current leading bids</small>
        </div>
      </div>
      {slots.map((group) => (
        <div className="squad-group" key={group.label}>
          <div className="section-head">
            <div>
              <span className="eyebrow">
                {group.players.length} of {group.required}
              </span>
              <h3>{group.label}</h3>
            </div>
          </div>
          <div className="squad-list">
            {group.players.map((a) => (
              <article key={a.id}>
                <div className="avatar">{position(a)}</div>
                <div className="squad-player">
                  <strong>{name(a)}</strong>
                  <span>
                    {a.player_seasons?.clubs?.name} · Rating{" "}
                    {a.player_seasons?.overall_rating || "—"}
                  </span>
                </div>
                <div className="squad-bid">
                  <span>{a.ownership_status === "owned" ? "Signed for" : "Leading bid"}</span>
                  <strong>
                    {money(a.current_price_pence || a.reserve_price_pence)}
                  </strong>
                </div>
                <div className={`availability-badge ${a.injury_status !== "available" || a.suspension_matches ? "unavailable" : ""}`}>
                  {a.suspension_matches ? `Suspended ${a.suspension_matches}` : a.injury_status !== "available" ? a.injury_status : `${Math.round(Number(a.fitness || 100))}% fit`}
                </div>
                <div className={a.ownership_status === "owned" ? "owned-badge" : "provisional-badge"}>{a.ownership_status === "owned" ? "Signed" : "Provisional"}</div>
                <button className="squad-profile-btn" onClick={() => onProfile(a.player_seasons.id)}>Profile</button>
              </article>
            ))}
            {Array.from(
              { length: Math.max(0, group.required - group.players.length) },
              (_, index) => (
                <button
                  className="empty-squad-slot"
                  key={`empty-${index}`}
                  onClick={onOpenAuctions}
                >
                  <span>+</span>
                  <div>
                    <strong>Empty slot</strong>
                    <small>
                      Find a{" "}
                      {group.label === "Goalkeepers" ? "goalkeeper" : "player"}
                    </small>
                  </div>
                </button>
              ),
            )}
          </div>
        </div>
      ))}
    </section>
  );
}

const FORMATION_PITCH = {
  "4-4-2": {
    GK: [[50, 91]],
    CD: [
      [12, 72],
      [38, 75],
      [62, 75],
      [88, 72],
    ],
    MD: [
      [12, 44],
      [38, 48],
      [62, 48],
      [88, 44],
    ],
    ATT: [
      [38, 17],
      [62, 17],
    ],
  },
  "4-3-3": {
    GK: [[50, 91]],
    CD: [
      [12, 72],
      [38, 75],
      [62, 75],
      [88, 72],
    ],
    MD: [
      [25, 47],
      [50, 51],
      [75, 47],
    ],
    ATT: [
      [15, 18],
      [50, 12],
      [85, 18],
    ],
  },
  "3-5-2": {
    GK: [[50, 91]],
    CD: [
      [25, 74],
      [50, 77],
      [75, 74],
    ],
    MD: [
      [8, 46],
      [30, 49],
      [50, 53],
      [70, 49],
      [92, 46],
    ],
    ATT: [
      [38, 17],
      [62, 17],
    ],
  },
  "4-2-3-1": {
    GK: [[50, 91]],
    CD: [
      [12, 72],
      [38, 75],
      [62, 75],
      [88, 72],
    ],
    MD: [
      [38, 57],
      [62, 57],
      [20, 34],
      [50, 38],
      [80, 34],
    ],
    ATT: [[50, 12]],
  },
  "5-3-2": {
    GK: [[50, 91]],
    CD: [
      [8, 70],
      [29, 75],
      [50, 78],
      [71, 75],
      [92, 70],
    ],
    MD: [
      [25, 46],
      [50, 50],
      [75, 46],
    ],
    ATT: [
      [38, 17],
      [62, 17],
    ],
  },
};

function PitchPreview({ formation, players }) {
  const shape = FORMATION_PITCH[formation];
  const groups = Object.fromEntries(
    ["GK", "CD", "MD", "ATT"].map((code) => [
      code,
      players.filter((a) => position(a) === code),
    ]),
  );
  const slots = Object.entries(shape).flatMap(([code, coordinates]) =>
    coordinates.map(([x, y], index) => ({
      code,
      x,
      y,
      player: groups[code][index],
    })),
  );
  return (
    <section className="pitch-section">
      <div className="section-head">
        <div>
          <span className="eyebrow">Formation preview</span>
          <h3>{formation}</h3>
        </div>
        <span className="results-count">{players.length}/11 placed</span>
      </div>
      <div className="football-pitch">
        <div className="pitch-halfway" />
        <div className="pitch-circle" />
        <div className="pitch-box top" />
        <div className="pitch-box bottom" />
        {slots.map((slot, index) => (
          <div
            className={`pitch-player${slot.player ? " filled" : ""}`}
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
            key={`${slot.code}-${index}`}
          >
            <span>{slot.player ? position(slot.player) : "+"}</span>
            <strong>
              {slot.player
                ? name(slot.player).split(" ").slice(-1)[0]
                : slot.code}
            </strong>
            {slot.player && (
              <small>{slot.player.player_seasons?.overall_rating || "—"}</small>
            )}
          </div>
        ))}
      </div>
      <p className="pitch-help">
        Players are placed by their squad position and the selected formation.
        Change the order of your starters to adjust players within each line.
      </p>
    </section>
  );
}

function LineupPlanner({ season, players, onOpenAuctions }) {
  const [starters, setStarters] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("fantasy-lineup-starters") || "[]",
      );
    } catch {
      return [];
    }
  });
  const [bench, setBench] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("fantasy-lineup-bench") || "[]");
    } catch {
      return [];
    }
  });
  const [lineupMessage, setLineupMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [formation, setFormation] = useState(
    () => localStorage.getItem("fantasy-formation") || "4-4-2",
  );
  const [submitting, setSubmitting] = useState(false);
  const playerIds = players.map((a) => a.id);
  const startingPlayers = starters
    .map((id) => players.find((a) => a.id === id))
    .filter(Boolean);
  const benchPlayers = bench
    .map((id) => players.find((a) => a.id === id))
    .filter(Boolean);
  const availablePlayers = players.filter(
    (a) => !starters.includes(a.id) && !bench.includes(a.id),
  );
  const startGoalkeepers = startingPlayers.filter(
    (a) => position(a) === "GK",
  ).length;
  const startOutfield = startingPlayers.length - startGoalkeepers;
  const benchGoalkeepers = benchPlayers.filter(
    (a) => position(a) === "GK",
  ).length;
  const benchOutfield = benchPlayers.length - benchGoalkeepers;
  const lineupComplete =
    startingPlayers.length === 11 &&
    startGoalkeepers === 1 &&
    benchPlayers.length === 6 &&
    benchGoalkeepers === 1;
  const formationShape = {
    "4-4-2": [4, 4, 2],
    "4-3-3": [4, 3, 3],
    "3-5-2": [3, 5, 2],
    "4-2-3-1": [4, 5, 1],
    "5-3-2": [5, 3, 2],
  }[formation];
  const starterShape = ["CD", "MD", "ATT"].map(
    (code) => startingPlayers.filter((a) => position(a) === code).length,
  );
  const formationMatches = formationShape.every(
    (count, index) => count === starterShape[index],
  );

  useEffect(() => {
    const validStarters = starters.filter((id) => playerIds.includes(id)),
      validBench = bench.filter((id) => playerIds.includes(id));
    if (validStarters.length !== starters.length) setStarters(validStarters);
    if (validBench.length !== bench.length) setBench(validBench);
  }, [auctions]);
  useEffect(() => {
    localStorage.setItem("fantasy-lineup-starters", JSON.stringify(starters));
  }, [starters]);
  useEffect(() => {
    localStorage.setItem("fantasy-lineup-bench", JSON.stringify(bench));
  }, [bench]);
  useEffect(() => {
    localStorage.setItem("fantasy-formation", formation);
  }, [formation]);
  useEffect(() => {
    if (!players.length) return;
    supabase.rpc("get_my_lineup_draft").then(({ data, error }) => {
      if (error) return setLineupMessage(error.message);
      const toAuctionIds = (ids) =>
        (ids || [])
          .map(
            (playerSeasonId) =>
              players.find((a) => a.player_seasons?.id === playerSeasonId)?.id,
          )
          .filter(Boolean);
      const remoteStarters = toAuctionIds(data?.starters);
      const remoteBench = toAuctionIds(data?.bench);
      if (remoteStarters.length || remoteBench.length) {
        setStarters(remoteStarters);
        setBench(remoteBench);
        setSavedAt("Loaded saved lineup");
      }
    });
  }, [players.length]);

  function assign(a, destination) {
    const goalkeeper = position(a) === "GK";
    if (
      destination === "start" &&
      (startingPlayers.length >= 11 ||
        (goalkeeper && startGoalkeepers >= 1) ||
        (!goalkeeper && startOutfield >= 10))
    )
      return setLineupMessage(
        goalkeeper
          ? "The starting XI can only contain one goalkeeper."
          : "The starting XI already has ten outfield players.",
      );
    if (
      destination === "bench" &&
      (benchPlayers.length >= 6 ||
        (goalkeeper && benchGoalkeepers >= 1) ||
        (!goalkeeper && benchOutfield >= 5))
    )
      return setLineupMessage(
        goalkeeper
          ? "The bench can only contain one goalkeeper."
          : "The bench already has five outfield players.",
      );
    setStarters((current) =>
      destination === "start"
        ? [...current.filter((id) => id !== a.id), a.id]
        : current.filter((id) => id !== a.id),
    );
    setBench((current) =>
      destination === "bench"
        ? [...current.filter((id) => id !== a.id), a.id]
        : current.filter((id) => id !== a.id),
    );
    setLineupMessage("");
  }

  function remove(id) {
    setStarters((current) => current.filter((item) => item !== id));
    setBench((current) => current.filter((item) => item !== id));
    setLineupMessage("");
  }
  function orderedIds(group, id) {
    const list = group === "starter" ? starters : bench;
    const selectedPlayer = players.find((a) => a.id === id);
    return list.filter((itemId) => {
      const item = players.find((a) => a.id === itemId);
      return group === "starter"
        ? position(item) === position(selectedPlayer)
        : position(item) !== "GK";
    });
  }
  function movePlayer(id, direction, group) {
    const setList = group === "starter" ? setStarters : setBench;
    setList((current) => {
      const ordered = orderedIds(group, id);
      const currentOrder = ordered.indexOf(id);
      const otherId = ordered[currentOrder + direction];
      if (!otherId) return current;
      const next = [...current];
      const from = next.indexOf(id),
        to = next.indexOf(otherId);
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
    setSavedAt(null);
    setLineupMessage("");
  }
  async function saveDraft() {
    setSaving(true);
    setLineupMessage("");
    const starterIds = starters
      .map((id) => players.find((a) => a.id === id)?.player_seasons?.id)
      .filter(Boolean);
    const benchIds = [...benchPlayers]
      .sort((a, b) =>
        position(a) === "GK" ? -1 : position(b) === "GK" ? 1 : 0,
      )
      .map((a) => a.player_seasons?.id)
      .filter(Boolean);
    const { data, error } = await supabase.rpc("save_my_lineup_draft", {
      p_starters: starterIds,
      p_bench: benchIds,
    });
    setSaving(false);
    if (error) {
      setLineupMessage(error.message);
      return false;
    }
    setSavedAt(
      new Date(data?.saved_at || Date.now()).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
    setLineupMessage("Lineup draft saved to your club.");
    return true;
  }
  async function submitLineup() {
    if (!lineupComplete || !formationMatches) return;
    setSubmitting(true);
    const saved = await saveDraft();
    if (!saved) {
      setSubmitting(false);
      return;
    }
    const { data, error } = await supabase.rpc("submit_my_lineup", {
      p_formation: formation,
    });
    setSubmitting(false);
    if (error) return setLineupMessage(error.message);
    setSavedAt(
      new Date(data?.submitted_at || Date.now()).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
    setLineupMessage(`${formation} lineup submitted successfully.`);
  }
  const PlayerRow = ({ a, selected, group, priority }) => {
    const order = selected ? orderedIds(group, a.id) : [];
    const orderIndex = order.indexOf(a.id);
    const reorderable = group === "starter" || position(a) !== "GK";
    return (
      <article className="lineup-player">
        <div className="avatar">{position(a)}</div>
        <div>
          <strong>{name(a)}</strong>
          <small>
            {a.player_seasons?.clubs?.name} · Rating{" "}
            {a.player_seasons?.overall_rating || "—"}
          </small>
        </div>
        {priority && <span className="sub-priority">{priority}</span>}
        {selected ? (
          <div className="selected-player-actions">
            {reorderable && (
              <div className="order-buttons">
                <button
                  disabled={orderIndex <= 0}
                  onClick={() => movePlayer(a.id, -1, group)}
                  aria-label={`Move ${name(a)} up`}
                >
                  ↑
                </button>
                <button
                  disabled={orderIndex >= order.length - 1}
                  onClick={() => movePlayer(a.id, 1, group)}
                  aria-label={`Move ${name(a)} down`}
                >
                  ↓
                </button>
              </div>
            )}
            <button className="lineup-remove" onClick={() => remove(a.id)}>
              Remove
            </button>
          </div>
        ) : (
          <div className="lineup-actions">
            <button onClick={() => assign(a, "start")}>Start</button>
            <button onClick={() => assign(a, "bench")}>Bench</button>
          </div>
        )}
      </article>
    );
  };

  return (
    <section className="lineup-page">
      <div className="lineup-heading">
        <div>
          <span className="eyebrow">Daily team selection</span>
          <h2>Pick your team</h2>
          <p>
            Select one goalkeeper and ten outfield starters, plus one goalkeeper
            and five outfield substitutes.
          </p>
        </div>
        <div className="lineup-save-area">
          <label className="formation-select">
            Formation
            <select
              value={formation}
              onChange={(e) => setFormation(e.target.value)}
            >
              {["4-4-2", "4-3-3", "3-5-2", "4-2-3-1", "5-3-2"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <div className={`lineup-status${lineupComplete ? " complete" : ""}`}>
            <span>
              {lineupComplete
                ? "✓ Lineup ready"
                : `${startingPlayers.length + benchPlayers.length}/17 selected`}
            </span>
            <small>
              {season?.first_match_at
                ? `Deadline ${new Date(season.first_match_at).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                : "Deadline to be announced"}
            </small>
          </div>
          <button
            className="primary-btn"
            disabled={saving || !players.length}
            onClick={saveDraft}
          >
            {saving ? "Saving…" : "Save lineup"}
          </button>
          <button
            className="submit-lineup-btn"
            disabled={submitting || !lineupComplete || !formationMatches}
            onClick={submitLineup}
          >
            {submitting ? "Submitting…" : "Submit lineup"}
          </button>
          {lineupComplete && !formationMatches && (
            <small className="formation-error">
              Need {formationShape[0]} defenders, {formationShape[1]}{" "}
              midfielders and {formationShape[2]} attackers
            </small>
          )}
          {savedAt && <small className="saved-at">Saved: {savedAt}</small>}
        </div>
      </div>
      {lineupMessage && (
        <div
          className={
            lineupMessage.includes("saved") ||
            lineupMessage.includes("submitted")
              ? "lineup-success"
              : "lineup-warning"
          }
        >
          {lineupMessage}
        </div>
      )}
      {players.length < 17 && (
        <div className="lineup-notice">
          <div>
            <strong>Your provisional squad is not complete.</strong>
            <span>
              You can plan with current winning bids and fill the remaining
              positions as you sign players.
            </span>
          </div>
          <button className="secondary-btn" onClick={onOpenAuctions}>
            Find players
          </button>
        </div>
      )}
      <PitchPreview formation={formation} players={startingPlayers} />
      <div className="lineup-columns">
        <div className="lineup-column">
          <div className="lineup-column-head">
            <div>
              <span className="eyebrow">Starting XI</span>
              <h3>{startingPlayers.length}/11</h3>
            </div>
            <small>
              {startGoalkeepers}/1 GK · {startOutfield}/10 outfield
            </small>
          </div>
          <div className="lineup-list">
            {startingPlayers.map((a) => (
              <PlayerRow key={a.id} a={a} selected group="starter" />
            ))}
            {Array.from(
              { length: Math.max(0, 11 - startingPlayers.length) },
              (_, i) => (
                <div className="lineup-empty" key={i}>
                  Empty starting position
                </div>
              ),
            )}
          </div>
        </div>
        <div className="lineup-column">
          <div className="lineup-column-head">
            <div>
              <span className="eyebrow">Substitutes</span>
              <h3>{benchPlayers.length}/6</h3>
            </div>
            <small>
              {benchGoalkeepers}/1 GK · {benchOutfield}/5 outfield
            </small>
          </div>
          <div className="lineup-list">
            {benchPlayers.map((a) => (
              <PlayerRow
                key={a.id}
                a={a}
                selected
                group="bench"
                priority={
                  position(a) === "GK"
                    ? "GK"
                    : `Sub ${benchPlayers.filter((p) => position(p) !== "GK").findIndex((p) => p.id === a.id) + 1}`
                }
              />
            ))}
            {Array.from(
              { length: Math.max(0, 6 - benchPlayers.length) },
              (_, i) => (
                <div className="lineup-empty" key={i}>
                  Empty substitute position
                </div>
              ),
            )}
          </div>
        </div>
      </div>
      <div className="available-section">
        <div className="section-head">
          <div>
            <span className="eyebrow">Unselected</span>
            <h3>Available squad players</h3>
          </div>
          <span className="results-count">
            {availablePlayers.length} available
          </span>
        </div>
        {availablePlayers.length ? (
          <div className="available-lineup-list">
            {availablePlayers.map((a) => (
              <PlayerRow key={a.id} a={a} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>No unselected players.</strong>
            <span>
              Remove a player from the XI or bench to change your selection.
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

const fixtureDate = (value, includeTime = true) => {
  if (!value) return "To be announced";
  return new Date(value).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(includeTime && { hour: "2-digit", minute: "2-digit" }),
  });
};

const tacticGroups = [
  { key: "mentality", label: "Mentality", description: "Your overall risk and attacking intent.", options: [["very_defensive", "Very defensive"], ["defensive", "Defensive"], ["balanced", "Balanced"], ["attacking", "Attacking"], ["very_attacking", "Very attacking"]] },
  { key: "tempo", label: "Tempo", description: "How quickly your team moves the ball.", options: [["slow", "Slow"], ["balanced", "Balanced"], ["fast", "Fast"]] },
  { key: "passing_style", label: "Passing", description: "How your team progresses possession.", options: [["short", "Short"], ["mixed", "Mixed"], ["direct", "Direct"]] },
  { key: "pressing", label: "Pressing", description: "How aggressively players close down opponents.", options: [["low", "Low block"], ["balanced", "Balanced"], ["high", "High press"]] },
  { key: "width", label: "Team width", description: "Where your team concentrates its play.", options: [["narrow", "Narrow"], ["balanced", "Balanced"], ["wide", "Wide"]] },
  { key: "defensive_line", label: "Defensive line", description: "How high your defenders hold their position.", options: [["deep", "Deep"], ["balanced", "Balanced"], ["high", "High"]] },
];

function TacticsPage({ season }) {
  const defaults = { mentality: "balanced", tempo: "balanced", pressing: "balanced", width: "balanced", defensive_line: "balanced", passing_style: "mixed" };
  const [tactics, setTactics] = useState(defaults);
  const [hasLineup, setHasLineup] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    supabase.rpc("get_my_tactics").then(({ data, error }) => {
      if (error) setMessage(error.message);
      if (data) {
        setTactics(Object.fromEntries(Object.keys(defaults).map((key) => [key, data[key] || defaults[key]])));
        setHasLineup(data.has_lineup);
      }
      setLoading(false);
    });
  }, []);

  async function saveTactics() {
    setSaving(true);
    setMessage("");
    const { data, error } = await supabase.rpc("save_my_tactics", {
      p_mentality: tactics.mentality,
      p_tempo: tactics.tempo,
      p_pressing: tactics.pressing,
      p_width: tactics.width,
      p_defensive_line: tactics.defensive_line,
      p_passing_style: tactics.passing_style,
    });
    setSaving(false);
    if (error) return setMessage(error.message);
    setMessage(`Tactics saved at ${new Date(data.saved_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.`);
  }

  if (loading) return <div className="tactics-loading">Loading your tactics…</div>;
  const styleName = tactics.mentality.includes("attacking") ? "Front-foot football" : tactics.mentality.includes("defensive") ? "Compact counterattack" : tactics.tempo === "fast" ? "High-tempo control" : "Balanced control";
  return (
    <section className="tactics-page">
      <div className="tactics-heading">
        <div><span className="eyebrow">Match preparation</span><h2>Team tactics</h2><p>Set the playing style the match engine will use with your selected lineup.</p></div>
        <div className="tactics-save">
          <small>{season?.first_match_at ? `Deadline ${fixtureDate(season.first_match_at)}` : "Deadline to be announced"}</small>
          <button className="primary-btn" disabled={saving || !hasLineup} onClick={saveTactics}>{saving ? "Saving…" : "Save tactics"}</button>
        </div>
      </div>
      {!hasLineup && <div className="tactics-warning"><strong>Save your lineup first.</strong><span>Tactics are attached to your current team selection.</span></div>}
      {message && <div className={message.includes("saved") ? "tactics-success" : "tactics-warning"}>{message}</div>}
      <div className="tactics-layout">
        <div className="tactics-groups">
          {tacticGroups.map((group) => (
            <article className="tactic-group" key={group.key}>
              <div><h3>{group.label}</h3><p>{group.description}</p></div>
              <div className="tactic-options">
                {group.options.map(([value, label]) => <button key={value} className={tactics[group.key] === value ? "active" : ""} onClick={() => { setTactics((current) => ({ ...current, [group.key]: value })); setMessage(""); }}>{label}</button>)}
              </div>
            </article>
          ))}
        </div>
        <aside className="tactics-summary">
          <span className="eyebrow">Tactical identity</span><h3>{styleName}</h3>
          <div className="tactic-board"><i className="line forwards" /><i className="line midfield" /><i className="line defence" /></div>
          <dl>{tacticGroups.map((group) => <div key={group.key}><dt>{group.label}</dt><dd>{group.options.find(([value]) => value === tactics[group.key])?.[1]}</dd></div>)}</dl>
          <p>More aggressive settings can create chances but increase fatigue and leave space for opponents.</p>
        </aside>
      </div>
    </section>
  );
}

const eventLabel = (event) => {
  const labels = {
    goal: "Goal",
    yellow_card: "Yellow card",
    red_card: "Red card",
    substitution: "Substitution",
    injury: "Injury",
    missed_penalty: "Penalty missed",
  };
  return labels[event.event_type] || event.event_type?.replaceAll("_", " ") || "Match event";
};

function MatchCentre({ data, loading, error, onClose }) {
  const fixture = data?.fixture;
  const match = data?.simulation;
  const events = data?.events || [];
  const explanation = match?.explanation;
  const summary = typeof explanation === "string"
    ? explanation
    : explanation?.summary || explanation?.narrative || explanation?.key_factor;
  const stats = match ? [
    ["Possession", match.home_possession, match.away_possession, "%"],
    ["Shots", match.home_shots, match.away_shots],
    ["Shots on target", match.home_shots_on_target, match.away_shots_on_target],
    ["Expected goals", match.home_xg, match.away_xg],
    ["Corners", match.home_corners, match.away_corners],
    ["Fouls", match.home_fouls, match.away_fouls],
    ["Yellow cards", match.home_yellow, match.away_yellow],
    ["Red cards", match.home_red, match.away_red],
  ] : [];

  return (
    <div className="match-modal-backdrop" onClick={onClose}>
      <section className="match-centre" role="dialog" aria-modal="true" aria-label="Match centre" onClick={(e) => e.stopPropagation()}>
        <button className="match-close" onClick={onClose} aria-label="Close match centre">×</button>
        {loading ? <div className="match-loading">Loading match centre…</div> : error ? (
          <div className="match-error"><strong>Could not load this match.</strong><span>{error}</span></div>
        ) : match ? (
          <>
            <header className="match-header">
              <span className="eyebrow">Full time · Round {fixture.round_number}</span>
              <small>{fixtureDate(fixture.scheduled_at)}</small>
              <div className="match-scoreboard">
                <strong>{fixture.home_club_name}</strong>
                <b>{match.home_goals} <i>–</i> {match.away_goals}</b>
                <strong>{fixture.away_club_name}</strong>
              </div>
            </header>
            <div className="match-content">
              <div className="match-main">
                <div className="match-section-head"><span className="eyebrow">Match statistics</span><h3>How the game unfolded</h3></div>
                <div className="match-stats">
                  {stats.map(([label, home, away, suffix = ""]) => {
                    const total = Number(home || 0) + Number(away || 0);
                    const width = total ? (Number(home || 0) / total) * 100 : 50;
                    return <div className="match-stat" key={label}>
                      <div><strong>{home ?? "—"}{home !== null && home !== undefined ? suffix : ""}</strong><span>{label}</span><strong>{away ?? "—"}{away !== null && away !== undefined ? suffix : ""}</strong></div>
                      <div className="stat-track"><i style={{ width: `${width}%` }} /></div>
                    </div>;
                  })}
                </div>
                {summary && <div className="match-report"><span className="eyebrow">Match report</span><p>{summary}</p></div>}
              </div>
              <aside className="match-timeline">
                <div className="match-section-head"><span className="eyebrow">Timeline</span><h3>Key events</h3></div>
                {events.length ? events.map((event) => (
                  <div className={`timeline-event ${event.club_id === fixture.home_club_id ? "home-event" : "away-event"}`} key={event.id}>
                    <b>{event.minute}'</b><div><strong>{eventLabel(event)}</strong><span>{event.player_name || "Team event"}{event.related_player_name ? ` · ${event.related_player_name}` : ""}</span></div>
                  </div>
                )) : <div className="timeline-empty">No individual match events were recorded.</div>}
              </aside>
            </div>
          </>
        ) : <div className="match-error"><strong>Match data is not available yet.</strong><span>The full report will appear after the simulation completes.</span></div>}
      </section>
    </div>
  );
}

function FixturesPage({ fixtures, loading }) {
  const [filter, setFilter] = useState("upcoming");
  const [matchCentre, setMatchCentre] = useState(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState("");
  async function openMatch(fixtureId) {
    setMatchCentre({});
    setMatchLoading(true);
    setMatchError("");
    const { data, error } = await supabase.rpc("get_my_match_centre", { p_fixture_id: fixtureId });
    setMatchLoading(false);
    if (error) return setMatchError(error.message);
    setMatchCentre(data);
  }
  const completed = (fixture) =>
    fixture.home_goals !== null && fixture.home_goals !== undefined;
  const nextFixture = fixtures.find((fixture) => !completed(fixture));
  const visibleFixtures = fixtures.filter((fixture) =>
    filter === "all"
      ? true
      : filter === "results"
        ? completed(fixture)
        : !completed(fixture),
  );

  if (loading)
    return <div className="fixtures-loading">Loading your fixtures…</div>;

  return (
    <section className="fixtures-page">
      {nextFixture && (
        <div className="next-fixture">
          <div className="next-fixture-copy">
            <span className="eyebrow">Next match · Round {nextFixture.round_number}</span>
            <h2>{nextFixture.venue === "home" ? "Home" : "Away"} vs {nextFixture.opponent_name}</h2>
            <p>{fixtureDate(nextFixture.scheduled_at)} · {nextFixture.competition_type || "League"}</p>
          </div>
          <div className="deadline-card">
            <span>Lineup deadline</span>
            <strong>{fixtureDate(nextFixture.deadline_at)}</strong>
            <small className={nextFixture.has_lineup ? "is-ready" : ""}>
              {nextFixture.has_lineup ? "✓ Lineup submitted" : "Lineup not submitted"}
            </small>
          </div>
        </div>
      )}

      <div className="fixtures-toolbar">
        <div>
          <span className="eyebrow">Season schedule</span>
          <h2>Fixtures &amp; results</h2>
        </div>
        <div className="fixture-tabs" aria-label="Filter fixtures">
          {[['upcoming', 'Upcoming'], ['results', 'Results'], ['all', 'All']].map(([value, label]) => (
            <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>
          ))}
        </div>
      </div>

      {visibleFixtures.length ? (
        <div className="fixture-list">
          {visibleFixtures.map((fixture) => {
            const played = completed(fixture);
            return (
              <article className="fixture-card" key={fixture.id}>
                <div className="fixture-meta">
                  <span>Round {fixture.round_number}</span>
                  <strong>{fixtureDate(fixture.scheduled_at, false)}</strong>
                  <small>{fixture.scheduled_at ? new Date(fixture.scheduled_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "TBA"}</small>
                </div>
                <div className="fixture-teams">
                  <div><span>Home</span><strong>{fixture.home_club_name}</strong></div>
                  <div className={`fixture-score${played ? " played" : ""}`}>
                    {played ? `${fixture.home_goals} – ${fixture.away_goals}` : "VS"}
                  </div>
                  <div className="away-team"><span>Away</span><strong>{fixture.away_club_name}</strong></div>
                </div>
                <div className="fixture-state">
                  {played ? (
                    <>
                      <b className={`result-badge result-${fixture.result?.toLowerCase()}`}>{fixture.result}</b>
                      <small>{fixture.home_shots ?? "—"}–{fixture.away_shots ?? "—"} shots · {fixture.home_xg ?? "—"}–{fixture.away_xg ?? "—"} xG</small>
                      <button className="match-centre-btn" onClick={() => openMatch(fixture.id)}>Match centre</button>
                    </>
                  ) : (
                    <>
                      <b>{fixture.venue === "home" ? "Home" : "Away"}</b>
                      <small>{fixture.has_lineup ? "Lineup ready" : `Deadline ${fixtureDate(fixture.deadline_at)}`}</small>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state fixtures-empty">
          <strong>{fixtures.length ? `No ${filter} fixtures.` : "Fixtures have not been scheduled yet."}</strong>
          <span>Your schedule will appear here when the season calendar is generated.</span>
        </div>
      )}
      {matchCentre && <MatchCentre data={matchCentre} loading={matchLoading} error={matchError} onClose={() => setMatchCentre(null)} />}
    </section>
  );
}

function LeagueTablePage({ data, loading }) {
  if (loading)
    return <div className="table-loading">Loading league standings…</div>;

  const league = data?.league;
  const standings = data?.standings || [];
  if (!league)
    return (
      <div className="empty-state table-empty">
        <strong>Your club has not joined a league yet.</strong>
        <span>The table will appear as soon as league placement is complete.</span>
      </div>
    );

  const zone = (row) => {
    const automatic = Number(league.automatic_promotion_places || league.promotion_places || 0);
    const playoffs = Number(league.playoff_places || 0);
    const relegation = Number(league.relegation_places || 0);
    if (row.position <= automatic) return "promotion";
    if (row.position <= automatic + playoffs) return "playoff";
    if (relegation && row.position > standings.length - relegation) return "relegation";
    return "";
  };

  return (
    <section className="league-page">
      <div className="league-heading">
        <div>
          <span className="eyebrow">Tier {league.tier}</span>
          <h2>{league.name}</h2>
          <p>{standings.length} clubs · Three points for a win</p>
        </div>
        <div className="league-key">
          {!!Number(league.promotion_places) && <span><i className="key-promotion" />Promotion</span>}
          {!!Number(league.playoff_places) && <span><i className="key-playoff" />Playoffs</span>}
          {!!Number(league.relegation_places) && <span><i className="key-relegation" />Relegation</span>}
        </div>
      </div>
      <div className="league-table-wrap">
        <table className="league-table">
          <thead><tr><th>Pos</th><th>Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr></thead>
          <tbody>
            {standings.map((row) => (
              <tr key={row.club_id} className={`${row.is_my_club ? "my-club" : ""} ${zone(row)}`}>
                <td><span className="position-cell">{row.position}</span></td>
                <td className="club-cell"><strong>{row.club_name}</strong>{row.is_my_club && <small>You</small>}</td>
                <td>{row.played}</td><td>{row.won}</td><td>{row.drawn}</td><td>{row.lost}</td>
                <td>{row.goals_for}</td><td>{row.goals_against}</td>
                <td>{Number(row.goal_difference) > 0 ? `+${row.goal_difference}` : row.goal_difference}</td>
                <td className="points-cell">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="table-note">Teams level on points are separated by goal difference, then goals scored.</p>
    </section>
  );
}

export default function App() {
  const [session, setSession] = useState(null),
    [authReady, setAuthReady] = useState(false),
    [state, setState] = useState(null),
    [auctions, setAuctions] = useState([]),
    [squad, setSquad] = useState([]),
    [loading, setLoading] = useState(true),
    [fixtures, setFixtures] = useState([]),
    [fixturesLoading, setFixturesLoading] = useState(false),
    [leagueTable, setLeagueTable] = useState(null),
    [leagueLoading, setLeagueLoading] = useState(false),
    [playerProfile, setPlayerProfile] = useState(null),
    [profileLoading, setProfileLoading] = useState(false),
    [profileError, setProfileError] = useState(""),
    [message, setMessage] = useState(""),
    [bid, setBid] = useState({}),
    [bidding, setBidding] = useState(null),
    [withdrawing, setWithdrawing] = useState(null),
    [tick, setTick] = useState(0),
    [selected, setSelected] = useState(null),
    [history, setHistory] = useState([]),
    [query, setQuery] = useState(""),
    [positionFilter, setPositionFilter] = useState("ALL"),
    [seasonFilter, setSeasonFilter] = useState("ALL"),
    [clubFilter, setClubFilter] = useState("ALL"),
    [show, setShow] = useState("all"),
    [sort, setSort] = useState("ending"),
    [marketView, setMarketView] = useState("list"),
    [expandedAuction, setExpandedAuction] = useState(null),
    [auctionStage, setAuctionStage] = useState(0),
    [auctionTotal, setAuctionTotal] = useState(0),
    [auctionLoading, setAuctionLoading] = useState(false),
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
  async function fetchAuctionPlayers(stage) {
    const stages = stage === 0 ? [1, 2, 3, 4] : [stage];
    const responses = await Promise.all(stages.map((item) => supabase.rpc("get_auction_room", { p_stage: item })));
    return {
      data: responses.flatMap((response) => response.data || []),
      error: responses.find((response) => response.error)?.error,
    };
  }
  async function refresh(activeSession = session) {
    setLoading(true);
    const { data, error } = await supabase.rpc(
      activeSession ? "get_my_game_state" : "get_public_season_state",
    );
    if (error) setMessage(error.message);
    setState(data);
    if (activeSession) {
      const { data: squadItems, error: squadError } = await supabase.rpc("get_my_squad");
      if (squadError) setMessage(squadError.message);
      setSquad(squadItems || []);
      setFixturesLoading(true);
      const { data: fixtureItems, error: fixtureError } = await supabase.rpc("get_my_fixtures");
      if (fixtureError) setMessage(fixtureError.message);
      setFixtures(fixtureItems || []);
      setFixturesLoading(false);
      setLeagueLoading(true);
      const { data: tableData, error: tableError } = await supabase.rpc("get_my_league_table");
      if (tableError) setMessage(tableError.message);
      setLeagueTable(tableData || null);
      setLeagueLoading(false);
      const { data: items, error: auctionError } = await fetchAuctionPlayers(auctionStage);
      if (auctionError) setMessage(auctionError.message);
      setAuctions(items || []);
      if (auctionStage === 0) setAuctionTotal((items || []).length);
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
  async function changeAuctionStage(stage) {
    setAuctionStage(stage);
    setAuctionLoading(true);
    setSelected(null);
    setHistory([]);
    const { data, error } = await fetchAuctionPlayers(stage);
    if (error) setMessage(error.message);
    setAuctions(data || []);
    if (stage === 0) setAuctionTotal((data || []).length);
    setAuctionLoading(false);
  }
  async function openPlayerProfile(playerSeasonId) {
    setPlayerProfile({});
    setProfileLoading(true);
    setProfileError("");
    const { data, error } = await supabase.rpc("get_player_profile", { p_player_season_id: playerSeasonId });
    setProfileLoading(false);
    if (error) return setProfileError(error.message);
    setPlayerProfile(data);
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
  async function removeBid(a) {
    if (!window.confirm(`Remove your bid on ${name(a)}? Your reserved budget will be released immediately.`)) return;
    setWithdrawing(a.id);
    setMessage("");
    const { data, error } = await supabase.rpc("withdraw_my_auction_bid", {
      p_auction_id: a.id,
    });
    if (error) {
      setMessage(error.message);
    } else {
      setBid((current) => ({ ...current, [a.id]: "" }));
      setMessage(
        data?.current_winner_club_id
          ? "Your bid was removed. The next eligible bidder is now leading."
          : "Your bid was removed and your reserved budget has been released.",
      );
      await refresh(true);
      if (selected === a.id) await loadHistory(a.id, true);
    }
    setWithdrawing(null);
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
      auctions
        .filter((a) => {
          const q = query.trim().toLowerCase();
          return (
            (!q ||
              name(a).toLowerCase().includes(q) ||
              (a.player_seasons?.clubs?.name || "")
                .toLowerCase()
                .includes(q) ||
              (a.player_seasons?.season_label || "").toLowerCase().includes(q)) &&
            (positionFilter === "ALL" || position(a) === positionFilter) &&
            (seasonFilter === "ALL" || a.player_seasons?.season_label === seasonFilter) &&
            (clubFilter === "ALL" || a.player_seasons?.clubs?.name === clubFilter) &&
            (show === "all" ||
              (show === "winning" &&
                a.current_winner_club_id === state?.club?.id) ||
              (show === "live" && a.status === "live") ||
              (show === "watched" && watchlist.includes(a.id)))
          );
        })
        .sort((a, b) => {
          if (sort === "price-low")
            return (
              Number(a.current_price_pence || a.reserve_price_pence) -
              Number(b.current_price_pence || b.reserve_price_pence)
            );
          if (sort === "price-high")
            return (
              Number(b.current_price_pence || b.reserve_price_pence) -
              Number(a.current_price_pence || a.reserve_price_pence)
            );
          if (sort === "rating")
            return (
              Number(b.player_seasons?.overall_rating || 0) -
              Number(a.player_seasons?.overall_rating || 0)
            );
          if (sort === "name") return name(a).localeCompare(name(b));
          if (sort === "position")
            return position(a).localeCompare(position(b)) || name(a).localeCompare(name(b));
          return (
            new Date(a.ends_at || "9999-12-31") -
            new Date(b.ends_at || "9999-12-31")
          );
        }),
    [
      auctions,
      query,
      positionFilter,
      seasonFilter,
      clubFilter,
      show,
      sort,
      state?.club?.id,
      watchlist,
      tick,
    ],
  );
  const availableSeasons = [...new Set(auctions.map((a) => a.player_seasons?.season_label).filter(Boolean))].sort().reverse();
  const availableHistoricalClubs = useMemo(() => [...new Set(
    auctions
      .filter((a) => seasonFilter === "ALL" || a.player_seasons?.season_label === seasonFilter)
      .map((a) => a.player_seasons?.clubs?.name)
      .filter(Boolean),
  )].sort((a, b) => a.localeCompare(b)), [auctions, seasonFilter]);
  const selectedSquadTotal = clubFilter === "ALL" ? 0 : auctions.filter(
    (a) =>
      a.player_seasons?.clubs?.name === clubFilter &&
      (seasonFilter === "ALL" || a.player_seasons?.season_label === seasonFilter),
  ).length;
  useEffect(() => {
    if (clubFilter !== "ALL" && !availableHistoricalClubs.includes(clubFilter)) {
      setClubFilter("ALL");
    }
  }, [availableHistoricalClubs, clubFilter]);
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
                    : view === "tactics"
                      ? "Match strategy and playing style"
                    : view === "fixtures"
                      ? "Match schedule and results"
                      : view === "table"
                        ? "League position and season record"
                    : auctionStage === 0 ? "All player auctions · prices update live" : `Auction Day ${auctionStage} · prices update live`}
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
            My Squad <span>{squad.length}/17</span>
          </button>
          <button
            className={view === "lineup" ? "active" : ""}
            onClick={() => setView("lineup")}
          >
            Lineup
          </button>
          <button className={view === "tactics" ? "active" : ""} onClick={() => setView("tactics")}>Tactics</button>
          <button
            className={view === "fixtures" ? "active" : ""}
            onClick={() => setView("fixtures")}
          >
            Fixtures <span>{fixtures.length}</span>
          </button>
          <button
            className={view === "table" ? "active" : ""}
            onClick={() => setView("table")}
          >
            League Table
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
              <span>Market cards</span>
              <strong>{auctions.length}</strong>
              <small>Across selected auction days</small>
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
          <ProvisionalSquad
            players={squad}
            onOpenAuctions={() => setView("auctions")}
            onProfile={openPlayerProfile}
          />
        ) : view === "lineup" ? (
          <LineupPlanner
            season={season}
            players={squad}
            onOpenAuctions={() => setView("auctions")}
          />
        ) : view === "tactics" ? (
          <TacticsPage season={season} />
        ) : view === "fixtures" ? (
          <FixturesPage fixtures={fixtures} loading={fixturesLoading} />
        ) : view === "table" ? (
          <LeagueTablePage data={leagueTable} loading={leagueLoading} />
        ) : (
          <section className="section">
            <div className="auction-stage-panel">
              <div className="auction-stage-intro">
                <span className="eyebrow">Four-day player draft</span>
                <h2>Auction calendar</h2>
                <p>Every player starts on Day 1. Only unsold cards continue into the later auction days.</p>
              </div>
              <div className="auction-stage-tabs">
                <button className={auctionStage === 0 ? "active all-players" : "all-players"} onClick={() => changeAuctionStage(0)}>
                  <span>Full market</span><strong>All players</strong><small>{auctionTotal || auctions.length} cards</small>
                </button>
                {[1, 2, 3, 4].map((stage) => {
                  const stageState = auctionStageState(season, stage);
                  const start = auctionStageStart(season, stage);
                  return <button key={stage} className={`${auctionStage === stage ? "active" : ""} ${stageState}`} onClick={() => changeAuctionStage(stage)}>
                    <span>Day {stage}</span>
                    <strong>{stageState === "live" ? "Live now" : stageState === "complete" ? "Complete" : start ? new Date(start).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "TBA"}</strong>
                    <small>{stageState === "upcoming" ? (start ? `Opens ${new Date(start).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : "Schedule pending") : stageState === "live" ? "Bidding open" : "Bidding closed"}</small>
                  </button>;
                })}
              </div>
              <div className={`active-stage-status ${auctionStage === 0 ? "all" : auctionStageState(season, auctionStage)}`}>
                {auctionStage === 0 ? <><b>{auctionTotal || auctions.length} player-season cards</b><span>Use the season and position filters below or choose an auction day</span></> : <><b>{auctionStageState(season, auctionStage) === "live" ? "● Live" : auctionStageState(season, auctionStage) === "complete" ? "✓ Complete" : "◷ Upcoming"}</b><span>{auctionStageState(season, auctionStage) === "live" ? `${left(auctionStage === 4 ? season?.fixed_price_start : auctionStageStart(season, auctionStage + 1))} remaining` : auctionStageState(season, auctionStage) === "upcoming" ? `Opens in ${left(auctionStageStart(season, auctionStage)).replace("Starts after first bid", "TBA")}` : "Winning bids have been settled into squads"}</span></>}
              </div>
            </div>
            <div className="section-head">
              <div>
                <span className="eyebrow">Player market</span>
                <h2>
                  {clubFilter !== "ALL"
                    ? `${clubFilter}${seasonFilter !== "ALL" ? ` ${seasonFilter}` : ""} squad`
                    : auctionStage === 0
                      ? "All player cards"
                      : `Day ${auctionStage} player cards`}
                </h2>
              </div>
              <span className="results-count">
                {visible.length} player{visible.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="position-filter-bar" aria-label="Filter players by position">
              {[['ALL','All players'],['GK','Goalkeepers'],['CD','Defenders'],['MD','Midfielders'],['ATT','Forwards']].map(([value,label]) => <button key={value} className={positionFilter === value ? "active" : ""} onClick={() => setPositionFilter(value)}>{label}<span>{value === 'ALL' ? auctions.length : auctions.filter((a) => position(a) === value).length}</span></button>)}
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
                {[
                  { value: "GK", label: "Goalkeepers" },
                  { value: "CD", label: "Defenders" },
                  { value: "MD", label: "Midfielders" },
                  { value: "ATT", label: "Attackers" },
                ].map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select aria-label="Filter by historical season" value={seasonFilter} onChange={(e) => setSeasonFilter(e.target.value)}>
                <option value="ALL">All seasons</option>
                {availableSeasons.map((seasonLabel) => <option key={seasonLabel} value={seasonLabel}>{seasonLabel}</option>)}
              </select>
              <select aria-label="Filter by historical club" value={clubFilter} onChange={(e) => setClubFilter(e.target.value)}>
                <option value="ALL">All historical clubs</option>
                {availableHistoricalClubs.map((clubName) => <option key={clubName} value={clubName}>{clubName}</option>)}
              </select>
              <select
                aria-label="Sort auctions"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="ending">Ending soon</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
                <option value="rating">Highest rating</option>
                <option value="name">Player name</option>
                <option value="position">Position</option>
              </select>
              <div className="market-view-toggle" aria-label="Market view">
                <button className={marketView === "list" ? "active" : ""} onClick={() => setMarketView("list")}>☰ List</button>
                <button className={marketView === "cards" ? "active" : ""} onClick={() => setMarketView("cards")}>▦ Cards</button>
              </div>
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
            {clubFilter !== "ALL" && (
              <div className="historical-squad-summary">
                <div>
                  <span className="eyebrow">Historical squad</span>
                  <strong>{clubFilter} · {seasonFilter === "ALL" ? "All available seasons" : seasonFilter}</strong>
                  <small>{selectedSquadTotal} player-season card{selectedSquadTotal === 1 ? "" : "s"} in this squad</small>
                </div>
                <button className="secondary-btn" onClick={() => setClubFilter("ALL")}>Clear team</button>
              </div>
            )}
            {loading || auctionLoading ? (
              <div className="empty-state">Refreshing auctions…</div>
            ) : visible.length && marketView === "cards" ? (
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
                    removeBid={() => removeBid(a)}
                    removing={withdrawing === a.id}
                    busy={bidding === a.id}
                    open={selected === a.id}
                    history={history}
                    toggleHistory={() => loadHistory(a.id)}
                    watched={watchlist.includes(a.id)}
                    toggleWatch={() => toggleWatch(a.id)}
                    availablePence={available}
                    onProfile={openPlayerProfile}
                  />
                ))}
              </div>
            ) : visible.length ? (
              <div className="auction-list-view">
                <div className="auction-list-head">
                  <button onClick={() => setSort("name")}>Player {sort === "name" ? "↑" : ""}</button>
                  <button onClick={() => setSort("position")}>Position {sort === "position" ? "↑" : ""}</button>
                  <button onClick={() => setSort(sort === "price-low" ? "price-high" : "price-low")}>Price {sort === "price-low" ? "↑" : sort === "price-high" ? "↓" : ""}</button>
                  <span>Status</span><span>Ends</span><span />
                </div>
                {visible.map((a) => {
                  const isExpanded = expandedAuction === a.id;
                  const leading = a.current_winner_club_id === club.id;
                  return <article className={`auction-list-item${isExpanded ? " expanded" : ""}`} key={a.id}>
                    <button className="auction-list-row" onClick={() => setExpandedAuction(isExpanded ? null : a.id)} aria-expanded={isExpanded}>
                      <div className="list-player">
                        <span className="mini-position">{position(a)}</span>
                        <div className="list-player-copy">
                          <strong className="list-player-name" title={name(a)}>
                            <span>{compactName(a)}</span>
                            <em>{a.player_seasons?.season_label}</em>
                          </strong>
                          <small className="list-player-meta">
                            <span>{positionLabel(a)} · {a.player_seasons?.clubs?.name}</span>
                            <b>Rating {a.player_seasons?.overall_rating || "—"}</b>
                          </small>
                        </div>
                      </div>
                      <b>{positionLabel(a)}</b>
                      <strong>{money(a.current_price_pence || a.reserve_price_pence)}</strong>
                      <span className={leading ? "list-winning" : `list-${a.status}`}>{leading ? "Winning" : a.status}</span>
                      <span className="timer">{left(a.ends_at)}</span>
                      <i>{isExpanded ? "−" : "+"}</i>
                    </button>
                    {isExpanded && <div className="auction-list-detail"><AuctionCard auction={a} clubId={club.id} value={bid[a.id] ?? ""} setValue={(value) => setBid((current) => ({ ...current, [a.id]: value }))} placeBid={() => placeBid(a)}
                    removeBid={() => removeBid(a)}
                    removing={withdrawing === a.id} busy={bidding === a.id} open={selected === a.id} history={history} toggleHistory={() => loadHistory(a.id)} watched={watchlist.includes(a.id)} toggleWatch={() => toggleWatch(a.id)} availablePence={available} onProfile={openPlayerProfile} /></div>}
                  </article>;
                })}
              </div>
            ) : (
              <div className="empty-state">
                <strong>No auctions match those filters.</strong>
                <span>Try viewing all positions or clearing your search.</span>
              </div>
            )}
          </section>
        )}
        {playerProfile && <PlayerProfile data={playerProfile} loading={profileLoading} error={profileError} onClose={() => setPlayerProfile(null)} />}
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
