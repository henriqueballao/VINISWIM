# Revisão independente adversarial — encaminhamento executável ao Codex
Data: 2026-10-11. Branch: `fix/official-import-audit-20261011`. PR: #17.
Status global: **REPROVADO**. Revisão de leitura GitHub, Supabase e Railway. Nenhuma operação sobre dados, deploy, merge ou reexecução de migrations foi realizada nesta revisão.

## Fonte de evidências
- Documentos examinados primeiro: `docs/audit/2026-10-11/gpt-handoff.md` e `report.md`.
- GitHub compare `main...fix/official-import-audit-20261011`: 8 commits à frente, 28 arquivos alterados no momento da consulta.
- Supabase `cdtvhagbgiwnjkgninqn`: projetos, histórico de migrations, definição atual de Edge Functions, consultas SELECT em catálogo, ACL, RLS e contagens.
- Railway: ambientes de `VINISWIM-COMMERCIAL` e `VINISWIM-MONITOR`.
- Este documento distingue **confirmado**, **inferência/risco** e **não verificado**. Os relatórios e links de CI são evidências documentais, não equivalem a homologação da produção.

## Fatos independentemente confirmados
1. Supabase contém as migrations `20261011142913`, `20261011143101` e `20261011145252` no histórico. `v_result_timeline` está com `security_invoker=true`; as cinco caches de evidências estão com RLS ligado, sem escrita direta por `authenticated`; `service_role` mantém escrita. A policy `results_delete_account_writer` restringe DELETE à origem manual, não oficial, com associação e papel da conta. **Não reaplicar SQL.**
2. ACL das cinco caches ainda concede SELECT a `anon` e `authenticated`; RLS default-deny impede leitura comum na ausência de policies permissivas. Revisar privilégios indiretos por RPC/SECURITY DEFINER e consumidores antes de eventual REVOKE SELECT.
3. Edge publicada: `monitor-runner` v115 e `import-v2-runner` v30, ambas `verify_jwt=false`. O código publicado de v30 importa módulos remotos fixados em `f7a54ea2298888aa40fa072758b8105ec5388fda`. O novo `current-meet-adapter.mjs` não está integrado à Edge publicada.
4. Código publicado de v30 contém `readerText` que utiliza cache/leitor externo; `persistCandidates` calcula fingerprint incluindo `timeMs` e `status`. Risco real de duplicidade ao corrigir tempo oficial. A PR não entrega reconciliador transacional.
5. Consultas independentes no Supabase: `results=0`, `meet_entries=0`, `personal_bests=0` e 8 `monitor_jobs` pendentes, à data de auditoria. Não extrapolar estas contagens para todas as tabelas derivadas.
6. Cron ativo `viniswim-import-v2-runner` a cada minuto via `net.http_post` sem autenticação explícita no cabeçalho exibido; cron `viniswim-nightly-all-athlete-full-scan` ativo diariamente às 06:00 UTC. Proteger Edge e cron **em conjunto**, sem romper execução.
7. Railway: `VINISWIM-COMMERCIAL` web e monitor tiveram últimos deployments FAILED; `VINISWIM-MONITOR` `viniswim-monitor-live` teve deployment SUCCESS sem volume; serviço antigo `viniswim-monitor` sem último deployment possui volume /data. Existe ainda `push-test-399680` com exclusão apenas staged e volume separado. Nada disso prova armazenamento de resultados esportivos em Railway.
8. Na conta auditada, registros de Vini 422692, Lorenzo 399680 e configuração de André 393259 existem. André não tem `athlete_identifiers` correspondente; não fundir atletas de contas distintas. Ausência de André nos oito PDFs relatados não prova inexistência histórica.

