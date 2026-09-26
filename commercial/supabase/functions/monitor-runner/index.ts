import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import * as cheerio from "npm:cheerio@1.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
const json=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{"content-type":"application/json"}});
const n=(s='')=>String(s).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/\s+/g,' ').trim();
const meetBase=(u:string)=>String(u).replace(/\/(athletes|results)\/?$/,'').replace(/\/$/,'');
function parseTime(v:string){const s=String(v||'').trim().replace(',','.').replace(/[”″]/g,'"').replace(/[’′]/g,"'");if(!s)return null;let m=s.match(/^(\d+):(\d{1,2})(?:\.(\d{1,2}))?$/);if(m)return Math.round((Number(m[1])*60+Number(m[2])+Number(`0.${m[3]||'0'}`))*1000);m=s.match(/^(\d+)['’](\d{1,2})["”]?(\d{1,2})?$/);if(m)return Math.round((Number(m[1])*60+Number(m[2])+Number(`0.${m[3]||'0'}`))*1000);m=s.match(/^(\d{1,3})["”](\d{1,2})$/);if(m)return Math.round((Number(m[1])+Number(`0.${m[2]}`))*1000);m=s.match(/^(\d{1,3})(?:\.(\d{1,2}))?$/);if(m)return Math.round((Number(m[1])+Number(`0.${m[2]||'0'}`))*1000);return null}
async function get(url:string){const c=new AbortController();const t=setTimeout(()=>c.abort(),12000);try{const r=await fetch(url,{headers:{"user-agent":"VINISWIM Commercial Monitor/1.0"},signal:c.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.text()}finally{clearTimeout(t)}}
async function quickReaderText(url:string){
 const {data:cached}=await db.from('historical_document_text_cache').select('text_content,fetch_status').eq('url',url).maybeSingle();
 if(cached?.fetch_status==='ok'&&cached.text_content)return cached.text_content;
 const target='https://r.jina.ai/http://'+url.replace(/^https?:\/\//i,'');
 const c=new AbortController();
 const t=setTimeout(()=>c.abort(),18000);
 try{
   const r=await fetch(target,{headers:{"Accept":"text/plain","user-agent":"VINISWIM Historical Batch/1.0"},signal:c.signal});
   const text=await r.text();
   if(!r.ok||!text||/403 Forbidden|429 Too Many Requests/i.test(text))throw new Error(`Reader HTTP ${r.status}`);
   await db.from('historical_document_text_cache').upsert({
     url,text_content:text,fetch_status:'ok',http_status:r.status,error_message:null,
     fetched_at:new Date().toISOString(),updated_at:new Date().toISOString()
   },{onConflict:'url'});
   return text
 }finally{clearTimeout(t)}
}


function names(i:any){return [i.external_name,i.athletes?.full_name,i.athletes?.preferred_name].filter(Boolean).map((x:any)=>n(x))}
function words(s:string){return n(s).replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(Boolean)}
function looseNameMatch(text:string,name:string){
 const hay=words(text),needle=words(name); if(needle.length<2)return false;
 const raw=n(text),exact=n(name); if(exact&&raw.includes(exact))return true;
 const set=new Set(hay),first=needle[0],last=needle[needle.length-1];
 if(!set.has(first)||!set.has(last))return false;
 const middle=needle.slice(1,-1).filter(w=>!['de','da','do','dos','das'].includes(w));
 if(middle.length<=1)return true;
 const hits=middle.filter(w=>set.has(w)||hay.some(h=>h.length===1&&h===w[0])).length;
 return hits>=Math.ceil(middle.length/2)
}
function match(text:string,i:any){
 const x=n(text),id=n(i.external_id||''); if(id&&x.includes(id))return true;
 return names(i).some((y:string)=>y&&looseNameMatch(text,y))
}
function resultStatus(text:string){
 const s=n(text); if(/\bdns\b|nao compareceu/.test(s))return 'dns';
 if(/\bdql\b|\bdsq\b|\bdq\b|desclassific/.test(s))return 'dsq';
 if(/\bdnf\b|nao completou|abandonou/.test(s))return 'dnf';
 return null
}
function eventFrom(text:string){
 const m=text.match(/((?:\d+x)?\d{2,4})\s*m?\s+(Livre|Costas|Peito|Borboleta|Medley)/i);
 return m ? (m[1]+' '+m[2]) : null
}
function dateFrom(text:string){
 const m=text.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
 return m ? (m[3]+'-'+m[2]+'-'+m[1]) : null
}
function resultEventDate(text:string){
 const m=text.match(/\b(\d{2})\/(\d{2})\/(\d{4})\s*-\s*\d{1,2}:\d{2}\s*Resultados\b/i);
 return m ? (m[3]+'-'+m[2]+'-'+m[1]) : null
}
function historicalMeetDate(text:string){
 const range=text.match(/\b(\d{1,2})\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
 if(range)return range[4]+'-'+String(range[3]).padStart(2,'0')+'-'+String(range[1]).padStart(2,'0');
 const slash=text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
 if(slash)return slash[3]+'-'+String(slash[2]).padStart(2,'0')+'-'+String(slash[1]).padStart(2,'0');
 const pub=text.match(/Published Time:\s*\w+,\s*(\d{1,2})\s+(\w{3})\s+(\d{4})/i);
 if(pub){const mm:any={jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};const m=mm[pub[2].toLowerCase()];if(m)return pub[3]+'-'+m+'-'+String(pub[1]).padStart(2,'0')}
 return null
}

function parseMeet(html:string,url:string){
 const $=cheerio.load(html),body=$('body').text().replace(/\s+/g,' ');
 const title=$('title').first().text().replace(/\s*-\s*SPLASH.*$/i,'').trim();
 return {
  externalId:meetBase(url).split('/').pop()||meetBase(url),
  name:title||$('h1').first().text().trim()||'Campeonato',
  startDate:dateFrom(body),
  course:/\b25\s*m\b/i.test(body)?'SCM':/\b50\s*m\b/i.test(body)?'LCM':null,
  officialUrl:meetBase(url)
 }
}
function athleteHistoricalEvents(text:string,i:any){
 const lines=text.split(/\r?\n/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean),out:string[]=[];
 let active=false;
 for(const line of lines){
  if(/\b(19|20)\d{2}\s*\(\d+\s*Anos?\)/i.test(line)){active=names(i).some((nm:string)=>looseNameMatch(line,nm));continue}
  if(!active)continue;
  const rx=/((?:\d+x)?\d{2,4})m\s+(Livre|Costas|Peito|Borboleta|Medley)\b/gi; let m;
  while((m=rx.exec(line))){
   if(/x/i.test(m[1]))continue;
   const label=m[1]+' '+m[2]; if(!out.some(x=>n(x)===n(label)))out.push(label)
  }
 }
 return out
}
function categoryCodeFor(year:number,birthDate?:string|null){
 if(!year||!birthDate)return null; const by=Number(String(birthDate).slice(0,4)),age=year-by;
 return age===9?'M1':age===10?'M2':age===11?'P1':age===12?'P2':null
}
function categoryLabelFor(resultDate:string|null,birthDate?:string|null,current?:string|null){
 if(!resultDate||!birthDate)return current||null;
 const age=Number(String(resultDate).slice(0,4))-Number(String(birthDate).slice(0,4));
 const labels:any={9:'Mirim I',10:'Mirim II',11:'Petiz I',12:'Petiz II',13:'Infantil I',14:'Infantil II',15:'Juvenil I',16:'Juvenil II',17:'Júnior I',18:'Júnior II',19:'Sênior',20:'Sênior'};
 if(labels[age])return labels[age];
 if(age>=25)return 'Master';
 return current||null
}
function historicalCity(text:string){
 const m=String(text||'').match(/\b([A-ZÀ-Ý][A-Za-zÀ-ÿ .'-]{2,40}),\s*\d{1,2}(?:-\d{1,2})?\/\d{1,2}\/\d{4}/);
 return m?m[1].trim():null
}
function historicalLinks(html:string,base:string,eventLabels:string[],categoryCode:string|null){
 const $=cheerio.load(html),out:any[]=[]; let stroke='';
 $('tr').each((_,tr)=>{
  const row=$(tr),txt=row.text().replace(/\s+/g,' ').trim(),simple=n(txt);
  const styles=['Livre','Costas','Peito','Borboleta','Medley'];
  const direct=txt.match(/((?:\d+\s*x\s*)?\d{2,4})\s*m\s+(Livre|Costas|Peito|Borboleta|Medley)/i);
  let ev='';
  if(direct&&!/x/i.test(direct[1]))ev=direct[1].replace(/\s+/g,'')+' '+direct[2];
  else{
   const styleName=styles.find(s=>simple.includes(n(s)))||'';
   const hasDistance=/(?:\d+\s*x\s*)?\d{2,4}\s*m/i.test(txt);
   if(styleName&&!hasDistance&&txt.length<100){stroke=styleName;return}
   const dm=txt.match(/((?:\d+\s*x\s*)?\d{2,4})\s*m/i);
   if(!dm||!stroke||/x/i.test(dm[1]))return;
   ev=dm[1].replace(/\s+/g,'')+' '+stroke
  }
  if(!eventLabels.some(x=>n(x)===n(ev)))return;
  if(categoryCode){
   const family=/^P/i.test(categoryCode)?'petiz':/^M/i.test(categoryCode)?'mirim':'';
   if(family&&!simple.includes(family))return
  }
  row.find('a[href]').each((__,a)=>{
   const href=$(a).attr('href')||'',label=n($(a).text());
   if(!/ResultList_\d+\.pdf/i.test(href)&&!/result/i.test(label))return;
   try{out.push({url:new URL(href,base).toString(),label:ev,context:txt})}catch{}
  })
 });
 return [...new Map(out.map((x:any)=>[x.url,x])).values()]
}
function extractOfficialRowTime(line:string,externalId:string){
 const raw=String(line||'').replace(/\s+/g,' ').trim();
 let after=raw;
 const id=String(externalId||'').trim();
 if(id){
  const p=raw.indexOf(id);
  if(p<0)return null;
  after=raw.slice(p+id.length);
 }
 const patterns=[
  /(\d{1,2}:\d{2}\.\d{2}|\d{1,3}\.\d{2})(?=\s*\d{2,3}%)/,
  /(\d{1,2}:\d{2}\.\d{2}|\d{1,3}\.\d{2})(?=\s*--)/,
  /(\d{1,2}:\d{2}\.\d{2}|\d{1,3}\.\d{2})(?=\s*-\s*-)/,
  /(\d{1,2}:\d{2}\.\d{2}|\d{1,3}\.\d{2})(?=\s+\d{1,2},\d{2})/
 ];
 for(const rx of patterns){
  const m=after.match(rx);
  if(m){
   const v=parseTime(m[1]);
   if(v!=null&&v>5000&&v<1800000)return v
  }
 }
 return null
}
function parseHistoricalResultText(text:string,url:string,i:any,expectedLabel:string,course:any){
 const body=String(text||'').replace(/\r/g,'');
 const eventDate=resultEventDate(body);
 const lines=body.split(/\n+/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
 const id=String(i.external_id||'').trim();
 const athleteLines=lines.filter(line=>{
  if(id&&line.includes(id))return true;
  return names(i).some((nm:string)=>looseNameMatch(line,nm))
 });
 const out:any[]=[];
 for(const line of athleteLines){
  if(!match(line,i))continue;
  const st=resultStatus(line);
  const timeMs=extractOfficialRowTime(line,id);
  if(timeMs==null&&!st)continue;
  const date=eventDate||dateFrom(body);
  out.push({eventLabel:expectedLabel,timeMs,status:st||'valid',sourceUrl:url,resultDate:date,course})
 }
 return out
}
function discover(html:string,base:string){
 const $=cheerio.load(html),out=new Map<string,string>();
 $('a[href*="?e="],a[href*="&e="]').each((_,a)=>{
  try{
   const u=new URL($(a).attr('href')||'',base),id=u.searchParams.get('e');
   if(id){const p=new URL(meetBase(base)+'/results');p.searchParams.set('e',id);out.set(p.toString(),$(a).text().replace(/\s+/g,' ').trim())}
  }catch{}
 });
 return [...out].map(([url,label])=>({url,label}))
}
function discoverGeneric(html:string,base:string){
 const $=cheerio.load(html),out=new Map<string,string>(); let host=''; try{host=new URL(base).hostname}catch{}
 $('a[href]').each((_,a)=>{
  try{
   const href=$(a).attr('href')||'',u=new URL(href,base),label=$(a).text().replace(/\s+/g,' ').trim();
   if(u.hostname!==host)return; const key=n(label+' '+u.pathname);
   if(/result|resultado|prova|evento|campeonato|atleta|athlete|ranking|baliz|master|tempo/.test(key))out.set(u.toString(),label)
  }catch{}
 });
 return [...out].map(([url,label])=>({url,label})).slice(0,60)
}
function parseGeneric(html:string,url:string,i:any){
 const $=cheerio.load(html),body=$('body').text().replace(/\s+/g,' '),course=/\b25\s*m\b/i.test(body)?'SCM':/\b50\s*m\b/i.test(body)?'LCM':null,pageDate=dateFrom(body),out:any[]=[];
 $('tr').each((_,tr)=>{
  const row=$(tr).text().replace(/\s+/g,' ').trim(); if(!row||!match(row,i))return;
  const eventLabel=eventFrom(row); if(!eventLabel)return; const st=resultStatus(row),cells=$(tr).find('td').toArray().map(td=>$(td).text().replace(/\s+/g,' ').trim());
  let timeMs=null; for(const cell of [...cells].reverse()){const v=parseTime(cell);if(v!=null){timeMs=v;break}}
  if(timeMs==null&&!st)return; out.push({eventLabel,timeMs,status:st||'valid',sourceUrl:url,resultDate:dateFrom(row)||pageDate,course})
 });
 return out
}
function parseEntries(html:string,i:any){
 const $=cheerio.load(html),out:any[]=[];
 $('body *').each((_,el)=>{
  const text=$(el).text().replace(/\s+/g,' ').trim(); if(text.length<20||text.length>1600||!match(text,i))return;
  const rx=/(?:\d{1,2}:\d{2}\s+)?((?:\d+x)?\d{2,4})\s*m?\s+(Livre|Costas|Peito|Borboleta|Medley)(?:.*?S[eé]rie\s*(\d+))?(?:.*?Raia\s*(\d+))?/gi; let m;
  while((m=rx.exec(text))){const eventLabel=m[1]+' '+m[2];if(out.some(e=>n(e.eventLabel)===n(eventLabel)))continue;out.push({eventLabel,seedTimeMs:null,heat:m[3]?Number(m[3]):null,lane:m[4]?Number(m[4]):null})}
 });
 return out
}
function parseResults(html:string,url:string,label:string,i:any,course:any,resultDate:any){
 const $=cheerio.load(html),eventLabel=eventFrom(label)||eventFrom($('h1,h2,h3').text())||'',out:any[]=[];
 $('tr').each((_,tr)=>{
  const row=$(tr).text().replace(/\s+/g,' ').trim();if(!match(row,i))return;
  const cells=$(tr).find('td').toArray().map(td=>$(td).text().replace(/\s+/g,' ').trim()),st=resultStatus(row);let timeMs=null;
  for(const c of [...cells].reverse()){const v=parseTime(c);if(v!=null){timeMs=v;break}}
  if(timeMs==null&&!st)return;out.push({eventLabel,timeMs,status:st||'valid',sourceUrl:url,resultDate,course})
 });
 return out
}
async function eventMap(){const {data}=await db.from('events').select('id,label');return new Map((data||[]).map((e:any)=>[n(e.label),e.id]))}
async function createNotifications(athleteId:string,resultId:string,eventId:string,status:string,label:string,course:string){return}

async function ensureArchiveJobsForDiscovered(j:any,i:any){
 const discovered=new Set<string>(await discoverHistoricalBases(i));
 // Internal catalog is only an accelerator/cache; discovery does not depend on the user maintaining it.
 const {data:catalogSource}=await db.from('sources').select('id').eq('code','fdap').maybeSingle();
 if(catalogSource?.id){
  const {data:docs}=await db.from('historical_source_documents').select('base_url').eq('source_id',catalogSource.id).eq('active',true);
  for(const d of docs||[])if(d.base_url)discovered.add(String(d.base_url).replace(/\/$/,'')+'/')
 }
 // Reuse official URLs already proven by this athlete as another discovery signal.
 const {data:prior}=await db.from('result_sources').select('source_url,results!inner(athlete_id)').eq('results.athlete_id',j.athlete_id);
 for(const x of prior||[]){try{const u=new URL(String(x.source_url||''));const m=u.pathname.match(/^\/(\d{4,8})\//);if(m)discovered.add('https://swimsystem.swimtimebrasil.com/'+m[1]+'/')}catch{}}
 const {data:archiveSource}=await db.from('sources').select('id').eq('code','fdap').maybeSingle();
 if(!archiveSource?.id)return;
 for(const base of discovered){
  const eventKey=base.split('/').filter(Boolean).pop(); if(!eventKey)continue;
  const {data:existing}=await db.from('historical_archives').select('id').eq('event_key',eventKey).maybeSingle();
  let archiveId=existing?.id;
  if(!archiveId){
   try{
    const html=await get(base),parsed=parseMeet(html,base);
    const progression=await quickReaderText(new URL('ProgressionDetails.pdf',base).toString());
    const officialDate=historicalMeetDate(progression);
    if(!officialDate)continue;
    const row={source_id:archiveSource.id,provider:'swimsystem',event_key:eventKey,name:parsed.name||('SwimSystem '+eventKey),base_url:base,start_date:officialDate,end_date:parsed.endDate||null,course:parsed.course||null,active:true,updated_at:new Date().toISOString()};
    const ins=await db.from('historical_archives').insert(row).select('id').single();
    if(ins.error){console.error('ARCHIVE_CREATE',eventKey,ins.error.message);continue} archiveId=ins.data.id
   }catch(e){console.error('ARCHIVE_DISCOVERY',eventKey,String(e));continue}
  }
  if(archiveId)await db.from('historical_archive_jobs').upsert({athlete_id:j.athlete_id,archive_id:archiveId,status:'pending',updated_at:new Date().toISOString()},{onConflict:'athlete_id,archive_id',ignoreDuplicates:true})
 }
}
async function processArchiveJob(aj:any){
 const now=()=>new Date().toISOString();
 const beat=async()=>{await db.from('historical_archive_jobs').update({heartbeat_at:now(),updated_at:now()}).eq('id',aj.id)};
 try{
   const {data:archive,error:archiveError}=await db.from('historical_archives').select('*,sources(code,name)').eq('id',aj.archive_id).single();
   if(archiveError||!archive)throw new Error('Arquivo histórico não encontrado');
   let {data:cfg}=await db.from('athlete_source_configs').select('*').eq('athlete_id',aj.athlete_id).eq('source_id',archive.source_id).eq('active',true).maybeSingle();
   let identifierSourceId=archive.source_id;
   if(!cfg && archive.sources?.code==='fdap'){
     const {data:ss}=await db.from('sources').select('id').eq('code','swimsystem').maybeSingle();
     if(ss?.id){
       const q=await db.from('athlete_source_configs').select('*').eq('athlete_id',aj.athlete_id).eq('source_id',ss.id).eq('active',true).maybeSingle();
       cfg=q.data||null;
       if(cfg)identifierSourceId=ss.id;
     }
   }
   if(!cfg)throw new Error('Fonte histórica não configurada para o atleta');
   const {data:athlete}=await db.from('athletes').select('full_name,preferred_name,birth_date,gender,category').eq('id',aj.athlete_id).single();
   const {data:idn}=await db.from('athlete_identifiers').select('*').eq('athlete_id',aj.athlete_id).eq('source_id',identifierSourceId).maybeSingle();
   const i={...(idn||{}),external_id:cfg.external_id,external_name:cfg.external_name,athletes:athlete};

   let payload=aj.cursor_payload||{};
   let links:any[]=Array.isArray(payload.links)?payload.links:[];
   let meet:any=payload.meet||null;

   if(!links.length||!meet){
     await beat();
     const base=archive.base_url,html=await get(base),parsed=parseMeet(html,base);
     meet={
       ...parsed,
       externalId:archive.event_key||parsed.externalId,
       name:archive.name||parsed.name,
       startDate:archive.start_date||parsed.startDate,
       endDate:archive.end_date||null,
       course:archive.course||parsed.course,
       officialUrl:base
     };
     const progressionUrl=new URL('ProgressionDetails.pdf',base).toString();
     const progression=await quickReaderText(progressionUrl);
     meet.city=meet.city||historicalCity(progression)||historicalCity(html);
     const archiveDate=historicalMeetDate(progression);
     if(archiveDate)meet.startDate=archiveDate;
     const athleteEvents=athleteHistoricalEvents(progression,i);
     if(!athleteEvents.length){
       await db.from('historical_archive_jobs').update({
         status:'completed',records_found:0,records_inserted:0,records_promoted:0,
         heartbeat_at:null,finished_at:now(),updated_at:now(),
         cursor_index:0,cursor_payload:{meet,links:[]}
       }).eq('id',aj.id);
       return
     }
     const year=Number(String(meet.startDate||'').slice(0,4))||new Date().getFullYear();
     const categoryCode=categoryCodeFor(year,athlete?.birth_date);
     links=historicalLinks(html,base,athleteEvents,categoryCode);
     payload={meet,links};
     await db.from('historical_archive_jobs').update({
       cursor_payload:payload,cursor_index:0,heartbeat_at:now(),updated_at:now()
     }).eq('id',aj.id);
     aj.cursor_index=0
   }

   const startAt=Number(aj.cursor_index||0);
   const batch=links.slice(startAt,startAt+2);
   if(!batch.length){
     await db.from('historical_archive_jobs').update({
       status:'completed',heartbeat_at:null,finished_at:now(),updated_at:now()
     }).eq('id',aj.id);
     return
   }

   const mq=await db.from('meets').upsert({
     source_id:archive.source_id,
     external_id:meet.externalId,
     name:meet.name,
     start_date:meet.startDate||null,
     end_date:meet.endDate||null,
     course:meet.course,
     city:meet.city||null,
     official_url:meet.officialUrl,
     status:'completed'
   },{onConflict:'source_id,external_id'}).select('id,start_date,course').single();
   if(mq.error)throw new Error('Meet histórico: '+mq.error.message);
   const m=mq.data,ev=await eventMap();

   let foundAdd=0,insertedAdd=0,promotedAdd=0;
   for(const l of batch){
     await beat();
     const txt=await quickReaderText(l.url);
     const parsed=parseHistoricalResultText(txt,l.url,i,l.label,meet.course);
     const seen=new Set<string>();
     for(const r of parsed){
       const eid=ev.get(n(r.eventLabel));if(!eid)continue;
       const date=m.start_date,course=r.course||m.course;
       if(!date||!course)continue;
       const key=[eid,date,course,r.timeMs,r.status].join('|');
       if(seen.has(key))continue;seen.add(key);foundAdd++;
       let q=db.from('results').select('id,is_official,origin').eq('athlete_id',aj.athlete_id).eq('event_id',eid).eq('result_date',date).eq('course',course).eq('status',r.status);
       q=r.timeMs==null?q.is('time_ms',null):q.eq('time_ms',r.timeMs);
       const {data:old}=await q.maybeSingle();
       if(!old){
         let cq=db.from('results').select('id,result_date,status,is_official').eq('athlete_id',aj.athlete_id).eq('event_id',eid).eq('course',course);
         cq=r.timeMs==null?cq.is('time_ms',null):cq.eq('time_ms',r.timeMs);
         const {data:candidates}=await cq.limit(5);
         const stale=(candidates||[]).find((x:any)=>x.is_official&&x.result_date!==date);
         if(stale){
           const fp2=[aj.athlete_id,m.id,eid,date,course,r.timeMs,r.status].join('|');
           await db.from('results').update({meet_id:m.id,result_date:date,status:r.status,source_id:archive.source_id,category:categoryLabelFor(date,athlete?.birth_date,athlete?.category),result_fingerprint:fp2,updated_at:now()}).eq('id',stale.id);
           await db.from('result_sources').upsert({result_id:stale.id,source_id:archive.source_id,source_url:r.sourceUrl,retrieved_at:now(),metadata:{historical_archive:archive.event_key}},{onConflict:'result_id,source_id'});
           promotedAdd++;continue
         }
       }
       if(old){
         if(!old.is_official){
           await db.from('results').update({
             meet_id:m.id,origin:'official',source_id:archive.source_id,is_official:true,
             notes:'Confirmado por arquivo histórico oficial.',updated_at:now()
           }).eq('id',old.id);
           await db.from('result_sources').upsert({
             result_id:old.id,source_id:archive.source_id,source_url:r.sourceUrl,
             retrieved_at:now(),metadata:{historical_archive:archive.event_key}
           },{onConflict:'result_id,source_id'});
           promotedAdd++
         }
         continue
       }
       const fp=[aj.athlete_id,m.id,eid,date,course,r.timeMs,r.status].join('|');
       const ins=await db.from('results').insert({
         athlete_id:aj.athlete_id,meet_id:m.id,event_id:eid,result_date:date,course,
         time_ms:r.timeMs,status:r.status,origin:'official',source_id:archive.source_id,
         is_official:true,category:categoryLabelFor(date,athlete?.birth_date,athlete?.category),result_fingerprint:fp
       }).select('id').single();
       if(ins.error)throw new Error('Resultado histórico: '+ins.error.message);
       insertedAdd++;
       await db.from('result_sources').insert({
         result_id:ins.data.id,source_id:archive.source_id,source_url:r.sourceUrl,
         retrieved_at:now(),metadata:{historical_archive:archive.event_key}
       })
     }
   }

   const nextIndex=startAt+batch.length;
   const done=nextIndex>=links.length;
   await db.from('historical_archive_jobs').update({
     status:done?'completed':'pending',
     cursor_index:nextIndex,
     records_found:Number(aj.records_found||0)+foundAdd,
     records_inserted:Number(aj.records_inserted||0)+insertedAdd,
     records_promoted:Number(aj.records_promoted||0)+promotedAdd,
     heartbeat_at:null,
     finished_at:done?now():null,
     last_error:null,
     updated_at:now()
   }).eq('id',aj.id)
 }catch(e:any){
   await db.from('historical_archive_jobs').update({
     status:'failed',heartbeat_at:null,last_error:String(e?.message||e).slice(0,1000),
     finished_at:now(),updated_at:now()
   }).eq('id',aj.id);
   throw e
 }
}

async function processLink(r:any){if(r.sources?.code!=='swimsystem')throw new Error('Fonte sem adaptador');const raw=r.current_meet_url;if(!raw)throw new Error('URL do campeonato atual não informada');const u=new URL(raw);if(!/(^|\.)swimsystem\.app$/i.test(u.hostname))throw new Error('URL fora do SwimSystem');const i={external_id:r.external_id,external_name:null,athletes:r.athletes};const html=await get(meetBase(raw)+'/athletes');if(!match(cheerio.load(html)('body').text(),i)){await db.from('source_link_requests').update({status:'rejected',message:'Registro/nome não encontrado',processed_at:new Date().toISOString()}).eq('id',r.id);return}const metadata={current_meet_url:raw};await db.from('athlete_identifiers').upsert({athlete_id:r.athlete_id,source_id:r.source_id,external_id:r.external_id,status:'active',verified:true,verified_at:new Date().toISOString(),active:true,metadata},{onConflict:'athlete_id,source_id'});await db.from('source_link_requests').update({status:'verified',message:'Vínculo validado',processed_at:new Date().toISOString()}).eq('id',r.id);await db.from('athletes').update({status:'active'}).eq('id',r.athlete_id);await db.from('monitor_jobs').upsert({athlete_id:r.athlete_id,source_id:r.source_id,job_type:'current_meet',status:'pending',priority:10,next_run_at:new Date().toISOString(),attempts:0},{onConflict:'athlete_id,source_id,job_type'})}

function historicalMeetBases(urls:any[]){
 const out=new Set<string>();
 for(const raw of urls||[]){
  try{
   const u=new URL(String(raw));
   if(!/(^|\.)swimsystem\.swimtimebrasil\.com$/i.test(u.hostname))continue;
   const m=u.pathname.match(/^\/(\d{4,8})(?:\/|$)/);
   if(m)out.add('https://swimsystem.swimtimebrasil.com/'+m[1]+'/');
  }catch{}
 }
 return [...out]
}
async function discoverHistoricalBases(i:any){
 const id=String(i.external_id||'').trim(),name=String(i.external_name||i.athletes?.full_name||'').trim();
 if(!id||!name)return [];
 const {data:cached}=await db.from('historical_discovery_cache').select('discovered_urls,updated_at').eq('external_id',id).order('updated_at',{ascending:false}).limit(1).maybeSingle();
 let bases=historicalMeetBases(cached?.discovered_urls||[]);
 if(bases.length)return bases;
 const queries=[`"${name}" "${id}" natação resultados`,`"${name}" site:swimsystem.swimtimebrasil.com`,`"${id}" site:swimsystem.swimtimebrasil.com`];
 const urls=new Set<string>(cached?.discovered_urls||[]);
 const errors:string[]=[];
 for(const q of queries.slice(0,1)){
  try{
   const r=await fetch('https://s.jina.ai/?q='+encodeURIComponent(q),{headers:{Accept:'text/plain','User-Agent':'VINISWIM historical discovery/2.0'}});
   const t=await r.text();if(!r.ok){errors.push('HTTP '+r.status);continue}
   for(const m of t.matchAll(/https?:\/\/[^\s)\]>"']+/g))urls.add(m[0].replace(/[.,;]+$/,''));
  }catch(e){errors.push(String(e))}
 }
 bases=historicalMeetBases([...urls]);
 await db.from('historical_discovery_cache').insert({external_id:id,external_name:name,source_hint:'swimsystem',query_text:queries.join(' | '),status:bases.length?'completed':'empty',discovered_urls:[...urls],error_message:errors.length?errors.join(' ; ').slice(0,3000):null,updated_at:new Date().toISOString()});
 return bases
}
async function scanHistoricalCatalog(j:any,i:any){
 const catalogCode=j.sources?.code==='swimsystem'?'fdap':j.sources?.code;
 const {data:src}=await db.from('sources').select('id').eq('code',catalogCode).maybeSingle();
 const {data:docs}=src?.id?await db.from('historical_source_documents').select('*').eq('source_id',src.id).eq('active',true).order('year',{ascending:true}):{data:[]};
 const byBase=new Map<string,any>();
 for(const d of docs||[])byBase.set(String(d.base_url).replace(/\/$/,'')+'/',d);
 if(j.sources?.code==='swimsystem'){
  for(const base of await discoverHistoricalBases(i))if(!byBase.has(base))byBase.set(base,{base_url:base,external_event_id:base.split('/').filter(Boolean).pop(),title:null,year:null});
 }
 const packs:any[]=[];
 const allDocs=[...byBase.values()];
 const cursor=Number(j.metadata?.historical_cursor||0);
 const selected=allDocs.slice(cursor,cursor+1);
 for(const doc of selected){
  try{
   const base=doc.base_url,html=await get(base),meet=parseMeet(html,base);
   meet.externalId=doc.external_event_id||meet.externalId;meet.name=doc.title||meet.name;
   const progression=await quickReaderText(new URL('ProgressionDetails.pdf',base).toString());
   meet.city=historicalCity(progression);
   const progressionDate=historicalMeetDate(progression);
   if(progressionDate)meet.startDate=progressionDate;
   const athleteEvents=athleteHistoricalEvents(progression,i);if(!athleteEvents.length)continue;
   const year=Number(doc.year)||Number(String(meet.startDate||'').slice(0,4))||0;
   const links=historicalLinks(html,base,athleteEvents,categoryCodeFor(year,i.athletes?.birth_date));
   const results:any[]=[];
   for(const l of links.slice(0,2)){try{results.push(...parseHistoricalResultText(await quickReaderText(l.url),l.url,i,l.label,meet.course))}catch{}}
   packs.push({meet,results});
  }catch{}
 }
 (j as any).__historical_has_more=cursor+selected.length<allDocs.length;
 (j as any).__historical_next_cursor=(j as any).__historical_has_more?cursor+selected.length:0;
 return packs
}

async function processJob(j:any){
 const {data:idn}=await db.from('athlete_identifiers').select('*').eq('athlete_id',j.athlete_id).eq('source_id',j.source_id).eq('active',true).single();
 const {data:cfg}=await db.from('athlete_source_configs').select('*').eq('athlete_id',j.athlete_id).eq('source_id',j.source_id).eq('active',true).single();
 if(!cfg)throw new Error('Fonte não cadastrada para o atleta');
 const i={...idn,external_id:cfg.external_id,external_name:cfg.external_name,athletes:j.athletes};
 const sourceCode=j.sources?.code||'',url=cfg.source_url;
 await db.from('monitor_jobs').update({status:'running',locked_at:new Date().toISOString()}).eq('id',j.id);
 const {data:run}=await db.from('monitor_runs').insert({job_id:j.id,status:'running'}).select('id').single();
 try{
   let meet:any,entries:any[]=[],results:any[]=[];
   if(j.job_type==='historical'&&(sourceCode==='fdap'||sourceCode==='swimsystem')){
     // Historical archive jobs are the incremental pipeline. The monitor job only
     // schedules/reconciles that queue; it must not rescan PDFs synchronously.
     await ensureArchiveJobsForDiscovered(j,i);
     const {data:archives}=await db.from('historical_archives').select('id').eq('active',true);
     for(const a of archives||[]){
       await db.from('historical_archive_jobs').upsert({
         athlete_id:j.athlete_id,archive_id:a.id,status:'pending',updated_at:new Date().toISOString()
       },{onConflict:'athlete_id,archive_id',ignoreDuplicates:true})
     }
     const {count:remaining}=await db.from('historical_archive_jobs').select('id',{count:'exact',head:true}).eq('athlete_id',j.athlete_id).in('status',['pending','running']);
     await db.from('monitor_runs').update({status:'completed',finished_at:new Date().toISOString(),records_found:0,records_inserted:0,records_duplicated:0}).eq('id',run.id);
     await db.from('monitor_jobs').update({status:(remaining||0)>0?'pending':'completed',last_run_at:new Date().toISOString(),next_run_at:(remaining||0)>0?new Date(Date.now()+60000).toISOString():null,locked_at:null,last_error:null,attempts:0}).eq('id',j.id);
     return
     const packs=await scanHistoricalCatalog(j,i);
     const ev=await eventMap();let inserted=0,dups=0,found=0;
     for(const pack of packs){
       const pm=pack.meet;
       const mq=await db.from('meets').upsert({source_id:j.source_id,external_id:pm.externalId,name:pm.name,start_date:pm.startDate||null,course:pm.course,official_url:pm.officialUrl,status:'completed'},{onConflict:'source_id,external_id'}).select('id,start_date,course').single();if(mq.error)throw new Error('Meet upsert: '+mq.error.message);const m=mq.data;
       for(const r of pack.results){
         found++;
         const eid=ev.get(n(r.eventLabel));if(!eid)continue;const date=r.resultDate||m.start_date,course=r.course||m.course;if(!course||!date)continue;
         let q=db.from('results').select('id,is_official,origin').eq('athlete_id',j.athlete_id).eq('event_id',eid).eq('result_date',date).eq('course',course).eq('status',r.status);
         q=r.timeMs==null?q.is('time_ms',null):q.eq('time_ms',r.timeMs);
         const {data:old}=await q.maybeSingle();
         if(!old&&date){
           let cq=db.from('results').select('id,result_date,status,is_official').eq('athlete_id',j.athlete_id).eq('event_id',eid).eq('course',course).eq('source_id',j.source_id);
           cq=r.timeMs==null?cq.is('time_ms',null):cq.eq('time_ms',r.timeMs);
           const {data:candidates}=await cq.limit(5);
           const stale=(candidates||[]).find((x:any)=>x.is_official&&x.result_date!==date);
           if(stale){
             const fp2=[j.athlete_id,m.id,eid,date,course,r.timeMs,r.status].join('|');
             await db.from('results').update({meet_id:m.id,result_date:date,status:r.status,result_fingerprint:fp2,category:categoryLabelFor(date,j.athletes?.birth_date,j.athletes?.category),updated_at:new Date().toISOString()}).eq('id',stale.id);
             await db.from('result_sources').upsert({result_id:stale.id,source_id:j.source_id,source_url:r.sourceUrl,retrieved_at:new Date().toISOString(),monitor_run_id:run.id},{onConflict:'result_id,source_id'});
             continue
           }
         }
         if(old){if(!old.is_official){await db.from('results').update({meet_id:m.id,origin:'official',source_id:j.source_id,is_official:true,notes:'Confirmado por histórico oficial.',updated_at:new Date().toISOString()}).eq('id',old.id);await db.from('result_sources').upsert({result_id:old.id,source_id:j.source_id,source_url:r.sourceUrl,retrieved_at:new Date().toISOString(),monitor_run_id:run.id},{onConflict:'result_id,source_id'})}else dups++;continue}
         const fp=[j.athlete_id,m.id,eid,date,course,r.timeMs,r.status].join('|');
         const {data:nr}=await db.from('results').insert({athlete_id:j.athlete_id,meet_id:m.id,event_id:eid,result_date:date,course,time_ms:r.timeMs,status:r.status,origin:'official',source_id:j.source_id,is_official:true,result_fingerprint:fp}).select('id').single();
         inserted++;await db.from('result_sources').insert({result_id:nr.id,source_id:j.source_id,source_url:r.sourceUrl,retrieved_at:new Date().toISOString(),monitor_run_id:run.id})
       }
     }
     await db.from('monitor_runs').update({status:'completed',finished_at:new Date().toISOString(),records_found:found,records_inserted:inserted,records_duplicated:dups}).eq('id',run.id);
     const more=Boolean((j as any).__historical_has_more);
     await db.from('monitor_jobs').update({status:more?'pending':'completed',last_run_at:new Date().toISOString(),next_run_at:more?new Date().toISOString():null,locked_at:null,last_error:null,attempts:0,metadata:{...(j.metadata||{}),historical_cursor:(j as any).__historical_next_cursor||0}}).eq('id',j.id);
     return
   }else if(sourceCode==='swimsystem'){
     const base=meetBase(url),html=await get(base);meet=parseMeet(html,base);
     try{entries=parseEntries(await get(base+'/athletes'),i)}catch{}
     const pages=discover(html,base);for(const p of pages.slice(0,80)){try{results.push(...parseResults(await get(p.url),p.url,p.label,i,meet.course,meet.startDate))}catch{}}
   }else{
     const rootHtml=await get(url),$=cheerio.load(rootHtml),body=$('body').text().replace(/\s+/g,' ');
     meet={externalId:'search-'+sourceCode+'-'+j.athlete_id,name:j.sources?.name||cfg.display_name,startDate:dateFrom(body)||new Date().toISOString().slice(0,10),course:/\b25\s*m\b/i.test(body)?'SCM':/\b50\s*m\b/i.test(body)?'LCM':null,officialUrl:url};
     results.push(...parseGeneric(rootHtml,url,i));
     for(const p of discoverGeneric(rootHtml,url)){if(/\.pdf(?:$|\?)/i.test(p.url))continue;try{results.push(...parseGeneric(await get(p.url),p.url,i))}catch{}}
   }
   const {data:m}=await db.from('meets').upsert({source_id:j.source_id,external_id:meet.externalId,name:meet.name,start_date:meet.startDate||new Date().toISOString().slice(0,10),course:meet.course,official_url:meet.officialUrl,status:'active'},{onConflict:'source_id,external_id'}).select('id,start_date,course').single();
   const ev=await eventMap();for(const e of entries){const eid=ev.get(n(e.eventLabel));if(eid)await db.from('meet_entries').upsert({meet_id:m.id,athlete_id:j.athlete_id,event_id:eid,seed_time_ms:e.seedTimeMs,heat:e.heat,lane:e.lane,entry_status:'seeded',source_id:j.source_id},{onConflict:'meet_id,athlete_id,event_id'})}
   let inserted=0,dups=0;const seen=new Set<string>();
   for(const r of results){
     const eid=ev.get(n(r.eventLabel));if(!eid)continue;const date=r.resultDate||m.start_date,course=r.course||m.course;if(!course||!date)continue;
     const key=[eid,date,course,r.timeMs,r.status].join('|');if(seen.has(key))continue;seen.add(key);
     let q=db.from('results').select('id,is_official,origin').eq('athlete_id',j.athlete_id).eq('event_id',eid).eq('result_date',date).eq('course',course).eq('status',r.status);
     q=r.timeMs==null?q.is('time_ms',null):q.eq('time_ms',r.timeMs);
     const {data:old}=await q.maybeSingle();
     if(old){
       if(!old.is_official){await db.from('results').update({meet_id:m.id,origin:'official',source_id:j.source_id,is_official:true,notes:'Confirmado por fonte oficial.',updated_at:new Date().toISOString()}).eq('id',old.id);await db.from('result_sources').upsert({result_id:old.id,source_id:j.source_id,source_url:r.sourceUrl,retrieved_at:new Date().toISOString(),monitor_run_id:run.id},{onConflict:'result_id,source_id'})}
       else dups++;
       continue
     }
     const fp=[j.athlete_id,m.id,eid,date,course,r.timeMs,r.status].join('|');
     const {data:nr}=await db.from('results').insert({athlete_id:j.athlete_id,meet_id:m.id,event_id:eid,result_date:date,course,time_ms:r.timeMs,status:r.status,origin:'official',source_id:j.source_id,is_official:true,result_fingerprint:fp}).select('id').single();
     inserted++;await db.from('result_sources').insert({result_id:nr.id,source_id:j.source_id,source_url:r.sourceUrl,retrieved_at:new Date().toISOString(),monitor_run_id:run.id});await createNotifications(j.athlete_id,nr.id,eid,r.status,r.eventLabel,course)
   }
   await db.from('monitor_runs').update({status:'completed',finished_at:new Date().toISOString(),records_found:results.length,records_inserted:inserted,records_duplicated:dups}).eq('id',run.id);
   await db.from('monitor_jobs').update({status:'completed',last_run_at:new Date().toISOString(),next_run_at:null,locked_at:null,last_error:null,attempts:0}).eq('id',j.id)
 }catch(e:any){
   await db.from('monitor_runs').update({status:'failed',finished_at:new Date().toISOString(),error_code:String(e.message||e).slice(0,240)}).eq('id',run.id);
   await db.from('monitor_jobs').update({status:'failed',locked_at:null,last_error:String(e.message||e).slice(0,1000),next_run_at:null}).eq('id',j.id);throw e
 }
}

Deno.serve(async()=>{
 const summary={links:0,jobs:0,archives:0,errors:[] as string[]};
 try{
  await db.from('historical_archive_jobs').update({
   status:'pending',last_error:'Recuperado automaticamente após timeout.',started_at:null,updated_at:new Date().toISOString()
  }).eq('status','running').lt('updated_at',new Date(Date.now()-3*60*1000).toISOString());
  await db.from('monitor_jobs').update({
   status:'pending',locked_at:null,last_error:'Recuperado automaticamente após timeout.',updated_at:new Date().toISOString()
  }).eq('status','running').lt('locked_at',new Date(Date.now()-5*60*1000).toISOString());
  const {data:rt}=await db.from('backend_runtime').select('last_run_at').eq('key','commercial_monitor').single();
  if(rt?.last_run_at&&Date.now()-new Date(rt.last_run_at).getTime()<15000)return json({ok:true,throttled:true});
  await db.from('backend_runtime').update({last_run_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('key','commercial_monitor');

  const {data:links}=await db.from('source_link_requests').select('*,sources(code),athletes(full_name,preferred_name)').eq('status','pending').limit(20);
  for(const r of links||[]){
   summary.links++;
   try{await processLink(r)}
   catch(e:any){
    summary.errors.push(e.message||String(e));
    await db.from('source_link_requests').update({status:'error',message:String(e.message||e).slice(0,500),processed_at:new Date().toISOString()}).eq('id',r.id)
   }
  }

  const {data:claimed,error:claimError}=await db.rpc('claim_monitor_jobs',{p_limit:1});
  if(claimError)throw claimError;
  const ids=(claimed||[]).map((x:any)=>x.id);
  let jobs:any[]=[];
  if(ids.length){
   const q=await db.from('monitor_jobs').select('*,sources(code),athletes(full_name,preferred_name,birth_date,gender)').in('id',ids);
   if(q.error)throw q.error;jobs=q.data||[]
  }
  for(const j of jobs){
   summary.jobs++;
   try{await processJob(j)}catch(e:any){summary.errors.push(e.message||String(e))}
  }

  const {data:archiveJobs,error:archiveClaimError}=await db.rpc('claim_historical_archive_jobs',{p_limit:1});
  if(archiveClaimError)throw archiveClaimError;
  for(const aj of archiveJobs||[]){
   summary.archives++;
   try{await processArchiveJob(aj)}catch(e:any){summary.errors.push(e.message||String(e))}
  }

  return json({ok:true,...summary})
 }catch(e:any){
  return json({ok:false,error:e.message||String(e),...summary},500)
 }
});
