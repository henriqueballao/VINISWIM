import test from "node:test";
import assert from "node:assert/strict";
import {parseProgressionDetails} from "./progression-parser.mjs";
import {validateResultCandidate} from "./contracts.mjs";

const text="\n\nVinicius Suzin Ballao,  2015 (10 Anos),  Masculino4\n100m LivreFinal Direta29.1:52.82622:11.61136%\n200m LivreFinal Direta19.4:11.29614:36.44121%\n50m CostasFinal Direta28.56.735957.52103%\n50m BorboletaFinal Direta20.59.6848NT-\n100m MedleyFinal Direta29.2:08.44562:15.79112%";

const base={text,identity:{externalId:"422692",canonicalName:"Vinicius Suzin Ballao",aliases:[]},meet:{sourceCode:"fdap",externalMeetId:"fixture-legacy",course:"SCM"},sourceUrl:"fixture://ProgressionDetails.pdf",retrievedAt:"2026-01-01T00:00:00Z"};

test("compact PDF rows are parsed without borrowing neighboring values",()=>{
 const r=parseProgressionDetails(base);
 assert.deepEqual(r.map(x=>[x.event,x.timeMs]),[["100 Livre",112820],["200 Livre",251290],["50 Costas",56730],["50 Borboleta",59680],["100 Medley",128440]]);
});

test("multi-day summary without event-date evidence is rejected by validator",()=>{
 const r=parseProgressionDetails(base);
 assert.equal(r.length,5);
 assert.equal(r.every(x=>!validateResultCandidate(x).accepted),true);
 assert.equal(r.every(x=>validateResultCandidate(x).errors.includes("missing:resultDate")),true);
});

test("same-meet official event dates make candidates valid",()=>{
 const eventDates={"100 livre":"2025-07-04","200 livre":"2025-07-04","50 costas":"2025-07-05","50 borboleta":"2025-07-05","100 medley":"2025-07-06"};
 const r=parseProgressionDetails({...base,eventDates});
 assert.equal(r.every(x=>validateResultCandidate(x).accepted),true);
});
