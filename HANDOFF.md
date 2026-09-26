# VINISWIM — HANDOFF.md (fonte única de verdade)

Este arquivo é o registro vivo de decisões técnicas do projeto VINISWIM. Ele existe para que o "chat" (arquitetura/decisão) e o "Code" (execução) fiquem sincronizados sem depender de copiar e colar mensagens.

## Papéis (definido em 26/09/2026)

- **Chat**: discute arquitetura, avalia risco, decide o quê fazer e em que ordem. Não tem acesso a GitHub/Supabase. Lê este arquivo (colado pelo usuário) antes de decidir algo novo.
- **Code** (esta sessão / Claude Code): único executor. É quem tem acesso de escrita a GitHub e Supabase. Implementa exatamente o que foi decidido, registra aqui o que foi feito, e não decide sozinho mudanças de arquitetura ou de dados — só propõe.
- **Usuário**: ponte entre os dois, autoriza qualquer ação sobre dados reais, e decide em caso de divergência entre chat e Code.

## Regras invioláveis (herdadas do handoff técnico de 26/09/2026)

1. Nenhuma alteração em dados reais de atletas (`results` e tabelas relacionadas) sem autorização explícita do usuário — nada de insert/update/delete/importação/dedup automática.
2. Nenhum código pode depender do nome "Vini" ou de qualquer atleta específico para funcionar.
3. Não redesenhar, não trocar stack, não desligar RLS, não usar service_role no browser.
4. Commit ≠ produção. Só declarar algo publicado depois de: build passou → workflow rodou → GitHub Pages fez deploy → (quando relevante) confirmação de que não é cache/service worker servindo versão antiga.
5. Toda mudança de código roda em **commits pequenos e verificáveis**, separando limpeza de mudança funcional. Não misturar correção funcional, segurança e limpeza/refatoração no mesmo commit.
6. Testes de importação/parser usam SELECT, fixtures ou dry-run — nunca escrita na base real sem autorização.

## Onde as coisas vivem

- Repo principal: `henriqueballao/VINISWIM` — frontend em `commercial/apps/web/`, publicação em `app/` (GitHub Pages, domínio `viniswim.com.br/app/`).
- Repo `henriqueballao/VINISWIM-MONITOR`: serviço legado standalone (Node/Express, hospedado no Render), não conectado ao Supabase. Status ativo/morto ainda não confirmado pelo usuário.
- Supabase (projeto `VINISWIM`, ref `cdtvhagbgiwnjkgninqn`, org `henriqueballao's Org`): banco, Auth, RLS, RPCs e Edge Functions.
- **Edge Function `monitor-runner` agora está versionada em git**: `commercial/supabase/functions/monitor-runner/index.ts` (a partir do commit `c65d23c0f1777a2980398a3cc7f511cc20246d08`, refletindo a v59 implantada). As demais Edge Functions (`monitor-gateway`, `push-gateway`, `vapid-setup`, `push-runner`, `bootstrap-owner`, etc.) e as RPCs continuam só no Supabase, sem versionamento em git — pendência ainda aberta.
- Branch de trabalho do Code: `claude/novo-projeto-costaguerra-b2ua1t` (em ambos os repos). Mudanças não vão direto para `main`; ficam nessa branch até o usuário decidir mergear ou pedir um PR.

## Convenção de commits

`<tipo>(<escopo>): <resumo curto> [D-XXX]`

Tipos: `fix`, `feat`, `chore`, `docs`, `refactor`, `security`.
Escopo: nome do módulo/função (`monitor-runner`, `results-page`, `handoff`, etc.)
`[D-XXX]` referencia o número da decisão neste arquivo, quando aplicável.

Exemplo: `security(monitor-runner): remove delete automático em processArchiveJob [D-001]`

## Estado atual conhecido (snapshot atualizado em 26/09/2026, pós D-001/D-002)

- HEAD do GitHub (main): `7c26358703c9f0f4c9b427c850f7b8a228e97ba2` (build automático do commit `f1a9a5b1c` — "Remove verified unused legacy CSS"). A branch de trabalho está à frente disso com os commits de D-001 (docs) e D-002 (código versionado), mas nada foi mergeado em `main` ainda.
- Último deploy público confirmado: Pages run #503, sucesso, 26/09 13:27:07Z, sobre o commit acima. Nenhuma mudança de frontend foi feita desde então — D-001/D-002 tocaram só Supabase e git, não o app publicado.
- `monitor-runner` (Edge Function): **versão 59 ACTIVE**, SHA `03b77a63ae7ce97b5e23dd405e1dac21f53aa54ab2456e529be064f59fb86162`. Código também versionado em `commercial/supabase/functions/monitor-runner/index.ts`.
- **RESOLVIDO (D-001)**: o `DELETE` automático em `results` dentro de `processArchiveJob` foi removido. Verificado por diff programático (linha a linha) entre v58 e v59: a única diferença é a remoção do bloco de 7 linhas que fazia o delete — nenhuma outra lógica foi tocada.
- **RESOLVIDO (D-001)**: `claim_monitor_jobs` e `claim_historical_archive_jobs` agora têm `EXECUTE` revogado de `anon` e `authenticated`; `service_role` mantém acesso. Verificado via `has_function_privilege`.
- **Confirmado como correto**: `request_result_refresh` (as duas versões) e `cancel_result_refresh` validam `auth.uid()` + `account_members` antes de agir.
- Frontend (`ResultsPage`/App.tsx): considera `monitor_jobs` e `historical_archive_jobs` corretamente para pending/running/failed. Ainda depende de string (`refreshMsg`) em vez de um `request_id` de correlação — ver proposta D-003 (não implementada).
- Animação do nadador: CSS limpo, um único `@keyframes swimAcross`, sem duplicação — confirmado ok.
- `VINISWIM-MONITOR` (Render): serviço legado sem relação com o Supabase atual — pendente decisão do usuário sobre manter/arquivar.

