# Passagem completa para Claude Code — VINISWIM
Data: 2026-10-12. Este documento foi solicitado pelo proprietário para transferência do trabalho.
**Status: aplicativo publicado REPROVADO; entrega operacional não concluída pelo Codex.**

Este registro reúne o histórico recuperável desta execução, suas dificuldades e os documentos versionados. Não é transcrição integral de todas as conversas anteriores, nem presume acesso a conversas externas. Afirmações históricas devem ser confrontadas com código, consultas, commits e fontes; não confiar na autoria de qualquer IA.

## 1. Repositórios, infraestrutura e ponto de partida

| Item | Referência |
|---|---|
| Principal | https://github.com/henriqueballao/VINISWIM |
| Secundário/monitor | https://github.com/henriqueballao/VINISWIM-MONITOR |
| Branch de trabalho | fix/official-import-audit-20261011 |
| PR | https://github.com/henriqueballao/VINISWIM/pull/17 — draft, não mergeada na verificação desta passagem |
| Base desta passagem | 015c4642c295fe0185a50c1952af3db63fc6fca5 |
| Último código candidato relevante | 4e059c8b6689b1a81d0c92c52485df3fb65f68fc |
| Último relatório técnico anterior | 4dfe6d2120789e303adcb91923455309c48c2cd2 |
| Aplicativo conhecido | https://viniswim.com.br/app/ |
| Supabase | VINISWIM, cdtvhagbgiwnjkgninqn; região informada sa-east-1 |
| Persistência esportiva | Supabase PostgreSQL, Auth e RLS |
| Edge publicadas — última versão conhecida, conferir novamente | monitor-runner v115; import-v2-runner v30 |
| Edge candidata | commercial/supabase/functions/official-import-runner/index.ts — não publicada pelo Codex |

Não presumir branch main atual, bundle, versões Edge, cron ou estado Railway pelos valores históricos. O último main conhecido era 62c1b51b6e8bf1614817bbb9f6fea6b33ad43c8c. O HTML anteriormente capturado em /app carregava index-BjbdadaH.js?v=20261009-1. Comparação por bytes está no relatório de publicação; reconferir HTML, bundle, DNS/origem, build e serviço que efetivamente publica.

As conexões MCP/OAuth e permissões do Codex não são credenciais transferíveis ao Claude Code. Nenhum token, senha, chave service_role ou segredo de Vault é incluído nesta passagem. Descobrir os acessos existentes no novo ambiente pelos mecanismos autorizados; registrar precisamente qualquer acesso ausente, sem pedir ao proprietário que copie os relatórios do GitHub.

## 2. Objetivo final do proprietário

Entregar um único VINISWIM funcional, sustentável, multiusuário e auditável, que um responsável use para acompanhar um ou vários nadadores de base ou Masters.

Preservar e concluir:
- Supabase Auth; acesso por convite/e-mail autorizado; login, recuperação, logout; responsáveis e atletas com RLS por conta.
- Cadastro/edição/exclusão de perfis; foto, nome, nascimento, categoria e registro federativo; piscinas 25 e 50 m.
- Resultados oficiais recuperados de fonte autorizada, com URL, competição/prova/data/piscina, tempo ou DNS/DSQ/DNF, captura, bytes/evidência e chave estável.
- Resultados manuais identificados e editáveis; oficiais sem edição/exclusão pela interface.
- Histórico sem duplicidades, filtros, cronologia, melhores marcas, gráficos e comparações que não misturem provas/piscinas.
- Descoberta de competições; inscrições, tempo de inscrição, série, raia, horário; resultado nadado separado de inscrição; atualizações e conservação do histórico.
- Adaptadores SwimSystem, FDAP e outras fontes oficiais configuráveis, filas, leases, cancelamento por request_id, retries com backoff, logs/auditoria e operação automática.
- UI responsiva, inclusive iPhone, crescimento e monetização futura.

