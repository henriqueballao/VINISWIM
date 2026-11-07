DO $$ BEGIN IF current_database()<>'viniswim_isolated_test' THEN RAISE EXCEPTION 'Never run catalog fixture on production'; END IF; END $$;
-- Published core columns, defaults, constraints, indexes and RLS copied from
-- read-only catalog; external account/Auth/monitor relations are minimal stubs.
CREATE TABLE public.accounts(id uuid PRIMARY KEY);
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.monitor_runs(id uuid PRIMARY KEY);
CREATE TYPE public."gender_code" AS ENUM ('male','female','other','unspecified');
CREATE TYPE public."meet_status" AS ENUM ('draft','scheduled','active','completed','cancelled');
CREATE TYPE public."member_role" AS ENUM ('owner','admin','guardian','coach','viewer','athlete');
CREATE TYPE public."source_type" AS ENUM ('official_results','federation','club','other');
CREATE TYPE public."swim_course" AS ENUM ('SCM','LCM');
CREATE TYPE public."swim_stroke" AS ENUM ('freestyle','backstroke','breaststroke','butterfly','medley','relay');
CREATE TYPE public."account_type" AS ENUM ('individual','family','club');
CREATE TYPE public."entry_status" AS ENUM ('entered','seeded','withdrawn','dns','cancelled');
CREATE TYPE public."member_status" AS ENUM ('invited','active','suspended','removed');
CREATE TYPE public."result_origin" AS ENUM ('official','manual','import');
CREATE TYPE public."result_status" AS ENUM ('valid','dns','dsq','dnf','partial');
CREATE TYPE public."account_status" AS ENUM ('active','suspended','cancelled','pending_deletion');
CREATE TYPE public."athlete_status" AS ENUM ('draft','pending_source','syncing','active','sync_error','inactive');
CREATE TYPE public."monitor_job_type" AS ENUM ('current_meet','historical','reconciliation');
CREATE TYPE public."identifier_status" AS ENUM ('unverified','verified','syncing','active','error','disabled');
CREATE TYPE public."notification_type" AS ENUM ('official_result','personal_best','meet_entry','seed_change','occurrence','system');
CREATE TYPE public."monitor_job_status" AS ENUM ('pending','running','completed','partial','failed','cancelled');
CREATE TYPE public."monitor_run_status" AS ENUM ('running','completed','partial','failed');
CREATE TYPE public."source_link_status" AS ENUM ('pending','verified','rejected','error');
CREATE TYPE public."notification_status" AS ENUM ('pending','sent','failed','read');
CREATE TYPE public."subscription_status" AS ENUM ('trialing','active','past_due','cancelled','expired');
CREATE TYPE public."commercial_access_status" AS ENUM ('authorized','used','revoked','expired');
CREATE TABLE public."sources" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "code" text NOT NULL,
 "name" text NOT NULL,
 "source_type" source_type NOT NULL,
 "base_url" text,
 "official" bool DEFAULT false NOT NULL,
 "active" bool DEFAULT true NOT NULL,
 "created_at" timestamptz DEFAULT now() NOT NULL,
 "updated_at" timestamptz DEFAULT now() NOT NULL,
 CONSTRAINT "sources_code_check" CHECK ((code ~ '^[a-z0-9_]+$'::text)),
 CONSTRAINT "sources_code_key" UNIQUE (code),
 CONSTRAINT "sources_pkey" PRIMARY KEY (id)
);
CREATE TABLE public."athletes" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "account_id" uuid NOT NULL,
 "full_name" text NOT NULL,
 "preferred_name" text,
 "birth_date" date,
 "gender" gender_code DEFAULT 'unspecified'::gender_code NOT NULL,
 "club_name" text,
 "status" athlete_status DEFAULT 'draft'::athlete_status NOT NULL,
 "active" bool DEFAULT true NOT NULL,
 "created_at" timestamptz DEFAULT now() NOT NULL,
 "updated_at" timestamptz DEFAULT now() NOT NULL,
 "category" text,
 "category_by_year" jsonb DEFAULT '{}'::jsonb NOT NULL,
 "photo_data_url" text,
 CONSTRAINT "athletes_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
 CONSTRAINT "athletes_full_name_check" CHECK ((length(TRIM(BOTH FROM full_name)) >= 2)),
 CONSTRAINT "athletes_pkey" PRIMARY KEY (id)
);
CREATE TABLE public."account_members" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "account_id" uuid NOT NULL,
 "user_id" uuid NOT NULL,
 "role" member_role DEFAULT 'guardian'::member_role NOT NULL,
 "status" member_status DEFAULT 'invited'::member_status NOT NULL,
 "invited_at" timestamptz,
 "joined_at" timestamptz,
 "created_at" timestamptz DEFAULT now() NOT NULL,
 "updated_at" timestamptz DEFAULT now() NOT NULL,
 CONSTRAINT "account_members_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
 CONSTRAINT "account_members_account_id_user_id_key" UNIQUE (account_id, user_id),
 CONSTRAINT "account_members_pkey" PRIMARY KEY (id),
 CONSTRAINT "account_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE TABLE public."athlete_identifiers" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "athlete_id" uuid NOT NULL,
 "source_id" uuid NOT NULL,
 "external_id" text NOT NULL,
 "external_name" text,
 "status" identifier_status DEFAULT 'unverified'::identifier_status NOT NULL,
 "verified" bool DEFAULT false NOT NULL,
 "verified_at" timestamptz,
 "active" bool DEFAULT true NOT NULL,
 "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
 "created_at" timestamptz DEFAULT now() NOT NULL,
 "updated_at" timestamptz DEFAULT now() NOT NULL,
 CONSTRAINT "athlete_identifiers_athlete_id_fkey" FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE,
 CONSTRAINT "athlete_identifiers_athlete_id_source_id_key" UNIQUE (athlete_id, source_id),
 CONSTRAINT "athlete_identifiers_pkey" PRIMARY KEY (id),
 CONSTRAINT "athlete_identifiers_source_id_fkey" FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE RESTRICT
);
CREATE TABLE public."athlete_source_configs" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "athlete_id" uuid NOT NULL,
 "source_id" uuid,
 "display_name" text NOT NULL,
 "source_url" text NOT NULL,
 "external_id" text,
 "external_name" text,
 "active" bool DEFAULT true NOT NULL,
 "created_at" timestamptz DEFAULT now() NOT NULL,
 "updated_at" timestamptz DEFAULT now() NOT NULL,
 "is_default" bool DEFAULT false NOT NULL,
 "sort_order" int4 DEFAULT 100 NOT NULL,
 CONSTRAINT "athlete_source_configs_athlete_id_fkey" FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE,
 CONSTRAINT "athlete_source_configs_athlete_id_source_id_key" UNIQUE (athlete_id, source_id),
 CONSTRAINT "athlete_source_configs_pkey" PRIMARY KEY (id),
 CONSTRAINT "athlete_source_configs_source_id_fkey" FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE RESTRICT
);
CREATE TABLE public."events" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "distance_m" int4 NOT NULL,
 "stroke" swim_stroke NOT NULL,
 "relay" bool DEFAULT false NOT NULL,
 "label" text NOT NULL,
 "sort_order" int4 DEFAULT 0 NOT NULL,
 "active" bool DEFAULT true NOT NULL,
 "created_at" timestamptz DEFAULT now() NOT NULL,
 CONSTRAINT "events_distance_m_check" CHECK ((distance_m > 0)),
 CONSTRAINT "events_distance_m_stroke_relay_key" UNIQUE (distance_m, stroke, relay),
 CONSTRAINT "events_pkey" PRIMARY KEY (id)
);
CREATE TABLE public."meets" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "source_id" uuid,
 "external_id" text,
 "name" text NOT NULL,
 "start_date" date NOT NULL,
 "end_date" date,
 "venue" text,
 "city" text,
 "state" text,
 "country" text DEFAULT 'BR'::text NOT NULL,
 "course" swim_course,
 "official_url" text,
 "status" meet_status DEFAULT 'scheduled'::meet_status NOT NULL,
 "created_at" timestamptz DEFAULT now() NOT NULL,
 "updated_at" timestamptz DEFAULT now() NOT NULL,
 CONSTRAINT "meets_check" CHECK (((end_date IS NULL) OR (end_date >= start_date))),
 CONSTRAINT "meets_pkey" PRIMARY KEY (id),
 CONSTRAINT "meets_source_id_fkey" FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL
);
CREATE TABLE public."refresh_requests" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "athlete_id" uuid NOT NULL,
 "requested_by" uuid NOT NULL,
 "source_codes" text[],
 "created_at" timestamptz DEFAULT now() NOT NULL,
 "updated_at" timestamptz DEFAULT now() NOT NULL,
 "cancel_requested_at" timestamptz,
 "job_count" int4 DEFAULT 0 NOT NULL,
 "terminal_status" text,
 "completed_job_count" int4,
 "failed_job_count" int4,
 "finalized_at" timestamptz,
 CONSTRAINT "refresh_requests_athlete_id_fkey" FOREIGN KEY (athlete_id) REFERENCES athletes(id),
 CONSTRAINT "refresh_requests_pkey" PRIMARY KEY (id),
 CONSTRAINT "refresh_requests_terminal_status_check" CHECK (((terminal_status IS NULL) OR (terminal_status = ANY (ARRAY['cancelled'::text, 'completed'::text, 'failed'::text, 'no_sources'::text]))))
);
CREATE TABLE public."import_v2_jobs" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "request_id" uuid NOT NULL,
 "athlete_id" uuid NOT NULL,
 "source_id" uuid NOT NULL,
 "job_type" text NOT NULL,
 "status" text DEFAULT 'pending'::text NOT NULL,
 "priority" int4 DEFAULT 10 NOT NULL,
 "cursor" jsonb DEFAULT '{}'::jsonb NOT NULL,
 "failure_code" text,
 "last_error" text,
 "attempts" int4 DEFAULT 0 NOT NULL,
 "records_found" int4 DEFAULT 0 NOT NULL,
 "records_inserted" int4 DEFAULT 0 NOT NULL,
 "records_duplicated" int4 DEFAULT 0 NOT NULL,
 "locked_at" timestamptz,
 "last_run_at" timestamptz,
 "next_run_at" timestamptz DEFAULT now(),
 "created_at" timestamptz DEFAULT now() NOT NULL,
 "updated_at" timestamptz DEFAULT now() NOT NULL,
 CONSTRAINT "import_v2_jobs_athlete_id_fkey" FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE,
 CONSTRAINT "import_v2_jobs_job_type_check" CHECK ((job_type = ANY (ARRAY['historical'::text, 'current_meet'::text]))),
 CONSTRAINT "import_v2_jobs_pkey" PRIMARY KEY (id),
 CONSTRAINT "import_v2_jobs_request_id_fkey" FOREIGN KEY (request_id) REFERENCES refresh_requests(id) ON DELETE CASCADE,
 CONSTRAINT "import_v2_jobs_request_id_source_id_job_type_key" UNIQUE (request_id, source_id, job_type),
 CONSTRAINT "import_v2_jobs_source_id_fkey" FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE RESTRICT,
 CONSTRAINT "import_v2_jobs_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])))
);
CREATE TABLE public."results" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "athlete_id" uuid NOT NULL,
 "meet_id" uuid,
 "event_id" uuid NOT NULL,
 "result_date" date NOT NULL,
 "course" swim_course NOT NULL,
 "time_ms" int4,
 "status" result_status DEFAULT 'valid'::result_status NOT NULL,
 "origin" result_origin DEFAULT 'manual'::result_origin NOT NULL,
 "source_id" uuid,
 "external_id" text,
 "is_official" bool DEFAULT false NOT NULL,
 "notes" text,
 "created_by" uuid,
 "result_fingerprint" text,
 "created_at" timestamptz DEFAULT now() NOT NULL,
 "updated_at" timestamptz DEFAULT now() NOT NULL,
 "venue" text,
 "city" text,
 "category" text,
 CONSTRAINT "results_athlete_id_fkey" FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE,
 CONSTRAINT "results_check" CHECK (((status <> 'valid'::result_status) OR (time_ms IS NOT NULL))),
 CONSTRAINT "results_check1" CHECK (((origin <> 'official'::result_origin) OR (is_official = true))),
 CONSTRAINT "results_check2" CHECK (((origin <> 'manual'::result_origin) OR (is_official = false))),
 CONSTRAINT "results_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
 CONSTRAINT "results_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE RESTRICT,
 CONSTRAINT "results_meet_id_fkey" FOREIGN KEY (meet_id) REFERENCES meets(id) ON DELETE SET NULL,
 CONSTRAINT "results_pkey" PRIMARY KEY (id),
 CONSTRAINT "results_source_id_fkey" FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL,
 CONSTRAINT "results_time_ms_check" CHECK (((time_ms IS NULL) OR (time_ms > 0)))
);
CREATE TABLE public."result_sources" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "result_id" uuid NOT NULL,
 "source_id" uuid NOT NULL,
 "source_url" text,
 "external_id" text,
 "retrieved_at" timestamptz DEFAULT now() NOT NULL,
 "raw_hash" text,
 "monitor_run_id" uuid,
 "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
 "created_at" timestamptz DEFAULT now() NOT NULL,
 CONSTRAINT "result_sources_monitor_run_fk" FOREIGN KEY (monitor_run_id) REFERENCES monitor_runs(id) ON DELETE SET NULL,
 CONSTRAINT "result_sources_pkey" PRIMARY KEY (id),
 CONSTRAINT "result_sources_result_id_fkey" FOREIGN KEY (result_id) REFERENCES results(id) ON DELETE CASCADE,
 CONSTRAINT "result_sources_result_id_source_id_external_id_key" UNIQUE (result_id, source_id, external_id),
 CONSTRAINT "result_sources_source_id_fkey" FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE RESTRICT
);
CREATE TABLE public."meet_entries" (
 "id" uuid DEFAULT gen_random_uuid() NOT NULL,
 "meet_id" uuid NOT NULL,
 "athlete_id" uuid NOT NULL,
 "event_id" uuid NOT NULL,
 "seed_time_ms" int4,
 "heat" int4,
 "lane" int4,
 "entry_status" entry_status DEFAULT 'entered'::entry_status NOT NULL,
 "source_id" uuid,
 "external_id" text,
 "created_at" timestamptz DEFAULT now() NOT NULL,
 "updated_at" timestamptz DEFAULT now() NOT NULL,
 "scheduled_at" timestamptz,
 CONSTRAINT "meet_entries_athlete_id_fkey" FOREIGN KEY (athlete_id) REFERENCES athletes(id) ON DELETE CASCADE,
 CONSTRAINT "meet_entries_event_id_fkey" FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE RESTRICT,
 CONSTRAINT "meet_entries_heat_check" CHECK (((heat IS NULL) OR (heat > 0))),
 CONSTRAINT "meet_entries_lane_check" CHECK (((lane IS NULL) OR (lane > 0))),
 CONSTRAINT "meet_entries_meet_id_fkey" FOREIGN KEY (meet_id) REFERENCES meets(id) ON DELETE CASCADE,
 CONSTRAINT "meet_entries_pkey" PRIMARY KEY (id),
 CONSTRAINT "meet_entries_seed_time_ms_check" CHECK (((seed_time_ms IS NULL) OR (seed_time_ms > 0))),
 CONSTRAINT "meet_entries_source_id_fkey" FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL
);
CREATE INDEX account_members_user_account_idx ON public.account_members USING btree (user_id, account_id);
CREATE INDEX athlete_identifiers_athlete_idx ON public.athlete_identifiers USING btree (athlete_id);
CREATE UNIQUE INDEX athlete_source_configs_known_source_uq ON public.athlete_source_configs USING btree (athlete_id, source_id) WHERE (source_id IS NOT NULL);
CREATE INDEX athletes_account_idx ON public.athletes USING btree (account_id);
CREATE INDEX import_v2_jobs_athlete_idx ON public.import_v2_jobs USING btree (athlete_id);
CREATE INDEX import_v2_jobs_claim_idx ON public.import_v2_jobs USING btree (status, next_run_at, priority, created_at);
CREATE INDEX import_v2_jobs_source_idx ON public.import_v2_jobs USING btree (source_id);
CREATE INDEX meet_entries_athlete_idx ON public.meet_entries USING btree (athlete_id);
CREATE INDEX meet_entries_event_idx ON public.meet_entries USING btree (event_id);
CREATE UNIQUE INDEX meet_entries_natural_uidx ON public.meet_entries USING btree (meet_id, athlete_id, event_id);
CREATE INDEX meet_entries_scheduled_idx ON public.meet_entries USING btree (athlete_id, scheduled_at) WHERE (scheduled_at IS NOT NULL);
CREATE UNIQUE INDEX meet_entries_source_external_uidx ON public.meet_entries USING btree (source_id, external_id) WHERE ((source_id IS NOT NULL) AND (external_id IS NOT NULL));
CREATE UNIQUE INDEX meets_source_external_uidx ON public.meets USING btree (source_id, external_id) WHERE ((source_id IS NOT NULL) AND (external_id IS NOT NULL));
CREATE UNIQUE INDEX meets_source_external_uq ON public.meets USING btree (source_id, external_id);
CREATE INDEX refresh_requests_athlete_created_idx ON public.refresh_requests USING btree (athlete_id, created_at DESC);
CREATE INDEX result_sources_monitor_run_idx ON public.result_sources USING btree (monitor_run_id);
CREATE INDEX result_sources_source_idx ON public.result_sources USING btree (source_id);
CREATE INDEX results_athlete_date_idx ON public.results USING btree (athlete_id, result_date DESC, created_at DESC);
CREATE INDEX results_athlete_event_course_idx ON public.results USING btree (athlete_id, event_id, course);
CREATE INDEX results_created_by_idx ON public.results USING btree (created_by);
CREATE INDEX results_event_idx ON public.results USING btree (event_id);
CREATE UNIQUE INDEX results_fingerprint_uidx ON public.results USING btree (result_fingerprint) WHERE (result_fingerprint IS NOT NULL);
CREATE INDEX results_meet_athlete_idx ON public.results USING btree (meet_id, athlete_id);
CREATE UNIQUE INDEX results_source_external_uidx ON public.results USING btree (source_id, external_id) WHERE ((source_id IS NOT NULL) AND (external_id IS NOT NULL));
ALTER TABLE public."sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."athletes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."account_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."athlete_identifiers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."athlete_source_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."meets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."refresh_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."import_v2_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."result_sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."meet_entries" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "account_members_select_self" ON public."account_members" FOR SELECT TO "authenticated" USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "athlete_identifiers_select_member" ON public."athlete_identifiers" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (athletes a
     JOIN account_members am ON ((am.account_id = a.account_id)))
  WHERE ((a.id = athlete_identifiers.athlete_id) AND (am.user_id = ( SELECT auth.uid() AS uid)) AND (am.status = 'active'::member_status)))));
