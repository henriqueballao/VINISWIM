import {createHash,timingSafeEqual} from 'node:crypto';
const digest=value=>createHash('sha256').update(value).digest();
export function authorizeWorkerRequest(request,configuredToken){
 if(request.method!=='POST')return {allowed:false,status:405,code:'method_not_allowed'};
 if(typeof configuredToken!=='string'||configuredToken.length<32)return {allowed:false,status:503,code:'worker_not_configured'};
 const match=request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/);
 if(!match||!timingSafeEqual(digest(match[1]),digest(configuredToken)))return {allowed:false,status:401,code:'service_authentication_required'};
 return {allowed:true};
}
