import {test} from 'node:test';import assert from 'node:assert/strict';
import {captureOfficialDocument} from '../../import-v2/src/official-document.mjs';
import {discoverOfficialCatalog,canonicalCatalogUrl} from './catalog.mjs';
const capture=html=>captureOfficialDocument({url:'https://www.swimsystem.app/meets',allowedHosts:['www.swimsystem.app'],fetchImpl:async()=>new Response(html,{headers:{'content-type':'text/html'}})});
test('catalog is generic, preserves all 37 meets, ignores scripts and duplicate links',async()=>{
 const urls=Array.from({length:37},(_,i)=>'/meets/sw/'+i.toString(16).padStart(8,'0')+'-0000-4000-8000-000000000001');
 const html=urls.map(url=>`<a href="${url}">publicação</a>`).join('')+`<a href="${urls[0]}">duplicado</a><a href="/meets?page=2">Próxima</a><script>"/meets/sw/ffffffff-ffff-4fff-8fff-ffffffffffff"</script>`;
 const found=discoverOfficialCatalog(await capture(html));assert.equal(found.meetUrls.length,37);assert.deepEqual(found.pageUrls,['https://www.swimsystem.app/meets?page=2']);
});
test('copied provenance, unrecognized empty catalog and unsafe pagination fail explicitly',async()=>{
 assert.throws(()=>discoverOfficialCatalog({url:'https://www.swimsystem.app/meets',text:'<a href="/meets/sw/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa">x</a>'}));
 assert.throws(()=>canonicalCatalogUrl('https://evil.invalid/meets?page=2'));
 assert.throws(()=>canonicalCatalogUrl('https://www.swimsystem.app/meets?page=2&page=3'));
 const empty=await capture('<h1>Competições</h1>');assert.throws(()=>discoverOfficialCatalog(empty),/no recognized/);
});

test('authorized original catalog fixture verifies hash and discovers all 70 captured links',async()=>{
 const {readFile}=await import('node:fs/promises');const {createHash}=await import('node:crypto');
 const base=new URL('../fixtures/catalog-20261012/',import.meta.url);
 const provenance=JSON.parse(await readFile(new URL('provenance.json',base),'utf8'));
 const {gunzipSync}=await import('node:zlib');
 const bytes=gunzipSync(Buffer.from((await readFile(new URL('calendar.html.gz.base64',base),'utf8')).trim(),'base64'),{maxOutputLength:4*1024*1024});
 assert.equal(createHash('sha256').update(bytes).digest('hex'),provenance.rawHash);assert.equal(bytes.length,provenance.bytes);
 const document=await captureOfficialDocument({url:provenance.url,allowedHosts:['www.swimsystem.app'],fetchImpl:async()=>new Response(bytes,{headers:{'content-type':'text/html'}})});
 const found=discoverOfficialCatalog(document);assert.deepEqual(found.meetUrls,provenance.meetUrls);assert.equal(found.meetUrls.length,70);
 assert.ok(found.meetUrls.includes('https://www.swimsystem.app/meets/sw/c8587533-2e44-4b08-991f-f827170c7344'));
});
