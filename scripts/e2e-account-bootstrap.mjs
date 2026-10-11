import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

if (!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD) throw new Error("QA credentials required");
const base = process.env.E2E_BASE_URL || "http://127.0.0.1:5185";
const repro = process.env.E2E_REPRO === "1";
await mkdir(".e2e-artifacts", { recursive:true });
const browser = await chromium.launch({ channel:"chrome", headless:true });
const fixture = {
  name:"QA Home Screen", bulan:"Oktober", tahun:"2026",
  dompet:[{ id:"qa-cash", nama:"Tunai QA", tipe:"Tunai", saldo:"932000", icon:"CASH" }],
  txs:Array.from({ length:68 }, (_,i)=>({ id:`qa-${i}`, tipe:"pengeluaran", tgl:"2026-10-10", jml:"1000", ket:`Catatan QA ${i+1}`, dompetId:"qa-cash", budgetExcluded:true })),
  budgets:[], goals:[], utang:[], asetTetap:[], recurring:[], processedRecurring:{}, amplop:[], habits:[],
};
try {
  for (const scenario of repro ? ["approval-failure"] : ["fresh-storage", "slow-cloud", "missing-embedded", "startup-failure", "approval-failure", "invalid-cloud", "invalid-cloud-desktop", "legacy-cache", "corrupt-cache", "other-account-cache", "new-account", "explicit-reset"]) {
    const desktop=scenario==="invalid-cloud-desktop";
    const context = await browser.newContext({ viewport:desktop?{width:1440,height:900}:{ width:390, height:844 }, locale:"id-ID", isMobile:!desktop, hasTouch:!desktop });
    const page = await context.newPage();
    let recovery = false;
    let gets = 0;
    const writes = [];
    const errors = [];
    page.on("pageerror",e=>errors.push(e.message));
    await page.route("**/api/users/**", async route=>{
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const token = request.headers().authorization?.slice(7);
      const uid = JSON.parse(Buffer.from(token.split(".")[1],"base64url").toString()).sub;
      const profile = { uid, email:process.env.E2E_EMAIL, approvalStatus:"approved", role:"user", paymentStatus:"paid" };
      const cloud = { data:fixture, onboarded:false, version:7, updatedAt:"2026-10-10T12:00:00.000Z", lastBackupAt:null };
      if (path === "/api/users/me") {
        gets++;
        if (scenario === "approval-failure" && gets === 1) return route.fulfill({ json:{ profile:{ ...profile, approvalStatus:"pending_review" } } });
        if (["legacy-cache","corrupt-cache","other-account-cache"].includes(scenario)) {
          await page.evaluate(({uid,fixture,scenario})=>{
            localStorage.setItem("aturduitku_last_uid",scenario==="other-account-cache"?"another-account":uid);
            localStorage.setItem("aturduitku_data",scenario==="corrupt-cache"?"invalid-json":JSON.stringify(fixture));
            localStorage.setItem("aturduitku_onboarded","0");
          },{uid,fixture,scenario});
        }
        if (scenario === "slow-cloud") {
          await page.waitForTimeout(1800);
          assert.equal(await page.getByText("Halo! Saya AturDuitku",{exact:true}).count(),0,"No setup flash while loading");
          assert.equal(writes.length,0,"No writes while loading");
        }
        if (["missing-embedded","approval-failure","startup-failure"].includes(scenario)) return route.fulfill({ json:{ profile } });
        if (scenario.startsWith("invalid-cloud")) return route.fulfill({ json:{ profile, cloud:{ ...cloud, data:{} } } });
        if (["new-account","legacy-cache","corrupt-cache","other-account-cache"].includes(scenario)) return route.fulfill({ json:{ profile, cloud:{ data:null, onboarded:false, version:0, updatedAt:null } } });
        return route.fulfill({ json:{ profile, cloud } });
      }
      if (path === "/api/users/data") {
        if (request.method() === "POST") {
          const body = request.postDataJSON(); writes.push(body);
          return route.fulfill({ json:{ ok:true, version:8, updatedAt:new Date().toISOString() } });
        }
        if (["approval-failure","startup-failure"].includes(scenario) && !recovery) return route.fulfill({ status:503, json:{ error:"QA data temporarily unavailable" } });
        if (scenario.startsWith("invalid-cloud")) return route.fulfill({ json:{ ...cloud, data:{} } });
        if (["new-account","legacy-cache","corrupt-cache","other-account-cache"].includes(scenario)) return route.fulfill({ json:{ data:null, onboarded:false, version:0, updatedAt:null } });
        return route.fulfill({ json:cloud });
      }
      return route.fulfill({ json:{ ok:true } });
    });
    await page.route("**/api/monitoring/**",route=>route.fulfill({ json:{ ok:true } }));
    await page.goto(`${base}/#login`,{ waitUntil:"domcontentloaded" });
    await page.getByPlaceholder("Email").fill(process.env.E2E_EMAIL);
    await page.getByPlaceholder("Password").fill(process.env.E2E_PASSWORD);
    await page.getByRole("button",{ name:"Masuk dengan Email", exact:true }).click();
    if (repro) {
      await page.getByText("Menunggu approval admin",{ exact:true }).waitFor();
      await page.waitForTimeout(11000);
      const setup = await page.getByText("Halo! Saya AturDuitku",{ exact:true }).isVisible();
      await page.screenshot({ path:".e2e-artifacts/account-bootstrap-before.png" });
      console.log("REPRO approval read failure",{ setup, writes:writes.length });
      assert.equal(setup,true,"Existing implementation should reproduce unwanted onboarding");
    } else if (["approval-failure","startup-failure","invalid-cloud","invalid-cloud-desktop","corrupt-cache"].includes(scenario)) {
      await page.getByTestId("account-data-unavailable").waitFor({ timeout:20000 });
      await page.waitForTimeout(2000);
      assert.equal(writes.length,0,"Failed reads must never trigger cloud writes");
      assert.equal(await page.getByText("Halo! Saya AturDuitku",{ exact:true }).count(),0);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,"Error screen must not overflow");
      const retryButton=page.getByRole("button",{name:"Coba muat data lagi",exact:true});
      assert.ok((await retryButton.boundingBox()).height>=44);
      await page.screenshot({ path:`.e2e-artifacts/account-bootstrap-${scenario}.png` });
      if (["approval-failure","startup-failure"].includes(scenario)) {
        recovery=true;
        await page.getByRole("button",{ name:"Coba muat data lagi", exact:true }).click();
        await page.getByTestId("page-title").waitFor({ timeout:30000 });
        const saved = await page.evaluate(()=>JSON.parse(localStorage.getItem("aturduitku_data")));
        assert.equal(saved.txs.length,68);
        assert.equal(saved.dompet[0].saldo,"932000");
      }
    } else if (["new-account","other-account-cache"].includes(scenario)) {
      await page.getByText("Halo! Saya AturDuitku",{ exact:true }).waitFor({ timeout:30000 });
    } else {
      await page.getByTestId("page-title").waitFor({ timeout:30000 });
      const saved = await page.evaluate(()=>JSON.parse(localStorage.getItem("aturduitku_data")));
      assert.equal(saved.txs.length,68);
      assert.equal(saved.dompet[0].saldo,"932000");
      assert.equal(await page.evaluate(()=>localStorage.getItem("aturduitku_onboarded")),"1");
      await page.reload();
      await page.getByTestId("page-title").waitFor({ timeout:30000 });
      if(scenario==="explicit-reset"){
        for(const name of ["Nanti dulu","Nanti"]){
          const button=page.getByRole("button",{name,exact:true});
          if(await button.isVisible().catch(()=>false)) await button.click();
        }
        await page.getByRole("button",{name:/Lainnya/}).last().click();
        await page.getByRole("dialog",{name:"Menu lainnya"}).getByRole("button",{name:/Setting/}).click();
        await page.getByRole("button",{name:"Reset semua data",exact:true}).click();
        await page.getByRole("button",{name:"Ya, Lanjutkan",exact:true}).click();
        await page.getByText("Halo! Saya AturDuitku",{exact:true}).waitFor();
      }
    }
    if (!repro) {
      await page.waitForTimeout(1800);
      if(["new-account","other-account-cache"].includes(scenario)) assert.equal(writes.length,0,"Never autosave defaults before setup completes");
      if(scenario==="explicit-reset") {
        const reset=writes.find(write=>write.onboarded===false);
        assert.ok(reset,"Explicit confirmed reset must still persist");
        assert.equal(reset.data.txs.length,0);
      }
      for (const write of writes) if (scenario !== "new-account") {
        if(scenario==="explicit-reset"&&!write.onboarded) continue;
        if(scenario==="other-account-cache") {
          assert.equal(write.data.txs.length,0,"Never migrate another account's records");
        }else{
          assert.equal(write.data.txs.length,68);
          assert.equal(write.baseVersion,scenario==="legacy-cache"?0:7);
          assert.equal(write.onboarded,true);
        }
      }
      assert.deepEqual(errors,[]);
      console.log(`PASS account bootstrap ${scenario}: isolated storage, verified restoration, safe failure/retry, no customer writes`);
    }
    await context.close();
  }
} finally { await browser.close(); }