CREATE POLICY "athlete_source_configs_select_member" ON public."athlete_source_configs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (athletes a
     JOIN account_members am ON ((am.account_id = a.account_id)))
  WHERE ((a.id = athlete_source_configs.athlete_id) AND (am.user_id = auth.uid()) AND (am.status = 'active'::member_status)))));
CREATE POLICY "athletes_insert_writer" ON public."athletes" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM account_members am
  WHERE ((am.account_id = athletes.account_id) AND (am.user_id = ( SELECT auth.uid() AS uid)) AND (am.status = 'active'::member_status) AND (am.role = ANY (ARRAY['owner'::member_role, 'admin'::member_role, 'guardian'::member_role]))))));
CREATE POLICY "athletes_select_member" ON public."athletes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM account_members am
  WHERE ((am.account_id = athletes.account_id) AND (am.user_id = ( SELECT auth.uid() AS uid)) AND (am.status = 'active'::member_status)))));
CREATE POLICY "athletes_update_writer" ON public."athletes" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM account_members am
  WHERE ((am.account_id = athletes.account_id) AND (am.user_id = ( SELECT auth.uid() AS uid)) AND (am.status = 'active'::member_status) AND (am.role = ANY (ARRAY['owner'::member_role, 'admin'::member_role, 'guardian'::member_role])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM account_members am
  WHERE ((am.account_id = athletes.account_id) AND (am.user_id = ( SELECT auth.uid() AS uid)) AND (am.status = 'active'::member_status) AND (am.role = ANY (ARRAY['owner'::member_role, 'admin'::member_role, 'guardian'::member_role]))))));
