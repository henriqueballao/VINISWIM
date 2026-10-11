DO $$ BEGIN IF current_database()<>'viniswim_isolated_test' THEN RAISE EXCEPTION 'Synthetic fixture must never run on production'; END IF; END $$;
-- SYNTHETIC isolated PostgreSQL contract fixture, never run on production.
-- Mirrors the audited relevant constraints; not a full Supabase schema dump.
CREATE TYPE public.swim_course AS ENUM ('SCM','LCM');
CREATE TABLE public.meet_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),meet_id uuid NOT NULL,
 athlete_id uuid NOT NULL,event_id uuid NOT NULL,
 lane integer,heat integer,seed_time_ms integer,
 CONSTRAINT meet_entries_lane_check CHECK (lane IS NULL OR lane>0),
 CHECK (heat IS NULL OR heat>0),CHECK (seed_time_ms IS NULL OR seed_time_ms>0)
);
CREATE UNIQUE INDEX meet_entries_natural_uidx ON public.meet_entries(meet_id,athlete_id,event_id);
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
DECLARE meet uuid:=gen_random_uuid(); athlete uuid:=gen_random_uuid(); event uuid:=gen_random_uuid();
BEGIN
 INSERT INTO public.meet_entries(meet_id,athlete_id,event_id,lane,official_event_number,official_round,official_sex,official_event_date,official_course)
 VALUES(meet,athlete,event,0,'16','Final Direta','masculino','2026-10-10','LCM'),
       (meet,athlete,event,1,'20','Final Direta','masculino','2026-10-10','LCM'),
       (meet,athlete,event,1,'16','Semifinal','masculino','2026-10-10','LCM');
 IF (SELECT count(*) FROM meet_entries)<>3 THEN RAISE EXCEPTION 'Separate official races lost'; END IF;
 BEGIN
  INSERT INTO public.meet_entries(meet_id,athlete_id,event_id,lane,official_event_number,official_round,official_sex,official_event_date,official_course)
  VALUES(meet,athlete,event,2,'16','Final Direta','masculino','2026-10-10','LCM');
  RAISE EXCEPTION 'Duplicate official identity accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 -- The same registration may have profiles in separate accounts/athlete IDs.
 INSERT INTO public.meet_entries(meet_id,athlete_id,event_id,lane,official_event_number,official_round,official_sex,official_event_date,official_course)
 VALUES(meet,gen_random_uuid(),event,0,'16','Final Direta','masculino','2026-10-10','LCM');
 BEGIN
  INSERT INTO public.meet_entries(meet_id,athlete_id,event_id,official_event_number) VALUES(meet,athlete,event,'17');
  RAISE EXCEPTION 'Partial official event identity accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
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
