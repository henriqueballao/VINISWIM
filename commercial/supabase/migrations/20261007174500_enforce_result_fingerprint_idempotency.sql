create unique index if not exists results_fingerprint_uidx
on public.results(result_fingerprint)
where result_fingerprint is not null;
