-- Candidate NOT APPLIED. Same request->job lock order as the batch transaction.
BEGIN;
CREATE OR REPLACE FUNCTION public.cancel_result_refresh_request(p_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE completed integer;failed integer;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.refresh_requests rr JOIN public.athletes a ON a.id=rr.athlete_id
  JOIN public.account_members am ON am.account_id=a.account_id
  WHERE rr.id=p_request_id AND am.user_id=auth.uid() AND am.status='active'
 ) THEN RAISE EXCEPTION 'REQUEST_ACCESS_DENIED'; END IF;
 -- Linearization point shared with persistence. Cancellation before this lock
 -- wins prevents the entire batch; cancellation after commit preserves valid
 -- already-persisted results. No compensating sporting-data deletion.
 PERFORM id FROM public.refresh_requests WHERE id=p_request_id FOR UPDATE;
 UPDATE public.monitor_jobs SET status='cancelled',locked_at=NULL,next_run_at=NULL,updated_at=now()
  WHERE request_id=p_request_id AND status IN ('pending','running');
 UPDATE public.historical_archive_jobs SET status='cancelled',heartbeat_at=NULL,finished_at=now(),updated_at=now()
  WHERE request_id=p_request_id AND status IN ('pending','running');
 UPDATE public.import_v2_jobs SET status='cancelled',locked_at=NULL,next_run_at=NULL,lease_token=NULL,lease_expires_at=NULL,updated_at=now()
  WHERE request_id=p_request_id AND status IN ('pending','running','blocked');
 SELECT count(*) FILTER(WHERE status='completed'),count(*) FILTER(WHERE status IN ('failed','blocked')) INTO completed,failed
 FROM (SELECT status::text FROM public.monitor_jobs WHERE request_id=p_request_id
  UNION ALL SELECT status::text FROM public.historical_archive_jobs WHERE request_id=p_request_id
  UNION ALL SELECT status::text FROM public.import_v2_jobs WHERE request_id=p_request_id) x;
 UPDATE public.refresh_requests SET cancel_requested_at=now(),updated_at=now(),terminal_status='cancelled',
  completed_job_count=completed,failed_job_count=failed,finalized_at=now()
  WHERE id=p_request_id AND finalized_at IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.cancel_result_refresh_request(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cancel_result_refresh_request(uuid) TO authenticated;
COMMIT;
