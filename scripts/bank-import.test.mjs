import assert from "node:assert/strict";
import { detectFinancialProvider, parseStatementCSV } from "../src/bankImport.js";

const cases = [
  ["BCA", "Tanggal,Keterangan,Cabang,Debit,Kredit,Saldo\n01/08/2026,QRIS KOPI,001,45000,0,955000", "pengeluaran", "45000"],
  ["Mandiri", "Tanggal,Deskripsi,Jumlah,Tipe,Saldo\n02/08/2026,Transfer masuk,250000,CR,1205000", "pemasukan", "250000"],
  ["BNI", "Tanggal Transaksi,Keterangan,Debet,Kredit,Saldo\n03/08/2026,GAJI,0,3500000,4705000", "pemasukan", "3500000"],
  ["BRI", "Tanggal;Uraian;Debet;Kredit;Saldo\n04/08/2026;BRIVA;125000;0;4580000", "pengeluaran", "125000"],
  ["CIMB", "Date,Description,Debit,Credit,Balance\n05/08/2026,Transfer,0,500000,5080000", "pemasukan", "500000"],
  ["Jenius", "Date,Description,Amount,Type,Balance\n06/08/2026,Card purchase,-75000,Debit,5005000", "pengeluaran", "75000"],
  ["OVO", "Tanggal & Waktu,Jenis Transaksi,Nama,Nominal,Status\n07/08/2026 08:10,Pembayaran,Merchant A,30000,Berhasil", "pengeluaran", "30000"],
  ["GoPay", "Tanggal,Keterangan,Kredit,Debet,Saldo\n08/08/2026,Cashback,15000,0,115000", "pemasukan", "15000"],
  ["Dana", "Tanggal,Deskripsi,Tipe,Jumlah,Status\n09/08/2026,Terima uang,Dana Masuk,80000,Sukses", "pemasukan", "80000"],
  ["ShopeePay", "Waktu,Deskripsi,Tipe,Jumlah,Status\n10/08/2026 10:20,Belanja,Pembayaran,45000,Selesai", "pengeluaran", "45000"],
  ["BSI", "Tanggal,Keterangan,Debit,Kredit,Saldo\n11/08/2026,Bagi hasil,0,12000,1012000", "pemasukan", "12000"],
  ["Permata", "Transaction Date,Remarks,Debit,Credit,Balance\n12/08/2026,Admin fee,7500,0,1004500", "pengeluaran", "7500"],
  ["BTN", "Tanggal,Deskripsi,Debit,Kredit,Saldo\n13/08/2026,Transfer masuk,0,100000,1104500", "pemasukan", "100000"],
];

for (const [provider, csv, type, amount] of cases) {
  const rows = parseStatementCSV(csv, provider);
  assert.equal(rows.length, 1, `${provider} harus menghasilkan satu transaksi`);
  assert.equal(rows[0].tipe, type, `${provider} harus mengenali arah transaksi`);
  assert.equal(rows[0].jml, amount, `${provider} harus mengenali nominal`);
  assert.equal(rows[0].needsReview, false, `${provider} dengan penanda jelas tidak perlu review`);
}

const reordered = parseStatementCSV("Status|Jumlah|Merchant|Waktu|Jenis Transaksi\nBerhasil|Rp 52.500|Warung|14/08/2026 12:30|Pembayaran", "GoPay");
assert.deepEqual(reordered.map(row => [row.tgl, row.tipe, row.jml, row.ket]), [["2026-08-14", "pengeluaran", "52500", "Warung"]], "Header acak harus dipetakan otomatis");

const pending = parseStatementCSV("Tanggal,Deskripsi,Tipe,Jumlah,Status\n15/08/2026,Kirim uang,Dana Keluar,100000,Pending", "Dana");
assert.equal(pending.length, 0, "Transaksi e-wallet pending tidak boleh diimpor");

const ambiguous = parseStatementCSV("Tanggal,Keterangan,Nominal\n16/08/2026,Penyesuaian,25000", "Generic");
assert.equal(ambiguous[0].needsReview, true, "Arah transaksi ambigu harus diperiksa user");

assert.equal(detectFinancialProvider("Riwayat transaksi GoPay dari aplikasi Gojek"), "GoPay");
assert.equal(detectFinancialProvider("e-Statement Bank Syariah Indonesia BYOND"), "BSI");
assert.equal(detectFinancialProvider("Dokumen tanpa identitas penyedia"), "Generic");
assert.equal(detectFinancialProvider("LAPORAN TRANSAKSI FINANSIAL\nTransfer dari BANK CENTRAL ASIA"), "BRI", "Nama bank lawan transaksi tidak boleh mengalahkan identitas penerbit");
assert.equal(detectFinancialProvider("Laporan Mutasi Rekening\nTransfer ke Mandiri"), "BNI", "Header penerbit harus diprioritaskan");

console.log("Bank and e-wallet import tests passed");
