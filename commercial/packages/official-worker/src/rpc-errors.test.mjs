import test from 'node:test';import assert from 'node:assert/strict';
import {OfficialRpcError,classifyOfficialRpcFailure,rpcFailureDetails,staleWorkerError,uncertainCommitResponse} from './rpc-errors.mjs';
import {commitOfficialBatch} from './batch.mjs';
test('RPC error preserves SQLSTATE, semantic message, details, hint and original cause',async()=>{
 const cause={code:'P0001',message:'REQUEST_ACCESS_REVOKED',details:'SYNTHETIC DETAIL',hint:'SYNTHETIC HINT'};
 await assert.rejects(commitOfficialBatch({rpc:async()=>({error:cause,status:400}),job:{id:'synthetic',lease_token:'synthetic'},prepared:{accepted:true,batch:{}}}),error=>{
  assert.ok(error instanceof OfficialRpcError);assert.equal(error.code,'P0001');assert.equal(error.databaseMessage,cause.message);assert.equal(error.cause,cause);assert.equal(error.details,cause.details);assert.equal(error.hint,cause.hint);
  assert.deepEqual(classifyOfficialRpcFailure(error),{code:'access_denied',retryable:false});assert.equal(uncertainCommitResponse(error),false);assert.equal(rpcFailureDetails(error).sqlstate,'P0001');assert.equal(rpcFailureDetails(error).cause.message,cause.message);return true;
 });
});
test('deterministic SQL denials and validation errors never become immediate replays or automatic retries',()=>{
 for(const [message,code] of [['SOURCE_IDENTITY_NOT_VERIFIED','identity_not_found'],['SOURCE_IDENTITY_MISSING_OR_AMBIGUOUS','identity_not_found'],['UNSUPPORTED_OFFICIAL_SOURCE','unsupported_job_type'],['CANDIDATE_SCOPE_MISMATCH','access_denied'],['CAPTURE_BYTES_MISMATCH','format_unrecognized'],['RECEIPT_PAYLOAD_MISMATCH','format_unrecognized'],['EVENT_NOT_FOUND','database_error'],['UNEXPECTED_DATABASE_EXCEPTION','database_error']]){
  const error=new OfficialRpcError('synthetic',{code:'P0001',message});assert.deepEqual(classifyOfficialRpcFailure(error),{code,retryable:false});assert.equal(uncertainCommitResponse(error),false);
 }
 const error=new OfficialRpcError('synthetic',{code:'42P10',message:'no constraint matching ON CONFLICT'});assert.deepEqual(classifyOfficialRpcFailure(error),{code:'database_error',retryable:false});
 assert.equal(staleWorkerError(new OfficialRpcError('synthetic',{code:'P0001',message:'STALE_WORKER_LEASE'})),true);
});
test('known transient DB errors use job backoff, not immediate uncertain-response replay',()=>{
 for(const code of ['40001','40P01','55P03','57P03','53300','08006','PGRST003']){
  const error=new OfficialRpcError('synthetic',{code,message:'SYNTHETIC transient DB failure'});assert.deepEqual(classifyOfficialRpcFailure(error),{code:'database_error',retryable:true});assert.equal(uncertainCommitResponse(error),false);
 }
});
test('network uncertainty is explicit; an arbitrary programming error is not a lost commit response',()=>{
 for(const error of [new TypeError('fetch failed'),new DOMException('aborted','AbortError'),new OfficialRpcError('synthetic',{code:'',message:'TypeError: Failed to fetch'},{status:0}),new OfficialRpcError('synthetic',{code:'',message:'Gateway unavailable'},{status:503})]){
  assert.equal(uncertainCommitResponse(error),true);assert.deepEqual(classifyOfficialRpcFailure(error),{code:'database_error',retryable:true});
 }
 assert.equal(uncertainCommitResponse(new Error('bad programming contract')),false);
 const error=new OfficialRpcError('synthetic',{code:'INVALID_RPC_RESPONSE',message:'missing result'});assert.deepEqual(classifyOfficialRpcFailure(error),{code:'database_error',retryable:false});
});
test('a code-only SDK error retains its diagnostic and cannot become a retry loop',()=>{
 const error=new OfficialRpcError('synthetic',{code:'STALE_WORKER_LEASE'});
 assert.ok(error.message.includes('STALE_WORKER_LEASE'));assert.equal(staleWorkerError(error),true);assert.equal(uncertainCommitResponse(error),false);
 const unicode=new OfficialRpcError('synthetic',{code:'P0001',message:'🌊'.repeat(5000),details:'🌊'.repeat(5000),hint:'🌊'.repeat(5000)});
 assert.ok(new TextEncoder().encode(JSON.stringify(rpcFailureDetails(unicode))).length<8192);
 const denied=new OfficialRpcError('synthetic',{code:'',message:'REQUEST_ACCESS_REVOKED'},{status:503});
 assert.equal(uncertainCommitResponse(denied),false);assert.deepEqual(classifyOfficialRpcFailure(denied),{code:'access_denied',retryable:false});
});
