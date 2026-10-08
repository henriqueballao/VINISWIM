# VINISWIM — Auditoria do pacote candidato de publicação (Gate 2)
Data: 2026-10-08
Escopo: PR #4, branch `ui/unified-dashboard-validation`, HEAD `3982e4bd87045e5538d9c217c2d6106be8e1d2f1`.

## Evidência executada
- GitHub Actions [workflow #30](https://github.com/henriqueballao/VINISWIM/actions/runs/37809509756), job `verify-source`, conclusão **success**, todas as etapas com conclusão success.
- Compilação TypeScript e Vite; inspeção do build, testes Chromium de login e responsividade, testes autenticados sintéticos de navegação das quatro abas, links HTTPS da competição, guardas de não escrita; verificador experimental do bundle; upload do artefato.
- Import V2 Gates [workflow #111](https://github.com/henriqueballao/VINISWIM/actions/runs/37809509632): success.
- Artefato `viniswim-ui-gate2-candidate`, GitHub artifact ID **11564647379**, 238471 bytes, digest `sha256:e230b18eaff96baff551143b2572e6aa8fdceea8fa0c696d15607b1fbbc9b008`, expira em 2026-10-15. O artefato foi gerado pelo próprio workflow #30; não foi publicado.

## Itens aprovados
1. **Fonte reprodutível**: `commercial/apps/web/src/App.tsx` passa no TypeScript e Vite.
2. **Subdiretório /app/**: `commercial/apps/web/vite.config.ts` usa `base:'./'`; gate exige caminhos relativos em `dist/index.html`.
3. **PWA**: arquivos fonte `commercial/apps/web/public/sw.js` e `manifest.webmanifest` existem; o build publica diretório `dist`.
4. **Testes funcionais sem dados reais**: Chromium desktop, retrato e paisagem no login; desktop e celular autenticados com dados sintéticos; nenhum teste escreve no Supabase.
5. **Import V2**: suite própria passou, sem alterar motor.

## Ressalvas e bloqueios objetivos de release
- **Não ocorreu deploy**. A pasta atualmente versionada `app/` ainda tem `index.html` apontando para `./assets/index-DXCaaEsO.js` e `./assets/index-DkBfo2Nq.css`; ela **não** foi substituída pelo `dist` fresco aprovado. Publicar esse `app/` sem sincronizar resultaria em servir o bundle experimental antigo. É obrigatório substituir o conjunto HTML/assets por **exatamente o build aprovado**, de forma atômica e com rollback preservado.
- O artefato CI é da fonte React, não demonstra sozinho que a **publicação real** e seu cache/PWA no domínio `viniswim.com.br/app/` foram testados. Exigir smoke após deploy.
- O balizamento **direto por prova** não foi comprovado. A interface oferece link HTTPS da **competição**; não chamá-lo de link direto para a série/raia.
- Testes autenticados utilizam mock de sessão e dados sintéticos. Conectividade e permissões RLS reais exigem verificação posterior não destrutiva.
- O diff do PR #4 ainda inclui `app/assets/index-DXCaaEsO.js` alterado manualmente: NÃO usar esse arquivo como pacote definitivo. A publicação deverá usar unicamente o bundle recompilado.
- Artefato temporário (expira 15/10/2026): guardar evidência e regenerar em caso de publicação posterior, conferindo hash do novo build.

## Decisão de auditoria
**APROVADO COMO CANDIDATO TÉCNICO**, com build e testes CI verdes. **NÃO APROVADO PARA DEPLOY INALTERADO** enquanto `app/` não for sincronizado ao artefato do workflow #30 e não existir procedimento de rollback/verificação pós-deploy. Nenhuma alteração em `main`, Supabase ou resultados reais autorizada por este documento.
