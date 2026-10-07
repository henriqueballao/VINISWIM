create or replace function public.request_result_refresh(p_athlete_id uuid)
returns jsonb
language plpgsql
security definer
set search_path='public'
as $$
begin
  return public.request_result_refresh(p_athlete_id, null::text[]);
end
$$;
