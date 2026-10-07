import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { historicalDryRun } from "https://raw.githubusercontent.com/henriqueballao/VINISWIM/338c7d9311eeaa621bc8dee438b50573e4b2c518/commercial/packages/import-v2/src/historical-dryrun.mjs";
import { discoverSwimSystemMeetIds } from "https://raw.githubusercontent.com/henriqueballao/VINISWIM/338c7d9311eeaa621bc8dee438b50573e4b2c518/commercial/packages/import-v2/src/discovery.mjs";
import { parseMeetEvidence,parseStartlist } from "https://raw.githubusercontent.com/henriqueballao/VINISWIM/338c7d9311eeaa621bc8dee438b50573e4b2c518/commercial/packages/import-v2/src/swimsystem-current.mjs";
import { classifyImportFailure } from "https://raw.githubusercontent.com/henriqueballao/VINISWIM/338c7d9311eeaa621bc8dee438b50573e4b2c518/commercial/packages/import-v2/src/failure-states.mjs";

const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
const json=(v:any,s=200)=>new Response(JSON.stringify(v),{status:s,headers:{"content-type":"application/json"}});
const n=(v:any)=>String(v||"").normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase().replace(/\s+/g," ").trim();
function canonicalMeetName(v:any){
 return String(v||"").replace(/^\s*(?:Resultados|Provas|Atletas|Clubes|Inscrições|Informações)\s*[·:|-]\s*/i,"").replace(/\s+/g," ").trim();
}
function decodeHtml(v:any){
 return String(v||"").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">");
}
function stripHtml(v:any){
 return decodeHtml(String(v||"").replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ")).replace(/\s+/g," ").trim();
}
function parseOfficialMeetPage(html:string){
 const raw=String(html||"");
 const name=canonicalMeetName(decodeHtml((raw.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)||[])[1]||"").replace(/<[^>]+>/g," "));
 const text=stripHtml(raw);
 const marker=/Local da competição/i.exec(raw);
 let venue=null;
 if(marker){
  const tail=raw.slice(marker.index+marker[0].length,marker.index+marker[0].length+2200);
  const chunks=[...tail.matchAll(/>([^<>]+)</g)]
    .map((m:any)=>decodeHtml(m[1]).replace(/\s+/g," ").trim())
    .filter((x:string)=>x&&!/^(?:Google Maps|Pedir corrida|Adicionar à agenda|Local da competição)$/i.test(x));
  venue=chunks[0]||null;
 }
 const cityMatch=text.match(/\b([A-Za-zÀ-ÿ' -]{2,80})\s*\/\s*([A-Z]{2})\s+(?:Piscina Curta|Piscina Longa|Mar)\b/i);
 const courseMatch=text.match(/\b(Piscina Curta|Piscina Longa)\s*[·-]\s*(25|50)m\b/i);
 return {
  canonical_name:name||null,
  venue,
  city:cityMatch?cityMatch[1].trim():null,
  course:courseMatch?(courseMatch[2]==="50"?"LCM":"SCM"):null
 };
}
function tokenScore(a:any,b:any){
 const aa=new Set(n(a).split(" ").filter((x:string)=>x.length>3&&!["campeonato","torneio","trofeu","regiao","mirim","petiz","senior","semestre"].includes(x)));
 const bb=new Set(n(b).split(" ").filter((x:string)=>x.length>3&&!["campeonato","torneio","trofeu","regiao","mirim","petiz","senior","semestre"].includes(x)));
 if(!aa.size||!bb.size)return 0;
 let hit=0;for(const x of aa)if(bb.has(x))hit++;
 return hit/Math.max(aa.size,bb.size);
}
function parseCachedDocHeader(text:any){
 const flat=stripHtml(String(text||"").slice(0,3500));
 const header=flat.match(/([A-Za-zÀ-ÿ' .-]{2,80}),\s*(\d{1,2})(?:\s*-\s*(\d{1,2}))?\/(\d{1,2})\/(\d{4}),\s*(SCM|LCM)\s*\((25|50)m\)/i);
 const named=flat.match(/(?:Federação de Desportos Aquáticos do Paraná|Federacao de Desportos Aquaticos do Parana)\s+(.+?)\s+[A-Za-zÀ-ÿ' .-]{2,80},\s*\d{1,2}(?:\s*-\s*\d{1,2})?\/\d{1,2}\/\d{4},\s*(?:SCM|LCM)/i);
 return {
  start_date:header?String(header[5])+"-"+String(header[4]).padStart(2,"0")+"-"+String(header[2]).padStart(2,"0"):null,
  course:header?header[6].toUpperCase():null,
  name:canonicalMeetName(named?.[1]||flat.slice(0,220))
 };
}
let liveMeetCatalogCache:any[]|null=null;
async function loadLiveMeetCatalog(){
 if(liveMeetCatalogCache)return liveMeetCatalogCache;
 const html=await fetchText("https://www.swimsystem.app/meets",20000);
 const normalized=String(html||"").replace(/\\\"/g,'"');
 const out:any[]=[];
 const re=/"id":"([0-9a-f-]{36})"[\s\S]{0,240}?"name":"([^"]+)"[\s\S]{0,180}?"start_date":"(\d{4}-\d{2}-\d{2})"[\s\S]{0,180}?"end_date":"(\d{4}-\d{2}-\d{2})"[\s\S]{0,500}?"course":(?:"(SCM|LCM)"|null)/gi;
 for(const m of normalized.matchAll(re)){
  out.push({id:m[1],name:decodeHtml(m[2]),start_date:m[3],end_date:m[4],course:m[5]||null});
 }
 liveMeetCatalogCache=[...new Map(out.map((x:any)=>[x.id,x])).values()];
 return liveMeetCatalogCache;
}
async function discoverModernMirror(archive:any){
 const start=String(archive.start_date||"");
 if(!start)return null;
 const candidates:any[]=[];
 try{
  for(const m of await loadLiveMeetCatalog()){
   if(m.start_date!==start)continue;
   if(archive.course&&m.course&&String(archive.course)!==m.course)continue;
   const score=tokenScore(archive.name,m.name);
   if(score>0)candidates.push({id:m.id,score});
  }
 }catch{}
 if(!candidates.length){
  const q=await db.from("official_meet_document_catalog").select("external_id,sample_text,source_url").limit(1000);
  if(q.error)throw q.error;
  for(const d of q.data||[]){
   const meta=parseCachedDocHeader(d.sample_text);
   if(meta.start_date!==start)continue;
   if(archive.course&&meta.course&&String(archive.course)!==meta.course)continue;
   const score=tokenScore(archive.name,meta.name);
   if(score>0)candidates.push({id:String(d.external_id),score});
  }
 }
 candidates.sort((a,b)=>b.score-a.score);
 if(!candidates.length||candidates[0].score<0.34)return null;
 if(candidates[1]&&Math.abs(candidates[0].score-candidates[1].score)<0.08)return null;
 return candidates[0].id;
}
async function meetEvidence(sourceId:string,externalId:string,archive?:any){
 const cached=await db.from("meet_metadata_evidence").select("canonical_name,venue,city,evidence_url,evidence_kind").eq("source_id",sourceId).eq("external_id",externalId).maybeSingle();
 if(cached.error)throw cached.error;
 if(cached.data?.evidence_kind==="auto_official_page"&&cached.data.venue)return cached.data;
 let officialId=/^[0-9a-f-]{36}$/i.test(externalId)?externalId:null;
 if(!officialId&&archive)officialId=await discoverModernMirror(archive);
 if(!officialId)return null;
 const url="https://www.swimsystem.app/meets/sw/"+officialId;
 let html="";try{html=await fetchText(url,18000)}catch{return null}
 const meta=parseOfficialMeetPage(html);
 if(!meta.canonical_name&&!meta.venue)return null;
 const row={source_id:sourceId,external_id:externalId,canonical_name:meta.canonical_name||canonicalMeetName(archive?.name||""),venue:meta.venue,city:meta.city,evidence_url:url,evidence_kind:"auto_official_page",verified_at:new Date().toISOString(),updated_at:new Date().toISOString()};
 const up=await db.from("meet_metadata_evidence").upsert(row,{onConflict:"source_id,external_id"});
 if(up.error)throw up.error;
 return row;
}

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
 const ev=await eventMap();let inserted=0,duplicated=0,promoted=0;
 for(const c of candidates){
  const eid=ev.get(n(c.event));if(!eid)continue;
  const start=c.meetStartDate||archive.start_date||c.resultDate;
  if(!start||!c.resultDate||!c.course)continue;
  const evidence=await meetEvidence(job.source_id,String(archive.event_key),archive);
  const meetUp=await db.from("meets").upsert({
   source_id:job.source_id,external_id:String(archive.event_key),
   name:canonicalMeetName(evidence?.canonical_name||archive.name||("Competição "+archive.event_key)),
   start_date:start,end_date:c.meetEndDate||archive.end_date||null,course:c.course,
   venue:evidence?.venue||undefined,city:evidence?.city||undefined,
   official_url:archive.base_url,status:"completed"
  },{onConflict:"source_id,external_id"}).select("id").single();
  if(meetUp.error)throw meetUp.error;

  const archiveKey=String(archive.event_key);
  const fp=[job.athlete_id,meetUp.data.id,eid,c.resultDate,c.course,c.timeMs??"",c.status].join("|");

  let semantic=db.from("results").select("id,meet_id,meets!inner(external_id,official_url)").eq("athlete_id",job.athlete_id).eq("event_id",eid).eq("result_date",c.resultDate).eq("course",c.course).eq("status",c.status);
  semantic=c.timeMs==null?semantic.is("time_ms",null):semantic.eq("time_ms",c.timeMs);
  const {data:semanticRows,error:semanticError}=await semantic.limit(20);
  if(semanticError)throw semanticError;

  const {data:fingerprintOld,error:fingerprintError}=await db.from("results").select("id,meet_id").eq("result_fingerprint",fp).maybeSingle();
  if(fingerprintError)throw fingerprintError;

  let legacy=db.from("results").select("id,meet_id,meets!inner(external_id,official_url)").eq("athlete_id",job.athlete_id).eq("event_id",eid).eq("course",c.course).eq("status",c.status);
  legacy=c.timeMs==null?legacy.is("time_ms",null):legacy.eq("time_ms",c.timeMs);
  const {data:legacyRows,error:legacyError}=await legacy.limit(30);
  if(legacyError)throw legacyError;
  const verifiedLegacy=(legacyRows||[]).filter((x:any)=>{
   const external=String(x.meets?.external_id||"");
   const official=String(x.meets?.official_url||"");
   return external.startsWith("legacy-")&&(
    external===archiveKey||
    external.endsWith(":sw-"+archiveKey)||
    official.includes("/meets/sw/"+archiveKey)
   )
  });

  const canonicalSemantic=(semanticRows||[]).find((x:any)=>{
   const external=String(x.meets?.external_id||"");
   return x.meet_id===meetUp.data.id||external===archiveKey
  })||null;

  let rid=fingerprintOld?.id||canonicalSemantic?.id||null;
  let promotedCandidate=false;

  if(!rid&&verifiedLegacy.length){
   const legacyMatch=verifiedLegacy[0];
   const up=await db.from("results").update({
    meet_id:meetUp.data.id,result_date:c.resultDate,course:c.course,time_ms:c.timeMs,status:c.status,
    origin:"official",source_id:job.source_id,is_official:true,result_fingerprint:fp,
    category:categoryFor(c.resultDate,athlete.birth_date,athlete.category)
   }).eq("id",legacyMatch.id).select("id").single();
   if(up.error)throw up.error;
   rid=up.data.id;promoted++;promotedCandidate=true;
  }

  if(!rid){
   const ins=await db.from("results").insert({
    athlete_id:job.athlete_id,meet_id:meetUp.data.id,event_id:eid,result_date:c.resultDate,course:c.course,
    time_ms:c.timeMs,status:c.status,origin:"official",source_id:job.source_id,is_official:true,
    result_fingerprint:fp,category:categoryFor(c.resultDate,athlete.birth_date,athlete.category)
   }).select("id").single();
   if(ins.error){
    if((ins.error as any).code==="23505"){
     const q=await db.from("results").select("id").eq("result_fingerprint",fp).maybeSingle();
     if(q.error)throw q.error;rid=q.data?.id||null;duplicated++;
    }else throw ins.error;
   }else{rid=ins.data.id;inserted++}
  }else if(!promotedCandidate)duplicated++;

  if(rid){
   for(const old of verifiedLegacy.filter((x:any)=>x.id!==rid)){
    const sq=await db.from("result_sources").select("source_id,source_url,external_id,retrieved_at,raw_hash,metadata").eq("result_id",old.id);
    if(sq.error)throw sq.error;
    for(const src of sq.data||[]){
     const moved=await db.from("result_sources").upsert({
      result_id:rid,source_id:src.source_id,source_url:src.source_url,
      external_id:src.external_id||src.source_url,retrieved_at:src.retrieved_at,
      raw_hash:src.raw_hash,metadata:{...(src.metadata||{}),reconciled_by:"import-v2"}
     },{onConflict:"result_id,source_id,external_id"});
     if(moved.error)throw moved.error;
    }
    const del=await db.from("results").delete().eq("id",old.id);
    if(del.error)throw del.error;
    promoted++;
   }
   const prov=await db.from("result_sources").upsert({
    result_id:rid,source_id:job.source_id,source_url:c.sourceUrl,external_id:c.sourceUrl,retrieved_at:c.retrievedAt,
    raw_hash:null,metadata:{engine:"v2",parser_version:c.parserVersion,source_block:c.sourceBlock}
   },{onConflict:"result_id,source_id,external_id"});
   if(prov.error)throw prov.error;
  }
 }
 return {inserted,duplicated,promoted};
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
  if(source.code==="fdap"||source.code==="swimsystem"){
   const refreshed=await db.rpc("refresh_official_meet_document_catalog");
   if(refreshed.error)throw refreshed.error;
  }
  cursor.discovery_done=true;cursor.archive_index=0;cursor.pdf_cursor=0;
 }
 const aq=await db.from("historical_archives").select("*").eq("source_id",job.source_id).order("created_at",{ascending:true});
 if(aq.error)throw aq.error;
 const archives=aq.data||[];
 const ai=Number(cursor.archive_index||0);
 if(ai>=archives.length)return {done:true,cursor,found:0,inserted:0,duplicated:0};
 const a=archives[ai],retrievedAt=new Date().toISOString(),docs:any[]=[];
 if(a.provider==="masters_parana"){
  const txt=await readerText(a.base_url);
  if(n(txt).includes(n(identity.canonicalName))||identity.aliases.some((x:string)=>n(txt).includes(n(x))))docs.push({externalMeetId:String(a.event_key),url:a.base_url,text:txt});
 }else if(a.provider==="swimsystem_v2"){
  const cached=await db.from("historical_document_text_cache").select("url,text_content").eq("fetch_status","ok").like("url","%/meet-documents/"+String(a.event_key)+"/%").limit(100);
  if(cached.error)throw cached.error;
  for(const d of cached.data||[]){if(String(d.text_content||"").includes(identity.externalId))docs.push({externalMeetId:String(a.event_key),url:d.url,text:d.text_content})}
  const base=String(a.base_url).replace(/\/results\/?$/,""),html=await fetchText(base);
  const links=pdfLinks(html);
  const pi=Number(cursor.pdf_cursor||0),batch=links.slice(pi,pi+3);
  for(const u of batch){
   if(docs.some((d:any)=>d.url===u))continue;
   const txt=await readerText(u);if(String(txt).includes(identity.externalId))docs.push({externalMeetId:String(a.event_key),url:u,text:txt})
  }
  const next=pi+batch.length;
  if(next<links.length){
   const pack=historicalDryRun({identity,archives:[{externalMeetId:String(a.event_key),sourceCode:source.code,course:a.course,provider:a.provider,startDate:a.start_date,endDate:a.end_date,name:a.name}],documents:docs,retrievedAt});
   if(docs.length&&pack.accepted.length===0&&a.provider!=="masters_parana"&&a.provider!=="swimsystem_v2"){const e:any=new Error("parser no match");e.parserMatched=false;throw e}
   const p=await persistCandidates(job,a,pack.accepted,athlete);
   return {done:false,cursor:{...cursor,archive_index:ai,pdf_cursor:next},found:pack.accepted.length,inserted:p.inserted,duplicated:p.duplicated};
  }
 }else{
  const cq=await db.from("historical_document_text_cache").select("url,text_content").eq("fetch_status","ok").like("url",String(a.base_url).replace(/%/g,"")+"%").limit(500);
  for(const d of cq.data||[]){if(/ResultList_/i.test(d.url)&&String(d.text_content||"").includes(identity.externalId))docs.push({externalMeetId:String(a.event_key),url:d.url,text:d.text_content})}
 }
 const pack=historicalDryRun({identity,archives:[{externalMeetId:String(a.event_key),sourceCode:source.code,course:a.course,provider:a.provider,startDate:a.start_date,endDate:a.end_date,name:a.name}],documents:docs,retrievedAt});
 if(docs.length&&pack.accepted.length===0&&a.provider!=="masters_parana"&&a.provider!=="swimsystem_v2"){const e:any=new Error("parser no match");e.parserMatched=false;throw e}
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
  const meta=await meetEvidence(job.source_id,id,{event_key:id,name:evidence?.name||("SwimSystem "+id),start_date:evidence.startDate,course:evidence.course});
  const mq=await db.from("meets").upsert({
   source_id:job.source_id,external_id:id,
   name:canonicalMeetName(meta?.canonical_name||("SwimSystem "+id)),
   start_date:evidence.startDate,end_date:evidence.endDate||null,course:evidence.course,
   official_url:base,status:"scheduled",venue:meta?.venue||null,city:meta?.city||evidence.city||null
  },{onConflict:"source_id,external_id"}).select("id").single();
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
 let externalId=String(cq.data?.external_id||iq.data?.external_id||"").trim();
 if(!externalId&&sq.data.code==="fdap"){
  const ss=await db.from("sources").select("id").eq("code","swimsystem").maybeSingle();
  if(ss.data?.id){
   const sc=await db.from("athlete_source_configs").select("external_id").eq("athlete_id",job.athlete_id).eq("source_id",ss.data.id).eq("active",true).maybeSingle();
   const si=await db.from("athlete_identifiers").select("external_id").eq("athlete_id",job.athlete_id).eq("source_id",ss.data.id).eq("active",true).maybeSingle();
   externalId=String(sc.data?.external_id||si.data?.external_id||"").trim();
  }
 }
 const canonicalName=cq.data?.external_name||iq.data?.external_name||aq.data.full_name;
 if(!externalId&&job.job_type==="current_meet"){const e:any=new Error("parser no match: missing external identity");e.parserMatched=false;throw e}
 if(!externalId&&job.job_type==="historical"&&sq.data.code!=="masters_parana")return {done:true,cursor:{},found:0,inserted:0,duplicated:0};
 const identity={externalId,canonicalName,aliases:[aq.data.full_name,aq.data.preferred_name,cq.data?.external_name,iq.data?.external_name].filter(Boolean)};
 return job.job_type==="current_meet"?await processCurrent(job,identity):await processHistorical(job,sq.data,identity,aq.data);
}
Deno.serve(async()=>{
 try{
  const claim=await db.rpc("claim_import_v2_jobs",{p_limit:1});if(claim.error)throw claim.error;
  const jobs=claim.data||[];if(!jobs.length)return json({ok:true,processed:0});
  const job=jobs[0],started=Date.now();let state={...job},found=0,inserted=0,duplicated=0,done=false;
  try{
   while(Date.now()-started<70000&&!done){
    const r=await process(state);found+=r.found;inserted+=r.inserted;duplicated+=r.duplicated;done=r.done;
    state={...state,cursor:r.cursor,records_found:Number(state.records_found||0)+r.found,records_inserted:Number(state.records_inserted||0)+r.inserted,records_duplicated:Number(state.records_duplicated||0)+r.duplicated};
   }
   await db.from("import_v2_jobs").update({
    status:done?"completed":"pending",cursor:done?{}:state.cursor,locked_at:null,next_run_at:done?null:new Date(Date.now()+5000).toISOString(),
    last_error:null,failure_code:null,records_found:state.records_found,records_inserted:state.records_inserted,records_duplicated:state.records_duplicated
   }).eq("id",job.id).eq("status","running");
   return json({ok:true,processed:1,job_id:job.id,done,found,inserted,duplicated});
  }catch(e:any){
   const f=classifyImportFailure({error:e,message:e?.message,httpStatus:e?.httpStatus,parserMatched:e?.parserMatched});
   const retry=f.retryable&&Number(job.attempts||0)<3;
   await db.from("import_v2_jobs").update({status:retry?"pending":"failed",locked_at:null,next_run_at:retry?new Date(Date.now()+60000).toISOString():null,failure_code:f.code,last_error:String(e?.message||e).slice(0,1000)}).eq("id",job.id).eq("status","running");
   return json({ok:retry,processed:1,job_id:job.id,retry,failure_code:f.code,error:String(e?.message||e)},retry?200:500);
  }
 }catch(e:any){return json({ok:false,error:String(e?.message||e)},500)}
});