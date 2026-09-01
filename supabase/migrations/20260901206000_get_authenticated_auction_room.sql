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
      'players', jsonb_build_object('full_name', p.full_name),
      'clubs', jsonb_build_object('name', c.name)
    )
  ) order by coalesce(a.current_price_pence, a.reserve_price_pence) desc, p.full_name), '[]'::jsonb)
  into l_result
  from public.auctions a
  join public.player_seasons ps on ps.id = a.player_season_id
  join public.players p on p.id = ps.player_id
  join public.clubs c on c.id = ps.primary_club_id
  where a.stage = p_stage and a.status in ('scheduled','live');

  return l_result;
end;
$$;

revoke all on function public.get_auction_room(smallint) from public, anon;
grant execute on function public.get_auction_room(smallint) to authenticated;
