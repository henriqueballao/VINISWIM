-- Candidate NOT APPLIED. Server-only context, never accept browser athlete IDs
-- as worker authority. Persistence repeats authorization while holding locks.
BEGIN;
CREATE OR REPLACE FUNCTION public.load_official_import_context(p_job_id uuid,p_lease_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE j public.import_v2_jobs%ROWTYPE;rr public.refresh_requests%ROWTYPE;a public.athletes%ROWTYPE;ids text[];
BEGIN
 SELECT * INTO j FROM public.import_v2_jobs WHERE id=p_job_id;
 IF NOT FOUND OR j.worker_version<>'official-v3' OR j.status<>'running' OR j.lease_token IS DISTINCT FROM p_lease_token OR j.lease_expires_at IS NULL OR j.lease_expires_at<=now() THEN RAISE EXCEPTION 'STALE_WORKER_LEASE'; END IF;
 SELECT * INTO rr FROM public.refresh_requests WHERE id=j.request_id;
 IF NOT FOUND OR rr.cancel_requested_at IS NOT NULL OR rr.terminal_status IS NOT NULL THEN RAISE EXCEPTION 'REQUEST_CANCELLED_OR_TERMINAL'; END IF;
 SELECT * INTO a FROM public.athletes WHERE id=j.athlete_id;
 IF NOT FOUND OR rr.athlete_id IS DISTINCT FROM a.id OR NOT EXISTS(SELECT 1 FROM public.account_members WHERE account_id=a.account_id AND user_id=rr.requested_by AND status='active') THEN RAISE EXCEPTION 'REQUEST_ACCESS_REVOKED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sources WHERE id=j.source_id AND code='swimsystem' AND active AND official) THEN RAISE EXCEPTION 'UNSUPPORTED_OFFICIAL_SOURCE'; END IF;
 IF EXISTS(SELECT 1 FROM public.athlete_source_configs WHERE athlete_id=a.id AND source_id=j.source_id)
 AND NOT EXISTS(SELECT 1 FROM public.athlete_source_configs WHERE athlete_id=a.id AND source_id=j.source_id AND active) THEN RAISE EXCEPTION 'REQUEST_ACCESS_REVOKED'; END IF;
 SELECT array_agg(DISTINCT external_id) INTO ids FROM (
  SELECT external_id FROM public.athlete_identifiers WHERE athlete_id=a.id AND source_id=j.source_id AND active AND verified
  UNION ALL SELECT external_id FROM public.athlete_source_configs WHERE athlete_id=a.id AND source_id=j.source_id AND active
 ) identities WHERE external_id IS NOT NULL AND trim(external_id)<>'';
 IF cardinality(ids) IS DISTINCT FROM 1 OR ids[1] !~ '^[0-9]+$' THEN RAISE EXCEPTION 'SOURCE_IDENTITY_MISSING_OR_AMBIGUOUS'; END IF;
 IF j.job_type='historical' AND j.cursor->>'scope'='meet_catalog' THEN
  IF j.cursor->>'catalog_url' IS NULL OR j.cursor->>'catalog_url' !~ '^https://www[.]swimsystem[.]app/meets([?]page=[1-9][0-9]*)?$' THEN RAISE EXCEPTION 'UNSUPPORTED_JOB_TYPE'; END IF;
  RETURN jsonb_build_object('athlete',jsonb_build_object('id',a.id,'account_id',a.account_id),'identity',jsonb_build_object('externalId',ids[1]),'scope','meet_catalog','catalogUrl',j.cursor->>'catalog_url');
 END IF;
 IF j.job_type<>'current_meet' OR j.cursor->>'scope' IS DISTINCT FROM 'targeted_meet'
  OR j.cursor->>'official_url' IS DISTINCT FROM 'https://www.swimsystem.app/meets/sw/'||(j.cursor->>'external_meet_id') THEN RAISE EXCEPTION 'UNSUPPORTED_JOB_TYPE'; END IF;
 RETURN jsonb_build_object('athlete',jsonb_build_object('id',a.id,'account_id',a.account_id),'identity',jsonb_build_object('externalId',ids[1]),'officialUrl',j.cursor->>'official_url');
END $$;
REVOKE ALL ON FUNCTION public.load_official_import_context(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.load_official_import_context(uuid,uuid) TO service_role;
COMMIT;
