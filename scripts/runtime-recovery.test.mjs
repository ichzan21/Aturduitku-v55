import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { afterFirstPaint, classifyRuntimeFailure, getRuntimeErrorMessage, isRecoverableStorageFailure } from "../src/runtimeRecovery.js";

const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
assert.match(appSource, /const GoalCard=\(\{[^}]*lang="id"[^}]*\}\)=>\{/,
  "GoalCard harus memiliki fallback bahasa agar tidak memicu react_boundary");
assert.match(appSource, /<GoalCard[^>]*lang=\{lang\}/,
  "Pilihan bahasa aplikasi harus diteruskan ke GoalCard");

assert.equal(classifyRuntimeFailure(new Error("Failed to connect to MetaMask")).kind, "ignored");
assert.equal(classifyRuntimeFailure("Script error.").kind, "ignored");
assert.equal(classifyRuntimeFailure(new Error("Connection to Indexed Database server lost. Refresh the page to try again")).kind, "storage_disconnect");
assert.equal(classifyRuntimeFailure(new Error("Database connection is closing")).kind, "storage_disconnect");
assert.equal(classifyRuntimeFailure(new Error("Unexpected application failure")).kind, "incident");
assert.equal(isRecoverableStorageFailure("IndexedDB database connection closed"), true);
assert.equal(getRuntimeErrorMessage({ message:"Pesan aman" }), "Pesan aman");

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

console.log("Runtime recovery tests passed");
