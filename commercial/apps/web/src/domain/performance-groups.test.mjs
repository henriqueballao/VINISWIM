import assert from 'node:assert/strict'
import {test} from 'node:test'
import {confirmedBests,performanceKey} from './performance-groups.ts'

test('confirmed bests keep separate races and pool lengths and exclude manual and invalid results',()=>{
 const row={event_id:'50-free',course:'SCM',status:'valid',time_ms:32000,is_official:true}
 const rows=[row,{...row,time_ms:31000},{...row,course:'LCM',time_ms:34000},{...row,event_id:'50-back',time_ms:40000},{...row,is_official:false,time_ms:20000},{...row,status:'DSQ',time_ms:10000},{...row,course:'unknown',time_ms:1000},{...row,time_ms:NaN}]
 assert.deepEqual(confirmedBests(rows).map(x=>[x.event_id,x.course,x.time_ms]),[['50-free','SCM',31000],['50-free','LCM',34000],['50-back','SCM',40000]])
 assert.notEqual(performanceKey(row),performanceKey({...row,course:'LCM'}))
})
