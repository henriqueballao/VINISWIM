// VINISWIM MONITOR V40 — DNS/DSQ/DNF real + descoberta automatica das provas do atleta
import express from 'express';
import cors from 'cors';
import webpush from 'web-push';
import * as cheerio from 'cheerio';
import fs from 'node:fs/promises';
import path from 'node:path';

const app=express();
app.use(cors());
app.use(express.json({limit:'2mb'}));

const PORT=Number(process.env.PORT||8080);
const DATA_DIR=process.env.DATA_DIR||'./data';
const STATE_FILE=path.join(DATA_DIR,'state.json');
const INTERVAL=Number(process.env.CHECK_INTERVAL_MS||60000);

const ADMIN_TOKEN=process.env.ADMIN_TOKEN||'';
function adminOk(req){
  return ADMIN_TOKEN && String(req.query.token||req.headers['x-admin-token']||'')===ADMIN_TOKEN;
}

function jsonOrJsonp(req,res,payload,status=200){
  const cb=String(req.query?.callback||'').trim();
  if(cb && /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(cb)){
    res.status(200).type('application/javascript; charset=utf-8').send(cb+'('+JSON.stringify(payload)+');');
    return;
  }
  res.status(status).json(payload);
}


const VAPID_PUBLIC_KEY=process.env.VAPID_PUBLIC_KEY||'';
const VAPID_PRIVATE_KEY=process.env.VAPID_PRIVATE_KEY||'';
const VAPID_SUBJECT=process.env.VAPID_SUBJECT||'mailto:admin@example.com';

if(VAPID_PUBLIC_KEY&&VAPID_PRIVATE_KEY){
  webpush.setVapidDetails(VAPID_SUBJECT,VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY);
}

const defaultState={devices:[],sent:{},pendingResults:[],resultNotified:{},autonomousScanAt:{},autonomousStats:{}};

const AUTONOMOUS_ATHLETES=[
  {
    registration:'422692',
    name:'Vinícius Suzin Ballão',
    aliases:['Vinicius Suzin Ballao','Vinícius Suzin Ballão','Vini Suzin Ballão','Vini Suzin Ballao'],
    category:'Petiz I',
    swimSystemMeetUrl:'https://www.swimsystem.app/meets/sw/9b002997-591e-4f74-8492-ef595b4705c0'
  },
  {
    registration:'399680',
    name:'Lorenzo de Azevedo Fortes',
    aliases:[
      'Lorenzo Azevedo Fortes','Lorenzo de Azevedo Fortes','Lorenzo De Fortes',
      'Lorenzo De Zevedo Fortes','Lourenço Fortes','Lourenço de Azevedo Fortes',
      'Lourenco Fortes','Lourenco de Azevedo Fortes'
    ],
    category:'Petiz I',
    swimSystemMeetUrl:'https://www.swimsystem.app/meets/sw/9b002997-591e-4f74-8492-ef595b4705c0'
  },
  {
    registration:'393259',
    name:'Andre Szpak ZRAIK',
    aliases:['Andre Szpak ZRAIK','André Szpak ZRAIK','Andre Szpak Zraik','André Szpak Zraik'],
    category:'Petiz I',
    swimSystemMeetUrl:'https://www.swimsystem.app/meets/sw/9b002997-591e-4f74-8492-ef595b4705c0'
  }
];
const AUTONOMOUS_SCAN_INTERVAL_MS=5*60*1000;

