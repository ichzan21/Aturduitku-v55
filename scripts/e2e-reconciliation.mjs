import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import { summarizeTransactions } from "../src/reportPeriod.js";
import { moneyNumber } from "../src/financeLedger.js";

if(!process.env.E2E_EMAIL||!process.env.E2E_PASSWORD)throw new Error("QA credentials required");
await mkdir(".e2e-artifacts",{recursive:true});
const browser=await chromium.launch({channel:"chrome",headless:true});
try{
  for(const viewport of [{width:390,height:844},{width:1440,height:900}]){
    const context=await browser.newContext({viewport,locale:"id-ID",timezoneId:"Asia/Makassar"});
    const page=await context.newPage();
    const errors=[];
    page.on("pageerror",error=>errors.push(error.message));
    let cloud={version:1,onboarded:true,updatedAt:new Date().toISOString(),data:{
      name:"QA jeda pencatatan",bulan:"Oktober",tahun:"2026",dompet:[{id:"qa",nama:"Dompet QA",saldo:"1000000",tipe:"Tunai",icon:"CASH"}],
      budgets:[],txs:[{id:1,tipe:"pengeluaran",tgl:"2026-10-05",jml:"100000",dompetId:"qa",ket:"Pengeluaran 5 Oktober",budgetExcluded:true},{id:2,tipe:"pemasukan",tgl:"2026-10-06",jml:"300000",dompetId:"qa",ket:"Pemasukan 6 Oktober"}],
      goals:[],utang:[],asetTetap:[],amplop:[],recurring:[],processedRecurring:{},habits:[],
    }};
    const originalTotals=summarizeTransactions(cloud.data.txs,moneyNumber);
    await page.route("**/api/users/**",async route=>{
      const path=new URL(route.request().url()).pathname;
      if(path==="/api/users/me")return route.fulfill({json:{profile:{approvalStatus:"approved",role:"user",paymentStatus:"paid"},cloud}});
      if(path==="/api/users/data"){
        if(route.request().method()==="POST"){
          const payload=route.request().postDataJSON();
          cloud={...cloud,data:payload.data,onboarded:payload.onboarded,version:cloud.version+1,updatedAt:new Date().toISOString()};
        }
        return route.fulfill({json:cloud});
      }
      return route.fulfill({json:{ok:true}});
    });
    await page.route("**/api/monitoring/client-error",route=>route.fulfill({json:{ok:true}}));
    await page.goto(process.env.E2E_BASE_URL||"https://www.aturduitku.com",{waitUntil:"domcontentloaded"});
    await page.getByPlaceholder("Email").fill(process.env.E2E_EMAIL);
    await page.getByPlaceholder("Password").fill(process.env.E2E_PASSWORD);
    await page.getByRole("button",{name:"Masuk dengan Email"}).click();
    await page.getByTestId("page-title").waitFor({state:"visible",timeout:45000});
    for(const name of ["Nanti dulu","Nanti"]){
      const button=page.getByRole("button",{name,exact:true});
      if(await button.isVisible().catch(()=>false))await button.click();
    }
    const walletPage=async()=>{
      if(viewport.width<900)await page.locator(".bottom-nav").getByRole("button",{name:/Dompet/}).click();
      else await page.getByText("Dompet",{exact:true}).first().click();
    };
    await walletPage();
    await page.getByRole("button",{name:"Cocokkan saldo",exact:true}).click();
    const modal=page.locator(".modal-overlay");
    await modal.getByLabel("Tanggal saldo acuan (akhir hari)").fill("2026-10-04");
    await modal.locator('input[inputmode="numeric"]').fill("500000");
    await modal.getByText(/800rb/).waitFor({state:"visible"});
    await page.waitForTimeout(700);
    assert.equal(await modal.evaluate(element=>element.scrollWidth>element.clientWidth),false);
    await page.screenshot({path:`.e2e-artifacts/reconciliation-${viewport.width}.png`,fullPage:true});
    await modal.getByRole("button",{name:"Simpan koreksi saldo",exact:true}).click();
    await modal.waitFor({state:"detached"});
    await page.waitForTimeout(2400);
    assert.equal(cloud.data.dompet[0].saldo,"700000");
    assert.equal(cloud.data.txs.find(tx=>tx.tipe==="penyesuaian").tgl,"2026-10-04");
    assert.deepEqual(summarizeTransactions(cloud.data.txs,moneyNumber),originalTotals);
    await page.reload({waitUntil:"domcontentloaded"});
    await page.getByTestId("page-title").waitFor({state:"visible"});
    await walletPage();
    await page.locator('[data-animated-number="700000"]').first().waitFor({state:"visible"});
    await page.getByRole("button",{name:"Cocokkan saldo",exact:true}).click();
    await modal.getByLabel("Tanggal saldo acuan (akhir hari)").fill("2026-10-04");
    await modal.locator('input[inputmode="numeric"]').fill("500000");
    await modal.getByRole("button",{name:"Saldo sudah cocok",exact:true}).click();
    await modal.waitFor({state:"detached"});
    assert.equal(cloud.data.txs.filter(tx=>tx.tipe==="penyesuaian").length,1);
    assert.deepEqual(errors,[]);
    console.log(`OK reconciliation ${viewport.width}: historical cutoff, later transactions preserved, cashflow unchanged, reload, no double correction, no overflow`);
    await context.close();
  }
}finally{await browser.close();}
