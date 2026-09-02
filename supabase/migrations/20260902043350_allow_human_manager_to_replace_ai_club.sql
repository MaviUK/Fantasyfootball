create or replace function public.create_my_game_club(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_uid uuid := auth.uid();
  l_club_id uuid;
  l_season_id uuid;
  l_league_id uuid;
  l_member_count integer;
begin
  if l_uid is null then
    raise exception 'Authentication required';
  end if;

  if length(btrim(p_name)) not between 2 and 40 then
    raise exception 'Club name must be 2 to 40 characters';
  end if;

  select gc.id
  into l_club_id
  from public.game_clubs gc
  where gc.user_id = l_uid
  limit 1;

  if l_club_id is not null then
    return l_club_id;
  end if;

  select gs.id
  into l_season_id
  from public.game_seasons gs
  where gs.status in ('scheduled', 'auction', 'active')
  order by gs.season_number desc
  limit 1;

  if l_season_id is null then
    raise exception 'No joinable game season';
  end if;

  select l.id
  into l_league_id
  from public.leagues l
  where l.game_season_id = l_season_id
    and l.tier = 1
    and l.league_number = 1
  order by l.created_at
  limit 1
  for update;

  if l_league_id is null then
    raise exception 'Premier Division is not ready';
  end if;

  -- AI clubs are placeholders. Reusing the row preserves fixtures and league
  -- membership while giving a new manager a clean £100m starting position.
  select gc.id
  into l_club_id
  from public.game_clubs gc
  join public.league_members lm on lm.game_club_id = gc.id
  where lm.league_id = l_league_id
    and gc.manager_type = 'ai'
    and gc.user_id is null
  order by lm.seeded_order desc, gc.created_at
  limit 1
  for update of gc skip locked;

  if l_club_id is not null then
    update public.game_clubs
    set name = btrim(p_name),
        manager_type = 'human',
        user_id = l_uid,
        budget_pence = 10000000000,
        reserved_pence = 0,
        squad_limit = 17,
        updated_at = now()
    where id = l_club_id;

    delete from public.ai_club_strategies
    where game_club_id = l_club_id;

    return l_club_id;
  end if;

  select count(*)
  into l_member_count
  from public.league_members lm
  where lm.league_id = l_league_id;

  if l_member_count >= 20 then
    raise exception 'Premier Division is full';
  end if;

  insert into public.game_clubs (
    name, manager_type, user_id, budget_pence, reserved_pence, squad_limit
  )
  values (
    btrim(p_name), 'human', l_uid, 10000000000, 0, 17
  )
  returning id into l_club_id;

  insert into public.league_members (league_id, game_club_id, seeded_order)
  values (l_league_id, l_club_id, (l_member_count + 1)::smallint);

  return l_club_id;
end;
$$;

revoke all on function public.create_my_game_club(text) from public, anon;
grant execute on function public.create_my_game_club(text) to authenticated;
