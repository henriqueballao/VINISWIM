DO $$ BEGIN IF current_database()<>'viniswim_isolated_test' THEN RAISE EXCEPTION 'Synthetic fixture must never run on production'; END IF; END $$;
-- SYNTHETIC ONLY. Isolated Postgres; no production credentials or sporting data.
-- Relevant audited contracts, not a full Supabase snapshot or trigger suite.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
\ir published-core-schema.sql
\ir ../../proposals/official-event-integrity.sql
\ir ../../proposals/official-worker-leases.sql
\ir ../../proposals/official-worker-context.sql
\ir ../../proposals/official-worker-outcomes.sql
\ir ../../proposals/official-batch-transaction.sql
CREATE TABLE monitor_jobs(request_id uuid,status text,locked_at timestamptz,next_run_at timestamptz,updated_at timestamptz,last_error text);
CREATE TABLE historical_archive_jobs(request_id uuid,status text,heartbeat_at timestamptz,finished_at timestamptz,updated_at timestamptz,started_at timestamptz,last_error text);
\ir ../../proposals/official-request-cancellation.sql
\ir ../../proposals/official-monitoring.sql
\ir ../../proposals/official-legacy-writer-fence.sql
\ir ../../proposals/official-targeted-request.sql
\ir ../../proposals/official-progress-view.sql
\ir published-triggers.sql
GRANT USAGE ON SCHEMA public,extensions TO service_role;
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO service_role;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
-- Published core fixture already installs the actual results policies.
GRANT SELECT ON results,athletes,account_members TO authenticated;
INSERT INTO accounts(id) VALUES('00000000-0000-4000-8000-000000000021'),('00000000-0000-4000-8000-000000000022');
INSERT INTO auth.users(id) VALUES('00000000-0000-4000-8000-000000000031'),('00000000-0000-4000-8000-000000000032');
INSERT INTO sources(id,code,name,source_type,active,official) VALUES('00000000-0000-4000-8000-000000000001','swimsystem','SYNTHETIC CI ONLY','official_results',true,true);
INSERT INTO athletes(id,account_id,full_name) VALUES('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000021','SYNTHETIC A'),('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000022','SYNTHETIC B');
INSERT INTO account_members(account_id,user_id,status,role) VALUES('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000031','active','owner'),('00000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-000000000032','active','owner');
INSERT INTO athlete_identifiers(athlete_id,source_id,external_id,active,verified,status) SELECT id,'00000000-0000-4000-8000-000000000001','700001',true,true,'verified' FROM athletes;
INSERT INTO events(id,distance_m,stroke,label,active) VALUES('00000000-0000-4000-8000-000000000041',100,'freestyle','100 Livre',true);
CREATE FUNCTION pg_temp.new_job(athlete uuid DEFAULT '00000000-0000-4000-8000-000000000011',usr uuid DEFAULT '00000000-0000-4000-8000-000000000031') RETURNS import_v2_jobs LANGUAGE plpgsql AS $$
DECLARE request uuid; j import_v2_jobs;
BEGIN
 INSERT INTO refresh_requests(athlete_id,requested_by) VALUES(athlete,usr) RETURNING id INTO request;
 INSERT INTO import_v2_jobs(request_id,athlete_id,source_id,worker_version,job_type,cursor) VALUES(request,athlete,'00000000-0000-4000-8000-000000000001','official-v3','current_meet','{"scope":"targeted_meet","external_meet_id":"aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa","official_url":"https://www.swimsystem.app/meets/sw/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa"}');
 SELECT * INTO j FROM claim_official_import_jobs(1); RETURN j;
