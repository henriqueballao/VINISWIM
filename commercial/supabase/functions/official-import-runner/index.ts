// CANDIDATE: no deployment until schema, secret, scheduler and UI cutover pass.
import {createClient} from '@supabase/supabase-js';
import {officialWorkerHandler} from '../../../packages/official-worker/src/runner.mjs';
import {extractOfficialPdfJs} from '../../../packages/official-worker/src/pdf-js-extractor.mjs';
const url=Deno.env.get('SUPABASE_URL');
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const token=Deno.env.get('OFFICIAL_IMPORT_WORKER_TOKEN');
const client=url&&key?createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}):null;
const handler=client?officialWorkerHandler({
 rpc:(name:string,args:Record<string,unknown>)=>client.rpc(name,args),
 extractPdf:extractOfficialPdfJs,
 serviceToken:token,
}):null;
Deno.serve((request:Request)=>handler?handler(request):Response.json({outcome:'worker_not_configured'},{status:503}));
