-- All authorized active athletes, all registered active sources.
-- Production runner executes one pending task/minute. This job only enqueues.
-- No writes to results and no guessed records.
create or replace function public.enqueue_all_active_athlete_scans()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 v record;
 v_req uuid;
 v_jobs integer;
 v_total integer := 0;
 v_athletes integer := 0;
begin
 for v in
  select a.id as athlete_id, m.user_id
  from public.athletes a
  join lateral (
   select am.user_id from public.account_members am
   where am.account_id=a.account_id and am.status='active'
   order by case when am.role='owner' then 0 else 1 end
   limit 1
  ) m on true
  where a.active=true
   and exists (
    select 1 from public.athlete_source_configs c
    join public.sources s on s.id=c.source_id
    where c.athlete_id=a.id and c.active and s.active
   )
   and not exists (
    select 1 from public.refresh_requests r
    where r.athlete_id=a.id and r.finalized_at is null
   )
 loop
  insert into public.refresh_requests
   (athlete_id,requested_by,source_codes,job_count,completed_job_count,failed_job_count)
  values(v.athlete_id,v.user_id,null,0,0,0)
  returning id into v_req;
  insert into public.import_v2_jobs
   (request_id,athlete_id,source_id,job_type,priority,next_run_at)
  select distinct v_req,v.athlete_id,s.id,'historical',5,now()
  from public.athlete_source_configs c
  join public.sources s on s.id=c.source_id
  where c.athlete_id=v.athlete_id and c.active and s.active
  on conflict do nothing;
  insert into public.import_v2_jobs
   (request_id,athlete_id,source_id,job_type,priority,next_run_at)
  select distinct v_req,v.athlete_id,s.id,'current_meet',4,now()
  from public.athlete_source_configs c
  join public.sources s on s.id=c.source_id
  where c.athlete_id=v.athlete_id and c.active and s.active and s.code='swimsystem'
  on conflict do nothing;
  select count(*) into v_jobs from public.import_v2_jobs where request_id=v_req;
  update public.refresh_requests set
   job_count=v_jobs,
   terminal_status=case when v_jobs=0 then 'no_sources' else null end,
   finalized_at=case when v_jobs=0 then now() else null end,
   updated_at=now()
  where id=v_req;
  v_athletes:=v_athletes+1;
  v_total:=v_total+v_jobs;
 end loop;
 return jsonb_build_object('athletes_queued',v_athletes,'tasks_queued',v_total);
end;
$$;
revoke all on function public.enqueue_all_active_athlete_scans() from public, anon, authenticated;
grant execute on function public.enqueue_all_active_athlete_scans() to postgres, service_role;
-- 06:00 UTC == 03:00 America/Sao_Paulo; automatic daily imports.
select cron.schedule(
 'viniswim-nightly-all-athlete-full-scan',
 '0 6 * * *',
 'select public.enqueue_all_active_athlete_scans();'
);
