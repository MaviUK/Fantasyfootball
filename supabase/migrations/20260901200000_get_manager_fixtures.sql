create or replace function public.get_my_fixtures()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  l_user_id uuid := auth.uid();
  l_club_id uuid;
  l_season_id uuid;
  l_fixtures jsonb;
begin
  if l_user_id is null then
    raise exception 'Authentication required';
  end if;

  select gc.id
  into l_club_id
  from public.game_clubs gc
  where gc.user_id = l_user_id
  limit 1;

  if l_club_id is null then
    raise exception 'Club not found';
  end if;

  select gs.id
  into l_season_id
  from public.game_seasons gs
  order by gs.season_number desc
  limit 1;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', f.id,
        'competition_type', f.competition_type,
        'round_number', f.round_number,
        'match_slot', f.match_slot,
        'scheduled_at', f.scheduled_at,
        'deadline_at', f.deadline_at,
        'status', f.status,
        'locked_at', f.locked_at,
        'venue', case when f.home_club_id = l_club_id then 'home' else 'away' end,
        'opponent_id', case when f.home_club_id = l_club_id then f.away_club_id else f.home_club_id end,
        'opponent_name', case when f.home_club_id = l_club_id then away_club.name else home_club.name end,
        'home_club_name', home_club.name,
        'away_club_name', away_club.name,
        'has_lineup', case when f.home_club_id = l_club_id then f.home_lineup_id is not null else f.away_lineup_id is not null end,
        'home_goals', sim.home_goals,
        'away_goals', sim.away_goals,
        'home_xg', sim.home_xg,
        'away_xg', sim.away_xg,
        'home_possession', sim.home_possession,
        'away_possession', sim.away_possession,
        'home_shots', sim.home_shots,
        'away_shots', sim.away_shots,
        'result', case
          when sim.id is null then null
          when sim.home_goals = sim.away_goals then 'D'
          when (f.home_club_id = l_club_id and sim.home_goals > sim.away_goals)
            or (f.away_club_id = l_club_id and sim.away_goals > sim.home_goals) then 'W'
          else 'L'
        end
      )
      order by f.scheduled_at asc, f.round_number asc, f.match_slot asc
    ),
    '[]'::jsonb
  )
  into l_fixtures
  from public.fixtures f
  join public.game_clubs home_club on home_club.id = f.home_club_id
  join public.game_clubs away_club on away_club.id = f.away_club_id
  left join lateral (
    select ms.*
    from public.match_simulations ms
    where ms.fixture_id = f.id
    order by ms.created_at desc
    limit 1
  ) sim on true
  where f.game_season_id = l_season_id
    and (f.home_club_id = l_club_id or f.away_club_id = l_club_id);

  return l_fixtures;
end;
$$;

revoke all on function public.get_my_fixtures() from public, anon;
grant execute on function public.get_my_fixtures() to authenticated;
