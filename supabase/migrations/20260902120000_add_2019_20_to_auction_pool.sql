-- Include every eligible historical card, including the newly imported 2019/20 season,
-- and rebalance unsold scheduled cards evenly across the four auction stages.
with current_game_season as (
  select gs.* from public.game_seasons gs order by gs.season_number desc limit 1
), ranked_base as (
  select ps.id,
    ntile(4) over (
      partition by ps.game_position
      order by ps.market_value_pence desc, ps.overall_rating desc, ps.id
    ) as band,
    row_number() over (
      partition by ps.game_position
      order by ps.market_value_pence desc, ps.overall_rating desc, ps.id
    ) as rn
  from public.player_seasons ps
  where ps.is_eligible and ps.market_value_pence is not null
), ranked as (
  select id, (1 + mod((band - 1) + (rn - 1), 4))::smallint as stage
  from ranked_base
)
insert into public.auctions (
  player_season_id, stage, status, reserve_price_pence, current_price_pence,
  starts_at, ends_at, game_season_id
)
select ps.id, ranked.stage, 'scheduled', ps.market_value_pence, ps.market_value_pence,
  case ranked.stage
    when 1 then gs.auction_day1_start
    when 2 then gs.auction_day2_start
    when 3 then gs.auction_day3_start
    when 4 then gs.auction_day4_start
  end,
  case ranked.stage
    when 1 then gs.auction_day2_start
    when 2 then gs.auction_day3_start
    when 3 then gs.auction_day4_start
    when 4 then gs.fixed_price_start
  end,
  gs.id
from public.player_seasons ps
join ranked on ranked.id = ps.id
cross join current_game_season gs
where ps.is_eligible
  and ps.market_value_pence is not null
  and not exists (select 1 from public.auctions a where a.player_season_id = ps.id)
on conflict (player_season_id) do nothing;

with current_game_season as (
  select gs.* from public.game_seasons gs order by gs.season_number desc limit 1
), ranked_base as (
  select ps.id,
    ntile(4) over (
      partition by ps.game_position
      order by ps.market_value_pence desc, ps.overall_rating desc, ps.id
    ) as band,
    row_number() over (
      partition by ps.game_position
      order by ps.market_value_pence desc, ps.overall_rating desc, ps.id
    ) as rn
  from public.player_seasons ps
  where ps.is_eligible and ps.market_value_pence is not null
), ranked as (
  select id, (1 + mod((band - 1) + (rn - 1), 4))::smallint as stage
  from ranked_base
)
update public.auctions a set
  stage = ranked.stage,
  starts_at = case ranked.stage
    when 1 then gs.auction_day1_start
    when 2 then gs.auction_day2_start
    when 3 then gs.auction_day3_start
    when 4 then gs.auction_day4_start
  end,
  ends_at = case ranked.stage
    when 1 then gs.auction_day2_start
    when 2 then gs.auction_day3_start
    when 3 then gs.auction_day4_start
    when 4 then gs.fixed_price_start
  end,
  game_season_id = gs.id,
  updated_at = now()
from current_game_season gs, ranked
where ranked.id = a.player_season_id
  and a.status = 'scheduled'
  and a.first_bid_at is null;
