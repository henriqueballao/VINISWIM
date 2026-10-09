-- Restore FDAP/SwimSystem legacy ResultList archives from verified meet metadata.
-- Only registered meets with a confirmed course and existing cached official PDFs.
-- Never creates athlete results or guesses times.
insert into public.historical_archives
 (source_id,provider,event_key,name,base_url,start_date,course,active,updated_at)
select m.source_id,'swimsystem',m.external_id,m.name,
 'https://swimsystem.swimtimebrasil.com/'||m.external_id||'/',
 m.start_date,m.course,true,now()
from public.meets m
join public.sources s on s.id=m.source_id
where s.code='fdap'
 and m.course in ('SCM','LCM')
 and m.external_id ~ '^[0-9]{4,8}$'
 and exists(
   select 1 from public.historical_document_text_cache d
   where d.fetch_status='ok'
     and d.url like 'https://swimsystem.swimtimebrasil.com/'||m.external_id||'/ResultList_%.pdf'
 )
on conflict(source_id,event_key) do update
 set provider='swimsystem',
     course=excluded.course,
     start_date=excluded.start_date,
     name=excluded.name,
     active=true,
     updated_at=now();
