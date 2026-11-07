# VINISWIM — recuperação documental parcial de resultados do Vinícius

Data da consulta: 2026-11-07. Atleta: Vinicius Suzin Ballao (nascido em 2015; registro de competição 422692, quando informado). **Recuperados de documentos públicos de resultados; não importados no Supabase.**

## Registros encontrados — exclusivamente tempos efetivamente nadados

| Competição / período | Prova | Tempo | Fonte |
|---|---|---|---|
| 22º Festival 4 Estilos, 26/10/2024 | 25 Borboleta | 34.41 | S1 |
| idem | 25 Costas | 32.88 | S1 |
| idem | 25 Livre | 28.28 | S1 |
| Regional 1ª Região, 05-06/04/2025 | 50 Livre | 53.09 | S2 |
| idem | 50 Costas | 58.78 | S2 |
| idem | 50 Peito | 1:15.22 | S2 |
| idem | 100 Medley | 2:15.79 | S2 |
| Troféu Ossami Fukuda, 04-06/07/2025 | 100 Livre | 1:52.82 | S3 |
| idem | 200 Livre | 4:11.29 | S3 |
| idem | 50 Costas | 56.73 | S3 |
| idem | 50 Borboleta | 59.68 | S3 |
| idem | 100 Medley | 2:08.44 | S3 |
| Regional 1ª Região, 13-14/09/2025 | 50 Livre | 48.90 | S4 |
| idem | 200 Livre | 4:01.80 | S4 |
| idem | 50 Costas | 58.43 | S4 |
| idem | 50 Borboleta | 1:05.71 | S4 |
| Troféu Germano Bayer, 11-12/10/2025 | 100 Livre | 1:55.10 | S5 |
| idem | 200 Livre | 3:50.75 | S5 |
| idem | 50 Costas | 55.90 | S5 |
| idem | 50 Borboleta | 1:08.83 | S5 |
| Sul-brasileiro Mirim/Petiz, 07-09/11/2025 (LCM) | 100 Livre | 1:52.98 | S6 |
| idem | 200 Livre | 3:47.56 | S6 |
| idem | 50 Costas | 56.98 | S6 |
| Regional 1ª Região, 06-08/03/2026 (SCM) | 100 Livre | 1:45.58 | S7 |
| idem | 50 Costas | 54.68 | S7 |
| idem | 100 Costas | 1:55.91 | S7 |
| Paranaense de Inverno, 17-19/04/2026 (SCM) | 50 Livre | 44.68 | S8 |
| idem | 100 Livre | 1:45.58 | S8 |
| idem | 50 Costas | 51.92 | S8 |
| idem | 100 Costas | 1:55.75 | S8 |

**Total: 30 resultados de provas individuais em oito competições, encontrados nesta amostra documental; NÃO é comprovação de histórico completo.** Os períodos indicam data da competição e não necessariamente dia exato de cada prova. Nas fontes que não especificam de forma clara o comprimento da piscina, curso permanece **não confirmado** e deve ser obtido do boletim original antes de persistência. Não confundir tempo de inscrição (coluna T. Inscrição) com resultado.

Fontes:
- S1 https://sge-aquaticos.bigmidia.com/_uploads/relatorios/4c5ed93640b296f5cf95a7a7f48d02bc.pdf
- S2 https://swimsystem.swimtimebrasil.com/39519/ProgressionDetails.pdf
- S3 https://swimsystem.swimtimebrasil.com/39523/ProgressionDetails.pdf
- S4 https://swimsystem.swimtimebrasil.com/39532/ProgressionDetails.pdf
- S5 https://swimsystem.swimtimebrasil.com/39533/ProgressionDetails.pdf
- S6 https://swimsystem.swimtimebrasil.com/40366/ProgressionDetails.pdf
- S7 https://swimsystem.swimtimebrasil.com/40595/ProgressionDetails.pdf
- S8 https://swimsystem.swimtimebrasil.com/40602/ProgressionDetails.pdf

## Achados de banco, consulta 07/11/2026

Instância VINISWIM Supabase `cdtvhagbgiwnjkgninqn`: 6 atletas, 4 contas, **0 results**, **0 personal_bests**, **0 meet_entries**, **0 result_sources**. Dois cadastros de Vinícius confirmados:
- Família de Henrique Costa Ballao: `f02e62f2-4987-4c99-aa21-1b8d89b80e65`
- Família de Vinícius Suzin Ballão: `af41d466-479b-47e5-8ffb-6dd03ae26e4f`

Após consulta, VINISWIM foi pausado e PCQO teve reativação solicitada conforme mandato do proprietário. **Nenhuma escrita realizada no banco.**

## Bloqueios antes de restabelecer registros nos dois cadastros

1. Inspecionar catálogo atual de competições e provas, identificações oficiais, datas e piscinas por documento.
2. Conferir demais resultados oficiais de 2024-2026 (esta amostra não representa cobertura exaustiva).
3. Construir transações idempotentes e com procedência; não marcar como oficial sem documento e integridade.
4. Definir data individual exata e curso da prova e inserir apenas sob autorização do proprietário, respeitando políticas e trigger de personal_bests.
5. Preservar separação dos dois cadastros (mesmo nadador, duas contas), sem fusão cruzada.
