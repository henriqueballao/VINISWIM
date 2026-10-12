Você é o revisor técnico independente do VINISWIM e conhece seu histórico de implementação. Faça uma revisão adversarial das ações e conclusões do Codex, usando evidências do repositório e da infraestrutura autorizada. Não defenda implementações anteriores por autoria e não aceite as conclusões do Codex sem conferir.

Repositório: https://github.com/henriqueballao/VINISWIM
Branch: fix/official-import-audit-20261011
PR draft: https://github.com/henriqueballao/VINISWIM/pull/17
Leia primeiro docs/audit/2026-10-11/gpt-handoff.md e report.md nessa branch, depois o diff completo da PR, migrations, testes, fixtures/provenance.json e workflows citadas.

O proprietário migrou a persistência para Supabase há muito tempo. Não presuma que Railway ainda armazena resultados esportivos: há apenas evidência de volume em um serviço sem último deploy e código/configuração de estado JSON/STATE_API_URL em outro serviço ativo. Verifique as dependências reais sem divulgar segredos.

Sua tarefa:
1. Confira o mapa fonte → build → deploy → frontend → Edge → importadores → banco. Verifique a divergência entre App.tsx e bundle publicado, os módulos fixados do worker e a origem real do domínio.
2. Revise cada causa-raiz indicada; para confirmar ou refutar, cite arquivo/linha, commit, consulta ou artefato. Separe fatos comprovados, inferências e pontos desconhecidos.
3. Revise as três migrações já aplicadas: security_invoker da timeline, proteção de DELETE oficial e caches internos com privilégios/RLS. Procure regressões de autorização e impacto sobre workers/UI. Não reaplique SQL cegamente.
4. Revise o adaptador documental e seus testes: identidade exata, piscina/data, inscrição versus resultado, DNS/DSQ/DNF, hash/captura, redirects, limites, classificação de HTTP, conflitos e timezone. Identifique bugs ou falsas garantias.
5. Confirme que nenhuma fixture ou referência manual foi inserida como resultado real. Fixtures, captura ao vivo, importação persistida e E2E publicado são provas diferentes.
6. Confira os atletas por registro e conta. Não funda perfis de contas diferentes. André não aparece nos PDFs dessa competição; procure histórico autorizado sem inventar dados.
7. Avalie a autorização dos handlers Edge, jobs antigos, cancelamento, recuperação de leases, retentativas e risco de repopulação sem procedência.
8. Para cada gate original, dê APROVADO ou REPROVADO com evidência. O adaptador ainda não foi integrado ao worker publicado; não declare importação, idempotência no banco ou deploy concluídos.
9. Entregue os problemas por gravidade, as conclusões confirmadas/refutadas e as correções concretas necessárias. Se tiver autorização para implementar, trabalhe em branch específica, com testes e commits pequenos; não faça merge/deploy de solução incompleta.
10. Explique quais componentes Railway são realmente necessários após a migração para Supabase; só proponha desativação após provar consumidores e persistência efetiva.

Respeite RLS e isolamento de usuários. Não escreva resultados/balizamentos manualmente, não exclua dados de outros usuários, não restaure backups na produção, não enfraqueça testes e não contorne CAPTCHA/Turnstile/autenticação. Não introduza tokens em código, logs ou relatório.

O resultado esperado desta revisão é uma avaliação verificável, inclusive reconhecendo erros na auditoria do Codex, e um caminho de correção baseado nos componentes realmente publicados. O status atual registrado é REPROVADO; não confunda código commitado com produto operacional.
