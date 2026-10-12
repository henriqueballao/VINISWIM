-- Maintenance hardening. Safe before candidate schema installation: the default
-- mode blocks official/legacy writes for ALL athletes, including new profiles.
-- Switching to official_only requires complete coordinated schema/worker/UI.
BEGIN;
CREATE SCHEMA IF NOT EXISTS app;
CREATE TABLE app.official_pipeline_mode (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 mode text NOT NULL DEFAULT 'maintenance' CHECK(mode IN('maintenance','official_only')),
 changed_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO app.official_pipeline_mode(singleton) VALUES(true);
ALTER TABLE app.official_pipeline_mode ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app.official_pipeline_mode FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION app.guard_global_official_pipeline() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE phase text;job uuid;token uuid;context jsonb;
BEGIN
 SELECT mode INTO phase FROM app.official_pipeline_mode WHERE singleton;
 IF TG_TABLE_NAME='results' THEN
  IF NEW.origin::text='manual' AND NOT NEW.is_official THEN
   IF TG_OP='INSERT' THEN RETURN NEW; END IF;
   IF OLD.origin::text='manual' AND NOT OLD.is_official THEN RETURN NEW; END IF;
  END IF;
 ELSE
  IF (to_jsonb(NEW)->>'status') NOT IN('pending','running') AND TG_TABLE_NAME<>'meet_entries' THEN RETURN NEW; END IF;
 END IF;
 IF phase IS DISTINCT FROM 'official_only' THEN RAISE EXCEPTION 'OFFICIAL_IMPORT_MAINTENANCE'; END IF;
 IF TG_TABLE_NAME='import_v2_jobs' AND to_jsonb(NEW)->>'worker_version'='official-v3' THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME<>'results' THEN RAISE EXCEPTION 'LEGACY_IMPORT_WRITER_RETIRED'; END IF;
 job=nullif(current_setting('viniswim.official_job_id',true),'')::uuid;
 token=nullif(current_setting('viniswim.official_lease_token',true),'')::uuid;
 IF job IS NULL OR token IS NULL OR to_jsonb(NEW)->>'official_identity_key' IS NULL THEN RAISE EXCEPTION 'LEGACY_IMPORT_WRITER_RETIRED'; END IF;
 context=public.load_official_import_context(job,token);
 IF context->>'scope'='meet_catalog' OR context->'athlete'->>'id' IS DISTINCT FROM NEW.athlete_id::text
 OR NOT EXISTS(SELECT 1 FROM public.import_v2_jobs j WHERE j.id=job AND j.source_id=NEW.source_id)
 THEN RAISE EXCEPTION 'LEGACY_IMPORT_WRITER_RETIRED'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app.guard_global_official_pipeline() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER global_results_pipeline_guard BEFORE INSERT OR UPDATE ON public.results FOR EACH ROW EXECUTE FUNCTION app.guard_global_official_pipeline();
CREATE TRIGGER global_entries_pipeline_guard BEFORE INSERT OR UPDATE ON public.meet_entries FOR EACH ROW EXECUTE FUNCTION app.guard_global_official_pipeline();
CREATE TRIGGER global_v2_pipeline_guard BEFORE INSERT OR UPDATE ON public.import_v2_jobs FOR EACH ROW EXECUTE FUNCTION app.guard_global_official_pipeline();
CREATE TRIGGER global_monitor_pipeline_guard BEFORE INSERT OR UPDATE ON public.monitor_jobs FOR EACH ROW EXECUTE FUNCTION app.guard_global_official_pipeline();
CREATE TRIGGER global_historical_pipeline_guard BEFORE INSERT OR UPDATE ON public.historical_archive_jobs FOR EACH ROW EXECUTE FUNCTION app.guard_global_official_pipeline();
COMMIT;
