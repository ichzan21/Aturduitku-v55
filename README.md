# 💜 AturDuitku

> **Aplikasi keuangan personal** yang lengkap, gratis, dan 100% berjalan di browser.  
> Tersedia dalam **Bahasa Indonesia 🇮🇩** dan **English 🇺🇸**

[![Deploy](https://img.shields.io/badge/Live-aturduitku--v4.vercel.app-7C3AED?style=flat-square&logo=vercel)](https://aturduitku-v4.vercel.app)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite)
![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=flat-square)

---

## ✨ Fitur

### 💳 Dompet & Transaksi
- **Multi-Dompet** — Bank, E-Wallet, Tunai, Investasi, Kripto
- **Transaksi** — Pemasukan, pengeluaran, tabungan, transfer antar dompet
- **Import Mutasi Bank** — 14 bank: BCA, Mandiri, BNI, BRI, CIMB, Jenius, OVO, GoPay, Dana, ShopeePay, BSI, Permata, BTN + Generic CSV
- **Transaksi Rutin** — Auto-input tagihan bulanan (listrik, internet, dll)

### 📊 Anggaran & Goals
- **Budget per Kategori** — Alokasi & tracking realisasi tiap bulan
- **Amplop Digital** — Envelope budgeting untuk kontrol pengeluaran
- **Goals Tabungan** — Target + progress + tambah dana dari dompet
- **Aset Tetap** — Inventaris aset + estimasi nilai

### 📋 Utang & Piutang
- Tracking utang & piutang dengan nama, jumlah, jatuh tempo
- Reminder otomatis mendekati tanggal jatuh tempo
- Cicilan parsial + riwayat pembayaran

### 📈 Laporan & Analisis
- **Health Score** — Skor kesehatan finansial (0–100)
- **Tren 6 Bulan** — Grafik pemasukan vs pengeluaran
- **Komparasi Bulanan** — Bandingkan 2 bulan sekaligus
- **Year in Review** — Rekap tahunan lengkap + skor
- **Kalkulator Cicilan** — Hitung cicilan flat & efektif
- **Export PDF** — Laporan bank-style siap print
- **Export CSV** — Data transaksi untuk Excel

### 📱 Lainnya
- **PWA** — Install ke home screen Android/iOS, bisa offline
- **Dark Mode** — Tema gelap otomatis/manual
- **Blur Saldo** — Sembunyikan nominal di tempat umum
- **Backup & Restore** — Export/import JSON lengkap
- **Notifikasi** — Reminder tagihan & anggaran mepet

---

## 🚀 Cara Jalankan

```bash
git clone https://github.com/ichzan21/Aturduitku.git
cd Aturduitku
npm install
npm run dev
```

Buka **http://localhost:5173**

```bash
# Build untuk production
npm run build
# Hasil di folder dist/ — deploy ke Vercel/Netlify/GitHub Pages
```

---

## 🛠️ Tech Stack

| | |
|---|---|
| **Framework** | React 18 + Vite |
| **Charts** | Recharts |
| **PDF** | jsPDF + jspdf-autotable |
| **Storage** | localStorage (no backend) |
| **PWA** | Service Worker + Web Manifest |

---

## 🔒 Privasi

Semua data **hanya ada di perangkatmu sendiri**.  
Tidak ada server, tidak ada akun, tidak ada tracking, tidak ada iklan.

> Backup rutin via **Setting → Export JSON** untuk keamanan data.

---

## 📁 Struktur Proyek

```
src/
  App.jsx      # Seluruh aplikasi (single-file architecture)
  index.css    # Global styles + mobile fixes
  main.jsx     # Entry point + Error Boundary
public/
  manifest.json
  sw.js        # Service Worker
  icon-*.png   # PWA icons
```

---

*AturDuitku — Atur duitmu, atur hidupmu.* 💜  
Built with ❤️ by **Iksanarsana**
