-- Candidate NOT APPLIED. Install after catalog/monitoring; activate only at cutover.
BEGIN;
CREATE TABLE public.official_catalog_subscriptions (
 athlete_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
 source_id uuid NOT NULL REFERENCES public.sources(id),requested_by uuid NOT NULL REFERENCES auth.users(id),
 active boolean NOT NULL DEFAULT true,next_scan_at timestamptz NOT NULL DEFAULT now()+interval '1 day',
 updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(athlete_id,source_id)
);
ALTER TABLE public.official_catalog_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.official_catalog_subscriptions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.official_catalog_subscriptions TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.official_catalog_subscriptions TO service_role;
CREATE POLICY catalog_subscription_member_read ON public.official_catalog_subscriptions FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.athletes a JOIN public.account_members m ON m.account_id=a.account_id
 WHERE a.id=official_catalog_subscriptions.athlete_id AND m.user_id=auth.uid() AND m.status='active')
);
CREATE FUNCTION public.enroll_official_catalog_from_config() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE blocked_request uuid;
BEGIN
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sources WHERE id=NEW.source_id AND code='swimsystem' AND official AND active) THEN RETURN NEW; END IF;
 IF NOT NEW.active OR NEW.external_id IS NULL OR NEW.external_id !~ '^[0-9]+$' THEN
  UPDATE public.official_catalog_subscriptions SET active=false,updated_at=now() WHERE athlete_id=NEW.athlete_id AND source_id=NEW.source_id;
  RETURN NEW;
 END IF;
 BEGIN
  PERFORM public.request_official_catalog_import(NEW.athlete_id);
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'SOURCE_IDENTITY_MISSING_OR_AMBIGUOUS' THEN RAISE; END IF;
  -- Preserve config edits needed to resolve identity; report a blocked request,
  -- rather than rolling the config save back or silently claiming enrollment.
  UPDATE public.official_catalog_subscriptions SET active=false,updated_at=now() WHERE athlete_id=NEW.athlete_id AND source_id=NEW.source_id;
  INSERT INTO public.refresh_requests(athlete_id,requested_by,source_codes,job_count)
  VALUES(NEW.athlete_id,auth.uid(),ARRAY['swimsystem'],1) RETURNING id INTO blocked_request;
  INSERT INTO public.import_v2_jobs(request_id,athlete_id,source_id,job_type,worker_version,status,failure_code,last_error,cursor)
  VALUES(blocked_request,NEW.athlete_id,NEW.source_id,'historical','official-v3','blocked','identity_not_found','SOURCE_IDENTITY_MISSING_OR_AMBIGUOUS',jsonb_build_object('scope','meet_catalog','catalog_url','https://www.swimsystem.app/meets'));
  RETURN NEW;
 END;
 INSERT INTO public.official_catalog_subscriptions(athlete_id,source_id,requested_by)
 VALUES(NEW.athlete_id,NEW.source_id,auth.uid())
 ON CONFLICT(athlete_id,source_id) DO UPDATE SET requested_by=excluded.requested_by,active=true,updated_at=now();
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enroll_official_catalog_from_config() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER official_catalog_config_enrollment AFTER INSERT OR UPDATE OF active,external_id,source_id ON public.athlete_source_configs
 FOR EACH ROW EXECUTE FUNCTION public.enroll_official_catalog_from_config();
CREATE FUNCTION public.enqueue_official_catalog_scans(p_limit integer DEFAULT 8) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE subscription public.official_catalog_subscriptions;request uuid;enqueued integer:=0;revoked integer:=0;
BEGIN
 FOR subscription IN SELECT * FROM public.official_catalog_subscriptions WHERE active AND next_scan_at<=now()
 ORDER BY next_scan_at FOR UPDATE SKIP LOCKED LIMIT least(greatest(coalesce(p_limit,8),1),32) LOOP
  -- Skip rather than wait while holding a subscription row used by enrollment.
  IF NOT pg_try_advisory_xact_lock(hashtextextended('catalog-request:'||subscription.athlete_id::text,0)) THEN CONTINUE; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.athletes a JOIN public.account_members m ON m.account_id=a.account_id
   JOIN public.sources s ON s.id=subscription.source_id WHERE a.id=subscription.athlete_id AND m.user_id=subscription.requested_by AND m.status='active' AND s.code='swimsystem' AND s.active AND s.official)
   OR NOT EXISTS(SELECT 1 FROM public.athlete_source_configs c WHERE c.athlete_id=subscription.athlete_id AND c.source_id=subscription.source_id AND c.active AND c.external_id ~ '^[0-9]+$') THEN
   UPDATE public.official_catalog_subscriptions SET active=false,updated_at=now() WHERE athlete_id=subscription.athlete_id AND source_id=subscription.source_id;
   revoked=revoked+1;CONTINUE;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.refresh_requests r JOIN public.import_v2_jobs j ON j.request_id=r.id
   WHERE r.athlete_id=subscription.athlete_id AND r.terminal_status IS NULL AND r.cancel_requested_at IS NULL AND j.worker_version='official-v3' AND j.source_id=subscription.source_id AND j.cursor->>'scope'='meet_catalog') THEN
   INSERT INTO public.refresh_requests(athlete_id,requested_by,source_codes,job_count) VALUES(subscription.athlete_id,subscription.requested_by,ARRAY['swimsystem'],1) RETURNING id INTO request;
   INSERT INTO public.import_v2_jobs(request_id,athlete_id,source_id,job_type,worker_version,cursor)
   VALUES(request,subscription.athlete_id,subscription.source_id,'historical','official-v3',jsonb_build_object('scope','meet_catalog','catalog_url','https://www.swimsystem.app/meets'));
   enqueued=enqueued+1;
  END IF;
  UPDATE public.official_catalog_subscriptions SET next_scan_at=now()+interval '1 day',updated_at=now() WHERE athlete_id=subscription.athlete_id AND source_id=subscription.source_id;
 END LOOP;
 RETURN jsonb_build_object('enqueued',enqueued,'revoked',revoked);
END $$;
REVOKE ALL ON FUNCTION public.enqueue_official_catalog_scans(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_official_catalog_scans(integer) TO service_role;
COMMIT;
