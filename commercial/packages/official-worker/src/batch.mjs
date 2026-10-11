import {scanCurrentMeet} from '../../import-v2/src/current-meet-adapter.mjs';
import {verifiedCaptureEvidence} from '../../import-v2/src/official-document.mjs';

// Server-only boundary. No raw caller-provided candidates or hashes are accepted.
// Scope must come from the claimed job; the SQL transaction rechecks it.
export function buildOfficialBatch({job,athlete,identity,meet,documents,allowedHosts}){
 if(job.athlete_id!==athlete.id||!athlete.account_id||job.worker_version!=='official-v3'||!job.lease_token)throw new Error('Invalid claimed job scope');
 const scope={accountId:athlete.account_id,athleteId:athlete.id};
 const scan=scanCurrentMeet({meetId:meet.externalMeetId,identity,expectedMeet:meet,documents,allowedHosts,scope});
 if(scan.status==='partial'||scan.status==='blocked'||scan.status==='identity_not_found')return {accepted:false,scan};
 const captures=documents.map(d=>{
  const evidence=verifiedCaptureEvidence(d);if(!evidence)throw new Error('Unverified original capture');
  // The initial SQL candidate is deliberately narrower than the fetch boundary:
  // redirected PDF publications require explicit validated DB redirect support.
  if(evidence.url!==evidence.requestedUrl)throw new Error('Redirected publication requires validated persistence support');
  return {url:evidence.url,requestedUrl:evidence.requestedUrl,retrievedAt:evidence.retrievedAt,rawHash:evidence.rawHash,rawBase64:Buffer.from(evidence.bytes).toString('base64')};
 });
 return {accepted:true,scan,batch:{...scope,athleteExternalId:identity.externalId,meet,documents:captures,entries:scan.entries,results:scan.results}};
}

export async function commitOfficialBatch({rpc,job,prepared}){
 if(!prepared.accepted)throw new Error('Rejected scan cannot reach persistence');
 const result=await rpc('persist_official_meet_batch',{p_job_id:job.id,p_lease_token:job.lease_token,p_batch:prepared.batch});
 if(result?.error)throw new Error(`Official transaction failed: ${result.error.code||'database_error'}`);
 if(!result?.data?.outcome)throw new Error('Official transaction returned no auditable outcome');
 return result.data;
}
