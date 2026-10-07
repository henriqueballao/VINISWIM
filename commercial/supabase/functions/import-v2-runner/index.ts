import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { historicalDryRun } from "https://raw.githubusercontent.com/henriqueballao/VINISWIM/46af3ca89d75dd62647477f3ec7ff3c730528ff6/commercial/packages/import-v2/src/historical-dryrun.mjs";
import { discoverSwimSystemMeetIds } from "https://raw.githubusercontent.com/henriqueballao/VINISWIM/46af3ca89d75dd62647477f3ec7ff3c730528ff6/commercial/packages/import-v2/src/discovery.mjs";
import { parseMeetEvidence,parseStartlist } from "https://raw.githubusercontent.com/henriqueballao/VINISWIM/46af3ca89d75dd62647477f3ec7ff3c730528ff6/commercial/packages/import-v2/src/swimsystem-current.mjs";
import { classifyImportFailure } from "https://raw.githubusercontent.com/henriqueballao/VINISWIM/46af3ca89d75dd62647477f3ec7ff3c730528ff6/commercial/packages/import-v2/src/failure-states.mjs";

const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
const json=(v:any,s=200)=>new Response(JSON.stringify(v),{status:s,headers:{"content-type":"application/json"}});
const n=(v:any)=>String(v||"").normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase().replace(/\s+/g," ").trim();

