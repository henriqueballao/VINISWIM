-- Shared source caches are worker-owned. Browser writes can poison official evidence.
-- Keep existing SELECT privileges; deny every browser mutation, including TRUNCATE.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.historical_discovery_cache, public.historical_document_text_cache,
 public.historical_source_documents, public.history_debug_probe,
 public.official_meet_document_catalog
FROM PUBLIC, anon, authenticated;
