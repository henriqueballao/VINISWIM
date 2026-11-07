import {useEffect,useState} from 'react'
import fixture from '../../../../sandbox-data/vini-20261107/fixture.json'

type SandboxRecord={
 key:string;meet:string;meet_date_or_range:string;event:string;course:string|null;
 result_time:string|null;time_ms:number|null;status:string;
 seed_time?:string;heat?:number;lane?:number;stage?:number;scheduled_local_time?:string;
 evidence_type:string;source_url?:string
}
type SandboxAccount={athlete_id:string;account_name:string;records:SandboxRecord[]}
const recordsByAthlete=new Map((fixture.accounts as SandboxAccount[]).map(a=>[a.athlete_id,a]))
const storageKey=(uid:string,accountId:string,athleteId:string)=>`viniswim-sandbox-20261107:${uid}:${accountId}:${athleteId}`

/** A local, clearly labelled preview. Never writes to official Supabase results or entries. */
export function SandboxViniResults({athleteId,accountId,userId}:{athleteId:string;accountId:string;userId:string}){
 const sandbox=recordsByAthlete.get(athleteId)
 const key=storageKey(userId,accountId,athleteId)
 const [deleted,setDeleted]=useState(()=>{try{return localStorage.getItem(key)==='deleted'}catch{return false}})
 const [viewAll,setViewAll]=useState(false)
 useEffect(()=>{try{setDeleted(localStorage.getItem(key)==='deleted')}catch{setDeleted(false)}setViewAll(false)},[key])
 if(!sandbox||deleted)return null
 const records=viewAll?sandbox.records:sandbox.records.filter(r=>r.key.startsWith('2026-11-'))
 const erase=()=>{
  if(!window.confirm('Remover esta cópia de demonstração do dispositivo? Nenhum resultado do banco será excluído.'))return
  try{localStorage.setItem(key,'deleted')}catch{}
  setDeleted(true)
 }
 return <section className="section" aria-label="Resultados de demonstração isolados">
  <div className="section-head"><h3>Resultados recuperados — prévia isolada</h3></div>
  <p className="muted">Dados de teste associados ao cadastro selecionado: {sandbox.account_name}. Não estão gravados no Supabase, não entram nos gráficos nem constituem resultados oficiais homologados.</p>
  <div className="actions" style={{marginBottom:12,display:'flex',flexWrap:'wrap',gap:8}}>
   <button type="button" className="btn" onClick={()=>setViewAll(v=>!v)}>{viewAll?'Ver somente novembro de 2026':'Ver todo o histórico recuperado (34 registros)'}</button>
   <button type="button" className="btn danger" onClick={erase}>Remover prévia deste dispositivo</button>
  </div>
  <div style={{overflowX:'auto'}}>
  <table><thead><tr><th>Competição / data</th><th>Prova</th><th>Inscrição</th><th>Resultado</th><th>Detalhes</th></tr></thead>
   <tbody>{records.map(r=><tr key={r.key}>
    <td>{r.meet}<small style={{display:'block'}}>{r.meet_date_or_range}</small></td>
    <td>{r.event}</td><td>{r.seed_time||'—'}</td><td><strong>{r.result_time||'Pendente'}</strong></td>
    <td>{r.heat!==undefined?`Série ${r.heat} · Raia ${r.lane} · ${r.scheduled_local_time||'—'}`:(r.course||'Piscina não confirmada')}{r.source_url&&<div><a href={r.source_url} target="_blank" rel="noreferrer">Fonte documental</a></div>}</td>
   </tr>)}</tbody>
  </table>
  </div>
  <p className="muted">Exclusão local: oculta esta prévia somente para este usuário, conta e atleta. Para remover definitivamente do código, excluir o diretório sandbox e esta integração em commit posterior.</p>
 </section>
}
