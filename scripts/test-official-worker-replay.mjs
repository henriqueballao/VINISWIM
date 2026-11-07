// Original official PDFs replayed through synthetic HTTP transport, never a
// live import or production write. Capture, extractor and batch boundary real.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {captureOfficialDocument} from '../commercial/packages/import-v2/src/official-document.mjs';
import {extractOfficialPdf} from '../commercial/packages/official-worker/src/pdf-extractor.mjs';
import {buildOfficialBatch,commitOfficialBatch} from '../commercial/packages/official-worker/src/batch.mjs';
const root='commercial/packages/import-v2/fixtures/official-20261011',artifact=process.argv[2];
if(!artifact)throw new Error('Original artifact directory required');
const manifest=JSON.parse(await fs.readFile(`${root}/provenance.json`,'utf8'));
const allowedHosts=['sportstimingbrasil-swimsystem.supabase.co'],documents=[];
for(const meta of manifest.documents){
 const raw=await fs.readFile(`${artifact}/${meta.file}`);assert.equal(createHash('sha256').update(raw).digest('hex'),meta.rawHash);
 documents.push(await captureOfficialDocument({url:meta.url,allowedHosts,fetchImpl:async()=>new Response(raw,{headers:{'content-type':'application/pdf'}}),extractPdf:extractOfficialPdf,now:()=>new Date(meta.retrievedAt)}));
}
const job={id:'00000000-0000-4000-8000-000000000051',athlete_id:'00000000-0000-4000-8000-000000000011',worker_version:'official-v3',lease_token:'00000000-0000-4000-8000-000000000061'};
const athlete={id:job.athlete_id,account_id:'00000000-0000-4000-8000-000000000021'};
const meet={externalMeetId:manifest.meetId,name:'Torneio Regional da 1ª Região (Pré-Mirim/Petiz)',officialUrl:`https://www.swimsystem.app/meets/sw/${manifest.meetId}`,startDate:'2026-10-10',endDate:'2026-10-11',course:'LCM'};
const prepared=buildOfficialBatch({job,athlete,identity:{externalId:'422692'},meet,documents,allowedHosts});
assert.equal(prepared.accepted,true);assert.equal(prepared.batch.entries.length,4);assert.equal(prepared.batch.results.length,2);
assert.deepEqual(prepared.batch.results.map(r=>r.timeMs),[103910,43780]);
for(const doc of prepared.batch.documents)assert.equal(createHash('sha256').update(Buffer.from(doc.rawBase64,'base64')).digest('hex'),doc.rawHash);
let calls=0;
await commitOfficialBatch({job,prepared,rpc:async(name,args)=>{calls++;assert.equal(name,'persist_official_meet_batch');assert.equal(args.p_job_id,job.id);assert.equal(args.p_lease_token,job.lease_token);assert.deepEqual(args.p_batch,prepared.batch);return {data:{outcome:'SYNTHETIC-TRANSPORT-ONLY'}};}});
assert.equal(calls,1);
await assert.rejects(commitOfficialBatch({job,prepared,rpc:async()=>({error:{code:'STALE_WORKER_LEASE'}})}),/STALE_WORKER_LEASE/);
const andre=buildOfficialBatch({job,athlete,identity:{externalId:'393259'},meet,documents,allowedHosts});assert.equal(andre.accepted,false);
await assert.rejects(commitOfficialBatch({job,prepared:andre,rpc:async()=>{throw new Error('Rejected data reached RPC');}}),/Rejected scan/);
console.log(JSON.stringify({mode:'original-pdf-replay-synthetic-http-and-rpc',originalByteHashesVerified:2,seededEntries:4,officialResults:2,missingIdentityRejected:true,productionWrites:0}));
