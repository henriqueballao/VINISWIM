# Canônico — Gates de Teste

## Gate 0 — Segurança
Dry-run não escreve em results, meets, meet_entries ou result_sources. Testes de escrita usam somente fixtures/atletas sintéticos.

## Gate 1 — Parser
Fixtures oficiais congeladas. Cada parser deve produzir exatamente os candidatos esperados, inclusive PDF com whitespace removido/compactado.

## Gate 2 — Descoberta
Partindo somente da identidade configurada, o motor descobre as competições aplicáveis sem URL específica de campeonato fornecida manualmente.

## Gate 3 — Histórico real em dry-run
Usar atletas reais somente para leitura. O resultado é JSON/relatório; zero escrita. O conjunto deve bater com o gabarito documental.

## Gate 4 — Idempotência
Duas execuções idênticas produzem a mesma saída. Em banco sintético, a segunda execução insere zero duplicatas.

## Gate 5 — Falhas
TLS, timeout, documento ausente, mudança de HTML e parser sem match devem produzir estados distintos e recuperáveis. Retry não depende de editar job manualmente.

## Gate 6 — Request lifecycle
Refresh permanece running enquanto houver trabalho descendente. completed somente quando todos os jobs do request terminarem; failed quando houver falha terminal.

## Gate 7 — Cutover
Somente após Vini, André e Lorenzo passarem os gates documentais sem regra individual. Depois, executar piloto sintético de escrita e só então trocar o frontend para V2.

## Definição de resolvido
Não é commit, deploy nem tela aparentemente correta. É execução reproduzível + evidência dos gates.
