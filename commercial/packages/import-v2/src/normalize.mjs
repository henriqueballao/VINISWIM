export function normalizeText(s=""){return String(s).normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase().replace(/\s+/g," ").trim()}
export function parseTime(v){
  const s=String(v||"").trim().replace(",",".");
  let m=s.match(/^(\d+):(\d{1,2})\.(\d{2})$/);
  if(m)return (Number(m[1])*60+Number(m[2]))*1000+Number(m[3])*10;
  m=s.match(/^(\d{1,3})\.(\d{2})$/);
  if(m)return Number(m[1])*1000+Number(m[2])*10;
  return null;
}