CREATE POLICY "events_read_authenticated" ON public."events" FOR SELECT TO "authenticated" USING ((active = true));
CREATE POLICY "import_v2_jobs_select_members" ON public."import_v2_jobs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (athletes a
     JOIN account_members am ON ((am.account_id = a.account_id)))
  WHERE ((a.id = import_v2_jobs.athlete_id) AND (am.user_id = ( SELECT auth.uid() AS uid)) AND (am.status = 'active'::member_status)))));
CREATE POLICY "meet_entries_select_member" ON public."meet_entries" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (athletes a
     JOIN account_members am ON ((am.account_id = a.account_id)))
  WHERE ((a.id = meet_entries.athlete_id) AND (am.user_id = ( SELECT auth.uid() AS uid)) AND (am.status = 'active'::member_status)))));
CREATE POLICY "meets_select_related" ON public."meets" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM ((meet_entries me
     JOIN athletes a ON ((a.id = me.athlete_id)))
     JOIN account_members am ON ((am.account_id = a.account_id)))
  WHERE ((me.meet_id = meets.id) AND (am.user_id = ( SELECT auth.uid() AS uid)) AND (am.status = 'active'::member_status)))) OR (EXISTS ( SELECT 1
   FROM ((results r
     JOIN athletes a ON ((a.id = r.athlete_id)))
     JOIN account_members am ON ((am.account_id = a.account_id)))
  WHERE ((r.meet_id = meets.id) AND (am.user_id = ( SELECT auth.uid() AS uid)) AND (am.status = 'active'::member_status))))));
