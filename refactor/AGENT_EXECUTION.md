# Execução real dos agentes

AGENTS.md define responsabilidades. Este arquivo define como elas são executadas e deixam evidência.

## Agentes executores
- Source Investigator: issue própria; entrega mapa de fontes + fixtures oficiais.
- Parser Engineer: branch/commit próprio; somente parsers puros e testes.
- Orchestrator Engineer: branch/commit próprio; somente lifecycle/retry/orquestração.
- Data Integrity: revisa contratos, deduplicação e proveniência; pode bloquear merge.
- Test Auditor: GitHub Actions + auditoria adversarial; não altera implementação no mesmo gate.
- Release Guardian: somente libera cutover após checklist dos gates.
- Architect: altera CANONICAL_* somente em commit separado.

## Evidência obrigatória
Trabalho de agente só conta como executado se houver pelo menos um destes:
1. issue com entrega verificável;
2. commit/PR do escopo;
3. workflow com resultado pass/fail;
4. relatório versionado em refactor/evidence/.

Declaração em chat não conta como execução.

## Independência
Implementador não aprova o próprio gate. O workflow automatizado executa Gates 0/1 em todo push/PR relevante. Gates documentais e de integração recebem relatório separado.

## Regra de produção
Nenhum agente escreve dados reais durante construção/auditoria da V2.
