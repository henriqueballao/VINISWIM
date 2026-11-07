# VINISWIM — Sul-Brasileiro Mirim/Petiz (2º semestre), 6–8 novembro 2026 — atualização por telas oficiais

**Data do registro:** 2026-11-07.
**Fonte:** duas capturas de tela da página "Provas do atleta" do SwimSystem fornecidas pelo proprietário nesta conversa. **O commit contém transcrição textual, não os arquivos de imagem.** Confirmar URL/identificador da competição e documento bruto antes de marcar como importação oficial auditável.

**Atleta mostrado:** Vinicius Suzin BALLAO, nascido em 2015, masculino, Curitibano, categoria Petiz 1. **Quatro provas.**

| Data | Etapa | Prova | Nº da prova | Série | Raia | Horário indicado | Tempo inscrição | Tempo nadado | Situação |
|---|---|---|---:|---:|---:|---|---|---|---|
| 2026-11-06 | 1ª | 50 m costas | 11 | 2 | 2 | 11:30 | 50.24 | **48.49** | Resultado exibido; 38º |
| 2026-11-07 | 3ª | 100 m livre | 47 | 2 | 5 | 11:04 | 1:35.18 | **1:39.68** | Resultado exibido; 51º |
| 2026-11-08 | 5ª | 100 m costas | 75 | 2 | 1 | 09:18 | 1:43.91 | — | Agendado, não confundir com resultado |
| 2026-11-08 | 5ª | 50 m livre | 83 | 2 | **0** | 10:59 | 43.78 | — | Agendado, não confundir com resultado |

## Interpretação e cuidado

- 50 costas: resultado 1,75 s mais rápido que a inscrição.
- 100 livre: resultado 4,50 s mais lento que a inscrição.
- Horários são **horários indicados na página**, não garantias de realização em tempo real.
- A tela não identifica inequivocamente piscina 25/50 m. Não inferir o comprimento; verificar nos metadados oficiais da competição.
- Tempos de inscrição devem ir exclusivamente a `meet_entries.seed_time_ms`, jamais como marca nadada.
- Resultados 48.49 e 1:39.68 somente devem ir a `results` com prova, data, piscina, status, fonte e conta autorizada verificados.
- Os tempos dos dias seguintes não foram realizados na captura. A raia 0 é literalmente mostrada e deve ser aceita pelo domínio, sem conversão para nulo.
- Vini tem dois cadastros independentes por conta: `f02e62f2-4987-4c99-aa21-1b8d89b80e65` (Família de Henrique Costa Ballao) e `af41d466-479b-47e5-8ffb-6dd03ae26e4f` (Família de Vinícius Suzin Ballão). Não misturar os IDs dos tenants.

## Estado operacional no momento

VINISWIM Supabase `cdtvhagbgiwnjkgninqn`: **INACTIVE**. PCQO `wfnusjxrxpxaqqberpcs`: **ACTIVE_HEALTHY**. Para não pausar novamente o projeto empresarial sem autorização renovada, **nenhuma escrita no Supabase foi realizada**.

Este documento é um registro de informações fornecidas pelo usuário, não uma importação auditada por documento bruto nem comprovante de aplicação em produção. Na próxima janela autorizada de escrita, reconciliar os quatro eventos com dados existentes e anexar URL/hash dos documentos oficiais para evitar duplicações.
