# AturDuitku

AturDuitku adalah aplikasi keuangan personal berbasis React + Vite untuk mencatat transaksi, mengatur budget, memantau goals, dan melihat laporan keuangan dari satu dashboard.

Live app: [https://www.aturduitku.com](https://www.aturduitku.com)

## Fitur utama

- Dashboard keuangan harian dengan insight cepat
- Multi dompet, transaksi, transfer, dan mutasi saldo
- Budget bulanan, amplop digital, goals, aset, dan utang
- Laporan keuangan, health score, dan export data
- Login email dan Google
- Approval user manual via dashboard admin
- AI assistant via Cloudflare Workers AI

## Jalankan lokal

```bash
git clone https://github.com/ichzan21/Aturduitku-v55.git
cd Aturduitku-v55
npm install
npm run dev
```

## Environment variables

Isi environment berikut di Vercel untuk production:

```bash
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

ALLOWED_ORIGIN=https://www.aturduitku.com
ADMIN_EMAILS=ichzan24@gmail.com

CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_AI_MODEL=@cf/meta/llama-3.3-70b-instruct-fp8-fast
```

## Deploy

Build production:

```bash
npm run build
```

Deploy target saat ini menggunakan Vercel.
