import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {classifyImportFailure} from '../commercial/packages/import-v2/src/failure-states.mjs';

// Public GET requests only. No tokens, session creation, CAPTCHA solving or writes.
const output='audit-evidence';
await mkdir(output,{recursive:true});
const captures=[];
async function capture(url,name){
 const retrievedAt=new Date().toISOString();
 try{
  const response=await fetch(url,{signal:AbortSignal.timeout(20000),redirect:'follow'});
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length>20*1024*1024)throw new Error('capture exceeds 20 MiB');
  const text=response.headers.get('content-type')?.includes('text')?bytes.toString('utf8'):'';
  const antiBot=/cf-chl-|cf-turnstile|challenges.cloudflare.com\/turnstile|verify you are human/i.test(text);
  const failure=!response.ok||antiBot?classifyImportFailure({httpStatus:response.status,antiBot}):null;
  const metadata={requestedUrl:url,url:response.url,retrievedAt,httpStatus:response.status,contentType:response.headers.get('content-type'),rawHash:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,outcome:failure?.code||'document_captured',file:name};
  await writeFile(`${output}/${name}`,bytes);captures.push(metadata);
  return {metadata,text};
 }catch(error){captures.push({requestedUrl:url,retrievedAt,outcome:'capture_failed',failure:classifyImportFailure({error}),message:String(error.message)});return null;}
}
const frontend=await capture('https://viniswim.com.br/app/','frontend.html');
if(frontend?.metadata.outcome==='document_captured'){
 const modules=[...frontend.text.matchAll(/<script\b[^>]*src=["']([^"']+)["'][^>]*>/gi)].map(x=>new URL(x[1],frontend.metadata.url));
 for(let i=0;i<modules.length;i++)if(modules[i].origin==='https://viniswim.com.br')await capture(modules[i].href,`frontend-module-${i}.js`);
}
const source=await capture('https://www.swimsystem.app/meets/sw/c8587533-2e44-4b08-991f-f827170c7344','competition.html');
await writeFile(`${output}/captures.json`,JSON.stringify({mode:'live-readonly',resultsInserted:0,captures},null,2));
for(const item of captures)console.log(JSON.stringify(item));
// HTML access is separate from athlete identity, startlists and result ingestion.
if(!frontend||!source||frontend.metadata.outcome!=='document_captured'||source.metadata.outcome!=='document_captured')process.exitCode=1;
