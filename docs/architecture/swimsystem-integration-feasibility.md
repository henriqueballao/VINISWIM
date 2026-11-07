# SwimSystem — Viabilidade de integração direta

**Decisão em 07/11/2026: API pública não comprovada. Acesso por entidade ou parceiro é uma hipótese contratualmente prevista e ainda não habilitada para o VINISWIM. Exportação LENEX é a primeira opção para um piloto autorizado.**

| Questão | Resultado observado |
|---|---|
| API pública e webhooks | [Ajuda oficial](https://www.swimsystem.app/help), seção Desenvolvedores, marca ambos como “Em breve”. Nenhum endpoint público, esquema, SDK, limite numérico, tipo de token ou assinatura de webhook validado. |
| API de entidade/parceiro | Os [termos da STB, seção 14](https://sportstimingbrasil.com/terms) descrevem chaves emitidas para a entidade, limites definidos na documentação vigente e restrições de uso/redistribuição. Isso confirma que o produto prevê esse canal. O acesso para parceiros, o plano, os escopos, as credenciais e a disponibilidade comercial precisam de confirmação direta. |
| Exportações | A [página de gestão](https://www.swimsystem.app/system) anuncia importação/exportação LENEX, SDIF e Excel. O [guia LENEX](https://www.swimsystem.app/resources/importacao-inscricoes-lenex) descreve exportação do resultado final, com parciais e desclassificações, e suporte do formato a inscrições e balizamentos. O guia [CSV/Excel via Central de Ajuda](https://www.swimsystem.app/help) trata de entrada de inscrições. Não comprova feed CSV de resultados. |
| Evento público | O [evento amostrado](https://www.swimsystem.app/meets/sw/c8587533-2e44-4b08-991f-f827170c7344) retornou HTML com 10 PDFs distintos e nenhum link HTML para arquivo estruturado esportivo. A observação cobre essa página. Links públicos de documentos são referências de publicação, sem equivalência com API de dados. |
| Atualizações e correções | Há resultados exibidos ao vivo e exportação documentada após homologação. Nenhum contrato acessível comprova revisão incremental, eventos de retificação, cancelamento, ordem de versões, webhook ou exportação agendada. Requer confirmação e amostra de uma correção. |
| Uso legítimo | Os [termos](https://sportstimingbrasil.com/terms) vedam extração automatizada em massa fora da API e dos seus limites. A [política de privacidade](https://sportstimingbrasil.com/privacy) trata acesso por entidade, finalidade e dados de menores. Para o piloto, obter autorização de uso, armazenamento e escopo da entidade, e chave específica do fornecedor se for API. Não foram consultadas interfaces privadas ou reaproveitadas sessões. |

**Dados sem scraping.** Com arquivos autorizados e campos presentes, LENEX pode transportar calendário da competição, sessões, provas, piscina de 25/50 m, categorias, registros de atletas, inscrições, tempos de inscrição, séries, raias, resultados, colocações, parciais e códigos de status. O formato prevê recordes e índices. A presença e estabilidade dos identificadores, exportação pré-prova, ranking oficial de temporada, histórico, distribuição e cobertura de parciais não foram confirmados para arquivos emitidos por este fornecedor. [Especificação LENEX 3.0](https://wiki.swimrankings.net/images/6/62/Lenex_3.0_Technical_Documentation.pdf).

## Minuta técnica para a Sports Timing Brasil

Canal publicado na [Central de Ajuda](https://swimsystem.app/help): support@sportstimingbrasil.com. Minuta registrada para revisão e envio pelo responsável.

> Somos responsáveis pelo VINISWIM, ferramenta de análise do histórico esportivo dos atletas. Queremos validar uma integração de leitura com dados oficiais, começando por um evento autorizado.
>
> A STB oferece API a entidades ou integradores hoje? Qual entidade deve autorizar o VINISWIM, quais planos permitem a integração e como emitir credencial própria de leitura em sandbox? Pedimos documentação, campos, autenticação, escopos, IDs estáveis, quotas, paginação, políticas de versão e condições de retenção e exibição de dados, inclusive para atletas menores.
>
> A interface entrega calendário, inscrições, séries/raias, resultados, parciais e rankings? Como sinaliza resultados provisórios, homologação, correções, anulações e republicações? Há webhook assinado com reentrega ou cursor incremental para leitura periódica?
>
> Se o acesso por API ainda não estiver disponível para este caso, podemos receber um LENEX oficial autorizado do mesmo evento em três momentos: balizamento, resultado homologado e retificação? Pedimos a publicação oficial correspondente para conciliação, o perfil que pode exportar e a confirmação de entrega manual ou automatizada por competição.

[Registro técnico das consultas](evidence/2026-11-07-official-source-probes.json).
