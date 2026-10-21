-- Candidate NOT APPLIED. Serialize the derived best mark for athlete/event/pool
-- when distinct official races are inserted concurrently.
BEGIN;
CREATE OR REPLACE FUNCTION app.refresh_personal_best()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_athlete uuid;
  v_event uuid;
  v_course public.swim_course;
  v_best record;
begin
  v_athlete := coalesce(new.athlete_id, old.athlete_id);
  v_event := coalesce(new.event_id, old.event_id);
  v_course := coalesce(new.course, old.course);

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('personal_best:'||v_athlete::text||':'||v_event::text||':'||v_course::text,0));

  delete from public.personal_bests
  where athlete_id=v_athlete and event_id=v_event and course=v_course;

  select r.id, r.time_ms, r.result_date
    into v_best
  from public.results r
  where r.athlete_id=v_athlete
    and r.event_id=v_event
    and r.course=v_course
    and r.status='valid'
    and r.is_official=true
    and r.time_ms is not null
  order by r.time_ms asc, r.result_date asc, r.created_at asc
  limit 1;

  if v_best.id is not null then
    insert into public.personal_bests(athlete_id,event_id,course,result_id,time_ms,achieved_at)
    values(v_athlete,v_event,v_course,v_best.id,v_best.time_ms,v_best.result_date);
  end if;

  return coalesce(new,old);
end;
$function$;
COMMIT;

