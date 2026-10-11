import {parseMeetEvidence} from './swimsystem-current.mjs';
import {parseTime} from './normalize.mjs';

export function scheduledInstant(date,time,timeZone){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{1,2}:\d{2}$/.test(time))throw new RangeError('invalid schedule');
 const [hour,minute]=time.split(':').map(Number);
 if(hour>23||minute>59)throw new RangeError('invalid schedule');
 const [year,month,day]=date.split('-').map(Number),local=Date.UTC(year,month-1,day,hour,minute);
 if(new Date(local).toISOString().slice(0,10)!==date)throw new RangeError('invalid schedule date');
 const formatter=new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const observed=instant=>{
  const p=Object.fromEntries(formatter.formatToParts(new Date(instant)).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
  return Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute);
 };
 // Probe both sides of possible clock transitions. Never choose arbitrarily
 // between repeated local times or normalize a nonexistent local time.
 const offsets=new Set();for(let hours=-36;hours<=36;hours+=6){const probe=local+hours*3600000;offsets.add(observed(probe)-probe);}
 const candidates=[...offsets].map(offset=>local-offset).filter(instant=>observed(instant)===local);
 if(candidates.length!==1)throw new RangeError(candidates.length?'ambiguous schedule timezone':'nonexistent schedule timezone');
 return new Date(candidates[0]).toISOString();
}

// Parse only explicit Balizamento sections. Registration, date, heat, lane and
// seed are read from the athlete's own row; a result publication is never a seed.
export function parseSeededStartlist({text,identity,sourceUrl,retrievedAt,rawHash,timeZone='America/Sao_Paulo'}){
 const id=String(identity?.externalId||'').trim();if(!/^\d+$/.test(id))return [];
 const body=String(text||'').replace(/\r/g,''),meet=parseMeetEvidence(body);if(!meet.accepted)return [];
 const headers=[...body.matchAll(/^\s*Prova\s+(\d+)\s*[-—]\s*Final\s+Direta\s+(Masculino|Feminino),\s*(\d{1,4})m\s+(Livre|Costas|Peito|Borboleta|Medley)[^\n]*\n\s*(\d{2})\/(\d{2})\/(\d{4})[^\n]*\bBalizamento\b/gmi)],entries=[];
 for(let k=0;k<headers.length;k++){
  const header=headers[k],date=`${header[7]}-${header[6]}-${header[5]}`;
  if(!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date<meet.meet.startDate||date>meet.meet.endDate)continue;
  const block=body.slice(header.index+header[0].length,k+1<headers.length?headers[k+1].index:undefined);
  let heat=null,time=null;
  for(const line of block.split('\n')){
   const series=line.match(/^\s*Série\s+(\d+)\s+de\s+\d+\s+(\d{1,2}:\d{2})\s*$/i);
   if(series){heat=Number(series[1]);time=series[2];continue;}
   // Continuation pages explicitly repeat the heat and time. A new unseeded
   // section ends this block even if its header does not match Balizamento.
   if(/^\s*(?:Prova|…Prova)\s+\d+/.test(line)){heat=null;time=null;}
   const row=line.match(/^\s*(\d{1,2})\s+(.+?)\s+(\d{4,8})\s+((?:19|20)\d{2})\s+.*?\s+(?:LT\s*)?(NT|\d{1,2}:\d{2}\.\d{2}|\d{1,3}\.\d{2})\s*$/);
   if(!row||row[3]!==id||heat===null||time===null)continue;
   const lane=Number(row[1]);if(lane>9||heat<1)continue;
   const scheduledAt=scheduledInstant(date,time,timeZone);
   entries.push({kind:'seeded_entry',athleteExternalId:id,externalEventId:header[1],round:'Final Direta',sex:header[2].toLowerCase(),event:`${header[3]} ${header[4]}`,eventDate:date,course:meet.meet.course,seedTimeMs:row[5]==='NT'?null:parseTime(row[5]),heat,lane,scheduledAt,sourceUrl,retrievedAt,rawHash,parserVersion:'swimsystem-seeded-v1',sourceBlock:`${header[0].trim()}\nSérie ${heat} ${time}\n${line.trim()}`});
  }
 }
 const unique=new Map();for(const entry of entries)unique.set(JSON.stringify([entry.athleteExternalId,entry.externalEventId,entry.round,entry.sex,entry.eventDate,entry.heat,entry.lane,entry.scheduledAt,entry.seedTimeMs]),entry);
 return [...unique.values()];
}
