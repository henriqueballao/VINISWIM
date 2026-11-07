# Descoberta automática por atleta: catálogo e fila agrupada

2026-10-12. Branch fix/official-import-audit-20261011, PR #17 draft. Implementação examinada: **5d57a2d6c794010cda53241e66d728bcf4527f23**. Todos os **12 gates continuam REPROVADOS**. Sem merge, deploy ou escrita no Supabase ativo nesta etapa.

## Evidência real da fonte pública

O worker candidato consultou legitimamente https://www.swimsystem.app/meets sem token, CAPTCHA bypass ou proxy de leitura. Captura em 2026-10-12T01:43:51.148Z: **70 links de competição**, incluindo c8587533 e 9b002997; nenhum link de paginação reconhecido nessa captura. HTML original: 535756 bytes, SHA-256 2666970e9d5f4305d42f15ed9c34be7753dc386c26fc7c7325eb2f2e58353d3b. Run 38192985099, artifact 11722171243.

Os bytes originais foram baixados pelo conector GitHub e preservados no repositório em commercial/packages/official-worker/fixtures/catalog-20261012/calendar.html.gz.base64, com provenance.json. O teste descomprime, recalcula hash/tamanho e compara os 70 links. A fixture permanece reproduzível após expirar o artifact; não contém credenciais nem URL temporária de download. Gzip é apenas armazenamento: o hash refere-se aos bytes HTML originais.

Isso comprova acesso e descoberta dessa página, **não** catálogo histórico completo, todos os anos/regiões, acesso à API protegida ou importação persistida de todas as competições.

## Caminho candidato implementado

catalog.mjs interpreta links do DOM com parse5, exige captura atestada, canonicaliza URLs oficiais e paginação permitida, deduplica sem corte arbitrário de 20 competições e ignora traduções/scripts. Catálogo vazio/alterado sem links reconhecidos gera erro explícito; não vira sucesso com zero.

request_official_catalog_import autentica o responsável, confere conta/atleta/fonte/registro e reutiliza solicitação ativa. A inscrição em catálogo é persistida para scans diários. Um trigger de configuração SwimSystem ativa com registro numérico inicia o primeiro scan sem clique adicional. Conflito de identidades conserva a edição necessária para corrigir a configuração e cria solicitação blocked com diagnóstico; não anuncia conclusão.

O worker carrega escopo/identidade exclusivamente do banco, captura o catálogo e chama persist_official_catalog. A transação revalida autorização/lease, calcula hash dos bytes, guarda HTML privado e expande tarefas. Uma resposta de transporte perdida repete o mesmo payload uma vez e recebe recibo; replay alterado é rejeitado. Essa fase **não grava resultados nem balizamentos**.

Cada competição descoberta passa pelo mesmo leitor de documentos e pela transação oficial já testados. Somente uma publicação validada que localiza o atleta cria subscription do campeonato para novas consultas. Competições sem identidade/publicação ou com acesso bloqueado conservam seus motivos e não produzem dados inventados. Uma tarefa bloqueada não impede processamento das demais; pode reprovar o conjunto da solicitação, o que é diferente de declarar importação completa.

O scheduler candidato enfileira scans diários de catálogo e os scans de campeonatos existentes, com ator/membership/fonte revalidados. Configuração explicitamente desativada não é contornada por identificador ainda ativo; contexto e persistência repetem essa proteção. Advisory locks na inscrição evitam upgrade de locks de atleta e o scheduler usa try-lock para não esperar sob lock de subscription.

A UI candidata substituiu as chamadas de request_result_refresh_v2 por request_official_catalog_import. Fontes além do SwimSystem mostram limitação explícita; não recebem fallback para escritores antigos. Nenhuma dessas funções/propostas está instalada em produção.

## Restrição descoberta e correção estrutural

O schema publicado contém UNIQUE(request_id, source_id, job_type) em import_v2_jobs. O primeiro fan-out no mesmo request perdeu tarefas por conflito: falha CATALOG_CHILD_DEDUP_FAILED no run 38193585411. **A constraint legada não foi removida nem alterada.**

A solução usa requests menores, cada um com uma tarefa, ligados a um root por catalog_root_request_id. official_catalog_tasks deduplica URL por root e registra a relação. A view de progresso agrupa todos os filhos, mostra somente a solicitação principal e não finaliza quando apenas o catálogo termina. Cancelamento do root alcança filhos; recuperação/commit/falha usam lock do root antes do request individual e job. O finalizer official-v3 conta estados reais e conserva o comportamento legado separado.

