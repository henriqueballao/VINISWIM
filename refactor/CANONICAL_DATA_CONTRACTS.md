# Canônico — Contratos de Dados

## AthleteIdentity
- athlete_id
- source_code
- external_id quando a fonte o fornece
- canonical_name
- aliases[]
- birth_date
- club quando disponível

## MeetCandidate
- source_code
- external_meet_id
- name
- start_date
- end_date
- course
- venue
- city
- official_url
- discovery_evidence

Sem data ou piscina quando obrigatórias: candidato inválido, não completar por inferência.

## OfficialDocument
- source_code
- external_meet_id
- document_type
- url
- retrieved_at
- content_hash
- raw_text/raw_payload
- fetch_strategy

## ResultCandidate
- athlete identity usada
- external_meet_id
- event
- result_date
- course
- time_ms ou status
- source_url
- source_row/source_block
- parser_version
- retrieved_at

Regra: atleta + prova + tempo/status + data + piscina devem vir da mesma evidência oficial ou de metadados canônicos do mesmo documento/competição.

## ValidationResult
- accepted boolean
- errors[]
- warnings[]
- normalized_candidate

## PersistResult
- inserted[]
- promoted[]
- duplicates[]
- rejected[]
- provenance[]

Persistência deve ser idempotente e transacional por unidade lógica.
