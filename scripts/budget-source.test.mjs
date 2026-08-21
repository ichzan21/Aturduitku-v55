import assert from "node:assert/strict";
import { budgetSourceLabel, findBudgetSourceWallet, normalizeBudgetSourceId } from "../src/budgetSource.js";

const wallets = [
  { id: 1, nama: "BCA" },
  { id: "cash", nama: "Tunai" },
];

assert.equal(normalizeBudgetSourceId(undefined), "", "budget lama harus tetap valid");
assert.equal(normalizeBudgetSourceId(1), 1);
assert.equal(findBudgetSourceWallet(wallets, "1")?.nama, "BCA", "ID dari select harus cocok dengan ID numerik lama");
assert.equal(findBudgetSourceWallet(wallets, "cash")?.nama, "Tunai");
assert.equal(findBudgetSourceWallet(wallets, "missing"), null, "dompet yang sudah dihapus harus kembali ke fallback");
assert.equal(budgetSourceLabel(wallets, "missing"), "Semua dompet");

console.log("Budget source wallet tests passed.");
