# VINISWIM — HANDOFF.md (fonte única de verdade)

Este arquivo é o registro vivo de decisões técnicas do projeto VINISWIM. Ele existe para que o "chat" (arquitetura/decisão) e o "Code" (execução) fiquem sincronizados sem depender de copiar e colar mensagens.

## Papéis (definido em 26/09/2026)

- **Chat**: discute arquitetura, avalia risco, decide o quê fazer e em que ordem. Não tem acesso a GitHub/Supabase. Lê este arquivo (colado pelo usuário) antes de decidir algo novo.
- **Code** (esta sessão / Claude Code): único executor. É quem tem acesso de escrita a GitHub e Supabase. Implementa exatamente o que foi decidido, registra aqui o que foi feito, e não decide sozinho mudanças de arquitetura ou de dados — só propõe.
- **Usuário**: ponte entre os dois, autoriza qualquer ação sobre dados reais, e decide em caso de divergência entre chat e Code.

**Regra de comunicação**: ao final de toda resposta em que Code executa algo, encontra algo relevante na auditoria, ou fica bloqueado, Code entrega um bloco de texto pronto para o usuário colar direto no chat, resumindo o que foi feito/encontrado e o que precisa de decisão.

## Regras invioláveis (herdadas do handoff técnico de 26/09/2026)

1. Nenhuma alteração em dados reais de atletas (`results` e tabelas relacionadas) sem autorização explícita do usuário — nada de insert/update/delete/importação/dedup automática.
2. Nenhum código pode depender do nome "Vini" ou de qualquer atleta específico para funcionar.
3. Não redesenhar, não trocar stack, não desligar RLS, não usar service_role no browser.
4. Commit ≠ produção. Só declarar algo publicado depois de: build passou → workflow rodou → GitHub Pages fez deploy → (quando relevante) confirmação de que não é cache/service worker servindo versão antiga.
5. Toda mudança de código roda em **commits pequenos e verificáveis**, separando limpeza de mudança funcional. Não misturar correção funcional, segurança e limpeza/refatoração no mesmo commit.
6. Testes de importação/parser usam SELECT, fixtures ou dry-run — nunca escrita na base real sem autorização.
7. **Testes com dados sintéticos em `monitor_jobs`/`historical_archive_jobs` NÃO são inertes**: existe um agendador automático real que invoca o `monitor-runner` periodicamente (ver seção de achados abaixo). Qualquer linha `pending` criada para teste pode ser processada de verdade. Usar sempre atletas sintéticos dedicados (nunca reaproveitar `athlete_id` real) e limpar tudo (jobs, `monitor_runs`, `athlete_source_configs`/`athlete_identifiers` auto-seedados, o atleta sintético) logo após o teste.
8. **A partir da D-004 etapa D**: o código versionado em git (`commercial/apps/web/src/`, `commercial/supabase/functions/`) é a origem dos deploys — nunca transcrever manualmente Supabase→git ou vice-versa quando já existe uma cópia local/clonada para editar e verificar por diff.
9. **O ambiente de execução do Code (sandbox desta sessão) nega, por política de rede, conexões de saída para `*.supabase.co`** (só permite uma lista fechada de hosts: npm, GitHub, APIs Anthropic). Isso significa que um navegador real rodando dentro desta sessão **não consegue** chamar a API REST/Auth do Supabase — mesmo que as ferramentas MCP do Supabase (usadas por Code para tudo neste handoff) funcionem normalmente, pois passam pela infraestrutura da Anthropic, não pela rede local da sessão. Qualquer teste que dependa de "abrir a página publicada num navegador de verdade e clicar" só é possível se o usuário ampliar o acesso de rede do ambiente (menu do ambiente → Editar) antes da sessão começar esse teste.

## Onde as coisas vivem

- Repo principal: `henriqueballao/VINISWIM` — frontend em `commercial/apps/web/`, publicação em `app/` (GitHub Pages, domínio `viniswim.com.br/app/`).
- Repo `henriqueballao/VINISWIM-MONITOR`: serviço legado standalone (Node/Express, hospedado no Render), não conectado ao Supabase. Status ativo/morto ainda não confirmado pelo usuário.
- Supabase (projeto `VINISWIM`, ref `cdtvhagbgiwnjkgninqn`, org `henriqueballao's Org`): banco, Auth, RLS, RPCs e Edge Functions.
- **Edge Function `monitor-runner` agora está versionada em git**: `commercial/supabase/functions/monitor-runner/index.ts`. As demais Edge Functions (`monitor-gateway`, `push-gateway`, `vapid-setup`, `push-runner`, `bootstrap-owner`, etc.) e as RPCs continuam só no Supabase, sem versionamento em git — pendência ainda aberta.
- **Existe um agendador automático (cron externo ou pg_cron) que chama o `monitor-runner` periodicamente, a cada ~2 minutos, independente de qualquer clique de usuário.** Descoberto em 26/09/2026 durante teste da D-004 (ver achados). Isso significa que a fila de `monitor_jobs`/`historical_archive_jobs` é sempre drenada automaticamente pelo sistema, não só quando alguém clica em Atualizar.
- Branch de trabalho do Code: `claude/novo-projeto-costaguerra-b2ua1t` (em ambos os repos). Mudanças não vão direto para `main`; ficam nessa branch até o usuário decidir mergear ou pedir um PR.

## Convenção de commits

`<tipo>(<escopo>): <resumo curto> [D-XXX]`

Tipos: `fix`, `feat`, `chore`, `docs`, `refactor`, `security`.
Escopo: nome do módulo/função (`monitor-runner`, `results-page`, `handoff`, etc.)
`[D-XXX]` referencia o número da decisão neste arquivo, quando aplicável.

Exemplo: `security(monitor-runner): remove delete automático em processArchiveJob [D-001]`

## Estado atual conhecido (snapshot atualizado em 27/09/2026, pós DEPLOY da D-004 para produção)

