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


## Venue e nome canônicos — automático
- Removida a semeadura manual de metadados de competição do banco e da migration.
- O V2 consulta o catálogo oficial do SwimSystem, casa legado por data + piscina + similaridade de nome e abre a página oficial correspondente.
- `meets.name` passa pelo nome canônico da página oficial; prefixos de navegação como `Resultados ·` são descartados.
- `meets.venue` vem de `Local da competição`; cidade permanece metadado separado e não substitui Local.
- Evidência persistida somente como `auto_official_page`.
- Prova real após zerar a tabela de evidências: 9/9 competições rediscoverertas automaticamente.
- Timeline real: 37 resultados, 0 locais vazios e 0 nomes contaminados.
- Request FDAP final: `de1c62c6-90b4-41d3-a59d-b70285556e7d` -> 1/1 completed, 0 failed.
- Runner produção: v22.


## 2026-10-07 — fechamento antes de /clear
- Runner de produção: v22.
- Descoberta de metadados de competição não depende mais de seed manual: tabela de evidências foi zerada e 9/9 competições do histórico testado foram reconstruídas a partir do catálogo/páginas oficiais do SwimSystem.
- Estado oficial do perfil principal antes do lançamento manual: 37 resultados oficiais, 0 locais vazios, 0 nomes com prefixo técnico, 0 duplicidades semânticas conhecidas.
- Correção de Melhores Marcas: frontend passou a carregar `results(*,meets(venue,city,name))`; "Local" usa `meet.venue`. Commit de fonte `215670a7ebfc318596d519605ac89bc279d94d14`; build compilado `16cf5a4c5df9a306d0a8b0d28d7a1885ec9b3d31`.
- Operação manual explicitamente autorizada pelo usuário: quatro resultados manuais identificados como `hist35-01..04` foram copiados do perfil secundário para o perfil principal, preservando `origin=manual` e `is_official=false`. Não foi apresentada como busca automática.
- Estado atual do perfil principal após essa operação: 41 resultados = 37 oficiais + 4 manuais.
- Os quatro manuais são do Torneio Regional da 1ª Região, 22/03/2025, SCM, Santa Mônica Clube de Campo: 100 Livre 2:11.61; 200 Livre 4:36.44; 50 Costas 57.52; 50 Livre 57.63.
- Política canônica atualizada: escrita manual só é permitida quando explicitamente solicitada pelo usuário, permanece manual/não-oficial e nunca serve como evidência dos gates automáticos.
