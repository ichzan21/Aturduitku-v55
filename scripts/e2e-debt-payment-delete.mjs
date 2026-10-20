import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { remainingDebtAmount } from '../src/financialNotifications.js';

if (!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD) throw new Error('QA credentials required');
await mkdir('.e2e-artifacts', {recursive:true});
const base=process.env.E2E_BASE_URL||'http://127.0.0.1:5185';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  for (const width of [390,1440]) {
    const context=await browser.newContext({viewport:{width,height:900},timezoneId:'Asia/Makassar',locale:'id-ID'});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Makassar'}).format(new Date());
    let aiReply={action:'bayar_utang',nama:'Utang AI QA',jumlah:10000,dompet:'Tunai QA'};
    let cloud={version:1,onboarded:true,updatedAt:new Date().toISOString(),data:{
      name:'QA Pembatalan',bulan:'Oktober',tahun:'2026',budgets:[],asetTetap:[],amplop:[],recurring:[],processedRecurring:{},habits:[],
      dompet:[{id:'cash',nama:'Tunai QA',saldo:'300000',tipe:'Tunai',icon:'CASH'},{id:'other',nama:'Dompet Lain',saldo:'11000',tipe:'Bank',icon:'BANK'},{id:'empty',nama:'Dompet Kosong',saldo:'0',tipe:'Tunai',icon:'CASH'}],
      goals:[{id:'goal',nama:'Dana QA',target:'200000',kumpul:'100000',history:[]}],
      utang:[
        {id:'legacy',nama:'Utang Tunai Lama',tipe:'utang',jml:'100000',lunas:true,cicilan:[{tgl:date,jml:'20000'},{tgl:date,jml:'80000'}]},
        {id:'new',nama:'Utang Baru',tipe:'utang',jml:'50000',lunas:false,cicilan:[]},
        {id:'goal-debt',nama:'Piutang Goal QA',tipe:'piutang',jml:'50000',lunas:false,cicilan:[],sourceType:'goal',sourceId:'goal'},
        {id:'ambiguous',nama:'Utang Ambigu',tipe:'utang',jml:'50000',lunas:false,cicilan:[{tgl:date,jml:'10000'},{tgl:date,jml:'10000'}]},
        {id:'ai-debt',nama:'Utang AI QA',tipe:'utang',jml:'40000',lunas:false,cicilan:[]},
        {id:'ai-receivable',nama:'Piutang AI QA',tipe:'piutang',jml:'12000',lunas:false,cicilan:[]},
      ],
      txs:[
        {id:'old-80',tipe:'pengeluaran',tgl:date,jml:'80000',dompetId:'cash',ket:'Bayar Utang/Cicilan: Utang Tunai Lama'},
        {id:'old-20',tipe:'pengeluaran',tgl:date,jml:'20000',dompetId:'cash',ket:'Bayar Utang/Cicilan: Utang Tunai Lama'},
        {id:'ambiguous-tx',tipe:'pengeluaran',tgl:date,jml:'10000',dompetId:'cash',ket:'Bayar Utang/Cicilan: Utang Ambigu'},
      ],
    }};
    await page.route('**/api/**',async route=>{
      const request=route.request();
      const path=new URL(request.url()).pathname;
      if(path==='/api/users/me') {
        const token=request.headers().authorization.slice(7);
        const uid=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).sub;
        return route.fulfill({json:{profile:{uid,approvalStatus:'approved',role:'user',paymentStatus:'paid'},cloud}});
      }
      if(path==='/api/users/data') {
        if(request.method()==='POST') {
          const body=request.postDataJSON();
          cloud={...cloud,data:body.data,onboarded:body.onboarded,version:cloud.version+1,updatedAt:new Date().toISOString()};
        }
        return route.fulfill({json:cloud});
      }
      if(path==='/api/ai/cloudflare') return route.fulfill({json:{reply:JSON.stringify(aiReply)}});
      return route.fulfill({json:{ok:true}});
    });
    const navigate=async name=>{
      if(width<900) {
        if(name==='Transaksi') return page.locator('.bottom-nav').getByRole('button',{name:/Transaksi/}).click();
        await page.getByRole('button',{name:/Lainnya/}).last().click();
        await page.getByRole('dialog',{name:'Menu lainnya'}).getByRole('button',{name:new RegExp(name)}).click();
      } else await page.getByText(name,{exact:true}).first().click();
    };
    const local=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('aturduitku_data')));
    const debtCard=name=>page.getByTestId('debt-card').filter({has:page.getByText(name,{exact:true})});
    const remove=async(name,amount)=>{
      await navigate('Transaksi');
      const row=page.getByTestId('transaction-row').filter({hasText:name}).filter({hasText:amount});
      await row.getByRole('button',{name:'Ganti nama transaksi',exact:true}).waitFor({state:'visible'});
      assert.equal(await row.getByRole('button',{name:'Ganti nama transaksi',exact:true}).count(),1,'Linked financial details must not be silently detached by the generic editor');
      await row.getByRole('button',{name:'Hapus',exact:true}).click();
      await page.getByRole('button',{name:'Ya, Lanjutkan',exact:true}).click();
      await page.getByTestId('transaction-undo').waitFor();
      await page.waitForTimeout(1900);
    };
    await page.goto(`${base}/#login`,{waitUntil:'domcontentloaded'});
    await page.getByPlaceholder('Email').fill(process.env.E2E_EMAIL);
    await page.getByPlaceholder('Password').fill(process.env.E2E_PASSWORD);
    await page.getByRole('button',{name:'Masuk dengan Email',exact:true}).click();
    await page.getByTestId('page-title').waitFor({timeout:45000});
    for(const name of ['Nanti dulu','Nanti']){
      const button=page.getByRole('button',{name,exact:true});
      if(await button.isVisible().catch(()=>false)) await button.click();
    }
    await remove('Bayar Utang/Cicilan: Utang Tunai Lama','80.000');
    assert.equal(cloud.data.dompet[0].saldo,'380000');
    assert.equal(remainingDebtAmount(cloud.data.utang.find(d=>d.id==='legacy')),80000);
    assert.equal(cloud.data.utang.find(d=>d.id==='legacy').lunas,false);
    await page.getByTestId('transaction-undo-button').click();
    await page.waitForTimeout(1900);
    assert.equal(cloud.data.dompet[0].saldo,'300000');
    assert.equal(cloud.data.utang.find(d=>d.id==='legacy').lunas,true);
    await remove('Bayar Utang/Cicilan: Utang Tunai Lama','80.000');
    await page.reload({waitUntil:'domcontentloaded'});
    await page.getByTestId('page-title').waitFor();
    await navigate('Utang');
    assert.equal(await debtCard('Utang Tunai Lama').getAttribute('data-debt-status'),'active');
    assert.match(await debtCard('Utang Tunai Lama').innerText(),/80\.000/);
    await debtCard('Utang Tunai Lama').screenshot({path:`.e2e-artifacts/debt-delete-restored-${width}.png`});
    const newCard=debtCard('Utang Baru');
    await newCard.getByPlaceholder('Nominal...').fill('25000');
    await newCard.getByLabel('Tujuan pembayaran').selectOption('wallet:cash');
    await newCard.getByRole('button',{name:'+ Bayar',exact:true}).click();
    await page.waitForTimeout(1900);
    const newPayment=cloud.data.txs.find(tx=>tx.debtId==='new');
    assert.ok(newPayment);
    assert.equal(cloud.data.utang.find(d=>d.id==='new').cicilan[0].txId,newPayment.id);
    assert.equal(cloud.data.dompet[0].saldo,'355000');
    await remove('Bayar Utang/Cicilan: Utang Baru','25.000');
    assert.equal(cloud.data.dompet[0].saldo,'380000');
    assert.equal(remainingDebtAmount(cloud.data.utang.find(d=>d.id==='new')),50000);
    await navigate('Utang');
    await debtCard('Piutang Goal QA').getByPlaceholder('Nominal...').fill('50000');
    await debtCard('Piutang Goal QA').getByLabel('Tujuan pembayaran').selectOption('goal:goal');
    await debtCard('Piutang Goal QA').getByRole('button',{name:'+ Bayar',exact:true}).click();
    await page.waitForTimeout(1900);
    assert.equal(cloud.data.goals[0].kumpul,'150000');
    await remove('Terima Piutang/Cicilan: Piutang Goal QA','50.000');
    assert.equal(cloud.data.goals[0].kumpul,'100000');
    assert.equal(cloud.data.goals[0].history.length,0);
    assert.equal(remainingDebtAmount(cloud.data.utang.find(d=>d.id==='goal-debt')),50000);
    const beforeAmbiguous=JSON.stringify(await local());
    const ambiguous=page.getByTestId('transaction-row').filter({hasText:'Bayar Utang/Cicilan: Utang Ambigu'});
    await ambiguous.getByRole('button',{name:'Hapus',exact:true}).click();
    await page.getByRole('button',{name:'Ya, Lanjutkan',exact:true}).click();
    await page.getByText(/Cicilan transaksi ini belum dapat dicocokkan dengan aman/).waitFor();
    assert.equal(JSON.stringify(await local()),beforeAmbiguous);
    await page.getByRole('button',{name:'Batal',exact:true}).click();
    await navigate('Utang');
    await page.locator('.ai-float-btn').click();
    await page.locator('.ai-textarea').fill('catat pembayaran utang Utang AI QA 10000 dari Tunai QA');
    await page.locator('.ai-send-btn').click();
    await page.getByText(/Cicilan dicatat!/).waitFor({timeout:30000});
    await page.getByRole('button',{name:'Tutup',exact:true}).click();
    await page.waitForTimeout(1900);
    const aiPayment=cloud.data.txs.find(tx=>tx.debtId==='ai-debt');
    assert.ok(aiPayment,'AI payment must create the same transaction-to-installment links');
    await remove('Bayar Utang/Cicilan: Utang AI QA','10.000');
    assert.equal(remainingDebtAmount(cloud.data.utang.find(d=>d.id==='ai-debt')),40000);
    assert.equal(cloud.data.dompet[0].saldo,'380000');
    assert.equal(cloud.data.dompet[1].saldo,'11000');
    aiReply={action:'bayar_utang',nama:'Piutang AI QA',jumlah:12000,dompet:'Dompet Kosong'};
    await navigate('Utang');
    await page.locator('.ai-float-btn').click();
    await page.locator('.ai-textarea').fill('catat cicilan piutang Piutang AI QA 12000 ke Dompet Kosong');
    await page.locator('.ai-send-btn').click();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('aturduitku_data')).txs.some(tx=>tx.debtId==='ai-receivable'),null,{timeout:15000});
    await page.getByRole('button',{name:'Tutup',exact:true}).click();
    await page.waitForTimeout(1900);
    const aiIncoming=cloud.data.txs.find(tx=>tx.debtId==='ai-receivable');
    assert.ok(aiIncoming);
    assert.equal(aiIncoming.tipe,'piutang_masuk');
    assert.equal(cloud.data.dompet[2].saldo,'12000','AI receivable repayment credits an empty wallet, not an expense or insufficient-funds failure');
    await remove('Terima Piutang/Cicilan: Piutang AI QA','12.000');
    assert.equal(cloud.data.dompet[2].saldo,'0');
    assert.equal(remainingDebtAmount(cloud.data.utang.find(d=>d.id==='ai-receivable')),12000);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(errors,[]);
    console.log(`PASS debt payment deletion ${width}: legacy full and new partial payments, Undo, reload, Goal repayment, ambiguous rollback blocked, AI links, unchanged unrelated wallet`);
    await context.close();
  }
} finally {await browser.close();}
