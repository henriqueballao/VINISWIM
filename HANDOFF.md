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
- **Edge Function `monitor-runner` agora está versionada em git**: `commercial/supabase/functions/monitor-runner/index.ts` (a partir do commit `c65d23c0f1777a2980398a3cc7f511cc20246d08`, refletindo a v59 implantada). As demais Edge Functions (`monitor-gateway`, `push-gateway`, `vapid-setup`, `push-runner`, `bootstrap-owner`, etc.) e as RPCs continuam só no Supabase, sem versionamento em git — pendência ainda aberta.
- **Existe um agendador automático (cron externo ou pg_cron) que chama o `monitor-runner` periodicamente, a cada ~2 minutos, independente de qualquer clique de usuário.** Descoberto em 26/09/2026 durante teste da D-004 (ver achados). Isso significa que a fila de `monitor_jobs`/`historical_archive_jobs` é sempre drenada automaticamente pelo sistema, não só quando alguém clica em Atualizar.
- Branch de trabalho do Code: `claude/novo-projeto-costaguerra-b2ua1t` (em ambos os repos). Mudanças não vão direto para `main`; ficam nessa branch até o usuário decidir mergear ou pedir um PR.

## Convenção de commits

`<tipo>(<escopo>): <resumo curto> [D-XXX]`

Tipos: `fix`, `feat`, `chore`, `docs`, `refactor`, `security`.
Escopo: nome do módulo/função (`monitor-runner`, `results-page`, `handoff`, etc.)
`[D-XXX]` referencia o número da decisão neste arquivo, quando aplicável.

Exemplo: `security(monitor-runner): remove delete automático em processArchiveJob [D-001]`

## Estado atual conhecido (snapshot atualizado em 26/09/2026, pós D-004 etapa A)

- HEAD do GitHub (main): `7c26358703c9f0f4c9b427c850f7b8a228e97ba2`. A branch de trabalho está à frente com os commits de D-001/D-002/D-004, nada mergeado em `main` ainda.
- Último deploy público confirmado: Pages run #503, 26/09 13:27:07Z. Nenhuma mudança de frontend desde então.
- `monitor-runner` (Edge Function): **versão 59 ACTIVE**, SHA `03b77a63ae7ce97b5e23dd405e1dac21f53aa54ab2456e529be064f59fb86162`.
- **RESOLVIDO (D-001)**: `DELETE` automático em `results` removido; RPCs de claim travadas para `anon`/`authenticated`.
- **Confirmado como correto**: `request_result_refresh` e `cancel_result_refresh` validam `auth.uid()` + `account_members`.
- **Schema D-004 etapa A já aplicado** (ver log de decisões): tabela `refresh_requests`, coluna `request_id` em `monitor_jobs`/`historical_archive_jobs`, view `v_refresh_request_status`. Nada disso é usado pelo frontend ainda — RPCs (etapa B) e frontend (etapa D) não foram tocados.
- **Regra de agregação de estado da D-004 está PROPOSTA, não congelada** — aguardando aprovação do chat da tabela completa (ver D-004 abaixo) antes de prosseguir para etapa B.
- `VINISWIM-MONITOR` (Render): serviço legado sem relação com o Supabase atual — pendente decisão do usuário sobre manter/arquivar.

## Achados/fixes independentes (fora da numeração D-XXX)

