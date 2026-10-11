\set ON_ERROR_STOP on
DO $$ BEGIN IF current_database()<>'viniswim_isolated_test' THEN RAISE EXCEPTION 'Audit fixture must never run in production'; END IF; END $$;
-- Synthetic fixture applies the candidate index migration to an isolated DB.
-- No credentials or connection to the VINISWIM Supabase project.
\ir ../../../../commercial/supabase/tests/isolated/event-contract.sql
BEGIN;
-- Same conflict target used by published import-v2-runner current-meet upsert.
-- Compatibility must hold for other tenants while legacy consumers are active.
INSERT INTO public.meet_entries(meet_id,athlete_id,event_id,seed_time_ms,heat,lane)
VALUES('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000103',20000,1,1)
ON CONFLICT(meet_id,athlete_id,event_id) DO UPDATE SET seed_time_ms=excluded.seed_time_ms;
ROLLBACK;
