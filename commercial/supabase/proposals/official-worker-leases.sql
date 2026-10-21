-- Candidate only, NOT APPLIED. Requires coordinated authenticated worker + cron
-- deployment. Legacy claim must be fenced before any official-v3 job is queued.
BEGIN;
ALTER TABLE public.refresh_requests ADD COLUMN catalog_root_request_id uuid REFERENCES public.refresh_requests(id) ON DELETE RESTRICT;
CREATE INDEX refresh_catalog_root_idx ON public.refresh_requests(catalog_root_request_id) WHERE catalog_root_request_id IS NOT NULL;
CREATE FUNCTION public.lock_official_request(p_request_id uuid) RETURNS public.refresh_requests
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE rr public.refresh_requests;
BEGIN
 SELECT * INTO rr FROM public.refresh_requests WHERE id=p_request_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_NOT_FOUND'; END IF;
 PERFORM id FROM public.refresh_requests WHERE id=coalesce(rr.catalog_root_request_id,rr.id) FOR UPDATE;
 SELECT * INTO rr FROM public.refresh_requests WHERE id=p_request_id FOR UPDATE;
 RETURN rr;
END $$;
REVOKE ALL ON FUNCTION public.lock_official_request(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lock_official_request(uuid) TO service_role;
ALTER TABLE public.import_v2_jobs
 ADD COLUMN worker_version text NOT NULL DEFAULT 'legacy-v2' CHECK(worker_version IN ('legacy-v2','official-v3')),
 ADD COLUMN lease_token uuid,
 ADD COLUMN lease_expires_at timestamptz,
 ADD COLUMN failure_details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(failure_details)='object' AND octet_length(failure_details::text)<=8192);

CREATE OR REPLACE FUNCTION public.claim_official_import_jobs(p_limit integer DEFAULT 1)
RETURNS SETOF public.import_v2_jobs LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public AS $$
DECLARE request_row public.refresh_requests%ROWTYPE;
BEGIN
 -- Recover in the same request-before-job order as commit/cancellation. Skip a
 -- request already locked by either operation instead of creating a deadlock.
 FOR request_row IN SELECT r.* FROM public.refresh_requests r WHERE r.catalog_root_request_id IS NULL AND EXISTS(
  SELECT 1 FROM public.import_v2_jobs j JOIN public.refresh_requests child ON child.id=j.request_id WHERE coalesce(child.catalog_root_request_id,child.id)=r.id AND j.worker_version='official-v3' AND j.status='running'
   AND (j.lease_expires_at IS NULL OR j.lease_expires_at<now())
 ) ORDER BY r.id FOR UPDATE OF r SKIP LOCKED LIMIT 64 LOOP
  UPDATE public.import_v2_jobs j SET
   status=CASE WHEN request_row.cancel_requested_at IS NOT NULL OR request_row.terminal_status IS NOT NULL THEN 'cancelled' WHEN j.attempts>=5 THEN 'failed' ELSE 'pending' END,
   lease_token=NULL,lease_expires_at=NULL,locked_at=NULL,
   next_run_at=CASE WHEN request_row.cancel_requested_at IS NULL AND request_row.terminal_status IS NULL AND j.attempts<5 THEN now() ELSE NULL END,
   failure_code='lease_expired',last_error=left(concat_ws('; ',j.last_error,'Worker lease expired'),1000),updated_at=now()
  FROM (SELECT id FROM public.import_v2_jobs WHERE request_id IN(SELECT id FROM public.refresh_requests WHERE id=request_row.id OR catalog_root_request_id=request_row.id) AND worker_version='official-v3' AND status='running'
   AND (lease_expires_at IS NULL OR lease_expires_at<now()) ORDER BY id FOR UPDATE SKIP LOCKED) expired
  WHERE j.id=expired.id;
 END LOOP;
 RETURN QUERY WITH picked AS (
  SELECT j.id FROM public.import_v2_jobs j JOIN public.refresh_requests r ON r.id=j.request_id
  WHERE j.worker_version='official-v3' AND j.status='pending' AND r.cancel_requested_at IS NULL
   AND r.terminal_status IS NULL AND j.attempts<5 AND (j.next_run_at IS NULL OR j.next_run_at<=now())
  ORDER BY j.priority,j.created_at FOR UPDATE OF j SKIP LOCKED LIMIT least(greatest(coalesce(p_limit,1),1),4)
 ) UPDATE public.import_v2_jobs j SET status='running',locked_at=now(),last_run_at=now(),attempts=j.attempts+1,
  lease_token=gen_random_uuid(),lease_expires_at=now()+interval '2 minutes',updated_at=now()
 FROM picked p WHERE p.id=j.id RETURNING j.*;
END $$;
REVOKE ALL ON FUNCTION public.claim_official_import_jobs(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_official_import_jobs(integer) TO service_role;

-- Fence the old runner. It must never claim attested transactions.
CREATE OR REPLACE FUNCTION public.claim_import_v2_jobs(p_limit integer DEFAULT 1)
RETURNS SETOF public.import_v2_jobs LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
BEGIN
 RETURN QUERY WITH picked AS (
  SELECT j.id FROM public.import_v2_jobs j WHERE j.worker_version='legacy-v2' AND j.status='pending'
   AND (j.next_run_at IS NULL OR j.next_run_at<=now())
  ORDER BY j.priority,j.created_at FOR UPDATE SKIP LOCKED LIMIT greatest(coalesce(p_limit,1),1)
 ) UPDATE public.import_v2_jobs j SET status='running',locked_at=now(),last_run_at=now(),attempts=j.attempts+1,updated_at=now()
 FROM picked p WHERE p.id=j.id RETURNING j.*;
END $$;
REVOKE ALL ON FUNCTION public.claim_import_v2_jobs(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_import_v2_jobs(integer) TO service_role;
COMMIT;
