// A previous athlete/account/session response must never update the selected UI.
// Only one load runs for the current scope; slow polls cannot create a backlog.
export function createScopedLoader(){
 let selected='',generation=0,running:number|null=null;
 return {
  select(scope:string){if(scope!==selected){selected=scope;generation++;running=null;}},
  async run<T>(scope:string,load:()=>Promise<T>,apply:(value:T)=>void,fail:(error:unknown)=>void){
   if(!scope||scope!==selected||running===generation)return;
   const current=generation;running=current;
   try{const value=await load();if(scope===selected&&current===generation)apply(value);}
   catch(error){if(scope===selected&&current===generation)fail(error);}
   finally{if(running===current)running=null;}
  }
 };
}
