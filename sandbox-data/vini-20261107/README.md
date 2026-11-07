# VINISWIM — dataset isolado e descartável do Vini

**Local:** `sandbox-data/vini-20261107/` na branch **`sandbox/vini-two-accounts-20261107`**.

**Isolamento:** somente arquivos no GitHub desta branch; **não é migração SQL, seed aplicado ao Supabase, alteração da interface, deploy nem gravação em contas reais**. O VINISWIM Supabase estava INACTIVE na última verificação e o PCQO ACTIVE_HEALTHY. Não ligar esta fixture às rotas do aplicativo sem nova autorização.

## Conteúdo

`fixture.json` armazena **2 cópias separadas** da mesma história esportiva, uma para cada cadastro do atleta no banco real (UUIDs já identificados por consulta somente leitura):

- Família de Henrique Costa Ballao — atleta `f02e62f2-4987-4c99-aa21-1b8d89b80e65`.
- Família de Vinícius Suzin Ballão — atleta `af41d466-479b-47e5-8ffb-6dd03ae26e4f`.

**Por cadastro:** 30 tempos históricos recuperados documentalmente de oito competições anteriores + 2 resultados de 06–07/11/2026 + 2 provas de 08/11/2026 apenas com balizamento/inscrição. Total **34 registros lógicos por cadastro**, **32 resultados realizados**, **4 entradas de novembro com tempo de inscrição** (das quais duas já realizadas e duas pendentes). A prova de 50 m livre em 08/11 mantém **raia 0**.

As 30 marcas anteriores vêm de transcrição documental em `docs/audit/2026-11-07-vini-public-results-recovered-partial.md`, não de validação independente de cada documento nesta execução. Os quatro registros de novembro vêm das imagens encaminhadas pelo proprietário e de `docs/audit/2026-11-07-vini-sulbrasileiro-2026-entries-results.md`. **Não considerar como histórico completo e não publicar como dados oficiais definitivos sem conciliação dos documentos.**

Campos incertos (`course` e dia exato de várias provas históricas) são `null` ou intervalos textuais: não deduzir arbitrariamente. Os registros de domingo 08/11 são apenas entradas, com `time_ms: null`.

## Teste isolado

`node --test sandbox-data/vini-20261107/fixture.test.mjs`

Os testes conferem separação por cadastro, quantidades, ausência de resultado para provas pendentes e preservação de raia zero. Não fazem chamadas de rede nem acessam Supabase.

## Remoção sob solicitação

Quando o proprietário solicitar excluir o dataset:
1. Excluir `sandbox-data/vini-20261107/fixture.json`, `fixture.test.mjs` e este `README.md` da branch, registrando commit de remoção; ou apagar integralmente a branch dedicada caso não tenha outros trabalhos.
2. Verificar que nenhum runtime, CI, website ou banco consome os arquivos.
3. **Limite:** exclusão de arquivos ou branch não apaga necessariamente objetos do histórico Git. Para eliminação irreversível de dados do histórico, são necessários procedimentos próprios do GitHub e avaliação de réplicas/clones, sem prometer apagamento total.

Não executar `DELETE` em Supabase — nada deste dataset foi gravado no banco.

## Prévia integrada no código do aplicativo (somente nesta branch)

O arquivo `commercial/apps/web/src/SandboxViniResults.tsx` é renderizado pela aba **Resultados** de `commercial/apps/web/src/App.tsx` **somente se o atleta selecionado for um dos dois UUIDs presentes na fixture e houver sessão de usuário e conta selecionada**.

- Carrega os dados do arquivo versionado `fixture.json`; **não escreve em PostgreSQL nem chama uma importação**.
- Por padrão exibe as quatro provas de novembro, com opção de exibir todos os 34 registros do cadastro.
- Cada registro histórico mantém sua classificação como transcrição não integralmente homologada.
- O botão **Remover prévia deste dispositivo** grava um marcador em `localStorage` com chave composta de usuário, conta e atleta; isso oculta a prévia somente naquele navegador. **Não é exclusão de dados persistidos**. Não usar este controle para prometer deleção irreversível.
- Para exclusão do código sob ordem do proprietário, remover a linha de importação e a renderização de `SandboxViniResults` em `App.tsx`, apagar `src/SandboxViniResults.tsx` e o diretório `sandbox-data/vini-20261107/`, registrar commit e verificar build.
- A branch **não foi mesclada nem implantada**; o aplicativo publicado não mostra esta prévia. Não implantar a branch sem revisão de exposição de dados, porque a fixture é empacotada com o frontend estático, e o filtro visual por conta não é barreira de autorização.
