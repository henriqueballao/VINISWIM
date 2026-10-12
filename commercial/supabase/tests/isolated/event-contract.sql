DO $$ BEGIN IF current_database()<>'viniswim_isolated_test' THEN RAISE EXCEPTION 'Synthetic fixture must never run on production'; END IF; END $$;
-- SYNTHETIC isolated PostgreSQL contract fixture, never run on production.
-- Mirrors the audited relevant constraints; not a full Supabase schema dump.
CREATE TYPE public.swim_course AS ENUM ('SCM','LCM');
CREATE TABLE public.meets(id uuid PRIMARY KEY);
CREATE TABLE public.athletes(id uuid PRIMARY KEY,account_id uuid NOT NULL);
CREATE TABLE public.events(id uuid PRIMARY KEY);
CREATE TABLE public.sources(id uuid PRIMARY KEY);
CREATE TABLE public.meet_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),meet_id uuid NOT NULL,
 athlete_id uuid NOT NULL,event_id uuid NOT NULL,
 lane integer,heat integer,seed_time_ms integer,
 CONSTRAINT meet_entries_lane_check CHECK (lane IS NULL OR lane>0),
 CHECK (heat IS NULL OR heat>0),CHECK (seed_time_ms IS NULL OR seed_time_ms>0)
);
CREATE UNIQUE INDEX meet_entries_natural_uidx ON public.meet_entries(meet_id,athlete_id,event_id);
SELECT set_config('test.legacy_entry_index',pg_get_indexdef('public.meet_entries_natural_uidx'::regclass),false);
SELECT set_config('test.legacy_entry_constraints',(SELECT jsonb_agg(pg_get_constraintdef(oid) ORDER BY conname)::text FROM pg_constraint WHERE conrelid='public.meet_entries'::regclass),false);
CREATE TABLE public.import_v2_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),status text NOT NULL,
 CONSTRAINT import_v2_jobs_status_check CHECK(status IN ('pending','running','completed','failed','cancelled'))
);
CREATE TABLE public.results (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),time_ms integer CHECK(time_ms IS NULL OR time_ms>0),origin text NOT NULL DEFAULT 'manual',is_official boolean NOT NULL DEFAULT false,source_id uuid);
DO $$ BEGIN
 BEGIN
  INSERT INTO public.meet_entries(meet_id,athlete_id,event_id,lane) VALUES(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),0);
  RAISE EXCEPTION 'Original lane-zero failure was not reproduced';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  INSERT INTO public.import_v2_jobs(status) VALUES('blocked');
  RAISE EXCEPTION 'Original blocked-status failure was not reproduced';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
