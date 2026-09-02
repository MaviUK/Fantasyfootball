-- Full club squads contain 22 players. Matchday selection remains 11 starters
-- plus 6 substitutes.
alter table public.game_clubs
  alter column squad_limit set default 22;

update public.game_clubs
set squad_limit = 22,
    updated_at = now()
where squad_limit <> 22;

-- Give AI clubs a balanced 22-player recruitment target.
alter table public.ai_club_strategies
  drop constraint ai_club_strategies_check,
  alter column target_gk set default 2,
  alter column target_cd set default 7,
  alter column target_md set default 7,
  alter column target_att set default 6;

update public.ai_club_strategies
set target_gk = 2,
    target_cd = 7,
    target_md = 7,
    target_att = 6;

alter table public.ai_club_strategies
  add constraint ai_club_strategies_check
    check (target_gk + target_cd + target_md + target_att = 22);

create or replace function public.club_squad_shape(p_club_id uuid)
returns table(game_position text, n integer, target integer, missing integer)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with targets as (
    select *
    from (values ('GK', 2), ('CD', 7), ('MD', 7), ('ATT', 6))
      as positions(game_position, target)
  ), owned as (
    select ps.game_position, count(*)::integer as n
    from public.card_ownership co
    join public.player_seasons ps on ps.id = co.player_season_id
    where co.owner_type = 'game_club'
      and co.owner_id = p_club_id
    group by ps.game_position
  )
  select
    targets.game_position,
    coalesce(owned.n, 0),
    targets.target,
    greatest(0, targets.target - coalesce(owned.n, 0))
  from targets
  left join owned using (game_position)
$function$;

create or replace function public.register_owned_card(
  p_game_season_id uuid,
  p_club_id uuid,
  p_player_season_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  l_registered integer;
  l_squad_limit integer;
  l_registration_id uuid;
begin
  if not exists (
    select 1
    from public.card_ownership
    where player_season_id = p_player_season_id
      and owner_type = 'game_club'
      and owner_id = p_club_id
  ) then
    raise exception 'Club does not own card';
  end if;

  select gc.squad_limit
  into l_squad_limit
  from public.game_clubs gc
  where gc.id = p_club_id;

  if not found then
    raise exception 'Club not found';
  end if;

  select count(*)
  into l_registered
  from public.squad_registrations
  where game_season_id = p_game_season_id
    and game_club_id = p_club_id
    and status = 'active';

  if l_registered >= l_squad_limit then
    raise exception 'Squad limit reached';
  end if;

  insert into public.squad_registrations (
    game_season_id,
    game_club_id,
    player_season_id
  )
  values (p_game_season_id, p_club_id, p_player_season_id)
  returning id into l_registration_id;

  return l_registration_id;
end
$function$;

create or replace function public.auto_complete_squad_at_deadline(
  p_club_id uuid,
  p_game_season_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  l_shape record;
  l_player record;
  l_club public.game_clubs%rowtype;
  l_price bigint;
  l_added integer := 0;
  l_spent bigint := 0;
begin
  select *
  into l_club
  from public.game_clubs
  where id = p_club_id
  for update;

  if not found then
    raise exception 'Club not found';
  end if;

  for l_shape in
    select * from public.club_squad_shape(p_club_id) where missing > 0
  loop
    for l_player in
      select ps.id, ps.market_value_pence
      from public.player_seasons ps
      join public.card_ownership co on co.player_season_id = ps.id
      where ps.is_eligible = true
        and ps.game_position = l_shape.game_position
        and co.owner_type = 'market'
        and not exists (
          select 1
          from public.auctions a
          where a.game_season_id = p_game_season_id
            and a.player_season_id = ps.id
            and a.current_winner_club_id is not null
        )
      order by ps.market_value_pence, ps.overall_rating, ps.id
      limit l_shape.missing
    loop
      l_price := l_player.market_value_pence;

      select *
      into l_club
      from public.game_clubs
      where id = p_club_id
      for update;

      if l_club.budget_pence - l_club.reserved_pence < l_price then
        raise exception 'Club % cannot afford legal squad; needs % at %',
          p_club_id, l_shape.game_position, l_price;
      end if;

      update public.card_ownership
      set owner_type = 'game_club',
          owner_id = p_club_id,
          acquisition_type = 'auto_allocated',
          acquisition_price_pence = l_price,
          acquired_at = now(),
          updated_at = now()
      where player_season_id = l_player.id
        and owner_type = 'market';

      if found then
        update public.game_clubs
        set budget_pence = budget_pence - l_price,
            updated_at = now()
        where id = p_club_id;

        update public.auctions
        set status = 'settled',
            settled_at = now(),
            lifecycle_note = 'Auto-allocated at FPL price to complete legal squad',
            updated_at = now()
        where game_season_id = p_game_season_id
          and player_season_id = l_player.id
          and status in ('scheduled', 'live', 'unsold', 'ended');

        l_added := l_added + 1;
        l_spent := l_spent + l_price;
      end if;
    end loop;
  end loop;

  if exists (
    select 1 from public.club_squad_shape(p_club_id) where missing > 0
  ) then
    raise exception 'Unable to complete legal %-player squad for club %',
      l_club.squad_limit, p_club_id;
  end if;

  return jsonb_build_object(
    'club_id', p_club_id,
    'added', l_added,
    'spent_pence', l_spent,
    'squad_size', l_club.squad_limit
  );
end
$function$;

-- Keep both paths for a new human manager on the 22-player limit.
do $block$
declare
  l_definition text;
begin
  select pg_get_functiondef('public.create_my_game_club(text)'::regprocedure)
  into l_definition;

  l_definition := replace(l_definition, 'squad_limit = 17', 'squad_limit = 22');
  l_definition := replace(l_definition, ', 0, 17', ', 0, 22');
  execute l_definition;
end
$block$;

revoke all on function public.create_my_game_club(text) from public, anon;
grant execute on function public.create_my_game_club(text) to authenticated;
