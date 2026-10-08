# Registro de Decisões — Import V2

## D-001 — Refatorar ao lado do legado
A V2 será construída isoladamente. O motor atual não é a especificação; os canônicos são.

## D-002 — Dry-run antes de escrita
Validação com atletas reais é somente leitura até os gates serem aprovados.

## D-003 — Parser puro
Parsing não persiste e não depende do estado de jobs.

## D-004 — Proveniência obrigatória
Resultado sem fonte oficial e evidência rastreável é rejeitado.

## D-005 — Sem exceções por atleta
Casos reais servem como fixtures/gabaritos, nunca como branches de produção.


## D-006 — Metadados de competição sem seed manual
Nome canônico, local e cidade de competição são derivados de evidência oficial descoberta pelo pipeline. Seeds por competição não podem ser usados para satisfazer descoberta ou testes. `venue` representa o local/clube; `city` permanece campo separado.

## D-007 — Resultado manual é produto, não importação
Quando o usuário pedir explicitamente lançamento/migração manual, o registro pode ser criado com `origin=manual` e `is_official=false`. Esse registro nunca conta como sucesso do importador, nunca é promovido a oficial sem evidência documental e não pode alterar resultados oficiais existentes.

## D-008 — Projeções derivadas usam metadados canônicos
Resultados, Melhores Marcas e demais telas derivadas devem resolver metadados de competição pelo mesmo meet canônico. Campo exibido como "Local" usa `venue`; cidade não é fallback semântico.
