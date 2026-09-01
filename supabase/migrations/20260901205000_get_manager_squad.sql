create or replace function public.get_my_squad()
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
  l_result jsonb;
begin
  if l_user_id is null then raise exception 'Authentication required'; end if;
  select gc.id into l_club_id from public.game_clubs gc where gc.user_id = l_user_id limit 1;
  if l_club_id is null then raise exception 'Club not found'; end if;
  select gs.id into l_season_id from public.game_seasons gs order by gs.season_number desc limit 1;

  with squad_cards as (
    select co.player_season_id, 'owned'::text as ownership_status,
      co.acquisition_price_pence as price_pence, co.acquired_at,
      null::timestamptz as auction_ends_at
    from public.card_ownership co
    where co.owner_type = 'game_club' and co.owner_id = l_club_id
    union all
    select a.player_season_id, 'provisional'::text,
      coalesce(a.current_price_pence, a.reserve_price_pence), null, a.ends_at
    from public.auctions a
    where a.game_season_id = l_season_id
      and a.current_winner_club_id = l_club_id
      and a.status in ('scheduled','live')
      and not exists (
        select 1 from public.card_ownership co
        where co.player_season_id = a.player_season_id
          and co.owner_type = 'game_club' and co.owner_id = l_club_id
      )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ps.id,
    'ownership_status', sc.ownership_status,
    'current_price_pence', sc.price_pence,
    'acquired_at', sc.acquired_at,
    'ends_at', sc.auction_ends_at,
    'fitness', coalesce(pgs.fitness, 100),
    'injury_status', coalesce(pgs.injury_status, 'available'),
    'injury_until_fixture_count', coalesce(pgs.injury_until_fixture_count, 0),
    'suspension_matches', coalesce(pgs.suspension_matches, 0),
    'yellow_card_tally', coalesce(pgs.yellow_card_tally, 0),
    'red_card_tally', coalesce(pgs.red_card_tally, 0),
    'player_seasons', jsonb_build_object(
      'id', ps.id,
      'game_position', ps.game_position,
      'overall_rating', ps.overall_rating,
      'players', jsonb_build_object('full_name', p.full_name),
      'clubs', jsonb_build_object('name', c.name)
    )
  ) order by case ps.game_position when 'GK' then 1 when 'CD' then 2 when 'MD' then 3 else 4 end, p.full_name), '[]'::jsonb)
  into l_result
  from squad_cards sc
  join public.player_seasons ps on ps.id = sc.player_season_id
  join public.players p on p.id = ps.player_id
  join public.clubs c on c.id = ps.primary_club_id
  left join public.player_game_state pgs
    on pgs.player_season_id = ps.id
    and pgs.game_club_id = l_club_id
    and pgs.game_season_id = l_season_id;

  return l_result;
end;
$$;

revoke all on function public.get_my_squad() from public, anon;
grant execute on function public.get_my_squad() to authenticated;
