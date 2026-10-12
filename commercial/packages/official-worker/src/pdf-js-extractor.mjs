import {getDocumentProxy} from 'unpdf';
import {pdfTextLines} from './pdf-lines.mjs';
import {SourceAccessError} from '../../import-v2/src/official-document.mjs';
export const PDF_EXTRACTOR_VERSION='unpdf@1.8.1/pdf-lines-v1';
export async function extractOfficialPdfJs(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length>20*1024*1024)throw new SourceAccessError('Invalid official PDF size',{formatUnrecognized:true});
 let document;
 try{
  document=await getDocumentProxy(bytes.slice(),{isEvalSupported:false,disableFontFace:true,useSystemFonts:false,useWorkerFetch:false});
  if(document.numPages>200)throw new SourceAccessError('Official PDF exceeds 200-page processing limit',{formatUnrecognized:true});
  const pages=[],started=performance.now();
  for(let number=1;number<=document.numPages;number++){
   if(performance.now()-started>15000)throw new SourceAccessError('Official PDF extraction timeout',{timeout:true});
   const page=await document.getPage(number),content=await page.getTextContent();
   pages.push(pdfTextLines(content.items).join('\n'));page.cleanup();
  }
  const text=pages.join('\n\n');
  if(!text.trim())throw new SourceAccessError('Official PDF has no accessible text',{formatUnrecognized:true});
  return text;
 }catch(error){
  if(error instanceof SourceAccessError)throw error;
  throw new SourceAccessError('Official PDF extraction failed: '+String(error?.message||error),{formatUnrecognized:true});
 }finally{if(document)await document.loadingTask.destroy();}
}
