import test from "node:test";import assert from "node:assert/strict";
import {parseModernResultBook} from "./swimsystem-modern-results.mjs";
import {validateResultCandidate} from "./contracts.mjs";
const meet={sourceCode:"swimsystem",externalMeetId:"modern-fixture"};
test("modern result book anchors event date, registration and course",()=>{
 const text="# Meet Federação de Desportos Aquáticos do Paraná Colombo (PR), 18-20/09/2026, LCM (50m) ## Prova 6 - Final Direta Masculino, 100m Livre Petiz 1 18/09/2026 Resultados 34. 4/8 Atleta Teste 700001 2015 Clube 1:35.18 115 0.00 35. 1/6 Vizinho 700002 2015 Clube 1:44.42 87 0.00";
 const r=parseModernResultBook({text,identity:{externalId:"700001"},meet,sourceUrl:"fixture://modern.pdf",retrievedAt:"2026-10-07T00:00:00Z"});
 assert.equal(r.length,1);assert.deepEqual([r[0].event,r[0].resultDate,r[0].course,r[0].timeMs,r[0].status],["100 Livre","2026-09-18","LCM",95180,"valid"]);assert.equal(validateResultCandidate(r[0]).accepted,true);
});
test("modern result book keeps DNS without borrowing neighbor time",()=>{
 const text="# Meet Federação de Desportos Aquáticos do Paraná Colombo (PR), 18-20/09/2026, LCM (50m) ## Prova 48 - Final Direta Masculino, 50m Livre Petiz 1 19/09/2026 Resultados DNS 3/6 Atleta Teste 700001 2015 Clube DNS — — 12. 2/5 Vizinho 700002 2015 Clube 42.10 160 0.00";
 const r=parseModernResultBook({text,identity:{externalId:"700001"},meet,sourceUrl:"fixture://modern-dns.pdf",retrievedAt:"2026-10-07T00:00:00Z"});
 assert.equal(r.length,1);assert.equal(r[0].status,"dns");assert.equal(r[0].timeMs,null);assert.equal(validateResultCandidate(r[0]).accepted,true);
});
test("modern summary without exact dated result section is ignored",()=>{
 const text="# Meet Federação de Desportos Aquáticos do Paraná Colombo (PR), 18-20/09/2026, LCM (50m) Resultados por Clube Atleta Teste 700001 100m Livre Final Direta 34. 1:35.18";
 assert.equal(parseModernResultBook({text,identity:{externalId:"700001"},meet,sourceUrl:"fixture://summary.pdf",retrievedAt:"2026-10-07T00:00:00Z"}).length,0);
});
