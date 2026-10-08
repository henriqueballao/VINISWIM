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


## MeetMetadataEvidence
- source_code/source_id
- external_meet_id
- canonical_name
- venue
- city
- evidence_url
- evidence_kind
- verified_at

Regras:
- `canonical_name` e `venue` devem vir de evidência oficial descoberta pelo pipeline; não podem ser semeados por competição para satisfazer teste;
- `venue` é o local/clube da competição; `city` é campo distinto e nunca substitui `venue` na UI quando o rótulo é "Local";
- títulos de navegação como `Resultados ·`, `Provas ·`, `Atletas ·`, `Clubes ·`, `Inscrições ·` e `Informações ·` não fazem parte do nome canônico;
- para espelhos legado -> moderno, o vínculo deve ser reproduzível por atributos genéricos da competição, como data, piscina e similaridade normalizada de nome.

## ManualResult
- athlete_id
- meet_id/event_id
- result_date
- course
- time_ms ou status
- venue/city/category quando disponíveis
- origin = manual
- is_official = false
- trace/provenance da operação manual

Resultado manual explicitamente autorizado pelo usuário não pertence ao contrato de descoberta automática e não pode ser usado para satisfazer gates do Import V2.
