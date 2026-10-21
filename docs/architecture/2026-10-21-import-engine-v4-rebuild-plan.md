# VINISWIM — Diagnóstico e plano de substituição integral do motor de importação

Data: 2026-10-21
Branch de análise: `fix/official-import-audit-20261011`
Natureza: decisão arquitetural e plano executável; **não autoriza deletar dados, alterar produção, fazer merge ou deploy**.
Objetivo do proprietário: **preservar integralmente o design/layout da interface e substituir todos os motores de importação de resultados por uma única implementação simples, eficiente, verificável e recuperável.**

## 1. Diagnóstico confirmado em código e evidências

Fontes: `docs/audit/2026-10-11/adversarial-review-5775834.md`, `codex-corrections-after-independent-review.md`, `docs/audit/2026-10-12/codex-acknowledgment-of-incomplete-delivery.md`, worker e runner na branch. Datas e contagens de produção citadas são capturas históricas, **não uma leitura atual em 21/10**.

1. **Motores em paralelo, com múltiplos escritores:** raiz GitHub Pages consome Railway/JSON; React em `/app/` consome Supabase; `monitor-runner` e `import-v2-runner` e crons legados continuavam ativos na captura; worker `official-v3` era candidato e não estava publicado. Ausência de fonte única e cutover.
2. **Semântica de identidades frágil:** colisões se faltar conta, atleta, competição, prova, número, rodada, sexo, piscina, data e origem. Nunca usar nome ou tempo como chave de identidade de corrida.
3. **Proveniência insuficiente em dados existentes:** captura em 11/10 identificou 252 `results`, 82 `personal_bests`, zero `meet_entries`, e zero `raw_hash` entre 252 fontes; a origem alegada desses registros era o legado. Não significa que o estado atual seja igual.
4. **Erro transacional perdido e retentativa indevida:** revisão de `5775834` reproduziu perda de mensagem SQL e classificação incorreta; arquivos mais recentes da branch já mostram `OfficialRpcError` e replay apenas de resposta incerta. Considerar a falha **histórica, exigindo reexecução dos testes**, e não afirmar que persiste sem novo teste.
5. **Índices e upsert incompatíveis:** alteração proposta de índice único completo para parcial retorna PostgreSQL `42P10` no consumidor `import-v2-runner`; risco transversal a outras contas. Não executar a migração incompatível.
6. **Proteção de escrita insuficiente:** fence proposto cobria `results`, mas não todo o ciclo de `meet_entries`, `meets` e derivados. Cutover deve impedir escritores antigos, sem bloquear leitura e resultados manuais.
7. **Operação e observabilidade incompletas:** jobs históricos `completed=0` sem causa, mensagens `unknown`, contratos de fila/monitor/worker não demonstrados após reinício; UI testada em mocks não constitui prova de produto.
8. **Desempenho não homologado:** lote de até 16 PDFs / 20 MiB cada, múltiplas cópias em base64, sem prova de memória/CPU real. Limites e streaming devem ser medidos.
9. **Cadastro manual:** código da UI tentava INSERT direto com policies apenas SELECT na captura. Corrigir caminho manual separadamente, sem abrir RLS e sem confundir com importação oficial.
10. **Contaminação de escopo:** resultados de múltiplas contas e fontes, incluindo atletas anteriores retirados dos casos de aceitação pelo proprietário em 12/10. Não reativar aqueles três atletas como critérios de aceite sem nova determinação.

## 2. O que eliminar e o que preservar

**Eliminar a arquitetura de importação concorrente, não a evidência nem os dados.** Depois de identificar e substituir cada consumidor, remover handlers, parsers, crons e workers legados duplicados, inclusive o caminho de importação do Railway quando todos seus consumidores tiverem substituto. Manter provisoriamente os serviços antigos somente em modo de leitura e sob controle de rollback, sem escrita concorrente.

