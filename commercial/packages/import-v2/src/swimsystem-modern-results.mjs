import {parseTime} from "./normalize.mjs";
import {parseMeetEvidence} from "./swimsystem-current.mjs";

const ROW_MARKER=/(?:\d{1,3}\.|DNS|DNF|DSQ|DQL|DQ|N\/C|WDR|EXH)\s+\d{1,2}\s*\/\s*\d{1,2}/gi;
function iso(d,m,y){return y+"-"+String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0")}
function statusFromPrefix(v){
 const s=String(v||"").toUpperCase();
 if(/^DNS|^WDR/.test(s))return "dns";
 if(/^DNF/.test(s))return "dnf";
 if(/^DSQ|^DQL|^DQ\b|^N\/C/.test(s))return "dsq";
 if(/^EXH/.test(s))return null;
 return "valid";
}
function athleteRow(flat,id,pos){
 const before=flat.slice(0,pos),markers=[...before.matchAll(ROW_MARKER)],prev=markers.at(-1);
 if(!prev)return null;
 const afterId=pos+id.length,tail=flat.slice(afterId);
 ROW_MARKER.lastIndex=0;const next=ROW_MARKER.exec(tail);
 const end=next?afterId+(next.index??0):Math.min(flat.length,afterId+260);
 return {prefix:prev[0],text:flat.slice(prev.index??0,end).trim(),after:flat.slice(afterId,end).trim()};
}
function firstOfficialTime(after){
 const payload=String(after||"").replace(/^\s*\d{4}\s+/,"").trim();
 const m=payload.match(/(?:^|\s)(\d{1,2}:\d{2}\.\d{2}|\d{1,3}\.\d{2})(?=\s)/);
 return m?parseTime(m[1]):null;
}
export function parseModernResultBook({text,identity,meet,sourceUrl,retrievedAt}){
 const raw=String(text||"").replace(/\r/g,"");
 const ev=parseMeetEvidence(raw);
 if(!ev.accepted)return [];
 const id=String(identity?.externalId||"").trim();if(!id)return [];
 const flat=raw.replace(/\s+/g," ").trim();
 const eventRe=/Prova\s+\d+\s*(?:-|—)\s*(?:Final\s+Direta\s+)?(?:Feminino|Masculino),\s*(\d{1,4})m\s+(Livre|Costas|Peito|Borboleta|Medley)[\s\S]{0,160}?(\d{1,2})\/(\d{1,2})\/(\d{4})\s+Resultados/gi;
 const starts=[...flat.matchAll(eventRe)],out=[];
 for(let k=0;k<starts.length;k++){
   const h=starts[k],start=(h.index??0)+h[0].length,end=k+1<starts.length?(starts[k+1].index??flat.length):flat.length;
   const block=flat.slice(start,end),needle=" "+id+" ",pos=(" "+block+" ").indexOf(needle);
   if(pos<0)continue;
   const absolutePos=start+Math.max(0,pos-1);
   const row=athleteRow(flat,id,absolutePos);if(!row)continue;
   const status=statusFromPrefix(row.prefix);if(status===null)continue;
   const timeMs=status==="valid"?firstOfficialTime(row.after):null;
   if(status==="valid"&&timeMs==null)continue;
   out.push({
     sourceCode:meet.sourceCode,externalMeetId:meet.externalMeetId,event:h[1]+" "+h[2],
     resultDate:iso(h[3],h[4],h[5]),course:ev.meet.course,timeMs,status,
     sourceUrl,sourceBlock:row.text.slice(0,240),parserVersion:"swimsystem-modern-results-v1",
     retrievedAt,athleteExternalId:id,meetStartDate:ev.meet.startDate,meetEndDate:ev.meet.endDate
   });
 }
 return out;
}
