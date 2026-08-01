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

// Format riil BNI "Laporan Mutasi Rekening" (wondr): nominal bertanda +/- di baris kedua,
// footer bank di setiap halaman tidak boleh bocor ke keterangan.
const bniLines = [
  "Laporan Mutasi Rekening",
  "Periode: 1 - 30 Juni 2026",
  "Saldo Awal Total Pemasukan Total Pengeluaran Saldo Akhir",
  "100,000 +5,000,000 -3,000,000 2,100,000",
  "Tanggal & Waktu Rincian Transaksi Nominal (IDR) Saldo (IDR)",
  "Saldo Awal 100,000",
  "01 Jun 2026 Transfer",
  "+5,000,000 5,100,000",
  "06:26:02 WIB BNI - PT CONTOH SEJAHTERA",
  "PT Bank Negara Indonesia (Persero) Tbk. berizin dan diawasi oleh Otoritas Jasa Keuangan (OJK) serta merupakan",
  "peserta penjaminan Lembaga Penjamin Simpanan (LPS). 1 dari 2",
  "Laporan Mutasi Rekening",
  "Tanggal & Waktu Rincian Transaksi Nominal (IDR) Saldo (IDR)",
  "02 Jun 2026 Pembayaran Qris",
  "-3,000,000 2,100,000",
  "13:06:38 WIB TOKO CONTOH - MAKASSAR",
  "Saldo Akhir 2,100,000",
];
const bni = parsePdfStatementLines(bniLines, "BNI");
assert.deepEqual(bni.map(row => [row.tgl, row.tipe, row.jml]), [
  ["2026-06-01", "pemasukan", "5000000"],
  ["2026-06-02", "pengeluaran", "3000000"],
]);
assert.ok(!/pt bank negara/i.test(bni[0].ket), "Footer bank tidak boleh masuk keterangan");
assert.ok(!/\bWIB\b/.test(bni[0].ket), "Jam transaksi tidak boleh masuk keterangan");
assert.deepEqual(extractPdfStatementSummary(bniLines), { opening:100000, income:5000000, expense:3000000, closing:2100000 });
assert.equal(validatePdfStatement(bniLines, bni).accurate, true);

// Format riil Mandiri e-Statement (Livin): tanggal di baris sendiri, lalu "no ±nominal saldo".
const mandiriLivin = parsePdfStatementLines([
  "e-Statement",
  "Menara Mandiri 1 Jalan Jenderal Sudirman Kav. 54-55, Jakarta 12190, Indonesia",
  "Nama/ Name : CONTOH Periode/ Period : 01 Jul 2026 - 28 Jul 2026 1 dari 2",
  "Saldo Awal/ Initial Balance : 0,00",
  "Nomor Rekening/ Account Number : 1234567890 Dana Masuk/ Incoming Transactions : + 203.000,00",
  "Dana Keluar/ Outgoing Transactions : - 4.000,00",
  "Saldo Akhir/ Closing Balance : 199.000,00",
  "No Tanggal Keterangan Nominal (IDR) Saldo (IDR)",
  "Transfer antar Mandiri",
  "02 Jul 2026",
  "1 +203.000,00 203.000,00",
  "17:40:21 WIB",
  "1234567890 987654321",
  "03 Jul 2026",
  "6 Biaya administrasi kartu debit -4.000,00 199.000,00",
  "05:06:20 WIB",
  "PT Bank Mandiri (Persero) Tbk. berizin dan diawasi oleh Otoritas Jasa Keuangan (OJK) dan Bank Indonesia (BI),",
  "Mandiri Call 14000",
], "Mandiri");
assert.deepEqual(mandiriLivin.map(row => [row.tgl, row.tipe, row.jml]), [
  ["2026-07-02", "pemasukan", "203000"],
  ["2026-07-03", "pengeluaran", "4000"],
]);
assert.ok(!/\bWIB\b/.test(mandiriLivin[0].ket), "Jam WIB tidak boleh masuk keterangan Mandiri");
assert.ok(!/mandiri call/i.test(mandiriLivin[1].ket), "Footer Mandiri tidak boleh masuk keterangan");

