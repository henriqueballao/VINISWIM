# Canônico — Motor de Importação V2

Status: obrigatório para a refatoração.

## Princípios
1. Código genérico: nenhuma regra por nome, e-mail, UUID ou atleta específico.
2. Fonte oficial primeiro. API/JSON quando disponível; HTML/PDF somente quando necessário.
3. Identidade e descoberta são separadas de parsing e persistência.
4. Parser é função pura: documento + identidade + contexto -> candidatos. Não escreve no banco.
5. Ausência de dado obrigatório gera diagnóstico; nunca fallback inventado.
6. Persistência ocorre somente depois de validação e deduplicação.
7. Toda linha persistida mantém proveniência verificável.
8. Retry é idempotente.
9. Estado antigo de job não pode impedir que código corrigido seja validado.
10. Refresh só termina quando o trabalho descendente daquele request terminou.

## Pipeline
A. ResolveIdentity
B. DiscoverMeets
C. FetchOfficialDocuments
D. ParseCandidates
E. Normalize
F. Validate
G. Deduplicate
H. Persist
I. ReconcileRequest

Cada estágio recebe e devolve contrato explícito. Nenhum estágio consulta implicitamente o resultado de outro por efeitos colaterais.

## Proibições
- correção manual de resultado real;
- criação manual de competição para mascarar falha de descoberta;
- tempo obtido de atleta vizinho;
- primeiro tempo encontrado no bloco;
- fallback por nome quando external_id confiável existe;
- data atual quando a data oficial não existe;
- competição marcada como concluída antes de seus documentos/jobs terminarem;
- lógica especial para Vini, André, Lorenzo ou qualquer atleta.

## Compatibilidade
Frontend, Auth, RLS e tabelas de produto são preservados inicialmente. O V2 nasce ao lado do motor legado. Cutover somente após os gates.
