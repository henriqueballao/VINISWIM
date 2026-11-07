-- Candidate only: NOT APPLIED to production. Promote via Supabase CLI after
-- coordinated worker/frontend cutover and full-schema integration tests.
BEGIN;
ALTER TABLE public.import_v2_jobs DROP CONSTRAINT import_v2_jobs_status_check;
ALTER TABLE public.import_v2_jobs ADD CONSTRAINT import_v2_jobs_status_check
 CHECK (status IN ('pending','running','completed','failed','cancelled','blocked'));

-- Preserve the legacy TABLE and its full three-column conflict target. An
-- unchanged legacy upsert cannot infer a partial index. Attested races use a
-- separate entity; no backfill, rename or deletion of legacy sporting data.
CREATE TABLE public.official_meet_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 meet_id uuid NOT NULL REFERENCES public.meets(id),
 athlete_id uuid NOT NULL REFERENCES public.athletes(id),
 event_id uuid NOT NULL REFERENCES public.events(id),
 source_id uuid NOT NULL REFERENCES public.sources(id),
 external_id text NOT NULL CHECK(external_id ~ '^[a-f0-9]{64}$'),
 seed_time_ms integer CHECK(seed_time_ms IS NULL OR seed_time_ms>0),
 heat integer NOT NULL CHECK(heat>0),lane integer NOT NULL CHECK(lane BETWEEN 0 AND 9),
 scheduled_at timestamptz NOT NULL,
 entry_status text NOT NULL DEFAULT 'seeded' CHECK(entry_status='seeded'),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 official_event_number text NOT NULL CHECK(official_event_number ~ '^[0-9]+$'),
 official_round text NOT NULL CHECK(length(trim(official_round))>0),
 official_sex text NOT NULL CHECK(official_sex IN ('masculino','feminino')),
 official_event_date date NOT NULL,official_course public.swim_course NOT NULL,
 UNIQUE(source_id,external_id)
);
CREATE UNIQUE INDEX official_meet_entries_identity_uidx ON public.official_meet_entries
 (meet_id,athlete_id,event_id,official_event_number,official_round,official_sex,official_event_date,official_course)
 ;
CREATE INDEX official_meet_entries_athlete_idx ON public.official_meet_entries(athlete_id);
ALTER TABLE public.official_meet_entries ENABLE ROW LEVEL SECURITY;

-- These fields are only for the new attested transaction path. Legacy
-- fingerprints and rows stay intact until reconciliation/cutover is verified.
ALTER TABLE public.results ADD COLUMN official_identity_key text,
 ADD COLUMN official_event_number text,
 ADD COLUMN official_round text,
 ADD COLUMN official_sex text,
 ADD CONSTRAINT results_attested_identity_official_only CHECK (official_identity_key IS NULL OR (origin='official' AND is_official=true AND source_id IS NOT NULL AND official_identity_key ~ '^[a-f0-9]{64}$' AND official_event_number IS NOT NULL AND official_event_number ~ '^[0-9]+$' AND official_round IS NOT NULL AND length(trim(official_round))>0 AND official_sex IS NOT NULL AND official_sex IN ('masculino','feminino')));
CREATE UNIQUE INDEX results_official_identity_uidx ON public.results(official_identity_key)
 WHERE official_identity_key IS NOT NULL;
COMMIT;
