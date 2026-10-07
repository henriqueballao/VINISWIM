import {parseTime} from "./normalize.mjs";
function iso(d,m,y){const yy=y.length===2?String(2000+Number(y)):y;return yy+"-"+m.padStart(2,"0")+"-"+d.padStart(2,"0")}
const ROW_MARKER=/(?:\d{1,3}\.|N\/C|DQL|DQ|DNS|DNF|DSQ)\s*(?:F\d+\s*)?\d{1,2}\s*\/\s*\d{1,2}/gi;
function athleteRow(flat,id,pos){
 const before=flat.slice(0,pos),markers=[...before.matchAll(ROW_MARKER)];
 const prev=markers.at(-1);if(!prev)return null;
 const start=prev.index??0,afterId=pos+id.length,tail=flat.slice(afterId);
 ROW_MARKER.lastIndex=0;const next=ROW_MARKER.exec(tail);
 const end=next?afterId+(next.index??0):Math.min(flat.length,afterId+240);
 return {text:flat.slice(start,end).trim(),prefix:prev[0],after:flat.slice(afterId,end).trim()};
}
function rowStatus(prefix){
 if(/^N\/C|^DQL|^DQ\b|^DSQ/i.test(prefix))return "dsq";
 if(/^DNS/i.test(prefix))return "dns";
 if(/^DNF/i.test(prefix))return "dnf";
 return null;
}
function officialTime(after){
 const payload=String(after||"").replace(/^\s*\d{4}/,"").trim();
 const patterns=[
  /(?:^|\s)(\d{1,2}:\d{2}\.\d{2}|\d{1,3}\.\d{2})(?=\s+\d{2,3}%\s+(?:\d{1,2}[.,]\d{2}|-)\s+\d{1,4}(?:\s|$))/,
  /(?:^|\s)(\d{1,2}:\d{2}\.\d{2}|\d{1,3}\.\d{2})(?=\s+-\s+\d{1,4}(?:\s|$))/,
  /(?:^|\s)(\d{1,2}:\d{2}\.\d{2}|\d{1,3}\.\d{2})(?=\s+\d{1,2},\d{2}\s+\d{1,4}(?:\s|$))/
 ];
 for(const rx of patterns){const m=payload.match(rx);if(m){const ms=parseTime(m[1]);if(ms!=null&&ms>5000&&ms<1800000)return ms}}
 return null;
}
export function parseResultList({text,identity,meet,sourceUrl,retrievedAt}){
 const body=String(text||"").replace(/\r/g,""),h=body.match(/Prova\s*\d+\s*(?:Feminino|Masculino),\s*(\d{1,4})m\s*(Livre|Costas|Peito|Borboleta|Medley)[\s\S]{0,160}?(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?:\s*-\s*\d{1,2}:\d{2})?\s*Resultados/i);if(!h)return [];
 const id=String(identity.externalId||"").trim();if(!id)return [];const flat=body.replace(/\s+/g," ").trim();let from=0,out=[];
 while(from<flat.length){
  const pos=flat.indexOf(id,from);if(pos<0)break;from=pos+id.length;
  const left=pos?flat[pos-1]:" ";if(/\d/.test(left))continue;
  const right=flat[pos+id.length]||" ";if(!/\s|\d/.test(right))continue;
  const row=athleteRow(flat,id,pos);if(!row)continue;
  const status=rowStatus(row.prefix),timeMs=status?null:officialTime(row.after);
  if(timeMs==null&&!status)continue;
  out.push({sourceCode:meet.sourceCode,externalMeetId:meet.externalMeetId,event:h[1]+" "+h[2],resultDate:iso(h[3],h[4],h[5]),course:meet.course,timeMs,status:status||"valid",sourceUrl,sourceBlock:row.text.slice(0,220),parserVersion:"resultlist-v2.4",retrievedAt,athleteExternalId:id})
 }
 return out;
}
