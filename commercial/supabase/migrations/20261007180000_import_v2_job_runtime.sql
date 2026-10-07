create table if not exists public.import_v2_jobs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.refresh_requests(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete restrict,
  job_type text not null check (job_type in ('historical','current_meet')),
  status text not null default 'pending' check (status in ('pending','running','completed','failed','cancelled')),
  priority integer not null default 10,
  cursor jsonb not null default '{}'::jsonb,
  failure_code text,
  last_error text,
  attempts integer not null default 0,
  records_found integer not null default 0,
  records_inserted integer not null default 0,
  records_duplicated integer not null default 0,
  locked_at timestamptz,
  last_run_at timestamptz,
  next_run_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(request_id,source_id,job_type)
);
alter table public.import_v2_jobs enable row level security;
create index if not exists import_v2_jobs_athlete_idx on public.import_v2_jobs(athlete_id);
create index if not exists import_v2_jobs_source_idx on public.import_v2_jobs(source_id);
create index if not exists import_v2_jobs_claim_idx on public.import_v2_jobs(status,next_run_at,priority,created_at);
drop policy if exists import_v2_jobs_select_members on public.import_v2_jobs;
create policy import_v2_jobs_select_members on public.import_v2_jobs for select to authenticated
using (exists(select 1 from public.athletes a join public.account_members am on am.account_id=a.account_id where a.id=import_v2_jobs.athlete_id and am.user_id=(select auth.uid()) and am.status='active'));
drop trigger if exists import_v2_jobs_set_updated_at on public.import_v2_jobs;
create trigger import_v2_jobs_set_updated_at before update on public.import_v2_jobs for each row execute function app.set_updated_at();

create or replace function public.claim_import_v2_jobs(p_limit integer default 1)
returns setof public.import_v2_jobs language plpgsql security definer set search_path=public as $$
begin
 return query with picked as (
  select j.id from public.import_v2_jobs j
  where j.status='pending' and (j.next_run_at is null or j.next_run_at<=now())
  order by j.priority,j.created_at for update skip locked limit greatest(coalesce(p_limit,1),1)
 )
 update public.import_v2_jobs j set status='running',locked_at=now(),last_run_at=now(),attempts=j.attempts+1,updated_at=now()
 from picked p where j.id=p.id returning j.*;
end $$;
revoke all on function public.claim_import_v2_jobs(integer) from public,anon,authenticated;
grant execute on function public.claim_import_v2_jobs(integer) to service_role;

create or replace function public.finalize_refresh_request_if_terminal()
returns trigger language plpgsql set search_path=public as $$
declare v_request_id uuid;v_pending_running int;v_cancelled int;v_failed int;v_completed int;
begin
 v_request_id:=coalesce(new.request_id,old.request_id);if v_request_id is null then return new;end if;
 select count(*) filter(where status in ('pending','running')),count(*) filter(where status='cancelled'),count(*) filter(where status='failed'),count(*) filter(where status='completed')
 into v_pending_running,v_cancelled,v_failed,v_completed
 from (
  select status::text from public.monitor_jobs where request_id=v_request_id
  union all select status::text from public.historical_archive_jobs where request_id=v_request_id
  union all select status::text from public.import_v2_jobs where request_id=v_request_id
 ) x(status);
 if v_pending_running>0 or v_cancelled>0 then return new;end if;
 update public.refresh_requests set terminal_status=case when v_failed>0 then 'failed' else 'completed' end,
 completed_job_count=v_completed,failed_job_count=v_failed,finalized_at=now(),updated_at=now()
 where id=v_request_id and finalized_at is null and cancel_requested_at is null;
 return new;
end $$;
drop trigger if exists trg_finalize_import_v2_jobs on public.import_v2_jobs;
create trigger trg_finalize_import_v2_jobs after insert or update of status,request_id on public.import_v2_jobs for each row execute function public.finalize_refresh_request_if_terminal();

