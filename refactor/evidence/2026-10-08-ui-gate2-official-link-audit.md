# VINISWIM — Gate 2 | Evidência de ligação oficial e proteção de release
Data: 2026-10-08
Branch: ui/unified-dashboard-gate2

## Constatações verificadas (somente leitura)
1. No Supabase VINISWIM, a competição futura de 10/10/2026 "Torneio Regional da 1ª Região (Pré-Mirim/Petiz) · SwimSystemApp" possui `meets.official_url` = `https://www.swimsystem.app/meets/sw/c8587533-2e44-4b08-991f-f827170c7344`, `venue` = Clube Curitibano e oito `meet_entries` vinculadas. Esse endereço é armazenado como URL da competição, não como URL específica de prova/balizamento.
2. A tabela `meet_entries` contém `event_id`, `scheduled_at`, `heat`, `lane`, `seed_time_ms`, `external_id`, `source_id`, mas **não possui URL dedicada de balizamento por prova**. Portanto não é aceitável construir automaticamente um destino de prova concatenando parâmetros supostos.
3. Protótipo da branch aceita somente URLs HTTPS existentes em `meet.official_url`, usa `noopener noreferrer` e rótulo acessível. Não representa implementação do link específico de balizamento.
4. O checkout de produção não foi alterado. O bundle experimental permanece divergente do arquivo `commercial-src.zip` até sincronização explícita da fonte e rebuild.

## Gate estático ampliado
O script `scripts/check-ui-consolidation-gate2.cjs` passou de 14 para 18 verificações declarativas, incluindo HTTPS, segurança de link, remoção da duplicidade da seção de próximo campeonato e limite de três marcas no resumo. Estas são verificações de texto compilado; não substituem execução e testes E2E.

## Bloqueios de integração
- A fonte comercial zipada precisa receber a mesma modificação na origem editável `apps/web/src/App.tsx`, com geração de um novo bundle reprodutível; não publicar diretamente o bundle manipulado.
- Endereço de balizamento específico depende de evidência real do site oficial. Enquanto não houver, oferecer somente link claramente identificado como página oficial da competição, jamais rotulado como link específico da prova.
- Exigir testes automatizados reais, responsividade, não duplicação e zero mutação do banco.

## Conclusão
**Gate 2 continua bloqueado para merge/deploy**. Este relatório documenta avanço verificável sem aprovação falsa.
