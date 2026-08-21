import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { afterFirstPaint, classifyRuntimeFailure, getRuntimeErrorMessage, isModuleLoadFailure, isRecoverableStorageFailure, isServiceWorkerLifecycleFailure, scheduleModuleLoadRecovery } from "../src/runtimeRecovery.js";
import { getCloudDataPayload } from "../api/_lib/userCloudData.js";

const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const mainSource = await readFile(new URL("../src/main.jsx", import.meta.url), "utf8");
const serviceWorkerSource = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
assert.match(appSource, /const GoalCard=\(\{[^}]*lang="id"[^}]*\}\)=>\{/,
  "GoalCard harus memiliki fallback bahasa agar tidak memicu react_boundary");
assert.match(appSource, /<GoalCard[^>]*lang=\{lang\}/,
  "Pilihan bahasa aplikasi harus diteruskan ke GoalCard");

assert.equal(classifyRuntimeFailure(new Error("Failed to connect to MetaMask")).kind, "ignored");
assert.equal(classifyRuntimeFailure("Script error.").kind, "ignored");
assert.equal(classifyRuntimeFailure(new Error("Connection to Indexed Database server lost. Refresh the page to try again")).kind, "storage_disconnect");
assert.equal(classifyRuntimeFailure(new Error("Database connection is closing")).kind, "storage_disconnect");
const serviceWorkerFailure = "Failed to update a ServiceWorker for scope ('https://www.aturduitku.com/') with script ('https://www.aturduitku.com/sw.js'): An unknown error occurred when fetching the script.";
assert.equal(classifyRuntimeFailure(new Error(serviceWorkerFailure)).kind, "ignored");
assert.equal(isServiceWorkerLifecycleFailure(serviceWorkerFailure), true);
assert.equal(classifyRuntimeFailure(new Error("Unexpected application failure")).kind, "incident");
const timeoutError = new Error("Permintaan melewati batas waktu 12000 ms");
timeoutError.code = "API_TIMEOUT";
assert.deepEqual(classifyRuntimeFailure(timeoutError), { kind:"request_failure", message:"Permintaan melewati batas waktu 12000 ms", code:"API_TIMEOUT" });
assert.equal(classifyRuntimeFailure(new Error("Importing a module script failed.")).kind, "module_load");
assert.equal(classifyRuntimeFailure(new Error("Failed to fetch dynamically imported module")).kind, "module_load");
assert.equal(isModuleLoadFailure("Failed to fetch dynamically imported module"), true);
assert.equal(isRecoverableStorageFailure("IndexedDB database connection closed"), true);
assert.equal(getRuntimeErrorMessage({ message:"Pesan aman" }), "Pesan aman");
assert.match(appSource, /e\?\.target\?\.files\?\.\[0\]/, "Pemilih file harus aman saat event tidak lengkap");
assert.match(mainSource, /type:'asset_load_recovery'/, "Kegagalan chunk harus masuk jalur pemulihan, bukan crash biasa");
assert.match(serviceWorkerSource, /aturduitku-v27-landscape-session/, "Cache PWA harus berganti versi setelah dukungan landscape dan sesi diperbaiki");
assert.match(serviceWorkerSource, /fetch\(e\.request, \{ cache: 'no-store' \}\)[\s\S]*catch\(\(\) => caches\.match\(e\.request\)\)/,
  "Aset build harus network-first dengan fallback offline");

// Tab yang terlihat: start-up menunggu frame pertama seperti sebelumnya.
const visibleWindow = {
  requestAnimationFrame:callback => setTimeout(callback,0),
  requestIdleCallback:callback => setTimeout(callback,0),
  setTimeout:(callback,ms) => setTimeout(callback,ms),
};
await afterFirstPaint(visibleWindow,5000);

// Tab tersembunyi (tab latar, restore session, PWA belum difokuskan) tidak pernah
// menjalankan requestAnimationFrame. Tanpa cadangan waktu, login tidak pernah
// dimulai dan aplikasi tertahan di layar "Menyiapkan data akunmu...".
const hiddenWindow = {
  requestAnimationFrame:() => {},
  requestIdleCallback:callback => setTimeout(callback,0),
  setTimeout:(callback,ms) => setTimeout(callback,ms),
};
const hiddenStart = Date.now();
await afterFirstPaint(hiddenWindow,120);
const hiddenElapsed = Date.now() - hiddenStart;
assert.ok(hiddenElapsed >= 100,"Cadangan waktu tidak boleh berjalan lebih cepat dari yang diminta");
assert.ok(hiddenElapsed < 2000,`Tab tersembunyi harus tetap memulai aplikasi (butuh ${hiddenElapsed} ms)`);

// Peramban tanpa requestAnimationFrame sama sekali tetap harus jalan.
await afterFirstPaint({ setTimeout:(callback,ms) => setTimeout(callback,ms) },5000);

// Janji hanya boleh selesai satu kali walau kedua jalur menyala.
let resolveCount = 0;
await new Promise(done => {
  afterFirstPaint({
    requestAnimationFrame:callback => setTimeout(callback,0),
    requestIdleCallback:callback => setTimeout(callback,0),
    setTimeout:(callback,ms) => setTimeout(callback,ms),
  },1).then(() => { resolveCount += 1; setTimeout(done,60); });
});
assert.equal(resolveCount,1,"Start-up tidak boleh dipicu dua kali");

// Lingkungan tanpa window (build/SSR) langsung selesai.
await afterFirstPaint(null,5000);

const recoveryCalls = [];
const recoveryWindow = {
  sessionStorage:{ getItem:()=>null, setItem:(key,value)=>recoveryCalls.push(["session",key,value]) },
  caches:{ keys:async()=>["aturduitku-old","other-app"], delete:async key=>recoveryCalls.push(["cache",key]) },
  navigator:{ serviceWorker:{ getRegistration:async()=>({ update:async()=>recoveryCalls.push(["sw-update"]) }) } },
  setTimeout:callback=>callback(),
  location:{ reload:()=>recoveryCalls.push(["reload"]) },
};
assert.equal(scheduleModuleLoadRecovery(recoveryWindow,0),true);
await new Promise(resolve=>setTimeout(resolve,20));
assert.ok(recoveryCalls.some(([type,key])=>type==="cache"&&key==="aturduitku-old"));
assert.ok(!recoveryCalls.some(([type,key])=>type==="cache"&&key==="other-app"));
assert.ok(recoveryCalls.some(([type])=>type==="reload"));

assert.deepEqual(getCloudDataPayload({data:{wallets:[]},onboarded:true,dataVersion:7,updatedAt:"now",lastBackupAt:"backup"}), {
  data:{wallets:[]},onboarded:true,version:7,updatedAt:"now",lastBackupAt:"backup",
});

console.log("Runtime recovery tests passed");
