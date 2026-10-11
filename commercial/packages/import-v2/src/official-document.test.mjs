import test from 'node:test';
import assert from 'node:assert/strict';
import {captureOfficialDocument} from './official-document.mjs';
// Synthetic transport fixtures. They are NOT captured official publications.
const options={url:'https://official.example/results.pdf',allowedHosts:['official.example']};
test('captures original bytes, hash and capture date through authorized extractor',async()=>{
 const r=await captureOfficialDocument({...options,fetchImpl:async()=>new Response('%PDF-synthetic',{headers:{'content-type':'application/pdf'}}),extractPdf:async bytes=>{assert.equal(new TextDecoder().decode(bytes),'%PDF-synthetic');return 'SYNTHETIC TEST DOCUMENT';},now:()=>new Date('2026-10-11T12:00:00Z')});
 assert.equal(r.retrievedAt,'2026-10-11T12:00:00.000Z');assert.match(r.rawHash,/^[a-f0-9]{64}$/);assert.equal(r.url,options.url);
});
test('authentication, access denied, missing PDF and challenge stop ingestion',async()=>{
 for(const [status,code] of [[401,'authentication_required'],[403,'access_denied'],[404,'document_missing']])await assert.rejects(captureOfficialDocument({...options,fetchImpl:async()=>new Response('error',{status})}),e=>e.failure.code===code);
 await assert.rejects(captureOfficialDocument({...options,fetchImpl:async()=>new Response('<div class="cf-turnstile">',{headers:{'content-type':'text/html'}})}),e=>e.failure.code==='anti_bot_blocked');
 await assert.rejects(captureOfficialDocument({...options,fetchImpl:async()=>new Response('Object not found',{headers:{'content-type':'text/plain'}})}),e=>e.failure.code==='document_missing');
});
test('redirects cannot escape the configured official hosts',async()=>{
 let calls=0;await assert.rejects(captureOfficialDocument({...options,fetchImpl:async()=>{calls++;return new Response(null,{status:302,headers:{location:'https://other.example/secret'}});}}),e=>e.failure.code==='access_denied');assert.equal(calls,1);
});
test('format and byte limits reject documents before extraction',async()=>{
 await assert.rejects(captureOfficialDocument({...options,fetchImpl:async()=>new Response('binary',{headers:{'content-type':'application/octet-stream'}})}),e=>e.failure.code==='format_unrecognized');
 await assert.rejects(captureOfficialDocument({...options,maxBytes:3,fetchImpl:async()=>new Response('too long',{headers:{'content-type':'text/plain'}})}),e=>e.failure.code==='format_unrecognized');
});
