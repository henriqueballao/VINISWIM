Você é o Claude Code e assume a missão VINISWIM como engenheiro responsável pela entrega. Preciso do aplicativo funcionando, com importação oficial automática, íntegra e rastreável. Não quero outra sequência de relatórios sem entrega operacional, nem promessas ou aprovação baseada só em testes locais.

REPOSITÓRIOS E CONTEXTO
- Principal: https://github.com/henriqueballao/VINISWIM
- Secundário/monitor: https://github.com/henriqueballao/VINISWIM-MONITOR
- Branch de trabalho: fix/official-import-audit-20261011
- PR #17: https://github.com/henriqueballao/VINISWIM/pull/17 — manter draft enquanto incompleta.
- Aplicativo publicado: https://viniswim.com.br/app/
- Supabase de produção: VINISWIM, project_id cdtvhagbgiwnjkgninqn, região informada sa-east-1.
- Use o HEAD mais recente da branch. A base anterior a esta passagem era 015c4642c295fe0185a50c1952af3db63fc6fca5. Não confunda código commitado com versão publicada.

LEITURA OBRIGATÓRIA, DIRETO DO GITHUB
Comece por docs/audit/2026-10-12/claude-code-handoff.md e claude-code-evidence-inventory.json. A passagem registra histórico, dificuldades técnicas e de execução, alterações aplicadas, correções candidatas, falhas de testes preservadas, acessos, limitações e objetivo final.
Depois leia:
1. docs/audit/2026-10-12/edge-runtime-browser-and-recovery.md e edge-browser-recovery-evidence/.
2. docs/audit/2026-10-12/codex-acknowledgment-of-incomplete-delivery.md.
3. docs/audit/2026-10-12/global-maintenance-and-native-live-proof.md.
4. docs/audit/2026-10-12/athlete-catalog-discovery.md e manual-planning-and-shared-meet.md.
5. docs/audit/2026-10-11/independent-technical-assessment-01a5fb9.md, independent-review-and-codex-actions.md, adversarial-review-5775834.md, corrections-after-ea19d91.md, authorized-legacy-cleanup.md, report.md e evidências/repros associados.
Consulte também HANDOFF.md, refactor/, AGENTS.md aplicáveis, git log, diff main...branch, workflows e ambos os repositórios. Relatórios antigos são fotografias históricas: reconfirme o estado e dê prioridade às minhas instruções atuais. Não me solicite cópias do que está no repositório.

INSTRUÇÕES ATUAIS QUE SUBSTITUEM OS CASOS ANTIGOS
Não vou mais usar Vini, Lorenzo ou André para homologação. Não os importe nem mantenha os três como requisito de entrega. Escolherei um novo atleta sem avisar previamente quem será: quero testar a importação pelo aplicativo, sem conhecerem antecipadamente seus resultados.
Não use whitelist, nome/registro/tempos hardcoded, restauração de backups ou INSERT/UPDATE manual de resultado. O registro 437084 usado pelo Codex é um caso adicional isolado, não o meu atleta surpresa.

ESTADO CONHECIDO — CONFIRME
O Codex não entregou o aplicativo funcionando em produção e registrou essa admissão. A última consulta de produção desta passagem, 2026-10-12 14:28:35 UTC, confirmou maintenance e zero results, meet_entries, personal_bests e result_sources.
Os 252 resultados antigos foram apagados com autorização específica. Usuários/Auth/responsáveis/configurações/identificadores foram preservados. Não repita a limpeza nem restaure esses resultados.
Há holds específicos e proteção global aplicada pela migration 20261012023634, além de migrations anteriores. Não reaplique migrations já existentes. Três crons antigos de importação foram desativados; não reative importador legado sem rastreabilidade.
O novo schema/worker/UI de integração não foi ativado. Edge anteriormente conhecidas: monitor-runner v115 e import-v2-runner v30. O bundle conhecido era index-BjbdadaH.js, mas confirme o HTML/bundle atual.
Supabase é a persistência esportiva. Railway tem serviços/estado JSON/volumes históricos a investigar; não presuma banco esportivo ou ausência absoluta de persistência lá.

O QUE JÁ EXISTE — AUDITE, NÃO DESCARTE NEM ACEITE CEGAMENTE
Frontend React/TS em commercial/apps/web; contratos/parsers em commercial/packages/import-v2; worker modular em commercial/packages/official-worker; entrada em commercial/supabase/functions/official-import-runner; SQL candidato em commercial/supabase/proposals.
Há captura autorizada de HTML/PDF com bytes/hash, identidade por fonte/registro, resultado separado de balizamento, deduplicação/transação/recibos, locks/leases/cancelamento/retries, RLS, configuração que não autoverifica identidade e token de Vault rotacionável.
Builders scripts/build-official-migration-candidate.py e package-official-edge.py geram artefatos revisáveis sem ativar produção. Leia ordem/dependências e manifeste hashes; não aplique proposals alfabeticamente.
O run 38250000935 passou usando Auth/REST/PG e runtime Supabase CLI reais, navegador sem mocks, cadastro da fonte pela UI, cinco resultados oficiais ao vivo, reimportação com zero inserções, isolamento, comparação de cada valor desktop/móvel, rotação de token e recuperação após reinício da função/banco.
Isso ocorreu em ambiente isolado, com periféricos sintéticos e harness HTTP no lugar do cron. Uma competição foi priorizada e os demais filhos cancelados. NÃO comprova produção, histórico completo, todas as 70 competições, outras fontes, limites hospedados ou meu teste futuro.

