# Checkpoint pré-/clear — 2026-10-07

## Produção
- Runner Import V2: v22.
- Frontend de Melhores Marcas carrega `results(*,meets(venue,city,name))` e exibe `meet.venue` como Local.
- Commit da correção de fonte: `215670a7ebfc318596d519605ac89bc279d94d14`.
- Build compilado correspondente: `16cf5a4c5df9a306d0a8b0d28d7a1885ec9b3d31`.
- Build comercial e deploy do Pages concluídos com sucesso.

## Metadados de competição
- A semeadura manual de `meet_metadata_evidence` foi removida.
- A tabela foi zerada antes da prova de rediscovery.
- O V2 reconstruiu automaticamente 9/9 competições usadas pelo histórico testado por meio do catálogo/páginas oficiais do SwimSystem.
- `evidence_kind=auto_official_page`.
- Regra vigente: `venue` = local/clube; `city` = cidade separada; cidade não substitui Local.
- Prefixos técnicos de navegação, incluindo `Resultados ·`, não pertencem ao nome canônico.
- Prova FDAP: request `de1c62c6-90b4-41d3-a59d-b70285556e7d` -> 1/1 completed, 0 failed.

## Resultado real
Antes da operação manual autorizada:
- 37 resultados oficiais;
- 0 locais vazios;
- 0 nomes contaminados;
- 0 duplicidades semânticas conhecidas.

Operação manual autorizada explicitamente pelo usuário:
- copiados 4 resultados manuais do perfil secundário para o principal;
- preservados `origin=manual` e `is_official=false`;
- nenhum resultado oficial alterado;
- operação não conta como evidência do Import V2.

Registros:
- `hist35-01`: 100 Livre, 22/03/2025, SCM, 2:11.61;
- `hist35-02`: 200 Livre, 22/03/2025, SCM, 4:36.44;
- `hist35-03`: 50 Costas, 22/03/2025, SCM, 57.52;
- `hist35-04`: 50 Livre, 22/03/2025, SCM, 57.63;
- competição: Torneio Regional da 1ª Região;
- local: Santa Mônica Clube de Campo;
- cidade: Colombo;
- categoria: Mirim 2.

Estado atual do perfil principal:
- 41 resultados;
- 37 oficiais;
- 4 manuais.

## Regras consolidadas
- Nunca semear competição/local/nome para mascarar descoberta.
- Nunca alterar resultado oficial manualmente para fazer gate/tela passar.
- Resultado manual só pode ser criado quando o usuário solicitar explicitamente; deve permanecer manual/não-oficial.
- Resultado manual não prova funcionamento do importador.
- Novo atleta deve funcionar pela mesma pipeline genérica, sem branch ou dado preparado por atleta.
