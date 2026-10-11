import {classifyImportFailure} from './failure-states.mjs';

const captures=new WeakMap();

// Only the byte-capture boundary can attest provenance. Copies/JSON supplied by
// clients are not attested; persistence receives a fresh copy of original bytes.
export function verifiedCaptureEvidence(document){
 const stored=captures.get(document);
 return stored?{...stored,bytes:stored.bytes.slice()}:null;
}

export class SourceAccessError extends Error {
 constructor(message,details={}){super(message);this.name='SourceAccessError';Object.assign(this,details);this.failure=classifyImportFailure({...details,message});}
}

// Fetch the original publication directly. extractPdf must be an authorized local
// byte extractor; this module never sends protected URLs to a reader proxy.
export async function captureOfficialDocument({url,allowedHosts,fetchImpl=fetch,extractPdf,now=()=>new Date(),timeoutMs=15000,maxBytes=20*1024*1024}){
 const check=(value)=>{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||!allowedHosts.includes(u.hostname))throw new SourceAccessError('Unapproved official document URL',{httpStatus:403});return u;};
 let target=check(url),response;
 const requestedUrl=target.href,redirectChain=[];
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  for(let redirects=0;redirects<=3;redirects++){
   response=await fetchImpl(target.href,{signal:controller.signal,redirect:'manual',headers:{accept:'application/pdf,text/html,text/plain'}});
   if([301,302,303,307,308].includes(response.status)){
    const location=response.headers.get('location');
    if(!location||redirects===3)throw new SourceAccessError('Invalid document redirect');
    const next=check(new URL(location,target).href);redirectChain.push(Object.freeze({from:target.href,to:next.href,status:response.status}));target=next;continue;
   }
   break;
  }
  if(!response.ok)throw new SourceAccessError(`Official source HTTP ${response.status}`,{httpStatus:response.status,sourceUrl:target.href});
  const declared=Number(response.headers.get('content-length')||0);
  if(declared>maxBytes)throw new SourceAccessError('Official document exceeds size limit',{formatUnrecognized:true});
  const chunks=[];let size=0;
  if(!response.body)throw new SourceAccessError('Empty official document',{formatUnrecognized:true});
  const reader=response.body.getReader();
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes)throw new SourceAccessError('Official document exceeds size limit',{formatUnrecognized:true});chunks.push(value);}}finally{await reader.cancel();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const retrievedAt=now().toISOString();
  const rawHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
  const mime=response.headers.get('content-type')?.split(';')[0].trim()||'';
  const isPdf=new TextDecoder().decode(bytes.slice(0,5))==='%PDF-';
  let text;
  if(isPdf){if(!extractPdf)throw new SourceAccessError('Authorized PDF extractor is unavailable',{formatUnrecognized:true});text=await extractPdf(bytes.slice());}
  else if(['text/plain','text/html'].includes(mime))text=new TextDecoder().decode(bytes);
  else throw new SourceAccessError('Official document format is unrecognized',{formatUnrecognized:true});
  if(/cf-chl-|<title>\s*(?:just a moment|attention required)|verify you are human/i.test(text))throw new SourceAccessError('Official source requires anti-bot validation',{antiBot:true,sourceUrl:target.href});
  if(/object not found/i.test(text)&&text.length<2000)throw new SourceAccessError('Official document object not found',{httpStatus:404,sourceUrl:target.href});
  if(!text.trim())throw new SourceAccessError('Empty extracted official document',{formatUnrecognized:true});
  const document=Object.freeze({requestedUrl,redirectChain:Object.freeze(redirectChain),url:target.href,retrievedAt,rawHash,mime,bytes:bytes.slice(),text});
  captures.set(document,{requestedUrl,redirectChain:document.redirectChain,url:document.url,retrievedAt:document.retrievedAt,rawHash,mime,bytes:bytes.slice(),text});
  return document;
 }catch(error){if(error instanceof SourceAccessError)throw error;throw new SourceAccessError(String(error?.message||error),{sourceUrl:target.href});}
 finally{clearTimeout(timer);}
}
