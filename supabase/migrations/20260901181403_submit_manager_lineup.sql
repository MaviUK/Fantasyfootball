create or replace function public.submit_my_lineup(p_formation text)
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
  l_deadline timestamptz;
  l_starters integer;
  l_bench integer;
  l_start_gk integer;
  l_bench_gk integer;
  l_cd integer;
  l_md integer;
  l_att integer;
  l_cd_zones text[];
  l_md_zones text[];
  l_att_zones text[];
begin
  if l_user_id is null then raise exception 'Authentication required'; end if;
  select id into l_club_id from public.game_clubs where user_id = l_user_id limit 1;
  if l_club_id is null then raise exception 'Club not found'; end if;
  select id into l_season_id from public.game_seasons order by season_number desc limit 1;

  select coalesce(f.deadline_at, gs.first_match_at) into l_deadline
  from public.game_seasons gs
  left join lateral (
    select deadline_at from public.fixtures
    where game_season_id = gs.id and status = 'scheduled'
      and (home_club_id = l_club_id or away_club_id = l_club_id)
    order by scheduled_at limit 1
  ) f on true where gs.id = l_season_id;
  if l_deadline is not null and now() >= l_deadline then raise exception 'The lineup deadline has passed'; end if;

  select id into l_lineup_id from public.lineups
  where game_season_id = l_season_id and game_club_id = l_club_id and is_default
  order by updated_at desc limit 1 for update;
  if l_lineup_id is null then raise exception 'Save your lineup draft before submitting'; end if;

  select count(*) filter (where ls.slot_type='starter'), count(*) filter (where ls.slot_type='bench'),
    count(*) filter (where ls.slot_type='starter' and ps.game_position='GK'), count(*) filter (where ls.slot_type='bench' and ps.game_position='GK'),
    count(*) filter (where ls.slot_type='starter' and ps.game_position='CD'), count(*) filter (where ls.slot_type='starter' and ps.game_position='MD'),
    count(*) filter (where ls.slot_type='starter' and ps.game_position='ATT')
  into l_starters,l_bench,l_start_gk,l_bench_gk,l_cd,l_md,l_att
  from public.lineup_slots ls join public.player_seasons ps on ps.id=ls.player_season_id
  where ls.lineup_id=l_lineup_id;
  if l_starters<>11 or l_bench<>6 or l_start_gk<>1 or l_bench_gk<>1 then raise exception 'Select 11 starters and 6 substitutes, with one goalkeeper in each group'; end if;

  case p_formation
    when '4-4-2' then l_cd_zones:=array['LB','LCB','RCB','RB']; l_md_zones:=array['LM','LCM','RCM','RM']; l_att_zones:=array['LCF','RCF'];
    when '4-3-3' then l_cd_zones:=array['LB','LCB','RCB','RB']; l_md_zones:=array['LCM','CM','RCM']; l_att_zones:=array['LW','CF','RW'];
    when '3-5-2' then l_cd_zones:=array['LCB','CB','RCB']; l_md_zones:=array['LWB','LCM','CM','RCM','RWB']; l_att_zones:=array['LCF','RCF'];
    when '4-2-3-1' then l_cd_zones:=array['LB','LCB','RCB','RB']; l_md_zones:=array['LDM','RDM','LAM','AM','RAM']; l_att_zones:=array['ST'];
    when '5-3-2' then l_cd_zones:=array['LB','LCB','CB','RCB','RB']; l_md_zones:=array['LCM','CM','RCM']; l_att_zones:=array['LCF','RCF'];
    else raise exception 'Unsupported formation';
  end case;
  if l_cd<>cardinality(l_cd_zones) or l_md<>cardinality(l_md_zones) or l_att<>cardinality(l_att_zones) then
    raise exception 'Your selected players do not match the % formation', p_formation;
  end if;

  update public.lineup_slots set pitch_zone_code='GK', suitability=100
  where lineup_id=l_lineup_id and slot_type='starter' and player_season_id in (select id from public.player_seasons where game_position='GK');
  with ranked as (select ls.id,row_number() over(order by ls.slot_number) n from public.lineup_slots ls join public.player_seasons ps on ps.id=ls.player_season_id where ls.lineup_id=l_lineup_id and ls.slot_type='starter' and ps.game_position='CD')
  update public.lineup_slots ls set pitch_zone_code=l_cd_zones[r.n] from ranked r where ls.id=r.id;
  with ranked as (select ls.id,row_number() over(order by ls.slot_number) n from public.lineup_slots ls join public.player_seasons ps on ps.id=ls.player_season_id where ls.lineup_id=l_lineup_id and ls.slot_type='starter' and ps.game_position='MD')
  update public.lineup_slots ls set pitch_zone_code=l_md_zones[r.n] from ranked r where ls.id=r.id;
  with ranked as (select ls.id,row_number() over(order by ls.slot_number) n from public.lineup_slots ls join public.player_seasons ps on ps.id=ls.player_season_id where ls.lineup_id=l_lineup_id and ls.slot_type='starter' and ps.game_position='ATT')
  update public.lineup_slots ls set pitch_zone_code=l_att_zones[r.n] from ranked r where ls.id=r.id;
  update public.lineups set submitted_at=now(), updated_at=now() where id=l_lineup_id;
  return jsonb_build_object('lineup_id',l_lineup_id,'formation',p_formation,'submitted_at',now(),'deadline_at',l_deadline);
end;
$$;

revoke all on function public.submit_my_lineup(text) from public, anon;
grant execute on function public.submit_my_lineup(text) to authenticated;
