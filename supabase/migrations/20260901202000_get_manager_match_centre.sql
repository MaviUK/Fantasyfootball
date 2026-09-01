create or replace function public.get_my_match_centre(p_fixture_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  l_user_id uuid := auth.uid();
  l_club_id uuid;
  l_result jsonb;
begin
  if l_user_id is null then
    raise exception 'Authentication required';
  end if;

  select gc.id into l_club_id
  from public.game_clubs gc
  where gc.user_id = l_user_id
  limit 1;

  if l_club_id is null then
    raise exception 'Club not found';
  end if;

  select jsonb_build_object(
    'fixture', jsonb_build_object(
      'id', f.id,
      'round_number', f.round_number,
      'competition_type', f.competition_type,
      'scheduled_at', f.scheduled_at,
      'status', f.status,
      'home_club_id', f.home_club_id,
      'away_club_id', f.away_club_id,
      'home_club_name', home_club.name,
      'away_club_name', away_club.name
    ),
    'simulation', case when sim.id is null then null else jsonb_build_object(
      'id', sim.id,
      'home_goals', sim.home_goals,
      'away_goals', sim.away_goals,
      'home_xg', sim.home_xg,
      'away_xg', sim.away_xg,
      'home_possession', sim.home_possession,
      'away_possession', sim.away_possession,
      'home_shots', sim.home_shots,
      'away_shots', sim.away_shots,
      'home_shots_on_target', sim.home_shots_on_target,
      'away_shots_on_target', sim.away_shots_on_target,
      'home_corners', sim.home_corners,
      'away_corners', sim.away_corners,
      'home_fouls', sim.home_fouls,
      'away_fouls', sim.away_fouls,
      'home_yellow', sim.home_yellow,
      'away_yellow', sim.away_yellow,
      'home_red', sim.home_red,
      'away_red', sim.away_red,
      'explanation', sim.explanation,
      'created_at', sim.created_at
    ) end,
    'events', coalesce(events.items, '[]'::jsonb)
  )
  into l_result
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
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', me.id,
        'minute', me.minute,
        'event_type', me.event_type,
        'club_id', me.club_id,
        'player_name', player.full_name,
        'related_player_name', related_player.full_name,
        'detail', me.detail
      ) order by me.minute, me.created_at
    ) as items
    from public.match_events me
    left join public.player_seasons ps on ps.id = me.player_season_id
    left join public.players player on player.id = ps.player_id
    left join public.player_seasons related_ps on related_ps.id = me.related_player_season_id
    left join public.players related_player on related_player.id = related_ps.player_id
    where me.simulation_id = sim.id
  ) events on true
  where f.id = p_fixture_id
    and (f.home_club_id = l_club_id or f.away_club_id = l_club_id);

  if l_result is null then
    raise exception 'Match not found';
  end if;

  return l_result;
end;
$$;

revoke all on function public.get_my_match_centre(uuid) from public, anon;
grant execute on function public.get_my_match_centre(uuid) to authenticated;
