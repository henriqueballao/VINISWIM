create table if not exists public.meet_metadata_evidence (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id) on delete cascade,
  external_id text not null,
  canonical_name text,
  venue text,
  city text,
  evidence_url text not null,
  evidence_kind text not null default 'official_event_page',
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_id,external_id)
);
alter table public.meet_metadata_evidence enable row level security;

insert into public.meet_metadata_evidence(source_id,external_id,canonical_name,venue,city,evidence_url,evidence_kind)
select s.id,v.external_id,v.canonical_name,v.venue,v.city,v.evidence_url,'official_event_page'
from public.sources s
join (values
 ('39519','Torneio Regional da 1ª Região (Pré-Mirim/Petiz)','Clube Curitibano','Curitiba','https://ccnatacao.com.br/eventos/lista/?eventDisplay=past&tribe-bar-date=2025-05-31'),
 ('39523','Troféu Ossami Fukuda 2025','Santa Mônica Clube de Campo','Colombo','https://ccnatacao.com.br/eventos/categoria/petiz/lista/?eventDisplay=past'),
 ('39532','Torneio Regional da 1ª Região (Pré-Mirim/Petiz)','Clube Curitibano','Curitiba','https://ccnatacao.com.br/evento/torneio-regional-pre-mirim-a-petiz-5/'),
 ('39533','Troféu Germano Bayer 2025','Clube Curitibano','Curitiba','https://ccnatacao.com.br/evento/campeonato-paranaense-de-verao-pre-mirim-a-petiz/'),
 ('40366','Campeonato Sul-Brasileiro Mirim & Petiz 2025','Clube Curitibano','Curitiba','https://ccnatacao.com.br/evento/campeonato-sul-brasileiro-mirim-e-petiz-2/'),
 ('40595','Torneio Regional da 1ª Região 2026','Clube Curitibano','Curitiba','https://www.swimsystem.app/meets/sw/41937212-ddd8-4561-a182-4c062911d722'),
 ('40602','Campeonato Paranaense de Inverno 2026','Santa Mônica Clube de Campo','Colombo','https://ccnatacao.com.br/evento/paranaense-de-inverno-mirim-petiz-2026/')
) as v(external_id,canonical_name,venue,city,evidence_url)
  on s.code='fdap'
on conflict(source_id,external_id) do update
set canonical_name=excluded.canonical_name,venue=excluded.venue,city=excluded.city,evidence_url=excluded.evidence_url,evidence_kind=excluded.evidence_kind,verified_at=now(),updated_at=now();

insert into public.meet_metadata_evidence(source_id,external_id,canonical_name,venue,city,evidence_url,evidence_kind)
select s.id,v.external_id,v.canonical_name,v.venue,v.city,v.evidence_url,'official_swimsystem'
from public.sources s
join (values
 ('13a41f8d-fbce-4d6d-8b06-01c9d5f866f4','Torneio Regional da 1ª Região (Pré-Mirim/Petiz)','Clube Curitibano','Curitiba','https://www.swimsystem.app/meets/sw/13a41f8d-fbce-4d6d-8b06-01c9d5f866f4'),
 ('9b002997-591e-4f74-8492-ef595b4705c0','Campeonato Paranaense de Verão (Mirim/Petiz)','Santa Mônica Clube de Campo','Colombo','https://www.swimsystem.app/meets/sw/9b002997-591e-4f74-8492-ef595b4705c0')
) as v(external_id,canonical_name,venue,city,evidence_url)
  on s.code='swimsystem'
on conflict(source_id,external_id) do update
set canonical_name=excluded.canonical_name,venue=excluded.venue,city=excluded.city,evidence_url=excluded.evidence_url,evidence_kind=excluded.evidence_kind,verified_at=now(),updated_at=now();
