create unique index if not exists results_result_fingerprint_uq
on public.results(result_fingerprint)
where result_fingerprint is not null;
