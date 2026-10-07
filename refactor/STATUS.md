# Status — Import V2

## 2026-10-07 — Gate 7 concluído após correção pós-cutover
- Gates 0/1: suíte isolada V2 aprovada.
- Gate 2: descoberta live read-only aprovada.
- Gates 3/4: dry-run documental e idempotência aprovados.
- Gate 5: falhas distintas e recuperáveis implementadas e testadas.
- Gate 6: lifecycle de request inclui jobs descendentes V2 e terminalidade correta.
- Gate 7: Vini, André e Lorenzo validados documentalmente sem regra individual.
- Piloto sintético de escrita aprovado e resíduos removidos.
- Frontend usa `request_result_refresh_v2`.
- Runner V2 e cron V2 ativos; cron legado de importação removido.

## Correção pós-cutover
A primeira declaração de fechamento foi invalidada por um defeito real: o runner histórico limitava a busca a 45 dias antes do resultado mais recente. O request podia terminar `completed` sem reconstruir todo o histórico.

Correções aplicadas:
- removido o cutoff de 45 dias;
- varredura de todos os arquivos históricos conhecidos;
- ResultList legado cobre hífens espaçados e mantém fronteira da própria linha;
- linhas legadas só são promovidas com evidência oficial da mesma competição;
- arquivos históricos inativos permanecem elegíveis como evidência;
- livros de resultados do SwimSystem moderno passam a ser parser oficial do V2;
- documentos modernos não dependem do padrão de nome `ResultList_*.pdf`.

## Estado real validado do perfil em produção
- request corretivo `6597a8d5-be55-4f9f-907a-ddb779449e97`: 4/4 completed, 0 failed;
- request de reconciliação final `66d37ea2-1801-4311-b060-831528312e83`: 4/4 completed, 0 failed;
- 37 resultados totais;
- 37 resultados oficiais;
- 0 resultados ligados a `legacy-vini:*`;
- 0 fingerprints ausentes;
- 0 grupos de duplicidade semântica;
- 0 tempos suspeitos abaixo de 10 s;
- competição de 18-20/09/2026 reconciliada para o meet canônico `9b002997-591e-4f74-8492-ef595b4705c0`, LCM (50m), conforme documento oficial.

O perfil homônimo separado não foi usado como fonte e não houve merge.

Evidência integral: `refactor/evidence/2026-10-07-gate7.md`.

## Estado
**PODE BUSCAR AGORA.**
