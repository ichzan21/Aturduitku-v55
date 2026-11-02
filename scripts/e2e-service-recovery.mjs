import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const base=process.env.E2E_BASE_URL||'http://127.0.0.1:5192';
await mkdir('.e2e-artifacts',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  for(const width of [320,390,1440]) for(const reducedMotion of ['no-preference','reduce']) {
    const context=await browser.newContext({viewport:{width,height:900},locale:'id-ID',timezoneId:'Asia/Makassar',reducedMotion});
    const page=await context.newPage();
    const errors=[];
    let apiCalls=0;
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/api/**',route=>{apiCalls++;return route.fulfill({json:{ok:true}});});
    await page.clock.install({time:new Date('2026-11-02T13:30:00+08:00')});
    await page.goto(base,{waitUntil:'domcontentloaded'});
    const notice=page.getByTestId('service-recovery-notice');
    await notice.waitFor({timeout:45000});
    await page.clock.pauseAt(new Date('2026-11-02T13:30:10+08:00'));
    assert.equal(await notice.locator('[data-unit="Jam"]').innerText(),'02');
    assert.equal(await notice.locator('[data-unit="Menit"]').innerText(),'29');
    assert.equal(await notice.locator('[data-unit="Detik"]').innerText(),'50');
    assert.equal(await notice.getByRole('timer').getAttribute('aria-live'),'off','Seconds must not interrupt screen readers');
    assert.match(await notice.innerText(),/Estimasi pemulihan[\s\S]*2 November 2026, 16\.00 WITA/);
    await notice.locator('img').evaluate(img=>img.decode());
    assert.equal(await notice.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0),true);
    const motion=await notice.locator('.service-recovery-tool').evaluate(icon=>getComputedStyle(icon).animationName);
    assert.equal(motion,reducedMotion==='reduce'?'none':'recovery-working');
    const boxes=await notice.locator('.service-recovery-unit').evaluateAll(items=>items.map(item=>({x:item.getBoundingClientRect().x,width:item.getBoundingClientRect().width})));
    await page.clock.fastForward(1000);
    assert.equal(await notice.locator('[data-unit="Detik"]').innerText(),'49');
    assert.deepEqual(await notice.locator('.service-recovery-unit').evaluateAll(items=>items.map(item=>({x:item.getBoundingClientRect().x,width:item.getBoundingClientRect().width}))),boxes,'Ticking must not shift the countdown layout');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    if(reducedMotion==='no-preference') await notice.screenshot({path:`.e2e-artifacts/service-recovery-public-${width}.png`});
    await page.getByRole('link',{name:'Log in',exact:true}).click();
    await page.getByPlaceholder('Email').waitFor();
    assert.equal(await page.getByTestId('service-recovery-notice').count(),1,'The login screen must keep the announcement');
    await page.clock.fastForward(3*60*60*1000);
    await page.getByTestId('service-recovery-checking').waitFor();
    assert.equal(await page.getByTestId('service-recovery-countdown').count(),0);
    assert.match(await notice.innerText(),/Waktu estimasi sudah terlewati[\s\S]*masih memeriksa/);
    assert.doesNotMatch(await notice.innerText(),/Layanan sudah pulih|Semua layanan normal/);
    assert.equal(apiCalls,0,'The countdown must not poll or read the database');
    assert.deepEqual(errors,[]);
    console.log(`PASS recovery notice ${width} ${reducedMotion}: live WITA countdown, stable layout, mascot, public/login coverage, safe expiry, zero database calls`);
    await context.close();
  }
} finally {await browser.close();}
