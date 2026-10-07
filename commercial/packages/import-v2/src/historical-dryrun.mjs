import {scanDocuments} from "./document-scanner.mjs";
export function historicalDryRun(input){
 const meets=Object.fromEntries(input.archives.map(a=>[String(a.externalMeetId),{sourceCode:a.sourceCode||"swimsystem",externalMeetId:String(a.externalMeetId),course:a.course}]));
 return scanDocuments({identity:input.identity,meets,documents:input.documents,retrievedAt:input.retrievedAt});
}
