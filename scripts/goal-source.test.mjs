import assert from "node:assert/strict";
import fs from "node:fs";
import { findGoalSourceWallet, goalSourceLabel, normalizeGoalSourceId } from "../src/goalSource.js";
import { buildGoalHistoryTimeline, goalHistoryDelta } from "../src/goalHistory.js";

const wallets = [
  { id: 1, nama: "BCA" },
  { id: "bni", nama: "BNI" },
];

assert.equal(normalizeGoalSourceId(undefined), "", "goal lama tanpa sumber harus tetap valid");
assert.equal(normalizeGoalSourceId(1), 1);
assert.equal(findGoalSourceWallet(wallets, "1")?.nama, "BCA", "ID select harus cocok dengan ID numerik lama");
assert.equal(findGoalSourceWallet(wallets, "bni")?.nama, "BNI");
assert.equal(findGoalSourceWallet(wallets, "missing"), null, "dompet yang hilang harus memakai fallback");
assert.equal(goalSourceLabel(wallets, "missing"), "Belum ditentukan");

assert.equal(goalHistoryDelta({ jml:"250000" }), 250000, "Setoran Goal harus menambah saldo");
assert.equal(goalHistoryDelta({ jml:"250000", tipe:"penggunaan" }), -250000, "Penggunaan Goal harus mengurangi saldo");
assert.equal(goalHistoryDelta({ jml:"-100000", tipe:"piutang_keluar" }), -100000, "Dana Goal yang dipinjamkan harus mengurangi saldo");
const goalTimeline = buildGoalHistoryTimeline({
  kumpul:"350000",
  history:[
    { tgl:"2026-08-20", jml:"500000" },
    { tgl:"2026-08-21", jml:"250000", tipe:"penggunaan" },
    { tgl:"2026-08-22", jml:"100000", tipe:"pengembalian_piutang" },
  ],
});
assert.deepEqual(goalTimeline.map(entry => entry.balanceAfter), [350000, 250000, 500000], "Saldo setelah aktivitas Goal harus konsisten");

const appSource=fs.readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
assert.match(appSource,/const gunakanGoalDana=/,"Goal harus menyediakan alur penggunaan dana");
assert.match(appSource,/goalSpendId:currentGoal\.id/,"Transaksi penggunaan harus tertaut ke Goal");
assert.match(appSource,/onGunakan=\{gunakanGoalDana\}/,"Kartu Goal harus menerima aksi penggunaan dana");
assert.match(appSource,/Dompet tidak dipotong lagi/,"UI harus menjelaskan pencegahan debit ganda");
assert.match(appSource,/Cash flow dan budget juga tidak terpengaruh/,"UI harus menjelaskan pemisahan dari budget");
assert.match(appSource,/modal.type==="goalHistory"/,"Goal harus menyediakan modal riwayat saldo");
assert.match(appSource,/onHistory={id=>setModal\(\{type:"goalHistory",goalId:id\}\)\}/,"Kartu Goal harus dapat membuka riwayatnya");
assert.match(appSource,/tipe:"pengembalian_piutang"/,"Pengembalian piutang ke Goal harus punya tipe histori khusus");

console.log("Goal source wallet tests passed.");
