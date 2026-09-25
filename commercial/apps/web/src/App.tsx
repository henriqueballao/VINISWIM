import {useEffect,useMemo,useState} from 'react'
import {Activity,Bell,Camera,ChartNoAxesCombined,ChevronDown,Eye,EyeOff,Gauge,LogOut,Medal,Menu,MoreHorizontal,Plus,Printer,RefreshCw,Settings,ShieldCheck,Trophy,UserPlus,X} from 'lucide-react'
import {CartesianGrid,Legend,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts'
import {formatSwimTime,parseSwimTime} from '@viniswim/shared'
import {supabase} from './supabase'

type Page='dashboard'|'results'|'evolution'|'meets'|'expectations'|'settings'
const nav:[Page,string,any][]=[['dashboard','Visão Geral',Gauge],['results','Resultados',Medal],['evolution','Evolução',ChartNoAxesCombined],['meets','Campeonatos',Trophy],['expectations','Expectativas',Activity],['settings','Configurações',Settings]]
const d=(x:string)=>x?new Date(x+'T12:00:00').toLocaleDateString('pt-BR'):'—'
const statusLabel=(s:string,t:number|null)=>s==='valid'?formatSwimTime(t):String(s||'').toUpperCase()
const calcAge=(birth?:string)=>{if(!birth)return null;const b=new Date(birth+'T00:00:00'),n=new Date();let a=n.getFullYear()-b.getFullYear();const m=n.getMonth()-b.getMonth();if(m<0||(m===0&&n.getDate()<b.getDate()))a--;return a}
const initials=(name='Atleta')=>name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()
const poolLabel=(c:string)=>c==='SCM'?'25 m':c==='LCM'?'50 m':'—'
const resultOrigin=(r:any)=>r.is_official?'Oficial':r.origin==='manual'?'Manual':'Importado'
const ATHLETE_CATEGORIES=['Pré-Mirim','Mirim I','Mirim II','Petiz I','Petiz II','Infantil I','Infantil II','Juvenil I','Juvenil II','Júnior I','Júnior II','Sênior','Master']

async function compressPhoto(file:File){
  if(!file.type.startsWith('image/'))throw new Error('Escolha uma imagem.')
  const url=URL.createObjectURL(file)
  const img=await new Promise<HTMLImageElement>((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=url})
  const side=Math.min(img.naturalWidth,img.naturalHeight),sx=(img.naturalWidth-side)/2,sy=(img.naturalHeight-side)/2
  const c=document.createElement('canvas');c.width=512;c.height=512
  c.getContext('2d')!.drawImage(img,sx,sy,side,side,0,0,512,512)
  URL.revokeObjectURL(url)
  return c.toDataURL('image/jpeg',.82)
}

function AthleteAvatar({athlete,size='md'}:{athlete:any,size?:'sm'|'md'|'lg'}){
  return athlete?.photo_data_url?<img className={'athlete-avatar '+size} src={athlete.photo_data_url} alt={athlete.full_name}/>:<div className={'athlete-avatar placeholder '+size}>{initials(athlete?.full_name)}</div>
}

function PasswordRecovery({onDone}:{onDone:()=>void}){
 const [password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[msg,setMsg]=useState(''),[show,setShow]=useState(false),[busy,setBusy]=useState(false)
 async function save(e:any){e.preventDefault();if(password.length<8){setMsg('Use uma senha com pelo menos 8 caracteres.');return}if(password!==confirm){setMsg('As senhas não coincidem.');return}setBusy(true);setMsg('');const {error}=await supabase.auth.updateUser({password});setBusy(false);if(error){setMsg(error.message);return}await supabase.auth.signOut();onDone()}
 return <div className="auth"><div className="auth-card"><img className="auth-logo" src="../apple-touch-icon.png" alt="VINISWIM"/><h1>VINISWIM</h1><div className="performance-tracker">PERFORMANCE TRACKER</div><p>Defina uma nova senha para sua conta.</p><form onSubmit={save}><label>Nova senha<div className="password-field"><input type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} minLength={8} required/><button type="button" className="password-toggle" onClick={()=>setShow(v=>!v)}>{show?<EyeOff size={21}/>:<Eye size={21}/>}</button></div></label><label>Confirmar nova senha<input type={show?'text':'password'} value={confirm} onChange={e=>setConfirm(e.target.value)} minLength={8} required/></label><button className="btn primary" disabled={busy}>{busy?'Salvando...':'Salvar nova senha'}</button></form>{msg&&<div className="notice">{msg}</div>}</div></div>
}

function Auth({onAuthenticated}:{onAuthenticated:(session:any)=>void}){
 const [mode,setMode]=useState<'login'|'activate'|'recover'>('login'),[step,setStep]=useState<'email'|'password'>('email')
 const [name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirmPassword,setConfirmPassword]=useState(''),[recoveryCode,setRecoveryCode]=useState(''),[msg,setMsg]=useState(''),[showPassword,setShowPassword]=useState(false),[busy,setBusy]=useState(false)
 function authMessage(error:any){const raw=String(error?.message||'');const wait=raw.match(/after\s+(\d+)\s+seconds?/i);if(wait)return 'Limite temporário do servidor. Tente novamente.';if(/rate limit|security purposes|too many requests/i.test(raw))return'Limite temporário do servidor. Tente novamente.';if(/invalid login credentials/i.test(raw))return'E-mail ou senha incorretos.';if(/already registered|already been registered/i.test(raw))return'Este e-mail já possui cadastro. Volte para o login.';if(/not authorized|VINISWIM_SIGNUP_NOT_AUTHORIZED|Database error/i.test(raw))return'Este e-mail não está autorizado para ativar o VINISWIM.';return raw||'Não foi possível concluir a operação.'}
 async function validateAccess(){if(!email.trim()){setMsg('Informe o e-mail comercializado.');return}setBusy(true);setMsg('');try{const {data,error}=await supabase.rpc('commercial_access_state',{p_email:email.trim().toLowerCase()});if(error){setMsg('Não foi possível validar o acesso agora.');return}if(data==='used'){setMode('login');setStep('email');setMsg('Conta já ativada. Entre com seu e-mail e senha.');return}if(data!=='authorized'){setMsg(data==='expired'?'A autorização deste e-mail expirou.':data==='revoked'?'Este acesso foi revogado.':'Este e-mail não está autorizado. Solicite a liberação comercial do VINISWIM.');return}setStep('password')}finally{setBusy(false)}}
 async function forgotPassword(){if(!email.trim()){setMsg('Informe seu e-mail para redefinir a senha.');return}setBusy(true);setMsg('');const redirectTo=window.location.origin+window.location.pathname+'?reset=1';const {error}=await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(),{redirectTo});setBusy(false);if(error)setMsg(authMessage(error));else setMsg('Enviamos um link para redefinir sua senha. Confira seu e-mail.');}
 async function submit(e:any){e.preventDefault();if(busy)return;setMsg('');setBusy(true);try{
   if(mode==='login'){
     const {data,error}=await supabase.auth.signInWithPassword({email:email.trim().toLowerCase(),password});
     if(error){setMsg(authMessage(error));return}
     if(data.session){setMsg('');onAuthenticated(data.session)}
     return
   }
   if(mode==='recover'){
     if(password.length<8){setMsg('A nova senha deve ter pelo menos 8 caracteres.');return}
     if(password!==confirmPassword){setMsg('As senhas não conferem.');return}
     const {data,error}=await supabase.rpc('consume_support_password_reset',{p_email:email.trim().toLowerCase(),p_token:recoveryCode.trim(),p_password:password});
     if(error){setMsg('Não foi possível redefinir a senha.');return}
     if(!data?.ok){setMsg(data?.error==='invalid_or_expired_code'?'Código inválido ou expirado.':'Não foi possível redefinir a senha.');return}
     setMode('login');setPassword('');setConfirmPassword('');setRecoveryCode('');setMsg('Senha alterada. Entre com a nova senha.');return
   }
   if(step==='email'){setBusy(false);await validateAccess();return}
   if(password.length<8){setMsg('A senha deve ter pelo menos 8 caracteres.');return}
   if(password!==confirmPassword){setMsg('As senhas não conferem.');return}
   const {data,error}=await supabase.auth.signUp({email:email.trim().toLowerCase(),password,options:{data:{full_name:name.trim()}}});
   if(error){setMsg(authMessage(error));return}
   if(data.session){setMsg('');onAuthenticated(data.session);return}
   setMsg('Acesso criado. Volte ao login e entre com sua senha.')
 }finally{setBusy(false)}}
 function switchMode(next:'login'|'activate'|'recover'){setMode(next);setStep('email');setMsg('');setPassword('');setConfirmPassword('');setRecoveryCode('');setShowPassword(false)}
 return <div className="auth"><div className="auth-card"><img className="auth-logo" src="../apple-touch-icon.png" alt="VINISWIM"/><h1>VINISWIM</h1><div className="performance-tracker">PERFORMANCE TRACKER</div><p>Resultados, evolução e campeonatos em um único perfil por atleta.</p>
 <form onSubmit={submit}>
  {mode==='activate'&&step==='password'&&<label>Nome completo<input value={name} onChange={e=>setName(e.target.value)} required/></label>}
  <label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required disabled={mode==='activate'&&step==='password'}/></label>
  {mode==='recover'&&<label>Código de recuperação<input value={recoveryCode} onChange={e=>setRecoveryCode(e.target.value.toUpperCase())} required autoCapitalize="characters"/></label>}
  {(mode==='login'||step==='password'||mode==='recover')&&<label>{mode==='recover'?'Nova senha':'Senha'}<div className="password-field"><input type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} minLength={mode==='login'?6:8} required/><button type="button" className="password-toggle" onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={21}/>:<Eye size={21}/>}</button></div></label>}
  {(mode==='recover'||(mode==='activate'&&step==='password'))&&<label>Confirmar senha<input type={showPassword?'text':'password'} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} minLength={8} required/></label>}
  <button className="btn primary" disabled={busy}>{busy?'Processando...':mode==='login'?'Entrar':mode==='recover'?'Redefinir senha':step==='email'?'Validar e-mail autorizado':'Criar minha senha'}</button>
 </form>
 {mode==='activate'&&step==='password'&&<div className="access-ok">E-mail autorizado para ativação.</div>}
 {msg&&<div className="notice">{msg}</div>}
 {mode==='login'&&<><button className="link secondary-link" type="button" onClick={forgotPassword}>Enviar recuperação por e-mail</button><button className="link secondary-link" type="button" onClick={()=>switchMode('recover')}>Tenho código de recuperação</button></>}
 <button className="link" type="button" onClick={()=>switchMode(mode==='login'?'activate':'login')}>{mode==='login'?'Primeiro acesso? Ativar conta':'Voltar para o login'}</button>
 </div></div>
}

