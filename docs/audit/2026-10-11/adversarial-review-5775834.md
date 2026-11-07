# Revisão adversarial do commit 5775834

Data: 11/10/2026. Alvo congelado: `57758343528fe661733aa9bf7e04037fbb87dc42`.
Status: **REPROVADO nos 12 gates; PR #17 continua draft, sem merge/deploy.**

Esta revisão foi executada pelo Codex sobre sua própria candidata, confrontando GitHub, logs Actions e consultas somente de leitura no Supabase. Não constitui nova avaliação por revisor externo independente. Não houve escrita, limpeza, chamada de importador, configuração de cron, migração, deploy ou reinício em produção nesta revisão. Foram acrescentados contratos adversariais em ambiente sintético e este registro documental.

## O que o commit realmente entrega

A API de commits confirmou dois arquivos de documentação alterados, 17 linhas adicionadas e cinco removidas, com parent `0e763b9a840e37f5f9caba0af8b99b3af3d5e482`. Portanto, `5775834` não contém uma nova implementação nem implantação. As declarações sobre código se referem aos commits anteriores da mesma árvore.

A PR estava aberta/draft, não merged, head `5775834` e base `62c1b51`. Foram lidos novamente os arquivos batch.mjs, runner.mjs, official-legacy-writer-fence.sql, official-batch-transaction.sql, App.tsx e o relatório diretamente no GitHub usando o SHA congelado; todos coincidiram com os arquivos locais inspecionados. A revisão original do commit `28212ec` também foi consultada diretamente.

## Achados que impedem integração

### R1 — ALTO: diagnóstico semântico perdido no commit transacional

**Confirmado por execução.** `commercial/packages/official-worker/src/batch.mjs:25` transforma qualquer erro RPC em `Official transaction failed: <SQLSTATE>`, descartando `message`. Os RAISE EXCEPTION da proposta usam `P0001`; com isso, `REQUEST_ACCESS_REVOKED`, `STALE_WORKER_LEASE` e `SOURCE_IDENTITY_NOT_VERIFIED` tornam-se indistinguíveis.

`runner.mjs:23-25` repete todo erro de commit uma vez, mesmo quando se trata de negação determinística. Em `runner.mjs:29-35`, a classificação depende justamente da mensagem descartada. O classificador recebe `unknown/retryable=true`. No cenário de revogação entre a última consulta de contexto e o commit, o banco impede a escrita, mas o worker perde o motivo e tenta reprocessar. Isto não comprova bypass de autorização; comprova diagnóstico incorreto e retentativa indevida.

Há ainda divergência de vocabulário: a transação gera `SOURCE_IDENTITY_NOT_VERIFIED`, mas o mapeamento explícito do runner só considera `SOURCE_IDENTITY_MISSING_OR_AMBIGUOUS`. Preservar a mensagem é necessário, mas não suficiente para completar a classificação.

