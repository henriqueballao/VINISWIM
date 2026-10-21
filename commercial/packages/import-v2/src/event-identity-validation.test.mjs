import test from 'node:test';
import assert from 'node:assert/strict';
import {parseModernResultBook} from './swimsystem-modern-results.mjs';
import {scheduledInstant} from './swimsystem-seeded.mjs';
const header='Federação de Desportos Aquáticos do Paraná Colombo (PR), 18-20/09/2026, LCM (50m)';
const section=(n,date='18/09/2026',round='Final Direta',sex='Masculino')=>`Prova ${n} - ${round} ${sex}, 100m Livre Petiz 1 ${date} Resultados 1. 1/1 Atleta Teste 700001 2015 Clube 1:35.18 115 0.00 `;
const parse=(text,meet={})=>parseModernResultBook({text,identity:{externalId:'700001'},meet:{sourceCode:'swimsystem',externalMeetId:'synthetic-meet',...meet},sourceUrl:'fixture://synthetic',retrievedAt:'2026-10-11T12:00:00Z'});
test('two same-style races retain event number and round instead of collision',()=>{
 const r=parse(header+' '+section(1)+' '+section(2,'18/09/2026','Semifinal'));
 assert.equal(r.length,2);assert.deepEqual(r.map(x=>[x.externalEventId,x.round,x.sex]),[['1','Final Direta','masculino'],['2','Semifinal','masculino']]);
});
test('result dates outside meet or invalid calendar date cannot become official',()=>{
 for(const date of ['17/09/2026','21/09/2026','31/09/2026'])assert.equal(parse(header+' '+section(1,date)).length,0);
});
test('document dates or pool inconsistent with authoritative meet are rejected',()=>{
 assert.equal(parse(header+' '+section(1),{course:'SCM'}).length,0);
 assert.equal(parse(header+' '+section(1),{startDate:'2026-09-17'}).length,0);
});
test('schedules reject missing and ambiguous DST times rather than estimating',()=>{
 assert.throws(()=>scheduledInstant('2026-03-08','02:30','America/New_York'),/nonexistent/);
 assert.throws(()=>scheduledInstant('2026-11-01','01:30','America/New_York'),/ambiguous/);
 assert.throws(()=>scheduledInstant('2026-02-30','10:00','America/Sao_Paulo'),RangeError);
 assert.equal(scheduledInstant('2026-10-11','00:05','America/Sao_Paulo'),'2026-10-11T03:05:00.000Z');
});
