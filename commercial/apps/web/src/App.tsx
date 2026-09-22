import {useEffect,useMemo,useState} from 'react'
import {Activity,Bell,ChartNoAxesCombined,Eye,EyeOff,Gauge,LogOut,Medal,Menu,Plus,Settings,ShieldCheck,Trophy,Users,X} from 'lucide-react'
import {LineChart,Line,ResponsiveContainer,XAxis,YAxis,Tooltip,CartesianGrid} from 'recharts'
import {formatSwimTime,parseSwimTime} from '@viniswim/shared'
import {supabase} from './supabase'

type Page='dashboard'|'results'|'evolution'|'meets'|'expectations'|'alerts'|'audit'|'settings'
const nav:[Page,string,any][]=[['dashboard','Visão Geral',Gauge],['results','Resultados',Medal],['evolution','Evolução',ChartNoAxesCombined],['meets','Campeonatos',Trophy],['expectations','Expectativas',Activity],['alerts','Alertas',Bell],['audit','Auditoria',ShieldCheck],['settings','Configurações',Settings]]
const d=(x:string)=>new Date(x+'T12:00:00').toLocaleDateString('pt-BR')
const statusLabel=(s:string,t:number|null)=>s==='valid'?formatSwimTime(t):s.toUpperCase()

function Auth(){
 const [mode,setMode]=useState<'login'|'activate'>('login')
 const [step,setStep]=useState<'email'|'password'>('email')
 const [name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState('')
 const [msg,setMsg]=useState(''),[showPassword,setShowPassword]=useState(false),[busy,setBusy]=useState(false),[cooldown,setCooldown]=useState(0)
 useEffect(()=>{if(cooldown<=0)return;const timer=window.setInterval(()=>setCooldown(v=>Math.max(0,v-1)),1000);return()=>window.clearInterval(timer)},[cooldown])
 function authMessage(error:any){
  const raw=String(error?.message||'')
  const wait=raw.match(/after\s+(\d+)\s+seconds?/i)
  if(wait){setCooldown(Number(wait[1]));return `Aguarde ${wait[1]} segundos antes de tentar novamente.`}
  if(/rate limit|security purposes|too many requests/i.test(raw)){setCooldown(60);return 'Muitas tentativas em sequência. Aguarde 1 minuto e tente novamente.'}
  if(/invalid login credentials/i.test(raw))return 'E-mail ou senha incorretos.'
  if(/user already registered|already been registered/i.test(raw))return 'Este e-mail já possui cadastro. Volte para o login.'
  if(/VINISWIM_SIGNUP_NOT_AUTHORIZED|not authorized|Database error saving new user/i.test(raw))return 'Este e-mail não está autorizado para ativar o VINISWIM.'
  if(/password should be at least/i.test(raw))return 'A senha precisa ter pelo menos 6 caracteres.'
  return raw||'Não foi possível concluir a operação.'
 }
 async function validateAccess(){
  if(!email.trim()){setMsg('Informe o e-mail comercializado.');return}
  setBusy(true);setMsg('')
  try{
   const {data,error}=await supabase.rpc('check_commercial_access',{p_email:email.trim().toLowerCase()})
   if(error){setMsg('Não foi possível validar o acesso agora.');return}
   if(!data){setMsg('Este e-mail não está autorizado. Solicite a liberação comercial do VINISWIM.');return}
   setStep('password')
  }finally{setBusy(false)}
 }
 async function submit(e:any){
  e.preventDefault()
  if(busy||cooldown>0)return
  setMsg('');setBusy(true)
  try{
   if(mode==='login'){
    const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password})
    if(error)setMsg(authMessage(error))
   }else{
    if(step==='email'){setBusy(false);await validateAccess();return}
    const {data,error}=await supabase.auth.signUp({email:email.trim().toLowerCase(),password,options:{data:{full_name:name.trim()}}})
    if(error){setMsg(authMessage(error));return}
    if(data.session)setMsg('Acesso ativado. Entrando no VINISWIM...')
    else setMsg('Acesso ativado. Confira seu e-mail para confirmar o cadastro e depois volte ao login.')
   }
  }finally{setBusy(false)}
 }
 const buttonDisabled=busy||cooldown>0
 function switchMode(next:'login'|'activate'){setMode(next);setStep('email');setMsg('');setPassword('');setShowPassword(false);setCooldown(0)}
 return <div className="auth"><div className="auth-card"><img className="auth-logo" src="../apple-touch-icon.png" alt="VINISWIM"/><h1>VINISWIM</h1><div className="performance-tracker">PERFORMANCE TRACKER</div><p>Resultados, evolução e campeonatos em um único perfil por atleta.</p>
 <form onSubmit={submit}>
  {mode==='activate'&&step==='password'&&<label>Nome completo<input value={name} onChange={e=>setName(e.target.value)} required autoComplete="name"/></label>}
  <label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" disabled={mode==='activate'&&step==='password'}/></label>
  {(mode==='login'||step==='password')&&<label>Senha<div className="password-field"><input type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} minLength={6} required autoComplete={mode==='login'?'current-password':'new-password'}/><button type="button" className="password-toggle" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Ocultar senha':'Mostrar senha'}>{showPassword?<EyeOff size={21}/>:<Eye size={21}/>}</button></div></label>}
  <button className="btn primary" disabled={buttonDisabled}>{busy?'Processando...':cooldown>0?`Aguarde ${cooldown}s`:mode==='login'?'Entrar':step==='email'?'Validar e-mail autorizado':'Criar minha senha'}</button>
 </form>
 {mode==='activate'&&step==='password'&&<div className="access-ok">E-mail autorizado para ativação.</div>}
 {msg&&<div className="notice">{msg}</div>}
 {mode==='login'
   ?<button className="link" onClick={()=>switchMode('activate')}>Primeiro acesso? Ativar conta</button>
   :<button className="link" onClick={()=>switchMode('login')}>Voltar para o login</button>}
 </div></div>
}