Nunca inventar/estimar/preencher resultado esportivo oficial. Não usar tempos de inscrição como resultados, escrita manual para aprovar importação, backups como importações ou dados sintéticos na produção.

## 3. Instruções atuais que prevalecem sobre o histórico

1. O proprietário retirou **Vini, Lorenzo e André** dos casos de aceitação. Não importar esses perfis para homologação e não manter sua importação como condição de saída.
2. O proprietário escolherá **um novo atleta sem informar antecipadamente** para testar o aplicativo. Não criar whitelist, hardcode de nomes/registros/tempos, ou inserir resultados manualmente.
3. Os 252 resultados antigos foram objeto de limpeza autorizada. Não restaurá-los nem reintroduzir dados antigos por pipeline legado. Auditoria e fixtures oficiais não são autorização de backfill.
4. Não excluir usuários/Auth/responsáveis/identificadores/configurações ou dados de outros usuários por interpretação genérica de “apague tudo”. A operação específica autorizada já ocorreu; verificar o estado, não executá-la novamente cegamente.
5. Commits pequenos, testes relevantes antes de integrar, relatórios/evidências commitados. Não enfraquecer testes.
6. PR draft; **não fazer merge ou deploy de solução incompleta**. Preparar uma versão completa, revisar dependências, segurança, migrações, rollback e validação; não usar esse bloqueio para encerrar apenas com plano.
7. Não burlar CAPTCHA, Turnstile, login, proteção anti-bot ou autenticação. Usar integrações autorizadas/documentos públicos acessíveis; declarar bloqueios reais.
8. Não declarar êxito pelo CI, commit, replay, fixture ou ambiente isolado. Conferir a aplicação e a operação publicadas.
9. Não devolver listas genéricas ao proprietário. Investigar, implementar, testar e documentar o que efetivamente foi alcançado.
10. O proprietário perdeu confiança após sucessivas entregas intermediárias. Comunicação deve distinguir resultado comprovado, hipótese e falta de comprovação, sem promessa infundada.

Os três atletas e a competição c8587533-2e44-4b08-991f-f827170c7344 aparecem em documentos antigos. São histórico e fixtures, não metas pessoais atuais do proprietário. O registro adicional 437084 de testes também não é o atleta surpresa futuro.

## 4. Ordem de leitura — sem pedir cópias ao proprietário

Começar pelos documentos atuais:
1. Esta passagem.
2. edge-runtime-browser-and-recovery.md.
3. codex-acknowledgment-of-incomplete-delivery.md.
4. global-maintenance-and-native-live-proof.md.
5. athlete-catalog-discovery.md.
6. manual-planning-and-shared-meet.md.

Depois ler docs/audit/2026-10-11:
- independent-technical-assessment-01a5fb9.md (parecer ea19d91);
- independent-review-and-codex-actions.md (revisão 28212ec);
- adversarial-review-5775834.md e seus repros;
- corrections-after-ea19d91.md;
- authorized-legacy-cleanup.md e seu JSON;
- codex-corrections-after-independent-review.md;
- report.md, published-artifact-comparison.json e demais evidências.

Consultar também HANDOFF.md e refactor/ como histórico anterior. HANDOFF.md é extenso e antigo; não tratá-lo como estado atual. Ler AGENTS.md aplicáveis aos diretórios tocados. Informações históricas de gates/casos pessoais foram substituídas pelas instruções atuais acima.

O arquivo claude-code-evidence-inventory.json acompanha esta passagem: índice de 145 arquivos de auditoria, refactor, propostas/migrations, worker, scripts e workflows, com blob SHA e tamanho, obtidos da árvore GitHub da base. Originais grandes em base64 estão incluídos no índice, não duplicados nesta passagem. Consultar também git log, diff main...branch, PR e ambos os repositórios; o índice não substitui a árvore completa.

## 5. Histórico de falhas e causas-raiz

