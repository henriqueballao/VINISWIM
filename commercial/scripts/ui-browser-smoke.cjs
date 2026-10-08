const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({headless:true});
  const url = 'http://127.0.0.1:4173/';
  const viewports = [
    {name:'desktop', width:1440, height:900},
    {name:'mobile-portrait', width:390, height:844},
    {name:'mobile-landscape', width:844, height:390},
  ];
  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({viewport:{width:viewport.width,height:viewport.height}, serviceWorkers:'block'});
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror',err=>errors.push(err.message));
      // Never allow a real authenticated account, real data, or writes.
      await page.route('https://*.supabase.co/**', async route => {
        const req = route.request();
        if(req.method()!=='GET') return route.fulfill({status:403,body:'Synthetic test: writes blocked'});
        return route.fulfill({status:200,contentType:'application/json',body:'[]'});
      });
      await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
      await page.getByRole('heading',{name:'VINISWIM'}).waitFor({timeout:15000});
      const email=page.locator('input[type=email]').first();
      const password=page.locator('input[type=password]').first();
      assert.equal(await email.count(),1,'Email input missing');
      assert.equal(await password.count(),1,'Password input missing');
      await password.fill('senha-teste');
      const toggle=page.locator('.password-toggle').first();
      await toggle.click();
      assert.equal(await page.locator('input[type=text]').filter({visible:true}).count()>=1,true,'Password visibility toggle did not work');
      await toggle.click();
      assert.equal(await password.count(),1,'Password visibility toggle did not restore input');
      const bodyWidth=await page.evaluate(()=>document.body.scrollWidth);
      assert.ok(bodyWidth<=viewport.width+2,`Horizontal overflow at ${viewport.name}: ${bodyWidth} vs ${viewport.width}`);
      assert.deepEqual(errors,[],`Runtime JS errors at ${viewport.name}`);
      console.log(`PASS ${viewport.name}: login, password toggle, responsive overflow, no JS errors`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(err=>{console.error(err);process.exitCode=1});
