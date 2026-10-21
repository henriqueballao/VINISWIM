CREATE OR REPLACE FUNCTION app.guard_legacy_cleanup_hold() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
BEGIN
 IF EXISTS (SELECT 1 FROM app.legacy_cleanup_holds h WHERE h.athlete_id=NEW.athlete_id) THEN
  IF TG_TABLE_NAME IN ('results','meet_entries') THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='LEGACY_IMPORT_PAUSED_AFTER_AUTHORIZED_CLEANUP';
  END IF;
  IF (to_jsonb(NEW)->>'status') IN ('pending','running') THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='LEGACY_IMPORT_PAUSED_AFTER_AUTHORIZED_CLEANUP';
  END IF;
 END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION app.guard_legacy_cleanup_hold() FROM PUBLIC,anon,authenticated,service_role;