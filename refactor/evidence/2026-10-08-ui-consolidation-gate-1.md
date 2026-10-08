# VINISWIM — Gate 1 | Inventário funcional e matriz de migração
Data: 2026-10-08
Branch auditada: main
Referência: refactor/evidence/2026-10-08-ui-consolidation-gate-0.md

## Escopo e evidência
Leitura direta do bundle servido por `app/index.html`: `app/assets/index-DXCaaEsO.js` (SHA de blob `d12b539f7f64718dfe9e7e44aac1c7803d7bc5cc`). Este é um levantamento do código compilado real; para modificar a aplicação deve-se trabalhar na fonte comercial de `commercial-src.zip` e reconstruir o bundle. Nenhuma alteração em banco/dados reais nesta etapa.

## Inventário por tela, com destino único
| Origem/função observada | Implementação atual | Destino | Condição de equivalência |
|---|---|---|---|
| Visão Geral — quatro KPIs | `QW`, `Va`: total, manual, oficial, ocorrências; cards navegáveis para Resultados | Visão Geral / Indicadores | preservar cliques e denominadores |
| Visão Geral — próximo campeonato | `QW`: primeira `meet_entry` futura ordenada por `meets.start_date`; mostra competição, data, local, piscina, prova, tempo de inscrição, série e raia | Visão Geral / Próxima competição | não confundir primeiro entry com todas as inscrições; mostrar todas as provas da próxima competição sem repetir o campeonato |
| Visão Geral — melhores marcas | `QW`: `pbs`, número, prova, piscina, data, `venue`, tempo; exibe a lista completa | Visão Geral / Resumo de melhores marcas | resumo curto com acesso ao detalhe sem apagar marcas; `meet.venue` é obrigatório como Local |
| Campeonatos — lista de vigentes | `tX`: `meets.filter(status !== 'completed')`, cartões com `name,start_date,venue,course` | Visão Geral / Próximas competições | próxima competição não deve aparecer duplicada no calendário |
| Campeonatos — prova inscrita | `tX`: `meet_entries` vinculadas por `meet_id`; prova, resultado oficial se houver, diferença contra balizamento, tempo de inscrição, série, raia | Visão Geral / Provas de cada campeonato | preservar comparação, status e campos atuais |
| Campeonatos — fonte oficial | `tX`: `meet.official_url` como link **da competição**, rótulo “Fonte oficial” | Visão Geral / campeonato e prova | não promover esta URL a link específico de prova sem validar alvo real |
| Campeonatos — buscar | `tX`: `onSearch` usa refresh V2 e `derived_status`; botão bloqueado enquanto pendente/executando, sinaliza falha | Visão Geral / ações do calendário | preservar estados, bloqueios, erros, request lifecycle |
| Campeonatos — novo campeonato | `tX` invoca `onNew`; modal `WW` insere `meets` e `meet_entries` com nome, data, piscina, local, cidade, prova, balizamento, série e raia | Visão Geral / ações do calendário | **preservar a funcionalidade de cadastro explícito do usuário**, mas jamais usá-la como seed para validar importação automática |
| Campeonatos — importar competição | `tX`: input URL oficial e submit em `source_link_requests` com `external_id` do atleta e fonte SwimSystem; exige identificador | Visão Geral / ações do calendário | preservar validação, resposta e restrição por atleta |
| Expectativas — projeções | `nX`: por inscrição, até cinco resultados anteriores da mesma prova e piscina; média, melhor/pior, confiança Alta/Média/Baixa por amostragem; aviso de dados insuficientes | Visão Geral / Expectativas por prova | preservar algoritmo, amostra, classificação, discriminação de piscina e estado vazio; não inventar meta nem tempo |
| Navegação desktop | `xM`: dashboard/results/evolution/meets/expectations/settings | menu com dashboard/results/evolution/settings | atualizar os dois roteiros condicionais sem deixar páginas órfãs |
| Navegação móvel | `mobile-nav`: dashboard/results/evolution/meets + botão Mais | dashboard/results/evolution + Mais | acesso a Configurações via Mais; nenhuma rota oculta |
| Tutorial | `XW` referencia explicitamente Campeonatos/Expectativas | tutorial atualizado | manter guia coerente com menu novo |
| Resultados | `ZW` continua rota independente | Resultados | preservar filtros, atualização, manuais e proveniência |
| Evolução | `eX` continua rota independente | Evolução | preservar gráficos completos |
| Configurações | `fX` continua rota independente | Configurações | preservar fontes, cadastro e configurações |

## Divergência / requisito não satisfeito hoje
A prova inscrita renderizada em `tX` é um `div.entry` contendo rótulo em `<b>`, sem `href` ou evento de clique. O único link observado é `meet.official_url` na cabeça do campeonato, apontando genericamente à fonte oficial. A prova no card “Próximo campeonato” de `QW` também não tem link. Portanto **clicar na prova para abrir o balizamento específico não está implementado**. É necessário mapear fonte/identificador oficial do balizamento por prova, validar URL de destino, preservar evidência e oferecer fallback apenas para a página oficial geral real; sem fonte verificada, apresentar indisponível.

## Alertas técnicos adicionais
1. `QW` seleciona o primeiro entry futuro, não agrega as provas pelo meet; consolidação deve mudar este comportamento para cobrir múltiplas inscrições.
2. `tX` inclui competições com `status != completed`; não remover inadvertidamente controles de inscrição, busca e cadastro.
3. A estimativa de `nX` é histórica, não uma meta configurável. Não criar meta fictícia na nova interface.
4. O frontend publicado usa bundle compilado; não editar só HTML de raiz ou só arquivo de build sem alinhar a fonte.
5. Resultados manuais autorizados são dados de produto; não entram como evidência do motor importador.

## Gate 1 — conclusão
**APROVADO: inventário e matriz de migração documentados a partir do frontend real.**
**Não aprovado ainda:** implementação, URL por prova, testes de comportamento, build e deploy. São tarefas de Gate 2+.

## Gate 2 — critério binário
- [ ] Consolidar `QW`, `tX`, `nX` por composição de componentes reutilizáveis, em fonte editável.
- [ ] Atualizar menu desktop, mobile e tutorial; preservar todas as ações.
- [ ] Todas as provas inscritas em próximo campeonato, com dados e expectativas acessíveis.
- [ ] Link por prova somente se evidência oficial permitir; fallback à URL geral oficial validada; nada inventado.
- [ ] Layout responsivo e estados vazios/de falha conferidos.
- [ ] Testes e build reproduzíveis.
- [ ] Zero alteração de resultados reais.
