# PROMPT PARA CODEX CLOUD — VINISWIM: investigação API-first e prova de conceito

Você está atuando no repositório `henriqueballao/VINISWIM`. A missão é **investigar, com evidências técnicas e código executado, a substituição dos motores de busca/scraping de resultados por integrações estruturadas com sistemas oficiais**, começando pelo SwimSystem. O produto desejado é uma camada analítica complementar à plataforma oficial, não outro buscador de PDFs.

## Contexto obrigatório

Leia primeiro:
- `docs/architecture/2026-11-07-api-first-official-integration-strategy.md`
- `docs/architecture/2026-10-21-import-engine-v4-rebuild-plan.md`
- `docs/audit/2026-10-11/adversarial-review-5775834.md`
- `docs/audit/2026-10-12/codex-acknowledgment-of-incomplete-delivery.md`

O histórico registra: múltiplos importadores/cron/consumidores (Railway, Edge, React/Supabase), incompatibilidade SQL `42P10`, erros de classificação/retry, baixa rastreabilidade das fontes, ausência de balizamentos na captura histórica e ausência de comprovação operacional de ponta a ponta. **Não trate os números de outubro como estado atual**. Não declare que o problema está resolvido com testes isolados.

## Premissas inegociáveis

1. **Preservar o design/layout e todas as telas, gráficos, identidade visual, rotas e responsividade do VINISWIM.** Não redesenhar frontend.
2. **Não modificar produção nesta missão**: sem deploy, merge, migrations, alterações de RLS, cron, service roles, escrituras no Supabase/Railway ativos, exclusão de dados ou desativação de serviços.
3. Não assumir que API existe, é pública, documentada ou autorizada. API interna identificada por DevTools/network **não é autorização de consumo**. Não contornar login, CAPTCHA, políticas de acesso ou termos, nem revelar credenciais.
4. Distinguir API pública documentada, API de parceiro licenciada, exportação LENEX/XML/CSV, feed oficial, documento HTML/PDF e endpoint interno sem autorização. Confirmar cada classificação com URL/documentação e teste não invasivo permitido.
5. Não criar mais um motor de scraping nesta etapa. O foco é determinar a viabilidade real da integração.
6. **Toda análise, evidência, PoC e conclusão devem ser commitadas no GitHub**, em branch de trabalho adequada. Não entregar somente no chat. Manter PR existente em draft e não fazer merge.

## Execução obrigatória

### Etapa 1 — Inventário real

Inspecione a árvore atual (não assuma que commits antigos são head), o frontend publicado, handlers, parsers, imports remotos, Edge Functions, Railway, filas, jobs, crons, views, triggers, migrations e configurações de fontes. Identifique **todos os sites/fontes cadastrados**, não apenas SwimSystem. Construa tabela com: fonte; URL e evidência; mecanismo atual; consumidor; tabelas afetadas; autenticação; possibilidade de acesso estruturado; risco de remoção; caminho proposto. Aponte arquivos e linhas. Capture SHA da branch-base e data.

### Etapa 2 — Descoberta de interfaces oficiais

Para **SwimSystem / Sports Timing Brasil** e demais fontes realmente cadastradas:
- Encontrar documentação primária de APIs, SDKs, webhooks, autenticação, limites, versões, política de uso e licença/retensão de dados.
- Conferir suporte a **LENEX 3.0 (.lef/.lxf)**, exportação de resultados/inscrições/balizamentos, acesso por evento, disponibilidade para atleta/organizador e atualização incremental.
- Validar, somente quando explicitamente permitido, endpoints de leitura documentados com exemplos públicos, salvando status HTTP, esquema dos campos, paginação e prova de origem, **sem tokens/sessões privadas de terceiros**.
- Examinar se existem identificadores estáveis de atleta, competição, evento/prova, número, rodada, sexo, piscina, inscrição, série, raia, tempo, splits, status e homologação. Não inventar campos ausentes.
- Identificar eventuais APIs internas observáveis apenas como **hipóteses não utilizáveis sem autorização**; não promover engenharia reversa a solução.
- Se a API estiver indisponível, listar exatamente o que dependeria de contato/convênio com o fornecedor. Gerar minuta técnica objetiva de solicitação de acesso, sem enviar mensagens.

