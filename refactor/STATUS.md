# Status — Import V2

## 2026-10-07
- Canônicos e agentes publicados.
- Pacote isolado commercial/packages/import-v2 criado.
- Parser puro ProgressionDetails e validador criados.
- Resumo multi-dia NÃO atribui start_date a todas as provas.
- Fixture cobre PDF compactado sem whitespace.
- Dry-run não possui Supabase nem escrita.
- Parser puro SwimSystem atual criado.
- Cabeçalho oficial é obrigatório para data/piscina; sem fallback de data atual.
- Startlist exige external_id autônomo.

## Próximo gate
1. ResultList por prova para data oficial histórica.
2. Discovery SwimSystem sem limite arbitrário de 20 meets.
3. Executar suíte isolada e registrar Gates 0/1/2.
4. Só então criar orquestrador V2 read-only.