Reversão/ativação ainda requer revisão e ensaio: propostas aditivas continuam não aplicadas; não retirar holds, habilitar cron ou publicar parte da cadeia. As dependências incluem leases/root-lock antes de contexto/outcomes; catálogo antes de automação; monitoring e automação antes do scheduler. Não reaplicar migrations de segurança/limpeza já aplicadas.

## Testes e resultados

| Run | Commit | Resultado/limite |
| --- | --- | --- |
| [38194254090](https://github.com/henriqueballao/VINISWIM/actions/runs/38194254090) | 5d57a2d6 | PostgreSQL 17 isolado: autorização/RLS, registro sintético 987654, trigger sem clique, scan repetido não duplicado, progresso agrupado, cancelamento de filhos, recibo, fonte desativada, concorrência e originais; passou |
| [38194254083](https://github.com/henriqueballao/VINISWIM/actions/runs/38194254083) | 5d57a2d6 | Repros adversariais originais, sem alterar assertions; passou |
| [38194257020](https://github.com/henriqueballao/VINISWIM/actions/runs/38194257020) | 5d57a2d6 | Build React e browser sintético desktop/mobile: fonte configurada chama catálogo com apenas athlete_id, sem RPC antiga; passou |
| [38194257013](https://github.com/henriqueballao/VINISWIM/actions/runs/38194257013) | 5d57a2d6 | Import-v2 regressão; passou |
| [38194019148](https://github.com/henriqueballao/VINISWIM/actions/runs/38194019148) | 04806358 | Worker, original do catálogo, build Node/check Deno frozen e consultas públicas somente leitura; passou |

scripts/test-official-pipeline-isolated.mjs agora processa os bytes do catálogo pelo worker, cria os 70 filhos em SQL e seleciona a competição presente nos arquivos originais arquivados. Depois processa PDFs via worker e PostgreSQL e compara resultados/balizamentos com JS/Poppler. Nos cinco pares validados: André histórico 6, Lorenzo outubro 5/histórico 6, Vini outubro 4/histórico 5. Segunda importação: zero novos resultados e zero atualizações de entradas. Subscription foi criada a partir da publicação validada. André não foi localizado em outubro e continua sem registro inventado.

Os demais filhos são cancelados no teste porque seus PDFs não fazem parte dessa fixture. **Não alegar que 70 competições foram importadas, nem histórico completo.** O catálogo é original, o HTTP é substituído pelos arquivos no replay, as contas e o banco são sintéticos. O teste de registro 987654 comprova contrato genérico de cadastro/contexto, não um nadador real importado. O atleta surpresa escolhido pelo proprietário ainda não foi testado ao vivo.

Falhas intermediárias registradas: 7dbb1062 teve newline literal no script de auditoria UI e o trigger abortava configuração de identidade conflitante; 44d5a2b0 corrigiu ambos. A mesma rodada revelou a constraint da fila, corrigida com requests agrupados em 704ca760. Assertions de erro, dedup e progresso foram conservadas/fortalecidas; não se removeu a paginação do teste para fazê-lo passar.

## Produção e gates

Consulta às **02:13:52 UTC**: results=0, meet_entries=0, personal_bests=0, result_sources=0; cinco holds e zero crons legados de importação ativos. Dados apagados continuam ausentes. Os holds cobrem os cinco perfis da limpeza; **não constituem fence global de todos os atletas futuros ou de toda chamada externa legada**. A retirada coordenada dos escritores e de todas as entradas antigas ainda precisa ser homologada antes do teste publicado com novo atleta.

Gates 1–12: todos individualmente REPROVADOS. Provas que faltam continuam: cadeia consolidada publicada, código/consumidores legados retirados, importação real e confrontada dos três, balizamentos completos no ativo, procedência persistida no ativo, segunda execução ativa, UI publicada fiel, novas publicações monitoradas, bloqueios apresentados em produção e integridade após reinício/deploy. Outras fontes, história não visível no catálogo, reconciliação e dependências periféricas do schema ainda estão pendentes.

O relatório de código candidato é avanço verificável e não parecer independente nem autorização de deploy. Evidência estruturada: athlete-catalog-discovery-evidence.json.
