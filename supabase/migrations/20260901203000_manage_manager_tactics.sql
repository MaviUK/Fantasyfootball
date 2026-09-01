create or replace function public.get_my_tactics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  l_user_id uuid := auth.uid();
  l_lineup_id uuid;
  l_result jsonb;
begin
  if l_user_id is null then raise exception 'Authentication required'; end if;

  select l.id into l_lineup_id
  from public.lineups l
  join public.game_clubs gc on gc.id = l.game_club_id
  where gc.user_id = l_user_id and l.is_default
  order by l.updated_at desc limit 1;

  select jsonb_build_object(
    'has_lineup', l_lineup_id is not null,
    'mentality', coalesce(tt.mentality, 'balanced'),
    'tempo', coalesce(tt.tempo, 'balanced'),
    'pressing', coalesce(tt.pressing, 'balanced'),
    'width', coalesce(tt.width, 'balanced'),
    'defensive_line', coalesce(tt.defensive_line, 'balanced'),
    'passing_style', coalesce(tt.passing_style, 'mixed'),
    'updated_at', tt.updated_at
  ) into l_result
  from (select 1) seed
  left join public.team_tactics tt on tt.lineup_id = l_lineup_id;

  return l_result;
end;
$$;

create or replace function public.save_my_tactics(
  p_mentality text,
  p_tempo text,
  p_pressing text,
  p_width text,
  p_defensive_line text,
  p_passing_style text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_user_id uuid := auth.uid();
  l_club_id uuid;
  l_lineup_id uuid;
  l_season_id uuid;
  l_deadline timestamptz;
  l_saved_at timestamptz := now();
begin
  if l_user_id is null then raise exception 'Authentication required'; end if;
  if p_mentality not in ('very_defensive','defensive','balanced','attacking','very_attacking') then raise exception 'Invalid mentality'; end if;
  if p_tempo not in ('slow','balanced','fast') then raise exception 'Invalid tempo'; end if;
  if p_pressing not in ('low','balanced','high') then raise exception 'Invalid pressing'; end if;
  if p_width not in ('narrow','balanced','wide') then raise exception 'Invalid width'; end if;
  if p_defensive_line not in ('deep','balanced','high') then raise exception 'Invalid defensive line'; end if;
  if p_passing_style not in ('short','mixed','direct') then raise exception 'Invalid passing style'; end if;

  select gc.id into l_club_id from public.game_clubs gc where gc.user_id = l_user_id limit 1;
  if l_club_id is null then raise exception 'Club not found'; end if;
  select gs.id into l_season_id from public.game_seasons gs order by gs.season_number desc limit 1;
  select l.id into l_lineup_id from public.lineups l
  where l.game_club_id = l_club_id and l.game_season_id = l_season_id and l.is_default
  order by l.updated_at desc limit 1;
  if l_lineup_id is null then raise exception 'Save your lineup before setting tactics'; end if;

  select coalesce(f.deadline_at, gs.first_match_at) into l_deadline
  from public.game_seasons gs
  left join lateral (
    select deadline_at from public.fixtures
    where game_season_id = gs.id and status = 'scheduled'
      and (home_club_id = l_club_id or away_club_id = l_club_id)
    order by scheduled_at limit 1
  ) f on true where gs.id = l_season_id;
  if l_deadline is not null and now() >= l_deadline then raise exception 'The tactics deadline has passed'; end if;

  insert into public.team_tactics (lineup_id, mentality, tempo, pressing, width, defensive_line, passing_style, updated_at)
  values (l_lineup_id, p_mentality, p_tempo, p_pressing, p_width, p_defensive_line, p_passing_style, l_saved_at)
  on conflict (lineup_id) do update set
    mentality = excluded.mentality,
    tempo = excluded.tempo,
    pressing = excluded.pressing,
    width = excluded.width,
    defensive_line = excluded.defensive_line,
    passing_style = excluded.passing_style,
    updated_at = excluded.updated_at;

  return jsonb_build_object('saved_at', l_saved_at, 'deadline_at', l_deadline);
end;
$$;

revoke all on function public.get_my_tactics() from public, anon;
revoke all on function public.save_my_tactics(text,text,text,text,text,text) from public, anon;
grant execute on function public.get_my_tactics() to authenticated;
grant execute on function public.save_my_tactics(text,text,text,text,text,text) to authenticated;