function AthleteForm({accountId,onDone}:{accountId:string,onDone:()=>void}){const [name,setName]=useState(''),[birth,setBirth]=useState(''),[club,setClub]=useState(''),[msg,setMsg]=useState('');async function save(e:any){e.preventDefault();const {error}=await supabase.from('athletes').insert({account_id:accountId,full_name:name,preferred_name:name.split(' ')[0],birth_date:birth||null,club_name:club||null,status:'pending_source'});if(error)setMsg(error.message);else onDone()}return <div className="empty"><h2>Cadastre o primeiro atleta</h2><p>Os dados ficam vinculados somente à sua conta.</p><form className="form" onSubmit={save}><label>Nome completo<input value={name} onChange={e=>setName(e.target.value)} required/></label><label>Data de nascimento<input type="date" value={birth} onChange={e=>setBirth(e.target.value)}/></label><label>Clube<input value={club} onChange={e=>setClub(e.target.value)}/></label><button className="btn primary">Cadastrar atleta</button></form>{msg&&<div className="notice">{msg}</div>}</div>}

function Kpi({k,v}:{k:string,v:any}){return <div className="kpi"><span>{k}</span><b>{v}</b></div>}

function ResultModal({athleteId,events,row,onClose,onSaved}:{athleteId:string,events:any[],row:any,onClose:()=>void,onSaved:()=>void}){
 const [eventId,setEventId]=useState(row?.event_id||events[0]?.id||''),[date,setDate]=useState(row?.result_date||new Date().toISOString().slice(0,10)),[course,setCourse]=useState(row?.course||'SCM'),[status,setStatus]=useState(row?.status||'valid'),[time,setTime]=useState(row?.time_ms?formatSwimTime(row.time_ms):''),[notes,setNotes]=useState(row?.notes||''),[msg,setMsg]=useState('')
 async function save(e:any){e.preventDefault();const {data:{user}}=await supabase.auth.getUser();const ms=status==='valid'||status==='partial'?parseSwimTime(time):null;if((status==='valid'||status==='partial')&&ms==null){setMsg('Tempo inválido.');return}const payload={athlete_id:athleteId,event_id:eventId,result_date:date,course,status,time_ms:ms,notes:notes||null,origin:'manual',is_official:false,created_by:user!.id};const q=row?supabase.from('results').update(payload).eq('id',row.id):supabase.from('results').insert(payload);const {error}=await q;if(error)setMsg(error.message);else{onSaved();onClose()}}
 return <div className="modal"><form className="modal-card" onSubmit={save}><div className="modal-head"><h3>{row?'Editar resultado manual':'Novo resultado manual'}</h3><button type="button" className="icon-btn" onClick={onClose}><X/></button></div><div className="form-grid"><label>Prova<select value={eventId} onChange={e=>setEventId(e.target.value)}>{events.map(x=><option value={x.id} key={x.id}>{x.label}</option>)}</select></label><label>Data<input type="date" value={date} onChange={e=>setDate(e.target.value)} required/></label><label>Piscina<select value={course} onChange={e=>setCourse(e.target.value)}><option value="SCM">25 m</option><option value="LCM">50 m</option></select></label><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="valid">Válido</option><option value="dns">DNS</option><option value="dsq">DSQ</option><option value="dnf">DNF</option><option value="partial">Parcial</option></select></label><label>Tempo<input value={time} onChange={e=>setTime(e.target.value)} placeholder={'35"21'} disabled={!['valid','partial'].includes(status)}/></label><label className="wide">Observação<input value={notes} onChange={e=>setNotes(e.target.value)}/></label></div>{msg&&<div className="notice">{msg}</div>}<div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn primary">Salvar</button></div></form></div>
}

