import {parseResultList} from "./resultlist-parser.mjs";
import {dryRun} from "./dry-run.mjs";
export function scanDocuments(input){
 const out=[];
 for(const d of input.documents){
  const meet=input.meets[d.externalMeetId];
  if(!meet) continue;
  out.push(...parseResultList({text:d.text,identity:input.identity,meet,sourceUrl:d.url,retrievedAt:input.retrievedAt}));
 }
 return dryRun(out);
}
