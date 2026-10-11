import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";

if(!process.env.E2E_EMAIL||!process.env.E2E_PASSWORD) throw new Error("QA credentials required");
await mkdir(".e2e-artifacts",{recursive:true});
const browser=await chromium.launch({channel:"chrome",headless:true});
try{
  for(const viewport of [{width:390,height:844},{width:1440,height:900}]){
    const context=await browser.newContext({viewport,locale:"id-ID",timezoneId:"Asia/Makassar"});
    const page=await context.newPage();
    const errors=[];
    let inject520=false;
    let failedMutation="";
    let replayVerified=false;
    let lastMutation="";
    let persistent520=false;
    let failedSaves=0;
    const monitoring=[];
    await page.route("**/api/monitoring/client-error",route=>{
      monitoring.push(route.request().postDataJSON());
      return route.fulfill({json:{ok:true}});
    });
    page.on("pageerror",error=>errors.push(error.message));
    const date=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Makassar"}).format(new Date());
    const month=["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"][new Date(date).getUTCMonth()];
    let cloud={version:1,onboarded:true,updatedAt:new Date().toISOString(),data:{
      name:"QA piutang",bulan:month,tahun:date.slice(0,4),
      dompet:[{id:"bsi-qa",nama:"Bank Syariah Indonesia (BSI)",saldo:"1000000",tipe:"Bank",icon:"BANK"},{id:2,nama:"Tunai QA",saldo:"500000",tipe:"Tunai",icon:"CASH"}],
      budgets:[],txs:[],goals:[],utang:[],asetTetap:[],amplop:[],recurring:[],processedRecurring:{},habits:[],
    }};
    // Never write QA financial data to a real customer's account.
    await page.route("**/api/users/**",async route=>{
      const path=new URL(route.request().url()).pathname;
      if(path==="/api/users/me"){
        const uid=JSON.parse(Buffer.from(route.request().headers().authorization.slice(7).split(".")[1],"base64url").toString()).sub;
        return route.fulfill({json:{profile:{uid,approvalStatus:"approved",role:"user",paymentStatus:"paid"},cloud}});
      }
      if(path==="/api/users/data"){
        if(route.request().method()==="POST"){
          const payload=route.request().postDataJSON();
          if(persistent520){
            failedSaves++;
            return route.fulfill({status:520,contentType:"text/html",body:"Server unavailable"});
          }
          if(payload.mutationId===lastMutation){
            if(failedMutation){
              assert.equal(route.request().postData(),failedMutation,"Retry must reuse the exact mutation ID and payload");
              replayVerified=true;
            }
            return route.fulfill({json:{...cloud,replayed:true}});
          }
          lastMutation=payload.mutationId;
          cloud={...cloud,data:payload.data,onboarded:payload.onboarded,version:cloud.version+1,updatedAt:new Date().toISOString()};
          if(inject520){
            inject520=false;
            failedMutation=route.request().postData();
            return route.fulfill({status:520,contentType:"text/html",body:"Upstream unavailable"});
          }
        }
        return route.fulfill({json:cloud});
      }
      return route.fulfill({json:{ok:true}});
    });
    const navigate=async name=>{
      if(viewport.width<900){
        if(name==="Dompet"){
          await page.locator(".bottom-nav").getByRole("button",{name:/Dompet/}).click();
          return;
        }
        await page.getByRole("button",{name:/Lainnya/}).last().click();
        await page.getByRole("dialog",{name:"Menu lainnya"}).getByRole("button",{name:new RegExp(name)}).click();
      }else await page.getByText(name,{exact:true}).first().click();
    };
    await page.goto(process.env.E2E_BASE_URL||"https://www.aturduitku.com",{waitUntil:"domcontentloaded"});
    await page.locator(".public-login").click();
    await page.getByPlaceholder("Email").fill(process.env.E2E_EMAIL);
    await page.getByPlaceholder("Password").fill(process.env.E2E_PASSWORD);
    await page.getByRole("button",{name:"Masuk dengan Email"}).click();
    await page.getByTestId("page-title").waitFor({state:"visible",timeout:45000});
    for(const name of ["Nanti dulu","Nanti"]){
      const button=page.getByRole("button",{name,exact:true});
      if(await button.isVisible().catch(()=>false))await button.click();
    }
    await navigate("Utang");
    if(process.env.E2E_TEST_AI==="1"){
      await page.route("**/api/ai/cloudflare",route=>route.fulfill({json:{reply:JSON.stringify({action:"tambah_utang",tipe:"piutang",nama:"QA AI piutang",jml:202500})}}));
      await page.locator(".ai-float-btn").click();
      await page.locator(".ai-textarea").fill("catat piutang QA AI 202500");
      await page.locator(".ai-send-btn").click();
      await page.getByText(/Piutang belum disimpan dan saldo belum dipotong/).waitFor({state:"visible"});
      await page.getByRole("button",{name:"Tutup",exact:true}).click();
      assert.equal(cloud.data.utang.length,0,"AI must not create unfunded receivables");
      assert.equal(cloud.data.dompet[0].saldo,"1000000","AI draft must not silently debit a wallet");
      await page.getByRole("button",{name:/Simpan Catatan/i}).click();
      await page.getByText("Pilih sumber dana piutang.",{exact:true}).waitFor({state:"visible"});
      assert.equal(cloud.data.utang.length,0,"Saving without source must be rejected");
      console.log(`OK AI receivable ${viewport.width}: explicit source required, no premature save or debit`);
    }
    await page.getByRole("button",{name:"Piutang",exact:true}).click();
    const source=page.locator('select').filter({has:page.locator('option[value="wallet:bsi-qa"]')});
    await source.selectOption("wallet:bsi-qa");
    await page.locator('input[type="date"]').first().fill(date);
    await page.getByPlaceholder(/Contoh: Shopee PayLater/).fill("QA pinjam BSI");
    await page.locator('input[inputmode="numeric"]').first().fill("202500");
    inject520=process.env.E2E_TEST_SYNC==="1";
    await page.getByRole("button",{name:/Simpan Catatan/i}).click();
    await page.waitForTimeout(2400);
    assert.equal(cloud.data.dompet[0].saldo,"797500","BSI debit must be exactly Rp202500");
    assert.equal(cloud.data.dompet[1].saldo,"500000","Unrelated wallet must be untouched");
    const tx=cloud.data.txs.find(tx=>tx.tipe==="piutang_keluar");
    assert.equal(tx.dompetId,"bsi-qa");
    assert.equal(Number(tx.jml),202500);
    assert.equal(cloud.data.utang.length,1);
    if(process.env.E2E_TEST_SYNC==="1"){
      assert.equal(replayVerified,true,"A committed write with a lost 520 response must recover idempotently");
      assert.equal(await page.getByText("Sync error",{exact:true}).count(),0);
      failedMutation="";
      console.log(`OK sync ${viewport.width}: committed 520 replay, identical payload, no duplicate debit`);
    }
    await page.reload({waitUntil:"domcontentloaded"});
    await page.getByTestId("page-title").waitFor({state:"visible"});
    await navigate("Dompet");
    const wallet=page.getByText("Bank Syariah Indonesia (BSI)",{exact:true}).locator('xpath=ancestor::div[.//button[text()="Riwayat saldo"]][1]');
    await page.waitForTimeout(1500);
    await page.screenshot({path:`.e2e-artifacts/receivable-wallet-${viewport.width}.png`,fullPage:true});
    await wallet.getByText(/797\.500/).waitFor({state:"visible"});
    await wallet.getByRole("button",{name:"Riwayat saldo",exact:true}).click();
    await page.getByText("Pinjamkan: QA pinjam BSI",{exact:true}).waitFor({state:"visible"});
    await page.waitForTimeout(700);
    await page.screenshot({path:`.e2e-artifacts/receivable-bsi-${viewport.width}.png`,fullPage:true});
    await page.reload({waitUntil:"domcontentloaded"});
    await page.getByTestId("page-title").waitFor({state:"visible"});
    await navigate("Utang");
    const card=page.getByText("QA pinjam BSI",{exact:true}).last().locator('xpath=ancestor::div[.//input[@placeholder="Nominal..."]][1]');
    await card.getByPlaceholder("Nominal...").fill("202500");
    await card.locator("select").selectOption("wallet:bsi-qa");
    await card.getByRole("button",{name:"+ Bayar",exact:true}).click();
    await page.waitForTimeout(2400);
    assert.equal(cloud.data.dompet[0].saldo,"1000000","Repayment must restore BSI exactly once");
    assert.equal(cloud.data.utang[0].lunas,true);
    await page.reload({waitUntil:"domcontentloaded"});
    await page.getByTestId("page-title").waitFor({state:"visible"});
    assert.equal(cloud.data.dompet[0].saldo,"1000000","Reopen must not double apply repayment");
    if(process.env.E2E_TEST_SYNC==="1"){
      await navigate("Utang");
      await page.getByRole("button",{name:"Piutang",exact:true}).click();
      await source.selectOption("wallet:bsi-qa");
      await page.getByPlaceholder(/Contoh: Shopee PayLater/).fill("QA local pending");
      await page.locator('input[inputmode="numeric"]').first().fill("7500");
      persistent520=true;
      await page.getByRole("button",{name:/Simpan Catatan/i}).click();
      await page.getByText("Sinkronisasi perlu dicek",{exact:true}).waitFor({state:"visible"});
      assert.equal(failedSaves,3,"Persistent 520 stops after three attempts");
      const local=await page.evaluate(()=>JSON.parse(localStorage.getItem("aturduitku_data")));
      assert.equal(local.dompet[0].saldo,"992500","Pending changes survive in local storage");
      assert.equal(cloud.data.dompet[0].saldo,"1000000","Failed writes must not overwrite cloud data");
      await page.waitForTimeout(500);
      assert.equal(monitoring.filter(event=>event.type==="api_server_error").length,1,"Only final failure is reported, not every retry");
      console.log(`OK persistent 520 ${viewport.width}: local data preserved, honest sync warning, bounded retries, one incident`);
    }
    assert.deepEqual(errors,[],"No uncaught browser errors");
    console.log(`OK BSI receivable ${viewport.width}: debit, persistence, history, repayment, reopen`);
    await context.close();
  }
}finally{await browser.close();}
