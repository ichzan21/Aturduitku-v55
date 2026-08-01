import assert from "node:assert/strict";
import {inferExpenseCategory, resolveExpenseCategory} from "../src/transactionCategory.js";

const cases = [
  ["QRIS DOBAR COFFEE", "Makan & Minum"],
  ["Pembayaran PLN Iconpay", "Tagihan & Utilitas"],
  ["Monthly Fee ATM", "Tagihan & Utilitas"],
  ["Biaya transfer BI-FAST", "Tagihan & Utilitas"],
  ["TRSF E-BANKING SPAYLATER", "Tagihan & Utilitas"],
  ["GRABFOOD nasi ayam", "Makan & Minum"],
  ["GOJEK GORIDE", "Transportasi"],
  ["Pembelian Bibit reksadana", "Investasi"],
  ["Transaksi Tokopedia", "Belanja"],
  ["Pembayaran Netflix", "Hiburan"],
  ["Transfer BI-Fast ke BANK CENTRAL ASIA", "Lainnya"],
  ["TRSF E-BANKING TAUFIK", "Lainnya"],
];
for (const [description, expected] of cases) assert.equal(inferExpenseCategory(description).name, expected, description);

const budgets = [{id:101,kat:"Makan & Minum"},{id:109,kat:"Lainnya"}];
assert.equal(resolveExpenseCategory("STARBUCKS", budgets).id, 101);
assert.equal(resolveExpenseCategory("TRANSFER ANTAR BANK", budgets).id, 109);
console.log("Transaction category tests passed");
