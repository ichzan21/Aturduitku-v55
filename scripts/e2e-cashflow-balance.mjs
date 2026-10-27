import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { cashflowBalanceTransactions, cashflowBalanceWallets } from './cashflow-balance-fixture.mjs';

if(!process.env.E2E_EMAIL||!process.env.E2E_PASSWORD) throw new Error('QA credentials required');
const base=process.env.E2E_BASE_URL||'http://127.0.0.1:5187';
await mkdir('.e2e-artifacts',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  for(const width of [390,1440]) {
    const context=await browser.newContext({viewport:{width,height:900},locale:'id-ID',timezoneId:'Asia/Makassar'});
    const page=await context.newPage();
    await page.clock.setFixedTime(new Date('2026-10-28T10:00:00+08:00'));
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    let cloud={version:1,onboarded:true,updatedAt:new Date().toISOString(),data:{
      name:'QA Arus Kas',bulan:'Oktober',tahun:'2026',
      dompet:structuredClone(cashflowBalanceWallets),txs:structuredClone(cashflowBalanceTransactions),
      budgets:[],goals:[],utang:[],asetTetap:[],amplop:[],habits:[],recurring:[],processedRecurring:{},
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
    const navigate=async()=>width<900
      ? page.locator('.bottom-nav').getByRole('button',{name:/Transaksi/}).click()
      : page.getByText('Transaksi',{exact:true}).first().click();
    await page.goto(`${base}/#login`,{waitUntil:'domcontentloaded'});
    await page.getByPlaceholder('Email').fill(process.env.E2E_EMAIL);
    await page.getByPlaceholder('Password').fill(process.env.E2E_PASSWORD);
    await page.getByRole('button',{name:'Masuk dengan Email',exact:true}).click();
    await page.getByTestId('page-title').waitFor({timeout:45000});
    for(const name of ['Nanti dulu','Nanti']) {
      const button=page.getByRole('button',{name,exact:true});
      if(await button.isVisible().catch(()=>false)) await button.click();
    }
    await navigate();
    const summary=page.getByTestId('transaction-summary');
    const explanation=page.getByTestId('cashflow-balance-explanation');
    const assertNet=async value=>{
      await summary.getByText('Arus kas bersih',{exact:true}).locator('..').locator(`[data-animated-number="${value}"]`).waitFor();
    };
    await assertNet(2500000);
    assert.match(await page.getByTestId('transaction-summary-period').innerText(),/Semua tanggal/);
    assert.equal(await summary.getByText('Bukan saldo dompet',{exact:true}).count(),1);
    await explanation.locator('summary').focus();
    await explanation.locator('summary').press('Enter');
    assert.notEqual(await explanation.getAttribute('open'),null,'Explanation must work from the keyboard');
    assert.match(await page.getByTestId('cashflow-current-wallet-balance').innerText(),/3\.975\.000/);
    await page.getByRole('button',{name:'Bulan ini',exact:true}).click();
    await assertNet(2000000);
    assert.match(await explanation.innerText(),/28 Okt 2026/);
    assert.match(await explanation.innerText(),/Rp 3\.000\.000[\s\S]*Rp 800\.000[\s\S]*Rp 200\.000[\s\S]*Rp 2\.000\.000/);
    await page.waitForTimeout(700);
    await summary.screenshot({path:`.e2e-artifacts/cashflow-summary-${width}.png`});
    await explanation.screenshot({path:`.e2e-artifacts/cashflow-explanation-${width}.png`});
    const layout=await explanation.evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));
    assert.ok(layout.scroll<=layout.width+1);
    await page.getByLabel('Filter tipe transaksi',{exact:true}).selectOption('pengeluaran');
    await assertNet(-800000);
    assert.match(await page.getByTestId('transaction-summary-period').innerText(),/Sesuai filter aktif/);
    assert.match(await page.getByTestId('cashflow-current-wallet-balance').innerText(),/3\.975\.000/);
    await page.getByRole('button',{name:'Reset',exact:true}).click();
    await page.getByLabel('Filter dompet',{exact:true}).selectOption('bank');
    await assertNet(0);
    await page.getByRole('button',{name:'Reset',exact:true}).click();
    await page.getByPlaceholder(/Cari transaksi/).fill('Gaji Oktober');
    await assertNet(3000000);
    await page.getByPlaceholder(/Cari transaksi/).fill('no result qa');
    await assertNet(0);
    await page.getByRole('button',{name:'Reset',exact:true}).click();
    await assertNet(2500000);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.getByTestId('page-title').waitFor();
    await navigate();
    await assertNet(2500000);
    assert.deepEqual(cloud.data.dompet.map(w=>({id:w.id,saldo:w.saldo})),cashflowBalanceWallets.map(w=>({id:w.id,saldo:w.saldo})));
    assert.equal(cloud.data.txs.length,cashflowBalanceTransactions.length);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    assert.deepEqual(errors,[]);
    console.log(`PASS cashflow vs balance ${width}: opening balances, savings, receivables, adjustments, all/month/type/wallet/search/empty filters, keyboard details, reload, no balance changes`);
    await context.close();
  }
} finally {await browser.close();}
