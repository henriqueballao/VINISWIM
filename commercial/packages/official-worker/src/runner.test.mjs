import test from 'node:test';import assert from 'node:assert/strict';
import {officialWorkerHandler,processClaimedOfficialJob} from './runner.mjs';
import {readFileSync} from 'node:fs';
const token='SYNTHETIC-WORKER-TOKEN-ONLY-32-CHARS',id='00000000-0000-4000-8000-000000000001';
const job={id,request_id:id,athlete_id:id,lease_token:id,worker_version:'official-v3'};
const context={athlete:{id,account_id:id},identity:{externalId:'700001'},officialUrl:`https://www.swimsystem.app/meets/sw/${id}`};
test('worker authorization precedes global claim and never consumes caller athlete scope',async()=>{let claims=0;const handler=officialWorkerHandler({serviceToken:token,rpc:async()=>{claims++;return {data:[]};}});const denied=await handler(new Request('https://worker.example',{method:'POST',body:JSON.stringify({athlete_id:id})}));assert.equal(denied.status,401);assert.equal(claims,0);const idle=await handler(new Request('https://worker.example',{method:'POST',headers:{authorization:'Bearer '+token},body:JSON.stringify({athlete_id:id})}));assert.equal((await idle.json()).outcome,'idle');assert.equal(claims,1);});
test('source 401 records a blocking diagnostic without attempting persistence',async()=>{const calls=[];const result=await processClaimedOfficialJob({job,rpc:async(name,args)=>{calls.push({name,args});return {data:name==='load_official_import_context'?context:{status:'blocked',failureCode:args.p_failure_code}};},fetchImpl:async()=>new Response('Official login required',{status:401})});assert.equal(result.status,'blocked');assert.equal(result.failureCode,'authentication_required');assert.deepEqual(calls.map(c=>c.name),['load_official_import_context','finish_official_import_failure']);assert.equal(calls[1].args.p_retryable,false);});
test('revoked lease stops source access and cannot finalize another worker',async()=>{let fetched=false;const answer=await processClaimedOfficialJob({job,rpc:async()=>({error:{message:'STALE_WORKER_LEASE'}}),fetchImpl:async()=>{fetched=true;}});assert.equal(answer.status,'cancelled_or_stale');assert.equal(fetched,false);});
test('failure persistence error propagates and never becomes completed',async()=>{await assert.rejects(processClaimedOfficialJob({job,rpc:async name=>name==='load_official_import_context'?{data:context}:{error:{message:'isolated database unavailable'}},fetchImpl:async()=>new Response('missing',{status:404})}),AggregateError);});

