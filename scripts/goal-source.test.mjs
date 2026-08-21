import assert from "node:assert/strict";
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

console.log("Goal source wallet tests passed.");
