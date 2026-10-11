CREATE TABLE app.legacy_cleanup_holds (
 athlete_id uuid PRIMARY KEY REFERENCES public.athletes(id) ON DELETE RESTRICT,
 held_at timestamptz NOT NULL DEFAULT now(),
 reason text NOT NULL CHECK (reason <> '')
);
ALTER TABLE app.legacy_cleanup_holds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app.legacy_cleanup_holds FROM PUBLIC, anon, authenticated, service_role;
CREATE FUNCTION app.guard_legacy_cleanup_hold() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $fn$
BEGIN
 IF EXISTS (SELECT 1 FROM app.legacy_cleanup_holds h WHERE h.athlete_id = NEW.athlete_id)
 THEN
  IF TG_TABLE_NAME IN ('results','meet_entries') OR NEW.status::text IN ('pending','running') THEN
   RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='LEGACY_IMPORT_PAUSED_AFTER_AUTHORIZED_CLEANUP';
  END IF;
 END IF;
 RETURN NEW;
END
$fn$;
REVOKE ALL ON FUNCTION app.guard_legacy_cleanup_hold() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER results_cleanup_hold BEFORE INSERT OR UPDATE ON public.results FOR EACH ROW EXECUTE FUNCTION app.guard_legacy_cleanup_hold();
CREATE TRIGGER entries_cleanup_hold BEFORE INSERT OR UPDATE ON public.meet_entries FOR EACH ROW EXECUTE FUNCTION app.guard_legacy_cleanup_hold();
CREATE TRIGGER monitor_jobs_cleanup_hold BEFORE INSERT OR UPDATE ON public.monitor_jobs FOR EACH ROW EXECUTE FUNCTION app.guard_legacy_cleanup_hold();
CREATE TRIGGER import_v2_jobs_cleanup_hold BEFORE INSERT OR UPDATE ON public.import_v2_jobs FOR EACH ROW EXECUTE FUNCTION app.guard_legacy_cleanup_hold();
CREATE TRIGGER historical_jobs_cleanup_hold BEFORE INSERT OR UPDATE ON public.historical_archive_jobs FOR EACH ROW EXECUTE FUNCTION app.guard_legacy_cleanup_hold();