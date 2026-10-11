# Correções candidatas após parecer ea19d91

Data: 2026-10-11. Branch `fix/official-import-audit-20261011`, PR #17 draft. Base desta execução: parecer `independent-technical-assessment-01a5fb9.md`, commit ea19d91. Implementação examinada: **ce3e097df2a33bbb8b4dd24c96219eade10079aa**.

**REPROVADO: os 12 gates operacionais permanecem reprovados.** Os dois bloqueios críticos foram corrigidos e verificados na candidata isolada. Isso não constitui homologação independente, importação no Supabase ativo, funcionamento da interface publicada ou recuperação após reinício. Não houve escrita em produção nesta execução, merge, deploy, limpeza ou fusão de atletas. Auditoria e evidências são commitadas separadamente do código.

## R2 — compatibilidade do upsert legado

Commit 918b5993 preserva integralmente `meet_entries`, seu índice único completo `(meet_id, athlete_id, event_id)` e suas constraints. A proposta anterior de índice parcial foi retirada. O escritor vigente continua usando o mesmo `ON CONFLICT` de três colunas. Balizamentos atestados ficam na entidade adicional `official_meet_entries`, com identidade completa da corrida, evidências e unicidade própria; não são projetados por escrita manual na tabela legada.

Arquivos em `commercial/supabase/proposals/`: `official-event-integrity.sql`, `official-entry-read-model.sql`, `official-batch-transaction.sql` e `official-legacy-writer-fence.sql`. O modelo de leitura `v_meet_entry_timeline` usa `security_invoker`, preserva RLS por conta e reúne as duas entidades sem duplicar na apresentação a entrada legada quando existe entrada atestada correspondente. Cada corrida oficial permanece distinta. A candidata React em `commercial/apps/web/src/App.tsx` consulta essa view; ela não está publicada.

Os contratos SQL verificam índice e constraints legados inalterados, upserts repetidos em duas contas, conservação das corridas oficiais, ausência de duplicação na leitura, autorização seletiva de campeonatos com apenas balizamento, restrição de escrita do navegador e isolamento entre contas. A evidência da entrada aponta para a nova entidade, sem cascade que apague procedência.

## R1 — diagnóstico SQL e retentativas

Commits e3b112f7, b4e84963 e ce3e097d. `commercial/packages/official-worker/src/rpc-errors.mjs` conserva nome da RPC, SQLSTATE, mensagem, details, hint, HTTP status e causa original. A transação e o runner usam esse erro estruturado; o encerramento grava diagnóstico limitado em `failure_details` do job, com ACL de serviço. As propostas de leases e outcomes contêm a persistência e o contrato adicional de diagnóstico; não estão instaladas.

Negação de acesso, identidade não verificada, validação inválida e contrato SQL incompatível são definitivos. Lease obsoleto não encerra o job de outro worker. Serialization/deadlock/lock e indisponibilidade reconhecida seguem backoff. Somente resposta de commit incerta por transporte autoriza uma repetição imediata, limitada a uma, com payload idêntico e recibo idempotente. Negação sem SQLSTATE continua definitiva mesmo acompanhada de HTTP 503. Erro desconhecido de banco não vira automaticamente retry.

O primeiro CI após e3b112f7 revelou regressão no erro SDK com apenas `code`: a mensagem perdeu o diagnóstico. b4e84963 corrigiu o código, preservando o teste. ce3e097d acrescentou a proteção para negação sem SQLSTATE em gateway indisponível. Não foram retiradas assertions para produzir aprovação.

Os dois scripts adversariais originais permanecem byte a byte iguais desde 2b45a7b: `repros/transaction-error-propagation.test.mjs` (blob 8d6de4383f295ab623064bd4dd5fd758d73e3634) e `repros/legacy-entry-upsert.sql` (blob fab566f4a6e190e555e147ced4c4c2ecaeaf4f90). Ambos falhavam no run 38172476437; ambos passam no run atual 38181053112.

