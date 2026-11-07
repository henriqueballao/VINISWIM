// Synthetic local CI database only. Parallel sessions exercise actual locks.
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const args=['-h','localhost','-p','5432','-U','postgres','-d','viniswim_isolated_test','-v','ON_ERROR_STOP=1','-At'];
function query(sql){return new Promise((resolve,reject)=>{
 const child=spawn('psql',[...args,'-c',sql],{stdio:['ignore','pipe','pipe']});let out='',err='';
 child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);child.on('error',reject);child.on('close',code=>resolve({code,out,err}));
});}
async function checked(sql){const r=await query(sql);assert.equal(r.code,0,r.err);return r.out.trim();}
async function waitFor(sql){const deadline=Date.now()+5000;while(Date.now()<deadline){if(await checked(sql)==='t')return;await new Promise(r=>setTimeout(r,25));}throw new Error('Expected concurrent lock state was not observed');}
assert.equal(await checked('SELECT current_database()'),'viniswim_isolated_test');
const athlete='00000000-0000-4000-8000-000000000011',user='00000000-0000-4000-8000-000000000031',source='00000000-0000-4000-8000-000000000001';
async function job(n){
 const id=`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`,request=`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`,token=`30000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 await checked(`INSERT INTO refresh_requests(id,athlete_id,requested_by) VALUES('${request}','${athlete}','${user}'); INSERT INTO import_v2_jobs(id,request_id,athlete_id,source_id,worker_version,status,lease_token,lease_expires_at,job_type,cursor) VALUES('${id}','${request}','${athlete}','${source}','official-v3','running','${token}',now()+interval '2 minutes','current_meet','{"scope":"targeted_meet","external_meet_id":"aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa","official_url":"https://www.swimsystem.app/meets/sw/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa"}');`);
 return {id,request,token};
}
const commit=(j,event)=>`SELECT persist_official_meet_batch('${j.id}','${j.token}',jsonb_set(payload,'{results,0,externalEventId}','"${event}"')) FROM isolated_test_payload;`;
const cancel=j=>`SELECT set_config('request.jwt.claim.sub','${user}',true); SELECT cancel_result_refresh_request('${j.request}');`;
const asleep=name=>`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='${name}' AND wait_event='PgSleep')`;
const waiting=name=>`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='${name}' AND wait_event_type='Lock')`;
let count=Number(await checked('SELECT count(*) FROM results'));
const one=await job(101),two=await job(102);
const first=query(`SET application_name='viniswim-synthetic-first';BEGIN;${commit(one,777)}SELECT pg_sleep(2);COMMIT;`);
await waitFor(asleep('viniswim-synthetic-first'));
const second=query(`SET application_name='viniswim-synthetic-second';${commit(two,777)}`);
await waitFor(waiting('viniswim-synthetic-second'));
for(const r of await Promise.all([first,second]))assert.equal(r.code,0,r.err);
assert.equal(Number(await checked('SELECT count(*) FROM results')),count+1);
assert.equal(Number(await checked(`SELECT sum(records_inserted) FROM import_v2_jobs WHERE id IN('${one.id}','${two.id}')`)),1);
assert.equal(Number(await checked(`SELECT sum(records_duplicated) FROM import_v2_jobs WHERE id IN('${one.id}','${two.id}')`)),1);
count++;
const before=await job(103);
const canceller=query(`SET application_name='viniswim-synthetic-cancel';BEGIN;SELECT id FROM refresh_requests WHERE id='${before.request}' FOR UPDATE;SELECT pg_sleep(2);${cancel(before)}COMMIT;`);
await waitFor(asleep('viniswim-synthetic-cancel'));
const denied=query(`SET application_name='viniswim-synthetic-denied';${commit(before,778)}`);
await waitFor(waiting('viniswim-synthetic-denied'));
assert.equal((await canceller).code,0);const rejected=await denied;assert.notEqual(rejected.code,0);assert.match(rejected.err,/STALE_WORKER_LEASE/);
assert.equal(Number(await checked('SELECT count(*) FROM results')),count);
const after=await job(104);
const writer=query(`SET application_name='viniswim-synthetic-writer';BEGIN;${commit(after,779)}SELECT pg_sleep(2);COMMIT;`);
await waitFor(asleep('viniswim-synthetic-writer'));
const later=query(`SET application_name='viniswim-synthetic-later';${cancel(after)}`);
await waitFor(waiting('viniswim-synthetic-later'));
for(const r of await Promise.all([writer,later]))assert.equal(r.code,0,r.err);
assert.equal(Number(await checked('SELECT count(*) FROM results')),count+1);
console.log(JSON.stringify({mode:'synthetic-isolated-postgres',concurrentDeduplication:'passed',cancelBeforeCommit:'passed',cancelAfterCommitPreservesResults:'passed',lockWaitsObserved:true,productionWrites:0}));
