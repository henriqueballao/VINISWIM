import test from 'node:test';import assert from 'node:assert/strict';
import {resultForEntry} from './result-for-entry.ts';
const entry={athlete_id:'SYNTHETIC-A',meet_id:'SYNTHETIC-M',event_id:'100-Livre',source_id:'official',official_event_number:'16',official_round:'Final Direta',official_sex:'masculino',official_event_date:'2026-10-10',official_course:'LCM'};
const result={...entry,is_official:true,result_date:'2026-10-10',course:'LCM',time_ms:12345};
test('only the exact athlete, pool, date and official race can match seeded entry',()=>{
 assert.equal(resultForEntry(entry,[result]).result,result);
 for(const [k,v] of [['athlete_id','SYNTHETIC-B'],['course','SCM'],['result_date','2026-10-11'],['official_event_number','20'],['official_round','Semifinal'],['official_sex','feminino'],['source_id','other'],['is_official',false]])assert.equal(resultForEntry(entry,[{...result,[k]:v}]).status,'not_found');
});
test('multiple candidates stay ambiguous and are never arbitrarily compared',()=>assert.equal(resultForEntry(entry,[result,{...result,time_ms:12346}]).status,'ambiguous'));
test('legacy entries require explicit pool and a unique result',()=>{
 const legacy={athlete_id:entry.athlete_id,meet_id:entry.meet_id,event_id:entry.event_id};
 assert.equal(resultForEntry(legacy,[result]).status,'not_found');
 assert.equal(resultForEntry(legacy,[result],'LCM').status,'matched');
 assert.equal(resultForEntry(legacy,[result,{...result,official_event_number:'20'}],'LCM').status,'ambiguous');
});
