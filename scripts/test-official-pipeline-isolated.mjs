// Real original publications -> two independent byte extractors -> candidate
// normalization -> real PostgreSQL transaction. DATABASE IS SYNTHETIC CI ONLY.
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {captureOfficialDocument} from '../commercial/packages/import-v2/src/official-document.mjs';
import {discoverOfficialMeet} from '../commercial/packages/official-worker/src/discovery.mjs';
import {extractOfficialPdfJs} from '../commercial/packages/official-worker/src/pdf-js-extractor.mjs';
import {extractOfficialPdf as extractOfficialPdfLocal} from '../commercial/packages/official-worker/src/pdf-extractor.mjs';
import {buildOfficialBatch,commitOfficialBatch} from '../commercial/packages/official-worker/src/batch.mjs';
const root=process.argv[2];if(!root)throw Error('Archived originals required');
const sql=value=>`'${String(value).replaceAll("'","''")}'`;
function query(statement){return execFileSync('psql',['-h','127.0.0.1','-U','postgres','-d','viniswim_isolated_test','-v','ON_ERROR_STOP=1','-qAt'],{input:statement,encoding:'utf8',maxBuffer:32*1024*1024}).trim();}
assert.equal(query('SELECT current_database()'),'viniswim_isolated_test');
const archived=JSON.parse(await fs.readFile(`${root}/report.json`,'utf8')),allowedHosts=['www.swimsystem.app','sportstimingbrasil-swimsystem.supabase.co'];
const account='00000000-0000-4000-8000-000000000701',user='00000000-0000-4000-8000-000000000702',source='00000000-0000-4000-8000-000000000001';
query(`INSERT INTO account_members VALUES(${sql(account)},${sql(user)},'active');`);
const expected={422692:[4,5,9],399680:[5,6,11],393259:[0,6,6]},proof=[];
for(const [externalId,[currentCount,historicalCount,total]] of Object.entries(expected)){
 const athlete={id:`00000000-0000-4000-8000-000000${externalId.padStart(6,'0')}`,account_id:account};
 query(`INSERT INTO athletes VALUES(${sql(athlete.id)},${sql(account)});INSERT INTO athlete_identifiers VALUES(${sql(athlete.id)},${sql(source)},${sql(externalId)},true,true);`);
 for(const meetId of ['c8587533-2e44-4b08-991f-f827170c7344','9b002997-591e-4f74-8492-ef595b4705c0']){
  async function capture(meta,extractPdf){const bytes=await fs.readFile(`${root}/${meta.file}`);assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.rawHash);return captureOfficialDocument({url:meta.url,allowedHosts,fetchImpl:async()=>new Response(bytes,{headers:{'content-type':meta.file.endsWith('.html')?'text/html':'application/pdf'}}),extractPdf,now:()=>new Date(meta.retrievedAt)});}
  const pageMeta=archived.captures.find(c=>c.file===`${meetId}-page.html`),page=await capture(pageMeta),discovered=discoverOfficialMeet(page),js=[],poppler=[];
  for(const doc of discovered.documents){const meta=archived.captures.find(c=>c.url===doc.url&&c.outcome==='original_captured');assert.ok(meta,'Missing original publication');js.push(await capture(meta,extractOfficialPdfJs));poppler.push(await capture(meta,extractOfficialPdfLocal));}
  const identity={externalId};
  const request=JSON.parse(query(`SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub',${sql(user)},false);SELECT request_official_meet_import(${sql(athlete.id)},${sql(discovered.meet.officialUrl)});`).split('\n').at(-1));
  const job=JSON.parse(query(`SET ROLE service_role;SELECT row_to_json(j) FROM claim_official_import_jobs(1) j;`).split('\n').at(-1));assert.equal(job.id,request.job_id);
  const prepared=buildOfficialBatch({job,athlete,identity,meet:discovered.meet,documents:js,allowedHosts});
  const oracle=buildOfficialBatch({job,athlete,identity,meet:discovered.meet,documents:poppler,allowedHosts});
  const signature=r=>[r.externalEventId,r.round,r.sex,r.resultDate,r.course,r.event,r.timeMs,r.status];
  assert.equal(prepared.accepted,oracle.accepted);assert.deepEqual(prepared.scan.results.map(signature),oracle.scan.results.map(signature),'Independent extractors disagree on official swims');
  if(!prepared.accepted){assert.equal(externalId,'393259');assert.equal(meetId,'c8587533-2e44-4b08-991f-f827170c7344');assert.equal(prepared.scan.status,'identity_not_found');query(`SET ROLE service_role;SELECT finish_official_import_failure(${sql(job.id)},${sql(job.lease_token)},'identity_not_found','Exact registration absent from published October documents',false);`);continue;}
  for(const label of new Set([...prepared.batch.entries,...prepared.batch.results].map(r=>r.event)))query(`INSERT INTO events(id,label,active) SELECT gen_random_uuid(),${sql(label)},true WHERE NOT EXISTS(SELECT 1 FROM events WHERE label=${sql(label)});`);
  const rpc=async(name,args)=>{assert.equal(name,'persist_official_meet_batch');return {data:JSON.parse(query(`SET ROLE service_role;SELECT persist_official_meet_batch(${sql(args.p_job_id)},${sql(args.p_lease_token)},${sql(JSON.stringify(args.p_batch))}::jsonb);`))};};
  const first=await commitOfficialBatch({rpc,job,prepared});assert.equal(first.inserted,meetId.startsWith('c858')?currentCount:historicalCount);
  const receipt=await commitOfficialBatch({rpc,job,prepared});assert.equal(receipt.receiptReplay,true);
  const again=JSON.parse(query(`SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub',${sql(user)},false);SELECT request_official_meet_import(${sql(athlete.id)},${sql(discovered.meet.officialUrl)});`).split('\n').at(-1));
  const secondJob=JSON.parse(query(`SET ROLE service_role;SELECT row_to_json(j) FROM claim_official_import_jobs(1) j;`).split('\n').at(-1));assert.equal(secondJob.id,again.job_id);
  const second=await commitOfficialBatch({rpc,job:secondJob,prepared});assert.equal(second.inserted,0);assert.equal(second.duplicated,first.inserted);assert.equal(second.entriesUpdated,0);
  const persisted=JSON.parse(query(`SELECT json_agg(json_build_array(r.official_event_number,r.official_round,r.official_sex,r.result_date,r.course,e.label,r.time_ms,r.status) ORDER BY r.official_event_number::integer) FROM results r JOIN events e ON e.id=r.event_id JOIN meets m ON m.id=r.meet_id WHERE r.athlete_id=${sql(athlete.id)} AND m.external_id=${sql(meetId)};`));
  assert.deepEqual(persisted,prepared.scan.results.map(signature).sort((a,b)=>Number(a[0])-Number(b[0])));
  proof.push({externalId,meetId,first,second,receiptReplay:true,independentExtractorsAgree:true,persistedMatchesOriginal:true});
 }
 assert.equal(Number(query(`SELECT count(*) FROM results WHERE athlete_id=${sql(athlete.id)}`)),total);
}
console.log(JSON.stringify({mode:'official-originals-to-isolated-postgres-not-production',proof,productionWrites:0}));
