// Authorized public GET only. Original bytes are archived; no Supabase writes.
import {mkdir,writeFile} from 'node:fs/promises';
import {captureOfficialDocument,verifiedCaptureEvidence} from '../commercial/packages/import-v2/src/official-document.mjs';
import {discoverOfficialMeet} from '../commercial/packages/official-worker/src/discovery.mjs';
import {extractOfficialPdfJs,PDF_EXTRACTOR_VERSION} from '../commercial/packages/official-worker/src/pdf-js-extractor.mjs';
import {buildOfficialBatch} from '../commercial/packages/official-worker/src/batch.mjs';
const output='official-meet-captures';await mkdir(output,{recursive:true});
const allowedHosts=['www.swimsystem.app','swimsystem.app','sportstimingbrasil-swimsystem.supabase.co'],captures=[],scans=[];
for(const meetId of ['c8587533-2e44-4b08-991f-f827170c7344','9b002997-591e-4f74-8492-ef595b4705c0']){
 const prefix=meetId;
 try{
  const page=await captureOfficialDocument({url:`https://www.swimsystem.app/meets/sw/${meetId}`,allowedHosts,maxBytes:4*1024*1024});
  await save(page,`${prefix}-page.html`);const discovered=discoverOfficialMeet(page),documents=[];
  for(const [index,publication] of discovered.documents.entries()){
   try{
    const document=await captureOfficialDocument({url:publication.url,allowedHosts,extractPdf:extractOfficialPdfJs});
    await save(document,`${prefix}-document-${index}.pdf`);await writeFile(`${output}/${prefix}-document-${index}.txt`,document.text);documents.push(document);
   }catch(error){documents.push({url:publication.url,failure:error.failure||{code:'unknown'}});captures.push({url:publication.url,outcome:'blocked',failure:error.failure||{code:'unknown'},message:error.message});}
  }
  const job={id:'00000000-0000-4000-8000-000000000051',athlete_id:'00000000-0000-4000-8000-000000000011',worker_version:'official-v3',lease_token:'00000000-0000-4000-8000-000000000061'},athlete={id:job.athlete_id,account_id:'00000000-0000-4000-8000-000000000021'};
  for(const externalId of ['422692','399680','393259']){
   const prepared=buildOfficialBatch({job,athlete,identity:{externalId},meet:discovered.meet,documents,allowedHosts});
   scans.push({meet:discovered.meet,athleteExternalId:externalId,accepted:prepared.accepted,scan:prepared.scan,pageEvidence:discovered.pageEvidence,skipped:discovered.skipped});
  }
 }catch(error){captures.push({url:`https://www.swimsystem.app/meets/sw/${meetId}`,outcome:'blocked',failure:error.failure||{code:'unknown'},message:error.message});}
}
async function save(document,file){const evidence=verifiedCaptureEvidence(document);await writeFile(`${output}/${file}`,evidence.bytes);captures.push({file,url:evidence.url,requestedUrl:evidence.requestedUrl,redirectChain:evidence.redirectChain,rawHash:evidence.rawHash,retrievedAt:evidence.retrievedAt,bytes:evidence.bytes.length,outcome:'original_captured'});}
const report={mode:'live-public-readonly-no-database',extractor:PDF_EXTRACTOR_VERSION,productionWrites:0,captures,scans};await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({mode:report.mode,productionWrites:0,captures:captures.map(c=>({...c})),scans:scans.map(s=>({meetId:s.meet.externalMeetId,athleteExternalId:s.athleteExternalId,accepted:s.accepted,status:s.scan.status,entries:s.scan.entries.length,results:s.scan.results.length,diagnostics:s.scan.diagnostics}))},null,2));
if(captures.some(c=>c.outcome==='blocked'))process.exitCode=1;
