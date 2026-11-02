import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

if(!process.env.E2E_EMAIL||!process.env.E2E_PASSWORD) throw new Error('QA credentials required');
const base=process.env.E2E_BASE_URL||'http://127.0.0.1:5191';
const quota={error:'Kuota database sedang habis. Data tidak dihapus.',code:'DATABASE_QUOTA_EXCEEDED',retryAfterSeconds:60};
await mkdir('.e2e-artifacts',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  for(const width of [390,1440]) {
    const context=await browser.newContext({viewport:{width,height:900},locale:'id-ID',timezoneId:'Asia/Makassar'});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    let unavailable=true,failUsers=false,failMonitoring=true,profileReads=0,userReads=0,monitoringReads=0,writes=0;
    let cloud={version:7,onboarded:true,updatedAt:new Date().toISOString(),data:{
      name:'QA Admin',bulan:'November',tahun:'2026',budgets:[{id:1,kat:'Transportasi',icon:'MOVE',kelas:'Kebutuhan',alokasi:'500000',sub:[]}],
      dompet:[{id:'cash',nama:'Tunai QA',tipe:'Tunai',icon:'CASH',saldo:'550000'}],
      txs:[{id:1,tipe:'pengeluaran',tgl:'2026-11-01',jml:'1000',ket:'Transaksi QA',dompetId:'cash',katId:1}],
      goals:[],utang:[],asetTetap:[],amplop:[],habits:[],recurring:[],processedRecurring:{},
    }};
    await page.route('**/api/**',async route=>{
      const request=route.request(),path=new URL(request.url()).pathname;
      if(path==='/api/users/me') {
        profileReads++;
        if(unavailable) return route.fulfill({status:503,json:quota});
        const uid=JSON.parse(Buffer.from(request.headers().authorization.slice(7).split('.')[1],'base64url').toString()).sub;
        return route.fulfill({json:{profile:{uid,approvalStatus:'approved',role:'admin',paymentStatus:'paid'},cloud}});
      }
      if(path==='/api/users/data') {
        if(unavailable) return route.fulfill({status:503,json:quota});
        if(request.method()==='POST') {
          const body=request.postDataJSON();
          assert.equal(body.baseVersion,cloud.version);
          writes++;
          cloud={...cloud,data:body.data,onboarded:body.onboarded,version:cloud.version+1,updatedAt:new Date().toISOString()};
        }
        return route.fulfill({json:cloud});
      }
      if(path==='/api/admin/users') {
        userReads++;
        await new Promise(resolve=>setTimeout(resolve,250));
        if(failUsers) return route.fulfill({status:503,json:quota});
        return route.fulfill({json:{users:[{uid:'qa-target',displayName:userReads>2?'QA Updated':'QA Customer',email:'qa@example.invalid',role:'user',approvalStatus:'approved'}],stats:{total:1,approved:1,pending_review:0,rejected:0}}});
      }
      if(path==='/api/admin/monitoring') {
        monitoringReads++;
        if(failMonitoring) return route.fulfill({status:503,json:quota});
        return route.fulfill({json:{generatedAt:new Date().toISOString(),summary:{last24Hours:0,performance1Hour:0,unresolved:0},recent:[],services:{firebase:true}}});
      }
      return route.fulfill({json:{ok:true}});
    });
    const navigate=async name=>{
      if(width>=900) return page.getByText(name,{exact:true}).first().click();
      if(['Home','Budget','Transaksi','Dompet'].includes(name)) return page.locator('.bottom-nav').getByRole('button',{name:new RegExp(name)}).click();
      await page.locator('.bottom-nav').getByRole('button',{name:/Lainnya/}).click();
      await page.getByRole('dialog',{name:'Menu lainnya'}).getByRole('button',{name:new RegExp(name)}).click();
    };
    await page.goto(`${base}/#login`,{waitUntil:'domcontentloaded'});
    await page.getByPlaceholder('Email').fill(process.env.E2E_EMAIL);
    await page.getByPlaceholder('Password').fill(process.env.E2E_PASSWORD);
    await page.getByRole('button',{name:'Masuk dengan Email',exact:true}).click();
    await page.getByText('Layanan sedang terganggu',{exact:true}).waitFor({timeout:45000});
    assert.equal(await page.getByText('Butuh bantuan approval?',{exact:true}).count(),0);
    assert.match(await page.locator('body').innerText(),/bukan penolakan akun atau hilangnya akses admin/);
    assert.equal(writes,0);
    await page.screenshot({path:`.e2e-artifacts/database-quota-${width}.png`});
    await page.clock.install();
    await page.clock.fastForward(125000);
    assert.equal(profileReads,1,'Unavailable status must not poll the exhausted database');
    assert.equal(writes,0,'Failed bootstrap must never initialize or save empty finances');
    unavailable=false;
    await page.getByRole('button',{name:'Cek status lagi',exact:true}).click();
    await page.getByTestId('page-title').waitFor();
    await page.clock.resume();
    for(const name of ['Nanti dulu','Nanti']) {
      const button=page.getByRole('button',{name,exact:true});
      if(await button.isVisible().catch(()=>false)) await button.click();
    }
    await page.waitForTimeout(2500);
    assert.equal(writes,0,'Loading unchanged server data must not trigger an autosave');
    await navigate('Admin');
    const usersPanel=page.getByText('Kelola User',{exact:true}).locator('../../..');
    await usersPanel.getByText('QA Customer',{exact:true}).waitFor();
    const initialUserReads=userReads;
    failUsers=true;
    await usersPanel.getByRole('button',{name:'Refresh',exact:true}).click();
    await usersPanel.getByRole('alert').waitFor();
    assert.match(await usersPanel.getByRole('alert').innerText(),/Kuota database[\s\S]*Daftar terakhir tetap ditampilkan/);
    assert.equal(await usersPanel.getByText('QA Customer',{exact:true}).count(),1,'A failed refresh must preserve the previous list');
    assert.equal(userReads,initialUserReads+1);
    failUsers=false;
    await usersPanel.getByRole('button',{name:'Refresh',exact:true}).click();
    await usersPanel.getByText('QA Updated',{exact:true}).waitFor();
    assert.equal(await usersPanel.getByRole('alert').count(),0);
    await usersPanel.screenshot({path:`.e2e-artifacts/admin-refresh-recovered-${width}.png`});
    const monitoringPanel=page.locator('section').filter({has:page.getByText('Kesehatan aplikasi',{exact:true})});
    assert.equal(monitoringReads,1,'Monitoring quota failure must not retry three times');
    failMonitoring=false;
    await monitoringPanel.getByRole('button',{name:'Refresh',exact:true}).click();
    await monitoringPanel.getByText('Terhubung',{exact:true}).waitFor();
    assert.equal(monitoringReads,2);
    await navigate('Budget');
    await page.getByTestId('budget-category-card').getByRole('textbox').fill('300000');
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('aturduitku_data')).budgets[0].alokasi==='300000');
    await page.waitForTimeout(2400);
    assert.equal(writes,1,'A real edit must still be saved exactly once');
    assert.equal(cloud.data.budgets[0].alokasi,'300000');
    assert.equal(cloud.data.dompet[0].saldo,'550000');
    assert.equal(cloud.data.txs.length,1);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    assert.deepEqual(errors,[]);
    console.log(`PASS quota/admin ${width}: no false approval, no polling storm, safe recovery, zero idle saves, refresh failure/recovery, monitoring retry control, real edit still saved`);
    await context.close();
  }
} finally {await browser.close();}
