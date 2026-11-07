# VINISWIM — Revisão da estratégia V4: API-first / integração oficial

Data: 2026-11-07
Decisão proposta: **priorizar integração com fontes oficiais, em vez de reconstruir crawlers de resultados**. Este documento complementa e **revisa a premissa técnica** de `docs/architecture/2026-10-21-import-engine-v4-rebuild-plan.md`. Não é autorização de deploy, remoção de motores ou acesso indevido a APIs.

## Constatações externas verificadas

1. SwimSystem oferece na própria plataforma eventos, inscrições, séries/raias, resultados oficiais, parciais e rankings. Fontes: https://www.swimsystem.app/ ; https://www.swimsystem.app/system ; https://apps.apple.com/br/app/swimsystem/id6818007109 .
2. A central oficial de desenvolvedores indica **API pública — Em breve** e **Webhooks e automações — Em breve**. Isto **não comprova disponibilidade, contrato, endpoint público estável ou autorização de uso**: https://swimsystem.app/help .
3. A documentação oficial do SwimSystem descreve suporte nativo ao formato **LENEX 3.0** (XML `.lef`, ZIP `.lxf`), com competições, inscrições, balizamentos e resultados, e capacidade de exportação pelos organizadores: https://www.swimsystem.app/resources/importacao-inscricoes-lenex . Não comprova que uma URL de exportação pública automática esteja disponível para todos os eventos.
4. O código legado do VINISWIM usa funções remotas/parsers e captura de documentos; o objetivo passa a ser **substituir procura HTML/PDF pela integração de dados estruturados quando legal e tecnicamente disponível**.

## Diretriz arquitetural

**API-first, webhook-when-authorized, LENEX-first for structured exports; documento original como fallback somente para fontes sem integração.** Não usar chamadas internas não documentadas, tokens do site, service-role keys, bancos de terceiros ou bypass de acesso como se fossem API pública. Endpoint retornando JSON não constitui permissão nem SLA.

A arquitetura exige:
- Cadastro por fonte: provedor, identificação oficial do atleta, tipo de autenticação, permissões, quotas, esquema/versionamento, política de atualização e indicadores de qualidade.
- Interface `OfficialProviderAdapter` compartilhada: `listMeets`, `getEntries`, `getStartlists`, `getResults`, `getUpdates` (se disponível), `getSourceEvidence`. Adaptadores por provedor, não motores separados.
- Preferir webhook assinado para atualização; na ausência, polling incremental autorizado com ETag/Last-Modified/cursor, limites de requisições e backoff. Sem varreduras integrais.
- Converter todos os dados ao mesmo modelo canônico de prova, competição, piscina, atleta, resultado, split e balizamento; persistir versão e ID externo da fonte; nunca usar nome ou tempo como chave.
- Preservar PostgreSQL próprio para histórico, melhores marcas, auditoria e resiliência, separando dados oficiais de dados manuais; idempotência, RLS e compatibilidade multi-tenant.
- Evidência: payload bruto autorizado ou arquivo LENEX, hash, URL/identificador, hora de coleta, versão do schema e status de atualização. Se houver termos que proíbam armazenamento, negociar autorização e ajustar a arquitetura, sem presumir permissão.
- Preservação literal de design, CSS, navegação, dashboard, gráficos, responsividade e autenticação VINISWIM.
- Fallback explícito: importação LENEX disponibilizada por organizador, feed/documento oficial permitido e, apenas em último caso, parser de documento oficial; jamais aumentar scraping sem necessidade.

## Investigações obrigatórias antes de implementar V4

1. **SwimSystem / Sports Timing Brasil:** solicitar confirmação formal de disponibilidade da API (incluindo ambiente de testes, documentação, autenticação, endpoints, webhooks, atualização/correção de resultados, limites e autorização de retenção de dados), e de exportação LENEX com acesso por evento. Canal público: `support@sportstimingbrasil.com` (https://swimsystem.app/help).
2. **Demais sites cadastrados:** fazer inventário exato a partir da configuração atual, classificar API pública documentada / API de parceiro / LENEX / arquivo aberto / somente HTML-PDF; registrar evidência de autorização por fonte. Não afirmar que todos possuem API.
3. **Prova de conceito limitada:** uma competição real, um atleta autorizado, extração de inscrições, séries/raias, resultados e parciais, com comparação ao oficial; sem escrita de produção, antes de qualquer recodificação em massa.
4. **Decisão do produto:** se existir API/artefato estruturado autorizado, eliminar do plano V4 a reimplementação dos crawlers correspondentes; se não existir, considerar acordo com fornecedor e ingestão LENEX antes de recorrer ao parser.
5. **Cutover:** não apagar motores antigos nem dados até todas as fontes necessárias estarem cobertas por integrações verificadas e o caminho legado ter sido desativado sem prejuízo a outras contas. Testes de reinício, consistência, idempotência e UI publicada são obrigatórios.

## Resultado

A hipótese do proprietário é **forte** e reduz a complexidade central: **VINISWIM deve ser extensão analítica, não concorrente do software de apuração oficial**. Contudo, **o acesso público à API SwimSystem permanece NÃO COMPROVADO** na documentação oficial consultada em 07/11/2026, que indica 'Em breve'. Próxima decisão depende de acesso autorizado ou de exportação LENEX validada.

**Não iniciar desenvolvimento de novo buscador V4 antes de concluir o levantamento de integrações estruturadas.**
