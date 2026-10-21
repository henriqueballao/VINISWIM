# Parecer técnico independente — revisão adversarial 01a5fb9

Data: 2026-10-11
Repositório: henriqueballao/VINISWIM
Branch: fix/official-import-audit-20261011
PR: #17 (draft)
Referências: 5775834 e 01a5fb9.

## Decisão

**REPROVADO. Manter todos os 12 gates reprovados, PR #17 em draft e sem merge ou deploy.**

Este parecer avalia as evidências relatadas na revisão adversarial commitada em 01a5fb9; não equivale à reprodução independente dos testes, nem à homologação de produção.

## Bloqueios críticos

1. **Classificação incorreta de erros SQL.** A candidata perde mensagens de erro SQL e pode interpretar bloqueios definitivos como falhas retentáveis. Exigir preservação de código/mensagem/causa ao longo da cadeia, política explícita de retentativas e testes que distingam erros permanentes de transitórios. Evitar loops ou repetição indevida.
2. **Incompatibilidade da proposta de índices com o upsert legado (PostgreSQL 42P10).** A definição proposta quebra a inferência de conflito usada pelo upsert legado e pode afetar contas fora do escopo dos três atletas. Exigir prova de compatibilidade das constraints/índices com ON CONFLICT vigente, testes de escrita legada em contas distintas e estratégia de migração reversível, sem alteração de produção antes da aprovação.

## Situação das evidências de produção

- 252 resultados legados.
- 82 melhores marcas.
- Zero balizamentos.
- Zero hashes de procedência entre os 252 resultados.

Estes números demonstram dados legados existentes, **não** demonstram importação automática corrigida, UI publicada nem recuperação íntegra após reinício. Não converter presença de registros anteriores em prova de funcionamento do pipeline novo.

## Sequência obrigatória

1. Corrigir a incompatibilidade 42P10 sem comprometer escritas legadas ou isolamento entre contas.
2. Corrigir preservação e classificação de erros SQL; manter os testes adversariais que reproduziram as falhas.
3. Executar testes de regressão para concorrência, cancelamento, RLS, proteção de resultados oficiais, upsert de múltiplas contas e idempotência de segunda importação.
4. Apresentar evidências reproduzíveis e verificáveis em ambiente de produção para importação automática, interface publicada, procedência/hash e recuperação pós-reinício.
5. Reavaliar individualmente os 12 gates somente após comprovação efetiva, sem aprovação por inferência.

## Instrução para Codex

Utilizar este parecer em conjunto com `docs/audit/2026-10-11/adversarial-review-5775834.md` e seu JSON de evidências. Não declarar gates aprovados ou liberar PR/deploy sem a evidência correspondente. Manter mudanças de auditoria separadas de correções de código e registrar os comandos, saídas e limites de cada nova validação.
