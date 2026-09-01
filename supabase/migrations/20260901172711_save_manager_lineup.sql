create or replace function public.save_my_lineup_draft(
  p_starters uuid[],
  p_bench uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_user_id uuid := auth.uid();
  l_club_id uuid;
  l_season_id uuid;
  l_lineup_id uuid;
  l_player_id uuid;
  l_slot smallint;
  l_starter_gk integer;
  l_bench_gk integer;
  l_total integer;
begin
  if l_user_id is null then raise exception 'Authentication required'; end if;
  if coalesce(cardinality(p_starters), 0) > 11 then raise exception 'A lineup can have at most 11 starters'; end if;
  if coalesce(cardinality(p_bench), 0) > 6 then raise exception 'A lineup can have at most 6 substitutes'; end if;

  select id into l_club_id from public.game_clubs where user_id = l_user_id limit 1;
  if l_club_id is null then raise exception 'Club not found'; end if;
  select id into l_season_id from public.game_seasons order by season_number desc limit 1;
  if l_season_id is null then raise exception 'Season not found'; end if;

  select count(distinct player_id),
    count(*) filter (where slot_type = 'starter' and game_position = 'GK'),
    count(*) filter (where slot_type = 'bench' and game_position = 'GK')
  into l_total, l_starter_gk, l_bench_gk
  from (
    select unnest(coalesce(p_starters, '{}'::uuid[])) player_id, 'starter'::text slot_type
    union all
    select unnest(coalesce(p_bench, '{}'::uuid[])), 'bench'::text
  ) picked
  join public.player_seasons ps on ps.id = picked.player_id;

  if l_total <> coalesce(cardinality(p_starters), 0) + coalesce(cardinality(p_bench), 0) then raise exception 'A player cannot occupy more than one lineup slot'; end if;
  if l_starter_gk > 1 then raise exception 'Only one starting goalkeeper is allowed'; end if;
  if l_bench_gk > 1 then raise exception 'Only one substitute goalkeeper is allowed'; end if;
  if exists (
    select 1 from unnest(coalesce(p_starters, '{}'::uuid[]) || coalesce(p_bench, '{}'::uuid[])) as chosen(player_id)
    where not exists (
      select 1 from public.squad_registrations sr
      where sr.game_season_id = l_season_id and sr.game_club_id = l_club_id
        and sr.player_season_id = player_id and sr.status = 'active'
    )
  ) then raise exception 'Every selected player must be registered to your squad'; end if;

  select id into l_lineup_id from public.lineups
  where game_season_id = l_season_id and game_club_id = l_club_id and is_default
  order by created_at limit 1 for update;
  if l_lineup_id is null then
    insert into public.lineups (game_season_id, game_club_id, name, is_default)
    values (l_season_id, l_club_id, 'Default lineup', true) returning id into l_lineup_id;
  end if;

  delete from public.lineup_slots where lineup_id = l_lineup_id;
  l_slot := 0;
  foreach l_player_id in array coalesce(p_starters, '{}'::uuid[]) loop
    l_slot := l_slot + 1;
    insert into public.lineup_slots (lineup_id, player_season_id, slot_type, slot_number, suitability)
    values (l_lineup_id, l_player_id, 'starter', l_slot, 100);
  end loop;
  l_slot := 0;
  foreach l_player_id in array coalesce(p_bench, '{}'::uuid[]) loop
    l_slot := l_slot + 1;
    insert into public.lineup_slots (lineup_id, player_season_id, slot_type, slot_number, suitability)
    values (l_lineup_id, l_player_id, 'bench', l_slot, 100);
  end loop;

  return jsonb_build_object('lineup_id', l_lineup_id, 'starters', cardinality(p_starters), 'bench', cardinality(p_bench), 'saved_at', now());
end;
$$;

revoke all on function public.save_my_lineup_draft(uuid[], uuid[]) from public, anon;
grant execute on function public.save_my_lineup_draft(uuid[], uuid[]) to authenticated;

create or replace function public.get_my_lineup_draft()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select l.id from public.lineups l
    join public.game_clubs gc on gc.id = l.game_club_id
    where gc.user_id = auth.uid() and l.is_default
    order by l.updated_at desc limit 1
  )
  select jsonb_build_object(
    'lineup_id', (select id from mine),
    'starters', coalesce((select jsonb_agg(ls.player_season_id order by ls.slot_number) from public.lineup_slots ls where ls.lineup_id = (select id from mine) and ls.slot_type = 'starter'), '[]'::jsonb),
    'bench', coalesce((select jsonb_agg(ls.player_season_id order by ls.slot_number) from public.lineup_slots ls where ls.lineup_id = (select id from mine) and ls.slot_type = 'bench'), '[]'::jsonb)
  )
$$;

revoke all on function public.get_my_lineup_draft() from public, anon;
grant execute on function public.get_my_lineup_draft() to authenticated;
