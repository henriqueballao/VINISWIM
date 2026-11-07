// Adversarial contract against the implementation reviewed at 5775834.
// Synthetic RPC responses only: no network, Auth session or database writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {commitOfficialBatch} from '../../../../commercial/packages/official-worker/src/batch.mjs';

for(const message of ['REQUEST_ACCESS_REVOKED','STALE_WORKER_LEASE','SOURCE_IDENTITY_NOT_VERIFIED']){
 test(`transaction RPC must retain ${message} for worker classification`,async()=>{
  await assert.rejects(commitOfficialBatch({
   job:{id:'SYNTHETIC-ONLY',lease_token:'SYNTHETIC-ONLY'},
   prepared:{accepted:true,batch:{}},
   rpc:async()=>({error:{code:'P0001',message}})
  }),error=>{
   assert.ok(error.message.includes(message),`Expected semantic diagnostic ${message}; received ${error.message}`);
   return true;
  });
 });
}