- HEAD do GitHub (main): `ad665f5230545a146aff9311c63e9e7dbfa4beb2` — **inclui a D-004 (etapas A–E) em produção**. Merge feito por fast-forward puro (branch de trabalho era 0 commits atrás / 12 à frente de `main`, sem divergência), então nenhum código além do já revisado e aprovado entrou no deploy.
- **Deploy público CONFIRMADO em 27/09/2026 00:46 UTC**: workflow `Build VINISWIM Commercial App` (run #105, sucesso) gerou o build e o bot commitou `ad665f5` em `app/` (novo bundle `assets/index-CzxNKciv.js`, substituindo `assets/index-BSw2K2bF.js`); workflow `pages build and deployment` (run #505) publicou esse commit com sucesso. `app/index.html` em `main` já referencia o novo arquivo — conferido lendo o arquivo direto do GitHub.
- **Limitação de verificação**: por causa da mesma restrição de rede da regra 9 (que aqui bloqueia não só `*.supabase.co`, mas qualquer domínio externo, incluindo `viniswim.com.br` e `*.github.io`), o Code **não conseguiu abrir a URL pública ao vivo para conferir visualmente**. A confirmação acima é a mais forte disponível pelas ferramentas desta sessão: os dois workflows do GitHub (build e Pages) reportam sucesso para o commit exato que contém o novo bundle, e o conteúdo do `index.html` publicado já foi lido diretamente do repositório. A conferência visual final (abrir `https://viniswim.com.br/app/` de verdade) fica para o smoke test do Henrique (ver Etapa D-DEPLOY abaixo).
- **Service worker/PWA**: `app/sw.js` só trata notificações push (`install`/`activate`/`push`/`notificationclick`) — **não implementa cache de `fetch`**, então não há risco de Service Worker servindo JS/CSS antigos. Como o Vite gera nomes de arquivo com hash de conteúdo (`index-CzxNKciv.js`), o único artefato sem hash é `index.html`; um cache de CDN/navegador desatualizado nele é resolvido por um hard-refresh simples, sem qualquer ação de código.
- `monitor-runner` (Edge Function): **versão 60 ACTIVE**, SHA `a590564ef67d6ac374d5513849e144860ffbbd41c089ff0d28134fc460382b0e`. Mirror em git verificado byte-a-byte igual ao deploy real.
- **RESOLVIDO (D-001)**: `DELETE` automático em `results` removido; RPCs de claim travadas para `anon`/`authenticated`.
- **D-004 etapas A, B, C, D e E EXECUTADAS, e frontend (etapa D) EM PRODUÇÃO** (ver log de decisões). Regra de agregação de estado **APROVADA e CONGELADA** pelo chat.
- **D-004 AINDA NÃO ESTÁ ESTABILIZADA** — o smoke test do Henrique na versão publicada encontrou um bug real introduzido pela etapa B (reassociação de jobs cancelados) e expôs uma característica de performance pré-existente que faz o botão Atualizar parecer travado. Ver "Etapa ESTABILIZAÇÃO" no log de decisões.
- **Etapa F (limpeza de legado) continua BLOQUEADA** — não pode começar antes da D-004 ser estabilizada.
- `VINISWIM-MONITOR` (Render): serviço legado sem relação com o Supabase atual — pendente decisão do usuário sobre manter/arquivar.

## Achados/fixes independentes (fora da numeração D-XXX)

### FIX-001 — `historical_archive_jobs.status` não aceitava `'cancelled'`
- **Encontrado**: 26/09/2026, durante validação da D-004.
- **Problema**: o `CHECK` constraint da coluna só permitia `pending/running/completed/failed`. O `cancel_result_refresh(p_athlete_id)` **legado**, já em produção, tenta gravar `status='cancelled'` nessa tabela — ou seja, esse cancelamento provavelmente falhava com erro sempre que havia uma busca histórica pending/running no momento do clique de pausar.
- **Correção aplicada**: migration própria `fix_historical_archive_jobs_status_allow_cancelled` — `DROP`/`ADD CONSTRAINT` ampliando a lista para incluir `'cancelled'`. Nenhuma linha existente foi alterada (todas já estavam dentro da lista antiga).
- **Verificação**: `pg_get_constraintdef` confirmou a nova lista instalada. Testado com gravação sintética (INSERT/UPDATE em atleta de teste, sem tocar `results`).
- **Validação adicional (pós etapa B)**: a nova RPC `cancel_result_refresh_request` faz exatamente esse tipo de gravação (`status='cancelled', heartbeat_at=null, finished_at=now()` sobre `historical_archive_jobs` em `pending`/`running`) e foi testada com sucesso em cenário sintético — confirma que o FIX-001 também resolve o caminho novo, não só o legado.

### FIX-002 (achado, não é bug) — agendador automático do monitor-runner
- Durante a validação da D-004, jobs sintéticos de teste com status `pending`/`running` foram capturados e processados de verdade por um agendador que chama o `monitor-runner` a cada ~2 minutos (confirmado por múltiplas linhas em `monitor_runs` com `finished_at` espaçados de ~2min, sem nenhuma ação manual). Nenhuma linha de `results` foi tocada (todo `records_found`/`records_inserted` ficou em 0, porque os atletas de teste não tinham fonte configurada de verdade) — mas o teste teve que ser refeito com atletas sintéticos dedicados e limpo depois. Ver regra 7 acima.

## Log de decisões

### D-001 — Remover DELETE destrutivo do monitor-runner + travar RPCs de claim
- **Status**: APROVADA pelo chat e EXECUTADA e VERIFICADA em 26/09/2026.
- **O quê foi feito**: (1) removido `results.delete()` de `processArchiveJob` (v58→v59, SHA `03b77a63ae7ce97b5e23dd405e1dac21f53aa54ab2456e529be064f59fb86162`, diff programático confirmou remoção exata de 7 linhas, nada mais mudou); (2) `REVOKE EXECUTE` de `anon`/`authenticated` em `claim_monitor_jobs`/`claim_historical_archive_jobs`, `GRANT` explícito a `service_role`.
- **Verificação**: `get_edge_function` + `has_function_privilege` confirmaram. Zero linhas de `results` tocadas.

### D-002 — Versionar em git o monitor-runner efetivamente implantado (pós D-001)
- **Status**: APROVADA pelo chat e EXECUTADA em 26/09/2026.
- **O quê foi feito**: código da v59 commitado em `commercial/supabase/functions/monitor-runner/index.ts`, commit `c65d23c0f1777a2980398a3cc7f511cc20246d08`.

### D-003 — Correlação por request_id (PROPOSTA INICIAL — SUBSTITUÍDA PARCIALMENTE PELA D-004)
- **Status**: aprovada em arquitetura pelo chat, com uma correção: a parte que previa `refresh_requests.status` persistido + trigger de reconciliação **foi substituída** pela abordagem 100% derivada da D-004 (ver abaixo). O restante do desenho original (tabela `refresh_requests`, coluna `request_id`, RPC de cancelamento por request, frontend guardando `request_id`) segue valendo e foi incorporado à D-004.

### D-004 — Implementação da correlação por request_id (arquitetura simplificada, sem status persistido)
- **Status**: etapas A, B, C, D e E EXECUTADAS. Regra de agregação de estado **APROVADA e CONGELADA** pelo chat. Etapa E revisada e **APROVADA PARCIALMENTE** (backend/identidade sintética validados; visual em navegador segue não testado, aceito como limitação de ambiente). **Merge/deploy para produção AUTORIZADO pelo chat e EXECUTADO em 27/09/2026** (ver "Etapa DEPLOY" abaixo). Etapa F continua **bloqueada**, aguardando smoke test visual do Henrique + revisão final do chat.
- **Decisões de produto já aprovadas pelo chat**: request_id é por atleta/conta (não por aba/dispositivo); duas abas enxergam o mesmo estado; pausar cancela só o request_id exibido; `request_result_refresh` reutiliza solicitação ativa em vez de criar concorrente; `cancel_result_refresh(p_athlete_id)` legado é preservado; nova RPC `cancel_result_refresh_request(p_request_id)` para o frontend novo; etapas em commits separados (A schema, B RPCs, C monitor-runner, D frontend, E validação, F limpeza de legado depois); zero linha de `results` tocada para testar; frontend novo só publica depois do backend validado.

#### Etapa A — Migration aditiva de schema (EXECUTADA E VERIFICADA)
- `CREATE TABLE public.refresh_requests` (id, athlete_id, requested_by, source_codes text[], created_at, updated_at, cancel_requested_at) — **sem coluna `status`**, por decisão do chat (evita duas fontes de verdade).
- RLS habilitado, policy `refresh_requests_select_member` (mesmo padrão de `monitor_jobs`/`historical_archive_jobs`: `EXISTS` via `athletes`+`account_members`).
- `ALTER TABLE monitor_jobs ADD COLUMN request_id uuid REFERENCES refresh_requests(id)` (nullable).
- `ALTER TABLE historical_archive_jobs ADD COLUMN request_id uuid REFERENCES refresh_requests(id)` (nullable).
- Índices em `request_id` nas duas tabelas de job, e em `refresh_requests(athlete_id, created_at desc)`.
- View `public.v_refresh_request_status` **com `security_invoker = true`** (evita repetir o problema já sinalizado pelo advisor em `v_result_timeline`, que é `SECURITY DEFINER` e bypassa RLS). Agrega `monitor_jobs` + `historical_archive_jobs` por `request_id` e calcula `derived_status`, `running_started_at` (para o timer) e `sample_error`.
- **Verificado**: RLS ativo, policy instalada, colunas criadas, `reloptions` da view confirma `security_invoker=true`, grants de SELECT herdados automaticamente para `anon`/`authenticated`/`service_role` (mesmo padrão das tabelas existentes — a proteção real é só a RLS, os GRANTs de tabela no Supabase são amplos por padrão).

#### Regra de agregação de estado — APROVADA E CONGELADA pelo chat em 26/09/2026

Fonte única: a view `v_refresh_request_status`. Nem backend (RPCs) nem frontend reimplementam esta lógica — ambos só leem `derived_status`.

**Buckets de status de job:**
- `ATIVO` = `pending`, `running`
- `FALHOU` = `failed`
- `CONCLUÍDO` = `completed`, `partial` (`partial` existe no enum `monitor_job_status` mas nenhum código atual o emite; tratado como "terminou, não é erro")
- `PARADO` = `cancelled` (status individual do job, distinto do sinal de nível de solicitação abaixo)

**Sinal de nível de solicitação:** `refresh_requests.cancel_requested_at` — carimbado pelo RPC de cancelamento no instante do clique, independente do estado dos jobs.

**Precedência (a primeira condição verdadeira decide, avaliada sobre TODOS os jobs do request_id):**

| # | Condição | `derived_status` |
|---|---|---|
| 1 | `cancel_requested_at IS NOT NULL` | `cancelled` |
| 2 | existe job `running` | `running` |
| 3 | existe job `pending` | `pending` |
| 4 | existe job `failed` | `failed` |
| 5 | existe pelo menos 1 job (nenhuma das regras acima bateu) | `completed` |
| 6 | nenhum job associado ao request_id | `no_sources` |

Justificativa completa da regra 1 e a tabela de combinações (pending/running/completed/failed/cancelled, isolados e cruzados) permanecem como registradas na proposta original desta seção — aprovadas sem alteração pelo chat, incluindo a correção de concorrência descrita na etapa C abaixo (a `UPDATE` final do runner nunca deve reviver um job já cancelado por fora).

#### Etapa B — RPCs de backend (EXECUTADA E VERIFICADA)

**`request_result_refresh(p_athlete_id uuid, p_source_codes text[] default null)`** — reescrita via `CREATE OR REPLACE` (mesma assinatura, compatível com o frontend atual):
- Antes de enfileirar qualquer coisa, verifica se já existe uma `refresh_requests` **não cancelada** com pelo menos um job `pending`/`running` associado (via `EXISTS` em `monitor_jobs`/`historical_archive_jobs` filtrado por `request_id`). Se existir, **reutiliza** essa solicitação: retorna `reused: true` e o `request_id` existente, sem inserir nada novo, sem duplicar jobs.
- Caso não exista solicitação ativa, insere uma linha em `refresh_requests` e usa o `id` gerado (`v_request_id`) para carimbar `request_id` em todo `upsert` feito em `monitor_jobs` e `historical_archive_jobs` — inclusive nos casos de `ON CONFLICT DO UPDATE` (jobs reaproveitados de uma configuração anterior também recebem o `request_id` novo).
- Resto da lógica de contagem de fontes incompletas, seleção de fontes por `source_codes`, e a mensagem de retorno para o usuário foi mantida idêntica à versão anterior — só a camada de `request_id`/reuso foi adicionada.
- A validação de `auth.uid()` + `account_members` (`ATHLETE_ACCESS_DENIED`) foi preservada sem alteração.

**`cancel_result_refresh_request(p_request_id uuid)`** — RPC nova, no mesmo estilo do `cancel_result_refresh(p_athlete_id)` legado (nomes de tabela sem qualificação de schema, `search_path='public'`):
- Valida acesso via `JOIN refresh_requests → athletes → account_members` (`REQUEST_ACCESS_DENIED` se o `request_id` não pertence a uma conta do usuário).
- `UPDATE monitor_jobs SET status='cancelled', locked_at=null, next_run_at=null WHERE request_id=... AND status IN ('pending','running')`.
- `UPDATE historical_archive_jobs SET status='cancelled', heartbeat_at=null, finished_at=now() WHERE request_id=... AND status IN ('pending','running')`.
- `UPDATE refresh_requests SET cancel_requested_at=now() WHERE id=...` — este é o carimbo que a regra de agregação (etapa A) usa para forçar `derived_status='cancelled'` imediatamente, sem esperar o runner reagir.
- `request_result_refresh(p_athlete_id)` e `cancel_result_refresh(p_athlete_id)` **legados (1 argumento) foram deixados intocados**, por decisão explícita do chat — não fazem parte da migração ainda, ficam para a etapa F (limpeza) depois que o frontend novo estiver validado em produção.

**Método de teste** (sem tocar `results`): criados atletas 100% sintéticos (contas reais só para satisfazer FK, `athlete_id` gerado, nunca reaproveitando Vinícius/André/Lorenzo) com jobs sintéticos em `monitor_jobs`/`historical_archive_jobs` simulando cada combinação de status da tabela de precedência. `auth.uid()` simulado via `select set_config('request.jwt.claim.sub', '<uuid-da-conta-de-teste>', true);` no mesmo batch da chamada RPC. Cenários testados: reuso de solicitação ativa (segunda chamada de `request_result_refresh` no mesmo atleta com jobs pending retorna `reused:true` e o mesmo `request_id`, sem duplicar linhas); nova solicitação depois de uma anterior cancelada (não reutiliza, cria `request_id` novo); `cancel_result_refresh_request` de um request de outra conta (`REQUEST_ACCESS_DENIED`); cancelamento efetivo zera `pending`/`running` para `cancelled` e carimba `cancel_requested_at`. Todos os atletas/jobs sintéticos foram apagados (`monitor_runs` → `monitor_jobs`/`historical_archive_jobs` → `athlete_source_configs`/`athlete_identifiers`/`historical_discovery_cache` → `refresh_requests` → `athletes`) e a limpeza foi conferida com contagem zero ao final. Nenhuma linha de `results` foi lida, criada ou alterada durante os testes.

#### Etapa C — Guardas de concorrência no monitor-runner (EXECUTADA E VERIFICADA, com incidente de transcrição corrigido)

**O quê foi feito**: adicionado `.eq('status','running')` como condição extra em toda `UPDATE` que faz a transição final de `running` para um status terminal (`completed`/`failed`), nos 7 pontos onde isso acontece:
1. `processArchiveJob` — conclusão antecipada quando não há eventos do atleta no arquivo histórico.
2. `processArchiveJob` — conclusão antecipada quando o lote de links já foi todo processado.
3. `processArchiveJob` — atualização de status ao final do processamento normal do lote (`completed`/`pending` conforme sobrou trabalho).
4. `processArchiveJob` — bloco `catch`, gravação de `status='failed'`.
5. `processJob` — conclusão do ramo histórico (`historical`).
6. `processJob` — conclusão do ramo não-histórico (sucesso final).
7. `processJob` — bloco `catch`, gravação de `status='failed'`.

**Por que**: sem essa guarda, se `cancel_result_refresh_request` marcasse um job como `cancelled` exatamente enquanto o `monitor-runner` estivesse processando esse mesmo job, a `UPDATE` final do runner (sem condição de status) sobrescreveria `cancelled` de volta para `completed`/`failed` — o usuário já teria visto "PAUSA SOLICITADA" corretamente (a regra 1 da agregação de estado não depende do status do job), mas o histórico do job individual mentiria depois, e pior: um job seria potencialmente reprocessado num futuro run porque seu status real não refletiria mais a intenção de parar. Com a guarda, se a `UPDATE` afetar 0 linhas (porque o status já não é mais `running`), isso é tratado como comportamento esperado de concorrência — não gera erro, não reabre o job, não reprocessa nada. `results` não é tocado por essa mudança em nenhum cenário.

**Deploy**: v59 → **v60**, SHA `a590564ef67d6ac374d5513849e144860ffbbd41c089ff0d28134fc460382b0e`. `verify_jwt: false` preservado (config original). Verificado via diff programático: o patch aplicado ao arquivo v59 localmente bate exatamente com o que foi buscado de volta do Supabase após o deploy — nenhuma outra linha mudou além das 7 guardas.

**Incidente (transparência total, pedido explícito do protocolo do chat):** ao transcrever manualmente o arquivo completo (~41KB) para o commit git da etapa C (espelho do deploy, por decisão da D-002), introduzi um erro de digitação: um `\n` literal (dois caracteres, barra invertida + "n") em vez de uma quebra de linha real dentro da função `parseEntries`, logo depois de `let m;`. Encontrei esse erro eu mesmo, antes de reportar a etapa como concluída, comparando o arquivo commitado com meu arquivo de referência local (que já tinha sido conferido byte-a-byte contra o v60 real implantado no Supabase). **A Edge Function realmente implantada (v60) nunca teve esse problema** — o erro existiu só no espelho em git, e só entre o commit da etapa C e o commit de correção seguinte. Corrigido no commit `a9eb3545f4a7e388ea7f5463d5e6e5ab09e77cb1`. **Verificação final**: busquei o conteúdo do commit de correção de volta do GitHub e fiz diff byte-a-byte contra o arquivo de referência do v60 real — resultado idêntico, sem nenhuma diferença. O mirror em git agora reflete exatamente o que está em produção.

**Lição aplicada na etapa D** (pedido do chat): em vez de transcrever manualmente, cloneei o repositório localmente (`git clone` com token, branch de trabalho), editei `App.tsx` com o editor de arquivos (substituições cirúrgicas, uma por vez), rodei o build real sobre esse clone, e fiz `git push` do próprio clone — sem digitação manual do arquivo inteiro em nenhum momento. Isso elimina a classe de erro do incidente da etapa C.

#### Etapa D — Frontend: fluxo de Atualizar guiado por request_id (EXECUTADA E APROVADA pelo chat)

**Commit**: `15a833ac18d17b1d606fd1324f1b4016ee997e3f` — `feat(results-page): fluxo de atualizacao guiado por request_id [D-004]`, arquivo único alterado: `commercial/apps/web/src/App.tsx` (30 inserções, 23 remoções).

**Resumo do que mudou** (detalhe completo na revisão anterior deste arquivo, mantido por referência): `App.tsx` passou a incluir, no `Promise.all` de `loadAthlete()` que já rodava a cada 2s, uma consulta a `v_refresh_request_status` filtrada por `athlete_id`. Essa consulta é a única fonte de verdade da busca ativa. Primeiro clique chama `request_result_refresh` (adota `request_id` novo ou `reused`); segundo clique durante `pending`/`running` chama `cancel_result_refresh_request(request_id)` — nunca mais a RPC legada por atleta inteiro. Um `ref` (`firstRequestPollRef`) evita reconstruir `completed`/`failed`/`no_sources` de uma solicitação antiga logo após reload/troca de atleta, mas permite ver qualquer estado ao vivo (incluindo `failed`) enquanto a página permanece aberta. Nenhuma mudança de CSS/layout/RPC legada.

**Build e validação (etapa D)**: `tsc -b && vite build` sem erros; 14 cenários de estado validados diretamente contra RPCs e view reais do Supabase com um atleta sintético sob uma conta real (só para satisfazer FK). Tudo limpo depois, zero linha de `results` tocada.

**Revisão cruzada do chat**: D-004 etapa D **APROVADA**, com instrução explícita de **não fazer merge/deploy para produção ainda**, e observação registrada na regra 8 (usar sempre o código versionado em git como origem, nunca transcrição manual).

#### Etapa E — Validação end-to-end (EXECUTADA PARCIALMENTE — bloqueio de rede do ambiente documentado com transparência)

**Autorização do chat**: criar exclusivamente para esta validação um usuário Auth sintético/descartável, conta sintética, `account_member` sintético, atleta sintético e configurações/fontes/jobs sintéticos necessários — nunca atletas reais, nunca tocar `results`, nunca reaproveitar conta real, nunca expor credenciais/segredos em git/HANDOFF/logs, nunca `service_role` no browser.

**Tentativa de teste de navegador real (o pedido original do chat)**:
1. Cloné a branch de trabalho localmente, configurei variáveis de ambiente do Vite (`VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` — ambas públicas, seguras para uso no cliente) e servi o build real da etapa D localmente (`vite preview`).
2. Autorizei um e-mail sintético descartável (`d004-etapa-e-sintetico@viniswim-teste.invalid`) na tabela `public.commercial_access` (o portão de autorização de cadastro do VINISWIM), status `authorized`, para permitir uma ativação de conta 100% normal por esse e-mail — sem tocar em nenhum e-mail/conta real.
3. Preparei um Chromium headless real (o mesmo binário usado pela ferramenta de automação de navegador desta sessão) para abrir a aplicação publicada nesta branch e executar o fluxo "Primeiro acesso? Ativar conta" clicando de verdade nos elementos da tela.
4. **Bloqueio encontrado**: a política de rede deste ambiente de execução (o container onde esta sessão do Code roda) nega conexões de saída para `*.supabase.co` — só permite uma lista fechada de hosts (npm, GitHub, APIs Anthropic). Confirmei isso tanto pelo erro real do navegador ("Não foi possível validar o acesso agora." ao chamar a RPC `commercial_access_state`) quanto por um teste direto de rede (`curl` contra o endpoint de Auth do Supabase, rejeitado com HTTP 403 pelo proxy de egresso por política da organização). **Isso não é um bug do código do VINISWIM** — é uma restrição do ambiente onde o Code está rodando nesta sessão. As ferramentas MCP do Supabase (usadas para tudo neste handoff) continuam funcionando normalmente porque passam pela infraestrutura da Anthropic, não pela rede local do sandbox.
5. Reportei o bloqueio ao usuário antes de prosseguir (nada foi simulado). O usuário optou por seguir sem o teste de navegador por ora, autorizando o caminho alternativo abaixo. Registrado aqui como pendência explícita: **se o usuário ampliar o acesso de rede deste ambiente no futuro, o teste de navegador de verdade pode e deve ser refeito antes do deploy final**, ver "Pendências" ao final desta seção.

**Caminho alternativo executado (autorizado pelo usuário)**: validação end-to-end de toda a máquina de estados contra o backend real, com uma identidade sintética **mais isolada e completa** do que a da etapa D — desta vez usuário Auth + conta + account_member genuinamente sintéticos (não uma conta real emprestada), criados de um jeito que exercita as triggers reais de cadastro do VINISWIM (não é um insert solto simulando dados; é o mesmo caminho que um cadastro de verdade percorre no banco):
- Autorizado o e-mail sintético em `commercial_access` (status `authorized`).
- `INSERT` em `auth.users` com esse e-mail (senha descartável, nunca usada/registrada em lugar nenhum) — isso disparou de verdade as duas triggers reais de `auth.users`: `viniswim_require_commercial_access` (`app.enforce_authorized_signup`, que checou a autorização e confirmou o e-mail automaticamente, exatamente como aconteceria num cadastro real por este VINISWIM ser um allow-list comercial) e `viniswim_on_auth_user_created` (`app.bootstrap_new_user`, que criou `profiles`, `accounts` ("Família de ETAPA E TESTE SINTETICO"), `account_members` (owner/active) e `subscriptions`, e marcou `commercial_access.status='used'`) — tudo exatamente como um usuário real ativando a conta pela tela veria acontecer no banco.
- Criado 1 atleta sintético (`ETAPA E ATLETA SINTETICO`) sob essa conta 100% sintética.
- Configurada 1 fonte (`swimsystem`) via a RPC real `save_athlete_source_config` (a mesma que a tela de Configurações chama), com `external_id`/`external_name` fictícios.
- `auth.uid()` simulado via `set_config('request.jwt.claim.sub', '<user_id sintético>', true)` para todas as chamadas de RPC subsequentes — o mesmo método já usado e aprovado nas etapas B e D.

**Resultado por item da lista pedida pelo chat:**

| # | Cenário | Resultado |
|---|---|---|
| 1 | Login normal | **NÃO TESTADO** — bloqueio de rede do ambiente (ver acima); a ativação/login real precisa do navegador chamando o Supabase Auth, o que este ambiente não permite agora. |
| 2 | Abrir atleta sintético | **NÃO TESTADO** — depende da UI em navegador (item 1). |
| 3 | Primeiro clique em Atualizar | **✓ verificado contra o backend real** (não via clique de navegador): `request_result_refresh` chamado como o usuário sintético autenticado (via `auth.uid()` simulado) retornou `request_id` novo, `queued:13`. |
| 4 | Feedback imediato do botão | **NÃO TESTADO** — é comportamento puramente visual do cliente (classe CSS `clicked` por 350ms), só observável em navegador. |
| 5 | request_id recebido/adotado | **✓** — mesmo request_id retornado pela RPC foi o único lido de volta por `v_refresh_request_status`. |
| 6 | Pending (painel/nadador parado/cronômetro não simula) | **Parcial**: dado real confirmado (`derived_status='pending'`, `running_started_at=null`) + revisão de código confirma que o cronômetro só conta a partir de `running_started_at` real; a aparência visual em si **NÃO TESTADA**. |
| 7 | Running (nadador começa/cronômetro real) | **Parcial**: `derived_status='running'` com `running_started_at` = timestamp real de início confirmado no backend; aparência visual **NÃO TESTADA**. |
| 8 | Running >20s → BUSCA DEMORADA | **Parcial**: `running_started_at` 31s no passado confirmado no backend (o limiar de 20s é aritmética pura de cliente, já revisada); aparência visual **NÃO TESTADA**. |
| 9 | Segundo clique cancela só o request atual + PAUSA SOLICITADA | **✓ verificado contra o backend real**: `cancel_result_refresh_request(request_id)` sobre uma busca `pending` com 13 jobs → todos os 13 viraram `cancelled`, `cancel_requested_at` carimbado, `derived_status='cancelled'`. O clique físico no botão **não foi simulado**; a chamada de RPC e o efeito real no banco, sim. |
| 10 | Reload em pending | **✓ por equivalência lógica**: uma "recarga" é, do ponto de vista do backend, apenas uma nova leitura sem estado do cliente — reproduzida abrindo uma nova consulta independente enquanto o request estava `pending`, com resultado idêntico. Aparência visual **NÃO TESTADA**. |
| 11 | Reload em running | Mesma equivalência lógica do item 10, com o request em `running`. Aparência visual **NÃO TESTADA**. |
| 12 | Reload após cancelled | Mesma equivalência lógica, confirmando `cancel_requested_at` e `derived_status='cancelled'` persistidos e recuperáveis por uma leitura nova e independente. Aparência visual **NÃO TESTADA**. |
| 13 | Completed: UI encerra, não fica grudado | **Parcial**: dado real confirmado (`derived_status='completed'`) + revisão de código confirma que `completed` é excluído do banner em qualquer leitura (inicial ou ao vivo); aparência visual **NÃO TESTADA**. |
| 14 | Failed: ERRO NA BUSCA só do request atual | **✓ verificado contra o backend real**: `sample_error` populado corretamente no request `failed`; o request mais recente e diferente (`completed`) não foi afetado — ver item 16. Aparência visual **NÃO TESTADA**. |
| 15 | No_sources | **✓ verificado contra o backend real**: atleta sem fonte completa, `request_result_refresh` real criou `request_id` com 0 jobs, `derived_status='no_sources'`. |
| 16 | Request antigo failed/completed não contamina tela | **✓ verificado contra o backend real**: criados em sequência, para o mesmo atleta sintético, um request `no_sources`, um `cancelled`, um `failed` (mais antigo) e por fim um `completed` (mais novo) — a consulta "última por `created_at`" (exatamente a que o frontend usa) retornou **somente** o `completed` mais recente em todas as leituras seguintes, ignorando corretamente os três anteriores. |
| 17 | Reused:true | **✓ verificado contra o backend real**: segunda chamada de `request_result_refresh` enquanto a primeira busca ainda estava ativa (`pending`) retornou `reused:true` com o **mesmo** `request_id`, `queued:0`. |
| 18 | Duas abas/sessões convergindo | **✓ por equivalência lógica**: duas leituras independentes e simultâneas de `v_refresh_request_status` ("sessão A"/"sessão B") retornaram exatamente o mesmo `request_id`/`derived_status` em todos os momentos testados, antes e depois do cancelamento — não há estado de cliente compartilhado a sincronizar, a convergência é garantida pela própria consulta. |
| 19 | Cancelamento em uma sessão refletido na outra | **✓ verificado contra o backend real**: após o cancelamento (item 9), as duas leituras independentes ("sessão A"/"sessão B") mostraram `derived_status='cancelled'` e o mesmo `cancel_requested_at`, sem qualquer sincronização manual entre elas. |
| 20 | Responsividade/layout não regrediram | **NÃO TESTADO** de forma completa — o bloqueio de rede impediu abrir a página de Resultados (onde a mudança da etapa D vive) em navegador real. Consigo confirmar que a tela de login do bundle da branch de trabalho renderiza corretamente num Chromium real (chegamos a capturar essa tela antes do bloqueio de rede aparecer no passo seguinte), mas isso não cobre a tela de Resultados. |

**Transparência conforme instrução do chat**: nenhum dos itens marcados "NÃO TESTADO" foi simulado, inferido visualmente ou marcado como aprovado. Onde o dado real do backend permite uma conclusão segura por revisão de código (marcados "Parcial"), isso está dito explicitamente, distinguindo do que foi de fato clicado numa tela.

**Limpeza (confirmada com contagem zero em cada tabela)**: apagados, nesta ordem, `historical_archive_jobs`, `monitor_jobs`, `refresh_requests`, `athlete_source_configs`, `athlete_identifiers`, o atleta sintético, `subscriptions`, `account_members`, `accounts`, `profiles`, `auth.identities`, `auth.users` e a linha de `commercial_access`. Processos locais de navegador/servidor de preview encerrados. Nenhum arquivo com chave ou segredo foi commitado (as variáveis de ambiente usadas localmente contêm só a URL do projeto e a chave publicável, que já são públicas por design — nunca `service_role`).

**Confirmação final**: `select count(*) from results where athlete_id='<atleta sintético>'` = 0. Nenhuma linha de `results` foi lida, criada, atualizada ou apagada em nenhum momento da etapa E.

**Pendências**:
- Se o usuário ampliar o acesso de rede deste ambiente (ou uma sessão futura rodar num ambiente sem essa restrição), refazer o teste de navegador real descrito nos passos 1–4 acima antes do deploy final — cobre especificamente os itens 1, 2, 4, 6–14 (aparência visual) e 20 desta lista, que hoje estão como "não testado" ou "parcial".
- Etapa F (limpeza de RPCs/legado) e merge/deploy para produção continuam **não autorizados**, aguardando decisão do chat sobre este relatório.

#### Etapa DEPLOY — Merge e publicação da D-004 em produção (EXECUTADA, aguardando smoke test + revisão final)

**Autorização do chat**: revisão da etapa E aprovada parcialmente (limitação de rede aceita como externa, não deve ser contornada de forma insegura); merge/deploy da versão já validada **autorizado**, com condições: nenhuma mudança funcional adicional junto do merge; usar exatamente o código da branch; confirmar build de novo; confirmar commit/merge efetivo; confirmar deploy do Pages; confirmar que a URL pública serve os assets certos; considerar service worker/cache/PWA; não disparar Atualizar para atleta real; não alterar `results`; não iniciar etapa F ainda.

**O que foi feito, em ordem:**
1. Conferido que `main` (`7c26358`) era exatamente o ponto de partida (`merge-base`) da branch de trabalho — **fast-forward puro, 0 commits de `main` ausentes na branch, 12 commits da branch ausentes em `main`**, todos já revisados e aprovados nas etapas A–E. Nenhuma mudança funcional adicional foi feita.
2. Rodado `npm run build:web` (`tsc -b && vite build`) sobre a árvore já mesclada, antes do push — sem erros, confirmando o build uma segunda vez conforme pedido.
3. `git push origin main` (fast-forward de `7c26358` para `13bfd7d`) — commit efetivo confirmado por `git log`/API do GitHub.
4. Workflow `Build VINISWIM Commercial App` (run `36283472312`, #105) disparado automaticamente pelo push (`paths: commercial/**`), concluído com sucesso; o bot `github-actions[bot]` commitou `ad665f5` em `app/` com o novo bundle (`assets/index-CzxNKciv.js` substituindo `assets/index-BSw2K2bF.js`, `index.html` atualizado).
5. Workflow `pages build and deployment` (run `36283498069`, #505) processou exatamente o commit `ad665f5` e concluiu com sucesso — deploy do GitHub Pages confirmado pela própria API do GitHub.
6. Lido `app/index.html` direto do repositório em `main` — confirma que a tag `<script>` aponta para `./assets/index-CzxNKciv.js`, o bundle novo.
7. Lido `app/sw.js` direto do repositório — confirma que o service worker só trata push/notificação, **não** implementa cache de `fetch`; combinado com nomes de arquivo com hash de conteúdo do Vite, não há risco de Service Worker servindo JS/CSS antigos. O único ponto sem hash (`index.html`) só teria problema com um cache de CDN/navegador muito agressivo, resolvido por um hard-refresh.
8. **Não foi possível abrir `https://viniswim.com.br/app/` nem o domínio padrão `*.github.io` a partir desta sessão** — o mesmo bloqueio de rede da regra 9 se mostrou mais amplo do que só `*.supabase.co`: nega qualquer domínio externo fora da lista fechada (npm, GitHub, APIs Anthropic), incluindo o próprio site publicado. Tentativas registradas com `WebFetch` para os dois domínios, ambas recusadas pelo proxy de egresso (`EGRESS_BLOCKED`). Por isso a confirmação visual final de que a URL pública está servindo a versão nova fica para o smoke test do Henrique, não para o Code.
9. Nenhuma chamada a `request_result_refresh`/`cancel_result_refresh*` foi feita para nenhum atleta real durante todo o processo de deploy. Nenhuma linha de `results` foi lida, criada, atualizada ou apagada.

**Roteiro de smoke test visual entregue ao Henrique** (fora deste arquivo, no bloco de retorno da conversa): login, abrir Resultados, layout, presença do botão Atualizar (sem tocar nele, para não disparar uma busca real), navegação/reload, responsividade — deliberadamente sem nenhum passo que dispare busca/importação real, conforme instrução do chat.

**Pendências**: aguardando o Henrique confirmar o smoke test visual, e o chat dar a revisão final antes de autorizar a etapa F.

#### Etapa ESTABILIZAÇÃO — achados do smoke test em produção (INVESTIGAÇÃO CONCLUÍDA, correção do bug #1 aguardando decisão sobre conflito arquitetural; nenhum código alterado ainda)

**Contexto**: o Henrique fez o smoke test na versão publicada (produção real, athlete real "Vinícius") e, apesar de instruído a não tocar em Atualizar, tocou — o que revelou, sem querer, um problema real. Investiguei tudo com SELECT puro contra o Supabase real (a mesma leitura que fiz nos logs reais do teste dele) e depois reproduzi cada achado com um atleta 100% sintético dedicado para não deixar dúvida. Nenhuma linha de código foi alterada, nenhuma migration aplicada, nenhum deploy feito, `results` não foi tocado em nenhum momento (confirmado por contagem zero antes/depois de cada teste sintético).

**1) BUG CRÍTICO DA D-004 — jobs de um request cancelado são "ressuscitados" por um request posterior**

*Onde exatamente*: `request_result_refresh`, nos dois `INSERT ... ON CONFLICT DO UPDATE`:
```sql
-- monitor_jobs
on conflict(athlete_id,source_id,job_type) do update set
  status='pending',next_run_at=now(),locked_at=null,last_error=null,updated_at=now(),request_id=v_request_id;

-- historical_archive_jobs
on conflict(athlete_id,archive_id) do update set
  status='pending',...,request_id=v_request_id;
```
Essas duas cláusulas sobrescrevem `status` e `request_id` **incondicionalmente**, sem checar se a linha existente pertencia a um request já cancelado.

*Por que acontece*: `monitor_jobs` tem `UNIQUE(athlete_id,source_id,job_type)` e `historical_archive_jobs` tem `UNIQUE(athlete_id,archive_id)` — ou seja, só pode existir **uma linha física** por combinação atleta+fonte (ou atleta+arquivo histórico), para sempre. Isso é anterior à D-004; a D-004 só acrescentou a coluna `request_id` nessa linha única. Como só existe uma linha, uma nova solicitação **precisa** reaproveitar essa mesma linha para a busca acontecer de novo — não há como criar uma linha "nova" para o mesmo atleta+fonte sem violar a constraint.

*Reprodução com dados 100% sintéticos (atleta descartável, apagado ao final, zero linha de `results` tocada)*:
1. `request_result_refresh` → request A, `queued:13`.
2. `cancel_result_refresh_request(A)` → A vira `cancelled`.
3. `request_result_refresh` de novo, imediatamente → request B, `queued:13`, `reused:false` (correto, A está cancelado então não é reutilizado).
4. **Resultado**: `v_refresh_request_status` mostra A com `derived_status='cancelled'` (correto) mas **`job_count=0`** — as 13 linhas de job que pertenciam a A foram fisicamente reatribuídas (`request_id` trocado) para B, que agora aparece com `job_count=13`.
5. Cancelar B depois **não afeta** o `cancel_requested_at` de A (isso está ok).
6. `results` = 0 linhas tocadas durante todo o teste.

*Impacto real*: não há corrupção de dados nem falha de segurança — o pior efeito é que o histórico do request A fica **enganoso** (parece que nunca teve jobs) e a garantia de "cancelar é definitivo" não é tão sólida quanto o texto "PAUSA SOLICITADA" sugere: se alguém clicar Atualizar de novo rápido, os jobs que estavam cancelados voltam a rodar sob um novo request_id, sem que isso fique visível em lugar nenhum além de uma auditoria manual como esta.

*Conflito arquitetural (reportado antes de improvisar, conforme pedido)*: as três regras que o chat pediu para o teste sintético —
- "jobs de A continuam ligados a A" (para sempre)
- "B recebe somente seus próprios jobs" (fisicamente distintos dos de A)
- "nenhum job muda de request_id"

— **não podem ser satisfeitas simultaneamente com o schema atual**, porque as constraints `UNIQUE(athlete_id,source_id,job_type)` e `UNIQUE(athlete_id,archive_id)` garantem que só existe uma linha de trabalho por atleta+fonte/arquivo. Satisfazer as três ao pé da letra exigiria permitir múltiplas linhas de job para o mesmo atleta+fonte (uma por request) — o que abriria uma porta perigosa: duas linhas do mesmo atleta+fonte poderiam ser reivindicadas (`claim_monitor_jobs`/`claim_historical_archive_jobs`) e processadas **em paralelo** por duas execuções do `monitor-runner`, e confirmei que `results` **não tem nenhuma constraint UNIQUE** (só chave primária) — ou seja, duas gravações concorrentes para o mesmo resultado poderiam criar duplicatas reais na tabela oficial. Relaxar essa constraint sem antes resolver a deduplicação de `results` seria trocar um bug cosmético por um risco real de dado duplicado.

**Duas opções, nenhuma implementada ainda — aguardando decisão do chat:**

- **Opção A (recomendada, aditiva, sem tocar nas constraints existentes)**: criar uma tabela nova, só de histórico/auditoria (ex.: `refresh_request_job_links(request_id, job_table, job_id, linked_at)`, inserção pura, nunca update), gravada toda vez que um job é associado a um request. Isso preserva rastreabilidade completa e permanente de "quais jobs cada request teve, mesmo depois de reatribuídos" sem mudar o comportamento de agendamento nem o risco de concorrência. **Não resolve** "o job nunca muda de request_id" na linha viva (isso seguiria mudando, é inerente ao modelo de linha única) — resolve a rastreabilidade histórica, que parece ser a preocupação real por trás da regra.
- **Opção B (mudança maior, não recomendada sem mais análise)**: permitir múltiplas linhas de job por atleta+fonte (uma por request), com filtro de "só uma pode estar pending/running por vez" garantido por outra constraint (ex.: unique index parcial `WHERE status IN ('pending','running')`). Resolveria as três regras ao pé da letra, mas exige repensar `claim_monitor_jobs`/`claim_historical_archive_jobs` e, antes de mexer nisso, resolver a ausência de constraint única em `results` para eliminar de vez o risco de duplicata em concorrência.

**Pergunta ao chat**: aprovar a Opção A (tabela de histórico aditiva, sem risco, resolve a rastreabilidade) para eu implementar, ou preferem outra direção? Não implementei nenhuma das duas ainda.

**2) Throughput real da busca — investigação concluída, NADA foi alterado (p_limit continua 1)**

Dados levantados, todos do Supabase real:
- `claim_historical_archive_jobs(p_limit)`: o Edge Function chama com `p_limit:1`, e a própria função RPC **limita o máximo a 3** mesmo que um valor maior fosse passado (`limit greatest(1,least(coalesce(p_limit,1),3))`) — ou seja, mesmo mudando só o parâmetro no Edge Function, o teto real é 3.
- Duração real de `processArchiveJob` **para o Vinícius (records_found=0)**: entre 0,15s e 0,7s por arquivo — muito rápido porque não encontrou nada. Isso **não representa o pior caso**: o código faz até 1 fetch da página base + 1 fetch do PDF de progressão + até 2 fetches de listas de resultado por arquivo, cada um com timeout de 18s (`quickReaderText`) — no pior caso (fontes lentas/fora do ar), um único arquivo pode levar até ~54s.
- **Limite da Edge Function (plano free confirmado no projeto)**: 150s de wall-clock por invocação, 2s de CPU por request (não conta espera de rede). Processar 3 arquivos no pior caso (~162s) **já estouraria os 150s do plano free** — ou seja, subir `p_limit` para o teto de 3 sem mais nada é arriscado por si só, pode matar a invocação no meio e deixar jobs presos em `running` até a recuperação automática de lock (3 min para arquivos históricos, 5 min para jobs de monitor).
- Frequência real do agendador externo observada nos dados do teste do Henrique: praticamente **1 vez por minuto** (intervalos de 51 a 63 segundos entre execuções), mais frequente do que o "~2 minutos" registrado anteriormente no achado FIX-002 — não sabemos por que mudou nem temos controle sobre esse agendador (é externo ao código do VINISWIM).
- Quantidade de arquivos históricos para o Vinícius: 12 (bate com os testes sintéticos anteriores). Não temos dado de qual é o máximo possível no catálogo geral.
- Comportamento se um arquivo travar/falhar: `claim_historical_archive_jobs` já recupera locks de `running` com mais de 3 minutos sem heartbeat, revertendo para `pending` com uma mensagem de erro anexada — existe uma rede de segurança, mas ela não acelera nada, só evita ficar preso para sempre.

**Conclusão desta etapa**: com o teto de 3 do RPC e o limite de 150s do plano free, **não é seguro simplesmente aumentar `p_limit` sem também colocar um orçamento de tempo dentro do próprio loop do Edge Function** (processar arquivos até estourar um limite de tempo seguro, ex. ~100s, e devolver o resto para a próxima invocação, em vez de um número fixo de arquivos). Isso é uma mudança de lógica no `monitor-runner`, não só um parâmetro — por isso não implementei nada e trago essa análise para decisão antes de qualquer mudança de throughput, conforme pedido.

**3) Cronômetro / UX — proposta (nenhuma mudança de frontend feita ainda)**

