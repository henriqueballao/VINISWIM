import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyImportFailure,retryDecision} from './failure-states.mjs';

test('source authentication and access failures do not look like no publication',()=>{
 assert.deepEqual(classifyImportFailure({httpStatus:401}),{code:'authentication_required',retryable:false});
 assert.deepEqual(classifyImportFailure({httpStatus:403}),{code:'access_denied',retryable:false});
 assert.deepEqual(classifyImportFailure({httpStatus:403,message:'Cloudflare Turnstile'}),{code:'anti_bot_blocked',retryable:false});
});
test('missing PDF, missing identity and incompatible format remain distinct',()=>{
 assert.equal(classifyImportFailure({httpStatus:404}).code,'document_missing');
 assert.equal(classifyImportFailure({message:'source_identity_missing: 393259'}).code,'identity_not_found');
 assert.equal(classifyImportFailure({formatUnrecognized:true}).code,'format_unrecognized');
});
test('automatic retries use bounded exponential backoff and terminate',()=>{
 const f=classifyImportFailure({httpStatus:503});
 assert.deepEqual([1,2,3,4].map(a=>retryDecision(f,a).delayMs),[60000,120000,240000,480000]);
 assert.equal(retryDecision(f,5).status,'failed');
 assert.deepEqual(retryDecision(classifyImportFailure({httpStatus:401}),1),{status:'blocked',delayMs:null});
 assert.throws(()=>retryDecision(f,0),RangeError);
});
