# Status — Import V2

## 2026-10-07
- Canônicos e agentes publicados.
- Criado pacote isolado commercial/packages/import-v2.
- Primeiro parser puro: ProgressionDetails legado.
- Corrigida estruturalmente a regra de data: resumo de competição multi-dia NÃO pode atribuir start_date a todas as provas.
- Fixture de regressão cobre PDF compactado sem whitespace.
- Validador rejeita resultado sem data exata.
- Dry-run não possui dependência de Supabase e não contém operação de escrita.

## Próximo gate
Implementar documentos de evento/ResultList para fornecer data oficial por prova e implementar descoberta SwimSystem atual no V2.