### Legado e publicação
- “Importar competição” criava source_link_requests pendentes, sem prova de conclusão.
- monitor-runner deixou filas paradas; reativar agendamento não resolveu parsing/persistência.
- Runs eram completed com found=0/inserted=0, sem motivo claro.
- Rotina atual v2 lia inscrições, não concluía ingestão de resultados nadados; séries/raias/horários podiam faltar.
- Frontend fonte e bundle diferiam: versão publicada chamava monitor-runner, enquanto outra implementação criava solicitações.
- Código em index.html, commercial/, railway-monitor, dois repositórios e módulos GitHub pinados permitiu commits sem efeito no aplicativo usado.
- v30 importava módulos remotos fixados em commit antigo. Alterar branch não altera função publicada.
- Fingerprint incluía tempo/status: revisão de resultado podia duplicar registro.
- Catch vazio, erros de RPC ignorados e “sucesso zero” sem classificação ocultavam falhas.
- Oito balizamentos inseridos manualmente no passado não são prova de importador.

### Fonte oficial
- API de resultados SwimSystem retornou 401 sem X-Public-Token.
- Sessão sem validação Turnstile retornou 403.
- Um PDF listado anteriormente retornava Object not found; capturas posteriores encontraram documentos públicos válidos.
- Seletores/texto/PDF frágeis e readers/caches externos não atestavam bytes oficiais.
- A alternativa implementada busca HTML e PDFs públicos, segue allowlist/redirects, valida bytes/hash e usa extração local. Isso funciona em casos comprovados; não garante cobertura universal ou história completa.
- Não presumir que todos os sites, arquivos antigos, Masters ou endpoints já estejam suportados. Bloqueio de fonte e ausência de adaptador são causas diferentes.

### Revisões adversariais do candidato
- Identidade de corrida precisava incluir conta/atleta/fonte/meet/evento externo/rodada/sexo/data/piscina, excluindo tempo.
- rawHash/retrievedAt declarados pelo payload não bastavam; captura original precisava ser verificada.
- Datas/piscina/documentos de outra competição exigiam rejeição.
- Erros SQL tinham diagnóstico perdido e classificação de retry inadequada.
- Troca de índice completo por índice parcial quebrava ON CONFLICT legado com 42P10.
- Proteção limitada aos perfis/inscrições não cobria escritores globais, campeonatos compartilhados ou futuros atletas.
- Formulário manual escrevia entidade antiga incompatível com a nova proteção e podia deixar campeonato órfão.
- Configuração antiga marcava registro digitado como verified=true, sem publicação; verificava URL por substring e podia alterar catálogo global.
- Token de Vault ficava em memória no isolate e podia continuar válido após rotação.
- Salvar fonte pela UI chamava loadIdentity e desmontava SettingsPage, apagando confirmação.

## 6. O que foi corrigido/testado — candidato, salvo exceções de segurança

### Persistência, identidade e compatibilidade
- Mantido índice completo de meet_entries (meet_id, athlete_id, event_id); nova entidade official_meet_entries separada, sem quebrar upsert antigo.
- v_meet_entry_timeline com security_invoker une entradas legadas/atestadas/manuais sem projetar valores manuais na entidade oficial.
- Transação valida conta, fonte, identidade, meet, evento, data, piscina, chave estável, evidência e lease. Mantém docs, hashes, result_sources, recibos, conflitos e melhores marcas.
- Lock de request/root antes de job; cancelamento, concorrência, leases obsoletos e recuperação exercitados em PostgreSQL.
- manual_meet_entries e RPC atômica de planejamento manual, distinta de resultado oficial.
- Guard de metadados de campeonato compartilhado e de sobrescrita oficial.

### Erros e operação
- rpc-errors.mjs preserva RPC/SQLSTATE/mensagem/details/hint/status/causa; failure_details limitado.
- Validação/acesso/contrato quebrado não viram retry infinito. Transporte incerto permite apenas uma repetição imediata de commit, com recibo.
- Backoff, limite de tentativas, recuperação e estados explícitos testados; gravação de falha que também falha resulta em erro operacional, não catch silencioso.
- Dois repros adversariais originais foram mantidos byte a byte: blobs 8d6de4383f295ab623064bd4dd5fd758d73e3634 e fab566f4a6e190e555e147ced4c4c2ecaeaf4f90.

