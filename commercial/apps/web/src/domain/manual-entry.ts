export function optionalEntryNumber(value:string,min:number,max:number):number|null{
 if(!value.trim())return null;
 if(!/^\d+$/.test(value.trim()))throw new Error('Informe um número inteiro válido.');
 const n=Number(value);
 if(!Number.isSafeInteger(n)||n<min||n>max)throw new Error('Número fora do intervalo permitido.');
 return n;
}
export function manualSeedTime(value:string,parse:(text:string)=>number|null):number|null{
 if(!value.trim())return null;
 const n=parse(value);
 if(n===null||!Number.isSafeInteger(n)||n<=0)throw new Error('Tempo de inscrição inválido.');
 return n;
}
