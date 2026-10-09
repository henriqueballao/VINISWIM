-- All active athlete sources must be queued; unsupported parsers fail explicitly instead of vanishing.
CREATE OR REPLACE FUNCTION public.request_result_refresh_v2(p_athlete_id uuid, p_source_codes text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_request uuid;
  v_count int:=0;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists(
    select 1
    from public.account_members am
    join public.athletes a on a.account_id=am.account_id
    where a.id=p_athlete_id and am.user_id=v_uid and am.status='active'
  ) then raise exception 'forbidden'; end if;

  insert into public.refresh_requests(athlete_id,requested_by,source_codes,job_count,completed_job_count,failed_job_count)
  values(p_athlete_id,v_uid,p_source_codes,0,0,0)
  returning id into v_request;

  insert into public.import_v2_jobs(request_id,athlete_id,source_id,job_type,priority,next_run_at)
  select distinct v_request,p_athlete_id,s.id,'historical',5,now()
  from public.athlete_source_configs c
  join public.sources s on s.id=c.source_id
  where c.athlete_id=p_athlete_id and c.active and s.active
    and (p_source_codes is null or s.code=any(p_source_codes))
  on conflict do nothing;

  insert into public.import_v2_jobs(request_id,athlete_id,source_id,job_type,priority,next_run_at)
  select distinct v_request,p_athlete_id,s.id,'current_meet',4,now()
  from public.athlete_source_configs c
  join public.sources s on s.id=c.source_id
  where c.athlete_id=p_athlete_id and c.active and s.active
    and s.code='swimsystem'
    and (p_source_codes is null or s.code=any(p_source_codes))
  on conflict do nothing;

  select count(*) into v_count from public.import_v2_jobs where request_id=v_request;

  update public.refresh_requests
  set job_count=v_count,
      terminal_status=case when v_count=0 then 'completed' else null end,
      finalized_at=case when v_count=0 then now() else null end,
      updated_at=now()
  where id=v_request;

  return jsonb_build_object('request_id',v_request,'engine','v2','job_count',v_count);
end
$function$
;