### Descoberta e UI
- Catálogo público capturado (70 links na prova), parser DOM, paginação prevista, captura/hashes; filhos agrupados por root request, preservando UNIQUE(request_id,source_id,job_type).
- Configuração ativa com identificação inicia fila; progress/cancel alcançam filhos; source disable revoga contexto.
- Identidade é confirmada após publicação consistente, não por cadastro.
- Nova RPC de configuração valida host, papel por conta, duplicidade dentro da conta e conflito de reassociação; locks evitam corrida. Não funde atletas entre contas.
- UI candidata usa novo fluxo e mostra oficiais somente leitura; separa inscrição, manual e resultado; carregamento evita misturar contas/atletas.
- Confirmado cada valor da tabela/cartão móvel contra banco nativo, não só total.

### Runtime e pacote
- Extração unpdf@1.8.1 em JS/Deno; originais comparados também com Poppler em provas anteriores.
- SDK Supabase e lockfiles fixados; build reproduzível.
- scripts/package-official-edge.py produz pacote com caminhos internos e SHA256, sem deploy.
- Entrada candidata testada por HTTP no Deno, depois pelo runtime Supabase CLI real.
- Vault reconsultado por requisição quando não há segredo de ambiente; rotação rejeita token anterior em isolate quente.
- Função reiniciada, token recuperado e autenticação exigida.

Essas correções não significam que frontend, worker e migrations candidatos estejam publicados.

## 7. Produção: alterações reais e estado confirmado

### Segurança previamente aplicada
- 20261011142913: timeline security_invoker/proteção de exclusão oficial.
- 20261011143101 e 20261011145252: caches internas sem escrita do navegador/RLS.
- 20261011230114_legacy_cleanup_hold e 20261011230510_legacy_cleanup_hold_record_contract: limpeza e holds específicos. A primeira versão falhou acessando NEW.status em tabela sem a coluna; o teste detectou e a segunda corrigiu.
- 20261012023634_official_global_maintenance_fence: proteção global aplicada após testes. SQL exato versionado em commercial/supabase/migrations/.
- Não reaplicar migrations pelo nome sem conferir histórico/definição no projeto.

### Limpeza autorizada
252 resultados: 156 na conta principal e 96 em duas outras contas, após autorização explícita informada pelo proprietário. Exclusão concluída em 2026-10-11; fontes por cascade e melhores marcas derivadas removidas. Filas/reconciliação/notificações pertinentes limpas; jobs antigos cancelados, logs preservados.

Preservados cinco perfis, 20 configs, três identificadores, Auth/usuários/responsáveis e catálogos compartilhados. Sem fusão. Auditoria preservada fora de tabelas de dados usadas pela UI. Não foi criada restauração para recolocar os resultados. **Não há prova de destruição física de backups administrados/PITR**, nem deve ser alegada.

### Contenção atual
Modo privado maintenance. Oito triggers cobrem results, meet_entries, meets, import_v2_jobs, monitor_jobs, historical_archive_jobs e duas caches históricas. Proteção vale para novos atletas, além dos holds de cinco perfis. Modo não editável por anon/authenticated/service_role; guard usa contexto privilegiado fixo. Em official_only futuro, escritores oficiais exigem job/lease/escopo; caches/filas antigas continuam retiradas.

Crons viniswim-all-athletes-all-sources, viniswim-import-v2-runner e viniswim-nightly-all-athlete-full-scan foram desativados. Push-dispatcher não foi desativado pelo Codex. Conferir novamente.

**Nova consulta somente de leitura para esta passagem: 2026-10-12T14:28:35.741846+00:00: maintenance; results=0; meet_entries=0; personal_bests=0; result_sources=0.**