**Preservar invariavelmente:** aparência, CSS, estrutura de componentes, navegação, gráficos e comportamento visual do React e da raiz publicada; autenticação e autorização; contas e atletas; `results`, `meet_entries`, `personal_bests`, `result_sources`, demais dados manuais, arquivos e logs de auditoria; backups, migrations aplicadas e material probatório. Alterações de integração na UI somente internas, mantendo a interface existente. Não excluir tabelas ou migrar resultados legados destrutivamente.

O verbo “apagar” se aplica a **código de motores desativados**, no final do cutover, nunca a dados de produção ou antes de verificar consumidores e equivalência.

## 3. Novo motor único: Import Engine V4

Arquitetura linear, um escritor SQL para todo resultado oficial:

```text
Scheduler + requisição autenticada
        ↓
Fila durável por conta/atleta/fonte/competição
        ↓
Worker V4 com lease/fencing e limites de concorrência
        ↓
Descoberta de fontes oficiais → captura do documento bruto
        ↓
SHA-256 + armazenamento imutável + metadados UTC
        ↓
Adaptador por fonte (HTML/PDF) → esquema canônico versionado
        ↓
Validação estrita de identidade e prova, sem inferência arbitrária
        ↓
Persistência SQL atômica com recibo e deduplicação idempotente
        ↓
Resultados / balizamentos / proveniência / conflitos / melhores marcas
        ↓
Consultas atuais → UI preservada sem mudança de layout
```

**Princípios obrigatórios:**
- Um único contrato para job, erro, captura, identidade, prova, resultado e recibo. Adaptadores por fonte são bibliotecas do mesmo motor, não outros motores.
- Descoberta incremental por fonte/competição, histórico paginado e limites explícitos; nenhum loop irrestrito de scraping. Respeitar autenticação, robots/termos aplicáveis e rate limits, sem contornar CAPTCHA.
- Dados brutos guardados uma vez em storage, por hash; não transportar documentos inteiros repetidamente em base64 na RPC. Parsing em arquivos/stream ou chunks limitados.
- Deduplicação por identidade oficial composta e versionada; **não usar o tempo nadado na chave**; atualizar apenas conforme regras de revisão oficial, preservando histórico/proveniência e conflitos.
- Separar tempo de inscrição (`meet_entries`) de marca nadada (`results`); DNS/DSQ/DNF sem inventar tempo; incluir raia 0 se documentos e domínio permitem.
- Autorização no servidor e RLS por conta/atleta. Worker opera com credenciais segregadas; RPC revalida permissão, lease e escopo na transação. Nenhum endpoint sem autenticação.
- Erros com `code`, `message`, `cause`, `retryable`, `job_id`, `source_url` e `attempt`; transitórios recebem backoff e limite; definitivos ficam bloqueados até ação; timeout pós-commit consulta recibo antes de repetir.
- Banco como fonte autoritativa; fila durável; retomar jobs após crash sem duplicação; status `completed` somente se contagem e recibo conciliarem.
- Índices/constraints definidos contra **todos os ON CONFLICT de todos os escritores sobreviventes**, incluindo contas alheias ao foco; testes PostgreSQL reais para 42P10.

## 4. Sequência de execução e critérios de saída

**Etapa A — Congelamento e inventário cirúrgico:** fixar SHA atual da PR; backup verificável de esquema/dados/artefatos; mapear entradas e consumidores dos importadores (root/index, Railway, React, edge, crons, triggers, filas, RPC, views) e listar exatamente cada writer ativo. Inventário serve para exclusão concreta, não para nova auditoria indefinida. Saída: mapa writer→entidade→consumidor→destino e plano de rollback, sem alterações de produção.

**Etapa B — V4 isolado, sem reaproveitar implementações de importação antigas:** criar um pacote e uma Edge/worker únicos; reutilizar apenas bibliotecas genéricas comprovadas (ex.: auth, leitura de arquivos), nunca coordenadores ou estado legado. Adaptadores próprios por fonte com fixtures originais, esquema canônico e rastreabilidade. Saída: fixtures reais com assertivas de todas as colunas/documentos, tempos, DNS, inscrição e identidade.

