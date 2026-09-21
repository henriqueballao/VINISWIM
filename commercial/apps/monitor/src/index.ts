import express from 'express'
import webpush from 'web-push'
import {gateway,pushGateway} from './gateway.js'
import {swimSystem} from './sources/swimsystem.js'
import type {Identifier,SourceAdapter} from './sources/types.js'
const app=express();app.use(express.json())
const PORT=Number(process.env.PORT||8080),INTERVAL=Number(process.env.CHECK_INTERVAL_MS||60000)
const adapters:Record<string,SourceAdapter>={swimsystem:swimSystem}
const vapidPublic=process.env.VAPID_PUBLIC_KEY||'',vapidPrivate=process.env.VAPID_PRIVATE_KEY||'',vapidSubject=process.env.VAPID_SUBJECT||'mailto:admin@viniswim.app'
if(vapidPublic&&vapidPrivate)webpush.setVapidDetails(vapidSubject,vapidPublic,vapidPrivate)
let running=false,lastRun:string|null=null,lastError:string|null=null
async function processLinks(links:any[]){for(const r of links){const adapter=adapters[r.sources?.code];if(!adapter?.verifyIdentifier){await gateway('link-result',{requestId:r.id,ok:false,message:'Fonte sem validador disponível'});continue}const id={id:r.id,athlete_id:r.athlete_id,source_id:r.source_id,external_id:r.external_id,external_name:null,metadata:{current_meet_url:r.current_meet_url},athletes:r.athletes} as Identifier;try{const v=await adapter.verifyIdentifier(id);await gateway('link-result',{requestId:r.id,ok:v.ok,externalName:v.externalName||null,message:v.message||null})}catch(e:any){await gateway('link-result',{requestId:r.id,ok:false,message:e?.message||String(e)})}}}
async function processJobs(jobs:any[]){for(const j of jobs){const adapter=adapters[j.sources?.code];if(!adapter)continue;let runId:string|undefined;try{const start=await gateway<{runId:string}>('start-run',{jobId:j.id});runId=start.runId;const scan=await adapter.scanCurrent(j.identifier as Identifier);if(!scan)throw new Error('Fonte sem campeonato atual configurado');await gateway('commit-scan',{jobId:j.id,runId,scan})}catch(e:any){await gateway('fail-run',{jobId:j.id,runId,message:e?.message||String(e)})}}}
async function processPush(){if(!vapidPublic||!vapidPrivate)return;const work=await pushGateway<any>('work');for(const item of work.items||[]){let sent=0,failed=0;for(const d of item.devices||[]){try{await webpush.sendNotification({endpoint:d.endpoint,keys:{p256dh:d.p256dh,auth:d.auth_key}},JSON.stringify({title:item.title,body:item.body,data:item.data||{}}));sent++}catch{failed++}}await pushGateway('result',{notificationId:item.id,sent,failed})}}
async function cycle(){if(running)return;running=true;try{const work=await gateway<any>('work');await processLinks(work.links||[]);await processJobs(work.jobs||[]);await processPush();lastRun=new Date().toISOString();lastError=null}catch(e:any){lastError=e?.message||String(e);console.error(e)}finally{running=false}}
app.get('/health',(_req,res)=>res.json({ok:true,running,lastRun,lastError,service:'viniswim-commercial-monitor'}))
app.post('/run',(_req,res)=>{void cycle();res.status(202).json({accepted:true})})
app.listen(PORT,()=>console.log(`VINISWIM monitor :${PORT}`));setInterval(()=>void cycle(),INTERVAL);void cycle()
