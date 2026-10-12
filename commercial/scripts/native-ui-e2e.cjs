// No route interception: real local Auth and PostgREST, no production endpoint.
const {chromium}=require('playwright');const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
 const state=JSON.parse(fs.readFileSync('/tmp/viniswim-native-actors.json','utf8'));const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.on('request',req=>{const host=new URL(req.url()).hostname;if(host.endsWith('supabase.co'))throw Error('Native browser reached production');});
  await page.goto('http://127.0.0.1:4173/');await page.locator('input[type=email]').fill(state.a.email);await page.locator('input[type=password]').fill(state.a.password);
  await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.getByRole('heading',{name:'Visão Geral'}).waitFor({timeout:30000});
  await page.getByRole('button',{name:'Abrir menu'}).click();await page.locator('aside.sidebar nav button').filter({hasText:'Resultados'}).click();
  if(process.argv[2]==='request'){
   const response=page.waitForResponse(r=>r.url().endsWith('/rest/v1/rpc/request_official_catalog_import'));
   await page.getByRole('button',{name:'Atualizar resultados'}).click();assert.equal((await response).status(),200);
   console.log('PASS native browser login and catalog request, no API mocks');
  }else{
   const proof=JSON.parse(fs.readFileSync('/tmp/viniswim-native-proof.json','utf8'));
   await page.getByText(proof.rows.length+' resultados oficiais registrados',{exact:true}).waitFor({timeout:30000});
   assert.ok(await page.locator('tbody tr').count()>=proof.rows.length);
   assert.equal(await page.getByRole('button',{name:'Excluir',exact:true}).count(),0);
   assert.ok(await page.evaluate(()=>document.body.scrollWidth)<=392);
   console.log('PASS native browser presents persisted official count, mobile layout and immutable actions');
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});