## Verificações executadas e limites

Detalhes estruturados, SHAs, contagens e pares de reimportação: [corrections-after-ea19d91-evidence.json](corrections-after-ea19d91-evidence.json).

| Execução GitHub Actions | Commit | Resultado e alcance |
| --- | --- | --- |
| [38180969836](https://github.com/henriqueballao/VINISWIM/actions/runs/38180969836) | 7d117949 | PostgreSQL isolado: transação, concorrência, lease/cancelamento, RLS e replay de originais com todos os campos de balizamento; passou |
| [38181053112](https://github.com/henriqueballao/VINISWIM/actions/runs/38181053112) | ce3e097d | Os dois contratos adversariais originais; passou |
| [38181053087](https://github.com/henriqueballao/VINISWIM/actions/runs/38181053087) | ce3e097d | 22 testes do worker, build Node e check Deno frozen, originais e consulta pública somente leitura; passou |
| [38181053083](https://github.com/henriqueballao/VINISWIM/actions/runs/38181053083) | ce3e097d | Hashes, excertos e replay de documentos originais arquivados; passou |
| [38181057333](https://github.com/henriqueballao/VINISWIM/actions/runs/38181057333) | ce3e097d | Build e navegador desktop/mobile com backend sintético; passou |
| [38181057458](https://github.com/henriqueballao/VINISWIM/actions/runs/38181057458) | ce3e097d | Regressão import-v2; passou |

Verificações locais: `node --test src/*.test.mjs` no pacote import-v2 (22 arquivos), testes de domínio UI com `--experimental-strip-types` (5 arquivos), rpc-errors (5 casos), repro adversarial RPC (3 casos) e `node scripts/test-official-worker-replay.mjs /workspace/live-documents`. Build completo e PostgreSQL ocorreram no Actions porque este workspace não tinha todas as dependências nem acesso funcional ao registry/Docker. Os logs do Actions foram lidos, não inferidos apenas do selo verde.

O espelho SQL inclui 12 tabelas centrais, 153 colunas, 57 constraints, 17 policies e oito triggers capturados. Auth e dependências periféricas ainda têm stubs; não equivale a um clone integral do projeto Supabase. O último SQL run é 7d117949; a mudança posterior ce3e097d altera a classificação JS de erro, coberta pelo run do worker, não é novo run do PostgreSQL.

O replay usa bytes oficiais preservados e hash verificado, HTTP substituído pelos arquivos arquivados, contas de teste e banco descartável. Não usa fixtures sintéticas como resultado esportivo nem escreve no Supabase ativo. Cinco pares atleta/competição produziram Vini 4+5, Lorenzo 5+6 e André 6 resultados e balizamentos correspondentes; a segunda execução de cada par inseriu zero e atualizou zero entradas. Foram comparados número/rodada/sexo/data/piscina/prova, tempo de inscrição, série, raia e horário persistidos com os originais extraídos por JS e Poppler. São extratores diferentes, não uma homologação humana independente. André não foi localizado na competição de outubro; não foi preenchido por inferência. DNS histórico permanece sem tempo. Isso demonstra idempotência isolada, não importação ao vivo ou histórico completo.

## Produção consultada, sem alteração

Supabase `cdtvhagbgiwnjkgninqn`, leitura às **22:39:20 UTC**: 252 resultados, 82 melhores marcas, zero `meet_entries`, 252 fontes e zero hashes de procedência. `official_meet_entries` e a RPC candidata de persistência estão ausentes. As Edge publicadas continuam `monitor-runner` v115 e `import-v2-runner` v30; `official-import-runner` não está publicada. Os dados são legados e não provam execução da candidata. Origem informada como monitor não exclui por si só intervenção privilegiada externa.

A auditoria anterior mapeou `/` legado e `/app/` React em GitHub Pages; commits nesta branch não alteram os bytes publicados. Railway V41 mantém estado de monitor em `DATA_DIR/state.json`; não demonstramos persistência desse arquivo após reinício e não o tratamos como banco de resultados. Supabase continua a persistência esportiva. Consumidores Railway conhecidos não foram removidos.

## Migração e reversão propostas

Todas as novas alterações SQL continuam em `proposals`, não aplicadas. A estratégia é aditiva: criar a entidade atestada, instalar leitura/RLS, contratos de job/diagnóstico e persistência/guards em ordem de dependências, validar compatibilidade antes da ativação coordenada do worker/UI. Não há backfill manual, mudança do índice legado, exclusão de dados ou migração de identidades entre contas.

Em reversão operacional, pausar agendamento/worker candidato antes de restaurar a UI anteriormente validada; cancelar requests v3 somente pelo contrato autorizado. Conservar entidades, resultados, evidências e logs. Não remover tabelas populadas, restaurar backups no ativo ou reabrir escrita legada nos atletas protegidos. A subscription pausada continua bloqueando sobrescrita legada de resultados; isso foi testado, assim como o escritor legado de outras contas. Esta é uma estratégia ainda sujeita a revisão/ensaio, não prova de rollback ou restart de produção. As três migrations de segurança previamente aplicadas não são reaplicadas.

## Pendências conservadas

R3 está parcialmente corrigido: a nova entidade oficial exige contexto de job válido, e pausar subscription não remove a proteção de resultados. Ainda faltam isolamento completo das alterações em metadados compartilhados de meets/caches e retirada coordenada de escritores antigos. R4 permanece: o modal manual escreve diretamente em `meet_entries`, negado pela RLS publicada, e a nomenclatura de balizamento requer correção. Demais fontes, histórico completo, reconciliação e operação automática não estão homologados. Nenhuma dessas limitações é resolvida pela separação das entidades.

## Matriz dos 12 gates — todos REPROVADOS

A numeração abaixo acompanha os doze requisitos de aceitação da missão; as provas parciais não aprovam o conjunto operacional.

| Gate | Status | Motivo atual |
| --- | --- | --- |
| 1. Pipeline de produção identificado e documentado | REPROVADO | Mapa documentado, mas cadeia consolidada publicada e consumidores ainda não homologados |
| 2. Código morto removido/isolado com justificativa | REPROVADO | Consumidores legados permanecem; aposentadoria coordenada pendente |
| 3. Importações reais sem escrita manual | REPROVADO | Candidata não instalada; replay isolado não é importação operacional |
| 4. Vini, Lorenzo e André pela fonte oficial | REPROVADO | Documentos capturados/replay dos três; importação corrigida ativa ausente |
| 5. Resultados comparados às publicações | REPROVADO | Comparação isolada e amostra histórica, não validação completa de produção |
| 6. Balizamentos completos e corretos | REPROVADO | Comparação campo a campo passou isoladamente; produção tem zero entradas |
| 7. Fonte, horário e evidência no banco | REPROVADO | Banco ativo tem zero hashes; novas entidades/atestação não instaladas |
| 8. Segunda importação idempotente | REPROVADO | Cinco pares isolados sem novos inserts; sem segunda execução em produção |
| 9. UI publicada fiel ao banco | REPROVADO | Preview sintético passou; UI publicada não contém a candidata |
| 10. Monitor reconhece novas publicações | REPROVADO | Documentos novos capturados, mas fluxo automático ativo corrigido não comprovado |
| 11. Bloqueios de fonte não ocultados | REPROVADO | Classificação candidata passou; runners publicados ainda legados |
| 12. Integridade após reinício e deploy | REPROVADO | Não ocorreu reinício/deploy autorizado desta etapa nem validação de recuperação |

Próxima revisão deve confrontar estes commits e os logs, preservar ambos os repros e avaliar as pendências sem autorizar merge/deploy por testes isolados. A proibição de publicar uma solução incompleta foi respeitada.
