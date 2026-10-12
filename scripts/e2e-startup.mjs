import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:5185';
await mkdir('.e2e-artifacts', {recursive:true});
const browser = await chromium.launch({channel:'chrome', headless:true});
try {
  for (const [width,height] of [[390,844],[1440,900]]) {
    const context = await browser.newContext({viewport:{width,height}, serviceWorkers:'block'});
    const page = await context.newPage();
    const errors = [];
    const financialWrites = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', route => {
      if (route.request().method() !== 'GET') financialWrites.push(route.request().url());
      return route.fulfill({json:{ok:true}});
    });
    await page.addInitScript(() => localStorage.setItem('startup-safe-fixture', 'unchanged'));
    let releaseChunk;
    const chunkGate = new Promise(resolve => { releaseChunk = resolve; });
    let delayed = false;
    await page.route('**/assets/App-*.js', async route => {
      delayed = true;
      await chunkGate;
      await route.continue();
    });
    await page.goto(base, {waitUntil:'domcontentloaded'});
    const boot = page.getByTestId('app-boot');
    await boot.waitFor();
    assert.equal(await boot.getAttribute('data-stage'), 'app');
    await boot.getByRole('button', {name:'Muat ulang', exact:true}).waitFor({timeout:12000});
    assert.equal(delayed, true);
    assert.equal(await boot.getByText('Pemuatan lebih lama dari biasanya.', {exact:true}).isVisible(), true);
    assert.equal(await page.evaluate(() => localStorage.getItem('startup-safe-fixture')), 'unchanged');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.ok((await boot.getByRole('button',{name:'Muat ulang',exact:true}).boundingBox()).height >= 44);
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await boot.locator('.app-boot-progress span').evaluate(node => getComputedStyle(node).animationName), 'none');
    await page.evaluate(() => {
      Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});
      window.dispatchEvent(new Event('offline'));
    });
    await boot.getByText('Koneksi internet terputus.', {exact:true}).waitFor();
    await page.screenshot({path:`.e2e-artifacts/startup-offline-${width}.png`});
    await page.evaluate(() => {
      Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>true});
      window.dispatchEvent(new Event('online'));
    });
    await boot.getByText('Membuka AturDuitku...', {exact:true}).waitFor();
    await page.screenshot({path:`.e2e-artifacts/startup-slow-chunk-${width}.png`});
    releaseChunk();
    await page.locator('.public-site').waitFor({timeout:30000});
    assert.equal(await boot.count(), 0);
    await page.locator('.public-login').click();
    await page.getByPlaceholder('Email').waitFor();
    await page.reload();
    await page.getByPlaceholder('Email').waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('startup-safe-fixture')), 'unchanged');
    assert.deepEqual(errors, []);
    assert.deepEqual(financialWrites, []);
    console.log(`PASS startup ${width}: delayed app chunk, offline/online, recovery help, reduced motion, login/reload, no storage reset or financial writes`);
    await context.close();
  }
  const recoveryContext = await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  const recoveryPage = await recoveryContext.newPage();
  await recoveryContext.route('**/api/**', route => route.fulfill({json:{ok:true}}));
  await recoveryPage.addInitScript(() => localStorage.setItem('startup-safe-fixture','unchanged'));
  let appRequests = 0;
  await recoveryPage.route('**/assets/App-*.js', route => ++appRequests === 1 ? route.abort('failed') : route.continue());
  await recoveryPage.goto(base,{waitUntil:'domcontentloaded'});
  await recoveryPage.locator('.public-site').waitFor({timeout:30000});
  assert.equal(appRequests,2,'Expired app chunk should retry through one safe reload');
  assert.equal(await recoveryPage.evaluate(() => localStorage.getItem('startup-safe-fixture')),'unchanged');
  console.log('PASS failed application chunk: automatic recovery without clearing user storage');
  await recoveryContext.close();
} finally { await browser.close(); }
