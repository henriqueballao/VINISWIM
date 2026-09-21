export type Identifier={id:string;athlete_id:string;source_id:string;external_id:string;external_name:string|null;metadata:any;athletes?:any;sources?:any}
export type ParsedMeet={externalId:string;name:string;startDate:string|null;endDate:string|null;course:'SCM'|'LCM'|null;venue:string|null;city:string|null;officialUrl:string}
export type ParsedEntry={eventLabel:string;seedTimeMs:number|null;heat:number|null;lane:number|null;externalId:string|null}
export type ParsedResult={eventLabel:string;timeMs:number|null;status:'valid'|'dns'|'dsq'|'dnf'|'partial';externalId:string|null;sourceUrl:string;resultDate:string|null;course:'SCM'|'LCM'|null}
export type ScanOutput={meet:ParsedMeet;entries:ParsedEntry[];results:ParsedResult[]}
export interface SourceAdapter{code:string;verifyIdentifier?(identifier:Identifier):Promise<{ok:boolean;externalName?:string|null;message?:string}>;scanCurrent(identifier:Identifier):Promise<ScanOutput|null>}
