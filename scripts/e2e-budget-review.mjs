import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { reviewBudgets, reviewTransactions } from './budget-review-fixture.mjs';

if(!process.env.E2E_EMAIL||!process.env.E2E_PASSWORD) throw new Error('QA credentials required');
const base=process.env.E2E_BASE_URL||'http://127.0.0.1:5189';
await mkdir('.e2e-artifacts',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  for(const width of [390,1440]) {
    const context=await browser.newContext({viewport:{width,height:900},locale:'id-ID',timezoneId:'Asia/Makassar'});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    let cloud={version:7,onboarded:true,updatedAt:new Date().toISOString(),data:{
      name:'QA Budget Review',bulan:'Oktober',tahun:'2026',budgets:structuredClone(reviewBudgets),txs:structuredClone(reviewTransactions),
      dompet:[{id:'cash',nama:'Tunai QA',tipe:'Tunai',icon:'CASH',saldo:'2000000'},{id:'bank',nama:'Bank QA',tipe:'Bank',icon:'BANK',saldo:'500000'}],
      goals:[],utang:[],asetTetap:[],amplop:[],habits:[],recurring:[],processedRecurring:{},
    }};
    await page.route('**/api/**',async route=>{
      const request=route.request(),path=new URL(request.url()).pathname;
      if(path==='/api/users/me') {
        const uid=JSON.parse(Buffer.from(request.headers().authorization.slice(7).split('.')[1],'base64url').toString()).sub;
        return route.fulfill({json:{profile:{uid,approvalStatus:'approved',role:'user',paymentStatus:'paid'},cloud}});
      }
      if(path==='/api/users/data') {
        if(request.method()==='POST') {
          const body=request.postDataJSON();
          cloud={...cloud,data:body.data,onboarded:body.onboarded,version:cloud.version+1,updatedAt:new Date().toISOString()};
        }
        return route.fulfill({json:cloud});
      }
      return route.fulfill({json:{ok:true}});
    });
    const navigate=async name=>width<900
      ? page.locator('.bottom-nav').getByRole('button',{name:new RegExp(name)}).click()
      : page.getByText(name,{exact:true}).first().click();
    const rows=page.getByTestId('transaction-row');
    const checkCount=async count=>{
      await page.waitForFunction(expected=>document.querySelectorAll('[data-testid="transaction-row"]').length===expected,count);
      assert.equal(await rows.count(),count);
    };
    const openReview=async expected=>{
      await navigate('Budget');
      await page.getByText(`${expected} transaksi di luar budget`,{exact:true}).waitFor();
      await page.getByRole('button',{name:'Periksa transaksi',exact:true}).click();
      await page.getByTestId('unassigned-budget-review').waitFor();
      await checkCount(expected);
    };
    await page.goto(`${base}/#login`,{waitUntil:'domcontentloaded'});
    await page.getByPlaceholder('Email').fill(process.env.E2E_EMAIL);
    await page.getByPlaceholder('Password').fill(process.env.E2E_PASSWORD);
    await page.getByRole('button',{name:'Masuk dengan Email',exact:true}).click();
    await page.getByTestId('page-title').waitFor({timeout:45000});
    for(const name of ['Nanti dulu','Nanti']) {
      const button=page.getByRole('button',{name,exact:true});
      if(await button.isVisible().catch(()=>false)) await button.click();
    }
    await openReview(4);
    for(const name of ['Donasi sengaja di luar budget','Kategori lama terhapus','Tabungan tanpa kategori','Investasi tanpa kategori']) assert.equal(await rows.filter({hasText:name}).count(),1);
    assert.equal(await rows.filter({hasText:'Belanja sudah masuk budget'}).count(),0);
    await page.getByTestId('unassigned-budget-review').screenshot({path:`.e2e-artifacts/budget-review-${width}.png`});
    await page.getByLabel('Filter tipe transaksi',{exact:true}).selectOption('pengeluaran');
    await checkCount(2);
    await page.getByPlaceholder(/Cari transaksi/).fill('sengaja');
    await checkCount(1);
    await page.getByPlaceholder(/Cari transaksi/).fill('');
    await page.getByLabel('Filter dompet',{exact:true}).selectOption('cash');
    await checkCount(1);
    await page.getByRole('button',{name:'Hapus filter di luar budget',exact:true}).click();
    assert.equal(await page.getByTestId('unassigned-budget-review').count(),0);
    assert.equal(await rows.filter({hasText:'Belanja sudah masuk budget'}).count(),1);
    await openReview(4);
    await page.getByPlaceholder(/Cari transaksi/).fill('no result qa');
    await checkCount(0);
    await page.getByRole('button',{name:'Lihat semua transaksi',exact:true}).click();
    await checkCount(reviewTransactions.length);
    await openReview(4);
    const assignExpense=async()=>{
      await rows.filter({hasText:'Donasi sengaja di luar budget'}).getByRole('button',{name:'Edit nama dan detail transaksi',exact:true}).click();
      const modal=page.locator('.modal-overlay');
      await modal.getByLabel('Kategori transaksi',{exact:true}).selectOption('1');
      await modal.getByRole('button',{name:'Simpan Perubahan',exact:true}).click();
      await checkCount(3);
      await page.waitForTimeout(1900);
    };
    await assignExpense();
    assert.equal(cloud.data.txs.find(tx=>tx.id==='outside').budgetExcluded,false);
    await page.getByTestId('transaction-undo-button').click();
    await checkCount(4);
    await page.waitForTimeout(1900);
    await assignExpense();
    await page.reload({waitUntil:'domcontentloaded'});
    await page.getByTestId('page-title').waitFor();
    await openReview(3);
    assert.equal(cloud.data.dompet[0].saldo,'2000000');
    assert.equal(cloud.data.dompet[1].saldo,'500000');
    assert.equal(cloud.data.txs.length,reviewTransactions.length);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    assert.deepEqual(errors,[]);
    console.log(`PASS budget review ${width}: exact notification match, savings/investments, date/type/wallet/search filters, clear, empty state, category edit, Undo, reload, balances unchanged`);
    await context.close();
  }
} finally {await browser.close();}
