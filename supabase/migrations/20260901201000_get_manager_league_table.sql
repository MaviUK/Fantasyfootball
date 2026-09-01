create or replace function public.get_my_league_table()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  l_user_id uuid := auth.uid();
  l_club_id uuid;
  l_league public.leagues%rowtype;
  l_table jsonb;
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

  select l.*
  into l_league
  from public.league_members lm
  join public.leagues l on l.id = lm.league_id
  where lm.game_club_id = l_club_id
  order by l.created_at desc
  limit 1;

  if l_league.id is null then
    return jsonb_build_object('league', null, 'standings', '[]'::jsonb);
  end if;

  with ranked as (
    select
      gc.id,
      gc.name,
      coalesce(ls.played, 0) as played,
      coalesce(ls.won, 0) as won,
      coalesce(ls.drawn, 0) as drawn,
      coalesce(ls.lost, 0) as lost,
      coalesce(ls.goals_for, 0) as goals_for,
      coalesce(ls.goals_against, 0) as goals_against,
      coalesce(ls.goal_difference, 0) as goal_difference,
      coalesce(ls.points, 0) as points,
      row_number() over (
        order by coalesce(ls.points, 0) desc,
          coalesce(ls.goal_difference, 0) desc,
          coalesce(ls.goals_for, 0) desc,
          lm.seeded_order asc,
          gc.name asc
      ) as position
    from public.league_members lm
    join public.game_clubs gc on gc.id = lm.game_club_id
    left join public.league_standings ls
      on ls.league_id = lm.league_id and ls.game_club_id = lm.game_club_id
    where lm.league_id = l_league.id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'position', r.position,
        'club_id', r.id,
        'club_name', r.name,
        'played', r.played,
        'won', r.won,
        'drawn', r.drawn,
        'lost', r.lost,
        'goals_for', r.goals_for,
        'goals_against', r.goals_against,
        'goal_difference', r.goal_difference,
        'points', r.points,
        'is_my_club', r.id = l_club_id
      ) order by r.position
    ),
    '[]'::jsonb
  )
  into l_table
  from ranked r;

  return jsonb_build_object(
    'league', jsonb_build_object(
      'id', l_league.id,
      'name', l_league.name,
      'tier', l_league.tier,
      'team_count', l_league.team_count,
      'promotion_places', l_league.promotion_places,
      'automatic_promotion_places', l_league.automatic_promotion_places,
      'playoff_places', l_league.playoff_places,
      'relegation_places', l_league.relegation_places
    ),
    'standings', l_table
  );
end;
$$;

revoke all on function public.get_my_league_table() from public, anon;
grant execute on function public.get_my_league_table() to authenticated;