**Etapa C — Banco compatível e idempotência:** migrations aditivas e reversíveis, storage bruto e receipt; preservar conflict targets legados até desligamento comprovado; proibir exclusão de índices antes disso. Testes PostgreSQL isolados cobrindo upsert das contas legadas, duplicidade, concorrência, cancelamento, rollback e RLS. Saída: nenhuma falha 42P10, nenhuma gravação cruzada, segunda importação com zero novos registros e comparação com originais.

**Etapa D — Shadow mode e confronto:** V4 captura e valida sob credenciais operacionais controladas, escreve apenas em schema/tabelas de shadow; sem efeito nos resultados exibidos. Confrontar contagem, identidade, originais e desempenho com fonte oficial. Saída: divergências identificadas e resolvidas, sem falsa aprovação de jobs vazios.

**Etapa E — Cutover coordenado e reversível:** provisionar novo agendamento/autorização/worker, pausar todos os escritores antigos depois de identificar dependências, validar que nenhum cron legado pode gravar; migrar exclusivamente contratos necessários; trocar a integração de dados internamente mantendo HTML/CSS/layout e rotas. Publicar com janela controlada, rollback validado e logs. Saída: somente V4 grava resultados oficiais; outras contas seguem operacionais.

**Etapa F — Prova em produção, recuperação e remoção:** importar novas publicações automaticamente e persistir documento/hash, resultado, inscrições e recibo; reimportar sem duplicar; testar UI autenticada desktop/mobile, parar/reiniciar worker e confirmar recuperação. Somente com evidências fechar gates e remover código, jobs, endpoints e dependências de motores antigos. Nunca remover backups ou registros oficiais sem autorização específica.

## 5. Aceite obrigatório (produto, não apenas testes)

1. Mesmo design, layout, tipografia, navegação e responsividade publicados (baseline visual desktop/mobile e screenshot comparison).
2. Importação automática funcionando de ponta a ponta, **sem import manual do operador**, com nova publicação oficial identificada.
3. Resultados e balizamentos reais correspondem byte/documento original e identidade exata, status e piscina corretos.
4. Cada registro tem URL, hash dos bytes capturados, horário, parser e identidade verificáveis.
5. Duas execuções iguais geram zero duplicações e sem alterar resultados oficiais anteriores indevidamente.
6. Dados e escritas de outras contas e resultados manuais não sofrem regressão.
7. Erros SQL não perdem mensagem/código, 42P10 reprovado por contraprova, e erro permanente não é repetido.
8. Crash/redeploy/restauração retomam jobs sem perda ou dupla escrita; alertas para jobs vazios e falhas.
9. Um só writer de resultados oficiais ativo; todos os antigos desativados, rotas consumidoras preservadas/substituídas.
10. Evidências de produção: logs, recibos, queries de contagem por conta e documentos capturados, UI publicada e teste autenticado. **Sem prova em produção, não declarar entregue.**

## 6. Ordem ao Codex e restrições de escopo

Tratar este documento como orientação arquitetural para preparar execução controlada. Começar por **Etapa A, imediatamente seguida de B e C**, sem demandar novos pareceres circulares. Preservar UI exatamente. Entregar modificações em commits pequenos por etapa, incluindo plano de remoção file-by-file e critério de rollback. A revisão anterior com doze gates permanece registrada, mas **não multiplicar checklists**. É expressamente proibido apagar os dados, desligar serviços em produção, criar migrations destrutivas, fazer merge/deploy ou declarar êxito sem autorização e comprovação operacional.

**Decisão técnica:** reconstrução integral do motor é indicada, porém a exclusão deve ser sequenciada como substituição controlada: novo writer comprovado → cutover → remoção dos motores antigos. Apagar tudo antes criaria indisponibilidade e perda de trilha de auditoria.
