import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  applyTransactionToWallets,
  replaceTransactionInWallets,
} from "../src/financeLedger.js";
import { assertDataVersion, isMutationReplay } from "../api/_lib/dataVersion.js";
import { incomeCategoryLabel, inferIncomeCategory, normalizeIncomeTransaction } from "../src/incomeCategory.js";
import { buildBudgetRealization, findTransactionBudget, prepareExpenseTransactionCategory, transactionMatchesBudgetPeriod } from "../src/budgetRealization.js";
import { getBillPayment } from "../src/billPayment.js";
import { filterTransactionsForList } from "../src/transactionList.js";

const billBudget = { id:3 };
const waterBill = { nama:"Air", alokasi:"145000" };
const manualBillPayment = { id:100, tipe:"pengeluaran", katId:"3", subKat:" Air ", jml:"145.000", tgl:"2026-10-01" };
const paymentStatus = transactions => getBillPayment(transactions, billBudget, waterBill, 0, "2026-10").paid;
assert.equal(paymentStatus([manualBillPayment]), true, "Manual payment must settle the matching bill");
assert.equal(paymentStatus([{...manualBillPayment,jml:"45000"}]), false, "Partial payment must not dismiss the bill");
assert.equal(paymentStatus([{...manualBillPayment,jml:"45000"},{...manualBillPayment,id:101,jml:"100000"}]), true);
for (const changed of [{tgl:"2026-09-01"},{katId:4},{subKat:"Internet"},{tipe:"pemasukan"},{jml:"0"}])
  assert.equal(paymentStatus([{...manualBillPayment,...changed}]), false);
assert.equal(paymentStatus([{...manualBillPayment,subKat:"Air",billRef:"3:0",jml:"120000"}]), true, "Explicit bill payment preserves actual billed amount");
assert.equal(paymentStatus([{...manualBillPayment,subKat:"Internet",billRef:"3:0"}]), false, "Changed subcategory index must not settle a different bill");
assert.equal(paymentStatus(JSON.parse(JSON.stringify([manualBillPayment]))), true, "Payment survives persistence");
const transferRows = [
  {id:10,tipe:"transfer",dompetId:1,dompetTo:2,jml:"7500",tgl:"2026-10-01"},
  {id:11,tipe:"transfer_internal_keluar",dompetId:1,jml:"10000",tgl:"2026-10-01"},
  {id:12,tipe:"transfer_internal_masuk",dompetId:2,jml:"10000",tgl:"2026-10-01"},
  {...manualBillPayment,id:13,dompetId:1},
];
assert.equal(filterTransactionsForList(transferRows,{type:"transfer_internal"}).length,3);
assert.equal(filterTransactionsForList(transferRows,{type:"transfer"}).length,3);
assert.deepEqual(filterTransactionsForList(transferRows,{type:"transfer_internal",walletId:"2"}).map(tx=>tx.id).sort(),[10,12]);
assert.equal(filterTransactionsForList(transferRows,{type:"transfer_internal",walletId:"99"}).length,0);

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

const transportBudget = { id:2, kat:"Transportasi", sub:[{ nama:"Bensin" }] };
const foodBudget = { id:1, kat:"Makan & Minum", sub:[] };
const fuelTransaction = { id:"fuel", tipe:"pengeluaran", tgl:"2026-09-25", jml:"42000", katId:"2", subKat:"Bensin" };
const SeptemberRealization = buildBudgetRealization([fuelTransaction],[foodBudget,transportBudget]);
assert.equal(SeptemberRealization.totalsByBudget["2"], 42000, "ID kategori string harus tetap masuk realisasi budget numerik");
assert.equal(SeptemberRealization.rowsByBudget["2"][0].id, "fuel", "Rincian realisasi harus memuat transaksi pembentuknya");
assert.equal(transactionMatchesBudgetPeriod(fuelTransaction,2026,8), true, "Tanggal transaksi September harus cocok dengan periode budget September");
assert.equal(transactionMatchesBudgetPeriod(fuelTransaction,2026,7), false, "Transaksi tidak boleh masuk ke periode bulan yang berbeda");
assert.equal(findTransactionBudget({...fuelTransaction,katId:"lama"},[foodBudget,transportBudget])?.id,2,"Subkategori unik harus memulihkan relasi kategori data lama");
assert.equal(buildBudgetRealization([{...fuelTransaction,katId:"",subKat:""}],[foodBudget,transportBudget]).unassigned.length,1,"Transaksi tanpa kategori harus ditandai agar tidak hilang diam-diam");
const outsideBudgetExpense=prepareExpenseTransactionCategory({...fuelTransaction,katId:"",customKat:"Donasi",subKat:"Bensin"},[foodBudget,transportBudget]);
assert.deepEqual(
  {katId:outsideBudgetExpense.katId,customKat:outsideBudgetExpense.customKat,subKat:outsideBudgetExpense.subKat,budgetExcluded:outsideBudgetExpense.budgetExcluded},
  {katId:"",customKat:"Donasi",subKat:"",budgetExcluded:true},
  "Pengeluaran di luar budget harus tetap memiliki label tanpa tersambung diam-diam ke budget",
);
assert.equal(findTransactionBudget({...outsideBudgetExpense,customKat:"Transportasi"},[foodBudget,transportBudget]),null,"Pilihan di luar budget harus tetap dikecualikan meski namanya sama dengan kategori budget");
assert.equal(buildBudgetRealization([outsideBudgetExpense],[foodBudget,transportBudget]).unassigned.length,1,"Pengeluaran di luar budget harus tampil sebagai transaksi yang belum dialokasikan");
const categorizedExpense=prepareExpenseTransactionCategory({...outsideBudgetExpense,katId:"2",customKat:"Donasi"},[foodBudget,transportBudget]);
assert.equal(categorizedExpense.katId,2,"Edit kategori harus dapat memasukkan transaksi kembali ke budget");
assert.equal(categorizedExpense.budgetExcluded,false,"Transaksi yang sudah dipilihkan kategori harus masuk realisasi");
assert.equal(categorizedExpense.customKat,"","Kategori bebas lama tidak boleh mengalahkan kategori budget baru");

