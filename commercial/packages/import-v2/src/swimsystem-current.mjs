import {normalizeText,parseTime} from "./normalize.mjs";
function iso(d,m,y){return y+"-"+String(m).padStart(2,"0")+"-"+String(d).padStart(2,"0")}
export function parseMeetEvidence(text){
 const raw=String(text||"").replace(/\s+/g," ").trim();
 const h=raw.match(/\b([^,]{2,80})\s*\(([A-Z]{2})\),\s*(\d{1,2})(?:\s*-\s*(\d{1,2}))?\/(\d{1,2})\/(\d{4}),\s*(SCM|LCM)\s*\((25|50)m\)/i);
 if(!h)return {accepted:false,errors:["missing:canonical_meet_header"]};
 return {accepted:true,meet:{city:h[1].trim(),startDate:iso(h[3],h[5],h[6]),endDate:iso(h[4]||h[3],h[5],h[6]),course:h[7].toUpperCase()}};
}
export function parseStartlist(text,identity){
 const id=String(identity.externalId||"").trim();if(!id)return [];
 const body=String(text||"").replace(/\r/g,""),eventRe=/Prova\s+\d+\s*-\s*(?:Final\s+Direta|Eliminat[oó]ria)[^,\n]*,\s*(\d{1,4})m\s+(Livre|Costas|Peito|Borboleta|Medley)[^\n]*/gi;
 const starts=[...body.matchAll(eventRe)],out=[];
 for(let k=0;k<starts.length;k++){const h=starts[k],block=body.slice(h.index+h[0].length,k+1<starts.length?starts[k+1].index:undefined).replace(/\s+/g," ").trim();const pos=(" "+block+" ").indexOf(" "+id+" ");if(pos<0)continue;const after=block.slice(Math.max(0,pos-1)+id.length);const next=after.search(/\s\d{1,3}\s+[A-ZÀ-Ÿ][A-Za-zÀ-ÿ .'-]{2,80}\s+\d{4,8}\s+(?:19|20)\d{2}\s/);const row=(next>=0?after.slice(0,next):after.slice(0,180)).trim();const tokens=row.match(/(?:\d{1,2}:\d{2}\.\d{2}|\d{1,3}\.\d{2}|\bNT\b)/gi)||[];const seed=tokens.at(-1)||null,event=h[1]+" "+h[2];if(!out.some(x=>normalizeText(x.event)===normalizeText(event)))out.push({event,seedTimeMs:seed&&!/^NT$/i.test(seed)?parseTime(seed):null,heat:null,lane:null,sourceBlock:row})}
 return out;
}