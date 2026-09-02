create or replace function public.get_my_game_state()
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
  select jsonb_build_object(
    'club', (
      select jsonb_build_object(
        'id', gc.id,
        'name', gc.name,
        'budget_pence', gc.budget_pence,
        'reserved_pence', gc.reserved_pence,
        'squad_limit', gc.squad_limit
      )
      from public.game_clubs gc
      where gc.user_id = auth.uid()
      limit 1
    ),
    'season', (
      select jsonb_build_object(
        'id', gs.id,
        'name', gs.name,
        'season_number', gs.season_number,
        'status', gs.status,
        'starts_at', gs.starts_at,
        'auction_day1_start', gs.auction_day1_start,
        'auction_day2_start', gs.auction_day2_start,
        'auction_day3_start', gs.auction_day3_start,
        'auction_day4_start', gs.auction_day4_start,
        'fixed_price_start', gs.fixed_price_start,
        'squad_deadline', gs.squad_deadline,
        'first_match_at', gs.first_match_at
      )
      from public.game_seasons gs
      order by gs.season_number desc
      limit 1
    )
  )
$function$;

create or replace function public.get_public_season_state()
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
  select jsonb_build_object(
    'season', (
      select jsonb_build_object(
        'id', gs.id,
        'name', gs.name,
        'season_number', gs.season_number,
        'status', gs.status,
        'starts_at', gs.starts_at,
        'auction_day1_start', gs.auction_day1_start,
        'auction_day2_start', gs.auction_day2_start,
        'auction_day3_start', gs.auction_day3_start,
        'auction_day4_start', gs.auction_day4_start,
        'fixed_price_start', gs.fixed_price_start,
        'squad_deadline', gs.squad_deadline,
        'first_match_at', gs.first_match_at
      )
      from public.game_seasons gs
      order by gs.season_number desc
      limit 1
    ),
    'premier_members', (
      select count(*)
      from public.league_members lm
      join public.leagues l on l.id = lm.league_id
      where l.game_season_id = (
        select id from public.game_seasons order by season_number desc limit 1
      )
      and l.tier = 1
      and l.league_number = 1
    )
  )
$function$;