### Etapa 3 — Prova de conceito mínima

Escolha **uma fonte com acesso estruturado confirmado e autorizado**. Se existir fonte/arquivo LENEX oficialmente acessível, implemente uma PoC local isolada que:
- leia payload estruturado/arquivo original e preserve hash SHA-256, URL, timestamp e esquema;
- extraia entidades reais e transforme em modelo canônico versionado;
- separe inscrições/balizamentos (`meet_entries`) de resultados nadados (`results`);
- suporte DNS/DNF/DSQ, piscinas 25/50m, provas, etapas, série, raia (inclusive 0 quando publicada), identidade por conta e atleta;
- compare contagens e campos com a publicação original e reporte divergências;
- demonstre importação idempotente duas vezes em banco descartável ou memória persistente de teste, **sem usar dados reais de produção**;
- meça chamadas, latência, payload e viabilidade de consulta incremental quando suportada.

Se nenhuma fonte estruturada autorizada estiver disponível, **não fabrique PoC bem-sucedida**. Entregue matriz de bloqueios, um adapter contract testável e fixture pública/licenciada apenas se permitida, claramente identificada como prova limitada.

### Etapa 4 — Arquitetura de substituição

Apresente desenho da camada `OfficialProviderAdapter` com interfaces como `listMeets`, `getEntries`, `getStartlists`, `getResults`, `getUpdates`, `getEvidence`, **somente para capacidades comprovadas de cada provedor**. Defina sincronização incremental autorizada, backoff/limites, armazenamento da origem, hash, modelagem de IDs externos, auditoria, multi-tenancy, RLS, idempotência, tratamento estruturado de erros, correções de resultados oficiais, retomada pós-falha e rollback.

Contraponha ao legado: complexidade de implantação, custo operacional, confiabilidade, cobertura histórica, dados ausentes, limite de acesso e riscos. Não propor eliminar banco próprio; ele continua responsável pelo histórico e analytics do VINISWIM.

### Etapa 5 — Plano de retirada dos motores legados

Entregue inventário **arquivo por arquivo e cron por cron** do que pode ser retirado **somente após** haver substituto homologado, com dependentes e testes de regressão. Preservar funcionalidades da raiz e de `/app/` se ainda houver consumidores. Nunca executar remoção antecipada ou migration destrutiva. Considerar outras contas e o erro `42P10` como gates de segurança.

## Entregáveis versionados

Crie em `docs/architecture/`:
1. `api-integration-source-inventory.md` — matriz de fontes/capacidades, URLs/documentação, arquivos e dependências;
2. `swimsystem-integration-feasibility.md` — evidências específicas, API pública/parceiro/LENEX, autorização, limitações e perguntas ao fornecedor;
3. `official-provider-adapter-v4.md` — contratos, modelo canônico, arquitetura proposta, fluxos/erros, idempotência e benchmark frente ao scraping;
4. `legacy-import-retirement-plan.md` — retirada graduada, mapa arquivo por arquivo, testes e rollback;
5. `codex-cloud-execution-report.md` — comandos/testes executados, URLs/outputs, SHAs, evidências, limites e decisão **VIÁVEL / VIÁVEL CONDICIONAL / NÃO COMPROVADO** por fonte.

Coloque eventual PoC isolada em diretório de testes/prototype com README e testes reproduzíveis. Não alterar frontend ou pipelines de produção. Faça commits efetivos e informe seus SHAs e links ao final.

## Critério de sucesso

A investigação só estará concluída quando for possível responder, com evidências verificáveis:
- O SwimSystem tem API pública/contratável utilizável? Qual autorização e quais recursos?
- É possível obter resultados, balizamentos e atualizações via API/webhook/LENEX? Quais campos faltam?
- Quais outros sites cadastrados oferecem estrutura similar?
- Qual é o menor caminho operacional seguro para tornar o VINISWIM extensão analítica de dados oficiais?
- Exatamente quais motores antigos serão substituídos, e em qual sequência sem interromper o aplicativo?

**Não inicie reconstrução de buscadores, não aprove a PR #17, não anuncie produto entregue.** Execute a investigação e a prova verificável, sem abrir nova sequência de auditorias repetitivas.
