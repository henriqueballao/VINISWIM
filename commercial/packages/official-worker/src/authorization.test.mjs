import test from 'node:test';import assert from 'node:assert/strict';
import {authorizeWorkerRequest} from './authorization.mjs';
const token='SYNTHETIC-WORKER-TOKEN-ONLY-32-CHARS';
test('global worker refuses browser, absent or misconfigured service credentials',()=>{
 for(const bearer of [null,'Bearer anon-key','Bearer user-jwt','Bearer '+token+'extra']){
  const headers=bearer?{authorization:bearer}:{};assert.equal(authorizeWorkerRequest(new Request('https://worker.example/run',{method:'POST',headers}),token).status,401);
 }
 assert.equal(authorizeWorkerRequest(new Request('https://worker.example/run',{method:'POST'}),'').status,503);
 assert.equal(authorizeWorkerRequest(new Request('https://worker.example/run'),token).status,405);
});
test('only configured service secret authorizes job consumption',()=>assert.deepEqual(authorizeWorkerRequest(new Request('https://worker.example/run',{method:'POST',headers:{authorization:'Bearer '+token}}),token),{allowed:true}));