Confirmado: como cada job "roda" por menos de 1 segundo e volta para `pending`, e a tela consulta o backend a cada 2 segundos, a chance de pegar o instante exato em que algo está `running` é próxima de zero — por isso o nadador fica parado e o cronômetro em `00:00` durante os ~12 minutos reais que a busca leva.

**Proposta**: trocar a base do cronômetro de `running_started_at` (de um job específico, que quase nunca é observável) para `refresh_requests.created_at` (já exposto pela view, o instante em que a solicitação foi aceita pelo backend) — o relógio passaria a contar a partir do clique, ativo enquanto `derived_status` for `pending` OU `running`, refletindo o tempo real da solicitação como um todo, não de um job individual. O limiar de "BUSCA DEMORADA" (hoje 20 segundos) precisaria ser recalibrado para um valor compatível com a duração real observada (~12 minutos) — isso é uma decisão de produto que prefiro trazer para vocês antes de mexer no código, já que muda o que o usuário vê e quando.

**Nenhuma mudança de frontend foi feita** — isso é só a proposta pedida.

**4) "Última atualização"**: sem alteração, conforme instrução do chat — diagnóstico permanece "mostra a última conclusão real", já registrado como correto.

**5) Gráfico de Evolução (eixo Y/X)**: confirmado que a D-004 nunca tocou o componente `Evolution` — registrado aqui como problema separado, meramente para constar, **sem nenhuma ação** até a D-004 estar estabilizada.

**Limpeza**: atleta sintético de reprodução do bug #1 e todos os jobs/requests criados para o teste foram apagados; contagem zero confirmada. Zero linha de `results` tocada em toda a etapa de estabilização.

#### Etapa ESTABILIZAÇÃO — Implementação (27/09/2026)

Decisão do chat sobre o relatório acima: **throughput e cronômetro aprovados para implementação** (com as condições abaixo); **Opção A do bug #1 rejeitada** — chat pediu reformulação conceitual (REQUEST = intenção/ciclo de vida do usuário; JOB = unidade operacional reutilizável) e uma nova proposta de histórico auto-contido em `refresh_requests`, para aprovação **antes** de qualquer migração. Commits mantidos separados por assunto, nenhuma mudança extra, apenas dados sintéticos para validar.

**1) Throughput — IMPLEMENTADO e validado com dados sintéticos**

- Mudança: `commercial/supabase/functions/monitor-runner/index.ts`, `Deno.serve`, substituído o `p_limit:1` único por um loop `while(true)` que só reivindica o próximo `historical_archive_job` se sobrar orçamento seguro de tempo (`WALL_CLOCK_BUDGET_MS=150000` − `SAFETY_MARGIN_MS=20000`, exige pelo menos `PER_ARCHIVE_WORST_CASE_MS=70000` restantes). Não altera o teto de 3 da própria RPC `claim_historical_archive_jobs`, nem o comportamento de `processArchiveJob` em si.
- Commit: `d148721` (isolado, só esse arquivo).
- Deploy: `monitor-runner` v61 → **erro de transcrição detectado** (um espaço a mais em `} catch(e:any){`, diferente do arquivo git) → corrigido e reimplantado como **v62** → **verificado byte a byte** contra o arquivo git local (`diff` = vazio, idêntico).
- **Validação com dados sintéticos** (atleta descartável `eeeeeeee-0006-4000-8000-000000000f02`, apagado ao final): criadas 6 linhas `historical_archive_jobs` `pending` apontando para 6 arquivos históricos reais já existentes e ativos (nenhum arquivo novo criado). Aguardado o agendador real de produção (fora do nosso controle) invocar o `monitor-runner` v62. Resultado: **as 6 linhas foram concluídas entre 02:58:01,7 e 02:58:03,6 — menos de 2 segundos, todas na mesma invocação**, contra o comportamento antigo de ~1 arquivo por minuto (levaria ~6 minutos). `records_found=0` em todas (nome sintético não bate com nenhum atleta real, como esperado); **zero linha em `results`**. Limpeza confirmada: 0 linhas restantes em `athletes`/`athlete_identifiers`/`athlete_source_configs`/`historical_archive_jobs` para esse id; `results` do Vinícius real intocado (28 linhas, mesma contagem de antes).
- **Efeito colateral observado, não uma regressão**: a solicitação real do Vinícius (`b3db76c3-09cc-444b-a4c9-c2be09034517`, `job_count=13`) já havia concluído naturalmente **antes** deste deploy (12 arquivos entre 01:30 e 01:41, ~1/minuto, sob a v60 antiga) — não foi tocada por este teste.

**2) Cronômetro — IMPLEMENTADO e publicado**

- Mudança: `commercial/apps/web/src/App.tsx`, `ResultsPage` — o `useEffect` do cronômetro agora fica ativo quando `isPending||isRunning` (antes: só `isRunning`) e usa `activeRequest.created_at` (de `v_refresh_request_status`) como referência, em vez de `running_started_at`. Nunca reinicia localmente — é sempre `Date.now()-created_at`, então um reload da página reconstrói o mesmo tempo decorrido a partir do backend. **Limiar de "BUSCA DEMORADA" mantido em 20 segundos, sem recalibração**, conforme instrução explícita do chat — agora medido sobre o tempo total da solicitação (fila + execução), não só sobre execução.
- Build local (`tsc -b && vite build`) validado sem erros antes do commit.
- Commit: `a88ff2f` (isolado, só esse arquivo).
- Deploy: push → workflow "Build VINISWIM Commercial App" run #107 (`36290292112`) concluído com sucesso → commit automático do bot `0566915` → `app/index.html` confirmado servindo `index-B__VpIsC.js` (hash igual ao build local).
- **Não alterado nesta etapa** (fora do escopo aprovado): o texto "Última atualização" (achado técnico já levantado — `monitor_jobs.last_run_at` é regravado a cada invocação de reconciliação do job `historical`, mesmo sem trabalho novo concluído, o que pode estar por trás da reclamação do usuário de que o texto "diz que atualizou" sem ter atualizado; meu diagnóstico anterior de "sem bug" precisa ser revisto à luz disso — **fica para decisão do chat**, não fiz nenhuma mudança); o gráfico de Evolução (eixos), que segue explicitamente fora do D-004 até estabilização completa.

**3) Bug #1 (reassociação de jobs) — NOVA proposta de design, para aprovação do chat, NADA implementado**

Reformulação aceita: `historical_archive_jobs`/`monitor_jobs` continuam sendo a **unidade operacional reutilizável** (uma linha física por atleta+fonte, reaproveitada a cada solicitação — isso não muda, e não deveria). O que precisa mudar é que `refresh_requests` (a **intenção do usuário**) pare de depender de um `JOIN` ao vivo em `request_id` para saber sua própria história, porque esse `request_id` pode ser sobrescrito por uma solicitação futura assim que a atual for cancelada.

**Mecanismo proposto (aditivo, só em `refresh_requests` + as duas RPCs existentes, nenhuma tabela nova):**

- **Novas colunas em `refresh_requests`**: `job_count int not null default 0`, `completed_job_count int`, `failed_job_count int` (as duas últimas nulas até o request ser cancelado ou concluído naturalmente).
- **`request_result_refresh`**: já calcula `v_count` e `v_archive_count` (linhas afetadas pelos dois `INSERT ... ON CONFLICT`) — hoje isso só vai para a resposta JSON da chamada. Passa a também gravar `job_count = v_count + v_archive_count` na própria linha de `refresh_requests`, no momento da criação. Esse número fica **congelado para sempre** — não depende mais de contar `monitor_jobs`/`historical_archive_jobs` pelo `request_id` (que pode mudar de dono depois).
- **`cancel_result_refresh_request`**: no momento exato do cancelamento (antes de qualquer solicitação futura poder existir, porque o usuário só pode clicar de novo depois de cancelar), faz um `SELECT count(*) FILTER (WHERE status='completed')`, `count(*) FILTER (WHERE status='failed')` nas linhas que **ainda** têm `request_id = p_request_id` nesse instante — e grava esse retrato final em `completed_job_count`/`failed_job_count` antes de marcar `cancel_requested_at`. Esse instante é sempre confiável porque nenhuma outra solicitação para o mesmo atleta pode ter roubado essas linhas ainda (a própria `request_result_refresh` já impede duas solicitações ativas simultâneas para o mesmo atleta).
- **`v_refresh_request_status`**: para uma solicitação **cancelada**, o `job_count` (e um eventual detalhamento "X de Y concluídos antes do cancelamento") passa a vir só dessas colunas congeladas — nunca mais de um `JOIN` ao vivo. Para uma solicitação **ativa** (não cancelada), nada muda: continua seguro fazer o `JOIN` ao vivo em `request_id`, porque por construção não pode existir uma segunda solicitação ativa para o mesmo atleta roubando essas linhas enquanto a primeira não for cancelada.
- **Por que isso resolve o problema sem quebrar a reutilização**: a linha física do job continua podendo (e devendo) ser reaproveitada pela próxima solicitação — isso é o comportamento correto e não muda. O que muda é que a solicitação cancelada **não perde sua própria verdade histórica** ("eu pedi 13, e no instante em que fui cancelada, 4 já tinham terminado") só porque a linha física foi reaproveitada depois. Nenhuma constraint existente é tocada, nenhum risco novo de concorrência é introduzido (o `SELECT` de congelamento acontece estritamente antes de qualquer reuso possível).
- **O que NÃO resolve, por decisão consciente**: não impede que os jobs de uma solicitação cancelada continuem sendo processados sob o `request_id` da solicitação nova (isso é o reaproveitamento correto do JOB, não um bug) — só garante que a solicitação antiga tenha um registro fiel e permanente do que aconteceu **até o momento em que ela deixou de ser dona**.

**Pergunta ao chat**: aprovar este mecanismo (2-3 colunas novas em `refresh_requests`, ajuste nas duas RPCs existentes, ajuste na view — tudo aditivo/reversível) para eu escrever a migration, ou pedir ajustes antes? Nenhuma migration foi escrita ou aplicada — aguardando aprovação explícita, conforme pedido.

**Limpeza desta etapa**: atleta sintético `eeeeeeee-0006-4000-8000-000000000f02` e todas as linhas associadas (4 tabelas) apagados e confirmados em zero. `results` do Vinícius real intocado durante toda a etapa (28 linhas, antes e depois).

#### Etapa ESTABILIZAÇÃO — Revisão do chat sobre o bug #1 e investigação do "Última atualização" (27/09/2026)

**Chat aprovou a proposta acima com um ajuste de princípio**: não congelar só no cancelamento — **todo estado terminal** (`cancelled`, `completed`, `failed`, `no_sources`) deve persistir seu resultado final em `refresh_requests` e a view nunca mais deve recalcular um request terminal a partir dos jobs (que podem ter sido reaproveitados). Enquanto `pending`/`running`, a view continua calculando ao vivo — isso não muda. Chat também pediu que eu resolva **como** `completed`/`failed` serão congelados de forma confiável (não há um clique do usuário nesses casos, ao contrário do cancelamento) antes de escrever a migration, e um plano de teste obrigatório com as 4 transições terminais.

