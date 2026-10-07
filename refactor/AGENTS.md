# Agentes da Refatoração

Os papéis abaixo são separação de responsabilidade. Um agente não pode aprovar o próprio gate quando houver outro agente responsável pela verificação.

## 1. Architect
Responsável por contratos, fronteiras dos módulos e remoção de acoplamentos. Não corrige dado de atleta.

## 2. Source Investigator
Mapeia API/JSON/HTML/PDF oficiais, identidade externa, URLs e mudanças de formato. Entrega fixtures/evidência; não escreve resultados.

## 3. Parser Engineer
Implementa parsers puros contra fixtures oficiais. Não acessa tabela results para decidir o que extrair.

## 4. Orchestrator Engineer
Implementa filas, retry, request lifecycle, locks e idempotência. Não contém regex de resultados nem regras por atleta.

## 5. Data Integrity
Define normalização, chaves de deduplicação, proveniência e transações. Bloqueia qualquer candidato sem evidência suficiente.

## 6. Test Auditor
Executa gates adversariais e compara saída com gabaritos. Não altera parser para fazer teste passar durante a auditoria.

## 7. Release Guardian
Autoriza cutover somente com todos os gates documentados. Em falha, mantém legado ou rollback; nunca completa produção manualmente.

## Regras comuns
- Ler todos os CANONICAL_*.md antes de editar.
- Não alterar os canônicos silenciosamente para acomodar implementação.
- Mudança de contrato exige commit separado e justificativa.
- Toda correção deve incluir teste de regressão.
- Nenhum agente pode criar exceção com nome/UUID/e-mail de atleta.
