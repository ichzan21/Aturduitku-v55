import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const base=process.env.E2E_BASE_URL||'https://www.aturduitku.com';
await mkdir('.e2e-artifacts',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();
  await page.route('**/api/**',route=>route.fulfill({json:{ok:true}}));
  const blocked=[];
  await context.route('https://apis.google.com/js/api.js*',route=>{blocked.push(route.request().url());return route.abort('failed');});
  await page.goto(`${base}/#login`,{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>localStorage.setItem('qa-login-preserved','keep'));
  await page.getByRole('button',{name:'Masuk dengan Google',exact:true}).click();
  await page.getByRole('button',{name:'Muat ulang login',exact:true}).waitFor({timeout:90000});
  assert.ok(blocked.length>0,'Simulate an unavailable Google login component');
  await page.getByRole('button',{name:'Masuk dengan Google',exact:true}).waitFor({state:'visible'});
  assert.equal(await page.getByRole('button',{name:'Masuk dengan Google',exact:true}).isEnabled(),true);
  await page.screenshot({path:'.e2e-artifacts/google-login-recovery.png',fullPage:true});
  await context.unroute('https://apis.google.com/js/api.js*');
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button',{name:'Muat ulang login',exact:true}).click(),
  ]);
  await page.getByRole('button',{name:'Masuk dengan Google',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>localStorage.getItem('qa-login-preserved')),'keep','Recovery must not clear saved account data');
  const popupPromise=page.waitForEvent('popup');
  await page.getByRole('button',{name:'Masuk dengan Google',exact:true}).click();
  const popup=await popupPromise;
  await popup.waitForURL(/https:\/\/accounts\.google\.com\//,{timeout:45000,waitUntil:'domcontentloaded'}).catch(error=>{
    if(!popup.url().startsWith('https://accounts.google.com/')) {
      console.error('Recovery popup:',popup.url().slice(0,120));
      throw error;
    }
  });
  assert.ok(popup.url().includes('accounts.google.com'));
  await popup.close();
  console.log('PASS Google login: blocked helper produces recovery, reload preserves data, Google account selection opens after recovery (no customer sign-in)');
  await context.close();
} finally {await browser.close();}
