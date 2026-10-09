-- VINISWIM: bounded scheduled scan of every active athlete across every active registered source.
-- Does not manufacture results; source-specific failures remain visible as failed jobs.
create or replace function public.enqueue_scheduled_results_v2(p_max_athletes integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
 rec record;
 v_request uuid;
 v_jobs integer;
 v_count integer := 0;
begin
 for rec in
  select a.id as athlete_id,
    (select am.user_id from public.account_members am
     where am.account_id=a.account_id and am.status='active'
     order by case when am.role='owner' then 0 else 1 end,am.user_id
     limit 1) as member_id
  from public.athletes a
  where a.active=true
    and exists(select 1 from public.athlete_source_configs c
      join public.sources s on s.id=c.source_id
      where c.athlete_id=a.id and c.active and s.active)
    and not exists(select 1 from public.import_v2_jobs j
      where j.athlete_id=a.id and j.status in ('pending','running'))
    and not exists(select 1 from public.refresh_requests rr
      where rr.athlete_id=a.id and rr.created_at>now()-interval '6 hours')
  order by a.created_at,a.id
  limit least(greatest(coalesce(p_max_athletes,20),1),20)
 loop
  if rec.member_id is null then continue; end if;
  insert into public.refresh_requests(athlete_id,requested_by,source_codes,job_count,completed_job_count,failed_job_count)
  values(rec.athlete_id,rec.member_id,null,0,0,0)
  returning id into v_request;

  insert into public.import_v2_jobs(request_id,athlete_id,source_id,job_type,priority,next_run_at)
  select distinct v_request,rec.athlete_id,s.id,'historical',5,now()
  from public.athlete_source_configs c join public.sources s on s.id=c.source_id
  where c.athlete_id=rec.athlete_id and c.active and s.active
  on conflict do nothing;

  insert into public.import_v2_jobs(request_id,athlete_id,source_id,job_type,priority,next_run_at)
  select distinct v_request,rec.athlete_id,s.id,'current_meet',4,now()
  from public.athlete_source_configs c join public.sources s on s.id=c.source_id
  where c.athlete_id=rec.athlete_id and c.active and s.active and s.code='swimsystem'
  on conflict do nothing;

  select count(*) into v_jobs from public.import_v2_jobs where request_id=v_request;
  update public.refresh_requests
  set job_count=v_jobs,terminal_status=case when v_jobs=0 then 'completed' else null end,
      finalized_at=case when v_jobs=0 then now() else null end,updated_at=now()
  where id=v_request;
  v_count:=v_count+1;
 end loop;
 return jsonb_build_object('queued_athletes',v_count,'max_athletes',least(greatest(coalesce(p_max_athletes,20),1),20));
end;
$$;
revoke all on function public.enqueue_scheduled_results_v2(integer) from public,anon,authenticated;
grant execute on function public.enqueue_scheduled_results_v2(integer) to postgres;
do $schedule$
begin
 if not exists(select 1 from cron.job where jobname='viniswim-all-athletes-all-sources') then
  perform cron.schedule('viniswim-all-athletes-all-sources','0 */6 * * *','select public.enqueue_scheduled_results_v2(20)');
 end if;
end
$schedule$;