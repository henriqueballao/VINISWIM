import {fetchSwimSystemCalendar} from "./fetch-readonly.mjs";import {discoverSwimSystemMeetIds} from "./discovery.mjs";
const r=await fetchSwimSystemCalendar();const ids=discoverSwimSystemMeetIds(r.text);console.log(JSON.stringify({url:r.url,status:r.status,count:ids.length,ids},null,2));
