-- Determine historical competition category only from athlete DOB or
-- independently cached official evidence of source name, registration and birth year.
-- No manual result INSERT; preserve times and meet provenance.
create or replace function public.verified_official_birth_year(p_athlete_id uuid)
returns integer
language sql stable security definer set search_path = ''
as $$
 with identifier as (
  select c.external_id,
         regexp_replace(btrim(c.external_name),'[[:space:]]+','[[:space:]]+','g') as name_pattern
  from public.athlete_source_configs c
  join public.sources s on s.id=c.source_id
  where c.athlete_id=p_athlete_id
    and c.active and s.active and s.code='swimsystem'
    and c.external_id ~ '^[0-9]{5,8}$'
    and c.external_name ~ '^[[:alpha:] ]{5,100}$'
  limit 1
 ), supported_years as (
  select m[1]::integer as yr,count(distinct d.url) as documents
  from identifier i
  join public.historical_document_text_cache d
   on d.fetch_status='ok'
   and d.url ~ '^https://swimsystem[.]swimtimebrasil[.]com/[0-9]+/ResultList_[0-9]+[.]pdf$'
   and d.text_content like '%'||i.external_id||'%'
  cross join lateral regexp_matches(
   d.text_content,
   '(?i)(?:^|[^[:alpha:]])'||i.name_pattern||'[[:space:]]+'||i.external_id||
   '[[:space:]]+((?:19|20)[0-9]{2})(?:[^0-9]|$)','g'
  ) m
  group by m[1]
  having count(distinct d.url)>=2
 )
 select case when count(*)=1 then max(yr) else null end
 from supported_years
$$;
revoke all on function public.verified_official_birth_year(uuid) from public, anon, authenticated;
grant execute on function public.verified_official_birth_year(uuid) to postgres, service_role;

-- Repair only official categories when at least two documents confirm birth year.
-- Never insert results, change times, or modify an athlete's birth_date.
with identified as (
 select a.id, public.verified_official_birth_year(a.id) as birth_year
 from public.athletes a
 where a.active and a.birth_date is null
), derived as (
 select r.id,
  case extract(year from r.result_date)::integer-i.birth_year
   when 9 then 'Mirim I'
   when 10 then 'Mirim II'
   when 11 then 'Petiz I'
   when 12 then 'Petiz II'
   when 13 then 'Infantil I'
   when 14 then 'Infantil II'
   when 15 then 'Juvenil I'
   when 16 then 'Juvenil II'
   when 17 then 'Júnior I'
   when 18 then 'Júnior II'
   when 19 then 'Sênior'
   when 20 then 'Sênior'
   else null
  end as correct_category
 from public.results r join identified i on i.id=r.athlete_id
 where r.is_official=true and i.birth_year is not null
)
update public.results r
 set category=d.correct_category
from derived d
where r.id=d.id and d.correct_category is not null
 and r.category is distinct from d.correct_category;