Contraprova versionada: `repros/transaction-error-propagation.test.mjs`, três assertions de preservação de mensagem. Execução local e Actions falharam pelas mensagens esperadas, sem rede/banco. [Run 38172476437, job 114567794080](https://github.com/henriqueballao/VINISWIM/actions/runs/38172476437/job/114567794080). Correção exigida: erro estruturado com código semântico preservado, mapping completo e replay limitado a falhas de transporte/resposta incerta; manter o recibo SQL para resposta perdida. Não enfraquecer as assertions.

### R2 — ALTO: migração global incompatível com importador legado ativo

**Confirmado em PostgreSQL 17 isolado.** `official-event-integrity.sql:24-29` substitui o índice completo `(meet_id,athlete_id,event_id)` por índices parciais. O caminho legado em `commercial/supabase/functions/import-v2-runner/index.ts:380` continua emitindo upsert com esse conflict target sem predicado. Após a proposta, o PostgreSQL retorna **42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification**.

O índice atual foi reconfirmado no catálogo de produção às 20:29 UTC: ele ainda é completo. O defeito é de compatibilidade da candidata, não uma nova falha causada em produção nesta revisão. O legado também não verifica a resposta SDK desse upsert; manter esse consumidor ao aplicar a migração pode mascarar falhas e afetar contas fora do novo fluxo. Preservar linhas antigas e limitar um trigger por atleta não limita o alcance da alteração de índice.

Contraprova: `repros/legacy-entry-upsert.sql`, executada após a fixture existente e a proposta real; a fixture passa antes de o upsert realista falhar com 42P10. [Run 38172476437, job 114567794356](https://github.com/henriqueballao/VINISWIM/actions/runs/38172476437/job/114567794356). Correção exigida: contrato de escrita compatível para consumidores mantidos, ou cutover comprovado de todos os consumidores antes da alteração. Não restaurar um índice único que volte a colidir corridas oficiais distintas.

### R3 — ALTO: isolamento de escritores legados ainda incompleto

**Confirmado por inspeção; corrupção em runtime não demonstrada.** `official-legacy-writer-fence.sql:34` instala guard apenas em `results`. Não protege `meet_entries`, metadados compartilhados de `meets` nem caches derivadas; depende da existência de subscription ativa (`:14`). O claim legado continua processando `legacy-v2`. Os cron legados seguem ativos em produção.

O relatório reconhece que não houve aposentadoria global; a alegação estreita de proteção de results para inscritos é sustentada pelo teste isolado. Seria incorreto elevar isso à garantia de que nenhum caminho antigo interfere com a cadeia consolidada. R2 já fornece uma falha concreta de coexistência. Antes do cutover, exigir inventário de todos os consumidores e testes de INSERT/UPDATE/DELETE em cada entidade relevante, inclusive após revogação/desativação da subscription.

### R4 — MÉDIO: cadastro manual de campeonato permanece desconectado da autorização

**Confirmado por código e catálogo; não houve tentativa de INSERT em produção.** `App.tsx:144` faz INSERT direto em `meets`, seguido de INSERT em `meet_entries`. As duas tabelas têm RLS e somente policies SELECT para authenticated no catálogo consultado. O formulário não tem caminho autorizado de criação na candidata. O campo `seed_time_ms` ainda recebe o rótulo “Balizamento” (`:145`). O smoke bloqueia mutações e não testa esse fluxo.

Correção exigida: operação autorizada e atômica para campeonato/inscrição manual, com origem clara e tempo de inscrição corretamente rotulado, seguida de teste de escrita sob role authenticated isolada. Não conceder escrita ampla nas tabelas oficiais para fazer o formulário passar.

## Produção mudou desde a captura citada no relatório

A afirmação “zero às 17:56:51 UTC” é uma fotografia histórica, não o estado atual. A redação do relatório e da resposta anterior não deve ser reutilizada como contagem atual.

| Consulta de 20:26–20:29 UTC | Resultado |
|---|---:|
| results | 252 |
| meet_entries | 0 |
| personal_bests | 82 |
| monitor_jobs pending | 8 |
| result_sources com URL | 252 |
| result_sources com raw_hash | 0 |
| persist_official_meet_batch instalado | não |
| official_meet_subscriptions instalada | não |

As 252 linhas são marcadas official/is_official=true. A procedência informa `engine=v2`: 202 registros `resultlist-v2.7` e 50 `swimsystem-modern-results-v1`. Jobs históricos criados às 18:00 registram soma de 252 inserções; a auditoria registra 252 inserts de results, source=monitor, entre 18:10 e 18:31. Essa convergência sustenta atribuição ao pipeline legado, não à candidata. Não comprova por si só a identidade do executor nem exclui qualquer operação privilegiada externa. Não atribuir essas gravações ao novo worker ou aos testes isolados.

Os registros abrangem os três perfis canônicos e perfis em outras contas. Nenhuma fusão/exclusão foi feita. A ausência de grupos duplicados pela chave genérica atleta/meet/prova/data/piscina nesta leitura não prova idempotência em reprocessamento nem identidade por número/rodada/sexo.

A competição crítica `c8587533-2e44-4b08-991f-f827170c7344` existe em meets, mas continua sem resultados ou balizamentos persistidos. Os resultados SwimSystem atuais pertencem a agosto e setembro. Cinco jobs current_meet do lote das 18:00 foram completed com zero registros e sem motivo; outro falhou por identidade ausente. Falhas históricas de identidade aparecem com failure_code=unknown. Portanto, as falhas de observabilidade do worker publicado continuam verificáveis.

Edge segue monitor-runner v115 e import-v2-runner v30, verify_jwt=false; official-import-runner ausente. Continuam ativos runner v2/minuto, enqueuer a cada seis horas, nightly e push dispatcher. A limpeza anterior não permaneceu preservada frente aos escritores ativos. Não apagar os 252 registros nesta revisão: preservar evidência, identificar escopo e decidir limpeza controlada antes de eventual reimportação.

## Evidência positiva mantida, com limites

- Foram relidos os logs completos de [38166665908](https://github.com/henriqueballao/VINISWIM/actions/runs/38166665908): cinco pares atleta/competição, 9/11/6 resultados no total em banco descartável, segunda ingestão inserted=0 e entriesUpdated=0. Originais→extratores→worker→SQL isolado passou. Não são gravações no Supabase ativo.
- [38165004790](https://github.com/henriqueballao/VINISWIM/actions/runs/38165004790) confirma lock frozen, Deno check/replay e consulta pública. CPU de 1147,903 ms no replay Node de dois documentos não mede um job completo na Edge nem seu limite de memória. A candidata retém até 16 documentos, com limite individual de 20 MiB e cópias/base64; adequação aos limites reais ainda não foi comprovada. Trata-se de risco, não de OOM observado.
- [38167462968](https://github.com/henriqueballao/VINISWIM/actions/runs/38167462968) confirma build e navegador sintético desktop/celular, incluindo indisponibilidade/recuperação da leitura de conta. Não usa sessão legítima de produção nem prova o bundle publicado.
- Nesta revisão, foram comparadas tuplas do banco ativo contra a captura oficial arquivada de `9b002997`: Vini 5/5, Lorenzo 6/6, André 6/6 coincidem em prova/data/piscina/tempo/status/URL; DNS de Vini tem tempo NULL. O ZIP original tem SHA-256 `5d359b9f4b954aa178484f22208f2f5d9bd4246906fa4c7976bf2f30da99bb45`. Essa comparação parcial não valida os outros 235 resultados nem vincula os bytes originais à execução legada, que não gravou hashes, nem comprova todos os descritores de corrida.
- Reexecução local dos 22 arquivos import-v2 e cinco arquivos de domínio UI passou nos respectivos diretórios. Os novos contratos adversariais ficaram vermelhos; nenhum assertion foi retirado e nenhum deploy foi acionado. A primeira tentativa local da suíte import-v2 usou cwd errado e falhou por caminhos relativos; a execução no diretório do pacote passou.

## Matriz dos 12 gates

| Gate | Parecer | Motivo atual |
|---|---|---|
| 1 Pipeline completo/domínio | REPROVADO | Mapa anterior documentado; candidata não instalada e publicação da cadeia corrigida não comprovada |
| 2 Código morto isolado | REPROVADO | Consumidores legados ativos; cutover tem incompatibilidade 42P10 |
| 3 Importação oficial sem escrita manual | REPROVADO | Há gravações legadas com rastreabilidade incompleta; não comprovam o pipeline corrigido |
| 4 Três atletas | REPROVADO | Há registros dos três no ativo e comparação histórica parcial; qualidade/completude da cadeia oficial não homologada |
| 5 Banco versus originais | REPROVADO | 17 tuplas históricas coincidem; demais registros e competição crítica não validados |
| 6 Balizamentos completos | REPROVADO | meet_entries permanece zero em produção |
| 7 Procedência persistida | REPROVADO | Nenhum dos 252 result_sources possui raw_hash; captura vinculada à execução não comprovada |
| 8 Reimportação idempotente | REPROVADO | Prova apenas isolada; segunda execução real controlada não realizada |
| 9 UI publicada = banco | REPROVADO | Smoke sintético; sem E2E autenticado do bundle servido nesta revisão |
| 10 Monitor detecta novas publicações | REPROVADO | Subscriptions/worker candidatos ausentes; outubro não ingerido pelo ativo |
| 11 Falhas não ocultadas | REPROVADO | Jobs legados zero/completed e unknown; candidata também perde mensagens RPC |
| 12 Restart/redeploy mantém operação | REPROVADO | Nenhum reinício/redeploy efetivo da cadeia corrigida comprovado |

## Reprodução e continuidade da revisão

Commit de testes: `2b45a7bb8272a476e5263212a7879da9bc784fdd`. [Workflow adversarial 38172476437](https://github.com/henriqueballao/VINISWIM/actions/runs/38172476437) terminou failure nos dois jobs pelos defeitos R1 e R2. Falha do teste é a evidência do contrato não atendido; não é falha de instalação/extractor.

Node: `node --test docs/audit/2026-10-11/repros/transaction-error-propagation.test.mjs`.
SQL: executar `repros/legacy-entry-upsert.sql` somente em PostgreSQL descartável, database `viniswim_isolated_test`, nunca no Supabase ativo. O workflow já provisiona esse banco sem credenciais de produção.

Dados de suporte e horários estão em `adversarial-review-5775834-evidence.json`. As referências de código acima são da árvore congelada 5775834. A documentação anterior fica preservada como relato daquele momento; este relatório a complementa com estado atual e contraprovas. Manter draft, bloqueio de merge/deploy e todos os gates REPROVADOS.
