-- Raise the allowance by £100m without disturbing existing bids or purchases.
update public.game_clubs
set budget_pence = budget_pence + 10000000000,
    updated_at = now();

-- Keep every entry point and future-season reset on the new £200m allowance.
do $$
declare
  l_function record;
  l_definition text;
begin
  for l_function in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'create_my_game_club',
        'prepare_next_game_season',
        'rollover_game_season'
      )
  loop
    l_definition := pg_get_functiondef(l_function.oid);
    l_definition := replace(l_definition, '10000000000', '20000000000');
    l_definition := replace(l_definition, '£100m', '£200m');
    l_definition := replace(
      l_definition,
      $replace$('scheduled', 'auction', 'active')$replace$,
      $replace$('scheduled', 'auctions', 'active')$replace$
    );
    execute l_definition;
  end loop;
end;
$$;

revoke all on function public.create_my_game_club(text) from public, anon;
grant execute on function public.create_my_game_club(text) to authenticated;

revoke all on function public.prepare_next_game_season(uuid, text, timestamptz)
from public, anon, authenticated;
revoke all on function public.rollover_game_season(uuid, timestamptz)
from public, anon, authenticated;
