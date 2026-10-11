-- Candidate NOT APPLIED. Requires both preceding proposals and coordinated
-- worker/cron/frontend cutover. No SECURITY DEFINER or browser EXECUTE.
BEGIN;
CREATE TABLE public.official_import_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),source_id uuid NOT NULL REFERENCES public.sources(id),
 meet_external_id text NOT NULL,source_url text NOT NULL,requested_url text NOT NULL,
 captured_at timestamptz NOT NULL,raw_hash text NOT NULL CHECK(raw_hash ~ '^[a-f0-9]{64}$'),
 raw_bytes bytea NOT NULL CHECK(octet_length(raw_bytes) BETWEEN 5 AND 20971520),
 UNIQUE(source_id,source_url,raw_hash)
);
CREATE TABLE public.official_import_conflicts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),job_id uuid NOT NULL REFERENCES public.import_v2_jobs(id),
 athlete_id uuid NOT NULL REFERENCES public.athletes(id),identity_key text NOT NULL,
 document_id uuid NOT NULL REFERENCES public.official_import_documents(id),
 existing_value jsonb NOT NULL,incoming_value jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(job_id,identity_key,document_id)
);
CREATE TABLE public.official_entry_evidence (
 entry_id uuid NOT NULL REFERENCES public.meet_entries(id) ON DELETE CASCADE,
 document_id uuid NOT NULL REFERENCES public.official_import_documents(id),
 parser_version text NOT NULL,source_block text NOT NULL,captured_at timestamptz NOT NULL,
 PRIMARY KEY(entry_id,document_id)
);
CREATE TABLE public.official_import_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),job_id uuid NOT NULL REFERENCES public.import_v2_jobs(id),
 lease_token uuid NOT NULL,batch_hash text NOT NULL CHECK(batch_hash ~ '^[a-f0-9]{64}$'),athlete_id uuid NOT NULL REFERENCES public.athletes(id),
 outcome text NOT NULL,counters jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(job_id,lease_token)
);
ALTER TABLE public.official_import_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_import_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_entry_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_import_batches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.official_import_documents,public.official_import_conflicts,public.official_entry_evidence,public.official_import_batches FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.official_import_documents,public.official_import_conflicts,public.official_entry_evidence,public.official_import_batches TO service_role;

