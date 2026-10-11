import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {captureOfficialDocument,verifiedCaptureEvidence} from './official-document.mjs';
import {scanCurrentMeet,officialResultKey} from './current-meet-adapter.mjs';
const root=new URL('../fixtures/official-20261011/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('provenance.json',root)));
// Synthetic HTTP replay of official text excerpts: tests transport verification,
// not original PDF hashes or a live official import.
async function replay(meta,text=fs.readFileSync(new URL(meta.fixture,root),'utf8')){
 return captureOfficialDocument({url:meta.url,allowedHosts:['sportstimingbrasil-swimsystem.supabase.co'],fetchImpl:async()=>new Response(text,{headers:{'content-type':'text/plain'}}),now:()=>new Date(meta.retrievedAt)});
}
const documents=await Promise.all(manifest.documents.map(d=>replay(d)));
const input={meetId:manifest.meetId,identity:{externalId:'422692'},scope:{accountId:'tenant-one',athleteId:'athlete-one'},expectedMeet:{startDate:'2026-10-10',endDate:'2026-10-11',course:'LCM'},documents,allowedHosts:['sportstimingbrasil-swimsystem.supabase.co']};
test('adapter separates captured seeds from completed official swims and never writes',()=>{
 const scan=scanCurrentMeet(input);assert.equal(scan.status,'results_parsed');assert.equal(scan.writes,0);assert.equal(scan.entries.length,4);assert.equal(scan.results.length,2);
 assert.equal(scan.entries.find(e=>e.event==='100 Costas').seedTimeMs,106090);assert.equal(scan.results.find(e=>e.event==='100 Costas').timeMs,103910);
 assert.equal(scanCurrentMeet({...input,documents:[documents[0]]}).status,'no_result_publication');
});
test('duplicate documents are idempotent and corrected times use the same identity key',()=>{
 const one=scanCurrentMeet(input),two=scanCurrentMeet({...input,documents:[...documents,...documents]});assert.deepEqual(one,two);
 assert.equal(officialResultKey(one.results[0]),officialResultKey({...one.results[0],timeMs:one.results[0].timeMs+10}));
 assert.notEqual(officialResultKey(one.results[0]),officialResultKey({...one.results[0],athleteExternalId:'399680'}));
});
test('missing provenance and source failures cannot be reported as successful imports',()=>{
 const unverified=scanCurrentMeet({...input,documents:documents.map(d=>({...d,rawHash:null}))});assert.equal(unverified.status,'partial');assert.equal(unverified.results.length,0);
 const denied=scanCurrentMeet({...input,documents:[{url:documents[0].url,failure:{code:'authentication_required'}}]});assert.equal(denied.status,'partial');assert.equal(denied.diagnostics[0].code,'authentication_required');
 assert.equal(scanCurrentMeet({...input,identity:{externalId:'393259'}}).status,'identity_not_found');
});
test('contradicting official publications are held for reconciliation',async()=>{
 const original=documents[1],changed=await replay(manifest.documents[1],original.text.replace('1:43.91','1:43.92'));
 const result=scanCurrentMeet({...input,documents:[original,changed,original]});assert.equal(result.status,'partial');assert.equal(result.results.some(r=>r.event==='100 Costas'),false);assert.equal(result.diagnostics[0].code,'conflicting_official_publications');
});

test('result identity distinguishes tenant, event number, round and sex without time',()=>{
 const r=scanCurrentMeet(input).results[0];assert.ok(r);
 for(const [k,v] of [['accountId','tenant-two'],['athleteId','athlete-two'],['externalEventId','999'],['round','Semifinal'],['sex','feminino']])assert.notEqual(officialResultKey(r),officialResultKey({...r,[k]:v}));
 assert.throws(()=>officialResultKey({...r,externalEventId:null}),TypeError);
});
test('arbitrary valid-looking hash and timestamp are not verified capture',()=>{
 const copied=documents.map(d=>({...d}));
 const r=scanCurrentMeet({...input,documents:copied});assert.equal(r.results.length,0);assert.equal(r.diagnostics[0].code,'missing_capture_provenance');
 assert.equal(verifiedCaptureEvidence(copied[0]),null);
 const originalHash=verifiedCaptureEvidence(documents[0]).rawHash;
 documents[0].bytes.fill(0);assert.equal(verifiedCaptureEvidence(documents[0]).rawHash,originalHash);
 assert.notEqual(verifiedCaptureEvidence(documents[0]).bytes[0],0);
});
test('tenant and meet binding are mandatory',()=>{
 assert.equal(scanCurrentMeet({...input,scope:null}).status,'blocked');
 const mismatch=scanCurrentMeet({...input,expectedMeet:{...input.expectedMeet,course:'SCM'}});
 assert.equal(mismatch.entries.length,0);assert.equal(mismatch.results.length,0);
});