// Pergantian halaman BCA: header halaman baru tidak boleh menempel ke transaksi terakhir.
const bcaPageBreak = parsePdfStatementLines([
  "REKENING TAHAPAN PERIODE MEI 2026",
  "TANGGAL KETERANGAN CBG MUTASI SALDO",
  "30/05 TRANSAKSI DEBIT TGL: 30/05 39,500.00 DB 897,182.94",
  "QR 918",
  "Bersambung ke halaman berikut",
  "REKENING TAHAPAN",
  "K C P D A Y E U H K O L O T",
  "NAMA NASABAH NO. REKENING : 1234567890",
  "TANGGAL KETERANGAN CBG MUTASI SALDO",
  "31/05 TRANSAKSI DEBIT TGL: 31/05 30,000.00 DB 867,182.94",
], "BCA");
assert.deepEqual(bcaPageBreak.map(row => [row.tipe, row.jml]), [
  ["pengeluaran", "39500"],
  ["pengeluaran", "30000"],
]);
assert.ok(!/NO\. REKENING/i.test(bcaPageBreak[0].ket), "Header halaman BCA tidak boleh masuk keterangan");

// GoPay/e-wallet: bulan ditulis penuh, nominal bergaya "-Rp25.000" / "+Rp100.000".
const gopay = parsePdfStatementLines([
  "Riwayat Transaksi GoPay",
  "Periode 1 Juni 2026 - 30 Juni 2026",
  "01 Juni 2026",
  "Pembayaran QRIS Kopi Kenangan",
  "-Rp25.000",
  "02 Juni 2026",
  "Top Up GoPay dari BCA",
  "+Rp100.000",
  "03 Juni 2026",
  "Cashback Promo",
  "Rp500",
], "GoPay");
assert.deepEqual(gopay.map(row => [row.tgl, row.tipe, row.jml]), [
  ["2026-06-01", "pengeluaran", "25000"],
  ["2026-06-02", "pemasukan", "100000"],
  ["2026-06-03", "pemasukan", "500"],
], "Format e-wallet Rp harus terbaca dengan arah yang benar");

// OVO: nominal "IDR 50.000" dengan kata arah Masuk/Keluar.
const ovo = parsePdfStatementLines([
  "OVO Transaction History 2026",
  "01 Juni 2026 Pembayaran Merchant IDR 50.000 Keluar",
  "02 Juni 2026 Isi Saldo IDR 200.000 Masuk",
], "OVO");
assert.deepEqual(ovo.map(row => [row.tgl, row.tipe, row.jml]), [
  ["2026-06-01", "pengeluaran", "50000"],
  ["2026-06-02", "pemasukan", "200000"],
]);

// BSI dan bank lain dengan kolom Debit/Kredit terpisah seperti BRI.
const bsiLines = [
  "BANK SYARIAH INDONESIA LAPORAN MUTASI 2026",
  "Tanggal Keterangan Debit Kredit Saldo",
  "01/06/2026 BAGI HASIL 0.00 1,250.00 500,000.00",
  "02/06/2026 PEMBELIAN QRIS 75,000.00 0.00 425,000.00",
];
const bsi = parsePdfStatementLines(bsiLines, "BSI");
assert.deepEqual(bsi.map(row => [row.tgl, row.tipe, row.jml]), [
  ["2026-06-01", "pemasukan", "1250"],
  ["2026-06-02", "pengeluaran", "75000"],
], "Tabel Debit/Kredit non-BRI harus memakai logika kolom");

// Jenius: format Inggris "1 Jun 2026" dengan nominal bertanda.
const jenius = parsePdfStatementLines([
  "Jenius Account Statement 2026",
  "1 Jun 2026 Send It BCA - RENT -1,500,000.00 3,200,000.00",
  "2 Jun 2026 Top Up via Virtual Account +500,000.00 3,700,000.00",
], "Jenius");
assert.deepEqual(jenius.map(row => [row.tgl, row.tipe, row.jml]), [
  ["2026-06-01", "pengeluaran", "1500000"],
  ["2026-06-02", "pemasukan", "500000"],
]);

console.log("PDF e-statement parser tests passed");
