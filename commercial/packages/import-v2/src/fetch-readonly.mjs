export async function fetchText(url,{fetchImpl=globalThis.fetch}={}){
 const r=await fetchImpl(url,{headers:{"accept":"text/html,application/xhtml+xml"}});
 if(!r.ok)throw new Error("fetch_failed:"+r.status+":"+url);
 return {url:r.url||url,status:r.status,text:await r.text(),retrievedAt:new Date().toISOString()};
}
export async function fetchSwimSystemCalendar(opts={}){
 return fetchText("https://www.swimsystem.app/meets",opts);
}
