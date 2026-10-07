alter table public.monitor_jobs
add column if not exists metadata jsonb not null default '{}'::jsonb;