create or replace function public.request_result_refresh_v2(p_athlete_id uuid,p_source_codes text[] default null::text[])
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid();v_request uuid;v_count int:=0;
begin
 if v_uid is null then raise exception 'not_authenticated';end if;
 if not exists(select 1 from public.account_members am join public.athletes a on a.account_id=am.account_id where a.id=p_athlete_id and am.user_id=v_uid and am.status='active') then raise exception 'forbidden';end if;
 insert into public.refresh_requests(athlete_id,requested_by,source_codes,job_count,completed_job_count,failed_job_count)
 values(p_athlete_id,v_uid,p_source_codes,0,0,0) returning id into v_request;
 insert into public.import_v2_jobs(request_id,athlete_id,source_id,job_type,priority,next_run_at)
 select distinct v_request,p_athlete_id,s.id,'historical',5,now()
 from public.athlete_source_configs c join public.sources s on s.id=c.source_id
 where c.athlete_id=p_athlete_id and c.active and s.active and s.code in ('swimsystem','fdap','masters_parana')
 and (p_source_codes is null or s.code=any(p_source_codes)) on conflict do nothing;
 insert into public.import_v2_jobs(request_id,athlete_id,source_id,job_type,priority,next_run_at)
 select distinct v_request,p_athlete_id,s.id,'current_meet',4,now()
 from public.athlete_source_configs c join public.sources s on s.id=c.source_id
 where c.athlete_id=p_athlete_id and c.active and s.active and s.code='swimsystem'
 and (p_source_codes is null or s.code=any(p_source_codes)) on conflict do nothing;
 select count(*) into v_count from public.import_v2_jobs where request_id=v_request;
 update public.refresh_requests set job_count=v_count,terminal_status=case when v_count=0 then 'completed' else null end,
 finalized_at=case when v_count=0 then now() else null end,updated_at=now() where id=v_request;
 return jsonb_build_object('request_id',v_request,'engine','v2','job_count',v_count);
end $$;
revoke all on function public.request_result_refresh_v2(uuid,text[]) from public,anon;
grant execute on function public.request_result_refresh_v2(uuid,text[]) to authenticated;

create or replace function public.cancel_result_refresh_request(p_request_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_completed int;v_failed int;
begin
 if not exists(select 1 from public.refresh_requests rr join public.athletes a on a.id=rr.athlete_id join public.account_members am on am.account_id=a.account_id where rr.id=p_request_id and am.user_id=auth.uid() and am.status='active') then raise exception 'REQUEST_ACCESS_DENIED';end if;
 update public.monitor_jobs set status='cancelled',locked_at=null,next_run_at=null,updated_at=now() where request_id=p_request_id and status in ('pending','running');
 update public.historical_archive_jobs set status='cancelled',heartbeat_at=null,finished_at=now(),updated_at=now() where request_id=p_request_id and status in ('pending','running');
 update public.import_v2_jobs set status='cancelled',locked_at=null,next_run_at=null,updated_at=now() where request_id=p_request_id and status in ('pending','running');
 select count(*) filter(where status='completed'),count(*) filter(where status='failed') into v_completed,v_failed from (
  select status::text from public.monitor_jobs where request_id=p_request_id
  union all select status::text from public.historical_archive_jobs where request_id=p_request_id
  union all select status::text from public.import_v2_jobs where request_id=p_request_id
 ) x(status);
 update public.refresh_requests set cancel_requested_at=now(),updated_at=now(),terminal_status='cancelled',completed_job_count=v_completed,failed_job_count=v_failed,finalized_at=now()
 where id=p_request_id and finalized_at is null;
end $$;

create or replace view public.v_refresh_request_status with (security_invoker=true) as
with jobs as (
 select request_id,status::text as status,locked_at as effective_started_at,last_error from public.monitor_jobs where request_id is not null
 union all select request_id,status::text,started_at,last_error from public.historical_archive_jobs where request_id is not null
 union all select request_id,status::text,locked_at,last_error from public.import_v2_jobs where request_id is not null
)
select rr.id as request_id,rr.athlete_id,rr.requested_by,rr.source_codes,rr.created_at,rr.updated_at,rr.cancel_requested_at,
case when rr.finalized_at is not null then rr.terminal_status when rr.cancel_requested_at is not null then 'cancelled'
 when bool_or(j.status='running') then 'running' when bool_or(j.status='pending') then 'pending'
 when bool_or(j.status='failed') then 'failed' when count(j.status)>0 then 'completed' else 'no_sources' end as derived_status,
min(j.effective_started_at) filter(where j.status='running') as running_started_at,
(array_agg(j.last_error) filter(where j.status='failed' and j.last_error is not null))[1] as sample_error,
case when rr.finalized_at is not null then rr.job_count::bigint else count(j.status) end as job_count,
rr.finalized_at,rr.terminal_status,rr.completed_job_count,rr.failed_job_count
from public.refresh_requests rr left join jobs j on j.request_id=rr.id group by rr.id;
