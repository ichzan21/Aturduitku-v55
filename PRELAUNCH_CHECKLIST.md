# Checklist Rilis AturDuitku

## Otomatis

Jalankan sebelum setiap push ke `main`:

```bash
npm ci
npm run qa:release
```

Perintah tersebut wajib memastikan:

- secret scan lulus;
- build produksi lulus;
- syntax seluruh API Vercel valid;
- route Google Auth, AI, Telegram, sinkronisasi, monitoring, dan backup tersedia.

## Smoke Test Production

- Buka `https://www.aturduitku.com` di tab privat dan pastikan layar login tampil tanpa jeda putih.
- Uji login Google dan email/password, lalu logout dan reset password.
- Buat satu pemasukan dan satu pengeluaran; refresh dan cek data tetap ada.
- Buka akun yang sama di perangkat lain dan cek data cloud sama.
- Uji AI dengan pertanyaan biasa dan satu perintah pencatatan transaksi.
- Daftarkan akun uji baru dan cek satu notifikasi Telegram muncul; approve dari Telegram.
- Periksa Home, Dompet, Transaksi, Budget, Amplop, Goals, Habit, Aset, Utang, Laporan, dan Setting.
- Uji viewport Android kecil, iPhone, tablet/iPad, dan desktop; tidak boleh ada teks terpotong atau tombol tertutup.
- Pasang PWA ke Home Screen, buka ulang, lalu cek semua navigasi merespons sekali tekan.
- Cek Pengaturan > Akun & Cloud: sinkronisasi dan backup harus menampilkan waktu terbaru.

## Sesudah Deploy

- Pastikan domain production merespons `200`.
- Pastikan endpoint monitoring dan backup menolak request publik tanpa autentikasi.
- Periksa Vercel Functions/Logs untuk error baru selama 15 menit pertama.
- Jangan lanjut promosi jika build, login, sinkronisasi, atau approval gagal.