END $$;
CREATE FUNCTION pg_temp.batch(athlete uuid DEFAULT '00000000-0000-4000-8000-000000000011',account uuid DEFAULT '00000000-0000-4000-8000-000000000021') RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE url text:='https://sportstimingbrasil-swimsystem.supabase.co/storage/v1/object/public/reports/meet-documents/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb.pdf';raw bytea:=convert_to('%PDF-SYNTHETIC-ISOLATED-CONTRACT','UTF8');doc jsonb;r jsonb;
BEGIN
 doc=jsonb_build_object('url',url,'requestedUrl',url,'rawHash',encode(extensions.digest(raw,'sha256'),'hex'),'rawBase64',encode(raw,'base64'),'retrievedAt','2026-10-11T10:00:00Z');
 r=jsonb_build_object('kind','official_result','accountId',account,'athleteId',athlete,'athleteExternalId','700001','sourceCode','swimsystem','externalMeetId','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','externalEventId','16','round','Final Direta','sex','masculino','event','100 Livre','resultDate','2026-10-10','course','LCM','status','valid','timeMs',12345,'sourceUrl',url,'rawHash',doc->>'rawHash','retrievedAt',doc->>'retrievedAt','sourceBlock','SYNTHETIC athlete 700001 result','parserVersion','synthetic-isolated-v1');
 RETURN jsonb_build_object('accountId',account,'athleteId',athlete,'athleteExternalId','700001','meet',jsonb_build_object('name','SYNTHETIC ONLY','externalMeetId','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','officialUrl','https://www.swimsystem.app/meets/sw/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','startDate','2026-10-10','endDate','2026-10-11','course','LCM'),'documents',jsonb_build_array(doc),'entries','[]'::jsonb,'results',jsonb_build_array(r));
END $$;
BEGIN;
DO $$
DECLARE j import_v2_jobs;
BEGIN
 j=pg_temp.new_job();UPDATE import_v2_jobs SET status='blocked' WHERE id=j.id;
 IF (SELECT terminal_status FROM refresh_requests WHERE id=j.request_id)<>'completed' THEN RAISE EXCEPTION 'Published blocked-finalizer defect not reproduced'; END IF;
END $$;
ROLLBACK;
\ir ../../proposals/official-finalization-trigger.sql
\ir ../../proposals/official-personal-best-concurrency.sql
DO $$
DECLARE j import_v2_jobs;b jsonb;outcome jsonb;before_count integer;
BEGIN
 j=pg_temp.new_job();b=pg_temp.batch();outcome=persist_official_meet_batch(j.id,j.lease_token,b);
 IF (outcome->>'inserted')::integer<>1 THEN RAISE EXCEPTION 'Initial insert failed'; END IF;
 outcome=persist_official_meet_batch(j.id,j.lease_token,b);
 IF outcome->>'receiptReplay'<>'true' OR (SELECT count(*) FROM official_import_batches)<>1 THEN RAISE EXCEPTION 'Lost-response retry duplicated batch'; END IF;
 BEGIN
  PERFORM persist_official_meet_batch(j.id,j.lease_token,jsonb_set(b,'{results,0,timeMs}','12346'));RAISE EXCEPTION 'Receipt accepted changed payload';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'RECEIPT_PAYLOAD_MISMATCH' THEN RAISE; END IF; END;

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
 INSERT INTO athlete_source_configs(athlete_id,source_id,external_id,active,display_name,source_url) VALUES(j.athlete_id,j.source_id,'700099',true,'SYNTHETIC','https://www.swimsystem.app');
 BEGIN
  PERFORM persist_official_meet_batch(j.id,j.lease_token,b);RAISE EXCEPTION 'Ambiguous active source identity accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'SOURCE_IDENTITY_NOT_VERIFIED' THEN RAISE; END IF; END;
 DELETE FROM athlete_source_configs WHERE external_id='700099';
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
 INSERT INTO import_v2_jobs(request_id,athlete_id,source_id,worker_version,job_type,cursor) VALUES(request,'00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001','official-v3','current_meet','{"scope":"targeted_meet","external_meet_id":"aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa","official_url":"https://www.swimsystem.app/meets/sw/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa"}');
 SELECT * INTO j FROM claim_official_import_jobs(1);
 answer=persist_official_meet_batch(j.id,j.lease_token,current_setting('test.synthetic_batch')::jsonb);
 IF (answer->>'duplicated')::integer<>1 THEN RAISE EXCEPTION 'Actual service role cannot persist'; END IF;
END $$;
ROLLBACK;
SELECT 'isolated transaction assertions passed; not live persistence' AS outcome;

CREATE TABLE isolated_test_payload AS SELECT pg_temp.batch() AS payload;

BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub='00000000-0000-4000-8000-000000000031';
DO $$
DECLARE response jsonb;
BEGIN
 response=request_official_meet_import('00000000-0000-4000-8000-000000000011','https://www.swimsystem.app/meets/sw/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa');
 IF response->>'request_id' IS NULL OR response->>'job_id' IS NULL THEN RAISE EXCEPTION 'Request lacks auditable IDs'; END IF;
 BEGIN
  PERFORM request_official_meet_import('00000000-0000-4000-8000-000000000012','https://www.swimsystem.app/meets/sw/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa');
  RAISE EXCEPTION 'Other account enqueued';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'ATHLETE_ACCESS_DENIED' THEN RAISE; END IF; END;
 BEGIN
  PERFORM request_official_meet_import('00000000-0000-4000-8000-000000000011','https://unauthorized.example/results');
  RAISE EXCEPTION 'Unapproved source enqueued';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'INVALID_OFFICIAL_MEET_URL' THEN RAISE; END IF; END;
END $$;
ROLLBACK;
DO $$
DECLARE j import_v2_jobs;request uuid;
BEGIN
 j=pg_temp.new_job();request=j.request_id;
 UPDATE import_v2_jobs SET status='blocked',failure_code='authentication_required',last_error='Source requires authorized access' WHERE id=j.id;
 IF (SELECT derived_status FROM v_refresh_request_status WHERE request_id=request)<>'failed'
  OR (SELECT sample_error FROM v_refresh_request_status WHERE request_id=request) IS NULL THEN RAISE EXCEPTION 'Blocked job reported successful'; END IF;
END $$;

DO $$
DECLARE j import_v2_jobs;answer jsonb;
BEGIN
 UPDATE import_v2_jobs SET status='cancelled' WHERE status='running';
 j=pg_temp.new_job();UPDATE refresh_requests SET job_count=1 WHERE id=j.request_id;
 answer=finish_official_import_failure(j.id,j.lease_token,'authentication_required','Official source HTTP 401',true);
 IF answer->>'status'<>'blocked' OR (SELECT terminal_status FROM refresh_requests WHERE id=j.request_id)<>'failed' OR (SELECT last_error FROM import_v2_jobs WHERE id=j.id)<>'Official source HTTP 401' THEN RAISE EXCEPTION '401 hidden or retried'; END IF;
 j=pg_temp.new_job();answer=finish_official_import_failure(j.id,j.lease_token,'document_missing','Official PDF HTTP 404',true);
 IF answer->>'status'<>'pending' OR (answer->>'retryAfterSeconds')::integer<>60 THEN RAISE EXCEPTION '404 did not back off'; END IF;
 UPDATE import_v2_jobs SET attempts=4,next_run_at=now() WHERE id=j.id;
 SELECT * INTO j FROM claim_official_import_jobs(1);
 answer=finish_official_import_failure(j.id,j.lease_token,'timeout','timeout retained',true);
 IF answer->>'status'<>'failed' OR (SELECT attempts FROM import_v2_jobs WHERE id=j.id)<>5 THEN RAISE EXCEPTION 'Retries exceeded limit'; END IF;
 IF has_function_privilege('authenticated','finish_official_import_failure(uuid,uuid,text,text,boolean)','EXECUTE') THEN RAISE EXCEPTION 'Browser can finalize worker'; END IF;
END $$;

DO $$
DECLARE answer jsonb;subscription uuid;usr uuid:='00000000-0000-4000-8000-000000000031';
BEGIN
 PERFORM set_config('request.jwt.claim.sub',usr::text,true);
 PERFORM request_official_meet_import('00000000-0000-4000-8000-000000000011','https://www.swimsystem.app/meets/sw/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa');
 SELECT id INTO subscription FROM official_meet_subscriptions WHERE athlete_id='00000000-0000-4000-8000-000000000011';
 UPDATE official_meet_subscriptions SET next_scan_at=now() WHERE id=subscription;
 answer=enqueue_official_subscribed_meets();
 IF (answer->>'deferred')::integer<>1 OR (answer->>'enqueued')::integer<>0 THEN RAISE EXCEPTION 'Monitor duplicated active import'; END IF;
 UPDATE import_v2_jobs SET status='cancelled' WHERE athlete_id='00000000-0000-4000-8000-000000000011' AND status IN ('pending','running');
 UPDATE official_meet_subscriptions SET next_scan_at=now() WHERE id=subscription;
 answer=enqueue_official_subscribed_meets();
 IF (answer->>'enqueued')::integer<>1 THEN RAISE EXCEPTION 'Monitor does not queue without user click'; END IF;
 UPDATE account_members SET status='removed' WHERE user_id=usr;
 UPDATE official_meet_subscriptions SET next_scan_at=now() WHERE id=subscription;
 answer=enqueue_official_subscribed_meets();
 IF (answer->>'revoked')::integer<>1 OR (SELECT active FROM official_meet_subscriptions WHERE id=subscription) THEN RAISE EXCEPTION 'Monitor ignored revoked authorization'; END IF;
 UPDATE account_members SET status='active' WHERE user_id=usr;
 UPDATE import_v2_jobs SET status='cancelled' WHERE status IN ('pending','running');
 IF has_function_privilege('authenticated','enqueue_official_subscribed_meets(integer)','EXECUTE') THEN RAISE EXCEPTION 'Browser can run global monitor'; END IF;
