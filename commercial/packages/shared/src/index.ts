export function formatSwimTime(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—';
  const totalCs = Math.round(ms / 10);
  const minutes = Math.floor(totalCs / 6000);
  const seconds = Math.floor((totalCs % 6000) / 100);
  const cs = totalCs % 100;
  return minutes > 0
    ? `${minutes}'${String(seconds).padStart(2, '0')}"${String(cs).padStart(2, '0')}`
    : `${seconds}"${String(cs).padStart(2, '0')}`;
}
export function parseSwimTime(value: string): number | null {
  const s=String(value||'').trim().replace(',','.').replace(/[”″]/g,'"').replace(/[’′]/g,"'");
  if(!s)return null;
  let m=s.match(/^(\d+):(\d{1,2})(?:\.(\d{1,2}))?$/);
  if(m)return Math.round((Number(m[1])*60+Number(m[2])+Number(`0.${m[3]||'0'}`))*1000);
  m=s.match(/^(\d+)['’](\d{1,2})["”]?(\d{1,2})?$/);
  if(m)return Math.round((Number(m[1])*60+Number(m[2])+Number(`0.${m[3]||'0'}`))*1000);
  m=s.match(/^(\d{1,3})["”](\d{1,2})$/);
  if(m)return Math.round((Number(m[1])+Number(`0.${m[2]}`))*1000);
  m=s.match(/^(\d{1,3})(?:\.(\d{1,2}))?$/);
  if(m)return Math.round((Number(m[1])+Number(`0.${m[2]||'0'}`))*1000);
  return null;
}
export function deltaLabel(actual:number|null,seed:number|null):string{
  if(actual==null||seed==null)return '—';const d=actual-seed;const sign=d>0?'+':d<0?'−':'';
  return `${sign}${formatSwimTime(Math.abs(d))}`;
}