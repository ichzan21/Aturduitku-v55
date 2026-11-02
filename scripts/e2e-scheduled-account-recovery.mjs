import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

if(!process.env.E2E_EMAIL||!process.env.E2E_PASSWORD) throw new Error('QA credentials required');
const base=process.env.E2E_BASE_URL||'http://127.0.0.1:5193';
const quota={error:'Kuota database sedang habis. Data tidak dihapus.',code:'DATABASE_QUOTA_EXCEEDED',retryAfterSeconds:60};
const fixture={
  name:'QA Recovery',bulan:'November',tahun:'2026',
  budgets:[{id:1,kat:'Transportasi',icon:'MOVE',kelas:'Kebutuhan',alokasi:'500000',sub:[]}],
  dompet:[{id:'cash',nama:'Tunai QA',tipe:'Tunai',icon:'CASH',saldo:'550000'}],
  txs:[{id:1,tipe:'pengeluaran',tgl:'2026-11-01',jml:'1000',ket:'Catatan cloud QA',dompetId:'cash',katId:1}],
  goals:[],utang:[],asetTetap:[],amplop:[],habits:[],recurring:[],processedRecurring:{},
};
await mkdir('.e2e-artifacts',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  for(const width of [390,1440]) for(const scenario of ['approved','still-quota','pending','local-conflict']) {
    const context=await browser.newContext({viewport:{width,height:900},locale:'id-ID',timezoneId:'Asia/Makassar'});
    const page=await context.newPage();
    await page.clock.install({time:new Date('2026-11-02T17:00:00+08:00')});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    let recovering=false,profileReads=0,writes=0;
    await page.route('**/api/**',async route=>{
      const request=route.request(),path=new URL(request.url()).pathname;
      if(path==='/api/users/me') {
        profileReads++;
        const uid=JSON.parse(Buffer.from(request.headers().authorization.slice(7).split('.')[1],'base64url').toString()).sub;
        if(profileReads===1&&scenario==='local-conflict') await page.evaluate(({uid,fixture})=>{
          const data=structuredClone(fixture);
          data.dompet[0].saldo='548000';
          data.txs.push({id:2,tipe:'pengeluaran',tgl:'2026-11-02',jml:'2000',ket:'Belum tersinkron QA',dompetId:'cash',katId:1});
          localStorage.setItem('aturduitku_last_uid',uid);
          localStorage.setItem('aturduitku_data',JSON.stringify(data));
          localStorage.setItem('aturduitku_onboarded','1');
        },{uid,fixture});
        if(!recovering) return route.fulfill({status:503,json:quota});
        const profile={uid,approvalStatus:scenario==='pending'?'pending_review':'approved',role:'user',paymentStatus:'paid'};
        return route.fulfill({json:{profile,cloud:{version:7,onboarded:true,updatedAt:'2026-11-02T08:00:00Z',data:fixture}}});
      }
      if(request.method()!=='GET'&&path==='/api/users/data') writes++;
      return route.fulfill({json:{ok:true}});
    });
    await page.goto(`${base}/#login`,{waitUntil:'domcontentloaded'});
    await page.getByPlaceholder('Email').fill(process.env.E2E_EMAIL);
    await page.getByPlaceholder('Password').fill(process.env.E2E_PASSWORD);
    await page.getByRole('button',{name:'Masuk dengan Email',exact:true}).click();
    await page.getByText('Layanan sedang terganggu',{exact:true}).waitFor({timeout:45000});
    await page.getByText(/Pemulihan diperiksa otomatis/).waitFor();
    await page.clock.pauseAt(new Date('2026-11-02T17:00:30+08:00'));
    assert.equal(profileReads,1);
    if(scenario==='still-quota') {
      const next=page.waitForResponse(response=>response.url().includes('/api/users/me')&&response.status()===503);
      await page.clock.fastForward(65000);
      await next;
      await page.getByText('Layanan sedang terganggu',{exact:true}).waitFor();
      assert.equal(profileReads,2,'Only one gradual retry after the cooldown');
      await page.clock.fastForward(30000);
      assert.equal(profileReads,2,'Persistent quota failure must back off');
    }
    recovering=true;
    const next=page.waitForResponse(response=>response.url().includes('/api/users/me')&&response.status()===200);
    await page.clock.fastForward(scenario==='still-quota'?60000:65000);
    await next;
    if(scenario==='pending') {
      await page.getByText('Menunggu approval admin',{exact:true}).waitFor();
      assert.equal(await page.getByTestId('page-title').count(),0,'Recovery must never bypass approval');
    } else if(scenario==='local-conflict') {
      await page.getByText('Periksa catatan setelah gangguan',{exact:true}).waitFor();
      const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('aturduitku_data')));
      assert.equal(data.txs.length,2,'Unsynced transactions must remain on device');
      assert.equal(data.dompet[0].saldo,'548000');
    } else {
      await page.getByTestId('page-title').filter({hasText:'Home'}).waitFor();
      const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('aturduitku_data')));
      assert.equal(data.txs.length,1);
      assert.equal(data.dompet[0].saldo,'550000');
      assert.equal(await page.getByText('Layanan sedang terganggu',{exact:true}).count(),0);
    }
    await page.clock.fastForward(5000);
    assert.equal(writes,0,'Recovery must not write empty or unchanged finances');
    assert.deepEqual(errors,[]);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    if(scenario==='local-conflict') await page.screenshot({path:`.e2e-artifacts/recovery-local-protected-${width}.png`});
    console.log(`PASS scheduled recovery ${scenario} ${width}: verified server response, safe account access, no financial writes`);
    await context.close();
  }
} finally {await browser.close();}
