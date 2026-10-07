import {parseResultList} from "./resultlist-parser.mjs";
import {parseMastersParana} from "./masters-parana-parser.mjs";
import {dryRun} from "./dry-run.mjs";
export function scanDocuments(input){
 const out=[];
 for(const doc of input.documents){
  const meet=input.meets[doc.externalMeetId];
  if(!meet)continue;
  if(meet.provider==="masters_parana"){
   out.push(...parseMastersParana({text:doc.text,identity:input.identity,meet,sourceUrl:doc.url,retrievedAt:input.retrievedAt}));
   continue;
  }
  if(/ResultList_/i.test(doc.url||"")||meet.provider!=="swimtime_progression"){
   out.push(...parseResultList({text:doc.text,identity:input.identity,meet,sourceUrl:doc.url,retrievedAt:input.retrievedAt}));
  }
 }
 return dryRun(out);
}
