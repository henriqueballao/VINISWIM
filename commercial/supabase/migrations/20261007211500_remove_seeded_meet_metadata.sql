delete from public.meet_metadata_evidence;
alter table public.meet_metadata_evidence alter column evidence_kind set default 'auto_official_page';
