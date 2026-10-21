-- Internal caches have no browser consumers in React source or the captured bundle.
-- Service-role workers and authorized owner-run RPCs retain access.
DO $$ BEGIN
 IF NOT COALESCE((SELECT rolbypassrls FROM pg_roles WHERE rolname='service_role'),false)
 THEN RAISE EXCEPTION 'Worker RLS bypass is missing'; END IF;
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename IN
 ('historical_discovery_cache','historical_document_text_cache','historical_source_documents',
  'history_debug_probe','official_meet_document_catalog'))
 THEN RAISE EXCEPTION 'Unexpected cache policies require review'; END IF;
END $$;
ALTER TABLE public.historical_discovery_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_document_text_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.history_debug_probe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_meet_document_catalog ENABLE ROW LEVEL SECURITY;
