# Status — Import V2

## 2026-10-07
- Canônicos/agentes publicados.
- Pacote isolado import-v2 criado; sem Supabase e sem escrita.
- ProgressionDetails: parser puro; whitespace compacto coberto.
- ResultList: parser puro por registro, prova e data oficial do próprio documento.
- Corrigido o defeito estrutural de data multi-dia: ProgressionDetails não fabrica data; ResultList fornece a data exata.
- Fixture 39523 cobre 5 resultados documentais: 100 Livre 04/07, 50 Borboleta 04/07, 50 Costas 05/07, 100 Medley 05/07, 200 Livre 06/07.
- SwimSystem atual: parser de cabeçalho/startlist estrito.
- Discovery V2 retorna todos os UUIDs encontrados; removido do desenho V2 o corte arbitrário de 20 competições.
- Dry-run/validator bloqueiam candidato incompleto.

## Próximo gate
1. Rodar a suíte do pacote import-v2 fora da produção.
2. Criar fetch adapters read-only para documentos atuais e históricos.
3. Executar dry-run real do Vini e comparar com gabarito.
4. Implementar orquestrador V2 somente após Gates 0-3.
