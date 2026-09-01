create or replace function public.get_player_profile(p_player_season_id uuid)
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

  select jsonb_build_object(
    'id', ps.id,
    'full_name', p.full_name,
    'nationality_code', p.nationality_code,
    'date_of_birth', p.date_of_birth,
    'club_name', c.name,
    'season_label', s.label,
    'competition_name', comp.name,
    'game_position', ps.game_position,
    'historical_position', ps.historical_position,
    'age', ps.age_on_season_start,
    'overall_rating', ps.overall_rating,
    'market_value_pence', ps.market_value_pence,
    'data_confidence', ps.data_confidence,
    'appearances', ps.appearances,
    'starts', ps.starts,
    'substitute_appearances', ps.substitute_appearances,
    'minutes', ps.minutes,
    'goals', ps.goals,
    'assists', ps.assists,
    'yellow_cards', ps.yellow_cards,
    'red_cards', ps.red_cards,
    'clean_sheets', ps.clean_sheets,
    'goals_conceded', ps.goals_conceded,
    'saves', ps.saves,
    'penalties_scored', ps.penalties_scored,
    'penalties_missed', ps.penalties_missed,
    'rating_components', coalesce(ps.rating_components, '{}'::jsonb),
    'simulation_attributes', coalesce(ps.simulation_attributes, '{}'::jsonb),
    'stamina_rating', ps.stamina_rating,
    'injury_proneness', ps.injury_proneness,
    'game_stats', jsonb_build_object(
      'appearances', coalesce(game_stats.appearances, 0),
      'minutes', coalesce(game_stats.minutes, 0),
      'goals', coalesce(game_stats.goals, 0),
      'assists', coalesce(game_stats.assists, 0),
      'average_rating', game_stats.average_rating
    )
  ) into l_result
  from public.player_seasons ps
  join public.players p on p.id = ps.player_id
  join public.clubs c on c.id = ps.primary_club_id
  join public.competition_seasons cs on cs.id = ps.competition_season_id
  join public.seasons s on s.id = cs.season_id
  join public.competitions comp on comp.id = cs.competition_id
  left join lateral (
    select count(*)::integer as appearances,
      coalesce(sum(pms.minutes), 0)::integer as minutes,
      coalesce(sum(pms.goals), 0)::integer as goals,
      coalesce(sum(pms.assists), 0)::integer as assists,
      round(avg(pms.match_rating), 2) as average_rating
    from public.player_match_stats pms
    where pms.player_season_id = ps.id
  ) game_stats on true
  where ps.id = p_player_season_id and ps.is_eligible;

  if l_result is null then raise exception 'Player card not found'; end if;
  return l_result;
end;
$$;

revoke all on function public.get_player_profile(uuid) from public, anon;
grant execute on function public.get_player_profile(uuid) to authenticated;
