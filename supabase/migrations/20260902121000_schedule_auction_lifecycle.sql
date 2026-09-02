create extension if not exists pg_cron;

revoke all on function public.advance_auction_lifecycle(timestamptz)
from public, anon, authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname = 'advance-auction-lifecycle';

select cron.schedule(
  'advance-auction-lifecycle',
  '* * * * *',
  $job$select public.advance_auction_lifecycle(now());$job$
);

select * from public.advance_auction_lifecycle(now());