async function ensureDir(){await fs.mkdir(DATA_DIR,{recursive:true})}
async function loadState(){
  try{return {...defaultState,...JSON.parse(await fs.readFile(STATE_FILE,'utf8'))}}
  catch{return structuredClone(defaultState)}
}
async function saveState(s){
  await ensureDir();
  await fs.writeFile(STATE_FILE,JSON.stringify(s,null,2),'utf8');
}
function normalize(s=''){
  return String(s).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/\s+/g,' ').trim();
}
function canonicalPersonName(s=''){
  return normalize(s)
    .replace(/\b(de|da|do|das|dos)\b/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}
function athleteNameForms(athlete={}){
  const raw=[athlete?.name,...(Array.isArray(athlete?.aliases)?athlete.aliases:[])].filter(Boolean);
  const out=new Set();
  for(const v of raw){
    const n=normalize(v), c=canonicalPersonName(v);
    if(n)out.add(n);
    if(c)out.add(c);
  }
  return [...out];
}
function athleteTextMatches(text,athlete={}){
  const n=normalize(text), c=canonicalPersonName(text);
  return athleteNameForms(athlete).some(x=>n.includes(x)||c.includes(x));
}
function athleteExactNameMatches(name,athlete={}){
  const n=normalize(name), c=canonicalPersonName(name);
  return athleteNameForms(athlete).some(x=>n===x||c===x);
}
function toSeconds(v){
  if(v==null)return null;
  const s=String(v).trim().replace(',','.').replace(/[”″]/g,'"').replace(/[’′]/g,"'");
  let m=s.match(/^(\d+):(\d{1,2})(?:\.(\d{1,2}))?$/);
  if(m)return Number(m[1])*60+Number(m[2])+Number('0.'+(m[3]||'0'));
  m=s.match(/^(\d+)['’](\d{1,2})["”]?(\d{1,2})?$/);
  if(m)return Number(m[1])*60+Number(m[2])+Number('0.'+(m[3]||'0'));
  m=s.match(/^(\d{1,3})["”](\d{1,2})$/);
  if(m)return Number(m[1])+Number('0.'+m[2]);
  m=s.match(/^(\d{1,3})[.,](\d{1,2})$/);
  if(m)return Number(m[1])+Number('0.'+m[2]);
  return null;
}
function fmt(sec){
  if(!Number.isFinite(sec))return null;
  const m=Math.floor(sec/60), s=sec-m*60;
  const whole=Math.floor(s), cs=Math.round((s-whole)*100);
  return m?`${m}'${String(whole).padStart(2,'0')}"${String(cs).padStart(2,'0')}`:`${whole}"${String(cs).padStart(2,'0')}`;
}
function meetBase(url=''){return String(url).replace(/\/(athletes|results)\/?$/,'').replace(/\/$/,'')}

async function fetchText(url,timeoutMs=9000){
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),timeoutMs);
  try{
    const r=await fetch(url,{
      headers:{'user-agent':'VINISWIM Monitor/1.0 (+personal swim tracker)'},
      signal:ctrl.signal
    });
    if(!r.ok)throw new Error(`HTTP ${r.status} em ${url}`);
    return await r.text();
  }finally{
    clearTimeout(timer);
  }
}
const federationNextAt=new Map();
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
async function fetchTextFederation(url,timeoutMs=15000){
  const host=new URL(url).host;
  for(let attempt=0;attempt<4;attempt++){
    const wait=Math.max(0,(federationNextAt.get(host)||0)-Date.now());
    if(wait)await sleep(wait);
    federationNextAt.set(host,Date.now()+3500);

    const ctrl=new AbortController();
    const timer=setTimeout(()=>ctrl.abort(),timeoutMs);
    try{
      const r=await fetch(url,{
        headers:{
          'user-agent':'Mozilla/5.0 (compatible; VINISWIM/1.0; +historico-publico)',
          'accept':'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
          'accept-language':'pt-BR,pt;q=0.9,en;q=0.6'
        },
        signal:ctrl.signal,
        redirect:'follow'
      });
      if(r.status===429){
        const retryRaw=String(r.headers.get('retry-after')||'').trim();
        const retrySec=/^\d+$/.test(retryRaw)?Number(retryRaw):0;
        const backoff=Math.max(15000,retrySec*1000,(attempt+1)*15000);
        federationNextAt.set(host,Date.now()+backoff);
        if(attempt===3)throw new Error('HTTP 429 em '+url);
        await sleep(backoff);
        continue;
      }
      if(!r.ok)throw new Error('HTTP '+r.status+' em '+url);
      return await r.text();
    }finally{clearTimeout(timer)}
  }
  throw new Error('Falha FDAP em '+url);
}


function extractMeet(html,url){
  const $=cheerio.load(html);
  const text=$('body').text().replace(/\s+/g,' ').trim();
  const name=$('h1').first().text().trim()||null;
  const pool=(text.match(/Piscina\s+(?:Longa|Curta)\s*·\s*(25|50)m/i)||[])[1];
  const cityState=(text.match(/([A-Za-zÀ-ÿ ]+)\s*\/\s*PR\s+Piscina/i)||[])[1]?.trim()||null;
  const venueHeading=$('*').filter((_,el)=>normalize($(el).text())==='local da competicao').first();
  let venue=null;
  if(venueHeading.length){
    const after=venueHeading.parent().text().replace(/\s+/g,' ');
    const mm=after.match(/Local da competição\s+(.+?)\s+(?:Rodovia|Rua|Av\.|Avenida|CEP|Adicionar)/i);
    if(mm)venue=mm[1].trim();
  }
  return {
    id:'sw-'+meetBase(url).split('/').pop(),
    name,
    dateStart:null,dateEnd:null,
    city:cityState,venue,
    poolMeters:pool?Number(pool):null,
    sourceUrl:meetBase(url),
    entries:[]
  };
}

function findAthleteBlock($,athlete){
  const needleReg=normalize(athlete?.registration||'');
  const candidates=$('body *').toArray().filter(el=>{
    const raw=$(el).text();
    const t=normalize(raw);
    return (needleReg&&t.includes(needleReg))||athleteTextMatches(raw,athlete);
  });
  let best=null;
  for(const el of candidates){
    let cur=$(el);
    for(let i=0;i<6&&cur.length;i++,cur=cur.parent()){
      const txt=cur.text().replace(/\s+/g,' ').trim();
      if(txt.length>=40&&txt.length<=2500){
        if(!best||txt.length<best.text.length)best={el:cur,text:txt};
      }
    }
  }
  return best;
}

function extractEntriesFromBlock(text){
  const entries=[];
  const rx=/(\d{1,2}:\d{2})\s+((?:\d+x)?\d{2,4}m?\s+(?:Livre|Costas|Peito|Borboleta|Medley))/gi;
  let m;
  while((m=rx.exec(text)))entries.push({scheduled:m[1],event:m[2].replace(/\s+/g,' ').trim()});
  return entries;
}

function cleanEventName(s=''){
  return normalize(String(s))
    .replace(/\b(\d{2,4})\s*m\b/g,'$1')
    .replace(/\bfinal direta\b/g,'')
    .replace(/\bmasculino\b|\bfeminino\b|\bmisto\b/g,'')
    .replace(/\bpre-mirim\b|\bmirim\b|\bpetiz\b|\binfantil\b|\bjuvenil\b|\bjunior\b|\bsenior\b/g,'')
    .replace(/\s+/g,' ')
    .trim();
}

function validPublishedResult(raw){
  const s=String(raw||'').trim();
  if(!s || s==='—' || s==='-' || /^nt$/i.test(s) || /^0[:'"]?00/i.test(s))return false;
  const sec=toSeconds(s);
  return Number.isFinite(sec) && sec>0.01 && sec<1800;
}
function participationStatus(raw=''){
  const s=normalize(raw);
  if(/\bdns\b|nao compareceu|não compareceu/.test(s))return {status:'dns',code:'DNS',label:'Não Compareceu'};
  if(/\bdsq\b|\bdq\b|desclassificad/.test(s))return {status:'dsq',code:'DSQ',label:'Desclassificado'};
  if(/\bdnf\b|nao completou|não completou|abandonou/.test(s))return {status:'dnf',code:'DNF',label:'Não Completou'};
  if(/\bns\b|nao largou|não largou/.test(s))return {status:'dns',code:'DNS',label:'Não Compareceu'};
  return null;
}
function participationFromResultStatus(raw=''){
  const s=String(raw||'').trim().toUpperCase();
  if(['DNS','NS','NO_SHOW','NOSHOW'].includes(s))return {status:'dns',code:'DNS',label:'Não Compareceu'};
  if(['DSQ','DQ','DISQUALIFIED'].includes(s))return {status:'dsq',code:'DSQ',label:'Desclassificado'};
  if(['DNF','DID_NOT_FINISH'].includes(s))return {status:'dnf',code:'DNF',label:'Não Completou'};
  if(['WDR','WD','WITHDRAWN'].includes(s))return {status:'dns',code:'DNS',label:'Não Compareceu'};
  return participationStatus(s);
}

function eventStatusFromPage($,eventLabel=''){
  const label=String(eventLabel||'').replace(/\s+/g,' ').trim();
  if(/\bOficial\b/i.test(label) && !/Não Oficial/i.test(label))return 'official';
  if(/Parciais?\s*\(Não Oficial\)|Não Oficial/i.test(label))return 'partial';

  const local=$('h1,h2,h3,h4,[class*="badge"],[class*="status"],[class*="event"],[class*="result"]')
    .toArray().map(el=>$(el).text().replace(/\s+/g,' ').trim()).join(' ');
  if(/Parciais?\s*\(Não Oficial\)|Não Oficial/i.test(local))return 'partial';
  if(/\bOficial\b/i.test(local))return 'official';

  const body=$('body').text().replace(/\s+/g,' ');
  if(/Parciais?\s*\(Não Oficial\)/i.test(body))return 'partial';
  if(/\bOficial\b/i.test(body) && !/Não Oficial/i.test(body))return 'official';
  return 'published';
}

function selectedEventTitle($,fallback=''){
  const parts=$('h1,h2,h3,h4,[class*="title"],[class*="heading"]').toArray()
    .map(el=>$(el).text().replace(/\s+/g,' ').trim())
    .filter(Boolean);
  const rx=/\b((?:\d+x)?\d{2,4}\s*m?\s+(?:Livre|Costas|Peito|Borboleta|Medley))\b/i;
  for(const p of parts){
    const m=p.match(rx);
    if(m)return m[1].replace(/\s+/g,' ').trim();
  }
  const fm=String(fallback||'').match(rx);
  return fm?fm[1].replace(/\s+/g,' ').trim():null;
}

function tableHeaderMap($,table){
  const headers=$(table).find('thead th').toArray().map(th=>normalize($(th).text()));
  const map={};
  headers.forEach((h,i)=>{
    if(/resultado|tempo final|tempo obtido/.test(h))map.result=i;
    if(/inscricao|balizamento|tempo inscrito/.test(h))map.entry=i;
    if(/atleta|nome/.test(h))map.athlete=i;
    if(/raia/.test(h))map.lane=i;
  });
  return map;
}

function parseAthleteRowsFromResultPage(html,pageUrl,device,eventLabel=''){
  const $=cheerio.load(html);
  const athlete=device.athlete||{};
  const registration=normalize(athlete.registration||'');
  if(!athleteNameForms(athlete).length && !registration)return [];

  const pageStatus=eventStatusFromPage($,eventLabel);
  const eventTitle=selectedEventTitle($,eventLabel);
  const found=[];

  $('table').each((_,table)=>{
    const map=tableHeaderMap($,table);
    $(table).find('tbody tr, tr').each((__,tr)=>{
      const cells=$(tr).find('td').toArray().map(td=>$(td).text().replace(/\s+/g,' ').trim());
      if(!cells.length)return;
      const rowText=normalize(cells.join(' '));
      const matches=athleteTextMatches(cells.join(' '),athlete) || (registration && rowText.includes(registration));
      if(!matches)return;

      let resultRaw=null, entryTime=null, lane=null;

      if(Number.isInteger(map.result)) resultRaw=cells[map.result] ?? null;
      if(Number.isInteger(map.entry)) entryTime=cells[map.entry] ?? null;
      if(Number.isInteger(map.lane)) lane=cells[map.lane] ?? null;

      // Fallback only when the page is clearly a results table.
      if(resultRaw==null){
        const headers=$(table).find('th').toArray().map(th=>normalize($(th).text())).join(' ');
        if(/resultado|inscricao|balizamento/.test(headers) && cells.length>=3){
          resultRaw=cells[cells.length-1];
          entryTime=cells[cells.length-2]||entryTime;
        }
      }

      if(!validPublishedResult(resultRaw)){
        const part=participationStatus(cells.join(' ')+' '+String(resultRaw||''));
        if(!part)return;
        found.push({
          event:eventTitle,
          timeSeconds:null,
          time:null,
          entryTime:entryTime||null,
          lane:lane||null,
          status:part.status,
          resultCode:part.code,
          resultLabel:part.label,
          sourceUrl:pageUrl
        });
        return;
      }
      const sec=toSeconds(resultRaw);
      found.push({
        event:eventTitle,
        timeSeconds:sec,
        time:fmt(sec),
        entryTime:entryTime||null,
        lane:lane||null,
        status:pageStatus,
        sourceUrl:pageUrl
      });
    });
  });

  return found;
}

function discoverEventIdsFromHtml(html,base){
  const $=cheerio.load(html);
  const found=new Map();

  function addId(id,label=''){
    if(!id || !/^[A-Za-z0-9-]{8,}$/.test(id))return;
    const u=new URL(meetBase(base)+'/results');
    u.searchParams.set('e',id);
    const key=u.toString();
    if(!found.has(key) || (!found.get(key) && label))found.set(key,String(label||'').replace(/\s+/g,' ').trim());
  }

  $('a[href*="?e="],a[href*="&e="]').each((_,a)=>{
    const href=$(a).attr('href');
    if(!href)return;
    try{
      const u=new URL(href,base);
      let label=$(a).text().replace(/\s+/g,' ').trim();
      let cur=$(a);
      for(let depth=0;depth<5;depth++,cur=cur.parent()){
        const txt=cur.text().replace(/\s+/g,' ').trim();
        if(/(?:\d+x)?\d{2,4}\s*m?\s+(?:Livre|Costas|Peito|Borboleta|Medley)/i.test(txt)){
          label=txt;
          break;
        }
      }
      addId(u.searchParams.get('e'),label);
    }catch{}
  });

  const patterns=[
    /[?&]e=([A-Za-z0-9-]{8,})/g,
    /["']eventId["']\s*:\s*["']([A-Za-z0-9-]{8,})["']/g,
    /["']event_id["']\s*:\s*["']([A-Za-z0-9-]{8,})["']/g
  ];
  for(const rx of patterns){
    let m;
    while((m=rx.exec(html)))addId(m[1],'');
  }

  return [...found].map(([url,label])=>({url,label}));
}


function discoverExpectedEventPages(html,base,expected=[]){
  if(!html || !expected.length)return [];
  const $=cheerio.load(html);
  const out=new Map();
  const expectedClean=[...new Set(expected.map(cleanEventName).filter(Boolean))];

  function add(id,label){
    if(!id || !/^[A-Za-z0-9-]{8,}$/.test(id))return;
    const u=new URL(meetBase(base)+'/results');
    u.searchParams.set('e',id);
    const key=u.toString();
    const txt=String(label||'').replace(/\s+/g,' ').trim();
    if(!out.has(key) || txt.length>(out.get(key).label||'').length)out.set(key,{url:key,label:txt});
  }

  function idsFromNode(node){
    const ids=new Set();
    const $n=$(node);
    const attrs=node?.attribs||{};
    for(const v of Object.values(attrs)){
      const s=String(v||'');
      for(const m of s.matchAll(/[?&]e=([A-Za-z0-9-]{8,})/g))ids.add(m[1]);
      for(const m of s.matchAll(/\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/ig))ids.add(m[1]);
    }
    $n.find('*').each((_,el)=>{
      for(const v of Object.values(el.attribs||{})){
        const s=String(v||'');
        for(const m of s.matchAll(/[?&]e=([A-Za-z0-9-]{8,})/g))ids.add(m[1]);
        for(const m of s.matchAll(/\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/ig))ids.add(m[1]);
      }
    });
    return [...ids];
  }

  $('body *').each((_,el)=>{
    const own=$(el).clone().children().remove().end().text().replace(/\s+/g,' ').trim();
    const ownClean=cleanEventName(own);
    const matched=expectedClean.find(e=>ownClean===e || ownClean.includes(e) || e.includes(ownClean));
    if(!matched || !ownClean)return;

    let cur=$(el);
    for(let depth=0;depth<8 && cur.length;depth++,cur=cur.parent()){
      const txt=cur.text().replace(/\s+/g,' ').trim();
      const ct=cleanEventName(txt);
      if(!ct.includes(matched))continue;
      const ids=idsFromNode(cur[0]);
      if(ids.length){
        for(const id of ids)add(id,txt);
        break;
      }
    }
  });

  return [...out.values()];
}


function discoverAthleteEventPages(html,base,athlete={}){
  if(!html)return [];
  const $=cheerio.load(html);
  const registration=normalize(athlete.registration||'');
  const out=new Map();

  function add(id,label=''){
    if(!id || !/^[A-Za-z0-9-]{8,}$/.test(id))return;
    const u=new URL(meetBase(base)+'/results');
    u.searchParams.set('e',id);
    const key=u.toString();
    const txt=String(label||'').replace(/\s+/g,' ').trim();
    if(!out.has(key) || txt.length>(out.get(key).label||'').length)out.set(key,{url:key,label:txt});
  }

  $('body *').each((_,el)=>{
    const txt=$(el).text().replace(/\s+/g,' ').trim();
    const norm=normalize(txt);
    if(!(athleteTextMatches(txt,athlete) || (registration && norm.includes(registration))))return;

    let cur=$(el);
    for(let depth=0;depth<7 && cur.length;depth++,cur=cur.parent()){
      const block=cur[0];
      if(!block)continue;
      const label=cur.text().replace(/\s+/g,' ').trim();
      cur.find('a[href], [data-href], [data-url], [data-event-id], [data-eventid]').addBack().each((__,node)=>{
        for(const v of Object.values(node.attribs||{})){
          const s=String(v||'');
          for(const m of s.matchAll(/[?&]e=([A-Za-z0-9-]{8,})/g))add(m[1],label);
          for(const m of s.matchAll(/\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/ig))add(m[1],label);
        }
      });
      if(out.size)break;
    }
  });

  return [...out.values()];
}

async function recheckKnownResultUrls(state,device){
  const registration=String(device.athlete?.registration||'');
  const known=(state.pendingResults||[])
    .filter(x=>String(x.registration||'')===registration && x.sourceUrl)
    .map(x=>x.sourceUrl);
  const urls=[...new Set(known)];
  const refreshed=[];
  for(const url of urls){
    try{
      const html=await fetchText(url,8000);
      const rows=parseAthleteRowsFromResultPage(html,url,device,'');
      for(const r of rows)refreshed.push(r);
    }catch(e){}
  }
  return refreshed;
}

async function discoverResultEventPages(base,expected=[],athlete={}){
  const sources=[];
  const merged=new Map();

  async function scan(pathname){
    try{
      const html=await fetchText(base+pathname);
      const pages=discoverEventIdsFromHtml(html,base);
      const expectedPages=discoverExpectedEventPages(html,base,expected);
      sources.push({path:pathname,count:pages.length,expectedCount:expectedPages.length});
      for(const p of [...expectedPages,...pages]){
        if(!merged.has(p.url) || (!merged.get(p.url).label && p.label) || (p.label||'').length>(merged.get(p.url).label||'').length)merged.set(p.url,p);
      }
      return html;
    }catch(e){
      sources.push({path:pathname,count:0,error:e.message});
      return '';
    }
  }

  const resultsHtml=await scan('/results');
  const eventsHtml=await scan('/events');

  let athleteHtml='';
  try{
    athleteHtml=await fetchText(base+'/athletes',9000);
    const athletePages=discoverAthleteEventPages(athleteHtml,base,athlete);
    sources.push({path:'/athletes',count:athletePages.length,athleteSpecific:true});
    for(const p of athletePages){
      if(!merged.has(p.url) || (p.label||'').length>(merged.get(p.url).label||'').length)merged.set(p.url,p);
    }
  }catch(e){
    sources.push({path:'/athletes',count:0,error:e.message});
  }

  return {pages:[...merged.values()],sources,resultsHtml,eventsHtml,athleteHtml};
}

function expectedEventNames(device){
  const names=[];
  for(const meet of device.meets||[]){
    for(const e of meet.entries||[]){
      if(e.event)names.push(cleanEventName(e.event));
    }
  }
  return [...new Set(names.filter(Boolean))];
}

function likelyExpectedEvent(label,expected){
  if(!expected.length)return true;
  const raw=String(label||'');
  const m=raw.match(/((?:\d+x)?\d{2,4}\s*m?\s+(?:Livre|Costas|Peito|Borboleta|Medley))/i);
  const c=cleanEventName(m?m[1]:raw);
  if(!c)return false;
  return expected.some(e=>c===e||c.includes(e)||e.includes(c));
}

async function importSwimSystem(url,athlete){
  const base=meetBase(url);
  const meetHtml=await fetchText(base);
  const athleteHtml=await fetchText(base+'/athletes');
  const meet=extractMeet(meetHtml,base);
  const $=cheerio.load(athleteHtml);
  const block=findAthleteBlock($,athlete);
  if(block)meet.entries=extractEntriesFromBlock(block.text);
  return {meet,source:{id:meet.id+'-source',title:meet.name||'SwimSystem',url:base,kind:'official'}};
}

async function mapLimit(items,limit,worker){
  const out=new Array(items.length);
  let next=0;
  async function run(){
    while(true){
      const i=next++;
      if(i>=items.length)return;
      try{out[i]=await worker(items[i],i)}
      catch(e){out[i]=null}
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,items.length)},()=>run()));
  return out;
}


function strokeCodeName(code=''){
  return ({FREE:'Livre',BACK:'Costas',BREAST:'Peito',FLY:'Borboleta',MEDLEY:'Medley'})[String(code||'').toUpperCase()]||String(code||'');
}

function parseScheduleEventsFromAthletesHtml(html){
  if(!html)return [];
  // Next.js serializa os dados do servidor dentro do HTML usando aspas escapadas.
  const src=String(html);
  const rx=/\\?"id\\?":\\?"([0-9a-f-]{36})\\?",\\?"number\\?":(\d+),\\?"round\\?":\\?"([^"]+)\\?",\\?"gender\\?":\\?"([^"]+)\\?",\\?"swim\\?":\{\\?"distance\\?":(\d+),\\?"stroke\\?":\\?"([^"]+)\\?",\\?"relay_count\\?":(\d+)/ig;
  const out=[]; let m;
  while((m=rx.exec(src))){
    const x={id:m[1],number:Number(m[2]),round:m[3],gender:m[4],distance:Number(m[5]),stroke:m[6],relayCount:Number(m[7])};
    if(!out.some(y=>y.id===x.id))out.push(x);
  }
  return out;
}

function parseResultEventMeta(html){
  if(!html)return [];
  const src=String(html).replace(/\\\"/g,'"');
  const rx=/\{"id":"([0-9a-f-]{36})","number":(\d+),"sortcode":\d+,"gender":"([^"]+)","round":"([^"]+)","status":"([^"]+)","swim":\{"distance":(\d+),"stroke":"([^"]+)","relay_count":(\d+),"name":null\},"isRelay":(?:true|false),"classLabels":\[([^\]]*)\]/g;
  const out=[]; let m;
  while((m=rx.exec(src))){
    const labels=[...m[9].matchAll(/"([^"]+)"/g)].map(x=>x[1]);
    out.push({
      id:m[1],
      number:Number(m[2]),
      gender:m[3],
      round:m[4],
      status:m[5],
      distance:Number(m[6]),
      stroke:m[7],
      relayCount:Number(m[8]),
      classLabels:labels
    });
  }
  return out;
}

function parseEventCards(eventsHtml){
  if(!eventsHtml)return [];
  const $=cheerio.load(eventsHtml);
  const out=[];
  $('button').each((_,b)=>{
    const txt=$(b).text().replace(/\s+/g,' ').trim();
    const num=Number(txt.match(/^(\d+)\b/)?.[1]);
    const ev=txt.match(/((?:\d+x)?\d{2,4})m\s+(Livre|Costas|Peito|Borboleta|Medley)/i);
    if(!Number.isFinite(num)||!ev)return;
    out.push({
      number:num,
      event:cleanEventName(ev[1]+' '+ev[2]),
      text:txt,
      official:/\bOficial\b/i.test(txt) && !/Não Oficial/i.test(txt),
      partial:/Não Oficial|Parciais?/i.test(txt)
    });
  });
  return out;
}

function athleteCategoryFamily(device){
  const s=normalize(device?.athlete?.category||device?.settings?.category||'');
  if(s.includes('petiz'))return 'petiz';
  if(s.includes('mirim'))return 'mirim';
  if(s.includes('infantil'))return 'infantil';
  if(s.includes('juvenil'))return 'juvenil';
  if(s.includes('junior'))return 'junior';
  if(s.includes('senior'))return 'senior';
  return '';
}

function parseEmbeddedRowsForAthlete(html,device){
  if(!html)return [];
  const athlete=device?.athlete||{};
  if(!athleteNameForms(athlete).length)return [];
  const src=String(html).replace(/\\\"/g,'"');
  const rx=/\{"resultId":"([^"]+)","isRelay":(true|false),"name":"([^"]+)"[\s\S]{0,3500}?"recordLists":\[[^\]]*\]\}/g;
  const rows=[]; let m;
  while((m=rx.exec(src))){
    if(!athleteExactNameMatches(m[3],athlete))continue;
    const body=m[0];
    const val=re=>body.match(re)?.[1]??null;
    const num=re=>{const v=val(re);return v==null||v==='null'?null:Number(v)};
    rows.push({
      resultId:m[1],
      lane:num(/"lane":(null|\d+)/),
      entryTimeMs:num(/"entryTimeMs":(null|\d+)/),
      seedTimeMs:num(/"seedTimeMs":(null|\d+)/),
      resultTimeMs:num(/"resultTimeMs":(null|\d+)/),
      resultStatus:val(/"resultStatus":"([^"]+)"/),
      place:num(/"place":(null|\d+)/),
      performancePoints:num(/"performancePoints":(null|\d+)/)
    });
  }
  const seen=new Set();
  return rows.filter(r=>{
    const k=[r.resultId,r.resultTimeMs,r.lane].join('|');
    if(seen.has(k))return false;seen.add(k);return true;
  });
}

function expectedSeedMs(entry){
  const sec=toSeconds(entry?.seed||entry?.entryTime||'');
  return Number.isFinite(sec)?Math.round(sec*1000):null;
}

function pickEmbeddedRow(rows,entry){
  if(!rows.length)return null;
  const seed=expectedSeedMs(entry);
  const lane=Number(entry?.lane);
  const scored=rows
    .filter(r=>(Number.isFinite(r.resultTimeMs)&&r.resultTimeMs>0) || !!participationFromResultStatus(r.resultStatus))
    .map(r=>{
      let score=0;
      if(Number.isFinite(lane)&&r.lane===lane)score+=6;
      if(seed!=null && (r.entryTimeMs===seed || r.seedTimeMs===seed))score+=10;
      // Status de participação é tão válido quanto um tempo publicado.
      if(participationFromResultStatus(r.resultStatus))score+=1;
      return {r,score};
    })
    .sort((a,b)=>b.score-a.score);
  if(!scored.length)return null;
  if(scored[0].score===0 && scored.length>1)return null;
  return scored[0].r;
}

async function detectEmbeddedOfficialResults(base,device,meet,expected){
  // /results já contém, no payload Next.js, metadados de todas as provas
  // (incluindo status OFFICIAL) e todas as linhas de resultado.
  const resultsHtml=await fetchText(base+'/results',15000).catch(()=> '');
  if(!resultsHtml)return [];

  const eventMeta=parseResultEventMeta(resultsHtml);
  const allRows=parseEmbeddedRowsForAthlete(resultsHtml,device);
  const category=athleteCategoryFamily(device);
  const out=[];

  for(const entry of (meet?.entries||[])){
    if(entry?.date){
      const localNow=new Date();
      const when=entry.scheduled?new Date(`${entry.date}T${entry.scheduled}:00`):new Date(`${entry.date}T23:59:59`);
      if(!isNaN(when) && when.getTime()>localNow.getTime()+10*60000)continue;
    }

    const ekey=cleanEventName(entry.event||'');
    const m=ekey.match(/((?:\d+x)?\d{2,4})\s+(livre|costas|peito|borboleta|medley)/i);
    if(!m)continue;
    const distance=Number(m[1].replace(/^\d+x/i,''));
    const strokeMap={livre:'FREE',costas:'BACK',peito:'BREAST',borboleta:'FLY',medley:'MEDLEY'};
    const stroke=strokeMap[m[2].toLowerCase()];

    let candidates=eventMeta.filter(x=>x.gender==='M'&&x.distance===distance&&x.stroke===stroke&&x.relayCount===1);
    if(category){
      const byCategory=candidates.filter(x=>x.classLabels.some(label=>normalize(label).includes(category)));
      if(byCategory.length)candidates=byCategory;
    }
    const meta=candidates.find(x=>x.status==='OFFICIAL')||candidates[0]||null;

    const row=pickEmbeddedRow(allRows,entry);
    if(!row)continue;

    let sourceUrl=base+'/results';
    if(meta?.id){
      const u=new URL(meetBase(base)+'/results');
      u.searchParams.set('e',meta.id);
      sourceUrl=u.toString();
    }

    const rawStatus=String(meta?.status||'').toUpperCase();
    const status=rawStatus==='OFFICIAL'
      ?'official'
      :(/PARTIAL|PROVISION|UNOFFICIAL/.test(rawStatus)?'partial':'published');

    const participation=participationFromResultStatus(row.resultStatus);
    if(participation){
      out.push({
        event:entry.event,
        timeSeconds:null,
        time:null,
        entryTime:entry.seed||null,
        lane:row.lane||entry.lane||null,
        place:row.place,
        aqua:row.performancePoints,
        status:participation.status,
        resultCode:participation.code,
        resultLabel:participation.label,
        sourceUrl
      });
      continue;
    }

    const sec=row.resultTimeMs/1000;
    if(!Number.isFinite(sec)||sec<=0)continue;
    out.push({
      event:entry.event,
      timeSeconds:sec,
      time:fmt(sec),
      entryTime:entry.seed||null,
      lane:row.lane||entry.lane||null,
      place:row.place,
      aqua:row.performancePoints,
      status,
      sourceUrl
    });
  }
  return out;
}


function slugifyName(s=''){
  return normalize(s).replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim().replace(/ /g,'-');
}
function fdapEventName(raw=''){
  const s=normalize(raw)
    .replace(/\bmasc(?:ulino)?\.?\b|\bfem(?:inino)?\.?\b/g,' ')
    .replace(/\bmetros?\b/g,'m')
    .replace(/\s+/g,' ')
    .trim();
  const m=s.match(/\b((?:\d+x)?\d{2,4})\s*m?\s*(livre|costas|peito|borbol(?:eta)?|medley)\b/i);
  if(!m)return null;
  const stroke=/^borbol/i.test(m[2])?'Borboleta':
    m[2][0].toUpperCase()+m[2].slice(1).toLowerCase();
  return cleanEventName(m[1]+' '+stroke);
}
function parseDateLoose(s=''){
  const m=String(s).match(/\b(\d{2})[\/-](\d{2})[\/-](\d{4})\b/);
  if(m)return m[3]+'-'+m[2]+'-'+m[1];
  const iso=String(s).match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  return iso?.[1]||null;
}
function extractFdapRowsFromContainer($,root,sourceUrl,athlete){
  const out=[];
  const nodes=$(root).find('tr,li,.row,.item,.card,.marca,.resultado,[class*="marca"],[class*="result"]').addBack().toArray();
  for(const node of nodes){
    const txt=$(node).text().replace(/\s+/g,' ').trim();
    if(!txt)continue;
    const event=fdapEventName(txt);
    if(!event)continue;
    const timeMatches=[...txt.matchAll(/\b(?:\d{1,2}:\d{2}(?:[.,:]\d{1,2})?|\d{1,3}[.,]\d{2})\b/g)].map(x=>x[0]);
    const timeRaw=timeMatches.find(validPublishedResult);
    if(!timeRaw)continue;
    const sec=toSeconds(timeRaw);
    if(!Number.isFinite(sec))continue;
    const pm=txt.match(/\b(25|50)\s*m\b/i);
    const place=Number(txt.match(/\b(\d{1,2})\s*[º°]\b/)?.[1]||0)||null;
    const date=parseDateLoose(txt);
    out.push({
      event,timeSeconds:sec,time:fmt(sec),date,
      pool:Number(pm?.[1]||0)||null,
      place,status:'official',sourceUrl,
      registration:String(athlete.registration||''),
      athleteName:athlete.name||'',
      federationProfile:true
    });
  }
  return out;
}
function parseFederationProfileResults(html,sourceUrl,device){
  const $=cheerio.load(html);
  const athlete=device.athlete||{};
  const bodyText=$('body').text();
  if(!athleteTextMatches(bodyText,athlete))return [];
  const out=[];
  for(const r of extractFdapRowsFromContainer($,$('body'),sourceUrl,athlete))out.push(r);

  // Fallback para layouts visuais da FDAP sem tabela semântica.
  const text=$('body').text().replace(/\s+/g,' ').trim();
  const rx=/((?:\d+x)?\d{2,4}\s*m?\s*(?:livre|costas|peito|borbol(?:eta)?|medley)[^0-9]{0,80})(\d{1,2}:\d{2}(?:[.,:]\d{1,2})?|\d{1,3}[.,]\d{2})([\s\S]{0,100}?)(?=(?:\d+x)?\d{2,4}\s*m?\s*(?:livre|costas|peito|borbol(?:eta)?|medley)|$)/ig;
  let m;
  while((m=rx.exec(text))){
    const event=fdapEventName(m[1]); if(!event||!validPublishedResult(m[2]))continue;
    const sec=toSeconds(m[2]); if(!Number.isFinite(sec))continue;
    const tail=m[3]||'';
    const pm=tail.match(/\b(25|50)\s*m\b/i);
    const place=Number(tail.match(/\b(\d{1,2})\s*[º°]\b/)?.[1]||0)||null;
    const date=parseDateLoose(m[0]);
    out.push({event,timeSeconds:sec,time:fmt(sec),date,pool:Number(pm?.[1]||0)||null,place,status:'official',sourceUrl,registration:String(athlete.registration||''),athleteName:athlete.name||'',federationProfile:true});
  }
  const seen=new Set();
  return out.filter(r=>{const k=[r.date||'',cleanEventName(r.event),r.time,r.pool||''].join('|');if(seen.has(k))return false;seen.add(k);return true});
}
async function discoverFederationProfileUrls(base,athlete){
  const origin=new URL(base).origin;
  const urls=new Set();
  const registration=String(athlete.registration||'').trim();
  const primary=String(athlete.name||'').trim();
  const slug=slugifyName(primary);

  const baseUrl=String(base||'');
  if(baseUrl!==origin+'/' && baseUrl!==origin)urls.add(baseUrl);

  if(registration&&slug)urls.add(origin+'/atleta/natacao/'+registration+'/'+slug);
  if(slug)urls.add(origin+'/atletas-natacao/'+slug);
  if(slug)urls.add(origin+'/atleta/'+slug);

  // Uma única busca por domínio, somente como descoberta complementar.
  if(primary){
    try{
      const searchUrl=origin+'/?s='+encodeURIComponent(primary);
      const html=await fetchTextFederation(searchUrl,15000);
      const $=cheerio.load(html);
      $('a[href]').each((_,a)=>{
        const href=$(a).attr('href')||'';
        const label=$(a).text().replace(/\s+/g,' ').trim();
        let u; try{u=new URL(href,origin)}catch{return}
        if(u.origin!==origin)return;
        const pathText=u.pathname.replace(/[-_/]/g,' ');
        if(athleteTextMatches(label,athlete) || athleteTextMatches(pathText,athlete) || (registration&&u.pathname.includes(registration)))urls.add(u.toString());
      });
    }catch(_){}
  }
  return [...urls];
}
function federationLinkRelevant(url,origin,athlete,fromUrl=''){
  let u;
  try{u=new URL(url,origin)}catch{return false}
  if(u.origin!==origin)return false;
  const p=normalize(u.pathname+' '+u.search);
  if(/logout|login|wp-admin|admin|cadastro|contato|politica|termos/.test(p))return false;
  if(/\.(?:jpg|jpeg|png|gif|svg|css|js|woff2?|ico)(?:$|\?)/i.test(u.pathname))return false;
  const reg=normalize(athlete.registration||'');
  const athleteHit=(reg&&p.includes(reg)) || athleteNameForms(athlete).some(n=>canonicalPersonName(p).includes(n));
  const contextHit=/atleta|natacao|resultado|resultados|marca|marcas|historico|prova|provas|ranking|recorde|performance|tempo|tempos|pagina|page|offset|limit/.test(p);
  let sameProfile=false;
  try{
    const f=new URL(fromUrl||origin,origin);
    const a=f.pathname.split('/').filter(Boolean), b=u.pathname.split('/').filter(Boolean);
    sameProfile=a.length>=2&&b.length>=2&&a.slice(0,Math.min(3,a.length)).join('/')===b.slice(0,Math.min(3,b.length)).join('/');
  }catch(_){}
  return athleteHit || contextHit || sameProfile;
}
function discoverFederationLinks(html,currentUrl,athlete){
  const $=cheerio.load(html);
  const origin=new URL(currentUrl).origin;
  const out=new Set();
  $('a[href],form[action],[data-href],[data-url],[data-endpoint]').each((_,el)=>{
    const attrs=el.attribs||{};
    for(const k of ['href','action','data-href','data-url','data-endpoint']){
      const raw=attrs[k];
      if(!raw)return;
      let u;
      try{u=new URL(raw,currentUrl)}catch{return}
      if(federationLinkRelevant(u.toString(),origin,athlete,currentUrl))out.add(u.toString());
    }
  });
  // URLs embutidas em scripts/JSON da página (APIs, paginação e abas).
  $('script').each((_,s)=>{
    const txt=$(s).html()||'';
    for(const m of txt.matchAll(/https?:\\?\/\\?\/[^"'\s<>]+|\/[A-Za-z0-9_\-./?=&%]+/g)){
      const raw=String(m[0]||'').replace(/\\\//g,'/');
      let u;
      try{u=new URL(raw,currentUrl)}catch{continue}
      if(federationLinkRelevant(u.toString(),origin,athlete,currentUrl))out.add(u.toString());
    }
  });
  return [...out];
}
function parseFederationJsonResults(raw,sourceUrl,device){
  let data;
  try{data=typeof raw==='string'?JSON.parse(raw):raw}catch{return []}
  const athlete=device.athlete||{};
  const out=[];
  const seenObj=new Set();
  function visit(x,depth=0){
    if(x==null||depth>10)return;
    if(Array.isArray(x)){for(const v of x)visit(v,depth+1);return}
    if(typeof x!=='object')return;
    if(seenObj.has(x))return;seenObj.add(x);
    const entries=Object.entries(x);
    const flat=Object.fromEntries(entries.map(([k,v])=>[normalize(k),v]));
    const pick=(...keys)=>{
      for(const k of keys){
        const hit=Object.keys(flat).find(z=>z===k||z.includes(k));
        if(hit!=null&&flat[hit]!=null&&typeof flat[hit]!=='object')return flat[hit];
      }
      return null;
    };
    const rawEvent=pick('prova','evento','event','modalidade','estilo','stroke','descricao');
    const rawTime=pick('tempo','marca','resultado','resulttime','time','result_time');
    const reg=String(pick('registro','registration','idatleta','atleta_id')||'');
    const rawName=String(pick('atleta','nomeatleta','athlete','nome')||'');
    const identityOk=(!reg&&!rawName) || (reg&&String(athlete.registration||'')===reg) || (rawName&&athleteTextMatches(rawName,athlete));
    if(identityOk && rawEvent!=null && rawTime!=null){
      const event=fdapEventName(String(rawEvent));
      const sec=toSeconds(String(rawTime));
      if(event&&Number.isFinite(sec)&&sec>0){
        const poolRaw=String(pick('piscina','pool','metragem','poolmeters')||'');
        const pool=Number(poolRaw.match(/\b(25|50)\b/)?.[1]||0)||null;
        const date=parseDateLoose(String(pick('data','date','dataprova','competitiondate')||''));
        const place=Number(String(pick('colocacao','posicao','place','position')||'').match(/\d+/)?.[0]||0)||null;
        const meet=String(pick('competicao','campeonato','meet','evento_nome')||'').trim()||null;
        out.push({event,timeSeconds:sec,time:fmt(sec),date,pool,place,meet,status:'official',sourceUrl,registration:String(athlete.registration||''),athleteName:athlete.name||'',federationProfile:true});
      }
    }
    for(const [,v] of entries)visit(v,depth+1);
  }
  visit(data);
  return out;
}
async function crawlFederationProfile(startUrls,device,maxPages=120){
  const athlete=device.athlete||{};
  const queue=[...new Set(startUrls)];
  const visited=new Set(), out=[];
  while(queue.length&&visited.size<maxPages){
    const url=queue.shift();
    if(!url||visited.has(url))continue;
    visited.add(url);
    try{
      const raw=await fetchTextFederation(url,15000);
      const trim=String(raw||'').trim();
      if(trim.startsWith('{')||trim.startsWith('[')){
        for(const r of parseFederationJsonResults(trim,url,device))out.push(r);
        continue;
      }
      const $=cheerio.load(raw);
      const text=$('body').text();
      const identity=athleteTextMatches(text,athlete)||normalize(text).includes(normalize(athlete.registration||''));
      if(identity || visited.size===1){
        for(const r of parseFederationProfileResults(raw,url,device))out.push(r);
        for(const s of $('script').toArray()){
          const txt=$(s).html()||'';
          const trimmed=txt.trim();
          if(trimmed.startsWith('{')||trimmed.startsWith('[')){
            for(const r of parseFederationJsonResults(trimmed,url,device))out.push(r);
          }
        }
        for(const link of discoverFederationLinks(raw,url,athlete)){
          if(!visited.has(link)&&queue.length<maxPages*3)queue.push(link);
        }
      }
    }catch(_){}
  }
  return {results:out,pagesScanned:visited.size};
}

async function buildFdapDiagnostic(profile){
  const state=await loadState();
  const {representative}=autonomousRepresentative(state,profile);
  const athlete=representative.athlete||{};
  const bases=(representative.resultSources||[]).filter(u=>/fdap\.org\.br|fgda\.org\.br/i.test(String(u)));
  const startUrls=new Set();
  for(const base of bases){
    try{for(const u of await discoverFederationProfileUrls(base,athlete))startUrls.add(u)}catch(_){}
  }

  const queue=[...startUrls], visited=new Set(), pages=[];
  const apiHints=new Set(), paginationHints=new Set(), profileHints=new Set();

  while(queue.length && visited.size<40){
    const url=queue.shift();
    if(!url || visited.has(url))continue;
    visited.add(url);
    try{
      const raw=await fetchTextFederation(url,15000);
      const trim=String(raw||'').trim();
      const page={url,kind:(trim.startsWith('{')||trim.startsWith('['))?'json':'html',bytes:raw.length,identity:false,resultLike:false,links:0,apiHints:[]};

      if(page.kind==='json'){
        page.identity=athleteTextMatches(raw,athlete)||normalize(raw).includes(normalize(athlete.registration||''));
        page.resultLike=/tempo|marca|resultado|prova|evento|result|time/i.test(raw);
        pages.push(page);
        continue;
      }

      const $=cheerio.load(raw);
      const body=$('body').text().replace(/\s+/g,' ').trim();
      page.identity=athleteTextMatches(body,athlete)||normalize(body).includes(normalize(athlete.registration||''));
      page.resultLike=/tempo|marca|resultado|prova|evento|recorde/i.test(body);

      const foundLinks=[];
      $('a[href],form[action],[data-url],[data-endpoint],[data-href],script[src]').each((_,el)=>{
        const attrs=el.attribs||{};
        for(const key of ['href','action','data-url','data-endpoint','data-href','src']){
          const rawUrl=attrs[key]; if(!rawUrl)continue;
          let u; try{u=new URL(rawUrl,url)}catch{continue}
          foundLinks.push(u.toString());
          const s=normalize(u.pathname+' '+u.search);
          if(/api|ajax|resultado|result|marca|historico|history|atleta|athlete|ranking|prova|evento/.test(s))apiHints.add(u.toString());
          if(/page|pagina|offset|limit|start|cursor|p=|paged/.test(s))paginationHints.add(u.toString());
          if(/atleta|athlete|perfil|profile/.test(s))profileHints.add(u.toString());
        }
      });
      page.links=foundLinks.length;

      for(const s of $('script').toArray()){
        const txt=$(s).html()||'';
        for(const m of txt.matchAll(/(?:fetch|axios\.(?:get|post)|url|endpoint)\s*\(?\s*["'`]([^"'`]+)["'`]/gi)){
          let u; try{u=new URL(m[1],url)}catch{continue}
          apiHints.add(u.toString());
        }
      }

      page.apiHints=[...apiHints].slice(-20);
      pages.push(page);

      if(page.identity || visited.size===1){
        for(const link of discoverFederationLinks(raw,url,athlete)){
          if(!visited.has(link) && queue.length<120)queue.push(link);
        }
      }
    }catch(e){
      pages.push({url,error:e?.message||String(e)});
    }
  }

  const crawl=await crawlFederationProfile([...startUrls],representative,140).catch(()=>({results:[],pagesScanned:0}));
  return {
    ok:true,
    version:'V39-DIAG-SLOW',
    registration:profile.registration,
    startUrls:[...startUrls],
    pagesScanned:visited.size,
    parsedResults:Array.isArray(crawl.results)?crawl.results.length:0,
    crawlerPagesScanned:Number(crawl.pagesScanned||0),
    apiHints:[...apiHints].slice(0,120),
    paginationHints:[...paginationHints].slice(0,80),
    profileHints:[...profileHints].slice(0,80),
    pages
  };
}

async function detectFederationResults(device){
  const athlete=device.athlete||{};
  const bases=(device.resultSources||[]).filter(u=>/fdap\.org\.br|fgda\.org\.br/i.test(String(u)));
  if(!bases.length)return [];
  const urls=new Set();
  for(const base of bases){
    try{for(const u of await discoverFederationProfileUrls(base,athlete))urls.add(u)}catch(_){}
  }
  const crawled=await crawlFederationProfile([...urls],device,140);
  const seen=new Set();
  const results=crawled.results.filter(r=>{
    const k=[r.date||'',cleanEventName(r.event),r.time,r.pool||'',r.meet||''].join('|');
    if(seen.has(k))return false;seen.add(k);return true;
  });
  results._pagesScanned=crawled.pagesScanned;
  return results;
}

async function discoverAthleteExpectedEvents(base,athlete){
  try{
    const html=await fetchText(meetBase(base)+'/athletes',12000);
    const $=cheerio.load(html);
    const names=athleteNameForms(athlete);
    let bestText='';

    $('body *').each((_,el)=>{
      const own=$(el).clone().children().remove().end().text().replace(/\s+/g,' ').trim();
      if(!own)return;
      const ownNorm=canonicalPersonName(own);
      if(!names.some(n=>ownNorm===n))return;

      let cur=$(el);
      for(let depth=0;depth<8&&cur.length;depth++,cur=cur.parent()){
        const txt=cur.text().replace(/\s+/g,' ').trim();
        const matches=[...txt.matchAll(/\b((?:\d+x)?\d{2,4})\s*m?\s*(Livre|Costas|Peito|Borboleta|Medley)\b/gi)];
        if(matches.length){
          if(!bestText || txt.length<bestText.length)bestText=txt;
          break;
        }
      }
    });

    // Fallback: janela de texto a partir do nome até o próximo bloco de atleta.
    if(!bestText){
      const body=$('body').text().replace(/\s+/g,' ').trim();
      for(const raw of [athlete.name,...(athlete.aliases||[])].filter(Boolean)){
        const pos=normalize(body).indexOf(normalize(raw));
        if(pos>=0){bestText=body.slice(pos,pos+1800);break;}
      }
    }

    const out=[];
    const seen=new Set();
    for(const m of bestText.matchAll(/\b((?:\d+x)?\d{2,4})\s*m?\s*(Livre|Costas|Peito|Borboleta|Medley)\b/gi)){
      const ev=cleanEventName(m[1]+' '+m[2]);
      if(ev&&!seen.has(ev)){seen.add(ev);out.push(ev);}
    }
    return out;
  }catch(e){
    console.warn('athlete event discovery',e?.message||e);
    return [];
  }
}

async function detectResults(device,state=null){
  const base=meetBase(device.swimSystemMeetUrl||device.meets?.find(m=>m.sourceUrl)?.sourceUrl||'');
  if(!base)return [];

  const athlete=device.athlete||{};
  const registration=String(athlete.registration||'');
  const meet=device.meets?.find(m=>meetBase(m.sourceUrl||'')===base) || device.meets?.[0] || null;
  let expected=expectedEventNames(device);
  if(!expected.length)expected=await discoverAthleteExpectedEvents(base,athlete);
  const results=[];

  // Caminho principal e rápido: dados estruturados embutidos pelo próprio SwimSystem.
  const embedded=await detectEmbeddedOfficialResults(base,device,meet,expected);
  for(const x of embedded)results.push(x);

  // V28: a descoberta legada é complementar ao payload estruturado.
  // Isso evita perder provas quando o SwimSystem não expõe tudo no bloco embutido.
  {
    if(state){
      const refreshed=await recheckKnownResultUrls(state,device);
      for(const x of refreshed)results.push(x);
    }

    const discovery=await discoverResultEventPages(base,expected,athlete);
    if(discovery.resultsHtml){
      for(const x of parseAthleteRowsFromResultPage(discovery.resultsHtml,base+'/results',device,''))results.push(x);
    }

    let pages=discovery.pages;
    const filtered=pages.filter(p=>likelyExpectedEvent(p.label,expected));
    if(filtered.length)pages=filtered;
    else if(expected.length){
      const explicit=discoverExpectedEventPages(discovery.resultsHtml||'',base,expected);
      if(explicit.length)pages=explicit;
      else pages=pages.slice(0,Math.min(36,pages.length));
    }

    // Sem lista de provas, varre todas as páginas descobertas do meet para não perder DNS.
    const scanPages=expected.length?pages.slice(0,36):pages.slice(0,96);
    const pageResults=await mapLimit(scanPages,12,async p=>{
      const html=await fetchText(p.url,6000);
      const norm=normalize(html);
      if(athleteNameForms(athlete).length && !athleteTextMatches(html,athlete))return [];
      const rows=parseAthleteRowsFromResultPage(html,p.url,device,p.label);
      for(const x of rows){
        if(x.status==='published'){
          if(/Parciais?\s*\(Não Oficial\)|Não Oficial/i.test(p.label||''))x.status='partial';
          else if(/\bOficial\b/i.test(p.label||''))x.status='official';
        }
      }
      return rows;
    });
    for(const rows of pageResults){
      if(Array.isArray(rows))for(const x of rows)results.push(x);
    }
  }

  const seen=new Set();
  return results.filter(r=>{
    const key=[
      registration,
      r.date||'',
      cleanEventName(r.event||''),
      r.time||r.resultCode||r.status||'',
      r.sourceUrl||''
    ].join('|');
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  }).map(r=>{
    const eventKey=cleanEventName(r.event||'');
    const entry=(meet?.entries||[]).find(e=>cleanEventName(e.event||'')===eventKey)
      || (meet?.entries||[]).find(e=>{
        const k=cleanEventName(e.event||'');
        return k&&eventKey&&(k.includes(eventKey)||eventKey.includes(k));
      })
      || null;
    return {
      ...r,
      registration,
      athleteName:athlete.name||'',
      meet:meet?.name||null,
      meetId:meet?.id||null,
      date:entry?.date||meet?.dateStart||null,
      scheduled:entry?.scheduled||null,
      series:entry?.series??null,
      lane:r.lane||entry?.lane||null,
      seed:entry?.seed||r.entryTime||null,
      pool:meet?.pool||meet?.poolMeters||null,
      poolMeters:meet?.poolMeters||meet?.pool||null,
      venue:meet?.venue||null,
      city:meet?.city||null,
      publishedAt:new Date().toISOString()
    };
  });
}

function parseDateTime(date,time,tz){
  if(!date||!time)return null;
  // Events supplied by VINISWIM use local wall time. Current deployment target is Brazil.
  // JS Date on the server should run with TZ=America/Sao_Paulo for exact scheduling.
  const d=new Date(`${date}T${time}:00`);
  return isNaN(d)?null:d;
}

async function sendPush(device,payload){
  if(!VAPID_PUBLIC_KEY||!VAPID_PRIVATE_KEY)return false;
  try{
    await webpush.sendNotification(device.subscription,JSON.stringify(payload),{TTL:300});
    return true;
  }catch(e){
    if(e.statusCode===404||e.statusCode===410)device.disabled=true;
    console.error('push',e.statusCode||'',e.message);
    return false;
  }
}

async function checkAlerts(state,device,now){
  const defs=[
    ['m120',120,'2h'],['m60',60,'1h'],['m30',30,'30min'],
    ['m20',20,'20min'],['m10',10,'10min'],['m5',5,'5min']
  ];
  for(const meet of device.meets||[]){
    for(const entry of meet.entries||[]){
      const dt=parseDateTime(entry.date,entry.scheduled,device.timezone);
      if(!dt)continue;
      for(const [key,min,label] of defs){
        if(device.alerts?.[key]===false)continue;
        const target=dt.getTime()-min*60000;
        const id=[device.id,meet.id||meet.name,entry.event,entry.date,entry.scheduled,key].join('|');
        if(state.sent[id])continue;
        if(now>=target&&now<target+5*60000){
          const ok=await sendPush(device,{
            title:`VINISWIM — ${entry.event} em ${label}`,
            body:`${meet.name||'Próxima prova'} · prevista para ${entry.scheduled}`,
            tag:'pre-'+id,
            data:{url:(device.appUrl||'./')+'#alerts'}
          });
          if(ok)state.sent[id]=new Date().toISOString();
        }
      }
    }
  }
}

function canonicalResultKey(r={}){
  return [
    String(r.registration||''),
    String(r.date||''),
    cleanEventName(r.event||''),
    String(r.time||r.resultCode||r.status||fmt(Number(r.timeSeconds))||'')
  ].join('|');
}

function normalizeKnownResultKeyString(v=''){
  const parts=String(v||'').split('|');
  if(parts.length<4)return String(v||'').trim();
  const registration=String(parts[0]||'');
  const date=String(parts[1]||'');
  const event=cleanEventName(parts[2]||'');
  const time=String(parts.slice(3).join('|')||'').trim();
  return [registration,date,event,time].join('|');
}

function deviceKnowsResult(device,r){
  const key=canonicalResultKey(r);
  return Array.isArray(device?.knownResults) &&
    device.knownResults.some(x=>normalizeKnownResultKeyString(x)===key);
}

async function applyDetectedResults(state,devices,found,{notify=true}={}){
  const pushed=[];
  state.resultNotified=state.resultNotified||{};

  for(const r of found){
    const rid=[r.registration,r.meetId||r.meet||'',r.event||'',r.time||r.resultCode||r.status||''].join('|');
    const canonicalKey=canonicalResultKey(r);
    let existing=state.pendingResults.find(x=>x._rid===rid)
      || state.pendingResults.find(x=>
        String(x.registration||'')===String(r.registration||'') &&
        cleanEventName(x.event||'')===cleanEventName(r.event||'') &&
        String(x.time||'')===String(r.time||'')
      )
      || state.pendingResults.find(x=>
        String(x.registration||'')===String(r.registration||'') &&
        cleanEventName(x.event||'')===cleanEventName(r.event||'') &&
        String(x.date||'')===String(r.date||'') &&
        String(x.meetId||x.meet||'')===String(r.meetId||r.meet||'') &&
        (x.status!=='official' || r.status==='official')
      );

    if(!existing){
      existing={...r,_rid:rid};
      state.pendingResults.push(existing);
    }else{
      Object.assign(existing,r,{_rid:existing._rid||rid});
    }

    // Regra: um resultado gera uma única notificação.
    // A chave não depende mais de "partial/official", portanto a oficialização
    // posterior não dispara uma segunda mensagem do mesmo tempo/prova.
    const notifyKey=['result-once',canonicalKey].join('|');
    if(state.resultNotified[notifyKey])continue;

    let delivered=false;
    if(notify) for(const device of devices){
      if(device.alerts?.resultPublished===false)continue;
      // Se o próprio VINISWIM já informou que esse resultado está salvo,
      // nunca envia notificação novamente, mesmo após restart/deploy do monitor.
      if(deviceKnowsResult(device,r))continue;
      const partial=r.status==='partial';
      const participation=['dns','dsq','dnf'].includes(r.status);
      const ok=await sendPush(device,{
        title:participation
          ?'VINISWIM — situação da prova'
          :(r.status==='official'?'VINISWIM — resultado oficial':`VINISWIM — resultado publicado${partial?' (parcial)':''}`),
        body:participation
          ?`${r.event||'Prova'}: ${r.resultCode||r.status.toUpperCase()} · ${r.resultLabel||''}`.trim()
          :`${r.event||'Prova'}: ${r.time}${partial?' · ainda não oficializado':''}`,
        // tag estável: o sistema operacional substitui uma eventual cópia,
        // em vez de empilhar notificações iguais.
        tag:'result-'+canonicalKey,
        data:{url:(device.appUrl||'./')+'#history'}
      });
      if(ok){
        delivered=true;
        pushed.push({deviceId:device.id,result:existing});
      }
    }

    if(delivered){
      state.resultNotified[notifyKey]=new Date().toISOString();

      // Compatibilidade: marca também as chaves antigas para que versões
      // anteriores do monitor não possam reenviar este mesmo resultado.
      for(const device of devices){
        state.sent[['result',device.id,rid,'published'].join('|')]=state.resultNotified[notifyKey];
        state.sent[['result',device.id,rid,'official'].join('|')]=state.resultNotified[notifyKey];
      }
    }
  }
  return pushed;
}

async function checkOfficialResults(state,device){
  if(device.alerts?.resultPublished===false)return [];
  const found=await detectResults(device,state);
  return await applyDetectedResults(state,[device],found);
}


function autonomousRepresentative(state,profile){
  const devices=state.devices.filter(x=>!x.disabled && String(x.athlete?.registration||'')===profile.registration);
  const base=devices[0]?structuredClone(devices[0]):{
    id:'autonomous-'+profile.registration,
    alerts:{resultPublished:false,personalBest:false},
    meets:[],
    swimSystemMeetUrl:'',
    timezone:'America/Sao_Paulo',
    appUrl:'',
    knownResults:[],
    disabled:false,
    transient:true
  };
  base.athlete={
    ...(base.athlete||{}),
    name:profile.name,
    aliases:[...new Set([...(base.athlete?.aliases||[]),...(profile.aliases||[])])],
    registration:profile.registration,
    category:profile.category
  };
  if(profile.swimSystemMeetUrl)base.swimSystemMeetUrl=profile.swimSystemMeetUrl;
  base.resultSources=[...new Set([
    ...(base.resultSources||[]),
    profile.swimSystemMeetUrl||'',
    'https://fdap.org.br/',
    'https://fgda.org.br/'
  ].filter(Boolean))];
  return {representative:base,devices};
}

async function runAutonomousAthleteScan(state,profile){
  const {representative,devices}=autonomousRepresentative(state,profile);
  const liveDetected=await detectResultsAcrossSources(representative,state).catch(()=>[]);
  const federationDetected=await detectFederationResults(representative).catch(()=>[]);
  const detected=[...liveDetected,...federationDetected];

  // Consolida todo o histórico sem gerar uma enxurrada de push.
  await applyDetectedResults(state,devices,detected,{notify:false});

  // Para resultados de hoje, mantém o fluxo normal de notificação.
  const today=new Date().toISOString().slice(0,10);
  const current=detected.filter(r=>String(r.date||'')===today);
  if(current.length && devices.length){
    await applyDetectedResults(state,devices,current,{notify:true});
  }

  state.autonomousScanAt=state.autonomousScanAt||{};
  state.autonomousStats=state.autonomousStats||{};
  state.autonomousScanAt[profile.registration]=new Date().toISOString();
  const stats={
    name:profile.name,
    detected:detected.length,
    swimSystem:liveDetected.length,
    federation:federationDetected.length,
    federationPagesScanned:Number(federationDetected._pagesScanned||0),
    pending:state.pendingResults.filter(x=>String(x.registration||'')===profile.registration).length,
    updatedAt:new Date().toISOString()
  };
  state.autonomousStats[profile.registration]=stats;
  return {detected,stats};
}


let checking=false;
async function monitor(){
  if(checking)return;
  checking=true;
  try{
    const state=await loadState();
    const now=Date.now();
    const active=state.devices.filter(x=>!x.disabled);

    for(const device of active)await checkAlerts(state,device,now);

    const groups=new Map();
    for(const device of active){
      const reg=String(device.athlete?.registration||'');
      const base=meetBase(device.swimSystemMeetUrl||device.meets?.find(m=>m.sourceUrl)?.sourceUrl||'');
      if(!reg||!base)continue;
      const key=reg+'|'+base;
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(device);
    }

    for(const devices of groups.values()){
      const representative=devices[0];
      const found=await detectResults(representative,state);
      await applyDetectedResults(state,devices,found,{notify:true});
    }

    // V34: varredura independente do botão/app.
    // Roda imediatamente após deploy e depois a cada 15 minutos por atleta.
    for(const profile of AUTONOMOUS_ATHLETES){
      const last=Date.parse(state.autonomousScanAt?.[profile.registration]||0)||0;
      if(!last || (now-last)>=AUTONOMOUS_SCAN_INTERVAL_MS){
        try{await runAutonomousAthleteScan(state,profile)}
        catch(e){console.error('autonomous scan',profile.registration,e)}
      }
    }

    state.devices=state.devices.filter(x=>!x.disabled);
    await saveState(state);
  }catch(e){console.error('monitor',e)}
  finally{checking=false}
}

app.get('/health',(req,res)=>res.json({ok:true,version:'V40',features:{fdapCrawler:true,fdapPagination:true,fdapJsonApi:true,jsonpTransport:true,autonomousAthletes:true,refreshOnDemand:true,asyncRefresh:true},time:new Date().toISOString()}));


app.get('/refresh-athlete',async(req,res)=>{
  const registration=String(req.query.registration||'');
  const profile=AUTONOMOUS_ATHLETES.find(a=>a.registration===registration);
  if(!profile)return jsonOrJsonp(req,res,{ok:false,error:'atleta não configurado'},404);

  const existing=resultScanJobs.get(registration);
  if(!existing?.running){
    const job={running:true,startedAt:new Date().toISOString(),finishedAt:null,error:null,detected:0,detectedSwimSystem:0,detectedFederation:0,federationPagesScanned:0,lastVersion:'V40'};
    resultScanJobs.set(registration,job);

    (async()=>{
      try{
        const state=await loadState();
        const result=await runAutonomousAthleteScan(state,profile);
        await saveState(state);
        job.detected=Number(result?.stats?.detected||0);
        job.detectedSwimSystem=Number(result?.stats?.swimSystem||0);
        job.detectedFederation=Number(result?.stats?.federation||0);
        job.federationPagesScanned=Number(result?.stats?.federationPagesScanned||0);
      }catch(e){
        job.error=e?.message||String(e);
        console.error('refresh athlete',registration,e);
      }finally{
        job.running=false;
        job.finishedAt=new Date().toISOString();
      }
    })();
  }

  const state=await loadState();
  const pending=state.pendingResults.filter(x=>String(x.registration||'')===registration);
  jsonOrJsonp(req,res,{
    ok:true,
    version:'V40',
    registration,
    started:!existing?.running,
    running:true,
    results:pending
  });
});

async function writeFdapDiagnosticsOnce(){
  for(const registration of ['399680','393259']){
    const profile=AUTONOMOUS_ATHLETES.find(a=>a.registration===registration);
    if(!profile)continue;
    try{
      const out=await buildFdapDiagnostic(profile);
      await ensureDir();
      await fs.writeFile(path.join(DATA_DIR,'fdap-diagnostic-'+registration+'.json'),JSON.stringify(out,null,2),'utf8');
    }catch(e){
      try{
        await ensureDir();
        await fs.writeFile(path.join(DATA_DIR,'fdap-diagnostic-'+registration+'.json'),JSON.stringify({ok:false,registration,error:e?.message||String(e),at:new Date().toISOString()},null,2),'utf8');
      }catch(_){}
    }
  }
}
setTimeout(()=>writeFdapDiagnosticsOnce().catch(()=>{}),8000);

app.get('/fdap-diagnostic',async(req,res)=>{
  const registration=String(req.query.registration||'');
  const profile=AUTONOMOUS_ATHLETES.find(a=>a.registration===registration);
  if(!profile)return res.status(404).json({ok:false,error:'atleta não configurado'});
  try{
    const out=await buildFdapDiagnostic(profile);
    res.json(out);
  }catch(e){
    res.status(500).json({ok:false,error:e?.message||String(e)});
  }
});

app.get('/athletes-summary',async(req,res)=>{
  const state=await loadState();
  const athletes=AUTONOMOUS_ATHLETES.map(a=>({
    registration:a.registration,
    name:a.name,
    ...(state.autonomousStats?.[a.registration]||{
      detected:0,swimSystem:0,federation:0,federationPagesScanned:0,
      pending:state.pendingResults.filter(x=>String(x.registration||'')===a.registration).length,
      updatedAt:null
    })
  }));
  res.json({ok:true,version:'V40',athletes});
});

app.get('/status',async(req,res)=>{
  if(!adminOk(req))return res.status(401).json({error:'unauthorized'});
  const registration=String(req.query.registration||'');
  const state=await loadState();
  const devices=state.devices.filter(x=>!registration||String(x.athlete?.registration||'')===registration);
  res.json({
    ok:true,
    version:'V40',
    devices:devices.length,
    registrations:devices.map(x=>String(x.athlete?.registration||'')),
    pendingResults:state.pendingResults.filter(x=>!registration||String(x.registration||'')===registration).length,
    autonomousStats:registration
      ? (state.autonomousStats?.[registration]||null)
      : (state.autonomousStats||{})
  });
});


app.get('/debug-meet-base',async(req,res)=>{
  if(!adminOk(req))return res.status(401).json({error:'unauthorized'});
  const registration=String(req.query.registration||'');
  const state=await loadState();
  const device=state.devices.find(x=>!x.disabled && String(x.athlete?.registration||'')===registration);
  if(!device)return res.status(404).json({error:'device not found'});
  const raw=device.swimSystemMeetUrl||device.meets?.find(m=>m.sourceUrl)?.sourceUrl||'';
  res.json({
    ok:true,
    version:'V40',
    raw,
    meetBase:meetBase(raw)
  });
});

app.get('/scan-event-now',async(req,res)=>{
  if(!adminOk(req))return res.status(401).json({error:'unauthorized'});
  const registration=String(req.query.registration||'');
  const eventId=String(req.query.e||'');
  if(!/^[A-Za-z0-9-]{8,}$/.test(eventId))return res.status(400).json({error:'event id inválido'});

  const state=await loadState();
  const device=state.devices.find(x=>!x.disabled && String(x.athlete?.registration||'')===registration);
  if(!device)return res.status(404).json({error:'device not found'});

  const base=meetBase(device.swimSystemMeetUrl||device.meets?.find(m=>m.sourceUrl)?.sourceUrl||'');
  const u=new URL(meetBase(base)+'/results');
  u.searchParams.set('e',eventId);

  let html;
  try{html=await fetchText(u.toString())}
  catch(e){return res.status(502).json({error:e.message,url:u.toString()})}

  const rows=parseAthleteRowsFromResultPage(html,u.toString(),device,'');
  res.json({ok:true,version:'V40',url:u.toString(),athleteFound:normalize(html).includes(normalize(device.athlete?.name||'')),rows});
});

app.get('/scan-results-now',async(req,res)=>{
  if(!adminOk(req))return res.status(401).json({error:'unauthorized'});
  const registration=String(req.query.registration||'');
  const state=await loadState();
  const devices=state.devices.filter(x=>!x.disabled && (!registration||String(x.athlete?.registration||'')===registration));
  const scans=[];

  for(const device of devices){
    let discovery={pages:[],sources:[]};
    try{
      const base=meetBase(device.swimSystemMeetUrl||device.meets?.find(m=>m.sourceUrl)?.sourceUrl||'');
      if(base)discovery=await discoverResultEventPages(base);
    }catch{}

    const found=await detectResults(device,state);
    const pushed=await checkOfficialResults(state,device);
    scans.push({
      registration:String(device.athlete?.registration||''),
      discoverySources:discovery.sources||[],
      discoveredPages:(discovery.pages||[]).length,
      matchingPages:(discovery.pages||[]).slice(0,30).map(p=>({label:p.label,url:p.url})),
      found:found.map(x=>({event:x.event,time:x.time,entryTime:x.entryTime,lane:x.lane,status:x.status,sourceUrl:x.sourceUrl})),
      newPushes:pushed.map(x=>({event:x.event,time:x.time,status:x.status}))
    });
  }

  await saveState(state);
  res.json({ok:true,devices:devices.length,version:'V40',scans});
});

app.get('/schedule-test-alert',async(req,res)=>{
  if(!adminOk(req))return res.status(401).json({error:'unauthorized'});
  const registration=String(req.query.registration||'');
  const minutes=Math.max(1,Math.min(120,Number(req.query.minutes||5)));
  const state=await loadState();
  const devices=state.devices.filter(x=>!x.disabled && String(x.athlete?.registration||'')===registration);
  const knownResults=Array.isArray(req.body?.knownResults)?[...new Set(req.body.knownResults.map(normalizeKnownResultKeyString))]:[];
  if(knownResults.length){
    for(const d of devices)d.knownResults=knownResults;
    // Reidrata também o ledger global com o que já está salvo no app.
    state.resultNotified=state.resultNotified||{};
    for(const key of knownResults)state.resultNotified['result-once|'+key]=state.resultNotified['result-once|'+key]||new Date().toISOString();
    await saveState(state);
  }
  if(!devices.length)return res.status(404).json({error:'device not found'});

  const now=new Date();
  const target=new Date(now.getTime()+minutes*60000);
  const pad=n=>String(n).padStart(2,'0');
  const date=`${target.getFullYear()}-${pad(target.getMonth()+1)}-${pad(target.getDate())}`;
  const scheduled=`${pad(target.getHours())}:${pad(target.getMinutes())}`;
  const testId='test-'+Date.now();

  for(const device of devices){
    device.meets=device.meets||[];
    device.meets.push({
      id:testId,
      name:'TESTE VINISWIM',
      dateStart:date,
      dateEnd:date,
      entries:[{
        event:'Teste de alerta',
        date,
        scheduled
      }]
    });
    device.alerts=device.alerts||{};
    device.alerts.m5=true;
  }
  await saveState(state);
  res.json({
    ok:true,
    devices:devices.length,
    scheduledFor:`${date} ${scheduled}`,
    expectedAlertAt:`${date} ${pad(now.getHours())}:${pad(now.getMinutes())}`,
    note:'O alerta de 5 minutos será processado pelo monitor.'
  });
});

app.get('/clear-test-alerts',async(req,res)=>{
  if(!adminOk(req))return res.status(401).json({error:'unauthorized'});
  const registration=String(req.query.registration||'');
  const state=await loadState();
  let removed=0;
  for(const device of state.devices){
    if(registration && String(device.athlete?.registration||'')!==registration)continue;
    const before=(device.meets||[]).length;
    device.meets=(device.meets||[]).filter(m=>m.name!=='TESTE VINISWIM');
    removed+=before-device.meets.length;
  }
  await saveState(state);
  res.json({ok:true,removed});
});

app.get('/test-push',async(req,res)=>{
  if(!adminOk(req))return res.status(401).json({error:'unauthorized'});
  const registration=String(req.query.registration||'');
  const state=await loadState();
  const devices=state.devices.filter(x=>!x.disabled && (!registration||String(x.athlete?.registration||'')===registration));
  let sent=0,failed=0;
  for(const device of devices){
    const ok=await sendPush(device,{
      title:'VINISWIM — teste do servidor',
      body:'Push enviado pelo VINISWIM Monitor.',
      tag:'viniswim-server-test-'+Date.now(),
      data:{url:(device.appUrl||'./')+'#alerts'}
    });
    ok?sent++:failed++;
  }
  await saveState(state);
  res.json({ok:true,devices:devices.length,sent,failed});
});


function collectSwimSystemBases(device={}){
  const urls=[];
  if(device.swimSystemMeetUrl)urls.push(device.swimSystemMeetUrl);
  for(const m of device.meets||[])if(m?.sourceUrl)urls.push(m.sourceUrl);
  for(const s of device.resultSources||[])if(s)urls.push(s);
  for(const r of device.knownSourceUrls||[])if(r)urls.push(r);
  const out=[];
  const seen=new Set();
  for(const u of urls){
    if(!/swimsystem\.app\/meets\/sw\/|swimsystem\.swimtimebrasil\.com\//i.test(String(u)))continue;
    const b=meetBase(String(u).replace(/\/ResultList_[^/]+\.pdf.*$/i,'').replace(/\/ProgressionDetails\.pdf.*$/i,''));
    if(b&&!seen.has(b)){seen.add(b);out.push(b)}
  }
  return out;
}
async function detectResultsAcrossSources(device,state=null){
  const bases=collectSwimSystemBases(device);
  if(!bases.length)return await detectResults(device,state);
  const out=[];
  for(const base of bases){
    const clone=structuredClone(device);
    clone.swimSystemMeetUrl=base;
    const match=(clone.meets||[]).find(m=>meetBase(m.sourceUrl||'')===meetBase(base));
    if(match)clone.meets=[match];
    try{
      const found=await detectResults(clone,state);
      for(const r of found)out.push(r);
    }catch(e){console.warn('historical source scan',base,e?.message||e)}
  }
  const seen=new Set();
  return out.filter(r=>{
    const k=[r.date||'',cleanEventName(r.event||''),r.time||'',r.sourceUrl||''].join('|');
    if(seen.has(k))return false;seen.add(k);return true;
  });
}

const resultScanJobs=new Map();

async function runResultScanForRegistration(registration,fallbackDevice=null){
  registration=String(registration||'');
  if(!registration)return {ok:false,error:'registration obrigatória'};
  if(resultScanJobs.get(registration)?.running)return {ok:true,alreadyRunning:true};

  const job={running:true,startedAt:new Date().toISOString(),finishedAt:null,error:null,detected:0};
  resultScanJobs.set(registration,job);

  try{
    const state=await loadState();
    let devices=state.devices.filter(x=>!x.disabled && String(x.athlete?.registration||'')===registration);
    if(!devices.length && fallbackDevice)devices=[fallbackDevice];
    if(!devices.length)throw new Error('contexto do atleta indisponível');

    const representative=devices[0];
    const liveDetected=await detectResultsAcrossSources(representative,state);
    const federationDetected=await detectFederationResults(representative);
    const detected=[...liveDetected,...federationDetected];
    job.detected=detected.length;
    job.detectedSwimSystem=liveDetected.length;
    job.detectedFederation=federationDetected.length;
    job.federationPagesScanned=Number(federationDetected._pagesScanned||0);
    job.lastVersion='V39';

    await applyDetectedResults(state,devices,detected);
    await saveState(state);
    job.finishedAt=new Date().toISOString();
    job.running=false;
    return {ok:true,detected:detected.length};
  }catch(e){
    job.error=e?.message||String(e);
    job.finishedAt=new Date().toISOString();
    job.running=false;
    console.error('result scan',registration,e);
    return {ok:false,error:job.error};
  }
}

app.get('/config',(req,res)=>jsonOrJsonp(req,res,{publicKey:VAPID_PUBLIC_KEY,version:'V40'}));

app.post('/subscribe',async(req,res)=>{
  const b=req.body||{};
  if(!b.subscription?.endpoint)return res.status(400).json({error:'subscription obrigatória'});
  const state=await loadState();
  const endpoint=b.subscription.endpoint;
  const existing=state.devices.find(x=>x.subscription?.endpoint===endpoint);
  const device={
    id:existing?.id||crypto.randomUUID(),
    subscription:b.subscription,
    athlete:b.athlete||{},
    alerts:b.alerts||{},
    meets:b.meets||[],
    swimSystemMeetUrl:b.swimSystemMeetUrl||'',
    resultSources:Array.isArray(b.resultSources)?b.resultSources:existing?.resultSources||[],
    timezone:b.timezone||'America/Sao_Paulo',
    appUrl:b.appUrl||'',
    knownResults:Array.isArray(b.knownResults)?[...new Set(b.knownResults.map(normalizeKnownResultKeyString))]:existing?.knownResults||[],
    updatedAt:new Date().toISOString()
  };
  if(existing)Object.assign(existing,device); else state.devices.push(device);

  // V40: confirma a inscrição no próprio aparelho. Isso valida de ponta a ponta
  // permissão do iOS + service worker + subscription Apple + VAPID do servidor.
  // Não repete em cada abertura do app.
  let pushConfirmed=false;
  if(!existing?.pushConfirmedAt){
    pushConfirmed=await sendPush(device,{
      title:'VINISWIM — notificações ativas',
      body:(device.athlete?.name||'Atleta')+' · aparelho registrado para receber alertas.',
      tag:'viniswim-push-confirmed',
      data:{url:(device.appUrl||'./')+'#alerts'}
    });
    if(pushConfirmed)device.pushConfirmedAt=new Date().toISOString();
  }

  await saveState(state);
  res.json({ok:true,deviceId:device.id,pushConfirmed});
});

app.get('/subscribe-simple',async(req,res)=>{
  const endpoint=String(req.query.endpoint||'');
  const p256dh=String(req.query.p256dh||'');
  const auth=String(req.query.auth||'');
  const registration=String(req.query.registration||'');
  if(!endpoint||!p256dh||!auth||!registration){
    return jsonOrJsonp(req,res,{ok:false,error:'endpoint, chaves e registration são obrigatórios'},400);
  }
  const state=await loadState();
  const appUrl=String(req.query.appUrl||'');
  const existing=state.devices.find(x=>x.subscription?.endpoint===endpoint) ||
    state.devices.find(x=>String(x.athlete?.registration||'')===registration && (!appUrl || String(x.appUrl||'')===appUrl));
  const aliases=String(req.query.aliases||'').split('|').map(x=>x.trim()).filter(Boolean);
  const resultSources=[
    'https://fdap.org.br/',
    'https://fgda.org.br/',
    ...String(req.query.resultSources||'').split('|').map(x=>x.trim()).filter(Boolean)
  ];
  const device={
    id:existing?.id||crypto.randomUUID(),
    subscription:{endpoint,keys:{p256dh,auth}},
    athlete:{
      ...(existing?.athlete||{}),
      name:String(req.query.name||existing?.athlete?.name||''),
      aliases:aliases.length?aliases:(existing?.athlete?.aliases||[]),
      registration,
      category:String(req.query.category||existing?.athlete?.category||'')
    },
    alerts:existing?.alerts||{m120:true,m60:true,m30:true,m20:true,m10:true,m5:true,resultPublished:true,personalBest:true},
    meets:existing?.meets||[],
    swimSystemMeetUrl:String(req.query.swimSystemMeetUrl||existing?.swimSystemMeetUrl||''),
    resultSources:[...new Set([...(existing?.resultSources||[]),...resultSources])],
    timezone:String(req.query.timezone||existing?.timezone||'America/Sao_Paulo'),
    appUrl,
    knownResults:existing?.knownResults||[],
    updatedAt:new Date().toISOString()
  };
  if(existing)Object.assign(existing,device); else state.devices.push(device);

  let pushConfirmed=false;
  if(!existing?.pushConfirmedAt){
    pushConfirmed=await sendPush(device,{
      title:'VINISWIM — notificações ativas',
      body:(device.athlete?.name||'Atleta')+' · aparelho registrado para receber alertas.',
      tag:'viniswim-push-confirmed',
      data:{url:(device.appUrl||'./')+'#alerts'}
    });
    if(pushConfirmed)device.pushConfirmedAt=new Date().toISOString();
  }

  await saveState(state);
  jsonOrJsonp(req,res,{ok:true,version:'V40',deviceId:device.id,pushConfirmed});
});

app.post('/sync-results',async(req,res)=>{
  const registration=String(req.body?.registration||'');
  if(!registration)return res.status(400).json({error:'registration obrigatória'});

  const state=await loadState();
  const devices=state.devices.filter(x=>!x.disabled && String(x.athlete?.registration||'')===registration);

  const incomingAthlete=req.body?.athlete||{};
  const incomingSources=Array.isArray(req.body?.resultSources)?req.body.resultSources.filter(Boolean):[];
  const incomingKnown=Array.isArray(req.body?.knownSourceUrls)?req.body.knownSourceUrls.filter(Boolean):[];
  const mergedSources=[...new Set([...incomingSources,...incomingKnown])];

  // V31: o clique em "Atualizar" precisa atualizar o contexto salvo do aparelho.
  // Antes disso, aparelhos antigos continuavam varrendo com resultSources obsoletos,
  // então o crawler FDAP nunca recebia as novas fontes.
  for(const d of devices){
    d.athlete={
      ...(d.athlete||{}),
      name:String(incomingAthlete.name||d.athlete?.name||''),
      aliases:Array.isArray(incomingAthlete.aliases)?incomingAthlete.aliases:(d.athlete?.aliases||[]),
      registration,
      category:String(incomingAthlete.category||d.athlete?.category||'')
    };
    if(Array.isArray(req.body?.meets)&&req.body.meets.length)d.meets=req.body.meets;
    if(req.body?.swimSystemMeetUrl)d.swimSystemMeetUrl=String(req.body.swimSystemMeetUrl);
    d.resultSources=[...new Set([...(d.resultSources||[]),...mergedSources])];
    if(req.body?.timezone)d.timezone=String(req.body.timezone);
    if(req.body?.appUrl)d.appUrl=String(req.body.appUrl);
    d.updatedAt=new Date().toISOString();
  }
  if(devices.length)await saveState(state);

  let fallbackDevice=null;
  if(!devices.length && (req.body?.swimSystemMeetUrl || mergedSources.length)){
    fallbackDevice={
      id:'transient-'+registration,
      athlete:{
        name:String(incomingAthlete.name||''),
        aliases:Array.isArray(incomingAthlete.aliases)?incomingAthlete.aliases:[],
        registration,
        category:String(incomingAthlete.category||'')
      },
      alerts:{resultPublished:false,personalBest:false},
      meets:Array.isArray(req.body?.meets)?req.body.meets:[],
      swimSystemMeetUrl:String(req.body?.swimSystemMeetUrl||''),
      resultSources:mergedSources,
      timezone:String(req.body?.timezone||'America/Sao_Paulo'),
      appUrl:String(req.body?.appUrl||''),
      knownResults:[],
      disabled:false,
      transient:true
    };
  }
  if(!devices.length && !fallbackDevice){
    return res.status(400).json({error:'contexto do atleta/fonte não enviado'});
  }

  const existing=resultScanJobs.get(registration);
  if(!existing?.running){
    runResultScanForRegistration(registration,fallbackDevice).catch(e=>console.error('async result scan',e));
  }

  const pending=state.pendingResults.filter(x=>String(x.registration)===registration);
  res.json({
    ok:true,
    version:'V40',
    started:!existing?.running,
    running:true,
    devices:devices.length,
    transient:!devices.length,
    results:pending
  });
});


app.get('/sync-results-simple',async(req,res)=>{
  const registration=String(req.query.registration||'');
  if(!registration)return jsonOrJsonp(req,res,{ok:false,error:'registration obrigatória'},400);
  const state=await loadState();
  const devices=state.devices.filter(x=>!x.disabled && String(x.athlete?.registration||'')===registration);

  const incomingSources=[
    'https://fdap.org.br/',
    'https://fgda.org.br/',
    ...String(req.query.resultSources||'').split('|').map(x=>x.trim()).filter(Boolean)
  ];
  const incomingAliases=String(req.query.aliases||'').split('|').map(x=>x.trim()).filter(Boolean);

  for(const d of devices){
    d.athlete={
      ...(d.athlete||{}),
      name:String(req.query.name||d.athlete?.name||''),
      aliases:incomingAliases.length?incomingAliases:(d.athlete?.aliases||[]),
      registration,
      category:String(req.query.category||d.athlete?.category||'')
    };
    if(req.query.swimSystemMeetUrl)d.swimSystemMeetUrl=String(req.query.swimSystemMeetUrl);
    d.resultSources=[...new Set([...(d.resultSources||[]),...incomingSources])];
    if(req.query.appUrl)d.appUrl=String(req.query.appUrl);
    d.updatedAt=new Date().toISOString();
  }
  if(devices.length)await saveState(state);

  let fallbackDevice=null;
  if(!devices.length){
    fallbackDevice={
      id:'transient-'+registration,
      athlete:{
        name:String(req.query.name||''),
        aliases:incomingAliases,
        registration,
        category:String(req.query.category||'')
      },
      alerts:{resultPublished:false,personalBest:false},
      meets:[],
      swimSystemMeetUrl:String(req.query.swimSystemMeetUrl||''),
      resultSources:[...new Set(incomingSources)],
      timezone:'America/Sao_Paulo',
      appUrl:String(req.query.appUrl||''),
      knownResults:[],
      disabled:false,
      transient:true
    };
  }
  const existing=resultScanJobs.get(registration);
  if(!existing?.running){
    runResultScanForRegistration(registration,fallbackDevice).catch(e=>console.error('async simple result scan',e));
  }
  const pending=state.pendingResults.filter(x=>String(x.registration)===registration);
  jsonOrJsonp(req,res,{ok:true,version:'V40',started:!existing?.running,running:true,devices:devices.length,transient:!devices.length,results:pending});
});

app.get('/sync-status',async(req,res)=>{
  const registration=String(req.query.registration||'');
  const job=resultScanJobs.get(registration)||null;
  const state=await loadState();
  const results=state.pendingResults.filter(x=>String(x.registration)===registration);
  jsonOrJsonp(req,res,{
    ok:true,
    version:'V40',
    running:!!job?.running,
    startedAt:job?.startedAt||null,
    finishedAt:job?.finishedAt||null,
    error:job?.error||null,
    detected:job?.detected||0,
    detectedSwimSystem:job?.detectedSwimSystem||0,
    detectedFederation:job?.detectedFederation||0,
    federationPagesScanned:job?.federationPagesScanned||0,
    results
  });
});

app.get('/pending-results',async(req,res)=>{
  const registration=String(req.query.registration||'');
  const state=await loadState();
  const results=state.pendingResults.filter(x=>String(x.registration)===registration);
  jsonOrJsonp(req,res,{results});
});

app.post('/pending-results/ack',async(req,res)=>{
  const registration=String(req.body?.registration||'');
  const rids=Array.isArray(req.body?.rids)?req.body.rids.map(String):[];
  if(!registration||!rids.length)return res.status(400).json({error:'registration e rids são obrigatórios'});
  const state=await loadState();
  const before=state.pendingResults.length;
  state.resultNotified=state.resultNotified||{};
  for(const x of state.pendingResults){
    if(String(x.registration)===registration && rids.includes(String(x._rid||''))){
      state.resultNotified['result-once|'+canonicalResultKey(x)]=new Date().toISOString();
    }
  }
  state.pendingResults=state.pendingResults.filter(x=>!(String(x.registration)===registration && rids.includes(String(x._rid||''))));
  await saveState(state);
  res.json({ok:true,removed:before-state.pendingResults.length});
});

app.get('/pending-results/ack-simple',async(req,res)=>{
  const registration=String(req.query.registration||'');
  const rids=String(req.query.rids||'').split('|').map(String).filter(Boolean);
  if(!registration||!rids.length)return jsonOrJsonp(req,res,{ok:false,error:'registration e rids são obrigatórios'},400);
  const state=await loadState();
  const before=state.pendingResults.length;
  state.resultNotified=state.resultNotified||{};
  for(const x of state.pendingResults){
    if(String(x.registration)===registration && rids.includes(String(x._rid||''))){
      state.resultNotified['result-once|'+canonicalResultKey(x)]=new Date().toISOString();
    }
  }
  state.pendingResults=state.pendingResults.filter(x=>!(String(x.registration)===registration && rids.includes(String(x._rid||''))));
  await saveState(state);
  jsonOrJsonp(req,res,{ok:true,version:'V40',removed:before-state.pendingResults.length});
});

app.post('/swimsystem/import',async(req,res)=>{
  const {url,registration,name}=req.body||{};
  if(!/^https:\/\/(www\.)?swimsystem\.app\/meets\/sw\//i.test(String(url||'')))return res.status(400).json({error:'URL inválida'});
  try{
    const result=await importSwimSystem(url,{registration:String(registration||''),name:String(name||'')});
    res.json(result);
  }catch(e){
    console.error('import',e);
    res.status(502).json({error:e.message});
  }
});

await ensureDir();
app.listen(PORT,()=>{
  console.log(`VINISWIM monitor na porta ${PORT}`);
  monitor();
  setInterval(monitor,INTERVAL).unref();
});