### FIX-001 — `historical_archive_jobs.status` não aceitava `'cancelled'`
- **Encontrado**: 26/09/2026, durante validação da D-004.
- **Problema**: o `CHECK` constraint da coluna só permitia `pending/running/completed/failed`. O `cancel_result_refresh(p_athlete_id)` **legado**, já em produção, tenta gravar `status='cancelled'` nessa tabela — ou seja, esse cancelamento provavelmente falhava com erro sempre que havia uma busca histórica pending/running no momento do clique de pausar.
- **Correção aplicada**: migration própria `fix_historical_archive_jobs_status_allow_cancelled` — `DROP`/`ADD CONSTRAINT` ampliando a lista para incluir `'cancelled'`. Nenhuma linha existente foi alterada (todas já estavam dentro da lista antiga).
- **Verificação**: `pg_get_constraintdef` confirmou a nova lista instalada. Testado com gravação sintética (INSERT/UPDATE em atleta de teste, sem tocar `results`): a mesma escrita que o `cancel_result_refresh` legado faz (`status='cancelled', heartbeat_at=null, finished_at=now()` sobre uma linha `running`) agora é aceita.
- **Pendente**: validar `cancel_result_refresh_request` (RPC nova da D-004, etapa B) faz a mesma gravação com sucesso — só dá para confirmar quando essa RPC existir.

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
- **Status**: em execução. Etapa A concluída e verificada. Regra de agregação de estado **proposta, aguardando aprovação do chat** antes de prosseguir para etapa B.
- **Decisões de produto já aprovadas pelo chat**: request_id é por atleta/conta (não por aba/dispositivo); duas abas enxergam o mesmo estado; pausar cancela só o request_id exibido; `request_result_refresh` reutiliza solicitação ativa em vez de criar concorrente; `cancel_result_refresh(p_athlete_id)` legado é preservado; nova RPC `cancel_result_refresh_request(p_request_id)` para o frontend novo; etapas em commits separados (A schema, B RPCs, C monitor-runner, D frontend, E validação, F limpeza de legado depois); zero linha de `results` tocada para testar; frontend novo só publica depois do backend validado.

#### Etapa A — Migration aditiva de schema (EXECUTADA E VERIFICADA)
- `CREATE TABLE public.refresh_requests` (id, athlete_id, requested_by, source_codes text[], created_at, updated_at, cancel_requested_at) — **sem coluna `status`**, por decisão do chat (evita duas fontes de verdade).
- RLS habilitado, policy `refresh_requests_select_member` (mesmo padrão de `monitor_jobs`/`historical_archive_jobs`: `EXISTS` via `athletes`+`account_members`).
- `ALTER TABLE monitor_jobs ADD COLUMN request_id uuid REFERENCES refresh_requests(id)` (nullable).
- `ALTER TABLE historical_archive_jobs ADD COLUMN request_id uuid REFERENCES refresh_requests(id)` (nullable).
- Índices em `request_id` nas duas tabelas de job, e em `refresh_requests(athlete_id, created_at desc)`.
- View `public.v_refresh_request_status` **com `security_invoker = true`** (evita repetir o problema já sinalizado pelo advisor em `v_result_timeline`, que é `SECURITY DEFINER` e bypassa RLS). Agrega `monitor_jobs` + `historical_archive_jobs` por `request_id` e calcula `derived_status`, `running_started_at` (para o timer) e `sample_error`.
- **Verificado**: RLS ativo, policy instalada, colunas criadas, `reloptions` da view confirma `security_invoker=true`, grants de SELECT herdados automaticamente para `anon`/`authenticated`/`service_role` (mesmo padrão das tabelas existentes — a proteção real é só a RLS, os GRANTs de tabela no Supabase são amplos por padrão).

#### Regra de agregação de estado (PROPOSTA — pedindo aprovação explícita antes de congelar)

Fonte única: a view `v_refresh_request_status`. Nem backend (RPCs) nem frontend devem reimplementar esta lógica — ambos só leem `derived_status`.

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

**Justificativa da regra 1 ser incondicional** (o ponto que o chat pediu para revisar com mais cuidado): o handoff técnico original é explícito — "se o usuário clicar novamente enquanto existir pending/running: cancelar/paralisar a busca; bonequinho para; mostrar PAUSA SOLICITADA" e "o aviso deve permanecer até uma nova solicitação explícita." Isso exige feedback **imediato** no clique, sem esperar o backend convergir. Como uma nova solicitação sempre gera um `request_id` novo (regra de "reutilizar solicitação ativa" só reutiliza requests não-cancelados), marcar um `request_id` como `cancelled` para sempre assim que `cancel_requested_at` é setado nunca bloqueia buscas futuras — só é o rótulo definitivo daquele request específico.

