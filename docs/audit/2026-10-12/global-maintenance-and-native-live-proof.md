# Segurança de produção e prova operacional isolada — 2026-10-12

Status: **REPROVADO em produção**. PR #17 permanece draft, sem merge ou deploy da solução candidata. Este documento atualiza as auditorias anteriores; não transforma testes isolados em homologação do domínio publicado.

## Mudança efetivamente aplicada em produção

A migration `20261012023634_official_global_maintenance_fence` foi aplicada ao projeto Supabase `cdtvhagbgiwnjkgninqn`. Seu SQL exato está versionado em `commercial/supabase/migrations/20261012023634_official_global_maintenance_fence.sql`. Antes da aplicação, o candidato passou pelos testes PostgreSQL; a alteração foi de contenção de escrita, não ativação da nova integração.

O bloqueio anterior limitado aos cinco perfis não protegia um atleta novo. Agora oito triggers impedem repopulação esportiva e filas antigas em qualquer conta durante manutenção: results, meet_entries, meets, import_v2_jobs, monitor_jobs, historical_archive_jobs e duas caches históricas. A configuração privada do modo não é editável por anon/authenticated/service_role. Caches legadas permanecem retiradas mesmo no modo official_only. Nesse modo, uma futura escrita oficial exige contexto válido de job/lease, vínculo de conta/fonte e identidade/evidência; a migração não ativa esse modo.

Uma tentativa oficial em subtransação recebeu OFFICIAL_IMPORT_MAINTENANCE e foi revertida. Não foi usada para comprovar importação. Consulta de produção em 2026-10-12T03:20:15.284437+00:00: maintenance; oito guards; results=0, meet_entries=0, personal_bests=0, result_sources=0. As exclusões autorizadas anteriormente continuam preservadas. Nenhum resultado esportivo foi inserido manualmente em produção.

## Prova nova: fonte ao vivo, Auth e REST reais, banco isolado

Commit de código examinado: b2f9b508217dd358b5a634384353d4f3167f5183.

Execução: https://github.com/henriqueballao/VINISWIM/actions/runs/38200529145
Workflow: Native local Auth and live-source pipeline (no production writes).
Conclusão GitHub: success.
Artifact original: 11725930516; SHA256 do ZIP dfaaff92629a7c86ae2dd2d1ba2c5706af9973da5c79c7f0754eb1e68c9130d6.

A execução iniciou Supabase local descartável com CLI 2.120.0 no runner. Usou Auth, PostgREST, PostgreSQL e navegador reais, sem interceptação de API. Usuários, contas e perfis são fixtures sintéticas locais; os resultados esportivos foram buscados nos documentos oficiais públicos ao vivo e persistidos exclusivamente pelo pipeline candidato.

Registro adicional selecionado algoritmicamente: 437084, excluindo os três registros da missão. Não é o teste futuro escolhido pelo proprietário. O cadastro da fonte por usuário autenticado disparou a fila, sem clique de busca; identificador não estava verificado antes da leitura documental. O catálogo descobriu 70 competições. Para esta prova específica foi priorizado o job da competição c8587533-2e44-4b08-991f-f827170c7344 e cancelados os outros filhos: isso não comprova importar as 70 competições nem histórico completo.

Primeira ingestão ao vivo: cinco resultados e cinco inscrições/balizamentos; zero conflitos. Segunda ingestão: zero inserções, cinco resultados e cinco inscrições duplicados reconhecidos, zero atualizações. Resultado é entidade distinta do tempo de inscrição. As cinco marcas oficiais em piscina 50 m foram 35170, 84700, 169570, 37740 e 99910 ms, vinculadas às provas/datas no JSON da prova; não foram valores seedados.

A conta B não leu dados da conta A, nem conseguiu invocar a persistência privilegiada. O navegador mostrou cinco oficiais e não ofereceu exclusão oficial; verificação móvel passou. A CLI parou e iniciou efetivamente os serviços mantendo volumes de teste; nova autenticação e comparação integral de resultados e procedências confirmaram conservação de linhas, URLs, hashes e horários. Não foi apenas reload do React.

