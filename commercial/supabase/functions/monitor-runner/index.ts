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
function hasStandaloneId(text:string,id:any){
 const needle=String(id||'').trim();if(!needle)return false;
 const hay=' '+String(text||'').replace(/\s+/g,' ').trim()+' ';
 return hay.includes(' '+needle+' ')
}
function match(text:string,i:any){
 // When a source gives us a stable athlete registration, it is authoritative.
 // Never fall back to a fuzzy name after an ID mismatch: that can match a
 // namesake or a neighboring athlete on broad pages.
 const id=String(i.external_id||'').trim();
 if(id)return hasStandaloneId(text,id);
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
function dateFrom(text:string){const m=text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\b/);if(!m)return null;const y=m[3].length===2?String(2000+Number(m[3])):m[3];return y+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[1]).padStart(2,'0')}
function resultEventDate(text:string){const m=text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\s*-\s*\d{1,2}:\d{2}\s*Resultados\b/i);if(!m)return null;const y=m[3].length===2?String(2000+Number(m[3])):m[3];return y+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[1]).padStart(2,'0')}
function historicalMeetDate(text:string){const range=text.match(/\b(\d{1,2})\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);if(range)return range[4]+'-'+String(range[3]).padStart(2,'0')+'-'+String(range[1]).padStart(2,'0');const slash=text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);return slash?slash[3]+'-'+String(slash[2]).padStart(2,'0')+'-'+String(slash[1]).padStart(2,'0'):null}
function isoDate(d:string,m:string,y:string){return y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0')}
function parseSwimSystemMeetEvidence(text:string){const raw=String(text||'').replace(/\s+/g,' ').trim();const h=raw.match(/\b([^,]{2,80})\s*\(([A-Z]{2})\),\s*(\d{1,2})(?:\s*-\s*(\d{1,2}))?\/(\d{1,2})\/(\d{4}),\s*(SCM|LCM)\s*\((25|50)m\)/i);if(!h)return null;return {city:h[1].trim(),startDate:isoDate(h[3],h[5],h[6]),endDate:isoDate(h[4]||h[3],h[5],h[6]),course:h[7].toUpperCase()}}
function parseMeet(html:string,url:string){const $=cheerio.load(html);const title=$('title').first().text().replace(/\s*-\s*SPLASH.*$/i,'').trim();const locMatch=html.match(/Local da competição<\/span>[\s\S]{0,400}?<p[^>]*>([^<]+)<\/p>\s*<address[^>]*>([^<]+)<\/address>/i);const venue=locMatch?locMatch[1].replace(/\s+/g,' ').trim()||null:null;let city:string|null=null;if(locMatch){const parts=locMatch[2].replace(/\s+/g,' ').split('·').map(x=>x.trim()),cp=parts.find(x=>/\/\s*[A-Z]{2}\b/.test(x));city=cp?cp.split('/')[0].trim()||null:null}return {externalId:meetBase(url).split('/').pop()||meetBase(url),name:title||$('h1').first().text().trim()||'Campeonato',startDate:null,endDate:null,course:null,officialUrl:meetBase(url),venue,city}}
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
function boundedAthleteSegment(raw:string,id:string){
 const s=String(raw||'').replace(/\s+/g,' ').trim(),needle=String(id||'').trim();
 if(!needle)return null;
 // Registration must be a standalone field, not a substring of another number.
 const m=s.match(new RegExp('(?:^|\\\\s)'+needle+'(?=\\\\s|$)'));
 if(!m)return null;
 const p=(m.index||0)+m[0].indexOf(needle),after=s.slice(p+needle.length);
 // Legacy ResultList rows start with "Col. S/R". Stop before the next row,
 // including N/C/DQ status rows, so no neighboring swimmer can donate a time.
 const next=after.match(/\s(?:\d{1,3}\.|N\/C|DQL|DQ|DNS|DNF|DSQ)\s+\d{1,2}\s*\/\s*\d{1,2}\s+/i);
 return after.slice(0,next?next.index:Math.min(after.length,220)).trim()
}
function extractOfficialRowTime(line:string,externalId:string){
 const seg=boundedAthleteSegment(line,externalId);
 if(seg==null)return null;
 // ResultList schema after Reg.: Nasc. | Entidade | Tempo | % | Pts. | AQUA.
 // A result time is accepted only with a known suffix from the official
 // columns. This rejects birth year, registration, seed-like values and times
 // belonging to the next row.
 const patterns=[
  /(?:^|\s)(\d{1,2}:\d{2}\.\d{2}|\d{1,3}\.\d{2})(?=\s+\d{2,3}%\s+(?:\d{1,2}\.\d{2}|-)\s+\d{1,4}(?:\s|$))/,
  /(?:^|\s)(\d{1,2}:\d{2}\.\d{2}|\d{1,3}\.\d{2})(?=\s+-\s+(?:\d{1,2}\.\d{2}|-)\s+\d{1,4}(?:\s|$))/,
  /(?:^|\s)(\d{1,2}:\d{2}\.\d{2}|\d{1,3}\.\d{2})(?=\s+\d{1,2},\d{2}\s+\d{1,4}(?:\s|$))/
 ];
 for(const rx of patterns){
  const m=seg.match(rx);if(!m)continue;
  const v=parseTime(m[1]);if(v!=null&&v>5000&&v<1800000)return v
 }
 return null
}
function parseHistoricalResultText(text:string,url:string,i:any,expectedLabel:string,course:any){
 const body=String(text||'').replace(/\r/g,'');
 const eventDate=resultEventDate(body),date=eventDate||dateFrom(body);
 const id=String(i.external_id||'').trim();
 // Historical FDAP/legacy SwimSystem must be anchored by registration AND have
 // a reliable competition/result date. Never invent either.
 if(!id||!date)return [];
 const flat=body.replace(/\s+/g,' ').trim();
 const out:any[]=[];
 let from=0;
 while(from<flat.length){
  const pos=flat.indexOf(id,from);if(pos<0)break;from=pos+id.length;
  const left=pos===0?' ':flat[pos-1],right=flat[pos+id.length]||' ';
  if(!/\s/.test(left)||!/\s/.test(right))continue;
  const row=flat.slice(Math.max(0,pos-100),Math.min(flat.length,pos+id.length+260));
  const seg=boundedAthleteSegment(row,id);if(seg==null)continue;
  const st=resultStatus(seg),timeMs=extractOfficialRowTime(row,id);
  if(timeMs==null&&!st)continue;
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
  const eventLabel=eventFrom(row); if(!eventLabel)return;
  const parsed=strictHtmlRowResult($,tr);
  if(!parsed.identified||(parsed.timeMs==null&&!parsed.status))return;
  out.push({eventLabel,timeMs:parsed.timeMs,status:parsed.status||'valid',sourceUrl:url,resultDate:dateFrom(row)||pageDate,course})
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
function parseStartlistEntries(text:string,i:any){
 const id=String(i.external_id||'').trim();if(!id)return [];
 const body=String(text||'').replace(/\r/g,'');
 const eventRe=/Prova\s+\d+\s*-\s*(?:Final\s+Direta|Eliminat[oó]ria)[^,\n]*,\s*(\d{1,4})m\s+(Livre|Costas|Peito|Borboleta|Medley)[^\n]*/gi;
 const starts=[...body.matchAll(eventRe)],out:any[]=[];
 for(let k=0;k<starts.length;k++){
  const h=starts[k],end=k+1<starts.length?starts[k+1].index!:body.length;
  const block=body.slice(h.index!+h[0].length,end).replace(/\s+/g,' ').trim();
  const pos=(' '+block+' ').indexOf(' '+id+' ');if(pos<0)continue;
  const after=block.slice(Math.max(0,pos-1)+id.length);
  // Startlist row: Reg. | Nasc. | UF | Entidade | T. Inscrição.
  // The seed is the final time/NT before the next numbered athlete row.
  const next=after.search(/\s\d{1,3}\s+[A-ZÀ-Ÿ][A-Za-zÀ-ÿ .'-]{2,80}\s+\d{4,8}\s+(?:19|20)\d{2}\s/);
  const row=(next>=0?after.slice(0,next):after.slice(0,180)).trim();
  const tokens=row.match(/(?:\d{1,2}:\d{2}\.\d{2}|\d{1,3}\.\d{2}|\bNT\b)/gi)||[];
  const seed=tokens.length?tokens[tokens.length-1]:null;
  const seedTimeMs=seed&&!/^NT$/i.test(seed)?parseTime(seed):null;
  const eventLabel=h[1]+' '+h[2];
  if(!out.some((e:any)=>n(e.eventLabel)===n(eventLabel)))out.push({eventLabel,seedTimeMs,heat:null,lane:null})
 }
 return out
}
function parseClubDetailResults(text:string,i:any,fallbackCourse:any,fallbackDate:string|null,url:string){
 const headerRe=/\n\n([A-ZÀ-Ÿ][^\n,]{1,60}),\s*(\d{4})\s*\((\d{1,2})\s*Anos?\),\s*(Masculino|Feminino)/g;
 const headers=[...text.matchAll(headerRe)];
 const course=fallbackCourse||null;
 const out:any[]=[];
 for(let k=0;k<headers.length;k++){
  const h=headers[k],athleteName=h[1].trim();
  if(!names(i).some((nm:string)=>nm&&looseNameMatch(athleteName,nm)))continue;
  const start=h.index!+h[0].length;
  const end=k+1<headers.length?headers[k+1].index!:text.length;
  const block=text.slice(start,end);
  // ClubDetail/ProgressionDetails columns are:
  // Prova | Etapa | Col. | Tempo | FINA | T. Inscrição | Data | % | RP.
  // Therefore a valid result is the token immediately after Col. (N. or "-").
  // Never scan the rest of the segment: it contains FINA points and seed time.
  const eventRe=/(?<![x\d])(\d{1,4})m\s+(Livre|Costas|Peito|Borboleta|Medley)\s+(Final\s+Direta|Eliminat[oó]ria)\s+/gi;
  const starts=[...block.matchAll(eventRe)];
  for(let idx=0;idx<starts.length;idx++){
   const cur=starts[idx];
   const segEnd=idx+1<starts.length?starts[idx+1].index!:block.length;
   const seg=block.slice(cur.index!+cur[0].length,segEnd).trim();
   // Completed row: "3. 1:17.59 338 1:22.12 112%"
   // Entry-only row: "- NT -" or "- 1:20.17 -" -> no official result.
   // DSQ/DNS may replace the result token.
   // Jina's PDF text extraction often removes the visual whitespace between
   // the placement column and result time (e.g. "29.1:52.82", "28.56.73").
   // Accept that exact compact form as well as the spaced form; the parser is
   // still anchored at the beginning of the athlete's own event row.
   const m=seg.match(/^(?:\d{1,3}\.|-)\s*(DNS|DNF|DSQ|DQL|DQ|N\/C|\d{1,2}:\d{2}\.\d{2}|\d{1,3}\.\d{2}|NT)\b/i);
   if(!m)continue;
   const token=m[1];
   const st=resultStatus(token)||(/^(?:DQL|DQ|N\/C)$/i.test(token)?'dsq':null);
   const timeMs=st||/^NT$/i.test(token)?null:parseTime(token);
   if(timeMs==null&&!st)continue;
   out.push({eventLabel:cur[1]+' '+cur[2],timeMs,status:st||'valid',sourceUrl:url,resultDate:fallbackDate,course})
  }
 }
 return out
}
const MASTERS_PARANA_STROKE:any={LIVRE:'Livre',COSTAS:'Costas',PEITO:'Peito',BORBOLETA:'Borboleta',MEDLEY:'Medley'};
function parseMastersParanaResults(text:string,i:any,fallbackDate:string|null,url:string){
 // Masters Paraná publishes one PDF per etapa with every event's full standings
 // (grouped by age bracket, "FAIXA: NN +"), never one PDF per athlete — so unlike
 // parseClubDetailResults (which anchors on the athlete's own header block), here
 // we anchor on each "# Nª PROVA - <dist> METROS <stroke> <gender>" event header
 // and search that whole block for the athlete's name. Relay events
 // ("REVEZAMENTO") list team rosters with no individual time and are skipped.
 // Rows have no fixed column widths, so the same bounded-window-after-the-name
 // technique used elsewhere in this file is what finds the athlete's own time
 // without accidentally picking up a neighboring swimmer's — the block text is
 // whitespace-flattened first so string positions from a normalized-text search
 // line up with positions in the (still original-case) block being sliced.
 const headerRe=/#\s*\d+[ºª]\s*PROVA\s*-\s*(\d+)\s*METROS\s+(LIVRE|COSTAS|PEITO|BORBOLETA|MEDLEY)(?:\s+(FEMININO|MASCULINO))?/g;
 const headers=[...text.matchAll(headerRe)];
 const nm=names(i);
 const out:any[]=[];
 for(let k=0;k<headers.length;k++){
  const h=headers[k];
  if(/REVEZAMENTO/.test(h[0]))continue;
  const stroke=MASTERS_PARANA_STROKE[h[2]];if(!stroke)continue;
  const eventLabel=h[1]+' '+stroke;
  const start=h.index!+h[0].length;
  const end=k+1<headers.length?headers[k+1].index!:text.length;
  const block=text.slice(start,end).replace(/\s+/g,' ').trim();
  if(!nm.some((x:string)=>x&&looseNameMatch(block,x)))continue;
  let namePos=-1,matched='';
  for(const x of nm){const idx=n(block).indexOf(x);if(idx>=0){namePos=idx;matched=x;break}}
  if(namePos<0)continue;
  const before=block.slice(Math.max(0,namePos-24),namePos);
  const statusBefore=(before.match(/(?:N\/C|DQL|DQ|DNS|DNF|DSQ)\s+\d{1,8}\s*$/i)||[])[0]||'';
  const after=block.slice(namePos+matched.length);
  const nextMarker=after.match(/\s(?:N\/C|DQL|DQ|DNS|DNF|DSQ)\s+\d{1,8}\s|\s\d{1,3}[ºª°]\s+\d{1,8}\s/);
  const seg=nextMarker?after.slice(0,nextMarker.index):after.slice(0,260);
  const st=/N\/C|DQL|DQ|DSQ/i.test(statusBefore)?'dsq':/DNS/i.test(statusBefore)?'dns':/DNF/i.test(statusBefore)?'dnf':null;
  // ABMN row shape after athlete/team: TEMPO + PTS (decimal comma) + IT.
  // Do not accept an isolated time token: it may belong to a neighboring row.
  const tm=st?null:seg.match(/(?:^|\s)(\d{1,2}:\d{2}\.\d{2}|\d{1,3}\.\d{2})\s+\d{1,2},\d{2}\s+\d{1,4}(?:\s|$)/);
  const timeMs=tm?parseTime(tm[1]):null;
  if(timeMs==null&&!st)continue;
  out.push({eventLabel,timeMs,status:st||'valid',sourceUrl:url,resultDate:fallbackDate})
 }
 return out
}
async function ensureMastersParanaArchives(){
 const {data:mp}=await db.from('sources').select('id').eq('code','masters_parana').maybeSingle();
 if(!mp?.id)return;
 let pages:any[];
 try{
  const raw=await get('http://mastersparana.com.br/associacao/index.php?rest_route=/wp/v2/pages&per_page=50');
  pages=JSON.parse(raw)
 }catch(e){console.error('MASTERS_PARANA_PAGES_LIST',String(e));return}
 const meeting=pages.filter((p:any)=>/MEETING MASTERS\s+\d{4}/i.test(p?.title?.rendered||'')).sort((a:any,b:any)=>String(b.modified).localeCompare(String(a.modified)))[0];
 if(!meeting)return;
 const html=String(meeting.content?.rendered||'');
 const year=(meeting.title.rendered.match(/(\d{4})/)||[])[1]||String(new Date().getFullYear());
 // Enfold (the page builder this site uses) doesn't put each etapa's PDF
 // buttons as DOM siblings of its heading — sibling-walking from the heading
 // never reached them in testing. Bounding by raw HTML position between one
 // "Nª ETAPA" heading and the next works instead, but the boundary must be the
 // next heading of ANY kind, not just the next ETAPA one: this page also has a
 // yearly championship heading ("6° CAMPEONATO ESTADUAL ...") that doesn't
 // match the etapa pattern, and bounding only by etapa headings let the last
 // etapa's window run past it and pick up ITS result PDF as if it were the
 // etapa's own — confirmed against the real page before this shipped.
 const allHeadingPositions=[...html.matchAll(/<h[1-3][^>]*>/gi)].map(m=>m.index!);
 const headingRe=/<h[1-3][^>]*>\s*(\d+)[ºª°]\s*ETAPA\s+([^<]+)<\/h[1-3]>/gi;
 const headings=[...html.matchAll(headingRe)];
 for(const h of headings){
  const etapaNum=h[1],label=('Etapa '+etapaNum+' '+h[2]).replace(/\s+/g,' ').trim();
  const nextAny=allHeadingPositions.find(pos=>pos>h.index!);
  const block=html.slice(h.index!,nextAny!==undefined?nextAny:html.length);
  const hrefRe=/href='([^']+)'[^>]*class='[^']*avia-button[^']*'[^>]*aria-label="([^"]*)"/gi;
  let resultUrl='',hm;
  while((hm=hrefRe.exec(block))){
   const href=hm[1],aria=hm[2].toUpperCase();
   if(/RESULTADOS/.test(aria)&&!/EQUIPE/.test(aria)&&/\.pdf$/i.test(href)){resultUrl=href;break}
  }
  if(!resultUrl)continue;
  const eventKey='masters-parana-'+year+'-etapa-'+etapaNum;
  const {data:existing}=await db.from('historical_archives').select('id,base_url').eq('provider','masters_parana').eq('event_key',eventKey).maybeSingle();
  if(existing){
   if(existing.base_url!==resultUrl)await db.from('historical_archives').update({base_url:resultUrl,updated_at:new Date().toISOString()}).eq('id',existing.id);
   continue
  }
  await db.from('historical_archives').insert({source_id:mp.id,provider:'masters_parana',event_key:eventKey,name:'Meeting Masters '+year+' - '+label,base_url:resultUrl,active:true,updated_at:new Date().toISOString()});
 }
}
function resultColumnIndex($:any,tr:any){
 const table=$(tr).closest('table');
 const headers=table.find('thead th').toArray().map((th:any)=>n($(th).text()));
 let idx=headers.findIndex((h:string)=>/resultado|tempo final|marca/.test(h));
 if(idx>=0)return idx;
 // Some official pages omit <thead>; use the nearest preceding header row.
 const prior=$(tr).prevAll('tr').toArray().find((r:any)=>$(r).find('th').length);
 if(prior){
  const hs=$(prior).find('th').toArray().map((th:any)=>n($(th).text()));
  idx=hs.findIndex((h:string)=>/resultado|tempo final|marca/.test(h));
 }
 return idx
}
function strictHtmlRowResult($:any,tr:any){
 const cells=$(tr).find('td').toArray().map((td:any)=>$(td).text().replace(/\s+/g,' ').trim());
 const idx=resultColumnIndex($,tr);
 if(idx<0||idx>=cells.length)return {timeMs:null,status:null,identified:false};
 const cell=cells[idx]||'';
 const st=resultStatus(cell);
 const timeMs=st?null:parseTime(cell);
 return {timeMs,status:st,identified:true}
}
function parseResults(html:string,url:string,label:string,i:any,course:any,resultDate:any){
 const $=cheerio.load(html),eventLabel=eventFrom(label)||eventFrom($('h1,h2,h3').text())||'',out:any[]=[];
 $('tr').each((_,tr)=>{
  const row=$(tr).text().replace(/\s+/g,' ').trim();if(!match(row,i))return;
  const parsed=strictHtmlRowResult($,tr);
  // Never guess from another numeric cell (seed/Inscrição, AQUA points, lane,
  // ranking, etc.). If the result column cannot be identified, reject the row.
  if(!parsed.identified||(parsed.timeMs==null&&!parsed.status))return;
  out.push({eventLabel,timeMs:parsed.timeMs,status:parsed.status||'valid',sourceUrl:url,resultDate,course})
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
// The legacy discovery above only ever finds meets on the old
// swimsystem.swimtimebrasil.com domain (via web search), which the federation
// stopped publishing new meets to. This is the athlete-agnostic counterpart for
// the current site: it crawls the public meets listing at swimsystem.app and
// registers any meet not seen before as a new historical_archives row. Which
// athletes actually competed in each one is decided later, per athlete, inside
// processArchiveJob — exactly like the legacy path already does for its own
// archives.
async function ensureSwimSystemAppArchives(){
 const {data:ss}=await db.from('sources').select('id').eq('code','swimsystem').maybeSingle();
 if(!ss?.id)return;
 let html:string; try{html=await get('https://www.swimsystem.app/meets')}catch(e){console.error('SWIMSYSTEM_APP_MEETS_LIST',String(e));return}
 const ids=[...new Set([...html.matchAll(/\/meets\/sw\/([0-9a-f-]{36})/g)].map(m=>m[1]))];
 if(!ids.length)return;
 const {data:existing}=await db.from('historical_archives').select('event_key').eq('provider','swimsystem_v2').in('event_key',ids);
 const known=new Set((existing||[]).map((x:any)=>x.event_key));
 const missing=ids.filter(id=>!known.has(id));
 // Registering a brand-new meet needs one extra page fetch (its base HTML, for
 // a name) on top of the /meets listing above. Cap how many happen per
 // invocation so a large first-time backlog can't blow the function's
 // wall-clock/CPU budget and get killed mid-loop (leaving no trace, since a
 // hard platform kill never reaches a catch block) — the rest are picked up
 // on the next invocation, since this reruns on every 'historical' job tick
 // for as long as any athlete still has one pending.
 for(const id of missing.slice(0,8)){
  try{
   const base='https://www.swimsystem.app/meets/sw/'+id;
   const parsed=parseMeet(await get(base),base);
   await db.from('historical_archives').insert({source_id:ss.id,provider:'swimsystem_v2',event_key:id,name:parsed.name||('SwimSystem '+id),base_url:base,start_date:parsed.startDate||null,course:parsed.course||null,active:true,updated_at:new Date().toISOString()});
  }catch(e){console.error('SWIMSYSTEM_APP_ARCHIVE_DISCOVERY',id,String(e))}
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
   if((!cfg||!cfg.external_id) && archive.sources?.code==='fdap'){
     const {data:ss}=await db.from('sources').select('id').eq('code','swimsystem').maybeSingle();
     if(ss?.id){
       const q=await db.from('athlete_source_configs').select('*').eq('athlete_id',aj.athlete_id).eq('source_id',ss.id).eq('active',true).maybeSingle();
       if(q.data?.external_id){cfg=q.data;identifierSourceId=ss.id}
     }
   }
   // masters_parana has no per-athlete external id anywhere on the site (results
   // are matched by full name against each etapa's PDF, same as the name-search
   // already used elsewhere in this file) — only fdap/swimsystem need a real
   // external_id, since their pipelines anchor on it directly.
   if(!cfg||(!cfg.external_id&&archive.sources?.code!=='masters_parana'))throw new Error('Fonte histórica não configurada para o atleta (identificador ausente)');
   const {data:athlete}=await db.from('athletes').select('full_name,preferred_name,birth_date,gender,category').eq('id',aj.athlete_id).single();
   const {data:idn}=await db.from('athlete_identifiers').select('*').eq('athlete_id',aj.athlete_id).eq('source_id',identifierSourceId).maybeSingle();
   const i={...(idn||{}),external_id:cfg.external_id,external_name:cfg.external_name,athletes:athlete};

   if(archive.provider==='swimsystem_v2'){
     // Meets discovered from the current swimsystem.app site are self-contained:
     // one base page + a handful of PDF reports, same shape as the current-meet
     // path (processJob's swimsystem branch) — no per-event link pagination
     // needed, so this always finishes in a single pass, unlike the legacy
     // cursor/links flow below.
     const base=archive.base_url;
     let athletesHtml='';
     try{athletesHtml=await get(meetBase(base)+'/athletes')}catch{}
     await beat();
     // The PDF report links live in the meet's root page HTML, not the
     // /results sub-route (which is much more heavily client-rendered and
     // doesn't embed them server-side) — this bit us in testing: fetching
     // archive.base_url directly here always found 0 PDFs, even for a meet
     // already proven to work via the current_meet path, which fetches
     // meetBase(url) instead. Match that exactly.
     const rootBase=meetBase(base);
     const html=await get(rootBase),meetParsed=parseMeet(html,rootBase);
     const pdfLinks=[...new Set([...html.matchAll(/https?:\/\/[^"'\s]+\.pdf/gi)].map(m=>m[0]))];
     const results:any[]=[],scheduledEntries:any[]=[];
     const dbg:string[]=[];
     let reportEvidence:any=null;
     let athleteSeen=athletesHtml?match(cheerio.load(athletesHtml)('body').text(),i):false;
     for(const pdfUrl of pdfLinks){
       try{
         const txt=await quickReaderText(pdfUrl);
         const evd=parseSwimSystemMeetEvidence(txt);if(evd&&!reportEvidence)reportEvidence=evd;
         const startEntries=parseStartlistEntries(txt,i);
         if(startEntries.length){athleteSeen=true;scheduledEntries.push(...startEntries)}
         const fallbackDate=evd?.startDate||null;
         const parsed=parseClubDetailResults(txt,i,evd?.course||null,fallbackDate,pdfUrl);
         dbg.push(pdfUrl.split('/').pop()+':r'+parsed.length+'/e'+startEntries.length+'/'+txt.length);
         results.push(...parsed);
       }catch(e){dbg.push(pdfUrl.split('/').pop()+':ERR:'+String(e).slice(0,60))}
     }
     if(!athleteSeen){
       await db.from('historical_archive_jobs').update({status:'completed',records_found:0,records_inserted:0,records_promoted:0,heartbeat_at:null,finished_at:now(),updated_at:now(),last_error:'DEBUG:no_athlete_match html='+athletesHtml.length+' pdfs='+pdfLinks.length}).eq('id',aj.id).eq('status','running');
       return
     }
     if(!results.length){
       // A past archive with no official result for this athlete is not a
       // scheduled competition. Only a meet whose canonical report header dates
       // it today/future may create entries in Campeonatos.
       const today=new Date().toISOString().slice(0,10);
       const canSchedule=Boolean(reportEvidence?.startDate&&reportEvidence.startDate>=today);
       if(!canSchedule){
         await db.from('historical_archive_jobs').update({status:'completed',records_found:0,records_inserted:0,records_promoted:0,heartbeat_at:null,finished_at:now(),updated_at:now(),last_error:'DEBUG:no_results_not_future ['+dbg.join(' | ').slice(0,800)+']'}).eq('id',aj.id).eq('status','running');
         return
       }
       // No PDF result report exists yet for this meet at all (as opposed to one
       // existing but not mentioning this athlete) — that's the signature of a
       // meet that hasn't happened yet, not one this athlete skipped. Since the
       // athlete already matched on /athletes above, register it now as a
       // 'scheduled' meet with its entry list (seed times/heat/lane from the
       // same /athletes page), so it shows up under Campeonatos right away
       // instead of only appearing once results exist. A later run of this same
       // archive job, once PDFs are published, upserts the same meet row
       // (matched by source_id+external_id) to 'completed' with real results —
       // that status flip is what the Campeonatos tab uses to stop showing it
       // there, since by then it belongs in Resultados instead.
       {
         try{
           const entries=[...scheduledEntries,...parseEntries(athletesHtml,i)].filter((e:any,idx:number,arr:any[])=>arr.findIndex((x:any)=>n(x.eventLabel)===n(e.eventLabel))===idx);
           if(entries.length){
             const mq=await db.from('meets').upsert({
               source_id:archive.source_id,external_id:archive.event_key,name:archive.name||meetParsed.name,
               start_date:reportEvidence?.startDate||null,end_date:reportEvidence?.endDate||null,
               course:reportEvidence?.course||null,official_url:rootBase,status:'scheduled',
               ...(meetParsed.venue?{venue:meetParsed.venue}:{}),...(reportEvidence?.city?{city:reportEvidence.city}:meetParsed.city?{city:meetParsed.city}:{})
             },{onConflict:'source_id,external_id'}).select('id').single();
             if(!mq.error){
               const ev=await eventMap();
               for(const e of entries){
                 const eid=ev.get(n(e.eventLabel));if(!eid)continue;
                 await db.from('meet_entries').upsert({meet_id:mq.data.id,athlete_id:aj.athlete_id,event_id:eid,seed_time_ms:e.seedTimeMs,heat:e.heat,lane:e.lane,entry_status:'seeded',source_id:archive.source_id},{onConflict:'meet_id,athlete_id,event_id'})
               }
             }
           }
         }catch(e){console.error('SWIMSYSTEM_APP_SCHEDULED_ENTRIES',archive.event_key,String(e))}
       }
       await db.from('historical_archive_jobs').update({status:'completed',records_found:0,records_inserted:0,records_promoted:0,heartbeat_at:null,finished_at:now(),updated_at:now(),last_error:'DEBUG:no_results pdfs='+pdfLinks.length+' ['+dbg.join(' | ').slice(0,800)+']'}).eq('id',aj.id).eq('status','running');
       return
     }
     const ev=await eventMap();
     const mq=await db.from('meets').upsert({
       source_id:archive.source_id,external_id:archive.event_key,name:archive.name||meetParsed.name,
       start_date:reportEvidence?.startDate||results.find((r:any)=>r.resultDate)?.resultDate||null,
       end_date:reportEvidence?.endDate||null,course:reportEvidence?.course||null,official_url:meetBase(base),status:'completed',
       ...(meetParsed.venue?{venue:meetParsed.venue}:{}),...(meetParsed.city?{city:meetParsed.city}:{})
     },{onConflict:'source_id,external_id'}).select('id,start_date,course').single();
     if(mq.error)throw new Error('Meet SwimSystem v2: '+mq.error.message);
     const m=mq.data;
     let foundAdd=0,insertedAdd=0,promotedAdd=0;const seen=new Set<string>();
     for(const r of results){
       const eid=ev.get(n(r.eventLabel));if(!eid)continue;
       const date=r.resultDate||m.start_date,course=r.course||m.course;if(!date||!course)continue;
       const key=[eid,date,course,r.timeMs,r.status].join('|');if(seen.has(key))continue;seen.add(key);
       foundAdd++;
       let q=db.from('results').select('id,is_official,origin').eq('athlete_id',aj.athlete_id).eq('event_id',eid).eq('result_date',date).eq('course',course).eq('status',r.status);
       q=r.timeMs==null?q.is('time_ms',null):q.eq('time_ms',r.timeMs);
       const {data:old}=await q.maybeSingle();
       if(old){
         if(!old.is_official){
           await db.from('results').update({meet_id:m.id,origin:'official',source_id:archive.source_id,is_official:true,notes:'Confirmado por arquivo histórico oficial.',updated_at:now()}).eq('id',old.id);
           await db.from('result_sources').upsert({result_id:old.id,source_id:archive.source_id,source_url:r.sourceUrl,retrieved_at:now(),metadata:{historical_archive:archive.event_key}},{onConflict:'result_id,source_id'});
           promotedAdd++
         }
         continue
       }
       const fp=[aj.athlete_id,m.id,eid,date,course,r.timeMs,r.status].join('|');
       const ins=await db.from('results').insert({
         athlete_id:aj.athlete_id,meet_id:m.id,event_id:eid,result_date:date,course,time_ms:r.timeMs,status:r.status,
         origin:'official',source_id:archive.source_id,is_official:true,
         category:categoryLabelFor(date,athlete?.birth_date,athlete?.category),result_fingerprint:fp
       }).select('id').single();
       if(ins.error)throw new Error('Resultado SwimSystem v2: '+ins.error.message);
       insertedAdd++;
       await db.from('result_sources').insert({result_id:ins.data.id,source_id:archive.source_id,source_url:r.sourceUrl,retrieved_at:now(),metadata:{historical_archive:archive.event_key}})
     }
     await db.from('historical_archive_jobs').update({
       status:'completed',records_found:foundAdd,records_inserted:insertedAdd,records_promoted:promotedAdd,
       heartbeat_at:null,finished_at:now(),updated_at:now()
     }).eq('id',aj.id).eq('status','running');
     return
   }

   if(archive.provider==='swimtime_progression'){
     // Legacy swimtimebrasil.com has a broken TLS certificate on its HTML host.
     // Never fetch the meet root directly here. ProgressionDetails.pdf is the
     // canonical athlete summary and quickReaderText() reaches it through the
     // reader/cache path, so the import remains automatic and does not depend
     // on accepting an invalid certificate.
     await beat();
     const progressionUrl=new URL('ProgressionDetails.pdf',archive.base_url).toString();
     const txt=await quickReaderText(progressionUrl);
     const resultDate=archive.start_date||historicalMeetDate(txt)||null;
     const course=archive.course||null;
     if(!resultDate||!course)throw new Error('Arquivo legado sem data/piscina canônica');
     const results=parseClubDetailResults(txt,i,course,resultDate,progressionUrl);
     if(!results.length){
       await db.from('historical_archive_jobs').update({
         status:'completed',records_found:0,records_inserted:0,records_promoted:0,
         heartbeat_at:null,finished_at:now(),updated_at:now(),last_error:null
       }).eq('id',aj.id).eq('status','running');
       return
     }
     const ev=await eventMap();
     const mq=await db.from('meets').upsert({
       source_id:archive.source_id,external_id:archive.event_key,name:archive.name,
       start_date:resultDate,end_date:archive.end_date||null,course,
       city:historicalCity(txt)||null,official_url:archive.base_url,status:'completed'
     },{onConflict:'source_id,external_id'}).select('id,start_date,course').single();
     if(mq.error)throw new Error('Meet legado ProgressionDetails: '+mq.error.message);
     const m=mq.data;
     let foundAdd=0,insertedAdd=0,promotedAdd=0;const seen=new Set<string>();
     for(const r of results){
       const eid=ev.get(n(r.eventLabel));if(!eid)continue;
       const date=r.resultDate||m.start_date,rcourse=r.course||m.course;
       if(!date||!rcourse)continue;
       const key=[eid,date,rcourse,r.timeMs,r.status].join('|');if(seen.has(key))continue;seen.add(key);foundAdd++;
       let q=db.from('results').select('id,is_official,origin').eq('athlete_id',aj.athlete_id).eq('event_id',eid).eq('result_date',date).eq('course',rcourse).eq('status',r.status);
       q=r.timeMs==null?q.is('time_ms',null):q.eq('time_ms',r.timeMs);
       const {data:old}=await q.maybeSingle();
       if(old){
         if(!old.is_official){
           await db.from('results').update({meet_id:m.id,origin:'official',source_id:archive.source_id,is_official:true,notes:'Confirmado por ProgressionDetails oficial.',updated_at:now()}).eq('id',old.id);
           await db.from('result_sources').upsert({result_id:old.id,source_id:archive.source_id,source_url:progressionUrl,retrieved_at:now(),metadata:{historical_archive:archive.event_key,document:'ProgressionDetails.pdf'}},{onConflict:'result_id,source_id'});
           promotedAdd++
         }
         continue
       }
       const fp=[aj.athlete_id,m.id,eid,date,rcourse,r.timeMs,r.status].join('|');
       const ins=await db.from('results').insert({
         athlete_id:aj.athlete_id,meet_id:m.id,event_id:eid,result_date:date,course:rcourse,
         time_ms:r.timeMs,status:r.status,origin:'official',source_id:archive.source_id,is_official:true,
         category:categoryLabelFor(date,athlete?.birth_date,athlete?.category),result_fingerprint:fp
       }).select('id').single();
       if(ins.error)throw new Error('Resultado legado ProgressionDetails: '+ins.error.message);
       insertedAdd++;
       await db.from('result_sources').insert({result_id:ins.data.id,source_id:archive.source_id,source_url:progressionUrl,retrieved_at:now(),metadata:{historical_archive:archive.event_key,document:'ProgressionDetails.pdf'}})
     }
     await db.from('historical_archive_jobs').update({
       status:'completed',records_found:foundAdd,records_inserted:insertedAdd,records_promoted:promotedAdd,
       heartbeat_at:null,finished_at:now(),updated_at:now(),last_error:null
     }).eq('id',aj.id).eq('status','running');
     return
   }

   if(archive.provider==='masters_parana'){
     // Each archive here IS one etapa's results PDF (base_url points straight at
     // it, no separate root/athletes page to check first) — Masters Paraná
     // never publishes a machine-readable per-athlete entry list before an
     // etapa (the pre-meet PDF is a blank registration form; the heat-sheet PDF
     // is an image export with no extractable text), so unlike swimsystem_v2
     // there is no "scheduled" pre-result stage possible for this source: we
     // only ever learn about a result after it exists.
     await beat();
     let results:any[]=[];
     try{
       const txt=await quickReaderText(archive.base_url);
       const fallbackDate=historicalMeetDate(txt)||archive.start_date||null;
       results=parseMastersParanaResults(txt,i,fallbackDate,archive.base_url)
     }catch(e){
       await db.from('historical_archive_jobs').update({status:'completed',records_found:0,records_inserted:0,records_promoted:0,heartbeat_at:null,finished_at:now(),updated_at:now(),last_error:'DEBUG:fetch_error '+String(e).slice(0,300)}).eq('id',aj.id).eq('status','running');
       return
     }
     if(!results.length){
       await db.from('historical_archive_jobs').update({status:'completed',records_found:0,records_inserted:0,records_promoted:0,heartbeat_at:null,finished_at:now(),updated_at:now()}).eq('id',aj.id).eq('status','running');
       return
     }
     const ev=await eventMap();
     const mq=await db.from('meets').upsert({
       source_id:archive.source_id,external_id:archive.event_key,name:archive.name,
       start_date:results.find((r:any)=>r.resultDate)?.resultDate||archive.start_date||null,
       course:'SCM',official_url:archive.base_url,status:'completed'
     },{onConflict:'source_id,external_id'}).select('id,start_date,course').single();
     if(mq.error)throw new Error('Meet Masters Paraná: '+mq.error.message);
     const m=mq.data;
     let foundAdd=0,insertedAdd=0,promotedAdd=0;const seen=new Set<string>();
     for(const r of results){
       const eid=ev.get(n(r.eventLabel));if(!eid)continue;
       const date=r.resultDate||m.start_date,course=r.course||m.course;if(!date||!course)continue;
       const key=[eid,date,course,r.timeMs,r.status].join('|');if(seen.has(key))continue;seen.add(key);
       foundAdd++;
       let q=db.from('results').select('id,is_official,origin').eq('athlete_id',aj.athlete_id).eq('event_id',eid).eq('result_date',date).eq('course',course).eq('status',r.status);
       q=r.timeMs==null?q.is('time_ms',null):q.eq('time_ms',r.timeMs);
       const {data:old}=await q.maybeSingle();
       if(old){
         if(!old.is_official){
           await db.from('results').update({meet_id:m.id,origin:'official',source_id:archive.source_id,is_official:true,notes:'Confirmado por arquivo histórico oficial.',updated_at:now()}).eq('id',old.id);
           await db.from('result_sources').upsert({result_id:old.id,source_id:archive.source_id,source_url:r.sourceUrl,retrieved_at:now(),metadata:{historical_archive:archive.event_key}},{onConflict:'result_id,source_id'});
           promotedAdd++
         }
         continue
       }
       const fp=[aj.athlete_id,m.id,eid,date,course,r.timeMs,r.status].join('|');
       const ins=await db.from('results').insert({
         athlete_id:aj.athlete_id,meet_id:m.id,event_id:eid,result_date:date,course,time_ms:r.timeMs,status:r.status,
         origin:'official',source_id:archive.source_id,is_official:true,
         category:categoryLabelFor(date,athlete?.birth_date,athlete?.category),result_fingerprint:fp
       }).select('id').single();
       if(ins.error)throw new Error('Resultado Masters Paraná: '+ins.error.message);
       insertedAdd++;
       await db.from('result_sources').insert({result_id:ins.data.id,source_id:archive.source_id,source_url:r.sourceUrl,retrieved_at:now(),metadata:{historical_archive:archive.event_key}})
     }
     await db.from('historical_archive_jobs').update({
       status:'completed',records_found:foundAdd,records_inserted:insertedAdd,records_promoted:promotedAdd,
       heartbeat_at:null,finished_at:now(),updated_at:now()
     }).eq('id',aj.id).eq('status','running');
     return
   }

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
       }).eq('id',aj.id).eq('status','running');
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
     }).eq('id',aj.id).eq('status','running');
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
   }).eq('id',aj.id).eq('status','running')
 }catch(e:any){
   await db.from('historical_archive_jobs').update({
     status:'failed',heartbeat_at:null,last_error:String(e?.message||e).slice(0,1000),
     finished_at:now(),updated_at:now()
   }).eq('id',aj.id).eq('status','running');
   throw e
 }
}

async function processLink(r:any){if(r.sources?.code!=='swimsystem')throw new Error('Fonte sem adaptador');const raw=r.current_meet_url;if(!raw)throw new Error('URL do campeonato atual não informada');const u=new URL(raw);if(!/(^|\.)swimsystem\.app$/i.test(u.hostname))throw new Error('URL fora do SwimSystem');const i={external_id:r.external_id,external_name:null,athletes:r.athletes};const html=await get(meetBase(raw)+'/athletes');if(!match(cheerio.load(html)('body').text(),i)){await db.from('source_link_requests').update({status:'rejected',message:'Registro/nome não encontrado',processed_at:new Date().toISOString()}).eq('id',r.id);return}const metadata={current_meet_url:raw};await db.from('athlete_identifiers').upsert({athlete_id:r.athlete_id,source_id:r.source_id,external_id:r.external_id,status:'active',verified:true,verified_at:new Date().toISOString(),active:true,metadata},{onConflict:'athlete_id,source_id'});
// processJob() reads the URL to scan from athlete_source_configs.source_url, not
// from this metadata — without this update the current_meet job keeps scanning
// whatever generic URL the athlete had before (e.g. the SwimSystem homepage)
// and never actually looks at the linked competition.
await db.from('athlete_source_configs').update({source_url:raw,updated_at:new Date().toISOString()}).eq('athlete_id',r.athlete_id).eq('source_id',r.source_id);
await db.from('source_link_requests').update({status:'verified',message:'Vínculo validado',processed_at:new Date().toISOString()}).eq('id',r.id);await db.from('athletes').update({status:'active'}).eq('id',r.athlete_id);await db.from('monitor_jobs').upsert({athlete_id:r.athlete_id,source_id:r.source_id,job_type:'current_meet',status:'pending',priority:10,next_run_at:new Date().toISOString(),attempts:0},{onConflict:'athlete_id,source_id,job_type'})}

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

async function discoverCurrentSwimSystemMeet(j:any,i:any){
 const listing=await get('https://www.swimsystem.app/meets');
 const ids=[...new Set([...listing.matchAll(/\/meets\/sw\/([0-9a-f-]{36})/g)].map(m=>m[1]))].slice(0,20);
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
 let found=0;
 for(const id of ids){
  const base='https://www.swimsystem.app/meets/sw/'+id;
  let html='';try{html=await get(base)}catch{continue}
  const parsed=parseMeet(html,base);
  const pdfLinks=[...new Set([...html.matchAll(/https?:\/\/[^"'\s]+\.pdf/gi)].map(m=>m[0]))];
  let evidence:any=null,entries:any[]=[];
  for(const pdfUrl of pdfLinks){try{const txt=await quickReaderText(pdfUrl),evd=parseSwimSystemMeetEvidence(txt);if(evd&&!evidence)evidence=evd;if(evd)entries.push(...parseStartlistEntries(txt,i))}catch{}}
  if(!evidence?.startDate||evidence.startDate<today||!entries.length)continue;
  entries=entries.filter((e:any,idx:number,a:any[])=>a.findIndex((x:any)=>n(x.eventLabel)===n(e.eventLabel))===idx);
  const mq=await db.from('meets').upsert({source_id:j.source_id,external_id:id,name:parsed.name||('SwimSystem '+id),start_date:evidence.startDate,end_date:evidence.endDate||null,course:evidence.course,official_url:base,status:'scheduled',...(parsed.venue?{venue:parsed.venue}:{}),...(evidence.city?{city:evidence.city}:parsed.city?{city:parsed.city}:{})},{onConflict:'source_id,external_id'}).select('id').single();
  if(mq.error)throw new Error('Meet atual SwimSystem: '+mq.error.message);
  const ev=await eventMap();
  for(const e of entries){const eid=ev.get(n(e.eventLabel));if(eid)await db.from('meet_entries').upsert({meet_id:mq.data.id,athlete_id:j.athlete_id,event_id:eid,seed_time_ms:e.seedTimeMs,heat:e.heat,lane:e.lane,entry_status:'seeded',source_id:j.source_id},{onConflict:'meet_id,athlete_id,event_id'})}
  found+=entries.length
 }
 return found
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
   if(j.job_type==='current_meet'&&sourceCode==='swimsystem'){
     const found=await discoverCurrentSwimSystemMeet(j,i);
     await db.from('monitor_runs').update({status:'completed',finished_at:new Date().toISOString(),records_found:found,records_inserted:0,records_duplicated:0}).eq('id',run.id);
     await db.from('monitor_jobs').update({status:'completed',last_run_at:new Date().toISOString(),next_run_at:null,locked_at:null,last_error:null,attempts:0,request_id:null}).eq('id',j.id).eq('status','running');
     return
   }
   if(j.job_type==='historical'&&(sourceCode==='fdap'||sourceCode==='swimsystem'||sourceCode==='masters_parana')){
     // Historical archive jobs are the incremental pipeline. The monitor job only
     // schedules/reconciles that queue; it must not rescan PDFs synchronously.
     if(sourceCode==='fdap'||sourceCode==='swimsystem')await ensureArchiveJobsForDiscovered(j,i);
     if(sourceCode==='swimsystem')await ensureSwimSystemAppArchives();
     if(sourceCode==='masters_parana')await ensureMastersParanaArchives();
     // Include inactive legacy archives when they already have a job for this
     // athlete. Some old swimtime archives were disabled only because their
     // HTML host has broken TLS; the ProgressionDetails adapter no longer needs
     // that HTML host. Excluding active=false here made failed jobs impossible
     // to retry after the adapter was fixed.
     let archiveQuery=db.from('historical_archives').select('id,active,provider').eq('source_id',j.source_id);
     const {data:allArchives}=await archiveQuery;
     const {data:existingForAthlete}=await db.from('historical_archive_jobs').select('archive_id').eq('athlete_id',j.athlete_id);
     const existingArchiveIds=new Set((existingForAthlete||[]).map((x:any)=>x.archive_id));
     const archives=(allArchives||[]).filter((a:any)=>a.active||((a.provider==='swimtime_progression')&&existingArchiveIds.has(a.id)));
     for(const a of archives){
       // A user-requested refresh must retry technical failures. Previously
       // ignoreDuplicates left failed rows permanently failed, so fixes to an
       // adapter could never be exercised by a later Atualizar click.
       const {data:existing}=await db.from('historical_archive_jobs')
         .select('id,status').eq('athlete_id',j.athlete_id).eq('archive_id',a.id).maybeSingle();
       if(!existing){
         await db.from('historical_archive_jobs').insert({
           athlete_id:j.athlete_id,archive_id:a.id,status:'pending',updated_at:new Date().toISOString()
         })
       }else if(existing.status==='failed'){
         await db.from('historical_archive_jobs').update({
           status:'pending',cursor_index:0,cursor_payload:{},heartbeat_at:null,
           finished_at:null,last_error:null,records_found:0,records_inserted:0,
           records_promoted:0,updated_at:new Date().toISOString()
         }).eq('id',existing.id).eq('status','failed')
       }
     }
     const {count:remaining}=await db.from('historical_archive_jobs').select('id',{count:'exact',head:true}).eq('athlete_id',j.athlete_id).in('status',['pending','running']);
     await db.from('monitor_runs').update({status:'completed',finished_at:new Date().toISOString(),records_found:0,records_inserted:0,records_duplicated:0}).eq('id',run.id);
     // A swimsystem athlete's discovery must keep watching for new meets forever
     // (that's the whole point of the motor — no one should have to click
     // Atualizar again just so a future competition gets noticed). Once the
     // current backlog is drained, re-arm this job for a later check instead of
     // finalizing to 'completed'/next_run_at=null, which would otherwise stop it
     // from ever being claimed again until the user manually requests a refresh.
     // The legacy fdap path is a one-off cached web search, not a live listing
     // to re-poll, so it keeps its original finalize-when-drained behavior.
     const keepWatching=(sourceCode==='swimsystem'||sourceCode==='masters_parana')&&(remaining||0)===0
     const drained=(remaining||0)===0
     // request_result_refresh() treats a monitor_job that is still
     // pending/running AND tagged with a given request_id as proof that
     // request's search is still in flight, so it won't be re-queued by a
     // fresh click on "Atualizar" — it just reuses the old one. That's correct
     // while the backlog is still draining (this job IS still doing that
     // request's work), but once it's fully drained, re-arming to 'pending'
     // for keepWatching (or even finalizing to 'completed') must clear
     // request_id too: otherwise this job keeps citing the now-finished
     // request forever, and every future "Atualizar" click silently no-ops
     // instead of queuing a new search — confirmed happening for real for an
     // athlete whose keepWatching re-arm had never cleared it.
     await db.from('monitor_jobs').update({
       status:(remaining||0)>0||keepWatching?'pending':'completed',
       last_run_at:new Date().toISOString(),
       next_run_at:(remaining||0)>0?new Date(Date.now()+60000).toISOString():keepWatching?new Date(Date.now()+6*60*60*1000).toISOString():null,
       locked_at:null,last_error:null,attempts:0,
       ...(drained?{request_id:null}:{})
     }).eq('id',j.id).eq('status','running');
     return
   }else if(sourceCode==='swimsystem'){
     // The live meet overview page is client-rendered (no per-event links in the
     // server HTML), so per-event scraping via discover()/parseResults() rarely
     // finds anything. The site does publish static PDF result reports for the
     // meet (linked from the overview page) — those are the reliable source.
     const base=meetBase(url),html=await get(base);meet=parseMeet(html,base);
     try{entries=parseEntries(await get(base+'/athletes'),i)}catch{}
     const pages=discover(html,base);
     for(const p of pages.slice(0,80)){try{results.push(...parseResults(await get(p.url),p.url,p.label,i,meet.course,meet.startDate))}catch{}}
     const pdfLinks=[...new Set([...html.matchAll(/https?:\/\/[^"'\s]+\.pdf/gi)].map(m=>m[0]))];
     let reportEvidence:any=null;
     for(const pdfUrl of pdfLinks){
      try{
       const txt=await quickReaderText(pdfUrl),evd=parseSwimSystemMeetEvidence(txt);
       if(evd&&!reportEvidence)reportEvidence=evd;
       results.push(...parseClubDetailResults(txt,i,evd?.course||null,evd?.startDate||null,pdfUrl));
      }catch{}
     }
     if(reportEvidence)meet={...meet,startDate:reportEvidence.startDate,endDate:reportEvidence.endDate,course:reportEvidence.course,city:reportEvidence.city};
   }else{
     const rootHtml=await get(url),$=cheerio.load(rootHtml),body=$('body').text().replace(/\s+/g,' ');
     meet={externalId:'search-'+sourceCode+'-'+j.athlete_id,name:j.sources?.name||cfg.display_name,startDate:dateFrom(body),course:/\b25\s*m\b/i.test(body)?'SCM':/\b50\s*m\b/i.test(body)?'LCM':null,officialUrl:url};
     results.push(...parseGeneric(rootHtml,url,i));
     for(const p of discoverGeneric(rootHtml,url)){if(/\.pdf(?:$|\?)/i.test(p.url))continue;try{results.push(...parseGeneric(await get(p.url),p.url,i))}catch{}}
   }
   if(!meet.startDate)throw new Error('Data da competição não encontrada na fonte oficial; resultado não pode ser registrado sem data confiável.');
   const {data:m}=await db.from('meets').upsert({source_id:j.source_id,external_id:meet.externalId,name:meet.name,start_date:meet.startDate,course:meet.course,official_url:meet.officialUrl,status:'active',...(meet.venue?{venue:meet.venue}:{}),...(meet.city?{city:meet.city}:{})},{onConflict:'source_id,external_id'}).select('id,start_date,course').single();
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
   await db.from('monitor_jobs').update({status:'completed',last_run_at:new Date().toISOString(),next_run_at:null,locked_at:null,last_error:null,attempts:0}).eq('id',j.id).eq('status','running')
 }catch(e:any){
   await db.from('monitor_runs').update({status:'failed',finished_at:new Date().toISOString(),error_code:String(e.message||e).slice(0,240)}).eq('id',run.id);
   await db.from('monitor_jobs').update({status:'failed',locked_at:null,last_error:String(e.message||e).slice(0,1000),next_run_at:null}).eq('id',j.id).eq('status','running');throw e
 }
}

Deno.serve(async(req)=>{
 const invocationStart=Date.now();
 let forceAthleteId='';
 try{const body=await req.clone().json();forceAthleteId=typeof body?.force_athlete_id==='string'?body.force_athlete_id:''}catch{}
 if(!forceAthleteId){try{forceAthleteId=new URL(req.url).searchParams.get('force_athlete_id')||''}catch{}}
 // Free-plan wall-clock budget is 150s. Reserve a safety margin for the
 // links/monitor_jobs sections above and general jitter, and only start the
 // next archive job if there's still enough safe time for its worst case
 // (base page ~12s + ProgressionDetails.pdf ~18s + up to 2 result links at
 // ~18s each = ~66s, rounded up). This replaces a fixed 1-per-invocation
 // cap with "as many as safely fit", so fast real-world runs (sub-second,
 // as observed) drain the queue in one invocation instead of one per minute.
 const WALL_CLOCK_BUDGET_MS=150000;
 const SAFETY_MARGIN_MS=20000;
 const PER_ARCHIVE_WORST_CASE_MS=70000;
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

  let ids:string[]=[];
  if(forceAthleteId){
   // Diagnostic execution: run the athlete's already-existing historical jobs
   // now, without fabricating results or changing archive/result data by hand.
   const {data:forced}=await db.from('monitor_jobs').select('id').eq('athlete_id',forceAthleteId).eq('job_type','historical').eq('status','pending');
   ids=(forced||[]).map((x:any)=>x.id);
   if(ids.length)await db.from('monitor_jobs').update({status:'running',locked_at:new Date().toISOString(),updated_at:new Date().toISOString()}).in('id',ids).eq('status','pending');
  }else{
   const {data:claimed,error:claimError}=await db.rpc('claim_monitor_jobs',{p_limit:1});
   if(claimError)throw claimError;
   ids=(claimed||[]).map((x:any)=>x.id);
  }
  let jobs:any[]=[];
  if(ids.length){
   const q=await db.from('monitor_jobs').select('*,sources(code),athletes(full_name,preferred_name,birth_date,gender)').in('id',ids);
   if(q.error)throw q.error;jobs=q.data||[]
  }
  for(const j of jobs){
   summary.jobs++;
   try{await processJob(j)}catch(e:any){summary.errors.push(e.message||String(e))}
  }

  while(true){
   const remaining=WALL_CLOCK_BUDGET_MS-SAFETY_MARGIN_MS-(Date.now()-invocationStart);
   if(remaining<PER_ARCHIVE_WORST_CASE_MS)break;
   const {data:archiveJobs,error:archiveClaimError}=await db.rpc('claim_historical_archive_jobs',{p_limit:1});
   if(archiveClaimError)throw archiveClaimError;
   if(!archiveJobs||!archiveJobs.length)break;
   for(const aj of archiveJobs){
    summary.archives++;
    try{await processArchiveJob(aj)}catch(e:any){summary.errors.push(e.message||String(e))}
   }
  }

  return json({ok:true,...summary})
 } catch(e:any){
  return json({ok:false,error:e.message||String(e),...summary},500)
 }
});
