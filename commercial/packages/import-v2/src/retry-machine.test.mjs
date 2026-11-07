import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyImportFailure,retryState,retryDecision} from './failure-states.mjs';
for(const [input,code,status] of [
 [{httpStatus:401},'authentication_required','blocked'],
 [{httpStatus:403},'access_denied','blocked'],
 [{httpStatus:404},'document_missing','pending'],
 [{httpStatus:429},'http_error','pending'],
 [{httpStatus:503},'http_error','pending'],
 [{message:'TLS handshake failed'},'tls_error','pending'],
 [{message:'timeout'},'timeout','pending'],
 [{antiBot:true},'anti_bot_blocked','blocked'],
])test(`retry state preserves diagnosis: ${code} ${JSON.stringify(input)}`,()=>{
 const f=classifyImportFailure(input),r=retryState(f,1,{lastError:'original diagnostic'});
 assert.equal(r.status,status);assert.equal(r.failureCode,code);assert.equal(r.lastError,'original diagnostic');
 assert.equal(r.delayMs,status==='pending'?60000:null);
 assert.equal(retryState(f,5).status,status==='pending'?'failed':'blocked');
});
test('retry bounds reject invalid attempts and retain capped exponential backoff',()=>{
 const f=classifyImportFailure({httpStatus:503});
 for(const n of [0,-1,1.5,NaN])assert.throws(()=>retryState(f,n),RangeError);
 assert.equal(retryDecision(f,4,{baseDelayMs:1000000}).delayMs,3600000);
 assert.throws(()=>retryState(null),TypeError);
});
