# Contrato local de capacidades

Execute `node --test prototypes/official-provider-contract/contract.test.mjs` na raiz.

O protótipo verifica que um adaptador só expõe operações declaradas e que operações de dados exigem uma operação de evidência. As funções vazias existem apenas nos testes sintéticos. O teste verifica a forma do contrato, não valida autenticação, dados retornados, proveniência real ou persistência. Nenhum adaptador esportivo, credencial, fixture de atleta ou cliente de produção integra o pacote. A prova com dados reais depende de arquivo oficial autorizado ou acesso de parceiro. Ver [plano do adaptador](../../docs/architecture/official-provider-adapter-v4.md).
