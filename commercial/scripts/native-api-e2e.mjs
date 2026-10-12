// Local Supabase Auth/PostgREST + real worker/source; NEVER production.
import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {processClaimedOfficialJob} from '../packages/official-worker/src/runner.mjs';
import {extractOfficialPdfJs} from '../packages/official-worker/src/pdf-js-extractor.mjs';
const api=process.env.API_URL,anon=process.env.ANON_KEY,key=process.env.SERVICE_ROLE_KEY;
if(api!=='http://127.0.0.1:54321'||!anon||!key)throw Error('Native E2E requires isolated loopback Supabase');
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(api,key,options);
const checked=async response=>{const value=await response;if(value.error)throw Error(value.error.message);return value.data;};
const statePath='/tmp/viniswim-native-actors.json',password='SYNTHETIC-Local-Only-2026!';
async function actor(email){
 const created=await checked(admin.auth.admin.createUser({email,password,email_confirm:true}));
 const accountId=randomUUID(),athleteId=randomUUID();
 await checked(admin.from('accounts').insert({id:accountId,name:'SYNTHETIC NATIVE ACCOUNT'}));
 await checked(admin.from('profiles').insert({id:created.user.id,full_name:'SYNTHETIC LOCAL USER',email}));
 await checked(admin.from('account_members').insert({account_id:accountId,user_id:created.user.id,status:'active',role:'owner'}));
 await checked(admin.from('athletes').insert({id:athleteId,account_id:accountId,full_name:'SYNTHETIC NATIVE PROFILE',preferred_name:'Atleta de teste',active:true}));
 return {email,password,userId:created.user.id,accountId,athleteId};
}
if(process.argv[2]==='seed'){
 const a=await actor('native-a@example.invalid'),b=await actor('native-b@example.invalid');
 // Choose an additional published registration from the authorized original;
 // no whitelist of Vini/Lorenzo/Andre is consulted by importer or persistence.
 const text=await fs.readFile(new URL('../packages/import-v2/fixtures/official-20261011/results.txt',import.meta.url),'utf8');
 const registration=text.match(/^\s*\d+\.\s+\d+\/\d+\s+.+?\s+(\d{5,7})\s+20\d{2}\s+/m)?.[1];
 assert.ok(registration);assert.ok(!['422692','399680','393259'].includes(registration));
 const sourceId=randomUUID();await checked(admin.from('sources').insert({id:sourceId,code:'swimsystem',name:'SwimSystem',source_type:'official_results',official:true,active:true}));
 await checked(admin.from('athlete_source_configs').insert({athlete_id:a.athleteId,source_id:sourceId,display_name:'SwimSystem',source_url:'https://www.swimsystem.app',external_id:registration,external_name:'Public registration selected from official original',active:true}));
 await checked(admin.from('athlete_identifiers').insert({athlete_id:a.athleteId,source_id:sourceId,external_id:registration,active:true,verified:true,status:'verified'}));
 const strokes={Livre:'freestyle',Costas:'backstroke',Peito:'breaststroke',Borboleta:'butterfly',Medley:'medley'};
 await checked(admin.from('events').insert(Object.entries(strokes).flatMap(([label,stroke])=>[25,50,100,200,400,800,1500].map(distance=>({distance_m:distance,stroke,label:distance+' '+label,active:true})))));
 await fs.writeFile(statePath,JSON.stringify({a,b,registration,sourceId}));
 console.log(JSON.stringify({mode:'native-local-metadata-only',sportingWrites:0,additionalRegistration:registration}));
}else if(process.argv[2]==='import'){
 const state=JSON.parse(await fs.readFile(statePath,'utf8'));
 const user=createClient(api,anon,options);await checked(user.auth.signInWithPassword({email:state.a.email,password:state.a.password}));
 const rootJobs=await checked(admin.from('import_v2_jobs').select('*').eq('worker_version','official-v3').eq('status','pending').order('created_at'));
 const root=rootJobs.find(j=>j.cursor.scope==='meet_catalog');assert.ok(root,'UI must create the catalog request through native Auth');
 await checked(admin.from('import_v2_jobs').update({priority:-100}).eq('id',root.id));
 const rpc=(name,args)=>admin.rpc(name,args);
 const claimed=await checked(admin.rpc('claim_official_import_jobs',{p_limit:1}));assert.equal(claimed[0].id,root.id);
 const discovery=await processClaimedOfficialJob({job:claimed[0],rpc,extractPdf:extractOfficialPdfJs});
 assert.equal(discovery.outcome,'catalog_discovered',JSON.stringify(discovery));
 const children=await checked(admin.from('import_v2_jobs').select('*').eq('status','pending'));
 const target=children.find(j=>j.cursor.external_meet_id==='c8587533-2e44-4b08-991f-f827170c7344');assert.ok(target);
 await checked(admin.from('import_v2_jobs').update({priority:-101}).eq('id',target.id));
 const jobs=await checked(admin.rpc('claim_official_import_jobs',{p_limit:1}));assert.equal(jobs[0].id,target.id);
 const first=await processClaimedOfficialJob({job:jobs[0],rpc,extractPdf:extractOfficialPdfJs});assert.equal(first.status,'completed',JSON.stringify(first));assert.ok(first.inserted>0);
 await checked(user.rpc('cancel_result_refresh_request',{p_request_id:root.request_id}));
 const repeat=await checked(user.rpc('request_official_meet_import',{p_athlete_id:state.a.athleteId,p_meet_url:'https://www.swimsystem.app/meets/sw/c8587533-2e44-4b08-991f-f827170c7344'}));
 const reclaims=await checked(admin.rpc('claim_official_import_jobs',{p_limit:1}));assert.equal(reclaims[0].id,repeat.job_id);
 const second=await processClaimedOfficialJob({job:reclaims[0],rpc,extractPdf:extractOfficialPdfJs});assert.equal(second.status,'completed',JSON.stringify(second));assert.equal(second.inserted,0);
 const rows=await checked(user.from('v_result_timeline').select('*').eq('athlete_id',state.a.athleteId));assert.equal(rows.length,first.inserted);assert.ok(rows.every(r=>r.is_official));
 const other=createClient(api,anon,options);await checked(other.auth.signInWithPassword({email:state.b.email,password:state.b.password}));
 const forbidden=await checked(other.from('v_result_timeline').select('*').eq('athlete_id',state.a.athleteId));assert.deepEqual(forbidden,[]);
 const direct=await user.rpc('persist_official_catalog',{p_job_id:root.id,p_lease_token:randomUUID(),p_catalog:{}});assert.ok(direct.error,'Browser cannot invoke service persistence');
 const sources=await checked(admin.from('result_sources').select('result_id,source_url,raw_hash,retrieved_at').in('result_id',rows.map(r=>r.id)));
 assert.equal(sources.length,rows.length);assert.ok(sources.every(s=>/^[a-f0-9]{64}$/.test(s.raw_hash)));
 await fs.writeFile('/tmp/viniswim-native-proof.json',JSON.stringify({mode:'native-local-auth-rest-live-source',productionWrites:0,registration:state.registration,discovery,first,second,rows,sources,segregation:true}));
 console.log(JSON.stringify({mode:'native-local-auth-rest-live-source',productionWrites:0,registration:state.registration,inserted:first.inserted,reimported:second.inserted,segregation:true}));
}else if(process.argv[2]==='verify-restart'){
 const state=JSON.parse(await fs.readFile(statePath,'utf8')),proof=JSON.parse(await fs.readFile('/tmp/viniswim-native-proof.json','utf8'));
 const user=createClient(api,anon,options);await checked(user.auth.signInWithPassword({email:state.a.email,password:state.a.password}));
 const rows=await checked(user.from('v_result_timeline').select('*').eq('athlete_id',state.a.athleteId));
 const ordered=items=>items.toSorted((a,b)=>a.id.localeCompare(b.id));assert.deepEqual(ordered(rows),ordered(proof.rows));
 const sources=await checked(admin.from('result_sources').select('result_id,source_url,raw_hash,retrieved_at').in('result_id',rows.map(r=>r.id)));
 const sorted=items=>items.toSorted((a,b)=>a.result_id.localeCompare(b.result_id));assert.deepEqual(sorted(sources),sorted(proof.sources));
 proof.localServicesRestarted=true;proof.persistedRowsAndSourcesUnchanged=true;
 await fs.writeFile('/tmp/viniswim-native-proof.json',JSON.stringify(proof));
 console.log('PASS native services restarted: Auth login, rows and source hashes recovered unchanged');
}else throw Error('Choose seed, import or verify-restart');
