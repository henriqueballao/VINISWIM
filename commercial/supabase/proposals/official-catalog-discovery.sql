-- Candidate NOT APPLIED. Requires leases, context and outcomes. No result writes.
BEGIN;
CREATE TABLE public.official_catalog_captures (
 job_id uuid PRIMARY KEY REFERENCES public.import_v2_jobs(id),lease_token uuid NOT NULL,
 source_url text NOT NULL,captured_at timestamptz NOT NULL,raw_hash text NOT NULL,
 raw_bytes bytea NOT NULL,payload_hash text NOT NULL,outcome jsonb NOT NULL,
 CHECK(octet_length(raw_bytes) BETWEEN 1 AND 4194304)
);
ALTER TABLE public.official_catalog_captures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.official_catalog_captures FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.official_catalog_captures TO service_role;
CREATE UNIQUE INDEX official_job_request_scope_uidx ON public.import_v2_jobs
 (request_id,(cursor->>'scope'),(coalesce(cursor->>'official_url',cursor->>'catalog_url')))
 WHERE worker_version='official-v3';
CREATE FUNCTION public.request_official_catalog_import(p_athlete_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE source uuid;request uuid;job uuid;ids text[];
BEGIN
 PERFORM 1 FROM public.athletes a JOIN public.account_members m ON m.account_id=a.account_id
 WHERE a.id=p_athlete_id AND m.user_id=auth.uid() AND m.status='active' FOR SHARE OF a,m;
 IF auth.uid() IS NULL OR NOT FOUND THEN RAISE EXCEPTION 'ATHLETE_ACCESS_DENIED'; END IF;
 SELECT id INTO source FROM public.sources WHERE code='swimsystem' AND active AND official;
 IF source IS NULL THEN RAISE EXCEPTION 'OFFICIAL_SOURCE_UNAVAILABLE'; END IF;
 SELECT array_agg(DISTINCT external_id) INTO ids FROM (
  SELECT external_id FROM public.athlete_identifiers WHERE athlete_id=p_athlete_id AND source_id=source AND active AND verified
  UNION ALL SELECT external_id FROM public.athlete_source_configs WHERE athlete_id=p_athlete_id AND source_id=source AND active
 ) x WHERE external_id IS NOT NULL AND trim(external_id)<>'';
 IF cardinality(ids) IS DISTINCT FROM 1 OR ids[1] !~ '^[0-9]+$' THEN RAISE EXCEPTION 'SOURCE_IDENTITY_MISSING_OR_AMBIGUOUS'; END IF;
 -- Do not upgrade an athlete SHARE lock: import commit also holds it while
 -- reading source configs, including the config triggering this enrollment.
 PERFORM pg_advisory_xact_lock(hashtextextended('catalog-request:'||p_athlete_id::text,0));
 INSERT INTO public.official_catalog_subscriptions(athlete_id,source_id,requested_by)
 VALUES(p_athlete_id,source,auth.uid())
 ON CONFLICT(athlete_id,source_id) DO UPDATE SET active=true,requested_by=excluded.requested_by,updated_at=now();
 SELECT r.id INTO request FROM public.refresh_requests r JOIN public.import_v2_jobs j ON j.request_id=r.id
 WHERE r.athlete_id=p_athlete_id AND r.requested_by=auth.uid() AND r.terminal_status IS NULL AND r.cancel_requested_at IS NULL
 AND j.worker_version='official-v3' AND j.source_id=source AND j.cursor->>'scope'='meet_catalog'
 ORDER BY r.created_at DESC LIMIT 1;
 IF FOUND THEN RETURN jsonb_build_object('request_id',request,'status','pending','reused',true); END IF;
 INSERT INTO public.refresh_requests(athlete_id,requested_by,source_codes,job_count)
 VALUES(p_athlete_id,auth.uid(),ARRAY['swimsystem'],1) RETURNING id INTO request;
 INSERT INTO public.import_v2_jobs(request_id,athlete_id,source_id,job_type,worker_version,cursor)
 VALUES(request,p_athlete_id,source,'historical','official-v3',jsonb_build_object('scope','meet_catalog','catalog_url','https://www.swimsystem.app/meets')) RETURNING id INTO job;
 RETURN jsonb_build_object('request_id',request,'job_id',job,'status','pending','reused',false);
END $$;
REVOKE ALL ON FUNCTION public.request_official_catalog_import(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_official_catalog_import(uuid) TO authenticated;

CREATE FUNCTION public.persist_official_catalog(p_job_id uuid,p_lease_token uuid,p_catalog jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,extensions AS $$
DECLARE j public.import_v2_jobs;rr public.refresh_requests;receipt public.official_catalog_captures;
 raw bytea;payload_hash text;url text;child text;scope text;inserted integer:=0;n integer;answer jsonb;
BEGIN
 SELECT * INTO j FROM public.import_v2_jobs WHERE id=p_job_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'JOB_NOT_FOUND'; END IF;
 SELECT * INTO rr FROM public.refresh_requests WHERE id=j.request_id FOR UPDATE;
 SELECT * INTO j FROM public.import_v2_jobs WHERE id=p_job_id FOR UPDATE;
 payload_hash=encode(extensions.digest(convert_to(p_catalog::text,'UTF8'),'sha256'),'hex');
 SELECT * INTO receipt FROM public.official_catalog_captures WHERE job_id=j.id AND lease_token=p_lease_token;
 IF FOUND THEN
  IF receipt.payload_hash IS DISTINCT FROM payload_hash THEN RAISE EXCEPTION 'RECEIPT_PAYLOAD_MISMATCH'; END IF;
  RETURN receipt.outcome||jsonb_build_object('receiptReplay',true);
 END IF;
 -- Rechecks lease, actor, tenant and identity before expansion, not just fetching.
 PERFORM public.load_official_import_context(j.id,p_lease_token);
 IF j.cursor->>'scope'<>'meet_catalog' THEN RAISE EXCEPTION 'UNSUPPORTED_JOB_TYPE'; END IF;
 url=p_catalog->>'url';
 IF url IS DISTINCT FROM j.cursor->>'catalog_url' OR url !~ '^https://www[.]swimsystem[.]app/meets([?]page=[1-9][0-9]*)?$'
 OR jsonb_typeof(p_catalog->'meetUrls') IS DISTINCT FROM 'array' OR jsonb_typeof(p_catalog->'pageUrls') IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'INVALID_CATALOG_CAPTURE'; END IF;
 IF jsonb_array_length(p_catalog->'meetUrls')+jsonb_array_length(p_catalog->'pageUrls') NOT BETWEEN 1 AND 2000
 THEN RAISE EXCEPTION 'INVALID_CATALOG_CAPTURE'; END IF;
 raw=decode(p_catalog->>'rawBase64','base64');
 IF raw IS NULL OR octet_length(raw) NOT BETWEEN 1 AND 4194304
 OR encode(extensions.digest(raw,'sha256'),'hex') IS DISTINCT FROM p_catalog->>'rawHash'
 OR (p_catalog->>'retrievedAt') IS NULL OR (p_catalog->>'retrievedAt')::timestamptz>now()+interval '1 minute'
 THEN RAISE EXCEPTION 'CAPTURE_BYTES_MISMATCH'; END IF;
 FOR child,scope IN
  SELECT value,'targeted_meet' FROM jsonb_array_elements_text(p_catalog->'meetUrls')
  UNION ALL SELECT value,'meet_catalog' FROM jsonb_array_elements_text(p_catalog->'pageUrls')
 LOOP
  IF (scope='targeted_meet' AND child !~ '^https://www[.]swimsystem[.]app/meets/sw/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$')
  OR (scope='meet_catalog' AND child !~ '^https://www[.]swimsystem[.]app/meets[?]page=[1-9][0-9]*$')
  THEN RAISE EXCEPTION 'INVALID_CATALOG_CAPTURE'; END IF;
  INSERT INTO public.import_v2_jobs(request_id,athlete_id,source_id,job_type,worker_version,priority,cursor)
  VALUES(j.request_id,j.athlete_id,j.source_id,CASE WHEN scope='meet_catalog' THEN 'historical' ELSE 'current_meet' END,'official-v3',10,
   CASE WHEN scope='meet_catalog' THEN jsonb_build_object('scope',scope,'catalog_url',child)
   ELSE jsonb_build_object('scope',scope,'official_url',child,'external_meet_id',substring(child FROM '/meets/sw/([^/]+)$'),'catalog_discovery',true) END)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n=ROW_COUNT;inserted=inserted+n;
 END LOOP;
 -- Children exist before parent completion/finalizer observes the request.
 UPDATE public.refresh_requests SET job_count=(SELECT count(*) FROM public.import_v2_jobs WHERE request_id=j.request_id),updated_at=now() WHERE id=j.request_id;
 answer=jsonb_build_object('outcome','catalog_discovered','enqueued',inserted,'resultsInserted',0);
 INSERT INTO public.official_catalog_captures VALUES(j.id,p_lease_token,url,(p_catalog->>'retrievedAt')::timestamptz,p_catalog->>'rawHash',raw,payload_hash,answer);
 UPDATE public.import_v2_jobs SET status='completed',failure_code=NULL,last_error=NULL,locked_at=NULL,lease_token=NULL,lease_expires_at=NULL,
 records_found=jsonb_array_length(p_catalog->'meetUrls'),records_inserted=0,updated_at=now() WHERE id=j.id;
 PERFORM public.finalize_official_import_request(j.request_id);
 RETURN answer;
END $$;
REVOKE ALL ON FUNCTION public.persist_official_catalog(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.persist_official_catalog(uuid,uuid,jsonb) TO service_role;
COMMIT;
