import {parseMeetEvidence} from './swimsystem-current.mjs';
import {parseSeededStartlist} from './swimsystem-seeded.mjs';
import {parseModernResultBook} from './swimsystem-modern-results.mjs';
import {verifiedCaptureEvidence} from './official-document.mjs';
import {validateResultCandidate} from './contracts.mjs';

export function officialResultKey(result){
 const fields=['accountId','athleteId','sourceCode','externalMeetId','athleteExternalId','externalEventId','round','sex','resultDate','course'];
 if(fields.some(k=>typeof result[k]!=='string'||!result[k].trim()))throw new TypeError('Incomplete tenant/event identity');
 return JSON.stringify(fields.map(k=>result[k]));
}

// Pure normalization boundary. Network capture and persistence are separate.
// Caller must persist accepted evidence atomically and retain these diagnostics.
export function scanCurrentMeet({meetId,identity,documents,allowedHosts,scope,expectedMeet}){
 const entries=new Map(),results=new Map(),diagnostics=[];
 if(!scope?.accountId||!scope?.athleteId)return {status:'blocked',entries:[],results:[],diagnostics:[{code:'missing_tenant_scope'}],writes:0};
 if(!expectedMeet?.startDate||!expectedMeet?.endDate||!['LCM','SCM'].includes(expectedMeet.course))return {status:'blocked',entries:[],results:[],diagnostics:[{code:'missing_meet_binding'}],writes:0};
 if(!/^\d+$/.test(String(identity?.externalId||'')))return {status:'identity_not_found',entries:[],results:[],diagnostics:[{code:'identity_not_found'}],writes:0};
 for(const doc of documents){
  const sourceUrl=doc.url||doc.sourceUrl;
  if(doc.failure){diagnostics.push({sourceUrl,code:doc.failure.code});continue;}
  let url;try{url=new URL(sourceUrl);}catch{diagnostics.push({sourceUrl,code:'invalid_source_url'});continue;}
  if(url.protocol!=='https:'||!allowedHosts.includes(url.hostname)||!url.pathname.includes(`/meet-documents/${meetId}/`)||! /\.pdf$/i.test(url.pathname)){
   diagnostics.push({sourceUrl,code:'unapproved_document_source'});continue;
  }
  if(!verifiedCaptureEvidence(doc)){diagnostics.push({sourceUrl,code:'missing_capture_provenance'});continue;}
  const evidence=parseMeetEvidence(doc.text);
  if(!evidence.accepted){diagnostics.push({sourceUrl,code:'format_unrecognized'});continue;}
  if(evidence.meet.startDate!==expectedMeet.startDate||evidence.meet.endDate!==expectedMeet.endDate||evidence.meet.course!==expectedMeet.course){diagnostics.push({sourceUrl,code:'inconsistent_meet_evidence'});continue;}
  const args={...doc,sourceUrl,identity,meet:{sourceCode:'swimsystem',externalMeetId:meetId,...expectedMeet}};
  for(const parsed of parseSeededStartlist(args)){
   if(expectedMeet&&(parsed.eventDate<expectedMeet.startDate||parsed.eventDate>expectedMeet.endDate||parsed.course!==expectedMeet.course)){diagnostics.push({sourceUrl,code:'inconsistent_meet_evidence'});continue;}
   const entry={...parsed,...scope,sourceCode:'swimsystem',externalMeetId:meetId};
   const key=officialResultKey({...entry,resultDate:entry.eventDate}),previous=entries.get(key);
   if(previous&&['heat','lane','scheduledAt','seedTimeMs'].some(k=>previous[k]!==entry[k])){
    diagnostics.push({sourceUrl,code:'conflicting_official_seedings',key});entries.set(key,null);continue;
   }
   if(!entries.has(key))entries.set(key,entry);
  }
  for(const candidate of parseModernResultBook(args)){
   const validation=validateResultCandidate(candidate);
   if(!validation.accepted||candidate.athleteExternalId!==identity.externalId){diagnostics.push({sourceUrl,code:'invalid_official_candidate',errors:validation.errors});continue;}
   const result={...candidate,...scope,kind:'official_result',rawHash:doc.rawHash};
   const key=officialResultKey(result),previous=results.get(key);
   // Conflicting publications require reconciliation, never arbitrary overwrite.
   if(previous&&(previous.timeMs!==result.timeMs||previous.status!==result.status)){
    diagnostics.push({sourceUrl,code:'conflicting_official_publications',key});results.set(key,null);continue;
   }
   if(!diagnostics.some(d=>d.code==='conflicting_official_publications'&&d.key===key))results.set(key,result);
  }
 }
 const status=diagnostics.length?'partial':results.size?'results_parsed':entries.size?'no_result_publication':'identity_not_found';
 return {status,entries:[...entries.values()].filter(Boolean),results:[...results.values()].filter(Boolean),diagnostics,writes:0};
}
