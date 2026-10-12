DO $$ BEGIN IF current_database()<>'viniswim_isolated_test' THEN RAISE EXCEPTION 'Synthetic fixture must never run on production'; END IF; END $$;
-- SYNTHETIC isolated test only. Relevant audited column types; no production data.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE TABLE refresh_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),cancel_requested_at timestamptz,terminal_status text);
CREATE TABLE import_v2_jobs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_id uuid REFERENCES refresh_requests(id),
 status text NOT NULL DEFAULT 'pending',attempts integer NOT NULL DEFAULT 0,priority integer NOT NULL DEFAULT 10,
 locked_at timestamptz,last_run_at timestamptz,next_run_at timestamptz DEFAULT now(),failure_code text,last_error text,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
\ir ../../proposals/official-worker-leases.sql
GRANT SELECT,UPDATE ON import_v2_jobs,refresh_requests TO service_role;
DO $$
DECLARE request uuid:=gen_random_uuid(); job uuid:=gen_random_uuid(); legacy uuid:=gen_random_uuid(); token uuid; n integer;
BEGIN
 INSERT INTO refresh_requests(id) VALUES(request);
 INSERT INTO import_v2_jobs(id,request_id,worker_version) VALUES(job,request,'official-v3'),(legacy,request,'legacy-v2');
 PERFORM * FROM claim_import_v2_jobs(1);
 IF (SELECT status FROM import_v2_jobs WHERE id=job)<>'pending' THEN RAISE EXCEPTION 'Legacy worker stole official job'; END IF;
 SELECT count(*) INTO n FROM claim_official_import_jobs(1); IF n<>1 THEN RAISE EXCEPTION 'Official job not claimed'; END IF;
 SELECT lease_token INTO token FROM import_v2_jobs WHERE id=job;
 IF token IS NULL THEN RAISE EXCEPTION 'Claim lacks lease token'; END IF;
 SELECT count(*) INTO n FROM claim_official_import_jobs(1); IF n<>0 THEN RAISE EXCEPTION 'Concurrent duplicate claim'; END IF;
 UPDATE import_v2_jobs SET lease_expires_at=now()-interval '1 minute',last_error='Original timeout' WHERE id=job;
 PERFORM * FROM claim_official_import_jobs(1);
 IF (SELECT lease_token FROM import_v2_jobs WHERE id=job)=token THEN RAISE EXCEPTION 'Stale worker was not fenced'; END IF;
 IF (SELECT last_error FROM import_v2_jobs WHERE id=job) NOT LIKE 'Original timeout%' THEN RAISE EXCEPTION 'Recovery erased diagnosis'; END IF;
 UPDATE import_v2_jobs SET lease_expires_at=now()-interval '1 minute',attempts=5 WHERE id=job;
 PERFORM * FROM claim_official_import_jobs(1);
 IF (SELECT status FROM import_v2_jobs WHERE id=job)<>'failed' THEN RAISE EXCEPTION 'Retry exhaustion ignored'; END IF;
 UPDATE import_v2_jobs SET status='running',attempts=2,lease_expires_at=now()-interval '1 minute' WHERE id=job;
 UPDATE refresh_requests SET cancel_requested_at=now() WHERE id=request;
 PERFORM * FROM claim_official_import_jobs(1);
 IF (SELECT status FROM import_v2_jobs WHERE id=job)<>'cancelled' THEN RAISE EXCEPTION 'Cancelled request resurrected'; END IF;
 IF has_function_privilege('authenticated','claim_official_import_jobs(integer)','EXECUTE') OR has_function_privilege('anon','claim_official_import_jobs(integer)','EXECUTE') THEN RAISE EXCEPTION 'Browser can claim global jobs'; END IF;
END $$;
SELECT 'isolated lease assertions passed' AS outcome;
