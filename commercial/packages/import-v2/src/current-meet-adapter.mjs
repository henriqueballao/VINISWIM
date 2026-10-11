import {parseSeededStartlist} from './swimsystem-seeded.mjs';
import {parseModernResultBook} from './swimsystem-modern-results.mjs';
import {validateResultCandidate} from './contracts.mjs';

export function officialResultKey(result){
 return [result.sourceCode,result.externalMeetId,result.athleteExternalId,result.event,result.resultDate,result.course].join('|');
}

// Pure normalization boundary. Network capture and persistence are separate.
// Caller must persist accepted evidence atomically and retain these diagnostics.
export function scanCurrentMeet({meetId,identity,documents,allowedHosts}){
 const entries=new Map(),results=new Map(),diagnostics=[];
 if(!/^\d+$/.test(String(identity?.externalId||'')))return {status:'identity_not_found',entries:[],results:[],diagnostics:[{code:'identity_not_found'}],writes:0};
 for(const doc of documents){
  const sourceUrl=doc.url||doc.sourceUrl;
  if(doc.failure){diagnostics.push({sourceUrl,code:doc.failure.code});continue;}
  let url;try{url=new URL(sourceUrl);}catch{diagnostics.push({sourceUrl,code:'invalid_source_url'});continue;}
  if(url.protocol!=='https:'||!allowedHosts.includes(url.hostname)||!url.pathname.includes(`/meet-documents/${meetId}/`)||! /\.pdf$/i.test(url.pathname)){
   diagnostics.push({sourceUrl,code:'unapproved_document_source'});continue;
  }
  if(!/^[a-f0-9]{64}$/.test(doc.rawHash||'')||!Number.isFinite(Date.parse(doc.retrievedAt))){diagnostics.push({sourceUrl,code:'missing_capture_provenance'});continue;}
  const args={...doc,sourceUrl,identity,meet:{sourceCode:'swimsystem',externalMeetId:meetId}};
  for(const entry of parseSeededStartlist(args))entries.set([entry.athleteExternalId,entry.event,entry.eventDate,entry.course].join('|'),entry);
  for(const candidate of parseModernResultBook(args)){
   const validation=validateResultCandidate(candidate);
   if(!validation.accepted||candidate.athleteExternalId!==identity.externalId){diagnostics.push({sourceUrl,code:'invalid_official_candidate',errors:validation.errors});continue;}
   const result={...candidate,kind:'official_result',rawHash:doc.rawHash};
   const key=officialResultKey(result),previous=results.get(key);
   // Conflicting publications require reconciliation, never arbitrary overwrite.
   if(previous&&(previous.timeMs!==result.timeMs||previous.status!==result.status)){
    diagnostics.push({sourceUrl,code:'conflicting_official_publications',key});results.set(key,null);continue;
   }
   if(!diagnostics.some(d=>d.code==='conflicting_official_publications'&&d.key===key))results.set(key,result);
  }
 }
 const status=diagnostics.length?'partial':results.size?'results_parsed':entries.size?'no_result_publication':'identity_not_found';
 return {status,entries:[...entries.values()],results:[...results.values()].filter(Boolean),diagnostics,writes:0};
}
