alter table public.match_player_live_positions enable row level security;
alter table public.match_possession_states enable row level security;

revoke all privileges on table public.match_player_live_positions
  from public, anon, authenticated;
revoke all privileges on table public.match_possession_states
  from public, anon, authenticated;

grant select, insert, update, delete
  on table public.match_player_live_positions
  to service_role;
grant select, insert, update, delete
  on table public.match_possession_states
  to service_role;

comment on table public.match_player_live_positions is
  'Internal v17 simulation state. Direct client access is denied; backend simulation functions and service_role only.';
comment on table public.match_possession_states is
  'Internal v17 simulation state. Direct client access is denied; backend simulation functions and service_role only.';
