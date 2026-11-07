-- Candidate NOT APPLIED. Automatic monitoring for explicitly authorized,
-- subscribed competitions. Not a claim of federation-wide historical discovery.
BEGIN;
CREATE TABLE public.official_meet_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),athlete_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
 source_id uuid NOT NULL REFERENCES public.sources(id),meet_external_id text NOT NULL,official_url text NOT NULL,
 requested_by uuid NOT NULL,active boolean NOT NULL DEFAULT true,next_scan_at timestamptz NOT NULL DEFAULT now()+interval '15 minutes',
 last_checked_at timestamptz,last_publication_hash text,last_outcome text,last_error text,
 updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(athlete_id,source_id,meet_external_id),
 CHECK(official_url='https://www.swimsystem.app/meets/sw/'||meet_external_id),
 CHECK(meet_external_id ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'),
 CHECK(last_publication_hash IS NULL OR last_publication_hash ~ '^[a-f0-9]{64}$')
);
ALTER TABLE public.official_meet_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.official_meet_subscriptions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.official_meet_subscriptions TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.official_meet_subscriptions TO service_role;
CREATE POLICY official_subscription_member_read ON public.official_meet_subscriptions FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.athletes a JOIN public.account_members m ON m.account_id=a.account_id WHERE a.id=athlete_id AND m.user_id=auth.uid() AND m.status='active')
);
CREATE OR REPLACE FUNCTION public.enqueue_official_subscribed_meets(p_limit integer DEFAULT 16)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE subscription public.official_meet_subscriptions%ROWTYPE;request uuid;enqueued integer:=0;revoked integer:=0;deferred integer:=0;
BEGIN
 FOR subscription IN SELECT * FROM public.official_meet_subscriptions WHERE active AND next_scan_at<=now()
  ORDER BY next_scan_at FOR UPDATE SKIP LOCKED LIMIT least(greatest(coalesce(p_limit,16),1),64) LOOP
  IF NOT EXISTS(SELECT 1 FROM public.athletes a JOIN public.account_members m ON m.account_id=a.account_id
   JOIN public.sources s ON s.id=subscription.source_id WHERE a.id=subscription.athlete_id AND m.user_id=subscription.requested_by AND m.status='active' AND s.active AND s.official AND s.code='swimsystem'
   AND (NOT EXISTS(SELECT 1 FROM public.athlete_source_configs c WHERE c.athlete_id=a.id AND c.source_id=s.id) OR EXISTS(SELECT 1 FROM public.athlete_source_configs c WHERE c.athlete_id=a.id AND c.source_id=s.id AND c.active))) THEN
   UPDATE public.official_meet_subscriptions SET active=false,last_outcome='access_denied',last_error='Subscription actor or source is no longer authorized',updated_at=now() WHERE id=subscription.id;
   revoked=revoked+1;CONTINUE;
  END IF;
  IF EXISTS(SELECT 1 FROM public.import_v2_jobs j JOIN public.refresh_requests r ON r.id=j.request_id WHERE j.athlete_id=subscription.athlete_id AND j.source_id=subscription.source_id AND j.worker_version='official-v3'
   AND j.cursor->>'external_meet_id'=subscription.meet_external_id AND j.status IN ('pending','running') AND r.cancel_requested_at IS NULL AND r.terminal_status IS NULL) THEN
   UPDATE public.official_meet_subscriptions SET next_scan_at=now()+interval '1 minute',updated_at=now() WHERE id=subscription.id;
   deferred=deferred+1;CONTINUE;
  END IF;
  INSERT INTO public.refresh_requests(athlete_id,requested_by,source_codes,job_count) VALUES(subscription.athlete_id,subscription.requested_by,ARRAY['swimsystem'],1) RETURNING id INTO request;
  INSERT INTO public.import_v2_jobs(request_id,athlete_id,source_id,job_type,worker_version,priority,cursor)
   VALUES(request,subscription.athlete_id,subscription.source_id,'current_meet','official-v3',10,jsonb_build_object('scope','targeted_meet','external_meet_id',subscription.meet_external_id,'official_url',subscription.official_url));
  UPDATE public.official_meet_subscriptions SET next_scan_at=now()+interval '15 minutes',updated_at=now() WHERE id=subscription.id;
  enqueued=enqueued+1;
 END LOOP;
 RETURN jsonb_build_object('enqueued',enqueued,'revoked',revoked,'deferred',deferred);
END $$;
REVOKE ALL ON FUNCTION public.enqueue_official_subscribed_meets(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_official_subscribed_meets(integer) TO service_role;
COMMIT;