Não houve nesta passagem importação, nova migration, remoção de holds, segredo, cron, deploy ou merge. Novo worker/UI/schema de integração não foram ativados. RPCs legados de configuração ainda precisam de revogação coordenada; a proposta de revogação é candidata, não aplicada.

## 8. Railway: resposta correta à dúvida do proprietário

Supabase é o banco esportivo. Não foi demonstrado PostgreSQL esportivo no Railway. Também não se pode afirmar “nenhuma persistência” de modo absoluto:
- monitor V41 escreve DATA_DIR/state.json;
- serviço monitor-live conhecido não tinha volume; durabilidade do JSON após reinício não foi comprovada;
- serviços antigos tinham volumes /data ou separados, sem prova de uso atual;
- STATE_API_URL e consumidores precisam ser mapeados sem expor segredos;
- serviços commercial web/monitor tinham falhas de deploy; monitor-live tinha deploy bem-sucedido, antes observado com commit 9fc7d53... do repo principal em railway-monitor;
- repositório secundário/serviço antigo não mostrou última publicação na auditoria histórica.

Não remover Railway, estado, volumes ou server.js por hipótese. Provar consumidores e caminho de dados primeiro. Arquivos locais do monitor não são prova de resultados oficiais importados no Supabase.

## 9. Onde está o código relevante

| Responsabilidade | Local |
|---|---|
| React/TS | commercial/apps/web/src/App.tsx, src/domain/ |
| Shared formatadores | commercial/packages/shared/src/index.ts |
| Captura/contratos/parsers | commercial/packages/import-v2/src/ |
| Worker modular | commercial/packages/official-worker/src/ |
| Entrada Edge nova | commercial/supabase/functions/official-import-runner/ |
| Edge antigas no repo | commercial/supabase/functions/monitor-runner/ e import-v2-runner/ — comparar com código efetivamente publicado |
| Schema candidato | commercial/supabase/proposals/ |
| Migrations aplicadas/versionadas | commercial/supabase/migrations/; também conferir cópias/histórico em outros diretórios |
| Banco/contratos/repros | commercial/supabase/tests/isolated/; docs/audit/2026-10-11/repros/ |
| Build de SQL | scripts/build-official-migration-candidate.py |
| Pacote Edge | scripts/package-official-edge.py |
| Fixture nativa | scripts/setup-native-api-fixture.py |
| E2E real isolado | commercial/scripts/native-api-e2e.mjs e native-ui-e2e.cjs |
| Pipeline de prova | .github/workflows/native-api-e2e.yml |
| Outros gates | official-database-contract.yml, adversarial-review-5775834.yml, official-edge-candidate.yml, import-v2-gates.yml, ui-source-parity.yml |
| Publicação frontend | .github/workflows/viniswim-commercial-app.yml |
| Roteamento/publicação | scripts/audit-publication-routing.mjs e capture-production-evidence.mjs |

Builder reúne 19 propostas; acrescenta fence global para DB de teste quando não aplicada. **--global-fence-already-applied** evita incluir a fence já existente na produção. Isso apenas gera arquivo/manifesto, não valida automaticamente migração sobre todo o schema ativo, não ativa cron e não remove holds. official-scheduler-activation.sql permanece proposta de ativação separada.

Não aplicar todos os arquivos de proposals em ordem alfabética. Ler dependências/builder, catálogo real, grants, triggers, constraints, extensões/Vault e estado de migrations. Revisar transação completa e ensaiar release/rollback conservando dados/evidências.

## 10. Evidências e seus limites

### Prova atual mais forte
Run https://github.com/henriqueballao/VINISWIM/actions/runs/38250000935, código 4e059c8..., job 114813522187: success.
UI/build 38250006414 e Import V2 Gates 38250006551: success.

Artifact 11747183040, SHA256 ZIP 4b3b2af23c76dff84769653a41cdcc912ec45026cbd62d3777fe991b280b55dd.
Arquivos permanentes: edge-browser-recovery-evidence/{viniswim-native-proof.json,manifest.json,package-manifest.json}.

