import {authorizeWorkerRequest} from './authorization.mjs';
import {discoverOfficialMeet} from './discovery.mjs';
import {captureOfficialDocument,SourceAccessError} from '../../import-v2/src/official-document.mjs';
import {classifyImportFailure} from '../../import-v2/src/failure-states.mjs';
import {buildOfficialBatch,commitOfficialBatch} from './batch.mjs';
export const OFFICIAL_HOSTS=Object.freeze(['www.swimsystem.app','swimsystem.app','sportstimingbrasil-swimsystem.supabase.co']);
const stale=error=>/STALE_WORKER_LEASE|REQUEST_CANCELLED_OR_TERMINAL/.test(error?.message||'');
async function checkedRpc(rpc,name,args){const response=await rpc(name,args);if(response?.error)throw new Error(`${name}: ${response.error.message||response.error.code||'database_error'}`);if(response?.data===undefined||response?.data===null)throw new Error(`${name}: missing RPC response`);return response.data;}
export async function processClaimedOfficialJob({job,rpc,extractPdf,fetchImpl=fetch,now=()=>new Date()}){
 const context=()=>checkedRpc(rpc,'load_official_import_context',{p_job_id:job.id,p_lease_token:job.lease_token});
 try{
  const authorized=await context();
  const page=await captureOfficialDocument({url:authorized.officialUrl,allowedHosts:OFFICIAL_HOSTS,fetchImpl,now,maxBytes:4*1024*1024});
  const discovered=discoverOfficialMeet(page);
  if(!discovered.documents.length)throw new SourceAccessError('No supported official publication is listed yet',{parserMatched:false});
  if(discovered.documents.length>16)throw new SourceAccessError('Official document batch exceeds supported limit',{formatUnrecognized:true});
  const documents=[];
  for(const publication of discovered.documents){await context();documents.push(await captureOfficialDocument({url:publication.url,allowedHosts:OFFICIAL_HOSTS,fetchImpl,extractPdf,now}));}
  const prepared=buildOfficialBatch({job,athlete:authorized.athlete,identity:authorized.identity,meet:discovered.meet,documents,allowedHosts:OFFICIAL_HOSTS});
  if(!prepared.accepted){const code=prepared.scan.status==='identity_not_found'?'identity_not_found':prepared.scan.diagnostics[0]?.code||'format_unrecognized';throw new SourceAccessError(`Official scan rejected: ${code}`,{formatUnrecognized:true,scanCode:code});}
  let result;
  try{result=await commitOfficialBatch({rpc,job,prepared});}
  catch{ // A lost commit response is replayed with the exact same lease/payload.
   // SQL returns its durable receipt; an invalid batch still fails atomically.
   result=await commitOfficialBatch({rpc,job,prepared});
  }
  return {jobId:job.id,requestId:job.request_id,status:result.conflicts?'blocked':'completed',...result};
 }catch(error){
  if(stale(error))return {jobId:job.id,requestId:job.request_id,status:'cancelled_or_stale',code:'worker_lease_unavailable'};
  let failure=error.failure||classifyImportFailure({error});
  const message=String(error.message||error);
  if(/SOURCE_IDENTITY_MISSING_OR_AMBIGUOUS/.test(message))failure={code:'identity_not_found',retryable:false};
  else if(/UNSUPPORTED_JOB_TYPE|UNSUPPORTED_OFFICIAL_SOURCE/.test(message))failure={code:'unsupported_job_type',retryable:false};
  else if(/REQUEST_ACCESS_REVOKED/.test(message))failure={code:'access_denied',retryable:false};
  else if(['identity_not_found','conflicting_official_publications','inconsistent_meet_evidence'].includes(error.scanCode))failure={code:error.scanCode,retryable:false};
  // Failure to record failure is an operational error; never silently swallow it.
  try{const outcome=await checkedRpc(rpc,'finish_official_import_failure',{p_job_id:job.id,p_lease_token:job.lease_token,p_failure_code:failure.code,p_message:message,p_retryable:failure.retryable});return {jobId:job.id,requestId:job.request_id,...outcome};}
  catch(recordError){if(stale(recordError))return {jobId:job.id,requestId:job.request_id,status:'cancelled_or_stale',code:'worker_lease_unavailable'};throw new AggregateError([error,recordError],'Official worker could not record its failure');}
 }
}
export function officialWorkerHandler({rpc,extractPdf,serviceToken,fetchImpl=fetch,now}){
 return async request=>{
  const auth=authorizeWorkerRequest(request,serviceToken);
  if(!auth.allowed)return Response.json({outcome:auth.code},{status:auth.status});
  // The global worker consumes database claims only, never browser-supplied scope.
  if(Number(request.headers.get('content-length')||0)>1024)return Response.json({outcome:'request_too_large'},{status:413});
  try{
   const jobs=await checkedRpc(rpc,'claim_official_import_jobs',{p_limit:1}),outcomes=[];
   if(!Array.isArray(jobs))throw Error('Worker claim returned invalid contract');
   for(const job of jobs)outcomes.push(await processClaimedOfficialJob({job,rpc,extractPdf,fetchImpl,now}));
   return Response.json({outcome:jobs.length?'jobs_processed':'idle',outcomes});
  }catch(error){console.error(JSON.stringify({component:'official-worker',code:'unrecorded_worker_failure',message:String(error.message||error)}));return Response.json({outcome:'unrecorded_worker_failure'},{status:503});}
 };
}
