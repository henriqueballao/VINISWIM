-- CUTOVER CANDIDATE, NOT APPLIED. Execute only after complete schema/worker/UI,
-- original-data persistence and authenticated handler tests pass. This file does
-- not disable legacy global jobs: their consumers require a separate proven fence.
-- No worker token is created or embedded here. Provision it through Vault first.
BEGIN;
DO $$ BEGIN PERFORM public.read_official_worker_token(); END $$;
SELECT cron.schedule('viniswim-official-import-runner','* * * * *',
 'SELECT public.dispatch_official_import_worker();');
COMMIT;
