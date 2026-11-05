import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { chromium } from 'playwright-core';
import { createMoneyTools } from '../src/moneyFormat.js';
import { moneyNumber } from '../src/financeLedger.js';

if(!process.env.E2E_EMAIL||!process.env.E2E_PASSWORD) throw new Error('QA credentials required');
const base=process.env.E2E_BASE_URL||'http://127.0.0.1:5197';
const widths=(process.env.E2E_WIDTHS||'320,1440').split(',').map(Number);
const codes=(process.env.E2E_CURRENCIES||'IDR,MYR,SGD,THB,TND').split(',');
await mkdir('.e2e-artifacts',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  for(const width of widths) for(const code of codes) {
    const money=createMoneyTools(code),target=code==='IDR'?200000:code==='TND'?200.125:200.25,expense=code==='IDR'?37500:code==='TND'?37.501:37.5;
    const budget={id:1,kat:'Perawatan QA',kelas:'Kebutuhan',icon:'CARE',alokasi:'0',sub:[
      {nama:'Clothing care',emoji:'CARE',alokasi:'0',tempo:null},
      {nama:'Utensil care',emoji:'HOME',alokasi:'0',tempo:null},
      {nama:'Self care',emoji:'HEAL',alokasi:'0',tempo:'10'},
    ]};
    const previous=structuredClone(budget);previous.sub[0].alokasi='100';
    const txs=[{id:1,tipe:'pengeluaran',tgl:'2026-11-03',jml:expense,ket:'Perawatan QA',dompetId:'cash',katId:1,subKat:'Clothing care'}];
    const wallets=[{id:'cash',nama:'Tunai QA',saldo:'1000000',tipe:'Tunai',icon:'CASH'}];
    let cloud={version:7,onboarded:true,updatedAt:new Date().toISOString(),data:{name:'QA Subkategori',currency:code,bulan:'November',tahun:'2026',budgets:[budget],budgetPeriods:{'2026-10':[previous]},dompet:wallets,txs,goals:[],utang:[],asetTetap:[],amplop:[],habits:[],recurring:[],processedRecurring:{}}};
    const context=await browser.newContext({viewport:{width,height:900},locale:'id-ID',timezoneId:'Asia/Makassar',reducedMotion:'reduce'});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/api/**',async route=>{
      const request=route.request(),path=new URL(request.url()).pathname;
      if(path==='/api/users/me') {
        const uid=JSON.parse(Buffer.from(request.headers().authorization.slice(7).split('.')[1],'base64url').toString()).sub;
        return route.fulfill({json:{profile:{uid,approvalStatus:'approved',role:'user',paymentStatus:'paid'},cloud}});
      }
      if(path==='/api/users/data') {
        if(request.method()==='POST') {
          const body=request.postDataJSON();assert.equal(body.baseVersion,cloud.version);
          cloud={...cloud,data:body.data,onboarded:body.onboarded,version:cloud.version+1,updatedAt:new Date().toISOString()};
        }
        return route.fulfill({json:cloud});
      }
      return route.fulfill({json:{ok:true}});
    });
    const local=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('aturduitku_data')));
    const saved=async()=>{for(let i=0;i<160;i++){if(isDeepStrictEqual(cloud.data,await local()))return;await page.waitForTimeout(100);}assert.fail('Edited subcategory did not synchronize');};
    const navigate=async()=>{if(width<900)await page.locator('.bottom-nav').getByRole('button',{name:/Budget/}).click();else await page.getByText('Budget',{exact:true}).first().click();await page.getByTestId('budget-category-card').waitFor();};
    const input=name=>page.getByLabel(`Alokasi subkategori ${name} (${money.symbol})`,{exact:true});
    await page.goto(`${base}/#login`,{waitUntil:'domcontentloaded'});
    await page.getByPlaceholder('Email').fill(process.env.E2E_EMAIL);await page.getByPlaceholder('Password').fill(process.env.E2E_PASSWORD);
    await page.getByRole('button',{name:'Masuk dengan Email',exact:true}).click();
    await page.getByTestId('page-title').waitFor({timeout:45000});
    for(const name of ['Nanti dulu','Nanti'])if(await page.getByRole('button',{name,exact:true}).isVisible().catch(()=>false))await page.getByRole('button',{name,exact:true}).click();
    await navigate();
    const baseline=await local();
    assert.equal(await input('Clothing care').inputValue(),'0');
    assert.equal(await input('Clothing care').getAttribute('inputmode'),code==='IDR'?'numeric':'decimal');
    await input('Clothing care').fill(String(target));
    await input('Utensil care').fill(code==='IDR'?'1000':'10.5');
    await input('Utensil care').fill('');await input('Utensil care').blur();
    await page.waitForFunction(expected=>{const b=JSON.parse(localStorage.getItem('aturduitku_data')).budgets[0];return Number(String(b.sub[0].alokasi).replace(',','.'))===expected&&b.sub[1].alokasi==='0';},target);
    assert.equal(await input('Clothing care').inputValue(),money.fmtN(target));
    const card=page.getByTestId('budget-category-card');
    assert.ok((await card.getByTestId('budget-total-allocation').innerText()).includes(money.IDR(target)));
    assert.equal(await card.getByRole('button',{name:/1 transaksi/}).count(),1,'Allocation edits do not alter realization');
    assert.ok((await card.getByRole('button',{name:/1 transaksi/}).innerText()).includes(money.IDRs(expense)));
    assert.equal(await card.getByRole('button',{name:'Bayar',exact:true}).count(),1,'Existing bill action stays available');
    await saved();
    const november=structuredClone((await local()).budgets[0]);
    assert.equal(november.alokasi,'0');assert.deepEqual(november.sub[2],baseline.budgets[0].sub[2]);
    await page.getByRole('button',{name:'Bulan budget sebelumnya',exact:true}).click();
    assert.equal(await input('Clothing care').inputValue(),money.fmtN('100'),'October allocation stays unchanged');
    await page.getByRole('button',{name:'Bulan budget berikutnya',exact:true}).click();
    assert.equal(await input('Clothing care').inputValue(),money.fmtN(target));
    await saved();
    assert.deepEqual(cloud.data.budgetPeriods['2026-10'][0],baseline.budgetPeriods['2026-10'][0]);
    assert.deepEqual(cloud.data.txs,baseline.txs);assert.deepEqual(cloud.data.dompet,baseline.dompet);
    await page.evaluate(()=>localStorage.removeItem('aturduitku_data'));await page.reload();await page.getByTestId('page-title').waitFor();await navigate();
    assert.equal(moneyNumber((await local()).budgets[0].sub[0].alokasi),target,'Cloud-only reload restores the edit');
    assert.equal(await input('Clothing care').inputValue(),money.fmtN(target));
    const overflow=await card.evaluate(element=>[element,...element.querySelectorAll('[data-testid="budget-subcategory-row"]'),...element.querySelectorAll('input')].some(node=>node.scrollWidth>node.clientWidth+1));
    assert.equal(overflow,false,'Subcategory names and amount controls must fit');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    await card.screenshot({path:`.e2e-artifacts/subcategory-edit-${code}-${width}.png`});
    assert.deepEqual(errors,[]);
    console.log(`PASS subcategory allocation ${code} ${width}: edit/clear, additive total, unchanged transactions/wallet, October isolation, versioned cloud save/reload, bill action, no overflow`);
    await context.close();
  }
} finally {await browser.close();}
