with current_game_season as (
  select gs.* from public.game_seasons gs order by gs.season_number desc limit 1
), ranked_base as (
  select ps.id,
    ntile(4) over(partition by ps.game_position order by ps.market_value_pence desc, ps.overall_rating desc, ps.id) as band,
    row_number() over(partition by ps.game_position order by ps.market_value_pence desc, ps.overall_rating desc, ps.id) as rn
  from public.player_seasons ps
  where ps.is_eligible and ps.market_value_pence is not null
), ranked as (
  select rb.id, (1 + mod((rb.band - 1) + (rb.rn - 1), 4))::smallint as stage
  from ranked_base rb
)
insert into public.auctions (
  player_season_id, stage, status, reserve_price_pence, current_price_pence,
  starts_at, ends_at, game_season_id
)
select ps.id,
  ranked.stage,
  'scheduled',
  ps.market_value_pence,
  ps.market_value_pence,
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
    ntile(4) over(partition by ps.game_position order by ps.market_value_pence desc, ps.overall_rating desc, ps.id) as band,
    row_number() over(partition by ps.game_position order by ps.market_value_pence desc, ps.overall_rating desc, ps.id) as rn
  from public.player_seasons ps
  where ps.is_eligible and ps.market_value_pence is not null
), ranked as (
  select rb.id, (1 + mod((rb.band - 1) + (rb.rn - 1), 4))::smallint as stage
  from ranked_base rb
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
  and a.status = 'scheduled' and a.first_bid_at is null;

create or replace function public.get_auction_room(p_stage smallint default 1)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  l_result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_stage not between 1 and 4 then raise exception 'Invalid auction stage'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'stage', a.stage,
    'status', a.status,
    'reserve_price_pence', a.reserve_price_pence,
    'current_price_pence', a.current_price_pence,
    'current_winner_club_id', a.current_winner_club_id,
    'ends_at', a.ends_at,
    'min_increment_pence', a.min_increment_pence,
    'player_seasons', jsonb_build_object(
      'id', ps.id,
      'game_position', ps.game_position,
      'overall_rating', ps.overall_rating,
      'season_label', s.label,
      'players', jsonb_build_object('full_name', p.full_name),
      'clubs', jsonb_build_object('name', c.name)
    )
  ) order by coalesce(a.current_price_pence, a.reserve_price_pence) desc, p.full_name, s.start_year desc), '[]'::jsonb)
  into l_result
  from public.auctions a
  join public.player_seasons ps on ps.id = a.player_season_id
  join public.players p on p.id = ps.player_id
  join public.clubs c on c.id = ps.primary_club_id
  join public.competition_seasons cs on cs.id = ps.competition_season_id
  join public.seasons s on s.id = cs.season_id
  where a.stage = p_stage and a.status in ('scheduled','live');

  return l_result;
end;
$$;

revoke all on function public.get_auction_room(smallint) from public, anon;
grant execute on function public.get_auction_room(smallint) to authenticated;