END $$;

-- SYNTHETIC Vault/network contracts. The mocked net.http_post never makes HTTP.
CREATE SCHEMA vault;CREATE SCHEMA net;
CREATE TABLE vault.decrypted_secrets(name text,decrypted_secret text);
CREATE TABLE isolated_http_requests(id bigint GENERATED ALWAYS AS IDENTITY,url text,body jsonb,headers jsonb,timeout_milliseconds integer);
CREATE FUNCTION net.http_post(url text,body jsonb,headers jsonb,timeout_milliseconds integer) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE request bigint;
BEGIN
 IF current_database()<>'viniswim_isolated_test' THEN RAISE EXCEPTION 'Synthetic network must never run in production'; END IF;
 INSERT INTO isolated_http_requests(url,body,headers,timeout_milliseconds) VALUES(url,body,headers,timeout_milliseconds) RETURNING id INTO request;RETURN request;
END $$;
\ir ../../proposals/official-scheduler-auth.sql
DO $$
DECLARE answer jsonb;
BEGIN
 BEGIN
  PERFORM dispatch_official_import_worker();RAISE EXCEPTION 'Unconfigured worker dispatched';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'OFFICIAL_WORKER_TOKEN_NOT_CONFIGURED' THEN RAISE; END IF; END;
 INSERT INTO vault.decrypted_secrets VALUES('viniswim_official_import_worker_token',repeat('a',64));
 answer=dispatch_official_import_worker();
 IF answer->>'outcome'<>'http_request_queued' OR answer::text LIKE '%Bearer%' OR NOT EXISTS(SELECT 1 FROM isolated_http_requests WHERE headers->>'Authorization'='Bearer '||repeat('a',64)) THEN RAISE EXCEPTION 'Scheduler auth missing or secret leaked into outcome'; END IF;
 IF has_function_privilege('authenticated','read_official_worker_token()','EXECUTE') OR has_function_privilege('anon','dispatch_official_import_worker()','EXECUTE') THEN RAISE EXCEPTION 'Browser can read worker secret or dispatch'; END IF;
END $$;

DO $$
DECLARE before_count integer;
BEGIN
 UPDATE official_meet_subscriptions SET active=true WHERE athlete_id='00000000-0000-4000-8000-000000000011';
 before_count=(SELECT count(*) FROM results);
 BEGIN
  INSERT INTO results(athlete_id,event_id,result_date,course,time_ms,status,origin,source_id,is_official)
  VALUES('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000041','2026-10-10','LCM',99999,'valid','official','00000000-0000-4000-8000-000000000001',true);
  RAISE EXCEPTION 'Legacy official writer repopulated enrolled athlete';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'LEGACY_OFFICIAL_WRITER_FENCED' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM results)<>before_count THEN RAISE EXCEPTION 'Legacy fence is not atomic'; END IF;
 BEGIN
  DELETE FROM results WHERE athlete_id='00000000-0000-4000-8000-000000000011';RAISE EXCEPTION 'Enrolled official result deleted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'OFFICIAL_RESULT_DELETE_REQUIRES_CONTROLLED_AUDIT' THEN RAISE; END IF; END;
 -- Direct cleanup/restore is deliberately not granted through this guard.
END $$;
