# Prompt de revisão independente após prova ao vivo isolada

Leia primeiro docs/audit/2026-10-12/global-maintenance-and-native-live-proof.md e a pasta native-live-evidence; depois confronte com os pareceres de 2026-10-11, inclusive independent-technical-assessment-01a5fb9.md. Examine o diff real da PR #17, branch fix/official-import-audit-20261011.

Não aprove produção pelo CI. Distinga: proteção global realmente aplicada (migration 20261012023634), correções candidatas não publicadas, captura ao vivo de fonte pública e persistência somente em Supabase local.

Verifique os quatro PDFs originais por hash, o JSON de execução 38200529145, Auth/REST sem mocks, cadastro que dispara fila, verificação de identidade somente após publicação, cinco resultados/inscrições e segunda ingestão com zero inserções, negação cruzada e comparação após stop/start real. Tente refutar esses critérios no código e banco de teste. Não trate o registro 437084 como o atleta surpresa futuro do proprietário.

Audite concorrência/locks de configuração, igualdade de conta/fonte/job/lease, revisões documentais, cancelamento e recuperação. Confirme que o worker testado em Node não equivale à Edge publicada, que tabelas periféricas são fixtures e que priorizar uma competição/cancelar outros filhos não comprova histórico completo.

Na produção faça somente leitura: modo maintenance, oito guards, contagens esportivas, cron, versões Edge e HTML/bundle servido. Não habilite filas, não insira resultados manualmente, não faça merge/deploy. A revogação dos RPCs antigos e instalação do candidato não ocorreram em produção. Mantenha os 12 gates REPROVADOS sem prova operacional de cada um.

Commitar relatório na mesma branch, com fatos/contraprovas/limitações separados, links dos runs e consultas sem segredos. Não repetir que produção funciona por testes locais.
