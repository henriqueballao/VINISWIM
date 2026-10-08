# VINISWIM — Gate 0 | Consolidação da Visão Geral
Data: 2026-10-08
Escopo: auditoria e congelamento do contrato de navegação, sem alteração funcional.

## Resultado do Gate 0
**APROVADO PARA PLANEJAMENTO; IMPLEMENTAÇÃO NÃO INICIADA.**
Este gate registra o inventário preliminar, as fronteiras e os critérios verificáveis antes de alterar a UI.

## Base conferida
- Branch `main`; `app/index.html` referencia os bundles `./assets/index-DXCaaEsO.js` e `./assets/index-DkBfo2Nq.css`.
- `index.html` na raiz contém uma interface própria e redirecionamento de `viniswim.com.br` para `/app/`. **Não confundir a interface de raiz com o frontend publicado em `/app/`.**
- `package.json` define `commercial-src.zip` como fonte desempacotável via script `unpack`; não tomar o bundle compilado como código-fonte canônico.
- Documentos `refactor/README.md`, `CANONICAL_IMPORT_ENGINE.md`, `CANONICAL_DATA_CONTRACTS.md`, `CANONICAL_TEST_GATES.md`, `AGENTS.md`, `AGENT_EXECUTION.md`, `DECISIONS.md`, `STATUS.md` e `evidence/2026-10-07-pre-clear-checkpoint.md` foram examinados no início desta sequência.
- Captura fornecida pelo usuário mostra menu com Visão Geral, Resultados, Evolução, Campeonatos, Expectativas e Configurações. Outra captura mostra um perfil com 40 resultados (36 oficiais + 4 manuais), distinto do perfil principal registrado no checkpoint (41 = 37 + 4); não tratar isso como divergência do importador.

## Decisão de arquitetura da experiência
Reduzir o menu de seis para quatro destinos:
1. Visão Geral — incorpora as seções atualmente encontradas em Campeonatos e Expectativas.
2. Resultados — mantém tabela detalhada, filtros, fontes, edição manual autorizada, status e proveniência.
3. Evolução — mantém gráficos analíticos e filtros.
4. Configurações — mantém cadastro, origens e preferências.

### Seções únicas da Visão Geral
- KPIs: total, oficiais, manuais, melhores marcas e ocorrências, sem contagem dupla.
- Próxima competição: nome canônico, data, `meet.venue`, piscina, inscrições/provas e link oficial de balizamento quando documentado.
- Calendário/lista das demais competições: sem repetir o card da próxima competição.
- Expectativas por prova: referências, metas, projeções e qualquer interação já existente na aba original.
- Resumo de evolução: recorte, nunca cópia integral dos gráficos de Evolução.
- Melhores marcas: resumo e navegação ao detalhamento, sem duplicar o histórico completo.

## Contratos preservados
- Nenhuma regra por atleta, nome, UUID ou usuário.
- Não editar, inserir ou completar resultados oficiais; nenhum seed de competição, nome ou local.
- Manuais permanecem `origin=manual` e `is_official=false`, e só podem ser incluídos a pedido explícito.
- `venue` é Local; `city` é campo independente e não substitui Local.
- Prefixos técnicos como `Resultados ·` e `Provas ·` não pertencem ao nome canônico.
- `refresh_requests` não pode finalizar `completed` com jobs descendentes pendentes/running.
- O resumo de Melhores Marcas deve manter `results(*,meets(venue,city,name))` e usar `meet.venue`.

## Contrato do clique no balizamento
- Clicar na prova abre a URL oficial de balizamento identificada para a competição e, quando disponível, a prova.
- URL descoberta automaticamente, com origem/evidência; sem vínculo hardcoded para atleta/competição.
- Sem URL oficial comprovada, mostrar estado indisponível; **nunca inventar link**.
- Acessibilidade: link navegável por teclado, nome discernível e abertura segura de página externa.
- Importação de resultados e descoberta do balizamento são responsabilidades distintas; uma não pode fabricar evidência para a outra.

## Pendências bloqueantes antes do Gate 1
1. Abrir e inventariar integralmente os componentes e eventos reais de Campeonatos, Expectativas e Visão Geral no **código-fonte do frontend comercial**, mapeando cada recurso/campo para o novo destino. O bundle compilado não substitui esse inventário.
2. Identificar a origem efetiva das URLs de inscrições/balizamento, seu modelo e ausência de URLs; distinguir link de competição de link específico da prova.
3. Identificar roteamento, estado selecionado de atleta, persistência de filtros e dependências entre as três telas; definir migração sem regressão.
4. Criar testes de equivalência funcional e responsividade (desktop/mobile, paisagem/retrato) e validar a navegação para o site oficial.
5. Confirmar o build de fonte e o deploy de `/app/`; sem afirmar publicação por commit documental.

## Critérios binários para o próximo gate
- [ ] Inventário completo de todos os controles/ações/dados de Campeonatos e Expectativas com destino único.
- [ ] Nenhuma funcionalidade perdida e nenhuma seção duplicada.
- [ ] Links oficiais de balizamento testados, sem URL fabricada.
- [ ] Resultados/Evolução/Configurações sem regressões.
- [ ] Perfis principal e secundário permanecem segregados.
- [ ] Zero escrita de dados reais durante testes.
- [ ] Testes automatizados e build do frontend aprovados; implantação verificada em separado.

**Limite:** Gate 0 é contrato e auditoria inicial, não autoriza afirmar que a consolidação foi implementada, validada ou publicada.
