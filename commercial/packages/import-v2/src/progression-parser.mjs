import {normalizeText,parseTime} from "./normalize.mjs";

function looseName(a,b){
  const x=normalizeText(a),y=normalizeText(b);
  if(x===y)return true;
  const aw=x.split(" "),bw=y.split(" ");
  return aw.length>1&&bw.length>1&&aw[0]===bw[0]&&aw.at(-1)===bw.at(-1);
}

/**
 * Pure parser for legacy ProgressionDetails text.
 * IMPORTANT: ProgressionDetails proves athlete/event/result, but a multi-day
 * meet summary does not prove the event date. resultDate is therefore null
 * unless the caller supplies eventDates from a same-meet official document.
 */
export function parseProgressionDetails({text,identity,meet,eventDates={},sourceUrl,retrievedAt}){
  const headerRe=/\n\n([A-ZÀ-Ÿ][^\n,]{1,80}),\s*(\d{4})\s*\((\d{1,2})\s*Anos?\),\s*(Masculino|Feminino)/g;
  const headers=[...String(text||"").matchAll(headerRe)],out=[];
  for(let k=0;k<headers.length;k++){
    const h=headers[k],name=h[1].trim();
    if(![identity.canonicalName,...(identity.aliases||[])].some(n=>n&&looseName(name,n)))continue;
    const block=String(text).slice(h.index+h[0].length,k+1<headers.length?headers[k+1].index:undefined);
    const eventRe=/(?<![x\d])(\d{1,4})m\s+(Livre|Costas|Peito|Borboleta|Medley)\s+(?:Final\s+Direta|Eliminat[oó]ria)\s*/gi;
    const events=[...block.matchAll(eventRe)];
    for(let j=0;j<events.length;j++){
      const e=events[j],seg=block.slice(e.index+e[0].length,j+1<events.length?events[j+1].index:undefined).trim();
      const m=seg.match(/^(?:\d{1,3}\.|-)\s*(DNS|DNF|DSQ|DQL|DQ|N\/C|\d{1,2}:\d{2}\.\d{2}|\d{1,3}\.\d{2}|NT)\b/i);
      if(!m||/^NT$/i.test(m[1]))continue;
      const event=e[1]+" "+e[2],raw=m[1].toUpperCase();
      const status=/^(DNS|DNF)$/i.test(raw)?raw.toLowerCase():/^(DSQ|DQL|DQ|N\/C)$/i.test(raw)?"dsq":"valid";
      const timeMs=status==="valid"?parseTime(raw):null;
      out.push({sourceCode:meet.sourceCode,externalMeetId:meet.externalMeetId,event,resultDate:eventDates[normalizeText(event)]||null,course:meet.course,timeMs,status,sourceUrl,sourceBlock:seg.slice(0,180),parserVersion:"progression-v2.1",retrievedAt,athleteExternalId:identity.externalId});
    }
  }
  return out;
}
