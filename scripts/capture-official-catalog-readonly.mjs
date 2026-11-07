// Public HTML only. No credentials, CAPTCHA bypass or database writes.
import {mkdir,writeFile} from 'node:fs/promises';
import {captureOfficialDocument} from '../commercial/packages/import-v2/src/official-document.mjs';
import {discoverOfficialCatalog,OFFICIAL_CATALOG_URL} from '../commercial/packages/official-worker/src/catalog.mjs';
const root='official-catalog-capture';await mkdir(root,{recursive:true});
try{
 const document=await captureOfficialDocument({url:OFFICIAL_CATALOG_URL,allowedHosts:['www.swimsystem.app','swimsystem.app'],maxBytes:4*1024*1024});
 await writeFile(root+'/calendar.html',document.bytes);
 const evidence=discoverOfficialCatalog(document);await writeFile(root+'/evidence.json',JSON.stringify(evidence,null,2));
 console.log(JSON.stringify({mode:'public-catalog-readonly',writes:0,...evidence}));
}catch(error){console.log(JSON.stringify({mode:'public-catalog-readonly',writes:0,outcome:error.failure?.code||'unknown',message:error.message}));process.exitCode=1;}
