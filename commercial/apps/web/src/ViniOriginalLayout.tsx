import {useState} from 'react'
import {AlertTriangle,ChartNoAxesCombined,ChevronDown,Gauge,Medal,Menu,MoreHorizontal,RotateCcw,Trash2,Users,X} from 'lucide-react'
import {AthleteAvatar,Dashboard,ResultsPage,Evolution,Expectations} from './App'
import {getTemporaryAccount,temporaryAccounts,temporaryEvents,temporaryDeleteResult,temporaryDeleteBatch,temporaryRestoreBatch,temporaryHidden} from './temporary-data'
type Page='dashboard'|'results'|'evolution'
const tabs:[Page,string,typeof Gauge][]=[['dashboard','Visão Geral',Gauge],['results','Resultados',Medal],['evolution','Evolução',ChartNoAxesCombined]]
const dd=(value:string)=>value?new Date(value+'T12:00:00').toLocaleDateString('pt-BR'):'—'
export default function ViniOriginalLayout(){
 const [index,setIndex]=useState(0),[revision,setRevision]=useState(0),[page,setPage]=useState<Page>('dashboard'),[open,setOpen]=useState(false)
 const [filters,setFilters]=useState({event:[] as string[],course:[] as string[],category:[] as string[],origin:[] as string[]})
 const [resultFilter,setResultFilter]=useState<string[]|null>(null)
 const data=getTemporaryAccount(index),athlete=data.athlete,results=data.results
 const hidden=temporaryHidden(athlete.id), refresh=()=>setRevision(x=>x+1)
 const meets=data.meets, entries=data.entries,events=temporaryEvents,ev=new Map(events.map(e=>[e.id,e.label]))
 const meetOptions=[...new Map(results.map(r=>[r.meet_id,{id:r.meet_id,label:r.meet_name,date:r.result_date}])).values()].sort((a,b)=>b.date.localeCompare(a.date))
 const visible=resultFilter===null?results:results.filter(r=>resultFilter.includes(r.meet_id))
 const filtered=visible.filter(r=>
  (!filters.event.length||filters.event.includes(r.event_id))&&
  (!filters.course.length||(r.course!==null&&filters.course.includes(r.course)))&&
  (!filters.category.length||filters.category.includes(r.category))&&
  (!filters.origin.length||filters.origin.includes('manual')))
 const bests=resultFilter===null?data.pbs:events.map(e=>visible.filter(r=>r.event_id===e.id&&r.course&&r.status==='valid'&&r.time_ms!==null).sort((a,b)=>(a.time_ms||0)-(b.time_ms||0))[0]).filter(Boolean)
 const changeAccount=(next:number)=>{setIndex(next);setResultFilter(null);setFilters({event:[],course:[],category:[],origin:[]});setOpen(false);setRevision(x=>x+1)}
 function removeResult(r:any){if(!confirm('Excluir este tempo apenas do lote manual deste dispositivo?'))return;temporaryDeleteResult(athlete.id,r.id);refresh()}
 function removeBatch(){if(!confirm('Ocultar todos os resultados temporários deste cadastro no dispositivo?'))return;temporaryDeleteBatch(athlete.id);refresh()}
 function restoreBatch(){temporaryRestoreBatch(athlete.id);refresh()}
 const title=tabs.find(t=>t[0]===page)?.[1]||'VINISWIM'
 const recent=entries.filter(x=>x.meets?.start_date?.startsWith('2026-11'))
 return <div className="app">
  <aside className={open?'sidebar open':'sidebar'}>
   <div className="sidebar-head"><div className="brand"><img className="brand-logo" src="../apple-touch-icon.png" alt="VINISWIM"/><div><b>VINISWIM</b><small>Performance Tracker</small></div></div><button className="sidebar-close" onClick={()=>setOpen(false)} aria-label="Fechar"><X size={22}/></button></div>
   <nav>{tabs.map(([id,label,Icon])=><button key={id} className={page===id?'active':''} onClick={()=>{setPage(id);setOpen(false)}}><Icon size={18}/>{label}</button>)}</nav>
   <div className="sidebar-legal">VINISWIM · histórico manual<br/><span>Dados removíveis · sem banco</span></div>
  </aside>
  <div className={open?'sidebar-backdrop open':'sidebar-backdrop'} onClick={()=>setOpen(false)}/>
  <main><header><div className="header-left"><button className="menu" onClick={()=>setOpen(v=>!v)} aria-label="Menu"><Menu/></button><div><h1>{title}</h1><small>VINISWIM · Dados recuperados</small></div></div>
   <div className="header-switchers multi"><div className="athlete-switcher"><Users size={16}/><select value={index} aria-label="Selecionar conta" onChange={e=>changeAccount(Number(e.target.value))}>{temporaryAccounts.map((a,i)=><option key={a.id} value={i}>{a.name}</option>)}</select></div><div className="athlete-switcher"><AthleteAvatar athlete={athlete} size="sm"/><span>Vini</span></div></div>
  </header>
  <div className="content">
   <section className="athlete-hero"><AthleteAvatar athlete={athlete} size="lg"/><div className="athlete-main"><h2>{athlete.full_name}</h2><p>Curitibano · Histórico recuperado</p><div className="athlete-meta"><span>2015</span><span>Categoria: Petiz I</span></div></div></section>
   <section className="section" style={{display:'flex',gap:12,justifyContent:'space-between',alignItems:'center',flexWrap:'wrap'}}>
    <div><strong>{hidden?'Lote temporário oculto':'Tempos inseridos manualmente · 2024–2026'}</strong><p className="muted">Consulta sem Supabase. Datas e piscinas não documentadas não são presumidas. Os dois resultados de 06 e 07/11 estão incluídos.</p></div>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button className="btn" onClick={restoreBatch}><RotateCcw size={15}/> Restaurar</button><button className="btn danger" onClick={removeBatch}><Trash2 size={15}/> Excluir lote local</button></div>
   </section>
   {page==='dashboard'&&<>
    <Dashboard overview={data.overview} pbs={bests} events={events} setPage={p=>{if(p!=='settings')setPage(p)}}/>
    <div className="overview-content-grid">
     <section className="section"><div className="section-head"><h3>Campeonatos e balizamentos</h3></div>
      <div className="notice">Resultados das provas de 06 e 07/11/2026 e inscrições de 08/11/2026. Tempos de inscrição não são tratados como resultados.</div>
      {meets.filter(m=>m.start_date.startsWith('2026-11')).map(m=><div className="meet" key={m.id}><div className="meet-head"><div><b>{m.name}</b><small>{dd(m.start_date)} · Piscina a confirmar</small></div></div>
       <div className="entry-grid">{recent.filter(e=>e.meet_id===m.id).map(e=>{const r=results.find(x=>x.meet_id===e.meet_id&&x.event_id===e.event_id);return <div className="entry" key={e.id}><b>{ev.get(e.event_id)||'Prova'}</b><small>Resultado recuperado</small><strong>{r?formatMs(r.time_ms):'Aguardando'}</strong><small>Inscrição</small><span>{formatMs(e.seed_time_ms)}</span><em>Série {e.heat??'—'} · Raia {e.lane??'—'}</em></div>})}</div>
      </div>)}
     </section>
     <Expectations results={results} entries={entries} events={events}/>
    </div>
   </>}
   {page==='results'&&<ResultsPage offline={true} filtered={filtered} allResults={results} events={events} filters={filters} setFilters={setFilters} meets={meets} meetOptions={meetOptions} resultFilter={resultFilter} setResultFilter={setResultFilter} sourceConfigs={[]} selectedSources={[]} setSelectedSources={()=>{}} onNew={()=>{}} onEdit={()=>{}} onDelete={removeResult} onRefresh={async()=>{}} onCancelRefresh={async()=>{}} refreshMsg={''} athlete={athlete} activeRequest={null} onLinked={async()=>{}}/>}
   {page==='evolution'&&<><div className="notice">O gráfico apresenta todos os tempos, incluindo novembro de 2026. Use o filtro de piscina para comparar apenas registros com piscina identificada.</div><Evolution key={index} results={visible} events={events}/></>}
  </div></main>
  <nav className="mobile-nav">{tabs.map(([id,label,Icon])=><button key={id} className={page===id?'active':''} onClick={()=>setPage(id)}><Icon size={20}/><span>{id==='dashboard'?'Início':label}</span></button>)}<button onClick={()=>setOpen(true)}><MoreHorizontal size={20}/><span>Mais</span></button></nav>
 </div>
}
function formatMs(v:number|null){if(v===null)return '—';let cs=Math.round(v/10),seconds=Math.floor(cs/100),parts=String(cs%100).padStart(2,'0');return (seconds>=60?Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'):String(seconds))+'.'+parts}
