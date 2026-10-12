-- Candidate NOT APPLIED. Read both contracts without changing legacy writes.
-- Requires official-event-integrity.sql. Never backfills official provenance.
-- Also requires manual-meet-entry.sql for separately labelled manual plans.
BEGIN;
REVOKE ALL ON public.official_meet_entries FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.official_meet_entries TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.official_meet_entries TO service_role;
CREATE POLICY official_entries_member_read ON public.official_meet_entries FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.athletes a JOIN public.account_members m ON m.account_id=a.account_id
  WHERE a.id=official_meet_entries.athlete_id AND m.user_id=(SELECT auth.uid()) AND m.status='active')
);
-- Keep the published legacy policy; add access to meets having only attested
-- entries (no result and no legacy projection yet).
CREATE POLICY meets_select_official_entry ON public.meets FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.official_meet_entries e JOIN public.athletes a ON a.id=e.athlete_id
  JOIN public.account_members m ON m.account_id=a.account_id
  WHERE e.meet_id=meets.id AND m.user_id=(SELECT auth.uid()) AND m.status='active')
);
CREATE VIEW public.v_meet_entry_timeline WITH(security_invoker=true) AS
 SELECT e.id,e.meet_id,e.athlete_id,e.event_id,e.seed_time_ms,e.heat,e.lane,e.entry_status::text,
  e.created_at,e.updated_at,e.source_id,e.external_id,e.scheduled_at,
  e.official_event_number,e.official_round,e.official_sex,e.official_event_date,e.official_course,
  'official'::text AS entry_origin,to_jsonb(m) AS meets
 FROM public.official_meet_entries e JOIN public.meets m ON m.id=e.meet_id
 UNION ALL
 SELECT e.id,e.meet_id,e.athlete_id,e.event_id,e.seed_time_ms,e.heat,e.lane,e.entry_status::text,
  e.created_at,e.updated_at,e.source_id,e.external_id,e.scheduled_at,
  NULL::text,NULL::text,NULL::text,NULL::date,NULL::public.swim_course,
  'legacy'::text AS entry_origin,to_jsonb(m) AS meets
 FROM public.meet_entries e JOIN public.meets m ON m.id=e.meet_id
 WHERE NOT EXISTS(SELECT 1 FROM public.official_meet_entries o
  WHERE o.athlete_id=e.athlete_id AND o.meet_id=e.meet_id AND o.event_id=e.event_id)
 UNION ALL
 SELECT e.id,e.meet_id,e.athlete_id,e.event_id,e.seed_time_ms,e.heat,e.lane,'entered'::text,
  e.created_at,e.updated_at,NULL::uuid,NULL::text,NULL::timestamptz,
  NULL::text,NULL::text,NULL::text,NULL::date,NULL::public.swim_course,
  'manual'::text AS entry_origin,to_jsonb(m) AS meets
 FROM public.manual_meet_entries e JOIN public.meets m ON m.id=e.meet_id;
REVOKE ALL ON public.v_meet_entry_timeline FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.v_meet_entry_timeline TO authenticated,service_role;
COMMIT;