export default function App(){
 const [session,setSession]=useState<any>(null),[page,setPage]=useState<Page>('dashboard'),[open,setOpen]=useState(false),[profile,setProfile]=useState<any>(null),[account,setAccount]=useState<any>(null),[athletes,setAthletes]=useState<any[]>([]),[athleteId,setAthleteId]=useState(localStorage.getItem('viniswim-athlete')||''),[events,setEvents]=useState<any[]>([]),[results,setResults]=useState<any[]>([]),[overview,setOverview]=useState<any>(null),[pbs,setPbs]=useState<any[]>([]),[meets,setMeets]=useState<any[]>([]),[entries,setEntries]=useState<any[]>([]),[audit,setAudit]=useState<any[]>([]),[modal,setModal]=useState<any>(null),[filters,setFilters]=useState({event:'',course:'',origin:''})

 useEffect(()=>{supabase.auth.getSession().then(x=>setSession(x.data.session));const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>subscription.unsubscribe()},[])
 useEffect(()=>{if(session)void loadIdentity()},[session?.user?.id])
 useEffect(()=>{if(athleteId){localStorage.setItem('viniswim-athlete',athleteId);void loadAthlete()}},[athleteId])

 async function loadIdentity(){
  const uid=session.user.id
  const [{data:p},{data:m},{data:e}]=await Promise.all([supabase.from('profiles').select('*').eq('id',uid).maybeSingle(),supabase.from('account_members').select('account_id,role,accounts(*)').eq('user_id',uid).eq('status','active').limit(1).maybeSingle(),supabase.from('events').select('*').order('sort_order')])
  setProfile(p);setAccount((m as any)?.accounts||null);setEvents(e||[])
  if((m as any)?.account_id){const {data:a}=await supabase.from('athletes').select('*').eq('account_id',(m as any).account_id).eq('active',true).order('created_at');setAthletes(a||[]);if(!athleteId&&a?.[0])setAthleteId(a[0].id)}
 }
 async function loadAthlete(){
  const [{data:r},{data:o},{data:pb},{data:en},{data:au}]=await Promise.all([
   supabase.from('v_result_timeline').select('*').eq('athlete_id',athleteId).order('result_date',{ascending:false}).order('created_at',{ascending:false}),
   supabase.from('v_athlete_overview').select('*').eq('athlete_id',athleteId).maybeSingle(),
   supabase.from('personal_bests').select('*,results(*)').eq('athlete_id',athleteId).order('time_ms'),
   supabase.from('meet_entries').select('*,meets(*)').eq('athlete_id',athleteId),
   supabase.from('audit_log').select('*').eq('athlete_id',athleteId).order('created_at',{ascending:false}).limit(100)
  ])
  setResults(r||[]);setOverview(o||null);setPbs((pb||[]).map((x:any)=>({...x.results,pb_id:x.id})));setEntries(en||[]);setMeets([...new Map((en||[]).map((x:any)=>[x.meets?.id,x.meets])).values()].filter(Boolean));setAudit(au||[])
 }
 const athlete=athletes.find(x=>x.id===athleteId)
 const ev=new Map(events.map(x=>[x.id,x.label]))
 const filtered=results.filter(r=>(!filters.event||r.event_id===filters.event)&&(!filters.course||r.course===filters.course)&&(!filters.origin||r.origin===filters.origin))

 if(!session)return <Auth/>
 if(!account)return <div className="loading">Preparando sua conta VINISWIM...</div>
 if(!athletes.length)return <AthleteForm accountId={account.id} onDone={loadIdentity}/>

 async function del(r:any){if(!confirm('Excluir este resultado manual?'))return;await supabase.from('results').delete().eq('id',r.id);await loadAthlete()}
 const title=nav.find(x=>x[0]===page)?.[1]||'VINISWIM'

 return <div className="app">
  <aside className={open?'sidebar open':'sidebar'}><div className="brand"><img className="brand-logo" src="../apple-touch-icon.png" alt="VINISWIM"/><div><b>VINISWIM</b><small>Performance Tracker</small></div></div><nav>{nav.map(([id,label,Icon])=><button className={page===id?'active':''} onClick={()=>{setPage(id);setOpen(false)}} key={id}><Icon size={18}/>{label}</button>)}</nav><button className="logout" onClick={()=>supabase.auth.signOut()}><LogOut size={17}/> Sair</button></aside>
  <main><header><button className="menu" onClick={()=>setOpen(!open)}><Menu/></button><div><h1>{title}</h1><small>{profile?.full_name||session.user.email}</small></div><select value={athleteId} onChange={e=>setAthleteId(e.target.value)}>{athletes.map(a=><option key={a.id} value={a.id}>{a.preferred_name||a.full_name}</option>)}</select></header>
  <div className="content"><section className="hero"><div><span>ATLETA</span><h2>{athlete?.full_name}</h2><p>{athlete?.club_name||'Clube não informado'} · {athlete?.status}</p></div><div><b>{overview?.total_results||0}</b><span>registros</span></div></section>

  {page==='dashboard'&&<><div className="kpi-grid"><Kpi k="Total de Resultados" v={overview?.total_results||0}/><Kpi k="Oficiais" v={overview?.official_results||0}/><Kpi k="Manuais" v={overview?.manual_results||0}/><Kpi k="Ocorrências" v={overview?.occurrences||0}/><Kpi k="Melhores marcas" v={overview?.personal_bests||0}/></div><section className="section"><div className="section-head"><h3>Melhores marcas confirmadas</h3><span>{pbs.length}</span></div><div className="pb-grid">{pbs.map((r:any,i)=><div className="pb" key={r.id}><span>#{i+1}</span><div><b>{ev.get(r.event_id)||'Prova'}</b><small>{r.course} · {d(r.result_date)}</small></div><strong>{formatSwimTime(r.time_ms)}</strong></div>)}{!pbs.length&&<p className="muted">Ainda não há melhores marcas oficiais.</p>}</div></section><section className="section"><h3>Resultados recentes</h3><div className="table-wrap"><table><tbody>{results.slice(0,5).map(r=><tr key={r.id}><td><b>#{r.chronological_number}</b></td><td>{ev.get(r.event_id)}</td><td>{d(r.result_date)}</td><td><strong>{statusLabel(r.status,r.time_ms)}</strong></td><td>{r.is_official?'Oficial':'Manual'}</td></tr>)}</tbody></table></div></section></>}

  {page==='results'&&<section className="section"><div className="section-head"><h3>Resultados</h3><button className="btn primary" onClick={()=>setModal({})}><Plus size={15}/> Resultado manual</button></div><div className="filters"><select value={filters.event} onChange={e=>setFilters({...filters,event:e.target.value})}><option value="">Todas as provas</option>{events.map(e=><option key={e.id} value={e.id}>{e.label}</option>)}</select><select value={filters.course} onChange={e=>setFilters({...filters,course:e.target.value})}><option value="">Todas as piscinas</option><option value="SCM">25 m</option><option value="LCM">50 m</option></select><select value={filters.origin} onChange={e=>setFilters({...filters,origin:e.target.value})}><option value="">Todas as origens</option><option value="official">Oficial</option><option value="manual">Manual</option></select></div><div className="table-wrap"><table><thead><tr><th>#</th><th>Data</th><th>Prova</th><th>Piscina</th><th>Tempo/status</th><th>Origem</th><th></th></tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td>#{r.chronological_number}</td><td>{d(r.result_date)}</td><td>{ev.get(r.event_id)}</td><td>{r.course==='SCM'?'25 m':'50 m'}</td><td><strong>{statusLabel(r.status,r.time_ms)}</strong></td><td><span className={r.is_official?'tag official':'tag manual'}>{r.is_official?'Oficial':'Manual'}</span></td><td>{r.origin==='manual'&&<div className="actions"><button onClick={()=>setModal(r)}>Editar</button><button className="danger" onClick={()=>del(r)}>Excluir</button></div>}</td></tr>)}</tbody></table></div></section>}

  {page==='evolution'&&<Evolution results={results} events={events}/>}
  {page==='meets'&&<Meets meets={meets} entries={entries} results={results} events={events}/>}
  {page==='expectations'&&<Expectations results={results} events={events}/>}
  {page==='alerts'&&<Alerts athleteId={athleteId} userId={session.user.id}/>}
  {page==='audit'&&<Audit rows={audit}/>}
  {page==='settings'&&<SettingsPage athlete={athlete} userId={session.user.id} reload={async()=>{await loadIdentity();await loadAthlete()}}/>}
  </div></main>{modal&&<ResultModal athleteId={athleteId} events={events} row={modal.id?modal:null} onClose={()=>setModal(null)} onSaved={loadAthlete}/>}
 </div>
}

function Evolution({results,events}:{results:any[],events:any[]}){const [event,setEvent]=useState(''),[course,setCourse]=useState('SCM');useEffect(()=>{if(!event&&events[0])setEvent(events[0].id)},[events]);const data=results.filter(r=>r.event_id===event&&r.course===course&&r.status==='valid'&&r.time_ms).sort((a,b)=>a.result_date.localeCompare(b.result_date)).map(r=>({date:d(r.result_date),tempo:r.time_ms/1000,display:formatSwimTime(r.time_ms)}));return <section className="section"><div className="section-head"><h3>Evolução</h3><div className="filters"><select value={event} onChange={e=>setEvent(e.target.value)}>{events.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select><select value={course} onChange={e=>setCourse(e.target.value)}><option value="SCM">25 m</option><option value="LCM">50 m</option></select></div></div><div className="chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={data}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis reversed domain={['auto','auto']}/><Tooltip formatter={(v:any,_n:any,p:any)=>p.payload.display}/><Line type="monotone" dataKey="tempo" stroke="currentColor" strokeWidth={2}/></LineChart></ResponsiveContainer></div>{!data.length&&<p className="muted">Sem resultados comparáveis para esta prova/piscina.</p>}</section>}

function Meets({meets,entries,results,events}:{meets:any[],entries:any[],results:any[],events:any[]}){const ev=new Map(events.map(x=>[x.id,x.label]));return <section className="section"><h3>Campeonatos</h3>{meets.map(m=><div className="meet" key={m.id}><div className="meet-head"><div><b>{m.name}</b><small>{d(m.start_date)} · {m.course==='SCM'?'25 m':m.course==='LCM'?'50 m':'Piscina não informada'}</small></div>{m.official_url&&<a href={m.official_url} target="_blank">Fonte oficial</a>}</div><div className="entry-grid">{entries.filter(e=>e.meet_id===m.id).map(e=>{const r=results.find(x=>x.meet_id===m.id&&x.event_id===e.event_id&&x.is_official);const delta=r?.time_ms!=null&&e.seed_time_ms!=null?r.time_ms-e.seed_time_ms:null;return <div className="entry" key={e.id}><span>{ev.get(e.event_id)}</span><small>Resultado oficial</small><strong>{r?statusLabel(r.status,r.time_ms):'aguardando'}</strong>{delta!=null&&<i className={delta<=0?'good':'bad'}>{delta<=0?'−':'+'}{formatSwimTime(Math.abs(delta))} vs. balizamento</i>}<small>Balizamento</small><b>{formatSwimTime(e.seed_time_ms)}</b><em>Série {e.heat??'—'} · Raia {e.lane??'—'}</em></div>})}</div></div>)}{!meets.length&&<p className="muted">Nenhum campeonato sincronizado.</p>}</section>}

function Expectations({results,events}:{results:any[],events:any[]}){const groups=useMemo(()=>{const m=new Map<string,any[]>();for(const r of results)if(r.status==='valid'&&r.time_ms){const k=r.event_id+'|'+r.course;m.set(k,[...(m.get(k)||[]),r])}return [...m.entries()].map(([k,rows])=>{rows.sort((a,b)=>b.result_date.localeCompare(a.result_date));const sample=rows.slice(0,3);const avg=Math.round(sample.reduce((s,x)=>s+x.time_ms,0)/sample.length);const [eventId,course]=k.split('|');return{eventId,course,avg,best:Math.min(...sample.map(x=>x.time_ms)),n:sample.length}})},[results]);const ev=new Map(events.map(x=>[x.id,x.label]));return <section className="section"><h3>Expectativas de tempo</h3><p className="muted">Referência estatística simples com as três marcas válidas mais recentes; não é previsão de resultado.</p><div className="cards">{groups.map(g=><div className="expect" key={g.eventId+g.course}><b>{ev.get(g.eventId)}</b><small>{g.course==='SCM'?'25 m':'50 m'} · {g.n} marcas</small><span>Faixa de referência</span><strong>{formatSwimTime(g.best)} — {formatSwimTime(g.avg)}</strong></div>)}</div></section>}

function Alerts({athleteId,userId}:{athleteId:string,userId:string}){const types=[['official_result','Novo resultado oficial'],['personal_best','Nova melhor marca'],['meet_entry','Nova inscrição'],['seed_change','Mudança de balizamento'],['occurrence','Ocorrência']];const [state,setState]=useState<any>({}),[msg,setMsg]=useState('');useEffect(()=>{supabase.from('alerts').select('event_type,enabled').eq('athlete_id',athleteId).then(({data})=>{const x:any={};data?.forEach((r:any)=>x[r.event_type]=r.enabled);setState(x)})},[athleteId]);async function toggle(t:string){const enabled=!state[t];setState({...state,[t]:enabled});await supabase.from('alerts').upsert({user_id:userId,athlete_id:athleteId,event_type:t,enabled},{onConflict:'user_id,athlete_id,event_type'})}async function push(){try{if(!('serviceWorker'in navigator)||!('PushManager'in window))throw new Error('Push não suportado neste navegador.');if(await Notification.requestPermission()!=='granted')throw new Error('Permissão não concedida.');const reg=await navigator.serviceWorker.ready;const raw=(import.meta.env.VITE_VAPID_PUBLIC_KEY||'').replace(/-/g,'+').replace(/_/g,'/');const bin=atob(raw+'='.repeat((4-raw.length%4)%4));const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:new Uint8Array([...bin].map(c=>c.charCodeAt(0)))});const j=sub.toJSON();const {error}=await supabase.from('push_devices').upsert({user_id:userId,endpoint:sub.endpoint,p256dh:j.keys?.p256dh,auth_key:j.keys?.auth,platform:navigator.platform||'web',device_name:navigator.userAgent.slice(0,120),active:true,last_seen_at:new Date().toISOString()},{onConflict:'endpoint'});if(error)throw error;setMsg('Push ativado neste dispositivo.')}catch(e:any){setMsg(e.message)}}return <section className="section"><div className="section-head"><div><h3>Alertas</h3><p className="muted">Preferências independentes por responsável.</p></div><button className="btn primary" onClick={push}>Ativar push</button></div>{msg&&<div className="notice">{msg}</div>}<div className="alert-grid">{types.map(([t,l])=><label className="alert" key={t}><span><b>{l}</b><small>Notificação por usuário</small></span><input type="checkbox" checked={!!state[t]} onChange={()=>toggle(t)}/></label>)}</div></section>}

function Audit({rows}:{rows:any[]}){return <section className="section"><h3>Auditoria</h3><p className="muted">Alterações e ingestões rastreadas no banco.</p>{rows.map(r=><div className="audit" key={r.id}><b>{r.action.toUpperCase()}</b><span>{r.entity_type}</span><small>{new Date(r.created_at).toLocaleString('pt-BR')} · {r.source}</small></div>)}{!rows.length&&<p className="muted">Nenhum evento registrado.</p>}</section>}

function CommercialAdmin(){
 const [isAdmin,setIsAdmin]=useState(false),[rows,setRows]=useState<any[]>([]),[plans,setPlans]=useState<any[]>([])
 const [email,setEmail]=useState(''),[customer,setCustomer]=useState(''),[planId,setPlanId]=useState(''),[expires,setExpires]=useState(''),[notes,setNotes]=useState(''),[msg,setMsg]=useState('')
 useEffect(()=>{void load()},[])
 async function load(){
  const {data:admin}=await supabase.rpc('is_platform_admin')
  setIsAdmin(!!admin)
  if(!admin)return
  const [{data:r},{data:p}]=await Promise.all([
   supabase.from('commercial_access').select('*,plans(code,name)').order('created_at',{ascending:false}),
   supabase.from('plans').select('id,code,name').eq('active',true).order('name')
  ])
  setRows(r||[]);setPlans(p||[])
  if(!planId&&p?.length)setPlanId((p.find((x:any)=>x.code==='individual')||p[0]).id)
 }
 async function authorize(e:any){
  e.preventDefault();setMsg('')
  const normalized=email.trim().toLowerCase()
  const payload={email:normalized,customer_name:customer.trim()||null,plan_id:planId||null,status:'authorized',expires_at:expires?new Date(expires+'T23:59:59').toISOString():null,notes:notes.trim()||null,user_id:null,used_at:null}
  const {error}=await supabase.from('commercial_access').upsert(payload,{onConflict:'email'})
  if(error)setMsg(error.message);else{setMsg('E-mail autorizado para ativação.');setEmail('');setCustomer('');setExpires('');setNotes('');await load()}
 }
 async function revoke(id:string){const {error}=await supabase.from('commercial_access').update({status:'revoked'}).eq('id',id);if(error)setMsg(error.message);else await load()}
 if(!isAdmin)return null
 return <section className="section admin-commercial"><div className="section-head"><div><h3>Admin Comercial</h3><p className="muted">Somente e-mails cadastrados aqui podem criar uma conta VINISWIM.</p></div><span className="admin-badge">ADMIN</span></div>
 <form className="form-grid" onSubmit={authorize}>
  <label>Nome do cliente<input value={customer} onChange={e=>setCustomer(e.target.value)} placeholder="Responsável / cliente"/></label>
  <label>E-mail comercializado<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="cliente@email.com"/></label>
  <label>Plano<select value={planId} onChange={e=>setPlanId(e.target.value)} required>{plans.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
  <label>Validade da autorização<input type="date" value={expires} onChange={e=>setExpires(e.target.value)}/></label>
  <label className="wide">Observação<input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Opcional"/></label>
  <div className="wide"><button className="btn primary">Autorizar e-mail</button></div>
 </form>
 {msg&&<div className="notice">{msg}</div>}
 <div className="table-wrap"><table><thead><tr><th>Cliente</th><th>E-mail</th><th>Plano</th><th>Status</th><th>Autorizado</th><th></th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.customer_name||'—'}</td><td>{r.email}</td><td>{r.plans?.name||'—'}</td><td><span className={'tag '+(r.status==='authorized'?'official':'manual')}>{String(r.status).toUpperCase()}</span></td><td>{new Date(r.authorized_at).toLocaleDateString('pt-BR')}</td><td>{r.status==='authorized'&&<button className="danger-link" onClick={()=>revoke(r.id)}>Revogar</button>}</td></tr>)}</tbody></table></div>
 </section>
}

function SettingsPage({athlete,userId,reload}:{athlete:any,userId:string,reload:()=>void}){const [club,setClub]=useState(athlete.club_name||''),[registration,setRegistration]=useState(''),[url,setUrl]=useState(''),[link,setLink]=useState<any>(null),[msg,setMsg]=useState('');useEffect(()=>{setClub(athlete.club_name||'');supabase.from('source_link_requests').select('*,sources(name,code)').eq('athlete_id',athlete.id).order('created_at',{ascending:false}).limit(1).maybeSingle().then(({data})=>{setLink(data);if(data){setRegistration(data.external_id||'');setUrl(data.current_meet_url||'')}})},[athlete.id]);async function save(){const {error}=await supabase.from('athletes').update({club_name:club}).eq('id',athlete.id);setMsg(error?error.message:'Dados salvos.');if(!error)reload()}async function linkSource(e:any){e.preventDefault();const {data:src}=await supabase.from('sources').select('id').eq('code','swimsystem').single();if(!src){setMsg('Fonte indisponível.');return}const {error}=await supabase.from('source_link_requests').upsert({athlete_id:athlete.id,source_id:src.id,external_id:registration,current_meet_url:url,status:'pending',message:null,requested_by:userId,processed_at:null},{onConflict:'athlete_id,source_id'});setMsg(error?error.message:'Solicitação enviada para validação pelo backend.');if(!error){const {data}=await supabase.from('source_link_requests').select('*').eq('athlete_id',athlete.id).eq('source_id',src.id).single();setLink(data)}}return <><section className="section"><h3>Configurações do atleta</h3><div className="form-grid"><label>Nome<input value={athlete.full_name} disabled/></label><label>Clube<input value={club} onChange={e=>setClub(e.target.value)}/></label></div><button className="btn primary" onClick={save}>Salvar</button></section><section className="section"><h3>Fonte oficial</h3><p className="muted">O vínculo só fica ativo após o monitor localizar o registro informado na fonte.</p><form className="form" onSubmit={linkSource}><label>Registro SwimSystem<input value={registration} onChange={e=>setRegistration(e.target.value)} required/></label><label>URL do campeonato atual<input type="url" value={url} onChange={e=>setUrl(e.target.value)} required placeholder="https://www.swimsystem.app/meets/sw/..."/></label><button className="btn primary">Validar vínculo</button></form>{link&&<div className="source-state"><b>Status: {String(link.status).toUpperCase()}</b><small>{link.message||'Aguardando monitor'}</small></div>}{msg&&<div className="notice">{msg}</div>}</section><CommercialAdmin/></>}
