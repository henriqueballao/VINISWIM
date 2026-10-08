const {chromium}=require('playwright');
const assert=require('node:assert/strict');

const user={id:'11111111-1111-4111-8111-111111111111',email:'teste-sintetico@example.invalid',app_metadata:{provider:'email',providers:['email']},user_metadata:{},aud:'authenticated',role:'authenticated',created_at:'2026-01-01T00:00:00Z'};
const accountId='22222222-2222-4222-8222-222222222222', athleteId='33333333-3333-4333-8333-333333333333',eventId='44444444-4444-4444-8444-444444444444',meetId='55555555-5555-4555-8555-555555555555';
const meet={id:meetId,name:'Campeonato Sintético',status:'scheduled',start_date:'2026-10-10',course:'SCM',city:'Cidade Teste',venue:'Piscina Teste',official_url:'https://www.swimsystem.app/meets/sw/exemplo-sintetico'};
const tables={
  profiles:{id:user.id,full_name:'Usuário Sintético'},
  account_members:[{account_id:accountId,role:'owner',accounts:{id:accountId,name:'Conta Sintética'}}],
  events:[{id:eventId,label:'50 Livre',sort_order:1}],
  athletes:[{id:athleteId,account_id:accountId,active:true,preferred_name:'Nadador Sintético',category:'Master'}],
  v_result_timeline:[{id:'66666666-6666-4666-8666-666666666666',athlete_id:athleteId,event_id:eventId,course:'SCM',meet_id:meetId,meet_name:meet.name,result_date:'2026-09-01',created_at:'2026-09-01',status:'valid',time_ms:32000,origin:'official',is_official:true,category:'Master'}],
  v_athlete_overview:{total_results:1,official_results:1,manual_results:0,occurrences:0},
  personal_bests:Array.from({length:14},(_,i)=>({id:'pb-test-'+i,results:{id:'result-test-'+i,event_id:eventId,course:'SCM',result_date:'2026-09-01',time_ms:32000+i*1000,meets:{name:meet.name,venue:meet.venue,city:meet.city}}})),
  meet_entries:[{id:'88888888-8888-4888-8888-888888888888',meet_id:meetId,event_id:eventId,athlete_id:athleteId,meets:meet}],
  audit_log:[], result_sources:[], athlete_source_configs:[],monitor_jobs:[],historical_archive_jobs:[],
  v_refresh_request_status:null,athlete_result_filters:null
};
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const size of [{name:'desktop',width:1440,height:900},{name:'mobile',width:390,height:844}]){
   const context=await browser.newContext({viewport:{width:size.width,height:size.height},serviceWorkers:'block'});
   const page=await context.newPage();
   const errors=[],writes=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(!url.hostname.endsWith('.supabase.co'))return route.continue();
    const path=url.pathname;
    if(path==='/auth/v1/token'&&req.method()==='POST'){
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({access_token:'synthetic.mock.jwt',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:'synthetic-refresh',user})});
    }
    if(path==='/auth/v1/user'&&req.method()==='GET')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(user)});
    if(path.startsWith('/rest/v1/')&&req.method()==='GET'){
      const table=decodeURIComponent(path.split('/').pop());
      const data=Object.hasOwn(tables,table)?tables[table]:[];
      return route.fulfill({status:200,contentType:'application/json',headers:{'content-range':'0-0/1'},body:JSON.stringify(data)});
    }
    // Supabase RPC transport is POST even for read-only operations.
    // Mock ONLY this audited allowlist; all mutations remain forbidden.
    if(req.method()==='POST'&&path.startsWith('/rest/v1/rpc/')){
      const readOnly={'list_account_members':[],'list_account_invites':[],'account_limits':{},'is_platform_admin':false};
      const name=path.split('/').pop();
      if(Object.hasOwn(readOnly,name))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(readOnly[name])});
    }
    writes.push(req.method()+' '+path);
    return route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({message:'Synthetic test blocks all mutations'})});
   });
   await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
   await page.locator('input[type=email]').fill(user.email);
   await page.locator('input[type=password]').fill('senha-sintetica');
   await page.getByRole('button',{name:'Entrar'}).click();
   await page.getByRole('heading',{name:'Visão Geral'}).waitFor({timeout:20000});
   await page.getByRole('heading',{name:'Campeonatos'}).waitFor();
   await page.getByRole('heading',{name:'Expectativas de tempo'}).waitFor();
   await page.locator('.pb-grid .pb').first().waitFor({timeout:15000});
   assert.equal(await page.locator('.pb-grid .pb').count(),3,'Default should show three best marks');
   await page.getByRole('button',{name:'Ver todas (14)'}).click();
   assert.equal(await page.getByRole('heading',{name:'Visão Geral'}).count(),1,'Expanding should stay on dashboard');
   assert.equal(await page.locator('.pb-grid .pb').count(),14,'Expanded list should show all 14 marks');
   await page.getByRole('button',{name:'Recolher'}).click();
   assert.equal(await page.locator('.pb-grid .pb').count(),3,'Collapsing should restore three marks');
   assert.equal(await page.getByRole('heading',{name:'Campeonatos'}).count(),1);
   assert.equal(await page.getByRole('heading',{name:'Expectativas de tempo'}).count(),1);
   await page.getByText('Campeonato Sintético').first().waitFor({timeout:15000});
   await page.getByRole('link',{name:/Abrir fonte oficial da competição/}).first().waitFor({timeout:15000});
   const clickNav=async(label)=>{
    const button=page.locator('aside.sidebar nav button').filter({hasText:label});
    if(size.name==='mobile')await page.getByRole('button',{name:'Abrir menu'}).click();
    await button.click();
    await page.getByRole('heading',{name:label,exact:true}).first().waitFor();
   };
   for(const label of ['Resultados','Evolução','Configurações','Visão Geral'])await clickNav(label);
   const bodyWidth=await page.evaluate(()=>document.body.scrollWidth);
   assert.ok(bodyWidth<=size.width+2,'Horizontal overflow '+size.name+': '+bodyWidth);
   assert.deepEqual(errors,[],'JS errors '+size.name);
   assert.deepEqual(writes,[],'Unexpected write requests '+size.name);
   console.log('PASS synthetic authenticated dashboard/navigation '+size.name);
   await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});