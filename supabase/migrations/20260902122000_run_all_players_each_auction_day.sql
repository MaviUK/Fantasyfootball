-- Every eligible card enters Day 1. Only cards without a bid roll into later days.
with current_game_season as (
  select *
  from public.game_seasons
  order by season_number desc
  limit 1
)
update public.auctions a
set stage = 1,
    status = 'live',
    auction_mode = 'blind',
    starts_at = gs.auction_day1_start,
    ends_at = gs.auction_day2_start,
    current_price_pence = a.reserve_price_pence,
    lifecycle_note = 'Day 1: full player market',
    updated_at = now()
from current_game_season gs
where a.game_season_id = gs.id
  and a.status in ('scheduled', 'live')
  and a.current_winner_club_id is null
  and a.first_bid_at is null;

create or replace function public.advance_auction_lifecycle(
  p_now timestamptz default now()
)
returns table(action text, auction_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_count integer;
begin
  perform public.settle_auction(a.id)
  from public.auctions a
  where a.status = 'live'
    and a.auction_mode in ('blind', 'timed')
    and a.ends_at is not null
    and a.ends_at <= p_now
    and a.current_winner_club_id is not null;
  get diagnostics l_count = row_count;
  action := 'settled';
  auction_count := l_count;
  return next;

  -- No-bid cards progress one day at a time. Their reserve price is retained.
  update public.auctions a
  set stage = a.stage + 1,
      status = case
        when case a.stage + 1
          when 2 then gs.auction_day2_start
          when 3 then gs.auction_day3_start
          when 4 then gs.auction_day4_start
        end <= p_now then 'live'
        else 'scheduled'
      end,
      starts_at = case a.stage + 1
        when 2 then gs.auction_day2_start
        when 3 then gs.auction_day3_start
        when 4 then gs.auction_day4_start
      end,
      ends_at = case a.stage + 1
        when 2 then gs.auction_day3_start
        when 3 then gs.auction_day4_start
        when 4 then gs.fixed_price_start
      end,
      current_price_pence = a.reserve_price_pence,
      lifecycle_note = 'No bids: advanced to Day ' || (a.stage + 1),
      updated_at = p_now
  from public.game_seasons gs
  where gs.id = a.game_season_id
    and a.status = 'live'
    and a.auction_mode in ('blind', 'timed')
    and a.ends_at is not null
    and a.ends_at <= p_now
    and a.current_winner_club_id is null
    and a.stage < 4;
  get diagnostics l_count = row_count;
  action := 'advanced_unsold';
  auction_count := l_count;
  return next;

  update public.auctions a
  set auction_mode = 'fixed_price',
      buy_now_price_pence = a.reserve_price_pence,
      current_price_pence = a.reserve_price_pence,
      ends_at = null,
      lifecycle_note = 'Day 4 unsold: fixed-price market',
      updated_at = p_now
  where a.status = 'live'
    and a.stage = 4
    and a.auction_mode in ('blind', 'timed')
    and a.ends_at is not null
    and a.ends_at <= p_now
    and a.current_winner_club_id is null;
  get diagnostics l_count = row_count;
  action := 'moved_to_fixed';
  auction_count := l_count;
  return next;

  update public.auctions a
  set status = 'live',
      starts_at = coalesce(a.starts_at, p_now),
      auction_mode = case when a.stage between 1 and 4 then 'blind' else a.auction_mode end,
      lifecycle_note = 'Day ' || a.stage || ' opened',
      updated_at = p_now
  where a.status = 'scheduled'
    and a.starts_at is not null
    and a.starts_at <= p_now;
  get diagnostics l_count = row_count;
  action := 'opened';
  auction_count := l_count;
  return next;
end;
$$;

revoke all on function public.advance_auction_lifecycle(timestamptz)
from public, anon, authenticated;