CREATE POLICY "refresh_requests_select_member" ON public."refresh_requests" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (athletes a
     JOIN account_members am ON ((am.account_id = a.account_id)))
  WHERE ((a.id = refresh_requests.athlete_id) AND (am.user_id = ( SELECT auth.uid() AS uid)) AND (am.status = 'active'::member_status)))));
CREATE POLICY "result_sources_select_member" ON public."result_sources" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ((results r
     JOIN athletes a ON ((a.id = r.athlete_id)))
     JOIN account_members am ON ((am.account_id = a.account_id)))
  WHERE ((r.id = result_sources.result_id) AND (am.user_id = ( SELECT auth.uid() AS uid)) AND (am.status = 'active'::member_status)))));
CREATE POLICY "results_delete_account_writer" ON public."results" FOR DELETE TO "authenticated" USING (((origin = 'manual'::result_origin) AND (is_official = false) AND (EXISTS ( SELECT 1
   FROM (athletes a
     JOIN account_members am ON ((am.account_id = a.account_id)))
  WHERE ((a.id = results.athlete_id) AND (am.user_id = ( SELECT auth.uid() AS uid)) AND (am.status = 'active'::member_status) AND (am.role = ANY (ARRAY['owner'::member_role, 'admin'::member_role, 'guardian'::member_role])))))));
