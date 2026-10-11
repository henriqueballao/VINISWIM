-- Executed once following owner authorization. Scope/count assertion prevents reuse after cleanup.
BEGIN;
LOCK TABLE public.results, public.meet_entries, public.monitor_jobs, public.import_v2_jobs, public.historical_archive_jobs IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO app.legacy_cleanup_holds(athlete_id,reason)
SELECT id,'Owner authorized removal of all 252 legacy results across the three accounts; no import until validated pipeline activation'
FROM public.athletes WHERE id IN ('4949f776-8a46-4abe-9339-7d86192c82ca','32ff6a40-b7a3-4cf9-9739-35b6138993f9','29ccbda0-fd1b-4fba-a39b-3486f78588c4','af41d466-479b-47e5-8ffb-6dd03ae26e4f','f02e62f2-4987-4c99-aa21-1b8d89b80e65');
DO $check$ BEGIN
 IF (SELECT count(*) FROM app.legacy_cleanup_holds)<>5 OR (SELECT count(*) FROM public.results)<>252 OR EXISTS(SELECT 1 FROM public.results r WHERE NOT EXISTS(SELECT 1 FROM app.legacy_cleanup_holds h WHERE h.athlete_id=r.athlete_id)) THEN RAISE EXCEPTION 'CLEANUP_SCOPE_CHANGED'; END IF;
END $check$;
SELECT cron.alter_job(jobid,active:=false) FROM cron.job WHERE jobname IN ('viniswim-import-v2-runner','viniswim-all-athletes-all-sources','viniswim-nightly-all-athlete-full-scan');
UPDATE public.monitor_jobs SET status='cancelled',locked_at=NULL,last_error='Owner authorized legacy cleanup; imports paused',updated_at=now() WHERE athlete_id IN (SELECT athlete_id FROM app.legacy_cleanup_holds) AND status::text IN ('pending','running','partial','failed');
UPDATE public.import_v2_jobs SET status='cancelled',locked_at=NULL,last_error='Owner authorized legacy cleanup; imports paused',updated_at=now() WHERE athlete_id IN (SELECT athlete_id FROM app.legacy_cleanup_holds) AND status IN ('pending','running','failed');
DELETE FROM public.historical_archive_jobs WHERE athlete_id IN (SELECT athlete_id FROM app.legacy_cleanup_holds);
DELETE FROM public.reconciliation_queue WHERE athlete_id IN (SELECT athlete_id FROM app.legacy_cleanup_holds);
DELETE FROM public.notifications WHERE athlete_id IN (SELECT athlete_id FROM app.legacy_cleanup_holds);
DELETE FROM public.meet_entries WHERE athlete_id IN (SELECT athlete_id FROM app.legacy_cleanup_holds);
DELETE FROM public.results WHERE athlete_id IN (SELECT athlete_id FROM app.legacy_cleanup_holds);
DELETE FROM public.personal_bests WHERE athlete_id IN (SELECT athlete_id FROM app.legacy_cleanup_holds);
INSERT INTO public.audit_log(entity_type,action,source,new_data) VALUES ('legacy_cleanup','delete','owner_authorized_cleanup',jsonb_build_object('authorized_result_count',252,'athlete_profiles_preserved',5,'import_hold',true,'note','No archived result payload restored or used as import evidence'));
COMMIT;
SELECT jsonb_build_object('captured_at',now(),'results',(SELECT count(*) FROM results),'entries',(SELECT count(*) FROM meet_entries),'personal_bests',(SELECT count(*) FROM personal_bests),'result_sources',(SELECT count(*) FROM result_sources),'holds',(SELECT count(*) FROM app.legacy_cleanup_holds),'athletes_preserved',(SELECT count(*) FROM athletes WHERE id IN(SELECT athlete_id FROM app.legacy_cleanup_holds)),'cron',(SELECT jsonb_agg(jsonb_build_object('name',jobname,'active',active)) FROM cron.job)) AS evidence;
-- Final verification, includes rollback-only fence assertions
DO $test$ DECLARE aid uuid; blocked integer:=0; BEGIN SELECT athlete_id INTO aid FROM app.legacy_cleanup_holds LIMIT 1;
BEGIN INSERT INTO public.results(athlete_id) VALUES(aid); RAISE EXCEPTION 'RESULT_FENCE_FAILED'; EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM<>'LEGACY_IMPORT_PAUSED_AFTER_AUTHORIZED_CLEANUP' THEN RAISE; END IF; blocked:=blocked+1; END;
BEGIN INSERT INTO public.meet_entries(athlete_id) VALUES(aid); RAISE EXCEPTION 'ENTRY_FENCE_FAILED'; EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM<>'LEGACY_IMPORT_PAUSED_AFTER_AUTHORIZED_CLEANUP' THEN RAISE; END IF; blocked:=blocked+1; END;
BEGIN INSERT INTO public.import_v2_jobs(athlete_id,status,job_type) VALUES(aid,'pending','historical'); RAISE EXCEPTION 'JOB_FENCE_FAILED'; EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM<>'LEGACY_IMPORT_PAUSED_AFTER_AUTHORIZED_CLEANUP' THEN RAISE; END IF; blocked:=blocked+1; END;
IF blocked<>3 THEN RAISE EXCEPTION 'FENCE_ASSERTION_FAILED'; END IF; END $test$;
SELECT jsonb_build_object('captured_at',now(),'results',(SELECT count(*) FROM results),'entries',(SELECT count(*) FROM meet_entries),'personal_bests',(SELECT count(*) FROM personal_bests),'result_sources',(SELECT count(*) FROM result_sources),'held_athletes',(SELECT count(*) FROM app.legacy_cleanup_holds),'active_jobs',(SELECT count(*) FROM import_v2_jobs WHERE status IN('pending','running') AND athlete_id IN(SELECT athlete_id FROM app.legacy_cleanup_holds)),'migrations',(SELECT jsonb_agg(jsonb_build_object('version',version,'name',name)) FROM supabase_migrations.schema_migrations WHERE name IN('legacy_cleanup_hold','legacy_cleanup_hold_record_contract'))) AS evidence;