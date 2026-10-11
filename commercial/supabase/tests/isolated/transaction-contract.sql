-- SYNTHETIC ONLY. Isolated Postgres; no production credentials or sporting data.
-- Relevant audited contracts, not a full Supabase snapshot or trigger suite.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
CREATE TYPE swim_course AS ENUM ('SCM','LCM');
CREATE TYPE result_status AS ENUM ('valid','dns','dsq','dnf','partial');
CREATE TYPE result_origin AS ENUM ('manual','official','import');
CREATE TYPE entry_status AS ENUM ('entered','seeded','withdrawn','dns','cancelled');
CREATE TABLE sources(id uuid PRIMARY KEY,code text,active boolean,official boolean);
CREATE TABLE athletes(id uuid PRIMARY KEY,account_id uuid NOT NULL);
CREATE TABLE account_members(account_id uuid,user_id uuid,status text);
CREATE TABLE athlete_identifiers(athlete_id uuid REFERENCES athletes(id),source_id uuid REFERENCES sources(id),external_id text,active boolean,verified boolean);
CREATE TABLE athlete_source_configs(athlete_id uuid REFERENCES athletes(id),source_id uuid REFERENCES sources(id),external_id text,active boolean);
CREATE TABLE events(id uuid PRIMARY KEY,label text NOT NULL,active boolean NOT NULL);
CREATE TABLE meets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),source_id uuid REFERENCES sources(id),external_id text,name text NOT NULL,start_date date NOT NULL,end_date date,course swim_course,official_url text,UNIQUE(source_id,external_id));
CREATE TABLE refresh_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),athlete_id uuid REFERENCES athletes(id),requested_by uuid NOT NULL,cancel_requested_at timestamptz,terminal_status text,updated_at timestamptz DEFAULT now(),completed_job_count integer,failed_job_count integer,finalized_at timestamptz);
CREATE TABLE import_v2_jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_id uuid REFERENCES refresh_requests(id),athlete_id uuid REFERENCES athletes(id),source_id uuid REFERENCES sources(id),status text NOT NULL DEFAULT 'pending',attempts integer NOT NULL DEFAULT 0,priority integer NOT NULL DEFAULT 10,locked_at timestamptz,last_run_at timestamptz,next_run_at timestamptz DEFAULT now(),failure_code text,last_error text,records_found integer DEFAULT 0,records_inserted integer DEFAULT 0,records_duplicated integer DEFAULT 0,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),CONSTRAINT import_v2_jobs_status_check CHECK(status IN ('pending','running','completed','failed','cancelled')));
CREATE TABLE results(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),athlete_id uuid REFERENCES athletes(id),meet_id uuid REFERENCES meets(id),event_id uuid REFERENCES events(id),result_date date,course swim_course,time_ms integer CHECK(time_ms IS NULL OR time_ms>0),status result_status NOT NULL,origin result_origin NOT NULL,source_id uuid REFERENCES sources(id),external_id text,is_official boolean NOT NULL,result_fingerprint text);
CREATE UNIQUE INDEX results_source_external_uidx ON results(source_id,external_id) WHERE source_id IS NOT NULL AND external_id IS NOT NULL;
CREATE UNIQUE INDEX results_fingerprint_uidx ON results(result_fingerprint) WHERE result_fingerprint IS NOT NULL;
CREATE TABLE result_sources(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),result_id uuid REFERENCES results(id),source_id uuid REFERENCES sources(id),source_url text,external_id text,retrieved_at timestamptz,raw_hash text,metadata jsonb,UNIQUE(result_id,source_id,external_id));
CREATE TABLE meet_entries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),meet_id uuid REFERENCES meets(id),athlete_id uuid REFERENCES athletes(id),event_id uuid REFERENCES events(id),source_id uuid REFERENCES sources(id),external_id text,seed_time_ms integer CHECK(seed_time_ms IS NULL OR seed_time_ms>0),heat integer CHECK(heat IS NULL OR heat>0),lane integer,scheduled_at timestamptz,entry_status entry_status,CONSTRAINT meet_entries_lane_check CHECK(lane IS NULL OR lane>0));
CREATE UNIQUE INDEX meet_entries_natural_uidx ON meet_entries(meet_id,athlete_id,event_id);
\ir ../../proposals/official-event-integrity.sql
\ir ../../proposals/official-worker-leases.sql
\ir ../../proposals/official-batch-transaction.sql
CREATE TABLE monitor_jobs(request_id uuid,status text,locked_at timestamptz,next_run_at timestamptz,updated_at timestamptz);
CREATE TABLE historical_archive_jobs(request_id uuid,status text,heartbeat_at timestamptz,finished_at timestamptz,updated_at timestamptz);
\ir ../../proposals/official-request-cancellation.sql
GRANT USAGE ON SCHEMA public,extensions TO service_role;
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO service_role;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
CREATE POLICY result_member ON results FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM athletes a JOIN account_members m ON m.account_id=a.account_id WHERE a.id=results.athlete_id AND m.user_id=auth.uid() AND m.status='active'));
GRANT SELECT ON results,athletes,account_members TO authenticated;
INSERT INTO sources VALUES('00000000-0000-4000-8000-000000000001','swimsystem',true,true);
INSERT INTO athletes VALUES('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000021'),('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000022');
INSERT INTO account_members VALUES('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000031','active'),('00000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-000000000032','active');
INSERT INTO athlete_identifiers SELECT id,'00000000-0000-4000-8000-000000000001','700001',true,true FROM athletes;
INSERT INTO events VALUES('00000000-0000-4000-8000-000000000041','100 Livre',true);
CREATE FUNCTION pg_temp.new_job(athlete uuid DEFAULT '00000000-0000-4000-8000-000000000011',usr uuid DEFAULT '00000000-0000-4000-8000-000000000031') RETURNS import_v2_jobs LANGUAGE plpgsql AS $$
DECLARE request uuid; j import_v2_jobs;
BEGIN
 INSERT INTO refresh_requests(athlete_id,requested_by) VALUES(athlete,usr) RETURNING id INTO request;
 INSERT INTO import_v2_jobs(request_id,athlete_id,source_id,worker_version) VALUES(request,athlete,'00000000-0000-4000-8000-000000000001','official-v3');
 SELECT * INTO j FROM claim_official_import_jobs(1); RETURN j;
