type PerformanceRow = {event_id:string;course:string;status:string;time_ms:number|null;is_official?:boolean}

export function performanceKey(row:Pick<PerformanceRow,'event_id'|'course'>):string {
  return JSON.stringify([row.event_id,row.course])
}

export function confirmedBests<T extends PerformanceRow>(rows:T[]):T[] {
  const best=new Map<string,T>()
  for(const row of rows){
    if(row.is_official!==true||row.status!=='valid'||!Number.isFinite(row.time_ms)||Number(row.time_ms)<=0||!['SCM','LCM'].includes(row.course))continue
    const key=performanceKey(row),previous=best.get(key)
    if(!previous||Number(row.time_ms)<Number(previous.time_ms))best.set(key,row)
  }
  return [...best.values()]
}
