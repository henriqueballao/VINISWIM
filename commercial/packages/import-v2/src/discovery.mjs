export function discoverSwimSystemMeetIds(html){return [...new Set([...String(html||"").matchAll(/\/meets\/sw\/([0-9a-f-]{36})/gi)].map(m=>m[1].toLowerCase()))]}
export function meetUrls(ids){return ids.map(id=>"https://www.swimsystem.app/meets/sw/"+id)}
