alter table public.auction_bids
  add column if not exists withdrawn_at timestamptz;

create index if not exists auction_bids_active_auction_amount_idx
  on public.auction_bids (auction_id, amount_pence desc, created_at)
  where withdrawn_at is null;

create or replace function public.withdraw_my_auction_bid(p_auction_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  l_user_id uuid := auth.uid();
  l_club public.game_clubs%rowtype;
  l_auction public.auctions%rowtype;
  l_candidate record;
  l_candidate_club public.game_clubs%rowtype;
  l_candidate_squad_count integer;
  l_replacement_club_id uuid;
  l_replacement_amount bigint;
  l_withdrawn_count integer;
begin
  if l_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into l_auction
  from public.auctions
  where id = p_auction_id
  for update;

  if not found then
    raise exception 'Auction not found';
  end if;

  if l_auction.status <> 'live' then
    raise exception 'Auction is not live';
  end if;

  if l_auction.ends_at is not null and now() >= l_auction.ends_at then
    raise exception 'Auction has ended';
  end if;

  select *
  into l_club
  from public.game_clubs
  where user_id = l_user_id
    and manager_type = 'human'
  limit 1
  for update;

  if not found then
    raise exception 'Create your club first';
  end if;

  if l_auction.current_winner_club_id is distinct from l_club.id then
    raise exception 'You do not have an active bid on this auction';
  end if;

  update public.auction_bids
  set withdrawn_at = now()
  where auction_id = p_auction_id
    and game_club_id = l_club.id
    and withdrawn_at is null;

  get diagnostics l_withdrawn_count = row_count;

  update public.game_clubs
  set reserved_pence = greatest(
        0,
        reserved_pence - coalesce(l_auction.current_price_pence, 0)
      ),
      updated_at = now()
  where id = l_club.id;

  for l_candidate in
    select ranked.game_club_id, ranked.amount_pence
    from (
      select distinct on (b.game_club_id)
        b.game_club_id,
        b.amount_pence,
        b.created_at
      from public.auction_bids b
      where b.auction_id = p_auction_id
        and b.withdrawn_at is null
        and b.game_club_id <> l_club.id
      order by b.game_club_id, b.amount_pence desc, b.created_at asc
    ) ranked
    order by ranked.amount_pence desc, ranked.created_at asc
  loop
    select *
    into l_candidate_club
    from public.game_clubs
    where id = l_candidate.game_club_id
    for update;

    select count(*)
    into l_candidate_squad_count
    from public.card_ownership
    where owner_type = 'game_club'
      and owner_id = l_candidate.game_club_id;

    if l_candidate.amount_pence <=
         (l_candidate_club.budget_pence - l_candidate_club.reserved_pence)
       and l_candidate_squad_count < l_candidate_club.squad_limit then
      update public.game_clubs
      set reserved_pence = reserved_pence + l_candidate.amount_pence,
          updated_at = now()
      where id = l_candidate.game_club_id;

      l_replacement_club_id := l_candidate.game_club_id;
      l_replacement_amount := l_candidate.amount_pence;
      exit;
    end if;
  end loop;

  update public.auctions
  set current_winner_club_id = l_replacement_club_id,
      current_price_pence = coalesce(
        l_replacement_amount,
        l_auction.reserve_price_pence
      ),
      updated_at = now()
  where id = p_auction_id;

  return jsonb_build_object(
    'auction_id', p_auction_id,
    'withdrawn_bids', l_withdrawn_count,
    'current_winner_club_id', l_replacement_club_id,
    'current_price_pence', coalesce(
      l_replacement_amount,
      l_auction.reserve_price_pence
    )
  );
end
$function$;

revoke all on function public.withdraw_my_auction_bid(uuid)
  from public, anon;
grant execute on function public.withdraw_my_auction_bid(uuid)
  to authenticated, service_role;

create or replace function public.get_auction_bid_history(p_auction_id uuid)
returns table(
  amount_pence bigint,
  bid_type text,
  created_at timestamptz,
  is_my_bid boolean,
  is_current_winner boolean
)
language sql
stable
security definer
set search_path = public
as $function$
  select
    b.amount_pence,
    b.bid_type,
    b.created_at,
    (gc.user_id = auth.uid()) as is_my_bid,
    (
      a.current_winner_club_id = b.game_club_id
      and a.current_price_pence = b.amount_pence
    ) as is_current_winner
  from public.auction_bids b
  join public.game_clubs gc on gc.id = b.game_club_id
  join public.auctions a on a.id = b.auction_id
  where b.auction_id = p_auction_id
    and b.withdrawn_at is null
  order by b.created_at desc
  limit 30
$function$;
