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
