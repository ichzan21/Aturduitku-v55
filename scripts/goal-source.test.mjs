import assert from "node:assert/strict";
import fs from "node:fs";
import { findGoalSourceWallet, goalSourceLabel, normalizeGoalSourceId } from "../src/goalSource.js";

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

const appSource=fs.readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
assert.match(appSource,/const gunakanGoalDana=/,"Goal harus menyediakan alur penggunaan dana");
assert.match(appSource,/goalSpendId:currentGoal\.id/,"Transaksi penggunaan harus tertaut ke Goal");
assert.match(appSource,/onGunakan=\{gunakanGoalDana\}/,"Kartu Goal harus menerima aksi penggunaan dana");
assert.match(appSource,/Dompet tidak dipotong lagi/,"UI harus menjelaskan pencegahan debit ganda");

console.log("Goal source wallet tests passed.");
