import assert from "node:assert/strict";
import {
  applyTransactionToWallets,
  replaceTransactionInWallets,
} from "../src/financeLedger.js";
import { assertDataVersion } from "../api/_lib/dataVersion.js";

const balances = wallets => Object.fromEntries(wallets.map(wallet => [String(wallet.id), Number(wallet.saldo)]));
const base = [{ id:"utama", saldo:"1000000" }, { id:2, saldo:"500000" }];

const income = { id:1, tipe:"pemasukan", jml:"500000", dompetId:"utama" };
const expense = { id:2, tipe:"pengeluaran", jml:"200000", dompetId:"utama" };
const transfer = { id:3, tipe:"transfer", jml:"300000", biaya:"10000", dompetId:"utama", dompetTo:"2" };

let wallets = applyTransactionToWallets(base, income);
wallets = applyTransactionToWallets(wallets, expense);
wallets = applyTransactionToWallets(wallets, transfer);
assert.deepEqual(balances(wallets), { utama:990000, "2":800000 }, "Alur pemasukan, pengeluaran, dan transfer harus konsisten");

const editedExpense = { ...expense, jml:"350000" };
wallets = replaceTransactionInWallets(wallets, expense, editedExpense);
assert.deepEqual(balances(wallets), { utama:840000, "2":800000 }, "Edit pengeluaran harus membalik nominal lama sebelum menerapkan nominal baru");

const editedTransfer = { ...transfer, jml:"100000", biaya:"5000", dompetId:2, dompetTo:"utama" };
wallets = replaceTransactionInWallets(wallets, transfer, editedTransfer);
assert.deepEqual(balances(wallets), { utama:1250000, "2":395000 }, "Edit arah transfer dan biaya harus menjaga keseimbangan kedua dompet");

wallets = applyTransactionToWallets(wallets, editedTransfer, -1);
assert.deepEqual(balances(wallets), { utama:1150000, "2":500000 }, "Menghapus transfer hasil edit harus mengembalikan saldo sebelum transfer");

assert.throws(
  () => replaceTransactionInWallets(wallets, editedExpense, { ...editedExpense, jml:"2000000" }),
  error => error.code === "insufficient_funds",
  "Edit yang melampaui saldo harus ditolak",
);
assert.deepEqual(balances(wallets), { utama:1150000, "2":500000 }, "Edit gagal tidak boleh memutasi saldo input");

assert.equal(assertDataVersion(4, 4), 4, "Versi cloud yang sama boleh disimpan");
assert.throws(
  () => assertDataVersion(5, 4),
  error => error.status === 409 && error.code === "DATA_CONFLICT" && error.currentVersion === 5,
  "Versi perangkat lama harus ditolak sebagai konflik",
);
assert.equal(assertDataVersion(5, 4, true), 5, "Resolusi konflik eksplisit boleh menimpa versi cloud");

console.log("Financial user flow tests passed");
