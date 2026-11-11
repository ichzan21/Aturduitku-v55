import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {chromium} from 'playwright-core';
import {formatMoney} from '../src/moneyFormat.js';
import {roundMoney} from '../src/moneyValue.js';

if(!process.env.E2E_EMAIL||!process.env.E2E_PASSWORD)throw Error('QA credentials required');
const base=process.env.E2E_BASE_URL||'http://127.0.0.1:5198';
const widths=(process.env.E2E_WIDTHS||'320,1440').split(',').map(Number);
const codes=(process.env.E2E_CURRENCIES||'IDR,MYR,SGD,THB,TND').split(',');
const require=createRequire(import.meta.url);
const axeSource=await readFile(require.resolve('axe-core/axe.min.js'),'utf8');
await mkdir('.e2e-artifacts',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const width of widths)for(const code of codes){
  const english=width>=900,dark=width>=900,language=english?'en':'id';
  const amounts=Array.from({length:25},(_,index)=>code==='IDR'?(index+1)*1000:code==='TND'?roundMoney((index+1)*.101):roundMoney((index+1)*.1));
  amounts[0]=code==='IDR'?1234567890123:code==='TND'?123456789.123:123456789.12;
  const older=code==='IDR'?12500:code==='TND'?10.125:10.12;
  const expectedTotal=roundMoney(amounts.reduce((sum,value)=>sum+value,0)+older);
  const expenses=amounts.map((jml,index)=>({id:100+index,tipe:'pengeluaran',amplopId:index%2?'1':1,dompetId:index===4?'deleted':'shared',jml,tgl:`2026-11-${String(index%10+1).padStart(2,'0')}`,ket:index===1?'Keterangan panjang untuk pemakaian amplop '.repeat(10):`Belanja amplop ${index}`,displayName:index===2?'Nama transaksi diperbarui QA':''}));
  const data={name:'QA Riwayat Amplop',currency:code,bulan:'November',tahun:'2026',dompet:[{id:'shared',nama:'Dompet bersama QA',saldo:'5000000',tipe:'Tunai',icon:'CASH'}],budgets:[],goals:[],utang:[],asetTetap:[],habits:[],recurring:[],processedRecurring:{},
   amplop:[{id:1,nama:'Transportasi QA',alokasi:'200000',terpakai:'0',dompetId:'shared',icon:'MOVE'},{id:2,nama:'Transportasi QA',alokasi:'400000',terpakai:'55000',dompetId:'shared',icon:'MOVE'},{id:3,nama:'Amplop kosong QA',alokasi:'100000',terpakai:'0',dompetId:'shared',icon:'ENV'},{id:4,nama:'Catatan lama QA',alokasi:'100000',terpakai:'50000',dompetId:'shared',icon:'ENV'}],
   txs:[...expenses,{id:200,tipe:'pengeluaran',amplopId:1,dompetId:'shared',jml:older,tgl:'2026-10-02',ket:'Pemakaian bulan sebelumnya QA'},
    {id:201,tipe:'alokasi_amplop',amplopId:1,dompetId:'shared',jml:'200000',tgl:'2026-11-10',ket:'Pengisian amplop QA'},
    {id:202,tipe:'pengembalian_amplop',amplopId:1,dompetId:'shared',jml:'50000',tgl:'2026-11-10',ket:'Pengembalian amplop QA'},
    {id:203,tipe:'pengeluaran',amplopId:2,dompetId:'shared',jml:'55000',tgl:'2026-11-10',ket:'BUKAN amplop pertama QA'},
    {id:204,tipe:'pengeluaran',dompetId:'shared',jml:'9000',tgl:'2026-11-10',ket:'BUKAN transaksi amplop QA'},
    {id:205,tipe:'transfer',amplopId:1,dompetId:'shared',jml:'1000',tgl:'2026-11-10',ket:'BUKAN aktivitas amplop QA'},
    {id:206,tipe:'alokasi_amplop',amplopId:3,dompetId:'shared',jml:'100000',tgl:'2026-11-10',ket:'Isi amplop kosong QA'},
   ]};
  const context=await browser.newContext({viewport:{width,height:900},locale:'id-ID',timezoneId:'Asia/Makassar',reducedMotion:'reduce',serviceWorkers:'block'});
  await context.addInitScript(({language,dark})=>{localStorage.setItem('aturduitku_lang',language);localStorage.setItem('aturduitku_dark',dark?'1':'0');localStorage.setItem('aturduitku_tour_done','1');},{language,dark});
  const page=await context.newPage(),errors=[];
  page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
  let writes=0;
  await context.route('**/api/**',async route=>{
   const request=route.request(),path=new URL(request.url()).pathname;
   const cloud={data,version:7,onboarded:true,updatedAt:'2026-11-11T00:00:00Z'};
   if(path==='/api/users/me'){
    const uid=JSON.parse(Buffer.from(request.headers().authorization.slice(7).split('.')[1],'base64url')).sub;
    return route.fulfill({json:{profile:{uid,role:'user',approvalStatus:'approved',paymentStatus:'paid'},cloud}});
   }
   if(path==='/api/users/data'){if(request.method()==='POST')writes++;return route.fulfill({json:cloud});}
   return route.fulfill({json:{ok:true}});
  });
  const local=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('aturduitku_data')));
  const navigate=async()=>{
   if(width<900){await page.locator('.bottom-nav').getByRole('button',{name:/Lainnya|More/}).click();const more=page.getByRole('dialog',{name:'Menu lainnya'});await more.getByRole('button',{name:/Amplop|Envelopes/}).click();await more.waitFor({state:'hidden'});}
   else await page.locator('.nav-item').filter({hasText:'Envelopes'}).click();
   await page.getByTestId('envelope-summary').waitFor();
  };
  const dialog=()=>page.getByRole('dialog',{name:/^(Riwayat amplop|Envelope history):/});
  const open=async id=>{const trigger=page.locator(`[data-envelope-id="${id}"]`).getByTestId('envelope-history-trigger');await trigger.focus();await page.keyboard.press('Enter');await dialog().waitFor();return trigger;};
  const moreRows=async()=>{const more=dialog().getByRole('button',{name:/Tampilkan lebih banyak|Show more/});while(await more.count()){const before=await dialog().getByTestId('envelope-history-row').count();await more.click();await page.waitForFunction(before=>document.querySelectorAll('[data-testid="envelope-history-row"]').length>before,before);await page.waitForFunction(index=>document.activeElement?.getAttribute('data-history-index')===String(index),before);}};
  const audit=async()=>{
   if(!await page.evaluate(()=>!!window.axe))await page.addScriptTag({content:axeSource});
   const failures=await page.evaluate(async()=>{const result=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}});return result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}));});
   assert.deepEqual(failures,[],`${code} ${width} accessibility`);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  };
  try{
   await page.goto(`${base}/#login`);await page.getByLabel('Email',{exact:true}).fill(process.env.E2E_EMAIL);await page.getByLabel('Password',{exact:true}).fill(process.env.E2E_PASSWORD);await page.getByRole('button',{name:'Masuk dengan Email',exact:true}).click();await page.getByTestId('page-title').waitFor({timeout:45000});
   for(const label of ['Nanti dulu','Nanti'])if(await page.getByRole('button',{name:label,exact:true}).isVisible().catch(()=>false))await page.getByRole('button',{name:label,exact:true}).click();
   await navigate();const before=await local();
   await audit();
   assert.match(await page.locator('[data-envelope-id="1"]').getByTestId('envelope-history-trigger').innerText(),/26/);
   const trigger=await open(1);
   const history=dialog();
   assert.equal(await history.getByRole('button',{name:english?'Spending':'Pemakaian',exact:true}).getAttribute('aria-pressed'),'true');
   assert.equal(await history.getByTestId('envelope-history-spent').innerText(),formatMoney(expectedTotal,code));
   assert.equal(await history.getByTestId('envelope-history-spent').evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);return range.getClientRects().length;}),1,'Large totals must not split their digits across lines');
   assert.match(await history.getByTestId('envelope-history-note').innerText(),/reset/);
   assert.equal(await history.getByTestId('envelope-history-row').count(),20);
   await moreRows();assert.equal(await history.getByTestId('envelope-history-row').count(),26);
   assert.doesNotMatch(await history.innerText(),/BUKAN|Pengisian amplop QA|Pengembalian amplop QA/);
   assert.match(await history.innerText(),/Pemakaian bulan sebelumnya QA/);
   assert.match(await history.innerText(),/Nama transaksi diperbarui QA/);
   assert.match(await history.innerText(),english?/Wallet unavailable/:/Dompet tidak tersedia/);
   await audit();await history.evaluate(el=>{el.scrollTop=0;});await page.screenshot({path:`.e2e-artifacts/envelope-history-${code}-${width}-spending.png`});
   await history.getByRole('button',{name:english?'All activity':'Semua aktivitas',exact:true}).click();await moreRows();
   assert.equal(await history.getByTestId('envelope-history-row').count(),28);
   assert.equal(await history.locator('[data-activity-type="alokasi_amplop"]').count(),1);
   assert.equal(await history.locator('[data-activity-type="pengembalian_amplop"]').count(),1);
   assert.doesNotMatch(await history.innerText(),/BUKAN/);await audit();
   await page.keyboard.press('Escape');await history.waitFor({state:'hidden'});
   await page.waitForFunction(()=>document.activeElement?.matches('[data-testid="envelope-history-trigger"]'));
   assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
   await open(2);assert.equal(await dialog().getByTestId('envelope-history-row').count(),1);assert.match(await dialog().innerText(),/BUKAN amplop pertama QA/);await page.keyboard.press('Escape');await dialog().waitFor({state:'hidden'});
   await open(3);assert.equal(await dialog().getByTestId('envelope-history-row').count(),0);assert.match(await dialog().innerText(),english?/No recorded spending/:/Belum ada transaksi pemakaian/);await dialog().getByRole('button',{name:english?'All activity':'Semua aktivitas',exact:true}).click();assert.equal(await dialog().getByTestId('envelope-history-row').count(),1);await page.keyboard.press('Escape');await dialog().waitFor({state:'hidden'});
   await open(4);assert.match(await dialog().getByTestId('envelope-history-note').innerText(),english?/Older records/:/Catatan lama/);await page.keyboard.press('Escape');await dialog().waitFor({state:'hidden'});
   assert.deepEqual(await local(),before,'Reading and filtering history must not alter account data');assert.equal(writes,0,'History must never write financial data');
   await page.reload();await page.getByTestId('page-title').waitFor({timeout:45000});await navigate();await open(1);
   assert.equal(await dialog().getByRole('button',{name:english?'Spending':'Pemakaian',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(await dialog().getByTestId('envelope-history-spent').innerText(),formatMoney(expectedTotal,code));assert.deepEqual(await local(),before);assert.equal(writes,0);assert.deepEqual(errors,[]);
   console.log(`PASS envelope history ${code} ${width} ${language}: strict envelope isolation, all dates, 20-row paging, expense/all modes, empty/legacy/reset, full currency precision, keyboard/axe, reload, unchanged account and zero saves`);
  }catch(error){await page.screenshot({path:`.e2e-artifacts/envelope-history-${code}-${width}-failure.png`}).catch(()=>{});throw error;}
  finally{await context.close();}
 }
}finally{await browser.close();}