function AthleteModal({accountId,onClose,onSaved}:{accountId:string,onClose:()=>void,onSaved:()=>void}){
 const [name,setName]=useState(''),[birth,setBirth]=useState(''),[club,setClub]=useState(''),[category,setCategory]=useState(''),[photo,setPhoto]=useState(''),[msg,setMsg]=useState('')
 async function file(e:any){try{const f=e.target.files?.[0];if(f)setPhoto(await compressPhoto(f))}catch(err:any){setMsg(err.message)}}
 async function save(e:any){e.preventDefault();const {data:can}=await supabase.rpc('account_can_add_athlete',{p_account_id:accountId});if(!can){setMsg('O plano atual não permite outro atleta.');return}const {error}=await supabase.from('athletes').insert({account_id:accountId,full_name:name.trim(),preferred_name:name.trim().split(' ')[0],birth_date:birth||null,club_name:club||null,category:category||null,photo_data_url:photo||null,status:'pending_source'});if(error)setMsg(error.message);else{await onSaved();onClose()}}
 return <div className="modal"><form className="modal-card" onSubmit={save}><div className="modal-head"><h3>Adicionar atleta</h3><button type="button" className="icon-btn" onClick={onClose}><X/></button></div><div className="modal-body"><div className="profile-photo-editor">{photo?<img src={photo}/>:<div className="athlete-avatar placeholder lg">{initials(name||'Atleta')}</div>}<label className="btn"><Camera size={16}/> Escolher foto<input type="file" accept="image/*" onChange={file} hidden/></label></div><div className="form-grid"><label>Nome completo<input value={name} onChange={e=>setName(e.target.value)} required/></label><label>Data de nascimento<input type="date" value={birth} onChange={e=>setBirth(e.target.value)}/></label><label>Clube<input value={club} onChange={e=>setClub(e.target.value)}/></label><label>Categoria<div className="category-filter"><select value={category} onChange={e=>setCategory(e.target.value)} required><option value="">Escolha a categoria</option>{category&&!ATHLETE_CATEGORIES.includes(category)&&<option value={category}>{category}</option>}{ATHLETE_CATEGORIES.map(x=><option key={x} value={x}>{x}</option>)}</select><ChevronDown size={20}/></div></label></div>{msg&&<div className="notice">{msg}</div>}</div><div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn primary">Adicionar atleta</button></div></form></div>
}

