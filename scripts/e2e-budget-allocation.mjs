import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

if (!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD) throw new Error('QA credentials required');
const base=process.env.E2E_BASE_URL||'http://127.0.0.1:5186';
await mkdir('.e2e-artifacts',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  for (const width of [390,1440]) {
    const context=await browser.newContext({viewport:{width,height:900},locale:'id-ID',timezoneId:'Asia/Makassar'});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    let cloud={version:1,onboarded:true,updatedAt:new Date().toISOString(),data:{
      name:'QA Budget',bulan:'Oktober',tahun:'2026',dompet:[{id:'cash',nama:'Tunai QA',saldo:'500000',tipe:'Tunai',icon:'CASH'}],
      budgets:[
        {id:'transport',kat:'Transportasi',icon:'CAR',kelas:'Kebutuhan',alokasi:'200000',sub:[{nama:'Ganti Oli',alokasi:'100000',emoji:'CAR'}]},
        {id:'over',kat:'Jajan Adik Zein',icon:'CASH',kelas:'Keinginan',alokasi:'500000',sub:[]},
        {id:'zero',kat:'Tanpa Alokasi',icon:'ETC',kelas:'Kebutuhan',alokasi:'0',sub:[]},
      ],
      txs:[
        {id:1,tipe:'pengeluaran',katId:'transport',jml:'75000',tgl:'2026-10-27',ket:'Pengeluaran',dompetId:'cash'},
        {id:2,tipe:'pengeluaran',katId:'transport',jml:'100000',tgl:'2026-10-11',ket:'Ganti oli',subKat:'Ganti Oli',dompetId:'cash'},
        {id:3,tipe:'pengeluaran',katId:'transport',jml:'36000',tgl:'2026-10-02',ket:'Bensin',dompetId:'cash'},
        {id:4,tipe:'pengeluaran',katId:'over',jml:'596000',tgl:'2026-10-10',ket:'Jajan',dompetId:'cash'},
      ],utang:[],goals:[],asetTetap:[],amplop:[],habits:[],recurring:[],processedRecurring:{},
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
      ? page.locator('.bottom-nav').getByRole('button',{name:/Budget/}).click()
      : page.getByText('Budget',{exact:true}).first().click();
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
    const card=name=>page.getByTestId('budget-category-card').filter({has:page.getByText(name,{exact:true})});
    const transport=card('Transportasi');
    await transport.getByTestId('budget-total-allocation').waitFor();
    assert.match(await transport.getByTestId('budget-total-allocation').innerText(),/Rp 300\.000[\s\S]*Rp 200\.000 utama \+ Rp 100\.000 subkategori/);
    assert.match(await transport.getByTestId('budget-usage-summary').innerText(),/70% terpakai[\s\S]*Sisa: Rp 89\.000/);
    await transport.getByRole('button',{name:/3 transaksi/}).click();
    assert.equal(await transport.getByText('Transaksi pembentuk realisasi',{exact:true}).count(),1);
    assert.equal(await transport.getByText('Bensin',{exact:true}).count(),1);
    const over=card('Jajan Adik Zein');
    assert.match(await over.getByTestId('budget-usage-summary').innerText(),/119% terpakai[\s\S]*Lebih: Rp 96\.000/);
    assert.equal(await over.getByText('Over',{exact:true}).count(),1);
    await transport.screenshot({path:`.e2e-artifacts/budget-allocation-${width}.png`});
    await over.screenshot({path:`.e2e-artifacts/budget-over-${width}.png`});
    await transport.getByRole('textbox').fill('100000');
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('aturduitku_data')).budgets[0].alokasi==='100000');
    assert.match(await transport.getByTestId('budget-usage-summary').innerText(),/106% terpakai[\s\S]*Lebih: Rp 11\.000/);
    await page.waitForTimeout(1900);
    await page.reload({waitUntil:'domcontentloaded'});
    await page.getByTestId('page-title').waitFor();
    await navigate();
    await card('Transportasi').getByTestId('budget-total-allocation').waitFor();
    assert.match(await card('Transportasi').getByTestId('budget-total-allocation').innerText(),/Rp 200\.000/);
    assert.match(await card('Transportasi').getByTestId('budget-usage-summary').innerText(),/Lebih: Rp 11\.000/);
    assert.equal(cloud.data.dompet[0].saldo,'500000','Display and allocation changes must not move wallet money');
    assert.equal(cloud.data.txs.length,4);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
    assert.equal(overflow,false);
    assert.deepEqual(errors,[]);
    console.log(`PASS budget allocation ${width}: additive totals, transaction details, 119% excess, editing, reload, wallets unchanged`);
    await context.close();
  }
} finally {await browser.close();}
