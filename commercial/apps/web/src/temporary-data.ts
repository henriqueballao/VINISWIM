import dataset from './data/vini-temporary.json'

const PREFIX='viniswim-temporary-20261107:'
export const temporaryAccounts=dataset.accounts.map((account,i)=>({
 id:'temporary-account-'+i,
 athlete_id:account.athlete_id,
 name:account.account_name
}))
export const temporaryKey=(athleteId:string)=>PREFIX+athleteId
export function temporaryHidden(id:string){try{return localStorage.getItem(temporaryKey(id))==='1'}catch{return false}}
const removedKey=(id:string)=>temporaryKey(id)+':removed'
export function temporaryRemovedIds(id:string):string[]{try{return JSON.parse(localStorage.getItem(removedKey(id))||'[]')}catch{return []}}
export function temporaryDeleteResult(id:string,resultId:string){const ids=new Set(temporaryRemovedIds(id));ids.add(resultId);localStorage.setItem(removedKey(id),JSON.stringify([...ids]))}
export function temporaryDeleteBatch(id:string){localStorage.setItem(temporaryKey(id),'1')}
export function temporaryRestoreBatch(id:string){localStorage.removeItem(temporaryKey(id));localStorage.removeItem(removedKey(id))}
const dateFrom=(value:string)=>value.slice(0,10)
const eventCode=(label:string)=>label.trim().replace(/[^a-z0-9]+/gi,'-').toLowerCase()
export const temporaryEvents=[...new Set(dataset.accounts[0].results.map(r=>r.event))].map((label,i)=>({
 id:'temporary-event-'+eventCode(label),label,sort_order:i
}))
const eventId=(label:string)=>'temporary-event-'+eventCode(label)
const meetCode=(name:string,date:string)=>'temporary-meet-'+eventCode(name)+'-'+date.slice(0,7)
export function getTemporaryAccount(index:number){
 const account=dataset.accounts[index]??dataset.accounts[0]
 const athlete={id:account.athlete_id,account_id:temporaryAccounts[index]?.id,full_name:dataset.athlete,preferred_name:'Vini',birth_date:'2015-01-01',club_name:'Curitibano',category:'Petiz I',status:'active',active:true}
 const meetMap=new Map<string,any>()
 for(const r of account.results){
  const id=meetCode(r.meet,r.date)
  if(!meetMap.has(id))meetMap.set(id,{id,name:r.meet,start_date:dateFrom(r.date),end_date:r.date.includes('/')?r.date.split('/').at(-1):r.date,course:r.course,status:r.date.startsWith('2026-11')?'scheduled':'completed',official_url:r.source||null})
 }
 const meets=[...meetMap.values()]
 const removed=new Set(temporaryRemovedIds(account.athlete_id))
 const rows=account.results.filter(r=>(r.time_ms!=null||r.status==='dns')&&!temporaryHidden(account.athlete_id)&&!removed.has('temporary-result-'+r.key)).map((r,i)=>({
  id:'temporary-result-'+r.key,athlete_id:account.athlete_id,meet_id:meetCode(r.meet,r.date),meet_name:r.meet,event_id:eventId(r.event),
  result_date:dateFrom(r.date),course:r.course,time_ms:r.time_ms,status:r.status==='dns'?'dns':'valid',origin:'temporary',is_official:false,chronological_number:i+1,
  category:'Petiz I',venue:null,city:null,notes:'Dado manual recuperado e removível; confirmar data e piscina quando ausentes',
  created_at:'2026-11-07T12:00:00Z',result_fingerprint:'temporary-'+r.key
 }))
 const entries=account.results.filter(r=>r.seed_ms!=null&&!temporaryHidden(account.athlete_id)).map(r=>({
  id:'temporary-entry-'+r.key,athlete_id:account.athlete_id,meet_id:meetCode(r.meet,r.date),event_id:eventId(r.event),
  seed_time_ms:r.seed_ms,heat:r.heat,lane:r.lane,scheduled_at:r.date+'T'+(r.scheduled??'12:00')+':00',
  meets:meetMap.get(meetCode(r.meet,r.date)),entry_status:'confirmed'
 }))
 const byEvent=new Map<string,any>()
 for(const r of rows){if(!r.course)continue;const k=r.event_id+'|'+r.course;const prior=byEvent.get(k);if(!prior||(r.time_ms??Infinity)<(prior.time_ms??Infinity))byEvent.set(k,r)}
 const pbs=[...byEvent.values()].map(r=>({...r,pb_id:'temporary-pb-'+r.id}))
 return {athlete,meets,results:rows,entries,pbs,overview:{total_results:rows.length,manual_results:rows.length,official_results:0,occurrences:rows.filter(r=>r.status!=='valid').length},account:temporaryAccounts[index],membership:temporaryAccounts.map(a=>({account_id:a.id,role:'viewer',accounts:a}))}
}
