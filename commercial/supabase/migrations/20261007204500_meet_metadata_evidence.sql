create table if not exists public.meet_metadata_evidence (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id) on delete cascade,
  external_id text not null,
  canonical_name text,
  venue text,
  city text,
  evidence_url text not null,
  evidence_kind text not null default 'auto_official_page',
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_id,external_id)
);

alter table public.meet_metadata_evidence enable row level security;
