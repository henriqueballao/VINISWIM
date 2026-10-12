import {parse} from 'parse5';
import {verifiedCaptureEvidence,SourceAccessError} from '../../import-v2/src/official-document.mjs';
const storageHost='sportstimingbrasil-swimsystem.supabase.co';
const uuid='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
export function canonicalMeetUrl(value){
 const u=new URL(value),match=u.pathname.match(new RegExp(`^/meets/sw/(${uuid})/?$`,'i'));
 if(u.protocol!=='https:'||!['www.swimsystem.app','swimsystem.app'].includes(u.hostname)||u.port||u.username||u.password||!match)throw new SourceAccessError('Unsupported official meet URL',{formatUnrecognized:true});
 return {externalMeetId:match[1].toLowerCase(),officialUrl:`https://www.swimsystem.app/meets/sw/${match[1].toLowerCase()}`};
}
const attr=(node,name)=>node.attrs?.find(a=>a.name===name)?.value;
const text=node=>node.nodeName==='#text'?node.value:(node.childNodes||[]).filter(n=>!['script','style'].includes(n.tagName)).map(text).join(' ');
function walk(node,visit){visit(node);for(const child of node.childNodes||[])walk(child,visit);}
function date(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export function discoverOfficialMeet(document){
 if(!verifiedCaptureEvidence(document))throw new SourceAccessError('Discovery requires original captured HTML',{formatUnrecognized:true});
 const binding=canonicalMeetUrl(document.url),dom=parse(document.text),events=[],links=[];
 walk(dom,node=>{
  if(node.tagName==='script'&&attr(node,'type')==='application/ld+json'){
   let data;try{data=JSON.parse((node.childNodes||[]).map(n=>n.value||'').join(''));}catch{throw new SourceAccessError('Invalid official structured metadata',{formatUnrecognized:true});}
   const visit=value=>{if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach(visit);return;}if(value['@type']==='SportsEvent')events.push(value);if(value['@graph'])visit(value['@graph']);};visit(data);
  }
  if(node.tagName==='a'&&attr(node,'href'))links.push({href:attr(node,'href'),label:text(node).replace(/\s+/g,' ').trim()});
 });
 const matching=events.filter(e=>{try{return canonicalMeetUrl(e.url).externalMeetId===binding.externalMeetId;}catch{return false;}});
 if(matching.length!==1)throw new SourceAccessError('Missing or ambiguous official competition metadata',{formatUnrecognized:true});
 const event=matching[0],visible=text(dom).replace(/\s+/g,' '),courses=[];
 if(/Piscina Longa\s*[·-]?\s*50\s*m/i.test(visible))courses.push('LCM');
 if(/Piscina Curta\s*[·-]?\s*25\s*m/i.test(visible))courses.push('SCM');
 if(!event.name?.trim()||!date(event.startDate)||!date(event.endDate)||event.endDate<event.startDate||courses.length!==1)throw new SourceAccessError('Incomplete official competition dates or pool',{formatUnrecognized:true});
 const documents=new Map(),skipped=[];
 for(const link of links){
  let u;try{u=new URL(link.href,document.url);}catch{continue;}
  if(!/\.pdf$/i.test(u.pathname))continue;
  if(u.protocol!=='https:'||u.hostname!==storageHost||u.port||u.username||u.password||u.search||u.hash||!new RegExp(`^/storage/v1/object/public/reports/meet-documents/${binding.externalMeetId}/${uuid}\\.pdf$`,'i').test(u.pathname))throw new SourceAccessError('Official page links to unapproved PDF provenance',{formatUnrecognized:true});
  const label=link.label.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
  const kind=/^resultados?\b/.test(label)?'results':/^balizamento\b/.test(label)&&!label.includes('resumido')?'seeded':null;
  if(kind)documents.set(u.href,{url:u.href,label:link.label,kind});else skipped.push({url:u.href,label:link.label,reason:'outside_seeded_result_adapter'});
 }
 return {meet:{...binding,name:event.name.trim(),startDate:event.startDate,endDate:event.endDate,course:courses[0],city:event.location?.address?.addressLocality||null},documents:[...documents.values()],skipped,pageEvidence:{url:document.url,rawHash:document.rawHash,retrievedAt:document.retrievedAt}};
}