\ir ../../proposals/official-event-integrity.sql
DO $$
DECLARE meet uuid:=gen_random_uuid(); athlete uuid:=gen_random_uuid(); other uuid:=gen_random_uuid();event uuid:=gen_random_uuid();source uuid:=gen_random_uuid();
BEGIN
 INSERT INTO meets VALUES(meet);INSERT INTO events VALUES(event);INSERT INTO sources VALUES(source);
 INSERT INTO athletes VALUES(athlete,gen_random_uuid()),(other,gen_random_uuid());
 IF pg_get_indexdef('public.meet_entries_natural_uidx'::regclass)<>current_setting('test.legacy_entry_index') THEN RAISE EXCEPTION 'Legacy conflict index changed'; END IF;
 IF (SELECT jsonb_agg(pg_get_constraintdef(oid) ORDER BY conname)::text FROM pg_constraint WHERE conrelid='public.meet_entries'::regclass)<>current_setting('test.legacy_entry_constraints') THEN RAISE EXCEPTION 'Legacy constraints changed'; END IF;
 INSERT INTO public.official_meet_entries(meet_id,athlete_id,event_id,source_id,external_id,seed_time_ms,heat,lane,scheduled_at,official_event_number,official_round,official_sex,official_event_date,official_course)
 VALUES(meet,athlete,event,source,repeat('a',64),20000,1,0,'2026-10-10T19:59Z','16','Final Direta','masculino','2026-10-10','LCM'),
       (meet,athlete,event,source,repeat('b',64),20000,1,1,'2026-10-10T20:59Z','20','Final Direta','masculino','2026-10-10','LCM'),
       (meet,athlete,event,source,repeat('c',64),20000,1,1,'2026-10-10T21:59Z','16','Semifinal','masculino','2026-10-10','LCM');
 IF (SELECT count(*) FROM official_meet_entries)<>3 THEN RAISE EXCEPTION 'Separate official races lost'; END IF;
 BEGIN
  INSERT INTO public.official_meet_entries(meet_id,athlete_id,event_id,source_id,external_id,heat,lane,scheduled_at,official_event_number,official_round,official_sex,official_event_date,official_course)
  VALUES(meet,athlete,event,source,repeat('d',64),1,2,'2026-10-10T19:59Z','16','Final Direta','masculino','2026-10-10','LCM');
  RAISE EXCEPTION 'Duplicate official identity accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 -- The same registration may have profiles in separate accounts/athlete IDs.
 INSERT INTO public.official_meet_entries(meet_id,athlete_id,event_id,source_id,external_id,heat,lane,scheduled_at,official_event_number,official_round,official_sex,official_event_date,official_course)
 VALUES(meet,other,event,source,repeat('e',64),1,0,'2026-10-10T19:59Z','16','Final Direta','masculino','2026-10-10','LCM');
 BEGIN
  INSERT INTO public.official_meet_entries(meet_id,athlete_id,event_id,official_event_number) VALUES(meet,athlete,event,'17');
  RAISE EXCEPTION 'Partial official event identity accepted';
 EXCEPTION WHEN not_null_violation THEN NULL; END;
 -- Exact unchanged legacy conflict target, writes for two distinct accounts.
 INSERT INTO meet_entries(meet_id,athlete_id,event_id,lane,heat,seed_time_ms) VALUES(meet,athlete,event,1,1,30000),(meet,other,event,2,1,40000)
 ON CONFLICT(meet_id,athlete_id,event_id) DO UPDATE SET seed_time_ms=excluded.seed_time_ms;
 INSERT INTO meet_entries(meet_id,athlete_id,event_id,lane,heat,seed_time_ms) VALUES(meet,athlete,event,1,1,31000),(meet,other,event,2,1,41000)
 ON CONFLICT(meet_id,athlete_id,event_id) DO UPDATE SET seed_time_ms=excluded.seed_time_ms;
 IF (SELECT count(*) FROM meet_entries)<>2 OR (SELECT seed_time_ms FROM meet_entries WHERE athlete_id=athlete)<>31000 OR (SELECT seed_time_ms FROM meet_entries WHERE athlete_id=other)<>41000 THEN RAISE EXCEPTION 'Legacy multi-account upsert is not compatible/idempotent'; END IF;
 IF (SELECT count(*) FROM official_meet_entries)<>4 OR EXISTS(SELECT 1 FROM official_meet_entries WHERE seed_time_ms IS NOT NULL AND seed_time_ms<>20000) THEN RAISE EXCEPTION 'Legacy write modified attested race'; END IF;
 INSERT INTO public.import_v2_jobs(status) VALUES('blocked');
 BEGIN
  INSERT INTO public.import_v2_jobs(status) VALUES('invented-success');
  RAISE EXCEPTION 'Unknown job state accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 INSERT INTO public.results(time_ms,official_identity_key,origin,is_official,source_id,official_event_number,official_round,official_sex) VALUES(12345,repeat('a',64),'official',true,gen_random_uuid(),'16','Final Direta','masculino');
 BEGIN
  INSERT INTO public.results(time_ms,official_identity_key,origin,is_official,source_id,official_event_number,official_round,official_sex) VALUES(12346,repeat('a',64),'official',true,gen_random_uuid(),'16','Final Direta','masculino');
  RAISE EXCEPTION 'Corrected time created duplicate identity';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  INSERT INTO public.results(time_ms,official_identity_key) VALUES(12345,repeat('b',64));
  RAISE EXCEPTION 'Manual result occupied official identity';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
SELECT 'isolated contract assertions passed; no production connection' AS outcome;
