import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";

const baseURL=process.env.E2E_BASE_URL||"https://www.aturduitku.com";
if(!process.env.E2E_EMAIL||!process.env.E2E_PASSWORD) throw new Error("QA credentials required");
await mkdir(".e2e-artifacts",{recursive:true});
const browser=await chromium.launch({channel:"chrome",headless:true});
try{
  for(const viewport of [{width:390,height:844},{width:1440,height:900}]){
    const context=await browser.newContext({viewport,locale:"id-ID",timezoneId:"Asia/Makassar"});
    const page=await context.newPage();
    const date=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Makassar"}).format(new Date());
    const day=new Date(date);
    const month=["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"][day.getUTCMonth()];
    const debt=(id,nama,extra={})=>({id,nama,tipe:"piutang",tgl:date,tempo:date,jml:"7500",cicilan:[],lunas:false,...extra});
    let cloud={version:1,onboarded:true,updatedAt:new Date().toISOString(),data:{
      name:"QA pengingat",bulan:month,tahun:String(day.getUTCFullYear()),
      dompet:[{id:1,nama:"Dompet QA",saldo:"1000000",tipe:"Tunai",icon:"CASH"},{id:2,nama:"Tujuan QA",saldo:"500000",tipe:"Tunai",icon:"CASH"}],
      budgets:[{id:1,kat:"Investasi",kelas:"Investasi",alokasi:"100000",sub:[]},{id:2,kat:"Tagihan QA",kelas:"Kebutuhan",alokasi:"0",sub:[{nama:"QA air lunas",alokasi:"145000",tempo:String(day.getUTCDate())},{nama:"QA internet belum",alokasi:"145000",tempo:String(day.getUTCDate())}]}],
      txs:[{id:100,tipe:"pengeluaran",tgl:date,jml:"145000",katId:2,subKat:"QA air lunas",ket:"QA pembayaran manual",dompetId:1},{id:101,tipe:"transfer",tgl:date,jml:"7500",dompetId:1,dompetTo:2,ket:"QA transfer manual"}],goals:[],asetTetap:[],amplop:[],recurring:[],processedRecurring:{},habits:[],
      utang:[debt(1,"QA lunas boolean",{lunas:true}),debt(2,"QA lunas status",{status:"lunas"}),debt(3,"QA cicilan penuh",{cicilan:[{jml:"7500",tgl:date}]}),debt(4,"QA piutang aktif")],
    }};
    // All financial reads and writes stay in this browser fixture.
    await page.route("**/api/users/**",async route=>{
      const url=new URL(route.request().url());
      if(url.pathname==="/api/users/me") return route.fulfill({json:{profile:{approvalStatus:"approved",role:"user",paymentStatus:"paid"},cloud}});
      if(url.pathname==="/api/users/data"){
        if(route.request().method()==="POST"){
          const payload=route.request().postDataJSON();
          cloud={...cloud,data:payload.data,onboarded:payload.onboarded,version:cloud.version+1,updatedAt:new Date().toISOString()};
        }
        return route.fulfill({json:cloud});
      }
      return route.fulfill({json:{ok:true}});
    });
    await page.goto(baseURL,{waitUntil:"domcontentloaded"});
    await page.getByPlaceholder("Email").fill(process.env.E2E_EMAIL);
    await page.getByPlaceholder("Password").fill(process.env.E2E_PASSWORD);
    await page.getByRole("button",{name:"Masuk dengan Email"}).click();
    await page.getByTestId("page-title").waitFor({state:"visible",timeout:45000});
    for(const name of ["Nanti dulu","Nanti"]){
      const button=page.getByRole("button",{name,exact:true});
      if(await button.isVisible().catch(()=>false))await button.click();
    }
    const active=page.getByRole("button",{name:/Tutup pengingat .*QA piutang aktif/});
    await active.waitFor({state:"visible"});
    for(const label of ["QA lunas boolean","QA lunas status","QA cicilan penuh"])
      assert.equal(await page.getByRole("button",{name:new RegExp("Tutup pengingat .*"+label)}).count(),0);
    await active.click();
    await page.waitForTimeout(2200);
    assert.equal(Object.keys(cloud.data.dismissedAlerts||{}).length,1,"Dismissal must reach persistence");
    await page.reload({waitUntil:"domcontentloaded"});
    await page.getByTestId("page-title").waitFor({state:"visible"});
    await page.waitForTimeout(600);
    assert.equal(await active.count(),0,"Dismissed reminder must stay hidden after reopening");
    if(viewport.width<900){
      await page.getByRole("button",{name:/Lainnya/}).last().click();
      await page.getByRole("button",{name:/Utang/}).last().click();
    }else await page.getByText("Utang",{exact:true}).first().click();
    const card=page.getByText("QA piutang aktif",{exact:true}).last().locator('xpath=ancestor::div[.//input[@placeholder="Nominal..."]][1]');
    await card.getByPlaceholder("Nominal...").fill("7500");
    await card.getByRole("button",{name:"+ Bayar",exact:true}).click();
    await page.waitForTimeout(2200);
    assert.equal(cloud.data.utang.find(item=>item.id===4).lunas,true);
    assert.equal(Number(cloud.data.dompet[0].saldo),1007500,"Receivable repayment must credit wallet exactly");
    await page.reload({waitUntil:"domcontentloaded"});
    await page.getByTestId("page-title").waitFor({state:"visible"});
    await page.getByRole("button",{name:"Notifikasi",exact:true}).click();
    assert.equal(await page.getByText(/(?:Piutang|Jatuh Tempo): QA/).count(),0,"All settled debts must disappear from notification panel after reopening");
    assert.equal(await page.getByText("Tagihan: QA air lunas",{exact:true}).count(),0,"Manually paid bill must not return on reopen");
    await page.getByText("Tagihan: QA internet belum",{exact:true}).waitFor({state:"visible"});
    await page.waitForTimeout(1000);
    await page.screenshot({path:`.e2e-artifacts/notifications-${viewport.width}.png`,fullPage:true});
    console.log(`OK notification regression ${viewport.width}: settled statuses, dismissal persistence, repayment, reopen`);
    await page.reload({waitUntil:"domcontentloaded"});
    await page.getByTestId("page-title").waitFor({state:"visible"});
    if(viewport.width<900) await page.getByRole("button",{name:/Transaksi/}).last().click();
    else await page.getByText("Transaksi",{exact:true}).first().click();
    const transferFilter=page.locator('select').filter({has:page.locator('option[value="transfer_internal"]')});
    await transferFilter.selectOption("transfer_internal");
    await page.getByText("QA transfer manual",{exact:true}).waitFor({state:"visible"});
    await page.getByText(/Nominal transfer tidak dihitung/).waitFor({state:"visible"});
    assert.equal(await page.getByText("QA pembayaran manual",{exact:true}).count(),0);
    const walletFilter=page.locator('select').filter({has:page.locator('option').filter({hasText:"Tujuan QA"})});
    await walletFilter.selectOption("2");
    await page.getByText("QA transfer manual",{exact:true}).waitFor({state:"visible"});
    await page.waitForTimeout(1000);
    await page.screenshot({path:`.e2e-artifacts/transfer-filter-${viewport.width}.png`,fullPage:true});
    await transferFilter.selectOption("");
    await walletFilter.selectOption("");
    if(viewport.width<900){
      await page.getByRole("button",{name:"Aksi cepat",exact:true}).click();
      await page.getByRole("button",{name:/Catat pengeluaran/}).click();
    }else await page.getByRole("button",{name:/Tambah Transaksi|\+ Transaksi/i}).first().click();
    const investment=page.locator(".modal-overlay");
    await investment.getByRole("button",{name:"Investasi",exact:true}).click();
    await investment.locator('input[type="date"]').fill(date);
    await investment.locator('input[inputmode="numeric"]').fill("217500");
    await investment.locator("#transaction-name").fill("QA investasi emas");
    await investment.getByLabel("Kategori budget investasi",{exact:true}).selectOption("1");
    await investment.getByRole("button",{name:"Simpan Transaksi",exact:true}).click();
    await investment.waitFor({state:"detached"});
    await page.waitForTimeout(2200);
    assert.equal(Number(cloud.data.dompet[0].saldo),790000);
    assert.equal(Number(cloud.data.asetTetap[0].nilai),217500);
    await page.reload({waitUntil:"domcontentloaded"});
    await page.getByTestId("page-title").waitFor({state:"visible"});
    if(viewport.width<900) await page.getByRole("button",{name:/Budget/}).last().click();
    else await page.getByText("Budget",{exact:true}).first().click();
    const budget=page.getByTestId("budget-category-card").filter({has:page.locator('button[aria-controls="budget-realization-1"]')});
    await budget.locator('button[aria-controls="budget-realization-1"]').click();
    await budget.getByText("QA investasi emas",{exact:true}).waitFor({state:"visible"});
    await page.screenshot({path:`.e2e-artifacts/investment-realization-${viewport.width}.png`,fullPage:true});
    console.log(`OK investment regression ${viewport.width}: wallet, asset, persisted transaction, budget realization details`);
    await context.close();
  }
}finally{await browser.close();}