**Como funciona hoje (lido direto da view, `pg_get_viewdef`)**: `v_refresh_request_status` é 100% recalculada a cada consulta — `cancelled` se `cancel_requested_at` não for nulo; senão `running`/`pending` se algum job estiver nesse estado; senão `failed` se algum job falhou; senão `completed` se existir pelo menos 1 job; senão `no_sources`. Não existe hoje nenhum gatilho/trigger — é só uma agregação ao vivo.

**Os 3 "momentos de terminalidade" e onde congelar cada um:**

1. **`no_sources`** — na real já é conhecido **na criação**: se `v_count+v_archive_count=0` dentro de `request_result_refresh`, o request nunca teve job nenhum. Não precisa de trigger — grava `terminal_status='no_sources'`, `finalized_at=now()` **na mesma inserção**.
2. **`cancelled`** — momento exato é a própria chamada de `cancel_result_refresh_request`, que **já** marca os jobs daquele `request_id` como `status='cancelled'` (achado novo, relendo a função: eu tinha registrado antes só que `cancel_requested_at` era setado, mas a função também cancela os jobs — a "ressurreição" acontece depois, quando o `UPSERT` da próxima solicitação sobrescreve esse `status='cancelled'` de volta para `'pending'`). Como nenhuma segunda solicitação pode existir antes do cancelamento acontecer, o `COUNT` de `completed`/`failed` feito **dentro da mesma função, antes do UPDATE final** é sempre confiável.
3. **`completed`/`failed`** — não há uma chamada RPC nesse instante (é o `monitor-runner` que, ao terminar de processar o último job de um request, faz esse request "virar" terminal de forma assíncrona). **Mecanismo mínimo proposto**: dois triggers `AFTER UPDATE` (um em `monitor_jobs`, um em `historical_archive_jobs`), disparando **só** quando `NEW.status IN ('completed','failed') AND OLD.status IS DISTINCT FROM NEW.status` (não dispara em heartbeat, não dispara em `pending`/`running`/`cancelled`). A função do trigger: olha `NEW.request_id`; se nulo, não faz nada; conta quantos jobs desse `request_id` ainda estão `pending`/`running` — se algum, não é terminal ainda, não faz nada; se nenhum, calcula `completed`/`failed` (falha vence se houver ao menos 1) e grava com `WHERE id=NEW.request_id AND finalized_at IS NULL AND cancel_requested_at IS NULL` (dupla trava de idempotência: nunca sobrescreve um request já congelado, nunca disputa com um cancelamento).
   - **Por que é seguro e mínimo**: não é polling, não é cron, dispara exatamente 1x por request (a trava `finalized_at IS NULL` garante isso mesmo se dois jobs do mesmo request terminarem quase ao mesmo tempo — o segundo UPDATE não casa nenhuma linha). Não introduz nenhuma tabela nova, nenhuma fila, nenhum job assíncrono adicional — é só uma extensão do que já é feito hoje na mesma transação do `UPDATE` que o `monitor-runner` já executa.
   - **Colunas necessárias em `refresh_requests`** (substituindo a proposta anterior, mais completa): `job_count int not null default 0`, `terminal_status text` (nulo enquanto ativo; `cancelled`/`completed`/`failed`/`no_sources` quando terminal), `completed_job_count int`, `failed_job_count int`, `finalized_at timestamptz` (nulo enquanto ativo — funciona como trava de idempotência e como "timestamp de finalização").
   - **View revisada**: `derived_status` passa a ser `CASE WHEN finalized_at IS NOT NULL THEN terminal_status WHEN cancel_requested_at IS NOT NULL THEN 'cancelled' WHEN <agregação ao vivo de hoje> END` — ou seja, um request terminal **nunca mais** é recalculado a partir do `JOIN`; um request ainda ativo continua exatamente como hoje.

**Plano de teste obrigatório (nenhum ainda executado — só desenhado, aguardando aprovação do mecanismo acima antes de implementar e testar)**: para cada uma das 4 transições (`cancelled→B`, `completed→B`, `failed→B`, `no_sources→B`), com atleta 100% sintético dedicado e mesmas fontes: (1) rodar A até o estado terminal alvo; (2) capturar `job_count`/`terminal_status`/`completed_job_count`/`failed_job_count`/`finalized_at`/`created_at`/`updated_at` de A; (3) disparar B imediatamente nas mesmas fontes; (4) reconsultar A e comparar **campo a campo** com o que foi capturado no passo 2 (deve ser idêntico); (5) confirmar que a linha física do job foi reaproveitada por B (mesma `id` de `monitor_jobs`/`historical_archive_jobs`, `request_id` agora = B); (6) confirmar B evolui normalmente; (7) confirmar `results` com zero linha alterada em todo o teste. `failed` sintético exige forçar uma fonte inválida/indisponível de propósito (sem tocar em atleta real) — vou precisar de uma fonte de teste que falhe de forma controlada (ex.: `source_url` apontando para um domínio inexistente) para provocar o estado `failed` sem depender de uma falha real de terceiros.

**Pergunta ao chat**: aprovar especificamente o mecanismo dos 2 triggers (`AFTER UPDATE ... WHEN status IN ('completed','failed')`) como a forma de congelar `completed`/`failed`, e as 5 colunas listadas acima, para eu escrever a migration e rodar a bateria de 4 testes? Nada foi implementado ainda.

**4) "Última atualização" / `last_run_at` — investigação concluída (autorizada pelo chat), NENHUMA correção feita**

Todos os pontos que escrevem `monitor_jobs.last_run_at` (grep no `monitor-runner/index.ts`):
- Linha 523 (dentro do branch `job_type='historical'`): grava `last_run_at=now()` **toda vez que o job de reconciliação histórica é executado**, em `pending` (ainda há arquivos por processar) OU `completed` (não há mais) — ou seja, dispara a cada reconciliação, **independente de ter encontrado ou importado algo novo naquele passo**.
- Linha 556: código **morto** (depois de um `return` inalcançável no mesmo branch) — não executa nunca, mas ainda está no arquivo; não é bug em produção, é só lixo de código a ser removido num commit de limpeza separado, se aprovado.
- Linha 587 (branch não-histórico, ex. `swimsystem`/genérico): grava `last_run_at=now()` ao **concluir** a única execução daquele tipo de job — aqui sim reflete "essa fonte rodou até o fim agora", sem o mesmo problema.
- Frontend (`App.tsx:224`): `lastSync = MAX(monitor_jobs.last_run_at)` entre **todas** as linhas de `monitor_jobs` do atleta (todas as fontes/tipos), exibido como "Última atualização".

**Diagnóstico**: para o tipo `historical` (que é o que a busca "Atualizar" realmente aciona), `last_run_at` mede "a última vez que o agendador tocou no job de reconciliação", não "a última vez que algo novo foi confirmado/importado". Como a reconciliação acontece a cada invocação do `monitor-runner` enquanto restarem `historical_archive_jobs` (e agora, com o throughput corrigido, pode acontecer várias vezes seguidas), o rótulo "Última atualização" fica **quase sempre recente durante toda a busca**, mesmo que nada tenha sido encontrado ainda — o que bate com a reclamação do usuário de que o texto parece "mentir".

**4 semânticas possíveis, para o chat escolher**:
- (a) *último clique*: `refresh_requests.created_at` do request mais recente — já temos, sem mudança.
- (b) *última execução da fonte* (comportamento **atual**): `monitor_jobs.last_run_at` — mede atividade do agendador, não resultado.
- (c) *última busca concluída*: precisaria do `finalized_at` de um `refresh_requests` com `terminal_status='completed'` (depende da migration do item 3 acima) — mede "a última vez que uma busca inteira terminou", ainda sem garantir que achou algo novo.
- (d) *último resultado novo confirmado*: `MAX(result_sources.retrieved_at)` para os resultados do atleta — **dado que já existe hoje, sem nenhuma migration**, gravado exatamente no momento em que um resultado é inserido, promovido a oficial, ou confirmado por qualquer fonte (todos os caminhos de `processArchiveJob`/`processJob` já fazem upsert em `result_sources` com `retrieved_at=now()`). É a semântica que mais parece bater com a expectativa do usuário ("me diga quando algo realmente mudou"), e é a única das 4 que não depende da migration do bug #1.

**Proposta preliminar (não implementada, aguardando decisão)**: trocar a fonte de "Última atualização" no frontend de `monitor_jobs.last_run_at` para `MAX(result_sources.retrieved_at)` do atleta (semântica **d**) — zero migration, só troca a query do `App.tsx`. Se o chat preferir a semântica (c) ("busca concluída"), fica dependente da migration do item 3 estar aprovada e aplicada primeiro.

#### Etapa ESTABILIZAÇÃO — Migration do bug #1 aplicada e validada com 4 testes sintéticos (27/09/2026)

Chat aprovou o mecanismo dos 2 triggers com ajustes de precedência e proteção (ver revisão anterior) e pediu a bateria de 4 testes antes de qualquer outra etapa. **Migration aplicada, corrigida em campo, e os 4 cenários passaram.**

**Migrations aplicadas (Supabase, projeto `cdtvhagbgiwnjkgninqn`):**
- `refresh_requests_terminal_snapshot`: colunas `job_count`, `terminal_status` (com `CHECK` para os 4 valores válidos), `completed_job_count`, `failed_job_count`, `finalized_at` em `refresh_requests`; `request_result_refresh` (2 args) passa a congelar `job_count`/`no_sources` na criação; `cancel_result_refresh_request` passa a congelar `cancelled` + contagem completed/failed no instante do cancelamento; nova função `finalize_refresh_request_if_terminal()` + 2 triggers `AFTER UPDATE` (`monitor_jobs`, `historical_archive_jobs`) que congelam `completed`/`failed` quando não sobra `pending`/`running` para o request; `v_refresh_request_status` revisada para preferir o snapshot quando `finalized_at is not null`.
- **Erro pego em teste, antes de qualquer uso real**: a primeira versão do `cancel_result_refresh_request`/`finalize_refresh_request_if_terminal` fazia `UNION` entre `monitor_jobs.status` (enum `monitor_job_status`) e `historical_archive_jobs.status` (text) sem cast, o que o Postgres rejeita (`UNION types ... cannot be matched`). Corrigido na migration `fix_terminal_snapshot_status_cast` (adiciona `::text` nos dois lados), antes de qualquer request real ter passado por esse caminho — só afetou o teste sintético em andamento, que foi refeito com sucesso depois da correção.

**Os 4 testes obrigatórios, todos com atleta 100% sintético dedicado (apagado ao final), fonte real (`fdap`, arquivos já existentes) exceto no caso `failed`:**

| Cenário | Request A | job_count | completed | failed | terminal_status | A mudou após B? | B reaproveitou as linhas? |
|---|---|---|---|---|---|---|---|
| `no_sources→B` | congelado na criação (0 fontes válidas) | 0 | — | — | `no_sources` | **Não** (finalized_at/created_at/updated_at idênticos) | N/A (sem jobs) |
| `completed→B` | 12 arquivos reais, todos completaram | 12 | 12 | 0 | `completed` | **Não** | **Sim**, mesmos 12 ids de `historical_archive_jobs`, `request_id`→B, `status`→`pending` |
| `cancelled→B` | cancelado imediatamente (mesma transação da criação, 0 jobs chegaram a rodar) | 12 | 0 | 0 | `cancelled` | **Não** | **Sim**, mesmos 12 ids reaproveitados |
| `failed→B` | 12 arquivos reais + 1 job injetado contra arquivo com URL inválida (`https://invalid.nonexistent.viniswim-test.invalid/`, fixture `historical_archives` inativa, apagada ao final) | 13 | 12 | 1 | `failed` (**falha vence sobre sucesso**, conforme regra de precedência) | **Não** | Os 12 reais reaproveitados por B; o job quebrado não (arquivo inativo, fora do `INSERT..SELECT` do RPC) — esperado |

Em todos os 4 casos: comparação campo a campo de A (job_count/terminal_status/completed_job_count/failed_job_count/finalized_at/created_at/updated_at) antes e depois de criar B veio **idêntica**; B funcionou normalmente em todos; a reutilização operacional da linha física (mesma `id` de `historical_archive_jobs`) ocorreu exatamente como esperado, sem que isso alterasse o snapshot de A. Erro de DNS do job injetado (`failed to lookup address information`) confirma que o `failed` foi uma falha real de rede, não um erro do código de teste.

**Limpeza**: 5 atletas sintéticos (`eeeeeeee-0007-...-f01` a `f05`), seus `athlete_source_configs`/`athlete_identifiers`/`historical_archive_jobs`, todos os `refresh_requests` criados nos 4 testes, e a fixture `historical_archives` do arquivo quebrado — todos apagados, contagem zero confirmada em cada tabela. `results` do Vinícius real: 28 linhas antes e depois, intocado.

**Pendências que dependem desta migration, ainda não implementadas**: (1) frontend "Última atualização" com a semântica que o chat escolher — se for a opção (c) ("última busca concluída com sucesso"), agora já é possível via `terminal_status='completed'` + `finalized_at`; (2) nenhuma mudança de frontend foi feita ainda para isso.

#### Etapa ESTABILIZAÇÃO — "Última atualização" implementada, validada e publicada (27/09/2026)

Chat definiu a semântica final: **última busca concluída com sucesso** (`terminal_status='completed' AND finalized_at IS NOT NULL`, `MAX(finalized_at)` por atleta). Sem nenhum request `completed`, mostra o estado neutro já existente ("—"). Implementação **só de frontend** (`App.tsx`), sem migration, sem RPC nova, respeitando RLS normal (a query usa `v_refresh_request_status`, já filtrada por RLS de `refresh_requests`).

**Mudança**: `loadAthlete()` passou a buscar `select finalized_at from v_refresh_request_status where athlete_id=X and terminal_status='completed' order by finalized_at desc limit 1`, guardado em um novo estado `lastSuccessfulSync`; `lastSync` (usado no texto "Última atualização") passou a vir desse estado em vez de `MAX(monitor_jobs.last_run_at)`. Nenhuma outra linha tocada; código morto identificado antes (linha 556 do `monitor-runner`) **não foi limpo**, conforme instrução explícita do chat.

**Validação sintética (9 pontos, todos passaram)**, com 3 atletas dedicados (`eeeeeeee-0008-...-a001/a002/a003`, apagados ao final) e a mesma query exata usada pelo frontend:
1. `T1` (completed) congelado para `a001` → query retorna `T1`.
2. `failed` posterior (job injetado contra arquivo com URL inválida, 12 reais + 1 quebrado) → query continua retornando `T1` (não mudou).
3. `cancelled` posterior (mesma transação da criação) → query continua `T1`.
4. `no_sources` posterior (config desativada temporariamente, reativada em seguida) → query continua `T1`.
5. Novo `completed` (`T2`) → query passa a retornar `T2`, confirmado `T2 > T1`.
6. Reload: como a query é sempre recalculada a partir de dados persistidos (`finalized_at` já congelado pela migration anterior), não há estado local para "perder" — garantido pela própria natureza stateless da consulta, sem necessidade de teste de UI separado.
7. Isolamento entre atletas: `a002` manteve seu próprio `completed` inalterado (valor diferente de `T1`/`T2` de `a001`) durante todo o teste.
8. Atleta sem nenhum `completed` (`a003`) → query retorna **zero linhas** (estado neutro "—").

**Build local** (`tsc -b && vite build`) validado sem erros antes do commit. **Commit**: `f945287` (isolado, só `App.tsx`). **Deploy**: workflow "Build VINISWIM Commercial App" run #108 (`36304208665`) concluído com sucesso → commit automático do bot → `app/index.html` confirmado servindo `index-CtOzl5EU.js` (hash idêntico ao build local pós-edição, confirmando que o código publicado é exatamente o commitado).

**Limpeza**: 3 atletas sintéticos + 2 fixtures de arquivo quebrado (`...b1`, `...b2`) apagados, contagem zero confirmada em `athletes`/`athlete_source_configs`/`athlete_identifiers`/`historical_archive_jobs`/`refresh_requests`/`historical_archives`. `results` do Vinícius real: 28 linhas, intocado durante toda a etapa.

**Próximo passo (aguardando o usuário, não o Code)**: smoke test manual real, decidido e executado por Henrique quando quiser — Atualizar → cronômetro conta desde a solicitação → processamento termina → "Última atualização" reflete a conclusão bem-sucedida. Code não dispara esse teste. **Etapa F continua bloqueada até o resultado desse smoke test.** Gráfico de Evolução continua registrado e fora de escopo.

#### Etapa ESTABILIZAÇÃO — Smoke test real do Henrique + correção de UX (27/09/2026)

Henrique executou o smoke test no atleta real (Vinícius) e mandou 5 capturas de tela + 1 follow-up. Reconstrução via SQL (só leitura, nenhuma ação) confirmou tudo tecnicamente correto:

- **04:55:16** clique em Atualizar → request criado (13 itens: 1 monitor_job SwimSystem + 12 `historical_archive_jobs` fdap).
- **04:55:~36** atingiu 20s → BUSCA DEMORADA (relógio congela em 00:20 na tela, como já era esperado pelo design existente).
- **04:57:09** Henrique tocou o ícone Atualizar de novo enquanto a busca ainda estava ativa → como o botão **cancela** quando já há busca em andamento (comportamento pré-existente da D-004, não desta etapa), isso **cancelou** a 1ª busca. Nesse instante, 12 de 13 itens já tinham terminado — ficou congelado nesse request para sempre, confirmando o fix do bug #1 funcionando com dado real e orgânico (as linhas físicas foram reaproveitadas pela 2ª busca 5s depois sem alterar esse snapshot).
- **04:57:14** nova busca criada, completou com sucesso às **05:00:10** (13/13, 0 falhas, 0 resultados novos encontrados — normal).

**Achado de UX real (não é bug de dado)**: Henrique tirou uma nova captura às 05:06, depois de ter clicado Atualizar mais duas vezes (05:04:39 cancelada em 4/13; nova busca criada 05:05:09, ainda ativa/demorada às 05:06). A tela mostrava simultaneamente `"Última atualização: 27/09/2026, 05:00:10"` (correto — última busca `completed`) **e** `BUSCA DEMORADA` de uma busca nova ainda em andamento. Reação do Henrique: pareceu que o horário estava "preso"/fake. **O dado estava certo; a apresentação confundia.**

**Decisão do chat**: não alterar semântica/backend (a fonte continua `MAX(finalized_at)` com `terminal_status='completed'`, sem mudança de query). Correção **só de frontend/UX**:
1. Rótulo trocado de "Última atualização" para **"Última busca concluída"**.
2. Quando há busca ativa (`pending`/`running`), o título principal passa a ter prioridade visual sobre o estado atual, combinado com o cronômetro: **"BUSCA EM ANDAMENTO · 00:12"** e, após 20s, **"BUSCA DEMORADA · 00:20"** — substitui o texto genérico "Buscando novos resultados..." e o cronômetro separado só nesse caso. `cancelled`/`failed` mantêm a apresentação anterior (fora do escopo).

**Implementação**: `commercial/apps/web/src/App.tsx`, duas linhas alteradas (o texto do rótulo `results-sync-meta`, e o `<b>` dentro de `swim-status-copy` condicionado por `isActive`/`slow`, reaproveitando o `syncClock` já existente — nenhuma lógica de cronômetro ou de dado tocada). Build local validado sem erros. **Commit**: `e53923a` (isolado). **Deploy**: workflow "Build VINISWIM Commercial App" run #109 (`36306366882`) concluído com sucesso → `app/index.html` confirmado servindo `index-DFyes9F2.js` (hash igual ao build local pós-edição).

**Nenhuma mudança de backend/migration/RPC/monitor-runner nesta correção.** `results` do Vinícius: nenhuma ação de Code, contagem intocada durante toda a etapa.

**Próximo passo**: Henrique fará um novo smoke test visual para confirmar a apresentação corrigida. **Etapa F continua bloqueada** até a decisão do chat após esse teste.

## D-004 — ENCERRADA E APROVADA EM PRODUÇÃO (27/09/2026)

Smoke test final (busca `99fa804f`, 08:30:39→08:33:04 UTC, 13/13, 0 falhas, sem cancelamento) aprovado pelo chat. Todos os critérios de aceite confirmados: cronômetro desde a solicitação, BUSCA DEMORADA em 20s, throughput corrigido, bug de reassociação de jobs corrigido (snapshot terminal imutável), "Última busca concluída" com semântica correta e prioridade visual ao estado atual, `results` reais intocados (28 linhas) durante toda a etapa. **Nenhuma mudança adicional autorizada na D-004 a partir de agora.**

