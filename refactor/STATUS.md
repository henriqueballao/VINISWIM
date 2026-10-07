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

## Forensic cleanup
- Unauthorized manual result updates were rolled back from audit snapshots before the final reprocess.
- V2 runner v15 performs generic modern-document discovery and verified legacy reconciliation.
- Final real state: 37/37 official, 0 legacy-vini rows, 0 missing fingerprints, 0 semantic duplicate groups.
- Final SwimSystem-only reconciliation request: `e7548a44-8dd1-421f-a9e7-469f6edef703` -> 2/2 completed.
- Import V2 Gates, Documentary Gates and Live Readonly are green at commit `612d5242935871ba112141b91c384b76b43fad4e`.

## Estado
**PODE BUSCAR AGORA.**
