import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

if(!process.env.E2E_EMAIL||!process.env.E2E_PASSWORD) throw new Error('QA credentials required');
const base=process.env.E2E_BASE_URL||'http://127.0.0.1:5190';
await mkdir('.e2e-artifacts',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  for(const width of [390,1440]) {
    const context=await browser.newContext({viewport:{width,height:900},locale:'id-ID',timezoneId:'Asia/Makassar'});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    let cloud={version:7,onboarded:true,updatedAt:new Date().toISOString(),data:{
      name:'QA Monthly Budget',bulan:'Oktober',tahun:'2026',budgets:[
        {id:1,kat:'Transportasi',icon:'MOVE',kelas:'Kebutuhan',alokasi:'500000',sub:[]},
        {id:2,kat:'Tagihan',icon:'BILL',kelas:'Kebutuhan',alokasi:'100000',sub:[{nama:'Internet',alokasi:'200000',emoji:'NET'}]},
      ],
      dompet:[{id:'cash',nama:'Tunai QA',tipe:'Tunai',icon:'CASH',saldo:'550000'}],
      txs:[{id:1,tipe:'pengeluaran',tgl:'2026-10-10',jml:'450000',ket:'Transportasi Oktober',dompetId:'cash',katId:1},
        {id:2,tipe:'pengeluaran',tgl:'2026-10-11',jml:'2000',ket:'Tagihan Oktober',dompetId:'cash',katId:2}],
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
          assert.equal(body.baseVersion,cloud.version,'Cloud save must retain version protection');
          cloud={...cloud,data:body.data,onboarded:body.onboarded,version:cloud.version+1,updatedAt:new Date().toISOString()};
        }
        return route.fulfill({json:cloud});
      }
      return route.fulfill({json:{ok:true}});
    });
    const navigate=async name=>{
      if(width>=900) return page.getByText(name,{exact:true}).first().click();
      if(['Home','Budget','Transaksi','Dompet'].includes(name)) return page.locator('.bottom-nav').getByRole('button',{name:new RegExp(name)}).click();
      await page.locator('.bottom-nav').getByRole('button',{name:/Lainnya/}).click();
      await page.getByRole('dialog',{name:'Menu lainnya'}).getByRole('button',{name:new RegExp(name)}).click();
    };
    const card=name=>page.getByTestId('budget-category-card').filter({has:page.getByText(name,{exact:true})});
    const local=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('aturduitku_data')));
    const checkPlan=async value=>{
      await page.waitForFunction(expected=>JSON.parse(localStorage.getItem('aturduitku_data'))?.budgets[0].alokasi===expected,value);
      assert.equal(await card('Transportasi').getByRole('textbox').inputValue(),Number(value).toLocaleString('id-ID'));
    };
    const waitSaved=async()=>{
      const deadline=Date.now()+20000;
      while(Date.now()<deadline) {
        if(JSON.stringify(cloud.data)===JSON.stringify(await local())) return;
        await new Promise(resolve=>setTimeout(resolve,250));
      }
      assert.fail('Monthly budget snapshot was not saved');
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
    await navigate('Budget');
    await checkPlan('500000');
    assert.match(await card('Transportasi').getByTestId('budget-usage-summary').innerText(),/90%/);
    await navigate('Home');
    await page.getByRole('button',{name:'Tutup buku',exact:true}).click();
    await page.getByRole('button',{name:'Ya, Lanjutkan',exact:true}).click();
    await page.getByText('Recap Oktober 2026',{exact:true}).waitFor();
    await page.locator('.modal-overlay').getByRole('button',{name:'Tutup',exact:true}).click();
    await navigate('Budget');
    await page.locator('[aria-label="Pilih periode budget"]').getByText('November 2026',{exact:true}).waitFor();
    await card('Transportasi').getByRole('textbox').fill('300000');
    await checkPlan('300000');
    await card('Tagihan').getByRole('button',{name:'Hapus',exact:true}).click();
    await page.getByRole('button',{name:'Ya, Lanjutkan',exact:true}).click();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('aturduitku_data')).budgets.length===1);
    await page.getByRole('button',{name:'Bulan budget sebelumnya',exact:true}).click();
    await checkPlan('500000');
    assert.match(await card('Transportasi').getByTestId('budget-usage-summary').innerText(),/90%[\s\S]*50\.000/);
    assert.match(await card('Tagihan').getByTestId('budget-total-allocation').innerText(),/300\.000[\s\S]*200\.000 subkategori/);
    await card('Transportasi').screenshot({path:`.e2e-artifacts/budget-period-october-${width}.png`});
    await page.getByRole('button',{name:'Bulan budget berikutnya',exact:true}).click();
    await checkPlan('300000');
    assert.equal(await card('Tagihan').count(),0);
    await waitSaved();
    assert.equal(cloud.data.budgetPeriods['2026-10'][0].alokasi,'500000');
    assert.equal(cloud.data.budgetPeriods['2026-11'][0].alokasi,'300000');
    // Reload without the device's financial cache, requiring the cloud snapshot.
    await page.evaluate(()=>localStorage.removeItem('aturduitku_data'));
    await page.reload({waitUntil:'domcontentloaded'});
    await page.getByTestId('page-title').waitFor();
    await navigate('Budget');
    await checkPlan('300000');
    await page.getByRole('button',{name:'Bulan budget sebelumnya',exact:true}).click();
    await checkPlan('500000');
    await page.getByRole('button',{name:'Bulan budget berikutnya',exact:true}).click();
    await checkPlan('300000');
    // Report anchor is independent of the currently active budget month.
    await navigate('Laporan');
    await page.getByLabel('Tanggal acuan laporan',{exact:true}).fill('2026-10-15');
    const performance=page.getByText('Alokasi vs realisasi per kategori',{exact:true}).locator('../../..');
    await performance.scrollIntoViewIfNeeded();
    assert.match(await performance.innerText(),/Transportasi[\s\S]*500rb[\s\S]*450rb[\s\S]*Tagihan/);
    await performance.screenshot({path:`.e2e-artifacts/budget-period-report-${width}.png`});
    await navigate('Transaksi');
    const oldBill=page.getByTestId('transaction-row').filter({hasText:'Tagihan Oktober'});
    await oldBill.getByRole('button',{name:'Edit nama dan detail transaksi',exact:true}).click();
    assert.equal(await page.getByLabel('Kategori transaksi',{exact:true}).inputValue(),'2','An old transaction keeps its historical category even if deleted from November');
    await page.getByLabel('Nama transaksi',{exact:true}).fill('Tagihan Oktober diedit');
    await page.getByRole('button',{name:'Simpan Perubahan',exact:true}).click();
    await page.getByTestId('transaction-row').filter({hasText:'Tagihan Oktober diedit'}).waitFor();
    await page.getByTestId('transaction-undo-button').click();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('aturduitku_data')).txs.find(tx=>tx.id===2).ket==='Tagihan Oktober');
    await waitSaved();
    assert.equal(cloud.data.dompet[0].saldo,'550000');
    assert.equal(cloud.data.txs.length,2);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1),false);
    assert.deepEqual(errors,[]);
    console.log(`PASS monthly budget ${width}: close month, 500k/300k isolation, subcategory and category retention, cloud reload, independent report period`);
    await context.close();
  }
} finally {await browser.close();}