## Achados adicionais na PR que o Codex deve corrigir ou refutar com testes
- **ALTO — chave ambígua de resultado:** `commercial/packages/import-v2/src/current-meet-adapter.mjs:5-7` (`officialResultKey`) não distingue número externo de prova, rodada/etapa e sexo. `scanCurrentMeet` também deduplica balizamento apenas por atleta/evento/data/piscina. Duas provas válidas do mesmo estilo num dia podem colidir. Criar identidade tenant-aware/evento-etapa com evidência oficial e testar colisões.
- **ALTO — procedência declarada não comprovada:** `current-meet-adapter.mjs:17-24` aceita `rawHash` e `retrievedAt` fornecidos no objeto sem recalculá-los a partir dos bytes. Ligar a ingestão a captura original verificável; hash de bytes, URL final, redirecionamentos, instante, parser e excerto devem ficar associados à escrita.
- **ALTO — validação insuficiente:** `swimsystem-modern-results.mjs` usa data extraída do cabeçalho da prova sem conferir explicitamente que está dentro das datas da competição; `contracts.mjs` confere campos essenciais, mas não vínculo completo entre conta, atleta, meet, rodada e documento. Adicionar testes de datas incompatíveis e documentos de outra competição/piscina.
- **ALTO — state helper inconsistente:** `failure-states.mjs`, `retryState` devolve sempre `status:pending` e `lastError:null`, mesmo para falha bloqueante. Se usado em produção, poderá ocultar diagnóstico ou reabrir bloqueios. Exigir testes da máquina de estados completa, 401/403/404/429/5xx/TLS/timeout, limites de retentativas e persistência do último erro.
- **MÉDIO — parsing e timezone:** `swimsystem-seeded.mjs` usa regex dependentes de linhas e deduplica por prova/dia, e `scheduledInstant` usa convergência iterativa. Testar segunda sessão, raia zero, continuação de página, horários inexistentes/ambíguos, fronteiras de data, formatos alternativos. Não aceitar tempo de inscrição como resultado.
- **MÉDIO — build e bundle:** `.github/workflows/viniswim-commercial-app.yml` executa `npm install` sem lockfile e grava dist no `app/` de `main`. O relatório e `published-artifact-comparison.json` documentam bytes do bundle servido e divergência fonte `App.tsx` vs artefato. Confirmar novamente domínio/DNS/serviço originador e reconciliar comportamento `monitor-runner` vs `source_link_requests` antes do rebuild.
- **Evidência parcial:** `fixtures/official-20261011/provenance.json` contém detalhes de dois PDFs para as fixtures; a auditoria relata oito PDFs em artifact Actions `38148027929`. Verificar os oito originais por hash, sua disponibilidade e o vínculo texto↔bytes. O teste em `current-meet-adapter.test.mjs` prova determinismo em memória, **não** idempotência SQL, captura ao vivo ou UI publicada.
- **Segurança:** `verify_jwt=false` exige autenticação interna de serviço e autorização por usuário/conta/atleta nos handlers. Auditar métodos aceitos, RPCs SECURITY DEFINER, cancelamento, leases, requeues e jobs legados. Cenários de negação cruzada entre tenants devem usar dados de teste isolados, não inserir resultados sintéticos em produção.

## Plano obrigatório para o Codex (PR #17 permanece draft)
1. Conferir diff completo, histórico e linhas reais antes de afirmar correção. Documentar para cada causa raiz arquivo/linha/commit/consulta, evidência, contraprova e pontos ainda não comprovados.
2. Mapear efetivamente fonte→build→domínio→bundle→Edge→imports pinados→jobs/cron→Supabase. Para Railway, descobrir consumidores, persistência efetiva de estado JSON e destino de `STATE_API_URL` **sem copiar valores secretos**; não desativar serviços/volumes por hipótese.
3. Em branch específica de correção, fazer commits pequenos e testes que refutem regressões; não mudar produção prematuramente. Tratar auth dos handlers e cron de modo coordenado; garantir RLS/isolamento por conta.
4. Integrar captura documental autorizada ao worker e a persistência transacional; armazenar evidência, detectar conflitos e revisões oficiais, manter key imutável sem tempo e implementar unicidade/idempotência no banco. Evitar escrita manual e bypass CAPTCHA/Turnstile/login.
5. Implementar e testar recuperação de leases, concorrência, cancelamento antes/depois de cada fronteira de persistência, reprocessamento e prevenção de repopulação por caminhos antigos sem procedência.
6. Testar três atletas por conta e registro exato; buscar histórico autorizado de André sem inventar tempos e sem fundir contas. Documentos analisados de uma competição não constituem histórico completo.
7. Validar quatro camadas separadamente: (a) fixture/parser, (b) captura original ao vivo com hash, (c) escrita persistida e segunda importação no Supabase com rollback/concorrência, (d) E2E autenticado do **bundle publicado** comparado ao banco. Smoke com mocks não comprova (d).
8. Não fazer merge/deploy de solução incompleta; não reaplicar migrations nem apagar dados/volumes de terceiros. Manter PR em draft até todos os gates efetivamente aprovados, com artefatos reexecutáveis.

## Gates: todos REPROVADOS até prova operacional
1 pipeline completo/domínio; 2 código morto isolado; 3 importação oficial persistida sem escrita manual; 4 três atletas; 5 comparativo de persistência versus originais; 6 balizamentos completos no banco; 7 procedência persistida; 8 segunda ingestão idempotente no banco; 9 UI publicada = banco; 10 monitor detecta nova publicação; 11 falhas não ocultadas pelos workers publicados; 12 restart/redeploy mantém operação.

**Critério de saída:** links de commits, testes, consultas e artifact hashes, prova de autorização por tenant, logs sem segredos, caminho de produção identificável e verificação E2E publicada. Sem isso, status REPROVADO.
