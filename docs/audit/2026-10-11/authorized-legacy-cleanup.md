# Limpeza autorizada de todos os 252 resultados legados

Data: 2026-10-11, projeto Supabase cdtvhagbgiwnjkgninqn. Autorização explícita do proprietário: “Apague tudo”, após informar que 156 resultados estavam na conta principal e 96 em outras duas contas.

Exclusão transacional concluída às 23:02 UTC; verificação às 23:05 UTC: **results=0, meet_entries=0, personal_bests=0, result_sources=0**. Foram removidos os 252 resultados e suas fontes por FK cascade; melhores marcas derivadas foram zeradas. Filas de reconciliação, notificações e tarefas históricas dos cinco perfis também estão vazias. Jobs legados ativos foram cancelados, sem apagar seus logs históricos.

Foram preservados os cinco perfis, 20 configurações de fonte e três identificadores existentes. Usuários/Auth, responsáveis e campeonatos/catálogos compartilhados não foram excluídos. Nenhuma fusão de atletas foi realizada. Os índices legados foram preservados.

Os três crons de importação foram pausados; push-dispatcher permaneceu inalterado. Uma tabela privada de hold protege os cinco perfis; triggers bloqueiam INSERT/UPDATE de resultados e entradas, e novos jobs pendentes/em execução. O bloqueio vale inclusive para escritores service_role antigos e chamadas já iniciadas; não depende somente de pausar cron. O futuro pipeline validado precisará de uma ativação coordenada que retire explicitamente o hold, após homologação. Não há desbloqueio automático.

Teste transacional de tentativa de INSERT de resultado, entrada e job pendente: os três foram rejeitados com LEGACY_IMPORT_PAUSED_AFTER_AUTHORIZED_CLEANUP; nenhuma linha de teste foi persistida. A primeira versão do trigger tinha acesso a NEW.status ausente em meet_entries: a verificação detectou, e a segunda migration corrigiu o contrato antes do resultado final. Registra-se a falha, sem ocultar ou enfraquecer o teste.

Migrations aplicadas: 20261011230114_legacy_cleanup_hold e 20261011230510_legacy_cleanup_hold_record_contract. Os nomes/versionamentos foram obtidos do histórico real do Supabase, e o SQL aplicado fica versionado na branch.

A auditoria de exclusão foi preservada fora das tabelas de resultados usadas pelo aplicativo. O total acumulado de audit_log deletes inclui limpezas anteriores e não é prova da contagem desta transação. Não foi criado backup dos resultados para futura restauração; backups administrados existentes e registros de auditoria não foram destruídos. Não afirmar apagamento físico de backups/PITR. Os resultados antigos não devem ser restaurados no ambiente ativo.

Evidência estruturada: authorized-legacy-cleanup-evidence.json. Não houve deploy do app/worker candidato nem merge. **Todos os 12 gates continuam REPROVADOS.** Esta operação limpa os dados ativos e bloqueia sua reposição; não homologa o produto.
