// Database denial/validation and uncertain transport responses are distinct.
// Keep the original cause; never reconstruct a semantic error from SQLSTATE.
export class OfficialRpcError extends Error {
 constructor(rpcName,error,{status=0}={}){
  const message=String(error?.message||error?.code||'Missing database diagnostic');
  super(`${rpcName}: ${message}`,{cause:error});
  this.name='OfficialRpcError';this.rpcName=rpcName;
  this.code=String(error?.code||'');this.databaseMessage=message;
  this.details=error?.details??null;this.hint=error?.hint??null;
  this.httpStatus=Number(status)||0;
 }
}

const staleCodes=['STALE_WORKER_LEASE','REQUEST_CANCELLED_OR_TERMINAL'];
const deniedCodes=['REQUEST_ACCESS_REVOKED','ATHLETE_ACCESS_DENIED','TENANT_SCOPE_MISMATCH','CANDIDATE_SCOPE_MISMATCH','LEGACY_OFFICIAL_WRITER_FENCED'];
const identityCodes=['SOURCE_IDENTITY_NOT_VERIFIED','SOURCE_IDENTITY_MISSING_OR_AMBIGUOUS','SOURCE_IDENTITY_MISSING','SOURCE_IDENTITY_CONFLICT'];
const unsupportedCodes=['UNSUPPORTED_JOB_TYPE','UNSUPPORTED_OFFICIAL_SOURCE'];
const validationCodes=['INVALID_BATCH_SHAPE','BATCH_LIMIT','INVALID_OFFICIAL_MEET','JOB_MEET_SCOPE_MISMATCH','UNAPPROVED_CAPTURE_URL','CAPTURE_BYTES_MISMATCH','INVALID_CAPTURE_TIME','INVALID_EVENT_IDENTITY','CANDIDATE_EVIDENCE_MISSING','INCOMPLETE_SEEDING','INVALID_OFFICIAL_RESULT','INVALID_CANDIDATE_KIND','RECEIPT_PAYLOAD_MISMATCH'];
const matches=(error,codes)=>codes.some(code=>String(error?.databaseMessage||error?.message||'').includes(code));
export const staleWorkerError=error=>matches(error,staleCodes);

// Auditable allowlist: omit headers, tokens, payload, URL query and stack traces.
// Keep the full original cause in-process; bounded diagnostics go to the job.
export function rpcFailureDetails(error){
 const short=value=>value==null?null:new TextDecoder().decode(new TextEncoder().encode(String(value)).slice(0,512));
 if(!(error instanceof OfficialRpcError))return {kind:'runtime',name:short(error?.name),code:short(error?.code),message:short(error?.message)};
 return {kind:'database',rpc:short(error.rpcName),sqlstate:short(error.code),httpStatus:error.httpStatus,
  message:short(error.databaseMessage),details:short(error.details),hint:short(error.hint),
  cause:{name:short(error.cause?.name),code:short(error.cause?.code),message:short(error.cause?.message)}};
}

// Replay ONLY the exact same batch when a transport response is uncertain.
// Known DB responses (including deadlock/serialization errors) use job backoff.
export function uncertainCommitResponse(error){
 if(matches(error,[...staleCodes,...deniedCodes,...identityCodes,...unsupportedCodes,...validationCodes]))return false;
 if(error instanceof OfficialRpcError){
  if(error.code)return false;
  return error.httpStatus===0&&/fetch failed|failed to fetch|network|ECONNRESET|ETIMEDOUT|connection closed|abort|timeout/i.test(error.databaseMessage)
   ||[502,503,504].includes(error.httpStatus);
 }
 return error?.name==='AbortError'||error?.name==='TimeoutError'
  ||['ECONNRESET','ETIMEDOUT','EPIPE','UND_ERR_SOCKET'].includes(error?.code)
  ||error instanceof TypeError&&/fetch failed|failed to fetch|network/i.test(error.message);
}

export function classifyOfficialRpcFailure(error){
 if(matches(error,deniedCodes))return {code:'access_denied',retryable:false};
 if(matches(error,identityCodes))return {code:'identity_not_found',retryable:false};
 if(matches(error,unsupportedCodes))return {code:'unsupported_job_type',retryable:false};
 if(matches(error,validationCodes))return {code:'format_unrecognized',retryable:false};
 if(!(error instanceof OfficialRpcError))return uncertainCommitResponse(error)?{code:'database_error',retryable:true}:null;
 if(staleWorkerError(error))return {code:'access_denied',retryable:false};
 if(error.code==='42501'||[401,403].includes(error.httpStatus))return {code:'access_denied',retryable:false};
 if(['40001','40P01','55P03','57P03','53300','53400','PGRST000','PGRST001','PGRST002','PGRST003'].includes(error.code)||/^08[A-Z0-9]{3}$/.test(error.code))return {code:'database_error',retryable:true};
 if(!error.code&&(uncertainCommitResponse(error)||[408,429,500,502,503,504].includes(error.httpStatus)))return {code:'database_error',retryable:true};
 // Unrecognized SQL/SDK contract errors require investigation. In particular,
 // P0001, 42P10 and missing catalogue rows must not spin a retry loop.
 return {code:'database_error',retryable:false};
}