END $$;
CREATE FUNCTION pg_temp.batch(athlete uuid DEFAULT '00000000-0000-4000-8000-000000000011',account uuid DEFAULT '00000000-0000-4000-8000-000000000021') RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE url text:='https://sportstimingbrasil-swimsystem.supabase.co/storage/v1/object/public/reports/meet-documents/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb.pdf';raw bytea:=convert_to('%PDF-SYNTHETIC-ISOLATED-CONTRACT','UTF8');doc jsonb;r jsonb;
BEGIN
 doc=jsonb_build_object('url',url,'requestedUrl',url,'rawHash',encode(extensions.digest(raw,'sha256'),'hex'),'rawBase64',encode(raw,'base64'),'retrievedAt','2026-10-11T10:00:00Z');
 r=jsonb_build_object('kind','official_result','accountId',account,'athleteId',athlete,'athleteExternalId','700001','sourceCode','swimsystem','externalMeetId','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','externalEventId','16','round','Final Direta','sex','masculino','event','100 Livre','resultDate','2026-10-10','course','LCM','status','valid','timeMs',12345,'sourceUrl',url,'rawHash',doc->>'rawHash','retrievedAt',doc->>'retrievedAt','sourceBlock','SYNTHETIC athlete 700001 result','parserVersion','synthetic-isolated-v1');
 RETURN jsonb_build_object('accountId',account,'athleteId',athlete,'athleteExternalId','700001','meet',jsonb_build_object('name','SYNTHETIC ONLY','externalMeetId','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','officialUrl','https://www.swimsystem.app/meets/sw/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','startDate','2026-10-10','endDate','2026-10-11','course','LCM'),'documents',jsonb_build_array(doc),'entries','[]'::jsonb,'results',jsonb_build_array(r));
