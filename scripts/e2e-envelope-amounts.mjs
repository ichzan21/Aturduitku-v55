import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { formatMoney } from '../src/moneyFormat.js';
import { moneyNumber } from '../src/financeLedger.js';
import { roundMoney } from '../src/moneyValue.js';

if(!process.env.E2E_EMAIL||!process.env.E2E_PASSWORD) throw new Error('QA credentials required');
const base=process.env.E2E_BASE_URL||'http://127.0.0.1:5196';
const widths=(process.env.E2E_WIDTHS||'320,1440').split(',').map(Number);
const codes=(process.env.E2E_CURRENCIES||'IDR,MYR,SGD,THB,TND').split(',');
const scenarios=codes.map(code=>({code,name:'normal',amounts:code==='IDR'?[1230000,500000,80000]:code==='TND'?[1234.567,495.432,80.123]:[1234.56,495.43,80.12]}));
if(!process.env.E2E_CURRENCIES) scenarios.push(
  {code:'IDR',name:'large',amounts:[1234567890123,0,80000]},
  {code:'TND',name:'overspent',amounts:[1.234,0,2.345]},
  {code:'IDR',name:'empty',amounts:[0,0,0]},
);
await mkdir('.e2e-artifacts',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  for(const width of widths) for(const {code,name,amounts:[first,second,used]} of scenarios) {
    const context=await browser.newContext({viewport:{width,height:900},locale:'id-ID',timezoneId:'Asia/Makassar',reducedMotion:'reduce'});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const amplop=name==='empty'?[]:[{id:1,nama:'Belanja QA',alokasi:first,terpakai:used,dompetId:'cash',katId:'',icon:'ENV'},{id:2,nama:'Cadangan QA',alokasi:second,terpakai:0,dompetId:'cash',katId:'',icon:'ENV'}];
    const data={name:'QA Amplop',currency:code,bulan:'November',tahun:'2026',dompet:[{id:'cash',nama:'Tunai QA',saldo:'3000000',tipe:'Tunai',icon:'CASH'}],amplop,txs:[],budgets:[],goals:[],utang:[],asetTetap:[],habits:[],recurring:[],processedRecurring:{}};
    const cloud={version:1,onboarded:true,updatedAt:new Date().toISOString(),data};
    let writes=0;
    await page.route('**/api/**',async route=>{
      const request=route.request(),path=new URL(request.url()).pathname;
      if(path==='/api/users/me') {
        const uid=JSON.parse(Buffer.from(request.headers().authorization.slice(7).split('.')[1],'base64url').toString()).sub;
        return route.fulfill({json:{profile:{uid,approvalStatus:'approved',role:'user',paymentStatus:'paid'},cloud}});
      }
      if(path==='/api/users/data') {
        if(request.method()==='POST') writes++;
        return route.fulfill({json:cloud});
      }
      return route.fulfill({json:{ok:true}});
    });
    await page.goto(`${base}/#login`,{waitUntil:'domcontentloaded'});
    await page.getByPlaceholder('Email').fill(process.env.E2E_EMAIL);
    await page.getByPlaceholder('Password').fill(process.env.E2E_PASSWORD);
    await page.getByRole('button',{name:'Masuk dengan Email',exact:true}).click();
    await page.getByTestId('page-title').waitFor({timeout:45000});
    for(const label of ['Nanti dulu','Nanti']) if(await page.getByRole('button',{name:label,exact:true}).isVisible().catch(()=>false)) await page.getByRole('button',{name:label,exact:true}).click();
    if(width<900) {
      await page.locator('.bottom-nav').getByRole('button',{name:/Lainnya/}).click();
      await page.getByRole('dialog',{name:'Menu lainnya'}).getByRole('button',{name:/Amplop/}).click();
    } else await page.getByText('Amplop',{exact:true}).first().click();
    const summary=page.getByTestId('envelope-summary');
    await summary.waitFor();
    for(const [id,value] of [['total',roundMoney(first+second)],['used',used],['remaining',roundMoney(first+second-used)]]) {
      assert.equal(await page.getByTestId(`envelope-${id}`).innerText(),formatMoney(value,code),`${code} ${name} ${id} must show the full amount`);
    }
    assert.doesNotMatch(await summary.innerText(),/\d(?:[.,]\d+)?(?:jt|rb|K|M|B)\b/,'Summary must not abbreviate amounts');
    const overflow=await summary.evaluate(element=>[element,...element.querySelectorAll('*')].filter(node=>node.scrollWidth>node.clientWidth+1).map(node=>node.textContent));
    assert.deepEqual(overflow,[],`${code} ${name} summary content must not be clipped`);
    if(name==='large') assert.equal(await page.getByTestId('envelope-total').evaluate(element=>{const range=document.createRange();range.selectNodeContents(element);return range.getClientRects().length;}),1,'Large totals must fit without splitting their digits');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'No horizontal viewport overflow');
    await page.screenshot({path:`.e2e-artifacts/envelope-${code}-${name}-${width}.png`});
    const local=await page.evaluate(()=>JSON.parse(localStorage.getItem('aturduitku_data')));
    assert.deepEqual(local.amplop,amplop,'Reading the summary must not mutate envelope data');
    assert.equal(moneyNumber(local.dompet[0].saldo),3000000);
    assert.equal(writes,0,'Display changes must not write financial data');
    assert.deepEqual(errors,[]);
    console.log(`PASS envelope full amounts ${code} ${name} ${width}: exact total/used/remaining, no clipping, unchanged data, no cloud writes`);
    await context.close();
  }
} finally {await browser.close();}
