import {useMemo,useState} from 'react'
import {ChartNoAxesCombined,Gauge,Medal,Trash2,RotateCcw,Users,LogIn,Menu,X} from 'lucide-react'
import dataset from './data/vini-temporary.json'

type Rec=(typeof dataset.accounts)[number]['results'][number]
type Page='dashboard'|'results'|'evolution'
const dateLabel=(d:string)=>d.includes('/')?d.split('/').map(x=>new Date(x+'T12:00:00').toLocaleDateString('pt-BR')).join(' a '):new Date(d+'T12:00:00').toLocaleDateString('pt-BR')
const timeLabel=(ms:number|null)=>ms===null?'Pendente':(ms>=60000?Math.floor(ms/60000)+':':'')+String(Math.floor(ms/1000)%60).padStart(ms>=60000?2:1,'0')+'.'+String(Math.round(ms%1000/10)).padStart(2,'0')
const courseLabel=(course:string|null)=>course==='SCM'?'25 m':course==='LCM'?'50 m':'Não informada'
const flag='viniswim:temporary:vini-20261107:hidden:'
const pages:{id:Page;name:string;Icon:typeof Gauge}[]=[{id:'dashboard',name:'Visão Geral',Icon:Gauge},{id:'results',name:'Resultados',Icon:Medal},{id:'evolution',name:'Evolução',Icon:ChartNoAxesCombined}]
const key=(account:string)=>flag+account
export default function ViniTemporaryApp(){
 const [accountIndex,setAccountIndex]=useState(0)
 const [page,setPage]=useState<Page>('dashboard')
 const [menu,setMenu]=useState(false)
 const [all,setAll]=useState(false)
 const [deleted,setDeleted]=useState<Record<string,boolean>>({})
 const current=dataset.accounts[accountIndex]
 const hidden=deleted[current.athlete_id]??(typeof localStorage!=='undefined'&&localStorage.getItem(key(current.athlete_id))==='1')
 const records=hidden?[]:current.results as Rec[]
 const completed=records.filter(r=>r.time_ms!==null)
 const pending=records.filter(r=>r.time_ms===null)
 const recent=records.filter(r=>r.date.startsWith('2026-11-'))
 const visible=all?records:recent
 const bests=useMemo(()=>{
  const byEvent=new Map<string,Rec>()
  for(const r of completed){if(!r.course)continue;const k=r.event+'|'+r.course;const prev=byEvent.get(k);if(!prev||(r.time_ms??Infinity)<(prev.time_ms??Infinity))byEvent.set(k,r)}
  return [...byEvent.values()].sort((a,b)=>a.event.localeCompare(b.event,'pt-BR',{numeric:true})||String(a.course).localeCompare(String(b.course)))
 },[current.athlete_id,hidden])
 const choose=(index:number)=>{setAccountIndex(index);setAll(false);setMenu(false)}
 const remove=()=>{if(!confirm('Ocultar somente o lote temporário deste cadastro neste navegador? Os resultados originais não serão apagados.'))return;localStorage.setItem(key(current.athlete_id),'1');setDeleted(x=>({...x,[current.athlete_id]:true}))}
 const restore=()=>{localStorage.removeItem(key(current.athlete_id));setDeleted(x=>({...x,[current.athlete_id]:false}))}
 return <div className="app vini-temporary">
  <aside className={menu?'sidebar open':'sidebar'}>
   <div className="brand"><img className="brand-logo" src="../apple-touch-icon.png" alt=""/><div><b>VINISWIM</b><small>Performance Tracker</small></div></div>
   <button className="sidebar-close" onClick={()=>setMenu(false)} aria-label="Fechar menu"><X size={20}/></button>
   <nav>{pages.map(({id,name,Icon})=><button key={id} className={page===id?'active':''} onClick={()=>{setPage(id);setMenu(false)}}><Icon size={18}/>{name}</button>)}</nav>
   <div className="vini-sidebar-note">Dados temporários no código. Sem acesso ao Supabase.</div>
   <a className="vini-original-link" href="?live=1"><LogIn size={17}/> Acessar conta original</a>
  </aside>
  <div className={menu?'sidebar-backdrop open':'sidebar-backdrop'} onClick={()=>setMenu(false)}/>
  <main>
   <header><div className="header-left"><button className="menu" onClick={()=>setMenu(true)} aria-label="Abrir menu"><Menu/></button><div><h1>{pages.find(x=>x.id===page)?.name}</h1><small>VINISWIM · Histórico temporário</small></div></div>
    <div className="header-switchers"><div className="athlete-switcher"><Users size={17}/><select aria-label="Selecionar conta" value={accountIndex} onChange={e=>choose(Number(e.target.value))}>{dataset.accounts.map((a,i)=><option value={i} key={a.athlete_id}>{a.account_name}</option>)}</select></div></div>
   </header>
   <div className="content">
    <section className="athlete-hero"><div className="athlete-main"><h2>{dataset.athlete}</h2><p>Curitibano · Petiz 1 · Registros recuperados</p><div className="athlete-meta"><span>2015 · Masculino</span><span>Consulta local · Sem banco</span></div></div></section>
    <div className="vini-temp-banner"><strong>Histórico temporário</strong> · Os resultados de 2024–2026 e as quatro provas de novembro foram inseridos no código. Algumas datas e piscinas históricas ainda precisam de conferência documental. As provas de 08/11 permanecem como inscrições, sem resultado.</div>
    {hidden?<section className="section"><h3>Histórico temporário oculto</h3><p>Esta cópia foi removida apenas deste navegador e deste cadastro.</p><button className="vini-btn" onClick={restore}><RotateCcw size={16}/> Restaurar registros</button></section>:<>
    {page==='dashboard'&&<>
     <div className="vini-kpis"><div className="kpi"><span>Total de resultados</span><b>{completed.length}</b><small>Tempos documentados</small></div><div className="kpi"><span>Provas de novembro</span><b>{recent.length}</b><small>2 resultados · 2 inscrições</small></div><div className="kpi"><span>Próximas provas</span><b>{pending.length}</b><small>08/11/2026</small></div><div className="kpi"><span>Melhores marcas</span><b>{bests.length}</b><small>Apenas piscinas confirmadas</small></div></div>
     <section className="section"><div className="section-head"><h3>Campeonato Sul-Brasileiro — 06 a 08/11/2026</h3><button className="vini-btn" onClick={()=>setPage('results')}>Ver resultados</button></div><div className="vini-races">{recent.map(r=><div key={r.key} className="vini-race"><div><b>{r.event}</b><small>{dateLabel(r.date)} · {r.meet}</small><small>{r.heat!==null?'Série '+r.heat+' · Raia '+r.lane:''}</small></div><strong className={r.time_ms===null?'vini-pending':''}>{timeLabel(r.time_ms)}</strong></div>)}</div></section>
     <section className="section"><h3>Melhores marcas com piscina identificada</h3><div className="vini-races">{bests.map(r=><div key={r.key} className="vini-race"><div><b>{r.event}</b><small>{courseLabel(r.course)} · {dateLabel(r.date)}</small></div><strong>{timeLabel(r.time_ms)}</strong></div>)}{!bests.length&&<p>Sem marcas com piscina comprovada.</p>}</div></section>
    </>}
    {page==='results'&&<section className="section"><div className="section-head"><h3>Resultados e balizamentos</h3><button className="vini-btn" onClick={()=>setAll(v=>!v)}>{all?'Ver novembro':'Ver histórico completo ('+records.length+')'}</button></div>
     <p className="muted">Tempos de inscrição não são contabilizados como resultados. A indicação de piscina desconhecida não foi preenchida por suposição.</p>
     <div className="vini-tablewrap"><table className="vini-table"><thead><tr><th>Data / competição</th><th>Prova</th><th>Piscina</th><th>Inscrição</th><th>Resultado</th></tr></thead><tbody>{visible.map(r=><tr key={r.key}><td>{dateLabel(r.date)}<small>{r.meet}</small></td><td>{r.event}<small>{r.heat!==null?'Série '+r.heat+' · Raia '+r.lane:''}</small></td><td>{courseLabel(r.course)}</td><td>{timeLabel(r.seed_ms)}</td><td><strong className={r.time_ms===null?'vini-pending':''}>{timeLabel(r.time_ms)}</strong></td></tr>)}</tbody></table></div></section>}
    {page==='evolution'&&<section className="section"><h3>Evolução dos tempos</h3><p className="muted">Comparações por prova e comprimento de piscina. Competições com piscina não confirmada aparecem no histórico, mas não são misturadas às séries de evolução.</p>
     {Array.from(new Set(completed.filter(r=>r.course).map(r=>r.event+'|'+r.course))).sort().map(k=>{const [event,course]=k.split('|');const rows=completed.filter(r=>r.event===event&&r.course===course).sort((a,b)=>a.date.localeCompare(b.date));return <div className="vini-evolution" key={k}><h4>{event} · {courseLabel(course)}</h4>{rows.map(r=><div key={r.key} className="vini-race"><span>{dateLabel(r.date)} · {r.meet}</span><strong>{timeLabel(r.time_ms)}</strong></div>)}</div>})}
    </section>}
    <section className="section vini-control"><div><h3>Controle do lote temporário</h3><p className="muted">Ocultar neste dispositivo não apaga arquivos do GitHub. A exclusão definitiva é feita por remoção controlada dos arquivos do código.</p></div><button className="vini-btn vini-danger" onClick={remove}><Trash2 size={16}/> Ocultar lote deste cadastro</button></section>
    </>}
   </div>
  </main>
  <nav className="mobile-nav">{pages.map(({id,name,Icon})=><button key={id} className={id===page?'active':''} onClick={()=>setPage(id)}><Icon size={20}/><span>{name==='Visão Geral'?'Início':name}</span></button>)}</nav>
 </div>
}
