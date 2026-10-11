-- Candidate NOT APPLIED. Store the generated 32-byte random token in Supabase
-- Vault at activation; no token literal belongs in this migration or repository.
BEGIN;
CREATE OR REPLACE FUNCTION public.read_official_worker_token()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE token text;count_tokens integer;
BEGIN
 SELECT count(*),min(decrypted_secret) INTO count_tokens,token FROM vault.decrypted_secrets WHERE name='viniswim_official_import_worker_token';
 IF count_tokens<>1 OR token IS NULL OR token !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'OFFICIAL_WORKER_TOKEN_NOT_CONFIGURED'; END IF;
 RETURN token;
END $$;
REVOKE ALL ON FUNCTION public.read_official_worker_token() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_official_worker_token() TO service_role;

CREATE OR REPLACE FUNCTION public.dispatch_official_import_worker()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE token text;monitor_outcome jsonb;http_request bigint;
BEGIN
 token=public.read_official_worker_token();
 monitor_outcome=public.enqueue_official_subscribed_meets(16);
 SELECT net.http_post(
  url:='https://cdtvhagbgiwnjkgninqn.supabase.co/functions/v1/official-import-runner',
  body:='{}'::jsonb,
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token),
  timeout_milliseconds:=120000
 ) INTO http_request;
 IF http_request IS NULL THEN RAISE EXCEPTION 'OFFICIAL_WORKER_DISPATCH_FAILED'; END IF;
 -- HTTP request queued is not evidence of worker completion or imported data.
 RETURN jsonb_build_object('outcome','http_request_queued','httpRequestId',http_request,'monitor',monitor_outcome);
END $$;
REVOKE ALL ON FUNCTION public.dispatch_official_import_worker() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_official_import_worker() TO service_role;
COMMIT;
