// Local Supabase Auth/PostgREST + real worker/source; NEVER production.
import {createClient} from '@supabase/supabase-js';
import {randomUUID,randomBytes,createHash} from 'node:crypto';import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
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
 const user=createClient(api,anon,options);await checked(user.auth.signInWithPassword({email:a.email,password:a.password}));
 const configured=await checked(user.rpc('save_official_athlete_source_config',{p_athlete_id:a.athleteId,p_url:'https://www.swimsystem.app',p_external_id:registration,p_external_name:'Public registration selected from official original',p_display_name:'SwimSystem'}));assert.equal(configured.ok,true);
 const identifiers=await checked(admin.from('athlete_identifiers').select('*').eq('athlete_id',a.athleteId));assert.equal(identifiers.length,0,'Typed registration must not be marked officially verified');
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
 const token=process.env.OFFICIAL_IMPORT_WORKER_TOKEN;assert.ok(/^[a-f0-9]{64}$/.test(token||''));
 const endpoint='http://127.0.0.1:8000';
 const invoke=async expectedId=>{
  const response=await fetch(endpoint,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:'{}'});
  const payload=await response.json();assert.equal(response.status,200,JSON.stringify(payload));assert.equal(payload.outcome,'jobs_processed');
  assert.equal(payload.outcomes.length,1);assert.equal(payload.outcomes[0].jobId,expectedId);return payload.outcomes[0];
 };
 // Real production entrypoint over HTTP; neither Node handler nor mocked RPC.
 const vaultAccess=await user.rpc('read_official_worker_token');assert.ok(vaultAccess.error,'Browser cannot read service secret');
 const denied=await fetch(endpoint,{method:'POST',headers:{authorization:'Bearer '+token.slice(0,-1)+'z'},body:'{}'});assert.equal(denied.status,401);
 const get=await fetch(endpoint);assert.equal(get.status,405);
 const discovery=await invoke(root.id);
 assert.equal(discovery.outcome,'catalog_discovered',JSON.stringify(discovery));
 const children=await checked(admin.from('import_v2_jobs').select('*').eq('status','pending'));
 const target=children.find(j=>j.cursor.external_meet_id==='c8587533-2e44-4b08-991f-f827170c7344');assert.ok(target);
 await checked(admin.from('import_v2_jobs').update({priority:-101}).eq('id',target.id));
 const first=await invoke(target.id);assert.equal(first.status,'completed',JSON.stringify(first));assert.ok(first.inserted>0);
 await checked(user.rpc('cancel_result_refresh_request',{p_request_id:root.request_id}));
 const repeat=await checked(user.rpc('request_official_meet_import',{p_athlete_id:state.a.athleteId,p_meet_url:'https://www.swimsystem.app/meets/sw/c8587533-2e44-4b08-991f-f827170c7344'}));
 const second=await invoke(repeat.job_id);assert.equal(second.status,'completed',JSON.stringify(second));assert.equal(second.inserted,0);
 const rows=await checked(user.from('v_result_timeline').select('*').eq('athlete_id',state.a.athleteId));assert.equal(rows.length,first.inserted);assert.ok(rows.every(r=>r.is_official));
 const other=createClient(api,anon,options);await checked(other.auth.signInWithPassword({email:state.b.email,password:state.b.password}));
 const forbidden=await checked(other.from('v_result_timeline').select('*').eq('athlete_id',state.a.athleteId));assert.deepEqual(forbidden,[]);
 const direct=await user.rpc('persist_official_catalog',{p_job_id:root.id,p_lease_token:randomUUID(),p_catalog:{}});assert.ok(direct.error,'Browser cannot invoke service persistence');
 const sources=await checked(admin.from('result_sources').select('result_id,source_url,raw_hash,retrieved_at').in('result_id',rows.map(r=>r.id)));
 assert.equal(sources.length,rows.length);assert.ok(sources.every(s=>/^[a-f0-9]{64}$/.test(s.raw_hash)));
 const originals=await checked(admin.from('official_import_documents').select('source_url,raw_hash,captured_at,raw_bytes').eq('source_id',state.sourceId));
 const originalRoot='/tmp/native-official-originals';await fs.mkdir(originalRoot,{recursive:true});
 const manifest=[];
 for(const document of originals){
  assert.ok(/^\\x[a-f0-9]+$/i.test(document.raw_bytes));
  const bytes=Buffer.from(document.raw_bytes.slice(2),'hex');assert.equal(createHash('sha256').update(bytes).digest('hex'),document.raw_hash);
  const file=document.raw_hash+'.pdf';await fs.writeFile(originalRoot+'/'+file,bytes);
  manifest.push({file,url:document.source_url,rawHash:document.raw_hash,capturedAt:document.captured_at,bytes:bytes.length});
 }
 await fs.writeFile(originalRoot+'/manifest.json',JSON.stringify({mode:'native-local-live-original-captures',documents:manifest}));
 const db=new URL(process.env.DB_URL);assert.ok(['127.0.0.1','localhost'].includes(db.hostname)&&db.port==='54322');
 const rotated=randomBytes(32).toString('hex');
 const rotation=spawnSync('psql',[process.env.DB_URL,'-v','ON_ERROR_STOP=1'],{input:"SELECT vault.update_secret(id, '"+rotated+"') FROM vault.secrets WHERE name='viniswim_official_import_worker_token';",encoding:'utf8'});assert.equal(rotation.status,0,'Local Vault rotation must succeed');
 const revoked=await fetch(endpoint,{method:'POST',headers:{authorization:'Bearer '+token},body:'{}'});assert.equal(revoked.status,401,'Warm Deno isolate must reject revoked token');
 const refreshed=await fetch(endpoint,{method:'POST',headers:{authorization:'Bearer '+rotated},body:'{}'});assert.equal(refreshed.status,200);assert.equal((await refreshed.json()).outcome,'idle');
 await fs.writeFile('/tmp/viniswim-native-proof.json',JSON.stringify({mode:'native-deno-http-auth-rest-live-source',actualDenoEntrypoint:true,warmVaultRotationVerified:true,productionWrites:0,registration:state.registration,discovery,first,second,rows,sources,segregation:true}));
 console.log(JSON.stringify({mode:'native-deno-http-auth-rest-live-source',actualDenoEntrypoint:true,productionWrites:0,registration:state.registration,inserted:first.inserted,reimported:second.inserted,segregation:true}));
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
