import {normalizeText,parseTime} from "./normalize.mjs";
const STROKES={LIVRE:"Livre",COSTAS:"Costas",PEITO:"Peito",BORBOLETA:"Borboleta",MEDLEY:"Medley"};
function looseName(text,name){
 const a=normalizeText(text),b=normalizeText(name);if(!a||!b)return false;if(a.includes(b))return true;
 const aw=a.split(" "),bw=b.split(" ");return bw.length>1&&aw.includes(bw[0])&&aw.includes(bw.at(-1));
}
export function parseMastersParana({text,identity,meet,sourceUrl,retrievedAt}){
 const body=String(text||""),headerRe=/#\s*\d+[ºª]\s*PROVA\s*-\s*(\d+)\s*METROS\s+(LIVRE|COSTAS|PEITO|BORBOLETA|MEDLEY)(?:\s+(FEMININO|MASCULINO))?/gi;
 const headers=[...body.matchAll(headerRe)],names=[identity.canonicalName,...(identity.aliases||[])].filter(Boolean),out=[];
 for(let k=0;k<headers.length;k++){
  const h=headers[k],stroke=STROKES[h[2].toUpperCase()];if(!stroke)continue;
  const block=body.slice(h.index+h[0].length,k+1<headers.length?headers[k+1].index:undefined).replace(/\s+/g," ").trim();
  let matched="",namePos=-1;
  for(const name of names){if(!looseName(block,name))continue;const idx=normalizeText(block).indexOf(normalizeText(name));if(idx>=0){matched=normalizeText(name);namePos=idx;break}}
  if(namePos<0)continue;
  const norm=normalizeText(block);
  const before=norm.slice(Math.max(0,namePos-32),namePos);
  const statusBefore=(before.match(/(?:n\/c|dql|dq|dns|dnf|dsq)\s+\d{1,8}\s*$/i)||[])[0]||"";
  const after=block.slice(namePos+matched.length);
  const next=after.match(/\s(?:N\/C|DQL|DQ|DNS|DNF|DSQ)\s+\d{1,8}\s|\s\d{1,3}[ºª°]\s+\d{1,8}\s/i);
  const seg=(next?after.slice(0,next.index):after.slice(0,260)).trim();
  const status=/N\/C|DQL|DQ|DSQ/i.test(statusBefore)?"dsq":/DNS/i.test(statusBefore)?"dns":/DNF/i.test(statusBefore)?"dnf":"valid";
  const tm=status==="valid"?seg.match(/(?:^|\s)(\d{1,2}:\d{2}\.\d{2}|\d{1,3}\.\d{2})\s+\d{1,2},\d{2}\s+\d{1,4}(?:\s|$)/):null;
  const timeMs=tm?parseTime(tm[1]):null;
  if(status==="valid"&&timeMs==null)continue;
  out.push({sourceCode:meet.sourceCode,externalMeetId:meet.externalMeetId,event:h[1]+" "+stroke,resultDate:meet.startDate||null,course:meet.course,timeMs,status,sourceUrl,sourceBlock:seg.slice(0,180),parserVersion:"masters-parana-v2.1",retrievedAt,athleteExternalId:identity.externalId||null});
 }
 return out;
}
