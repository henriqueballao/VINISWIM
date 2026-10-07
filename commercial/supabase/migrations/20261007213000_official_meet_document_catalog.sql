create table if not exists public.official_meet_document_catalog (
  external_id text primary key,
  sample_text text not null,
  source_url text not null,
  refreshed_at timestamptz not null default now()
);

create or replace function public.refresh_official_meet_document_catalog()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_count integer;
begin
  insert into public.official_meet_document_catalog(external_id,sample_text,source_url,refreshed_at)
  select distinct on (substring(d.url from '/meet-documents/([0-9a-f-]{36})/'))
    substring(d.url from '/meet-documents/([0-9a-f-]{36})/'),
    left(d.text_content,3500),
    d.url,
    now()
  from public.historical_document_text_cache d
  where d.fetch_status='ok'
    and d.text_content is not null
    and d.url ~ '/meet-documents/[0-9a-f-]{36}/'
    and d.text_content ~* '(SCM|LCM)\s*\((25|50)m\)'
    and d.text_content ~ '\d{1,2}(\s*-\s*\d{1,2})?/\d{1,2}/\d{4}'
  order by substring(d.url from '/meet-documents/([0-9a-f-]{36})/'),
           case when d.text_content ilike '%Resultados por Clube (Detalhado)%' then 0 else 1 end,
           length(d.text_content)
  on conflict(external_id) do update
  set sample_text=excluded.sample_text,
      source_url=excluded.source_url,
      refreshed_at=excluded.refreshed_at;

  get diagnostics v_count = row_count;
  return v_count;
end
$$;

revoke all on function public.refresh_official_meet_document_catalog() from public,anon,authenticated;
grant execute on function public.refresh_official_meet_document_catalog() to service_role;

select public.refresh_official_meet_document_catalog();
