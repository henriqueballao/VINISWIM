-- Candidate NOT APPLIED. Load after leases and before batch transaction.
-- Only service role can record outcomes. Every mutation requires the current
-- lease, and takes the same request-before-job locks as cancellation/commit.
BEGIN;
CREATE OR REPLACE FUNCTION public.finalize_official_import_request(p_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE rr public.refresh_requests%ROWTYPE;total integer;active_count integer;failed_count integer;completed_count integer;
BEGIN
 SELECT * INTO rr FROM public.refresh_requests WHERE id=p_request_id;
 IF NOT FOUND THEN RETURN; END IF;
 rr=public.lock_official_request(coalesce(rr.catalog_root_request_id,rr.id));
 IF NOT FOUND OR rr.terminal_status IS NOT NULL OR rr.cancel_requested_at IS NOT NULL THEN RETURN; END IF;
 -- Mixed legacy requests are handled by their existing finalizer until cutover.
 IF EXISTS(SELECT 1 FROM public.import_v2_jobs WHERE request_id=rr.id AND worker_version<>'official-v3') THEN RETURN; END IF;
 SELECT count(*),count(*) FILTER(WHERE status IN ('pending','running')),count(*) FILTER(WHERE status IN ('failed','blocked')),count(*) FILTER(WHERE status='completed')
 INTO total,active_count,failed_count,completed_count FROM public.import_v2_jobs WHERE request_id IN(SELECT id FROM public.refresh_requests WHERE id=rr.id OR catalog_root_request_id=rr.id);
 IF total=0 OR active_count>0 THEN RETURN; END IF;
 UPDATE public.refresh_requests SET job_count=total,terminal_status=CASE WHEN failed_count>0 THEN 'failed' WHEN completed_count=total THEN 'completed' ELSE 'cancelled' END,
  completed_job_count=completed_count,failed_job_count=failed_count,finalized_at=now(),updated_at=now() WHERE id=rr.id;
END $$;
REVOKE ALL ON FUNCTION public.finalize_official_import_request(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_official_import_request(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.finish_official_import_failure(p_job_id uuid,p_lease_token uuid,p_failure_code text,p_message text,p_retryable boolean,p_details jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE j public.import_v2_jobs%ROWTYPE;rr public.refresh_requests%ROWTYPE;next_status text;delay_seconds integer;
BEGIN
 SELECT * INTO j FROM public.import_v2_jobs WHERE id=p_job_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'JOB_NOT_FOUND'; END IF;
 rr=public.lock_official_request(j.request_id);
 SELECT * INTO j FROM public.import_v2_jobs WHERE id=p_job_id FOR UPDATE;
 IF j.worker_version<>'official-v3' OR j.status<>'running' OR j.lease_token IS DISTINCT FROM p_lease_token OR j.lease_expires_at IS NULL OR j.lease_expires_at<=now() THEN RAISE EXCEPTION 'STALE_WORKER_LEASE'; END IF;
 IF rr.cancel_requested_at IS NOT NULL OR rr.terminal_status IS NOT NULL THEN RAISE EXCEPTION 'REQUEST_CANCELLED_OR_TERMINAL'; END IF;
 IF jsonb_typeof(p_details) IS DISTINCT FROM 'object' OR octet_length(p_details::text)>8192 THEN RAISE EXCEPTION 'INVALID_FAILURE_DETAILS'; END IF;
 IF p_failure_code IS NULL OR p_failure_code NOT IN ('authentication_required','anti_bot_blocked','access_denied','identity_not_found','format_unrecognized','tls_error','timeout','document_missing','html_changed','parser_no_match','http_error','unknown','database_error','conflicting_official_publications','inconsistent_meet_evidence','unsupported_job_type') THEN RAISE EXCEPTION 'INVALID_FAILURE_CODE'; END IF;
 next_status=CASE WHEN NOT coalesce(p_retryable,false) OR p_failure_code IN ('authentication_required','anti_bot_blocked','access_denied','identity_not_found','format_unrecognized','conflicting_official_publications','inconsistent_meet_evidence','unsupported_job_type') THEN 'blocked' WHEN j.attempts>=5 THEN 'failed' ELSE 'pending' END;
 delay_seconds=least(3600,60*(2^greatest(j.attempts-1,0))::integer);
 UPDATE public.import_v2_jobs SET status=next_status,failure_code=p_failure_code,failure_details=p_details,last_error=left(coalesce(nullif(p_message,''),p_failure_code),1000),
  next_run_at=CASE WHEN next_status='pending' THEN now()+make_interval(secs=>delay_seconds) ELSE NULL END,
  locked_at=NULL,lease_token=NULL,lease_expires_at=NULL,updated_at=now() WHERE id=j.id;
 UPDATE public.official_meet_subscriptions SET last_checked_at=now(),last_outcome=p_failure_code,last_error=left(coalesce(nullif(p_message,''),p_failure_code),1000),
  next_scan_at=CASE WHEN next_status='blocked' THEN now()+interval '1 day' ELSE now()+make_interval(secs=>delay_seconds) END,updated_at=now()
 WHERE athlete_id=j.athlete_id AND source_id=j.source_id AND meet_external_id=j.cursor->>'external_meet_id';
 PERFORM public.finalize_official_import_request(j.request_id);
 RETURN jsonb_build_object('status',next_status,'failureCode',p_failure_code,'retryAfterSeconds',CASE WHEN next_status='pending' THEN delay_seconds ELSE NULL END);
END $$;
REVOKE ALL ON FUNCTION public.finish_official_import_failure(uuid,uuid,text,text,boolean,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_official_import_failure(uuid,uuid,text,text,boolean,jsonb) TO service_role;
COMMIT;
