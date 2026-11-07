# Revisão independente — execução real no runtime Supabase local

Leia docs/audit/2026-10-12/edge-runtime-browser-and-recovery.md e edge-browser-recovery-evidence, além dos pareceres anteriores. O proprietário retirou Vini/Lorenzo/André da aceitação: não exigir/importar aqueles perfis; o teste final será atleta escolhido por ele sem aviso prévio.

Confronte os commits 47d0281, 4ff6ee7, 1c02f91, 8987cf2, 905de19, 66cc4ec e 4e059c8 com a execução 38250000935. Verifique hashes do pacote/capturas, cadastro pela UI, Auth/REST/Edge reais, nenhuma interceptação, identidade não autoverificada, cinco resultados ao vivo e zero novas inserções na reimportação, negação entre contas, comparação de cada tempo/data/prova/piscina/competição, troca de token em isolate quente e autenticação após reiniciar a função.

Não omita as falhas 38248730056/38249129902; examine se a correção de reloadSources resolve a causa sem enfraquecer asserções. Não confunda a fixture periférica com clone completo, harness HTTP com cron, priorização/cancelamento de filhos com importação de 70 competições, nem banco local com produção. Avalie catálogo sem participação, formatos antigos, outros adaptadores e limites do Edge hospedado.

Em produção somente leitura: modo, contagens, cron, versões Edge, bundle servido. Não inserir resultado, restaurar dados, remover holds ou ativar importadores. PR #17 permanece draft e os gates de produção reprovados. Commitar parecer na mesma branch, com contraprovas e distinção explícita entre código candidato e operação publicada.
