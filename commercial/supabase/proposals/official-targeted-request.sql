-- Candidate NOT APPLIED. Activate only after the official worker, lease fence,
-- progress view and authenticated cron are tested/deployed together.
BEGIN;
CREATE OR REPLACE FUNCTION public.request_official_meet_import(p_athlete_id uuid,p_meet_url text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE source uuid;registration_count integer;meet_external text;request uuid;job uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.athletes a JOIN public.account_members m ON m.account_id=a.account_id WHERE a.id=p_athlete_id AND m.user_id=auth.uid() AND m.status='active') THEN RAISE EXCEPTION 'ATHLETE_ACCESS_DENIED'; END IF;
 IF p_meet_url IS NULL OR p_meet_url !~ '^https://www[.]swimsystem[.]app/meets/sw/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN RAISE EXCEPTION 'INVALID_OFFICIAL_MEET_URL'; END IF;
 meet_external=substring(p_meet_url FROM '/meets/sw/([^/]+)$');
 SELECT id INTO source FROM public.sources WHERE code='swimsystem' AND active AND official;
 IF source IS NULL THEN RAISE EXCEPTION 'OFFICIAL_SOURCE_UNAVAILABLE'; END IF;
 SELECT count(DISTINCT external_id) INTO registration_count FROM (
  SELECT trim(external_id) external_id FROM public.athlete_identifiers WHERE athlete_id=p_athlete_id AND source_id=source AND active AND verified
  UNION ALL SELECT trim(external_id) FROM public.athlete_source_configs WHERE athlete_id=p_athlete_id AND source_id=source AND active
 ) ids WHERE external_id ~ '^[0-9]+$';
 IF registration_count=0 THEN RAISE EXCEPTION 'SOURCE_IDENTITY_MISSING'; END IF;
 IF registration_count<>1 THEN RAISE EXCEPTION 'SOURCE_IDENTITY_CONFLICT'; END IF;
 INSERT INTO public.refresh_requests(athlete_id,requested_by,source_codes,job_count) VALUES(p_athlete_id,auth.uid(),ARRAY['swimsystem'],1) RETURNING id INTO request;
 INSERT INTO public.import_v2_jobs(request_id,athlete_id,source_id,job_type,worker_version,priority,cursor)
 VALUES(request,p_athlete_id,source,'current_meet','official-v3',0,jsonb_build_object('scope','targeted_meet','external_meet_id',meet_external,'official_url',p_meet_url)) RETURNING id INTO job;
 RETURN jsonb_build_object('request_id',request,'job_id',job,'status','pending');
END $$;
REVOKE ALL ON FUNCTION public.request_official_meet_import(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_official_meet_import(uuid,text) TO authenticated;
COMMIT;
