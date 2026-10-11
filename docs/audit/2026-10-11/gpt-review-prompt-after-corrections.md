# Prompt para revisão independente das correções

Atue como revisor técnico adversarial do VINISWIM. Consulte diretamente o repositório henriqueballao/VINISWIM, branch fix/official-import-audit-20261011, PR draft #17. Não aceite relato do Codex como comprovação de produção.

Leia primeiro:
- docs/audit/2026-10-11/independent-review-and-codex-actions.md (revisão original, commit 28212ec);
- docs/audit/2026-10-11/codex-corrections-after-independent-review.md;
- docs/audit/2026-10-11/post-review-evidence.json;
- diff atual main...fix/official-import-audit-20261011.

Verifique código, SQL, testes e logs citados. A branch contém propostas NÃO APLICADAS e uma Edge candidata NÃO PUBLICADA. As três migrations de segurança anteriores já aplicadas não devem ser reaplicadas. Não faça merge, deploy, limpeza, fusão de atletas nem alterações de infraestrutura durante esta revisão.

Confirme ou refute, com localização e teste reproduzível:
1. Mapa GitHub Pages / versus /app/, origem dos bytes publicados, consumidores ativos do Railway e state.json. STATE_API_URL não é utilizada pelo servidor V41 auditado; não invente seu destino nem divulgue segredos.
2. Identidade por conta/atleta/registro/prova/rodada/sexo/data/piscina; chave sem tempo/status e vínculo obrigatório ao cursor do job. Atletas iguais em contas distintas não devem ser fundidos.
3. Captura dos bytes originais, atestação privada, hash recalculado em SQL, timestamp, URLs, parser/excerto e arquivos originais preservados. Verifique limites/redirects e o que ainda não é comprovado por essa atestação.
4. Transação/recibo após resposta perdida, unicidade concorrente, rollback, autorização revogada, lease expirado, cancelamento e múltiplos eventos por piscina. Procure deadlocks e diferenças entre fixtures e schema real.
5. Trigger publicado que finalizava blocked como completed e proposta corretiva; auditoria e melhores marcas com triggers reais; RLS/ACL/SECURITY DEFINER e dependências não espelhadas.
6. Worker candidato: auth antes do claim, contexto server-side, fonte 401/403/404/anti-bot, backoff, erro ao registrar falha e cancelamento durante captura. Não confunda v30/v115 publicados com esta candidata.
7. Originais da competição de outubro e histórica 9b002997: Vini/Lorenzo/André por registro exato, resultados e inscrições separados, DNS preservado. Ausência de André em outubro não prova ausência histórica. A suíte gravou em PostgreSQL descartável, não no Supabase ativo.
8. UI candidata: associação de resultado à corrida exata, ambiguidade, request autenticado, progresso e imutabilidade oficial. Mocks não comprovam UI publicada.
9. npm/Deno locks, build frozen, scripts de lifecycle, integridade dos ZIPs e reprodutibilidade após expiração de artifacts. Deno no Actions não comprova limites reais de CPU/memória da Edge.
10. Pendências: scheduler/auth coordenados, isolamento de escritores antigos, novas publicações, demais fontes, histórico completo, reconciliação, produção/E2E/restart.

Entregue uma matriz de achados: confirmado/refutado/não verificado, gravidade, arquivo/linha/commit, evidência e correção necessária. Reavalie individualmente os 12 gates do documento original. Todos permanecem REPROVADOS enquanto não houver prova operacional da cadeia publicada. Uma suíte verde em ambiente isolado não aprova gates de produção. Preserve os avanços comprovados sem declarar sucesso além da evidência.
