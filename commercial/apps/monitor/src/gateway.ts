const monitorEndpoint=process.env.SUPABASE_FUNCTION_URL
const pushEndpoint=process.env.SUPABASE_PUSH_FUNCTION_URL
const anonJwt=process.env.SUPABASE_ANON_JWT
const monitorToken=process.env.MONITOR_TOKEN
if(!monitorEndpoint||!pushEndpoint||!anonJwt||!monitorToken)throw new Error('Configuração dos gateways ausente')
async function call<T>(endpoint:string,action:string,payload:Record<string,unknown>={}){
 const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${anonJwt}`,'apikey':anonJwt,'x-monitor-token':monitorToken},body:JSON.stringify({action,...payload})})
 const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data?.error||`Gateway HTTP ${r.status}`);return data as T
}
export const gateway=<T=any>(action:string,payload:Record<string,unknown>={})=>call<T>(monitorEndpoint,action,payload)
export const pushGateway=<T=any>(action:string,payload:Record<string,unknown>={})=>call<T>(pushEndpoint,action,payload)
