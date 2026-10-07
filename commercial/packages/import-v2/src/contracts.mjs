export const REQUIRED_RESULT_FIELDS=["sourceCode","externalMeetId","event","resultDate","course","sourceUrl","sourceBlock","parserVersion","retrievedAt"];

export function validateResultCandidate(c){
  const errors=[];
  for(const k of REQUIRED_RESULT_FIELDS) if(c[k]===null||c[k]===undefined||c[k]==="") errors.push("missing:"+k);
  if(c.timeMs==null&&!["dns","dnf","dsq"].includes(c.status)) errors.push("missing:time_or_status");
  if(c.timeMs!=null&&c.status!=="valid") errors.push("conflict:time_and_status");
  if(!["SCM","LCM"].includes(c.course)) errors.push("invalid:course");
  return {accepted:errors.length===0,errors,normalizedCandidate:c};
}

export function resultKey(c){
  return [c.sourceCode,c.externalMeetId,c.event,c.resultDate,c.course,c.timeMs??"",c.status].join("|");
}