Etapa F (limpeza de legado) **continua adiada** — não iniciar.

## Nova frente — Gráfico de Evolução (27/09/2026): INVESTIGAÇÃO, sem código/banco alterado

Henrique reportou dois problemas: (1) eixo Y crescendo/escalando de forma inadequada; (2) eixo X não diferenciando categorias. Chat autorizou **somente investigação** (SELECT read-only permitido), nada de código, banco, migration, `results` ou etapa F.

**Componente**: `Evolution()` em `commercial/apps/web/src/App.tsx` (linhas ~318-379). Dados vêm de `v_result_timeline` (view: `results` + `meets` + `athletes`, com `category` = `COALESCE(r.category, calculado por idade na data do resultado)` — a categoria por resultado já vem correta da view).

**Causa raiz — eixo Y**: o domínio (`yMin`/`yMax`, com margem de 12%) é calculado a partir de `times`, que é a lista de tempos de **todos os resultados selecionados juntos** — quando o filtro "Todos os estilos" está ativo (padrão), tempos de provas de naturezas muito diferentes (ex.: 50 Livre ~32-49s vs 200 Livre ~227-242s, dados reais do Vinícius) dividem o mesmo eixo linear. Isso esmaga visualmente a variação real dentro de uma prova só (ex.: uma queda de quase 18s no 50 Livre ocupa menos de 8% da altura do gráfico quando o 200 Livre está no mesmo eixo). O filtro de piscina (SCM/LCM) tem o mesmo problema: por padrão mistura as duas, e SCM costuma ser mais rápido que LCM na mesma prova só por causa das viradas — o gráfico pode parecer mostrar "piora" que é só troca de piscina. Não há tratamento de outliers nem normalização — é soma bruta de milissegundos convertida em segundos.

**Causa raiz — eixo X / categorias**: o eixo X é literalmente a lista de `result_date` únicos (formatados como `DD/MM/AAAA` via `d()`), sem nenhuma segmentação por categoria. A categoria **existe corretamente por resultado** (confirmada nos dados reais: Vinícius tem resultados como `Mirim II` até 2025-11-08 e como `Petiz I` a partir de 2026-03-08 — mudança de categoria real e já registrada), mas o componente só usa `category` como filtro de dropdown e como legenda no tooltip — nunca como dimensão visual do eixo. Uma mesma prova (ex.: 50 Costas) é desenhada como uma única linha contínua atravessando a transição de categoria sem nenhuma marca visual.

