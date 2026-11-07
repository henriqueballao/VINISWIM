// Tests original publications with the Edge-compatible JavaScript extractor.
// HTTP is replayed; this script never connects to Supabase or inserts records.
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {extractOfficialPdfJs,PDF_EXTRACTOR_VERSION} from '../commercial/packages/official-worker/src/pdf-js-extractor.mjs';
import {captureOfficialDocument} from '../commercial/packages/import-v2/src/official-document.mjs';
import {buildOfficialBatch} from '../commercial/packages/official-worker/src/batch.mjs';
const artifact=process.argv[2];if(!artifact)throw new Error('Original capture artifact required');
const manifest=JSON.parse(await fs.readFile('commercial/packages/import-v2/fixtures/official-20261011/provenance.json','utf8'));
const allowedHosts=['sportstimingbrasil-swimsystem.supabase.co'],documents=[],cpu=process.cpuUsage(),started=performance.now();
for(const meta of manifest.documents){
 const bytes=await fs.readFile(`${artifact}/${meta.file}`);assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.rawHash);
 documents.push(await captureOfficialDocument({url:meta.url,allowedHosts,fetchImpl:async()=>new Response(bytes,{headers:{'content-type':'application/pdf'}}),extractPdf:extractOfficialPdfJs,now:()=>new Date(meta.retrievedAt)}));
}
const job={id:'00000000-0000-4000-8000-000000000051',athlete_id:'00000000-0000-4000-8000-000000000011',worker_version:'official-v3',lease_token:'00000000-0000-4000-8000-000000000061'};
const athlete={id:job.athlete_id,account_id:'00000000-0000-4000-8000-000000000021'},meet={externalMeetId:manifest.meetId,name:'Torneio Regional da 1ª Região (Pré-Mirim/Petiz)',officialUrl:`https://www.swimsystem.app/meets/sw/${manifest.meetId}`,startDate:'2026-10-10',endDate:'2026-10-11',course:'LCM'};
for(const [id,count,times] of [['422692',4,[103910,43780]],['399680',5,[102710,33380]]]){
 const prepared=buildOfficialBatch({job,athlete,identity:{externalId:id},meet,documents,allowedHosts});
 assert.equal(prepared.accepted,true,JSON.stringify(prepared.scan.diagnostics));assert.equal(prepared.batch.entries.length,count);assert.deepEqual(prepared.batch.results.map(r=>r.timeMs),times);
}
const absent=buildOfficialBatch({job,athlete,identity:{externalId:'393259'},meet,documents,allowedHosts});assert.equal(absent.accepted,false);
const usage=process.cpuUsage(cpu);
console.log(JSON.stringify({mode:'original-pdf-javascript-replay-no-database',extractor:PDF_EXTRACTOR_VERSION,cpuMs:(usage.user+usage.system)/1000,wallMs:performance.now()-started,viniSeededEntries:4,lorenzoSeededEntries:5,officialResultsPerAthlete:2,andreIdentityAbsent:true,productionWrites:0}));
