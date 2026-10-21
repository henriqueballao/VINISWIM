-- Candidate NOT APPLIED. Manual planning never writes attested/legacy entries.
BEGIN;
CREATE TABLE public.manual_meet_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 meet_id uuid NOT NULL UNIQUE REFERENCES public.meets(id) ON DELETE RESTRICT,
 athlete_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
 event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
 seed_time_ms integer CHECK(seed_time_ms>0),
 heat integer CHECK(heat>0), lane integer CHECK(lane BETWEEN 0 AND 9),
 created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.manual_meet_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.manual_meet_entries FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.manual_meet_entries TO authenticated,service_role;
CREATE POLICY manual_entries_member_read ON public.manual_meet_entries FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.athletes a JOIN public.account_members m ON m.account_id=a.account_id
 WHERE a.id=manual_meet_entries.athlete_id AND m.user_id=(SELECT auth.uid()) AND m.status='active')
);
CREATE POLICY meets_select_manual_entry ON public.meets FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.manual_meet_entries e JOIN public.athletes a ON a.id=e.athlete_id
 JOIN public.account_members m ON m.account_id=a.account_id
 WHERE e.meet_id=meets.id AND m.user_id=(SELECT auth.uid()) AND m.status='active')
);
CREATE FUNCTION public.create_manual_meet_entry(p_athlete_id uuid,p_event_id uuid,p_name text,p_date date,
 p_course public.swim_course,p_venue text DEFAULT NULL,p_city text DEFAULT NULL,p_seed_time_ms integer DEFAULT NULL,
 p_heat integer DEFAULT NULL,p_lane integer DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE meet uuid;entry uuid;
BEGIN
 -- Lock identity and membership against revocation/reassignment until commit.
 PERFORM 1 FROM public.athletes a JOIN public.account_members m ON m.account_id=a.account_id
 WHERE a.id=p_athlete_id AND m.user_id=auth.uid() AND m.status='active'
 AND m.role IN('owner','admin','guardian') FOR SHARE OF a,m;
 IF auth.uid() IS NULL OR NOT FOUND THEN RAISE EXCEPTION 'MANUAL_ENTRY_ACCESS_DENIED'; END IF;
 IF p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 1 AND 200 OR p_date IS NULL
 OR p_course IS NULL OR (p_seed_time_ms IS NOT NULL AND p_seed_time_ms<=0)
 OR (p_heat IS NOT NULL AND p_heat<=0) OR (p_lane IS NOT NULL AND p_lane NOT BETWEEN 0 AND 9)
 OR length(coalesce(p_venue,''))>200 OR length(coalesce(p_city,''))>200
 THEN RAISE EXCEPTION 'INVALID_MANUAL_ENTRY'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.events WHERE id=p_event_id AND active) THEN RAISE EXCEPTION 'EVENT_NOT_FOUND'; END IF;
 INSERT INTO public.meets(name,start_date,course,venue,city,status)
 VALUES(trim(p_name),p_date,p_course,nullif(trim(p_venue),''),nullif(trim(p_city),''),'scheduled') RETURNING id INTO meet;
 INSERT INTO public.manual_meet_entries(meet_id,athlete_id,event_id,seed_time_ms,heat,lane,created_by)
 VALUES(meet,p_athlete_id,p_event_id,p_seed_time_ms,p_heat,p_lane,auth.uid()) RETURNING id INTO entry;
 INSERT INTO public.audit_log(account_id,athlete_id,user_id,entity_type,entity_id,action,source,new_data)
 SELECT account_id,p_athlete_id,auth.uid(),'manual_meet_entry',entry,'insert','manual',
  jsonb_build_object('meet_id',meet,'entry_origin','manual','seed_time_ms',p_seed_time_ms,'heat',p_heat,'lane',p_lane)
 FROM public.athletes WHERE id=p_athlete_id;
 RETURN jsonb_build_object('meet_id',meet,'entry_id',entry,'entry_origin','manual');
END $$;
REVOKE ALL ON FUNCTION public.create_manual_meet_entry(uuid,uuid,text,date,public.swim_course,text,text,integer,integer,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.create_manual_meet_entry(uuid,uuid,text,date,public.swim_course,text,text,integer,integer,integer) TO authenticated;
COMMIT;
