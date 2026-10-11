-- Candidate NOT APPLIED. Preserve invoker semantics and existing output columns.
BEGIN;
CREATE OR REPLACE VIEW public.v_refresh_request_status WITH(security_invoker=true) AS
WITH jobs AS (
 SELECT request_id,status::text status,locked_at effective_started_at,last_error,NULL::text failure_code FROM public.monitor_jobs WHERE request_id IS NOT NULL
 UNION ALL SELECT request_id,status::text,started_at,last_error,NULL::text FROM public.historical_archive_jobs WHERE request_id IS NOT NULL
 UNION ALL SELECT request_id,status,locked_at,last_error,failure_code FROM public.import_v2_jobs WHERE request_id IS NOT NULL
)
SELECT rr.id request_id,rr.athlete_id,rr.requested_by,rr.source_codes,rr.created_at,rr.updated_at,rr.cancel_requested_at,
 CASE WHEN rr.finalized_at IS NOT NULL THEN rr.terminal_status WHEN rr.cancel_requested_at IS NOT NULL THEN 'cancelled'
  WHEN bool_or(j.status='running') THEN 'running' WHEN bool_or(j.status='pending') THEN 'pending'
  WHEN bool_or(j.status IN ('failed','blocked')) THEN 'failed' WHEN count(j.status)>0 THEN 'completed' ELSE 'no_sources' END derived_status,
 min(j.effective_started_at) FILTER(WHERE j.status='running') running_started_at,
 (array_agg(j.last_error ORDER BY j.effective_started_at DESC NULLS LAST) FILTER(WHERE j.status IN ('failed','blocked') AND j.last_error IS NOT NULL))[1] sample_error,
 CASE WHEN rr.finalized_at IS NOT NULL THEN rr.job_count::bigint ELSE count(j.status) END job_count,
 rr.finalized_at,rr.terminal_status,rr.completed_job_count,rr.failed_job_count,
 (array_agg(j.failure_code) FILTER(WHERE j.failure_code IS NOT NULL))[1] failure_code
FROM public.refresh_requests rr LEFT JOIN jobs j ON j.request_id=rr.id GROUP BY rr.id;
COMMIT;
