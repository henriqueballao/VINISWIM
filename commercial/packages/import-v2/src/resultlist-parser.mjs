import {parseTime} from "./normalize.mjs";
function iso(d,m,y){return y+"-"+m.padStart(2,"0")+"-"+d.padStart(2,"0")}
export function parseResultList({text,identity,meet,sourceUrl,retrievedAt}){
 const body=String(text||"").replace(/\r/g,""),h=body.match(/Prova\s*\d+\s*(?:Feminino|Masculino),\s*(\d{1,4})m\s+(Livre|Costas|Peito|Borboleta|Medley)[^\n]*\n(\d{1,2})\/(\d{1,2})\/(\d{4})\s*-\s*\d{1,2}:\d{2}\s*Resultados/i);
 if(!h)return [];
 const id=String(identity.externalId||"").trim();if(!id)return [];
 const flat=body.replace(/\s+/g," ").trim(),needle=id;let from=0,out=[];
 while(from<flat.length){const p=flat.indexOf(needle,from);if(p<0)break;from=p+needle.length;const l=p?flat[p-1]:" ",r=flat[p+needle.length]||" ";if(/\d/.test(l)||/\d/.test(r))continue;const after=flat.slice(p+needle.length,p+needle.length+180);const next=after.search(/\s(?:\d{1,3}\.|N\/C|DQL|DQ|DNS|DNF|DSQ)\s*\d{1,2}\s*\/\s*\d{1,2}/i);const row=(next>=0?after.slice(0,next):after).trim();let status=null;if(/^(?:N\/C|DQL|DQ|DSQ)\b/i.test(row))status="dsq";else if(/^DNS\b/i.test(row))status="dns";else if(/^DNF\b/i.test(row))status="dnf";const tm=status?null:row.match(/(\d{1,2}:\d{2}\.\d{2}|\d{1,3}\.\d{2})/);const timeMs=tm?parseTime(tm[1]):null;if(timeMs==null&&!status)continue;out.push({sourceCode:meet.sourceCode,externalMeetId:meet.externalMeetId,event:h[1]+" "+h[2],resultDate:iso(h[3],h[4],h[5]),course:meet.course,timeMs,status:status||"valid",sourceUrl,sourceBlock:row.slice(0,180),parserVersion:"resultlist-v2.1",retrievedAt,athleteExternalId:id})}
 return out;
}