**Tabela de combinações pedidas pelo chat** (verificadas com dados sintéticos, exceto onde marcado):

| Combinação de jobs | `derived_status` | Justificativa |
|---|---|---|
| só `pending` | `pending` | regra 3 |
| só `running` | `running` | regra 2 |
| só `completed` | `completed` | regra 5 |
| só `failed` | `failed` | regra 4 |
| `completed` + `running` | `running` | regra 2 antes da 5 — ainda há trabalho ativo, não declarar sucesso parcial |
| `completed` + `pending` | `pending` | regra 3 antes da 5 |
| `completed` + `failed` | `failed` | regra 4 antes da 5 — sucesso parcial não deve mascarar que uma fonte falhou |
| `failed` + `pending` | `pending` | regra 3 antes da 4 — ainda não é hora de julgar; outra fonte pode compensar |
| `failed` + `running` | `running` | regra 2 antes da 4, mesmo motivo |
| `cancelled` (status do job) sozinho + `cancel_requested_at` setado | `cancelled` | regra 1, direto |
| `cancel_requested_at` setado + job `running` | `cancelled` | regra 1 vence — feedback imediato, não espera o runner reagir |
| `cancel_requested_at` setado + job `pending` | `cancelled` | regra 1 vence |
| `cancel_requested_at` setado + job `completed` | `cancelled` | regra 1 vence, mesmo que o trabalho tenha terminado antes do cancelamento chegar — reflete a intenção do usuário de parar, não o timing exato da corrida |
| `cancel_requested_at` setado + job `failed` | `cancelled` | regra 1 vence |
| múltiplas fontes com conclusões diferentes (ex.: `completed` + `pending` + `failed` ao mesmo tempo) | `pending` | regras avaliadas na ordem 2→3→4→5; enquanto qualquer fonte está ativa, o request inteiro é "ainda buscando" |
| solicitação sem nenhum job (falha de enqueue) | `no_sources` | regra 6 |
| cancelamento pedido enquanto outro job está de fato em execução no `monitor-runner` (corrida real, não só o status no banco) | `cancelled` (imediato, pela regra 1) — **mas depende de uma correção na etapa C** | ver nota abaixo |

**Nota importante descoberta ao analisar esse último caso — revisão da etapa C:** o `monitor-runner` hoje, ao terminar um job, grava `status:'completed'`/`'failed'` **incondicionalmente** (sem checar se o status atual ainda é `'running'`). Se um cancelamento acontecer exatamente enquanto o runner está processando aquele job, a `UPDATE` final do runner **sobrescreve** o `status='cancelled'` de volta para `completed`/`failed`, apagando o rastro de que houve um pedido de cancelamento — mesmo que a `v_refresh_request_status` já mostre `cancelled` corretamente por causa da regra 1 (que não depende do status do job). Ou seja: a experiência do usuário fica correta (viu "PAUSA SOLICITADA" na hora), mas o histórico do job individual mentiria depois. Por isso a etapa C **precisa** incluir uma pequena correção: as `UPDATE`s finais do runner devem ter `.eq('status','running')` na condição, para nunca reviver um job que já foi marcado `cancelled` por fora. **Isso substitui minha conclusão anterior de "não precisa mexer no monitor-runner" — estava errada**, só enxerguei o problema analisando esse cenário específico.

**Pedido ao chat**: aprovar esta tabela e a regra de precedência (incluindo a correção da etapa C) antes de eu prosseguir para a etapa B.

---
*Atualizado por Code em 26/09/2026. Toda entrada nova deve manter o formato acima (Status / Proposto por / O quê / Impacto / Próximo passo).*