## Log de decisões

### D-001 — Remover DELETE destrutivo do monitor-runner + travar RPCs de claim
- **Status**: APROVADA pelo chat e EXECUTADA e VERIFICADA em 26/09/2026.
- **Proposto por**: Code (achado de auditoria), validado pelo handoff do chat de 26/09/2026.
- **O quê foi feito**:
  1. Removido o bloco `results.delete()` dentro de `processArchiveJob` (deploy da Edge Function `monitor-runner`, v58→v59, SHA novo `03b77a63ae7ce97b5e23dd405e1dac21f53aa54ab2456e529be064f59fb86162`). Nenhuma outra lógica foi alterada (diff programático confirmou remoção exata de 7 linhas).
  2. `REVOKE EXECUTE ON FUNCTION public.claim_monitor_jobs(integer) FROM anon, authenticated` e o mesmo para `claim_historical_archive_jobs(integer)`; `GRANT EXECUTE ... TO service_role` explícito nas duas (migration `revoke_anon_authenticated_claim_rpcs`).
- **Verificação pós-execução**: `get_edge_function` confirmou v59 ACTIVE sem `results.delete()`. `has_function_privilege` confirmou `anon`/`authenticated` = false e `service_role` = true nas duas RPCs.
- **Impacto em dados**: nenhum. Nenhuma linha de `results` foi lida, escrita ou apagada durante a execução desta decisão.

### D-002 — Versionar em git o monitor-runner efetivamente implantado (pós D-001)
- **Status**: APROVADA pelo chat e EXECUTADA em 26/09/2026.
- **O quê foi feito**: código da v59 (idêntico ao implantado, sem refatoração) commitado em `commercial/supabase/functions/monitor-runner/index.ts`, branch `claude/novo-projeto-costaguerra-b2ua1t`, commit `c65d23c0f1777a2980398a3cc7f511cc20246d08`.
- **Observação**: as demais Edge Functions e as RPCs continuam não versionadas — se o chat quiser, isso pode virar uma D-00X futura (mesmo padrão: buscar código implantado, commitar como está, sem refatorar).

### D-003 — Correlação por request_id no fluxo de Atualizar (SOMENTE PROPOSTA — NÃO IMPLEMENTADA)
- **Status**: proposta enviada para revisão do chat. Código NÃO foi alterado.
- **Problema que resolve**: hoje a "solicitação atual" no frontend é inferida por uma string (`refreshMsg.startsWith('Atualização iniciada')`) e as RPCs de cancelamento/claim operam por `athlete_id`, não por clique/solicitação. Isso deixa: (a) risco de job antigo (de outra aba, dispositivo, ou solicitação anterior já abandonada) contaminar o estado da solicitação atual; (b) `cancel_result_refresh` cancela *todos* os jobs pendentes/rodando do atleta, não só os da solicitação que dísparou o cancelamento; (c) nada sobrevive a um reload de página — `latchedAlert`/`syncSeconds` são estado local React.
- **Desenho proposto**:
  1. Nova tabela `refresh_requests` (id uuid pk, athlete_id, requested_by, source_codes text[], status, created_at, updated_at, cancel_requested_at, completed_at, error_summary) com RLS no mesmo padrão de `monitor_jobs`/`historical_archive_jobs` (SELECT via `account_members`).
  2. Nova coluna `request_id uuid references refresh_requests(id)`, nullable, em `monitor_jobs` e `historical_archive_jobs` — aditivo, linhas antigas ficam `NULL` sem quebrar nada.
  3. `request_result_refresh` passa a criar a linha em `refresh_requests` primeiro e carimbar `request_id` em todo job que insere/atualiza nesse clique; retorna `request_id` no JSON de resposta.
  4. Nova `cancel_result_refresh(p_request_id uuid)` cancela só os jobs daquele `request_id` (mantém a versão por `athlete_id` como legado até o frontend migrar — não deletar overload sem checar referências, igual regra do handoff original).
  5. Trigger/função de reconciliação: quando um job muda de status, recalcula `refresh_requests.status` (completed só quando todos os jobs daquele request_id saírem de pending/running sem erro; failed/cancelled conforme o caso).
  6. Frontend: guarda `request_id` retornado em vez de inferir por string; timer/estado passam a vir de uma consulta filtrada por `request_id`; no mount/reload, busca o `refresh_requests` mais recente do atleta para reconstruir o estado (resolve "PAUSA SOLICITADA" sumir no reload).
  7. Migration 100% aditiva e reversível (nova tabela + duas colunas nullable); rollback é só dropar as duas colunas e a tabela.
- **Pontos em aberto para o chat decidir antes de qualquer implementação**:
  - Comportamento de concorrência: se duas abas/dispositivos disparam Atualizar para o mesmo atleta, o segundo clique deve cancelar a `refresh_request` da primeira aba (mesmo sendo "outra solicitação"), ou os dois devem coexistir? Isso é decisão de produto, não técnica.
  - Se vale a pena já aposentar a assinatura antiga de `cancel_result_refresh(p_athlete_id)` depois que o frontend migrar, ou mantê-la indefinidamente por segurança.
- **Próximo passo**: aguardando decisão do chat/usuário sobre implementar (viraria D-004 com escopo fechado) e sobre os dois pontos em aberto acima.

---
*Atualizado por Code em 26/09/2026. Toda entrada nova deve manter o formato acima (Status / Proposto por / O quê / Impacto / Próximo passo).*
