import {parse} from 'parse5';
import {verifiedCaptureEvidence,SourceAccessError} from '../../import-v2/src/official-document.mjs';
import {canonicalMeetUrl} from './discovery.mjs';
export const OFFICIAL_CATALOG_URL='https://www.swimsystem.app/meets';
export function canonicalCatalogUrl(value){
 const url=new URL(value);
 if(url.protocol!=='https:'||url.hostname!=='www.swimsystem.app'||url.port||url.username||url.password||url.hash||url.pathname!=='/meets')throw new SourceAccessError('Unsupported official catalog URL',{formatUnrecognized:true});
 for(const [key,value] of url.searchParams)if(key!=='page'||!/^\d+$/.test(value)||Number(value)<1||!Number.isSafeInteger(Number(value)))throw new SourceAccessError('Unsupported catalog pagination',{formatUnrecognized:true});
 if([...url.searchParams.keys()].length>1)throw new SourceAccessError('Ambiguous catalog pagination',{formatUnrecognized:true});
 return url.href;
}
export function discoverOfficialCatalog(document){
 if(!verifiedCaptureEvidence(document))throw new SourceAccessError('Catalog requires captured original HTML',{formatUnrecognized:true});
 const url=canonicalCatalogUrl(document.url),meets=new Set(),pages=new Set();
 const walk=node=>{
  if(node.tagName==='a'){
   const href=node.attrs?.find(a=>a.name==='href')?.value;
   if(href){let link;try{link=new URL(href,url);}catch{link=null;}
    if(link&&['www.swimsystem.app','swimsystem.app'].includes(link.hostname)){
     if(link.pathname.startsWith('/meets/sw/'))meets.add(canonicalMeetUrl(link.href).officialUrl);
     else if(link.pathname==='/meets'&&link.searchParams.has('page')){const next=canonicalCatalogUrl(link.href);if(next!==url)pages.add(next);}
    }
   }
  }
  for(const child of node.childNodes||[])walk(child);
 };
 walk(parse(document.text));
 if(!meets.size&&!pages.size)throw new SourceAccessError('Catalog contains no recognized competition links; empty or changed source is unverified',{formatUnrecognized:true});
 return {url,meetUrls:[...meets].sort(),pageUrls:[...pages].sort(),rawHash:document.rawHash,retrievedAt:document.retrievedAt};
}
