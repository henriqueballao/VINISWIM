import test from "node:test";
import assert from "node:assert/strict";
import {parseResultList} from "./resultlist-parser.mjs";
import {dryRun} from "./dry-run.mjs";
const identity={externalId:"422692"};
const docs=[
["16","100","Livre","04/07/2025","1:52.82"],
["4","50","Borboleta","04/07/2025","59.68"],
["34","50","Costas","05/07/2025","56.73"],
["48","100","Medley","05/07/2025","2:08.44"],
["60","200","Livre","06/07/2025","4:11.29"]];
function candidates(){return docs.flatMap(([n,d,s,date,time])=>parseResultList({
 text:"Prova "+n+"Masculino, "+d+"m "+s+"Mirim\n"+date+" - 9:00Resultados\n29.2 / 5Vinicius Suzin Ballao"+"422"+"692"+"2015Curitibano"+time+"136%-62",
 identity,
 meet:{sourceCode:"swimsystem",externalMeetId:"39523",course:"SCM"},
 sourceUrl:"official://39523/ResultList_"+n+".pdf",
 retrievedAt:"2026-10-07T00:00:00Z"
}));}
test("documentary dry-run reconstructs exact 39523 set with zero writes",()=>{const r=dryRun(candidates());assert.equal(r.writes,0);assert.equal(r.rejected.length,0);assert.equal(r.accepted.length,5);assert.deepEqual(r.accepted.map(x=>[x.event,x.resultDate,x.timeMs]),[["100 Livre","2025-07-04",112820],["50 Borboleta","2025-07-04",59680],["50 Costas","2025-07-05",56730],["100 Medley","2025-07-05",128440],["200 Livre","2025-07-06",251290]]);});
test("same documentary input is idempotent",()=>{assert.deepEqual(dryRun(candidates()).accepted,dryRun(candidates()).accepted);});
