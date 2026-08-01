import assert from "node:assert/strict";
import { isEncryptedPdfBytes, parsePdfStatementLines } from "../src/pdfStatement.js";

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
assert.equal(isEncryptedPdfBytes(new TextEncoder().encode("trailer << /Encrypt 14 0 R >>")), true, "PDF terenkripsi harus dikenali sebelum mesin PDF dimuat");
assert.equal(isEncryptedPdfBytes(new TextEncoder().encode("trailer << /Root 1 0 R >>")), false, "PDF biasa tidak boleh meminta password");

console.log("PDF e-statement parser tests passed");