Limites: worker executado em Node com o núcleo compartilhado, não Edge publicada; edge-runtime não foi iniciado. O esquema esportivo foi capturado da produção, mas tabelas periféricas de conta/perfil são fixtures limitadas. Isso não prova configuração comercial completa, cron/segredos Edge de produção, domínio publicado ou reinício de serviços de produção.

## Evidências permanentes

A pasta native-live-evidence deste diretório guarda o JSON operacional, manifesto e quatro PDFs originais desta execução em gzip/base64. Não depende da retenção de 30 dias de Actions. Os hashes são dos bytes PDF descomprimidos, não do texto extraído. Recuperação: base64.decode seguido de gzip.decompress; comparar SHA256 com rawHash do manifesto.

O documento final de resultados tem SHA256 bf21a054397316983464ac7b6b0f6bc393a4b805270e82a2154415d387f4c510, capturado em 2026-10-12T03:41:00.774+00:00. Ele difere das capturas antigas. Fonte e evidência de cada registro constam no JSON, com productionWrites=0. Todos os quatro originais foram decodificados e seus hashes conferidos antes do commit. Nenhum CAPTCHA, token privado da fonte ou proteção de acesso foi contornado.

## Outras correções candidatas, ainda não aplicadas em produção

- save_official_athlete_source_config autoriza por conta, valida host oficial, impede conflito de registro no mesmo atleta e duplicação de registro na mesma conta. Contas distintas são permitidas; não há fusão cega. O cadastro não verifica identidade por declaração do usuário.
- Identidade só é verificada após publicação oficial consistente dentro da transação de ingestão. Locks impedem reassociação concorrente.
- Revogação dos RPCs antigos de quatro/seis argumentos é candidata, não aplicada em produção. Esses RPCs antigos marcavam identificador como verificado sem publicação. A contenção global impede que isso repovoe resultados.
- Botão de cancelamento corrigido após falha real de E2E na execução 38198243217: o rótulo ficava Atualizar apesar de a ação cancelar. A asserção não foi enfraquecida.
- Builder produz candidato SQL atômico com manifesto de hashes; não instala automaticamente em produção nem habilita cron. A opção global-fence-already-applied evita reaplicar a proteção.
- Lookup antigo de candidatos/cache e fontes sem adaptador continuam limitações explícitas. Não afirmamos remoção completa do legado ou suporte universal.

## Validações

No commit b2f9b508, também passaram UI Gate 2/build (38200532889) e Import V2 Gates (38200532892). No commit 5bb02dded344a76d97621f18872e00987bc085cb passaram PostgreSQL/leases/transações (38198927798), reproduções adversariais originais (38198927809), native live/restart (38198927887), UI/build (38198931555) e import (38198931571). As reproduções críticas originais foram mantidas sem alteração.

## Gates de produção

| Gate | Status | Falta operacional |
|---|---|---|
| 1 Pipeline completo/domínio | REPROVADO | Candidato não é o pipeline servido no domínio |
| 2 Código morto isolado | REPROVADO | Legado publicado e consumidores ainda existem |
| 3 Importação oficial persistida | REPROVADO | Prova ao vivo persistiu em ambiente isolado |
| 4 Três atletas | REPROVADO | Não importados pelo candidato em produção |
| 5 Persistência versus originais | REPROVADO | Prova/documentos locais não são linhas de produção |
| 6 Balizamentos completos | REPROVADO | Produção continua vazia por contenção |
| 7 Procedência persistida | REPROVADO | Ledger candidato validado somente isoladamente |
| 8 Segunda ingestão idempotente | REPROVADO | Confirmada isoladamente, não em produção |
| 9 UI publicada = banco | REPROVADO | Browser testou build candidato, não viniswim.com.br/app |
| 10 Monitor detecta nova publicação | REPROVADO | Cron/Edge publicados não executam o novo pipeline |
| 11 Falhas não ocultadas | REPROVADO | Candidato testado, workers antigos publicados |
| 12 Restart/redeploy | REPROVADO | Restart real local passou; produção/redeploy não homologados |

A Edge publicada permanece monitor-runner v115/import-v2-runner v30, e o frontend conhecido serve o bundle antigo. Não houve instalação da arquitetura candidata, remoção dos holds, novo segredo, habilitação de cron, merge ou deploy. A instrução do proprietário proíbe publicar solução incompleta; segurança aplicada e prova isolada não anulam esse bloqueio.
