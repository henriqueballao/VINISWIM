import test from "node:test";import assert from "node:assert/strict";import {parseMastersParana} from "./masters-parana-parser.mjs";import {validateResultCandidate} from "./contracts.mjs";
const meet={sourceCode:"masters_parana",externalMeetId:"fixture-mp",startDate:"2026-05-10",course:"SCM"};
test("Masters Paraná parser anchors event, athlete and official row",()=>{
 const text="# 1ª PROVA - 50 METROS LIVRE MASCULINO\n1º 700001 Atleta Master 35.50 10,00 500\n2º 700002 Vizinho 34.00 9,00 510";
 const r=parseMastersParana({text,identity:{canonicalName:"Atleta Master",aliases:[]},meet,sourceUrl:"fixture://masters.pdf",retrievedAt:"2026-10-07T00:00:00Z"});
 assert.equal(r.length,1);assert.equal(r[0].event,"50 Livre");assert.equal(r[0].timeMs,35500);assert.equal(validateResultCandidate(r[0]).accepted,true);
});
test("Masters Paraná parser does not borrow neighboring time",()=>{
 const text="# 2ª PROVA - 100 METROS COSTAS MASCULINO\nN/C 700001 Atleta Master\n1º 700002 Vizinho 1:10.00 10,00 500";
 const r=parseMastersParana({text,identity:{canonicalName:"Atleta Master",aliases:[]},meet,sourceUrl:"fixture://masters.pdf",retrievedAt:"2026-10-07T00:00:00Z"});
 assert.equal(r.length,1);assert.equal(r[0].status,"dsq");assert.equal(r[0].timeMs,null);
});
