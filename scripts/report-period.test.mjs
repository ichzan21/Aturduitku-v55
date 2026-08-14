import assert from "node:assert/strict";
import {
  buildReportActivity,
  buildReportCashflowActivity,
  filterTransactionsByPeriod,
  formatReportPeriod,
  getReportPdfTemplate,
  getReportPeriodRange,
  shiftReportAnchor,
  summarizeTransactions,
} from "../src/reportPeriod.js";
import { compareTransactionsNewestFirst, filterTransactionsForList, getHighestExpenseDay } from "../src/transactionList.js";

const txs = [
  { id:1, tgl:"2026-07-31", tipe:"pengeluaran", jml:"10000" },
  { id:2, tgl:"2026-08-01", tipe:"pemasukan", jml:"500000" },
  { id:3, tgl:"2026-08-02", tipe:"pengeluaran", jml:"150000" },
  { id:4, tgl:"2026-08-03", tipe:"pengeluaran", jml:"25000" },
  { id:5, tgl:"2026-08-03T12:00:00.000Z", tipe:"tabungan", jml:"50000" },
  { id:6, tgl:"2026-08-09", tipe:"investasi", jml:"75000" },
  { id:7, tgl:"2026-09-01", tipe:"pengeluaran", jml:"20000" },
  { id:8, tgl:"2025-08-03", tipe:"pengeluaran", jml:"999999" },
  { id:9, tgl:"2026-08-03", tipe:"transfer_internal_keluar", jml:"90000" },
];

assert.deepEqual(getReportPeriodRange("daily", "2026-08-03"), { start:"2026-08-03", end:"2026-08-03" });
assert.deepEqual(getReportPeriodRange("weekly", "2026-08-05"), { start:"2026-08-03", end:"2026-08-09" });
assert.deepEqual(getReportPeriodRange("monthly", "2026-02-15"), { start:"2026-02-01", end:"2026-02-28" });
assert.deepEqual(getReportPeriodRange("yearly", "2026-08-03"), { start:"2026-01-01", end:"2026-12-31" });

assert.equal(filterTransactionsByPeriod(txs, "daily", "2026-08-03").length, 3);
assert.equal(filterTransactionsByPeriod(txs, "weekly", "2026-08-05").length, 4);
assert.equal(filterTransactionsByPeriod(txs, "monthly", "2026-08-03").length, 6);
assert.equal(filterTransactionsByPeriod(txs, "yearly", "2026-08-03").length, 8);

assert.deepEqual(summarizeTransactions(filterTransactionsByPeriod(txs, "monthly", "2026-08-03")), {
  income:500000,
  expense:175000,
  saving:50000,
  investment:75000,
  future:125000,
  net:200000,
});

assert.equal(shiftReportAnchor("2026-01-31", "monthly", 1), "2026-02-28");
assert.equal(shiftReportAnchor("2026-08-03", "weekly", -1), "2026-07-27");
assert.match(formatReportPeriod("monthly", "2026-08-03"), /Agustus 2026/i);
assert.deepEqual(buildReportActivity(txs, "weekly", "2026-08-05").map(item => item.value), [25000, 0, 0, 0, 0, 0, 0]);

const visibleTransactions = filterTransactionsForList(txs, { type:"pengeluaran" });
assert.equal(visibleTransactions.length, 5);
assert.deepEqual(summarizeTransactions(visibleTransactions), {
  income:0,
  expense:1204999,
  saving:0,
  investment:0,
  future:0,
  net:-1204999,
});
assert.equal(filterTransactionsForList(txs, { type:"transfer_internal" }).length, 1);
assert.equal(filterTransactionsForList(txs, { search:"", walletId:"missing" }).length, 0);
assert.deepEqual(
  filterTransactionsForList(txs, { startDate:"2026-07-31", endDate:"2026-08-01" }).map(transaction=>transaction.id),
  [2, 1],
  "Filter tanggal harus inklusif pada tanggal mulai dan akhir",
);
assert.deepEqual(
  getHighestExpenseDay([
    { tgl:"2026-08-01", tipe:"pengeluaran", jml:20000 },
    { tgl:"2026-08-01", tipe:"pengeluaran", jml:30000 },
    { tgl:"2026-08-02", tipe:"pengeluaran", jml:40000 },
    { tgl:"2026-08-02", tipe:"pemasukan", jml:999999 },
  ]),
  { date:"2026-08-01", amount:50000, count:2 },
  "Insight harus memilih tanggal dengan total pengeluaran terbesar",
);

const bulkSameDate = [
  { id:100, entryOrder:100, tgl:"2026-07-30", ket:"Ganti senar" },
  { id:101, entryOrder:101, tgl:"2026-07-30", ket:"Parkir" },
  { id:102, entryOrder:102, tgl:"2026-07-31", ket:"Infaq Jumat" },
  { id:103, entryOrder:103, tgl:"2026-07-31", ket:"Beli air" },
  { id:104, entryOrder:104, tgl:"2026-07-31", ket:"Beli sate" },
  { id:105, entryOrder:105, tgl:"2026-07-31", ket:"Biaya SMS" },
];
assert.deepEqual(
  [...bulkSameDate].sort(compareTransactionsNewestFirst).map(tx=>tx.ket),
  ["Biaya SMS", "Beli sate", "Beli air", "Infaq Jumat", "Parkir", "Ganti senar"],
  "Input massal harus berurutan tanggal terbaru lalu baris input terbaru",
);
assert.deepEqual(
  filterTransactionsForList([
    { id:200, tgl:"2026-08-03", ket:"Baris lama" },
    { id:201, tgl:"2026-08-03", ket:"Baris baru" },
  ]).map(tx=>tx.ket),
  ["Baris baru", "Baris lama"],
  "Data lama tanpa entryOrder harus tetap stabil berdasarkan ID",
);

assert.equal(getReportPdfTemplate("daily").badge, "LAPORAN HARIAN");
assert.equal(getReportPdfTemplate("weekly", "en-US").title, "Weekly Financial Report");
assert.equal(getReportPdfTemplate("yearly").mode, "yearly");
assert.deepEqual(buildReportCashflowActivity(txs, "weekly", "2026-08-05").map(item => ({
  income:item.income,
  expense:item.expense,
  future:item.future,
})), [
  { income:0, expense:25000, future:50000 },
  { income:0, expense:0, future:0 },
  { income:0, expense:0, future:0 },
  { income:0, expense:0, future:0 },
  { income:0, expense:0, future:0 },
  { income:0, expense:0, future:0 },
  { income:0, expense:0, future:75000 },
]);

console.log("report-period tests passed");