**Achado adicional (fora do gráfico, na camada de dados — não é bug do componente)**: encontrados pelo menos 2 casos reais de resultados praticamente duplicados para o mesmo atleta+prova, cada um com `meet_id` diferente e `source_id` diferente (`swimsystem` vs `fdap`) — ex.: 50 Livre em 2025-09-14 com 49,78s (fonte SwimSystem) e 32,08s (fonte FDAP) sob dois `meets` distintos com nomes parecidos; 100 Livre com o mesmo tempo exato (1'45"58) sob duas competições diferentes em datas diferentes. Indício de que a mesma competição real, capturada por duas fontes diferentes, gera duas linhas de `meets`/`results` sem deduplicação entre fontes. Isso não é causado pelo componente do gráfico — é upstream, na importação — mas o gráfico hoje **não lida bem** com isso: quando há 2 resultados para a mesma prova na mesma data, o código simplesmente sobrescreve (`row[pointKey]=...` dentro do `forEach`), então um dos dois desaparece silenciosamente do gráfico, e qual dos dois "vence" depende só da ordem de importação (`created_at`), não de nenhum critério significativo (ex.: qual é oficial, qual é a fonte mais confiável). **Não fiz nada a respeito** — só registrando para vocês decidirem se isso é uma frente de deduplicação de `meets`/`results` separada.

**Resumo das demais perguntas do checklist**:
- `tickFormatter`: usa `formatSwimTime` (mesmo formatador do resto do app) — ok, sem problema aqui.
- Unidade interna: milissegundos no banco, convertidos para segundos só para o eixo (`time_ms/1000`) — consistente, sem bug de unidade.
- Padding: sim, 12% de margem (ou ±3% quando só há 1 ponto) — aplicado sobre o domínio já distorcido pela mistura de provas.
- Orientação do eixo Y (tempo menor = melhor, deveria "subir" visualmente?): **hoje o eixo NÃO é invertido** — tempo menor fica embaixo, tempo maior fica em cima (matematicamente correto, mas pode não bater com a expectativa "melhorar = subir no gráfico" comum em gráficos de performance esportiva). **Isso é uma decisão de produto, não técnica — precisa da decisão do Henrique/chat.**
- Mobile: `.chart{height:300px}` (`360px` no desktop), `ResponsiveContainer` escala a largura; `XAxis interval="preserveStartEnd"` esconde ticks intermediários automaticamente em tela estreita — comportamento padrão do Recharts, não é um bug novo, mas piora a falta de sinal de categoria (menos texto visível ainda).

**Proposta objetiva de correção (não implementada, para aprovação)**:
1. **Eixo Y**: quando mais de uma prova estiver visível ao mesmo tempo ("Todos os estilos"), não usar um único domínio absoluto em segundos para todas — opções a decidir: (a) manter "Todos os estilos" só como visão geral e exigir 1 prova selecionada para ver evolução detalhada (comportamento próximo do atual, só reforçando via UX); (b) escala relativa por prova (% do melhor tempo pessoal daquela prova) em vez de segundos absolutos quando várias provas estão visíveis; (c) piscina (SCM/LCM) nunca misturada por padrão no cálculo do domínio.
2. **Eixo X / categoria**: marcar visualmente a transição de categoria no eixo X (linha de referência vertical + rótulo no ponto de mudança), mantendo a granularidade de data — não precisa recalcular nada no banco, só usar o `category` que a view já entrega corretamente por resultado.
3. **Duplicatas**: fora do escopo do gráfico — recomendo abrir como frente própria de dados (deduplicação de `meets`/`results` entre fontes), não misturar com a correção visual.

**Ambiguidades de produto para decisão de vocês/Henrique**: (a) inverter o eixo Y (melhor = mais alto) ou manter como está; (b) o que fazer visualmente quando várias provas de escalas muito diferentes estão selecionadas ao mesmo tempo; (c) se a duplicação de resultados por fonte é uma frente separada a priorizar antes ou depois do gráfico.

**Nenhum código, banco, migration ou `results` foi alterado nesta investigação.** Todas as consultas foram `SELECT` read-only.

### Gráfico de Evolução — regras de produto aprovadas pelo chat + proposta técnica (27/09/2026)

Chat aprovou o diagnóstico e definiu 9 regras de produto (uma prova por gráfico, eixo Y em tempo real invertido — menor tempo mais alto —, domínio local sem forçar zero, SCM/LCM como séries independentes, marcação de transição de categoria sem quebrar a série, eixo X cronológico com ordenação determinística, duplicatas nunca somem silenciosamente mas sem inventar precedência, mobile ok). Deduplicação SwimSystem×FDAP fica como frente própria, não mexida agora. **Nada implementado ainda — proposta técnica enviada para aprovação antes do código:**

1. **Filtro que seleciona a prova**: o dropdown `event` já existente passa a ser obrigatório/central; a opção "Todos os estilos" (que hoje combina várias provas na mesma linha/eixo) é removida.
2. **Comportamento inicial**: ao abrir Evolução, seleciona automaticamente a prova com mais resultados válidos do atleta (empate por ordem alfabética do rótulo) — sem exigir clique extra. Sem nenhum resultado válido, mantém o estado vazio já existente.
3. **Domain/padding do Y**: mantém a fórmula já existente (margem de 12%, ou ±3% quando só há 1 valor) — só muda o que alimenta essa fórmula, que passa a ser exclusivamente os tempos da prova selecionada (SCM+LCM juntos, já que são a mesma prova). Inversão via prop `reversed` do `<YAxis>` do Recharts (suportada na versão instalada, 2.15.4) — domínio e tooltip continuam com os valores reais, só a direção visual do eixo inverte; sem negociar valores manualmente (evita o risco de bagunçar tooltip/rótulo).
4. **SCM × LCM**: quando ambas aparecem, viram duas séries (`<Line>`) independentes, com cor/traço distintos e legenda própria ("25 m" / "50 m"); nunca conectadas uma na outra. Filtro em uma piscina só mostra aquela série (comportamento já existente, mantido).
5. **Duas datas iguais**: ordenação secundária determinística por `created_at` e, por fim, `id` do resultado (nunca deixa empate real). Quando houver de fato duas datas idênticas dentro da mesma prova+piscina, cada uma ganha sua própria posição no eixo X (nunca sobrescreve/some silenciosamente) — sem decidir qual "vale mais", isso fica para a frente de deduplicação.
6. **Transição de categoria**: uma `<ReferenceLine>` por transição detectada (suporta múltiplas), posicionada na data do primeiro resultado da nova categoria dentro da prova selecionada, com rótulo discreto do nome da categoria — a linha da prova continua contínua por baixo, sem quebra.
7. **Eixo X**: continua cronológico por `result_date`, sem uso de categoria como substituto.
8. **Mobile**: estrutura responsiva existente (`.chart` com altura fixa + `ResponsiveContainer`) mantida; com no máximo 2 séries por vez (SCM/LCM) em vez de N provas simultâneas, a tela fica mais limpa, não mais poluída — validação visual real será feita no build antes de publicar.

**Aguardando aprovação explícita desta proposta antes de escrever qualquer código.**

### Gráfico de Evolução — implementado, validado visualmente e publicado (27/09/2026)

Chat aprovou a proposta com 2 ajustes (estado inicial pela prova do resultado mais recente, e a `ReferenceLine` de transição de categoria ancorada na posição X efetiva do ponto, não na string da data) — ambos incorporados. Implementação cirúrgica em `Evolution()` (`commercial/apps/web/src/App.tsx`):

1. Removida a opção "Todos os estilos" — dropdown de prova sempre central e obrigatório.
2. Seleção automática inicial: prova do resultado válido mais recente do atleta (empate por mais resultados históricos, depois ordem alfabética); refeita a cada troca de atleta via `key={athleteId}` no ponto de montagem.
3. Domínio do eixo Y calculado só com os tempos da prova selecionada (mesma fórmula de margem de sempre); `<YAxis reversed .../>` do Recharts inverte a direção visual sem negociar valores — tooltip e ticks continuam com o tempo real.
4. SCM/LCM viraram duas séries (`Line`) independentes, nunca conectadas uma na outra, legenda própria "25 m"/"50 m".
5. `dataKey` do eixo X passou a ser o `id` do resultado (não mais a data formatada), com `tickFormatter` exibindo a data — cada resultado tem posição própria; duas datas iguais não se sobrescrevem nem desaparecem mais. Ordenação determinística: `result_date` → `created_at` → `id`.
6. `ReferenceLine` de transição de categoria ancorada pelo `id` do primeiro resultado da nova categoria (não pela string da data) — funciona corretamente mesmo com datas duplicadas; suporta múltiplas transições; a linha da prova continua contínua por baixo.

**Achados extras corrigidos (dentro do escopo pedido de validar legenda/tooltip)**: `.chart-legend-custom` e `.chart-tooltip` nunca tiveram nenhuma regra CSS — a legenda aparecia sem espaçamento nem cor visível ("25 m50 m" grudado, sem bolinha) e o tooltip sem caixa/espaçamento. Adicionadas regras mínimas para ambos em `styles.css`, sem alterar nenhuma outra classe.

**Validação visual real (Playwright + dados sintéticos, formato replicando o caso real do Vinícius: SCM/LCM misturados, duas datas iguais no mesmo dia, transição Mirim II→Petiz I)**, feita ANTES do commit, em desktop (1000px) e largura de iPhone (390px): eixo Y invertido confirmado (menor tempo em cima), duas séries com cores/legenda distintas, os dois resultados da mesma data aparecendo lado a lado sem se sobrescrever, `ReferenceLine` "Petiz I" na posição correta mesmo com a duplicata, filtro de piscina única funcionando (mostra só 1 série), tooltip legível, sem overflow horizontal no mobile. Build local (`tsc -b && vite build`) validado sem erros antes e depois da limpeza dos arquivos de teste (nenhum arquivo de teste foi commitado).

**Commit**: `81fec94` (isolado). **Deploy**: workflow "Build VINISWIM Commercial App" run #110 (`36308203910`) concluído com sucesso → `app/index.html` confirmado servindo `index-Cp7DhCpB.js`/`index-Be1gvNqn.css` (hashes idênticos ao build local pós-edição).

**Nenhuma mudança de banco, migration, RPC, `monitor-runner`, fluxo Atualizar ou `results` nesta entrega.** Deduplicação SwimSystem×FDAP segue como frente separada, não tocada. Etapa F continua adiada.

**Próximo passo**: Henrique fará o smoke test visual no atleta real antes de encerrar esta frente.

## Gráfico de Evolução — FORMALMENTE ENCERRADO E APROVADO EM PRODUÇÃO (27/09/2026)

Smoke test real no Vinícius aprovado pelo Henrique ("Gráficos estão corretos"), 4 capturas reais confirmando: seleção automática da prova (100 Medley/100 Livre/50 Costas conforme a prova mais recente de cada teste), eixo Y invertido, domínio útil, dois resultados de mesma data/mesmo tempo preservados como pontos distintos (100 Medley, 2×2'15"79), segmento de piora destacado em vermelho com dado real (100 Livre), tooltip correto ao toque, filtro de categoria funcionando, transição Mirim II→Petiz I marcada na posição certa, séries 25 m/50 m independentes com legenda própria, sem overflow no iPhone. `results` do Vinícius: 28 linhas, sem alteração. **Chat aprovou o fechamento formal desta frente.**

Etapa F continua adiada.

## Nova frente — Auditoria de deduplicação multifonte (27/09/2026): INVESTIGAÇÃO READ-ONLY, sem alterar nada

Chat autorizou investigação para dimensionar resultados potencialmente duplicados entre fontes diferentes (especialmente SwimSystem × FDAP), achado inicial durante a investigação do Gráfico de Evolução. **Nenhuma linha será alterada** — nem `results`, nem `meets`, nem `result_sources`, nem `source_id`; nenhuma migration; nenhuma mudança de parser ou frontend; nenhuma decisão automática de qual fonte "vence". Só `SELECT`.

**Dimensão real**: banco de produção tem só 81 `results` no total, em **2 perfis de atleta** — ambos são o mesmo Vinícius real:

| Perfil | `athlete_id` | `account_id` (dono) | Resultados | Status | Criado em |
|---|---|---|---|---|---|
| B | `f02e62f2-...` | `8213ebbb-...` = **Henrique Costa Ballão** (dono original) | 53 | active | 22/09 |
| A | `af41d466-...` | `783a36e3-...` = perfil "Vinícius Suzin Ballão" (conta própria) | 28 | pending_source | 25/09 |

**Achado estrutural nº 1 (o maior fator de duplicação, maior que SwimSystem×FDAP)**: existem **duas contas de usuário diferentes**, cada uma com seu próprio perfil de atleta para a mesma criança real (mesma data de nascimento, mesmo clube, mesma categoria — só a grafia do nome difere: "Ballão" com acento no perfil A, "Ballao" sem acento no B, este último batendo com o registro oficial no SwimSystem). Cada perfil tem sua própria `athlete_source_configs`/busca, e ambos pesquisam as **mesmas fontes externas reais** (SwimSystem + FDAP) de forma independente — então a mesma competição real é importada duas vezes, uma vez por perfil. Isso sozinho já explica a maior parte dos "duplicados": quase todo evento/data tem uma linha em cada perfil com o mesmo valor (ex.: 200 Livre em 4 datas diferentes, valor idêntico nos dois perfis, toda vez).

**Achado estrutural nº 2 — confirmado com prova completa (bug de parsing, não duplicata)**: o resultado `25a8975b-5db0-4a7a-9074-8554190c3ee4` (perfil B, 50 Costas, 07/11/2025, 36.230s, `is_official=true`) está **errado** — o tempo real do Vinícius nessa prova foi **56.98s** (confirmado por um registro legado migrado, `metadata.migration='dropbox-legacy-v1'`, e por reconferência linha a linha do PDF fonte). 36.23s é o tempo do **1º colocado da prova** ("Joao Leopoldo Goncalves"), não do Vinícius (42º colocado). Texto bruto do PDF (`historical_document_text_cache`) confirma: `"...42. 2 / 1 Vinicius Suzin Ballao 422692 2015 Curitibano 56.98 96% - 70..."` — seu nome, registro e tempo corretos aparecem claramente no documento; o parser pegou o número errado.

*Causa provável*: o texto extraído do PDF pelo leitor (`r.jina.ai`) vem como um bloco praticamente sem quebras de linha (a tabela inteira de ~45 nadadores em uma "linha" só, confirmado: só 17 quebras de linha em 3862 caracteres, todas no cabeçalho). `extractOfficialRowTime()` busca o tempo *depois* da posição do `external_id` do atleta dentro desse bloco — se, no momento em que esse job específico rodou, o `external_id` usado estivesse vazio/não encontrado (a config específica de FDAP para o atleta não existe hoje para nenhum dos dois perfis — `athlete_source_configs` só tem linha para SwimSystem; o código atual já tem um fallback para usar a config do SwimSystem nesse caso, mas não temos certeza de que esse fallback já existia quando este resultado específico foi gravado), a função cai para pegar o *primeiro* tempo do bloco inteiro — que é sempre o tempo do 1º colocado da prova. Encontrados mais 3 resultados com a mesma assinatura suspeita (tempo do FDAP muito mais rápido que o tempo confirmado do SwimSystem/legado para a mesma prova/data, ~30-40% mais rápido): `time_ms` 37850 (50 Costas 11/10/2025), 30840 (50 Livre 19/04/2026), 36980 (50 Costas 08/03/2026) — mesma assinatura, mecanismo ainda não confirmado linha a linha como o primeiro caso.

**Categorização dos candidatos**:
- **(A) Duplicata exata "boa"** (mesmo valor, confirmado por 2 fontes/2 perfis concordando): maioria dos casos — ex. 200 Livre (todas as 4 datas), 100 Costas (2 datas), 100 Livre (2 datas), 50 Borboleta, 100 Medley 05/04/2025. Aqui o dado está certo, só duplicado entre os dois perfis.
- **(B) Provável duplicata com deriva de data/fonte**: SwimSystem e FDAP às vezes atribuem datas diferentes (±1 dia) à mesma competição para o mesmo tempo (ex. 50 Costas: perfil B tem 07/03/2026 via SwimSystem e 08/03/2026 via FDAP com valores diferentes — a data do FDAP parece ser a correta pela prova em si, mas o tempo do FDAP nesse caso é um dos 4 suspeitos de bug acima).
- **(C) Achado à parte, não é duplicata**: 3 resultados do perfil A todos datados exatamente 25/09/2026 (100 Medley, 50 Peito, 50 Costas-DSQ) — dois deles (100 Medley=135790, 50 Peito=75220) têm o **mesmo valor exato** de resultados já existentes com datas reais mais antigas (05/04/2025 e 06/04/2025 respectivamente). Indício de um segundo bug, independente: o job "swimsystem" (não-histórico, de "campeonato atual") usa `new Date().toISOString().slice(0,10)` como data de fallback quando não consegue extrair uma data real da página — criando um resultado "novo" hoje que na verdade é uma repetição malformatada de um resultado antigo.
- **(D) Resultados genuinamente distintos, não duplicata**: a maioria dos resultados exclusivos do perfil B (datas de 2026-08 e 2026-09, que o perfil A nunca buscou) — não achamos nenhum indício de duplicação aqui, são resultados reais só de um perfil.

**Estruturas existentes relevantes**:
- `result_sources` já permite múltiplas fontes para **um mesmo** `result_id` (`UNIQUE(result_id,source_id)`) — funciona bem quando (athlete_id, event_id, result_date, course, status, time_ms) batem exatamente, mas **não tem como** detectar duplicata entre dois `athlete_id` diferentes (a chave de match inclui `athlete_id`), nem entre datas próximas mas não-idênticas.
- `meets` é uma tabela por fonte (`UNIQUE(source_id, external_id)`) — não existe nenhuma canonicalização entre fontes. Confirmado com dado real: a mesma competição ("Torneio Regional da 1ª Região 2026") existe como **2 linhas diferentes de `meets`**, uma por perfil de atleta, cada uma criada pela própria busca daquele perfil, com nomes ligeiramente diferentes.
- Onde o pipeline decide INSERT vs. já-existe: a busca primária (`results.select(...).eq('athlete_id',...).eq('event_id',...).eq('result_date',...).eq('course',...).eq('status',...).eq('time_ms',...)`) já ignora `source_id` — ou seja, já é "fonte-agnóstica" para uma correspondência exata. Existe também uma lógica de "promoção de registro obsoleto" (`stale`) que localiza um resultado oficial existente com mesmo athlete/prova/piscina/tempo mas **data diferente** e sobrescreve a data dele — criada para corrigir datas, mas é exatamente o tipo de mecanismo que poderia (silenciosamente) fundir dois resultados reais diferentes que coincidem em tempo.

**Riscos de falso positivo (não ignorados)**: mesmo tempo **não é** necessariamente duplicata — já vimos no smoke test do gráfico um caso real de 2 resultados genuinamente distintos com o tempo idêntico (100 Medley, 2×2'15"79, datas diferentes, ambas válidas). Qualquer regra futura de deduplicação automática precisa usar identidade de **competição** (não só tempo) para decidir, e nunca decidir com base só em "mesmo valor".

**Proposta arquitetural (nenhuma implementada)**:
1. **Resolver primeiro a duplicação de perfil de atleta** (achado estrutural nº 1) — sem isso, qualquer deduplicação automática de `results` é arriscada, porque parte do "duplicado" é entre `athlete_id`s diferentes. Decisão de produto/humana (fundir contas? vincular perfis? é intencional ter os dois?) — não é algo que o Code deve decidir.
2. **Identidade canônica de competição** independente da fonte (nome normalizado + intervalo de data + federação/local), para que a mesma competição real vire uma linha só de `meets` não importa qual fonte a descobriu primeiro.
3. **Identidade canônica de resultado com tolerância de data** (±1 dia) e critério explícito de precedência entre fontes (ex.: migração legada > FDAP confirmado por PDF > SwimSystem "campeonato atual" genérico) em vez de "quem gravou por último vence".
4. **Corrigir os dois bugs de parsing encontrados** (atribuição errada de tempo por falta de `external_id` no bloco de texto sem quebras de linha; fallback de data para "hoje" no job não-histórico) e **reprocessar/reconferir os resultados históricos do FDAP já gravados** contra o texto bruto em cache, para achar outras possíveis atribuições erradas silenciosas como a confirmada.
5. **Correção do dado já errado** (`25a8975b-...`, 56.98s→36.23s trocado) é uma decisão separada e sensível — precisa da autorização explícita do Henrique, não decidida ou executada pelo Code agora.

**Nada foi alterado nesta investigação** — só `SELECT`. Nenhuma linha de `results`/`meets`/`result_sources` tocada.

## Deduplicação PAUSADA — causa raiz completa do bug do parser FDAP + bug de data + 2 perfis (27/09/2026)

Chat pausou a deduplicação (P3) e priorizou: **P0-A** (bug do parser FDAP), **P0-B** (bug de data "hoje"), **P0-C** (classificar os 4 suspeitos), **P1** (dois perfis). Investigação completa abaixo — **nada implementado, nada corrigido, nada de dados reais alterado**.

### P0-A — causa raiz EXATA e completa do bug do parser FDAP (CONFIRMADA, não é mais hipótese)

**A causa raiz tem duas partes, e a segunda é o gatilho real, ativo hoje para qualquer atleta:**

1. O trigger `seed_default_sources_after_athlete` cria automaticamente, para todo atleta novo, uma linha em `athlete_source_configs` **para cada fonte, inclusive `fdap`**, com `active=true` mas `external_id=null`. **Confirmado nos dois perfis do Vinícius**: ambos têm uma linha `fdap` ativa com `external_id=null` — nenhum dos dois tem `external_id` de FDAP preenchido (isso nunca é preenchido por nenhum fluxo do produto hoje).
2. Em `processArchiveJob` (`monitor-runner/index.ts`), a resolução de configuração é:
   ```
   let {data:cfg}=await db.from('athlete_source_configs')...eq('source_id',archive.source_id).eq('active',true).maybeSingle();
   if(!cfg && archive.sources?.code==='fdap'){ /* fallback para config do swimsystem */ }
   ```
   Como a linha `fdap` **existe e está ativa** (só com `external_id` vazio), `cfg` nunca é `null` — o fallback para a configuração do SwimSystem (que tem o `external_id` certo, "422692") **nunca dispara**. `cfg.external_id` fica `null`.
3. Em `parseHistoricalResultText`, com `id=''` (vazio), o filtro de linhas cai para correspondência por nome (`looseNameMatch`) — isso **funciona bem** para achar a seção certa (o texto extraído do PDF pelo leitor tem quebras de linha nos títulos de categoria, ex. "Petiz 1"/"Petiz 2"/"Mirim 1"/"Mirim 2", mas **não tem quebra entre as linhas de cada nadador dentro da mesma categoria** — a seção inteira daquela faixa etária vira uma "linha" só).
4. Em `extractOfficialRowTime`, com `id=''`, a condição `if(id){...}` é pulada inteira — `after=raw` (a seção inteira, do começo) — a primeira ocorrência do padrão tempo+percentual nessa seção é sempre o tempo do **1º colocado daquela categoria**, não o do Vinícius.

**Confirmado com 4 exemplos reais, texto bruto do PDF conferido linha a linha para cada um** (ver tabela na seção P0-C abaixo) — em 3 dos 4 casos o tempo roubado é do mesmo rival "Joao Leopoldo Goncalves", que aparece consistentemente como 1º colocado da categoria do Vinícius em várias competições.

**Isso não é um bug antigo/corrigido — está ativo hoje** para qualquer atleta sem `external_id` de FDAP preenchido (ou seja, todos, já que não existe fluxo para preencher isso).

**Patch mínimo proposto (duas partes complementares, nenhuma implementada ainda):**

1. **Corrige a causa raiz** (restaura o comportamento correto): em `processArchiveJob`, trocar
   `if(!cfg && archive.sources?.code==='fdap')`
   por
   `if((!cfg || !cfg.external_id) && archive.sources?.code==='fdap')`
   — assim o fallback para a config do SwimSystem dispara também quando existe uma linha `fdap` ativa mas vazia (o caso real de hoje), não só quando não existe linha nenhuma.
2. **Rede de segurança** (nunca inventar dado mesmo que a causa raiz não seja coberta por algum outro caminho ainda não mapeado): em `extractOfficialRowTime`, remover o comportamento de "se `id` vazio, usar a linha inteira desde o início" — exigir sempre `id` não-vazio E encontrado na linha; caso contrário, `return null` (hoje só retorna `null` quando `id` não é encontrado, mas quando `id` é vazio ele nunca chega a essa checagem). Efeito: sem identificador inequívoco, o resultado não é importado (`timeMs==null` e sem `status` ⇒ `continue`, a linha é ignorada) — exatamente a regra pedida.

Nenhuma das duas mudanças foi aplicada — só o diagnóstico e a proposta.

### P0-B — causa raiz completa do fallback de data "hoje"

Localizado com precisão: **só existe em 2 lugares, ambos dentro do branch não-histórico ("campeonato atual") de `processJob()`** — o caminho histórico/FDAP **já é seguro** (usa `||null`, nunca `new Date()`, confirmado lendo as 2 ocorrências equivalentes nesse caminho).

```
// linha 564 — monta o objeto meet para fontes genéricas (não SwimSystem, não histórico)
meet={...,startDate:dateFrom(body)||new Date().toISOString().slice(0,10),...}
// linha 568 — upsert do meet (aplica-se também ao branch SwimSystem "campeonato atual", que não tem fallback próprio mas herda este)
start_date:meet.startDate||new Date().toISOString().slice(0,10)
```

**Achado importante que torna o patch seguro**: `meets.start_date` é `NOT NULL` no banco — não dá simplesmente para trocar por `||null` (quebraria o insert). Mas o código **já tem** a proteção certa logo depois, no processamento de cada resultado individual: `const date=r.resultDate||m.start_date;if(!course||!date)continue;` — ou seja, se não houver data, o resultado individual já seria pulado. O problema é só que hoje a *competição* (`meets`) sempre recebe uma data (a de hoje), então `m.start_date` nunca fica vazio para acionar essa proteção.

**Patch mínimo proposto (não implementado)**: remover os dois fallbacks `||new Date().toISOString().slice(0,10)`, e adicionar uma checagem explícita **antes** do `meets.upsert`: se `meet.startDate` não foi determinado, **não fazer o upsert** — lançar um erro descritivo (ex.: `'Data da competição não pôde ser determinada com segurança'`), que o `catch` já existente em `processJob()` converte automaticamente em `monitor_runs.status='failed'` + `monitor_jobs.last_error` com a mensagem — diagnóstico visível, sem inventar dado.

**Efeito colateral esperado e aceito**: buscas de "campeonato atual" cuja página não tenha uma data em formato reconhecível deixam de importar resultado nenhum daquela página até que uma data real apareça (ex. quando os resultados forem arquivados historicamente pelo FDAP, que já tem tratamento de data mais robusto). Isso é exatamente o trade-off pedido (preferir ausência de dado a dado errado).

### P0-C — classificação dos 4 resultados suspeitos (conferidos linha a linha contra o PDF fonte)

| `result_id` | Prova | Data | Tempo gravado | Tempo real (confirmado no PDF) | Pertencia a | Classificação |
|---|---|---|---|---|---|---|
| `25a8975b-5db0-4a7a-9074-8554190c3ee4` | 50 Costas | 07/11/2025 | 36.23s | **56.98s** | Joao Leopoldo Goncalves (1º colocado) | **CONFIRMADO INCORRETO** |
| `441b6362-57a5-40ea-bdd4-d0d152bba5d1` | 50 Costas | 11/10/2025 | 37.85s | **55.90s** | Joao Leopoldo Goncalves (1º colocado "Mirim 2") | **CONFIRMADO INCORRETO** |
| `76844398-502f-4f5a-abc7-a44ef5f28179` | 50 Costas | 08/03/2026 | 36.98s | **54.68s** | Joao Leopoldo Goncalves (1º colocado "Petiz 1") | **CONFIRMADO INCORRETO** |
| `99cce11d-6960-4b59-90a5-10c99c650405` | 50 Livre | 19/04/2026 | 30.84s | **44.68s** | Gabriel Coelho Ghignone (1º colocado "Petiz 1") | **CONFIRMADO INCORRETO** |

Todos os 4 pertencem ao perfil B (`f02e62f2-...`, conta do Henrique), todos `is_official=true`, `status='valid'` — ou seja, hoje aparecem no app como marcas oficiais confirmadas do Vinícius, mas são de outro nadador. Os 4 seguem exatamente o mesmo mecanismo do P0-A. **Nenhum foi alterado.**

### P1 — os dois perfis do Vinícius (comparação completa)

| Campo | Perfil A | Perfil B |
|---|---|---|
| `athlete_id` | `af41d466-479b-47e5-8ffb-6dd03ae26e4f` | `f02e62f2-4987-4c99-aa21-1b8d89b80e65` |
| `account_id` | `783a36e3-b3d5-4103-a257-3c28f9f963c8` | `8213ebbb-2d8a-421c-87e0-6911fc9c096c` |
| Dono da conta (perfil) | "Vinícius Suzin Ballão" | "Henrique Costa Ballão" |
| Email do dono | viniciussuzinballao@gmail.com | henriqueballao@gmail.com |
| Conta criada em | 25/09/2026 20:51:01 | 22/09/2026 11:41:03 |
| Último login | **27/09/2026 12:24** (hoje, recente) | 26/09/2026 03:33 |
| Nome do atleta | "Vinícius Suzin Ballão" (com acento) | "Vinícius Suzin Ballao" (sem acento — bate com o registro oficial SwimSystem) |
| `athletes.status` | `pending_source` | `active` |
| Nascimento/clube/categoria | idênticos nos dois (mesma criança real) | idênticos |
| Registro SwimSystem (`external_id`) | 422692 | 422692 (mesmo registro real) |
| Fontes configuradas | swimsystem (com id), fdap/fgda/masters_parana (sem id, auto-seed) | idêntico |
| Quantidade de `results` | 28 | 53 |
| Contém dado legado migrado (`dropbox-legacy-v1`) | não verificado a fundo, provavelmente não | **sim** (pelo menos 1 resultado confirmado) |

**Sobre a origem**: o perfil A foi criado em 25/09, mesmo dia em que a D-004 começou a ser testada nesta sessão — mas o login **mais recente** desse perfil é de agora (27/09, depois de todo o trabalho desta sessão), o que indica uso real recente, não um fixture esquecido. Não encontrei nenhum registro em `audit_log` que explique o motivo exato da criação (a tabela não audita criação de conta/atleta, só resultados). **Não dá para confirmar com certeza técnica se foi intencional (ex.: Henrique quis dar um login próprio ao Vinícius) ou acidental** — isso só o Henrique sabe responder.

**Recomendação (não executada, decisão final é do Henrique)**: do ponto de vista técnico, ter 2 `athlete_id` para a mesma criança real garante que a duplicação vai continuar acontecendo para sempre, não importa o que se faça em `results`. Recomendo consolidar em UM perfil canônico — o perfil B parece o mais completo (mais resultados, `status=active`, contém dado legado já confirmado) — e, se o Henrique quiser que o Vinícius tenha login próprio, vincular esse login como membro adicional da MESMA conta/atleta, em vez de um perfil de atleta duplicado. Mas essa é uma decisão de produto do Henrique, não algo que o Code decide ou executa.

**Nada foi apagado, fundido, movido ou alterado** — só leitura, em `athletes`, `account_members`, `auth.users` (só e-mail/datas, nenhum secret), `athlete_source_configs`.

---

## P0-A e P0-B — IMPLEMENTADOS, TESTADOS E EM PRODUÇÃO (27/09/2026)

Chat autorizou a implementação dos dois patches P0. Ambos foram implementados, validados e deployados. **Os 4 resultados incorretos confirmados (P0-C) NÃO foram corrigidos** — segue explicitamente pausado até autorização específica do Henrique. **Os dois perfis duplicados (P1) NÃO foram tocados.**

### Commits (separados por assunto, conforme convenção)

- `cab1821` — fix(monitor-runner): corrige bug P0-A de identificação FDAP incorreta
- `cbe516c` — fix(monitor-runner): remove fallback de data para "hoje" em jobs não-históricos

### P0-A — patch aplicado

1. **`processArchiveJob` (resolução de config)**: `if(!cfg && fdap)` → `if((!cfg||!cfg.external_id) && fdap)`; o fallback para swimsystem só é aceito se `q.data?.external_id` existir; o guard final virou `if(!cfg||!cfg.external_id)throw(...)`. Ou seja: uma config `fdap` ativa mas com `external_id` vazio deixa de ser tratada como "configurada" — genérico, sem nenhum nome/id/competição hardcoded.
2. **`extractOfficialRowTime`**: recusa extração se `external_id` vier vazio (`if(!id)return null`) — elimina de vez o modo "varre o bloco inteiro sem id" que causava o bug.
3. **`boundedAthleteSegment` (nova função)**: a partir da posição do `id` no texto, delimita o segmento até o início da próxima linha de resultado (regex de início de linha `N. H/L Nome`) ou uma janela de 160 caracteres se não achar a próxima linha. Usada tanto por `extractOfficialRowTime` quanto por `resultStatus` dentro de `parseHistoricalResultText`, para que nem tempo nem status vazem para um atleta vizinho no mesmo bloco de categoria — mesmo com o id corretamente localizado.
4. **`parseHistoricalResultText`**: exige `id` não vazio (`if(!id)return []`) e remove por completo o fallback de correspondência só por nome (`looseNameMatch`) que existia para decidir quais linhas processar — agora só processa linhas onde o `id` aparece literalmente.

**Auditoria das funções irmãs** (`parseGeneric`, `parseResults`, usadas nos caminhos SwimSystem/genérico): **não alteradas**. Ambas operam sobre o texto de uma única `<tr>` do HTML (`$(tr).text()`), ou seja, a linha já é delimitada por atleta pela própria estrutura do DOM — não existe o cenário de "um bloco de texto com vários atletas colados" que causou o bug no FDAP (texto de PDF sem quebras de linha por nadador). O fallback por nome que ainda existe em `match()` para esses dois caminhos é um risco estrutural diferente (e bem mais raro: exigiria dois nadadores com nomes muito parecidos na mesma página), não o bug confirmado. Reportando essa distinção ao chat para decisão: manter como está, ou aplicar a mesma exigência de id literal também aqui por precaução extra.

### P0-B — patch aplicado

Removidos os dois fallbacks `dateFrom(body)||new Date().toISOString().slice(0,10)` e `meet.startDate||new Date().toISOString().slice(0,10)` no branch não-histórico de `processJob` (SwimSystem e genérico). Adicionado guard explícito antes do `meets.upsert`: `if(!meet.startDate)throw new Error('Data da competição não encontrada na fonte oficial; resultado não pode ser registrado sem data confiável.')`. Sem schema alterado — `meets.start_date` continua `NOT NULL`; a saída é lançar erro e não criar meet/resultado algum, aproveitando o mecanismo já existente de `status='failed'`/`last_error` em `monitor_jobs`. O caminho histórico (`processArchiveJob`, linhas com `||null`) não foi tocado — já era seguro.

### Testes executados (todos com entidades sintéticas, sob a conta real `8213ebbb-...`, limpas por completo depois)

**Node.js (funções puras, contra os 4 textos reais em cache que geraram o bug):**
- **F** — extração correta nos 4 casos reais: `40366`→56.98s, `39533`→55.90s, `40595`→54.68s, `40602`→44.68s (antes: 36.23/37.85/36.98/30.84s). 
- **D** — `external_id` vazio → `[]`; `external_id` presente mas ausente no texto (mesmo com nome batendo) → `[]`.
- **E** — bloco sintético com 3 atletas: nunca retorna o tempo do 1º colocado nem vaza para o 3º; com o próprio tempo bem formado no meio do bloco, extrai exatamente o próprio (33.33s), nunca o vizinho.
- 12/12 testes passaram.

**Supabase (via invocação real do `monitor-runner` v63 já deployado, jobs sintéticos):**
- **A** (fdap com `external_id` válido direto) → job falhou com erro de rede (DNS de domínio de teste inexistente), **não** com o erro de "não configurada" → confirma que a config foi aceita direto.
- **B** (fdap com `external_id` nulo + swimsystem com `external_id` válido) → mesmo erro de rede, **não** o erro de "não configurada" → confirma que o fallback funcionou.
- **C** (nenhuma fonte com `external_id`) → falhou com exatamente `"Fonte histórica não configurada para o atleta (identificador ausente)"` → confirma que o guard recusa corretamente.
- **G** (job não-histórico apontando para página real com data) → `status='completed'`, `last_error=null`, meet sintético criado com `start_date=2026-04-19` (data real extraída da página, não a data de hoje) → comportamento normal preservado.
- **H** (job não-histórico apontando para página sem nenhuma data, `https://example.com`) → `status='failed'`, `last_error` exatamente `"Data da competição não encontrada na fonte oficial; resultado não pode ser registrado sem data confiável."`, **zero** meets e **zero** results criados para o atleta sintético.
- **I** (não-regressão do caminho histórico) → confirmado por revisão de código (linhas com `||null` em `processArchiveJob` não tocadas) e indiretamente pelos testes A/B/C, que exercitaram esse mesmo caminho sem nenhuma falha relacionada a data.

### Deploy

- `monitor-runner` deployado como **versão 63** no projeto `cdtvhagbgiwnjkgninqn`.
- Conteúdo buscado de volta via `get_edge_function` e comparado **byte a byte** (`diff`) contra o arquivo local do git — **idêntico**.

### Confirmação de zero impacto em dados reais (só SELECT)

- Os 4 resultados incorretos confirmados continuam **exatamente com os mesmos valores** (`36230`, `37850`, `36980`, `30840` ms, `is_official=true`) — **não foram corrigidos**, como instruído.
- `total_results=81` (mesmo total de antes da investigação).
- Todas as entidades sintéticas (5 atletas, 3 arquivos históricos, 3 jobs de arquivo, 2 monitor_jobs, 1 meet sintético) foram **completamente removidas** após os testes — zero resíduo confirmado por contagem.

### Pendências explícitas (não fazer sem autorização)

- **P0-C**: os 4 resultados incorretos continuam incorretos — correção requer autorização específica do Henrique.
- **P1**: os dois perfis duplicados do Vinícius continuam duplicados — nenhuma fusão/exclusão/transferência de propriedade foi feita.
- Etapa F / deduplicação: não iniciada.

---

## Auditoria integral dos 81 results — READ-ONLY, sem alterar nada (27/09/2026)

Chat pediu, antes de corrigir os 4 resultados já conhecidos, uma auditoria READ-ONLY de **todos os 81 `results` reais**, para achar outros possivelmente contaminados pelo mesmo bug (FDAP), pelo bug de data "hoje" (P0-B), ou por qualquer outro erro objetivo. **Nenhum dado real foi alterado.**

### Método

Cada resultado foi classificado cruzando o valor salvo contra a fonte real (texto bruto do PDF em cache, localizando a própria linha do atleta pelo registro FDAP/SwimSystem `422692`). Para os 41 resultados oriundos do pipeline de histórico (FDAP + uma leva antiga via SwimSystem, ver abaixo), a classificação foi validada de forma determinística: reescrevi a lógica **exata pré-patch** (`extractOfficialRowTime`/`parseHistoricalResultText` antes do P0-A) em Node.js e rodei contra o texto real de cada um dos 21 PDFs envolvidos — em **100% dos 41 casos** o valor salvo foi **reproduzido byte a byte** por essa lógica antiga, confirmando o mecanismo exato de cada erro (não é suposição).

### Achado principal: o problema é muito maior que os 4 já conhecidos

| Classificação | Quantidade |
|---|---|
| **CONFIRMADO CORRETO** | 38 |
| **CONFIRMADO INCORRETO** | **25** (4 já conhecidos + **21 novos**) |
| **SEM EVIDÊNCIA SUFICIENTE PARA VALIDAR** | 18 |
| **Total** | 81 |

### Origem dos 81 (por mecanismo de importação)

| Origem | Qtde | Corretos | Incorretos | Sem evidência |
|---|---|---|---|---|
| FDAP via `processArchiveJob` (pipeline atual, `external_id` vazio — a causa raiz do P0-A) | 20 | 3 | **17** | 0 |
| SwimSystem via pipeline histórico antigo (`scanHistoricalCatalog`, código morto hoje — usava `external_id=422692`, real, mas com a mesma falha de não delimitar o segmento do atleta) | 21 | 13 | **8** | 0 |
| Migração legado `dropbox-legacy-v1` (dado manual, anterior a qualquer parser automático — **não passa pelo P0-A/P0-B**) | 32 | 22 | 0 | 10 (5 de uma competição cujos PDFs não foram individualmente mapeados nesta rodada — `39523`; 5 de uma página SwimSystem "ao vivo" já não recuperável) | 
| Inserido manualmente (`origin='manual'`, sem `source_id`, sem fonte externa) | 8 | 0 | 0 | 8 |

**Conclusão prática**: o pipeline **FDAP** (`processArchiveJob`, hoje corrigido pelo P0-A) produziu erro em **17 de 20** resultados que gravou — 85% de taxa de erro. O pipeline antigo via SwimSystem (código morto, não roda mais) produziu erro em 8 de 21 (38%) — proporcionalmente menor porque usava o `external_id` certo, mas ainda sofria do mesmo problema de não delimitar o segmento do atleta (exatamente o que o `boundedAthleteSegment` do P0-A resolve). **Nenhum** dos 32 resultados migrados do legado (dado manual, pré-automação) apresentou erro nos 22 que puderam ser cruzados contra fonte real.

### Tabela completa — 25 CONFIRMADOS INCORRETOS

Tempo "salvo" = o que está gravado hoje em `results.time_ms`/`status`. Tempo "real" = achado na própria linha do atleta (registro 422692) no PDF fonte. Mecanismo: **A** = pipeline FDAP atual (`external_id` vazio, pega o 1º tempo do bloco/categoria — em 1 caso pegou o tempo do NADADOR SEGUINTE em vez do 1º colocado); **B** = pipeline SwimSystem antigo/código morto (`external_id` certo, mas sem delimitar o segmento — pegou o tempo do nadador vizinho quando a própria linha do Vinícius não tinha "%" logo após o tempo); **C** = bug de data "hoje" (P0-B) — duplicata com tempo certo mas data fabricada no dia da execução.

| result_id | Perfil | Prova | Data salva | Salvo | Real | Mecanismo |
|---|---|---|---|---|---|---|
| `23f53383` | A | 50 Costas | 05/04/2025 | 39"10 (dsq) | **58"78 (valid)** | A — tempo E status errados (1º colocado + DQL de outro nadador) |
| `b4b6faba` | B | 50 Costas | 05/04/2025 | 39"10 (dsq) | **58"78 (valid)** | A — idem |
| `3e9274b1` | A | 50 Livre | 05/04/2025 | 32"97 | **53"09** | A — tempo do 1º colocado |
| `dd76be5d` | B | 50 Livre | 05/04/2025 | 32"97 | **53"09** | A — idem |
| `76e8c63b` | B | 50 Peito | 05/04/2025 | 43"48 | **1'15"22** | A — tempo do 1º colocado |
| `d6b0ecfb` | A | 50 Peito | 05/04/2025 | 43"48 | **1'15"22** | A — idem |
| `b9b85e51` | B | 100 Livre | 12/10/2025 | 1'20"77 | **1'55"10** | A — pegou o tempo de um nadador "OBS" no fim do bloco |
| `af0a322c` | B | 50 Livre | 14/09/2025 | 32"08 | **48"90** | A — tempo do 1º colocado |
| `fae67d60` | A | 50 Livre | 14/09/2025 | 32"08 | **48"90** | A — idem |
| `f402a628` | B | 50 Costas | 13/09/2025 | 38"42 | **58"43** | A — tempo do 1º colocado |
| `f57865a0` | A | 50 Costas | 13/09/2025 | 38"42 | **58"43** | A — idem |
| `bd9a915e` | B | 50 Borboleta | 13/09/2025 | 37"07 | **1'05"71** | A — tempo do 1º colocado |
| `dfac0c8e` | A | 50 Borboleta | 13/09/2025 | 37"07 | **1'05"71** | A — idem |
| `25a8975b` | B | 50 Costas | 07/11/2025 | 36"23 | **56"98** | A — já conhecido (P0-C original) |
| `441b6362` | B | 50 Costas | 11/10/2025 | 37"85 | **55"90** | A — já conhecido (P0-C original) |
| `76844398` | B | 50 Costas | 08/03/2026 | 36"98 | **54"68** | A — já conhecido (P0-C original) |
| `99cce11d` | B | 50 Livre | 19/04/2026 | 30"84 | **44"68** | A — já conhecido (P0-C original) |
| `4869e32c` | A | 100 Livre | 12/10/2025 | 1'20"77 | **1'55"10** | B — mesmo erro de `b9b85e51`, sob `source_id` SwimSystem |
| `3d8b3776` | A | 50 Livre | 14/09/2025 | 49"78 | **48"90** | B — pegou o tempo do nadador vizinho (linha do Vinícius sem "%") |
| `9bcd7323` | A | 50 Costas | 13/09/2025 | 58"59 | **58"43** | B — pegou o tempo do nadador seguinte (Felipe Barbosa Cortes) |
| `387fac6e` | A | 50 Borboleta | 13/09/2025 | 48"51 | **1'05"71** | B — pegou o tempo de um nadador "OBS" fora de ordem |
| `f52b316f` | A | 50 Livre | 19/04/2026 | 47"42 | **44"68** | B — pegou o tempo do nadador seguinte |
| `49963241` | A | 50 Costas | **25/09/2026 (fabricada — dia da execução)** | 58"78 (dsq) | 58"78 (**valid**) | C — tempo certo, mas status errado (DQL de outro nadador) e data fabricada |
| `9f516fe7` | A | 100 Medley | **25/09/2026 (fabricada)** | 2'15"79 | 2'15"79 (real: 05/04/2025) | C — tempo certo, só a data é fabricada |
| `17aad14d` | A | 50 Peito | **25/09/2026 (fabricada)** | 1'15"22 | 1'15"22 (real: 06/04/2025) | C — tempo certo, só a data é fabricada |

**Nenhum destes 25 foi alterado.** Todos continuam exatamente como estão em produção hoje.

### Casos de data possivelmente fabricada (P0-B)

Confirmados exatamente **3** (já eram os únicos com `result_date == data de retrieval == meet.start_date`, verificado contra os 21 resultados SwimSystem não-legado — nenhum outro caso com essa assinatura foi encontrado): `49963241`, `9f516fe7`, `17aad14d` — todos do perfil A, todos datados **25/09/2026** (dia em que aquele lote rodou), todos com o tempo certo mas a data sem nenhuma relação com a competição real (abril/2025). Tabela acima.

### Achado secundário, fora do escopo do P0-A/P0-B: imprecisão de dia em parte dos dados migrados do legado

Nos 22 resultados `dropbox-legacy-v1` cruzados com sucesso contra a fonte real, o **tempo bate exatamente em 100% dos casos** — mas em alguns (ex.: `babb1d3c` salvo com 06/03/2026, evento realmente ocorrido em 08/03/2026; padrão semelhante em 1-2 outros) a data salva corresponde ao primeiro dia do campeonato, não ao dia exato da prova dentro de um campeonato de vários dias. Não é o bug P0-B (a data não é "hoje", é uma data real dentro do período do campeonato) e não afeta veracidade do tempo. Registro apenas informativo — não é um "erro objetivo de parsing" no sentido do P0-A/P0-B, é uma imprecisão pré-existente no dado migrado manualmente. Não fiz nada a respeito.

### O que não pôde ser validado (18 resultados)

- **10 da migração legado**: 5 resultados (`100/200 Livre`, `50 Borboleta`, `50 Costas`, `100 Medley`, todos 04-06/07/2025) vieram de uma competição (`39523`) cujos 17 PDFs em cache não foram individualmente mapeados nesta rodada (não sabia qual `ResultList_XX.pdf` correspondia a qual prova sem abrir um a um) — dá para fechar isso numa rodada futura se o chat/Henrique quiser. Os outros 5 (`100 Livre`, `50 Costas`, `200 Livre`, `50 Livre` DNS, `100 Costas`, todos 18-20/09/2026) vieram de uma página SwimSystem "ao vivo" (`swimsystem.app`) que não existe mais para reconferir.
- **8 inseridos manualmente** (`origin='manual'`, sem `source_id`, datados 22/03/2025 e 15-16/08/2026): não passaram por nenhum parser automático (não é o escopo do P0-A/P0-B) e não há documento fonte externo para cruzar — são dados que só o Henrique (ou quem os digitou) pode confirmar.

Nenhum desses 18 foi classificado como incorreto — apenas não pôde ser confirmado nem contestado com as fontes disponíveis agora.

### Duplicação não tratada como erro

Conforme instruído, o mesmo tempo/prova/data aparecendo sob `source_id` diferente (ex.: os pares FDAP+SwimSystem acima) não foi por si só motivo de classificação — cada linha foi julgada pela sua própria veracidade (data/tempo/status), não pela existência de duplicata. A frente de deduplicação continua separada e pausada.

### Nada foi alterado

Toda esta auditoria foi SELECT-only. Nenhum `UPDATE`/`DELETE`/`INSERT` em `results`, nenhuma reimportação, nenhum "Atualizar Resultados" disparado, nenhuma fusão de perfis, nenhuma migration. Os scripts de verificação (Node.js, fora do banco) e os textos de PDF usados ficam registrados na sessão para auditoria futura, se necessário.

---

## Plano exato de reparo dos 25 confirmados incorretos — READ-ONLY, SQL PROPOSTO E NÃO EXECUTADO (27/09/2026)

Chat aceitou a auditoria e pediu o plano linha-a-linha antes de qualquer escrita. **Nada foi executado nesta etapa** — nenhum `UPDATE`/`DELETE`/`INSERT` real. Tudo abaixo é SELECT + análise.

### Achado que muda a estratégia: 16 dos 25 são duplicatas de um registro já correto do MESMO atleta — não precisam de UPDATE, precisam de remoção

Cruzando cada um dos 25 contra os 38 já confirmados corretos (e uns contra os outros) **pelo mesmo `athlete_id` + mesma prova + mesma data real**, descobri que **16 dos 25 já têm um gêmeo correto existente** para o mesmo atleta — inclusive **3 dos 4 já conhecidos desde antes desta auditoria** (`25a8975b`, `441b6362`, `76844398`, `99cce11d`: só `99cce11d`... na verdade os 4 originais também se encaixam, ver tabela). Nesses casos, fazer `UPDATE` no registro incorreto criaria uma **duplicata idêntica** do resultado que o atleta já tem correto — exatamente o risco que o chat pediu para verificar no item 8. A ação certa para esses 16 é **remoção**, não correção.

Consequência: o reparo real é **muito mais simples** do que "corrigir 25 linhas":
- **Grupo A — UPDATE seguro: 9 registros** (nenhum gêmeo correto existe para aquele atleta/prova/data real).
- **Grupo B — candidato a remoção por duplicar registro já correto do mesmo atleta: 16 registros** (os 3 do Grupo D inclusos — cada um dos 3 tem um gêmeo correto ou em correção no Grupo A, para o MESMO atleta).
- **Grupo C (reassociação de meet) e Grupo D (decisão adicional) da classificação pedida: 0 puros** — o único caso de reassociação de meet (os 3 de data fabricada) resolve-se pela remoção (Grupo B), não por reassociar `meet_id`, porque o gêmeo correto já existe em outro lugar. Sinalizo abaixo 1 caso com nota (`b9b85e51`) que é UPDATE mas gera um quase-duplicado com 1 dia de diferença contra um registro do legado (ver seção de imprecisão de data).

### Dependências verificadas (para todos os 25)

- `result_sources`: cada um dos 25 tem **exatamente 1** linha associada (`ON DELETE CASCADE` a partir de `results`) — remove/atualiza sozinho, sem passo manual.
- `personal_bests`: **não é view, é tabela real**, mas é mantida por um **trigger existente** (`results_refresh_personal_best` → `app.refresh_personal_best()`) que roda `AFTER INSERT OR UPDATE OR DELETE ON results` e recalcula sozinho o melhor tempo oficial válido por atleta/prova/piscina. **13 dos 25 registros incorretos são hoje o "recorde pessoal" oficial do atleta** nesse evento/piscina (ver coluna "é PB hoje?" nas tabelas abaixo) — ou seja, o app está mostrando um recorde falso para esses 13. UPDATE ou DELETE nesses 25 aciona o trigger automaticamente; **nenhuma reconciliação manual de `personal_bests` é necessária**.
- `meet_entries`: **zero linhas** em qualquer um dos 10 `meet_id` envolvidos nos 25 — sem impacto.
- `reconciliation_queue`: tabela vazia (0 linhas no banco todo) — sem impacto.
- `v_result_timeline` e `v_athlete_overview`: são **views puras** (sem materialização) — recalculam automaticamente a partir de `results`/`meets`/`athletes` a cada leitura, incluindo a categoria por idade (`v_result_timeline` deriva categoria de `result_date`+`birth_date` na hora). Nenhum passo extra.
- `result_fingerprint` (coluna de texto em `results`, não é constraint, não tem índice único): guarda `athlete_id|meet_id|event_id|result_date|course|time_ms|status` como string. Não é usada pela lógica de dedup do monitor-runner (que compara as colunas diretamente), mas fica **desatualizada** se eu só mudar `time_ms`/`status` sem recalculá-la — o SQL proposto abaixo já recalcula.
- `audit_log`: já existe, já está ativo (130 linhas hoje, trigger `results_audit_change` grava `old_data`/`new_data` em JSONB a cada INSERT/UPDATE/DELETE em `results`), e **é o mecanismo de rollback nativo** — ver seção de snapshot.
- `results.meet_id → meets.id`: `ON DELETE SET NULL` (não é `CASCADE`, não é `RESTRICT`) — apagar um `meet` órfão depois de remover seus `results` é seguro mesmo que eu esqueça a ordem.

### GRUPO T — TEMPO INCORRETO (22 registros: 9 para UPDATE + 13 para remoção)

| result_id | athlete_id | Perfil | source | meet_id atual | Competição | Data | Prova | Piscina | Tempo atual | Tempo correto | Evidência | Mecanismo | É PB hoje? | Classificação |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `23f53383-7841-4ffe-a115-61308980bc5d` | `af41d466-…` | A | fdap | `2db71942-…` | Torneio Regional 1ª Região | 05/04/2025 | 50 Costas | SCM | 39"10 (dsq) | **58"78 (valid)** | ResultList_8.pdf, linha do 422692 | A (1º colocado + DQL de outro nadador) | não | **A) UPDATE** |
| `3e9274b1-4cc5-4cdc-a101-e54491757e88` | `af41d466-…` | A | fdap | `2db71942-…` | Torneio Regional 1ª Região | 05/04/2025 | 50 Livre | SCM | 32"97 | **53"09** | ResultList_40.pdf | A (1º colocado) | não | **A) UPDATE** |
| `d6b0ecfb-bac9-468a-b963-6757fbf332ba` | `af41d466-…` | A | fdap | `2db71942-…` | Torneio Regional 1ª Região | 05/04/2025 | 50 Peito | SCM | 43"48 | **1'15"22** | ResultList_32.pdf | A (1º colocado) | **sim** | **A) UPDATE** |
| `b9b85e51-f107-42df-9678-6cb081e55fec` | `f02e62f2-…` | B | fdap | `3fb2b071-…` | Troféu Germano Bayer 2025 | 12/10/2025 | 100 Livre | LCM | 1'20"77 | **1'55"10** | ResultList_70.pdf | A (pegou o "OBS" do fim do bloco) | **sim** | **A) UPDATE** (ver nota¹) |
| `fae67d60-96f0-4227-b70d-5493c3450e5c` | `af41d466-…` | A | fdap | `6b4a524c-…` | Torneio Regional 1ª Região | 14/09/2025 | 50 Livre | LCM | 32"08 | **48"90** | ResultList_48.pdf | A (1º colocado) | **sim** | **A) UPDATE** |
| `f57865a0-d315-415f-8c58-fb38c027e08f` | `af41d466-…` | A | fdap | `6b4a524c-…` | Torneio Regional 1ª Região | 13/09/2025 | 50 Costas | LCM | 38"42 | **58"43** | ResultList_6.pdf | A (1º colocado) | **sim** | **A) UPDATE** |
| `dfac0c8e-0a62-4b9c-8e7c-7c84534a06ea` | `af41d466-…` | A | fdap | `6b4a524c-…` | Torneio Regional 1ª Região | 13/09/2025 | 50 Borboleta | LCM | 37"07 | **1'05"71** | ResultList_18.pdf | A (1º colocado) | **sim** | **A) UPDATE** |
| `4869e32c-9849-48f6-8d8f-89ad66b2aa50` | `af41d466-…` | A | swimsystem | `4119d4f2-…` | Troféu Germano Bayer 2025 | 12/10/2025 | 100 Livre | LCM | 1'20"77 | **1'55"10** | ResultList_70.pdf | B (mesmo bug, sob source SwimSystem) | não | **A) UPDATE** |
| `f52b316f-a1b5-4788-b920-1d4e3a7605b7` | `af41d466-…` | A | swimsystem | `4f78760e-…` | Campeonato Paranaense Inverno 2026 | 19/04/2026 | 50 Livre | SCM | 47"42 | **44"68** | ResultList_62.pdf | B (pegou o nadador seguinte) | não | **A) UPDATE** |
| `b4b6faba-0a08-45df-a389-f9547ba83d8c` | `f02e62f2-…` | B | fdap | `2db71942-…` | Torneio Regional 1ª Região | 05/04/2025 | 50 Costas | SCM | 39"10 (dsq) | 58"78 (valid) | idem `23f53383` | A | não | **B) REMOÇÃO** — gêmeo correto já existe: `b3448e48` (legado, 58"78, valid) |
| `dd76be5d-12cd-44e1-9f11-0d86796fb7e0` | `f02e62f2-…` | B | fdap | `2db71942-…` | Torneio Regional 1ª Região | 05/04/2025 | 50 Livre | SCM | 32"97 | 53"09 | idem `3e9274b1` | A | não | **B) REMOÇÃO** — gêmeo: `c9559294` (legado, 53"09) |
| `76e8c63b-1966-4829-b69e-ca5c9c6e93ec` | `f02e62f2-…` | B | fdap | `2db71942-…` | Torneio Regional 1ª Região | 05/04/2025→06/04 real | 50 Peito | SCM | 43"48 | 1'15"22 | idem `d6b0ecfb` | A | não | **B) REMOÇÃO** — gêmeo: `30c532fa` (legado, 1'15"22, data 06/04 certa) |
| `af0a322c-68a3-4dbc-a807-795fc151c183` | `f02e62f2-…` | B | fdap | `6b4a524c-…` | Torneio Regional 1ª Região | 14/09/2025 | 50 Livre | LCM | 32"08 | 48"90 | idem `fae67d60` | A | não | **B) REMOÇÃO** — gêmeo: `ec7806ae` (legado, 48"90) |
| `f402a628-ba0f-43b2-a0dd-2e87c12be841` | `f02e62f2-…` | B | fdap | `6b4a524c-…` | Torneio Regional 1ª Região | 13/09/2025 | 50 Costas | LCM | 38"42 | 58"43 | idem `f57865a0` | A | não | **B) REMOÇÃO** — gêmeo: `34961ad4` (legado, 58"43) |
| `bd9a915e-da26-4f4d-beef-06b395387c69` | `f02e62f2-…` | B | fdap | `6b4a524c-…` | Torneio Regional 1ª Região | 13/09/2025 | 50 Borboleta | LCM | 37"07 | 1'05"71 | idem `dfac0c8e` | A | não | **B) REMOÇÃO** — gêmeo: `8795b5c8` (legado, 1'05"71) |
| `25a8975b-5db0-4a7a-9074-8554190c3ee4` | `f02e62f2-…` | B | fdap | `a79e18e2-…` | Campeonato Sul-Brasileiro 2025 | 07/11/2025 | 50 Costas | LCM | 36"23 | 56"98 | ResultList_26.pdf (já conhecido) | A | não | **B) REMOÇÃO** — gêmeo: `b0e30fd5` (legado, 56"98, mesma data) |
| `441b6362-57a5-40ea-bdd4-d0d152bba5d1` | `f02e62f2-…` | B | fdap | `3fb2b071-…` | Troféu Germano Bayer 2025 | 11/10/2025 | 50 Costas | LCM | 37"85 | 55"90 | ResultList_30.pdf (já conhecido) | A | não | **B) REMOÇÃO** — gêmeo: `19b18d21` (legado, 55"90, mesma data) |
| `76844398-502f-4f5a-abc7-a44ef5f28179` | `f02e62f2-…` | B | fdap | `08d312bd-…` | Torneio Regional 1ª Região 2026 | 08/03/2026 | 50 Costas | SCM | 36"98 | 54"68 | ResultList_66.pdf (já conhecido) | A | não | **B) REMOÇÃO** — gêmeo: `328f8189` (legado, 54"68, data legado 07/03 imprecisa) |
| `99cce11d-6960-4b59-90a5-10c99c650405` | `f02e62f2-…` | B | fdap | `6582ec40-…` | Campeonato Paranaense Inverno 2026 | 19/04/2026 | 50 Livre | SCM | 30"84 | 44"68 | ResultList_62.pdf (já conhecido) | A | não | **B) REMOÇÃO** — gêmeo: `504a3ce0` (legado, 44"68, mesma data) |
| `3d8b3776-4c0b-4cb4-9568-b473ad3f51d5` | `af41d466-…` | A | swimsystem | `87a5ffe4-…` | Torneio Regional 1ª Região | 14/09/2025 | 50 Livre | LCM | 49"78 | 48"90 | idem `fae67d60` | B | não | **B) REMOÇÃO** — gêmeo (mesmo atleta A): `fae67d60`, que vai ser corrigido no Grupo A |
| `9bcd7323-c85c-4da4-b93e-06c8518e21ef` | `af41d466-…` | A | swimsystem | `87a5ffe4-…` | Torneio Regional 1ª Região | 13/09/2025 | 50 Costas | LCM | 58"59 | 58"43 | idem `f57865a0` | B (pegou o nadador seguinte) | não | **B) REMOÇÃO** — gêmeo: `f57865a0`, corrigido no Grupo A |
| `387fac6e-1cbd-411a-b87c-25b9e927224f` | `af41d466-…` | A | swimsystem | `87a5ffe4-…` | Torneio Regional 1ª Região | 13/09/2025 | 50 Borboleta | LCM | 48"51 | 1'05"71 | idem `dfac0c8e` | B | não | **B) REMOÇÃO** — gêmeo: `dfac0c8e`, corrigido no Grupo A |

