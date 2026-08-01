import assert from "node:assert/strict";
import { extractPdfStatementSummary, isEncryptedPdfBytes, parsePdfStatementLines, validatePdfStatement } from "../src/pdfStatement.js";

const bca = parsePdfStatementLines([
  "BANK CENTRAL ASIA E-STATEMENT PERIODE JULI 2026",
  "Tanggal Keterangan Mutasi Saldo",
  "01/07/2026 TRANSFER MASUK FREELANCE 2.500.000,00 CR 7.500.000,00",
  "02/07/2026 PEMBAYARAN QRIS KOPI 45.000,00 DB 7.455.000,00",
], "BCA");
assert.equal(bca.length, 2);
assert.deepEqual(bca.map(row => [row.tgl, row.tipe, row.jml]), [
  ["2026-07-01", "pemasukan", "2500000"],
  ["2026-07-02", "pengeluaran", "45000"],
]);

const mandiri = parsePdfStatementLines([
  "LIVIN BY MANDIRI ACCOUNT STATEMENT 2026",
  "Date Description Amount Balance",
  "03 Jul TRANSFER MASUK CLIENT +1,250,000.00 8,705,000.00",
  "04 Jul PURCHASE TOKO BUKU -125,000.00 8,580,000.00",
], "Mandiri");
assert.deepEqual(mandiri.map(row => [row.tgl, row.tipe, row.jml]), [
  ["2026-07-03", "pemasukan", "1250000"],
  ["2026-07-04", "pengeluaran", "125000"],
]);

const ambiguous = parsePdfStatementLines([
  "BANK STATEMENT 2026",
  "05/07/2026 TRANSAKSI LAINNYA 75.000,00 8.505.000,00",
], "Generic");
assert.equal(ambiguous[0].needsReview, true, "Arah mutasi tanpa penanda harus ditinjau user");
assert.equal(ambiguous[0].jml, "75000", "Saldo akhir tidak boleh dianggap nominal transaksi");

const dottedDate = parsePdfStatementLines([
  "STATEMENT 2026",
  "06.07.2026 TRANSFER KELUAR 125.000,00 DB 8.380.000,00",
], "Generic");
assert.equal(dottedDate[0].jml, "125000", "Tanggal dengan titik tidak boleh terbaca sebagai nominal");

const bcaOpeningAndKr = parsePdfStatementLines([
  "REKENING TAHAPAN PERIODE MEI 2026",
  "01/05 SALDO AWAL 1,264,258.94",
  "02/05 KR OTOMATIS NTRF 35,000.00 1,299,258.94",
  "03/05 TRANSAKSI DEBIT 15,869.00 DB 1,283,389.94",
  "SALDO AWAL : 1,264,258.94",
  "MUTASI CR : 35,000.00 1",
  "MUTASI DB : 15,869.00 1",
  "SALDO AKHIR : 1,283,389.94",
], "BCA");
assert.equal(bcaOpeningAndKr.length, 2, "Saldo awal bukan transaksi");
assert.deepEqual(bcaOpeningAndKr.map(row=>row.tipe), ["pemasukan","pengeluaran"]);

const briLines = [
  "LAPORAN TRANSAKSI FINANSIAL",
  "Tanggal Transaksi Uraian Transaksi Teller Debet Kredit Saldo",
  "05/07/26 13:29:30 Pembayaran Tagihan Kartu Kredit 50,000.00 0.00 3,138,840.60",
  "15/07/26 21:05:53 Transfer BI-Fast dari BANK CENTRAL ASIA 0.00 1,544,000.00 4,682,840.60",
  "Saldo Awal Total Transaksi Debet Total Transaksi Kredit Saldo Akhir",
  "Opening Balance Total Debit Transaction Total Credit Transaction Closing Balance",
  "3,188,840.60 50,000.00 1,544,000.00 4,682,840.60",
];
const bri = parsePdfStatementLines(briLines, "BRI");
assert.deepEqual(bri.map(row=>[row.tipe,row.jml]), [["pengeluaran","50000"],["pemasukan","1544000"]]);
assert.deepEqual(extractPdfStatementSummary(briLines), {opening:3188840.6,income:1544000,expense:50000,closing:4682840.6});
assert.equal(validatePdfStatement(briLines,bri).accurate,true);

const mandiriNumberedFee = parsePdfStatementLines([
  "e-Statement Mandiri 2026",
  "03 Jul 2026",
  "6 Biaya administrasi kartu debit -4.000,00 281.250,00",
], "Mandiri");
assert.equal(mandiriNumberedFee.length,1,"Nomor transaksi tidak boleh dianggap sebagai tanggal baru");
assert.equal(mandiriNumberedFee[0].jml,"4000");
assert.equal(isEncryptedPdfBytes(new TextEncoder().encode("trailer << /Encrypt 14 0 R >>")), true, "PDF terenkripsi harus dikenali sebelum mesin PDF dimuat");
assert.equal(isEncryptedPdfBytes(new TextEncoder().encode("trailer << /Root 1 0 R >>")), false, "PDF biasa tidak boleh meminta password");

console.log("PDF e-statement parser tests passed");
