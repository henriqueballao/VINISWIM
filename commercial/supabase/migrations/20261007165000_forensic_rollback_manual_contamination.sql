-- One-time forensic rollback of the assistant's unauthorized 2026-10-07 manual updates.
-- Restores the five real result rows from audit_log snapshots immediately preceding audit ids 569-573,
-- and restores the canonical meet metadata to its pre-manual snapshot. The production V2 pipeline must
-- then re-derive the correct state from official documents.

with snapshots as (
  select
    entity_id,
    old_data
  from public.audit_log
  where id in (569,570,571,572,573)
    and entity_type='result'
    and action='update'
)
update public.results r
set
  meet_id=(s.old_data->>'meet_id')::uuid,
  result_date=(s.old_data->>'result_date')::date,
  course=(s.old_data->>'course')::public.swim_course,
  time_ms=nullif(s.old_data->>'time_ms','')::integer,
  status=(s.old_data->>'status')::public.result_status,
  result_fingerprint=s.old_data->>'result_fingerprint',
  updated_at=now()
from snapshots s
where r.id=s.entity_id;

update public.meets
set
  name='Resultados · Campeonato Paranaense de Verão (Mirim/Petiz)',
  start_date='2026-09-18'::date,
  end_date=null,
  course='SCM'::public.swim_course,
  updated_at=now()
where id='70db3b44-29ef-4360-ac7f-7f308703d5c5'::uuid;
