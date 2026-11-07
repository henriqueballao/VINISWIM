-- Candidate NOT APPLIED. Existing view columns retain their names/order;
-- new official race descriptors are appended for exact UI association.
BEGIN;
CREATE OR REPLACE VIEW public.v_result_timeline WITH(security_invoker=true) AS
SELECT r.id,r.athlete_id,r.meet_id,r.event_id,r.result_date,r.course,r.time_ms,r.status,r.origin,r.is_official,r.notes,r.created_at,
 row_number() OVER(PARTITION BY r.athlete_id ORDER BY r.result_date,r.created_at,r.id) AS chronological_number,
 r.source_id,r.external_id,coalesce(r.venue,m.venue) AS venue,coalesce(r.city,m.city) AS city,
 coalesce(r.category,CASE extract(year FROM r.result_date)::integer-extract(year FROM a.birth_date)::integer
  WHEN 9 THEN 'Mirim I' WHEN 10 THEN 'Mirim II' WHEN 11 THEN 'Petiz I' WHEN 12 THEN 'Petiz II'
  WHEN 13 THEN 'Infantil I' WHEN 14 THEN 'Infantil II' WHEN 15 THEN 'Juvenil I' WHEN 16 THEN 'Juvenil II'
  WHEN 17 THEN 'Júnior I' WHEN 18 THEN 'Júnior II' WHEN 19 THEN 'Sênior' WHEN 20 THEN 'Sênior'
  ELSE CASE WHEN extract(year FROM r.result_date)::integer-extract(year FROM a.birth_date)::integer>=25 THEN 'Master' ELSE a.category END END) AS category,
 r.updated_at,m.name AS meet_name,r.official_event_number,r.official_round,r.official_sex,r.official_identity_key
FROM public.results r LEFT JOIN public.meets m ON m.id=r.meet_id LEFT JOIN public.athletes a ON a.id=r.athlete_id;
GRANT SELECT ON public.v_result_timeline TO authenticated;
COMMIT;
