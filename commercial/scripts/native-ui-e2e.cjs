// No route interception: real local Auth and PostgREST, no production endpoint.
const {chromium}=require('playwright');const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
 const state=JSON.parse(fs.readFileSync('/tmp/viniswim-native-actors.json','utf8'));const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.on('request',req=>{const host=new URL(req.url()).hostname;if(host.endsWith('supabase.co'))throw Error('Native browser reached production');});
  await page.goto('http://127.0.0.1:4173/');await page.locator('input[type=email]').fill(state.a.email);await page.locator('input[type=password]').fill(state.a.password);
  await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.getByRole('heading',{name:'Visão Geral'}).waitFor({timeout:30000});
  await page.getByRole('button',{name:'Abrir menu'}).click();
  if(process.argv[2]==='request'){
   await page.locator('aside.sidebar nav button').filter({hasText:'Configurações'}).click();
   await page.getByRole('button',{name:'Adicionar fonte',exact:true}).click();
   const form=page.locator('form.source-config-card');
   await form.getByLabel('Nome curto da fonte',{exact:true}).fill('SwimSystem');
   await form.getByLabel('URL',{exact:true}).fill('https://www.swimsystem.app');
   await form.getByLabel('Número / registro',{exact:true}).fill(state.registration);
   await form.getByLabel('Nome nesta fonte',{exact:true}).fill('Public registration selected from official original');
   await form.getByRole('button',{name:'Salvar fonte',exact:true}).click();
   await page.getByText('Fonte SwimSystem salva.',{exact:true}).waitFor({timeout:30000});
   await page.getByRole('button',{name:'Abrir menu'}).click();
   await page.locator('aside.sidebar nav button').filter({hasText:'Resultados'}).click();
   await page.getByRole('button',{name:'Cancelar busca'}).waitFor({timeout:30000});
   console.log('PASS browser Auth, source registration and automatic enrollment without API mocks or search click');
  }else{
   await page.locator('aside.sidebar nav button').filter({hasText:'Resultados'}).click();
   const proof=JSON.parse(fs.readFileSync('/tmp/viniswim-native-proof.json','utf8'));
   await page.getByText(proof.rows.length+' resultados oficiais registrados',{exact:true}).waitFor({timeout:30000});
   const displayed=await page.locator('.desktop-results tbody tr').allTextContents();assert.equal(displayed.length,proof.rows.length);
   const cards=page.locator('.mobile-results .result-card');assert.equal(await cards.count(),proof.rows.length);
   for(const row of proof.rows){
    const number='#'+row.chronological_number;
    const desktop=page.locator('.desktop-results tbody tr').filter({has:page.locator('td').filter({hasText:new RegExp('^'+number+'$')})});assert.equal(await desktop.count(),1);
    const cells=await desktop.locator('td').allTextContents();
    assert.equal(cells[1],row.result_date.split('-').reverse().join('/'));
    assert.equal(cells[3],proof.eventLabels[row.event_id]);assert.equal(cells[5],row.course==='LCM'?'50 m':'25 m');assert.equal(cells[7],row.meet_name);
    const match=cells[4].replace(/'/g,':').replace(/"/g,'.').match(/^(?:(\d+):)?(\d+)[.,](\d{2})$/);assert.ok(match,'Displayed time must have documented swim format');
    const ms=((Number(match[1]||0)*60+Number(match[2]))*1000)+Number(match[3])*10;assert.equal(ms,row.time_ms,'Displayed time must equal native database value');
    const card=cards.filter({has:page.locator('.result-number').filter({hasText:new RegExp('^'+number+'$')})});assert.equal(await card.count(),1);
    assert.equal(await card.locator('.result-card-top strong').textContent(),cells[4]);assert.equal(await card.locator('.result-card-top b').textContent(),cells[3]);
    assert.ok((await card.locator('small').textContent()).includes(cells[1]));
   }

   assert.equal(await page.getByRole('button',{name:'Excluir',exact:true}).count(),0);
   assert.ok(await page.evaluate(()=>document.body.scrollWidth)<=392);
   console.log('PASS native browser presents persisted official count, mobile layout and immutable actions');
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});
