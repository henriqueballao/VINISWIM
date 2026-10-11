-- Candidate NOT APPLIED. Published finalizer silently classified blocked jobs
-- as completed. Preserve all existing queues and count blocked as failed.
BEGIN;
CREATE OR REPLACE FUNCTION public.finalize_refresh_request_if_terminal()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_request_id uuid;
  v_pending_running int;
  v_cancelled int;
  v_failed int;
  v_completed int;
begin
  v_request_id := coalesce(new.request_id, old.request_id);
  if v_request_id is null then return new; end if;

  select
    count(*) filter (where status in ('pending','running')),
    count(*) filter (where status='cancelled'),
    count(*) filter (where status in ('failed','blocked')),
    count(*) filter (where status='completed')
  into v_pending_running,v_cancelled,v_failed,v_completed
  from (
    select status::text from public.monitor_jobs where request_id=v_request_id
    union all
    select status::text from public.historical_archive_jobs where request_id=v_request_id
    union all
    select status::text from public.import_v2_jobs where request_id=v_request_id
  ) x(status);

  if v_pending_running>0 then return new; end if;
  if v_cancelled>0 then return new; end if;

  update public.refresh_requests
  set terminal_status=case when v_failed>0 then 'failed' else 'completed' end,
      completed_job_count=v_completed,
      failed_job_count=v_failed,
      finalized_at=now(),
      updated_at=now()
  where id=v_request_id
    and finalized_at is null
    and cancel_requested_at is null;

  return new;
end
$function$;
COMMIT;

