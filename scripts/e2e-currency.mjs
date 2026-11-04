import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { isDeepStrictEqual } from 'node:util';
import { CURRENCIES, formatMoney, formatMoneyInput } from '../src/moneyFormat.js';
import { moneyNumber } from '../src/financeLedger.js';

if(!process.env.E2E_EMAIL||!process.env.E2E_PASSWORD) throw new Error('QA credentials required');
const base=process.env.E2E_BASE_URL||'http://127.0.0.1:5195';
const codes=(process.env.E2E_CURRENCIES||'MYR,SGD,THB,TND').split(',');
const widths=(process.env.E2E_WIDTHS||'390,1440').split(',').map(Number);
await mkdir('.e2e-artifacts',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const fixture={name:'QA Currency',bulan:'November',tahun:'2026',currency:'IDR',targetDana:'20000',prevPemasukan:'5000',prevPengeluaran:'1000',
  dompet:[{id:'cash',nama:'Tunai QA',tipe:'Tunai',icon:'CASH',saldo:'500'},{id:'bank',nama:'Bank QA',tipe:'Bank',icon:'BANK',saldo:'2500'}],
  budgets:[{id:1,kat:'Transportasi',kelas:'Kebutuhan',icon:'MOVE',alokasi:'5000',sub:[{nama:'Bensin',alokasi:'100',emoji:'MOVE'}]}],
  txs:[{id:1,tipe:'pengeluaran',jml:'25',tgl:'2026-11-04',ket:'Belanja awal QA',dompetId:'cash',katId:1},{id:2,tipe:'pemasukan',jml:'5000',tgl:'2026-11-01',ket:'Pemasukan QA',dompetId:'bank',katId:'Gaji'}],
  goals:[{id:1,nama:'Dana QA',target:'2000',kumpul:'100',icon:'GOAL',dompetId:'cash',history:[]}],
  utang:[{id:1,nama:'Utang QA',tipe:'utang',jml:'200',tempo:'2026-11-10',cicilan:[{tgl:'2026-11-01',jml:'50'}],lunas:false}],
  asetTetap:[{id:1,nama:'Aset QA',nilai:'300',ket:''}],
  amplop:[{id:1,nama:'Amplop QA',alokasi:'100',terpakai:'25',dompetId:'cash',katId:1,icon:'ENV'}],
  recurring:[{id:1,nama:'Rutin QA',jml:'25',hari:'1',tipe:'pengeluaran',dompetId:'cash',katId:1,aktif:false}],processedRecurring:{},habits:[],
};
try {
  for(const width of widths) for(const code of codes) {
    const info=CURRENCIES[code],context=await browser.newContext({viewport:{width,height:900},locale:'id-ID',timezoneId:'Asia/Makassar',reducedMotion:'reduce',acceptDownloads:true});
    const page=await context.newPage(),errors=[];
    let cloud={data:structuredClone(fixture),onboarded:true,version:7,updatedAt:new Date().toISOString()},writes=0,aiPrompt='';
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
          writes++;cloud={...cloud,data:body.data,onboarded:body.onboarded,version:cloud.version+1,updatedAt:new Date().toISOString()};
        }
        return route.fulfill({json:cloud});
      }
      if(path.startsWith('/api/ai/')) {aiPrompt=request.postDataJSON().systemPrompt;return route.fulfill({json:{reply:`Nominal akun memakai ${code}.`}});}
      return route.fulfill({json:{ok:true}});
    });
    const local=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('aturduitku_data')));
    const navigate=async name=>{
      if(width>=900) await page.getByText(name,{exact:true}).first().click();
      else if(['Home','Dompet','Transaksi','Budget'].includes(name)) await page.locator('.bottom-nav').getByRole('button',{name:new RegExp(name)}).click();
      else {await page.locator('.bottom-nav').getByRole('button',{name:/Lainnya/}).click();await page.getByRole('dialog',{name:'Menu lainnya'}).getByRole('button',{name:new RegExp(name)}).click();}
      await page.getByTestId('page-title').filter({hasText:name}).waitFor();
    };
    const noOldCurrency=async surface=>{
      const text=await page.locator('body').innerText();
      assert.doesNotMatch(text,/\bRp\s*(?:\d|\()/,`${code} ${surface} still contains a Rupiah amount`);
      assert.ok(text.includes(info.symbol),`${code} ${surface} must display the selected currency`);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${surface} viewport overflow`);
    };
    const saved=async()=>{
      for(let retry=0;retry<100;retry++){if(isDeepStrictEqual(cloud.data,await local()))return;await page.waitForTimeout(100);}
      const current=await local();
      const differences=Object.keys(current).filter(key=>!isDeepStrictEqual(current[key],cloud.data[key])).map(key=>({key,local:current[key],server:cloud.data[key]}));
      assert.fail('Currency data did not synchronize: '+JSON.stringify(differences));
    };
    await page.goto(`${base}/#login`,{waitUntil:'domcontentloaded'});
    await page.getByPlaceholder('Email').fill(process.env.E2E_EMAIL);await page.getByPlaceholder('Password').fill(process.env.E2E_PASSWORD);
    await page.getByRole('button',{name:'Masuk dengan Email',exact:true}).click();
    try { await page.getByTestId('page-title').filter({hasText:'Home'}).waitFor({timeout:45000}); }
    catch(error) {
      await page.screenshot({path:`.e2e-artifacts/currency-login-failure-${code}-${width}.png`});
      console.error('Currency QA login did not complete:',await page.locator('body').innerText());
      throw error;
    }
    for(const name of ['Nanti dulu','Nanti']) if(await page.getByRole('button',{name,exact:true}).isVisible().catch(()=>false))await page.getByRole('button',{name,exact:true}).click();
    await page.waitForTimeout(500);assert.equal(writes,0,'Opening an old IDR account must not write or convert it');
    const before=await local();
    await navigate('Setting');
    assert.equal(await page.getByTestId('currency-select').inputValue(),'IDR');
    await page.getByTestId('currency-select').selectOption(code);
    page.once('dialog',dialog=>dialog.dismiss());
    await page.getByRole('button',{name:'Simpan perubahan',exact:true}).click();
    assert.equal((await local()).currency,'IDR','Cancel must not change the recording currency');
    page.once('dialog',dialog=>dialog.accept());
    await page.getByRole('button',{name:'Simpan perubahan',exact:true}).click();
    await page.waitForFunction(expected=>JSON.parse(localStorage.getItem('aturduitku_data'))?.currency===expected,code);
    const after=await local();
    assert.deepEqual({...after,currency:'IDR'},before,'Switching currency must not multiply, clear or round saved finances');
    await saved();
    await page.reload();await page.getByTestId('page-title').filter({hasText:'Home'}).waitFor();
    assert.equal((await local()).currency,code);
    for(const name of ['Nanti dulu','Nanti'])if(await page.getByRole('button',{name,exact:true}).isVisible().catch(()=>false))await page.getByRole('button',{name,exact:true}).click();
    for(const name of ['Home','Dompet','Transaksi','Budget','Amplop','Goals','Aset','Utang','Laporan','Setting']) {
      await navigate(name);await noOldCurrency(name);
    }
    if(code==='TND') await page.screenshot({path:`.e2e-artifacts/currency-setting-${width}.png`});
    await navigate('Transaksi');
    let amount=code==='TND'?12.345:12.34;
    if(width<900){await page.getByRole('button',{name:'Aksi cepat',exact:true}).click();await page.getByRole('button',{name:/Transaksi baru|Catat pengeluaran|Transaksi/,exact:false}).last().click();}
    else await page.getByRole('button',{name:'+ Transaksi',exact:true}).click();
    const modal=page.locator('.modal-overlay .modal-pop');
    await modal.locator('#transaction-amount').fill(String(amount));
    assert.equal(await modal.locator('#transaction-amount').getAttribute('inputmode'),'decimal');
    await modal.locator('#transaction-name').fill('Pecahan QA');
    await modal.getByRole('button',{name:'Simpan Transaksi',exact:true}).click();
    await modal.waitFor({state:'hidden'});
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('aturduitku_data')).txs.some(tx=>tx.ket==='Pecahan QA'));
    const recorded=await local(),expense=recorded.txs.find(tx=>tx.ket==='Pecahan QA');
    assert.equal(moneyNumber(expense.jml),amount);
    assert.equal(moneyNumber(recorded.dompet[0].saldo),Math.round((500-amount)*1000)/1000);
    assert.ok((await page.locator('body').innerText()).includes(formatMoney(amount,code)));
    await page.getByRole('button',{name:'Edit nama dan detail transaksi',exact:true}).first().click();
    assert.equal(await modal.locator('#transaction-amount').inputValue(),formatMoneyInput(amount,code));
    amount=code==='TND'?12.346:12.35;
    await modal.locator('#transaction-amount').fill(String(amount));
    await modal.getByRole('button',{name:'Simpan Perubahan',exact:true}).click();
    await modal.waitFor({state:'hidden'});
    await page.waitForFunction(expected=>JSON.parse(localStorage.getItem('aturduitku_data')).txs.some(tx=>tx.ket==='Pecahan QA'&&tx.jml===expected),amount);
    assert.equal(moneyNumber((await local()).dompet[0].saldo),Math.round((500-amount)*1000)/1000);
    await navigate('Dompet');await page.getByRole('button',{name:'Cocokkan saldo',exact:true}).first().click();
    assert.equal(await modal.locator('input[inputmode="decimal"]').inputValue(),formatMoneyInput(moneyNumber((await local()).dompet[0].saldo),code));
    await page.locator('.modal-overlay').click({position:{x:2,y:2}});await page.locator('.modal-overlay').waitFor({state:'hidden'});
    await saved();
    await navigate('Laporan');
    const csvDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV',exact:true}).click();
    const csv=await readFile(await (await csvDownload).path(),'utf8');
    assert.ok(csv.includes(info.symbol));assert.doesNotMatch(csv,/\bRp\b/);assert.ok(csv.includes(String(amount)));
    if(width>=900||code==='TND') {
      await page.addScriptTag({url:'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'});
      await page.addScriptTag({url:'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'});
      await page.evaluate(()=>{const Original=window.jspdf.jsPDF;window.__qaPdfText=[];window.jspdf.jsPDF=new Proxy(Original,{construct(target,args,newTarget){const doc=Reflect.construct(target,args,newTarget),originalText=doc.text.bind(doc);doc.text=(...values)=>{window.__qaPdfText.push(values[0]);return originalText(...values);};return doc;}});});
      const pdfDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Export PDF',exact:true}).click();
      const pdf=await pdfDownload;assert.ok((await readFile(await pdf.path())).length>1500);
      await pdf.saveAs(`.e2e-artifacts/report-${code}-${width}.pdf`);
      const pdfText=await page.evaluate(()=>window.__qaPdfText.flat(Infinity).join(' '));
      assert.ok(pdfText.includes(code),`PDF must identify ${code}`);assert.doesNotMatch(pdfText,/\bRp\s*\d/);
      await page.addScriptTag({url:'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'});
      await page.evaluate(()=>{const write=window.XLSX.writeFile;window.XLSX.writeFile=(wb,...args)=>{window.__qaWorkbook=wb;return write(wb,...args);};});
      const sheetDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Export Sheets',exact:true}).click();
      assert.ok((await readFile(await (await sheetDownload).path())).length>2000);
      const sheetText=await page.evaluate(()=>Object.values(window.__qaWorkbook.Sheets).flatMap(sheet=>Object.values(sheet).filter(cell=>cell&&typeof cell==='object'&&'v'in cell).map(cell=>String(cell.v))).join(' '));
      assert.ok(sheetText.includes(info.symbol));assert.doesNotMatch(sheetText,/\bRp\s*\d/);
    }
    await navigate('Setting');
    const backupDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Backup',exact:true}).click();
    const backup=JSON.parse(await readFile(await (await backupDownload).path(),'utf8'));
    assert.equal(backup.currency,code);assert.equal(moneyNumber(backup.txs.find(tx=>tx.ket==='Pecahan QA').jml),amount);
    await page.locator('.ai-float-btn').click();
    await page.locator('.ai-textarea').fill('Tolong analisis kondisi keuanganku');
    await page.locator('.ai-panel').getByRole('button',{name:'Kirim',exact:true}).click();
    await page.getByText(`Nominal akun memakai ${code}.`,{exact:true}).waitFor();
    assert.ok(aiPrompt.includes(`Mata uang akun: ${code}`),'AI must receive the actual account currency');
    const aiAmount=code==='TND'?.125:.25;
    await page.locator('.ai-textarea').fill(`catat beli bensin ${code} ${aiAmount} di Tunai QA`);
    await page.locator('.ai-panel').getByRole('button',{name:'Kirim',exact:true}).click();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('aturduitku_data')).txs.length===4);
    const withAi=await local();
    assert.equal(moneyNumber(withAi.txs[0].jml),aiAmount);
    assert.equal(moneyNumber(withAi.dompet[0].saldo),Math.round((500-amount-aiAmount)*1000)/1000);
    assert.ok((await page.locator('.ai-panel').innerText()).includes(info.symbol));
    const otherCode=code==='SGD'?'MYR':'SGD';
    await page.locator('.ai-textarea').fill(`catat beli bensin ${otherCode} 10 di Tunai QA`);
    await page.locator('.ai-panel').getByRole('button',{name:'Kirim',exact:true}).click();
    await page.getByText(/Aku belum mencatatnya/).waitFor();
    assert.equal((await local()).txs.length,4,'AI must not silently relabel a different currency');
    await page.locator('.ai-panel').getByRole('button',{name:'Tutup',exact:true}).click();
    if(width>=900) {
      await page.getByRole('button',{name:/English$/}).click();
      await page.getByLabel('Currency',{exact:true}).waitFor();
      assert.equal(await page.getByTestId('currency-select').inputValue(),code);
      await page.getByRole('button',{name:/Indonesia$/}).click();
    }
    await saved();
    const writesBeforeReload=writes;
    await page.evaluate(()=>localStorage.removeItem('aturduitku_data'));
    await page.reload();await page.getByTestId('page-title').filter({hasText:'Home'}).waitFor();
    assert.equal((await local()).currency,code,'Restore currency from server even without local financial storage');
    assert.equal(moneyNumber((await local()).dompet[0].saldo),moneyNumber(withAi.dompet[0].saldo));
    const restored=await local();
    const withoutDerivedPeriods=transactions=>transactions.map(({bulan,tahun,...tx})=>tx);
    assert.deepEqual(withoutDerivedPeriods(restored.txs),withoutDerivedPeriods(withAi.txs));
    assert.deepEqual(restored.dompet,withAi.dompet);
    await page.waitForTimeout(1800);
    assert.equal(writes,writesBeforeReload,'Reading normalized cloud data must not cause an idle save');
    assert.deepEqual(errors,[]);
    console.log(`PASS currency ${code} ${width}: cancel/no conversion, cloud-only restore, 10 pages, decimal manual/AI transactions, cross-currency rejection, CSV/JSON${width>=900||code==='TND'?', real PDF/XLSX':''}, no stale Rp, no page errors`);
    await context.close();
  }
}finally{await browser.close();}