CREATE OR REPLACE FUNCTION public.persist_official_meet_batch(p_job_id uuid,p_lease_token uuid,p_batch jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,extensions AS $$
#variable_conflict use_column
<<batch>>
DECLARE
 j public.import_v2_jobs%ROWTYPE;rr public.refresh_requests%ROWTYPE;a public.athletes%ROWTYPE;
 meet_id uuid;event_id uuid;doc_id uuid;row_id uuid;existing public.results%ROWTYPE;old_entry public.meet_entries%ROWTYPE;
 d jsonb;r jsonb;metadata jsonb;raw bytea;identity_key text;source_code text;external_id text;
 start_date date;end_date date;race_date date;pool public.swim_course;
 inserted integer:=0;duplicated integer:=0;conflicts integer:=0;entries_inserted integer:=0;entries_updated integer:=0;entries_duplicated integer:=0;
 outcome text;counters jsonb;receipt public.official_import_batches%ROWTYPE;payload_hash text;identity_count integer;
BEGIN
 -- Shared request first, then job: cancellation must take this same request
 -- lock before touching any job. No network operation occurs in this transaction.
 SELECT * INTO j FROM public.import_v2_jobs WHERE id=p_job_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'JOB_NOT_FOUND'; END IF;
 SELECT * INTO rr FROM public.refresh_requests WHERE id=j.request_id FOR UPDATE;
 SELECT * INTO j FROM public.import_v2_jobs WHERE id=p_job_id FOR UPDATE;
 payload_hash=encode(extensions.digest(convert_to(p_batch::text,'UTF8'),'sha256'),'hex');
 SELECT * INTO receipt FROM public.official_import_batches WHERE job_id=j.id AND lease_token=p_lease_token;
 IF FOUND THEN
  IF receipt.batch_hash IS DISTINCT FROM payload_hash THEN RAISE EXCEPTION 'RECEIPT_PAYLOAD_MISMATCH'; END IF;
  RETURN receipt.counters||jsonb_build_object('outcome',receipt.outcome,'receiptReplay',true);
 END IF;
 IF j.worker_version<>'official-v3' OR j.status<>'running' OR j.lease_token IS DISTINCT FROM p_lease_token
  OR j.lease_expires_at IS NULL OR j.lease_expires_at<=now() THEN RAISE EXCEPTION 'STALE_WORKER_LEASE'; END IF;
 IF rr.cancel_requested_at IS NOT NULL OR rr.terminal_status IS NOT NULL THEN RAISE EXCEPTION 'REQUEST_CANCELLED_OR_TERMINAL'; END IF;
 SELECT * INTO a FROM public.athletes WHERE id=j.athlete_id FOR SHARE;
 IF NOT FOUND OR rr.athlete_id<>a.id OR (p_batch->>'athleteId')::uuid IS DISTINCT FROM a.id
  OR (p_batch->>'accountId')::uuid IS DISTINCT FROM a.account_id THEN RAISE EXCEPTION 'TENANT_SCOPE_MISMATCH'; END IF;
 PERFORM 1 FROM public.account_members WHERE account_id=a.account_id AND user_id=rr.requested_by AND status='active' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'REQUEST_ACCESS_REVOKED'; END IF;
 SELECT code INTO source_code FROM public.sources WHERE id=j.source_id AND active AND official;
 IF source_code IS DISTINCT FROM 'swimsystem' THEN RAISE EXCEPTION 'UNSUPPORTED_OFFICIAL_SOURCE'; END IF;
 external_id=p_batch->>'athleteExternalId';
 PERFORM 1 FROM public.athlete_identifiers WHERE athlete_id=a.id AND source_id=j.source_id AND active AND verified FOR SHARE;
 PERFORM 1 FROM public.athlete_source_configs WHERE athlete_id=a.id AND source_id=j.source_id AND active FOR SHARE;
 SELECT count(DISTINCT ids.external_id) INTO identity_count FROM (
  SELECT external_id FROM public.athlete_identifiers WHERE athlete_id=a.id AND source_id=j.source_id AND active AND verified
  UNION ALL SELECT external_id FROM public.athlete_source_configs WHERE athlete_id=a.id AND source_id=j.source_id AND active
 ) ids WHERE ids.external_id IS NOT NULL AND trim(ids.external_id)<>'';
 IF external_id IS NULL OR external_id !~ '^[0-9]+$' OR identity_count<>1 OR NOT EXISTS(
  SELECT 1 FROM public.athlete_identifiers WHERE athlete_id=a.id AND source_id=j.source_id AND active AND verified AND athlete_identifiers.external_id=p_batch->>'athleteExternalId'
  UNION ALL SELECT 1 FROM public.athlete_source_configs WHERE athlete_id=a.id AND source_id=j.source_id AND active AND athlete_source_configs.external_id=p_batch->>'athleteExternalId'
 ) THEN RAISE EXCEPTION 'SOURCE_IDENTITY_NOT_VERIFIED'; END IF;
 IF jsonb_typeof(p_batch->'documents') IS DISTINCT FROM 'array' OR jsonb_typeof(p_batch->'results') IS DISTINCT FROM 'array'
  OR jsonb_typeof(p_batch->'entries') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_BATCH_SHAPE'; END IF;
 IF jsonb_array_length(p_batch->'documents') NOT BETWEEN 1 AND 16 OR jsonb_array_length(p_batch->'results')+jsonb_array_length(p_batch->'entries')>200 THEN RAISE EXCEPTION 'BATCH_LIMIT'; END IF;
 metadata=p_batch->'meet';start_date=(metadata->>'startDate')::date;end_date=(metadata->>'endDate')::date;pool=(metadata->>'course')::public.swim_course;
 IF start_date IS NULL OR end_date IS NULL OR end_date<start_date OR pool IS NULL OR coalesce(length(trim(metadata->>'name')),0)=0
  OR (metadata->>'externalMeetId') IS NULL OR (metadata->>'externalMeetId') !~ '^[a-f0-9-]{36}$'
  OR (metadata->>'officialUrl') IS DISTINCT FROM 'https://www.swimsystem.app/meets/sw/'||(metadata->>'externalMeetId') THEN RAISE EXCEPTION 'INVALID_OFFICIAL_MEET'; END IF;
 IF j.job_type<>'current_meet' OR j.cursor->>'scope' IS DISTINCT FROM 'targeted_meet'
  OR j.cursor->>'external_meet_id' IS DISTINCT FROM metadata->>'externalMeetId'
  OR j.cursor->>'official_url' IS DISTINCT FROM metadata->>'officialUrl' THEN RAISE EXCEPTION 'JOB_MEET_SCOPE_MISMATCH'; END IF;
 FOR d IN SELECT value FROM jsonb_array_elements(p_batch->'documents') LOOP
  IF (d->>'rawHash') IS NULL OR (d->>'rawHash') !~ '^[a-f0-9]{64}$'
   OR (d->>'url') IS NULL OR (d->>'url') !~ ('^https://sportstimingbrasil-swimsystem[.]supabase[.]co/storage/v1/object/public/reports/meet-documents/'||(metadata->>'externalMeetId')||'/[a-f0-9-]+[.]pdf$')
   OR (d->>'requestedUrl') IS DISTINCT FROM d->>'url' THEN RAISE EXCEPTION 'UNAPPROVED_CAPTURE_URL'; END IF;
  raw=decode(d->>'rawBase64','base64');
  IF raw IS NULL OR encode(extensions.digest(raw,'sha256'),'hex') IS DISTINCT FROM d->>'rawHash'
   OR substring(raw FROM 1 FOR 5)<>convert_to('%PDF-','UTF8') THEN RAISE EXCEPTION 'CAPTURE_BYTES_MISMATCH'; END IF;
  IF (d->>'retrievedAt') IS NULL OR (d->>'retrievedAt')::timestamptz>now()+interval '1 minute' THEN RAISE EXCEPTION 'INVALID_CAPTURE_TIME'; END IF;
  INSERT INTO public.official_import_documents(source_id,meet_external_id,source_url,requested_url,captured_at,raw_hash,raw_bytes)
   VALUES(j.source_id,metadata->>'externalMeetId',d->>'url',d->>'requestedUrl',(d->>'retrievedAt')::timestamptz,d->>'rawHash',raw)
   ON CONFLICT(source_id,source_url,raw_hash) DO NOTHING;
 END LOOP;
 INSERT INTO public.meets(source_id,external_id,name,start_date,end_date,course,official_url)
 VALUES(j.source_id,metadata->>'externalMeetId',metadata->>'name',start_date,end_date,pool,metadata->>'officialUrl')
 ON CONFLICT(source_id,external_id) DO UPDATE SET name=excluded.name,start_date=excluded.start_date,end_date=excluded.end_date,course=excluded.course,official_url=excluded.official_url RETURNING id INTO meet_id;
 FOR r IN SELECT value FROM jsonb_array_elements((p_batch->'entries')||(p_batch->'results')) ORDER BY value->>'externalEventId',value->>'round',value->>'sex',coalesce(value->>'resultDate',value->>'eventDate'),value->>'kind' LOOP
  IF (r->>'athleteId')::uuid IS DISTINCT FROM a.id OR (r->>'accountId')::uuid IS DISTINCT FROM a.account_id
   OR (r->>'athleteExternalId') IS DISTINCT FROM external_id OR (r->>'externalMeetId') IS DISTINCT FROM metadata->>'externalMeetId'
   OR (r->>'sourceCode') IS DISTINCT FROM source_code THEN RAISE EXCEPTION 'CANDIDATE_SCOPE_MISMATCH'; END IF;
  race_date=coalesce(r->>'resultDate',r->>'eventDate')::date;
  IF race_date IS NULL OR race_date NOT BETWEEN start_date AND end_date OR (r->>'course') IS DISTINCT FROM pool::text
   OR coalesce(r->>'externalEventId','') !~ '^[0-9]+$' OR coalesce(length(trim(r->>'round')),0)=0
   OR coalesce(r->>'sex','') NOT IN ('masculino','feminino') THEN RAISE EXCEPTION 'INVALID_EVENT_IDENTITY'; END IF;
  SELECT id INTO event_id FROM public.events WHERE label=r->>'event' AND active;
  IF event_id IS NULL THEN RAISE EXCEPTION 'EVENT_NOT_FOUND'; END IF;
  SELECT id INTO doc_id FROM public.official_import_documents WHERE source_id=j.source_id AND meet_external_id=metadata->>'externalMeetId'
   AND raw_hash=r->>'rawHash' AND source_url=r->>'sourceUrl';
  IF doc_id IS NULL OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_batch->'documents') v WHERE v->>'rawHash'=r->>'rawHash' AND v->>'url'=r->>'sourceUrl')
   OR coalesce(length(r->>'sourceBlock'),0) NOT BETWEEN 1 AND 8192 OR coalesce(length(r->>'parserVersion'),0)=0 THEN RAISE EXCEPTION 'CANDIDATE_EVIDENCE_MISSING'; END IF;
  identity_key=encode(extensions.digest(convert_to(jsonb_build_array(a.account_id,a.id,source_code,metadata->>'externalMeetId',external_id,r->>'externalEventId',r->>'round',r->>'sex',race_date,pool)::text,'UTF8'),'sha256'),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(identity_key,0));
  IF r->>'kind'='seeded_entry' THEN
   IF r->>'heat' IS NULL OR (r->>'heat')::integer<1 OR r->>'lane' IS NULL OR (r->>'lane')::integer NOT BETWEEN 0 AND 9
    OR r->>'scheduledAt' IS NULL OR ((r->>'scheduledAt')::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date<>race_date THEN RAISE EXCEPTION 'INCOMPLETE_SEEDING'; END IF;
   SELECT * INTO old_entry FROM public.meet_entries WHERE meet_id=batch.meet_id AND athlete_id=a.id AND meet_entries.event_id=batch.event_id
    AND official_event_number=r->>'externalEventId' AND official_round=r->>'round' AND official_sex=r->>'sex' AND official_event_date=race_date AND official_course=pool FOR UPDATE;
   IF FOUND THEN
    row_id=old_entry.id;
    IF old_entry.heat IS NOT NULL AND old_entry.heat<>(r->>'heat')::integer OR old_entry.lane IS NOT NULL AND old_entry.lane<>(r->>'lane')::integer
     OR old_entry.scheduled_at IS NOT NULL AND old_entry.scheduled_at<>(r->>'scheduledAt')::timestamptz
     OR old_entry.seed_time_ms IS NOT NULL AND r->>'seedTimeMs' IS NOT NULL AND old_entry.seed_time_ms<>(r->>'seedTimeMs')::integer THEN
     conflicts=conflicts+1;
     INSERT INTO public.official_import_conflicts(job_id,athlete_id,identity_key,document_id,existing_value,incoming_value)
      VALUES(j.id,a.id,identity_key,doc_id,to_jsonb(old_entry),r) ON CONFLICT DO NOTHING;
     CONTINUE;
    END IF;
    IF old_entry.heat IS NULL OR old_entry.lane IS NULL OR old_entry.scheduled_at IS NULL OR (old_entry.seed_time_ms IS NULL AND r->>'seedTimeMs' IS NOT NULL) THEN
     UPDATE public.meet_entries SET heat=coalesce(heat,(r->>'heat')::integer),lane=coalesce(lane,(r->>'lane')::integer),scheduled_at=coalesce(scheduled_at,(r->>'scheduledAt')::timestamptz),seed_time_ms=coalesce(seed_time_ms,(r->>'seedTimeMs')::integer) WHERE id=row_id;
     entries_updated=entries_updated+1;
    ELSE entries_duplicated=entries_duplicated+1; END IF;
   ELSE
    INSERT INTO public.meet_entries(meet_id,athlete_id,event_id,source_id,external_id,seed_time_ms,heat,lane,scheduled_at,entry_status,official_event_number,official_round,official_sex,official_event_date,official_course)
     VALUES(meet_id,a.id,event_id,j.source_id,identity_key,(r->>'seedTimeMs')::integer,(r->>'heat')::integer,(r->>'lane')::integer,(r->>'scheduledAt')::timestamptz,'seeded',r->>'externalEventId',r->>'round',r->>'sex',race_date,pool) RETURNING id INTO row_id;
    entries_inserted=entries_inserted+1;
   END IF;
   INSERT INTO public.official_entry_evidence(entry_id,document_id,parser_version,source_block,captured_at)
    VALUES(row_id,doc_id,r->>'parserVersion',r->>'sourceBlock',(r->>'retrievedAt')::timestamptz) ON CONFLICT DO NOTHING;
  ELSIF r->>'kind'='official_result' THEN
   IF coalesce(r->>'status','') NOT IN ('valid','dns','dsq','dnf') OR (r->>'status'='valid' AND (r->>'timeMs' IS NULL OR (r->>'timeMs')::integer<=0))
    OR (r->>'status'<>'valid' AND r->>'timeMs' IS NOT NULL) THEN RAISE EXCEPTION 'INVALID_OFFICIAL_RESULT'; END IF;
   -- Serializes writers for the identity, including distinct requests/jobs.
   PERFORM pg_advisory_xact_lock(hashtextextended(identity_key,0));
   SELECT * INTO existing FROM public.results WHERE official_identity_key=identity_key FOR UPDATE;
   IF FOUND THEN
    row_id=existing.id;
    IF existing.time_ms IS DISTINCT FROM (r->>'timeMs')::integer OR existing.status::text IS DISTINCT FROM r->>'status' THEN
     conflicts=conflicts+1;
     INSERT INTO public.official_import_conflicts(job_id,athlete_id,identity_key,document_id,existing_value,incoming_value)
      VALUES(j.id,a.id,identity_key,doc_id,to_jsonb(existing),r) ON CONFLICT DO NOTHING;
     CONTINUE;
    END IF;
    duplicated=duplicated+1;
   ELSE
    INSERT INTO public.results(athlete_id,meet_id,event_id,result_date,course,time_ms,status,origin,source_id,external_id,is_official,result_fingerprint,official_identity_key,official_event_number,official_round,official_sex)
     VALUES(a.id,meet_id,event_id,race_date,pool,(r->>'timeMs')::integer,(r->>'status')::public.result_status,'official',j.source_id,identity_key,true,identity_key,identity_key,r->>'externalEventId',r->>'round',r->>'sex') RETURNING id INTO row_id;
    inserted=inserted+1;
   END IF;
   INSERT INTO public.result_sources(result_id,source_id,source_url,external_id,retrieved_at,raw_hash,metadata)
    VALUES(row_id,j.source_id,r->>'sourceUrl',identity_key||':'||(r->>'rawHash'),(r->>'retrievedAt')::timestamptz,r->>'rawHash',jsonb_build_object('document_id',doc_id,'parser_version',r->>'parserVersion','source_block',r->>'sourceBlock','job_id',j.id)) ON CONFLICT DO NOTHING;
  ELSE RAISE EXCEPTION 'INVALID_CANDIDATE_KIND'; END IF;
 END LOOP;
 outcome=CASE WHEN conflicts>0 THEN 'conflicting_official_publications' WHEN jsonb_array_length(p_batch->'results')=0 THEN 'no_result_publication' ELSE 'official_results_persisted' END;
 counters=jsonb_build_object('inserted',inserted,'duplicated',duplicated,'conflicts',conflicts,'entriesInserted',entries_inserted,'entriesUpdated',entries_updated,'entriesDuplicated',entries_duplicated);
 INSERT INTO public.official_import_batches(job_id,lease_token,batch_hash,athlete_id,outcome,counters) VALUES(j.id,p_lease_token,payload_hash,a.id,outcome,counters);
 UPDATE public.import_v2_jobs SET status=CASE WHEN conflicts>0 THEN 'blocked' ELSE 'completed' END,
  records_found=jsonb_array_length(p_batch->'results')+jsonb_array_length(p_batch->'entries'),records_inserted=inserted,records_duplicated=duplicated,
  failure_code=CASE WHEN outcome='official_results_persisted' THEN NULL ELSE outcome END,last_error=CASE WHEN outcome='official_results_persisted' THEN NULL ELSE outcome END,
  locked_at=NULL,lease_token=NULL,lease_expires_at=NULL,next_run_at=NULL,updated_at=now() WHERE id=j.id;
 PERFORM public.finalize_official_import_request(j.request_id);
 RETURN counters||jsonb_build_object('outcome',outcome);
END $$;
REVOKE ALL ON FUNCTION public.persist_official_meet_batch(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.persist_official_meet_batch(uuid,uuid,jsonb) TO service_role;
COMMIT;
