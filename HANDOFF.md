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

## Estado atual conhecido (snapshot atualizado em 26/09/2026, pós D-004 etapas A+B+C)

- HEAD do GitHub (main): `7c26358703c9f0f4c9b427c850f7b8a228e97ba2`. A branch de trabalho está à frente com os commits de D-001/D-002/D-004/FIX-001, nada mergeado em `main` ainda.
- Último deploy público confirmado: Pages run #503, 26/09 13:27:07Z. Nenhuma mudança de frontend desde então — D-004 ainda não chegou na etapa D (frontend).
- `monitor-runner` (Edge Function): **versão 60 ACTIVE**, SHA `a590564ef67d6ac374d5513849e144860ffbbd41c089ff0d28134fc460382b0e` (v59 + guardas de concorrência da etapa C). Mirror em git verificado byte-a-byte igual ao deploy real (ver incidente de transcrição registrado na etapa C abaixo).
- **RESOLVIDO (D-001)**: `DELETE` automático em `results` removido; RPCs de claim travadas para `anon`/`authenticated`.
- **Confirmado como correto**: `request_result_refresh` e `cancel_result_refresh` (versões legadas de 1 argumento) validam `auth.uid()` + `account_members`.
- **D-004 etapas A, B e C EXECUTADAS e VERIFICADAS** (ver log de decisões). Regra de agregação de estado **APROVADA e CONGELADA** pelo chat. RPCs novas (`request_result_refresh` reescrita, `cancel_result_refresh_request` nova) implantadas e testadas com dados sintéticos. `monitor-runner` com guardas de concorrência implantado como v60.
- **Frontend (etapa D) ainda NÃO iniciado** — aguardando relatório de revisão cruzada deste ciclo antes de começar, por instrução explícita do chat.
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
- **Status**: etapas A, B e C EXECUTADAS e VERIFICADAS. Regra de agregação de estado **APROVADA e CONGELADA** pelo chat, incluindo a correção de concorrência na etapa C. Aguardando revisão cruzada deste relatório antes de iniciar a etapa D (frontend).
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

**Incidente (transparência total, pedido explícito do protocolo do chat):** ao transcrever manualmente o arquivo completo (~41KB) para o commit git da etapa C (espelho do deploy, por decisão da D-002), introduzi um erro de digitação: um `\n` literal (dois caracteres, barra invertida + "n") em vez de uma quebra de linha real dentro da função `parseEntries`, logo depois de `let m;`. Encontrei esse erro eu mesmo, antes de reportar a etapa como concluída, comparando o arquivo commitado com meu arquivo de referência local (que já tinha sido conferido byte-a-byte contra o v60 real implantado no Supabase). **A Edge Function realmente implantada (v60) nunca teve esse problema** — o erro existiu só no espelho em git, e só entre o commit da etapa C e o commit de correção seguinte. Corrigido no commit `a9eb3545f4a7e388ea7f5463d5e6e5ab09e77cb1` (mensagem: "fix(handoff): corrige erro de transcricao no commit anterior (linha 223, sem mudanca de logica) [D-004]"). **Verificação final**: busquei o conteúdo do commit de correção de volta do GitHub e fiz diff byte-a-byte contra o arquivo de referência do v60 real — resultado idêntico, sem nenhuma diferença. O mirror em git agora reflete exatamente o que está em produção.

---
*Atualizado por Code em 26/09/2026. Toda entrada nova deve manter o formato acima (Status / Proposto por / O quê / Impacto / Próximo passo).*
