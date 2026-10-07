const ACTIVE=new Set(["pending","running"]);
const FAILED=new Set(["failed"]);
const CANCELLED=new Set(["cancelled","canceled"]);

export function reconcileRequestLifecycle({jobs=[],descendants=[],cancelRequested=false}={}){
 const all=[...jobs,...descendants];
 if(cancelRequested&&all.every(x=>!ACTIVE.has(x.status)))return {status:"cancelled",terminal:true};
 if(all.some(x=>ACTIVE.has(x.status)))return {status:"running",terminal:false};
 if(all.some(x=>FAILED.has(x.status)))return {status:"failed",terminal:true};
 if(all.length===0)return {status:"running",terminal:false};
 if(all.every(x=>x.status==="completed"||CANCELLED.has(x.status)))return {status:"completed",terminal:true};
 return {status:"running",terminal:false};
}
