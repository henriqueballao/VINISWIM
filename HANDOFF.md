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

---
*Atualizado por Code em 27/09/2026. Toda entrada nova deve manter o formato acima (Status / Proposto por / O quê / Impacto / Próximo passo).*