async function fetchText(url:string,ms=15000){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);
 try{
  const r=await fetch(url,{headers:{"user-agent":"VINISWIM Import V2/1.0"},signal:c.signal});
  if(!r.ok){const e:any=new Error("HTTP "+r.status);e.httpStatus=r.status;throw e}
  return await r.text();
 }finally{clearTimeout(t)}
}
async function readerText(url:string){
 const {data:cached}=await db.from("historical_document_text_cache").select("text_content,fetch_status").eq("url",url).maybeSingle();
 if(cached?.fetch_status==="ok"&&cached.text_content)return cached.text_content;
 const target="https://r.jina.ai/http://"+url.replace(/^https?:\/\//i,"");
 const text=await fetchText(target,18000);
 await db.from("historical_document_text_cache").upsert({url,text_content:text,fetch_status:"ok",http_status:200,error_message:null,fetched_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:"url"});
 return text;
}
function pdfLinks(html:string){
 return [...new Set([...String(html||"").matchAll(/https?:\/\/[^"'\\s]+\.pdf/gi)].map(m=>m[0]))];
}
function categoryFor(resultDate:string,birthDate:string|null,current:string|null){
 if(!resultDate||!birthDate)return current||null;
 const age=Number(resultDate.slice(0,4))-Number(String(birthDate).slice(0,4));
 const labels:any={9:"Mirim I",10:"Mirim II",11:"Petiz I",12:"Petiz II",13:"Infantil I",14:"Infantil II",15:"Juvenil I",16:"Juvenil II",17:"Júnior I",18:"Júnior II",19:"Sênior",20:"Sênior"};
 return labels[age]||(age>=25?"Master":current||null);
}
async function eventMap(){
 const {data,error}=await db.from("events").select("id,label").eq("active",true);if(error)throw error;
 return new Map((data||[]).map((x:any)=>[n(x.label),x.id]));
}
async function persistCandidates(job:any,archive:any,candidates:any[],athlete:any){
 const ev=await eventMap();let inserted=0,duplicated=0;
 for(const c of candidates){
  const eid=ev.get(n(c.event));if(!eid)continue;
  const start=archive.start_date||c.resultDate;
  if(!start||!c.resultDate||!c.course)continue;
  const meetUp=await db.from("meets").upsert({
   source_id:job.source_id,external_id:String(archive.event_key),name:archive.name||("Competição "+archive.event_key),
   start_date:start,end_date:archive.end_date||null,course:c.course,official_url:archive.base_url,status:"completed"
  },{onConflict:"source_id,external_id"}).select("id").single();
  if(meetUp.error)throw meetUp.error;
  const fp=[job.athlete_id,meetUp.data.id,eid,c.resultDate,c.course,c.timeMs??"",c.status].join("|");
  const {data:old}=await db.from("results").select("id").eq("result_fingerprint",fp).maybeSingle();
  let rid=old?.id;
  if(!rid){
   const ins=await db.from("results").insert({
    athlete_id:job.athlete_id,meet_id:meetUp.data.id,event_id:eid,result_date:c.resultDate,course:c.course,
    time_ms:c.timeMs,status:c.status,origin:"official",source_id:job.source_id,is_official:true,
    result_fingerprint:fp,category:categoryFor(c.resultDate,athlete.birth_date,athlete.category)
   }).select("id").single();
   if(ins.error){
    if((ins.error as any).code==="23505"){duplicated++;const q=await db.from("results").select("id").eq("result_fingerprint",fp).maybeSingle();rid=q.data?.id}
    else throw ins.error;
   }else{rid=ins.data.id;inserted++}
  }else duplicated++;
  if(rid)await db.from("result_sources").upsert({
   result_id:rid,source_id:job.source_id,source_url:c.sourceUrl,external_id:c.sourceUrl,retrieved_at:c.retrievedAt,
   raw_hash:null,metadata:{engine:"v2",parser_version:c.parserVersion,source_block:c.sourceBlock}
  },{onConflict:"result_id,source_id,external_id"});
 }
 return {inserted,duplicated};
}
async function ensureSwimSystemArchives(sourceId:string){
 const html=await fetchText("https://www.swimsystem.app/meets");
 const ids=discoverSwimSystemMeetIds(html);
 const existing=await db.from("historical_archives").select("event_key").eq("source_id",sourceId).eq("provider","swimsystem_v2");
 const have=new Set((existing.data||[]).map((x:any)=>String(x.event_key)));
 for(const id of ids){
  if(have.has(id))continue;
  await db.from("historical_archives").insert({source_id:sourceId,provider:"swimsystem_v2",event_key:id,name:"SwimSystem "+id,base_url:"https://www.swimsystem.app/meets/sw/"+id,active:true,updated_at:new Date().toISOString()});
 }
}
async function ensureMastersArchives(sourceId:string){
 let pages:any[]=[];
 try{pages=JSON.parse(await fetchText("http://mastersparana.com.br/associacao/index.php?rest_route=/wp/v2/pages&per_page=50"))}catch{return}
 const meeting=pages.filter((p:any)=>/MEETING MASTERS\s+\d{4}/i.test(p?.title?.rendered||"")).sort((a:any,b:any)=>String(b.modified).localeCompare(String(a.modified)))[0];
 if(!meeting)return;
 const html=String(meeting.content?.rendered||""),year=(meeting.title.rendered.match(/(\d{4})/)||[])[1]||String(new Date().getFullYear());
 const allHead=[...html.matchAll(/<h[1-3][^>]*>/gi)].map(m=>m.index!);
 for(const h of html.matchAll(/<h[1-3][^>]*>\s*(\d+)[ºª°]\s*ETAPA\s+([^<]+)<\/h[1-3]>/gi)){
  const next=allHead.find(x=>x>h.index!),block=html.slice(h.index!,next??html.length);let resultUrl="";
  for(const m of block.matchAll(/href='([^']+)'[^>]*class='[^']*avia-button[^']*'[^>]*aria-label="([^"]*)"/gi)){
   if(/RESULTADOS/i.test(m[2])&&!/EQUIPE/i.test(m[2])&&/\.pdf$/i.test(m[1])){resultUrl=m[1];break}
  }
  if(!resultUrl)continue;
  const key="masters-parana-"+year+"-etapa-"+h[1];
  await db.from("historical_archives").upsert({source_id:sourceId,provider:"masters_parana",event_key:key,name:("Meeting Masters "+year+" - Etapa "+h[1]+" "+h[2]).replace(/\s+/g," ").trim(),base_url:resultUrl,active:true,updated_at:new Date().toISOString()},{onConflict:"source_id,event_key"});
 }
}
async function processHistorical(job:any,source:any,identity:any,athlete:any){
 const cursor={...(job.cursor||{})};
 if(!cursor.discovery_done){
  if(source.code==="swimsystem")await ensureSwimSystemArchives(job.source_id);
  if(source.code==="masters_parana")await ensureMastersArchives(job.source_id);
  cursor.discovery_done=true;cursor.archive_index=0;cursor.pdf_cursor=0;
 }
 const aq=await db.from("historical_archives").select("*").eq("source_id",job.source_id).order("created_at",{ascending:true});
 if(aq.error)throw aq.error;const archives=aq.data||[];
 const ai=Number(cursor.archive_index||0);
 if(ai>=archives.length)return {done:true,cursor,found:0,inserted:0,duplicated:0};
 const a=archives[ai],retrievedAt=new Date().toISOString(),docs:any[]=[];
 if(a.provider==="masters_parana"){
  const txt=await readerText(a.base_url);
  if(n(txt).includes(n(identity.canonicalName))||identity.aliases.some((x:string)=>n(txt).includes(n(x))))docs.push({externalMeetId:String(a.event_key),url:a.base_url,text:txt});
 }else if(a.provider==="swimsystem_v2"){
  const base=String(a.base_url).replace(/\/results\/?$/,""),html=await fetchText(base);
  const links=pdfLinks(html).filter(u=>/ResultList_/i.test(u));
  const pi=Number(cursor.pdf_cursor||0),batch=links.slice(pi,pi+3);
  for(const u of batch){const txt=await readerText(u);if(String(txt).includes(identity.externalId))docs.push({externalMeetId:String(a.event_key),url:u,text:txt})}
  const next=pi+batch.length;
  if(next<links.length){
   const pack=historicalDryRun({identity,archives:[{externalMeetId:String(a.event_key),sourceCode:source.code,course:a.course,provider:a.provider,startDate:a.start_date,endDate:a.end_date,name:a.name}],documents:docs,retrievedAt});
   if(docs.length&&pack.accepted.length===0){const e:any=new Error("parser no match");e.parserMatched=false;throw e}
   const p=await persistCandidates(job,a,pack.accepted,athlete);
   return {done:false,cursor:{...cursor,archive_index:ai,pdf_cursor:next},found:pack.accepted.length,inserted:p.inserted,duplicated:p.duplicated};
  }
 }else{
  const cq=await db.from("historical_document_text_cache").select("url,text_content").eq("fetch_status","ok").like("url",String(a.base_url).replace(/%/g,"")+"%").limit(500);
  for(const d of cq.data||[]){if(/ResultList_/i.test(d.url)&&String(d.text_content||"").includes(identity.externalId))docs.push({externalMeetId:String(a.event_key),url:d.url,text:d.text_content})}
 }
 const pack=historicalDryRun({identity,archives:[{externalMeetId:String(a.event_key),sourceCode:source.code,course:a.course,provider:a.provider,startDate:a.start_date,endDate:a.end_date,name:a.name}],documents:docs,retrievedAt});
 if(docs.length&&pack.accepted.length===0){const e:any=new Error("parser no match");e.parserMatched=false;throw e}
 const p=await persistCandidates(job,a,pack.accepted,athlete);
 return {done:ai+1>=archives.length,cursor:{...cursor,archive_index:ai+1,pdf_cursor:0},found:pack.accepted.length,inserted:p.inserted,duplicated:p.duplicated};
}
async function processCurrent(job:any,identity:any){
 const listing=await fetchText("https://www.swimsystem.app/meets"),upcoming=listing.split(/Competições anteriores/i)[0],ids=discoverSwimSystemMeetIds(upcoming);
 const cursor={...(job.cursor||{})},mi=Number(cursor.meet_index||0);
 if(mi>=ids.length)return {done:true,cursor:{},found:0,inserted:0,duplicated:0};
 const id=ids[mi],base="https://www.swimsystem.app/meets/sw/"+id,html=await fetchText(base),links=pdfLinks(html),pi=cursor.meet_id===id?Number(cursor.pdf_cursor||0):0;
 let evidence=cursor.meet_id===id?cursor.evidence||null:null,entries=cursor.meet_id===id&&Array.isArray(cursor.entries)?cursor.entries:[];
 const batch=links.slice(pi,pi+2);
 for(const u of batch){
  try{const txt=await readerText(u),ev=parseMeetEvidence(txt);if(ev.accepted&&!evidence)evidence=ev.meet;if(ev.accepted)entries.push(...parseStartlist(txt,identity))}catch{}
 }
 entries=entries.filter((e:any,i:number,a:any[])=>a.findIndex((x:any)=>n(x.event)===n(e.event))===i);
 const next=pi+batch.length;
 if(next<links.length)return {done:false,cursor:{meet_index:mi,meet_id:id,pdf_cursor:next,evidence,entries},found:0,inserted:0,duplicated:0};
 if(evidence?.startDate&&entries.length){
  const mq=await db.from("meets").upsert({source_id:job.source_id,external_id:id,name:"SwimSystem "+id,start_date:evidence.startDate,end_date:evidence.endDate||null,course:evidence.course,official_url:base,status:"scheduled",city:evidence.city||null},{onConflict:"source_id,external_id"}).select("id").single();
  if(mq.error)throw mq.error;const ev=await eventMap();
  for(const e of entries){const eid=ev.get(n(e.event));if(eid)await db.from("meet_entries").upsert({meet_id:mq.data.id,athlete_id:job.athlete_id,event_id:eid,seed_time_ms:e.seedTimeMs,heat:e.heat,lane:e.lane,entry_status:"seeded",source_id:job.source_id},{onConflict:"meet_id,athlete_id,event_id"})}
 }
 return {done:mi+1>=ids.length,cursor:{meet_index:mi+1,pdf_cursor:0,meet_id:null,evidence:null,entries:[]},found:entries.length,inserted:0,duplicated:0};
}
async function process(job:any){
 const sq=await db.from("sources").select("id,code,name").eq("id",job.source_id).single();if(sq.error)throw sq.error;
 const aq=await db.from("athletes").select("id,full_name,preferred_name,birth_date,category").eq("id",job.athlete_id).single();if(aq.error)throw aq.error;
 const cq=await db.from("athlete_source_configs").select("external_id,external_name").eq("athlete_id",job.athlete_id).eq("source_id",job.source_id).eq("active",true).maybeSingle();if(cq.error)throw cq.error;
 const iq=await db.from("athlete_identifiers").select("external_id,external_name").eq("athlete_id",job.athlete_id).eq("source_id",job.source_id).eq("active",true).maybeSingle();
 const externalId=String(cq.data?.external_id||iq.data?.external_id||"").trim();
 const canonicalName=cq.data?.external_name||iq.data?.external_name||aq.data.full_name;
 if(!externalId&&job.job_type!=="historical"){const e:any=new Error("parser no match: missing external identity");e.parserMatched=false;throw e}
 const identity={externalId,canonicalName,aliases:[aq.data.full_name,aq.data.preferred_name,cq.data?.external_name,iq.data?.external_name].filter(Boolean)};
 return job.job_type==="current_meet"?await processCurrent(job,identity):await processHistorical(job,sq.data,identity,aq.data);
}
Deno.serve(async()=>{
 try{
  const claim=await db.rpc("claim_import_v2_jobs",{p_limit:1});if(claim.error)throw claim.error;
  const jobs=claim.data||[];if(!jobs.length)return json({ok:true,processed:0});
  const job=jobs[0];
  try{
   const r=await process(job);
   await db.from("import_v2_jobs").update({
    status:r.done?"completed":"pending",cursor:r.done?{}:r.cursor,locked_at:null,next_run_at:r.done?null:new Date(Date.now()+5000).toISOString(),
    last_error:null,failure_code:null,records_found:Number(job.records_found||0)+r.found,records_inserted:Number(job.records_inserted||0)+r.inserted,records_duplicated:Number(job.records_duplicated||0)+r.duplicated
   }).eq("id",job.id).eq("status","running");
   return json({ok:true,processed:1,job_id:job.id,done:r.done,found:r.found,inserted:r.inserted,duplicated:r.duplicated});
  }catch(e:any){
   const f=classifyImportFailure({error:e,message:e?.message,httpStatus:e?.httpStatus,parserMatched:e?.parserMatched});
   const retry=f.retryable&&Number(job.attempts||0)<3;
   await db.from("import_v2_jobs").update({status:retry?"pending":"failed",locked_at:null,next_run_at:retry?new Date(Date.now()+60000).toISOString():null,failure_code:f.code,last_error:String(e?.message||e).slice(0,1000)}).eq("id",job.id).eq("status","running");
   return json({ok:retry,processed:1,job_id:job.id,retry,failure_code:f.code,error:String(e?.message||e)},retry?200:500);
  }
 }catch(e:any){return json({ok:false,error:String(e?.message||e)},500)}
});