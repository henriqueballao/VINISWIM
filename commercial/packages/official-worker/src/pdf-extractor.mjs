import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
// Local byte extraction only. Protected URLs and credentials never reach a
// third-party reader, a shell command, or the extractor's environment.
export async function extractOfficialPdf(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length>20*1024*1024)throw new Error('Invalid PDF byte limit');
 const directory=await mkdtemp(join(tmpdir(),'viniswim-official-'));
 try{
  const file=join(directory,'document.pdf');await writeFile(file,bytes,{mode:0o600});
  const {stdout}=await run('pdftotext',['-layout',file,'-'],{timeout:15000,maxBuffer:32*1024*1024,env:{PATH:process.env.PATH,LANG:'C.UTF-8'}});
  if(!stdout.trim())throw new Error('Official PDF has no extractable text');return stdout;
 }finally{await rm(directory,{recursive:true,force:true});}
}
