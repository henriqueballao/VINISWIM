import test from "node:test";import assert from "node:assert/strict";import {parseResultList} from "./resultlist-parser.mjs";import {validateResultCandidate} from "./contracts.mjs";
const base={identity:{externalId:"422692"},meet:{sourceCode:"fdap",externalMeetId:"fixture",course:"SCM"},retrievedAt:"2026-01-01T00:00:00Z"};
const cases=[
["Prova 16Masculino, 100m LivreMirim\n04/07/2025 - 16:50Resultados\n29.2 / 5Vinicius Suzin Ballao4226922015Curitibano1:52.82136%-62","100 Livre","2025-07-04",112820],
["Prova 34Masculino, 50m CostasMirim\n05/07/2025 - 10:26Resultados\n28.4 / 8Vinicius Suzin Ballao4226922015Curitibano56.73103%-59","50 Costas","2025-07-05",56730],
["Prova 4Masculino, 50m BorboletaMirim\n04/07/2025 - 9:50Resultados\n20.2 / 6Vinicius Suzin Ballao4226922015Curitibano59.68--48","50 Borboleta","2025-07-04",59680],
["Prova 48Masculino, 100m MedleyMirim\n05/07/2025 - 17:12Resultados\n29.3 / 1Vinicius Suzin Ballao4226922015Curitibano2:08.44112%-56","100 Medley","2025-07-05",128440],
["Prova 60Masculino, 200m LivreMirim\n06/07/2025 - 9:00Resultados\n19.2 / 5Vinicius Suzin Ballao4226922015Curitibano4:11.29121%-61","200 Livre","2025-07-06",251290]
];
test("ResultList anchors exact event date and athlete id",()=>{for(const [text,event,date,time] of cases){const r=parseResultList({...base,text,sourceUrl:"fixture://result.pdf"});assert.equal(r.length,1);assert.equal(r[0].event,event);assert.equal(r[0].resultDate,date);assert.equal(r[0].timeMs,time);assert.equal(validateResultCandidate(r[0]).accepted,true)}});
test("wrong registration cannot donate neighboring result",()=>{const r=parseResultList({...base,text:cases[0][0].replace("422692","999999"),sourceUrl:"fixture://result.pdf"});assert.equal(r.length,0)});

test("legacy ResultList without clock time is parsed",()=>{
 const text="Prova 23 Masculino, 100m Peito Mirim/Sênior 07/12/2024 Resultados\n1. 5 / 4 Atleta Teste 700001 2015 Clube 1:41.08 20,00 163";
 const r=parseResultList({identity:{externalId:"700001"},meet:{sourceCode:"fdap",externalMeetId:"legacy-no-clock",course:"SCM"},retrievedAt:"2026-10-07T00:00:00Z",text,sourceUrl:"fixture://legacy-no-clock.pdf"});
 assert.equal(r.length,1);assert.equal(r[0].event,"100 Peito");assert.equal(r[0].resultDate,"2024-12-07");assert.equal(r[0].timeMs,101080);
});
test("compact N/C row is mapped to dns without borrowing a neighboring time",()=>{
 const text="Prova 26Masculino, 100m BorboletaMirim/Sênior 07/12/2024Resultados\n6.2 / 2 Outro 7000022015Clube2:10.12-49 N/C2 / 6Atleta Teste7000012015Clube- N/C1 / 4Vizinho7000032015Clube1:20.00-100";
 const r=parseResultList({identity:{externalId:"700001"},meet:{sourceCode:"fdap",externalMeetId:"legacy-nc",course:"SCM"},retrievedAt:"2026-10-07T00:00:00Z",text,sourceUrl:"fixture://legacy-nc.pdf"});
 assert.equal(r.length,1);assert.equal(r[0].status,"dns");assert.equal(r[0].timeMs,null);assert.equal(validateResultCandidate(r[0]).accepted,true);
});

test("compact N/C immediately followed by series number remains athlete status",()=>{
 const text="Prova 26Masculino, 100m BorboletaMirim/Sênior 07/12/2024Resultados N/C2 / 6Atleta Teste7000012015Clube- N/C1 / 4Vizinho7000032015Clube1:20.00-100";
 const r=parseResultList({identity:{externalId:"700001"},meet:{sourceCode:"fdap",externalMeetId:"legacy-nc-tight",course:"SCM"},retrievedAt:"2026-10-07T00:00:00Z",text,sourceUrl:"fixture://legacy-nc-tight.pdf"});
 assert.equal(r.length,1);assert.equal(r[0].status,"dns");assert.equal(r[0].timeMs,null);
});

test("legacy spaced dash suffix keeps official time",()=>{
 const text="Prova 32 Masculino, 50m Peito Mirim 6/4/25 - 10:56 Resultados 23. 2 / 1 Atleta Teste 700001 2015 Clube 1:15.22 - - 36 N/C 2 / 8 Vizinho 700002 2015 Clube - -";
 const r=parseResultList({identity:{externalId:"700001"},meet:{sourceCode:"fdap",externalMeetId:"legacy-spaced-dash",course:"SCM"},retrievedAt:"2026-10-07T00:00:00Z",text,sourceUrl:"fixture://legacy-spaced-dash.pdf"});
 assert.equal(r.length,1);assert.equal(r[0].resultDate,"2025-04-06");assert.equal(r[0].timeMs,75220);assert.equal(r[0].status,"valid");
});