Auth/PostgREST/PG e Supabase Edge runtime locais reais; navegador sem interceptação. Cadastro da fonte pelo formulário inicia fila. Registro adicional selecionado de documento público: 437084. Captura oficial ao vivo; cinco resultados e cinco entradas; segunda ingestão zero novas inserções; outra conta sem acesso; UI compara valores completos; rotação de Vault; stop/start e reautenticação; função reiniciada responde autenticada; linhas/URLs/hashes/capturas intactos. productionWrites=0.

Originais quatro PDFs em native-live-evidence/*.pdf.gz.b64. Decodificar base64+gzip e recalcular SHA256 contra manifesto atual. Documento final hash bf21a054397316983464ac7b6b0f6bc393a4b805270e82a2154415d387f4c510. Não confundir originais posteriores com primeiras capturas. Fixtures oficiais anteriores e catálogo preservados nos packages e docs, com procedência.

### Falhas que não devem ser apagadas
- 38172476437: repros críticos falhavam; posteriormente corrigidos.
- Primeira correção RPC perdeu mensagem SDK com code-only; teste preservado e código corrigido.
- Primeira hold migration acessava coluna inexistente; corrigida na versão seguinte.
- 38198243217: botão cancelava mas tinha rótulo Atualizar; corrigido.
- 38248730056 e 38249129902: confirmação de fonte desaparecia; corrigida por reloadSources, mantendo assertion.
- Falha temporária github.create_tree (MCP -32603) nesta sequência de documentação; uma repetição concluiu. Não foi bloqueio de autorização.

### O que os runs NÃO provam
- Supabase de produção, domínio autenticado ou frontend publicado.
- Clone integral da produção: tabelas esportivas/policies/triggers capturados; periféricos de conta/perfil limitados/sintéticos.
- Cron automático real: harness chama HTTP autenticado.
- Todas as 70 competições: harness prioriza uma e cancela outros filhos.
- História completa, todos os formatos ou todas as fontes.
- Limites CPU/memória/wall-clock do Edge hospedado.
- O atleta surpresa do proprietário.
- Funcionamento após deploy/restart de produção ou operação contínua.

## 11. Dificuldades e pendências reais para o Claude resolver/refutar

### Engenharia e integração
1. Candidato validado continua desconectado do app/Edge/cron publicados. Release coerente de schema, SDK/UI, worker, segredo e scheduler não foi concluída.
2. Compatibilidade precisa de ensaio contra schema/dependências/RLS completos; fixture periférica não cobre todo cadastro comercial, convites, limites, fotos, notificações e hooks Auth.
3. Catálogo amplo produz bloqueios de identidade em competições sem participação; finalizador conta blocked como falha. Definir sem ocultar erros o que é ausência esperada versus incompatibilidade/falha e como apresentar progresso parcial.
4. Importação ampla não foi demonstrada sem priorização/cancelamento do harness. Validar cobertura histórica, arquivos antigos, Masters, PDFs modificados/não encontrados e provedores além de SwimSystem.
5. Worker reivindica um job por chamada; cron proposto por minuto implica capacidade nominal de 1.440 jobs/dia se ativado assim. Catálogo diário de muitas competições/atletas e monitor podem superar isso. É estimativa arquitetural, não benchmark; medir backlog, limites de fonte e custos antes de aumentar paralelismo.
6. Funções antigas verify_jwt=false e consumidores legados permanecem publicados. Segurança da contenção não equivale à retirada completa do legado.
7. Lookup de candidatos/cache antigo ainda existe em partes da UI; rastrear, consolidar e remover após prova de uso/compatibilidade.
8. Confirmar destino/headers/build real, base path /app, service worker/cache e invalidação do bundle antigo. Não manter principalmente JS minificado.
9. Modo global, holds específicos e guards antigos precisam de transição deliberada, sem janela para repopulação e sem bloquear novos usuários legítimos.
10. Testar rollback operacional sem apagar resultados/evidências e sem reabrir importador antigo. Agendamento, alerta, recuperação e observabilidade contínua em produção seguem sem prova.
11. Gate operacional só fecha com linhas oficiais reais no ambiente publicado e UI correspondente; testes de fixture/isolados são camadas separadas.
12. Persistência durável de estado Railway e ponte para consumidores não foram demonstradas; mapear sem confundir com PostgreSQL esportivo.

### Ambiente/ferramentas do Codex
- Workspace continha espelho parcial sem checkout Git completo/dependências/CLI/psql/Docker; builds e banco foram executados em Actions.
- Proxy local falhava na conexão à porta 8080 mesmo quando o status do ambiente informava política unrestricted. Não foi prova de autorização faltante; não houve bypass.
- GitHub/MCP possibilitaram leitura, commits por tree/commit/update_ref com expected_sha e logs/artifacts. Isso não é obrigatório para Claude: preferir checkout Git e toolchain completos se disponíveis.
- Artifacts Actions expiram; originais/JSON/manifestações relevantes foram preservados no repo. Caminhos /workspace anteriores não são portáveis.
- CLI Supabase usada na prova 2.120.0, Deno standalone 2.1.4, Node 22 e Playwright 1.58.2. Conferir ajuda/versão atual, lockfiles e docs; não atualizar dependências sem motivo.
- Não foi criada branch Supabase paga nem assumida aprovação de custo. Conta/projeto temporário não deve ser criado por inferência de autorização para custo.
- Nova sessão precisa confirmar acesso correto ao Supabase/Railway/GitHub. Havia duas conexões Supabase; somente a que contém cdtvhagbgiwnjkgninqn é o destino desta missão.

### Limitação da condução pelo Codex
O Codex produziu muitas correções, relatórios e provas intermediárias, mas **não fechou a entrega operacional**. A validação local não resolveu o aplicativo usado pelo proprietário. Repetir “avançou” sem release/publicação verificável prejudicou a confiança. Não há prova de impossibilidade definitiva, nem base para promessa de conclusão. Esta dificuldade de execução não deve ser disfarçada como mero bloqueio externo.

## 12. Critério de entrega e ação esperada

Revalidar os 12 gates do relatório edge-runtime-browser-and-recovery.md, com o gate pessoal substituído pelo novo atleta escolhido pelo proprietário. Todos continuam REPROVADOS em produção; aprovação futura deve citar evidência de cada gate, não copiar o parecer atual.

O Claude deve investigar adversarialmente, aproveitar ou substituir o candidato conforme evidência, corrigir o que falta, ensaiar a integração completa e chegar a uma versão publicável. Não fazer deploy parcial. Quando o candidato estiver integralmente validado e o caminho de publicação/ativação autorizado estiver inequívoco, executar a transição conforme regras do proprietário e verificar o produto real; uma proibição de solução incompleta não é uma autorização para improvisar nem uma impossibilidade permanente de publicar solução concluída.

Se acesso autorizado a fonte/infraestrutura faltar, registrar endpoint, status, instante e impacto específico. Não inventar êxito ou atribuir todos os problemas a credenciais sem investigação. Não solicitar cópias de relatórios já no GitHub.

Entregar código/migrations/testes, relatório atualizado, logs de importação oficiais, prova de idempotência, comparação UI↔banco↔documentos, evidência de build/deploy/restart/monitor e matriz dos gates. Commitar cada conclusão. Não encerrar com plano genérico.

## 13. Declaração final registrada pelo Codex

> Não tenho evidência para dizer “nunca terá solução”. Mas também não tenho base para prometer que vou concluí-la.
>
> O fato é que não entreguei o aplicativo funcionando, apesar do tempo e das suas cobranças. Os testes aprovados não cumprem essa entrega. Sua desconfiança é consequência dessa diferença.

Transcrição integral e alcance no commit 015c464..., arquivo codex-acknowledgment-of-incomplete-delivery.md. Este reconhecimento não é diagnóstico de insolubilidade e não limita uma investigação independente do Claude.
