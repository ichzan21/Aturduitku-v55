import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  applyTransactionToWallets,
  replaceTransactionInWallets,
} from "../src/financeLedger.js";
import { assertDataVersion, isMutationReplay } from "../api/_lib/dataVersion.js";
import { incomeCategoryLabel, inferIncomeCategory, normalizeIncomeTransaction } from "../src/incomeCategory.js";

const balances = wallets => Object.fromEntries(wallets.map(wallet => [String(wallet.id), Number(wallet.saldo)]));
const base = [{ id:"utama", saldo:"1000000" }, { id:2, saldo:"500000" }];
const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");

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
assert.equal(isMutationReplay("save-123", "save-123"), true, "Retry mutasi yang sama harus idempotent");
assert.equal(isMutationReplay("save-123", "save-456"), false, "Mutasi baru tidak boleh dianggap replay");
assert.equal(isMutationReplay("", ""), false, "Mutation ID kosong tidak boleh melewati pemeriksaan versi");

assert.equal(inferIncomeCategory("Gaji kantor bulan Juli"), "Gaji", "Gaji harus dikenali otomatis");
assert.equal(inferIncomeCategory("Fee proyek website klien"), "Freelance", "Fee proyek harus dikenali sebagai freelance");
assert.equal(inferIncomeCategory("Bonus dan cashback"), "Bonus", "Bonus harus dikenali otomatis");
assert.equal(inferIncomeCategory("Hasil jualan toko"), "Bisnis", "Penjualan harus dikenali sebagai bisnis");
assert.equal(inferIncomeCategory("Dividen saham BRI"), "Investasi", "Dividen harus dikenali sebagai investasi");
assert.equal(inferIncomeCategory("Transfer masuk dari keluarga"), "Transfer Masuk", "Kiriman dana harus dikenali otomatis");
assert.equal(normalizeIncomeTransaction({tipe:"pemasukan",ket:"Fee proyek",katId:1}).katId, "Freelance", "Kategori numerik impor tidak boleh bocor ke laporan pemasukan");
assert.equal(normalizeIncomeTransaction({tipe:"pemasukan",ket:"Fee proyek",katId:1}).incomeCategoryAuto, true, "Pemasukan hasil impor harus tetap dapat dikategorikan ulang otomatis");
assert.equal(incomeCategoryLabel({tipe:"pemasukan",ket:"Fee proyek",katId:"Gaji"}), "Freelance", "Data lama dengan kategori default harus dianalisis ulang");
assert.equal(incomeCategoryLabel({tipe:"pemasukan",ket:"Fee proyek",katId:"Lainnya",customKat:"Royalti"}), "Royalti", "Kategori manual user harus tetap dipertahankan");

assert.match(appSource, /tipe:"transfer",jml:pN\(jml\),katId:"",customKat:"",subKat:"",goalId:""/,
  "Transfer baru tidak boleh mewarisi kategori pengeluaran dari form sebelumnya");
assert.match(appSource, /const txKatLabel=isTransfer\?"Transfer antar dompet"/,
  "Transfer lama harus selalu tampil sebagai transfer antar dompet, bukan kategori pengeluaran");
assert.match(appSource, /Transaksi pembentuk realisasi/,
  "Realisasi budget harus dapat dibuka untuk melihat transaksi penyusunnya");
assert.match(appSource, /aria-expanded=\{sameId\(expandedBudgetId,b\.id\)\}/,
  "Kontrol rincian realisasi budget harus menyampaikan status buka-tutup secara aksesibel");
assert.match(appSource, /aria-label=\{canEditTransaction\(t\)\?"Edit nama dan detail transaksi":"Ganti nama transaksi"\}/,
  "Aksi untuk mengganti nama transaksi harus mudah dikenali");
assert.match(appSource, /Nama transaksi tidak boleh kosong/,
  "Nama transaksi hasil edit tidak boleh disimpan kosong");
assert.match(appSource, /ket:cleanDescription/,
  "Nama transaksi harus dinormalisasi sebelum disimpan");
assert.match(appSource, /canEditTransaction\(t\)\?openEditTransaction\(t\):openRenameTransaction\(t\)/,
  "Semua transaksi harus memiliki aksi rename meski edit detailnya dikunci");
assert.match(appSource, /displayName:cleanName===String\(tx\.ket\|\|tx\.tipe\|\|"Transaksi"\)\?"":cleanName/,
  "Rename transaksi terhubung harus memakai nama tampilan tanpa merusak keterangan sumber");
assert.match(appSource, /Hanya nama yang terlihat yang diubah/,
  "Modal rename harus menjelaskan bahwa data keuangan tidak ikut berubah");
assert.doesNotMatch(appSource, /tx && !tx\.locked && !tx\.importRef/,
  "Transaksi hasil import mutasi harus dapat diedit lengkap");
assert.match(appSource, /ket:transactionDisplayName\(tx\)/,
  "Edit lengkap harus memuat nama tampilan terbaru dari transaksi impor");
assert.match(appSource, /id:previous\.id,\s*displayName:""/,
  "Edit lengkap harus menyatukan nama baru ke keterangan tanpa menyisakan override lama");

console.log("Financial user flow tests passed");