function ResultModal({athleteId,events,meets,row,onClose,onSaved}:{athleteId:string,events:any[],meets:any[],row:any,onClose:()=>void,onSaved:()=>void}){
 const [eventId,setEventId]=useState(row?.event_id||events[0]?.id||''),[date,setDate]=useState(row?.result_date||new Date().toISOString().slice(0,10)),[course,setCourse]=useState(row?.course||'SCM'),[status,setStatus]=useState(row?.status||'valid'),[time,setTime]=useState(row?.time_ms?formatSwimTime(row.time_ms):''),[meetId,setMeetId]=useState(row?.meet_id||''),[venue,setVenue]=useState(row?.venue||''),[city,setCity]=useState(row?.city||''),[category,setCategory]=useState(row?.category||''),[notes,setNotes]=useState(row?.notes||''),[msg,setMsg]=useState('')
 async function save(e:any){e.preventDefault();const {data:{user}}=await supabase.auth.getUser();const ms=['valid','partial'].includes(status)?parseSwimTime(time):null;if(['valid','partial'].includes(status)&&ms==null){setMsg('Tempo inválido.');return}const payload={athlete_id:athleteId,event_id:eventId,result_date:date,course,status,time_ms:ms,meet_id:meetId||null,venue:venue||null,city:city||null,category:category||null,notes:notes||null,origin:'manual',is_official:false,created_by:user!.id};const q=row?supabase.from('results').update(payload).eq('id',row.id):supabase.from('results').insert(payload);const {error}=await q;if(error)setMsg(error.message);else{await onSaved();onClose()}}
 return <div className="modal"><form className="modal-card wide-modal" onSubmit={save}><div className="modal-head"><h3>{row?'Editar resultado manual':'Novo resultado'}</h3><button type="button" className="icon-btn" onClick={onClose}><X/></button></div><div className="modal-body"><div className="form-grid three"><label>Prova<select value={eventId} onChange={e=>setEventId(e.target.value)}>{events.map(x=><option value={x.id} key={x.id}>{x.label}</option>)}</select></label><label>Data<input type="date" value={date} onChange={e=>setDate(e.target.value)} required/></label><label>Piscina<select value={course} onChange={e=>setCourse(e.target.value)}><option value="SCM">25 m</option><option value="LCM">50 m</option></select></label><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="valid">Válido</option><option value="dns">DNS</option><option value="dsq">DSQ</option><option value="dnf">DNF</option><option value="partial">Parcial</option></select></label><label>Tempo<input value={time} onChange={e=>setTime(e.target.value)} placeholder={'35"21'} disabled={!['valid','partial'].includes(status)}/></label><label>Categoria<select className="category-select" value={category} onChange={e=>setCategory(e.target.value)}><option value="">Escolha a categoria</option>{category&&!ATHLETE_CATEGORIES.includes(category)&&<option value={category}>{category}</option>}{ATHLETE_CATEGORIES.map(x=><option key={x} value={x}>{x}</option>)}</select></label><label>Competição<select value={meetId} onChange={e=>setMeetId(e.target.value)}><option value="">Sem competição vinculada</option>{meets.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>Local<input value={venue} onChange={e=>setVenue(e.target.value)}/></label><label>Cidade<input value={city} onChange={e=>setCity(e.target.value)}/></label><label className="wide">Observação<input value={notes} onChange={e=>setNotes(e.target.value)}/></label></div>{msg&&<div className="notice">{msg}</div>}</div><div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn primary">Salvar</button></div></form></div>
}

function MeetModal({athleteId,events,onClose,onSaved}:{athleteId:string,events:any[],onClose:()=>void,onSaved:()=>void}){
 const [name,setName]=useState(''),[date,setDate]=useState(''),[course,setCourse]=useState('SCM'),[venue,setVenue]=useState(''),[city,setCity]=useState(''),[eventId,setEventId]=useState(events[0]?.id||''),[seed,setSeed]=useState(''),[heat,setHeat]=useState(''),[lane,setLane]=useState(''),[msg,setMsg]=useState('')
 async function save(e:any){e.preventDefault();const {data:m,error}=await supabase.from('meets').insert({name,start_date:date,course,venue:venue||null,city:city||null,status:'scheduled'}).select('id').single();if(error){setMsg(error.message);return}const {error:ie}=await supabase.from('meet_entries').insert({meet_id:m.id,athlete_id:athleteId,event_id:eventId,seed_time_ms:seed?parseSwimTime(seed):null,heat:heat?Number(heat):null,lane:lane?Number(lane):null,entry_status:'entered'});if(ie)setMsg(ie.message);else{await onSaved();onClose()}}
 return <div className="modal"><form className="modal-card" onSubmit={save}><div className="modal-head"><h3>Novo campeonato</h3><button type="button" className="icon-btn" onClick={onClose}><X/></button></div><div className="modal-body"><div className="form-grid"><label>Campeonato<input value={name} onChange={e=>setName(e.target.value)} required/></label><label>Data<input type="date" value={date} onChange={e=>setDate(e.target.value)} required/></label><label>Piscina<select value={course} onChange={e=>setCourse(e.target.value)}><option value="SCM">25 m</option><option value="LCM">50 m</option></select></label><label>Local<input value={venue} onChange={e=>setVenue(e.target.value)}/></label><label>Cidade<input value={city} onChange={e=>setCity(e.target.value)}/></label><label>Prova<select value={eventId} onChange={e=>setEventId(e.target.value)}>{events.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></label><label>Balizamento<input value={seed} onChange={e=>setSeed(e.target.value)} placeholder={'42"07'}/></label><label>Série<input value={heat} onChange={e=>setHeat(e.target.value)} inputMode="numeric"/></label><label>Raia<input value={lane} onChange={e=>setLane(e.target.value)} inputMode="numeric"/></label></div>{msg&&<div className="notice">{msg}</div>}</div><div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Cancelar</button><button className="btn primary">Salvar campeonato</button></div></form></div>
}

function ActionModal({title,onClose,children}:{title:string,onClose:()=>void,children:any}){
 return <div className="modal action-modal"><div className="modal-card action-modal-card"><div className="modal-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="Fechar"><X/></button></div><div className="modal-body action-modal-body">{children}</div></div></div>
}

function ResultMultiFilter({label,values,allLabel,options,onChange}:{label:string,values:string[],allLabel:string,options:{value:string,label:string}[],onChange:(v:string[])=>void}){
 const [open,setOpen]=useState(false)
 const allValues=options.map(x=>x.value)
 const allSelected=options.length>0&&allValues.every(x=>values.includes(x))
 const summary=allSelected||!values.length?allLabel:values.length===1?(options.find(x=>x.value===values[0])?.label||'1 selecionado'):values.length+' selecionados'
 function toggle(v:string){onChange(values.includes(v)?values.filter(x=>x!==v):[...values,v])}
 function toggleAll(){onChange(allSelected||values.length===0?[]:allValues)}
 return <div className="result-filter-control">
  <button type="button" className="result-filter-button" onClick={()=>setOpen(v=>!v)} aria-expanded={open}>
   <span>{label}</span><b>{summary}</b><ChevronDown size={18} className={open?'rotated':''}/>
  </button>
  {open&&<div className="result-filter-menu result-filter-checks">
   <label className="source-option all"><input type="checkbox" checked={allSelected||values.length===0} onChange={toggleAll}/><span>{allLabel}</span></label>
   {options.map(x=>{const checked=values.includes(x.value)||values.length===0;return <label className="source-option" key={x.value}><input type="checkbox" checked={checked} onChange={()=>toggle(x.value)}/><span>{x.label}</span></label>})}
  </div>}
 </div>
}

function Tutorial({onClose}:{onClose:()=>void}){
 const steps=[
  ['Cadastre o atleta','Inclua foto, nascimento, clube e categoria. Cada atleta mantém histórico e fontes próprios.'],
  ['Configure as fontes','Em Configurações, complete nome e registro do atleta nos sites que utiliza. SwimSystem, FDAP, FGDA e Masters Paraná já aparecem como opções iniciais.'],
  ['Escolha onde buscar','Em Resultados, abra Fontes da busca e selecione uma, várias ou Todas. O VINISWIM usa somente as fontes marcadas.'],
  ['Atualize os resultados','Toque no ícone Atualizar. O sistema procura resultados, evita duplicidades e promove registros provisórios quando encontra confirmação oficial.'],
  ['Registre treino manual','Use Manual / treino para tomadas de tempo e resultados informados por você. Registros manuais permanecem identificados como Manual.'],
  ['Acompanhe a evolução','Use Resultados, Evolução, Campeonatos e Expectativas. Os filtros acompanham o atleta selecionado.'],
  ['Alertas e auditoria','Abra Ações para ativar Alertas, consultar Auditoria, imprimir ou rever este guia.']
 ]
 return <div className="modal tutorial-modal"><div className="modal-card tutorial"><div className="modal-head"><h3>Como usar o VINISWIM</h3><button className="icon-btn" onClick={onClose} aria-label="Fechar"><X/></button></div><div className="modal-body tutorial-list">{steps.map((s,i)=><div className="tutorial-step" key={s[0]}><span>{i+1}</span><div><b>{s[0]}</b><p>{s[1]}</p></div></div>)}</div></div></div>
}

function Kpi({k,v,s,onClick}:{k:string,v:any,s?:string,onClick?:()=>void}){return <button className="kpi" onClick={onClick}><span>{k}</span><b>{v}</b>{s&&<small>{s}</small>}</button>}

export default function App(){
 const [session,setSession]=useState<any>(null),[recovery,setRecovery]=useState(()=>new URLSearchParams(window.location.search).get('reset')==='1'),[page,setPage]=useState<Page>('dashboard'),[open,setOpen]=useState(false),[actionsOpen,setActionsOpen]=useState(false),[profile,setProfile]=useState<any>(null),[account,setAccount]=useState<any>(null),[athletes,setAthletes]=useState<any[]>([]),[athleteId,setAthleteId]=useState(localStorage.getItem('viniswim-athlete')||''),[events,setEvents]=useState<any[]>([]),[results,setResults]=useState<any[]>([]),[overview,setOverview]=useState<any>(null),[pbs,setPbs]=useState<any[]>([]),[meets,setMeets]=useState<any[]>([]),[entries,setEntries]=useState<any[]>([]),[audit,setAudit]=useState<any[]>([]),[sources,setSources]=useState<any[]>([]),[sourceConfigs,setSourceConfigs]=useState<any[]>([]),[searchSources,setSearchSources]=useState<string[]>([]),[monitorJobs,setMonitorJobs]=useState<any[]>([]),[modal,setModal]=useState<any>(null),[athleteModal,setAthleteModal]=useState(false),[meetModal,setMeetModal]=useState(false),[tutorial,setTutorial]=useState(false),[alertsModal,setAlertsModal]=useState(false),[auditModal,setAuditModal]=useState(false),[filters,setFilters]=useState({event:[] as string[],course:[] as string[],category:[] as string[],origin:[] as string[]}),[refreshMsg,setRefreshMsg]=useState('')
 useEffect(()=>{supabase.auth.getSession().then(x=>setSession(x.data.session));const {data:{subscription}}=supabase.auth.onAuthStateChange((e,s)=>{setSession(s);if(e==='PASSWORD_RECOVERY')setRecovery(true)});return()=>subscription.unsubscribe()},[])
 useEffect(()=>{if(session)void loadIdentity()},[session?.user?.id])
 useEffect(()=>{if(athleteId){localStorage.setItem('viniswim-athlete',athleteId);void loadAthlete()}},[athleteId])
 async function logout(){
  setOpen(false);setActionsOpen(false);setTutorial(false);setAlertsModal(false);setAuditModal(false);setModal(null);setAthleteModal(false);setMeetModal(false)
  localStorage.removeItem('viniswim-athlete')
  setAthleteId('');setProfile(null);setAccount(null);setAthletes([]);setEvents([]);setResults([]);setOverview(null);setPbs([]);setMeets([]);setEntries([]);setAudit([]);setSources([]);setSourceConfigs([]);setSearchSources([]);setMonitorJobs([]);setRefreshMsg('');setPage('dashboard')
  const {error}=await supabase.auth.signOut()
  setSession(null)
  if(error)console.error('VINISWIM signOut:',error.message)
 }
 async function loadIdentity(){const uid=session.user.id;const [{data:p},{data:m},{data:e}]=await Promise.all([supabase.from('profiles').select('*').eq('id',uid).maybeSingle(),supabase.from('account_members').select('account_id,role,accounts(*)').eq('user_id',uid).eq('status','active').limit(1).maybeSingle(),supabase.from('events').select('*').order('sort_order')]);setProfile(p);setAccount((m as any)?.accounts||null);setEvents(e||[]);if((m as any)?.account_id){const {data:a}=await supabase.from('athletes').select('*').eq('account_id',(m as any).account_id).eq('active',true).order('created_at');setAthletes(a||[]);if(!athleteId&&a?.[0])setAthleteId(a[0].id)}}
 async function loadAthlete(){const [{data:r},{data:o},{data:pb},{data:en},{data:au},{data:rs},{data:sc},{data:mj}]=await Promise.all([supabase.from('v_result_timeline').select('*').eq('athlete_id',athleteId).order('result_date',{ascending:false}).order('created_at',{ascending:false}),supabase.from('v_athlete_overview').select('*').eq('athlete_id',athleteId).maybeSingle(),supabase.from('personal_bests').select('*,results(*)').eq('athlete_id',athleteId),supabase.from('meet_entries').select('*,meets(*)').eq('athlete_id',athleteId),supabase.from('audit_log').select('*').eq('athlete_id',athleteId).order('created_at',{ascending:false}).limit(120),supabase.from('result_sources').select('*,sources(name,code)').in('result_id',(results||[]).map(x=>x.id).length?(results||[]).map(x=>x.id):['00000000-0000-0000-0000-000000000000']),supabase.from('athlete_source_configs').select('*,sources(code,name)').eq('athlete_id',athleteId).eq('active',true).order('sort_order').order('display_name'),supabase.from('monitor_jobs').select('*').eq('athlete_id',athleteId)]);setResults(r||[]);setOverview(o||null);setPbs((pb||[]).map((x:any)=>({...x.results,pb_id:x.id})));setEntries(en||[]);setMeets([...new Map((en||[]).map((x:any)=>[x.meets?.id,x.meets])).values()].filter(Boolean));setAudit(au||[]);setSources(rs||[]);setSourceConfigs(sc||[]);const codes=(sc||[]).map((x:any)=>x.sources?.code).filter(Boolean);setSearchSources(prev=>{const kept=prev.filter(x=>codes.includes(x));return kept.length?kept:codes});setMonitorJobs(mj||[])}
 useEffect(()=>{if(results.length&&athleteId)void supabase.from('result_sources').select('*,sources(name,code)').in('result_id',results.map(x=>x.id)).then(({data})=>setSources(data||[]))},[results.length,athleteId])
 const athlete=athletes.find(x=>x.id===athleteId),ev=new Map(events.map(x=>[x.id,x.label]))
 const filtered=results.filter(r=>
  (!filters.event.length||filters.event.includes(r.event_id))&&
  (!filters.course.length||filters.course.includes(r.course))&&
  (!filters.category.length||filters.category.includes(r.category))&&
  (!filters.origin.length||filters.origin.some((o:string)=>o==='official'?r.is_official:o==='manual'?r.origin==='manual':['dns','dsq','dnf','partial'].includes(r.status)))
 )
 if(recovery&&session)return <PasswordRecovery onDone={()=>{window.history.replaceState({},'',window.location.pathname);setRecovery(false);setSession(null)}}/>
 if(!session)return <Auth onAuthenticated={s=>setSession(s)}/>
 if(!account)return <div className="loading">Preparando sua conta VINISWIM...</div>
 if(!athletes.length)return <><AthleteModal accountId={account.id} onClose={()=>{}} onSaved={loadIdentity}/></>
 async function del(r:any){if(confirm('Excluir este resultado manual?')){await supabase.from('results').delete().eq('id',r.id);await loadAthlete()}}
 async function refresh(){setRefreshMsg('Solicitando atualização...');const {data,error}=await supabase.rpc('request_result_refresh',{p_athlete_id:athleteId,p_source_codes:searchSources});if(error)setRefreshMsg(error.message);else setRefreshMsg(data?.message||'Atualização solicitada.');setTimeout(()=>void loadAthlete(),4000)}
 const title=nav.find(x=>x[0]===page)?.[1]||'VINISWIM',age=calcAge(athlete?.birth_date),lastSync=monitorJobs.map(x=>x.last_run_at).filter(Boolean).sort().at(-1)
 return <div className="app">
  <aside className={open?'sidebar open':'sidebar'}><div className="sidebar-head"><div className="brand"><img className="brand-logo" src="../apple-touch-icon.png"/><div><b>VINISWIM</b><small>Performance Tracker</small></div></div><button className="sidebar-close" onClick={()=>setOpen(false)} aria-label="Fechar menu"><X size={22}/></button></div><nav>{nav.map(([id,label,Icon])=><button className={page===id?'active':''} onClick={()=>{setPage(id);setOpen(false)}} key={id}><Icon size={18}/>{label}</button>)}</nav><div className="sidebar-actions"><button className="sidebar-actions-toggle" onClick={()=>setActionsOpen(v=>!v)} aria-expanded={actionsOpen}><span>Ações</span><ChevronDown size={18} className={actionsOpen?'rotated':''}/></button>{actionsOpen&&<div className="sidebar-actions-menu"><button onClick={()=>{setTutorial(true);setOpen(false)}}>Como usar</button><button onClick={()=>{setAlertsModal(true);setOpen(false)}}><Bell size={16}/> Alertas</button><button onClick={()=>{setAuditModal(true);setOpen(false)}}><ShieldCheck size={16}/> Auditoria</button><button onClick={()=>window.print()}><Printer size={16}/> Imprimir / PDF</button><button onClick={logout}><LogOut size={17}/> Sair</button></div>}</div><div className="sidebar-legal">© 2026 VINISWIM<br/><span>Todos os direitos reservados · v0.1.0</span></div></aside><div className={open?'sidebar-backdrop open':'sidebar-backdrop'} onClick={()=>setOpen(false)}/>
  <main><header><div className="header-left"><button className="menu" onClick={()=>setOpen(v=>!v)} aria-label="Abrir menu"><Menu/></button><div><h1>{title}</h1><small>{profile?.full_name||session.user.email}</small></div></div><div className="athlete-switcher"><AthleteAvatar athlete={athlete} size="sm"/><select aria-label="Selecionar atleta" value={athleteId} onChange={e=>setAthleteId(e.target.value)}>{athletes.map(a=><option key={a.id} value={a.id}>{a.preferred_name||a.full_name}</option>)}</select><button className="switch-add" onClick={()=>setAthleteModal(true)} title="Adicionar atleta"><UserPlus size={18}/></button></div></header>
  <div className="content"><section className="athlete-hero"><AthleteAvatar athlete={athlete} size="lg"/><div className="athlete-main"><h2>{athlete?.full_name}</h2><p>{[athlete?.club_name,athlete?.status==='active'?'fonte oficial ativa':'fonte oficial pendente'].filter(Boolean).join(' · ')}</p><div className="athlete-meta"><span>Idade: {age==null?'—':age+' anos'}</span><span>Categoria: {athlete?.category||'—'}</span></div></div></section>
  {page==='dashboard'&&<Dashboard overview={overview} pbs={pbs} results={results} entries={entries} events={events} setPage={setPage}/>}
  {page==='results'&&<ResultsPage filtered={filtered} allResults={results} events={events} filters={filters} setFilters={setFilters} meets={meets} sourceConfigs={sourceConfigs} selectedSources={searchSources} setSelectedSources={setSearchSources} onNew={()=>setModal({})} onEdit={setModal} onDelete={del} onRefresh={refresh} refreshMsg={refreshMsg} lastSync={lastSync}/>}
  {page==='evolution'&&<Evolution results={results} events={events}/>}
  {page==='meets'&&<MeetsPage meets={meets} entries={entries} results={results} events={events} athlete={athlete} athleteId={athleteId} onNew={()=>setMeetModal(true)} reload={loadAthlete}/>}
  {page==='expectations'&&<Expectations results={results} entries={entries} events={events}/>}
  {page==='settings'&&<SettingsPage athlete={athlete} accountId={account.id} userId={session.user.id} sourceConfigs={sourceConfigs} reload={async()=>{await loadIdentity();await loadAthlete()}} onAddAthlete={()=>setAthleteModal(true)}/>}
  </div></main>
  <nav className="mobile-nav">{([['dashboard','Início',Gauge],['results','Resultados',Medal],['evolution','Evolução',ChartNoAxesCombined],['meets','Campeonatos',Trophy]] as any[]).map(([id,label,Icon])=><button key={id} className={page===id?'active':''} onClick={()=>setPage(id)}><Icon size={20}/><span>{label}</span></button>)}<button onClick={()=>setOpen(true)}><MoreHorizontal size={20}/><span>Mais</span></button></nav>
  {modal&&<ResultModal athleteId={athleteId} events={events} meets={meets} row={modal.id?modal:null} onClose={()=>setModal(null)} onSaved={loadAthlete}/>}
  {athleteModal&&<AthleteModal accountId={account.id} onClose={()=>setAthleteModal(false)} onSaved={loadIdentity}/>}
  {meetModal&&<MeetModal athleteId={athleteId} events={events} onClose={()=>setMeetModal(false)} onSaved={loadAthlete}/>}
  {alertsModal&&<ActionModal title="Alertas" onClose={()=>setAlertsModal(false)}><Alerts athleteId={athleteId} userId={session.user.id} entries={entries}/></ActionModal>}
  {auditModal&&<ActionModal title="Auditoria" onClose={()=>setAuditModal(false)}><Audit rows={audit} sources={sources} overview={overview}/></ActionModal>}
  {tutorial&&<Tutorial onClose={()=>setTutorial(false)}/>}
 </div>
}

function Dashboard({overview,pbs,results,entries,events,setPage}:{overview:any,pbs:any[],results:any[],entries:any[],events:any[],setPage:(p:Page)=>void}){const ev=new Map(events.map(x=>[x.id,x.label]));const next=entries.filter(e=>e.meets?.start_date>=new Date().toISOString().slice(0,10)).sort((a,b)=>a.meets.start_date.localeCompare(b.meets.start_date))[0];return <><div className="kpi-grid"><Kpi k="Total de resultados" v={overview?.total_results||0} s="Registros no histórico" onClick={()=>setPage('results')}/><Kpi k="Resultados manuais" v={overview?.manual_results||0} s="Lançamentos manuais" onClick={()=>setPage('results')}/><Kpi k="Resultados oficiais" v={overview?.official_results||0} s="Fontes oficiais" onClick={()=>setPage('results')}/><Kpi k="Ocorrências" v={overview?.occurrences||0} s="DNS · DSQ · DNF · Parcial" onClick={()=>setPage('results')}/></div><section className="section"><div className="section-head"><h3>Próximo campeonato</h3></div>{next?<div className="next-meet"><div><b>{next.meets.name}</b><small>{d(next.meets.start_date)} · {next.meets.venue||next.meets.city||'local não informado'} · {poolLabel(next.meets.course)}</small></div><div><b>{ev.get(next.event_id)}</b><small>Balizamento {formatSwimTime(next.seed_time_ms)} · Série {next.heat??'—'} · Raia {next.lane??'—'}</small></div></div>:<p className="muted">Nenhum campeonato futuro cadastrado.</p>}</section><section className="section"><div className="section-head"><h3>Melhores marcas confirmadas</h3><span>{pbs.length}</span></div><div className="pb-grid">{pbs.map((r:any,i)=><div className="pb" key={r.id}><span>#{i+1}</span><div><b>{ev.get(r.event_id)||'Prova'}</b><small>{poolLabel(r.course)} · {d(r.result_date)} · {r.venue||r.city||'local não informado'}</small></div><strong>{formatSwimTime(r.time_ms)}</strong></div>)}{!pbs.length&&<p className="muted">Ainda não há melhores marcas oficiais.</p>}</div></section></>}

function ResultsPage({filtered,allResults,events,filters,setFilters,meets,sourceConfigs,selectedSources,setSelectedSources,onNew,onEdit,onDelete,onRefresh,refreshMsg,lastSync}:{filtered:any[],allResults:any[],events:any[],filters:any,setFilters:any,meets:any[],sourceConfigs:any[],selectedSources:string[],setSelectedSources:any,onNew:()=>void,onEdit:any,onDelete:any,onRefresh:()=>void,refreshMsg:string,lastSync?:string}){
 const [sourceOpen,setSourceOpen]=useState(false)
 const ev=new Map(events.map(x=>[x.id,x.label])),mt=new Map(meets.map(x=>[x.id,x.name]))
 const eventIds=[...new Set(allResults.map(r=>r.event_id).filter(Boolean))]
 const athleteEvents=events.filter(e=>eventIds.includes(e.id))
 const courses=['SCM','LCM']
 const categories=[...new Set(allResults.map(r=>r.category).filter(Boolean))].sort()
 const hasOfficial=allResults.some(r=>r.is_official)
 const hasManual=allResults.some(r=>r.origin==='manual')
 const hasOccurrences=allResults.some(r=>['dns','dsq','dnf','partial'].includes(r.status))
 const allCodes=sourceConfigs.map((x:any)=>x.sources?.code).filter(Boolean)
 const allSelected=allCodes.length>0&&allCodes.every((x:string)=>selectedSources.includes(x))
 function toggleAll(){setSelectedSources(allSelected?[]:allCodes)}
 return <section className="section">
  <div className="section-head">
   <h3>Resultados</h3>
   <div className="results-icon-actions">
    <div className="result-icon-action">
     <button className="icon-action" onClick={onRefresh} title="Atualizar resultados nas fontes selecionadas" aria-label="Atualizar resultados"><RefreshCw size={18}/></button>
     <small>Atualizar</small>
    </div>
    <div className="result-icon-action">
     <button className="icon-action primary" onClick={onNew} title="Novo resultado manual de treino ou tomada de tempo" aria-label="Novo resultado manual"><Plus size={18}/></button>
     <small>Manual / treino</small>
    </div>
   </div>
  </div>
  <div className="results-sync-meta"><small>{lastSync?'Última atualização: '+new Date(lastSync).toLocaleString('pt-BR'):'Última atualização: —'}</small></div>
  {refreshMsg&&<div className="sync-msg">{refreshMsg}</div>}
  <div className="search-source-control">
   <button type="button" className="source-select-button" onClick={()=>setSourceOpen(v=>!v)} aria-expanded={sourceOpen}>
    <span>Fontes da busca</span>
    <b>{allSelected?'Todas':selectedSources.length?selectedSources.length+' selecionada(s)':'Nenhuma'}</b>
    <ChevronDown size={18} className={sourceOpen?'rotated':''}/>
   </button>
   {sourceOpen&&<div className="source-select-menu">
    <label className="source-option all"><input type="checkbox" checked={allSelected} onChange={toggleAll}/><span>Todas</span></label>
    {sourceConfigs.map((cfg:any)=>{const code=cfg.sources?.code||'';const checked=selectedSources.includes(code);return <label className="source-option" key={cfg.id}><input type="checkbox" checked={checked} onChange={()=>setSelectedSources((prev:string[])=>checked?prev.filter(x=>x!==code):[...prev,code])}/><span>{cfg.display_name}</span>{(!cfg.external_id||!cfg.external_name)&&<small>não configurada</small>}</label>})}
    {!sourceConfigs.length&&<div className="source-empty">Nenhuma fonte cadastrada em Configurações.</div>}
   </div>}
  </div>
  <div className="result-filter-grid">
   <ResultMultiFilter label="Prova" values={filters.event} allLabel="Todas as provas" options={athleteEvents.map((e:any)=>({value:e.id,label:e.label}))} onChange={v=>setFilters({...filters,event:v})}/>
   <ResultMultiFilter label="Piscina" values={filters.course} allLabel="Ambas" options={[{value:'SCM',label:'25 m'},{value:'LCM',label:'50 m'}]} onChange={v=>setFilters({...filters,course:v})}/>
   <ResultMultiFilter label="Categoria" values={filters.category} allLabel="Todas as categorias" options={categories.map((x:any)=>({value:String(x),label:String(x)}))} onChange={v=>setFilters({...filters,category:v})}/>
   <ResultMultiFilter label="Origem" values={filters.origin} allLabel="Todas as origens" options={[...(hasOfficial?[{value:'official',label:'Oficial'}]:[]),...(hasManual?[{value:'manual',label:'Manual'}]:[]),...(hasOccurrences?[{value:'occurrence',label:'DNS / DSQ / DNF / Parcial'}]:[])]} onChange={v=>setFilters({...filters,origin:v})}/>
  </div>
  <div className="table-wrap desktop-results"><table><thead><tr><th>#</th><th>Data</th><th>Categoria</th><th>Prova</th><th>Tempo</th><th>Piscina</th><th>Local</th><th>Competição</th><th>Origem</th><th></th></tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td>#{r.chronological_number}</td><td>{d(r.result_date)}</td><td>{r.category||'—'}</td><td>{ev.get(r.event_id)}</td><td><strong>{statusLabel(r.status,r.time_ms)}</strong></td><td>{poolLabel(r.course)}</td><td>{r.venue||r.city||'—'}</td><td>{mt.get(r.meet_id)||'—'}</td><td><span className={r.is_official?'tag official':'tag manual'}>{resultOrigin(r)}</span></td><td>{r.origin==='manual'&&<div className="actions"><button onClick={()=>onEdit(r)}>Editar</button><button className="danger" onClick={()=>onDelete(r)}>Excluir</button></div>}</td></tr>)}</tbody></table></div>
  <div className="mobile-results">{filtered.map(r=><div className="result-card" key={r.id}><div className="result-card-top"><div><span className="result-number">#{r.chronological_number}</span><b>{ev.get(r.event_id)}</b><small>{d(r.result_date)} · {poolLabel(r.course)} · {r.category||'categoria —'}</small></div><strong>{statusLabel(r.status,r.time_ms)}</strong></div><div className="result-card-meta">{r.venue||r.city||'Local não informado'}{mt.get(r.meet_id)?' · '+mt.get(r.meet_id):''}</div><div className="result-card-foot"><span className={r.is_official?'tag official':'tag manual'}>{resultOrigin(r)}</span>{r.origin==='manual'&&<div className="actions"><button onClick={()=>onEdit(r)}>Editar</button><button className="danger" onClick={()=>onDelete(r)}>Excluir</button></div>}</div></div>)}</div>
 </section>
}

function Evolution({results,events}:{results:any[],events:any[]}){
 const [event,setEvent]=useState('__all'),[course,setCourse]=useState(''),[category,setCategory]=useState('')
 const categories=[...new Set(results.map(r=>r.category).filter(Boolean))].sort()
 const labels=new Map(events.map(e=>[e.id,e.label]))
 const valid=results
  .filter(r=>r.status==='valid'&&r.time_ms&&(!course||r.course===course)&&(!category||r.category===category))
  .sort((a,b)=>a.result_date.localeCompare(b.result_date)||String(a.created_at||'').localeCompare(String(b.created_at||'')))
 const selected=event==='__all'?valid:valid.filter(r=>r.event_id===event)
 const eventIds=[...new Set(selected.map(r=>r.event_id))]
 const dates=[...new Set(selected.map(r=>r.result_date))].sort()
 const palette=['#159aa4','#3656bd','#14805e','#b27a15','#9b4aa2','#c75d45','#4d6fb6','#8b6a3d','#5d7b83','#a35f7d']
 const badColor='#c94747'
 const rows:any[]=dates.map(date=>({_date:date,date:d(date),_items:[]}))
 const rowByDate=new Map(rows.map(r=>[r._date,r]))
 const groups=eventIds.map((id,gi)=>{
   const pts=selected.filter(r=>r.event_id===id).sort((a,b)=>a.result_date.localeCompare(b.result_date)||String(a.created_at||'').localeCompare(String(b.created_at||'')))
   const pointKey='point_'+gi
   pts.forEach(p=>{const row=rowByDate.get(p.result_date);if(row){row[pointKey]=p.time_ms/1000;row._items.push({label:labels.get(id)||'Prova',time:p.time_ms,category:p.category,course:p.course})}})
   const segments=pts.slice(1).map((p,i)=>{
     const a=pts[i],key='seg_'+gi+'_'+i,from=rowByDate.get(a.result_date),to=rowByDate.get(p.result_date)
     if(from)from[key]=a.time_ms/1000
     if(to)to[key]=p.time_ms/1000
     return{key,worse:p.time_ms>a.time_ms}
   })
   return{id,label:labels.get(id)||String(id),pts,pointKey,segments,color:palette[gi%palette.length]}
 })
 const times=selected.map(r=>r.time_ms/1000)
 let yMin:number|undefined,yMax:number|undefined
 if(times.length){
   let min=Math.min(...times),max=Math.max(...times)
   if(min===max){min*=.97;max*=1.03}else{const margin=(max-min)*.12;min-=margin;max+=margin}
   yMin=min;yMax=max
 }
 const stats=times.length?{n:times.length,best:Math.min(...times),first:selected[0]?.time_ms/1000,last:selected[selected.length-1]?.time_ms/1000}:null
 const worseExists=groups.some(g=>g.segments.some(s=>s.worse))
 const summary=stats
   ? event==='__all'
     ? String(stats.n)+' resultado(s) comparável(is) · '+String(groups.length)+' prova(s) no período'
     : String(stats.n)+' resultado(s) comparável(is) · melhor '+formatSwimTime(Math.round(stats.best*1000))+' · evolução de '+formatSwimTime(Math.round(stats.first*1000))+' para '+formatSwimTime(Math.round(stats.last*1000))
   : 'Sem resultados comparáveis para os filtros selecionados.'
 return <section className="section">
  <div className="section-head"><h3>Evolução</h3><div className="filters">
   <select value={event} onChange={e=>setEvent(e.target.value)}><option value="__all">Todos os estilos</option>{events.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select>
   <select value={course} onChange={e=>setCourse(e.target.value)}><option value="">Todas as piscinas</option><option value="SCM">25 m</option><option value="LCM">50 m</option></select>
   <select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Todas as categorias</option>{categories.map((x:any)=><option key={x} value={x}>{x}</option>)}</select>
  </div></div>
  <div className="chart">
   <ResponsiveContainer width="100%" height="100%">
    <LineChart data={rows} margin={{top:28,right:22,bottom:18,left:18}}>
     <CartesianGrid strokeDasharray="3 3" vertical={false}/>
     <XAxis dataKey="date" interval="preserveStartEnd" tickMargin={10}/>
     <YAxis domain={yMin!=null&&yMax!=null?[yMin,yMax]:['auto','auto']} tickCount={5} width={62} tickFormatter={(v:any)=>formatSwimTime(Math.round(Number(v)*1000))}/>
     <Tooltip content={({active,label}:any)=>{if(!active)return null;const row=rows.find(r=>r.date===label);if(!row?._items?.length)return null;return <div className="chart-tooltip"><b>{label}</b>{row._items.map((x:any,i:number)=><div key={i}><span>{x.label}</span><strong>{formatSwimTime(x.time)}</strong><small>{[poolLabel(x.course),x.category].filter(Boolean).join(' · ')}</small></div>)}</div>}}/>
     {groups.flatMap(g=>g.segments.map(s=><Line key={s.key} type="linear" dataKey={s.key} stroke={s.worse?badColor:g.color} strokeWidth={2.3} dot={false} activeDot={false} connectNulls={false} isAnimationActive={false} legendType="none"/>))}
     {groups.map(g=><Line key={g.pointKey} type="linear" dataKey={g.pointKey} stroke="transparent" strokeWidth={0} connectNulls={false} isAnimationActive={false} dot={{r:4,fill:g.color,stroke:g.color,strokeWidth:1}} activeDot={{r:5,fill:'#fff',stroke:g.color,strokeWidth:2}} legendType="none"/>)}
    </LineChart>
   </ResponsiveContainer>
  </div>
  <div className="chart-legend-custom">{groups.map(g=><span key={g.id}><i style={{background:g.color}}></i>{g.label}</span>)}{worseExists&&<span><i style={{background:badColor}}></i>Piora de tempo</span>}</div>
  <div className="notice">{summary}</div>
 </section>
}

function MeetsPage({meets,entries,results,events,athlete,athleteId,onNew,reload}:{meets:any[],entries:any[],results:any[],events:any[],athlete:any,athleteId:string,onNew:()=>void,reload:()=>void}){const ev=new Map(events.map(x=>[x.id,x.label]));const [url,setUrl]=useState(''),[msg,setMsg]=useState('');async function importOfficial(){const {data:idn}=await supabase.from('athlete_identifiers').select('external_id').eq('athlete_id',athleteId).maybeSingle();if(!idn?.external_id){setMsg('Configure primeiro o registro oficial em Configurações.');return}const {data:src}=await supabase.from('sources').select('id').eq('code','swimsystem').single();if(!src){setMsg('Fonte SwimSystem indisponível.');return}const {data:{user}}=await supabase.auth.getUser();const {error}=await supabase.from('source_link_requests').upsert({athlete_id:athleteId,source_id:src.id,external_id:idn.external_id,current_meet_url:url,status:'pending',requested_by:user!.id,processed_at:null},{onConflict:'athlete_id,source_id'});setMsg(error?error.message:'Competição enviada para validação/importação.');if(!error)await reload()}return <section className="section"><div className="section-head"><h3>Campeonatos</h3><button className="btn primary" onClick={onNew}><Plus size={15}/> Novo campeonato</button></div><div className="notice">Fonte oficial: o VINISWIM mantém balizamento separado do resultado e dá prioridade visual ao resultado oficial.</div><div className="import-box"><select><option>SwimSystem</option></select><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="URL oficial da competição"/><button className="btn" onClick={importOfficial}>Importar competição</button></div>{msg&&<div className="sync-msg">{msg}</div>}{meets.map(m=><div className="meet" key={m.id}><div className="meet-head"><div><b>{m.name}</b><small>{d(m.start_date)} · {m.venue||m.city||'local não informado'} · {poolLabel(m.course)}</small></div>{m.official_url&&<a href={m.official_url} target="_blank">Fonte oficial</a>}</div><div className="entry-grid">{entries.filter(e=>e.meet_id===m.id).map(e=>{const r=results.find(x=>x.meet_id===m.id&&x.event_id===e.event_id&&x.is_official),delta=r?.time_ms!=null&&e.seed_time_ms!=null?r.time_ms-e.seed_time_ms:null;return <div className="entry" key={e.id}><b>{ev.get(e.event_id)}</b><small>Resultado oficial</small><strong>{r?statusLabel(r.status,r.time_ms):'aguardando'}</strong>{delta!=null&&<i className={delta<=0?'good':'bad'}>{delta<=0?'↓':'↑'} {formatSwimTime(Math.abs(delta))} vs. balizamento</i>}<small>Balizamento</small><span>{formatSwimTime(e.seed_time_ms)}</span><em>Série {e.heat??'—'} · Raia {e.lane??'—'}</em></div>})}</div></div>)}{!meets.length&&<p className="muted">Nenhum campeonato cadastrado.</p>}</section>}

function Expectations({results,entries,events}:{results:any[],entries:any[],events:any[]}){const ev=new Map(events.map(x=>[x.id,x.label]));const groups=useMemo(()=>entries.map(e=>{const rows=results.filter(r=>r.event_id===e.event_id&&r.course===e.meets?.course&&r.status==='valid'&&r.time_ms).sort((a,b)=>b.result_date.localeCompare(a.result_date)).slice(0,5);if(!rows.length)return null;const vals=rows.map(x=>x.time_ms),avg=Math.round(vals.reduce((a,b)=>a+b,0)/vals.length),best=Math.min(...vals),worst=Math.max(...vals),confidence=vals.length>=5?'Alta':vals.length>=3?'Média':'Baixa';return{entry:e,label:ev.get(e.event_id),avg,best,worst,confidence}}).filter(Boolean),[results,entries,events]);return <section className="section"><h3>Expectativas de tempo</h3><div className="notice">Estimativas calculadas somente com resultados confirmados. Quando não houver dados suficientes, o sistema mostra baixa confiança em vez de inventar precisão.</div><div className="prediction-list">{groups.map((g:any)=><div className="prediction" key={g.entry.id}><div><b>{g.label}</b><small>{g.entry.meets?.name||'Próxima competição'} · {poolLabel(g.entry.meets?.course)}</small></div><div><span>Referência</span><strong>{formatSwimTime(g.best)} — {formatSwimTime(g.worst)}</strong></div><div><span>Média recente</span><strong>{formatSwimTime(g.avg)}</strong></div><span className={'confidence '+g.confidence.toLowerCase().replace('é','e')}>{g.confidence} confiança</span></div>)}{!groups.length&&<p className="muted">Sem dados suficientes nas provas futuras.</p>}</div></section>}

function Alerts({athleteId,userId,entries}:{athleteId:string,userId:string,entries:any[]}){
 const [state,setState]=useState<any>({race_offsets_minutes:[120,60,30,20,10,5],official_result_enabled:true,personal_best_enabled:true,occurrence_enabled:true}),[msg,setMsg]=useState(''),[permission,setPermission]=useState(typeof Notification==='undefined'?'indisponível':Notification.permission),[pushActive,setPushActive]=useState(false)
 useEffect(()=>{supabase.from('athlete_alert_settings').select('*').eq('user_id',userId).eq('athlete_id',athleteId).maybeSingle().then(({data})=>{if(data)setState(data)});void checkPush()},[athleteId,userId])
 async function checkPush(){try{if(!('serviceWorker'in navigator)||!('PushManager'in window)){setPushActive(false);return}const reg=await navigator.serviceWorker.ready;setPushActive(!!(await reg.pushManager.getSubscription()));setPermission(typeof Notification==='undefined'?'indisponível':Notification.permission)}catch{setPushActive(false)}}
 async function save(next:any){setState(next);const {error}=await supabase.from('athlete_alert_settings').upsert({user_id:userId,athlete_id:athleteId,...next},{onConflict:'user_id,athlete_id'});if(error)setMsg(error.message)}
 async function showTest(reg:ServiceWorkerRegistration){await reg.showNotification('VINISWIM — alertas ativados',{body:'Este aparelho está pronto para receber os alertas do VINISWIM.',icon:'../apple-touch-icon.png',badge:'../apple-touch-icon.png',tag:'viniswim-alert-test'})}
 async function push(){
  try{
   setMsg('')
   if(typeof Notification==='undefined'||!('serviceWorker'in navigator)||!('PushManager'in window))throw new Error('Este navegador não oferece notificações push para o VINISWIM.')
   const p=await Notification.requestPermission();setPermission(p);if(p!=='granted')throw new Error('Permissão de notificações não concedida.')
   const reg=await navigator.serviceWorker.ready
   const raw=(import.meta.env.VITE_VAPID_PUBLIC_KEY||'').replace(/-/g,'+').replace(/_/g,'/')
   if(!raw)throw new Error('Chave de notificações indisponível.')
   const bin=atob(raw+'='.repeat((4-raw.length%4)%4))
   let sub=await reg.pushManager.getSubscription()
   if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:new Uint8Array([...bin].map(c=>c.charCodeAt(0)))})
   const j=sub.toJSON()
   const {error}=await supabase.from('push_devices').upsert({user_id:userId,endpoint:sub.endpoint,p256dh:j.keys?.p256dh,auth_key:j.keys?.auth,platform:navigator.platform||'web',device_name:navigator.userAgent.slice(0,120),active:true,last_seen_at:new Date().toISOString()},{onConflict:'endpoint'})
   if(error)throw error
   setPushActive(true)
   await showTest(reg)
   setMsg('Alertas ativados. Uma notificação de teste foi enviada para este aparelho.')
  }catch(e:any){setMsg(e.message||String(e));await checkPush()}
 }
 async function test(){try{if(Notification.permission!=='granted')throw new Error('Ative as notificações primeiro.');const reg=await navigator.serviceWorker.ready;await showTest(reg);setMsg('Notificação de teste enviada.')}catch(e:any){setMsg(e.message||String(e))}}
 const offsets=[120,60,30,20,10,5],future=entries.filter(e=>e.scheduled_at&&new Date(e.scheduled_at)>new Date()).sort((a,b)=>a.scheduled_at.localeCompare(b.scheduled_at))
 return <><section className="section"><div className="section-head"><h3>Alertas do VINISWIM</h3><button className="btn primary" onClick={push}>{pushActive?'Revalidar neste aparelho':'Ativar neste aparelho'}</button></div><div className="notice">Ao ativar, o VINISWIM envia imediatamente uma notificação de teste. Se ela não aparecer, o aparelho ainda não está apto a receber os avisos.</div><div className="alert-status"><div><small>Permissão</small><b>{permission}</b></div><div><small>Service Worker</small><b>{'serviceWorker'in navigator?'Disponível':'Indisponível'}</b></div><div><small>Push</small><b>{pushActive?'Ativo':'Inativo'}</b></div></div><div className="alert-grid">{offsets.map(x=><label className="alert" key={x}><span><b>{x>=60?x/60+'h':x+' min'} antes</b><small>Lembrete de prova</small></span><input type="checkbox" checked={state.race_offsets_minutes.includes(x)} onChange={()=>save({...state,race_offsets_minutes:state.race_offsets_minutes.includes(x)?state.race_offsets_minutes.filter((v:number)=>v!==x):[...state.race_offsets_minutes,x].sort((a:number,b:number)=>b-a)})}/></label>)}{[['official_result_enabled','Resultado oficial'],['personal_best_enabled','Nova melhor marca'],['occurrence_enabled','DNS / DSQ / DNF']].map(([k,l])=><label className="alert" key={k}><span><b>{l}</b><small>Push automático</small></span><input type="checkbox" checked={!!state[k]} onChange={()=>save({...state,[k]:!state[k]})}/></label>)}</div>{msg&&<div className="sync-msg">{msg}</div>}</section><section className="section"><div className="section-head"><h3>Próximos avisos</h3><button className="btn" onClick={test}>Enviar teste</button></div>{future.length?future.map(e=><div className="timeline-row" key={e.id}><b>{new Date(e.scheduled_at).toLocaleString('pt-BR')}</b><span>{e.meets?.name}</span></div>):<p className="muted">Nenhuma prova com horário programado.</p>}</section></>
}

function Audit({rows,sources,overview}:{rows:any[],sources:any[],overview:any}){const unique=[...new Map(sources.map((s:any)=>[s.source_id,s.sources])).values()].filter(Boolean);return <><div className="kpi-grid audit-kpis"><Kpi k="Total" v={overview?.total_results||0}/><Kpi k="Oficiais" v={overview?.official_results||0}/><Kpi k="Manuais" v={overview?.manual_results||0}/><Kpi k="Ocorrências" v={overview?.occurrences||0}/></div><section className="section"><h3>Fontes utilizadas</h3><div className="source-list">{unique.map((s:any)=><span className="source-chip" key={s.code}>{s.name||s.code}</span>)}{!unique.length&&<p className="muted">Nenhuma fonte oficial gravada ainda.</p>}</div></section><section className="section"><h3>Auditoria</h3>{rows.map(r=><div className="audit" key={r.id}><b>{r.action.toUpperCase()}</b><span>{r.entity_type}</span><small>{new Date(r.created_at).toLocaleString('pt-BR')} · {r.source}</small></div>)}{!rows.length&&<p className="muted">Nenhum evento registrado.</p>}</section></>}

function CommercialAdmin(){const [isAdmin,setIsAdmin]=useState(false),[rows,setRows]=useState<any[]>([]),[plans,setPlans]=useState<any[]>([]),[email,setEmail]=useState(''),[customer,setCustomer]=useState(''),[planId,setPlanId]=useState(''),[athleteLimit,setAthleteLimit]=useState(1),[expires,setExpires]=useState(''),[msg,setMsg]=useState(''),[resetCode,setResetCode]=useState(''),[resetEmail,setResetEmail]=useState('');useEffect(()=>{void load()},[]);async function load(){const {data:admin}=await supabase.rpc('is_platform_admin');setIsAdmin(!!admin);if(!admin)return;const [{data:r},{data:p}]=await Promise.all([supabase.from('commercial_access').select('*,plans(code,name)').order('created_at',{ascending:false}),supabase.from('plans').select('id,code,name').eq('active',true).order('name')]);setRows(r||[]);setPlans(p||[]);if(!planId&&p?.length)setPlanId((p.find((x:any)=>x.code==='family')||p[0]).id)}async function authorize(e:any){e.preventDefault();const {error}=await supabase.from('commercial_access').upsert({email:email.trim().toLowerCase(),customer_name:customer.trim()||null,plan_id:planId||null,athlete_limit:athleteLimit,status:'authorized',expires_at:expires?new Date(expires+'T23:59:59').toISOString():null,user_id:null,used_at:null},{onConflict:'email'});if(error)setMsg(error.message);else{setMsg('E-mail autorizado.');setEmail('');setCustomer('');setAthleteLimit(1);setExpires('');await load()}}async function revoke(id:string){await supabase.from('commercial_access').update({status:'revoked'}).eq('id',id);await load()}async function issueReset(targetEmail:string){setMsg('');setResetCode('');setResetEmail('');const {data,error}=await supabase.rpc('admin_issue_password_reset',{p_email:targetEmail});if(error){setMsg(error.message);return}setResetCode(String(data||''));setResetEmail(targetEmail);setMsg('Código gerado. Válido por 30 minutos.')}async function copyResetCode(){if(!resetCode)return;try{await navigator.clipboard.writeText(resetCode);setMsg('Código copiado para a área de transferência.')}catch{setMsg('Não foi possível copiar automaticamente. Selecione o código abaixo.')}}if(!isAdmin)return null;return <section className="section admin-commercial"><div className="section-head"><div><h3>Admin Comercial</h3><p className="muted">Somente e-mails cadastrados aqui podem ativar o VINISWIM.</p></div><span className="admin-badge">ADMIN</span></div><form className="form-grid" onSubmit={authorize}><label>Cliente<input value={customer} onChange={e=>setCustomer(e.target.value)}/></label><label>E-mail comercializado<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Plano<select value={planId} onChange={e=>setPlanId(e.target.value)}>{plans.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Perfis de atleta autorizados<input type="number" min="1" max="100" value={athleteLimit} onChange={e=>setAthleteLimit(Math.max(1,Math.min(100,Number(e.target.value)||1)))}/></label><label>Validade<input type="date" value={expires} onChange={e=>setExpires(e.target.value)}/></label><div className="wide"><button className="btn primary">Autorizar e-mail</button></div></form>{msg&&<div className="sync-msg">{msg}</div>}{resetCode&&<div className="reset-code-box"><small>Código para {resetEmail}</small><div className="reset-code-row"><input readOnly value={resetCode} onFocus={e=>e.currentTarget.select()} aria-label="Código de recuperação"/><button type="button" className="btn" onClick={copyResetCode}>Copiar código</button></div><small>Válido por 30 minutos.</small></div>}<div className="table-wrap"><table><thead><tr><th>Cliente</th><th>E-mail</th><th>Plano</th><th>Perfis</th><th>Status</th><th></th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.customer_name||'—'}</td><td>{r.email}</td><td>{r.plans?.name||'—'}</td><td>{r.athlete_limit||1}</td><td>{String(r.status).toUpperCase()}</td><td><div className="actions">{r.status==='used'&&<button onClick={()=>issueReset(r.email)}>Gerar código de senha</button>}{r.status==='authorized'&&<button className="danger-link" onClick={()=>revoke(r.id)}>Revogar</button>}</div></td></tr>)}</tbody></table></div></section>}

function SourceConfigEditor({athleteId,cfg,onSaved,onDeleted,onMessage,isNew,onCancel}:{athleteId:string,cfg?:any,onSaved:()=>void,onDeleted?:()=>void,onMessage:(m:string)=>void,isNew?:boolean,onCancel?:()=>void}){
 const [label,setLabel]=useState(cfg?.display_name||''),[url,setUrl]=useState(cfg?.source_url||''),[externalId,setExternalId]=useState(cfg?.external_id||''),[externalName,setExternalName]=useState(cfg?.external_name||''),[busy,setBusy]=useState(false)
 useEffect(()=>{setLabel(cfg?.display_name||'');setUrl(cfg?.source_url||'');setExternalId(cfg?.external_id||'');setExternalName(cfg?.external_name||'')},[cfg?.id])
 async function save(e:any){
  e.preventDefault();onMessage('')
  if(!url.trim()||!externalId.trim()||!externalName.trim()){onMessage('Preencha URL, número/registro e nome do atleta nesta fonte.');return}
  if(isNew&&!label.trim()){onMessage('Informe como essa fonte deve aparecer no VINISWIM.');return}
  setBusy(true)
  const {data,error}=await supabase.rpc('save_athlete_source_config',{
   p_athlete_id:athleteId,
   p_url:url.trim(),
   p_external_id:externalId.trim(),
   p_external_name:externalName.trim(),
   p_display_name:label.trim()||null,
   p_config_id:cfg?.id||null
  })
  setBusy(false)
  if(error){onMessage(error.message);return}
  if(!data?.ok){onMessage(data?.message||'Não foi possível salvar a fonte.');return}
  onMessage('Fonte '+data.display_name+' salva.')
  await onSaved()
  if(isNew&&onCancel)onCancel()
 }
 async function remove(){
  if(!cfg?.id)return
  if(!confirm('Excluir '+(cfg.display_name||'esta fonte')+' deste atleta?'))return
  setBusy(true)
  const {data,error}=await supabase.rpc('delete_athlete_source_config',{p_config_id:cfg.id})
  setBusy(false)
  if(error){onMessage(error.message);return}
  if(!data?.ok){onMessage('Não foi possível excluir a fonte.');return}
  onMessage('Fonte excluída.')
  await onDeleted?.()
 }
 const known=!!cfg?.sources?.code
 return <form className="source-config-card" onSubmit={save}>
  <div className="source-config-head"><div><b>{isNew?(label||'Nova fonte'):(cfg?.display_name||'Fonte')}</b>{!isNew&&<small>{cfg?.is_default?'Padrão VINISWIM':'Fonte adicionada'}</small>}</div><div className="actions">{cfg?.source_url&&<a href={cfg.source_url} target="_blank" rel="noreferrer">Abrir ↗</a>}{!isNew&&<button type="button" className="danger" onClick={remove} disabled={busy}>Excluir</button>}{isNew&&<button type="button" onClick={onCancel}>Cancelar</button>}</div></div>
  <div className="source-config-grid">
   {isNew&&<label>Nome curto da fonte<input value={label} onChange={e=>setLabel(e.target.value)} placeholder="Ex.: CBDA" required/></label>}
   <label className={isNew?'':'wide'}>URL<input type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..." required/></label>
   <label>Número / registro<input value={externalId} onChange={e=>setExternalId(e.target.value)} placeholder="Registro do atleta" required/></label>
   <label>Nome nesta fonte<input value={externalName} onChange={e=>setExternalName(e.target.value)} placeholder="Ex.: nome do atleta nesta fonte" required/></label>
  </div>
  <div className="source-config-actions"><button className="btn primary" disabled={busy}>{busy?'Salvando...':'Salvar fonte'}</button>{!externalId||!externalName?<small>Complete nome e registro para habilitar a busca.</small>:<small>Pronta para busca.</small>}</div>
 </form>
}

function SettingsPage({athlete,accountId,userId,sourceConfigs,reload,onAddAthlete}:{athlete:any,accountId:string,userId:string,sourceConfigs:any[],reload:()=>void,onAddAthlete:()=>void}){const [name,setName]=useState(athlete.full_name||''),[club,setClub]=useState(athlete.club_name||''),[birth,setBirth]=useState(athlete.birth_date||''),[category,setCategory]=useState(athlete.category||''),[photo,setPhoto]=useState(athlete.photo_data_url||''),[addingSource,setAddingSource]=useState(false),[msg,setMsg]=useState(''),[newPassword,setNewPassword]=useState(''),[confirmNewPassword,setConfirmNewPassword]=useState(''),[passwordMsg,setPasswordMsg]=useState(''),[passwordBusy,setPasswordBusy]=useState(false);useEffect(()=>{setName(athlete.full_name||'');setClub(athlete.club_name||'');setBirth(athlete.birth_date||'');setCategory(athlete.category||'');setPhoto(athlete.photo_data_url||'')},[athlete.id]);async function file(e:any){const f=e.target.files?.[0];if(f)setPhoto(await compressPhoto(f))}async function save(){const {error}=await supabase.from('athletes').update({full_name:name,preferred_name:name.split(' ')[0],club_name:club||null,birth_date:birth||null,category:category||null,photo_data_url:photo||null}).eq('id',athlete.id);setMsg(error?error.message:'Dados salvos automaticamente no Supabase.');if(!error)await reload()}async function changePassword(e:any){e.preventDefault();setPasswordMsg('');if(newPassword.length<8){setPasswordMsg('Use pelo menos 8 caracteres.');return}if(newPassword!==confirmNewPassword){setPasswordMsg('As senhas não conferem.');return}setPasswordBusy(true);const {error}=await supabase.auth.updateUser({password:newPassword});setPasswordBusy(false);if(error){setPasswordMsg(error.message);return}setNewPassword('');setConfirmNewPassword('');setPasswordMsg('Senha alterada com sucesso.')}return <><section className="section"><div className="section-head"><h3>Perfil do atleta</h3><button className="btn" onClick={onAddAthlete}><UserPlus size={16}/> Adicionar irmão / atleta</button></div><div className="settings-profile"><div className="profile-photo-editor">{photo?<img src={photo}/>:<AthleteAvatar athlete={athlete} size="lg"/>}<label className="btn"><Camera size={16}/> Alterar foto<input type="file" accept="image/*" hidden onChange={file}/></label></div><div className="form-grid"><label>Nome<input value={name} onChange={e=>setName(e.target.value)}/></label><label>Clube<input value={club} onChange={e=>setClub(e.target.value)}/></label><label>Nascimento<input type="date" value={birth} onChange={e=>setBirth(e.target.value)}/></label><label>Categoria<div className="category-filter"><select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Escolha a categoria</option>{category&&!ATHLETE_CATEGORIES.includes(category)&&<option value={category}>{category}</option>}{ATHLETE_CATEGORIES.map(x=><option key={x} value={x}>{x}</option>)}</select><ChevronDown size={20}/></div></label><div className="wide"><button className="btn primary" onClick={save}>Salvar perfil</button></div></div></div></section><section className="section"><div className="section-head"><div><h3>Fontes de resultados</h3><p className="muted">Os quatro sites padrão já vêm com seus endereços nativos. Preencha nome e registro do atleta em cada fonte que deseja usar.</p></div><button className="btn" onClick={()=>setAddingSource(true)}><Plus size={15}/> Adicionar fonte</button></div><div className="source-config-list">{sourceConfigs.map((cfg:any)=><SourceConfigEditor key={cfg.id} athleteId={athlete.id} cfg={cfg} onSaved={reload} onDeleted={reload} onMessage={setMsg}/>)}{addingSource&&<SourceConfigEditor athleteId={athlete.id} isNew onSaved={reload} onCancel={()=>setAddingSource(false)} onMessage={setMsg}/>}</div>{msg&&<div className="notice">{msg}</div>}</section><section className="section"><h3>Segurança da conta</h3><p className="muted">Altere sua senha diretamente no Supabase Auth. A nova senha vale em todos os aparelhos.</p><form className="form" onSubmit={changePassword}><label>Nova senha<input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} minLength={8} required/></label><label>Confirmar nova senha<input type="password" value={confirmNewPassword} onChange={e=>setConfirmNewPassword(e.target.value)} minLength={8} required/></label><button className="btn primary" disabled={passwordBusy}>{passwordBusy?'Alterando...':'Alterar senha'}</button></form>{passwordMsg&&<div className="notice">{passwordMsg}</div>}</section><CommercialAdmin/></>}
