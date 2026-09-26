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
5. Toda mudança de código roda em **commits pequenos e verificáveis**, separando limpeza de mudança funcional.
6. Testes de importação/parser usam SELECT, fixtures ou dry-run — nunca escrita na base real sem autorização.

## Onde as coisas vivem

- Repo principal: `henriqueballao/VINISWIM` — frontend em `commercial/apps/web/`, publicação em `app/` (GitHub Pages, domínio `viniswim.com.br/app/`).
- Repo `henriqueballao/VINISWIM-MONITOR`: serviço legado standalone (Node/Express, hospedado no Render), não conectado ao Supabase. Status ativo/morto ainda não confirmado pelo usuário.
- Supabase (projeto `VINISWIM`, ref `cdtvhagbgiwnjkgninqn`, org `henriqueballao's Org`): banco, Auth, RLS, RPCs e Edge Functions. **O código das Edge Functions e das RPCs não está versionado em git** — existe só no Supabase. Isso está registrado como pendência (ver Decisão D-002).
- Branch de trabalho do Code: `claude/novo-projeto-costaguerra-b2ua1t` (em ambos os repos). Mudanças não vão direto para `main`; ficam nessa branch até o usuário decidir mergear ou pedir um PR.

## Convenção de commits

`<tipo>(<escopo>): <resumo curto> [D-XXX]`

Tipos: `fix`, `feat`, `chore`, `docs`, `refactor`, `security`.
Escopo: nome do módulo/função (`monitor-runner`, `results-page`, `handoff`, etc.)
`[D-XXX]` referencia o número da decisão neste arquivo, quando aplicável.

Exemplo: `security(monitor-runner): remove delete automático em processArchiveJob [D-001]`

## Estado atual conhecido (snapshot 26/09/2026, pós-auditoria)

- HEAD do GitHub (main): `7c26358703c9f0f4c9b427c850f7b8a228e97ba2` (build automático do commit `f1a9a5b1c` — "Remove verified unused legacy CSS").
- Último deploy público confirmado: Pages run #503, sucesso, 26/09 13:27:07Z, sobre o commit acima.
- `monitor-runner` (Edge Function): versão **58 ACTIVE**, SHA `3918ee312af7d049f23d8166668fe9b44f966b122082439e796ec9539814028c`.
- **CONFIRMADO**: `processArchiveJob` ainda contém `await db.from('results').delete().eq('id',dup.id)` — deleta resultados oficiais "duplicados" automaticamente, sem confirmação, toda vez que um job de `historical_archive_jobs` roda. Ver Decisão D-001.
- **CONFIRMADO**: `claim_monitor_jobs` e `claim_historical_archive_jobs` são `SECURITY DEFINER` sem checagem de `auth.uid()` e executáveis por `anon`/`authenticated` via REST — qualquer pessoa não autenticada pode chamar essas RPCs. Ver Decisão D-001.
- **Confirmado como correto**: `request_result_refresh` (as duas versões) e `cancel_result_refresh` validam `auth.uid()` + `account_members` antes de agir.
- Frontend (`ResultsPage`/App.tsx): considera `monitor_jobs` e `historical_archive_jobs` corretamente para pending/running/failed. Ainda depende de string (`refreshMsg`) em vez de um `request_id` de correlação — risco de stale state remanescente (ver Decisão D-003, ainda não aberta para execução).
- Animação do nadador: CSS limpo, um único `@keyframes swimAcross`, sem duplicação — confirmado ok.
- `VINISWIM-MONITOR` (Render): serviço legado sem relação com o Supabase atual — pendente decisão do usuário sobre manter/arquivar.

## Log de decisões

### D-001 — Remover DELETE destrutivo do monitor-runner + travar RPCs de claim
- **Status**: proposto, aguardando autorização para executar.
- **Proposto por**: Code (achado de auditoria), validado pelo handoff do chat de 26/09/2026.
- **O quê**: (a) remover a chamada `results.delete()` dentro de `processArchiveJob`, mantendo o resto da lógica de promoção intacta; (b) `REVOKE EXECUTE` de `anon` e `authenticated` em `claim_monitor_jobs` e `claim_historical_archive_jobs`.
- **Impacto em dados**: nenhum — só impede deleções futuras e fecha acesso anônimo à fila. Não toca em nenhuma linha já gravada.
- **Próximo passo**: aguardando "pode aplicar" do usuário.

---
*Atualizado por Code em 26/09/2026. Toda entrada nova deve manter o formato acima (Status / Proposto por / O quê / Impacto / Próximo passo).*