// Synthetic HTTP/RPC/extractor contracts. Captured text is parser input only;
// these mock PDF bytes never leave the test and do not prove official capture.
const resultText=readFileSync(new URL('../../import-v2/fixtures/official-20261011/results.txt',import.meta.url),'utf8');
const pdfUrl=`https://sportstimingbrasil-swimsystem.supabase.co/storage/v1/object/public/reports/meet-documents/${id}/00000000-0000-4000-8000-000000000002.pdf`;
const page=`<script type="application/ld+json">${JSON.stringify({'@type':'SportsEvent',name:'SYNTHETIC ONLY',url:context.officialUrl,startDate:'2026-10-10',endDate:'2026-10-11'})}</script><div>Piscina Longa · 50m</div><a href="${pdfUrl}">Resultados PDF</a>`;
async function commitScenario(commit){
 const calls=[],payloads=[];
 const answer=await processClaimedOfficialJob({job,extractPdf:async()=>resultText,
  fetchImpl:async url=>new Response(url===pdfUrl?'%PDF-SYNTHETIC-UNIT-ONLY':page,{headers:{'content-type':url===pdfUrl?'application/pdf':'text/html'}}),
  rpc:async(name,args)=>{
   calls.push({name,args});
   if(name==='load_official_import_context')return {data:{...context,identity:{externalId:'422692'}}};
   if(name==='persist_official_meet_batch'){payloads.push(args.p_batch);return commit(payloads.length,args);}
   if(name==='finish_official_import_failure')return {data:{status:args.p_retryable?'pending':'blocked',failureCode:args.p_failure_code}};
   throw Error('Unexpected synthetic RPC');
  }
 });
 return {answer,calls,payloads};
}
for(const [message,failureCode] of [['REQUEST_ACCESS_REVOKED','access_denied'],['SOURCE_IDENTITY_NOT_VERIFIED','identity_not_found'],['CAPTURE_BYTES_MISMATCH','format_unrecognized']]){
 test(`commit denial ${message} is retained, recorded and never immediately replayed`,async()=>{
  const result=await commitScenario(async()=>({error:{code:'P0001',message},status:400}));
  assert.equal(result.payloads.length,1);assert.equal(result.answer.status,'blocked');assert.equal(result.answer.failureCode,failureCode);
  const final=result.calls.at(-1);assert.equal(final.name,'finish_official_import_failure');assert.equal(final.args.p_retryable,false);assert.ok(final.args.p_message.includes(message));
  assert.equal(final.args.p_details.sqlstate,'P0001');assert.equal(final.args.p_details.cause.message,message);
 });
}
test('stale commit lease exits without replay or mutation of another worker',async()=>{
 const result=await commitScenario(async()=>({error:{code:'P0001',message:'STALE_WORKER_LEASE'}}));
 assert.equal(result.payloads.length,1);assert.equal(result.answer.status,'cancelled_or_stale');assert.equal(result.calls.filter(x=>x.name==='finish_official_import_failure').length,0);
});
test('serialization failure defers through explicit job backoff without immediate batch replay',async()=>{
 const result=await commitScenario(async()=>({error:{code:'40001',message:'could not serialize synthetic transaction'}}));
 assert.equal(result.payloads.length,1);assert.equal(result.answer.status,'pending');assert.equal(result.answer.failureCode,'database_error');assert.equal(result.calls.at(-1).args.p_retryable,true);
});
test('lost transport response replays identical payload once and accepts durable receipt',async()=>{
 const result=await commitScenario(async attempt=>{if(attempt===1)throw new TypeError('fetch failed');return {data:{outcome:'official_results_persisted',inserted:2,conflicts:0,receiptReplay:true}};});
 assert.equal(result.payloads.length,2);assert.equal(result.payloads[0],result.payloads[1]);assert.equal(result.answer.status,'completed');assert.equal(result.answer.receiptReplay,true);assert.equal(result.calls.filter(x=>x.name==='finish_official_import_failure').length,0);
});
test('uncertain response replay is bounded and then uses backoff',async()=>{
 const result=await commitScenario(async()=>{throw new TypeError('fetch failed');});
 assert.equal(result.payloads.length,2);assert.equal(result.answer.status,'pending');assert.equal(result.answer.failureCode,'database_error');assert.equal(result.calls.at(-1).args.p_retryable,true);
});

test('generic catalog job expands source links without PDF extraction or result writes',async()=>{
 const calls=[],payloads=[];let extracts=0;
 const catalogContext={athlete:{id,account_id:id},identity:{externalId:'987654'},scope:'meet_catalog',catalogUrl:'https://www.swimsystem.app/meets'};
 const html=`<a href="/meets/sw/${id}">SYNTHETIC</a>`;
 const result=await processClaimedOfficialJob({job,extractPdf:async()=>{extracts++;},fetchImpl:async()=>new Response(html,{headers:{'content-type':'text/html'}}),rpc:async(name,args)=>{
  calls.push(name);if(name==='load_official_import_context')return {data:catalogContext};
  if(name==='persist_official_catalog'){payloads.push(args.p_catalog);if(payloads.length===1)throw new TypeError('fetch failed');return {data:{outcome:'catalog_discovered',enqueued:1,resultsInserted:0,receiptReplay:true}};}
  throw Error('Unexpected catalog RPC '+name);
 }});
 assert.equal(result.status,'catalog_discovered');assert.equal(extracts,0);assert.equal(result.resultsInserted,0);
 assert.deepEqual(payloads[0],payloads[1]);assert.equal(payloads[0].meetUrls.length,1);
 assert.equal(calls.includes('persist_official_meet_batch'),false);
});
