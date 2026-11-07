export const canWriteManualResult=(role:string)=>['owner','admin','guardian'].includes(role);
export const canModifyResult=(row:{origin?:string;is_official?:boolean},role:string)=>canWriteManualResult(role)&&row.origin==='manual'&&row.is_official===false;
