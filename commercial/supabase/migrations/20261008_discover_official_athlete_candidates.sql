-- VINISWIM — read-only discovery from independently cached official result PDFs.
-- Deployed to VINISWIM Supabase on 2026-10-08.
-- Names must share first and last tokens. A candidate must appear in >= 2 distinct official PDFs.
-- Never links an athlete or inserts results. User confirmation is required in the UI.
create or replace function public.discover_athlete_source_candidates(p_athlete_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
 v_uid uuid := auth.uid();
 v_athlete record;
 v_tokens text[];
 v_first text;
 v_last text;
 v_pattern text;
 v_candidates jsonb;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
 select a.full_name,a.birth_date into v_athlete
 from public.athletes a join public.account_members am on am.account_id=a.account_id
 where a.id=p_athlete_id and a.active=true and am.user_id=v_uid
   and am.status='active' and am.role in ('owner','admin','guardian') limit 1;
 if not found then raise exception 'ATHLETE_ACCESS_DENIED'; end if;
 v_tokens:=regexp_split_to_array(btrim(regexp_replace(lower(v_athlete.full_name),'[^[:alpha:] ]',' ','g')),'[[:space:]]+');
 if array_length(v_tokens,1)<2 then return jsonb_build_object('candidates','[]'::jsonb,'message','Nome completo insuficiente'); end if;
 v_first:=v_tokens[1];
 v_last:=v_tokens[array_length(v_tokens,1)];
 if length(v_first)<3 or length(v_last)<3 then return jsonb_build_object('candidates','[]'::jsonb,'message','Nome insuficiente'); end if;
 v_pattern:='(?i)(?:^|[^[:alpha:]])('||v_first||'(?:[[:space:]]+[[:alpha:]]+){0,3}[[:space:]]+'||v_last||')[[:space:]]+([0-9]{5,8})[[:space:]]+((?:19|20)[0-9]{2})[[:space:]]+([[:alpha:] /.-]{2,50})';
 select coalesce(jsonb_agg(to_jsonb(c) order by c.evidence_count desc,c.external_name),'[]'::jsonb)
 into v_candidates
 from (
  select m[2] as external_id,min(initcap(m[1])) as external_name,
   m[3]::integer as birth_year,count(distinct d.url)::integer as evidence_count,
   min(d.url) as evidence_url
  from public.historical_document_text_cache d
  cross join lateral regexp_matches(d.text_content,v_pattern,'g') as m
  where d.fetch_status='ok'
   and d.url ~ '^https://swimsystem[.]swimtimebrasil[.]com/[0-9]+/ResultList_[0-9]+[.]pdf$'
   and d.text_content ilike '%'||v_first||'%'
   and d.text_content ilike '%'||v_last||'%'
   and (v_athlete.birth_date is null or m[3]::integer=extract(year from v_athlete.birth_date)::integer)
  group by m[2],m[3]
  having count(distinct d.url)>=2
  order by count(distinct d.url) desc,min(m[1])
  limit 8
 ) c;
 return jsonb_build_object('candidates',v_candidates,'source','swimsystem','basis','official_result_documents');
end;
$$;
revoke all on function public.discover_athlete_source_candidates(uuid) from public,anon;
grant execute on function public.discover_athlete_source_candidates(uuid) to authenticated;
