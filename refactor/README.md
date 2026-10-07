# VINISWIM — Refatoração do Motor de Importação

Este diretório é a fonte canônica da refatoração do importador.

## Objetivo
Substituir a orquestração atual por uma pipeline determinística, testável e independente de atleta:
Identidade -> Descoberta -> Documento oficial -> Extração -> Normalização -> Validação -> Deduplicação -> Persistência.

## Regra de ouro
Nenhum dado real é inserido, corrigido, completado ou fabricado manualmente para fazer um teste passar.

## Gate de substituição
O motor V2 só assume produção depois de reproduzir, em dry-run, históricos oficiais conhecidos e passar os contratos definidos em CANONICAL_IMPORT_ENGINE.md.

Leia nesta ordem:
1. CANONICAL_IMPORT_ENGINE.md
2. CANONICAL_DATA_CONTRACTS.md
3. CANONICAL_TEST_GATES.md
4. AGENTS.md