END $$;
DO $$
DECLARE j import_v2_jobs;b jsonb;outcome jsonb;before_count integer;
BEGIN
 j=pg_temp.new_job();b=pg_temp.batch();outcome=persist_official_meet_batch(j.id,j.lease_token,b);
 IF (outcome->>'inserted')::integer<>1 THEN RAISE EXCEPTION 'Initial insert failed'; END IF;
 j=pg_temp.new_job();outcome=persist_official_meet_batch(j.id,j.lease_token,b);
 IF (outcome->>'duplicated')::integer<>1 OR (SELECT count(*) FROM results)<>1 OR (SELECT count(*) FROM result_sources)<>1 THEN RAISE EXCEPTION 'Reimport not idempotent'; END IF;
 j=pg_temp.new_job();outcome=persist_official_meet_batch(j.id,j.lease_token,jsonb_set(b,'{results,0,timeMs}','12346'));
 IF (outcome->>'conflicts')::integer<>1 OR (SELECT time_ms FROM results)<>12345 THEN RAISE EXCEPTION 'Correction overwrote original or duplicated'; END IF;
 j=pg_temp.new_job();
 BEGIN
  PERFORM persist_official_meet_batch(j.id,j.lease_token,jsonb_set(b,'{accountId}','"00000000-0000-4000-8000-000000000022"'));
  RAISE EXCEPTION 'Cross-account batch accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'TENANT_SCOPE_MISMATCH' THEN RAISE; END IF; END;
 BEGIN
  PERFORM persist_official_meet_batch(j.id,gen_random_uuid(),b);RAISE EXCEPTION 'Wrong token accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'STALE_WORKER_LEASE' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000032',true);
 BEGIN
  PERFORM cancel_result_refresh_request(j.request_id);RAISE EXCEPTION 'Cross-account cancellation accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'REQUEST_ACCESS_DENIED' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000031',true);
 PERFORM cancel_result_refresh_request(j.request_id);
 BEGIN
  PERFORM persist_official_meet_batch(j.id,j.lease_token,b);RAISE EXCEPTION 'Cancelled request wrote';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'STALE_WORKER_LEASE' THEN RAISE; END IF; END;
 UPDATE import_v2_jobs SET status='cancelled' WHERE id=j.id;
 j=pg_temp.new_job();
 BEGIN
  PERFORM persist_official_meet_batch(j.id,j.lease_token,jsonb_set(b,'{documents,0,rawHash}',to_jsonb(repeat('0',64))));RAISE EXCEPTION 'Forged hash accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'CAPTURE_BYTES_MISMATCH' THEN RAISE; END IF; END;
 -- New tenant tracks the same federation ID; results stay separate.
 UPDATE import_v2_jobs SET status='cancelled' WHERE id=j.id;
 j=pg_temp.new_job('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000032');
 outcome=persist_official_meet_batch(j.id,j.lease_token,pg_temp.batch('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000022'));
 IF (SELECT count(*) FROM results)<>2 THEN RAISE EXCEPTION 'Separate tenant merged'; END IF;
 -- Valid first candidate then invalid second must roll back the whole batch.
 j=pg_temp.new_job();b=jsonb_set(b,'{results,0,externalEventId}','"20"');
 b=jsonb_set(b,'{results}',(b->'results')||jsonb_build_array(jsonb_set(b->'results'->0,'{externalEventId}','"21"')||jsonb_build_object('status','partial')));
 before_count=(SELECT count(*) FROM results);
 BEGIN
  PERFORM persist_official_meet_batch(j.id,j.lease_token,b);RAISE EXCEPTION 'Partial batch accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'INVALID_OFFICIAL_RESULT' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM results)<>before_count THEN RAISE EXCEPTION 'Batch not atomic'; END IF;
 IF has_function_privilege('anon','persist_official_meet_batch(uuid,uuid,jsonb)','EXECUTE') OR has_function_privilege('authenticated','persist_official_meet_batch(uuid,uuid,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Browser has privileged RPC'; END IF;
END $$;
DO $$
DECLARE j import_v2_jobs;b jsonb;r jsonb;answer jsonb;
BEGIN
 -- Abandon the invalid synthetic job from the rollback test.
 UPDATE import_v2_jobs SET status='cancelled' WHERE status='running';
 b=pg_temp.batch();r=(b->'results'->0)-'resultDate'-'status'-'timeMs';
 r=r||jsonb_build_object('kind','seeded_entry','eventDate','2026-10-10','seedTimeMs',20000,'heat',1,'lane',0,'scheduledAt','2026-10-10T12:00:00Z','sourceBlock','SYNTHETIC seeded athlete 700001');
 b=jsonb_set(jsonb_set(b,'{results}','[]'),'{entries}',jsonb_build_array(r));
 j=pg_temp.new_job();answer=persist_official_meet_batch(j.id,j.lease_token,b);
 IF (answer->>'entriesInserted')::integer<>1 OR (SELECT lane FROM meet_entries)<>0 THEN RAISE EXCEPTION 'Complete lane-zero seeding not persisted'; END IF;
 IF (SELECT count(*) FROM results)<>2 THEN RAISE EXCEPTION 'Seed became official result'; END IF;
 j=pg_temp.new_job();answer=persist_official_meet_batch(j.id,j.lease_token,b);
 IF (answer->>'entriesDuplicated')::integer<>1 OR (answer->>'entriesUpdated')::integer<>0 OR (SELECT count(*) FROM meet_entries)<>1 THEN RAISE EXCEPTION 'Seeding reimport not idempotent'; END IF;
 j=pg_temp.new_job();answer=persist_official_meet_batch(j.id,j.lease_token,jsonb_set(b,'{entries,0,seedTimeMs}','null'));
 IF (SELECT seed_time_ms FROM meet_entries)<>20000 THEN RAISE EXCEPTION 'Missing seed erased valid inscription'; END IF;
 j=pg_temp.new_job();answer=persist_official_meet_batch(j.id,j.lease_token,jsonb_set(b,'{entries,0,lane}','2'));
 IF (answer->>'conflicts')::integer<>1 OR (SELECT lane FROM meet_entries)<>0 THEN RAISE EXCEPTION 'Contradiction overwrote seeding'; END IF;
 b=pg_temp.batch();b=jsonb_set(jsonb_set(jsonb_set(b,'{results,0,status}','"dsq"'),'{results,0,timeMs}','null'),'{results,0,externalEventId}','"99"');
 j=pg_temp.new_job();answer=persist_official_meet_batch(j.id,j.lease_token,b);
 IF NOT EXISTS(SELECT 1 FROM results WHERE status='dsq' AND time_ms IS NULL) THEN RAISE EXCEPTION 'DSQ did not persist separately'; END IF;
END $$;
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000031';
DO $$ BEGIN
 IF (SELECT count(*) FROM results)<>2 OR EXISTS(SELECT 1 FROM results WHERE athlete_id<>'00000000-0000-4000-8000-000000000011') THEN RAISE EXCEPTION 'RLS exposes other account results'; END IF;
END $$;
ROLLBACK;
SELECT set_config('test.synthetic_batch',pg_temp.batch()::text,false);
BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE request uuid; j import_v2_jobs; answer jsonb;
BEGIN
 INSERT INTO refresh_requests(athlete_id,requested_by) VALUES('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000031') RETURNING id INTO request;
 INSERT INTO import_v2_jobs(request_id,athlete_id,source_id,worker_version) VALUES(request,'00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001','official-v3');
 SELECT * INTO j FROM claim_official_import_jobs(1);
 answer=persist_official_meet_batch(j.id,j.lease_token,current_setting('test.synthetic_batch')::jsonb);
 IF (answer->>'duplicated')::integer<>1 THEN RAISE EXCEPTION 'Actual service role cannot persist'; END IF;
END $$;
ROLLBACK;
SELECT 'isolated transaction assertions passed; not live persistence' AS outcome;
