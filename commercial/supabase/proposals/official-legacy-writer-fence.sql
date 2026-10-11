-- Candidate NOT APPLIED. Scope is athletes with an authorized active official
-- subscription; unrelated tenants are untouched. Legacy writers lack the current
-- job/lease context and cannot repopulate official results for enrolled athletes.
BEGIN;
CREATE OR REPLACE FUNCTION public.guard_enrolled_official_result_write()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE athlete uuid;job uuid;token uuid;
BEGIN
 athlete=CASE WHEN TG_OP='DELETE' THEN OLD.athlete_id ELSE NEW.athlete_id END;
 IF TG_OP='UPDATE' THEN
  IF OLD.athlete_id IS DISTINCT FROM NEW.athlete_id AND (OLD.is_official OR OLD.origin='official')
   AND EXISTS(SELECT 1 FROM public.official_meet_subscriptions WHERE athlete_id IN (OLD.athlete_id,NEW.athlete_id) AND active) THEN RAISE EXCEPTION 'OFFICIAL_RESULT_REASSIGNMENT_FORBIDDEN'; END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.official_meet_subscriptions WHERE athlete_id=athlete AND active) THEN RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END; END IF;
 IF TG_OP='DELETE' THEN
  IF OLD.is_official OR OLD.origin='official' THEN RAISE EXCEPTION 'OFFICIAL_RESULT_DELETE_REQUIRES_CONTROLLED_AUDIT'; END IF;
  RETURN OLD;
 END IF;
 IF NOT NEW.is_official AND NEW.origin<>'official' THEN
  IF TG_OP='UPDATE' AND (OLD.is_official OR OLD.origin='official') THEN RAISE EXCEPTION 'OFFICIAL_RESULT_DOWNGRADE_FORBIDDEN'; END IF;
  RETURN NEW;
 END IF;
 job=nullif(current_setting('viniswim.official_job_id',true),'')::uuid;
 token=nullif(current_setting('viniswim.official_lease_token',true),'')::uuid;
 IF job IS NULL OR token IS NULL OR NEW.official_identity_key IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.import_v2_jobs j JOIN public.refresh_requests r ON r.id=j.request_id
  WHERE j.id=job AND j.lease_token=token AND j.worker_version='official-v3' AND j.status='running'
   AND j.lease_expires_at>now() AND j.athlete_id=NEW.athlete_id AND j.source_id=NEW.source_id
   AND r.cancel_requested_at IS NULL AND r.terminal_status IS NULL
 ) THEN RAISE EXCEPTION 'LEGACY_OFFICIAL_WRITER_FENCED'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_enrolled_official_result_write() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER official_enrolled_result_guard BEFORE INSERT OR UPDATE OR DELETE ON public.results
 FOR EACH ROW EXECUTE FUNCTION public.guard_enrolled_official_result_write();
-- Attested entries are never a legacy projection. Protection does not depend
-- on subscription.active; deactivation cannot reopen the official write path.
CREATE OR REPLACE FUNCTION public.guard_attested_entry_write()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE job uuid;token uuid;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'OFFICIAL_ENTRY_DELETE_REQUIRES_CONTROLLED_AUDIT'; END IF;
 IF TG_OP='UPDATE' THEN
  IF ROW(OLD.athlete_id,OLD.source_id,OLD.meet_id,OLD.event_id,OLD.external_id,OLD.official_event_number,OLD.official_round,OLD.official_sex,OLD.official_event_date,OLD.official_course)
   IS DISTINCT FROM ROW(NEW.athlete_id,NEW.source_id,NEW.meet_id,NEW.event_id,NEW.external_id,NEW.official_event_number,NEW.official_round,NEW.official_sex,NEW.official_event_date,NEW.official_course)
   THEN RAISE EXCEPTION 'OFFICIAL_ENTRY_REASSIGNMENT_FORBIDDEN'; END IF;
 END IF;
 job=nullif(current_setting('viniswim.official_job_id',true),'')::uuid;
 token=nullif(current_setting('viniswim.official_lease_token',true),'')::uuid;
 IF job IS NULL OR token IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.import_v2_jobs j JOIN public.refresh_requests r ON r.id=j.request_id
  WHERE j.id=job AND j.lease_token=token AND j.worker_version='official-v3' AND j.status='running'
   AND j.lease_expires_at>now() AND j.athlete_id=NEW.athlete_id AND j.source_id=NEW.source_id
   AND r.cancel_requested_at IS NULL AND r.terminal_status IS NULL
 ) THEN RAISE EXCEPTION 'LEGACY_OFFICIAL_WRITER_FENCED'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_attested_entry_write() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER official_attested_entry_guard BEFORE INSERT OR UPDATE OR DELETE ON public.official_meet_entries
 FOR EACH ROW EXECUTE FUNCTION public.guard_attested_entry_write();
COMMIT;
