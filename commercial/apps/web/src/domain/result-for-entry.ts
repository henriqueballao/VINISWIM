export interface EntryIdentity {
 athlete_id: string;
 meet_id: string;
 event_id: string;
 source_id?: string | null;
 official_event_number?: string | null;
 official_round?: string | null;
 official_sex?: string | null;
 official_event_date?: string | null;
 official_course?: string | null;
}
export interface ResultIdentity {
 athlete_id: string;
 meet_id?: string | null;
 event_id: string;
 source_id?: string | null;
 is_official: boolean;
 course: string;
 result_date: string;
 official_event_number?: string | null;
 official_round?: string | null;
 official_sex?: string | null;
}
// UI comparisons require a unique race, athlete and pool. A legacy row without
// official race descriptors is usable only when one candidate remains.
export function resultForEntry<T extends ResultIdentity>(entry: EntryIdentity,results: readonly T[],meetCourse?: string | null): {status:'matched'|'not_found'|'ambiguous';result:T|null}{
 const course=entry.official_course||meetCourse;
 if(!course)return {status:'not_found',result:null};
 let candidates=results.filter(r=>r.is_official&&r.athlete_id===entry.athlete_id&&r.meet_id===entry.meet_id&&r.event_id===entry.event_id&&r.course===course&&(!entry.source_id||r.source_id===entry.source_id));
 if(entry.official_event_number){
  candidates=candidates.filter(r=>r.official_event_number===entry.official_event_number&&r.official_round===entry.official_round&&r.official_sex===entry.official_sex&&r.result_date===entry.official_event_date);
 }
 if(candidates.length===1)return {status:'matched',result:candidates[0]};
 return {status:candidates.length?'ambiguous':'not_found',result:null};
}