**¹ Nota sobre `b9b85e51`**: o gêmeo mais próximo no legado (`642d4d9f`, 1'15"10, também já confirmado correto) está datado 11/10/2025 — 1 dia antes da data precisa do evento (12/10/2025, achada no próprio PDF). Não é o mesmo caso dos outros pares (aqui as datas diferem, não é uma duplicata exata) — por isso `b9b85e51` continua Grupo A (UPDATE), mas registro que, depois do reparo, `b9b85e51` (12/10, 1'55"10) e `642d4d9f` (11/10, 1'55"10) vão ficar muito parecidos entre si (mesmo atleta B, mesma prova, 1 dia de diferença, tempos que deveriam ser o mesmo evento). Isso é a mesma imprecisão de "data do legado" já registrada como frente futura — não misturei com esta correção, só sinalizo o efeito colateral.

### GRUPO D — DATA FABRICADA (P0-B) — 3 registros, todos removíveis

| result_id | athlete_id | source | meet_id atual | Competição (nome) | Prova | Piscina | Tempo | Data atual (fabricada) | Data correta comprovada | Evidência da data | meet_id representa competição errada ou só data errada? | Existe meet canônico da competição real? | Suficiente corrigir só a data, ou precisa reassociar? |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `49963241-b279-4e54-b9e1-ee149e7d8cdd` | `af41d466-…` | swimsystem | `5a161825-…` | "Torneio Regional da 1ª Região (Pré-Mirim/Petiz)" | 50 Costas | SCM | 58"78 (dsq — status também errado) | **25/09/2026** | 05/04/2025 | ResultList_8.pdf | O **meet inteiro é fabricado**: mesmo nome da competição real, `external_id=39519` batendo com a real, mas com `source_id=swimsystem` (a real é `fdap`) e `start_date=25/09/2026` — é uma duplicata de chave criada porque `(source_id, external_id)` difere do meet real | **Sim** — `2db71942-…` (fdap, 39519, 05/04/2025, já existe e é o meet correto) | **Nenhuma das duas** — a solução certa é remover este `result` (Grupo B, gêmeo `23f53383` sendo corrigido no Grupo A) |
| `9f516fe7-3df5-48f1-af78-c0ba43b8b226` | `af41d466-…` | swimsystem | `5a161825-…` | idem | 100 Medley | SCM | 2'15"79 (tempo já certo) | **25/09/2026** | 05/04/2025 | ResultList_4.pdf | idem — meet fabricado | **Sim** — `2db71942-…` | **Nenhuma** — remover (Grupo B); gêmeo já correto **hoje**: `272aaa67` (fdap, mesmo tempo, data certa) |
| `17aad14d-9f91-410b-a7ba-3abdb7aec6e7` | `af41d466-…` | swimsystem | `5a161825-…` | idem | 50 Peito | SCM | 1'15"22 (tempo já certo) | **25/09/2026** | 06/04/2025 | ResultList_32.pdf | idem — meet fabricado | **Sim** — `2db71942-…` | **Nenhuma** — remover (Grupo B); gêmeo `d6b0ecfb` sendo corrigido no Grupo A |

