#!/usr/bin/env python3
"""Local Supabase only: native Auth/PostgREST, captured sporting core contracts.
Peripheral account/profile tables below are marked synthetic, not a full clone.
"""
import os, subprocess
from pathlib import Path
from urllib.parse import urlparse
db = os.environ.get('DB_URL', '')
parsed = urlparse(db)
if parsed.hostname not in ('127.0.0.1', 'localhost') or parsed.port != 54322:
 raise SystemExit('Native fixture is restricted to loopback port 54322')
root = Path(__file__).resolve().parents[1]
core = (root/'commercial/supabase/tests/isolated/published-core-schema.sql').read_text()
core = '\n'.join(core.splitlines()[3:])
core = core.replace('CREATE TABLE public.accounts(id uuid PRIMARY KEY);', "CREATE TABLE public.accounts(id uuid PRIMARY KEY,name text NOT NULL DEFAULT 'SYNTHETIC LOCAL ACCOUNT');")
core = core.replace('CREATE TABLE auth.users(id uuid PRIMARY KEY);', '-- Native auth.users from the local Supabase service is retained.')
triggers = (root/'commercial/supabase/tests/isolated/published-triggers.sql').read_text()
triggers = '\n'.join(triggers.splitlines()[1:])
extra = """
-- SYNTHETIC peripheral contracts, native users and JWT verification are real.
CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id),full_name text NOT NULL,email text);
CREATE TABLE public.athlete_result_filters(athlete_id uuid PRIMARY KEY REFERENCES athletes(id),selected_meet_ids uuid[],updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.monitor_jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_id uuid REFERENCES refresh_requests(id),athlete_id uuid REFERENCES athletes(id),source_id uuid REFERENCES sources(id),status public.monitor_job_status NOT NULL DEFAULT 'pending',locked_at timestamptz,next_run_at timestamptz,updated_at timestamptz,last_error text);
CREATE TABLE public.historical_archive_jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_id uuid REFERENCES refresh_requests(id),athlete_id uuid REFERENCES athletes(id),status text NOT NULL DEFAULT 'pending',heartbeat_at timestamptz,finished_at timestamptz,updated_at timestamptz,started_at timestamptz,last_error text);
"""
policies = """
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY native_account_read ON public.accounts FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.account_members m WHERE m.account_id=accounts.id AND m.user_id=auth.uid() AND m.status='active'));
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY native_profile_read ON public.profiles FOR SELECT TO authenticated USING(id=auth.uid());
"""
for table in ['personal_bests','audit_log','monitor_jobs','historical_archive_jobs','athlete_result_filters']:
 policies += f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;\nCREATE POLICY native_member_read ON public.{table} FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.athletes a JOIN public.account_members m ON m.account_id=a.account_id WHERE a.id={table}.athlete_id AND m.user_id=auth.uid() AND m.status='active'));\n"
policies += """
REVOKE ALL ON public.profiles,public.personal_bests,public.audit_log,public.monitor_jobs,public.historical_archive_jobs,public.athlete_result_filters FROM anon,authenticated;
GRANT SELECT ON public.accounts,public.profiles,public.personal_bests,public.audit_log,public.monitor_jobs,public.historical_archive_jobs,public.athlete_result_filters TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
CREATE VIEW public.v_athlete_overview WITH(security_invoker=true) AS SELECT a.id athlete_id,
 count(r.id) total_results,count(r.id) FILTER(WHERE r.is_official) official_results,
 count(r.id) FILTER(WHERE r.origin='manual') manual_results,
 count(r.id) FILTER(WHERE r.status IN('dns','dsq','dnf','partial')) occurrences,
 (SELECT count(*) FROM personal_bests p WHERE p.athlete_id=a.id) personal_bests,max(r.result_date) latest_result_date
 FROM athletes a LEFT JOIN results r ON r.athlete_id=a.id GROUP BY a.id;
GRANT SELECT ON public.v_athlete_overview TO authenticated,service_role;
"""
subprocess.run(['psql',db,'-v','ON_ERROR_STOP=1'],input=core+'\n'+extra+'\n'+triggers+'\n'+policies,text=True,check=True,stdout=subprocess.DEVNULL)
print('Native local Auth and published sporting core installed; peripheral fixtures are synthetic')
