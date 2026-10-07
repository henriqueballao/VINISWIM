import {validateResultCandidate,resultKey} from "./contracts.mjs";

export function dryRun(candidates){
 const accepted=[],rejected=[],seen=new Set();
 for(const c of candidates){
   const v=validateResultCandidate(c);
   if(!v.accepted){rejected.push({candidate:c,errors:v.errors});continue}
   const key=resultKey(c);
   if(seen.has(key))continue;
   seen.add(key);accepted.push(c);
 }
 return {mode:"dry-run",writes:0,accepted,rejected};
}
