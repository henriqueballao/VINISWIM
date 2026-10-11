// CANDIDATE: no deployment until schema, secret, scheduler and UI cutover pass.
import {createClient} from '@supabase/supabase-js';
import {officialWorkerHandler} from '../../../packages/official-worker/src/runner.mjs';
import {extractOfficialPdfJs} from '../../../packages/official-worker/src/pdf-js-extractor.mjs';
const url=Deno.env.get('SUPABASE_URL');
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const configuredToken=Deno.env.get('OFFICIAL_IMPORT_WORKER_TOKEN');
const client=url&&key?createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}):null;
let cached:Promise<ReturnType<typeof officialWorkerHandler>>|null=null;
function getHandler(){
 if(!cached)cached=(async()=>{
  if(!client)throw new Error('worker_not_configured');
  let token=configuredToken;
  if(!token){const response=await client.rpc('read_official_worker_token');if(response.error||typeof response.data!=='string')throw new Error('worker_not_configured');token=response.data;}
  return officialWorkerHandler({rpc:(name:string,args:Record<string,unknown>)=>client.rpc(name,args),extractPdf:extractOfficialPdfJs,serviceToken:token});
 })();
 return cached;
}
Deno.serve(async(request:Request)=>{
 if(request.method!=='POST')return Response.json({outcome:'method_not_allowed'},{status:405});
 if(!/^Bearer [^\s]+$/.test(request.headers.get('authorization')||''))return Response.json({outcome:'service_authentication_required'},{status:401});
 try{return (await getHandler())(request);}
 catch{cached=null;return Response.json({outcome:'worker_not_configured'},{status:503});}
});
