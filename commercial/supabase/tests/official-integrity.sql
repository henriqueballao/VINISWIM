-- Read-only assertions. No synthetic sporting rows enter production.
DO $$
DECLARE t text; r text; p text;
BEGIN
 IF NOT COALESCE((SELECT 'security_invoker=true'=ANY(reloptions)
                  FROM pg_class WHERE oid='public.v_result_timeline'::regclass),false)
 THEN RAISE EXCEPTION 'Timeline bypasses RLS'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='results'
  AND policyname='results_delete_account_writer' AND roles=ARRAY['authenticated']::name[]
  AND qual LIKE '%origin = ''manual''%' AND qual LIKE '%is_official = false%')
 THEN RAISE EXCEPTION 'Official deletion protection is missing'; END IF;
 FOREACH t IN ARRAY ARRAY['historical_discovery_cache','historical_document_text_cache',
  'historical_source_documents','history_debug_probe','official_meet_document_catalog'] LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=('public.'||t)::regclass)
  THEN RAISE EXCEPTION 'Internal evidence cache lacks RLS: %',t; END IF;
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
   FOREACH p IN ARRAY ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
    IF has_table_privilege(r,('public.'||t)::regclass,p)
    THEN RAISE EXCEPTION 'Browser mutation allowed: %.% %',r,t,p; END IF;
   END LOOP;
  END LOOP;
  FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
   IF NOT has_table_privilege('service_role',('public.'||t)::regclass,p)
   THEN RAISE EXCEPTION 'Worker access lost: % %',t,p; END IF;
  END LOOP;
 END LOOP;
END $$;
