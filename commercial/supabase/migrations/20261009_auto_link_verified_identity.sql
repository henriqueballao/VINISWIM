-- Auto-link source identity from multiple independent official result PDFs.
-- Never inserts any results. Only fills an empty SwimSystem athlete identity.
create or replace function public.auto_link_verified_swimsystem_identity(p_athlete_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
 v_athlete record;
 v_config record;
 v_parts text[];
 v_first text;
 v_last text;
 v_pattern text;
 v_candidates integer;
 v_registration text;
 v_year integer;
 v_official_name text;
 v_docs integer;
begin
 select full_name,birth_date into v_athlete
 from public.athletes where id=p_athlete_id and active=true;
 if not found then return jsonb_build_object('linked',false,'reason','athlete_not_found'); end if;
 select c.id,c.external_id,c.external_name into v_config
 from public.athlete_source_configs c
 join public.sources s on s.id=c.source_id
 where c.athlete_id=p_athlete_id and c.active and s.active and s.code='swimsystem'
 limit 1;
 if not found then return jsonb_build_object('linked',false,'reason','source_not_registered'); end if;
 if nullif(btrim(v_config.external_id),'') is not null then
  return jsonb_build_object('linked',false,'reason','already_identified');
 end if;
 v_parts:=regexp_split_to_array(btrim(regexp_replace(lower(v_athlete.full_name),'[^[:alpha:] ]',' ','g')),'[[:space:]]+');
 if coalesce(array_length(v_parts,1),0)<2 then return jsonb_build_object('linked',false,'reason','name_incomplete'); end if;
 v_first:=v_parts[1];
 v_last:=v_parts[array_length(v_parts,1)];
 if length(v_first)<3 or length(v_last)<3 then return jsonb_build_object('linked',false,'reason','name_incomplete'); end if;
 v_pattern:='(?i)(?:^|[^[:alpha:]])('||v_first||'(?:[[:space:]]+[[:alpha:]]+){0,3}[[:space:]]+'||v_last||')[[:space:]]+([0-9]{5,8})[[:space:]]+((?:19|20)[0-9]{2})[[:space:]]+([[:alpha:] /.-]{2,50})';
 with matches as (
  select m[2] as registration,m[3]::int as birth_year,
         min(initcap(m[1])) as official_name,
         count(distinct d.url)::integer as docs
  from public.historical_document_text_cache d
  cross join lateral regexp_matches(d.text_content,v_pattern,'g') m
  where d.fetch_status='ok'
    and d.url ~ '^https://swimsystem[.]swimtimebrasil[.]com/[0-9]+/ResultList_[0-9]+[.]pdf$'
    and d.text_content ilike '%'||v_first||'%'
    and d.text_content ilike '%'||v_last||'%'
    and (v_athlete.birth_date is null or m[3]::int=extract(year from v_athlete.birth_date)::int)
  group by m[2],m[3]
  having count(distinct d.url)>=2
 )
 select count(*), min(registration),min(birth_year),min(official_name),max(docs)
 into v_candidates,v_registration,v_year,v_official_name,v_docs
 from matches;
 if v_candidates<>1 then
  return jsonb_build_object('linked',false,'reason',case when v_candidates=0 then 'no_verified_candidate' else 'ambiguous_identity' end,'candidate_count',v_candidates);
 end if;
 update public.athlete_source_configs
 set external_id=v_registration,
     external_name=v_official_name,
     updated_at=now()
 where id=v_config.id and nullif(btrim(external_id),'') is null;
 if not found then return jsonb_build_object('linked',false,'reason','changed_concurrently'); end if;
 return jsonb_build_object('linked',true,'source','swimsystem','external_id',v_registration,'document_count',v_docs);
end;
$$;
revoke all on function public.auto_link_verified_swimsystem_identity(uuid) from public,anon,authenticated;
grant execute on function public.auto_link_verified_swimsystem_identity(uuid) to service_role;