SUA PRIMEIRA INVESTIGAÇÃO E SUA EXECUÇÃO
1. Estabeleça código → build → serviço/domínio → bundle → Edge → filas/cron → banco de forma verificável. Compare fontes com o publicado, módulos pinados, caches/service workers e consumidores Railway.
2. Reproduza as falhas e a prova existente; confira originais e hashes, sem enfraquecer repros. Separe fixture, captura ao vivo, persistência e UI publicada.
3. Identifique e corrija os impedimentos reais de release: dependências completas do schema/Auth/comercial, flows legados, catálogo sem participação, formatos históricos/Masters, fontes adicionais, cron, recuperação, observabilidade, capacidade e limites Edge. Registre o que é confirmado e o que é hipótese.
4. Consolide um único fluxo canônico. Preserve o índice completo legado de meet_entries e a segregação por conta; não repita a quebra de ON CONFLICT 42P10. Não sobrescreva oficial com inscrição/manual nem misture provas/piscinas.
5. Prepare e ensaie versão completa, migrations, configuração, ativação coordenada e rollback que conserva resultados/evidências. Não retire os bloqueios antes de comprovar que só o pipeline correto escreve.
6. Não faça merge/deploy de solução incompleta. Ao ter a candidata integralmente validada e a autorização de publicação inequívoca, execute a transição segura e confira o produto efetivamente publicado. Não interprete testes locais como homologação nem o bloqueio a deploy parcial como justificativa para abandonar a entrega.
7. Valide operação automática, nova publicação, idempotência e reinício/redeploy no ambiente publicado, com comparação banco ↔ UI ↔ documentos oficiais. Prepare o app para eu cadastrar meu atleta desconhecido sem sua intervenção.

REQUISITOS DO PRODUTO
Multiusuário/convites/Auth/RLS; um responsável e vários atletas; perfil/foto/categorias de base e Masters; piscinas 25/50 m; resultados oficiais imutáveis na UI e manuais diferenciados; DNS/DSQ/DNF; histórico, filtros, cronologia, melhores marcas e evolução; inscrições/tempo de inscrição/série/raia/horário separados do resultado; competições atuais/futuras; monitor automático; filas/retries/cancelamento por request_id; logs/auditoria/procedência; responsividade inclusive iPhone.
Resultado oficial exige atleta inequívoco, fonte/URL, competição/prova/data/piscina, tempo ou status, instante de captura, evidência original e identidade estável. Não persistir candidato ambíguo como oficial.

SEGURANÇA, FONTES E HONESTIDADE
Não contorne CAPTCHA, Turnstile ou autenticação. API SwimSystem já retornou 401 e tentativa de sessão 403; documentos públicos são uma alternativa comprovada em alguns casos, não cobertura universal. Busque integração autorizada e registre bloqueio específico, endpoint/status/instante/impacto. Distinguir fonte sem publicação, indisponível, autenticação, anti-bot, PDF ausente/alterado, formato incompatível, identidade ausente, inserção/duplicado/atualização.
Não exponha credenciais em GitHub/logs/front-end. Confirme projeto/conta correta; acesso MCP/OAuth do Codex não é transferível. Não assuma autorização de custo, exclusão de usuários ou perda de dados de terceiros. Não altere produção por hipótese.

ENTREGA E CRITÉRIO DE SAÍDA
Trabalhe na branch com commits pequenos e testes unitários, banco/integração e E2E relevantes. Comite também diagnósticos, contraprovas, falhas e evidências — não deixe apenas no chat.
Mantenha matriz dos 12 gates atualizada; o gate dos três atletas foi substituído pelo meu caso novo. CI, mocks, fixture, replay, commit e execução isolada não substituem operação publicada.
Entregue código/migrations/testes, pipeline documentado, logs de importação oficiais, prova de idempotência, UI correta, build/deploy/restart/monitor comprovados e bloqueios externos explícitos.
Não há autorização para prometer sucesso sem evidência. Não termine apenas com um plano ou lista genérica. Seu objetivo é resolver o VINISWIM e demonstrar que eu consigo importar um atleta pelo aplicativo sem inserção manual de resultados.
