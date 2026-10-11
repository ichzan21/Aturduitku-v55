import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";
import { assertAccountResetIntent } from "../api/_lib/dataVersion.js";

if (!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD) throw new Error("QA credentials required");
const base = process.env.E2E_BASE_URL || "http://127.0.0.1:5185";
const repro = process.env.E2E_REPRO === "1";
const allScenarios=["fresh-storage", "slow-cloud", "missing-embedded", "startup-failure", "approval-failure", "invalid-cloud", "invalid-cloud-desktop", "legacy-cache", "corrupt-cache", "other-account-cache", "new-account", "explicit-reset", "admin-inspection", "admin-inspection-desktop"];
allScenarios.push("empty-cloud-local","empty-cloud-local-confirm","empty-cloud-backup","empty-cloud-backup-desktop","empty-cloud-backup-race","empty-cloud-backup-cas");
allScenarios.push("admin-inspection-restore","admin-inspection-restore-desktop");
const scenarios=repro?["approval-failure"]:process.env.E2E_SCENARIOS?process.env.E2E_SCENARIOS.split(","):allScenarios;
assert.ok(scenarios.every(scenario=>allScenarios.includes(scenario)),"Unknown test scenario");
await mkdir(".e2e-artifacts", { recursive:true });
const browser = await chromium.launch({ channel:"chrome", headless:true });
const fixture = {
  name:"QA Home Screen", bulan:"Oktober", tahun:"2026",
  dompet:[{ id:"qa-cash", nama:"Tunai QA", tipe:"Tunai", saldo:"932000", icon:"CASH" }],
  txs:Array.from({ length:68 }, (_,i)=>({ id:`qa-${i}`, tipe:"pengeluaran", tgl:"2026-10-10", jml:"1000", ket:`Catatan QA ${i+1}`, dompetId:"qa-cash", budgetExcluded:true })),
  budgets:[], goals:[], utang:[], asetTetap:[], recurring:[], processedRecurring:{}, amplop:[], habits:[],
};
const defaults={...fixture,name:"Iksanarsana",txs:[],dompet:["BCA","GoPay","Tunai"].map((nama,id)=>({id:`default-${id}`,nama,saldo:"0",tipe:"Tunai",icon:"CASH"}))};
try {
  for (const scenario of scenarios) {
    const desktop=scenario.endsWith("-desktop");
    const admin=scenario.startsWith("admin-inspection");
    const emptyCloud=scenario.startsWith("empty-cloud-");
    let persistedCloud=null;
    const context = await browser.newContext({ viewport:desktop?{width:1440,height:900}:{ width:390, height:844 }, locale:"id-ID", isMobile:!desktop, hasTouch:!desktop });
    const page = await context.newPage();
    let recovery = false;
    let gets = 0;
    const writes = [];
    const errors = [];
    let inspectionReads=0;
    let adminRestored=false;
    const adminRestores=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.route("**/api/admin/users**",async route=>{
      if(scenario.includes("-restore")&&route.request().method()==="POST"){
        const request=route.request().postDataJSON();
        adminRestores.push(request);
        assert.equal(request.action,"restore_backup");
        assert.equal(request.uid,"qa-target");
        assert.equal(request.expectedEmail,"qa-target@example.invalid");
        assert.equal(request.expectedVersion,8);
        assert.equal(request.confirmed,true);
        assert.deepEqual(request.backup,fixture);
        if(adminRestores.length===1) return route.fulfill({status:520,json:{error:"QA temporary restore failure"}});
        assert.deepEqual(adminRestores[0],request,"Retry retains target, backup and mutation ID");
        adminRestored=true;
        return route.fulfill({json:{ok:true,restored:{transactionCount:68,walletCount:1,version:9}}});
      }
      assert.equal(route.request().method(),"GET","Admin inspection is read-only");
      const url=new URL(route.request().url());
      if(url.searchParams.has("inspectUid")){
        inspectionReads++;
        assert.equal(url.searchParams.get("inspectUid"),"qa-target");
        if(inspectionReads===1) return route.fulfill({status:503,json:{error:"QA unavailable"}});
        return route.fulfill({json:{ok:true,inspection:{uid:"qa-target",checkedAt:new Date().toISOString(),cloud:{dataPresent:true,dataShapeValid:true,transactionCount:scenario.includes("-restore")&&!adminRestored?0:68,walletCount:1,version:scenario.includes("-restore")?(adminRestored?9:8):7,onboarded:adminRestored,updatedAt:"2026-10-10T12:00:00Z"},backups:[]}}});
      }
      return route.fulfill({json:{ok:true,users:[{uid:"qa-target",displayName:"QA target",email:"qa-target@example.invalid",approvalStatus:"approved",role:"user"}],stats:{total:1,approved:1,pending_review:0,rejected:0}}});
    });
    await page.route("**/api/users/**", async route=>{
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const token = request.headers().authorization?.slice(7);
      const uid = JSON.parse(Buffer.from(token.split(".")[1],"base64url").toString()).sub;
      const profile = { uid, email:process.env.E2E_EMAIL, approvalStatus:"approved", role:admin?"admin":"user", paymentStatus:"paid" };
      const cloud = persistedCloud||{ data:emptyCloud?defaults:fixture, onboarded:false, version:emptyCloud?8:7, updatedAt:"2026-10-10T12:00:00.000Z", lastBackupAt:null };
      if (path === "/api/users/me") {
        gets++;
        if (scenario === "approval-failure" && gets === 1) return route.fulfill({ json:{ profile:{ ...profile, approvalStatus:"pending_review" } } });
        if (["legacy-cache","corrupt-cache","other-account-cache"].includes(scenario)||(scenario.startsWith("empty-cloud-local")&&gets===1)) {
          await page.evaluate(({uid,fixture,scenario})=>{
            localStorage.setItem("aturduitku_last_uid",scenario==="other-account-cache"?"another-account":uid);
            localStorage.setItem("aturduitku_data",scenario==="corrupt-cache"?"invalid-json":JSON.stringify(fixture));
            localStorage.setItem("aturduitku_onboarded","0");
          },{uid,fixture,scenario});
        }
        if (scenario === "slow-cloud") {
          const writesBefore=writes.length;
          await page.waitForTimeout(1800);
          assert.equal(await page.getByText("Halo! Saya AturDuitku",{exact:true}).count(),0,"No setup flash while loading");
          assert.equal(writes.length,writesBefore,"No additional writes while loading, including reload");
        }
        if (["missing-embedded","approval-failure","startup-failure"].includes(scenario)) return route.fulfill({ json:{ profile } });
        if (scenario.startsWith("invalid-cloud")) return route.fulfill({ json:{ profile, cloud:{ ...cloud, data:{} } } });
        if (["new-account","legacy-cache","corrupt-cache","other-account-cache"].includes(scenario)) return route.fulfill({ json:{ profile, cloud:{ data:null, onboarded:false, version:0, updatedAt:null } } });
        return route.fulfill({ json:{ profile, cloud } });
      }
      if (path === "/api/users/data") {
        if (request.method() === "POST") {
          const body = request.postDataJSON(); writes.push(body);
          assertAccountResetIntent(cloud,body);
          if(scenario==="empty-cloud-backup-cas") return route.fulfill({status:409,json:{error:"QA cloud changed",code:"DATA_CONFLICT",currentVersion:9}});
          if(emptyCloud||scenario==="explicit-reset") persistedCloud={data:body.data,onboarded:body.onboarded,version:cloud.version+1,updatedAt:new Date().toISOString(),lastBackupAt:null};
          return route.fulfill({ json:{ ok:true, version:persistedCloud?.version||8, updatedAt:new Date().toISOString() } });
        }
        if(scenario==="empty-cloud-backup-race"&&!new URL(request.url()).searchParams.has("backup")) return route.fulfill({json:{...cloud,data:{...fixture,txs:fixture.txs.slice(0,3)},onboarded:true,version:9}});
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
    } else if(emptyCloud){
      if(scenario.startsWith("empty-cloud-local")){
        const dialog=page.getByRole("alertdialog",{name:"Data perangkat belum ada di cloud"});
        await dialog.waitFor({timeout:30000});
        assert.match(await dialog.innerText(),/Perangkat ini: 68 transaksi\. Cloud: 0 transaksi/);
        await page.waitForTimeout(2000);
        assert.equal(writes.length,0,"Never overwrite owned local records or upload without confirmation");
        assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("aturduitku_data")).txs.length),68);
        await page.screenshot({path:`.e2e-artifacts/account-bootstrap-${scenario}.png`,fullPage:true});
        if(scenario==="empty-cloud-local-confirm") await dialog.getByRole("button",{name:"Simpan perangkat ini",exact:true}).click();
      }else{
        const panel=page.getByTestId("account-backup-recovery");
        await panel.waitFor({timeout:30000});
        assert.equal(await page.getByText("Halo! Saya AturDuitku",{exact:true}).count(),0);
        const input=panel.getByLabel("Pilih backup JSON",{exact:true});
        await input.setInputFiles({name:"invalid.json",mimeType:"application/json",buffer:Buffer.from("invalid")});
        await panel.getByRole("alert").waitFor();
        assert.equal(writes.length,0);
        await input.setInputFiles({name:"qa-backup.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(fixture))});
        await panel.getByRole("status").waitFor();
        assert.match(await panel.getByRole("status").innerText(),/68 transaksi/);
        await page.waitForTimeout(1800);
        assert.equal(writes.length,0,"Selecting a backup must not save before confirmation");
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,"Recovery screen must fit mobile and desktop");
        assert.ok((await panel.getByRole("button",{name:"Pulihkan backup ke akun ini",exact:true}).boundingBox()).height>=44);
        await page.screenshot({path:`.e2e-artifacts/account-bootstrap-${scenario}.png`,fullPage:true});
        await panel.getByRole("button",{name:"Pulihkan backup ke akun ini",exact:true}).click();
        if(scenario.endsWith("-race")){
          await panel.getByText("Data cloud sudah berubah. Muat ulang akun sebelum memulihkan backup.",{exact:true}).waitFor();
          assert.equal(writes.length,0,"New meaningful cloud data must not be replaced by a backup");
        }else if(scenario.endsWith("-cas")){
          await panel.getByText("Data cloud berubah saat pemulihan. Muat ulang akun sebelum mencoba lagi.",{exact:true}).waitFor();
          assert.equal(writes.length,1,"CAS conflict must not be retried as a forced overwrite");
          assert.match(await panel.getByRole("status").innerText(),/68 transaksi/,"Keep the selected backup on conflict");
        }
      }
      if(["empty-cloud-local-confirm","empty-cloud-backup","empty-cloud-backup-desktop"].includes(scenario)){
        await page.getByTestId("page-title").waitFor({timeout:30000});
        await page.waitForTimeout(1800);
        assert.equal(persistedCloud.data.txs.length,68);
        assert.equal(persistedCloud.data.dompet[0].saldo,"932000");
        await page.reload();
        await page.getByTestId("page-title").waitFor({timeout:30000});
        assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("aturduitku_data")).txs.length),68);
        assert.equal(await page.getByTestId("account-backup-recovery").count(),0);
      }
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
      if(admin){
        for(const name of ["Nanti dulu","Nanti"]){
          const button=page.getByRole("button",{name,exact:true});
          if(await button.isVisible().catch(()=>false)) await button.click();
        }
        if(desktop) await page.getByText("Admin",{exact:true}).first().click();
        else{
          await page.getByRole("button",{name:/Lainnya/}).last().click();
          await page.getByRole("dialog",{name:"Menu lainnya"}).getByRole("button",{name:/Admin/}).click();
        }
        await page.getByText("QA target",{exact:true}).waitFor();
        await page.getByText("Detail akun",{exact:true}).click();
        await page.getByRole("button",{name:"Periksa sinkronisasi",exact:true}).click();
        await page.getByText("Pemeriksaan belum berhasil. Coba lagi.",{exact:true}).waitFor();
        await page.getByRole("button",{name:"Periksa sinkronisasi",exact:true}).click();
        await page.getByTestId("admin-data-inspection").waitFor();
        assert.match(await page.getByTestId("admin-data-inspection").innerText(),scenario.includes("-restore")?/Transaksi: 0/:/Transaksi: 68/);
        assert.equal(inspectionReads,2);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
        await page.screenshot({path:`.e2e-artifacts/account-bootstrap-${scenario}.png`,fullPage:true});
        if(scenario.includes("-restore")){
          await page.getByRole("button",{name:"Pulihkan backup JSON",exact:true}).click();
          const panel=page.getByTestId("admin-backup-restore");
          await panel.getByLabel("Backup JSON customer",{exact:true}).setInputFiles({name:"qa.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(fixture))});
          await panel.getByRole("status").waitFor();
          const submit=panel.getByRole("button",{name:"Pulihkan ke server customer",exact:true});
          assert.equal(await submit.isEnabled(),false,"Preview is not authorization to save");
          assert.equal(adminRestores.length,0);
          await panel.getByLabel("Konfirmasi backup milik akun tujuan",{exact:true}).check();
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
          assert.ok((await submit.boundingBox()).height>=44);
          await page.screenshot({path:`.e2e-artifacts/account-bootstrap-${scenario}-modal.png`,fullPage:true});
          await submit.click();
          await panel.getByRole("alert").waitFor();
          assert.match(await panel.getByRole("status").innerText(),/68 transaksi/);
          await submit.click();
          await panel.waitFor({state:"hidden"});
          await page.getByTestId("admin-data-inspection").getByText(/Transaksi: 68/).waitFor();
          assert.equal(adminRestores.length,2);
          assert.match(await page.getByTestId("admin-data-inspection").innerText(),/Versi: 9/);
        }
      }
    }
    if (!repro) {
      await page.waitForTimeout(1800);
      if(["new-account","other-account-cache"].includes(scenario)) assert.equal(writes.length,0,"Never autosave defaults before setup completes");
      if(scenario==="explicit-reset") {
        const reset=writes.find(write=>write.onboarded===false);
        assert.ok(reset,"Explicit confirmed reset must still persist");
        assert.equal(reset.data.txs.length,0);
        assert.equal(reset.confirmedReset,true);
        await page.reload();
        await page.getByText("Halo! Saya AturDuitku",{exact:true}).waitFor({timeout:30000});
        assert.equal(await page.getByTestId("account-backup-recovery").count(),0,"Confirmed reset can resume setup after reload");
      }
      for (const write of writes) if (scenario !== "new-account") {
        if(scenario==="explicit-reset"&&!write.onboarded) continue;
        if(scenario==="other-account-cache") {
          assert.equal(write.data.txs.length,0,"Never migrate another account's records");
        }else{
          assert.equal(write.data.txs.length,68);
          if(emptyCloud) assert.ok(write.baseVersion>=8);
          else if(scenario==="explicit-reset") assert.ok(write.baseVersion>=7);
          else assert.equal(write.baseVersion,scenario==="legacy-cache"?0:7);
          assert.notEqual(write.force,true,"Recovery must keep normal server version protection");
          assert.equal(write.onboarded,true);
        }
      }
      assert.deepEqual(errors,[]);
      console.log(`PASS account bootstrap ${scenario}: isolated storage, verified restoration, safe failure/retry, no customer writes`);
    }
    await context.close();
  }
} finally { await browser.close(); }
