import test from "node:test";
import assert from "node:assert/strict";
import {scanDocuments} from "./document-scanner.mjs";
const meet={sourceCode:"swimsystem",externalMeetId:"meet-a",course:"SCM"};
const doc=(n,event,date,time,reg="900001")=>({externalMeetId:"meet-a",url:"fixture://"+n,text:"Prova "+n+"Masculino, "+event+"Mirim\n"+date+" - 9:00Resultados\n1.1 / 1Atleta Teste"+reg+"2015Clube"+time+"100%-100"});
test("generic scanner derives results from external identity",()=>{const r=scanDocuments({identity:{externalId:"900001"},meets:{"meet-a":meet},documents:[doc("1","50m Livre","01/01/2026","40.00"),doc("2","100m Livre","02/01/2026","1:30.00")],retrievedAt:"2026-10-07T00:00:00Z"});assert.equal(r.writes,0);assert.equal(r.rejected.length,0);assert.equal(r.accepted.length,2);});
test("different external identity receives no neighboring result",()=>{const r=scanDocuments({identity:{externalId:"900002"},meets:{"meet-a":meet},documents:[doc("1","50m Livre","01/01/2026","40.00")],retrievedAt:"2026-10-07T00:00:00Z"});assert.equal(r.writes,0);assert.equal(r.accepted.length,0);});
