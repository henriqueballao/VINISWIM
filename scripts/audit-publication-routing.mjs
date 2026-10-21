// Public GET/DNS audit only. No auth, imports, notification or mutation calls.
import {resolve4,resolve6,resolveCname} from 'node:dns/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
const output=process.env.AUDIT_OUTPUT_DIR||'publication-routing-evidence';
await mkdir(output,{recursive:true});
const dns={};
for(const [name,fn] of [['A',resolve4],['AAAA',resolve6],['CNAME',resolveCname]]){
 try{dns[name]={records:await fn('viniswim.com.br')};}catch(e){dns[name]={error:e.code||e.message};}
}
function expectedBlob(path){try{return execFileSync('git',['rev-parse',`origin/main:${path}`],{encoding:'utf8'}).trim();}catch(e){return null;}}
const captures=[];
for(const [file,url,repositoryPath] of [
 ['root.html','https://viniswim.com.br/','index.html'],
 ['app.html','https://viniswim.com.br/app/','app/index.html'],
 ['railway-health.json','https://viniswim-monitor-live-production.up.railway.app/health',null]
]){
 try{
  const response=await fetch(url,{signal:AbortSignal.timeout(20000),redirect:'follow'});
  const bytes=Buffer.from(await response.arrayBuffer()),text=bytes.toString('utf8');
  await writeFile(`${output}/${file}`,bytes);
  const gitBlob=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),expected=repositoryPath?expectedBlob(repositoryPath):null;
  captures.push({requestedUrl:url,url:response.url,status:response.status,retrievedAt:new Date().toISOString(),file,rawHash:createHash('sha256').update(bytes).digest('hex'),gitBlob,repositoryPath,mainBlob:expected,matchesMain:expected?expected===gitBlob:null,headers:Object.fromEntries(['server','via','x-github-request-id','x-served-by','cf-ray','location'].map(k=>[k,response.headers.get(k)])),legacyRailwayReferences:/viniswim-monitor-live-production\.up\.railway\.app/.test(text)});
 }catch(e){captures.push({requestedUrl:url,error:e.message,captured:false});}
}
await writeFile(`${output}/routing.json`,JSON.stringify({mode:'public-readonly-no-import',dns,captures},null,2));
console.log(JSON.stringify({dns,captures},null,2));
if(captures.some(c=>!c.status||c.status!==200))process.exitCode=1;
