import assert from "node:assert/strict";
import {
  buildReportActivity,
  filterTransactionsByPeriod,
  formatReportPeriod,
  getReportPeriodRange,
  shiftReportAnchor,
  summarizeTransactions,
} from "../src/reportPeriod.js";

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

console.log("report-period tests passed");
