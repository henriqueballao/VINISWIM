-- Candidate only: NOT APPLIED to production. Promote via Supabase CLI after
-- coordinated worker/frontend cutover and full-schema integration tests.
BEGIN;
ALTER TABLE public.meet_entries DROP CONSTRAINT meet_entries_lane_check;
ALTER TABLE public.meet_entries ADD CONSTRAINT meet_entries_lane_check CHECK (lane IS NULL OR lane >= 0);
ALTER TABLE public.import_v2_jobs DROP CONSTRAINT import_v2_jobs_status_check;
ALTER TABLE public.import_v2_jobs ADD CONSTRAINT import_v2_jobs_status_check
 CHECK (status IN ('pending','running','completed','failed','cancelled','blocked'));

-- No inference/backfill of official event identifiers for legacy rows.
ALTER TABLE public.meet_entries
 ADD COLUMN official_event_number text,
 ADD COLUMN official_round text,
 ADD COLUMN official_sex text,
 ADD COLUMN official_event_date date,
 ADD COLUMN official_course public.swim_course,
 ADD CONSTRAINT meet_entries_official_event_complete CHECK (
  (official_event_number IS NULL AND official_round IS NULL AND official_sex IS NULL AND official_event_date IS NULL AND official_course IS NULL)
  OR (official_event_number IS NOT NULL AND official_event_number ~ '^[0-9]+$'
      AND official_round IS NOT NULL AND length(trim(official_round))>0
      AND official_sex IS NOT NULL AND official_sex IN ('masculino','feminino')
      AND official_event_date IS NOT NULL AND official_course IS NOT NULL)
 );
DROP INDEX public.meet_entries_natural_uidx;
CREATE UNIQUE INDEX meet_entries_natural_uidx ON public.meet_entries(meet_id,athlete_id,event_id)
 WHERE official_event_number IS NULL;
CREATE UNIQUE INDEX meet_entries_official_identity_uidx ON public.meet_entries
 (meet_id,athlete_id,event_id,official_event_number,official_round,official_sex,official_event_date,official_course)
 WHERE official_event_number IS NOT NULL;

-- These fields are only for the new attested transaction path. Legacy
-- fingerprints and rows stay intact until reconciliation/cutover is verified.
ALTER TABLE public.results ADD COLUMN official_identity_key text,
 ADD CONSTRAINT results_attested_identity_official_only CHECK (official_identity_key IS NULL OR (origin='official' AND is_official=true AND source_id IS NOT NULL AND official_identity_key ~ '^[a-f0-9]{64}$'));
CREATE UNIQUE INDEX results_official_identity_uidx ON public.results(official_identity_key)
 WHERE official_identity_key IS NOT NULL;
COMMIT;
