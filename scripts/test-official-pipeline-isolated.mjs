// Real original publications -> two independent byte extractors -> candidate
// normalization -> real PostgreSQL transaction. DATABASE IS SYNTHETIC CI ONLY.
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {captureOfficialDocument} from '../commercial/packages/import-v2/src/official-document.mjs';
import {discoverOfficialMeet} from '../commercial/packages/official-worker/src/discovery.mjs';
import {extractOfficialPdfJs} from '../commercial/packages/official-worker/src/pdf-js-extractor.mjs';
import {extractOfficialPdf as extractOfficialPdfLocal} from '../commercial/packages/official-worker/src/pdf-extractor.mjs';
import {processClaimedOfficialJob} from '../commercial/packages/official-worker/src/runner.mjs';
import {buildOfficialBatch,commitOfficialBatch} from '../commercial/packages/official-worker/src/batch.mjs';
const root=process.argv[2];if(!root)throw Error('Archived originals required');
const sql=value=>`'${String(value).replaceAll("'","''")}'`;
function query(statement){return execFileSync('psql',['-h','127.0.0.1','-U','postgres','-d','viniswim_isolated_test','-v','ON_ERROR_STOP=1','-qAt'],{input:statement,encoding:'utf8',maxBuffer:32*1024*1024}).trim();}
assert.equal(query('SELECT current_database()'),'viniswim_isolated_test');
const archived=JSON.parse(await fs.readFile(`${root}/report.json`,'utf8')),allowedHosts=['www.swimsystem.app','sportstimingbrasil-swimsystem.supabase.co'];
const account='00000000-0000-4000-8000-000000000701',user='00000000-0000-4000-8000-000000000702',source='00000000-0000-4000-8000-000000000001';
query(`INSERT INTO accounts(id) VALUES(${sql(account)});INSERT INTO auth.users(id) VALUES(${sql(user)});INSERT INTO account_members(account_id,user_id,status,role) VALUES(${sql(account)},${sql(user)},'active','owner');`);
const {gunzipSync}=await import('node:zlib');
const catalogOriginal=gunzipSync(Buffer.from((await fs.readFile('commercial/packages/official-worker/fixtures/catalog-20261012/calendar.html.gz.base64','utf8')).trim(),'base64'));
const catalogProvenance=JSON.parse(await fs.readFile('commercial/packages/official-worker/fixtures/catalog-20261012/provenance.json','utf8'));
assert.equal(createHash('sha256').update(catalogOriginal).digest('hex'),catalogProvenance.rawHash);
const expected={422692:[4,5,9],399680:[5,6,11],393259:[0,6,6]},proof=[];
for(const [externalId,[currentCount,historicalCount,total]] of Object.entries(expected)){
 const athlete={id:`00000000-0000-4000-8000-000000${externalId.padStart(6,'0')}`,account_id:account};
 query(`INSERT INTO athletes(id,account_id,full_name) VALUES(${sql(athlete.id)},${sql(account)},'SYNTHETIC ACCOUNT TEST');INSERT INTO athlete_identifiers(athlete_id,source_id,external_id,active,verified,status) VALUES(${sql(athlete.id)},${sql(source)},${sql(externalId)},true,true,'verified');`);
 for(const meetId of ['c8587533-2e44-4b08-991f-f827170c7344','9b002997-591e-4f74-8492-ef595b4705c0']){
  async function capture(meta,extractPdf){const bytes=await fs.readFile(`${root}/${meta.file}`);assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.rawHash);return captureOfficialDocument({url:meta.url,allowedHosts,fetchImpl:async()=>new Response(bytes,{headers:{'content-type':meta.file.endsWith('.html')?'text/html':'application/pdf'}}),extractPdf,now:()=>new Date(meta.retrievedAt)});}
  const pageMeta=archived.captures.find(c=>c.file===`${meetId}-page.html`),page=await capture(pageMeta),discovered=discoverOfficialMeet(page),js=[],poppler=[];
  for(const doc of discovered.documents){const meta=archived.captures.find(c=>c.url===doc.url&&c.outcome==='original_captured');assert.ok(meta,'Missing original publication');js.push(await capture(meta,extractOfficialPdfJs));poppler.push(await capture(meta,extractOfficialPdfLocal));}
  const identity={externalId};
  const request=JSON.parse(query(`SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub',${sql(user)},false);SELECT request_official_catalog_import(${sql(athlete.id)});`).split('\n').at(-1));
  query(`UPDATE import_v2_jobs SET priority=-100 WHERE id=${sql(request.job_id)};`);
  const catalogJob=JSON.parse(query(`SET ROLE service_role;SELECT row_to_json(j) FROM claim_official_import_jobs(1) j;`).split('\n').at(-1));assert.equal(catalogJob.id,request.job_id);
  const catalogRpc=async(name,args)=>{
   if(name==='load_official_import_context')return {data:JSON.parse(query(`SET ROLE service_role;SELECT load_official_import_context(${sql(args.p_job_id)},${sql(args.p_lease_token)});`))};
   if(name==='persist_official_catalog')return {data:JSON.parse(query(`SET ROLE service_role;SELECT persist_official_catalog(${sql(args.p_job_id)},${sql(args.p_lease_token)},${sql(JSON.stringify(args.p_catalog))}::jsonb);`))};
   throw Error('Unexpected catalog worker RPC '+name);
  };
  const discovery=await processClaimedOfficialJob({job:catalogJob,rpc:catalogRpc,fetchImpl:async()=>new Response(catalogOriginal,{headers:{'content-type':'text/html'}})});
  assert.equal(discovery.outcome,'catalog_discovered');assert.equal(discovery.enqueued,70);assert.equal(discovery.resultsInserted,0);
  const childId=query(`SELECT j.id FROM import_v2_jobs j JOIN refresh_requests r ON r.id=j.request_id WHERE r.catalog_root_request_id=${sql(request.request_id)} AND j.cursor->>'external_meet_id'=${sql(meetId)};`);
  assert.ok(childId);query(`UPDATE import_v2_jobs SET priority=-101 WHERE id=${sql(childId)};`);
  const job=JSON.parse(query(`SET ROLE service_role;SELECT row_to_json(j) FROM claim_official_import_jobs(1) j;`).split('\n').at(-1));assert.equal(job.id,childId);
  const cancelCatalog=()=>query(`SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub',${sql(user)},false);SELECT cancel_result_refresh_request(${sql(request.request_id)});`);
  const prepared=buildOfficialBatch({job,athlete,identity,meet:discovered.meet,documents:js,allowedHosts});
  const oracle=buildOfficialBatch({job,athlete,identity,meet:discovered.meet,documents:poppler,allowedHosts});
  const signature=r=>[r.externalEventId,r.round,r.sex,r.resultDate,r.course,r.event,r.timeMs,r.status];
  assert.equal(prepared.accepted,oracle.accepted);assert.deepEqual(prepared.scan.results.map(signature),oracle.scan.results.map(signature),'Independent extractors disagree on official swims');
  if(!prepared.accepted){assert.equal(externalId,'393259');assert.equal(meetId,'c8587533-2e44-4b08-991f-f827170c7344');assert.equal(prepared.scan.status,'identity_not_found');query(`SET ROLE service_role;SELECT finish_official_import_failure(${sql(job.id)},${sql(job.lease_token)},'identity_not_found','Exact registration absent from published October documents',false);`);cancelCatalog();continue;}
  for(const label of new Set([...prepared.batch.entries,...prepared.batch.results].map(r=>r.event))){const [distance,stroke]=label.split(' '),strokes={Livre:'freestyle',Costas:'backstroke',Peito:'breaststroke',Borboleta:'butterfly',Medley:'medley'};assert.ok(strokes[stroke]);query(`INSERT INTO events(id,distance_m,stroke,label,active) SELECT gen_random_uuid(),${Number(distance)},${sql(strokes[stroke])},${sql(label)},true WHERE NOT EXISTS(SELECT 1 FROM events WHERE label=${sql(label)});`);};
  const rpc=async(name,args)=>{assert.equal(name,'persist_official_meet_batch');return {data:JSON.parse(query(`SET ROLE service_role;SELECT persist_official_meet_batch(${sql(args.p_job_id)},${sql(args.p_lease_token)},${sql(JSON.stringify(args.p_batch))}::jsonb);`))};};
  const workerRpc=async(name,args)=>{
   if(name==='persist_official_meet_batch')return rpc(name,args);
   if(name==='load_official_import_context')return {data:JSON.parse(query(`SET ROLE service_role;SELECT load_official_import_context(${sql(args.p_job_id)},${sql(args.p_lease_token)});`))};
   if(name==='finish_official_import_failure')return {data:JSON.parse(query(`SET ROLE service_role;SELECT finish_official_import_failure(${sql(args.p_job_id)},${sql(args.p_lease_token)},${sql(args.p_failure_code)},${sql(args.p_message)},${args.p_retryable?'true':'false'},${sql(JSON.stringify(args.p_details||{}))}::jsonb);`))};
   throw Error('Unexpected worker RPC '+name);
  };
  const first=await processClaimedOfficialJob({job,rpc:workerRpc,extractPdf:extractOfficialPdfJs,now:()=>new Date('2026-10-11T17:48:13.000Z'),fetchImpl:async url=>{const meta=archived.captures.find(c=>c.url===url&&c.file);if(!meta)throw Error('Missing original '+url);return new Response(await fs.readFile(`${root}/${meta.file}`),{headers:{'content-type':meta.file.endsWith('.html')?'text/html':'application/pdf'}});}});
  assert.equal(first.status,'completed',JSON.stringify(first));assert.equal(first.inserted,meetId.startsWith('c858')?currentCount:historicalCount);

  assert.equal(query(`SELECT count(*) FROM official_meet_subscriptions WHERE athlete_id=${sql(athlete.id)} AND meet_external_id=${sql(meetId)} AND active;`),'1');
  cancelCatalog(); // Other visible meets are outside this original-PDF fixture; no claim of full history.
  const storedBatch=JSON.parse(query(`SELECT counters FROM official_import_batches WHERE job_id=${sql(job.id)};`));assert.equal(storedBatch.inserted,first.inserted);
  // Durable receipt replay is asserted with the exact payload in the SQL suite.
  const again=JSON.parse(query(`SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub',${sql(user)},false);SELECT request_official_meet_import(${sql(athlete.id)},${sql(discovered.meet.officialUrl)});`).split('\n').at(-1));
  const secondJob=JSON.parse(query(`SET ROLE service_role;SELECT row_to_json(j) FROM claim_official_import_jobs(1) j;`).split('\n').at(-1));assert.equal(secondJob.id,again.job_id);
  const second=await commitOfficialBatch({rpc,job:secondJob,prepared});assert.equal(second.inserted,0);assert.equal(second.duplicated,first.inserted);assert.equal(second.entriesUpdated,0);
  const persisted=JSON.parse(query(`SELECT json_agg(json_build_array(r.official_event_number,r.official_round,r.official_sex,r.result_date,r.course,e.label,r.time_ms,r.status) ORDER BY r.official_event_number::integer) FROM results r JOIN events e ON e.id=r.event_id JOIN meets m ON m.id=r.meet_id WHERE r.athlete_id=${sql(athlete.id)} AND m.external_id=${sql(meetId)};`));
  assert.deepEqual(persisted,prepared.scan.results.map(signature).sort((a,b)=>Number(a[0])-Number(b[0])));
  const entrySignature=r=>[r.externalEventId,r.round,r.sex,r.eventDate,r.course,r.event,r.seedTimeMs??null,r.heat,r.lane,new Date(r.scheduledAt).toISOString()];
  const persistedEntries=JSON.parse(query(`SELECT coalesce(json_agg(json_build_array(e.official_event_number,e.official_round,e.official_sex,e.official_event_date,e.official_course,v.label,e.seed_time_ms,e.heat,e.lane,to_char(e.scheduled_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))),'[]'::json) FROM official_meet_entries e JOIN events v ON v.id=e.event_id JOIN meets m ON m.id=e.meet_id WHERE e.athlete_id=${sql(athlete.id)} AND m.external_id=${sql(meetId)};`));
  const ordered=rows=>rows.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  assert.deepEqual(ordered(persistedEntries),ordered(prepared.scan.entries.map(entrySignature)),'SQL seeding differs from original in time/heat/lane/date/pool/race');
  assert.deepEqual(ordered(prepared.scan.entries.map(entrySignature)),ordered(oracle.scan.entries.map(entrySignature)),'Independent extractors disagree on official seeding');
  proof.push({externalId,meetId,first,second,catalogMeetCount:70,catalogWorkerAndSqlTested:true,subscriptionCreatedFromValidatedPublication:true,workerContextAndCaptureTested:true,independentExtractorsAgree:true,persistedMatchesOriginal:true,persistedSeedingMatchesOriginal:true});
 }
 assert.equal(Number(query(`SELECT count(*) FROM results WHERE athlete_id=${sql(athlete.id)}`)),total);
}
console.log(JSON.stringify({mode:'official-originals-to-isolated-postgres-not-production',proof,productionWrites:0}));
