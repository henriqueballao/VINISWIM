# Continuação após limpeza: inscrição manual e metadados oficiais

2026-10-12. Branch fix/official-import-audit-20261011, PR #17 draft. Implementação até **4b64896d53a21465f56b77d2d0791f8b823627c8**. Status: **12 gates REPROVADOS**, sem merge/deploy. Esta etapa fez somente leitura de produção; não repôs resultados, balizamentos ou melhores marcas.

## Produção preservada vazia

Consulta Supabase às 01:20:45 UTC: results=0, meet_entries=0, personal_bests=0, result_sources=0. Cinco holds de limpeza preservados e zero crons de importação antigos ativos. A limpeza autorizada já consta no commit 17bc962 e em docs/audit/2026-10-11/authorized-legacy-cleanup.md. Os 252 registros não foram restaurados. A futura importação de um atleta escolhido pelo proprietário, sem informar ao desenvolvedor, ainda depende de homologação operacional; não está comprovada por esta etapa.

## R4 corrigido na candidata

A UI anterior tentava dois INSERTs do navegador (meets e meet_entries), sem policies que autorizassem a gravação, com possibilidade de operação parcial se fossem liberalizadas. Também chamava tempo de inscrição de “Balizamento”.

A proposta manual-meet-entry.sql cria manual_meet_entries separada de meet_entries e official_meet_entries. A RPC create_manual_meet_entry autentica auth.uid, verifica membership ativa e papel owner/admin/guardian, bloqueia identidade/membership contra revogação concorrente, valida prova e valores e cria campeonato+inscrição+auditoria numa transação. Não recebe fonte, URL oficial, status oficial ou resultado nadado como argumentos. A conta é derivada do atleta, não aceita do cliente. Escrita direta e chamada anon/service_role estão revogadas; leitura usa RLS. O campeonato manual é novo, sem identidade de fonte oficial.

A view invoker v_meet_entry_timeline mostra a entidade com entry_origin=manual, preservando legados e atestados. Meets recebe policy adicional de leitura vinculada à inscrição manual; policies existentes não foram afrouxadas. O modal chama uma única RPC, mostra “Tempo de inscrição”, conserva formulário após falha, evita clique simultâneo e exibe “Inscrição manual” na lista. Campos inválidos não viram silenciosamente NULL; raia zero é aceita.

Arquivos: commercial/supabase/proposals/manual-meet-entry.sql, official-entry-read-model.sql; commercial/apps/web/src/App.tsx e domain/manual-entry.ts. A proposta de read model passa a depender também da instalação prévia de manual-meet-entry.sql. Nenhum desses novos contratos foi aplicado no ativo.

## R3 — proteção adicional de metadados compartilhados

official-legacy-writer-fence.sql agora protege INSERT/UPDATE/DELETE de meets vinculados a subscription, inclusive pausada, ou a entrada atestada. Alteração exige job official-v3 vigente, lease válido, mesmo source/meet do cursor e request não cancelado/terminal. Identidade do campeonato não pode ser reassociada; exclusão exige limpeza controlada.

official-batch-transaction.sql estabelece o contexto transacional antes do upsert de metadados, mantendo o índice/upsert legado. Campeonatos manuais sem source/external id seguem separados. Essa proteção é candidata e não cobre automaticamente todos os caches ou todos os caminhos históricos: R3 continua parcialmente pendente. Não confundir cron pausado/hold já aplicado com retirada global de todo escritor legado em todas as contas/atletas futuros.

## Testes reais em ambiente isolado

| Execução | SHA | Evidência |
| --- | --- | --- |
| [38190706932](https://github.com/henriqueballao/VINISWIM/actions/runs/38190706932) | c5e45ec8 | PostgreSQL 17: contratos event/lease/transaction, manual RPC autorizado, negação entre contas/viewer, escrita direta negada, RLS de leitura, auditoria, erro posterior ao INSERT de meet sem órfão, fence de metadados com subscription pausada, concorrência/cancelamento e replay dos originais; passou |
| [38190707025](https://github.com/henriqueballao/VINISWIM/actions/runs/38190707025) | c5e45ec8 | Dois repros adversariais originais; passou |
| [38190774929](https://github.com/henriqueballao/VINISWIM/actions/runs/38190774929) | 4b64896d | Testes de domínio, build React e Playwright desktop/mobile: seed inválido não chama RPC, falha mantém modal, retry explícito, raia zero, origem manual visível, nenhuma escrita direta de tabela; passou |
| [38190774909](https://github.com/henriqueballao/VINISWIM/actions/runs/38190774909) | 4b64896d | Regressão import-v2; passou |

Comandos locais: node --experimental-strip-types --test commercial/apps/web/src/domain/*.test.mjs (6 arquivos passaram), node --check commercial/scripts/ui-authenticated-smoke.cjs. O workflow SQL usa psql -v ON_ERROR_STOP=1 contra viniswim_isolated_test, roda scripts/test-isolated-concurrency.mjs e scripts/test-official-pipeline-isolated.mjs; os logs de ambos os jobs finais foram consultados.

Falhas intermediárias conservadas:
- d50dec14, run 38189952046: DELETE do teste de fence não chegava ao trigger porque a fixture service_role não tinha ACL DELETE em meets. Foi acrescentado GRANT DELETE apenas dentro da transação de teste, revertido ao final, para exercitar efetivamente a proteção. A assertion de negação pelo trigger permanece.
- 9b879007, run 38190643967, e c5e45ec8: browser não via “Inscrição manual”. A mock respondia a leitura de entries com a nova linha, mas continuava respondendo a meets somente com o campeonato inicial. 4b64896d corrigiu as respostas sintéticas subsequentes; a assertion de origem visível e as proibições de mutação externa permanecem.

Os mocks interceptam integralmente Supabase, incluindo a RPC manual, e não gravam em produção. Originais arquivados são processados pelo worker e persistidos somente no PostgreSQL descartável: cinco pares atleta/competição repetidos, zero novos inserts na segunda execução, comparação de resultado e todos os campos de balizamento com JS/Poppler. Não é importação ao vivo, navegador publicado, Auth real, teste de atleta surpresa ou recuperação após reinício de produção. O espelho central ainda tem dependências periféricas sintéticas.

## Limites e gates

Os gates 1–12 continuam individualmente REPROVADOS, com os motivos operacionais do relatório corrections-after-ea19d91.md: cadeia publicada consolidada, aposentadoria do legado, importação real dos três, validação dos registros ativos, balizamentos, procedência, idempotência ativa, UI publicada, monitoramento, bloqueios visíveis e recuperação pós-reinício não foram homologados. A diferença é que a produção agora está vazia por limpeza autorizada, não com 252 registros legados.

Permanecem descoberta automática/histórico completo, demais fontes, reconciliação, cobertura dos caches legados e publicação coordenada completa. O botão de busca geral ainda tem dependências legadas; a importação candidata de competição específica não deve ser apresentada como cobertura de qualquer histórico/fonte. A etapa não solicita liberação de uma solução incompleta.

Evidência estruturada: manual-planning-and-shared-meet-evidence.json. Revisão adversarial seguinte deve reproduzir estes contratos, examinar ACL/RLS da RPC manual e o contexto do upsert oficial, sem alterar os repros originais ou desbloquear os holds de produção.
