import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {scanCurrentMeet,officialResultKey} from './current-meet-adapter.mjs';
const root=new URL('../fixtures/official-20261011/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('provenance.json',root)));
const documents=manifest.documents.map(d=>({...d,text:fs.readFileSync(new URL(d.fixture,root),'utf8')}));
const input={meetId:manifest.meetId,identity:{externalId:'422692'},documents,allowedHosts:['sportstimingbrasil-swimsystem.supabase.co']};
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
test('contradicting official publications are held for reconciliation',()=>{
 const original=documents[1],changed={...original,text:original.text.replace('1:43.91','1:43.92')};
 const result=scanCurrentMeet({...input,documents:[original,changed,original]});assert.equal(result.status,'partial');assert.equal(result.results.some(r=>r.event==='100 Costas'),false);assert.equal(result.diagnostics[0].code,'conflicting_official_publications');
});
