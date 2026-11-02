import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { listAdminUsers, invalidateAdminDirectory } from '../api/_lib/adminUserDirectory.js';
import { directoryFixture } from './helpers/admin-directory-fixture.mjs';

if(!process.env.E2E_EMAIL||!process.env.E2E_PASSWORD) throw new Error('QA credentials required');
const base=process.env.E2E_BASE_URL||'http://127.0.0.1:5194';
await mkdir('.e2e-artifacts',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  for(const width of [390,1440]) {
    const context=await browser.newContext({viewport:{width,height:900},locale:'id-ID'});
    const page=await context.newPage(),fixture=directoryFixture(),errors=[];
    fixture.records[1199].value.orderId='ORDER-1199';
    let adminCalls=0,financialWrites=0,fail=false,delay=false;
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/api/**',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.pathname==='/api/users/me') {
        const uid=JSON.parse(Buffer.from(request.headers().authorization.slice(7).split('.')[1],'base64url').toString()).sub;
        return route.fulfill({json:{profile:{uid,approvalStatus:'approved',role:'admin',paymentStatus:'paid'},cloud:{version:7,onboarded:true,updatedAt:new Date().toISOString(),data:{name:'QA Admin',bulan:'November',tahun:'2026',dompet:[{id:'cash',nama:'Tunai QA',saldo:'100000',tipe:'Tunai',icon:'CASH'}],txs:[{id:1,tipe:'pemasukan',jml:'100000',tgl:'2026-11-01',ket:'QA',dompetId:'cash'}],budgets:[],goals:[],utang:[],asetTetap:[],amplop:[],habits:[],recurring:[],processedRecurring:{}}}}});
      }
      if(url.pathname==='/api/admin/users') {
        adminCalls++;
        if(request.method()==='POST') {
          const body=request.postDataJSON(),record=fixture.records.find(record=>record.id===body.uid);
          record.value.approvalStatus=body.approvalStatus;
          invalidateAdminDirectory(fixture.db);
          return route.fulfill({json:{ok:true,user:{uid:record.id,...record.value,data:undefined}}});
        }
        if(fail) return route.fulfill({status:503,json:{code:'DATABASE_QUOTA_EXCEEDED',error:'Kuota database sedang habis',retryAfterSeconds:60}});
        if(delay&&url.searchParams.get('status')==='all') await new Promise(resolve=>setTimeout(resolve,500));
        return route.fulfill({json:await listAdminUsers(fixture.db,Object.fromEntries(url.searchParams))});
      }
      if(url.pathname==='/api/admin/monitoring') return route.fulfill({json:{generatedAt:new Date().toISOString(),summary:{last24Hours:0,performance1Hour:0,unresolved:0},recent:[],services:{firebase:true}}});
      if(url.pathname==='/api/users/data'&&request.method()==='POST') financialWrites++;
      return route.fulfill({json:{ok:true}});
    });
    await page.goto(`${base}/#login`,{waitUntil:'domcontentloaded'});
    await page.getByPlaceholder('Email').fill(process.env.E2E_EMAIL);
    await page.getByPlaceholder('Password').fill(process.env.E2E_PASSWORD);
    await page.getByRole('button',{name:'Masuk dengan Email',exact:true}).click();
    await page.getByTestId('page-title').filter({hasText:'Home'}).waitFor({timeout:45000});
    for(const name of ['Nanti dulu','Nanti']) if(await page.getByRole('button',{name,exact:true}).isVisible().catch(()=>false)) await page.getByRole('button',{name,exact:true}).click();
    await page.waitForTimeout(500);
    assert.equal(adminCalls,0,'Home must not load the admin directory');
    if(width<900) {
      await page.locator('.bottom-nav').getByRole('button',{name:/Lainnya/}).click();
      await page.getByRole('dialog',{name:'Menu lainnya'}).getByRole('button',{name:/Admin/}).click();
    } else await page.getByText('Admin',{exact:true}).first().click();
    const panel=page.getByText('Kelola User',{exact:true}).locator('../../..');
    await panel.getByText('Customer 0',{exact:true}).waitFor();
    assert.equal(fixture.usage.reads,9);
    assert.equal(await panel.getByRole('button',{name:'Tandai bayar',exact:true}).count(),0);
    await panel.getByRole('button',{name:'Berikutnya',exact:true}).click();
    await panel.getByText('Customer 8',{exact:true}).waitFor();
    assert.equal(await panel.getByText('Customer 0',{exact:true}).count(),0);
    await panel.getByRole('button',{name:'Sebelumnya',exact:true}).click();
    await panel.getByText('Customer 0',{exact:true}).waitFor();
    assert.equal(fixture.usage.reads,18,'Returning to a recent page uses the short server cache');
    const calls=adminCalls;
    await panel.getByLabel('Pencarian pengguna',{exact:true}).fill('user01199');
    await page.waitForTimeout(500);
    assert.equal(adminCalls,calls,'Typing alone must not read Firestore');
    await panel.getByRole('button',{name:'Cari pengguna',exact:true}).click();
    await panel.getByText('Customer 1199',{exact:true}).waitFor();
    await panel.getByLabel('Cari pengguna berdasarkan',{exact:true}).selectOption('name');
    await panel.getByLabel('Pencarian pengguna',{exact:true}).fill('Customer 1199');
    await panel.getByLabel('Pencarian pengguna',{exact:true}).press('Enter');
    await panel.getByText('Customer 1199',{exact:true}).waitFor();
    await panel.getByLabel('Cari pengguna berdasarkan',{exact:true}).selectOption('order');
    await panel.getByLabel('Pencarian pengguna',{exact:true}).fill('ORDER-1199');
    await panel.getByLabel('Pencarian pengguna',{exact:true}).press('Enter');
    await panel.getByText('Customer 1199',{exact:true}).waitFor();
    await panel.getByLabel('Cari pengguna berdasarkan',{exact:true}).selectOption('email');
    await panel.getByRole('button',{name:'Hapus pencarian',exact:true}).click();
    await panel.getByText('Customer 0',{exact:true}).waitFor();
    await panel.getByRole('button',{name:'Menunggu',exact:true}).click();
    await panel.getByText('Customer 0',{exact:true}).waitFor();
    const user=panel.getByText('Customer 0',{exact:true}).locator('../../../..');
    await user.getByRole('button',{name:'Aktifkan',exact:true}).first().click();
    await panel.getByText('Customer 24',{exact:true}).waitFor();
    assert.equal(await panel.getByText('Customer 0',{exact:true}).count(),0,'Approved user leaves the pending list');
    assert.equal(fixture.records[0].value.approvalStatus,'approved');
    fail=true;
    await panel.getByRole('button',{name:'Refresh',exact:true}).click();
    await panel.getByRole('alert').waitFor();
    assert.equal(await panel.getByText('Customer 3',{exact:true}).count(),1,'Failed refresh preserves last successful page');
    fail=false;
    await panel.getByRole('button',{name:'Refresh',exact:true}).click();
    await panel.getByRole('alert').waitFor({state:'hidden'});
    await panel.getByRole('button',{name:'Semua',exact:true}).click();
    await panel.getByText('Customer 0',{exact:true}).waitFor();
    delay=true;
    await panel.getByLabel('Pencarian pengguna',{exact:true}).fill('user000');
    await panel.getByLabel('Pencarian pengguna',{exact:true}).press('Enter');
    await panel.getByRole('button',{name:'Ditolak',exact:true}).click();
    await panel.getByText('Customer 2',{exact:true}).waitFor();
    await page.waitForTimeout(650);
    assert.equal(await panel.getByText('Customer 0',{exact:true}).count(),0,'Stale all-users response must not replace the current filtered page');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    assert.equal(financialWrites,0);
    assert.deepEqual(errors,[]);
    await panel.screenshot({path:`.e2e-artifacts/admin-directory-${width}.png`});
    console.log(`PASS admin directory ${width}: lazy load, bounded reads, next/previous, explicit search beyond page one, approval, safe failed refresh, stale-response protection, no financial writes`);
    await context.close();
  }
} finally {await browser.close();}