**Conclusão do Grupo D**: os 3 nunca deveriam ter sido criados (nenhum já era um "resultado novo" real — são duplicatas com data fabricada de eventos que o atleta A já tinha registrado, corretamente ou não, em outro lugar). Nenhuma reassociação de `meet_id` é necessária porque a solução é remover a linha, não mantê-la. O meet fabricado `5a161825-…` (`Torneio Regional da 1ª Região`, 25/09/2026, source SwimSystem) **só tem esses 3 `results`** e **zero `meet_entries`** — depois de remover os 3, fica órfão e pode ser apagado com segurança (confirmado: `results.meet_id` é `ON DELETE SET NULL`, então mesmo que a ordem fosse invertida por engano, nada quebraria).

### Resumo da classificação pedida (A/B/C/D)

| Classificação | Quantidade | Observação |
|---|---|---|
| A) UPDATE seguro | 9 | 1 com nota de efeito colateral (`b9b85e51`) |
| B) candidato a remoção por duplicar registro correto do mesmo atleta | 16 | 13 do Grupo T + os 3 do Grupo D |
| C) requer reassociação de `meet_id` | 0 | O único cenário que pedia isso (Grupo D) resolve-se por remoção, não por reassociar |
| D) requer decisão adicional | 0 puro | `b9b85e51` é A com nota, não bloqueia |

### Proposta de snapshot / rollback

**Recomendo usar o mecanismo que já existe no banco em vez de criar algo novo**: a tabela `audit_log` já é populada automaticamente por um trigger (`results_audit_change`) em todo INSERT/UPDATE/DELETE de `results`, gravando `old_data`/`new_data` completos em JSONB — hoje já tem 130 linhas de histórico real. Qualquer futura correção destes 25 já vai gerar, sozinha, uma linha de auditoria por registro com o estado ANTES da mudança (`old_data`), suficiente para rollback exato (`UPDATE results SET (...) = (SELECT ... FROM jsonb_populate_record(null::results, old_data)) WHERE id=...`, ou simplesmente reconstruir o `INSERT` a partir do `old_data` de um `DELETE`).

**Complementar (cinto e suspensório)**: antes de qualquer execução futura, proponho exportar os 25 registros completos (todas as colunas de `results` + suas `result_sources`) para um JSON versionado no repositório (ex.: `commercial/docs/reparo-p0c-snapshot-27-09-2026.json`), como registro legível e independente do banco, para o caso de precisar consultar sem acesso ao `audit_log`. **Nada disso foi criado ainda** — é proposta.

### SQL proposto — NÃO EXECUTADO

```sql
-- ===== GRUPO A: UPDATE seguro (9 registros) =====
UPDATE results SET time_ms=58780, status='valid',
  result_fingerprint='af41d466-479b-47e5-8ffb-6dd03ae26e4f|2db71942-b4f2-42bb-bfc4-e0de08746b57|209728e8-d41f-4ab9-a658-f13da8e77315|2025-04-05|SCM|58780|valid',
  updated_at=now()
WHERE id='23f53383-7841-4ffe-a115-61308980bc5d';

UPDATE results SET time_ms=53090,
  result_fingerprint='af41d466-479b-47e5-8ffb-6dd03ae26e4f|2db71942-b4f2-42bb-bfc4-e0de08746b57|3e783e0c-a8e8-4d82-b012-86087f8d8d8a|2025-04-05|SCM|53090|valid',
  updated_at=now()
WHERE id='3e9274b1-4cc5-4cdc-a101-e54491757e88';

UPDATE results SET time_ms=75220,
  result_fingerprint='af41d466-479b-47e5-8ffb-6dd03ae26e4f|2db71942-b4f2-42bb-bfc4-e0de08746b57|8e027f8d-823c-40aa-82e9-f221cb821d83|2025-04-05|SCM|75220|valid',
  updated_at=now()
WHERE id='d6b0ecfb-bac9-468a-b963-6757fbf332ba';

UPDATE results SET time_ms=115100,
  result_fingerprint='f02e62f2-4987-4c99-aa21-1b8d89b80e65|3fb2b071-e133-43b8-a7fc-4d326ecbf946|a7fae32a-b2c4-4dc7-a068-c71092a7c853|2025-10-12|LCM|115100|valid',
  updated_at=now()
WHERE id='b9b85e51-f107-42df-9678-6cb081e55fec';

UPDATE results SET time_ms=48900,
  result_fingerprint='af41d466-479b-47e5-8ffb-6dd03ae26e4f|6b4a524c-20e0-49ec-82a6-8ad2e0374047|3e783e0c-a8e8-4d82-b012-86087f8d8d8a|2025-09-14|LCM|48900|valid',
  updated_at=now()
WHERE id='fae67d60-96f0-4227-b70d-5493c3450e5c';

UPDATE results SET time_ms=58430,
  result_fingerprint='af41d466-479b-47e5-8ffb-6dd03ae26e4f|6b4a524c-20e0-49ec-82a6-8ad2e0374047|209728e8-d41f-4ab9-a658-f13da8e77315|2025-09-13|LCM|58430|valid',
  updated_at=now()
WHERE id='f57865a0-d315-415f-8c58-fb38c027e08f';

UPDATE results SET time_ms=65710,
  result_fingerprint='af41d466-479b-47e5-8ffb-6dd03ae26e4f|6b4a524c-20e0-49ec-82a6-8ad2e0374047|9b371ad0-c246-4449-99e4-0f049a2c59e4|2025-09-13|LCM|65710|valid',
  updated_at=now()
WHERE id='dfac0c8e-0a62-4b9c-8e7c-7c84534a06ea';

UPDATE results SET time_ms=115100,
  result_fingerprint='af41d466-479b-47e5-8ffb-6dd03ae26e4f|4119d4f2-88f9-48dd-b7de-dc3bea591db7|a7fae32a-b2c4-4dc7-a068-c71092a7c853|2025-10-12|LCM|115100|valid',
  updated_at=now()
WHERE id='4869e32c-9849-48f6-8d8f-89ad66b2aa50';

UPDATE results SET time_ms=44680,
  result_fingerprint='af41d466-479b-47e5-8ffb-6dd03ae26e4f|4f78760e-7179-420a-afba-90dda53b3a83|3e783e0c-a8e8-4d82-b012-86087f8d8d8a|2026-04-19|SCM|44680|valid',
  updated_at=now()
WHERE id='f52b316f-a1b5-4788-b920-1d4e3a7605b7';

-- ===== GRUPO B: remoção por duplicar registro correto do mesmo atleta (16 registros) =====
DELETE FROM results WHERE id IN (
  'b4b6faba-0a08-45df-a389-f9547ba83d8c',
  'dd76be5d-12cd-44e1-9f11-0d86796fb7e0',
  '76e8c63b-1966-4829-b69e-ca5c9c6e93ec',
  'af0a322c-68a3-4dbc-a807-795fc151c183',
  'f402a628-ba0f-43b2-a0dd-2e87c12be841',
  'bd9a915e-da26-4f4d-beef-06b395387c69',
  '25a8975b-5db0-4a7a-9074-8554190c3ee4',
  '441b6362-57a5-40ea-bdd4-d0d152bba5d1',
  '76844398-502f-4f5a-abc7-a44ef5f28179',
  '99cce11d-6960-4b59-90a5-10c99c650405',
  '3d8b3776-4c0b-4cb4-9568-b473ad3f51d5',
  '9bcd7323-c85c-4da4-b93e-06c8518e21ef',
  '387fac6e-1cbd-411a-b87c-25b9e927224f',
  '49963241-b279-4e54-b9e1-ee149e7d8cdd',
  '9f516fe7-3df5-48f1-af78-c0ba43b8b226',
  '17aad14d-9f91-410b-a7ba-3abdb7aec6e7'
);

-- ===== Limpeza do meet fabricado pelo P0-B, só depois de confirmar 0 results restantes =====
DELETE FROM meets
WHERE id='5a161825-a021-458b-834a-7665a38623ea'
  AND NOT EXISTS (SELECT 1 FROM results WHERE meet_id='5a161825-a021-458b-834a-7665a38623ea');
```

### Contagens esperadas (antes → depois, se este plano for autorizado e executado)

| Métrica | Antes | Depois |
|---|---|---|
| `results` total | 81 | **65** (81 − 16 removidos) |
| CONFIRMADO CORRETO | 38 | **47** (38 + 9 corrigidos) |
| CONFIRMADO INCORRETO | 25 | **0** |
| SEM EVIDÊNCIA SUFICIENTE | 18 | 18 (inalterado — não tocar) |
| `results` do perfil A (`af41d466`) | 28 | **22** (perde 6: `3d8b3776`,`9bcd7323`,`387fac6e`,`49963241`,`9f516fe7`,`17aad14d`) |
| `results` do perfil B (`f02e62f2`) | 53 | **43** (perde 10) |
| `meets` total | (não contado nesta rodada) | −1 (remoção do meet fabricado `5a161825`) |
| `personal_bests` | 13 destes 25 são hoje o "recorde" de algum evento/piscina | recalculado sozinho pelo trigger — sem passo manual |

### O que ficaria visível para o Henrique no app

1. **Gráfico de Evolução**: 9 pontos mudam de valor (todos para tempos **mais lentos** que o atualmente exibido — os 9 erros do Grupo A sempre "roubaram" um tempo mais rápido de outro nadador). 16 pontos **desaparecem** (duplicatas removidas) — o gráfico deve ficar visualmente **igual ou mais correto**, nunca com menos eventos reais cobertos, porque todo ponto removido tem um gêmeo correto que permanece.
2. **Recorde pessoal / melhor tempo**: em pelo menos 13 provas, o "recorde" que o app mostra hoje é uma marca de outro nadador — depois do reparo, o recorde exibido passa a ser o tempo real do Vinícius (provavelmente mais lento do que aparece hoje).
3. **3 resultados de uma competição fantasma datada 25/09/2026** desaparecem por completo — se o Henrique já tiver notado uma competição estranha há 2 dias atrás no perfil A, é exatamente isso.
4. **Contagem total de resultados** cai (perfil A: 28→22; perfil B: 53→43) — é esperado e correto, não é perda de dado real, é remoção de duplicata sem substância.

### O que NÃO foi feito nesta etapa (conforme instruído)

Nenhum `UPDATE`/`DELETE`/`INSERT` real. Nenhuma reimportação. Nenhum "Atualizar Resultados" disparado. Nenhuma fusão de perfis. Nenhuma deduplicação geral. Nenhuma etapa F. Os 18 "sem evidência suficiente" não foram tocados nem se tentou inferir correção por plausibilidade. Os 1-2 casos de imprecisão de data do legado (1º dia do campeonato) não entraram nesta lista — ficam registrados como frente futura separada, sem misturar com o P0-B.

Aguardando o chat revisar este plano e, se aprovado, levá-lo ao Henrique para autorização explícita antes de qualquer escrita real.

### Plano APROVADO tecnicamente pelo chat — execução ainda BLOQUEADA até o Henrique autorizar (27/09/2026)

Chat confirmou a estratégia (9 UPDATE / 16 DELETE / DELETE condicional do meet fabricado / 18 sem evidência intocados / `results` 81→65) e acrescentou um checklist obrigatório de pré-voo, execução e pós-operação para quando a autorização vier:

1. Antes de executar: `SELECT` final dos 25 IDs para confirmar que nada mudou desde `fdb3783`.
2. Criar snapshot JSON versionado no repo dos 25 registros completos (`results` + `result_sources` + `personal_bests` pertinentes + o meet dos 3 casos de data) **antes** de qualquer escrita — o `audit_log` é uma segunda camada, não substitui esse snapshot.
3. Reverificar, imediatamente antes da operação, que cada um dos 16 gêmeos correto ainda existe e está igual para o mesmo `athlete_id` — se algum tiver sumido ou mudado, **abortar tudo e reportar**, não seguir parcialmente.
4. Executar em transação única se o mecanismo disponível garantir atomicidade; se não for possível garantir, **parar e voltar ao chat** antes de rodar qualquer coisa.
5. Nos 9 UPDATE: alterar somente os campos previstos no plano (`time_ms`, `status` onde aplicável, `result_fingerprint`), nada além disso.
6. Nos 16 DELETE: remover só os IDs explicitamente aprovados — sem deduplicação genérica.
7. Meet fabricado: só apagar depois de reconfirmar, pós-DELETE dos 3 results, que está de fato órfão (`results=0`, `meet_entries=0`, sem outra dependência).
8. Pós-operação obrigatória: conferir as contagens exatas (`results=65`, incorretos conhecidos=0, sem evidência=18, perfil A=22, perfil B=43), `personal_bests` recalculado, `result_sources` íntegro, views consistentes, **nenhum result fora dos 25 tocado**, `audit_log` gravado, ausência da competição fantasma, e um smoke test read-only do gráfico.
9. Não disparar "Atualizar Resultados"/reimportação durante a validação.
10. Qualquer pré-condição divergente → abortar, não improvisar.

**Nada foi executado.** Nenhum `UPDATE`/`DELETE` rodou nesta etapa nem vai rodar até o Henrique autorizar explicitamente. Code está de prontidão, seguindo este checklist à risca quando/se a autorização vier.

---
*Atualizado por Code em 27/09/2026. Toda entrada nova deve manter o formato acima (Status / Proposto por / O quê / Impacto / Próximo passo).*
