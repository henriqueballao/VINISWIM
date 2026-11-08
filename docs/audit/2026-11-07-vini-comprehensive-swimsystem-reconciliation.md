# VINISWIM — Auditoria por competição do Vinícius (07/11/2026)

**Identificação:** Vinicius Suzin Ballao / BALLAO, 2015, Curitibano, registro FDAP 422692.
**Escopo:** resultados públicos SwimSystem / SwimSystemApp, boletins históricos e capturas de novembro fornecidas pelo proprietário. Não há comprovação de exaustividade de competições não indexadas: não declarar pesquisa como histórico integral de toda a plataforma.

## Conciliação por competição (por cadastro)

| Competição | Data | Tempos válidos | Não compareceu | Pendentes |
|---|---|---:|---:|---:|
| Festival 4 Estilos | 26/10/2024 | 3 | 0 | 0 |
| Regional 1ª Região | 05–06/04/2025 | 4 | 0 | 0 |
| Ossami Fukuda | 04–06/07/2025 | 5 | 0 | 0 |
| Regional 1ª Região | 13–14/09/2025 | 4 | 0 | 0 |
| Germano Bayer | 11–12/10/2025 | 4 | 0 | 0 |
| Sul-brasileiro Mirim/Petiz | 07–09/11/2025 | 3 | 0 | 0 |
| Regional 1ª Região | 06–08/03/2026 | 3 | 1 (200 Livre) | 0 |
| Paranaense de Inverno | 17–19/04/2026 | 4 | 0 | 0 |
| Paranaense de Verão | 18–20/09/2026 | 4 | 1 (50 Livre) | 0 |
| Sulbrasileiro Mirim/Petiz | 06–08/11/2026 | 2 | 0 | 2 |
| **Total por cadastro (10 competições)** | | **36** | **2** | **2** |

Duas contas intencionalmente distintas, cada uma com 40 registros lógicos: família de Henrique e família de Vinícius. Nenhuma gravação no Supabase nesta operação. Fonte local: commercial/apps/web/src/data/vini-temporary.json.

## Setembro de 2026 — corrigidos cinco desfechos (quatro tempos mais uma ausência)

Fonte: boletim completo de 128 páginas, Campeonato Paranaense de Verão (Mirim/Petiz), Colombo, piscina de 50 metros.

- 18/09, prova 6: 100 Livre — **1:35.18**, 34º Petiz 1; PDF página 13 (índice 12).
- 18/09, prova 18: 50 Costas — **50.24**, 22º Petiz 1; PDF página 41 (índice 40).
- 19/09, prova 30: 200 Livre — **3:36.38**, 29º Petiz 1; PDF página 56 (índice 55).
- 19/09, prova 48: 50 Livre — **DNS** (não compareceu), sem tempo válido; PDF página 94 (índice 93). 48.90 era inscrição, não resultado.
- 20/09, prova 68: 100 Costas — **1:46.09**, 16º Petiz 1; PDF página 123 (índice 122).

Tempo de 100 Livre de 1:35.18 é uma marca nadada em setembro e foi o tempo de inscrição dos 100 Livre em novembro, em que marcou 1:39.68. Não são registros duplicados.

Fonte setembro:
https://sportstimingbrasil-swimsystem.supabase.co/storage/v1/object/public/reports/meet-documents/9b002997-591e-4f74-8492-ef595b4705c0/dc4225df-82a5-4001-bc78-63b133232246.pdf

## Março de 2026 — ocorrência

Em 08/03/2026, prova 38, 200 Livre, folha oficial indica N/C, série 3, raia 6. Normalizado como status DNS no histórico temporário, sem tempo.

Fonte: https://swimsystem.swimtimebrasil.com/40595/ResultList_38.pdf

## Novembro de 2026 — duas provas concluídas, duas pendentes

- 06/11: 50 Costas, 48.49, inscrição 50.24, série 2, raia 2.
- 07/11: 100 Livre, 1:39.68, inscrição 1:35.18, série 2, raia 5.
- 08/11: 100 Costas, inscrição 1:43.91, série 2, raia 1, sem resultado.
- 08/11: 50 Livre, inscrição 43.78, série 2, raia 0, sem resultado.

Evidência: capturas do SwimSystem encaminhadas pelo proprietário em 07/11/2026. Curso da competição: 50 m (LCM).

## Fontes históricas auditadas

- 2024: https://sge-aquaticos.bigmidia.com/_uploads/relatorios/4c5ed93640b296f5cf95a7a7f48d02bc.pdf
- Abr/2025: https://swimsystem.swimtimebrasil.com/39519/ProgressionDetails.pdf
- Jul/2025: https://swimsystem.swimtimebrasil.com/39523/ProgressionDetails.pdf
- Set/2025: https://swimsystem.swimtimebrasil.com/39532/ProgressionDetails.pdf
- Out/2025: https://swimsystem.swimtimebrasil.com/39533/ProgressionDetails.pdf
- Nov/2025: https://swimsystem.swimtimebrasil.com/40366/ProgressionDetails.pdf
- Mar/2026: https://swimsystem.swimtimebrasil.com/40595/ProgressionDetails.pdf
- Abr/2026: https://swimsystem.swimtimebrasil.com/40602/ProgressionDetails.pdf

## Limites de cobertura e integridade

Ainda podem existir competições não indexadas pelos buscadores ou fora destes dez boletins. Não foram confirmadas provas adicionais do atleta no Festival 2026 (festival destinado a nadadores não federados). Datas históricas incertas e piscinas não verificadas não devem ser inferidas. Uma prova sem resultado nunca entra em cálculo de melhores marcas, médias ou linha de evolução. Preservar a exclusão do lote sem afetar dados externos ao lote.