assert.match(appSource, /tipe:"transfer",jml:pN\(jml\),katId:"",customKat:"",subKat:"",goalId:""/,
  "Transfer baru tidak boleh mewarisi kategori pengeluaran dari form sebelumnya");
assert.match(appSource, /const txKatLabel=isTransfer\?"Transfer antar dompet"/,
  "Transfer lama harus selalu tampil sebagai transfer antar dompet, bukan kategori pengeluaran");
assert.match(appSource, /Transaksi pembentuk realisasi/,
  "Realisasi budget harus dapat dibuka untuk melihat transaksi penyusunnya");
assert.match(appSource, /Realisasi mengikuti tanggal transaksi/,
  "Halaman budget harus menjelaskan bahwa realisasi mengikuti tanggal transaksi");
assert.match(appSource, /Saldo dompet tetap berkurang dan transaksi tetap masuk laporan, tetapi tidak dihitung sebagai realisasi budget/,
  "Form harus menjelaskan dampak transaksi di luar budget");
assert.match(appSource, /<option value="">Di luar budget<\/option>/,
  "Pengeluaran manual dan massal harus menyediakan pilihan di luar budget");
assert.doesNotMatch(appSource, /Pilih kategori budget agar transaksi masuk ke realisasi/,
  "Pengeluaran manual tidak boleh lagi dipaksa masuk kategori budget");
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

const {isOutstandingDebt,remainingDebtAmount,debtReminderKey,visibleAlerts}=await import("../src/financialNotifications.js");
const {recordInvestment}=await import("../src/investmentTransaction.js");
const paidDebt={id:1,jml:"217.500",tempo:"2026-10-01",cicilan:[{jml:"217.500"}]};
assert.equal(isOutstandingDebt({...paidDebt,cicilan:[],lunas:true}),false);
assert.equal(isOutstandingDebt({...paidDebt,cicilan:[],status:"lunas"}),false);
assert.equal(isOutstandingDebt(paidDebt),false,"Pembayaran penuh harus menghentikan pengingat meskipun flag lama belum diperbarui");
const partialDebt={...paidDebt,cicilan:[{jml:"7.500"}]};
assert.equal(isOutstandingDebt(partialDebt),true);
assert.equal(remainingDebtAmount(partialDebt),210000);
const reminder={key:debtReminderKey(partialDebt),type:"warn",title:"Jatuh Tempo",body:"Sisa piutang"};
const dismissed=JSON.parse(JSON.stringify({[reminder.key]:true}));
assert.equal(visibleAlerts([reminder],dismissed,"2026-10-02").length,0,"Pengingat utang yang ditutup harus tetap tersembunyi setelah reload dan pergantian hari");
assert.equal(visibleAlerts([{...reminder,key:debtReminderKey({...partialDebt,tempo:"2026-10-05"})}],dismissed,"2026-10-02").length,1,"Perubahan jatuh tempo harus menghasilkan pengingat baru");
const investmentState={dompet:[{id:"bank",saldo:"1000000"}],asetTetap:[],txs:[],budgets:[{id:"emas",kat:"Emas",kelas:"Investasi"}]};
const investmentDraft={id:1,asetId:2,tipe:"investasi",jml:"217500",ket:"Emas digital",tgl:"2026-10-01",dompetId:"bank",katId:"emas",dompetTo:"stale"};
const invested=recordInvestment(investmentState,investmentDraft);
assert.equal(invested.dompet[0].saldo,"782500");
assert.equal(invested.asetTetap[0].nilai,"217500");
assert.equal(invested.txs[0].dompetTo,"");
assert.equal(buildBudgetRealization(invested.txs,invested.budgets,Number).totalsByBudget.emas,217500);
const toppedUp=recordInvestment(invested,{...investmentDraft,id:3,jml:"7500"});
assert.equal(toppedUp.asetTetap.length,1);
assert.equal(toppedUp.asetTetap[0].nilai,"225000");
assert.equal(toppedUp.dompet[0].saldo,"775000");
assert.throws(()=>recordInvestment(investmentState,{...investmentDraft,jml:"2000000"}),/insufficient_funds/);
assert.throws(()=>recordInvestment(investmentState,{...investmentDraft,katId:"deleted"}),/budget_not_found/);
assert.equal(investmentState.txs.length,0,"Validasi gagal tidak boleh mengubah data");
console.log("Financial user flow tests passed");
