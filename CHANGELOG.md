# AturDuitku v4 — Fitur Baru + Bug Fixes

## ✨ Fitur Baru

### 💾 Backup & Restore Data (Import/Export JSON)
- Export semua data ke file `.json` dari halaman Settings → Backup & Restore
- Import / restore data dari file backup `.json`
- Data yang di-export mencakup: semua dompet, transaksi, budget, goals, aset, utang, amplop, dan transaksi rutin
- Export CSV tetap tersedia di halaman Transaksi & Laporan

### 🔁 Transaksi Rutin (Recurring Transactions)
- Tambah transaksi yang berulang tiap bulan: gaji, cicilan, langganan, dll
- Pilih tipe (Pemasukan / Pengeluaran / Tabungan), tanggal, dompet, dan jumlah
- Aktifkan / nonaktifkan tanpa menghapus
- Satu klik "Proses Semua ke [Bulan Aktif]" untuk generate semua transaksi rutin sekaligus
- Sistem cerdas: tidak akan duplikat jika sudah diproses di bulan yang sama
- Tersedia di Settings → Transaksi Rutin

### ✉️ Amplop Digital (Envelope Budgeting)
- Halaman baru "Amplop" di navigasi
- Metode budgeting amplop virtual: alokasikan dana dari dompet ke amplop-amplop tertentu
- Setiap amplop punya nama, icon, dan alokasi dana
- Fitur per amplop:
  - **💸 Pakai** — catat pengeluaran dari amplop (dengan keterangan opsional)
  - **➕ Isi** — top-up amplop dari dompet manapun
  - **🔄 Reset** — reset saldo terpakai awal bulan
- Progress bar dengan warning otomatis jika >80% atau melebihi alokasi
- Semua transaksi amplop tercatat di riwayat transaksi

### 📅 Riwayat Saldo Historis (Time-Aware Saldo)
- Tabel di halaman Laporan yang menampilkan estimasi saldo tiap dompet per bulan (6 bulan terakhir)
- Dihitung dengan meng-reverse transaksi dari saldo saat ini
- Semakin lengkap data transaksi, semakin akurat estimasinya

### 📱 PWA (Progressive Web App)
- App bisa di-install di HP seperti aplikasi native (Add to Home Screen)
- Berjalan offline setelah pertama kali dimuat
- Manifest + Service Worker sudah terpasang

---

## 🐛 Bug Fixes (dari v3-fixed)

| # | Bug | Status |
|---|-----|--------|
| 1 | Pemasukan tidak update saldo dompet | ✅ Fixed |
| 2 | Pengeluaran tidak update saldo dompet | ✅ Fixed |
| 3 | Transfer tanpa validasi saldo | ✅ Fixed |
| 4 | Tabungan Goal via modal tidak potong saldo | ✅ Fixed |
| 5 | Hapus transaksi tidak kembalikan saldo | ✅ Fixed |
| 6 | Input massal tidak update saldo | ✅ Fixed |
| 7 | DailyChart highlight hari ini di bulan lain | ✅ Fixed |
| 8 | window.confirm (diblokir mobile) | ✅ Fixed |
| 9 | Paginasi transaksi (30/halaman) | ✅ Fixed |
| 10 | Investasi → kelas Kebutuhan; year picker mulai 2020 | ✅ Fixed |

---

## 🚀 Cara Pakai
```bash
# Extract zip, lalu:
npm install
npm run dev

# Build production:
npm run build
```
