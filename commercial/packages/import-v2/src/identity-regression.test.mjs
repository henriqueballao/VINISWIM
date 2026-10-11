import test from 'node:test';
import assert from 'node:assert/strict';
import {parseResultList} from './resultlist-parser.mjs';
import {parseMeetEvidence} from './swimsystem-current.mjs';
// All rows below are synthetic and must never be persisted in production.
const base={identity:{externalId:'700001'},meet:{sourceCode:'fdap',externalMeetId:'synthetic',course:'SCM'},sourceUrl:'fixture://synthetic.pdf',retrievedAt:'2026-10-11T12:00:00Z'};
const header='Prova 16 Masculino, 100m Livre\n10/10/2026 - 16:50 Resultados\n';
test('registration prefix cannot import a different athlete',()=>{
 for(const id of ['7000010','70000199'])assert.equal(parseResultList({...base,text:header+`1. 1/5 Other Athlete ${id} 2015 Club 1:12.82 100% - 62`}).length,0);
});
test('exact registration still works with compact PDF birth year',()=>{
 const rows=parseResultList({...base,text:header+'1.1/5Synthetic Athlete7000012015Club1:12.82100%-62'});
 assert.equal(rows.length,1);assert.equal(rows[0].athleteExternalId,'700001');assert.equal(rows[0].timeMs,72820);
});
test('conflicting pool length and impossible dates cannot become official evidence',()=>{
 for(const header of ['City (PR), 10/10/2026, SCM (50m)','City (PR), 31/02/2026, SCM (25m)','City (PR), 11-10/10/2026, LCM (50m)'])assert.equal(parseMeetEvidence(header).accepted,false);
});
