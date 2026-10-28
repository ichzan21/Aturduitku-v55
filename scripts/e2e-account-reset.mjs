import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { assertAccountResetIntent, assertDataVersion } from '../api/_lib/dataVersion.js';

if(!process.env.E2E_EMAIL||!process.env.E2E_PASSWORD) throw new Error('QA credentials required');
const base=process.env.E2E_BASE_URL||'http://127.0.0.1:5188';
const scenarios=(process.env.E2E_RESET_SCENARIOS||'success,server-failure,conflict,storage-blocked,in-flight-save,lost-response').split(',');
await mkdir('.e2e-artifacts',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  for(const width of [390,1440]) for(const scenario of scenarios) {
    const context=await browser.newContext({viewport:{width,height:900},locale:'id-ID',timezoneId:'Asia/Makassar'});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const original={name:'QA Reset',bulan:'Oktober',tahun:'2026',dompet:[{id:'cash',nama:'Tunai QA',tipe:'Tunai',icon:'CASH',saldo:'800000'}],
      txs:[{id:1,tipe:'pengeluaran',jml:'200000',tgl:'2026-10-28',ket:'Pengeluaran QA',dompetId:'cash'}],
      budgets:[],utang:[],goals:[],asetTetap:[],amplop:[],habits:[],recurring:[],processedRecurring:{}};
    let cloud={data:structuredClone(original),onboarded:true,version:7,updatedAt:new Date().toISOString()};
    let mode=scenario,committed=0,resetRequests=0,ordinaryHeld=false,lastMutation='';
    let releaseReset;
    const resetGate=new Promise(resolve=>{releaseReset=resolve;});
    let releaseOrdinary,ordinaryStarted;
    const ordinaryGate=new Promise(resolve=>{releaseOrdinary=resolve;});
    const ordinaryReady=new Promise(resolve=>{ordinaryStarted=resolve;});
    await page.route('**/api/**',async route=>{
      const request=route.request(),path=new URL(request.url()).pathname;
      if(path==='/api/users/me') {
        const uid=JSON.parse(Buffer.from(request.headers().authorization.slice(7).split('.')[1],'base64url').toString()).sub;
        return route.fulfill({json:{profile:{uid,approvalStatus:'approved',role:'user',paymentStatus:'paid'},cloud}});
      }
      if(path==='/api/users/data') {
        if(request.method()==='GET') return route.fulfill({json:cloud});
        const body=request.postDataJSON();
        if(body.confirmedReset) {
          resetRequests++;
          assert.equal(body.onboarded,false);
          assert.equal(body.data.txs.length,0);
          assert.notEqual(body.force,true,'Reset must retain conflict protection');
          if(mode==='server-failure') return route.fulfill({status:500,json:{error:'QA unavailable'}});
          if(mode==='conflict') return route.fulfill({status:409,json:{error:'QA changed',code:'DATA_CONFLICT',currentVersion:cloud.version+1}});
          await resetGate;
        } else if(scenario==='in-flight-save'&&!ordinaryHeld) {
          ordinaryHeld=true;
          ordinaryStarted();
          await ordinaryGate;
        }
        if(lastMutation!==body.mutationId) {
          try {
            assertDataVersion(cloud.version,body.baseVersion);
            assertAccountResetIntent({data:cloud.data,onboarded:cloud.onboarded},body);
          } catch(error) {return route.fulfill({status:error.status,json:{error:error.message,code:error.code,currentVersion:cloud.version}});}
          cloud={...cloud,data:body.data,onboarded:body.onboarded,version:cloud.version+1,updatedAt:new Date().toISOString()};
          lastMutation=body.mutationId;
          if(body.confirmedReset) {
            cloud.confirmedResetVersion=cloud.version;
            committed++;
            if(mode==='lost-response') {mode='success';return route.abort('failed');}
          }
        }
        return route.fulfill({json:{ok:true,version:cloud.version,updatedAt:cloud.updatedAt}});
      }
      return route.fulfill({json:{ok:true}});
    });
    await page.goto(`${base}/#login`,{waitUntil:'domcontentloaded'});
    await page.getByPlaceholder('Email').fill(process.env.E2E_EMAIL);
    await page.getByPlaceholder('Password').fill(process.env.E2E_PASSWORD);
    await page.getByRole('button',{name:'Masuk dengan Email',exact:true}).click();
    await page.getByTestId('page-title').waitFor({timeout:45000});
    for(const name of ['Nanti dulu','Nanti']) {
      const button=page.getByRole('button',{name,exact:true});
      if(await button.isVisible().catch(()=>false)) await button.click();
    }
    if(width<900) {
      await page.locator('.bottom-nav').getByRole('button',{name:/Lainnya/}).click();
      await page.getByRole('dialog',{name:'Menu lainnya'}).getByRole('button',{name:/Setting/}).click();
    } else await page.getByText('Setting',{exact:true}).first().click();
    await page.getByRole('button',{name:'Reset semua data',exact:true}).click();
    const panel=page.getByTestId('account-reset-dialog');
    const submit=panel.getByRole('button',{name:'Reset data keuangan',exact:true});
    assert.equal(await submit.isEnabled(),false);
    await panel.getByLabel('Konfirmasi reset',{exact:true}).fill('reset');
    assert.equal(await submit.isEnabled(),false,'Confirmation must be explicit');
    await panel.getByRole('button',{name:'Batal',exact:true}).click();
    await panel.waitFor({state:'hidden'});
    assert.equal(committed,0,'Cancel must not reset anything');
    await page.getByRole('button',{name:'Reset semua data',exact:true}).click();
    if(scenario==='success') {
      const downloadPromise=page.waitForEvent('download');
      await panel.getByRole('button',{name:'Unduh backup JSON',exact:true}).click();
      const download=await downloadPromise;
      let json='';
      for await(const chunk of await download.createReadStream()) json+=chunk.toString();
      assert.equal(JSON.parse(json).txs.length,1);
      assert.equal(committed,0,'Downloading a backup must not reset the account');
      await panel.screenshot({path:`.e2e-artifacts/account-reset-confirm-${width}.png`});
    }
    if(scenario==='in-flight-save') await ordinaryReady;
    if(scenario==='storage-blocked') await page.evaluate(()=>{
      const set=Storage.prototype.setItem;
      const remove=Storage.prototype.removeItem;
      Storage.prototype.setItem=function(key,value){if(String(key).startsWith('aturduitku_'))throw new DOMException('QA storage blocked','SecurityError');return set.call(this,key,value);};
      Storage.prototype.removeItem=function(key){if(String(key).startsWith('aturduitku_'))throw new DOMException('QA storage blocked','SecurityError');return remove.call(this,key);};
    });
    await panel.getByLabel('Konfirmasi reset',{exact:true}).fill('RESET');
    await submit.click();
    if(['server-failure','conflict'].includes(scenario)) {
      await panel.getByRole('alert').waitFor();
      assert.match(await panel.getByRole('alert').innerText(),scenario==='conflict'?/Data belum direset/:/Data di aplikasi tetap utuh/);
      assert.equal(committed,0);
      assert.equal(cloud.data.txs.length,1);
      assert.equal(await page.getByText('Halo! Saya AturDuitku',{exact:true}).count(),0,'No setup before server acknowledgement');
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('aturduitku_data')).txs.length),1);
      if(scenario==='conflict') {
        assert.equal(resetRequests,1,'Conflict must not retry as a forced reset');
        assert.deepEqual(errors,[]);
        console.log(`PASS account reset ${width} ${scenario}: explicit error, data preserved, no forced overwrite`);
        await context.close();
        continue;
      }
      assert.equal(resetRequests,3,'Transient failure retries must be bounded');
      mode='success';
      await submit.click();
    }
    await panel.getByRole('status').waitFor();
    assert.equal(await panel.getByRole('button',{name:'Batal',exact:true}).isEnabled(),false);
    assert.equal(await panel.getByLabel('Konfirmasi reset',{exact:true}).isEnabled(),false);
    assert.equal(await page.getByText('Halo! Saya AturDuitku',{exact:true}).count(),0);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('aturduitku_data')).txs.length),1,'Local data must remain until server acknowledges reset');
    if(scenario==='in-flight-save') {assert.equal(resetRequests,0);releaseOrdinary();}
    releaseReset();
    await page.getByTestId('account-reset-success').waitFor({timeout:30000});
    assert.equal(committed,1);
    assert.equal(cloud.onboarded,false);
    assert.equal(cloud.data.txs.length,0);
    assert.ok(cloud.data.dompet.every(wallet=>Number(wallet.saldo)===0));
    if(scenario==='lost-response') assert.equal(resetRequests,2,'A lost acknowledgement retries the same mutation once');
    await page.waitForTimeout(1900);
    assert.equal(cloud.data.txs.length,0,'Older queued saves must not resurrect old data');
    if(scenario==='success') await page.getByTestId('account-reset-success').screenshot({path:`.e2e-artifacts/account-reset-success-${width}.png`});
    // Remove the device marker to verify server-confirmed reset on another storage context.
    if(scenario!=='storage-blocked') await page.evaluate(()=>localStorage.removeItem('aturduitku_confirmed_reset'));
    await page.reload({waitUntil:'domcontentloaded'});
    await page.getByText('Halo! Saya AturDuitku',{exact:true}).waitFor({timeout:30000});
    assert.equal(await page.getByTestId('account-backup-recovery').count(),0);
    assert.equal(cloud.data.txs.length,0);
    if(scenario==='success') {
      await page.getByRole('button',{name:'Mulai Setup',exact:true}).click();
      await page.getByPlaceholder('Masukkan namamu...').fill('QA Setup Baru');
      await page.getByRole('button',{name:'Lanjut →',exact:true}).click();
      await page.getByPlaceholder('Saldo Awal',{exact:true}).first().waitFor();
      await page.getByRole('button',{name:'Lanjut →',exact:true}).click();
      await page.getByRole('button',{name:'Mulai Pakai!',exact:true}).click();
      await page.getByTestId('page-title').waitFor();
      await page.waitForTimeout(1900);
      assert.equal(cloud.onboarded,true);
      assert.equal(cloud.data.name,'QA Setup Baru');
      assert.equal(cloud.data.txs.length,0);
      assert.ok(cloud.version>cloud.confirmedResetVersion,'Finishing new setup supersedes the reset marker');
    }
    assert.deepEqual(errors,[]);
    console.log(`PASS account reset ${width} ${scenario}: typed confirmation, server-first, account retained, empty cloud persists, no old-data resurrection`);
    await context.close();
  }
} finally {await browser.close();}