CREATE POLICY "results_insert_manual_writer" ON public."results" FOR INSERT TO "authenticated" WITH CHECK (((origin = 'manual'::result_origin) AND (is_official = false) AND (created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM (athletes a
     JOIN account_members am ON ((am.account_id = a.account_id)))
  WHERE ((a.id = results.athlete_id) AND (am.user_id = ( SELECT auth.uid() AS uid)) AND (am.status = 'active'::member_status) AND (am.role = ANY (ARRAY['owner'::member_role, 'admin'::member_role, 'guardian'::member_role])))))));
CREATE POLICY "results_select_member" ON public."results" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (athletes a
     JOIN account_members am ON ((am.account_id = a.account_id)))
  WHERE ((a.id = results.athlete_id) AND (am.user_id = ( SELECT auth.uid() AS uid)) AND (am.status = 'active'::member_status)))));
CREATE POLICY "results_update_manual_writer" ON public."results" FOR UPDATE TO "authenticated" USING (((origin = 'manual'::result_origin) AND (is_official = false) AND (EXISTS ( SELECT 1
   FROM (athletes a
     JOIN account_members am ON ((am.account_id = a.account_id)))
  WHERE ((a.id = results.athlete_id) AND (am.user_id = ( SELECT auth.uid() AS uid)) AND (am.status = 'active'::member_status) AND (am.role = ANY (ARRAY['owner'::member_role, 'admin'::member_role, 'guardian'::member_role]))))))) WITH CHECK (((origin = 'manual'::result_origin) AND (is_official = false) AND (EXISTS ( SELECT 1
   FROM (athletes a
     JOIN account_members am ON ((am.account_id = a.account_id)))
  WHERE ((a.id = results.athlete_id) AND (am.user_id = ( SELECT auth.uid() AS uid)) AND (am.status = 'active'::member_status) AND (am.role = ANY (ARRAY['owner'::member_role, 'admin'::member_role, 'guardian'::member_role])))))));
CREATE POLICY "sources_read_authenticated" ON public."sources" FOR SELECT TO "authenticated" USING ((active = true));
GRANT SELECT ON public."sources",public."athletes",public."account_members",public."athlete_identifiers",public."athlete_source_configs",public."events",public."meets",public."refresh_requests",public."import_v2_jobs",public."results",public."result_sources",public."meet_entries" TO authenticated;
GRANT INSERT,UPDATE,DELETE ON public.results TO authenticated;

