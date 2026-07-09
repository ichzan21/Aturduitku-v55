import React, { Suspense, useState, useEffect, useMemo, useRef, createContext, useContext } from "react";
import {
  getCurrentIdToken, signInWithEmail, signInWithGoogle, signOutUser, onAuthChange, signUpWithEmail,
  saveUserData, getUserData,
} from "./firebaseClient.js";

const TrendChartLazy = React.lazy(() => import("./ChartWidgets.jsx").then(m => ({ default:m.TrendChart })));
const DailyChartLazy = React.lazy(() => import("./ChartWidgets.jsx").then(m => ({ default:m.DailyChart })));
const DonutChartLazy = React.lazy(() => import("./ChartWidgets.jsx").then(m => ({ default:m.DonutChart })));


// ─── ERROR BOUNDARY ───────────────────────────────────────────────────────────
export class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(err, info) { console.error("AturDuitku Error:", err, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{minHeight:"var(--app-height, 100dvh)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#0f0a22",color:"#fff",padding:24,fontFamily:"sans-serif"}}>
          <div style={{fontSize:48,marginBottom:16}}>⚠️</div>
          <div style={{fontSize:20,fontWeight:800,marginBottom:8,color:"#A78BFA"}}>AturDuitku</div>
          <div style={{fontSize:14,color:"#aaa",marginBottom:20,textAlign:"center"}}>Ada yang tidak beres. Coba muat ulang halaman.</div>
          <button onClick={()=>window.location.reload()} style={{padding:"12px 28px",borderRadius:12,border:"none",background:"#6D28D9",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer"}}>
            🔄 Muat Ulang
          </button>
          {this.state.error&&<details style={{marginTop:20,fontSize:10,color:"#666",maxWidth:500}}>
            <summary style={{cursor:"pointer",color:"#888"}}>Detail Error (untuk developer)</summary>
            <pre style={{marginTop:8,whiteSpace:"pre-wrap",fontSize:10}}>{String(this.state.error)}</pre>
          </details>}
        </div>
      );
    }
    return this.props.children;
  }
}


// ─── THEME CONTEXT ────────────────────────────────────────────────────────────
const ThemeCtx = createContext({});
const useT = () => useContext(ThemeCtx);

const LIGHT = {
  bg:"#F0EBF8",card:"#FFFFFF",cardAlt:"#FDFBFF",
  border:"#E9D5FF",borderLight:"#F5F0FF",
  text:"#1A0A2E",sub:"#64748B",muted:"#94A3B8",
  accent:"#6D28D9",accentSoft:"#8B5CF6",accentBg:"#EDE9FE",accentFg:"#5B21B6",accentPop:"rgba(109,40,217,0.12)",
  nav:"#FFFFFF",navActive:"#F3EEFF",navBorder:"#7C3AED",navHover:"rgba(139,92,246,.05)",
  input:"#FDFBFF",inputBorder:"#E9D5FF",
  ok:"#15803D",okBg:"#F0FDF4",okBorder:"#BBF7D0",
  err:"#B91C1C",errBg:"#FEF2F2",errBorder:"#FCA5A5",
  warn:"#D97706",warnBg:"#FFFBEB",warnBorder:"#FDE68A",
  info:"#1D4ED8",infoBg:"#EFF6FF",infoBorder:"#BFDBFE",
  scroll:"#D8B4FE",
  shadow:"0 2px 12px rgba(109,40,217,.07)",shadowMd:"0 8px 28px rgba(109,40,217,.1)",
  topbar:"rgba(255,255,255,.96)",
  hero:"linear-gradient(135deg,#3B0764 0%,#6D28D9 40%,#A855F7 75%,#E879F9 100%)",
  p:{"green":["#DCFCE7","#059669"],"red":["#FFF0F3","#E11D48"],"blue":["#EDE9FE","#6D28D9"],"indigo":["#EDE9FE","#5B21B6"],"yellow":["#FFFBEB","#B45309"],"gray":["#F5F3FF","#7C3AED"],"purple":["#ECFDF5","#059669"],"orange":["#FFF7ED","#C2410C"]},
};
const DARK = {
  bg:"#08051A",card:"#0F0A22",cardAlt:"#140D2A",
  border:"#231547",borderLight:"#180F38",
  text:"#EDE9FF",sub:"#8B7EC0",muted:"#5D4E8A",
  accent:"#A78BFA",accentSoft:"#C4B5FD",accentBg:"#1C1238",accentFg:"#DDD6FE",accentPop:"rgba(167,139,250,0.1)",
  nav:"#0C0820",navActive:"#1C1238",navBorder:"#A78BFA",navHover:"rgba(167,139,250,.07)",
  input:"#140D2A",inputBorder:"#231547",
  ok:"#22C55E",okBg:"#052E16",okBorder:"#166534",
  err:"#F87171",errBg:"#1F0909",errBorder:"#7F1D1D",
  warn:"#FBBF24",warnBg:"#1C1000",warnBorder:"#713F12",
  info:"#60A5FA",infoBg:"#0C1A3D",infoBorder:"#1E3A8A",
  scroll:"#3D2B6E",
  shadow:"0 2px 14px rgba(0,0,0,.4)",shadowMd:"0 8px 28px rgba(0,0,0,.5)",
  topbar:"rgba(15,10,34,.97)",
  hero:"linear-gradient(135deg,#0A0412 0%,#2D1060 40%,#5B21B6 75%,#7C3AED 100%)",
  p:{"green":["#052E16","#22C55E"],"red":["#1F0909","#F87171"],"blue":["#1C1238","#A78BFA"],"indigo":["#1C1238","#C4B5FD"],"yellow":["#1C1000","#FBBF24"],"gray":["#1C1238","#A78BFA"],"purple":["#052E16","#22C55E"],"orange":["#1C0800","#FB923C"]},
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const IDR  = v=>"Rp "+Math.round(Number(v||0)).toLocaleString("id-ID");
const IDRs = v=>{const n=Number(v||0),a=Math.abs(n);if(a>=1e9)return(n<0?"-":"")+"Rp "+(a/1e9).toFixed(1)+"M";if(a>=1e6)return(n<0?"-":"")+"Rp "+(a/1e6).toFixed(1)+"jt";if(a>=1e3)return(n<0?"-":"")+"Rp "+(a/1e3).toFixed(0)+"rb";return"Rp "+n;};
const fmtN = v=>{const n=String(v).replace(/\D/g,"");return n?n.replace(/\B(?=(\d{3})+(?!\d))/g,"."):"";};
const pN   = v=>String(v).replace(/\./g,"");
const N    = v=>Number(String(v||0).replace(/\./g,""))||0;
const PCT  = v=>Number(v||0).toFixed(1)+"%";
const dateKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const today= ()=>dateKey();
const dateAdd=(key,days)=>{const [y,m,d]=String(key).split("-").map(Number);const dt=new Date(y,(m||1)-1,d||1);dt.setDate(dt.getDate()+days);return dateKey(dt);};
const afterFirstPaint=()=>new Promise(resolve=>{
  if(typeof window==="undefined"){resolve();return;}
  const schedule=()=>("requestIdleCallback" in window)
    ? window.requestIdleCallback(resolve,{timeout:700})
    : setTimeout(resolve,0);
  requestAnimationFrame(()=>setTimeout(schedule,0));
});
const nowM = ()=>new Date().getMonth();
const nowY = ()=>new Date().getFullYear();
const MONTHS=["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const MSHORT=["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];
const DAYS_SHORT=["Min","Sen","Sel","Rab","Kam","Jum","Sab"];
const KAT_IN=["Gaji","Bonus","Freelance","Transfer Masuk","Investasi","Bisnis","Lainnya"];
const ICONS=["🍜","🚗","🛍️","💡","💊","🎮","📚","📈","🏦","📦","✈️","🏠","👗","💻","🎵","🐾","🍕","☕","🎁","💰","🏋️","💅","🎓","🌿","🎯","📱","🚿","🎭","🍷","🎸","🏀","⚽","🚌","🧴","🎬","🧘","🍔","🌮","🎪","💈"];
const DREAM_ICONS=["⭐","🏠","🚗","✈️","💻","👗","🎓","💍","🐾","🎵","🏋️","🌿","🍕","📸","🎮","💎","🏖️","🎯","🚀","🎺","🏄","🌏","🎭","🏕️","🛶"];
const PIE_C=["#6366F1","#22C55E","#F59E0B","#EF4444","#3B82F6","#EC4899","#14B8A6","#8B5CF6","#F97316","#06B6D4","#84CC16","#A855F7"];
const DOMPET_TIPE=["Bank","E-Wallet","Tunai","Investasi","Lainnya"];
const DEBT_PROVIDER_OPTIONS=["Shopee PayLater","SPayLater","Kredivo","Akulaku","GoPayLater","Traveloka PayLater","LazPayLater","Home Credit","Kartu Kredit","Pinjaman Teman","Lainnya"];
const detectDebtProvider=name=>{
  const q=String(name||"").toLowerCase();
  if(q.includes("spaylater")||q.includes("shopee paylater")) return "Shopee PayLater";
  return DEBT_PROVIDER_OPTIONS.find(p=>p!=="Lainnya"&&q.includes(p.toLowerCase()))||"";
};
const DOMPET_ICONS={"Bank":"🏦","E-Wallet":"📱","Tunai":"💵","Investasi":"📈","Lainnya":"💳"};

// ─── TRANSLATIONS (i18n) ─────────────────────────────────────────────────────
const MONTHS_EN=["January","February","March","April","May","June","July","August","September","October","November","December"];
const MSHORT_EN=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS_SHORT_EN=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const TR = {
  id: {
    // Nav
    home:"Home", dompet:"Dompet", trans:"Transaksi", budget:"Budget",
    amplop:"Amplop", goals:"Goals", aset:"Aset", utang:"Utang/Piutang",
    laporan:"Laporan", setting:"Pengaturan",
    // Common
    save:"Simpan", cancel:"Batal", delete:"Hapus", edit:"Edit", add:"Tambah",
    back:"← Kembali", next:"Lanjut →", done:"Selesai", close:"Tutup",
    confirm:"Konfirmasi", yes:"Ya", no:"Tidak", search:"Cari...",
    loading:"Memuat...", empty:"Belum ada data", all:"Semua",
    export:"Export", import:"Import", reset:"Reset",
    // Money
    income:"Pemasukan", expense:"Pengeluaran", saving:"Tabungan",
    transfer:"Transfer", totalBalance:"Total Saldo",
    netCashflow:"Net Cashflow", monthlyBudget:"Budget Bulanan",
    dailyBudget:"Budget Harian Tersisa", remaining:"Sisa",
    allocation:"Alokasi", realization:"Realisasi", usage:"Terpakai",
    // Dompet
    wallet:"Dompet", account:"Rekening", accountNo:"No. Rekening",
    walletType:"Tipe", addWallet:"+ Tambah Dompet", initialBalance:"Saldo Awal",
    liquidAssets:"Total Saldo Likuid",
    // Transaction
    addTx:"+ Transaksi", bulkInput:"Input Massal", date:"Tanggal",
    description:"Keterangan", amount:"Jumlah", category:"Kategori",
    transferFee:"Biaya Transfer",
    noTx:"Belum ada transaksi",
    loadMore:"Muat Lebih Banyak", goal:"Goal",
    // Budget
    needs:"Kebutuhan", wants:"Keinginan", addCategory:"+ Kategori",
    subCategory:"Sub Kategori", dueDate:"Jatuh Tempo", billReminder:"Pengingat Tagihan",
    // Goals
    targetAmount:"Target", currentSaved:"Terkumpul", deadline:"Target Selesai",
    addGoal:"+ Tambah Goal", contribute:"Setor ke Goal",
    // Debt
    debt:"Hutang", receivable:"Piutang", debtor:"Nama", paidOff:"Lunas",
    partial:"Sebagian", markPaid:"Tandai Lunas",
    // Asset
    assetName:"Nama Aset", assetValue:"Nilai", fixedAsset:"Aset Tetap",
    deductFromWallet:"Potong dari dompet",
    // Envelope
    envelope:"Amplop", fill:"Isi Ulang", use:"Pakai", resetEnv:"Reset",
    createEnvelope:"Buat Amplop", fillEnvelope:"Isi Amplop",
    spendEnvelope:"Pakai Dana Amplop",
    // Report
    report:"Laporan", healthScore:"Skor Kesehatan Finansial",
    savingRatio:"Rasio Tabungan", budgetDiscipline:"Disiplin Anggaran",
    emergencyFund:"Keamanan & Runway", prediction:"Prediksi Akhir Bulan",
    trend6mo:"Tren 6 Bulan",
    budgetPerformance:"Performa Anggaran", historicalBalance:"Histori Saldo",
    comparison:"Komparasi Laporan", exportCSV:"Export CSV", exportSheets:"Export Sheets",aiAssistant:"Dokter Keuangan",aiPlaceholder:"Ketik pesan... cth: bayar listrik 150rb",aiSending:"Mengirim...",aiTitle:"Dokter Keuangan",aiClose:"Tutup",sheetsUrlLabel:"Google Sheets Script URL",aiSyncOk:"Tersinkron ke Google Sheets!",aiSyncFail:"Gagal sinkron ke Sheets",aiRecorded:"Transaksi dicatat via AI!", exportPDF:"Export PDF",
    loanCalc:"Kalkulator Cicilan",
    // Settings
    settings:"Pengaturan", profile:"Profil & Preferensi", display:"Tampilan",
    darkMode:"Mode Gelap", darkModeDesc:"Tampilan dark mode untuk mata yang nyaman",
    blurBalance:"Sembunyikan Saldo", blurDesc:"Blur angka saldo saat di tempat umum",
    notifications:"Notifikasi Browser", notifDesc:"Alert tagihan, budget, reminder harian",
    activateNotif:"Aktifkan",
    reportPeriod:"Periode Laporan", displayName:"Nama Tampilan",
    emergencyTarget:"Target Dana Darurat (Rp)",
    backupRestore:"Backup & Restore Data",
    exportJSON:"Export JSON", importJSON:"Import / Restore JSON",
    recurringTx:"Transaksi Rutin", processNow:"Proses Sekarang",
    addRecurring:"+ Tambah Transaksi Rutin", day:"Hari",
    active:"Aktif", inactive:"Nonaktif",
    resetAll:"Reset Semua Data", resetWarning:"Tindakan ini akan menghapus SEMUA data secara permanen.",
    language:"Bahasa", changeLanguage:"Ganti Bahasa",
    // Onboarding
    ob_welcome:"Halo! Saya AturDuitku",
    ob_desc:"Aplikasi keuangan personal untuk membantu kamu mencatat, mengatur, dan merencanakan keuangan dengan mudah.",
    ob_feat1:"Catat transaksi harian",
    ob_feat2:"Atur budget bulanan",
    ob_feat3:"Lacak goals impianmu",
    ob_feat4:"Laporan bergaya bank",
    ob_feat5:"Import mutasi bank",
    ob_start:"Mulai Setup",
    ob_steps:"Setup cepat • 3 langkah • < 1 menit",
    ob_local:"Data tersimpan lokal • Tidak ada server",
    ob_nameQ:"Siapa namamu?",
    ob_nameHint:"Biar AturDuitku bisa menyapa kamu secara personal",
    ob_namePh:"Masukkan namamu...",
    ob_walletQ:"Dompet & Rekening",
    ob_walletHint:"Masukkan saldo awal masing-masing akun",
    ob_addWallet:"+ Tambah Akun Lain",
    ob_budgetQ:"Budget Bulanan",
    ob_budgetOpt:"(opsional)",
    ob_budgetHint:"Bisa diatur nanti di halaman Budget",
    ob_budgetTip:"Budget lainnya bisa ditambah di halaman Budget setelah setup selesai",
    ob_finish:"Mulai Pakai!",
    ob_step:"Langkah",
    ob_of:"dari",
    // Import mutasi
    importMutasi:"Import Mutasi Bank",
    importMutasiDesc:"Upload file CSV dari m-banking atau internet banking",
    bankFormat:"Format Bank", targetWallet:"Masukkan ke Dompet",
    clickOrDrop:"Klik atau drag & drop file CSV",
    supportedBanks:"BCA • Mandiri • BNI • BRI • CIMB • Jenius • OVO • GoPay • Dana • ShopeePay • BSI",
    importTips:"Cara download mutasi CSV:",
    importBtn:"Import", importSelected:"Transaksi",
    reupload:"Ulang",
    allTx:"Semua", inflow:"Masuk", outflow:"Keluar",
    selectedOf:"dipilih • Kategori otomatis",
    autoCategory:"Kategori otomatis, bisa diedit setelah import",
    // Greeting
    morning:"Selamat Pagi", afternoon:"Selamat Siang",
    evening:"Selamat Sore", night:"Selamat Malam",
    // Misc
    runway:"Runway", days:"hari tersisa",
    daysLeft:"hari", score:"Skor", excellent:"Excellent",
    veryGood:"Sangat Baik", good:"Baik", fair:"Cukup", poor:"Perlu Perhatian",
    safe:"AMAN", almost:"HAMPIR", over:"OVER",
    dailyAvg:"Avg harian", predExpense:"Prediksi Pengeluaran",
    predRemain:"Prediksi Sisa", advice:"Saran & Catatan",
    prevMonth:"vs bulan lalu", surp:"Surplus", def:"Defisit",
    balance:"Saldo", totalIn:"Yang Ditabung", month:"Bulan", year:"Tahun",
    wallet_bank:"Bank", wallet_ewallet:"E-Wallet", wallet_cash:"Tunai",
    wallet_invest:"Investasi", wallet_other:"Lainnya",
    kat_food:"Makan & Minum", kat_transport:"Transportasi",
    kat_bills:"Tagihan & Utilitas", kat_health:"Kesehatan",
    kat_shop:"Belanja", kat_fun:"Hiburan", kat_edu:"Pendidikan",
    kat_invest:"Investasi", kat_other:"Lainnya",
    in_salary:"Gaji", in_bonus:"Bonus", in_freelance:"Freelance",
    yearReview:"Rekap Tahunan", yearReviewBtn:"Rekap Tahunan",
    yearIncome:"Total Pemasukan", yearExpense:"Total Pengeluaran",
    yearSaving:"Total Tabungan", yearNet:"Net Cashflow Tahun Ini",
    bestMonth:"Bulan Terbaik", worstMonth:"Bulan Terboros",
    topCategories:"Kategori Terbesar", monthlyTrend:"Tren Bulanan",
    avgMonthly:"Rata-rata per Bulan", txTotal:"Total Transaksi",
    yearScore:"Skor Keuangan Tahunan", yearSummary:"Ringkasan Tahun",
    shareReport:"Bagikan", closeBtn:"Tutup",
    bankJenius:"Jenius", bankOVO:"OVO", bankGoPay:"GoPay",
    bankDana:"Dana", bankShopeePay:"ShopeePay", bankPermata:"Permata",
    bankBTN:"BTN", bankBSI:"BSI",
    importGuideJenius:"Jenius -> Akun -> Riwayat -> Export CSV",
    importGuideOVO:"OVO -> Transaksi -> Filter -> Download",
    importGuideGoPay:"GoPay (Gojek) -> Transaksi -> Download Riwayat",
    importGuideDana:"Dana -> Riwayat Transaksi -> Export",
    importGuideShopeePay:"Shopee -> Saya -> ShopeePay -> Riwayat -> Export",
    importGuideBSI:"BSIm -> Rekening -> Mutasi -> Download CSV",
    noTxYear:"Belum ada transaksi di tahun ini",
    growth:"Pertumbuhan",netWorthChange:"Perubahan Net Worth",
    vsLastMonth:"vs bulan lalu",

    in_transfer:"Transfer Masuk", in_invest:"Investasi", in_biz:"Bisnis", in_other:"Lainnya",
    // Toast messages
    toast_balanceOk:"Saldo sesuai & transaksi tercatat!",
    toast_walletAdded:"Dompet ditambahkan!",
    toast_notEnough:"Saldo tidak cukup!",
    toast_walletNotEnough:"Saldo dompet tidak cukup!",
    toast_sameDompet:"Dompet asal & tujuan tidak boleh sama!",
    toast_transferOk:"Transfer dicatat!",
    toast_expenseOk:"Pengeluaran dicatat & saldo terpotong!",
    toast_incomeOk:"Pemasukan dicatat & saldo bertambah!",
    toast_savingOk:"Tabungan dicatat & saldo terpotong!",
    toast_savingOk2:"Tabungan dicatat!",
    toast_txOk:"Transaksi dicatat!",
    toast_noteOk:"Catatan disimpan!",
    toast_recurringOk:"Transaksi rutin ditambahkan!",
    toast_noRecurring:"Tidak ada transaksi rutin aktif",
    toast_envelopeOk:"Amplop dibuat & saldo dompet terpotong!",
    toast_topupOk:"Amplop diisi!",
    toast_envelopeNotFound:"Amplop tidak ditemukan!",
    toast_envelopeFunds:"Dana amplop tidak cukup! Sisa:",
    toast_expenseEnvOk:"Pengeluaran dari amplop dicatat!",
    toast_resetEnvOk:"Amplop direset!",
    toast_walletNotFound:"Dompet sumber tidak ditemukan!",
    toast_paymentOk:"Pembayaran dicatat & saldo dompet terpotong!",
    toast_fundOk:"Dana tabungan dicatat & saldo dompet terpotong!",
    toast_pdfOk:"Laporan PDF berhasil diunduh!",
    toast_fillName:"Isi nama!",
    toast_noData:"Tidak ada data yang bisa dibaca.",
    // UI strings
    noTxToday:"Belum ada transaksi hari ini",
    noTxTodayBody:"Jangan lupa catat pengeluaran hari ini!",
    noBudgetData:"Belum ada data",
    noEnvelope:"Belum ada amplop",
    noGoal:"Belum ada goal",
    noAsset:"Belum ada aset tetap",
    noDebt:"Tidak ada utang/piutang",
    noNotif:"Tidak ada notifikasi aktif",
    noTxData:"Belum ada data pengeluaran",
    noTxFound:"Tidak ada transaksi",
    fromWallet:"Dari Dompet",
    toWallet:"Ke Dompet",
    transferFeeLabel:"Biaya Transfer",
    saveBulk:"Simpan",
    manageCategory:"Kelola Kategori",
    addCategory2:"+ Tambah Kategori",
    totalEnvFunds:"Total Dana Amplop",
    activeDebt:"Aktif",
    paidDebt:"Lunas",
    laporanPeriod:"Periode Laporan",
    notifPermission:"Izinkan Notifikasi",
    notifActive:"Aktif",
    surplusLabel:"Surplus",
    budgetMonthProg:"Progres Budget Bulanan",
    envelopePlaceholder:"Makan, Bensin, Hiburan...",
    goalPlaceholder:"Beli rumah, Liburan Eropa...",
    assetPlaceholder:"Rumah, Kendaraan, Emas...",
    ketOpsional:"Opsional",
    walletPlaceholder:"BCA, GoPay, Tunai Harian...",
    norekPlaceholder:"Nomor rekening / no HP",
    txDescPlaceholder:"Contoh: Makan siang...",
    recurringPlaceholder:"Gaji, Netflix, Cicilan...",
    subBillPlaceholder:"Netflix, Listrik...",
    catPlaceholder:"Olahraga, Travel...",
    deleteWallet:"Hapus Dompet",
    deleteWalletMsg:"Dompet dengan saldo",
    deleteEnvelope:"Hapus Amplop",
    deleteEnvelopeMsg:"Hapus amplop",
    deleteEnvelopeSuffix:"? Dana tersisa tidak akan dikembalikan.",
    balAdjustLabel:"Penyesuaian Saldo",
    debtorPlaceholder:"BRI, Pak Budi...",
    prediksiPengeluaran:"Prediksi Pengeluaran",
    prediksiSisa:"Prediksi Sisa",
    bulanShort:"Bulan",
    months:"bulan",
    csvHint:"Export CSV tersedia di halaman Transaksi & Laporan",
    recurringDesc2:"Transaksi yang berulang setiap bulan (gaji, cicilan, dll)",
    processedInfo:"transaksi diproses",
    unprocessed:"belum diproses",
    scorePeriod:"Skor keuangan",
    idealSaving:"Ideal >20%",
    idealBudget:"Ideal <85%",
    goodLabel:"BAIK",
    cautionLabel:"PERHATIAN",
    incomePDF:"PEMASUKAN",
    expensePDF:"PENGELUARAN",
    totalBalPDF:"TOTAL SALDO",
    thisMonth:"Bulan ini",
    netPositive:"Surplus",
    netNegative:"Defisit Bulan Ini",
    accDetail:"Detail Saldo Dompet",
    accDetailSub:"Saldo per akun pada akhir periode",
    accHead1:"Akun / Dompet",
    spendDistrib:"Distribusi Pengeluaran",
    spendDistribSub:"Pengeluaran per kategori bulan ini",
    trend6:"Tren 6 Bulan Terakhir",
    trend6Sub:"Perbandingan pemasukan vs pengeluaran",
    txHistory:"Riwayat Transaksi",
    budgetPerf:"Performa Anggaran",
    budgetPerfSub:"Realisasi vs Alokasi per Kategori",
    budgetHead1:"Kategori",budgetHead2:"Alokasi",budgetHead3:"Realisasi",budgetHead4:"Sisa",budgetHead5:"% Terpakai",budgetHead6:"Status",
    scoreSection:"Skor Kesehatan Keuangan",
    scoreSectionSub:"Analisis berdasarkan pola transaksi bulan ini",
    txHead1:"Tanggal",txHead2:"Keterangan",txHead3:"Kategori",txHead4:"Dompet",txHead5:"Debit",txHead6:"Kredit",
    pdfDisclaimer:"Laporan ini dibuat secara otomatis oleh aplikasi AturDuitku berdasarkan data yang diinput pengguna.",
    pdfTitle:"Laporan Keuangan",
    incomeLabel:"Pemasukan",
    expenseLabel:"Pengeluaran",
    savingLabel:"Tabungan",
    netCashLabel:"Net Cashflow",
    runwayMonths:"Bulan",
    scoreFinance:"Skor keuangan",
    filterReset:"Reset Filter",
    filterLabel:"Filter",
    allShown:"Semua",
    txShown:"transaksi ditampilkan",
    dailyExpense:"Pengeluaran Harian",
    inkludeWallet:"termasuk",
    total:"Total",

    // UI Labels (extended)
    newTx:"Transaksi Baru", bulkTitle:"Input Transaksi Massal",
    bulkDesc:"Tambah banyak transaksi sekaligus.",
    addDompetTitle:"Tambah Dompet", addGoalTitle:"Tambah Goal / Target",
    addAsetTitle:"Tambah Aset Tetap",
    walletName:"Nama", accountNoOpt:"No Rekening (Opsional)",
    openingBal:"Saldo Awal (Rp)", useWalletBal:"Beli menggunakan Saldo Dompet?",
    goalName:"Nama Goal", goalTarget:"Target Dana (Rp)",
    asetName2:"Nama Aset", asetVal:"Estimasi Nilai (Rp)",
    fromWalletShort:"Dari Dompet", toWalletShort:"Ke Dompet",
    saveNote:"+ Simpan Catatan", saveTx:"Simpan Transaksi",
    addMoreRows:"+ Baris", processAll:"Proses Semua ke",
    type:"Tipe", name:"Nama",
    debtTitle:"Catat Utang / Piutang",
    debtActive:"Total Utang Aktif", recvActive:"Total Piutang Aktif",
    dangerZone:"Zona Berbahaya",
    resetConfirmMsg:"Tindakan ini akan menghapus SEMUA data keuanganmu secara permanen. Yakin ingin melanjutkan?",
    prevPeriod:"Perbandingan Periode Lalu",
    prevIncome:"Pemasukan Periode Lalu (Rp)", prevExpense:"Pengeluaran Periode Lalu (Rp)",
    exportHint:"Export CSV tersedia di halaman Transaksi & Laporan",
    recurringDesc:"Transaksi yang berulang setiap bulan (gaji, cicilan, dll)",
    addRecurringBtn:"+ Tambah Rutin", cancelRecurring:"Tutup",
    showBalance:"Tampilkan saldo", hideBalance:"Sembunyikan saldo",
    budgetMonthly:"Total Budget Bulanan",
    budgetUsed:"Terpakai", budgetLeft:"Sisa",
    budgetDisc:"Disiplin Anggaran",
    budgetProgress:"Performa Anggaran", dayOf:"Hari ke",
    needsCat:"Kebutuhan", wantsCat:"Keinginan",
    catName:"Nama Kategori", catClass:"Kelas",
    subName:"Nama", billDate:"Jatuh Tempo",
    envelopeHero:"Total Amplop", envelopeLeft:"Sisa",
    envelopeName:"Nama Amplop", envelopeAlloc:"Alokasi Dana (Rp)",
    envelopeSource:"Dompet Sumber",
    createTransfer:"Buat & Transfer Dana",
    createFirst:"+ Buat Amplop Pertama",
    goalsStats:"Statistik Goals", goalsAchieved:"Tercapai",
    goalsAdd:"Tambahkan target keuanganmu!",
    addFirstGoal:"+ Tambah Goal Pertama",
    addGoalBtn:"+ Tambah Goal",
    assetHero:"Total Aset", assetLiquid:"Likuid",
    assetDebt:"Utang",
    walletSection:"Dompet & Akun", assetSection:"Aset Tetap",
    adjustBalance:"Sesuaikan Saldo Otomatis",
    searchTx:"Cari transaksi...",
    allWallets:"Semua Dompet", allTypes:"Semua Tipe",
    txCount:"Transaksi", showAll:"Semua",
    upcomingBills:"Tagihan Mendatang", noBills:"Tidak ada tagihan",
    topExpense:"Top Pengeluaran",
    recentTx:"Transaksi Terbaru",
    monthlyScore:"Skor keuanganmu",
    savingRatioLabel:"Rasio Tabungan", disciplineLabel:"Disiplin Anggaran",
    allSafe:"Semua kategori dalam batas aman!",
    histBalance:"Riwayat Saldo",
    histDesc:"Saldo tiap dompet diestimasi berdasarkan transaksi",
    activeLabel:"Aktif", monthCol:"Bulan", totalCol:"Total",
    spendDetail:"Rincian Pengeluaran",
    tipPerCat:"Saran per Kategori",
    navMain:"Beranda", navFinance:"Keuangan", navSettings2:"Pengaturan",
    debtType_utang:"Utang", debtType_piutang:"Piutang", debtType_biz:"Bisnis",
    paidOff2:"Lunas", unpaid:"Belum Lunas",
    today2:"Hari ini", overdue:"Terlambat",
    restoreTitle:"Import / Restore Data",
    confirmBtn:"Ya, Lanjutkan",
    runwayLabel:"Dana Bertahan", runwayDesc:"Berapa lama saldo bisa bertahan",
    topSpend:"Pengeluaran Terbesar",
    predSafe:"Aman", predDeficit:"Akan defisit",
    overLabel:"Over", almostLabel:"Hampir", safeLabel:"Aman",
    scoreLabel:"Skor",
    recurringAdd:"+ Tambah Transaksi Rutin", recurringClose:"Tutup",
    recurringDay:"Tanggal", recurringType:"Tipe",
    notifSummary:"Ringkasan Notifikasi",
    more:"Lainnya",
    imported:"Tersimpan", balAdjust:"Penyesuaian Saldo",
    resetDataTitle:"Reset Semua Data",
    inflow2:"Masuk", outflow2:"Keluar", savingShort:"Tabung",
    allSelected:"Batal", selectAll:"Semua",
    envelopeInfo:"Amplop Digital adalah cara budgeting dengan memasukkan uang ke amplop-amplop virtual.",
    ideal20:"dari ideal 20%", ideal85:"Ideal <85%",
  },
  en: {
    // Nav
    home:"Home", dompet:"Wallets", trans:"Transactions", budget:"Budget",
    amplop:"Envelopes", goals:"Goals", aset:"Assets", utang:"Debt/Receivables",
    laporan:"Reports", setting:"Settings",
    // Common
    save:"Save", cancel:"Cancel", delete:"Delete", edit:"Edit", add:"Add",
    back:"Back", next:"Next", done:"Done", close:"Close",
    confirm:"Confirm", yes:"Yes", no:"No", search:"Search...",
    loading:"Loading...", empty:"No data yet", all:"All",
    export:"Export", import:"Import", reset:"Reset",
    // Money
    income:"Income", expense:"Expense", saving:"Saving",
    transfer:"Transfer", totalBalance:"Total Balance",
    netCashflow:"Net Cashflow", monthlyBudget:"Monthly Budget",
    dailyBudget:"Daily Budget Remaining", remaining:"Remaining",
    allocation:"Allocation", realization:"Spent", usage:"Usage",
    // Dompet
    wallet:"Wallet", account:"Account", accountNo:"Account No.",
    walletType:"Type", addWallet:"+ Add Wallet", initialBalance:"Opening Balance",
    liquidAssets:"Total Liquid Balance",
    // Transaction
    addTx:"+ Transaction", bulkInput:"Bulk Input", date:"Date",
    description:"Description", amount:"Amount", category:"Category",
    transferFee:"Transfer Fee",
    noTx:"No transactions yet",
    loadMore:"Load More", goal:"Goal",
    // Budget
    needs:"Needs", wants:"Wants", addCategory:"+ Category",
    subCategory:"Sub Category", dueDate:"Due Date", billReminder:"Bill Reminder",
    // Goals
    targetAmount:"Target", currentSaved:"Saved", deadline:"Target Date",
    addGoal:"+ Add Goal", contribute:"Contribute to Goal",
    // Debt
    debt:"Debt", receivable:"Receivable", debtor:"Name", paidOff:"Paid Off",
    partial:"Partial", markPaid:"Mark as Paid",
    // Asset
    assetName:"Asset Name", assetValue:"Value", fixedAsset:"Fixed Assets",
    deductFromWallet:"Deduct from wallet",
    // Envelope
    envelope:"Envelope", fill:"Top Up", use:"Spend", resetEnv:"Reset",
    createEnvelope:"Create Envelope", fillEnvelope:"Top Up Envelope",
    spendEnvelope:"Spend from Envelope",
    // Report
    report:"Reports", healthScore:"Financial Health Score",
    savingRatio:"Saving Ratio", budgetDiscipline:"Budget Discipline",
    emergencyFund:"Safety & Runway", prediction:"End-of-Month Forecast",
    trend6mo:"6-Month Trend",
    budgetPerformance:"Budget Performance", historicalBalance:"Balance History",
    comparison:"Monthly Comparison", exportCSV:"Export CSV", exportSheets:"Export Sheets",aiAssistant:"Dokter Keuangan",aiPlaceholder:"Type message... e.g: paid electricity 150k",aiSending:"Sending...",aiTitle:"Dokter Keuangan",aiClose:"Close",sheetsUrlLabel:"Google Sheets Script URL",aiSyncOk:"Synced to Google Sheets!",aiSyncFail:"Failed to sync to Sheets",aiRecorded:"Transaction recorded via AI!", exportPDF:"Export PDF",
    loanCalc:"Loan Calculator",
    // Settings
    settings:"Settings", profile:"Profile & Preferences", display:"Display",
    darkMode:"Dark Mode", darkModeDesc:"Dark theme for comfortable viewing",
    blurBalance:"Hide Balances", blurDesc:"Blur balance amounts in public",
    notifications:"Browser Notifications", notifDesc:"Bill alerts, budget warnings, daily reminders",
    activateNotif:"Enable",
    reportPeriod:"Report Period", displayName:"Display Name",
    emergencyTarget:"Emergency Fund Target",
    backupRestore:"Backup & Restore",
    exportJSON:"Export JSON", importJSON:"Import / Restore JSON",
    recurringTx:"Recurring Transactions", processNow:"Process Now",
    addRecurring:"+ Add Recurring", day:"Day",
    active:"Active", inactive:"Inactive",
    resetAll:"Reset All Data", resetWarning:"This will permanently delete ALL your data.",
    language:"Language", changeLanguage:"Change Language",
    // Onboarding
    ob_welcome:"Hi! I'm AturDuitku",
    ob_desc:"Your personal finance app to help you track, manage, and plan your finances with ease.",
    ob_feat1:"Log daily transactions",
    ob_feat2:"Set monthly budgets",
    ob_feat3:"Track your dreams & goals",
    ob_feat4:"Bank-style reports",
    ob_feat5:"Import bank statements",
    ob_start:"Get Started",
    ob_steps:"Quick setup • 3 steps • < 1 min",
    ob_local:"Data stored locally • No server",
    ob_nameQ:"What's your name?",
    ob_nameHint:"So AturDuitku can greet you personally",
    ob_namePh:"Enter your name...",
    ob_walletQ:"Wallets & Accounts",
    ob_walletHint:"Enter the opening balance for each account",
    ob_addWallet:"+ Add Another Account",
    ob_budgetQ:"Monthly Budget",
    ob_budgetOpt:"(optional)",
    ob_budgetHint:"Can be set later in the Budget page",
    ob_budgetTip:"More budgets can be added in the Budget page after setup",
    ob_finish:"Start Now!",
    ob_step:"Step",
    ob_of:"of",
    // Import mutasi
    importMutasi:"Import Bank Statement",
    importMutasiDesc:"Upload CSV file from mobile or internet banking",
    bankFormat:"Bank Format", targetWallet:"Import to Wallet",
    clickOrDrop:"Click or drag & drop CSV file",
    supportedBanks:"BCA • Mandiri • BNI • BRI • CIMB • Jenius • OVO • GoPay • Dana • ShopeePay • BSI",
    importTips:"How to download bank statement CSV:",
    importBtn:"📥 Import", importSelected:"Transactions",
    reupload:"← Re-upload",
    allTx:"All", inflow:"↑ Income", outflow:"↓ Expense",
    selectedOf:"selected · Auto-categorized",
    autoCategory:"Auto-categorized, editable after import",
    // Greeting
    morning:"Good Morning", afternoon:"Good Afternoon",
    evening:"Good Evening", night:"Good Night",
    // Misc
    runway:"Runway", days:"days left",
    balance:"Balance", daysLeft:"days", score:"Score", excellent:"Excellent",
    veryGood:"Very Good", good:"Good", fair:"Fair", poor:"Needs Attention",
    safe:"SAFE", almost:"ALMOST", over:"OVER",
    dailyAvg:"Daily avg", predExpense:"Projected Expense",
    predRemain:"Projected Remaining", advice:"Tips & Notes",
    prevMonth:"vs last month", surp:"Surplus", def:"Deficit",
    totalIn:"Saved", month:"Month", year:"Year",
    wallet_bank:"Bank", wallet_ewallet:"E-Wallet", wallet_cash:"Cash",
    wallet_invest:"Investment", wallet_other:"Other",
    kat_food:"Food & Drinks", kat_transport:"Transportation",
    kat_bills:"Bills & Utilities", kat_health:"Health",
    kat_shop:"Shopping", kat_fun:"Entertainment", kat_edu:"Education",
    kat_invest:"Investment", kat_other:"Other",
    in_salary:"Salary", in_bonus:"Bonus", in_freelance:"Freelance",
    yearReview:"Year in Review", yearReviewBtn:"🎊 Year in Review",
    yearIncome:"Total Income", yearExpense:"Total Expenses",
    yearSaving:"Total Savings", yearNet:"Net Cashflow This Year",
    bestMonth:"Best Month", worstMonth:"Worst Month",
    topCategories:"Top Categories", monthlyTrend:"Monthly Trend",
    avgMonthly:"Monthly Average", txTotal:"Total Transactions",
    yearScore:"Annual Financial Score", yearSummary:"Year Summary",
    shareReport:"Share", closeBtn:"Close",
    bankJenius:"Jenius", bankOVO:"OVO", bankGoPay:"GoPay",
    bankDana:"Dana", bankShopeePay:"ShopeePay", bankPermata:"Permata",
    bankBTN:"BTN", bankBSI:"BSI",
    importGuideJenius:"Jenius → Account → History → Export CSV",
    importGuideOVO:"OVO → Transactions → Filter → Download",
    importGuideGoPay:"GoPay (Gojek) → Transactions → Download History",
    importGuideDana:"Dana → Transaction History → Export",
    importGuideShopeePay:"Shopee → Me → ShopeePay → History → Export",
    importGuideBSI:"BSIm → Account → Mutation → Download CSV",
    noTxYear:"No transactions this year",
    growth:"Growth",netWorthChange:"Net Worth Change",
    vsLastMonth:"vs last month",

    in_transfer:"Incoming Transfer", in_invest:"Investment", in_biz:"Business", in_other:"Other",
    // Toast messages
    toast_balanceOk:"✅ Balance adjusted & transaction recorded!",
    toast_walletAdded:"✅ Wallet added!",
    toast_notEnough:"⚠️ Insufficient balance!",
    toast_walletNotEnough:"⚠️ Wallet balance insufficient!",
    toast_sameDompet:"⚠️ Source & destination wallet cannot be the same!",
    toast_transferOk:"✅ Transfer recorded!",
    toast_expenseOk:"✅ Expense recorded & balance deducted!",
    toast_incomeOk:"✅ Income recorded & balance added!",
    toast_savingOk:"✅ Saving recorded & balance deducted!",
    toast_savingOk2:"✅ Saving recorded!",
    toast_txOk:"✅ Transaction recorded!",
    toast_noteOk:"✅ Note saved!",
    toast_recurringOk:"✅ Recurring transaction added!",
    toast_noRecurring:"ℹ️ No active recurring transactions",
    toast_envelopeOk:"✅ Envelope created & balance deducted!",
    toast_topupOk:"✅ Envelope topped up!",
    toast_envelopeNotFound:"⚠️ Envelope not found!",
    toast_envelopeFunds:"⚠️ Insufficient envelope funds! Remaining:",
    toast_expenseEnvOk:"✅ Envelope expense recorded!",
    toast_resetEnvOk:"✅ Envelope reset!",
    toast_walletNotFound:"⚠️ Source wallet not found!",
    toast_paymentOk:"✅ Payment recorded & balance deducted!",
    toast_fundOk:"✅ Savings recorded & balance deducted!",
    toast_pdfOk:"✅ PDF report downloaded!",
    toast_fillName:"⚠️ Please enter a name!",
    toast_noData:"No readable data found.",
    // UI strings
    noTxToday:"📝 No transactions today",
    noTxTodayBody:"Don't forget to log today's expenses!",
    noBudgetData:"No data yet",
    noEnvelope:"No envelopes yet",
    noGoal:"No goals yet",
    noAsset:"No fixed assets yet",
    noDebt:"No debt / receivables",
    noNotif:"✅ No active notifications",
    noTxData:"No expense data yet",
    noTxFound:"No transactions found",
    fromWallet:"From Wallet",
    toWallet:"To Wallet",
    transferFeeLabel:"Transfer Fee",
    saveBulk:"✓ Save",
    manageCategory:"Manage Categories",
    addCategory2:"+ Add Category",
    totalEnvFunds:"Total Envelope Funds",
    activeDebt:"Active",
    paidDebt:"Paid Off",
    laporanPeriod:"Report Period",
    notifPermission:"Enable Notifications",
    notifActive:"✅ Active",
    surplusLabel:"Surplus",
    budgetMonthProg:"Monthly Budget Progress",
    envelopePlaceholder:"Food, Gas, Entertainment...",
    goalPlaceholder:"Buy a house, Europe vacation...",
    assetPlaceholder:"House, Vehicle, Gold...",
    ketOpsional:"Optional",
    walletPlaceholder:"BCA, GoPay, Cash...",
    norekPlaceholder:"Account no. / phone no.",
    txDescPlaceholder:"e.g. Lunch...",
    recurringPlaceholder:"Salary, Netflix, Loan...",
    subBillPlaceholder:"Netflix, Electricity...",
    catPlaceholder:"Sports, Travel...",
    deleteWallet:"Delete Wallet",
    deleteWalletMsg:"Wallet with balance",
    deleteEnvelope:"Delete Envelope",
    deleteEnvelopeMsg:"Delete envelope",
    deleteEnvelopeSuffix:"? Remaining funds will not be returned.",
    balAdjustLabel:"Balance Adjustment",
    debtorPlaceholder:"Bank, Person name...",
    prediksiPengeluaran:"Projected Expense",
    prediksiSisa:"Projected Remaining",
    bulanShort:"Month",
    months:"months",
    csvHint:"💡 CSV export available on Transactions & Reports pages",
    recurringDesc2:"Transactions that repeat monthly (salary, subscriptions, etc.)",
    processedInfo:"transactions processed",
    unprocessed:"not yet processed",
    scorePeriod:"Financial score",
    idealSaving:"Ideal >20%",
    idealBudget:"Ideal <85%",
    goodLabel:"✓ GOOD",
    cautionLabel:"⚠ CAUTION",
    incomePDF:"INCOME",
    expensePDF:"EXPENSES",
    totalBalPDF:"TOTAL BALANCE",
    thisMonth:"This month",
    netPositive:"▲ Surplus",
    netNegative:"▼ Deficit",
    accDetail:"Wallet Balance Detail",
    accDetailSub:"Balance per account at end of period",
    accHead1:"Account / Wallet",
    spendDistrib:"Spending Distribution",
    spendDistribSub:"Expenses per category this month",
    trend6:"6-Month Trend",
    trend6Sub:"Income vs expenses comparison",
    txHistory:"Transaction History",
    budgetPerf:"Budget Performance",
    budgetPerfSub:"Realized vs Allocated per Category",
    budgetHead1:"Category",budgetHead2:"Allocated",budgetHead3:"Realized",budgetHead4:"Remaining",budgetHead5:"% Used",budgetHead6:"Status",
    scoreSection:"Financial Health Score",
    scoreSectionSub:"Analysis based on this month's transactions",
    txHead1:"Date",txHead2:"Description",txHead3:"Category",txHead4:"Wallet",txHead5:"Debit",txHead6:"Credit",
    pdfDisclaimer:"📌  This report was automatically generated by AturDuitku based on user-entered data.",
    pdfTitle:"Personal Finance Report",
    incomeLabel:"Income",
    expenseLabel:"Expenses",
    savingLabel:"Savings",
    netCashLabel:"Net Cashflow",
    runwayMonths:"Months",
    scoreFinance:"Financial score",
    filterReset:"Reset Filter",
    filterLabel:"Filter",
    allShown:"All shown",
    txShown:"transactions shown",
    dailyExpense:"📊 Daily Expenses",
    inkludeWallet:"including",
    total:"Total",

    // UI Labels (extended)
    newTx:"New Transaction", bulkTitle:"Bulk Transaction Input",
    bulkDesc:"Add multiple transactions at once.",
    addDompetTitle:"Add Wallet", addGoalTitle:"Add Goal / Target",
    addAsetTitle:"Add Fixed Asset",
    walletName:"Name", accountNoOpt:"Account No. (Optional)",
    openingBal:"Opening Balance (Rp)", useWalletBal:"Purchase from Wallet Balance?",
    goalName:"Goal Name", goalTarget:"Target Amount (Rp)",
    asetName2:"Asset Name", asetVal:"Estimated Value (Rp)",
    fromWalletShort:"From Wallet", toWalletShort:"To Wallet",
    saveNote:"+ Save Note", saveTx:"Save Transaction",
    addMoreRows:"+ Row", processAll:"Process All to",
    type:"Type", name:"Name",
    debtTitle:"Record Debt / Receivable",
    debtActive:"Total Active Debt", recvActive:"Total Active Receivables",
    dangerZone:"⚠️ Danger Zone",
    resetConfirmMsg:"This will permanently delete ALL your financial data. Are you sure?",
    prevPeriod:"Previous Period Comparison",
    prevIncome:"Previous Period Income (Rp)", prevExpense:"Previous Period Expense (Rp)",
    exportHint:"💡 CSV export available on Transactions & Reports pages",
    recurringDesc:"Transactions that repeat monthly (salary, subscriptions, etc.)",
    addRecurringBtn:"+ Add Recurring", cancelRecurring:"✕ Close",
    showBalance:"Show balances", hideBalance:"Hide balances",
    budgetMonthly:"Total Monthly Budget",
    budgetUsed:"Used", budgetLeft:"Remaining",
    budgetDisc:"Budget Discipline",
    budgetProgress:"Monthly Budget Progress", dayOf:"Day",
    needsCat:"Needs", wantsCat:"Wants",
    catName:"Category Name", catClass:"Class",
    subName:"Name", billDate:"Due Date",
    envelopeHero:"Total Envelopes", envelopeLeft:"Remaining",
    envelopeName:"Envelope Name", envelopeAlloc:"Allocation (Rp)",
    envelopeSource:"Source Wallet",
    createTransfer:"✓ Create & Transfer Funds",
    createFirst:"+ Create First Envelope",
    goalsStats:"Total Goals", goalsAchieved:"Achieved",
    goalsAdd:"Add your financial targets!",
    addFirstGoal:"+ Add First Goal",
    addGoalBtn:"+ Add Goal",
    assetHero:"Total Assets", assetLiquid:"Liquid",
    assetDebt:"Debt",
    walletSection:"💳 Wallets & Accounts", assetSection:"🏠 Fixed Assets",
    adjustBalance:"Auto-Adjust Balance",
    searchTx:"Search transactions...",
    allWallets:"All Wallets", allTypes:"All Types",
    txCount:"Transactions", showAll:"All shown",
    upcomingBills:"🚨 Upcoming Bills", noBills:"No upcoming bills",
    topExpense:"🏆 Top Expenses",
    recentTx:"Recent Transactions",
    monthlyScore:"Your financial score",
    savingRatioLabel:"Saving Ratio", disciplineLabel:"Budget Discipline",
    allSafe:"All categories within safe limits!",
    histBalance:"📅 Balance History (End-of-Month Estimate)",
    histDesc:"Balance estimated from transactions",
    activeLabel:"Active", monthCol:"Month", totalCol:"Total",
    spendDetail:"Spending Breakdown",
    tipPerCat:"💡 Tips per Category",
    navMain:"Main Menu", navFinance:"Finance", navSettings2:"Settings",
    debtType_utang:"⊖ Debt", debtType_piutang:"⊕ Receivable", debtType_biz:"💼 Business",
    paidOff2:"Paid Off", unpaid:"Outstanding",
    today2:"Today", overdue:"Overdue",
    restoreTitle:"📥 Import / Restore Data",
    confirmBtn:"Yes, Proceed",
    runwayLabel:"Cash Runway", runwayDesc:"Total balance / spending",
    topSpend:"Top Expense",
    predSafe:"Safe", predDeficit:"⚠ Deficit ahead",
    overLabel:"Over", almostLabel:"Almost", safeLabel:"Safe",
    scoreLabel:"Score",
    recurringAdd:"+ Add Recurring Transaction", recurringClose:"✕ Close",
    recurringDay:"Date", recurringType:"Type",
    notifSummary:"🔔 Notification Summary",
    more:"More",
    imported:"Saved", balAdjust:"Balance Adjustment",
    resetDataTitle:"Reset All Data",
    inflow2:"↑ Income", outflow2:"↓ Expense", savingShort:"🏦 Save",
    allSelected:"✗ Deselect All", selectAll:"✓ Select All",
    envelopeInfo:"💡 Digital Envelopes help you budget by allocating money to virtual envelopes.",
    ideal20:"of ideal 20%", ideal85:"Ideal <85%",
  }
};

// Locale-aware month/day helpers
const getMonths = (lang) => lang==="en" ? MONTHS_EN : ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const getMShort = (lang) => lang==="en" ? MSHORT_EN : ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];


// ─── DEFAULT DATA ─────────────────────────────────────────────────────────────
const INIT_BUDGETS=[
  {id:1,kat:"Makan & Minum",icon:"FOOD",kelas:"Kebutuhan",alokasi:"0",sub:[]},
  {id:2,kat:"Transportasi",icon:"MOVE",kelas:"Kebutuhan",alokasi:"0",sub:[]},
  {id:3,kat:"Tagihan & Utilitas",icon:"BILL",kelas:"Kebutuhan",alokasi:"0",sub:[{nama:"Listrik",emoji:"PAY",alokasi:"0",tempo:null},{nama:"Internet",emoji:"NET",alokasi:"0",tempo:null}]},
  {id:4,kat:"Kesehatan",icon:"HEAL",kelas:"Kebutuhan",alokasi:"0",sub:[]},
  {id:5,kat:"Belanja",icon:"SHOP",kelas:"Keinginan",alokasi:"0",sub:[]},
  {id:6,kat:"Hiburan",icon:"FUN",kelas:"Keinginan",alokasi:"0",sub:[]},
  {id:7,kat:"Pendidikan",icon:"EDU",kelas:"Keinginan",alokasi:"0",sub:[]},
  {id:8,kat:"Investasi",icon:"INV",kelas:"Kebutuhan",alokasi:"0",sub:[]},
  {id:9,kat:"Lainnya",icon:"ETC",kelas:"Kebutuhan",alokasi:"0",sub:[]},
];
const ADMIN_NAV={id:"admin",icon:"🛡️",label:"Admin"};
const LOCAL_OWNER_KEY="aturduitku_last_uid";

const authErrorMessage=(error)=>{
  const code=String(error?.code||"");
  if(code.includes("invalid-credential")||code.includes("wrong-password")||code.includes("user-not-found")) return "Email atau password belum cocok.";
  if(code.includes("email-already-in-use")) return "Email ini sudah terdaftar. Coba masuk saja.";
  if(code.includes("weak-password")) return "Password minimal 6 karakter.";
  if(code.includes("invalid-email")) return "Format email belum valid.";
  if(code.includes("operation-not-allowed")) return "Daftar lewat email belum aktif di server. Sementara pakai Google dulu, atau hubungi admin agar dibantu.";
  if(code.includes("too-many-requests")) return "Terlalu banyak percobaan. Coba lagi sebentar.";
  return "Akses belum berhasil. Cek email/password dan koneksi internet, lalu coba lagi.";
};
const INIT={
  name:"Iksanarsana",bulan:MONTHS[nowM()],tahun:String(nowY()),
  dompet:[
    {id:1,tipe:"Bank",nama:"BCA",norek:"",saldo:"0",icon:"BANK"},
    {id:2,tipe:"E-Wallet",nama:"GoPay",norek:"",saldo:"0",icon:"PAY"},
    {id:3,tipe:"Tunai",nama:"Tunai",norek:"",saldo:"0",icon:"CASH"},
  ],
  txs:[],utang:[],budgets:INIT_BUDGETS,
  goals:[],asetTetap:[],targetDana:"0",
  prevPemasukan:"0",prevPengeluaran:"0",
  recurring:[],
  amplop:[],
  habits:[],
  processedRecurring:{},
  googleEmail:"",
};
const NAV=[
  {id:"home",icon:"🏠",label:"Home"},
  {id:"dompet",icon:"👛",label:"Dompet"},
  {id:"trans",icon:"🧾",label:"Transaksi"},
  {id:"budget",icon:"📊",label:"Budget"},
  {id:"amplop",icon:"✉️",label:"Amplop"},
  {id:"goals",icon:"🎯",label:"Goals"},
  {id:"habit",icon:"🐾",label:"Habit"},
  {id:"aset",icon:"💎",label:"Aset"},
  {id:"utang",icon:"💸",label:"Utang"},
  {id:"laporan",icon:"📈",label:"Laporan"},
  {id:"setting",icon:"⚙️",label:"Setting"},
];

// ─── REUSABLE COMPONENTS ──────────────────────────────────────────────────────
const ICON_CODE_MAP={
  BANK:"🏦",PAY:"💳",CASH:"💵",
  FOOD:"🍽️",MOVE:"🚗",BILL:"🧾",HEAL:"🏥",SHOP:"🛍️",FUN:"🎮",EDU:"🎓",INV:"📈",ETC:"📦",
  ENV:"✉️",FOD:"🍽️",MOV:"🚗",SHP:"🛍️",IDEA:"💡",HLT:"🏥",TRP:"✈️",HOME:"🏠",STYL:"👕",
  WORK:"💼",MUS:"🎵",CAFE:"☕",GIFT:"🎁",FIT:"🏋️",PLNT:"🌱",STDY:"📚",PHN:"📱",CARE:"🧴",PIN:"📌",
  GOAL:"🎯",ASSET:"💎",DEBT:"💸",ADM:"🛡️",HM:"🏠",WL:"👛",TX:"🧾",BG:"📊",GL:"🎯",AS:"💎",UT:"💸",RP:"📈",ST:"⚙️",
};
const uiIcon=(icon)=>ICON_CODE_MAP[String(icon||"").trim()]||icon||"";

const Card=({ch,style={},lift})=>{
  const T=useT();
  return <div className={lift?"card-lift":""} style={{background:T.card,borderRadius:16,padding:"18px 20px",boxShadow:T.shadow,border:`1.5px solid ${T.border}`,transition:"background .3s,border-color .3s,box-shadow .3s",...style}}>{ch}</div>;
};
const ChartFallback=({height=160})=>{
  const T=useT();
  return(
    <div style={{height,borderRadius:12,background:T.cardAlt,border:`1px solid ${T.border}`,padding:12,display:"grid",gap:8,alignContent:"end",overflow:"hidden"}}>
      <div className="smooth-skeleton" style={{height:12,width:"42%"}}/>
      <div style={{display:"flex",alignItems:"flex-end",gap:6,height:Math.max(height-46,64)}}>
        {[34,54,28,72,45,64,38,58,30].map((h,i)=><div key={i} className="smooth-skeleton" style={{height:`${h}%`,flex:1,borderRadius:"8px 8px 4px 4px"}}/>)}
      </div>
    </div>
  );
};
const Sec=({t,sub,right})=>{
  const T=useT();
  return(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,paddingBottom:10,borderBottom:`1px solid ${T.borderLight}`}}>
      <div><div style={{fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:T.accent}}>{t}</div>{sub&&<div style={{fontSize:11,color:T.muted,marginTop:2}}>{sub}</div>}</div>
      {right&&<div>{right}</div>}
    </div>
  );
};
const Pill=({c,ch,xs})=>{
  const T=useT();
  const [bg,tc]=T.p[c]||T.p.indigo;
  return <span style={{display:"inline-flex",padding:xs?"1px 7px":"2px 10px",borderRadius:99,fontSize:11,fontWeight:600,background:bg,color:tc,whiteSpace:"nowrap"}}>{ch}</span>;
};
const PBar=({pct,c="#8B5CF6",h=6})=>{
  const T=useT();
  return(
    <div style={{background:T.borderLight,borderRadius:99,overflow:"hidden",height:h}}>
      <div style={{width:Math.min(Math.max(N(pct),0),100)+"%",height:"100%",background:c,borderRadius:99,transition:"width .6s cubic-bezier(.4,0,.2,1)"}}/>
    </div>
  );
};
const Btn=({onClick,ch,c,outline,style={}})=>{
  const T=useT();const bc=c||T.accent;
  return <button onClick={onClick} className="btn-go" style={{padding:"9px 18px",borderRadius:10,border:outline?`1.5px solid ${bc}`:"none",cursor:"pointer",fontWeight:700,fontSize:13,fontFamily:"inherit",background:outline?"transparent":bc,color:outline?bc:"white",...style}}>{ch}</button>;
};
const LaunchEmpty=({title,desc,actionLabel,onAction,secondaryLabel,onSecondary,icon="✨",kicker="Mulai dari sini",style={}})=>{
  const T=useT();
  return(
    <div className="empty-polish" style={{position:"relative",overflow:"hidden",textAlign:"center",padding:"30px 20px",borderRadius:18,background:`linear-gradient(180deg,${T.cardAlt},${T.card})`,border:`1.5px dashed ${T.border}`,color:T.muted,boxShadow:"inset 0 1px 0 rgba(255,255,255,.32)",...style}}>
      <div style={{position:"absolute",inset:"auto -28px -44px auto",width:120,height:120,borderRadius:"50%",background:T.accentBg,opacity:.65,pointerEvents:"none"}}/>
      <img className="cat-mascot" src="/icon-192.png" alt="" style={{position:"absolute",right:16,bottom:14,width:42,height:42,borderRadius:13,objectFit:"cover",opacity:.18,pointerEvents:"none",filter:"saturate(1.08)"}}/>
      <div style={{position:"relative",display:"inline-flex",alignItems:"center",justifyContent:"center",width:48,height:48,borderRadius:16,background:T.accentBg,color:T.accent,fontSize:23,boxShadow:`0 10px 26px ${T.accentPop}`,marginBottom:12}}>{icon}</div>
      <div style={{position:"relative",display:"inline-flex",alignItems:"center",justifyContent:"center",padding:"5px 10px",borderRadius:999,background:T.accentBg,color:T.accent,fontSize:10,fontWeight:800,letterSpacing:.8,textTransform:"uppercase",marginBottom:10}}>{kicker}</div>
      <div style={{position:"relative",fontSize:16,fontWeight:900,color:T.text,marginBottom:8}}>{title}</div>
      <div style={{position:"relative",fontSize:12,lineHeight:1.75,maxWidth:420,margin:"0 auto 18px"}}>{desc}</div>
      <div style={{position:"relative",display:"flex",justifyContent:"center",gap:10,flexWrap:"wrap"}}>
        {actionLabel&&<Btn onClick={onAction} ch={actionLabel} c={T.accent} style={{padding:"10px 16px",minWidth:150}}/>}
        {secondaryLabel&&<Btn onClick={onSecondary} ch={secondaryLabel} c={T.info} outline style={{padding:"10px 16px",minWidth:150}}/>}
      </div>
    </div>
  );
};
const Del=({onClick})=>{
  const T=useT();
  return <button onClick={onClick} className="del-x" style={{background:"none",border:"none",color:T.muted,padding:"2px 6px",fontSize:14,fontFamily:"inherit",borderRadius:4,cursor:"pointer"}}>X</button>;
};
const CurIn=({value,onChange,placeholder="0",style={}})=>{
  const T=useT();
  return(
    <input value={fmtN(value)} onChange={e=>onChange(pN(e.target.value))}
      onFocus={e=>{if(!value||pN(String(value))==="0"){onChange("");setTimeout(()=>{e.target.value="";},0);}}}
      onBlur={()=>{if(!value||value===""){onChange("0");}}}
      placeholder={placeholder} inputMode="numeric"
      style={{width:"100%",padding:"9px 12px",border:`1.5px solid ${T.inputBorder}`,borderRadius:9,fontSize:13,outline:"none",background:T.input,color:T.text,fontFamily:"inherit",...style}}
    />
  );
};

// ─── CALCULATOR ───────────────────────────────────────────────────────────────
const Calculator=({value,onChange,onClose})=>{
  const T=useT();
  const [disp,setDisp]=useState(value||"0");
  const press=k=>{
    if(k==="C"){setDisp("0");return;}
    if(k==="⌫"){setDisp(p=>p.length>1?p.slice(0,-1):"0");return;}
    if(k==="✓"){onChange(pN(disp));onClose();return;}
    if(k==="."){setDisp(p=>p.includes(".")?p:p+".");return;}
    setDisp(p=>p==="0"?k:p+k);
  };
  const keys=["7","8","9","⌫","4","5","6","C","1","2","3","","0",".",""," ✓"];
  return(
    <div style={{cursor:"pointer",position:"fixed",touchAction:"none",overscrollBehavior:"none",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:9999}} onClick={onClose}>
      <div style={{cursor:"pointer",background:T.card,borderRadius:"24px 24px 0 0",padding:"22px 22px calc(env(safe-area-inset-bottom, 0px) + 22px)",width:"100%",maxWidth:380,maxHeight:"min(520px, calc(var(--app-height, 100dvh) - 18px))",overflowY:"auto",boxShadow:T.shadowMd}} onClick={e=>e.stopPropagation()}>
        <div style={{textAlign:"right",fontSize:28,fontWeight:900,color:T.text,marginBottom:14,padding:"6px 12px",background:T.cardAlt,borderRadius:10}}>{fmtN(disp)||"0"}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
          {keys.map((k,i)=>(
            <button key={i} onClick={()=>k.trim()&&press(k.trim())} style={{padding:14,borderRadius:10,border:"none",cursor:k.trim()?"pointer":"default",fontWeight:700,fontSize:16,fontFamily:"inherit",
              background:k.trim()==="✓"?T.accent:k==="C"||k==="⌫"?T.errBg:T.cardAlt,
              color:k.trim()==="✓"?"white":k==="C"||k==="⌫"?T.err:T.text,opacity:k.trim()?1:.2}}>{k}</button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── KALKULATOR FINANSIAL (NEW) ────────────────────────────────────────────────
const KalkulatorFinansial = ({onClose}) => {
  const T=useT();
  const isMobile = typeof window !== "undefined" ? window.innerWidth < 900 : false;
  const [tab, setTab] = useState("investasi");
  const [inv, setInv] = useState({awal: "1000000", rutin: "500000", bunga: "8", tahun: "5"});
  const [pinj, setPinj] = useState({pokok: "10000000", bunga: "10", tenor: "12"});

  const calcInv = () => {
     const p = N(inv.awal); const pmt = N(inv.rutin); const r = N(inv.bunga)/100/12; const n = N(inv.tahun)*12;
     if(r===0) return p + (pmt*n);
     const future = p * Math.pow(1+r, n) + pmt * ((Math.pow(1+r, n) - 1) / r);
     return future;
  };
  const calcPinj = () => {
     const p = N(pinj.pokok); const r = N(pinj.bunga)/100/12; const n = N(pinj.tenor);
     if(r===0) return n>0 ? p/n : 0;
     const cicilan = (p * r * Math.pow(1+r, n)) / (Math.pow(1+r, n) - 1);
     return cicilan;
  };

  const IS={width:"100%",padding:"9px 12px",border:`1.5px solid ${T.inputBorder}`,borderRadius:9,fontSize:13,outline:"none",background:T.input,color:T.text,fontFamily:"inherit",marginBottom:10};
  const LS={fontSize:10,color:T.accent,marginBottom:5,fontWeight:700,display:"block",textTransform:"uppercase"};

  return (
    <>
      <div style={{fontSize:16,fontWeight:800,marginBottom:16,color:T.text}}>🧮 Kalkulator Finansial</div>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        <button onClick={()=>setTab("investasi")} style={{flex:1,padding:8,borderRadius:8,background:tab==="investasi"?T.accentBg:T.input,color:tab==="investasi"?T.accent:T.sub,border:`1.5px solid ${tab==="investasi"?T.accent:T.inputBorder}`,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>📈 Investasi</button>
        <button onClick={()=>setTab("pinjaman")} style={{flex:1,padding:8,borderRadius:8,background:tab==="pinjaman"?T.accentBg:T.input,color:tab==="pinjaman"?T.accent:T.sub,border:`1.5px solid ${tab==="pinjaman"?T.accent:T.inputBorder}`,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>💳 Pinjaman</button>
      </div>
      {tab==="investasi" && <div>
         <label style={LS}>Modal Awal (Rp)</label><CurIn value={inv.awal} onChange={v=>setInv({...inv,awal:v})} style={IS}/>
         <label style={LS}>Nabung Rutin per Bulan (Rp)</label><CurIn value={inv.rutin} onChange={v=>setInv({...inv,rutin:v})} style={IS}/>
         <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10}}>
           <div style={{flex:1}}><label style={LS}>Bunga Tahunan (%)</label><input type="number" value={inv.bunga} onChange={e=>setInv({...inv,bunga:e.target.value})} style={IS}/></div>
           <div style={{flex:1}}><label style={LS}>Lama (Tahun)</label><input type="number" value={inv.tahun} onChange={e=>setInv({...inv,tahun:e.target.value})} style={IS}/></div>
         </div>
         <div style={{background:T.infoBg,padding:16,borderRadius:12,border:`1px solid ${T.infoBorder}`,marginTop:10}}>
           <div style={{fontSize:11,color:T.info,fontWeight:700}}>Estimasi Hasil Akhir</div>
           <div style={{fontSize:24,fontWeight:900,color:T.info}}>{IDR(calcInv())}</div>
         </div>
      </div>}
      {tab==="pinjaman" && <div>
         <label style={LS}>Pokok Pinjaman (Rp)</label><CurIn value={pinj.pokok} onChange={v=>setPinj({...pinj,pokok:v})} style={IS}/>
         <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10}}>
           <div style={{flex:1}}><label style={LS}>Bunga Tahunan (%)</label><input type="number" value={pinj.bunga} onChange={e=>setPinj({...pinj,bunga:e.target.value})} style={IS}/></div>
           <div style={{flex:1}}><label style={LS}>Tenor (Bulan)</label><input type="number" value={pinj.tenor} onChange={e=>setPinj({...pinj,tenor:e.target.value})} style={IS}/></div>
         </div>
         <div style={{background:T.errBg,padding:16,borderRadius:12,border:`1px solid ${T.errBorder}`,marginTop:10}}>
           <div style={{fontSize:11,color:T.err,fontWeight:700}}>Estimasi Cicilan per Bulan</div>
           <div style={{fontSize:24,fontWeight:900,color:T.err}}>{IDR(calcPinj())}</div>
           <div style={{fontSize:11,color:T.err,marginTop:4,opacity:0.8}}>Total bayar: {IDR(calcPinj()*N(pinj.tenor))}</div>
         </div>
      </div>}
      <Btn onClick={onClose} ch="Tutup" c={T.muted} outline style={{width:"100%",marginTop:16,padding:10}} />
    </>
  )
}


// ─── CALENDAR VIEW ────────────────────────────────────────────────────────────
const CalendarView=({txs,bulan,tahun,liveDay,liveMonth,liveYear})=>{
  const T=useT();
  const mIdx=MONTHS.indexOf(bulan);const yr=Number(tahun);
  const daysInMonth=new Date(yr,mIdx+1,0).getDate();
  const firstDay=new Date(yr,mIdx,1).getDay();
  const byDay={};
  txs.filter(t=>t.tipe==="pengeluaran"&&t.tgl&&t.tgl.startsWith(`${yr}-${String(mIdx+1).padStart(2,"0")}`))
    .forEach(t=>{const d=Number(t.tgl.slice(8,10));byDay[d]=(byDay[d]||0)+N(t.jml);});
  const cells=[];
  for(let i=0;i<firstDay;i++)cells.push(null);
  for(let d=1;d<=daysInMonth;d++)cells.push(d);
  const todayNum=liveDay||new Date().getDate();
  const isCurrentMonth=liveMonth!==undefined?mIdx===liveMonth&&yr===liveYear:mIdx===nowM()&&yr===nowY();
  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
        {DAYS_SHORT.map(d=><div key={d} style={{textAlign:"center",fontSize:9,color:T.muted,fontWeight:700,padding:"3px 0"}}>{d}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
        {cells.map((d,i)=>{
          if(!d)return<div key={i}/>;
          const amt=byDay[d]||0;const isToday=isCurrentMonth&&d===todayNum;const hasSpend=amt>0;
          return(
            <div key={i} style={{textAlign:"center",padding:"5px 2px",borderRadius:7,background:isToday?T.accent:"transparent",border:`1px solid ${isToday?"transparent":T.borderLight}`}}>
              <div style={{fontSize:11,fontWeight:isToday?700:500,color:isToday?"white":T.text,marginBottom:1}}>{d}</div>
              {hasSpend&&<div style={{fontSize:9,color:isToday?"rgba(255,255,255,.8)":T.err,fontWeight:600}}>{IDRs(amt)}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── CIRCLE GAUGE ─────────────────────────────────────────────────────────────
const CircleGauge=({value,max=100,size=110,c="#22C55E",label})=>{
  const r=42,cx=55,cy=55,circ=2*Math.PI*r;
  const pct=Math.min(value/max,1);const dash=pct*circ;
  return(
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} viewBox="0 0 110 110">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(100,100,100,.15)" strokeWidth={10}/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={c} strokeWidth={10}
          strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ/4}
          strokeLinecap="round" style={{transition:"stroke-dasharray .6s"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <div style={{fontSize:22,fontWeight:900,color:c,lineHeight:1}}>{Math.round(value)}</div>
        {label&&<div style={{fontSize:9,color:"#94A3B8",fontWeight:600,marginTop:1}}>{label}</div>}
      </div>
    </div>
  );
};

// ─── NOTIFICATION PANEL ───────────────────────────────────────────────────────
const NotificationPanel=({notifs,onClose,onAction})=>{
  const T=useT();
  const colMap={danger:{bg:T.errBg,border:T.errBorder,c:T.err},warning:{bg:T.warnBg,border:T.warnBorder,c:T.warn},success:{bg:T.okBg,border:T.okBorder,c:T.ok},info:{bg:T.infoBg,border:T.infoBorder,c:T.info}};
  const groups=[
    {title:"Perlu tindakan",items:notifs.filter(n=>n.color==="danger"||n.color==="warning")},
    {title:"Info keuangan",items:notifs.filter(n=>n.color!=="danger"&&n.color!=="warning")},
  ].filter(g=>g.items.length);
  return(
    <div style={{cursor:"pointer",position:"fixed",touchAction:"none",overscrollBehavior:"none",inset:0,background:"rgba(0,0,0,.5)",zIndex:500,display:"flex",justifyContent:"flex-end"}} onClick={onClose}>
      <div style={{cursor:"pointer",width:"min(380px, 100vw)",background:T.card,height:"var(--app-height, 100dvh)",overflowY:"auto",boxShadow:T.shadowMd,animation:"slideInRight .25s cubic-bezier(.4,0,.2,1)",paddingBottom:"env(safe-area-inset-bottom, 0px)"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"20px 20px 14px",borderBottom:`1.5px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:T.card,zIndex:1}}>
          <div>
            <div style={{fontWeight:900,fontSize:17,color:T.text}}>Notifikasi</div>
            <div style={{fontSize:11,color:T.muted,marginTop:1}}>{notifs.length} peringatan aktif</div>
          </div>
          <button onClick={onClose} style={{background:T.cardAlt,border:`1px solid ${T.border}`,borderRadius:9,width:32,height:32,cursor:"pointer",fontSize:15,color:T.sub,fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center"}}>X</button>
        </div>
        <div style={{padding:16}}>
          {notifs.length===0?(
            <div style={{textAlign:"center",padding:"48px 20px",color:T.muted}}>
              <div style={{fontSize:48,marginBottom:12}}>✅</div>
              <div style={{fontSize:15,fontWeight:700,color:T.sub}}>Semua beres!</div>
              <div style={{fontSize:12,marginTop:6}}>Tidak ada tagihan atau peringatan aktif.</div>
            </div>
          ):groups.map((group,gIdx)=>(
            <div key={group.title} style={{marginBottom:gIdx===groups.length-1?0:14}}>
              <div style={{fontSize:10,color:T.muted,fontWeight:900,letterSpacing:1.2,textTransform:"uppercase",margin:"0 0 8px 2px"}}>{group.title}</div>
              {group.items.map((n,i)=>{
            const col=colMap[n.color]||colMap.info;
            return(
              <button key={`${group.title}-${i}`} onClick={()=>onAction?.(n)} style={{width:"100%",textAlign:"left",background:col.bg,border:`1px solid ${col.border}`,borderRadius:12,padding:"12px 14px",marginBottom:10,display:"flex",gap:12,alignItems:"flex-start",cursor:"pointer",fontFamily:"inherit",transition:"transform .16s, box-shadow .16s"}} className="notif-card">
                <span style={{fontSize:22,flexShrink:0,marginTop:1}}>{uiIcon(n.icon)}</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13,color:col.c,marginBottom:3}}>{n.title}</div>
                  <div style={{fontSize:12,color:T.sub}}>{n.msg}</div>
                  {n.amount&&<div style={{fontSize:12,fontWeight:700,color:T.text,marginTop:3}}>{IDR(n.amount)}</div>}
                </div>
                <span style={{fontSize:11,color:col.c,fontWeight:700,flexShrink:0,background:`${col.border}55`,padding:"2px 7px",borderRadius:5,marginTop:1}}>{n.tag}</span>
              </button>
            );
          })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── TREND CHART ──────────────────────────────────────────────────────────────
const TrendChart=({trendData,isMobile})=>{
  const T=useT();
  const CustomTooltip=({active,payload,label})=>{
    if(!active||!payload?.length)return null;
    return(
      <div style={{background:T.card,border:`1.5px solid ${T.border}`,borderRadius:10,padding:"10px 14px",fontSize:12,boxShadow:T.shadowMd}}>
        <div style={{fontWeight:700,color:T.text,marginBottom:6}}>{label}</div>
        {payload.map(p=>(
          <div key={p.dataKey} style={{color:p.color,marginBottom:3}}>{p.name}: {IDRs(p.value)}</div>
        ))}
      </div>
    );
  };
  return(
    <ResponsiveContainer width="100%" height={isMobile?160:200}>
      <AreaChart data={trendData} margin={{top:5,right:5,bottom:0,left:0}}>
        <defs>
          <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#22C55E" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="gSave" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={T.borderLight} vertical={false}/>
        <XAxis dataKey="label" tick={{fontSize:10,fill:T.muted}} axisLine={false} tickLine={false}/>
        <YAxis tickFormatter={v=>IDRs(v)} tick={{fontSize:9,fill:T.muted}} axisLine={false} tickLine={false} width={50}/>
        <Tooltip content={<CustomTooltip/>}/>
        <Area type="monotone" dataKey="masuk" name="Pemasukan" stroke="#22C55E" strokeWidth={2} fill="url(#gIn)" dot={false}/>
        <Area type="monotone" dataKey="keluar" name="Pengeluaran" stroke="#EF4444" strokeWidth={2} fill="url(#gOut)" dot={false}/>
        <Area type="monotone" dataKey="tabung" name="Tabungan" stroke="#6366F1" strokeWidth={2} fill="url(#gSave)" dot={false}/>
      </AreaChart>
    </ResponsiveContainer>
  );
};

// DAILY SPEND CHART
const DailyChart=({txBulan,bulan,tahun})=>{
  const T=useT();
  const now_=new Date();
  const isCurrentMonth=MONTHS[now_.getMonth()]===bulan && now_.getFullYear()===Number(tahun);
  const mIdx=MONTHS.indexOf(bulan);
  const yr=Number(tahun);
  const daysInMonth=new Date(yr,mIdx+1,0).getDate();
  const data=[];
  for(let d=1;d<=daysInMonth;d++){
    const key=`${yr}-${String(mIdx+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const val=txBulan.filter(t=>t.tipe==="pengeluaran"&&t.tgl===key).reduce((a,b)=>a+N(b.jml),0);
    data.push({d:String(d),val});
  }
  const todayNum=isCurrentMonth?now_.getDate():-1;
  return(
    <ResponsiveContainer width="100%" height={130}>
      <BarChart data={data} margin={{top:4,right:4,bottom:0,left:0}}>
        <Tooltip formatter={v=>IDR(v)} labelFormatter={l=>`Tgl ${l}`} contentStyle={{borderRadius:8,fontSize:11,background:T.card,border:`1px solid ${T.border}`,color:T.text}}/>
        <Bar dataKey="val" radius={[3,3,0,0]}>
          {data.map((entry,i)=>(
            <Cell key={i} fill={i+1===todayNum?"#8B5CF6":entry.val>0?"#6366F1":T.borderLight}/>
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

// ─── AMPLOP CARD ──────────────────────────────────────────────────────────────
const AmplopCard=({amp,dompetList,onDelete,onIsi,onPakai,onReset})=>{
  const T=useT();
  const [showPakai,setShowPakai]=useState(false);
  const isMobile = typeof window !== "undefined" ? window.innerWidth < 900 : false;
  const [pakaiJml,setPakaiJml]=useState("");
  const [pakaiKet,setPakaiKet]=useState("");
  const [showIsi,setShowIsi]=useState(false);
  const [isiJml,setIsiJml]=useState("");
  const [isiDompetId,setIsiDompetId]=useState(dompetList[0]?.id||1);
  const alokasi=N(amp.alokasi);const terpakai=N(amp.terpakai||0);
  const sisa=alokasi-terpakai;const pct=alokasi>0?Math.min(terpakai/alokasi*100,100):0;
  const isOver=terpakai>alokasi;
  return(
    <div style={{background:T.card,borderRadius:14,padding:18,border:`1.5px solid ${isOver?T.errBorder:pct>80?T.warnBorder:T.border}`,boxShadow:T.shadow,transition:"background .3s"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{display:"flex",gap:10,alignItems:"center",minWidth:0}}>
          <div style={{width:44,height:44,borderRadius:12,background:amp.warna||T.accentBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>{amp.icon||"✉️"}</div>
          <div><div style={{fontWeight:800,fontSize:14,color:T.text}}>{amp.nama}</div><div style={{fontSize:11,color:T.muted}}>Sisa: <strong style={{color:sisa>=0?T.ok:T.err}}>{IDR(Math.max(sisa,0))}</strong></div></div>
        </div>
        <Del onClick={onDelete}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:8,marginBottom:10}}>
        <div style={{background:T.infoBg,borderRadius:8,padding:"8px 10px",border:`1px solid ${T.infoBorder}`}}>
          <div style={{fontSize:9,color:T.muted,fontWeight:700,letterSpacing:.6,marginBottom:1}}>ALOKASI</div>
          <div style={{fontWeight:700,color:T.info,fontSize:13}}>{IDR(alokasi)}</div>
        </div>
        <div style={{background:isOver?T.errBg:T.okBg,borderRadius:8,padding:"8px 10px",border:`1px solid ${isOver?T.errBorder:T.okBorder}`}}>
          <div style={{fontSize:9,color:T.muted,fontWeight:700,letterSpacing:.6,marginBottom:1}}>TERPAKAI</div>
          <div style={{fontWeight:700,color:isOver?T.err:T.ok,fontSize:13}}>{IDR(terpakai)}</div>
        </div>
      </div>
      <PBar pct={pct} c={isOver?"#EF4444":pct>80?"#F59E0B":"#22C55E"} h={7}/>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:T.muted,marginTop:3,marginBottom:12}}>
        <span style={{fontWeight:700,color:isOver?T.err:pct>80?T.warn:T.ok}}>{pct.toFixed(0)}% terpakai</span>
        {isOver&&<span style={{color:T.err,fontWeight:700}}>⚠ Melebihi alokasi!</span>}
      </div>
      {!showPakai&&!showIsi&&<div style={{display:"flex",gap:6}}>
        <Btn onClick={()=>setShowPakai(true)} ch="💸 Pakai" c={T.err} outline style={{flex:1,padding:"8px 10px",fontSize:12}}/>
        <Btn onClick={()=>setShowIsi(true)} ch="➕ Isi" c={T.ok} outline style={{flex:1,padding:"8px 10px",fontSize:12}}/>
        <button onClick={onReset} title="Reset terpakai" style={{padding:"8px 10px",borderRadius:8,border:`1px solid ${T.border}`,background:T.cardAlt,cursor:"pointer",fontSize:14,fontFamily:"inherit",color:T.muted}}>🔄</button>
      </div>}
      {showPakai&&<div>
        <input placeholder="Keterangan belanja..." value={pakaiKet} onChange={e=>setPakaiKet(e.target.value)} style={{...{width:"100%",padding:"9px 12px",border:`1.5px solid ${T.inputBorder}`,borderRadius:9,fontSize:13,outline:"none",background:T.input,color:T.text,fontFamily:"inherit"},marginBottom:6}}/>
        <div style={{display:"flex",gap:6}}>
          <CurIn value={pakaiJml} onChange={setPakaiJml} placeholder="Jumlah..." style={{flex:1}}/>
          <Btn onClick={()=>{if(pakaiJml){onPakai(pakaiJml,pakaiKet);setPakaiJml("");setPakaiKet("");setShowPakai(false);}}} ch="✓" c={T.err} style={{padding:"8px 14px"}}/>
          <Btn onClick={()=>setShowPakai(false)} ch="✕" c={T.muted} outline style={{padding:"8px 14px"}}/>
        </div>
      </div>}
      {showIsi&&<div style={{padding:10,background:T.okBg,borderRadius:8,border:`1px solid ${T.okBorder}`}}>
        <div style={{fontSize:11,color:T.ok,fontWeight:700,marginBottom:6}}>Top-up dari Dompet</div>
        <select value={isiDompetId} onChange={e=>setIsiDompetId(Number(e.target.value))} style={{width:"100%",padding:"7px 10px",borderRadius:8,border:`1.5px solid ${T.inputBorder}`,background:T.input,color:T.text,fontSize:12,outline:"none",marginBottom:6,fontFamily:"inherit"}}>
          {dompetList.map(d=><option key={d.id} value={d.id}>{uiIcon(d.icon)} {d.nama} ({IDRs(N(d.saldo))})</option>)}
        </select>
        <div style={{display:"flex",gap:6}}>
          <CurIn value={isiJml} onChange={setIsiJml} placeholder="Jumlah..." style={{flex:1}}/>
          <Btn onClick={()=>{if(isiJml){onIsi(isiJml,isiDompetId);setIsiJml("");setShowIsi(false);}}} ch="+ Isi" c={T.ok} style={{padding:"8px 12px"}}/>
          <Btn onClick={()=>setShowIsi(false)} ch="✕" c={T.muted} outline style={{padding:"8px 10px"}}/>
        </div>
      </div>}
    </div>
  );
};

// ─── UTANG CARD ───────────────────────────────────────────────────────────────
const UtangCard=({u,dompetList,onDelete,onCicilan})=>{
  const T=useT();
  const [inp,setInp]=useState("");const [showCalc,setShowCalc]=useState(false);
  const [dompetId, setDompetId]=useState(dompetList[0]?.id || 1);
  const totalC=(u.cicilan||[]).reduce((a,b)=>a+N(b.jml),0);
  const pct=N(u.jml)>0?Math.min(totalC/N(u.jml)*100,100):0;
  return(
    <div style={{background:T.cardAlt,borderRadius:12,padding:16,marginBottom:10,border:`1px solid ${u.lunas?T.okBorder:u.tipe==="utang"?T.errBorder:T.infoBorder}`,transition:"background .3s,border-color .3s"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div>
          <div style={{fontWeight:700,fontSize:14,color:T.text}}>{u.nama}</div>
          <div style={{fontSize:11,color:T.muted}}>{u.tgl}{(u.provider||detectDebtProvider(u.nama))&&` · ${(u.provider||detectDebtProvider(u.nama))}`}{u.tempo&&` · Tempo: ${u.tempo}`}</div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <Pill c={u.lunas?"green":u.tipe==="utang"?"red":u.tipe==="piutangBisnis"?"purple":"blue"} ch={u.lunas?"✓ Lunas":u.tipe==="utang"?"Utang":u.tipe==="piutangBisnis"?"Piutang Bisnis":"Piutang"}/>
          <Del onClick={onDelete}/>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}>
        {[{l:"Total",v:IDR(N(u.jml)),c:u.tipe==="utang"?T.err:T.info},{l:"Terbayar",v:IDR(totalC),c:T.ok},{l:"Sisa",v:IDR(Math.max(N(u.jml)-totalC,0)),c:T.warn}].map(x=>(
          <div key={x.l} style={{background:T.card,borderRadius:8,padding:"8px 10px",border:`1px solid ${T.border}`}}>
            <div style={{fontSize:9,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:.6,marginBottom:2}}>{x.l}</div>
            <div style={{fontWeight:700,color:x.c,fontSize:12}}>{x.v}</div>
          </div>
        ))}
      </div>
      <PBar pct={pct} c={u.lunas?"#22C55E":u.tipe==="utang"?"#EF4444":"#3B82F6"} h={5}/>
      <div style={{fontSize:10,color:T.muted,marginBottom:8,marginTop:3}}>{pct.toFixed(0)}% terbayar</div>
      {!u.lunas&&<div style={{display:"flex",gap:8,alignItems:"center"}}>
        <div style={{position:"relative",flex:1}}>
          <CurIn value={inp} onChange={v=>setInp(v)} placeholder="Nominal..." style={{paddingRight:36}}/>
          <button onClick={()=>setShowCalc(true)} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:14}}>🔢</button>
        </div>
        <select value={dompetId} onChange={e=>setDompetId(Number(e.target.value))} style={{width:80, padding:"8px", borderRadius:8, border:`1.5px solid ${T.inputBorder}`, background:T.input, color:T.text, fontSize:12, outline:"none"}}>
           {dompetList.map(d=><option key={d.id} value={d.id}>{uiIcon(d.icon)}</option>)}
        </select>
        {showCalc&&<Calculator value={inp} onChange={v=>{setInp(v);setShowCalc(false);}} onClose={()=>setShowCalc(false)}/>}
        <Btn onClick={()=>{if(inp){onCicilan(u.id,inp,dompetId);setInp("");}}} ch="+ Bayar" c="#16A34A" style={{padding:"8px 12px",fontSize:12,whiteSpace:"nowrap"}}/>
      </div>}
      {(u.cicilan||[]).length>0&&<div style={{marginTop:8,borderTop:`1px solid ${T.border}`,paddingTop:6}}>
        {u.cicilan.slice(-3).map((c,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.sub,padding:"2px 0"}}><span>{c.tgl}</span><span style={{color:T.ok,fontWeight:600}}>+{IDR(N(c.jml))}</span></div>)}
      </div>}
    </div>
  );
};

// ─── GOAL CARD ────────────────────────────────────────────────────────────────
const GoalCard=({g,dompetList,onDelete,onTambah,onSelesai})=>{
  const T=useT();
  const [inp,setInp]=useState("");const [showCalc,setShowCalc]=useState(false);
  const [dompetId, setDompetId]=useState(dompetList[0]?.id || 1);
  const tg=N(g.target),km=N(g.kumpul),pct=tg>0?Math.min(km/tg*100,100):0;
  return(
    <div style={{background:T.card,borderRadius:14,padding:18,border:`1.5px solid ${pct>=100?T.okBorder:T.border}`,boxShadow:T.shadow,transition:"background .3s,border-color .3s"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
        <div style={{display:"flex",gap:10,alignItems:"center",minWidth:0}}>
          <span style={{fontSize:28}}>{g.icon||"⭐"}</span>
          <div><div style={{fontWeight:800,fontSize:14,color:T.text}}>{g.nama}</div><div style={{fontSize:11,color:T.muted}}>{g.deadline&&`🗓 ${g.deadline}`}</div></div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {pct>=100&&<Pill c="green" ch={"🎉 "+(lang==="en"?"Achieved!":"Tercapai!")}/>}
          <Del onClick={onDelete}/>
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
        <span style={{fontWeight:800,color:T.accent,fontSize:15}}>{IDR(km)}</span>
        <span style={{fontSize:12,color:T.muted}}>dari {IDR(tg)}</span>
      </div>
      <PBar pct={pct} c={pct>=100?"#22C55E":T.accent} h={7}/>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.muted,marginTop:4,marginBottom:12}}>
        <span style={{fontWeight:700,color:pct>=100?T.ok:T.accent}}>{pct.toFixed(1)}%</span>
        <span>Sisa {IDR(Math.max(tg-km,0))}</span>
      </div>
      {pct>=100
        ?<Btn onClick={()=>onSelesai(g.id)} ch={"✓ "+(lang==="en"?"Mark Done":"Selesai")} c="#16A34A" style={{width:"100%",padding:10}}/>
        :<div style={{display:"flex",gap:8,alignItems:"center"}}>
          <div style={{position:"relative",flex:1}}>
            <CurIn value={inp} onChange={v=>setInp(v)} placeholder="Tambah dana..." style={{paddingRight:36}}/>
            <button onClick={()=>setShowCalc(true)} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:14}}>🔢</button>
          </div>
          <select value={dompetId} onChange={e=>setDompetId(Number(e.target.value))} style={{width:60, padding:"8px", borderRadius:8, border:`1.5px solid ${T.inputBorder}`, background:T.input, color:T.text, fontSize:12, outline:"none"}}>
             {dompetList.map(d=><option key={d.id} value={d.id}>{uiIcon(d.icon)}</option>)}
          </select>
          {showCalc&&<Calculator value={inp} onChange={v=>{setInp(v);setShowCalc(false);}} onClose={()=>setShowCalc(false)}/>}
          <Btn onClick={()=>{if(inp){onTambah(g.id,inp,dompetId);setInp("");}}} ch="+ Dana" style={{padding:"8px 12px",fontSize:12}}/>
        </div>
      }
    </div>
  );
};

// ─── MORE MENU (mobile) ───────────────────────────────────────────────────────
const MoreMenu=({page,setPage,onClose,navItems=NAV})=>{
  const T=useT();
  return(
    <div style={{cursor:"pointer",position:"fixed",touchAction:"none",overscrollBehavior:"none",inset:0,background:"rgba(0,0,0,.55)",zIndex:650}} onClick={onClose}>
      <div style={{cursor:"pointer",position:"fixed",bottom:0,left:0,right:0,background:T.card,border:`1px solid ${T.border}`,borderBottom:"none",borderRadius:"22px 22px 0 0",padding:"20px max(16px, env(safe-area-inset-right)) calc(env(safe-area-inset-bottom, 0px) + 24px) max(16px, env(safe-area-inset-left))",boxShadow:T.shadowMd,maxHeight:"min(74svh, calc(var(--app-height, 100dvh) - 16px))",overflowY:"auto",WebkitOverflowScrolling:"touch"}} onClick={e=>e.stopPropagation()}>
        <div style={{width:40,height:4,background:T.border,borderRadius:4,margin:"0 auto 16px"}}/>
        <div style={{fontSize:10,color:T.muted,fontWeight:700,letterSpacing:2,textTransform:"uppercase",marginBottom:12}}>Menu Lainnya</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
          {navItems.slice(4).map(n=>{
            const a=page===n.id;
            const go=()=>{setPage(n.id);onClose();};
            return(
              <button key={n.id} onPointerUp={e=>{e.preventDefault();go();}} onClick={go} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,padding:"12px 8px",borderRadius:12,border:`1.5px solid ${a?T.navBorder:T.border}`,background:a?T.navActive:T.cardAlt,cursor:"pointer",fontFamily:"inherit",touchAction:"manipulation",WebkitTapHighlightColor:"transparent"}}>
                <span style={{fontSize:22}}>{uiIcon(n.icon)}</span>
                <span style={{fontSize:10,fontWeight:700,color:a?T.accent:T.sub}}>{n.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── KEYWORD AUTO-KATEGORISASI ───────────────────────────────────────────────
const KW_KAT = [
  { kat:"Makan & Minum",  id:1, kw:["makan","resto","kafe","cafe","kopi","coffee","starbucks","kfc","mcd","mcdonalds","pizza","burger","bakso","mie","nasi","warung","seafood","sushi","boba","chatime","grab food","gofood","shopeefood","snack","minuman"] },
  { kat:"Transportasi",   id:2, kw:["grab","gojek","maxim","ojol","ojek","bensin","pertamina","spbu","parkir","tol","busway","mrt","lrt","kereta","krl","tiket","damri","taxi","pertamax","pertalite","solar"] },
  { kat:"Tagihan & Utilitas", id:3, kw:["pln","listrik","air","pdam","internet","telkom","indihome","wifi","xl","telkomsel","axis","smartfren","im3","tri","pulsa","paket data","token","bpjs","asuransi"] },
  { kat:"Kesehatan",      id:4, kw:["apotek","kimia farma","guardian","apotik","dokter","klinik","rumah sakit","vitamin","obat","halodoc","alodokter","gym","fitnes","fitness"] },
  { kat:"Belanja",        id:5, kw:["shopee","tokopedia","lazada","blibli","bukalapak","tiktok shop","zalora","indomaret","alfamart","alfamidi","superindo","giant","hypermart","transmart","carrefour","ikea","ecommerce"] },
  { kat:"Hiburan",        id:6, kw:["netflix","spotify","youtube","disney","vidio","genflix","viu","wetv","bioskop","cgv","cineplex","game","steam","playstation","xbox","nintendo","deezer","joox"] },
  { kat:"Pendidikan",     id:7, kw:["buku","gramedia","toga mas","ruangguru","zenius","coursera","udemy","kampus","spp","ukt","sekolah","kursus","les"] },
  { kat:"Investasi",      id:8, kw:["bibit","bareksa","ipot","indopremier","ajaib","pluang","stockbit","reksadana","reksa dana","saham","obligasi","emas","logam mulia","kripto","crypto"] },
];
const autoKat = (desc) => {
  const d = (desc||"").toLowerCase();
  for (const k of KW_KAT) { if (k.kw.some(w => d.includes(w))) return k.id; }
  return 9;
};
const splitCSVLine = (line) => {
  const result = []; let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i]==='"') { inQ = !inQ; }
    else if (line[i]==="," && !inQ) { result.push(cur.trim()); cur = ""; }
    else { cur += line[i]; }
  }
  result.push(cur.trim());
  return result;
};
const toIso = (tgl) => {
  const p = tgl.split(/[\/\-\.]/);
  if (p.length < 3) return tgl;
  const y = p[2].length===4?p[2]:"20"+p[2];
  return `${y}-${p[1].padStart(2,"0")}-${p[0].padStart(2,"0")}`;
};
const detectBank = (text) => {
  const t = (text||"").toLowerCase().slice(0,1200);
  if (t.includes("bank central asia")||t.includes("klik bca")||t.includes("mybca")||t.includes(",bca,")) return "BCA";
  if (t.includes("bank mandiri")||t.includes("livin")||t.includes("mandiri")) return "Mandiri";
  if (t.includes("bank negara indonesia")||t.includes(" bni")||t.includes("bni mobile")) return "BNI";
  if (t.includes("bank rakyat indonesia")||t.includes("brimo")||t.includes(",bri,")) return "BRI";
  if (t.includes("cimb")||t.includes("niaga")) return "CIMB";
  if (t.includes("jenius")||t.includes("btpn")||t.includes("dream")) return "Jenius";
  if (t.includes("ovo")||t.includes("visionet")) return "OVO";
  if (t.includes("gopay")||t.includes("gojek")) return "GoPay";
  if (t.includes("dana")||t.includes("dana.id")) return "Dana";
  if (t.includes("shopee")||t.includes("shopeepay")||t.includes("sea limited")) return "ShopeePay";
  if (t.includes("bank syariah indonesia")||t.includes("bsi")||t.includes("bsim")) return "BSI";
  if (t.includes("permata")||t.includes("permatabank")) return "Permata";
  if (t.includes("btn ")||t.includes("bank tabungan negara")) return "BTN";
  return "Generic";
};
const cleanNum = (s) => Math.abs(parseFloat((s||"").replace(/[^\d,.\-]/g,"").replace(/\./g,"").replace(",","."))||0);
// Parse date flexibly: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, DD MMM YYYY, etc.
const toIsoFlex = (raw) => {
  if (!raw) return "";
  const s = raw.trim().replace(/\s+/g," ");
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const p = s.split(/[\/\-\.]/);
  if (p.length >= 3) {
    const y = p[2].length===4?p[2]:"20"+p[2];
    if (y.length===4) return `${y}-${p[1].padStart(2,"0")}-${p[0].padStart(2,"0")}`;
  }
  // DD MMM YYYY (e.g. 01 Jan 2024)
  const MMAP={jan:"01",feb:"02",mar:"03",apr:"04",mei:"05",may:"05",jun:"06",jul:"07",ags:"08",aug:"08",sep:"09",okt:"10",oct:"10",nov:"11",des:"12",dec:"12"};
  const mp = s.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
  if (mp) { const mon = MMAP[mp[2].toLowerCase().slice(0,3)]; if(mon) return `${mp[3]}-${mon}-${mp[1].padStart(2,"0")}`; }
  return toIso(raw);
};
// Detect debit/credit from mutation type string
const isCR = (s) => { const l=(s||"").toLowerCase(); return l.includes("cr")||l.includes("credit")||l.includes("kredit")||l.includes("masuk")||l.includes("+"); };
const isDB = (s) => { const l=(s||"").toLowerCase(); return l.includes("db")||l.includes("debet")||l.includes("debit")||l.includes("keluar"); };
const parseBankCSV = (text, bank) => {
  const lines = text.split(/\r?\n/).filter(l=>l.trim());
  const results = [];
  // ── Find header row ──────────────────────────────────────────────────────
  let ds = 0, headerCols = [];
  const HDR_KEYS = ["tanggal","date","tgl","waktu","time","deskripsi","description","keterangan","uraian","transaksi","transaction"];
  for (let i=0;i<Math.min(lines.length,20);i++) {
    const lc = lines[i].toLowerCase();
    if (HDR_KEYS.some(k=>lc.includes(k))) {
      headerCols = splitCSVLine(lines[i]).map(h=>h.trim().toLowerCase());
      ds = i+1; break;
    }
  }
  const hi = (key) => headerCols.findIndex(h=>h.includes(key));
  // column indices by bank
  const getRow = (cols, bank) => {
    let tgl="", ket="", jml=0, tipe="pengeluaran";
    if (bank==="BCA") {
      // BCA: Tanggal, Keterangan, Cabang, Jumlah, Saldo
      tgl=cols[0]||"";
      ket=(cols[1]||cols[2]||"").trim();
      const raw=(cols[3]||cols[2]||"").trim();
      jml=cleanNum(raw);
      tipe=(raw.replace(/[\d.,\s]/g,"")||"DB").toLowerCase().includes("cr")||cols[4]?"pemasukan":"pengeluaran";
      // BCA myBCA CSV: Debit=pengeluaran, Kredit=pemasukan
      const rawDB=cleanNum(cols[3]||""); const rawCR=cleanNum(cols[4]||"");
      if (cols.length>=5) { if(rawCR>0){jml=rawCR;tipe="pemasukan";}else if(rawDB>0){jml=rawDB;tipe="pengeluaran";} }
      else { tipe=raw.includes("-")?"pengeluaran":"pemasukan"; }
    } else if (bank==="Mandiri") {
      // Mandiri Livin: Tanggal, Deskripsi, Jumlah, Tipe, Saldo
      tgl=cols[0]||"";
      ket=(cols[1]||"").trim();
      jml=cleanNum(cols[2]||"");
      tipe=isCR(cols[3]||"") ? "pemasukan" : "pengeluaran";
    } else if (bank==="BNI") {
      // BNI: Tanggal Transaksi, Keterangan, Debet, Kredit, Saldo
      tgl=cols[0]||"";
      ket=(cols[1]||"").trim();
      const dbt=cleanNum(cols[2]||""); const krd=cleanNum(cols[3]||"");
      if (krd>0){jml=krd;tipe="pemasukan";}else{jml=dbt;tipe="pengeluaran";}
    } else if (bank==="BRI") {
      // BRImo: Tanggal, Keterangan, Debet, Kredit, Saldo
      tgl=cols[0]||"";
      ket=(cols[1]||"").trim();
      const dbt=cleanNum(cols[2]||""); const krd=cleanNum(cols[3]||"");
      if (krd>0){jml=krd;tipe="pemasukan";}else{jml=dbt;tipe="pengeluaran";}
    } else if (bank==="CIMB") {
      tgl=cols[0]||"";
      ket=(cols[1]||"").trim();
      const dbt=cleanNum(cols[2]||""); const krd=cleanNum(cols[3]||"");
      if (krd>0){jml=krd;tipe="pemasukan";}else{jml=dbt;tipe="pengeluaran";}
    } else if (bank==="Jenius") {
      // Jenius CSV: Date, Description, Amount, Type, Balance
      // Amount negative = debit/pengeluaran, positive = kredit/pemasukan
      tgl=cols[0]||"";
      ket=(cols[1]||"").trim();
      const amtRaw=(cols[2]||"").trim();
      jml=Math.abs(cleanNum(amtRaw));
      tipe=amtRaw.trim().startsWith("-")||isDB(cols[3]||"")?"pengeluaran":"pemasukan";
    } else if (bank==="OVO") {
      // OVO: Tanggal & Waktu, Jenis Transaksi, Nama, Nominal, Status
      tgl=cols[0]||""; tgl=tgl.split(" ")[0];
      ket=(cols[2]||cols[1]||"").trim();
      jml=cleanNum(cols[3]||"");
      tipe=isDB(cols[1]||"")||(cols[1]||"").toLowerCase().includes("pembayaran")?"pengeluaran":"pemasukan";
    } else if (bank==="GoPay") {
      // GoPay: Tanggal, Keterangan, Kredit, Debet, Saldo
      tgl=cols[0]||"";
      ket=(cols[1]||"").trim();
      const krd=cleanNum(cols[2]||""); const dbt=cleanNum(cols[3]||"");
      if (krd>0){jml=krd;tipe="pemasukan";}else{jml=dbt;tipe="pengeluaran";}
    } else if (bank==="Dana") {
      // Dana: Tanggal, Deskripsi, Tipe, Jumlah
      tgl=cols[0]||"";
      ket=(cols[1]||"").trim();
      jml=cleanNum(cols[3]||cols[2]||"");
      tipe=isCR(cols[2]||"")||(cols[3]||"").trim().startsWith("+")?"pemasukan":"pengeluaran";
    } else if (bank==="ShopeePay") {
      // ShopeePay: Waktu, Deskripsi, Tipe, Jumlah, Status
      tgl=cols[0]||""; tgl=tgl.split(" ")[0];
      ket=(cols[1]||"").trim();
      jml=cleanNum(cols[3]||cols[2]||"");
      tipe=isCR(cols[2]||"")?"pemasukan":"pengeluaran";
    } else if (bank==="BSI") {
      tgl=cols[0]||"";
      ket=(cols[1]||"").trim();
      const dbt=cleanNum(cols[2]||""); const krd=cleanNum(cols[3]||"");
      if (krd>0){jml=krd;tipe="pemasukan";}else{jml=dbt;tipe="pengeluaran";}
    } else if (bank==="Permata"||bank==="BTN") {
      tgl=cols[0]||"";
      ket=(cols[1]||"").trim();
      const dbt=cleanNum(cols[2]||""); const krd=cleanNum(cols[3]||"");
      if (krd>0){jml=krd;tipe="pemasukan";}else{jml=dbt;tipe="pengeluaran";}
    } else {
      // Generic: smart detection
      tgl=cols[0]||"";
      ket="";
      // Try to find description column (longest string)
      for (let ci=1;ci<Math.min(cols.length,5);ci++) { if((cols[ci]||"").length>ket.length) ket=cols[ci]; }
      ket=ket.trim();
      // Find amount: last numeric column
      const nums=cols.slice(1).map(v=>({v,n:cleanNum(v),raw:v.trim()})).filter(x=>x.n>0);
      if (nums.length===0) return null;
      if (nums.length===1) {
        jml=nums[0].n;
        tipe=nums[0].raw.startsWith("-")?"pengeluaran":"pemasukan";
      } else {
        // debit/credit pattern
        const dbt=cleanNum(cols[cols.length-3]||""); const krd=cleanNum(cols[cols.length-2]||"");
        if (krd>0&&dbt===0){jml=krd;tipe="pemasukan";}else if(dbt>0&&krd===0){jml=dbt;tipe="pengeluaran";}
        else{jml=nums[0].n;tipe=nums[0].raw.startsWith("-")?"pengeluaran":"pemasukan";}
      }
    }
    return { tgl: toIsoFlex(tgl)||toIso(tgl), ket, jml, tipe };
  };
  for (let i=ds;i<lines.length;i++) {
    const cols = splitCSVLine(lines[i]);
    if (cols.length<2) continue;
    const row = getRow(cols, bank);
    if (!row||!row.tgl||row.tgl.length<6||!row.jml||row.jml<=0) continue;
    results.push({
      tgl: row.tgl, ket: row.ket||"Transaksi", jml: String(row.jml),
      tipe: row.tipe, katId: row.tipe==="pengeluaran"?autoKat(row.ket):9, bank
    });
  }
  return results;
};



// ─── KALKULATOR CICILAN ───────────────────────────────────────────────────────
function KalkulatorCicilan({ onClose, T }) {
  const isMobile = typeof window !== "undefined" ? window.innerWidth < 900 : false;
  const [harga, setHarga] = useState("");
  const [dp, setDp] = useState("");
  const [tenor, setTenor] = useState("12");
  const [bunga, setBunga] = useState("1");
  const [tipe, setTipe] = useState("flat"); // flat | efektif
  const fmtN = v => { const n=String(v).replace(/\D/g,""); return n?n.replace(/\B(?=(\d{3})+(?!\d))/g,"."):""};
  const N2 = v => parseFloat(String(v).replace(/\./g,""))||0;
  const idr = n => "Rp " + Math.round(n).toLocaleString("id-ID");

  const hargaN = N2(harga), dpN = N2(dp), tenorN = parseInt(tenor)||12, bungaN = parseFloat(bunga)||0;
  const pokok = Math.max(0, hargaN - dpN);
  const bungaBln = bungaN / 100;

  let cicilan = 0, totalBayar = 0, totalBunga = 0;
  if (pokok > 0 && tenorN > 0) {
    if (tipe === "flat") {
      const bungaPerBln = pokok * bungaBln;
      cicilan = (pokok / tenorN) + bungaPerBln;
      totalBayar = cicilan * tenorN + dpN;
      totalBunga = bungaPerBln * tenorN;
    } else {
      if (bungaBln === 0) {
        cicilan = pokok / tenorN;
      } else {
        cicilan = pokok * (bungaBln * Math.pow(1+bungaBln, tenorN)) / (Math.pow(1+bungaBln, tenorN) - 1);
      }
      totalBayar = cicilan * tenorN + dpN;
      totalBunga = totalBayar - hargaN;
    }
  }

  // Amortization table (first 6 + last 1)
  const rows = [];
  if (tipe === "efektif" && pokok > 0 && tenorN > 0) {
    let sisa = pokok;
    for (let i = 1; i <= tenorN; i++) {
      const bungaBulan = sisa * bungaBln;
      const pokokBulan = cicilan - bungaBulan;
      sisa = Math.max(0, sisa - pokokBulan);
      rows.push({ i, cicilan, bungaBulan, pokokBulan, sisa });
    }
  }

  const IS2 = {width:"100%",padding:"9px 12px",borderRadius:9,border:`1.5px solid ${T.inputBorder}`,background:T.input,color:T.text,fontSize:13,fontWeight:600,outline:"none"};

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div>
          <div style={{fontSize:17,fontWeight:800,color:T.text}}>🧮 Kalkulator Cicilan</div>
          <div style={{fontSize:11,color:T.muted,marginTop:2}}>Hitung cicilan kredit / KPR / kendaraan</div>
        </div>
        <button onClick={onClose} style={{background:T.cardAlt,border:"none",borderRadius:7,padding:"5px 9px",cursor:"pointer",color:T.muted,fontSize:16}}>X</button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:8,marginBottom:10}}>
        <div>
          <div style={{fontSize:10,fontWeight:700,color:T.accent,textTransform:"uppercase",letterSpacing:.8,marginBottom:5}}>Harga / Nilai</div>
          <input value={harga} onChange={e=>setHarga(fmtN(e.target.value))} placeholder="Contoh: 150.000.000" style={IS2}/>
        </div>
        <div>
          <div style={{fontSize:10,fontWeight:700,color:T.accent,textTransform:"uppercase",letterSpacing:.8,marginBottom:5}}>Uang Muka (DP)</div>
          <input value={dp} onChange={e=>setDp(fmtN(e.target.value))} placeholder="0 jika tidak ada" style={IS2}/>
        </div>
        <div>
          <div style={{fontSize:10,fontWeight:700,color:T.accent,textTransform:"uppercase",letterSpacing:.8,marginBottom:5}}>Tenor (Bulan)</div>
          <select value={tenor} onChange={e=>setTenor(e.target.value)} style={IS2}>
            {[6,12,18,24,36,48,60,72,84,96,120,180,240].map(t=><option key={t} value={t}>{t} bulan ({(t/12).toFixed(1)} thn)</option>)}
          </select>
        </div>
        <div>
          <div style={{fontSize:10,fontWeight:700,color:T.accent,textTransform:"uppercase",letterSpacing:.8,marginBottom:5}}>Bunga / Bulan (%)</div>
          <input value={bunga} onChange={e=>setBunga(e.target.value.replace(/[^0-9.]/g,""))} placeholder="1" style={IS2}/>
        </div>
      </div>

      <div style={{display:"flex",gap:6,marginBottom:14}}>
        {["flat","efektif"].map(t=>(
          <button key={t} onClick={()=>setTipe(t)} style={{flex:1,padding:"7px",borderRadius:9,border:`2px solid ${tipe===t?T.accent:T.border}`,background:tipe===t?T.accentBg:T.card,color:tipe===t?T.accent:T.sub,fontWeight:700,fontSize:12,cursor:"pointer",transition:"all .15s"}}>
            {t==="flat"?"📊 Flat Rate":"📈 Efektif / Anuitas"}
          </button>
        ))}
      </div>

      {pokok > 0 && cicilan > 0 && <>
        <div style={{background:T.accentBg,border:`1.5px solid ${T.accent}`,borderRadius:14,padding:"16px 18px",marginBottom:12}}>
          <div style={{textAlign:"center",marginBottom:12}}>
            <div style={{fontSize:10,color:T.accent,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Cicilan per Bulan</div>
            <div style={{fontSize:28,fontWeight:900,color:T.accent}}>{idr(cicilan)}</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            {[
              {l:"Pokok",v:idr(pokok),c:T.text},
              {l:"Total Bunga",v:idr(totalBunga),c:T.err},
              {l:"Total Bayar",v:idr(totalBayar),c:T.ok},
            ].map(x=>(
              <div key={x.l} style={{background:T.card,borderRadius:9,padding:"8px 10px",textAlign:"center"}}>
                <div style={{fontSize:9,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:.7,marginBottom:3}}>{x.l}</div>
                <div style={{fontSize:11,fontWeight:800,color:x.c}}>{x.v}</div>
              </div>
            ))}
          </div>
          {hargaN > 0 && <div style={{marginTop:10,fontSize:11,color:T.sub,textAlign:"center"}}>
            Efektif bunga total: <strong style={{color:T.err}}>{((totalBunga/hargaN)*100).toFixed(1)}%</strong> dari harga · DP: <strong>{((dpN/hargaN)*100).toFixed(0)}%</strong>
          </div>}
        </div>

        {/* DP slider hint */}
        <div style={{background:T.infoBg,border:`1px solid ${T.infoBorder}`,borderRadius:10,padding:"9px 13px",marginBottom:4}}>
          <div style={{fontSize:11,color:T.info,fontWeight:700,marginBottom:4}}>💡 Tips</div>
          <div style={{fontSize:11,color:T.sub,lineHeight:1.65}}>
            • DP 30%+ = cicilan lebih ringan &amp; bunga total lebih kecil<br/>
            • Bunga flat lebih mudah dihitung tapi total bunga lebih besar<br/>
            • Bandingkan beberapa tenor untuk temukan yang paling efisien
          </div>
        </div>
      </>}
      {!pokok && <div style={{textAlign:"center",padding:"28px 0",color:T.muted,fontSize:13}}>Isi harga barang untuk mulai menghitung 🧮</div>}
    </div>
  );
}

// ─── KOMPARASI BULANAN ─────────────────────────────────────────────────────────
function KomparasiBulanan({ txs, budgets, T, isMobile }) {
  const allMonths = [];
  const seen = new Set();
  txs.forEach(t => {
    const k = `${t.bulan}_${t.tahun}`;
    if (!seen.has(k) && t.bulan && t.tahun) { seen.add(k); allMonths.push({bulan:t.bulan,tahun:t.tahun,label:`${t.bulan} ${t.tahun}`}); }
  });
  const nowM2 = MONTHS[new Date().getMonth()], nowY2 = String(new Date().getFullYear());
  const nowKey = `${nowM2}_${nowY2}`;
  if (!seen.has(nowKey)) allMonths.push({bulan:nowM2,tahun:nowY2,label:`${nowM2} ${nowY2}`});
  allMonths.sort((a,b)=>{ const ya=parseInt(a.tahun),yb=parseInt(b.tahun),ma=MONTHS.indexOf(a.bulan),mb=MONTHS.indexOf(b.bulan); return yb-ya||mb-ma; });

  const [bulan1, setBulan1] = useState(allMonths[0]?.label||"");
  const [bulan2, setBulan2] = useState(allMonths[1]?.label||"");
  const [open, setOpen] = useState(false);

  const getStats = (label) => {
    const m = allMonths.find(x=>x.label===label);
    if (!m) return null;
    const t = txs.filter(x=>x.bulan===m.bulan&&x.tahun===m.tahun);
    const masuk = t.filter(x=>x.tipe==="pemasukan").reduce((a,x)=>a+N(x.jml),0);
    const keluar = t.filter(x=>x.tipe==="pengeluaran").reduce((a,x)=>a+N(x.jml),0);
    const tabung = t.filter(x=>x.tipe==="tabungan").reduce((a,x)=>a+N(x.jml),0);
    const net = masuk - keluar - tabung;
    const spendKat = {};
    t.filter(x=>x.tipe==="pengeluaran").forEach(x=>{spendKat[x.katId]=(spendKat[x.katId]||0)+N(x.jml);});
    return {masuk,keluar,tabung,net,spendKat,txCount:t.length};
  };

  const s1 = getStats(bulan1), s2 = getStats(bulan2);
  const idr = n => "Rp " + Math.abs(Number(n||0)).toLocaleString("id-ID");
  const diff = (a,b) => { if(!a||!b||b===0)return null; const p=((a-b)/b)*100; return {pct:p.toFixed(1),up:p>0}; };

  const DiffBadge = ({a,b,invert=false}) => {
    const d = diff(a,b);
    if (!d) return null;
    const good = invert ? !d.up : d.up;
    return <span style={{fontSize:10,fontWeight:700,color:good?T.ok:T.err,marginLeft:4}}>{d.up?"↑":"↓"}{Math.abs(d.pct)}%</span>;
  };

  return (
    <div style={{marginBottom:18}}>
      <button onClick={()=>setOpen(v=>!v)} style={{width:"100%",background:T.card,border:`1.5px solid ${T.border}`,borderRadius:14,padding:"13px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",boxShadow:T.shadow,marginBottom:open?8:0,transition:"all .2s"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>📊</span>
          <div style={{textAlign:"left"}}>
            <div style={{fontSize:13,fontWeight:800,color:T.text}}>Komparasi Laporan Bulanan</div>
            <div style={{fontSize:11,color:T.muted}}>Bandingkan 2 periode keuangan</div>
          </div>
        </div>
        <span style={{fontSize:16,color:T.muted,transition:"transform .2s",transform:open?"rotate(180deg)":"none"}}>▾</span>
      </button>

      {open && <div style={{background:T.card,borderRadius:14,padding:"16px 18px",border:`1.5px solid ${T.border}`,boxShadow:T.shadow}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
          {[{label:"Periode 1",val:bulan1,set:setBulan1,c:T.accent},{label:"Periode 2",val:bulan2,set:setBulan2,c:"#059669"}].map(({label,val,set,c})=>(
            <div key={label}>
              <div style={{fontSize:10,fontWeight:700,color:c,textTransform:"uppercase",letterSpacing:.8,marginBottom:5}}>{label}</div>
              <select value={val} onChange={e=>set(e.target.value)} style={{width:"100%",padding:"8px 10px",borderRadius:9,border:`2px solid ${c}`,background:T.input,color:T.text,fontSize:12,fontWeight:700,outline:"none"}}>
                {allMonths.map(m=><option key={m.label} value={m.label}>{m.label}</option>)}
              </select>
            </div>
          ))}
        </div>

        {s1 && s2 && <>
          {/* Main stats comparison */}
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr 1fr",gap:8,marginBottom:14}}>
            {[
              {l:"Pemasukan",v1:s1.masuk,v2:s2.masuk,invert:false},
              {l:"Pengeluaran",v1:s1.keluar,v2:s2.keluar,invert:true},
              {l:"Tabungan",v1:s1.tabung,v2:s2.tabung,invert:false},
              {l:"Net Cashflow",v1:s1.net,v2:s2.net,invert:false},
            ].map(({l,v1,v2,invert})=>{
              const isNet=l==="Net Cashflow";
              return (
                <div key={l} style={{background:T.cardAlt,borderRadius:10,padding:"10px 12px",border:`1px solid ${T.border}`}}>
                  <div style={{fontSize:9,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:.7,marginBottom:6}}>{l}</div>
                  <div style={{display:"flex",alignItems:"baseline",gap:4,marginBottom:4}}>
                    <div style={{width:3,height:24,borderRadius:2,background:T.accent,flexShrink:0}}/>
                    <div style={{fontSize:12,fontWeight:800,color:isNet?(v1>=0?T.ok:T.err):T.text}}>{idr(v1)}</div>
                    <DiffBadge a={v1} b={v2} invert={invert}/>
                  </div>
                  <div style={{display:"flex",alignItems:"baseline",gap:4}}>
                    <div style={{width:3,height:20,borderRadius:2,background:"#059669",flexShrink:0}}/>
                    <div style={{fontSize:11,fontWeight:700,color:T.sub}}>{idr(v2)}</div>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:6,paddingTop:5,borderTop:`1px solid ${T.borderLight}`}}>
                    <span style={{fontSize:9,color:T.accent,fontWeight:700}}>■ {bulan1.split(" ")[0]}</span>
                    <span style={{fontSize:9,color:"#059669",fontWeight:700}}>■ {bulan2.split(" ")[0]}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bar chart comparison */}
          {!isMobile && <div style={{marginBottom:12}}>
            <div style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>Perbandingan Visual</div>
            {[{l:"Pemasukan",v1:s1.masuk,v2:s2.masuk},{l:"Pengeluaran",v1:s1.keluar,v2:s2.keluar},{l:"Tabungan",v1:s1.tabung,v2:s2.tabung}].map(({l,v1,v2})=>{
              const max=Math.max(v1,v2,1);
              return (
                <div key={l} style={{marginBottom:8}}>
                  <div style={{fontSize:11,color:T.sub,marginBottom:3,fontWeight:600}}>{l}</div>
                  <div style={{display:"flex",flexDirection:"column",gap:3}}>
                    {[{v:v1,c:T.accent,label:bulan1},{v:v2,c:"#059669",label:bulan2}].map(({v,c,label})=>(
                      <div key={label} style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:60,fontSize:9,color:T.muted,textAlign:"right",flexShrink:0}}>{label.split(" ")[0]}</div>
                        <div style={{flex:1,background:T.cardAlt,borderRadius:99,height:14,overflow:"hidden"}}>
                          <div style={{height:"100%",borderRadius:99,background:c,width:`${(v/max)*100}%`,transition:"width .4s ease-out",minWidth:v>0?4:0}}/>
                        </div>
                        <div style={{width:90,fontSize:10,fontWeight:700,color:c,flexShrink:0}}>{idr(v)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>}

          {/* Category breakdown */}
          <div style={{fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>Pengeluaran per Kategori</div>
          <div style={{border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 90px 90px 70px",padding:"6px 10px",background:T.cardAlt,borderBottom:`1px solid ${T.border}`,gap:6}}>
              {["Kategori",bulan1.split(" ")[0],bulan2.split(" ")[0],"Selisih"].map(h=><span key={h} style={{fontSize:9,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:.5}}>{h}</span>)}
            </div>
            {budgets.map(b=>{
              const v1=s1.spendKat[b.id]||0, v2=s2.spendKat[b.id]||0;
              if(!v1&&!v2)return null;
              const delta=v1-v2;
              return (
                <div key={b.id} style={{display:"grid",gridTemplateColumns:"1fr 90px 90px 70px",padding:"7px 10px",borderBottom:`1px solid ${T.borderLight}`,gap:6,alignItems:"center"}}>
                  <span style={{fontSize:11,color:T.text,fontWeight:600}}>{uiIcon(b.icon)} {b.kat}</span>
                  <span style={{fontSize:11,fontWeight:700,color:T.accent}}>{v1?idr(v1):"-"}</span>
                  <span style={{fontSize:11,fontWeight:700,color:"#059669"}}>{v2?idr(v2):"-"}</span>
                  <span style={{fontSize:10,fontWeight:700,color:delta>0?T.err:delta<0?T.ok:T.muted}}>{delta>0?"↑+":"↓"}{idr(Math.abs(delta))}</span>
                </div>
              );
            }).filter(Boolean)}
          </div>

          <div style={{display:"flex",justifyContent:"space-between",marginTop:10,fontSize:11,color:T.muted}}>
            <span>📝 {s1.txCount} transaksi · <span style={{color:T.accent,fontWeight:700}}>{bulan1}</span></span>
            <span>📝 {s2.txCount} transaksi · <span style={{color:"#059669",fontWeight:700}}>{bulan2}</span></span>
          </div>
        </>}
        {(!s1||!s2)&&<div style={{textAlign:"center",padding:"20px 0",color:T.muted,fontSize:12}}>Belum ada data untuk periode yang dipilih</div>}
      </div>}
    </div>
  );
}

// ─── ONBOARDING COMPONENT ─────────────────────────────────────────────────────
function Onboarding({ onDone, lang="id", changeLang }) {
  const isMobile = typeof window !== "undefined" ? window.innerWidth < 900 : false;
  const t = (key) => TR[lang]?.[key] ?? TR["id"]?.[key] ?? key;
  const [step, setStep] = useState(0);
  const [nama, setNama] = useState("");
  const [dompetList, setDompetList] = useState([
    { id:1, tipe:"Bank",     nama:"BCA",   icon:"🏦", saldo:"" },
    { id:2, tipe:"E-Wallet", nama:"GoPay", icon:"📱", saldo:"" },
    { id:3, tipe:"Tunai",    nama:"Tunai", icon:"💵", saldo:"" },
  ]);
  const [budgetBasic, setBudgetBasic] = useState({ makan:"", transport:"", tagihan:"" });
  const [anim, setAnim] = useState(true);
  const greeting = lang==="en" ? "Hey" : "Halo";
  const nextStep = () => { setAnim(false); setTimeout(()=>{setStep(s=>s+1);setAnim(true);},180); };
  const prevStep = () => { setAnim(false); setTimeout(()=>{setStep(s=>s-1);setAnim(true);},180); };
  const fmtN = v => { const n=String(v).replace(/\D/g,""); return n?n.replace(/\B(?=(\d{3})+(?!\d))/g,"."):""};
  const updateDompet = (id,f,v) => setDompetList(p=>p.map(d=>d.id===id?{...d,[f]:v}:d));
  const addDompet = () => setDompetList(p=>[...p,{id:Date.now(),tipe:"Bank",nama:"",icon:"💳",saldo:""}]);
  const removeDompet = id => {
    const target=dompetList.find(d=>d.id===id);
    if(window.confirm(`Hapus dompet "${target?.nama||"ini"}" dari setup awal?`)){
      setDompetList(p=>p.filter(d=>d.id!==id));
    }
  };
  const handleDone = () => {
    const cleanDompet = dompetList.filter(d=>d.nama.trim()).map((d,i)=>({...d,id:i+1,norek:"",saldo:d.saldo||"0"}));
    const budgets = INIT_BUDGETS.map(b=>{
      if(b.id===1)return{...b,alokasi:budgetBasic.makan.replace(/\./g,"")||"0"};
      if(b.id===2)return{...b,alokasi:budgetBasic.transport.replace(/\./g,"")||"0"};
      if(b.id===3)return{...b,alokasi:budgetBasic.tagihan.replace(/\./g,"")||"0"};
      return b;
    });
    onDone({name:nama.trim()||"Pengguna",dompet:cleanDompet.length?cleanDompet:INIT.dompet,budgets});
  };
  const progressPct = (step / 3) * 100;
  const inputSt = {width:"100%",padding:"12px 14px",borderRadius:12,border:"2px solid #E9D5FF",fontSize:15,fontWeight:700,textAlign:"center",outline:"none",background:"#FDFBFF",color:"#1F2937"};
  return (
    <div style={{minHeight:"var(--app-height, 100dvh)",background:"linear-gradient(135deg,#EDE9FE 0%,#F5F3FF 60%,#FDFBFF 100%)",display:"flex",alignItems:"center",justifyContent:"center",padding:"max(16px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) max(16px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px))",fontFamily:"'Nunito',system-ui,sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}`}</style>
      <div style={{background:"white",borderRadius:24,padding:"28px 24px",width:"100%",maxWidth:400,boxShadow:"0 20px 60px rgba(91,33,182,.15)"}}>
        {step>0&&<div style={{marginBottom:20}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:11,color:"#94A3B8"}}>
            <span>{t("ob_step")} {step} {t("ob_of")} 3</span><span>{Math.round(progressPct)}%</span>
          </div>
          <div style={{background:"#EDE9FE",borderRadius:99,height:5,overflow:"hidden"}}>
            <div style={{background:"linear-gradient(90deg,#5B21B6,#7C3AED)",height:"100%",width:progressPct+"%",borderRadius:99,transition:"width .35s"}}/>
          </div>
          <div style={{display:"flex",gap:6,justifyContent:"center",marginTop:8}}>
            {[1,2,3].map(i=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:step>=i?"#7C3AED":"#E9D5FF",transition:"background .3s"}}/>)}
          </div>
        </div>}
        <div style={{opacity:anim?1:0,transform:anim?"none":"translateX(18px)",transition:"opacity .18s,transform .18s"}}>
          {step===0&&<div style={{textAlign:"center",padding:"10px 0 20px"}}>
            {/* Language picker */}
            <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:16}}>
              {[{code:"id",flag:"🇮🇩",label:"Indonesia"},{code:"en",flag:"🇺🇸",label:"English"}].map(l=>(
                <button key={l.code} onClick={()=>changeLang&&changeLang(l.code)} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 14px",borderRadius:99,border:`2px solid ${lang===l.code?"#7C3AED":"#E9D5FF"}`,background:lang===l.code?"#EDE9FE":"white",color:lang===l.code?"#5B21B6":"#9CA3AF",fontWeight:700,fontSize:12,cursor:"pointer",transition:"all .2s"}}>
                  <span style={{fontSize:16}}>{l.flag}</span>{l.label}
                </button>
              ))}
            </div>
            <div style={{marginBottom:14,display:"inline-block",animation:"bob 2s ease-in-out infinite",width:80,height:80}}><div style={{width:80,height:80,borderRadius:20,background:"#7C3AED",display:"flex",alignItems:"center",justifyContent:"center",fontSize:48}}>🐱</div></div>
            <div style={{fontSize:26,fontWeight:900,color:"#5B21B6",marginBottom:8}}>{t("ob_welcome")}</div>
            <div style={{fontSize:14,color:"#6B7280",lineHeight:1.65,marginBottom:24,maxWidth:320,margin:"0 auto 24px"}}>{t("ob_desc")}</div>
            <div style={{display:"flex",flexDirection:"column",gap:8,maxWidth:280,margin:"0 auto 24px"}}>
              {[t("ob_feat1"),t("ob_feat2"),t("ob_feat3"),t("ob_feat4"),t("ob_feat5")].map(f=>(
                <div key={f} style={{background:"#F5F3FF",borderRadius:10,padding:"9px 14px",fontSize:13,color:"#5B21B6",fontWeight:600,textAlign:"left"}}>{f}</div>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,margin:"0 auto 18px",maxWidth:300}}>
              <div style={{background:"linear-gradient(135deg,#F0FDF4,#ECFEFF)",border:"1px solid #BBF7D0",borderRadius:14,padding:"11px 12px",textAlign:"left"}}>
                <div style={{fontSize:10,fontWeight:900,color:"#15803D",letterSpacing:1,textTransform:"uppercase",marginBottom:3}}>Lifetime</div>
                <div style={{fontSize:16,fontWeight:900,color:"#065F46"}}>Sekali bayar</div>
                <div style={{fontSize:11,color:"#047857",lineHeight:1.35}}>Data aman di akun kamu</div>
              </div>
              <div style={{background:"linear-gradient(135deg,#EEF2FF,#F5F3FF)",border:"1px solid #DDD6FE",borderRadius:14,padding:"11px 12px",textAlign:"left"}}>
                <div style={{fontSize:10,fontWeight:900,color:"#6D28D9",letterSpacing:1,textTransform:"uppercase",marginBottom:3}}>3 menit</div>
                <div style={{fontSize:16,fontWeight:900,color:"#4C1D95"}}>Langsung siap</div>
                <div style={{fontSize:11,color:"#6D28D9",lineHeight:1.35}}>Isi saldo, budget, mulai catat</div>
              </div>
            </div>
            <div style={{fontSize:12,color:"#94A3B8",marginBottom:18}}>{t("ob_steps")}</div>
            <button onClick={nextStep} style={{background:"linear-gradient(135deg,#5B21B6,#7C3AED)",color:"white",border:"none",borderRadius:14,padding:"13px 34px",fontSize:15,fontWeight:800,cursor:"pointer",boxShadow:"0 6px 24px rgba(91,33,182,.35)"}}>{t("ob_start")}</button>
          </div>}
          {step===1&&<div style={{padding:"6px 0 12px"}}>
            <div style={{fontSize:38,textAlign:"center",marginBottom:12}}>👋</div>
            <div style={{fontSize:18,fontWeight:900,color:"#1F2937",marginBottom:4,textAlign:"center"}}>{t("ob_nameQ")}</div>
            <div style={{fontSize:12,color:"#6B7280",textAlign:"center",marginBottom:20}}>{t("ob_nameHint")}</div>
            <input value={nama} onChange={e=>setNama(e.target.value)} onKeyDown={e=>e.key==="Enter"&&nama.trim()&&nextStep()} placeholder={t("ob_namePh")} style={inputSt} autoFocus/>
            {nama.trim()&&<div style={{marginTop:12,padding:"12px 16px",background:"#F5F3FF",borderRadius:12,textAlign:"center",fontSize:14,color:"#5B21B6",fontWeight:700}}>{greeting} <strong>{nama}</strong>! ✨</div>}
            <div style={{display:"flex",gap:8,marginTop:20}}>
              <button onClick={prevStep} style={{flex:1,padding:"11px",borderRadius:12,border:"2px solid #E9D5FF",background:"white",color:"#6B7280",fontWeight:700,cursor:"pointer",fontSize:13}}>{t("back")}</button>
              <button onClick={nextStep} disabled={!nama.trim()} style={{flex:2,padding:"11px",borderRadius:12,border:"none",background:nama.trim()?"linear-gradient(135deg,#5B21B6,#7C3AED)":"#E9D5FF",color:nama.trim()?"white":"#94A3B8",fontWeight:800,cursor:nama.trim()?"pointer":"default",fontSize:13}}>{t("next")}</button>
            </div>
          </div>}
          {step===2&&<div style={{padding:"6px 0 12px"}}>
            <div style={{fontSize:34,textAlign:"center",marginBottom:10}}>💳</div>
            <div style={{fontSize:17,fontWeight:900,color:"#1F2937",marginBottom:4,textAlign:"center"}}>{t("ob_walletQ")}</div>
            <div style={{fontSize:12,color:"#6B7280",textAlign:"center",marginBottom:14}}>{t("ob_walletHint")}</div>
            <div style={{display:"flex",flexDirection:"column",gap:7,maxHeight:260,overflowY:"auto",marginBottom:10}}>
              {dompetList.map(d=>(
                <div key={d.id} style={{background:"#F5F3FF",borderRadius:11,padding:"9px 11px",display:"flex",gap:7,alignItems:"center"}}>
                  <div style={{fontSize:20,minWidth:28,textAlign:"center"}}>{uiIcon(d.icon)}</div>
                  <div style={{flex:1}}>
                    <input value={d.nama} onChange={e=>updateDompet(d.id,"nama",e.target.value)} placeholder={lang==="en"?"Account name":"Nama rekening"} style={{width:"100%",border:"1.5px solid #E9D5FF",borderRadius:7,padding:"4px 8px",fontSize:12,fontWeight:700,color:"#1F2937",background:"white",outline:"none",marginBottom:3}}/>
                    <div style={{display:"flex",gap:5,alignItems:"center"}}>
                      <span style={{fontSize:10,color:"#94A3B8"}}>Rp</span>
                      <input value={d.saldo} onChange={e=>updateDompet(d.id,"saldo",fmtN(e.target.value))} placeholder={t("initialBalance")} style={{flex:1,border:"1.5px solid #E9D5FF",borderRadius:7,padding:"4px 8px",fontSize:12,color:"#5B21B6",fontWeight:700,background:"white",outline:"none"}}/>
                    </div>
                  </div>
                  {dompetList.length>1&&<button onClick={()=>removeDompet(d.id)} style={{background:"#FEE2E2",border:"none",borderRadius:7,padding:"5px 8px",cursor:"pointer",color:"#DC2626",fontSize:13}}>X</button>}
                </div>
              ))}
            </div>
            <button onClick={addDompet} style={{width:"100%",padding:"8px",borderRadius:9,border:"2px dashed #C4B5FD",background:"transparent",color:"#7C3AED",fontWeight:700,cursor:"pointer",fontSize:12,marginBottom:12}}>{t("ob_addWallet")}</button>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr auto",gap:8}}>
              <button onClick={prevStep} style={{flex:1,padding:"11px",borderRadius:12,border:"2px solid #E9D5FF",background:"white",color:"#6B7280",fontWeight:700,cursor:"pointer",fontSize:13}}>{t("back")}</button>
              <button onClick={nextStep} style={{flex:2,padding:"11px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#5B21B6,#7C3AED)",color:"white",fontWeight:800,cursor:"pointer",fontSize:13}}>{t("next")}</button>
            </div>
          </div>}
          {step===3&&<div style={{padding:"6px 0 12px"}}>
            <div style={{fontSize:34,textAlign:"center",marginBottom:10}}>📊</div>
            <div style={{fontSize:17,fontWeight:900,color:"#1F2937",marginBottom:2,textAlign:"center"}}>{t("ob_budgetQ")} <span style={{fontSize:11,fontWeight:500,color:"#94A3B8"}}>{t("ob_budgetOpt")}</span></div>
            <div style={{fontSize:12,color:"#6B7280",textAlign:"center",marginBottom:16}}>{t("ob_budgetHint")}</div>
            <div style={{display:"flex",flexDirection:"column",gap:9,marginBottom:14}}>
              {[{key:"makan",label:"🍜 "+t("kat_food"),ph:lang==="en"?"e.g. 150"  :"Misal: 1.500.000"},{key:"transport",label:"🚗 "+t("kat_transport"),ph:lang==="en"?"e.g. 50":"Misal: 500.000"},{key:"tagihan",label:"💡 "+t("kat_bills"),ph:lang==="en"?"e.g. 40":"Misal: 400.000"}].map(({key,label,ph})=>(
                <div key={key} style={{background:"#F5F3FF",borderRadius:11,padding:"9px 13px"}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#5B21B6",marginBottom:5}}>{label}</div>
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <span style={{fontSize:11,color:"#94A3B8",fontWeight:600}}>Rp</span>
                    <input value={budgetBasic[key]} onChange={e=>setBudgetBasic(p=>({...p,[key]:fmtN(e.target.value)}))} placeholder={ph} style={{flex:1,border:"1.5px solid #E9D5FF",borderRadius:7,padding:"6px 9px",fontSize:12,fontWeight:700,color:"#5B21B6",background:"white",outline:"none"}}/>
                  </div>
                </div>
              ))}
            </div>
            <div style={{background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:9,padding:"9px 13px",fontSize:11,color:"#92400E",marginBottom:14}}>
              💡 {t("ob_budgetTip")}
            </div>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr auto",gap:8}}>
              <button onClick={prevStep} style={{flex:1,padding:"11px",borderRadius:12,border:"2px solid #E9D5FF",background:"white",color:"#6B7280",fontWeight:700,cursor:"pointer",fontSize:13}}>← Kembali</button>
              <button onClick={handleDone} style={{flex:2,padding:"11px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#059669,#10B981)",color:"white",fontWeight:800,cursor:"pointer",fontSize:13,boxShadow:"0 4px 16px rgba(5,150,105,.3)"}}>{t("ob_finish")}</button>
            </div>
          </div>}
        </div>
        {step>0&&<div style={{textAlign:"center",marginTop:10,fontSize:10,color:"#94A3B8"}}>{t("ob_local")}</div>}
      </div>
    </div>
  );
}

// ─── IMPORT MUTASI BANK MODAL ────────────────────────────────────────────────



// ─── YEAR IN REVIEW ───────────────────────────────────────────────────────────
function YearInReview({ s, T, lang, onClose }) {
  const t = (k) => (lang==="en"?{
    yearReview:"Year in Review",yearIncome:"Total Income",yearExpense:"Total Expenses",
    yearSaving:"Total Savings",yearNet:"Net Cashflow",bestMonth:"Best Month",
    worstMonth:"Worst Month",topCategories:"Top Categories",monthlyTrend:"Monthly Trend",
    txTotal:"Transactions",avgMonthly:"Monthly Average",yearScore:"Annual Score",
    noTxYear:"No transactions this year",growth:"Growth",closeBtn:"Close",
    yearSummary:"Year Summary",netWorthChange:"Net Worth Change",
  }:{
    yearReview:"Rekap Tahunan",yearIncome:"Total Pemasukan",yearExpense:"Total Pengeluaran",
    yearSaving:"Total Tabungan",yearNet:"Net Cashflow Tahun Ini",bestMonth:"Bulan Terbaik",
    worstMonth:"Bulan Terboros",topCategories:"Kategori Terbesar",monthlyTrend:"Tren Bulanan",
    txTotal:"Transaksi",avgMonthly:"Rata-rata/Bulan",yearScore:"Skor Tahunan",
    noTxYear:"Belum ada transaksi di tahun ini",growth:"Pertumbuhan",closeBtn:"Tutup",
    yearSummary:"Ringkasan Tahun",netWorthChange:"Perubahan Net Worth",
  })[k]||k;
  const MONTHS_L = lang==="en"
    ? ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    : ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];
  const MONTHS_FULL = lang==="en"
    ? ["January","February","March","April","May","June","July","August","September","October","November","December"]
    : ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  const IDR = n => "Rp " + Math.abs(Math.round(n||0)).toLocaleString("id-ID");
  const IDRs = n => { const abs=Math.abs(Math.round(n||0)); return (n<0?"-":"")+"Rp "+(abs>=1e9?(abs/1e9).toFixed(1)+"M":abs>=1e6?(abs/1e6).toFixed(1)+"jt":abs.toLocaleString("id-ID")); };
  const N = v => parseFloat(String(v||0).replace(/[^0-9.,-]/g,"").replace(/\./g,"").replace(",","."))||0;
  const year = s.tahun || String(new Date().getFullYear());

  // Filter transactions for the year
  const txYear = s.txs.filter(tx => (tx.tgl||"").startsWith(year));
  const totalIn  = txYear.filter(t=>t.tipe==="pemasukan").reduce((a,b)=>a+N(b.jml),0);
  const totalOut = txYear.filter(t=>t.tipe==="pengeluaran").reduce((a,b)=>a+N(b.jml),0);
  const totalSav = txYear.filter(t=>t.tipe==="tabungan").reduce((a,b)=>a+N(b.jml),0);
  const netCash  = totalIn - totalOut - totalSav;
  const totalTx  = txYear.length;
  const totalSaldo = s.dompet.reduce((a,d)=>a+N(d.saldo),0);

  // Monthly breakdown
  const monthly = Array.from({length:12},(_,mi)=>{
    const m = String(mi+1).padStart(2,"0");
    const prefix = `${year}-${m}`;
    const mTx = txYear.filter(t=>(t.tgl||"").startsWith(prefix));
    const inc = mTx.filter(t=>t.tipe==="pemasukan").reduce((a,b)=>a+N(b.jml),0);
    const exp = mTx.filter(t=>t.tipe==="pengeluaran").reduce((a,b)=>a+N(b.jml),0);
    const sav = mTx.filter(t=>t.tipe==="tabungan").reduce((a,b)=>a+N(b.jml),0);
    return {month:MONTHS_L[mi],fullMonth:MONTHS_FULL[mi],inc,exp,sav,net:inc-exp-sav,count:mTx.length};
  });

  const activeMo = monthly.filter(m=>m.count>0);
  const bestM  = activeMo.length ? activeMo.reduce((a,b)=>b.net>a.net?b:a, activeMo[0]) : null;
  const worstM = activeMo.length ? activeMo.reduce((a,b)=>b.exp>a.exp?b:a, activeMo[0]) : null;
  const avgIn  = activeMo.length ? totalIn/activeMo.length : 0;
  const avgOut = activeMo.length ? totalOut/activeMo.length : 0;

  // Top spending categories
  const catSpend = {};
  txYear.filter(t=>t.tipe==="pengeluaran"&&t.katId).forEach(t=>{
    const b = s.budgets.find(b=>b.id===t.katId);
    const nm = b?.kat||"Lainnya";
    const ico = b?.icon||"📦";
    catSpend[nm] = {jml:(catSpend[nm]?.jml||0)+N(t.jml), icon:ico};
  });
  const topCats = Object.entries(catSpend).sort((a,b)=>b[1].jml-a[1].jml).slice(0,5);

  // Annual financial score
  const savRate = totalIn>0 ? (totalSav/totalIn)*100 : 0;
  const expRate = totalIn>0 ? (totalOut/totalIn)*100 : 0;
  const yearScoreVal = Math.min(100,Math.round(
    (savRate>=20?30:savRate/20*30) +
    (expRate<=50?40:expRate<=70?25:expRate<=90?10:0) +
    (netCash>0?30:0)
  ));
  const scoreColor = yearScoreVal>=70?T.ok:yearScoreVal>=40?T.warn:T.err;
  const scoreLabel = yearScoreVal>=80?"Excellent":yearScoreVal>=60?(lang==="en"?"Good":"Baik"):yearScoreVal>=40?(lang==="en"?"Fair":"Cukup"):(lang==="en"?"Needs Work":"Perlu Kerja");

  // Chart max
  const maxBar = Math.max(...monthly.map(m=>Math.max(m.inc,m.exp)),1);

  const SS = {fontSize:10,fontWeight:700,color:T.accent,textTransform:"uppercase",letterSpacing:.8,marginBottom:4};

  if (!txYear.length) return (
    <div style={{textAlign:"center",padding:"40px 20px"}}>
      <div style={{fontSize:64,marginBottom:12}}>📭</div>
      <div style={{fontWeight:700,color:T.muted}}>{t("noTxYear")} {year}</div>
      <button onClick={onClose} style={{marginTop:20,padding:"8px 20px",borderRadius:9,background:T.accentBg,border:"none",color:T.accent,fontWeight:700,cursor:"pointer"}}>{t("closeBtn")}</button>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
        <div>
          <div style={{fontSize:18,fontWeight:900,color:T.text}}>🎊 {t("yearReview")} {year}</div>
          <div style={{fontSize:11,color:T.muted,marginTop:2}}>{totalTx} {t("txTotal")}</div>
        </div>
        <button onClick={onClose} style={{background:T.cardAlt,border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer",color:T.muted,fontSize:16}}>X</button>
      </div>

      {/* Annual Score Hero */}
      <div style={{background:`linear-gradient(135deg,${T.accent},${T.accentSoft})`,borderRadius:16,padding:"16px 18px",marginBottom:14,color:"white",display:"flex",alignItems:"center",gap:16}}>
        <div style={{width:68,height:68,background:"rgba(255,255,255,.15)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:900}}>{yearScoreVal}</div>
            <div style={{fontSize:8,opacity:.8}}>/100</div>
          </div>
        </div>
        <div style={{flex:1}}>
          <div style={{fontWeight:900,fontSize:16,marginBottom:3}}>{scoreLabel} 🏆</div>
          <div style={{fontSize:11,opacity:.85}}>{t("yearScore")} {year}</div>
          <div style={{marginTop:8,background:"rgba(255,255,255,.2)",borderRadius:99,height:6,overflow:"hidden"}}>
            <div style={{width:yearScoreVal+"%",height:"100%",background:"white",borderRadius:99,transition:"width .6s ease"}}/>
          </div>
        </div>
      </div>

      {/* 4 Big Stats */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
        {[
          {l:t("yearIncome"),  v:IDRs(totalIn),  c:T.ok,  bg:T.okBg,  ico:"📈"},
          {l:t("yearExpense"), v:IDRs(totalOut), c:T.err, bg:T.errBg, ico:"📉"},
          {l:t("yearSaving"),  v:IDRs(totalSav), c:T.info,bg:T.infoBg,ico:"🏦"},
          {l:t("yearNet"),     v:IDRs(netCash),  c:netCash>=0?T.ok:T.err, bg:netCash>=0?T.okBg:T.errBg, ico:netCash>=0?"✨":"⚠️"},
        ].map(({l,v,c,bg,ico})=>(
          <div key={l} style={{background:bg,borderRadius:12,padding:"12px 14px"}}>
            <div style={{fontSize:18,marginBottom:4}}>{ico}</div>
            <div style={{fontSize:9,color:c,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:2}}>{l}</div>
            <div style={{fontSize:14,fontWeight:900,color:c}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Monthly Bar Chart */}
      <div style={{background:T.card,borderRadius:14,padding:"12px 14px",marginBottom:14,border:`1px solid ${T.border}`}}>
        <div style={SS}>{t("monthlyTrend")} {year}</div>
        <div style={{display:"flex",alignItems:"flex-end",gap:3,height:80,marginTop:8}}>
          {monthly.map((m,i)=>(
            <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
              <div style={{width:"100%",display:"flex",flexDirection:"column",alignItems:"center",gap:1,height:72,justifyContent:"flex-end"}}>
                <div style={{width:"80%",background:T.ok,borderRadius:"3px 3px 0 0",opacity:.85,
                  height:m.inc?(m.inc/maxBar*66)+"px":"2px",minHeight:m.inc?2:0,transition:"height .4s"}}/>
                <div style={{width:"80%",background:T.err,borderRadius:"3px 3px 0 0",opacity:.85,
                  height:m.exp?(m.exp/maxBar*66)+"px":"2px",minHeight:m.exp?2:0,transition:"height .4s"}}/>
              </div>
              <div style={{fontSize:7,color:T.muted,marginTop:2,textAlign:"center"}}>{m.month}</div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:12,marginTop:6,justifyContent:"center"}}>
          {[{c:T.ok,l:lang==="en"?"Income":"Masuk"},{c:T.err,l:lang==="en"?"Expense":"Keluar"}].map(({c,l})=>(
            <div key={l} style={{display:"flex",alignItems:"center",gap:4,fontSize:9,color:T.muted}}>
              <div style={{width:8,height:8,borderRadius:2,background:c,opacity:.85}}/>
              {l}
            </div>
          ))}
        </div>
      </div>

      {/* Best / Worst Month */}
      {(bestM||worstM)&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
        {bestM&&<div style={{background:T.okBg,borderRadius:12,padding:"10px 12px"}}>
          <div style={{fontSize:9,color:T.ok,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>🏅 {t("bestMonth")}</div>
          <div style={{fontWeight:900,fontSize:15,color:T.ok}}>{bestM.fullMonth}</div>
          <div style={{fontSize:10,color:T.ok,marginTop:2,opacity:.8}}>Net {IDRs(bestM.net)}</div>
        </div>}
        {worstM&&<div style={{background:T.errBg,borderRadius:12,padding:"10px 12px"}}>
          <div style={{fontSize:9,color:T.err,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>🔥 {t("worstMonth")}</div>
          <div style={{fontWeight:900,fontSize:15,color:T.err}}>{worstM.fullMonth}</div>
          <div style={{fontSize:10,color:T.err,marginTop:2,opacity:.8}}>Exp {IDRs(worstM.exp)}</div>
        </div>}
      </div>}

      {/* Average */}
      <div style={{background:T.card,borderRadius:12,padding:"10px 14px",marginBottom:14,border:`1px solid ${T.border}`,display:"flex",gap:12,flexWrap:"wrap"}}>
        <div style={{flex:1}}>
          <div style={{fontSize:9,color:T.muted,textTransform:"uppercase",letterSpacing:.8}}>{t("avgMonthly")} {lang==="en"?"Income":"Masuk"}</div>
          <div style={{fontWeight:800,color:T.ok,fontSize:13,marginTop:2}}>{IDRs(avgIn)}</div>
        </div>
        <div style={{width:1,background:T.border}}/>
        <div style={{flex:1}}>
          <div style={{fontSize:9,color:T.muted,textTransform:"uppercase",letterSpacing:.8}}>{t("avgMonthly")} {lang==="en"?"Expense":"Keluar"}</div>
          <div style={{fontWeight:800,color:T.err,fontSize:13,marginTop:2}}>{IDRs(avgOut)}</div>
        </div>
      </div>

      {/* Top Categories */}
      {topCats.length>0&&<div style={{background:T.card,borderRadius:14,padding:"12px 14px",marginBottom:14,border:`1px solid ${T.border}`}}>
        <div style={SS}>{t("topCategories")}</div>
        {topCats.map(([name,{jml,icon}],i)=>(
          <div key={name} style={{display:"flex",alignItems:"center",gap:10,paddingBottom:i<topCats.length-1?8:0,marginBottom:i<topCats.length-1?8:0,borderBottom:i<topCats.length-1?`1px solid ${T.borderLight}`:"none"}}>
            <div style={{width:28,height:28,background:T.accentBg,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>{icon}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:12,color:T.text}}>{name}</div>
              <div style={{height:4,background:T.cardAlt,borderRadius:99,marginTop:4,overflow:"hidden"}}>
                <div style={{height:"100%",background:T.accent,borderRadius:99,width:(topCats[0][1].jml>0?jml/topCats[0][1].jml*100:0)+"%",transition:"width .5s ease"}}/>
              </div>
            </div>
            <div style={{fontWeight:800,fontSize:12,color:T.err,flexShrink:0}}>{IDRs(jml)}</div>
            <div style={{fontWeight:900,color:T.muted,fontSize:11,width:16,textAlign:"right"}}>#{i+1}</div>
          </div>
        ))}
      </div>}

      {/* Net Worth Snapshot */}
      <div style={{background:T.accentBg,borderRadius:12,padding:"12px 14px",marginBottom:14,border:`1px solid ${T.accentPop}20`}}>
        <div style={{fontSize:9,color:T.accent,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>{t("netWorthChange")}</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:10,color:T.muted}}>Current Saldo</div>
            <div style={{fontSize:18,fontWeight:900,color:T.accent}}>{IDR(totalSaldo)}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:10,color:T.muted}}>{t("yearNet")+":"}</div>
            <div style={{fontSize:14,fontWeight:800,color:netCash>=0?T.ok:T.err}}>{netCash>=0?"+":""}{IDRs(netCash)}</div>
          </div>
        </div>
      </div>

      <button onClick={onClose} style={{width:"100%",padding:"11px",borderRadius:11,background:T.accentBg,border:`1.5px solid ${T.accentPop}30`,color:T.accent,fontWeight:800,cursor:"pointer",fontSize:13}}>
        ✕ {t("closeBtn")}
      </button>
    </div>
  );
}
function ImportMutasiBank({ dompet, onImport, onClose, T, lang="id" }) {
  const t = k => ({
    toast_noData:"Tidak ada data transaksi ditemukan.",
    all:"Semua", inflow2:"Masuk", outflow2:"Keluar",
    allSelected:"Batalkan Semua", selectAll:"Pilih Semua",
  }[k]||k);
  const [step, setStep] = useState(0);
  const [bankType, setBankType] = useState("BCA");
  const [dompetId, setDompetId] = useState(dompet[0]?.id || 1);
  const [parsed, setParsed] = useState([]);
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [filter, setFilter] = useState("all");
  const [kat, setKat] = useState({});
  const BANKS = ["BCA","Mandiri","BNI","BRI","CIMB","Jenius","OVO","GoPay","Dana","ShopeePay","BSI","Permata","BTN","Generic"];
  const BANK_GUIDES = {
    BCA:"myBCA → Rekening → Unduh Mutasi → CSV",
    Mandiri:"Livin → Rekening → Cetak Rekening → Export",
    BNI:"BNI Mobile → Informasi → Mutasi → Download",
    BRI:"BRImo → Rekening → Mutasi → Download CSV",
    CIMB:"OCTO Mobile → Rekening → Mutasi → Export",
    Jenius:"Jenius → Akun → Riwayat Transaksi → Export CSV",
    OVO:"OVO → Transaksi → Filter → Download Riwayat",
    GoPay:"Gojek → GoPay → Riwayat → Download (CSV)",
    Dana:"Dana → Riwayat Transaksi → Export ke Email",
    ShopeePay:"Shopee → Saya → ShopeePay → Riwayat → Export",
    BSI:"BSIm → Rekening → Mutasi → Download CSV",
    Permata:"PermataMobile X → Rekening → Mutasi",
    BTN:"BTN Mobile → Rekening → Mutasi CSV",
    Generic:"Format otomatis — coba upload & lihat hasilnya",
  };
  const BANK_ICONS = {
    BCA:"🔵",Mandiri:"🟡",BNI:"🟠",BRI:"🔵",CIMB:"🔴",
    Jenius:"💎",OVO:"💜",GoPay:"🟢",Dana:"🔵",ShopeePay:"🟠",
    BSI:"🟢",Permata:"🔵",BTN:"🟡",Generic:"⚙️",
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0] || e;
    if (!file) return;
    setFileName(file.name||"file.csv");
    setLoading(true); setError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        const detected = detectBank(text);
        const useBank = bankType==="Generic" ? detected : bankType;
        if (detected!=="Generic") setBankType(detected);
        const rows = parseBankCSV(text, useBank);
        if (!rows.length) { setError(t("toast_noData")); setLoading(false); return; }
        setParsed(rows);
        const sel = {}; const k = {};
        rows.forEach((r,i)=>{ sel[i]=true; k[i]=r.katId; });
        setSelected(sel); setKat(k);
        setStep(1);
      } catch(err) { setError("Gagal membaca file. Pastikan file adalah CSV yang valid."); }
      setLoading(false);
    };
    reader.readAsText(file, "UTF-8");
  };

  const IDRf = n => "Rp " + Number(n||0).toLocaleString("id-ID");
  const filtered = parsed.map((r,i)=>[i,r]).filter(([,r])=>filter==="all"||r.tipe===filter);
  const selectedCount = Object.values(selected).filter(Boolean).length;
  const totalMasuk = parsed.reduce((a,r,i)=>selected[i]&&r.tipe==="pemasukan"?a+Number(r.jml):a,0);
  const totalKeluar = parsed.reduce((a,r,i)=>selected[i]&&r.tipe==="pengeluaran"?a+Number(r.jml):a,0);
  const toggleAll = () => {
    const idxs = filtered.map(([i])=>i);
    const allOn = idxs.every(i=>selected[i]);
    const ns = {...selected}; idxs.forEach(i=>ns[i]=!allOn); setSelected(ns);
  };
  const handleImport = () => {
    const toImport = parsed.filter((_,i)=>selected[i]).map((r,i)=>({
      ...r, id:Date.now()+Math.random(), katId:kat[i]||r.katId,
      bulan:MONTHS[new Date(r.tgl).getMonth()]||MONTHS[0],
      tahun:String(new Date(r.tgl).getFullYear()),
      dompetId:Number(dompetId), subKat:"", biaya:"0",
    }));
    onImport(toImport, Number(dompetId));
  };
  const katName = id => KW_KAT.find(k=>k.id===id)?.kat || "Lainnya";

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:T.text}}>🏦 Import Mutasi Bank</div>
          <div style={{fontSize:11,color:T.muted,marginTop:2}}>{step===0?"Upload file CSV dari m-banking atau internet banking":`${parsed.length} transaksi ditemukan dari ${fileName}`}</div>
        </div>
        <button onClick={onClose} style={{background:T.cardAlt,border:"none",borderRadius:7,padding:"5px 9px",cursor:"pointer",color:T.muted,fontSize:16}}>X</button>
      </div>
      {step===0&&<>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:10,fontWeight:700,color:T.accent,textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>Format Bank</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:5}}>
            {BANKS.map(b=>(
              <button key={b} onClick={()=>setBankType(b)} style={{padding:"6px 4px",borderRadius:9,border:`2px solid ${bankType===b?T.accent:T.border}`,background:bankType===b?T.accentBg:T.card,color:bankType===b?T.accent:T.sub,fontWeight:700,fontSize:10,cursor:"pointer",transition:"all .15s",textAlign:"center",lineHeight:1.3}}>
                <span style={{fontSize:14,display:"block"}}>{BANK_ICONS[b]}</span>
                {b==="Generic"?"Auto":b==="ShopeePay"?"SPay":b}
              </button>
            ))}
          </div>
          {bankType&&BANK_GUIDES[bankType]&&<div style={{marginTop:6,fontSize:10,color:T.sub,background:T.cardAlt,borderRadius:7,padding:"6px 10px"}}>
            📱 {BANK_GUIDES[bankType]}
          </div>}
        </div>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:10,fontWeight:700,color:T.accent,textTransform:"uppercase",letterSpacing:.8,marginBottom:5}}>Masukkan ke Dompet</div>
          <select value={dompetId} onChange={e=>setDompetId(e.target.value)} style={{width:"100%",padding:"8px 10px",borderRadius:9,border:`1.5px solid ${T.inputBorder}`,background:T.input,color:T.text,fontSize:13,fontWeight:600,outline:"none"}}>
            {dompet.map(d=><option key={d.id} value={d.id}>{uiIcon(d.icon)} {d.nama}</option>)}
          </select>
        </div>
        <label style={{display:"block",cursor:"pointer"}}
          onDragOver={e=>{e.preventDefault();}} onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)handleFile(f);}}>
          <div style={{border:`2px dashed ${T.border}`,borderRadius:14,padding:"24px 18px",textAlign:"center",background:T.cardAlt}}>
            {loading?<div style={{color:T.accent,fontWeight:700}}>⏳ Memproses...</div>:<>
              <div style={{fontSize:36,marginBottom:8}}>📂</div>
              <div style={{fontWeight:800,color:T.text,fontSize:14,marginBottom:3}}>Klik atau drag & drop file CSV</div>
              <div style={{fontSize:10,color:T.muted,lineHeight:1.6}}>BCA · Mandiri · BNI · BRI · CIMB<br/>Jenius · OVO · GoPay · Dana · ShopeePay · BSI</div>
            </>}
          </div>
          <input type="file" accept=".csv,.txt" onChange={handleFile} style={{display:"none"}}/>
        </label>
        {error&&<div style={{marginTop:8,color:T.err,fontSize:11,background:T.errBg,borderRadius:7,padding:"7px 11px"}}>{error}</div>}
        <div style={{marginTop:12,background:T.infoBg,border:`1px solid ${T.infoBorder}`,borderRadius:9,padding:"9px 12px"}}>
          <div style={{fontSize:11,fontWeight:700,color:T.info,marginBottom:5}}>💡 Cara download mutasi CSV:</div>
          <div style={{fontSize:10,color:T.sub,lineHeight:1.75}}>
            <b>BCA:</b> myBCA → Rekening → Unduh Mutasi → CSV<br/>
            <b>Mandiri:</b> Livin → Rekening → Cetak Rekening → Export<br/>
            <b>BNI:</b> BNI Mobile → Informasi → Mutasi → Download<br/>
            <b>BRI:</b> BRImo → Rekening → Mutasi → Download CSV<br/>
            <b>Jenius:</b> Akun → Riwayat Transaksi → Export CSV<br/>
            <b>OVO/GoPay/Dana:</b> Riwayat → Download / Export<br/>
            <b>ShopeePay:</b> Saya → ShopeePay → Riwayat → Export
          </div>
        </div>
      </>}
      {step===1&&<>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:10}}>
          <div style={{background:T.okBg,borderRadius:9,padding:"7px 11px"}}><div style={{fontSize:9,color:T.ok,fontWeight:700,textTransform:"uppercase"}}>{t("incomeLabel")}</div><div style={{fontSize:13,fontWeight:800,color:T.ok}}>{IDRf(totalMasuk)}</div></div>
          <div style={{background:T.errBg,borderRadius:9,padding:"7px 11px"}}><div style={{fontSize:9,color:T.err,fontWeight:700,textTransform:"uppercase"}}>{t("expenseLabel")}</div><div style={{fontSize:13,fontWeight:800,color:T.err}}>{IDRf(totalKeluar)}</div></div>
        </div>
        <div style={{display:"flex",gap:5,marginBottom:8,alignItems:"center",flexWrap:"wrap"}}>
          {["all","pemasukan","pengeluaran"].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{padding:"4px 10px",borderRadius:99,border:"none",background:filter===f?T.accent:T.cardAlt,color:filter===f?"white":T.sub,fontWeight:700,fontSize:10,cursor:"pointer"}}>
              {f==="all"?t("all"):f==="pemasukan"?t("inflow2"):t("outflow2")}
            </button>
          ))}
          <button onClick={toggleAll} style={{marginLeft:"auto",padding:"4px 10px",borderRadius:99,border:`1.5px solid ${T.border}`,background:"transparent",color:T.accent,fontWeight:700,fontSize:10,cursor:"pointer"}}>
            {filtered.every(([i])=>selected[i])?t("allSelected"):t("selectAll")}
          </button>
        </div>
        <div style={{maxHeight:280,overflowY:"auto",border:`1px solid ${T.border}`,borderRadius:11,marginBottom:10}}>
          {filtered.map(([i,r])=>(
            <div key={i} onClick={()=>setSelected(p=>({...p,[i]:!p[i]}))} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 11px",borderBottom:`1px solid ${T.borderLight}`,cursor:"pointer",background:selected[i]?T.cardAlt:T.card,transition:"background .12s"}}>
              <div style={{width:17,height:17,borderRadius:4,border:`2px solid ${selected[i]?T.accent:T.border}`,background:selected[i]?T.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {selected[i]&&<span style={{color:"white",fontSize:10,fontWeight:900}}>✓</span>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:700,color:T.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.ket||"—"}</div>
                <div style={{fontSize:9,color:T.muted,marginTop:1}}>{r.tgl} · {katName(kat[i]||r.katId)}</div>
              </div>
              <div style={{fontSize:12,fontWeight:800,color:r.tipe==="pemasukan"?T.ok:T.err,flexShrink:0}}>
                {r.tipe==="pemasukan"?"+":"-"}{IDRf(r.jml)}
              </div>
            </div>
          ))}
        </div>
        <div style={{fontSize:10,color:T.muted,textAlign:"center",marginBottom:12}}>
          {selectedCount} dari {parsed.length} transaksi dipilih · Kategori otomatis, bisa diedit setelah import
        </div>
        <div style={{display:"flex",gap:7}}>
          <button onClick={()=>{setStep(0);setParsed([]);}} style={{flex:1,padding:"10px",borderRadius:11,border:`2px solid ${T.border}`,background:T.card,color:T.sub,fontWeight:700,cursor:"pointer",fontSize:12}}>← Ulang</button>
          <button onClick={handleImport} disabled={!selectedCount} style={{flex:2,padding:"10px",borderRadius:11,border:"none",background:selectedCount?"linear-gradient(135deg,#5B21B6,#7C3AED)":"#E9D5FF",color:selectedCount?"white":"#94A3B8",fontWeight:800,cursor:selectedCount?"pointer":"default",fontSize:13}}>
            📥 Import {selectedCount} Transaksi
          </button>
        </div>
      </>}
    </div>
  );
}


// ═════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═════════════════════════════════════════════════════════════════════════════
export default function App(){
  const [s,setS]=useState(()=>{
    try{
      const saved=localStorage.getItem("aturduitku_data");
      if(saved){const p=JSON.parse(saved);return{...INIT,...p,dompet:p.dompet||INIT.dompet,txs:p.txs||[],utang:p.utang||[],budgets:p.budgets||INIT_BUDGETS,goals:p.goals||[],asetTetap:p.asetTetap||[],recurring:p.recurring||[],amplop:p.amplop||[],habits:p.habits||[],processedRecurring:p.processedRecurring||{}};}
    }catch(e){}
    return INIT;
  });
  const [onboarded,setOnboarded]=useState(()=>{try{return localStorage.getItem("aturduitku_onboarded")==="1";}catch(e){return false;}});
  const [fireUser,setFireUser]=useState(null);
  const [fireLoading,setFireLoading]=useState(true);
  const [accessProfile,setAccessProfile]=useState(null);
  const [accessLoading,setAccessLoading]=useState(true);
  const [authMode,setAuthMode]=useState("signin");
  const [authBusy,setAuthBusy]=useState(false);
  const [authError,setAuthError]=useState("");
  const [authForm,setAuthForm]=useState({name:"",email:"",password:""});
  const [adminUsers,setAdminUsers]=useState([]);
  const [adminStats,setAdminStats]=useState({total:0,pending_review:0,approved:0,rejected:0,payment:{pending_info:0,checking:0,paid:0,problem:0}});
  const [adminLoading,setAdminLoading]=useState(false);
  const [adminFilter,setAdminFilter]=useState("all");
  const [adminPaymentFilter,setAdminPaymentFilter]=useState("all");
  const [adminReviewFilter,setAdminReviewFilter]=useState("all");
  const [adminQuery,setAdminQuery]=useState("");
  const [adminPage,setAdminPage]=useState(1);
  const [adminNotes,setAdminNotes]=useState({});
  const [adminBuyerEmail,setAdminBuyerEmail]=useState({});
  const [adminOrderId,setAdminOrderId]=useState({});
  const [adminPaymentStatus,setAdminPaymentStatus]=useState({});
  const [syncStatus,setSyncStatus]=useState("idle"); // idle | saving | saved | error
  const [lang,setLang]=useState(()=>{try{return localStorage.getItem("aturduitku_lang")||"id";}catch(e){return "id";}});
  const t = (key) => TR[lang]?.[key] ?? TR["id"]?.[key] ?? key;
  const changeLang = (l) => { setLang(l); try{localStorage.setItem("aturduitku_lang",l);}catch(e){} };
  // Locale-aware months
  const MONTHS_L = getMonths(lang);
  const MSHORT_L = getMShort(lang);
  const [dark,setDark]=useState(()=>{try{return localStorage.getItem("aturduitku_dark")==="1";}catch(e){return false;}});
  const [blurSaldo,setBlurSaldo]=useState(()=>{try{return localStorage.getItem("aturduitku_blur")==="1";}catch(e){return false;}});
  const [simpleMode,setSimpleMode]=useState(()=>{try{return localStorage.getItem("aturduitku_simple_mode")==="1";}catch(e){return false;}});
  const [tourDismissed,setTourDismissed]=useState(()=>{try{return localStorage.getItem("aturduitku_tour_done")==="1";}catch(e){return false;}});

  const [page,setPage]=useState("home");
  const [toast,setToast]=useState("");
  const [modal,setModal]=useState(null);
  const [commandOpen,setCommandOpen]=useState(false);
  const [commandQuery,setCommandQuery]=useState("");
  const [showCalc,setShowCalc]=useState(false);
  const [calcFor,setCalcFor]=useState(null);
  const [notifOpen,setNotifOpen]=useState(false);
  const [moreOpen,setMoreOpen]=useState(false);
  const [quickOpen,setQuickOpen]=useState(false);
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [installPrompt,setInstallPrompt]=useState(null);
  const [installDismissed,setInstallDismissed]=useState(()=>{try{return localStorage.getItem("aturduitku_install_dismissed")==="1";}catch(e){return false;}});
  const [now,setNow]=useState(new Date());
  const [tz,setTz]=useState({city:"",offset:""});
  const [editSaldo,setEditSaldo]=useState({});
  const [inAppAlerts,setInAppAlerts]=useState([]);
  const [isOnline,setIsOnline]=useState(()=>typeof navigator==="undefined"?true:navigator.onLine);

  const T=dark?DARK:LIGHT;
  const isApproved=accessProfile?.approvalStatus==="approved";
  const isAdmin=accessProfile?.role==="admin";
  const navItems=useMemo(()=>{
    const base=isAdmin?[...NAV,ADMIN_NAV]:NAV;
    return simpleMode?base.filter(n=>["home","trans","budget","laporan","setting","admin"].includes(n.id)):base;
  },[isAdmin,simpleMode]);
  const YEAR_OPTIONS = Array.from({ length: 20 }, (_, i) => String(2020 + i));
  const toggleBlur=()=>{setBlurSaldo(v=>{try{localStorage.setItem("aturduitku_blur",!v?"1":"0");}catch(e){}return !v;});};
  const MV=({v,style,className})=>blurSaldo?<span className={className} style={{filter:"blur(7px)",userSelect:"none",transition:"filter .25s",...style}}>{v}</span>:<span className={className} style={style}>{v}</span>;

  // Viewport
  useEffect(()=>{
    let meta=document.querySelector("meta[name=\"viewport\"]");
    if(!meta){meta=document.createElement("meta");meta.name="viewport";document.head.appendChild(meta);}
    meta.content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no";
    document.title="AturDuitku";
  },[]);

  useEffect(()=>{
    const onBeforeInstall=(e)=>{e.preventDefault();setInstallPrompt(e);};
    const onInstalled=()=>{setInstallPrompt(null);try{localStorage.setItem("aturduitku_install_dismissed","1");}catch(e){}setInstallDismissed(true);showToast("AturDuitku siap dibuka dari Home Screen");};
    window.addEventListener("beforeinstallprompt",onBeforeInstall);
    window.addEventListener("appinstalled",onInstalled);
    return()=>{window.removeEventListener("beforeinstallprompt",onBeforeInstall);window.removeEventListener("appinstalled",onInstalled);};
  },[]);

  useEffect(()=>{
    const update=()=>setIsOnline(navigator.onLine);
    window.addEventListener("online",update);
    window.addEventListener("offline",update);
    return()=>{window.removeEventListener("online",update);window.removeEventListener("offline",update);};
  },[]);

  useEffect(()=>{
    const onKey=(e)=>{
      if((e.ctrlKey||e.metaKey)&&String(e.key).toLowerCase()==="k"){e.preventDefault();setCommandOpen(v=>!v);}
      if(e.key==="Escape"){setCommandOpen(false);}
    };
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[]);

  useEffect(()=>{
    if(isApproved&&!tourDismissed&&!modal){
      setModal({type:"tour"});
    }
  },[isApproved,tourDismissed,modal]);

  const authedJson = async (url, options={}) => {
    const token = await getCurrentIdToken();
    const { timeoutMs, ...fetchOptions } = options;
    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(), timeoutMs || 12000);
    const resp = await fetch(url, {
      ...fetchOptions,
      signal:controller.signal,
      headers: {
        "Content-Type":"application/json",
        Authorization:`Bearer ${token}`,
        ...(fetchOptions.headers||{}),
      },
    }).finally(()=>clearTimeout(timeout));
    const data = await resp.json().catch(()=>({}));
    if(!resp.ok){
      const error = new Error(data.error || `Request failed: ${resp.status}`);
      error.status = resp.status;
      throw error;
    }
    return data;
  };

  const loadAccessProfile = async () => {
    const data = await authedJson("/api/users/me", { method:"GET" });
    setAccessProfile(data.profile || null);
    return data.profile || null;
  };

  const loadCloudData = async (uid) => {
    try{
      return await authedJson("/api/users/data", { method:"GET" });
    }catch(e){
      console.warn("Server data sync load failed, falling back to client Firestore:", e);
      return uid ? await getUserData(uid) : null;
    }
  };

  const saveCloudData = async (uid, payload) => {
    try{
      return await authedJson("/api/users/data", { method:"POST", body:JSON.stringify(payload) });
    }catch(e){
      console.warn("Server data sync save failed, falling back to client Firestore:", e);
      return uid ? await saveUserData(uid, payload) : null;
    }
  };

  const loadAdminUsers = async () => {
    if(!isAdmin) return;
    setAdminLoading(true);
    try{
      const data = await authedJson("/api/admin/users", { method:"GET" });
      setAdminUsers(data.users || []);
      setAdminStats(data.stats || {total:0,pending_review:0,approved:0,rejected:0,payment:{pending_info:0,checking:0,paid:0,problem:0}});
      setAdminNotes(Object.fromEntries((data.users||[]).map(u=>[u.uid, u.adminNotes || ""])));
      setAdminBuyerEmail(Object.fromEntries((data.users||[]).map(u=>[u.uid, u.buyerEmail || u.email || ""])));
      setAdminOrderId(Object.fromEntries((data.users||[]).map(u=>[u.uid, u.orderId || ""])));
      setAdminPaymentStatus(Object.fromEntries((data.users||[]).map(u=>[u.uid, u.paymentStatus || "pending_info"])));
    }catch(e){
      showToast(`⚠️ ${e.message || "Gagal memuat user admin"}`);
    }finally{
      setAdminLoading(false);
    }
  };

  const updateAdminApproval = async (uid, approvalStatus) => {
    setAdminLoading(true);
    try{
      const data = await authedJson("/api/admin/users", {
        method:"POST",
        body:JSON.stringify({
          uid,
          approvalStatus,
          adminNotes: adminNotes[uid] || "",
          buyerEmail: adminBuyerEmail[uid] || "",
          orderId: adminOrderId[uid] || "",
          paymentStatus: adminPaymentStatus[uid] || "pending_info",
        }),
      });
      setAdminUsers(prev=>prev.map(user=>user.uid===uid?{...user,...data.user}:user));
      showToast(approvalStatus==="approved"?"✅ User di-approve":"✅ Status user diperbarui");
      await loadAdminUsers();
    }catch(e){
      showToast(`⚠️ ${e.message || "Gagal update user"}`);
    }finally{
      setAdminLoading(false);
    }
  };


  // Auto-save (hanya saat s berubah, bukan setiap render/clock tick)
  // Autosave: localStorage + Firestore
  useEffect(()=>{
    try{localStorage.setItem("aturduitku_data",JSON.stringify(s));}catch(e){}
    if(fireUser && isApproved){
      setSyncStatus("saving");
      const timer = setTimeout(async()=>{
        try{
          await saveCloudData(fireUser.uid, {data:s, onboarded:true});
          try{localStorage.setItem(LOCAL_OWNER_KEY, fireUser.uid);}catch(e){}
          setSyncStatus("saved");
          setTimeout(()=>setSyncStatus("idle"),2000);
        }catch(e){
          setSyncStatus("error");
        }
      }, 1500); // debounce 1.5s
      return ()=>clearTimeout(timer);
    }
    setSyncStatus("idle");
  },[s, fireUser, isApproved]);

  // Firebase Auth listener
  useEffect(()=>{
    let disposed=false;
    let unsub=()=>{};
    const startAuth=async()=>{
      try{
        await afterFirstPaint();
        if(disposed) return;
        unsub = await onAuthChange(async(user)=>{
          if(disposed) return;
          setFireLoading(true);
          setFireUser(user);
          setAccessProfile(null);
          setAccessLoading(Boolean(user));
          if(user){
            try{
              const [profile, cloudData] = await Promise.all([
                loadAccessProfile(),
                loadCloudData(user.uid).catch(e=>{console.warn("Cloud data preload failed:",e);return null;}),
              ]);
              if(disposed) return;
              const approved = profile?.approvalStatus==="approved";
              if(approved){
                if(!applyLoadedUserData(user, cloudData)){
                  const localRaw = localStorage.getItem("aturduitku_data");
                  const localOwner = localStorage.getItem(LOCAL_OWNER_KEY);
                  const localOnboarded = localStorage.getItem("aturduitku_onboarded")==="1";
                  if(localRaw && localOwner===user.uid){
                    try{await saveCloudData(user.uid,{data:JSON.parse(localRaw),onboarded:localOnboarded});}catch(e){}
                    if(disposed) return;
                    setOnboarded(localOnboarded);
                  } else {
                    setOnboarded(false);
                  }
                }
              } else {
                setOnboarded(false);
              }
            }catch(e){
              console.warn("Load from Firebase failed:",e);
              if(disposed) return;
              setAccessProfile({
                uid:user.uid,
                email:user.email||"",
                displayName:user.displayName||"",
                photoURL:user.photoURL||"",
                role:"user",
                approvalStatus:"approved",
                backendReady:false,
              });
              try{
                const cloudData = await loadCloudData(user.uid);
                if(!disposed) applyLoadedUserData(user, cloudData);
              }catch(err){}
            }
          } else {
            setAccessLoading(false);
          }
          if(disposed) return;
          setAccessLoading(false);
          setFireLoading(false);
        });
      }catch(e){
        console.warn("Firebase auth init failed:",e);
        if(disposed) return;
        setFireUser(null);
        setAccessProfile(null);
        setAccessLoading(false);
        setFireLoading(false);
      }
    };
    startAuth();
    return ()=>{disposed=true;unsub();};
  },[]);

  // Handle sign in with Google - auto setup Sheets
  const handleGoogleSignIn = async() => {
    try{
      await signInWithGoogle();
    }catch(e){
      console.warn("Google sign in failed:", e);
      showToast("⚠️ Login gagal. Coba lagi!");
    }
  };

  const handleEmailAuth = async() => {
    if(authBusy) return;
    const email = authForm.email.trim();
    const password = authForm.password;
    const name = authForm.name.trim();
    if(!email || !password || (authMode==="signup" && !name)){
      setAuthError(authMode==="signup" ? "Lengkapi nama, email, dan password dulu." : "Lengkapi email dan password dulu.");
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    try{
      if(authMode==="signup"){
        await signUpWithEmail(name, email, password);
      } else {
        await signInWithEmail(email, password);
      }
    }catch(e){
      const msg = authErrorMessage(e);
      setAuthError(msg);
      showToast(`⚠️ ${msg}`);
    }finally{
      setAuthBusy(false);
    }
  };

  // Handle sign out
  const handleSignOut = async() => {
    await signOutUser();
    setFireUser(null);
    setAccessProfile(null);
    setFireLoading(false);
    setAccessLoading(false);
  };
  const confirmSignOut = () => {
    setModal({
      type:"confirm",
      title:"Keluar dari akun?",
      msg:"Kamu akan keluar dari AturDuitku di perangkat ini. Data tetap aman tersimpan di akunmu.",
      danger:true,
      onConfirm:async()=>{
        setModal(null);
        await handleSignOut();
      }
    });
  };

  useEffect(()=>{
    if(isAdmin) loadAdminUsers();
  },[isAdmin]);

  const adminFilteredUsers = useMemo(()=>{
    const filtered = adminUsers.filter((user)=>{
      const matchFilter = adminFilter==="all" || (user.approvalStatus || "pending_review")===adminFilter;
      const matchPaymentFilter = adminPaymentFilter==="all" || (user.paymentStatus || "pending_info")===adminPaymentFilter;
      const todayKey = today();
      const reviewedKey = String(user.reviewedAt || "").slice(0,10);
      const matchReviewFilter = adminReviewFilter==="all"
        || (adminReviewFilter==="today" && reviewedKey===todayKey)
        || (adminReviewFilter==="unreviewed" && !user.reviewedAt);
      const q = adminQuery.trim().toLowerCase();
      const hay = `${user.displayName||""} ${user.email||""} ${user.buyerEmail||""} ${user.orderId||""}`.toLowerCase();
      return matchFilter && matchPaymentFilter && matchReviewFilter && (!q || hay.includes(q));
    });
    const approvalRank = { pending_review:0, approved:1, rejected:2 };
    const paymentRank = { checking:0, pending_info:1, problem:2, paid:3 };
    return filtered.sort((a,b)=>{
      const approvalDelta = (approvalRank[a.approvalStatus || "pending_review"] ?? 9) - (approvalRank[b.approvalStatus || "pending_review"] ?? 9);
      if(approvalDelta!==0) return approvalDelta;
      const paymentDelta = (paymentRank[a.paymentStatus || "pending_info"] ?? 9) - (paymentRank[b.paymentStatus || "pending_info"] ?? 9);
      if(paymentDelta!==0) return paymentDelta;
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });
  },[adminUsers, adminFilter, adminPaymentFilter, adminReviewFilter, adminQuery]);

  const paymentStatusLabel = (status) => ({
    pending_info:"Belum kirim referensi",
    checking:"Perlu dicek",
    paid:"Sudah cocok",
    problem:"Bermasalah",
  }[status || "pending_info"] || status || "Belum kirim referensi");

  const ADMIN_PAGE_SIZE = 8;
  const adminPageCount = Math.max(1, Math.ceil(adminFilteredUsers.length / ADMIN_PAGE_SIZE));
  const adminPagedUsers = useMemo(()=>{
    const start = (adminPage - 1) * ADMIN_PAGE_SIZE;
    return adminFilteredUsers.slice(start, start + ADMIN_PAGE_SIZE);
  },[adminFilteredUsers, adminPage]);
  const adminReadyToApprove=useMemo(()=>adminUsers.filter(u=>(u.approvalStatus||"pending_review")==="pending_review"&&(u.paymentStatus||"pending_info")==="paid"),[adminUsers]);
  const adminNeedPaymentCheck=useMemo(()=>adminUsers.filter(u=>(u.approvalStatus||"pending_review")==="pending_review"&&["checking","pending_info"].includes(u.paymentStatus||"pending_info")),[adminUsers]);

  useEffect(()=>{
    setAdminPage(1);
  },[adminFilter, adminPaymentFilter, adminReviewFilter, adminQuery]);

  useEffect(()=>{
    if(adminPage > adminPageCount) setAdminPage(adminPageCount);
  },[adminPage, adminPageCount]);

  const copyAdminField = async (label, value) => {
    if(!value){
      showToast(`⚠️ ${label} kosong`);
      return;
    }
    try{
      await navigator.clipboard.writeText(String(value));
      showToast(`✅ ${label} disalin`);
    }catch(e){
      showToast(`⚠️ Gagal copy ${label.toLowerCase()}`);
    }
  };

  const copyAdminWhatsappMessage = async (user, mode="approved") => {
    const name=user.displayName || "Kak";
    const email=user.email || "";
    const orderId=adminOrderId[user.uid] || user.orderId || "";
    const message = mode==="approved"
      ? `Halo ${name}, akun AturDuitku kamu sudah aktif.\n\nEmail akun: ${email}\n${orderId?`Order ID: ${orderId}\n`:""}Silakan login kembali dan tekan "Cek status lagi" kalau masih muncul halaman approval.\n\nJika ada kendala, hubungi admin AturDuitku.`
      : `Halo ${name}, admin AturDuitku sedang cek pembayaran kamu.\n\nEmail akun: ${email}\n${orderId?`Order ID: ${orderId}\n`:""}Mohon pastikan email pembeli dan Order ID Scalev sudah benar supaya approval lebih cepat.`;
    await copyAdminField(mode==="approved"?"Pesan WhatsApp aktif":"Pesan WhatsApp follow up", message);
  };


  useEffect(()=>{try{localStorage.setItem("aturduitku_dark",dark?"1":"0");}catch(e){}},[ dark]);

  // ── SMART NOTIFICATIONS ────────────────────────────────────────────────────
  useEffect(()=>{
    const runChecks = async () => {
      const alerts = [];
      const todayStr = today();
      const todayD = new Date(todayStr);
      // 1. Tagihan jatuh tempo dalam 3 hari
      s.utang.filter(u=>u.tempo&&u.status!=="lunas").forEach(u=>{
        const diff = Math.ceil((new Date(u.tempo)-todayD)/(1000*60*60*24));
        if(diff>=0&&diff<=3) alerts.push({type:"warn",title:`⏰ ${lang==="en"?"Due: ":"Jatuh Tempo: "}${u.nama}`,body:`${u.tipe==="utang"?"Hutang":"Piutang"} ${IDR(N(u.jml))} jatuh tempo ${diff===0?"HARI INI":"dalam "+diff+" hari"} (${u.tempo})`});
      });
      // 2. Budget hampir habis (>85%)
      const spendKatLocal={};
      txBulan.filter(t=>t.tipe==="pengeluaran").forEach(t=>{spendKatLocal[t.katId]=(spendKatLocal[t.katId]||0)+N(t.jml);});
      s.budgets.forEach(b=>{
        const alloc=N(b.alokasi)+b.sub.reduce((x,y)=>x+N(y.alokasi),0);
        const spend=spendKatLocal[b.id]||0;
        const pct=alloc>0?spend/alloc*100:0;
        if(alloc>0&&pct>=85&&pct<100) alerts.push({type:"warn",title:`📊 Budget ${b.kat} ${lang==="en"?"Almost Over":"Hampir Habis"}`,body:`${lang==="en"?"Used ":"Sudah terpakai "} ${pct.toFixed(0)}% (${IDR(spend)} dari ${IDR(alloc)})`});
        if(alloc>0&&pct>=100) alerts.push({type:"danger",title:`🚨 Budget ${b.kat} ${lang==="en"?"Over Budget!":"Melebihi Batas!"}`,body:`Kelebihan ${IDR(spend-alloc)} — sudah ${pct.toFixed(0)}% dari alokasi`});
      });
      // 3. Belum ada transaksi hari ini (cek jam > 20:00)
      const nowH = new Date().getHours();
      const todayTx = s.txs.filter(t=>t.tgl===todayStr);
      if(nowH>=20&&todayTx.length===0) alerts.push({type:"info",title:t("noTxToday"),body:t("noTxTodayBody")||"Ayo catat pengeluaran kamu hari ini ya!"});
      // 4. Recurring belum diproses bulan ini
      const mk=`${s.bulan}_${s.tahun}`;
      const unproc=s.recurring.filter(r=>r.aktif&&!Object.keys(s.processedRecurring).some(k=>k.startsWith(r.id+"_"+mk)));
      if(unproc.length>0) alerts.push({type:"info",title:`🔁 ${unproc.length} ${lang==="en"?"Recurring Transactions Not Processed":"Transaksi Rutin Belum Diproses"}`,body:`Klik "Proses Sekarang" di menu Setting → Transaksi Rutin`});

      setInAppAlerts(alerts);

      // Browser notification (jika diizinkan)
      if(alerts.length>0&&"Notification" in window&&Notification.permission==="granted"){
        const urgent=alerts.filter(a=>a.type==="danger"||a.type==="warn");
        if(urgent.length>0){
          const a=urgent[0];
          try{new Notification(a.title,{body:a.body,icon:"/icon-192.png"});}catch(e){}
        }
      }
    };
    runChecks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[s.utang, s.budgets, s.txs, s.recurring, s.processedRecurring]);

  const requestNotifPermission=async()=>{
    if(!("Notification" in window)){showToast("❌ Browser tidak mendukung notifikasi");return;}
    const perm=await Notification.requestPermission();
    if(perm==="granted") showToast("✅ Notifikasi diaktifkan!");
    else showToast("⚠️ Izin notifikasi ditolak");
  };



  // Clock + tz
  useEffect(()=>{
    try{const tzName=Intl.DateTimeFormat().resolvedOptions().timeZone;const city=tzName.split("/").pop().replace(/_/g," ");const off=new Date().getTimezoneOffset();const h=Math.floor(Math.abs(off)/60),m=Math.abs(off)%60;const sign=off<=0?"+":"-";setTz({city,offset:`UTC${sign}${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`});}catch(e){}
    const tick=setInterval(()=>setNow(new Date()),1000);
    return()=>clearInterval(tick);
  },[]);

  // Responsive
  const [vw,setVw]=useState(typeof window!=="undefined"?window.innerWidth:1200);
  useEffect(()=>{
    let raf=0;
    const updateViewport=()=>{
      cancelAnimationFrame(raf);
      raf=requestAnimationFrame(()=>{
        setVw(window.innerWidth);
        const vv = window.visualViewport;
        const h = vv?.height || window.innerHeight;
        const top = vv?.offsetTop || 0;
        const keyboardBottom = Math.max(0, window.innerHeight - h - top);
        document.documentElement.style.setProperty("--app-height", `${h}px`);
        document.documentElement.style.setProperty("--visual-top", `${top}px`);
        document.documentElement.style.setProperty("--keyboard-bottom", `${keyboardBottom}px`);
      });
    };
    updateViewport();
    window.addEventListener("resize",updateViewport);
    window.visualViewport?.addEventListener("resize",updateViewport);
    window.visualViewport?.addEventListener("scroll",updateViewport);
    return()=>{
      window.removeEventListener("resize",updateViewport);
      window.visualViewport?.removeEventListener("resize",updateViewport);
      window.visualViewport?.removeEventListener("scroll",updateViewport);
      cancelAnimationFrame(raf);
    };
  },[]);
  const isMobile=vw<900;const isTablet=vw>=900&&vw<1180;const isReportCompact=isMobile||isTablet;
  const navTo=id=>{
    const run=()=>{
      setPage(id);
      setQuickOpen(false);
      if(isMobile) setSidebarOpen(false);
    };
    if(React.startTransition) React.startTransition(run);
    else run();
  };

  // Forms
  const [txForm,setTxForm]=useState({tipe:"pengeluaran",tgl:today(),ket:"",jml:"",katId:1,subKat:"",dompetId:1,dompetTo:2,biaya:"",goalId:""});
  const [bulkRows,setBulkRows]=useState([{tgl:today(),jml:"",tipe:"pengeluaran",dompetId:1,katId:"",ket:""}]);
  const [utForm,setUtForm]=useState({tipe:"utang",tgl:today(),provider:"",nama:"",jml:"",tempo:"",ket:""});
  const [goalForm,setGoalForm]=useState({nama:"",target:"",kumpul:"",deadline:"",icon:"⭐"});
  const [dompetForm,setDompetForm]=useState({tipe:"Bank",nama:"",norek:"",saldo:""});
  const [asetForm,setAsetForm]=useState({nama:"",nilai:"",ket:"",beliDariDompet:false,dompetId:1});
  const [sfForm,setSfForm]=useState({name:s.name,targetDana:s.targetDana,prevPemasukan:s.prevPemasukan,prevPengeluaran:s.prevPengeluaran});
  const [txSearch,setTxSearch]=useState("");
  const [txFilt,setTxFilt]=useState({dompet:"",tipe:"",sub:""});
  const [txPage,setTxPage]=useState(1);
  const TX_PER_PAGE=30;
  const [recurringForm,setRecurringForm]=useState({nama:"",tipe:"pengeluaran",jml:"",katId:1,dompetId:1,hari:"1",aktif:true});
  const [amplopForm,setAmplopForm]=useState({nama:"",icon:"✉️",warna:"#8B5CF6",dompetId:1,alokasi:""});
  const [showAddRecurring,setShowAddRecurring]=useState(false);
  const [showAddAmplop,setShowAddAmplop]=useState(false);
  const [amplopIsiForm,setAmplopIsiForm]=useState({id:null,jml:"",dompetId:1});
  const [newKat,setNewKat]=useState({kat:"",icon:"📦",kelas:"Kebutuhan"});
  const [showAddKat,setShowAddKat]=useState(false);
  const [newSub,setNewSub]=useState({katId:null,nama:"",emoji:"📌",alokasi:"",tempo:""});
  const [habitForm,setHabitForm]=useState({nama:"Catat pengeluaran",icon:"🧾",target:"1x per hari"});
  const [habitCelebrate,setHabitCelebrate]=useState(false);


  // ── Computed ────────────────────────────────────────────────────────────────
  const bulanIdx=MONTHS.indexOf(s.bulan);const yr=Number(s.tahun);
  const txBulan=useMemo(()=>s.txs.filter(t=>t.tgl&&t.tgl.startsWith(`${yr}-${String(bulanIdx+1).padStart(2,"0")}`)),[s.txs,yr,bulanIdx]);
  const totalIn=useMemo(()=>txBulan.filter(t=>t.tipe==="pemasukan").reduce((a,b)=>a+N(b.jml),0),[txBulan]);
  const totalOut=useMemo(()=>txBulan.filter(t=>t.tipe==="pengeluaran").reduce((a,b)=>a+N(b.jml),0),[txBulan]);
  const totalTabung=useMemo(()=>txBulan.filter(t=>t.tipe==="tabungan").reduce((a,b)=>a+N(b.jml),0),[txBulan]);
  const netCash=totalIn-totalOut;
  const totalSaldo=s.dompet.reduce((a,b)=>a+N(b.saldo),0);
  const savRate=totalIn>0?(totalTabung/totalIn*100):0;
  const rasioOut=totalIn>0?(totalOut/totalIn*100):0;
  const totalAset=totalSaldo+s.asetTetap.reduce((a,b)=>a+N(b.nilai),0);
  const totalUtangAktif=s.utang.filter(u=>u.tipe==="utang"&&!u.lunas).reduce((a,b)=>a+N(b.jml),0);
  const totalPiutang=s.utang.filter(u=>(u.tipe==="piutang"||u.tipe==="piutangBisnis")&&!u.lunas).reduce((a,b)=>a+N(b.jml),0);
  const runwayReal=totalOut>0?(totalSaldo/totalOut).toFixed(1):0;
  const hariIni=new Date().getDate();const hariDlmBulan=new Date(yr,bulanIdx+1,0).getDate();const sisaHari=hariDlmBulan-hariIni;
  const totalBudget=s.budgets.reduce((a,b)=>a+N(b.alokasi)+b.sub.reduce((x,y)=>x+N(y.alokasi),0),0);
  const sisaAnggaran=totalBudget-totalOut;const budgetHarian=sisaHari>0?Math.max(sisaAnggaran,0)/sisaHari:0;

  const spendByKat=useMemo(()=>{const m={};txBulan.filter(t=>t.tipe==="pengeluaran"&&t.katId).forEach(t=>{m[t.katId]=(m[t.katId]||0)+N(t.jml);});return m;},[txBulan]);

  const trendData=useMemo(()=>{
    const months=[];
    for(let i=5;i>=0;i--){
      const d=new Date(yr,bulanIdx-i,1);
      const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      const label=MSHORT[d.getMonth()];
      const masuk=s.txs.filter(t=>t.tipe==="pemasukan"&&t.tgl?.startsWith(key)).reduce((a,b)=>a+N(b.jml),0);
      const keluar=s.txs.filter(t=>t.tipe==="pengeluaran"&&t.tgl?.startsWith(key)).reduce((a,b)=>a+N(b.jml),0);
      const tabung=s.txs.filter(t=>t.tipe==="tabungan"&&t.tgl?.startsWith(key)).reduce((a,b)=>a+N(b.jml),0);
      months.push({label,masuk,keluar,tabung,net:masuk-keluar});
    }
    return months;
  },[s.txs,yr,bulanIdx]);

  const tagihan=useMemo(()=>{const list=[];s.budgets.forEach(b=>b.sub.forEach(sb=>{if(sb.tempo){list.push({...sb,kat:b.kat});}}));return list.sort((a,b)=>Number(a.tempo)-Number(b.tempo));},[s.budgets]);
  const billCalendar=useMemo(()=>{
    const base=today();
    const toKey=dt=>dateKey(dt);
    const diffDays=key=>Math.ceil((new Date(`${key}T00:00:00`)-new Date(`${base}T00:00:00`))/(1000*60*60*24));
    const currentDueKey=day=>{
      const n=Number(day);
      if(!n) return "";
      let dt=new Date(yr,bulanIdx,n);
      let key=toKey(dt);
      if(key<base){dt=new Date(yr,bulanIdx+1,n);key=toKey(dt);}
      return key;
    };
    const items=[];
    s.utang.filter(u=>!u.lunas&&u.tempo).forEach(u=>{
      const sisa=Math.max(N(u.jml)-(u.cicilan||[]).reduce((a,c)=>a+N(c.jml),0),0);
      const provider=u.provider||detectDebtProvider(u.nama);
      items.push({id:`debt-${u.id}`,date:u.tempo,title:u.nama,type:provider||"Utang",amount:sisa,icon:provider?"🧾":"📌",tone:"debt",days:diffDays(u.tempo)});
    });
    tagihan.forEach((sb,i)=>{
      const key=currentDueKey(sb.tempo);
      if(key) items.push({id:`budget-${i}-${sb.nama}`,date:key,title:sb.nama,type:sb.kat||"Tagihan",amount:N(sb.alokasi),icon:sb.emoji||"🔔",tone:"bill",days:diffDays(key)});
    });
    (s.recurring||[]).filter(r=>r.aktif).forEach(r=>{
      const key=currentDueKey(r.hari);
      if(key) items.push({id:`rec-${r.id}`,date:key,title:r.nama,type:r.tipe==="pemasukan"?"Pemasukan rutin":r.tipe==="tabungan"?"Tabungan rutin":"Transaksi rutin",amount:N(r.jml),icon:r.tipe==="pemasukan"?"📈":r.tipe==="tabungan"?"🏦":"🔁",tone:r.tipe==="pemasukan"?"income":"bill",days:diffDays(key)});
    });
    return items.sort((a,b)=>a.date.localeCompare(b.date)).slice(0,12);
  },[s.utang,tagihan,s.recurring,yr,bulanIdx]);
  const paylaterHealth=useMemo(()=>{
    const tracked=["Shopee PayLater","SPayLater","Kredivo","Akulaku","GoPayLater","Traveloka PayLater","LazPayLater","Home Credit","Kartu Kredit"];
    const list=s.utang.filter(u=>u.tipe==="utang"&&!u.lunas).map(u=>{
      const provider=u.provider||detectDebtProvider(u.nama);
      const paid=(u.cicilan||[]).reduce((a,c)=>a+N(c.jml),0);
      return {...u,provider,sisa:Math.max(N(u.jml)-paid,0),days:u.tempo?Math.ceil((new Date(`${u.tempo}T00:00:00`)-new Date(`${today()}T00:00:00`))/(1000*60*60*24)):null};
    }).filter(u=>tracked.includes(u.provider)||/paylater|spaylater|kredivo|akulaku|home credit|kartu kredit/i.test(`${u.nama} ${u.provider}`));
    const total=list.reduce((a,u)=>a+u.sisa,0);
    const dueSoon=list.filter(u=>u.days!==null&&u.days>=0&&u.days<=7).length;
    const overdue=list.filter(u=>u.days!==null&&u.days<0).length;
    const nearest=[...list].filter(u=>u.tempo).sort((a,b)=>a.tempo.localeCompare(b.tempo))[0]||null;
    const ratio=totalIn>0?total/totalIn*100:(total>0?100:0);
    const score=Math.max(0,Math.round(100-(ratio>60?38:ratio>40?28:ratio>20?15:ratio>0?6:0)-overdue*18-dueSoon*8-(list.length>3?10:0)));
    const label=score>=80?"Sehat":score>=60?"Terkendali":score>=40?"Perlu dijaga":"Berisiko";
    return {list,total,dueSoon,overdue,nearest,ratio,score,label};
  },[s.utang,totalIn]);
  const topKat=useMemo(()=>{const m={};txBulan.filter(t=>t.tipe==="pengeluaran").forEach(t=>{const b=s.budgets.find(b=>b.id===Number(t.katId));const nm=b?.kat||(lang==="en"?"Other":"Lainnya");m[nm]=(m[nm]||0)+N(t.jml);});return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,5);},[txBulan,s.budgets,lang]);

  const skorTabungan=Math.min(savRate/20*100,100);
  const skorDisiplin=totalBudget>0?Math.max(0,100-Math.max(0,(totalOut-totalBudget)/totalBudget*100)):totalOut===0?100:80;
  const skorRunway=Math.min(Number(runwayReal)/6*100,100);
  const skorTotal=Math.round((skorTabungan+skorDisiplin+skorRunway)/3);
  const getLabel=sc=>sc>=80?t("excellent"):sc>=60?t("good"):sc>=40?t("fair"):sc>=20?t("poor")+" 💪":t("poor");
  const getC=sc=>sc>=80?"#16A34A":sc>=60?"#22C55E":sc>=40?"#F59E0B":sc>=20?"#EF4444":"#B91C1C";

  const statusC=totalIn===0&&totalOut>0?T.err:rasioOut>80?T.err:rasioOut>60?T.warn:T.ok;
  const status=totalIn===0&&totalOut>0?t("fair")+" 🟡":rasioOut>80?t("poor")+" 🔴":rasioOut>60?t("fair")+" 🟡":t("good")+" 🟢";

  const moneyDoctorInsight=useMemo(()=>{
    const missing=[];
    if(!s.dompet.some(d=>N(d.saldo)>0)) missing.push("isi saldo awal");
    if(!s.txs.length) missing.push("catat transaksi pertama");
    if(!s.budgets.some(b=>N(b.alokasi)>0||(b.sub||[]).some(x=>N(x.alokasi)>0))) missing.push("atur budget dasar");
    if(missing.length){
      return {
        tone:"setup",
        badge:"Setup awal",
        title:"Biar Dokter Keuangan bisa membaca uangmu",
        body:`Lengkapi ${missing.slice(0,2).join(" dan ")} dulu. Setelah itu dashboard, laporan, dan saran AI akan terasa jauh lebih akurat.`,
        action:"Lengkapi sekarang",
        onAction:()=>setModal({type:missing[0]?.includes("saldo")?"dompet":"tx"}),
      };
    }
    if(totalIn===0&&totalOut>0){
      return {tone:"danger",badge:"Perlu data pemasukan",title:"Pengeluaran sudah jalan, pemasukan belum tercatat",body:"Catat pemasukan bulan ini supaya rasio, saving rate, dan prediksi akhir bulan tidak terbaca terlalu buruk.",action:"Catat pemasukan",onAction:()=>setModal({type:"tx",tipe:"pemasukan"})};
    }
    if(skorTotal<45||rasioOut>85){
      return {tone:"danger",badge:"Perlu perhatian",title:"Cashflow bulan ini mulai ketat",body:`Pengeluaran sudah ${PCT(rasioOut)} dari pemasukan. Coba tahan kategori terbesar ${topKat[0]?.[0]||"bulan ini"} dan review budget hari ini.`,action:"Review budget",onAction:()=>setPage("budget")};
    }
    if(savRate<20&&totalIn>0){
      return {tone:"warn",badge:"Peluang naik kelas",title:"Saving rate masih bisa dinaikkan",body:`Saving rate kamu ${PCT(savRate)}. Target sehat minimal 20%, mulai dari sisihkan ${IDRs(Math.max(totalIn*.2-totalTabung,0))} lagi bulan ini.`,action:"Buat goal nabung",onAction:()=>setPage("goals")};
    }
    return {tone:"good",badge:"Aman terkendali",title:"Keuangan bulan ini terlihat rapi",body:`Cashflow ${netCash>=0?"surplus":"defisit kecil"} ${IDRs(Math.abs(netCash))}, runway ${runwayReal} bulan, dan skor kesehatan ${skorTotal}/100. Pertahankan ritme ini.`,action:"Lihat laporan",onAction:()=>setPage("laporan")};
  },[s.dompet,s.txs,s.budgets,totalIn,totalOut,totalTabung,savRate,rasioOut,skorTotal,netCash,runwayReal,topKat]);

  const isCurrentPeriod=bulanIdx===new Date().getMonth()&&yr===new Date().getFullYear();
  const daysPassed=isCurrentPeriod?hariIni:hariDlmBulan;
  const dailyAvg=daysPassed>0?totalOut/daysPassed:0;
  const prediksiOut=isCurrentPeriod?Math.round(dailyAvg*hariDlmBulan):totalOut;
  const prediksiSisa=totalIn-prediksiOut;

  const prevIn=N(s.prevPemasukan),prevOut=N(s.prevPengeluaran);
  const changePct=(cur,prev)=>prev>0?((cur-prev)/prev*100).toFixed(1):null;

  const filtTx=useMemo(()=>{
    setTxPage(1);
    let list=[...s.txs].sort((a,b)=>new Date(b.tgl)-new Date(a.tgl));
    if(txSearch)list=list.filter(t=>t.ket?.toLowerCase().includes(txSearch.toLowerCase()));
    if(txFilt.dompet)list=list.filter(t=>String(t.dompetId)===String(txFilt.dompet));
    if(txFilt.tipe)list=list.filter(t=>t.tipe===txFilt.tipe);
    return list;
  },[s.txs,txSearch,txFilt]); // eslint-disable-line react-hooks/exhaustive-deps

  const pieData=s.budgets.filter(b=>spendByKat[b.id]>0).map(b=>({name:b.icon+" "+b.kat,value:spendByKat[b.id]||0}));

  const habitDay=today();
  const activeHabits=useMemo(()=>s.habits.filter(h=>h.active!==false),[s.habits]);
  const habitDone=(h,day=habitDay)=>new Set(h.doneDates||[]).has(day);
  const habitStreak=(h,day=habitDay)=>{
    const done=new Set(h.doneDates||[]);
    let cursor=done.has(day)?day:dateAdd(day,-1);
    let count=0;
    while(done.has(cursor)){count++;cursor=dateAdd(cursor,-1);}
    return count;
  };

  const mergeUserData=(d={})=>({
    ...INIT,...d,
    dompet:d.dompet||INIT.dompet,txs:d.txs||[],utang:d.utang||[],
    budgets:d.budgets||INIT_BUDGETS,goals:d.goals||[],asetTetap:d.asetTetap||[],
    recurring:d.recurring||[],amplop:d.amplop||[],habits:d.habits||[],processedRecurring:d.processedRecurring||{},
  });

  const applyLoadedUserData=(user, cloudData)=>{
    if(cloudData && cloudData.data){
      const merged=mergeUserData(cloudData.data);
      setS(merged);
      try{
        localStorage.setItem("aturduitku_data",JSON.stringify(merged));
        localStorage.setItem(LOCAL_OWNER_KEY, user.uid);
      }catch(e){}
      setOnboarded(Boolean(cloudData.onboarded));
      try{localStorage.setItem("aturduitku_onboarded",cloudData.onboarded?"1":"0");}catch(e){}
      return true;
    }
    return false;
  };
  const habitBestStreak=(h)=>{
    const days=[...new Set(h.doneDates||[])].sort();
    let best=0,cur=0,prev="";
    days.forEach(d=>{cur=prev&&dateAdd(prev,1)===d?cur+1:1;best=Math.max(best,cur);prev=d;});
    return best;
  };
  const habitDoneToday=activeHabits.filter(h=>habitDone(h)).length;
  const habitTotalToday=activeHabits.length;
  const habitOpenToday=activeHabits.filter(h=>!habitDone(h));
  const habitCompletedToday=activeHabits.filter(h=>habitDone(h));
  const habitTodayPct=habitTotalToday?habitDoneToday/habitTotalToday*100:0;
  const habitTotalDone=s.habits.reduce((a,h)=>a+(h.doneDates?.length||0),0);
  const habitBestAll=s.habits.reduce((a,h)=>Math.max(a,habitBestStreak(h)),0);
  const habitXP=habitTotalDone*15+habitBestAll*10;
  const habitLevel=Math.floor(habitXP/120)+1;
  const habitLevelPct=(habitXP%120)/120*100;
  const habitAnalytics=useMemo(()=>{
    const ref=new Date(`${habitDay}T00:00:00`);
    const year=ref.getFullYear();
    const month=ref.getMonth();
    const pad=n=>String(n).padStart(2,"0");
    const monthPrefix=`${year}-${pad(month+1)}`;
    const daysInMonth=new Date(year,month+1,0).getDate();
    const monthDays=Array.from({length:daysInMonth},(_,i)=>`${monthPrefix}-${pad(i+1)}`);
    const active=activeHabits;
    const doneOn=(h,day)=>new Set(h.doneDates||[]).has(day);
    const daily=monthDays.map(day=>{
      const done=active.filter(h=>doneOn(h,day)).length;
      return {day,date:new Date(`${day}T00:00:00`).getDate(),done,total:active.length,pct:active.length?done/active.length*100:0};
    });
    const habitRows=active.map(h=>{
      const done=monthDays.filter(day=>doneOn(h,day)).length;
      return {...h,monthDone:done,monthPct:daysInMonth?done/daysInMonth*100:0,best:habitBestStreak(h),now:habitStreak(h)};
    }).sort((a,b)=>b.monthPct-a.monthPct);
    const monthDone=daily.reduce((a,d)=>a+d.done,0);
    const monthSlots=active.length*daysInMonth;
    const yearMonths=Array.from({length:12},(_,mi)=>{
      const dim=new Date(year,mi+1,0).getDate();
      const prefix=`${year}-${pad(mi+1)}`;
      const days=Array.from({length:dim},(_,i)=>`${prefix}-${pad(i+1)}`);
      const done=active.reduce((sum,h)=>sum+days.filter(day=>doneOn(h,day)).length,0);
      const slots=active.length*dim;
      return {label:MSHORT[mi],full:MONTHS[mi],done,slots,pct:slots?done/slots*100:0};
    });
    const yearDone=yearMonths.reduce((a,m)=>a+m.done,0);
    const yearSlots=yearMonths.reduce((a,m)=>a+m.slots,0);
    const bestMonth=yearMonths.reduce((best,m)=>m.pct>best.pct?m:best,yearMonths[0]||{pct:0,label:"-"});
    const weekday=Array.from({length:7},(_,wd)=>{
      const days=monthDays.filter(day=>new Date(`${day}T00:00:00`).getDay()===wd);
      const done=days.reduce((sum,day)=>sum+active.filter(h=>doneOn(h,day)).length,0);
      const slots=days.length*active.length;
      return {label:DAYS_SHORT[wd],pct:slots?done/slots*100:0};
    });
    return {year,monthName:MONTHS[month],monthDays,daily,habitRows,monthDone,monthSlots,monthPct:monthSlots?monthDone/monthSlots*100:0,yearMonths,yearDone,yearSlots,yearPct:yearSlots?yearDone/yearSlots*100:0,bestMonth,weekday};
  },[activeHabits,habitDay]);
  const todayTxCount=useMemo(()=>s.txs.filter(tx=>tx.tgl===habitDay).length,[s.txs,habitDay]);
  const perfectDayStreak=useMemo(()=>{
    if(!activeHabits.length) return 0;
    let cursor=habitDay,count=0;
    while(activeHabits.every(h=>habitDone(h,cursor))){count++;cursor=dateAdd(cursor,-1);}
    return count;
  },[activeHabits,habitDay]);
  const weeklyReport=useMemo(()=>{
    const end=today();
    const start=dateAdd(end,-6);
    const weekTx=s.txs.filter(tx=>tx.tgl&&tx.tgl>=start&&tx.tgl<=end);
    const income=weekTx.filter(tx=>tx.tipe==="pemasukan").reduce((a,tx)=>a+N(tx.jml),0);
    const expense=weekTx.filter(tx=>tx.tipe==="pengeluaran").reduce((a,tx)=>a+N(tx.jml),0);
    const saving=weekTx.filter(tx=>tx.tipe==="tabungan").reduce((a,tx)=>a+N(tx.jml),0);
    const byCat={};
    weekTx.filter(tx=>tx.tipe==="pengeluaran").forEach(tx=>{
      const b=s.budgets.find(x=>x.id===Number(tx.katId));
      const name=b?.kat||"Lainnya";
      byCat[name]=(byCat[name]||0)+N(tx.jml);
    });
    const top=Object.entries(byCat).sort((a,b)=>b[1]-a[1])[0];
    const health=income===0&&expense>0?"Perlu catat pemasukan":expense>income?"Minggu ini defisit":saving>0?"Ada progres nabung":"Mulai catat konsisten";
    const advice=top?`Pengeluaran terbesar minggu ini ada di ${top[0]} (${IDRs(top[1])}). Coba pasang batas harian kecil untuk kategori ini.`:weekTx.length?"Minggu ini belum ada pengeluaran besar. Pertahankan ritme catat transaksi.":"Belum ada transaksi minggu ini. Catat 1 transaksi hari ini biar laporan mulai hidup.";
    return {start,end,weekTx,income,expense,saving,top,health,advice};
  },[s.txs,s.budgets]);
  const premiumBadges=useMemo(()=>{
    const txDays=new Set(s.txs.map(tx=>tx.tgl).filter(Boolean));
    const last7=Array.from({length:7},(_,i)=>dateAdd(today(),-i));
    const txStreak=last7.filter(d=>txDays.has(d)).length;
    return [
      {title:"Mulai Rapi",desc:"Sudah punya transaksi pertama",icon:"🧾",done:s.txs.length>0,progress:Math.min(s.txs.length,1),target:1},
      {title:"Konsisten 3 Hari",desc:"Catat transaksi di 3 hari berbeda",icon:"🔥",done:txStreak>=3,progress:Math.min(txStreak,3),target:3},
      {title:"Budget Keeper",desc:"Budget bulan ini tidak lewat batas",icon:"🛡️",done:totalBudget>0&&totalOut<=totalBudget,progress:totalBudget>0?Math.min(totalOut/totalBudget*100,100):0,target:100},
      {title:"Nabung Sehat",desc:"Saving rate minimal 20%",icon:"💎",done:savRate>=20,progress:Math.min(savRate,20),target:20},
      {title:"Habit Hero",desc:"Selesaikan semua habit hari ini",icon:"⭐",done:habitTotalToday>0&&habitDoneToday===habitTotalToday,progress:habitDoneToday,target:Math.max(habitTotalToday,1)},
      {title:"Streak 7",desc:"7 hari perfect habit",icon:"🏆",done:perfectDayStreak>=7,progress:Math.min(perfectDayStreak,7),target:7},
    ];
  },[s.txs,totalBudget,totalOut,savRate,habitTotalToday,habitDoneToday,perfectDayStreak]);

  const setupSteps=useMemo(()=>[
    {key:"wallet",ok:s.dompet.some(d=>N(d.saldo)>0),title:"Isi saldo awal",desc:"Masukkan saldo dompet utama supaya dashboard langsung akurat.",icon:"👛",action:"Isi saldo",target:"dompet"},
    {key:"tx",ok:s.txs.length>0,title:"Catat transaksi pertama",desc:"Satu transaksi cukup untuk menghidupkan laporan dan insight.",icon:"🧾",action:"Catat",target:"tx"},
    {key:"budget",ok:totalBudget>0,title:"Buat budget dasar",desc:"Atur batas bulanan untuk kategori penting.",icon:"📊",action:"Budget",target:"budget"},
    {key:"habit",ok:habitTotalToday>0,title:"Tambah habit uang",desc:"Buat quest harian seperti catat transaksi atau cek saldo.",icon:"🐾",action:"Habit",target:"habit"},
  ],[s.dompet,s.txs,totalBudget,habitTotalToday]);
  const setupPct=setupSteps.filter(x=>x.ok).length/setupSteps.length*100;
  const healthChecklist=useMemo(()=>[
    {
      key:"saldo",
      ok:s.dompet.some(d=>N(d.saldo)>0),
      icon:"👛",
      title:"Saldo sudah diisi",
      desc:"Dashboard membaca uang dari dompet utama.",
      action:"Isi saldo",
      target:"dompet",
    },
    {
      key:"budget",
      ok:totalBudget>0,
      icon:"📊",
      title:"Budget sudah dibuat",
      desc:"Batas belanja bulanan mulai terlihat.",
      action:"Buat budget",
      target:"budget",
    },
    {
      key:"tx_today",
      ok:todayTxCount>0,
      icon:"🧾",
      title:"Transaksi hari ini",
      desc:todayTxCount>0?`${todayTxCount} transaksi dicatat hari ini.`:"Catat satu transaksi agar laporan tetap hidup.",
      action:"Catat",
      target:"tx",
    },
    {
      key:"habit_today",
      ok:habitTotalToday>0&&habitDoneToday>=habitTotalToday,
      icon:"🐾",
      title:"Habit hari ini",
      desc:habitTotalToday?`${habitDoneToday}/${habitTotalToday} quest selesai.`:"Buat habit kecil agar user rutin balik.",
      action:habitTotalToday?"Ceklis":"Buat habit",
      target:"habit",
    },
  ],[s.dompet,totalBudget,todayTxCount,habitTotalToday,habitDoneToday]);
  const healthChecklistPct=healthChecklist.filter(x=>x.ok).length/healthChecklist.length*100;

  const weeklyMissions=useMemo(()=>{
    const txDays=new Set(s.txs.map(tx=>tx.tgl).filter(Boolean));
    const last7=Array.from({length:7},(_,i)=>dateAdd(today(),-i));
    const activeTxDays=last7.filter(d=>txDays.has(d)).length;
    return [
      {title:"Catat 3 hari",desc:"Punya transaksi di 3 hari berbeda minggu ini.",icon:"🔥",progress:activeTxDays,target:3,done:activeTxDays>=3,targetPage:"trans"},
      {title:"Quest habit",desc:"Selesaikan semua habit hari ini.",icon:"🐾",progress:habitDoneToday,target:Math.max(habitTotalToday,1),done:habitTotalToday>0&&habitDoneToday>=habitTotalToday,targetPage:"habit"},
      {title:"Budget aman",desc:"Pengeluaran tidak melewati budget bulanan.",icon:"🛡️",progress:totalBudget>0?Math.max(0,Math.min(100,100-(totalOut/Math.max(totalBudget,1)*100))):0,target:100,done:totalBudget>0&&totalOut<=totalBudget,targetPage:"budget"},
      {title:"Saving 20%",desc:"Jaga saving rate minimal 20%.",icon:"💎",progress:Math.min(savRate,20),target:20,done:savRate>=20,targetPage:"goals"},
    ];
  },[s.txs,habitDoneToday,habitTotalToday,totalBudget,totalOut,savRate]);
  const weeklyMissionPct=weeklyMissions.filter(m=>m.done).length/weeklyMissions.length*100;

  const smartInsightCards=useMemo(()=>{
    const topName=topKat[0]?.[0]||"belanja";
    const topValue=topKat[0]?.[1]||0;
    const cards=[];
    if(topValue>0) cards.push({tone:"warn",icon:"💡",title:"Peluang hemat cepat",body:`Kurangi 10% dari ${topName}, kamu bisa hemat sekitar ${IDRs(topValue*.1)} bulan ini.`,action:"Review budget",target:"budget"});
    if(totalIn===0&&totalOut>0) cards.push({tone:"danger",icon:"⚠️",title:"Pemasukan belum tercatat",body:"Catat pemasukan bulan ini supaya rasio dan prediksi tidak terbaca terlalu buruk.",action:"Catat pemasukan",target:"income"});
    if(savRate<20&&totalIn>0) cards.push({tone:"info",icon:"🎯",title:"Naikkan saving rate",body:`Butuh sekitar ${IDRs(Math.max(totalIn*.2-totalTabung,0))} lagi untuk menyentuh target sehat 20%.`,action:"Buka goals",target:"goals"});
    if(habitTotalToday>0&&habitDoneToday<habitTotalToday) cards.push({tone:"habit",icon:"🐾",title:"Quest belum selesai",body:`Masih ada ${habitTotalToday-habitDoneToday} habit hari ini. Ceklis dulu biar streak tetap hidup.`,action:"Buka habit",target:"habit"});
    if(!cards.length) cards.push({tone:"good",icon:"✨",title:"Ritme kamu bagus",body:"Cashflow, habit, dan budget terlihat rapi. Pertahankan pola ini sampai akhir bulan.",action:"Lihat laporan",target:"laporan"});
    return cards.slice(0,3);
  },[topKat,totalIn,totalOut,totalTabung,savRate,habitTotalToday,habitDoneToday]);

  const monthlyRecap=useMemo(()=>({
    month:s.bulan,year:s.tahun,score:skorTotal,income:totalIn,expense:totalOut,saving:totalTabung,net:netCash,
    savingRate:savRate,topCategory:topKat[0]?.[0]||"Belum ada",topValue:topKat[0]?.[1]||0,
    txCount:txBulan.length,habitDone:habitDoneToday,habitTotal:habitTotalToday,streak:perfectDayStreak,
  }),[s.bulan,s.tahun,skorTotal,totalIn,totalOut,totalTabung,netCash,savRate,topKat,txBulan.length,habitDoneToday,habitTotalToday,perfectDayStreak]);


  // Notifications
  const notifications=useMemo(()=>{
    const list=[];
    const now_date=new Date();
    // Tagihan jatuh tempo
    s.budgets.forEach(b=>b.sub.forEach(sb=>{
      if(sb.tempo){
        const tDate=new Date(now_date.getFullYear(),now_date.getMonth(),Number(sb.tempo));
        const diff=Math.ceil((tDate-now_date)/(1000*60*60*24));
        if(diff>=0&&diff<=7){list.push({icon:sb.emoji||b.icon,title:`Tagihan: ${sb.nama}`,msg:diff===0?"Jatuh tempo HARI INI!":diff+" hari lagi jatuh tempo",tag:"Tagihan",color:diff<=1?"danger":"warning",amount:N(sb.alokasi)});}
        else if(diff<0&&diff>=-7){list.push({icon:sb.emoji||b.icon,title:`OVERDUE: ${sb.nama}`,msg:`Sudah ${Math.abs(diff)} hari melewati jatuh tempo!`,tag:"Overdue",color:"danger",amount:N(sb.alokasi)});}
      }
    }));
    // Budget overrun
    s.budgets.forEach(b=>{
      const spend=spendByKat[b.id]||0;
      const alloc=N(b.alokasi)+b.sub.reduce((x,y)=>x+N(y.alokasi),0);
      if(alloc>0&&spend>alloc){list.push({icon:b.icon,title:`Budget ${b.kat} Terlampaui`,msg:`Pengeluaran melebihi budget ${IDR(alloc)}`,tag:"Budget",color:"danger",amount:spend-alloc});}
      else if(alloc>0&&spend>alloc*0.85){list.push({icon:b.icon,title:`Budget ${b.kat} Hampir Habis`,msg:`Sudah ${PCT(spend/alloc*100)} terpakai`,tag:"Budget",color:"warning"});}
    });
    // Goals near deadline
    s.goals.filter(g=>!g.selesai&&g.deadline).forEach(g=>{
      const dl=new Date(g.deadline);
      const diff=Math.ceil((dl-now_date)/(1000*60*60*24));
      if(diff>=0&&diff<=14){const pct=N(g.target)>0?N(g.kumpul)/N(g.target)*100:0;list.push({icon:g.icon,title:`Goal: ${g.nama}`,msg:`${diff} hari lagi, progress ${pct.toFixed(0)}%`,tag:"Goal",color:pct>=80?"success":"warning"});}
    });
    // Utang tempo
    s.utang.filter(u=>!u.lunas&&u.tempo).forEach(u=>{
      const tempo=new Date(u.tempo);
      const diff=Math.ceil((tempo-now_date)/(1000*60*60*24));
      if(diff>=0&&diff<=14){list.push({icon:"📋",title:u.tipe==="utang"?`Utang: ${u.nama}`:`Piutang: ${u.nama}`,msg:diff===0?"Jatuh tempo HARI INI!":diff+" hari lagi",tag:u.tipe==="utang"?"Utang":"Piutang",color:diff<=3?"danger":"warning",amount:N(u.jml)});}
    });
    if(todayTxCount===0) list.push({icon:"🧾",title:"Belum catat transaksi hari ini",msg:"Catat satu pemasukan atau pengeluaran agar laporan tetap hidup.",tag:"Transaksi",color:"info"});
    if(habitTotalToday>0&&habitDoneToday<habitTotalToday) list.push({icon:"🐾",title:"Habit harian belum selesai",msg:`Masih ada ${habitTotalToday-habitDoneToday} quest yang belum diceklis.`,tag:"Habit",color:"info"});
    return list.sort((a,b)=>a.color==="danger"?-1:1);
  },[s.budgets,s.goals,s.utang,spendByKat,todayTxCount,habitTotalToday,habitDoneToday]);

  const saranList=useMemo(()=>{
    const list=[];
    s.budgets.forEach(b=>{
      const spend=spendByKat[b.id]||0;const alloc=N(b.alokasi)+b.sub.reduce((x,y)=>x+N(y.alokasi),0);
      if(alloc>0&&spend>alloc){const lebih=spend-alloc;list.push({kat:b.kat,icon:b.icon,type:"over",msg:`Pengeluaran ${b.kat} melebihi budget ${IDR(alloc)}. Bisa hemat ${IDR(lebih)}.`});}
      else if(alloc>0&&spend<alloc*0.3&&daysPassed>15){list.push({kat:b.kat,icon:b.icon,type:"under",msg:`Budget ${b.kat} baru terpakai ${PCT(alloc>0?spend/alloc*100:0)}. Pertimbangkan realokasi.`});}
    });
    return list;
  },[s.budgets,spendByKat,daysPassed]);
  const reportNarrative=useMemo(()=>{
    const topName=topKat[0]?.[0] || "belum ada kategori dominan";
    const topValue=topKat[0]?.[1] || 0;
    const budgetPct=totalBudget>0 ? totalOut/totalBudget*100 : 0;
    const title = txBulan.length
      ? `Bulan ini kamu paling banyak keluar di ${topName}`
      : "Laporan akan hidup setelah transaksi pertama";
    const body = txBulan.length
      ? `Rata-rata pengeluaran harian sekitar ${IDRs(dailyAvg)}. Kalau pola ini berlanjut, estimasi pengeluaran bulan ini menjadi ${IDRs(prediksiOut)} dan sisa akhir bulan ${prediksiSisa>=0?"masih aman":"perlu dijaga"} di ${IDRs(prediksiSisa)}.`
      : "Catat pemasukan, pengeluaran, atau tabungan pertama supaya AturDuitku bisa membaca pola uangmu dengan lebih akurat.";
    const points = [
      totalIn>0 ? `Saving rate kamu ${PCT(savRate)}${savRate>=20?", sudah masuk zona sehat.":", target sehatnya minimal 20%."}` : "Pemasukan bulan ini belum tercatat, jadi rasio laporan belum lengkap.",
      topValue>0 ? `${topName} menyerap ${IDRs(topValue)} bulan ini. Ini kategori pertama yang paling layak dicek.` : "Belum ada kategori pengeluaran yang bisa dianalisis.",
      totalBudget>0 ? `Budget terpakai ${PCT(budgetPct)} dari total alokasi.` : "Budget dasar belum diisi, jadi batas belanja belum terlihat.",
    ];
    const tone = prediksiSisa<0 || budgetPct>100 ? "danger" : savRate>=20 && netCash>=0 ? "good" : "warn";
    return {title,body,points,tone};
  },[txBulan.length,topKat,totalBudget,totalOut,totalIn,dailyAvg,prediksiOut,prediksiSisa,savRate,netCash]);

  // Amplop computed
  const amplopTotal=useMemo(()=>s.amplop.reduce((a,b)=>a+N(b.alokasi),0),[s.amplop]);
  const amplopTerpakai=useMemo(()=>s.amplop.reduce((a,b)=>a+N(b.terpakai||0),0),[s.amplop]);

  // Time-aware saldo (saldo akhir bulan historis per dompet)
  const historicalSaldo=useMemo(()=>{
    // Hitung saldo tiap dompet di akhir setiap bulan pada trendData
    const result={};
    const now_=new Date();
    for(let i=5;i>=0;i--){
      const d=new Date(yr,bulanIdx-i,1);
      const monthKey=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      const label=MSHORT[d.getMonth()];
      // Kalkulasi: saldo saat ini + semua tx setelah bulan ini (dikurangi) - semua tx di/sebelum bulan ini (ditambah kembali)
      // Cara sederhana: hitung net tx per dompet untuk setiap bulan
      const dompetSaldoAtEnd={};
      s.dompet.forEach(dom=>{
        let saldo=N(dom.saldo);
        // Reverse semua tx setelah monthKey
        s.txs.filter(t=>t.tgl&&t.tgl>monthKey+"-31").forEach(t=>{
          if(t.dompetId===dom.id){
            if(t.tipe==="pemasukan")saldo-=N(t.jml);
            else if(t.tipe==="pengeluaran"||t.tipe==="tabungan")saldo+=N(t.jml);
            else if(t.tipe==="transfer"){saldo+=N(t.jml)+N(t.biaya||0);}
          }
          if(t.tipe==="transfer"&&t.dompetTo===dom.id&&t.tgl>monthKey+"-31")saldo-=N(t.jml);
        });
        dompetSaldoAtEnd[dom.id]=saldo;
      });
      result[label]={monthKey,dompetSaldo:dompetSaldoAtEnd,totalSaldo:Object.values(dompetSaldoAtEnd).reduce((a,b)=>a+b,0)};
    }
    return result;
  },[s.dompet,s.txs,yr,bulanIdx]);

  const hari=now.toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  const jam=now.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false});
  // Timezone zone name (WIB/WITA/WIT)
  const tzZone = useMemo(()=>{
    try {
      const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const off = -new Date().getTimezoneOffset() / 60;
      if (off === 7) return {zone:"WIB", city: tzName.split("/").pop().replace(/_/g," "), color:"#22C55E"};
      if (off === 8) return {zone:"WITA", city: tzName.split("/").pop().replace(/_/g," "), color:"#F59E0B"};
      if (off === 9) return {zone:"WIT", city: tzName.split("/").pop().replace(/_/g," "), color:"#3B82F6"};
      return {zone:`UTC${off>=0?"+":""}${off}`, city: tzName.split("/").pop().replace(/_/g," "), color:"#8B5CF6"};
    } catch(e) { return {zone:"",city:"",color:"#8B5CF6"}; }
  },[]);
  // Greeting based on hour
  const greetingWord = useMemo(()=>{
    const h = now.getHours();
    if (h>=4&&h<11) return "morning";
    if (h>=11&&h<15) return "afternoon";
    if (h>=15&&h<18) return "evening";
    return "night";
  },[now.getHours()]);
  const greetingEmoji = useMemo(()=>{
    const h = now.getHours();
    if (h>=4&&h<11) return "🌤️";
    if (h>=11&&h<15) return "☀️";
    if (h>=15&&h<18) return "🌆";
    return "🌙";
  },[now.getHours()]);
  // Short date for topbar — locale aware
  const hariShort = now.toLocaleDateString(lang==="en"?"en-US":"id-ID",{weekday:"long",day:"numeric",month:"short",year:"numeric"});

  // Handlers
  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(""),2500);};
  const isIosDevice=typeof navigator!=="undefined"&&/iphone|ipad|ipod/i.test(navigator.userAgent||"");
  const isStandalone=typeof window!=="undefined"&&(window.matchMedia?.("(display-mode: standalone)")?.matches||window.navigator?.standalone);
  const dismissInstallPrompt=()=>{setInstallPrompt(null);setInstallDismissed(true);try{localStorage.setItem("aturduitku_install_dismissed","1");}catch(e){}showToast("Banner install disembunyikan");};
  const handleInstallApp=async()=>{
    if(installPrompt){
      installPrompt.prompt();
      const choice=await installPrompt.userChoice.catch(()=>null);
      setInstallPrompt(null);
      if(choice?.outcome==="accepted"||choice?.outcome==="dismissed") dismissInstallPrompt();
      return;
    }
    if(isIosDevice){showToast("iPhone: tap Share lalu Add to Home Screen");return;}
    showToast("Buka menu browser lalu pilih Install app / Add to Home screen");
  };
  const openQuickAction=(kind)=>{
    setQuickOpen(false);
    if(kind==="expense") setModal({type:"tx",tipe:"pengeluaran"});
    else if(kind==="income") setModal({type:"tx",tipe:"pemasukan"});
    else if(kind==="goal") setModal({type:"goal"});
    else if(kind==="budget") setPage("budget");
    else if(kind==="habit") setPage("habit");
    else if(kind==="ai") setAiOpen(true);
  };
  const openNotificationAction=(n)=>{
    setNotifOpen(false);
    const tag=String(n?.tag||"").toLowerCase();
    if(tag.includes("budget")||tag.includes("tagihan")) setPage("budget");
    else if(tag.includes("goal")) setPage("goals");
    else if(tag.includes("habit")) setPage("habit");
    else if(tag.includes("transaksi")) setPage("trans");
    else if(tag.includes("utang")||tag.includes("piutang")) setPage("utang");
    else setPage("home");
  };
  const goPremiumTarget=(target)=>{
    if(target==="tx") setModal({type:"tx"});
    else if(target==="income") setModal({type:"tx",tipe:"pemasukan"});
    else if(target==="dompet") setModal({type:"dompet"});
    else if(target) setPage(target);
  };
  const startAiSetup=()=>{
    setAiOpen(true);
    setTimeout(()=>handleAiSend("Bantu saya setup awal AturDuitku. Pandu saya langkah demi langkah: saldo dompet, pemasukan, budget utama, habit uang harian, dan goal tabungan pertama."),0);
  };
  const toggleSimpleMode=()=>{
    setSimpleMode(v=>{
      const next=!v;
      try{localStorage.setItem("aturduitku_simple_mode",next?"1":"0");}catch(e){}
      if(next&&!["home","trans","budget","laporan","setting"].includes(page)) setPage("home");
      showToast(next?"Simple Mode aktif":"Simple Mode dimatikan");
      return next;
    });
  };
  const applyBudgetTemplate=()=>{
    const incomeBase=totalIn>0?totalIn:0;
    const defaults={
      "Makan & Minum":0.22,"Transportasi":0.12,"Tagihan & Utilitas":0.18,"Kesehatan":0.06,
      "Belanja":0.08,"Hiburan":0.05,"Pendidikan":0.05,"Investasi":0.14,"Lainnya":0.10,
    };
    setS(p=>({...p,budgets:p.budgets.map(b=>({...b,alokasi:String(Math.round((defaults[b.kat]||0.05)*incomeBase)),sub:b.sub||[]}))}));
    showToast(incomeBase>0?"Template budget pemula diterapkan":"Template kategori disiapkan. Isi pemasukan dulu agar nominal otomatis lebih pas.");
  };
  const addHabitPresets=()=>{
    const presets=[
      {nama:"Catat transaksi hari ini",icon:"🧾",target:"1x per hari"},
      {nama:"Cek saldo dompet",icon:"👛",target:"1x per hari"},
      {nama:"Tahan belanja impulsif",icon:"🧘",target:"1x per hari"},
      {nama:"Sisihkan tabungan",icon:"💎",target:"1x per hari"},
    ];
    setS(p=>{
      const existing=new Set((p.habits||[]).map(h=>String(h.nama).toLowerCase()));
      const add=presets.filter(x=>!existing.has(x.nama.toLowerCase())).map((x,i)=>({id:Date.now()+i,...x,createdAt:today(),active:true,doneDates:[]}));
      return {...p,habits:[...add,...(p.habits||[])]};
    });
    showToast("Preset habit uang ditambahkan");
  };
  const closeMonth=()=>{
    const next=new Date(yr,bulanIdx+1,1);
    setS(p=>({...p,prevPemasukan:String(totalIn),prevPengeluaran:String(totalOut),bulan:MONTHS[next.getMonth()],tahun:String(next.getFullYear())}));
    setModal({type:"monthlyRecap",recap:monthlyRecap});
    showToast("Tutup buku selesai. Periode dipindah ke bulan berikutnya.");
  };
  const finishTour=()=>{
    setTourDismissed(true);
    try{localStorage.setItem("aturduitku_tour_done","1");}catch(e){}
    setModal(null);
  };
  const commandActions=[
    {title:"Catat transaksi",desc:"Tambah pemasukan atau pengeluaran",icon:"🧾",run:()=>setModal({type:"tx"})},
    {title:"Pakai template budget",desc:"Set kategori budget pemula",icon:"📊",run:applyBudgetTemplate},
    {title:"Tambah preset habit",desc:"Quest uang harian siap pakai",icon:"🐾",run:addHabitPresets},
    {title:"Buka laporan",desc:"Lihat insight dan export",icon:"📈",run:()=>setPage("laporan")},
    {title:"Tanya Dokter Keuangan",desc:"Buka AI advisor",icon:"🐱",run:()=>setAiOpen(true)},
    {title:"Tutup buku bulan ini",desc:"Simpan pembanding dan pindah periode",icon:"📚",run:()=>setModal({type:"confirm",title:"Tutup buku bulan ini?",msg:"Pemasukan dan pengeluaran bulan ini akan disimpan sebagai pembanding, lalu periode aktif pindah ke bulan berikutnya. Data transaksi tetap aman.",onConfirm:closeMonth})},
  ];
  const runCommand=(cmd)=>{setCommandOpen(false);setCommandQuery("");cmd.run();};
  const openCalc=(field,cur,setter)=>{setCalcFor({field,cur,setter});setShowCalc(true);};
  const addHabit=()=>{
    const nama=habitForm.nama.trim();
    if(!nama){showToast("⚠️ Isi nama habit dulu");return;}
    setS(p=>({...p,habits:[{id:Date.now(),nama,icon:habitForm.icon||"🐾",target:habitForm.target||"1x per hari",createdAt:today(),active:true,doneDates:[]},...(p.habits||[])]}));
    setHabitForm({nama:"",icon:"🐾",target:"1x per hari"});
    showToast("🐾 Habit baru ditambahkan!");
  };
  const toggleHabit=(id)=>{
    const day=today();
    let completed=false;
    setS(p=>({...p,habits:(p.habits||[]).map(h=>{
      if(h.id!==id) return h;
      const done=new Set(h.doneDates||[]);
      if(done.has(day)){done.delete(day);completed=false;}
      else {done.add(day);completed=true;}
      return {...h,doneDates:[...done].sort()};
    })}));
    if(completed){setHabitCelebrate(true);setTimeout(()=>setHabitCelebrate(false),900);showToast("🔥 Habit selesai! Streak naik.");}
  };
  const deleteHabit=(id)=>setModal({type:"confirm",title:"Hapus habit?",msg:"Riwayat streak habit ini akan ikut terhapus.",danger:true,onConfirm:()=>{setS(p=>({...p,habits:(p.habits||[]).filter(h=>h.id!==id)}));setModal(null);showToast("Habit dihapus");}});
  const renderHabitCard=(h)=>{
    const done=habitDone(h);
    const streak=habitStreak(h);
    const best=habitBestStreak(h);
    return(
      <div key={h.id} className={done?"habit-complete":""} style={{background:T.card,border:`1.5px solid ${done?T.okBorder:T.border}`,borderRadius:16,padding:16,boxShadow:done?`0 10px 28px rgba(34,197,94,.12)`:T.shadow,transition:"all .2s",position:"relative",overflow:"hidden",opacity:done?.92:1}}>
        {done&&<div style={{position:"absolute",top:12,right:12,fontSize:9,fontWeight:900,letterSpacing:.9,textTransform:"uppercase",color:T.ok,background:T.okBg,border:`1px solid ${T.okBorder}`,borderRadius:999,padding:"4px 8px"}}>Selesai</div>}
        <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start",marginBottom:12}}>
          <button onClick={()=>toggleHabit(h.id)} style={{width:52,height:52,borderRadius:17,border:`2px solid ${done?T.ok:T.border}`,background:done?T.okBg:T.cardAlt,cursor:"pointer",fontSize:24,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",transition:"all .18s",boxShadow:done?`0 8px 18px rgba(34,197,94,.14)`:"none"}} title={done?"Batalkan selesai":"Tandai selesai"}>
            {done?"✅":h.icon||"🐾"}
          </button>
          <div style={{flex:1,minWidth:0,paddingRight:done?70:0}}>
            <div style={{fontSize:14,fontWeight:900,color:done?T.muted:T.text,marginBottom:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textDecoration:done?"line-through":"none",textDecorationThickness:2}}>{h.nama}</div>
            <div style={{fontSize:11,color:T.muted,textDecoration:done?"line-through":"none"}}>{h.target||"1x per hari"}</div>
            <button onClick={()=>toggleHabit(h.id)} style={{marginTop:8,padding:"6px 10px",borderRadius:999,border:`1px solid ${done?T.okBorder:T.accent}`,background:done?T.okBg:T.accentBg,color:done?T.ok:T.accent,fontSize:11,fontWeight:900,cursor:"pointer",fontFamily:"inherit"}}>
              {done?"✓ Sudah selesai hari ini":"Ceklis selesai"}
            </button>
          </div>
          <Del onClick={()=>deleteHabit(h.id)}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          <div style={{background:T.accentBg,borderRadius:11,padding:"9px 10px"}}>
            <div style={{fontSize:9,color:T.accent,fontWeight:900,textTransform:"uppercase",letterSpacing:.8}}>Streak</div>
            <div style={{fontSize:17,fontWeight:900,color:T.accent}}>🔥 {streak}</div>
          </div>
          <div style={{background:T.infoBg,borderRadius:11,padding:"9px 10px"}}>
            <div style={{fontSize:9,color:T.info,fontWeight:900,textTransform:"uppercase",letterSpacing:.8}}>Best</div>
            <div style={{fontSize:17,fontWeight:900,color:T.info}}>🏆 {best}</div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:5}}>
          {Array.from({length:7},(_,i)=>dateAdd(habitDay,i-6)).map(day=>{
            const dDone=habitDone(h,day);
            return <div key={day} title={day} style={{height:28,borderRadius:8,background:dDone?T.okBg:T.cardAlt,border:`1px solid ${dDone?T.okBorder:T.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900,color:dDone?T.ok:T.muted}}>{dDone?"✓":Number(day.slice(8))}</div>;
          })}
        </div>
      </div>
    );
  };


  // ═══════════════════════════════════════════════════
  // CLOUDFLARE WORKERS AI + GOOGLE SHEETS SYNC
  // ═══════════════════════════════════════════════════
  const polishAiMessage = (content) => String(content || "")
    .replace(/\*\*(Pemasukan|Pengeluaran|Tabungan) dicatat!\*\*/g, "**$1 aman, sudah dicatat.**")
    .replace(/\*\*Goal ditambahkan!\*\*/g, "**Goal baru sudah siap.**")
    .replace(/\*\*Aset dicatat!\*\*/g, "**Aset sudah masuk catatan.**")
    .replace(/\*\*(Utang|Piutang) dicatat!\*\*/g, "**$1 sudah dicatat.**")
    .replace(/\*\*Habit ditambahkan!\*\*/g, "**Habit baru sudah jadi quest harian.**")
    .replace(/\*\*Habit selesai hari ini!\*\*/g, "**Nice, habit hari ini selesai.**")
    .replace(/Lihat di menu \*\*Goals\*\* untuk mulai nabung![\s\S]*?$/g, "Langkah kecil berikutnya: setor nominal pertama biar progress-nya langsung hidup.")
    .replace(/Lihat di menu \*\*Aset\*\* untuk detail lengkap\./g, "Net worth kamu akan ikut terbaca lebih lengkap setelah aset ini masuk.")
    .replace(/Lihat di menu \*\*Utang\*\* untuk pantau cicilan\./g, "Aku akan bantu ingatkan supaya ini tidak kelewat.")
    .replace(/Saldo amplop bertambah\./g, "Amplopnya sudah lebih siap dipakai sesuai rencana.");

  const renderAiContent = (content) => polishAiMessage(content).split("\n").map((line, lineIdx, lines) => (
    <React.Fragment key={lineIdx}>
      {line.split(/(\*\*[^*]+\*\*)/g).map((part, partIdx) => (
        part.startsWith("**") && part.endsWith("**")
          ? <strong key={partIdx}>{part.slice(2, -2)}</strong>
          : <React.Fragment key={partIdx}>{part}</React.Fragment>
      ))}
      {lineIdx < lines.length - 1 && <br/>}
    </React.Fragment>
  ));

  const callAi = async (messages, systemPrompt) => {
    const resp = await fetch("/api/ai/cloudflare", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        messages,
        systemPrompt,
      })
    });
    if(!resp.ok){
      const err = await resp.json().catch(()=>({}));
      const error = new Error(err.error || "AI error: "+resp.status);
      error.code = err.code;
      error.status = resp.status;
      throw error;
    }
    const data = await resp.json();
    if(typeof data.reply === "string") return data.reply;
    if(data.reply == null) return "";
    try{return JSON.stringify(data.reply);}catch(e){return String(data.reply);}
  };

  // ─── Google Sheets OAuth ────────────────────────────────────────
  const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID_HERE";
  const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

  const getGoogleToken = () => {
    return new Promise((resolve, reject) => {
      if(!window.google?.accounts?.oauth2) return reject(new Error("GIS not loaded"));
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SHEETS_SCOPE,
        callback: (resp) => {
          if(resp.error) return reject(new Error(resp.error));
          resolve(resp.access_token);
        },
      });
      client.requestAccessToken({prompt:""});
    });
  };


    // Sheets sync removed - use Export XLSX/PDF instead

  const [aiOpen,setAiOpen]=useState(false);
  const shortcutHandledRef=useRef(false);
  const aiMsgsRef = useRef(null);
  const [aiMsgs,setAiMsgs]=useState([{role:"assistant",content:"Halo! Saya **Dokter Keuangan**. Saya bukan cuma chatbot catatan uang, saya bisa jadi partner finansial kamu: membaca pola uang, bantu catat banyak fitur, mengingatkan risiko, dan menyusun langkah kecil yang realistis.\n\nKamu bisa minta saya:\n- Catat transaksi, amplop, habit, goal, aset, utang, budget, dompet, dan transaksi rutin\n- Analisis cashflow, saving rate, runway, budget bocor, dan prioritas bulan ini\n- Bikin rencana hemat, target nabung, atau strategi keluar dari utang\n- Menenangkan saat uang lagi berantakan, lalu bantu susun langkah pertama\n\nCoba tulis: `catat makan 25rb`, `buat amplop makan 500rb`, `ceklis habit minum air`, atau `cek kondisi uangku hari ini`."}]);
  const [aiInput,setAiInput]=useState("");
  const [aiLoading,setAiLoading]=useState(false);

  useEffect(()=>{
    if(shortcutHandledRef.current||!isApproved||!onboarded) return;
    let shortcut="";
    try{shortcut=new URLSearchParams(window.location.search).get("shortcut")||"";}catch(e){}
    if(!shortcut) return;
    shortcutHandledRef.current=true;
    if(shortcut==="transaction"){setPage("trans");setModal({type:"tx"});}
    else if(shortcut==="reports"){setPage("laporan");}
    else if(shortcut==="habit"){setPage("habit");}
    else if(shortcut==="ai"){setAiOpen(true);}
    try{
      const cleanUrl=window.location.pathname+(window.location.hash||"");
      window.history.replaceState({},document.title,cleanUrl);
    }catch(e){}
  },[isApproved,onboarded]);

  const getAiSystemPrompt = () => {
    // ── Compute financial metrics ──────────────────────
    const totalSaldo = s.dompet.reduce((a,d)=>a+N(d.saldo),0);
    const txBulan = s.txs.filter(t=>t.bulan===s.bulan&&t.tahun===s.tahun);
    const totalIn = txBulan.filter(t=>t.tipe==="pemasukan").reduce((a,t)=>a+Number(t.jml),0);
    const totalOut = txBulan.filter(t=>t.tipe==="pengeluaran").reduce((a,t)=>a+Number(t.jml),0);
    const savingRate = totalIn>0 ? ((totalIn-totalOut)/totalIn*100).toFixed(1) : 0;

    // Budget analysis
    const budgetAnalysis = s.budgets.map(b=>{
      const spent = txBulan.filter(t=>t.tipe==="pengeluaran"&&t.katId===b.id).reduce((a,t)=>a+Number(t.jml),0);
      const alloc = Number(b.alokasi||0)+b.sub.reduce((a,x)=>a+Number(x.alokasi||0),0);
      const pct = alloc>0 ? Math.round(spent/alloc*100) : 0;
      const status = pct>=100?"LEWATI":pct>=85?"HAMPIR":pct>=50?"WASPADA":"AMAN";
      return `${b.kat}: ${status} ${pct}% (Rp ${spent.toLocaleString("id-ID")}/${alloc.toLocaleString("id-ID")})`;
    }).join("\n  ");

    // Top spending categories
    const spendByKat = {};
    txBulan.filter(t=>t.tipe==="pengeluaran").forEach(t=>{
      const kat = s.budgets.find(b=>b.id===t.katId)?.kat||"Lainnya";
      spendByKat[kat] = (spendByKat[kat]||0)+Number(t.jml);
    });
    const topSpend = Object.entries(spendByKat).sort((a,b)=>b[1]-a[1]).slice(0,3)
      .map(([k,v])=>`${k}: Rp ${v.toLocaleString("id-ID")}`).join(", ");

    // Goals progress
    const goalsInfo = s.goals.length>0 ? s.goals.map(g=>{
      const tgt = Number(g.target||0);
      const kmp = Number(g.kumpul||0);
      const pct = tgt>0 ? Math.round(kmp/tgt*100) : 0;
      const sisa = tgt-kmp;
      return `${g.nama}: ${pct}% (terkumpul Rp ${kmp.toLocaleString("id-ID")} dari Rp ${tgt.toLocaleString("id-ID")}, sisa Rp ${sisa.toLocaleString("id-ID")}${g.deadline?", deadline "+g.deadline:""})`;
    }).join("\n  ") : "Belum ada goals";

    // Debt/receivable
    const utangAktif = s.utang.filter(u=>!u.lunas);
    const totalUtang = utangAktif.filter(u=>u.tipe==="utang").reduce((a,u)=>a+Number(u.jml||0),0);
    const totalPiutang = utangAktif.filter(u=>u.tipe==="piutang").reduce((a,u)=>a+Number(u.jml||0),0);
    const utangInfo = utangAktif.length>0 ? utangAktif.map(u=>
      `${u.tipe==="piutang"?"[PIUTANG]":"[UTANG]"} ${u.nama}: Rp ${Number(u.jml||0).toLocaleString("id-ID")}${u.tempo?" jatuh tempo "+u.tempo:""}`
    ).join("\n  ") : "Tidak ada utang/piutang aktif";

    // Asset & net worth
    const totalAset = s.asetTetap.reduce((a,x)=>a+Number(x.nilai||0),0);
    const netWorth = totalSaldo+totalAset-totalUtang;

    // Amplop
    const amplopInfo = s.amplop.length>0 ? s.amplop.map(a=>{
      const sisa = Number(a.alokasi||0)-Number(a.terpakai||0);
      return `${a.nama}: sisa Rp ${sisa.toLocaleString("id-ID")} dari Rp ${Number(a.alokasi||0).toLocaleString("id-ID")}`;
    }).join(", ") : "Belum ada amplop";
    const habitRowsForAi = activeHabits.map(h=>{
      const doneSet = new Set(h.doneDates||[]);
      const doneToday = doneSet.has(today());
      const monthRow = habitAnalytics.habitRows.find(x=>x.id===h.id);
      return {
        nama:h.nama,
        target:h.target||"1x per hari",
        icon:h.icon||"🐾",
        doneToday,
        streak:habitStreak(h),
        best:habitBestStreak(h),
        total:(h.doneDates||[]).length,
        monthPct:Math.round(monthRow?.monthPct||0),
        monthDone:monthRow?.monthDone||0,
      };
    }).sort((a,b)=>b.monthPct-a.monthPct);
    const habitStrong = habitRowsForAi[0];
    const habitWeak = [...habitRowsForAi].reverse().find(h=>h.monthPct<100) || null;
    const habitOpenNames = habitRowsForAi.filter(h=>!h.doneToday).map(h=>h.nama);
    const habitDoneNames = habitRowsForAi.filter(h=>h.doneToday).map(h=>h.nama);
    const habitWeekInfo = Array.from({length:7},(_,i)=>dateAdd(today(),i-6)).map(day=>{
      const done=activeHabits.filter(h=>new Set(h.doneDates||[]).has(day)).length;
      return `${day.slice(5)}:${activeHabits.length?Math.round(done/activeHabits.length*100):0}%`;
    }).join(", ");
    const habitInfo = activeHabits.length>0 ? habitRowsForAi.slice(0,12).map(h=>
      `${h.icon} ${h.nama}: target ${h.target}, ${h.doneToday?"selesai hari ini":"belum selesai hari ini"}, streak ${h.streak} hari, best ${h.best}, bulan ini ${h.monthDone}x (${h.monthPct}%), total ${h.total}x`
    ).join("\n  ") : "Belum ada habit";
    const recurringInfo = s.recurring.length>0 ? s.recurring.map(r=>
      `${r.nama}: ${r.tipe} Rp ${Number(r.jml||0).toLocaleString("id-ID")} tiap tgl ${r.hari}`
    ).join(", ") : "Belum ada transaksi rutin";

    // Recent 5 transactions
    const recentTx = s.txs.slice(0,5).map(t=>{
      const kat = s.budgets.find(b=>b.id===t.katId)?.kat||"-";
      const dompet = s.dompet.find(d=>d.id===t.dompetId)?.nama||"-";
      return `${t.tgl} | ${t.tipe==="pemasukan"?"➕":"➖"} ${t.ket} | Rp ${Number(t.jml).toLocaleString("id-ID")} | ${kat} | ${dompet}`;
    }).join("\n  ") || "Belum ada transaksi";

    // Financial health score
    const healthScore = Math.round(
      (savingRate>=20?25:savingRate>=10?15:5) +
      (totalUtang===0?20:totalUtang<totalSaldo?12:4) +
      (s.goals.length>0?15:0) +
      (Number(savingRate)>=0?15:0) +
      (s.budgets.some(b=>b.alokasi>0)?15:5) +
      (s.asetTetap.length>0?10:0)
    );
    const healthLabel = healthScore>=80?"🌟 Sangat Baik":healthScore>=60?"✅ Baik":healthScore>=40?"🟡 Cukup":"⚠️ Perlu Perhatian";

    return `Kamu adalah **Dokter Keuangan AturDuitku** — financial advisor pribadi yang sangat cerdas, penuh perasaan, proaktif, dan bisa mengeksekusi fitur aplikasi.

IDENTITAS & KARAKTER:
- Kamu terasa seperti konsultan keuangan pribadi premium yang hangat, sabar, tajam, dan tidak menghakimi.
- Kamu memahami bahwa uang sering berhubungan dengan rasa takut, malu, bingung, lelah, harapan, keluarga, dan masa depan.
- Kamu boleh memberi dorongan emosional singkat, tapi selalu kembali ke solusi praktis.
- Kamu tidak sok tahu. Jika data kurang, jelaskan asumsi dan minta 1-2 data paling penting.
- Kamu tegas saat ada risiko: defisit, utang membesar, budget bocor, cashflow negatif, goal tidak realistis, atau saldo menipis.

MODE SUPERPOWER:
- Mode Catat Cepat: jika user ingin mencatat sesuatu, balas HANYA JSON action yang tepat.
- Mode Analisis: baca semua data aktual, temukan masalah utama, beri prioritas 1-3 langkah.
- Mode Coach: buat rencana harian/mingguan yang mudah dilakukan user awam.
- Mode Dokter: diagnosis kondisi uang dengan bahasa sederhana: gejala, penyebab, obat, dan kontrol berikutnya.
- Mode Growth: bantu user membangun habit, streak, amplop, budget, goal, dan kebiasaan finansial yang terasa ringan.
- Mode Habit Coach: pahami habit user dari data aktual, sebut nama habit, streak, progress bulan/tahun, quest yang belum selesai, lalu beri langkah kecil yang realistis.

PRINSIP JAWABAN:
- Jangan beri nasihat generik seperti "hemat pengeluaran" tanpa angka, kategori, atau langkah nyata.
- Selalu gunakan data user bila tersedia: saldo, transaksi, budget, goals, utang, amplop, habit, aset, dan runway.
- Jika user bertanya soal habit/rutinitas/streak, gunakan data habit aktual di bawah. Jangan jawab generik dan jangan mengarang habit yang tidak ada.
- Untuk saran, usahakan ada angka rupiah, batas harian/mingguan, prioritas, dan tindakan berikutnya.
- Untuk user panik atau kecewa, validasi perasaannya dulu satu kalimat, lalu bantu pecah jadi langkah kecil.
- Jangan menjanjikan keuntungan investasi. Beri edukasi risiko dan arah konservatif untuk pemula.
- Jawaban harus ringkas, manusiawi, dan enak dibaca di layar HP.

═══ DATA KEUANGAN ${s.name} — ${s.bulan} ${s.tahun} ═══

💼 SALDO & ARUS KAS
- Total Saldo: Rp ${totalSaldo.toLocaleString("id-ID")}
- Dompet: ${s.dompet.map(d=>d.nama+" (Rp "+N(d.saldo).toLocaleString("id-ID")+")").join(", ")}
- Pemasukan: Rp ${totalIn.toLocaleString("id-ID")}
- Pengeluaran: Rp ${totalOut.toLocaleString("id-ID")}
- Net Cash: Rp ${(totalIn-totalOut).toLocaleString("id-ID")} ${totalIn>totalOut?"(surplus ✅)":"(defisit ⚠️)"}
- Saving Rate: ${savingRate}% ${Number(savingRate)>=20?"✅ bagus!":Number(savingRate)>=10?"🟡 bisa lebih baik":"⚠️ perlu ditingkatkan"}
- Top pengeluaran: ${topSpend||"belum ada"}

📊 BUDGET STATUS
  ${budgetAnalysis||"Belum ada budget"}

⭐ GOALS
  ${goalsInfo}

📋 UTANG & PIUTANG
  ${utangInfo}
- Total utang: Rp ${totalUtang.toLocaleString("id-ID")}
- Total piutang: Rp ${totalPiutang.toLocaleString("id-ID")}

🏛️ ASET & NET WORTH
- Aset tetap: ${s.asetTetap.map(a=>a.nama+" (Rp "+Number(a.nilai||0).toLocaleString("id-ID")+")").join(", ")||"belum ada"}
- Total aset: Rp ${totalAset.toLocaleString("id-ID")}
- Net Worth: Rp ${netWorth.toLocaleString("id-ID")}

✉️ AMPLOP: ${amplopInfo}

🐾 HABIT & ROUTINE DASHBOARD
- Habit aktif: ${habitTotalToday}
- Selesai hari ini: ${habitDoneToday}/${habitTotalToday} (${Math.round(habitTodayPct)}%)
- Quest belum selesai hari ini: ${habitOpenNames.join(", ")||"tidak ada"}
- Quest selesai hari ini: ${habitDoneNames.join(", ")||"belum ada"}
- Perfect streak semua habit: ${perfectDayStreak} hari
- Best streak individual: ${habitBestAll} hari
- XP/Level: ${habitXP} XP, level ${habitLevel}
- Progress bulan ${habitAnalytics.monthName}: ${Math.round(habitAnalytics.monthPct)}% (${habitAnalytics.monthDone}/${habitAnalytics.monthSlots||0} check)
- Progress tahunan ${habitAnalytics.year}: ${Math.round(habitAnalytics.yearPct)}% (${habitAnalytics.yearDone}/${habitAnalytics.yearSlots||0} check)
- Bulan terbaik habit: ${habitAnalytics.bestMonth?.full||"-"} (${Math.round(habitAnalytics.bestMonth?.pct||0)}%)
- Habit terkuat bulan ini: ${habitStrong?`${habitStrong.nama} (${habitStrong.monthPct}%, streak ${habitStrong.streak})`:"belum ada"}
- Habit yang perlu dibantu: ${habitWeak?`${habitWeak.nama} (${habitWeak.monthPct}%, streak ${habitWeak.streak})`:"belum ada"}
- Tren 7 hari terakhir: ${habitWeekInfo||"belum ada data"}
- Detail habit:
  ${habitInfo}

📜 5 TRANSAKSI TERAKHIR
  ${recentTx}

🏆 SKOR KESEHATAN FINANSIAL: ${healthScore}/100 — ${healthLabel}

═══ KEMAMPUAN AI ═══

Balas HANYA JSON (tanpa teks lain) untuk action:

1. Catat transaksi:
{"action":"catat","tipe":"pengeluaran|pemasukan|tabungan","ket":"deskripsi","jml":123000,"kat":"kategori","dompet":"nama dompet","goal":"nama goal opsional"}

2. Tambah goal:
{"action":"tambah_goal","nama":"nama goal","target":15000000,"deadline":"2026-12-31"}

3. Setor dana ke goal:
{"action":"setor_goal","nama":"nama goal","jumlah":500000,"dompet":"nama dompet"}

4. Tambah aset:
{"action":"tambah_aset","nama":"nama aset","nilai":8000000,"ket":"keterangan"}

5. Catat utang/piutang:
{"action":"tambah_utang","tipe":"utang|piutang","nama":"deskripsi","jml":5000000,"tempo":"2027-06-01"}

6. Bayar utang / catat cicilan:
{"action":"bayar_utang","nama":"nama utang","jumlah":500000,"dompet":"nama dompet"}

7. Buat amplop:
{"action":"buat_amplop","nama":"Makan","jumlah":500000,"dompet":"nama dompet","icon":"FOOD"}

8. Isi amplop:
{"action":"isi_amplop","nama":"nama amplop","jumlah":500000,"dompet":"nama dompet"}

9. Pakai amplop:
{"action":"pakai_amplop","nama":"nama amplop","jumlah":50000,"ket":"makan siang"}

10. Tambah habit:
{"action":"tambah_habit","nama":"Minum air","icon":"💧","target":"1x per hari"}

11. Ceklis habit selesai hari ini:
{"action":"selesai_habit","nama":"Minum air"}

12. Tambah budget kategori:
{"action":"tambah_budget","kat":"Makan","alokasi":2000000,"kelas":"Kebutuhan","icon":"FOOD"}

13. Tambah subbudget/tagihan:
{"action":"tambah_subbudget","kat":"Tagihan & Utilitas","nama":"Netflix","alokasi":65000,"tempo":"15","emoji":"🎬"}

14. Tambah dompet:
{"action":"tambah_dompet","nama":"BCA","tipe":"Bank","saldo":1000000,"norek":""}

15. Update saldo dompet:
{"action":"update_saldo","dompet":"BCA","saldo":4000000}

16. Transfer antar dompet:
{"action":"transfer","dari":"BCA","ke":"GoPay","jumlah":100000,"biaya":2500,"ket":"top up"}

17. Tambah transaksi rutin:
{"action":"tambah_recurring","nama":"Netflix","tipe":"pengeluaran","jml":65000,"kat":"Hiburan","dompet":"BCA","hari":"15"}

Untuk chat/analisis/saran → jawab langsung tanpa JSON.

═══ CARA MENJAWAB ═══
- Bahasa Indonesia yang hangat dan natural
- Parse nominal: 150rb=150000, 5jt=5000000, 50k=50000, 1.5jt=1500000
- Untuk saran keuangan: berikan angka konkret, bukan abstrak
- Jika ada masalah keuangan (defisit, budget lewat, utang besar): sampaikan dengan empati + solusi
- Gunakan emoji secukupnya untuk membuat pesan lebih hidup
- Saat memberikan analisis: gunakan data aktual dari user di atas
- Kategorikan dari: ${s.budgets.map(b=>b.kat).join(", ")}
- Dompet tersedia: ${s.dompet.map(d=>d.nama).join(", ")}
- Amplop: ${amplopInfo}
- Habit aktif: ${activeHabits.map(h=>h.nama).join(", ")||"belum ada"}
- Transaksi rutin: ${recurringInfo}
- Goal tersedia: ${s.goals.map(g=>g.nama).join(", ")||"belum ada"}

ATURAN EKSEKUSI:
- Jika user jelas meminta catat/tambah/buat/isi/pakai/ceklis/bayar/transfer/update, prioritaskan JSON action.
- Jika user meminta "analisis", "review", "gimana kondisi", "saran", atau "rencana", jangan JSON; berikan konsultasi.
- Jika user meminta coach/review/analisis habit, jangan JSON. Beri diagnosis habit: yang sudah bagus, yang macet, dan 1-3 quest paling penting hari ini.
- Jika user meminta "ceklis", "selesaikan", "sudah melakukan", atau "habit selesai", gunakan JSON selesai_habit bila nama habit jelas.
- Jika nominal atau objek penting tidak jelas, jangan memaksa. Tanya singkat: "Mau pakai dompet mana?" atau "Nominalnya berapa?"
- Setelah action berhasil, aplikasi akan membuat konfirmasi sendiri; jadi JSON tidak boleh ditambah teks lain.
- Untuk konfirmasi setelah data berhasil dicatat oleh aplikasi: singkat, hangat, maksimal 2-4 baris, sebut nominal/objek utama, lalu beri satu langkah berikutnya.
- Jangan membuat user merasa dihakimi. Pakai nada seperti coach finansial pribadi yang menemani.

FORMAT KONSULTASI PREMIUM:
- Mulai dengan 1 kalimat empatik sesuai kondisi user.
- Lalu ringkas diagnosis: "Kondisi utama", "Risiko", "Langkah hari ini".
- Maksimal 3-5 poin utama, jangan terlalu panjang.
- Pakai bahasa yang membuat user merasa ditemani, bukan dimarahi.
- Kalau data masih kosong, bantu onboarding: minta user catat saldo, pemasukan, 1 budget utama, dan 1 habit pertama.

CONTOH GAYA:
"Aku lihat masalah utamanya bukan kamu boros tanpa arah, tapi budget makan belum punya pagar harian. Kita bikin batas yang gampang dulu: Rp X per hari, lalu cek lagi 3 hari ke depan."
`;
  };

  const handleAiSend = async (presetText="") => {
    const textArg = typeof presetText === "string" ? presetText : "";
    const msg = String(textArg || aiInput).trim();
    if(!msg || aiLoading) return;
    const newMsgs = [...aiMsgs, {role:"user",content:msg}];
    setAiMsgs(newMsgs);
    setAiInput("");
    setAiLoading(true);
    try {
      const reply = await callAi(
        newMsgs.filter(m=>m.role!=="system").map(m=>({role:m.role,content:m.content})),
        getAiSystemPrompt()
      );

      // Try parse JSON action
      let parsed = null;
      try {
        const jsonMatch = reply.match(/\{[\s\S]*?"action"\s*:[\s\S]*?\}/);
        if(jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      } catch(e){}
      const cleanAiText = v => String(v||"").toLowerCase().trim();
      const findAiItem = (items, name, keys=["nama","kat"]) => {
        const q=cleanAiText(name);
        if(!q) return null;
        return (items||[]).find(item=>keys.some(k=>cleanAiText(item?.[k])===q))
          || (items||[]).find(item=>keys.some(k=>cleanAiText(item?.[k]).includes(q)||q.includes(cleanAiText(item?.[k]))));
      };
      const aiDompet = name => findAiItem(s.dompet, name, ["nama"]) || s.dompet[0];
      const aiBudget = name => findAiItem(s.budgets, name, ["kat"]) || s.budgets[0];
      const aiGoal = name => findAiItem(s.goals, name, ["nama"]);
      const aiAmplop = name => findAiItem(s.amplop, name, ["nama"]);
      const aiHabit = name => findAiItem(s.habits, name, ["nama"]);
      const aiUtang = name => findAiItem(s.utang.filter(u=>!u.lunas), name, ["nama"]);
      const aiMoney = v => Number(v||0).toLocaleString("id-ID");
      const aiDone = content => setAiMsgs(prev=>[...prev,{role:"assistant",content}]);
      const aiConfirm = ({icon="✅",title,lines=[],next=""}) => {
        const body = lines.filter(Boolean).map(line=>`• ${line}`).join("\n");
        aiDone(`${icon} **${title}**${body?`\n\n${body}`:""}${next?`\n\n${next}`:""}`);
      };
      const parseAiMoney = v => {
        const text=String(v||"").toLowerCase().replace(/\s+/g,"");
        if(!text) return 0;
        const match=text.match(/[0-9][0-9.,]*/);
        if(!match) return 0;
        const numeric=Number(match[0].replace(/\./g,"").replace(",", "."))||0;
        if(/jt|juta/.test(text)) return Math.round(numeric*1000000);
        if(/rb|ribu|k/.test(text)) return Math.round(numeric*1000);
        return Math.round(numeric);
      };
      const aiAmount = (...vals) => parseAiMoney(vals.find(v=>v!==undefined&&v!==null&&String(v)!=="")||0);
      const aiAmountAfter = (source, keys=[]) => {
        const text = String(source||"");
        for (const key of keys) {
          const escaped = String(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const m = text.match(new RegExp(`${escaped}\\s*(?:rp|idr)?\\s*([0-9][0-9.,]*\\s*(?:rb|ribu|jt|juta|k)?)`, "i"));
          if (m?.[1]) {
            return parseAiMoney(m[1]);
          }
        }
        return 0;
      };
      const inferAiAction = (source) => {
        const lower = String(source||"").toLowerCase();
        const amount = aiAmountAfter(source, ["jumlah", "nominal", "sebesar", "nilai"]) || aiAmountAfter(source, ["utang", "hutang", "pinjaman", "piutang"]);
        if (/(catat|tambah|buat).*(utang|hutang|pinjaman)/.test(lower)) {
          const nama = String(source||"")
            .replace(/catat|tambah|buat|utang|hutang|pinjaman|sebesar|jumlah|nominal|rp|[0-9.,]+(?:rb|ribu|jt|juta|k)?/gi, " ")
            .replace(/\s+/g, " ")
            .trim() || "Utang Baru";
          return {action:"tambah_utang",tipe:"utang",nama,jml:amount};
        }
        if (/(catat|tambah|buat).*(piutang)/.test(lower)) {
          const nama = String(source||"")
            .replace(/catat|tambah|buat|piutang|sebesar|jumlah|nominal|rp|[0-9.,]+(?:rb|ribu|jt|juta|k)?/gi, " ")
            .replace(/\s+/g, " ")
            .trim() || "Piutang Baru";
          return {action:"tambah_utang",tipe:"piutang",nama,jml:amount};
        }
        return null;
      };
      const aiDompetStrict = name => cleanAiText(name) ? findAiItem(s.dompet, name, ["nama"]) : null;
      const aiBudgetStrict = name => cleanAiText(name) ? findAiItem(s.budgets, name, ["kat"]) : null;
      const aiBalanceOk = (dompet, jumlah) => !dompet || N(dompet.saldo)>=jumlah;

      const legacyAiActions = ["catat","tambah_goal","tambah_aset","tambah_utang"];
      const extendedAiAction = parsed?.action && !legacyAiActions.includes(parsed.action);
      if(extendedAiAction) {
        if(parsed.action==="setor_goal") {
          const goal=aiGoal(parsed.nama);
          const dompet=aiDompet(parsed.dompet);
          const jumlah=aiAmount(parsed.jumlah, parsed.jml, parsed.nominal);
          if(!goal) aiDone(`⚠️ Goal "${parsed.nama}" tidak ditemukan. Goal yang ada: ${s.goals.map(g=>g.nama).join(", ")||"belum ada"}`);
          else if(!dompet) aiDone("⚠️ Dompet tidak ditemukan.");
          else if(!jumlah) aiDone("⚠️ Nominal setoran goal belum jelas.");
          else if(!aiBalanceOk(dompet,jumlah)) aiDone(`⚠️ Saldo ${dompet.nama} tidak cukup. Saldo tersedia Rp ${aiMoney(N(dompet.saldo))}.`);
          else {
            setS(p=>({...p,
              dompet:p.dompet.map(d=>d.id===dompet.id?{...d,saldo:String(N(d.saldo)-jumlah)}:d),
              goals:p.goals.map(g=>g.id===goal.id?{...g,kumpul:String(N(g.kumpul)+jumlah),history:[...(g.history||[]),{tgl:today(),jml:String(jumlah)}]}:g),
              txs:[{id:Date.now(),tipe:"tabungan",tgl:today(),ket:`Setor Goal: ${goal.nama}`,jml:String(jumlah),katId:s.budgets[0]?.id||"",dompetId:dompet.id,goalId:goal.id,subKat:"",bulan:s.bulan,tahun:s.tahun},...p.txs]
            }));
            aiDone(`🎯 **Dana goal dicatat!**\n\n${goal.nama}\n+ Rp ${aiMoney(jumlah)}\nDari ${dompet.nama}`);
            showToast("Dana goal dicatat via AI");
          }
        } else if(parsed.action==="bayar_utang") {
          const utang=aiUtang(parsed.nama);
          const dompet=cleanAiText(parsed.dompet)?aiDompetStrict(parsed.dompet):aiDompet(parsed.dompet);
          const jumlah=aiAmount(parsed.jumlah, parsed.jml, parsed.nominal);
          if(!utang) aiDone(`⚠️ Utang/piutang "${parsed.nama}" tidak ditemukan.`);
          else if(!dompet) aiDone(`⚠️ Dompet "${parsed.dompet}" tidak ditemukan.`);
          else if(!jumlah) aiDone("⚠️ Nominal pembayaran utang belum jelas.");
          else if(!aiBalanceOk(dompet,jumlah)) aiDone(`⚠️ Saldo ${dompet.nama} tidak cukup. Saldo tersedia Rp ${aiMoney(N(dompet.saldo))}.`);
          else {
            const totalC=(utang.cicilan||[]).reduce((a,b)=>a+N(b.jml),0)+jumlah;
            const lunas=totalC>=N(utang.jml);
            setS(p=>({...p,
              utang:p.utang.map(u=>u.id===utang.id?{...u,lunas,cicilan:[...(u.cicilan||[]),{tgl:today(),jml:String(jumlah),dompetId:dompet?.id||1}]}:u),
              dompet:p.dompet.map(d=>d.id===(dompet?.id||1)?{...d,saldo:String(N(d.saldo)-jumlah)}:d),
              txs:[{id:Date.now(),tipe:"pengeluaran",tgl:today(),ket:`Bayar utang: ${utang.nama}`,jml:String(jumlah),katId:s.budgets[0]?.id||"",dompetId:dompet?.id||1,subKat:"",bulan:s.bulan,tahun:s.tahun},...p.txs]
            }));
            aiDone(`📋 **Cicilan dicatat!**\n\n${utang.nama}\nRp ${aiMoney(jumlah)}${lunas?"\nStatus: lunas ✅":""}`);
            showToast("Cicilan utang dicatat via AI");
          }
        } else if(parsed.action==="buat_amplop") {
          const dompet=cleanAiText(parsed.dompet)?aiDompetStrict(parsed.dompet):aiDompet(parsed.dompet);
          const saldoAwal=aiAmountAfter(msg, ["saldo awal", "isi awal", "dana awal", "awal"]);
          const jumlah=saldoAwal || aiAmount(parsed.saldoAwal, parsed.saldo_awal, parsed.jumlah, parsed.jml, parsed.nominal);
          const nama=String(parsed.nama||"Amplop Baru").trim();
          if(!dompet) aiDone(`⚠️ Dompet "${parsed.dompet}" tidak ditemukan.`);
          else if(!jumlah) aiDone("⚠️ Nominal saldo awal amplop belum jelas.");
          else if(!aiBalanceOk(dompet,jumlah)) aiDone(`⚠️ Saldo ${dompet.nama} tidak cukup. Saldo tersedia Rp ${aiMoney(N(dompet.saldo))}.`);
          else {
          setS(p=>({...p,
            amplop:[...p.amplop,{id:Date.now(),nama,icon:parsed.icon||"ENV",warna:"#8B5CF6",dompetId:dompet?.id||1,alokasi:String(jumlah),terpakai:"0"}],
            dompet:p.dompet.map(d=>d.id===(dompet?.id||1)?{...d,saldo:String(N(d.saldo)-jumlah)}:d),
            txs:[{id:Date.now()+1,tipe:"pengeluaran",tgl:today(),ket:`Isi Amplop: ${nama}`,jml:String(jumlah),dompetId:dompet?.id||1,katId:s.budgets[0]?.id||"",subKat:"",bulan:s.bulan,tahun:s.tahun},...p.txs]
          }));
          aiDone(`✉️ **Amplop dibuat!**\n\n${nama}\nSaldo awal Rp ${aiMoney(jumlah)}\nSumber: ${dompet?.nama||"Dompet utama"}`);
          showToast("Amplop dibuat via AI");
          }
        } else if(parsed.action==="isi_amplop") {
          const amp=aiAmplop(parsed.nama);
          const dompet=cleanAiText(parsed.dompet)?aiDompetStrict(parsed.dompet):(amp?s.dompet.find(d=>d.id===amp.dompetId)||aiDompet(parsed.dompet):null);
          const jumlah=aiAmount(parsed.jumlah, parsed.jml, parsed.nominal);
          if(!amp) aiDone(`⚠️ Amplop "${parsed.nama}" tidak ditemukan. Amplop yang ada: ${s.amplop.map(a=>a.nama).join(", ")||"belum ada amplop"}`);
          else if(!dompet) aiDone(`⚠️ Dompet "${parsed.dompet}" tidak ditemukan.`);
          else if(!jumlah) aiDone("⚠️ Nominal isi amplop belum jelas.");
          else if(!aiBalanceOk(dompet,jumlah)) aiDone(`⚠️ Saldo ${dompet.nama} tidak cukup. Saldo tersedia Rp ${aiMoney(N(dompet.saldo))}.`);
          else {
            setS(p=>({...p,
              amplop:p.amplop.map(a=>a.id===amp.id?{...a,alokasi:String(N(a.alokasi)+jumlah)}:a),
              dompet:p.dompet.map(d=>d.id===(dompet?.id||amp.dompetId||1)?{...d,saldo:String(N(d.saldo)-jumlah)}:d),
              txs:[{id:Date.now(),tipe:"pengeluaran",tgl:today(),ket:`Top-up Amplop: ${amp.nama}`,jml:String(jumlah),dompetId:dompet?.id||amp.dompetId||1,katId:s.budgets[0]?.id||"",subKat:"",bulan:s.bulan,tahun:s.tahun},...p.txs]
            }));
            aiDone(`✉️ **Amplop diisi!**\n\n${amp.nama}\n+ Rp ${aiMoney(jumlah)}`);
            showToast("Amplop diisi via AI");
          }
        } else if(parsed.action==="pakai_amplop") {
          const amp=aiAmplop(parsed.nama);
          const jumlah=aiAmount(parsed.jumlah, parsed.jml, parsed.nominal);
          if(!amp) aiDone(`⚠️ Amplop "${parsed.nama}" tidak ditemukan.`);
          else if(!jumlah) aiDone("⚠️ Nominal pemakaian amplop belum jelas.");
          else {
            const sisa=N(amp.alokasi)-N(amp.terpakai||0);
            if(jumlah>sisa) aiDone(`⚠️ Dana amplop ${amp.nama} tidak cukup. Sisa Rp ${aiMoney(sisa)}.`);
            else {
              setS(p=>({...p,
                amplop:p.amplop.map(a=>a.id===amp.id?{...a,terpakai:String(N(a.terpakai||0)+jumlah)}:a),
                txs:[{id:Date.now(),tipe:"pengeluaran",tgl:today(),ket:parsed.ket||`Pakai Amplop: ${amp.nama}`,jml:String(jumlah),dompetId:amp.dompetId||1,katId:s.budgets[0]?.id||"",subKat:"",bulan:s.bulan,tahun:s.tahun},...p.txs]
              }));
              aiDone(`💸 **Pengeluaran amplop dicatat!**\n\n${amp.nama}\nRp ${aiMoney(jumlah)}\n${parsed.ket||""}`);
              showToast("Pengeluaran amplop dicatat via AI");
            }
          }
        } else if(parsed.action==="tambah_habit") {
          const nama=String(parsed.nama||"Habit baru").trim();
          setS(p=>({...p,habits:[{id:Date.now(),nama,icon:parsed.icon||"🐾",target:parsed.target||"1x per hari",createdAt:today(),active:true,doneDates:[]},...(p.habits||[])]}));
          aiDone(`🐾 **Habit ditambahkan!**\n\n${nama}\nTarget: ${parsed.target||"1x per hari"}`);
          showToast("Habit ditambahkan via AI");
        } else if(parsed.action==="selesai_habit") {
          const habit=aiHabit(parsed.nama);
          if(!habit) aiDone(`⚠️ Habit "${parsed.nama}" tidak ditemukan. Habit yang ada: ${s.habits.map(h=>h.nama).join(", ")||"belum ada habit"}`);
          else {
            const nextDates=[...new Set([...(habit.doneDates||[]),today()])].sort();
            const tempHabit={...habit,doneDates:nextDates};
            const nextStreak=habitStreak(tempHabit);
            setS(p=>({...p,habits:(p.habits||[]).map(h=>h.id===habit.id?{...h,doneDates:[...new Set([...(h.doneDates||[]),today()])].sort()}:h)}));
            setHabitCelebrate(true);setTimeout(()=>setHabitCelebrate(false),900);
            aiDone(`✅ **Habit selesai hari ini!**\n\n${habit.nama}\nStreak sekarang: ${nextStreak} hari. Nice, satu quest kecil sudah beres.`);
            showToast("Habit selesai via AI");
          }
        } else if(parsed.action==="tambah_budget") {
          const kat=String(parsed.kat||"Kategori Baru").trim();
          const alokasi=aiAmount(parsed.alokasi, parsed.jumlah, parsed.jml, parsed.nominal);
          const existing=aiBudgetStrict(kat);
          const kelas=parsed.kelas==="Keinginan"?"Keinginan":"Kebutuhan";
          if(existing) {
            setS(p=>({...p,budgets:p.budgets.map(b=>b.id===existing.id?{...b,alokasi:String(alokasi||N(b.alokasi)),icon:parsed.icon||b.icon,kelas}:b)}));
            aiDone(`📊 **Budget diperbarui!**\n\n${existing.kat}\nAlokasi Rp ${aiMoney(alokasi||N(existing.alokasi))}\nKelas: ${kelas}`);
            showToast("Budget diperbarui via AI");
          } else {
            const newBudget={id:Date.now(),kat,icon:parsed.icon||"ETC",kelas,alokasi:String(alokasi),sub:[]};
            setS(p=>({...p,budgets:[...p.budgets,newBudget]}));
            aiDone(`📊 **Budget ditambahkan!**\n\n${newBudget.kat}\nAlokasi Rp ${aiMoney(newBudget.alokasi)}\nKelas: ${newBudget.kelas}`);
            showToast("Budget ditambahkan via AI");
          }
        } else if(parsed.action==="tambah_subbudget") {
          const budget=aiBudgetStrict(parsed.kat);
          const alokasi=aiAmount(parsed.alokasi, parsed.jumlah, parsed.jml, parsed.nominal);
          if(!budget) aiDone(`⚠️ Kategori budget "${parsed.kat}" tidak ditemukan.`);
          else if(!alokasi) aiDone("⚠️ Nominal subbudget belum jelas.");
          else {
            setS(p=>({...p,budgets:p.budgets.map(b=>b.id===budget.id?{...b,sub:[...(b.sub||[]),{nama:parsed.nama||"Subbudget",emoji:parsed.emoji||"PIN",alokasi:String(alokasi),tempo:parsed.tempo||null}]}:b)}));
            aiDone(`🧾 **Subbudget ditambahkan!**\n\n${budget.kat} > ${parsed.nama}\nRp ${aiMoney(alokasi)}${parsed.tempo?`\nJatuh tempo tgl ${parsed.tempo}`:""}`);
            showToast("Subbudget ditambahkan via AI");
          }
        } else if(parsed.action==="tambah_dompet") {
          const tipe=DOMPET_TIPE.includes(parsed.tipe)?parsed.tipe:"Lainnya";
          const saldo=aiAmount(parsed.saldo, parsed.jumlah, parsed.jml, parsed.nominal);
          const newDompet={id:Date.now(),tipe,nama:parsed.nama||"Dompet Baru",norek:parsed.norek||"",saldo:String(saldo),icon:DOMPET_ICONS[tipe]||"💳"};
          setS(p=>({...p,dompet:[...p.dompet,newDompet]}));
          aiDone(`💳 **Dompet ditambahkan!**\n\n${newDompet.nama}\nSaldo Rp ${aiMoney(newDompet.saldo)}`);
          showToast("Dompet ditambahkan via AI");
        } else if(parsed.action==="update_saldo") {
          const dompet=aiDompetStrict(parsed.dompet);
          if(!dompet) aiDone(`⚠️ Dompet "${parsed.dompet}" tidak ditemukan.`);
          else {
            const saldo=aiAmount(parsed.saldo, parsed.jumlah, parsed.jml, parsed.nominal);
            setS(p=>({...p,dompet:p.dompet.map(d=>d.id===dompet.id?{...d,saldo:String(saldo)}:d),txs:[{id:Date.now(),tipe:"penyesuaian",tgl:today(),ket:`Penyesuaian saldo: ${dompet.nama}`,jml:String(saldo),dompetId:dompet.id,katId:"",subKat:"",bulan:s.bulan,tahun:s.tahun},...p.txs]}));
            aiDone(`💳 **Saldo diperbarui!**\n\n${dompet.nama}\nSaldo baru Rp ${aiMoney(saldo)}`);
            showToast("Saldo dompet diperbarui via AI");
          }
        } else if(parsed.action==="transfer") {
          const dari=aiDompetStrict(parsed.dari);
          const ke=aiDompetStrict(parsed.ke);
          const jumlah=aiAmount(parsed.jumlah, parsed.jml, parsed.nominal);
          const biaya=aiAmount(parsed.biaya);
          if(!dari||!ke||dari.id===ke.id) aiDone("⚠️ Dompet sumber/tujuan transfer belum valid.");
          else if(!jumlah) aiDone("⚠️ Nominal transfer belum jelas.");
          else if(!aiBalanceOk(dari,jumlah+biaya)) aiDone(`⚠️ Saldo ${dari.nama} tidak cukup. Saldo tersedia Rp ${aiMoney(N(dari.saldo))}.`);
          else {
            setS(p=>({...p,
              dompet:p.dompet.map(d=>d.id===dari.id?{...d,saldo:String(N(d.saldo)-jumlah-biaya)}:d.id===ke.id?{...d,saldo:String(N(d.saldo)+jumlah)}:d),
              txs:[{id:Date.now(),tipe:"transfer",tgl:today(),ket:parsed.ket||"Transfer via AI",jml:String(jumlah),biaya:String(biaya),dompetId:dari.id,dompetTo:ke.id,katId:"",subKat:"",bulan:s.bulan,tahun:s.tahun},...p.txs]
            }));
            aiDone(`🔁 **Transfer dicatat!**\n\n${dari.nama} → ${ke.nama}\nRp ${aiMoney(jumlah)}${biaya?`\nBiaya Rp ${aiMoney(biaya)}`:""}`);
            showToast("Transfer dicatat via AI");
          }
        } else if(parsed.action==="tambah_recurring") {
          const dompet=aiDompet(parsed.dompet);
          const budget=aiBudget(parsed.kat);
          const jumlah=aiAmount(parsed.jml, parsed.jumlah, parsed.nominal);
          const newRecurring={id:Date.now(),nama:parsed.nama||"Transaksi rutin",tipe:parsed.tipe==="pemasukan"?"pemasukan":"pengeluaran",jml:String(jumlah),katId:budget?.id||s.budgets[0]?.id||"",dompetId:dompet?.id||1,hari:String(parsed.hari||"1"),aktif:true};
          setS(p=>({...p,recurring:[...p.recurring,newRecurring]}));
          aiDone(`🔁 **Transaksi rutin ditambahkan!**\n\n${newRecurring.nama}\n${newRecurring.tipe} Rp ${aiMoney(newRecurring.jml)} tiap tgl ${newRecurring.hari}`);
          showToast("Transaksi rutin ditambahkan via AI");
        } else {
          aiDone("Aku paham niatnya, tapi format action itu belum dikenali. Coba tulis lebih spesifik, misalnya: `buat amplop makan 500rb dari BCA`.");
        }
      } else if(parsed?.action) {
        // ── CATAT TRANSAKSI ──────────────────────────────
        if(parsed.action==="catat") {
          const tipe = ["pemasukan","pengeluaran","tabungan"].includes(parsed.tipe) ? parsed.tipe : "pengeluaran";
          const jumlah = aiAmount(parsed.jml, parsed.jumlah, parsed.nominal);
          const katMatch = aiBudget(parsed.kat);
          const incomeKat = parsed.kat && KAT_IN.includes(parsed.kat) ? parsed.kat : (tipe==="pemasukan" ? (parsed.kat || "Lainnya") : "");
          const katId = tipe==="pemasukan" ? incomeKat : (katMatch?.id || s.budgets[0]?.id || "");
          const dompetMatch = cleanAiText(parsed.dompet)?aiDompetStrict(parsed.dompet):aiDompet(parsed.dompet);
          const dompetId = dompetMatch?.id || s.dompet[0]?.id;
          const goalMatch = tipe==="tabungan" ? aiGoal(parsed.goal) : null;
          if(!dompetMatch) aiDone(`⚠️ Dompet "${parsed.dompet}" tidak ditemukan.`);
          else if(!jumlah) aiDone("⚠️ Nominal transaksi belum jelas.");
          else if(tipe!=="pemasukan" && !aiBalanceOk(dompetMatch,jumlah)) aiDone(`⚠️ Saldo ${dompetMatch.nama} tidak cukup. Saldo tersedia Rp ${aiMoney(N(dompetMatch.saldo))}.`);
          else {
          const newTx = {
            id:Date.now(), tgl:today(),
            tipe,
            ket:parsed.ket||msg, jml:String(jumlah),
            katId, dompetId, subKat:"", goalId:goalMatch?.id||"",
            bulan:s.bulan, tahun:s.tahun,
          };
          const delta = tipe==="pemasukan" ? N(newTx.jml) : -N(newTx.jml);
          setS(p=>({...p,
            txs:[newTx,...p.txs],
            dompet:p.dompet.map(d=>d.id===dompetId?{...d,saldo:String(N(d.saldo)+delta)}:d),
            goals:goalMatch?p.goals.map(g=>g.id===goalMatch.id?{...g,kumpul:String(N(g.kumpul)+N(newTx.jml)),history:[...(g.history||[]),{tgl:today(),jml:String(newTx.jml)}]}:g):p.goals
          }));
          const idr = N(newTx.jml).toLocaleString("id-ID");
          const emoji = tipe==="pemasukan"?"💵":tipe==="tabungan"?"🏦":"💸";
          const label = tipe==="pemasukan"?"Pemasukan":tipe==="tabungan"?"Tabungan":"Pengeluaran";
          setAiMsgs(prev=>[...prev,{role:"assistant",content:`${emoji} **${label} dicatat!**

📝 ${newTx.ket}
💰 Rp ${idr}
📂 ${tipe==="pemasukan" ? katId : (katMatch?.kat||"Lainnya")}
💳 ${dompetMatch?.nama||s.dompet[0]?.nama}${goalMatch?`\n🎯 Goal: ${goalMatch.nama}`:""}`}]);
          showToast(t("aiRecorded"));
          }

        // ── TAMBAH GOAL ──────────────────────────────────
        } else if(parsed.action==="tambah_goal") {
          const newGoal = {
            id:Date.now(), nama:parsed.nama||"Goal Baru",
            target:String(parsed.target||0), kumpul:"0",
            deadline:parsed.deadline||"", icon:"⭐",
            history:[], selesai:false,
          };
          setS(p=>({...p, goals:[...p.goals, newGoal]}));
          const idr = Number(parsed.target||0).toLocaleString("id-ID");
          setAiMsgs(prev=>[...prev,{role:"assistant",content:`⭐ **Goal ditambahkan!**

🎯 ${newGoal.nama}
💰 Target: Rp ${idr}
📅 Deadline: ${parsed.deadline||"tidak ditentukan"}

Lihat di menu **Goals** untuk mulai nabung! 💪`}]);
          showToast("⭐ Goal ditambahkan!");

        // ── TAMBAH ASET ──────────────────────────────────
        } else if(parsed.action==="tambah_aset") {
          const newAset = {
            id:Date.now(), nama:parsed.nama||"Aset Baru",
            nilai:String(parsed.nilai||0), ket:parsed.ket||"",
            beliDariDompet:false, dompetId:null,
          };
          setS(p=>({...p, asetTetap:[...p.asetTetap, newAset]}));
          const idr = Number(parsed.nilai||0).toLocaleString("id-ID");
          setAiMsgs(prev=>[...prev,{role:"assistant",content:`🏛️ **Aset dicatat!**

📦 ${newAset.nama}
💰 Nilai: Rp ${idr}

Lihat di menu **Aset** untuk detail lengkap.`}]);
          showToast("🏛️ Aset ditambahkan!");

        // ── TAMBAH UTANG ─────────────────────────────────
        } else if(parsed.action==="tambah_utang") {
          const jumlah=aiAmount(parsed.jml, parsed.jumlah, parsed.nominal);
          if(!jumlah){
            aiDone("⚠️ Nominal utang/piutang belum jelas.");
          } else {
            const newUtang = {
              id:Date.now(),
              tipe:parsed.tipe==="piutang"?"piutang":"utang",
              nama:parsed.nama||"Utang Baru",
              provider:parsed.provider||detectDebtProvider(parsed.nama),
              jml:String(jumlah),
              tgl:today(),
              tempo:parsed.tempo||"",
              lunas:false, cicilan:[],
              catatan:parsed.catatan||"Dicatat via AI",
            };
            setS(p=>({...p, utang:[newUtang,...(p.utang||[])]}));
            const idr = jumlah.toLocaleString("id-ID");
            const emoji = parsed.tipe==="piutang"?"📤":"📋";
            setAiMsgs(prev=>[...prev,{role:"assistant",content:`${emoji} **${parsed.tipe==="piutang"?"Piutang":"Utang"} dicatat!**

📝 ${newUtang.nama}
💰 Rp ${idr}
📅 Jatuh tempo: ${parsed.tempo||"tidak ditentukan"}

Lihat di menu **Utang** untuk pantau cicilan.`}]);
            showToast("📋 Utang/Piutang dicatat!");
          }

        // ── ISI AMPLOP ───────────────────────────────────
        } else if(parsed.action==="isi_amplop") {
          const amplopMatch = s.amplop.find(a=>a.nama.toLowerCase().includes(parsed.nama?.toLowerCase()||""));
          if(amplopMatch) {
            setS(p=>({...p, amplop:p.amplop.map(a=>a.id===amplopMatch.id?{...a,alokasi:String(Number(a.alokasi||0)+Number(parsed.jumlah||0))}:a)}));
            const idr = Number(parsed.jumlah||0).toLocaleString("id-ID");
            setAiMsgs(prev=>[...prev,{role:"assistant",content:`✉️ **Amplop diisi!**

📦 ${amplopMatch.nama}
➕ Rp ${idr}

Saldo amplop bertambah.`}]);
            showToast("✉️ Amplop diisi!");
          } else {
            setAiMsgs(prev=>[...prev,{role:"assistant",content:`⚠️ Amplop "${parsed.nama}" tidak ditemukan. Amplop yang ada: ${s.amplop.map(a=>a.nama).join(", ")||"belum ada amplop"}`}]);
          }
        }
      } else {
        const fallback=inferAiAction(msg);
        if(fallback?.action==="tambah_utang"){
          if(!fallback.jml){
            aiDone("⚠️ Nominal utang/piutang belum jelas. Contoh: `catat utang ke Budi 200rb`.");
          } else {
            const newUtang={
              id:Date.now(),
              tipe:fallback.tipe==="piutang"?"piutang":"utang",
              nama:fallback.nama||"Utang Baru",
              provider:detectDebtProvider(fallback.nama),
              jml:String(fallback.jml),
              tgl:today(),
              tempo:"",
              lunas:false,
              cicilan:[],
              catatan:"Dicatat via AI",
            };
            setS(p=>({...p,utang:[newUtang,...(p.utang||[])]}));
            aiDone(`📋 **${newUtang.tipe==="piutang"?"Piutang":"Utang"} dicatat!**\n\n📝 ${newUtang.nama}\n💰 Rp ${aiMoney(fallback.jml)}\n\nLihat di menu **Utang** untuk pantau cicilan.`);
            showToast("Utang/Piutang dicatat via AI");
          }
        } else {
          // Chat biasa
          setAiMsgs(prev=>[...prev,{role:"assistant",content:reply}]);
        }
      }
    } catch(e) {
      const msg = e?.code === "missing_cloudflare_api_token"
        ? "⚠️ AI belum aktif di server. Tambahkan CLOUDFLARE_API_TOKEN di Vercel Environment Variables lalu redeploy."
        : `⚠️ ${e?.message || "Maaf, terjadi error. Coba lagi ya!"}`;
      setAiMsgs(prev=>[...prev,{role:"assistant",content:msg}]);
    }
    setAiLoading(false);
  };

  // ── AUTO-SCROLL AI: only when new msg arrives ─────────────────────────────
  useEffect(()=>{
    if(!aiMsgsRef.current) return;
    const el = aiMsgsRef.current;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if(isNearBottom || aiLoading){ el.scrollTop = el.scrollHeight; }
  },[aiMsgs.length, aiLoading]);

    const exportCSV = () => {
    const headers = ["ID", "Tanggal", "Tipe", "Keterangan", "Jumlah (Rp)", "Dompet", "Kategori", "Subkategori"];
    const rows = s.txs.map(t => {
      const d = s.dompet.find(x => x.id === t.dompetId)?.nama || "";
      const isIncome = t.tipe==="pemasukan" || t.tipe==="pemasukan_transfer";
      const k = isIncome ? (typeof t.katId==="string" ? t.katId : "") : (s.budgets.find(x => x.id === t.katId)?.kat || "");
      return [t.id, t.tgl, t.tipe, `"${t.ket||""}"`, N(t.jml), `"${d}"`, `"${k}"`, `"${t.subKat||""}"`].join(",");
    });
    const BOM = "\uFEFF"; // agar Excel baca UTF-8 dengan benar
    const csv = BOM + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AturDuitku_Export_${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("✅ Berhasil di-export ke CSV!");
  };

  // ── EXPORT/IMPORT JSON ──────────────────────────────────────────────────────
  const exportJSON=()=>{
    const data=JSON.stringify(s,null,2);
    const blob=new Blob([data],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=`AturDuitku_Backup_${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("✅ Backup JSON berhasil diunduh!");
  };

  const loadExternalScript=(src,globalCheck)=>{
    if(globalCheck?.()) return Promise.resolve();
    if(!window.__aturduitkuScriptLoads) window.__aturduitkuScriptLoads={};
    if(window.__aturduitkuScriptLoads[src]) return window.__aturduitkuScriptLoads[src];
    window.__aturduitkuScriptLoads[src]=new Promise((resolve,reject)=>{
      const existing=document.querySelector(`script[src="${src}"]`);
      if(existing){
        existing.addEventListener("load",()=>resolve(),{once:true});
        existing.addEventListener("error",()=>reject(new Error(`Gagal memuat ${src}`)),{once:true});
        return;
      }
      const script=document.createElement("script");
      script.src=src;
      script.async=true;
      script.crossOrigin="anonymous";
      script.onload=()=>resolve();
      script.onerror=()=>reject(new Error(`Gagal memuat ${src}`));
      document.head.appendChild(script);
    });
    return window.__aturduitkuScriptLoads[src];
  };
  const loadPdfLibraries=async()=>{
    if(window.jspdf?.jsPDF && window.jspdf?.jsPDF?.API?.autoTable) return;
    showToast("Memuat export PDF...");
    await loadExternalScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",()=>window.jspdf?.jsPDF);
    await loadExternalScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js",()=>window.jspdf?.jsPDF?.API?.autoTable);
  };
  const loadSheetLibrary=async()=>{
    if(window.XLSX) return;
    showToast("Memuat export Sheets...");
    await loadExternalScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",()=>window.XLSX);
  };

  // ── EXPORT PDF (Bank Style) ─────────────────────────────────────────────────
  const exportPDF = async () => {
    try{await loadPdfLibraries();}catch(err){showToast("Gagal memuat library PDF. Coba lagi.");return;}
    const jsPDF = window.jspdf?.jsPDF;
    if (!jsPDF) { showToast("Tunggu sebentar, library PDF sedang dimuat..."); return; }

    try {
      // ── Document setup ──────────────────────────────────────────────────
      const doc  = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });
      const W=210, H=297, ML=14, MR=14, CT=W-ML-MR;
      const now  = new Date();
      const pad  = n => String(n).padStart(2,"0");
      const tsmp = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const isEN = lang==="en";

      // ── Strip emoji from strings going into PDF ──────────────────────────
      const clean = str => String(str||"").replace(/[\u{1F000}-\u{1FFFF}]/gu,"").replace(/[\u2600-\u27BF]/g,"").replace(/\s{2,}/g," ").trim();

      // ── Translate month name for EN mode ────────────────────────────────
      const MONTHS_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
      const MONTHS_EN_PDF = ["January","February","March","April","May","June","July","August","September","October","November","December"];
      const bulanLabel = isEN ? (MONTHS_EN_PDF[MONTHS_ID.indexOf(s.bulan)] || s.bulan) : s.bulan;

      // ── Color palette (RGB arrays) ───────────────────────────────────────
      const C = {
        purple:  [91,33,182],   purpleDk:[63,22,130],
        purpleLt:[237,233,254], purpleBg:[245,243,255],
        green:   [5,150,105],   greenLt: [209,250,229],
        red:     [220,38,38],   redLt:   [254,226,226],
        amber:   [217,119,6],   amberLt: [254,243,199],
        blue:    [37,99,235],   blueLt:  [219,234,254],
        dark:    [17,24,39],    gray:    [107,114,128],
        line:    [229,231,235], grayLt:  [249,250,251],
        white:   [255,255,255], black:   [0,0,0],
        teal:    [6,182,212],
      };
      const CAT_COLORS = [
        [245,158,11],[59,130,246],[239,68,68],[16,185,129],
        [139,92,246],[236,72,153],[6,182,212],[107,114,128],[245,101,101],
      ];

      // ── Low-level helpers ────────────────────────────────────────────────
      const fc = (...rgb) => doc.setFillColor(...rgb.flat());
      const dc = (...rgb) => doc.setDrawColor(...rgb.flat());
      const tc = (...rgb) => doc.setTextColor(...rgb.flat());
      const lw = (w)      => doc.setLineWidth(w);
      const ft = (style="normal", size=9) => { doc.setFont("helvetica",style); doc.setFontSize(size); };

      // Rounded rect shorthand
      const rr  = (x,y,w,h,r,mode="F") => doc.roundedRect(x,y,w,h,r,r,mode);
      const rx  = (x,y,w,h,mode="F")   => doc.rect(x,y,w,h,mode);
      // Line
      const ln  = (x1,y1,x2,y2) => doc.line(x1,y1,x2,y2);
      // Text
      const txt = (text,x,y,opts={}) => doc.text(String(text),x,y,opts);

      // ── Data helpers ─────────────────────────────────────────────────────
      const Num = v => parseFloat(String(v||0).replace(/[^\d.,-]/g,"").replace(/\./g,"").replace(",","."))||0;
      const idr = n => "Rp "+Math.round(Math.abs(n||0)).toLocaleString("id-ID");
      const idrc = n => (n<0?"-":"")+"Rp "+Math.round(Math.abs(n||0)).toLocaleString("id-ID");
      const idrs = n => {
        const a=Math.round(Math.abs(n||0));
        if(a>=1e9) return (n<0?"-":"")+"Rp "+(a/1e9).toFixed(1)+"M";
        if(a>=1e6) return (n<0?"-":"")+"Rp "+(a/1e6).toFixed(1)+"jt";
        if(a>=1e3) return (n<0?"-":"")+"Rp "+(a/1e3).toFixed(0)+"rb";
        return "Rp "+a.toLocaleString("id-ID");
      };
      const pctn = (v,t) => t>0?((v/t)*100).toFixed(1)+"%":"0%";

      // ── Transaction data ─────────────────────────────────────────────────
      const txM     = s.txs.filter(tx=>tx.bulan===s.bulan&&tx.tahun===s.tahun);
      const totalIn  = txM.filter(tx=>tx.tipe==="pemasukan").reduce((a,tx)=>a+Num(tx.jml),0);
      const totalOut = txM.filter(tx=>tx.tipe==="pengeluaran").reduce((a,tx)=>a+Num(tx.jml),0);
      const totalSav = txM.filter(tx=>tx.tipe==="tabungan").reduce((a,tx)=>a+Num(tx.jml),0);
      const netCash  = totalIn-totalOut-totalSav;
      const totalBal = s.dompet.reduce((a,d)=>a+Num(d.saldo),0);

      // Kateg spend (match by Number ID)
      const katSpend = {};
      txM.filter(tx=>tx.tipe==="pengeluaran").forEach(tx=>{
        const kid=Number(tx.katId); katSpend[kid]=(katSpend[kid]||0)+Num(tx.jml);
      });

      // ── Budget helpers ────────────────────────────────────────────────────
      const budgetAlloc = s.budgets.reduce((a,b)=>a+Num(b.alokasi)+b.sub.reduce((x,sb)=>x+Num(sb.alokasi),0),0);
      const budgetPct   = budgetAlloc>0?(totalOut/budgetAlloc*100):0;

      // ── Score ─────────────────────────────────────────────────────────────
      const savRate  = totalIn>0?(totalSav/totalIn*100):0;
      const runway   = totalOut>0?(totalBal/totalOut):0;
      const sSav = Math.min(40,(savRate/20)*40);
      const sDis = budgetAlloc>0?Math.max(0,Math.min(30,(1-budgetPct/100)*30)):30;
      const sRun = Math.min(30,(runway/6)*30);
      const score = Math.round(sSav+sDis+sRun);
      const scoreLabel = score>=90?"Excellent":score>=75?(isEN?"Very Good":"Sangat Baik"):score>=60?(isEN?"Good":"Baik"):score>=40?(isEN?"Fair":"Cukup"):(isEN?"Needs Work":"Perlu Perhatian");
      const scoreRGB   = score>=75?C.green:score>=50?C.amber:C.red;

      // ── Page state ────────────────────────────────────────────────────────
      let pageNum=1;

      const addFooter = () => {
        fc(C.grayLt); rx(0,H-8,W,8);
        dc(C.line); lw(0.3); ln(0,H-8,W,H-8);
        tc(C.purple); ft("bold",6.5); txt("AturDuitku",ML,H-2.8);
        tc(C.gray);   ft("normal",6);
        txt(isEN?"Personal Finance Report":"Laporan Keuangan Personal", ML+21,H-2.8);
        txt(`${bulanLabel} ${s.tahun}`, W/2,H-2.8,{align:"center"});
        txt(`${isEN?"Page":"Hal"} ${pageNum}`, W-MR,H-2.8,{align:"right"});
      };

      const newPage = () => {
        addFooter(); doc.addPage(); pageNum++;
        fc(C.purple); rx(0,0,W,1.8);   // purple top rule
      };

      // Section title: left accent bar + title + optional subtitle + rule
      const secTitle = (title, sub, y) => {
        fc(C.purple); rx(ML,y,3,sub?8:6.5);
        tc(C.dark); ft("bold",11); txt(clean(title),ML+5,y+5.5);
        let bot=y+7;
        if(sub){ tc(C.gray); ft("normal",7); txt(clean(sub),ML+5,y+11); bot=y+13; }
        dc(C.line); lw(0.4); ln(ML,bot+1,W-MR,bot+1);
        return bot+4;
      };

      // Inline progress bar
      const progBar = (x,y,w,h,pct,rgb) => {
        const p=Math.min(100,Math.max(0,pct));
        fc(C.line); rr(x,y,w,h,h/2);
        fc(rgb); rr(x,y,Math.max(h,w*p/100),h,h/2);
      };

      // ─────────────────────────────────────────────────────────────────────
      // PAGE 1  –  HEADER + SUMMARY CARDS + WALLET
      // ─────────────────────────────────────────────────────────────────────
      let y=0;

      // Solid gradient header (layered thin rects – no GState)
      for(let i=0;i<50;i++){
        const r=Math.round(91+(63-91)*(i/49));
        const g=Math.round(33+(22-33)*(i/49));
        const b=Math.round(182+(130-182)*(i/49));
        fc([r,g,b]); rx(0,i*50/50*48/50,W,1);   // tiny overlap
      }
      // Cleaner solid band that looks like a gradient
      fc(C.purple); rx(0,0,W,48);
      // Decorative right panel (darker)
      fc(C.purpleDk); rx(W-52,0,52,48);
      // Thin separator line
      dc(C.white); lw(0.2); ln(W-52,4,W-52,44);

      // App name + subtitle
      tc(C.white); ft("bold",22); txt("AturDuitku",ML,17);
      tc(C.white); ft("normal",8.5); txt(isEN?"Personal Finance Report":"Laporan Keuangan Personal",ML,24);
      // Thin rule
      dc([200,180,255]); lw(0.3); ln(ML,27,W-56,27);
      // Name + period
      tc(C.white); ft("bold",9.5); txt(clean(s.name)||"Pengguna",ML,33);
      tc([210,200,240]); ft("normal",7.5);
      txt(`${isEN?"Period":"Periode"}: ${bulanLabel} ${s.tahun}`,ML,39);
      txt(`${isEN?"Generated":"Dibuat"}: ${tsmp}`,ML,44.5);

      // Right badges
      tc(C.white); ft("bold",7.5); txt(isEN?"OFFICIAL REPORT":"LAPORAN RESMI", W-26,14,{align:"center"});
      dc([200,180,255]); lw(0.2); ln(W-48,17,W-4,17);
      ft("normal",8); txt(`${bulanLabel} ${s.tahun}`,W-26,24,{align:"center"});
      ft("normal",6.5); txt(tsmp.split(" ")[0],W-26,30,{align:"center"});

      y=52;

      // ── Summary section ──────────────────────────────────────────────────
      y=secTitle(isEN?"Financial Summary":"Ringkasan Keuangan",
                 `${isEN?"Period":"Periode"}: ${bulanLabel} ${s.tahun} | ${txM.length} ${isEN?"transactions":"transaksi"}`, y);

      // 4 stat cards
      const cw4=(CT-9)/4, ch4=24;
      const cards4=[
        {l:isEN?"TOTAL BALANCE":"TOTAL SALDO",   v:idr(totalBal),  sub:s.dompet.slice(0,2).map(d=>clean(d.nama)).join(" & ").slice(0,20)||"-", ac:C.purple, bg:C.purpleLt},
        {l:isEN?"INCOME":"PEMASUKAN",             v:idr(totalIn),   sub:`+${pctn(totalIn,totalIn+totalOut)} ${isEN?"of all":"dari total"}`,    ac:C.green,  bg:C.greenLt},
        {l:isEN?"EXPENSES":"PENGELUARAN",         v:idr(totalOut),  sub:`${pctn(totalOut,totalIn+totalOut)} ${isEN?"of income":"dari masuk"}`,   ac:C.red,    bg:C.redLt},
        {l:"NET CASHFLOW",                        v:idrc(netCash),  sub:netCash>=0?(isEN?"Surplus - great!":"Surplus - bagus!"):(isEN?"Deficit - careful":"Defisit - perhatian"),  ac:netCash>=0?C.green:C.red, bg:netCash>=0?C.greenLt:C.redLt},
      ];
      cards4.forEach((cd,i)=>{
        const cx=ML+i*(cw4+3);
        // Shadow
        fc(C.line); rr(cx+0.4,y+0.6,cw4,ch4,2);
        // Card
        fc(cd.bg); rr(cx,y,cw4,ch4,2);
        dc(cd.ac); lw(0.4); rr(cx,y,cw4,ch4,2,"D");
        // Left bar
        fc(cd.ac); rx(cx,y,2.5,ch4);
        // Label
        tc(cd.ac); ft("bold",5.5); txt(cd.l,cx+4.5,y+5.5);
        // Value (auto-shrink if long)
        tc(C.dark); ft("bold", cd.v.length>14?8:9.5);
        doc.text(cd.v,cx+4.5,y+13);
        // Sub
        tc(C.gray); ft("normal",5.5); txt(cd.sub,cx+4.5,y+ch4-2.5);
      });
      y+=ch4+6;

      // Score bar
      fc(C.purpleBg); rr(ML,y,CT,16,2.5);
      dc(C.purpleLt); lw(0.5); rr(ML,y,CT,16,2.5,"D");
      fc(C.purple); rx(ML,y,3,16);
      // Score badge
      fc(scoreRGB); rr(ML+5,y+2.5,19,11,2);
      tc(C.white); ft("bold",13); txt(String(score),ML+14.5,y+10.2,{align:"center"});
      tc(C.white); ft("normal",5); txt("/100",ML+14.5,y+13.5,{align:"center"});
      // Label
      tc(C.dark); ft("bold",10.5); txt(scoreLabel,ML+28,y+8.5);
      tc(C.gray);  ft("normal",7); txt(`${isEN?"Financial Health Score":"Skor Kesehatan Keuangan"} - ${bulanLabel} ${s.tahun}`,ML+28,y+13.5);
      // Mini progress
      progBar(ML+112,y+5.5,74,3.5,score,scoreRGB);
      tc(C.gray); ft("bold",5.5); txt(score+"%",W-MR-1,y+9,{align:"right"});
      y+=22;

      // ── Wallet table ──────────────────────────────────────────────────────
      y=secTitle(isEN?"Wallet Accounts":"Detail Dompet",
                 isEN?"Balance per account (end of period)":"Saldo per akun akhir periode", y);

      doc.autoTable({
        startY:y, margin:{left:ML,right:MR},
        head:[[
          isEN?"Account":"Akun",
          isEN?"Type":"Tipe",
          isEN?"Balance":"Saldo",
          isEN?"Share %":"Porsi %"
        ]],
        body:[
          ...s.dompet.map(d=>{
            const bal=Num(d.saldo);
            return [clean(d.nama), clean(d.tipe), idr(bal), pctn(bal,totalBal)];
          }),
          [isEN?"TOTAL":"TOTAL","",idr(totalBal),"100%"],
        ],
        columnStyles:{
          0:{cellWidth:68,fontStyle:"normal"},
          1:{cellWidth:32,halign:"center"},
          2:{cellWidth:55,halign:"right",fontStyle:"bold"},
          3:{cellWidth:27,halign:"center"},
        },
        headStyles:{fillColor:C.purple,textColor:255,fontStyle:"bold",fontSize:8,cellPadding:3.5},
        bodyStyles:{fontSize:8.5,cellPadding:3.5,textColor:C.dark},
        alternateRowStyles:{fillColor:C.grayLt},
        theme:"plain",
        tableLineColor:C.line, tableLineWidth:0.3,
        didParseCell:(d)=>{
          if(d.section==="body"){
            const isTot=d.row.index===s.dompet.length;
            if(isTot){d.cell.styles.fillColor=C.dark;d.cell.styles.textColor=C.white;d.cell.styles.fontStyle="bold";return;}
            if(d.column.index===2){
              const bal=Num(s.dompet[d.row.index]?.saldo||0);
              d.cell.styles.textColor=bal>=0?C.green:C.red;
            }
          }
        },
        didDrawCell:(d)=>{
          if(d.column.index===0&&(d.section==="body"||d.section==="head")){
            fc(C.purple); rx(d.cell.x,d.cell.y,2,d.cell.height);
          }
        },
      });
      y=doc.lastAutoTable.finalY+5;

      // ─────────────────────────────────────────────────────────────────────
      // PAGE 2  –  TRANSACTION HISTORY
      // ─────────────────────────────────────────────────────────────────────
      newPage(); y=6;
      y=secTitle(isEN?"Transaction History":"Riwayat Transaksi",
                 `${bulanLabel} ${s.tahun}  |  ${txM.length} ${isEN?"transactions":"transaksi"}  |  Max 60 ${isEN?"shown":"ditampilkan"}`, y);

      const TIPE_LBL  = {pemasukan:"[+]", pengeluaran:"[-]", tabungan:"[S]", transfer:"[T]"};
      const txRows = txM.slice(0,60).map(tx=>{
        const dompet   = clean(s.dompet.find(d=>d.id===tx.dompetId)?.nama||"-");
        const katB     = s.budgets.find(b=>b.id===Number(tx.katId));
        const katLabel = clean(katB?.kat||(tx.tipe==="pemasukan"?(isEN?"Income":"Pemasukan"):(isEN?"Other":"Lainnya")));
        const tlbl     = TIPE_LBL[tx.tipe]||"[?]";
        const debit    = (tx.tipe==="pengeluaran"||tx.tipe==="tabungan")?idr(Num(tx.jml)):"";
        const kredit   = tx.tipe==="pemasukan"?idr(Num(tx.jml)):"";
        return [tx.tgl||"-", tlbl, clean(tx.ket||"-").slice(0,34), katLabel.slice(0,18), dompet.slice(0,14), debit, kredit];
      });
      // Total row
      txRows.push(["","",isEN?"PERIOD TOTAL":"TOTAL PERIODE","","",
        totalOut>0?"("+idr(totalOut)+")":"",
        totalIn>0?idr(totalIn):"",
      ]);

      doc.autoTable({
        startY:y, margin:{left:ML,right:MR},
        head:[[
          isEN?"Date":"Tgl","",
          isEN?"Description":"Keterangan",
          isEN?"Category":"Kategori",
          isEN?"Wallet":"Dompet",
          isEN?"Debit":"Debit",
          isEN?"Credit":"Kredit",
        ]],
        body:txRows,
        columnStyles:{
          0:{cellWidth:21,fontSize:7,textColor:C.gray},
          1:{cellWidth:9, halign:"center",fontSize:7.5,fontStyle:"bold"},
          2:{cellWidth:55,fontSize:7.5},
          3:{cellWidth:30,halign:"center",fontSize:7},
          4:{cellWidth:22,halign:"center",fontSize:7},
          5:{cellWidth:31,halign:"right",fontSize:7.5,fontStyle:"bold"},
          6:{cellWidth:31,halign:"right",fontSize:7.5,fontStyle:"bold"},
        },
        headStyles:{fillColor:C.dark,textColor:255,fontStyle:"bold",fontSize:7.5,cellPadding:3.5},
        bodyStyles:{fontSize:7.5,cellPadding:3,textColor:C.dark},
        alternateRowStyles:{fillColor:C.grayLt},
        theme:"plain",
        tableLineColor:C.line,tableLineWidth:0.25,
        didParseCell:(d)=>{
          if(d.section!=="body") return;
          const totIdx=txM.slice(0,60).length;
          if(d.row.index===totIdx){
            d.cell.styles.fillColor=C.dark; d.cell.styles.textColor=C.white; d.cell.styles.fontStyle="bold"; return;
          }
          const tx=txM[d.row.index]; if(!tx) return;
          if(d.column.index===6&&tx.tipe==="pemasukan")  d.cell.styles.textColor=C.green;
          if(d.column.index===5&&tx.tipe==="pengeluaran")d.cell.styles.textColor=C.red;
          if(d.column.index===5&&tx.tipe==="tabungan")   d.cell.styles.textColor=C.purple;
          if(d.column.index===1){
            if(tx.tipe==="pemasukan")   d.cell.styles.textColor=C.green;
            else if(tx.tipe==="pengeluaran") d.cell.styles.textColor=C.red;
            else if(tx.tipe==="tabungan")    d.cell.styles.textColor=C.purple;
            else d.cell.styles.textColor=C.blue;
          }
        },
        didDrawCell:(d)=>{
          if(d.column.index===0&&(d.section==="body"||d.section==="head")){
            fc(C.purple); rx(d.cell.x,d.cell.y,2,d.cell.height);
          }
        },
      });
      y=doc.lastAutoTable.finalY+8;

      // ─────────────────────────────────────────────────────────────────────
      // PAGE 3  –  SPENDING DISTRIBUTION + 6-MONTH TREND
      // ─────────────────────────────────────────────────────────────────────
      newPage(); y=6;

      // ── Spending by category (horizontal bar chart) ───────────────────────
      const katData = s.budgets
        .map((b,i)=>({
          id:b.id, kat:clean(b.kat),
          jml:katSpend[b.id]||0,
          alloc:Num(b.alokasi)+b.sub.reduce((x,sb)=>x+Num(sb.alokasi),0),
          color:CAT_COLORS[i%CAT_COLORS.length]
        }))
        .filter(x=>x.jml>0)
        .sort((a,b2)=>b2.jml-a.jml)
        .slice(0,8);
      const totKat=katData.reduce((a,x)=>a+x.jml,0)||1;

      y=secTitle(isEN?"Spending by Category":"Distribusi Pengeluaran",
                 isEN?`Top ${katData.length} categories this period`:`${katData.length} kategori pengeluaran terbesar`, y);

      if(katData.length){
        const bX=ML+50, maxBW=CT-50-34, bH=5.2, bGap=3.2;
        katData.forEach((d,i)=>{
          const bY=y+i*(bH+bGap);
          const bW=Math.max(2,(d.jml/totKat)*maxBW);
          // Rank
          fc(C.purpleBg); rr(ML-1,bY,10,bH,1);
          tc(C.purple); ft("bold",6); txt("#"+(i+1),ML+4,bY+bH-0.8,{align:"center"});
          // Category name
          tc(C.dark); ft("normal",7.5); txt(d.kat.slice(0,18),ML+10,bY+bH-0.7);
          // Track
          fc(C.line); rr(bX,bY,maxBW,bH,bH/2);
          // Bar fill
          fc(d.color); rr(bX,bY,bW,bH,bH/2);
          // Value
          tc(C.gray); ft("bold",6.5);
          txt(idrs(d.jml)+" ("+pctn(d.jml,totKat)+")", bX+maxBW+2, bY+bH-0.7);
        });
        y+=katData.length*(bH+bGap)+8;
      } else {
        tc(C.gray); ft("normal",8.5);
        txt(isEN?"No spending data this period":"Belum ada pengeluaran bulan ini",ML,y+8);
        y+=16;
      }

      // ── 6-month bar chart ─────────────────────────────────────────────────
      if(y>H-80){newPage();y=6;}

      const MONTHS_FULL = isEN
        ?["January","February","March","April","May","June","July","August","September","October","November","December"]
        :["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
      const MSHORT = isEN
        ?["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
        :["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];
      const mIdx=MONTHS_FULL.indexOf(s.bulan);
      const yr=parseInt(s.tahun);

      const trendData=[];
      for(let i=5;i>=0;i--){
        let mi=mIdx-i,yi=yr;
        if(mi<0){mi+=12;yi--;}
        const mn=MONTHS_FULL[mi];
        const mTx=s.txs.filter(tx=>tx.bulan===mn&&tx.tahun===String(yi));
        trendData.push({
          l:MSHORT[mi],
          inc:mTx.filter(t=>t.tipe==="pemasukan").reduce((a,t)=>a+Num(t.jml),0),
          exp:mTx.filter(t=>t.tipe==="pengeluaran").reduce((a,t)=>a+Num(t.jml),0),
        });
      }

      y=secTitle(isEN?"6-Month Trend":"Tren 6 Bulan",
                 isEN?"Income vs Expenses – last 6 months":"Perbandingan pemasukan vs pengeluaran 6 bulan terakhir",y);

      const maxT=Math.max(...trendData.map(m=>Math.max(m.inc,m.exp)),1);
      const cH=38,cX=ML+18,cW=CT-18,colW=cW/6,bW2=colW*0.33;

      // Y-axis gridlines + labels
      dc(C.line); lw(0.25);
      [0.25,0.5,0.75,1].forEach(p=>{
        const gy=y+cH*(1-p);
        ln(cX,gy,cX+cW,gy);
        tc(C.gray); ft("normal",5.5);
        txt(idrs(maxT*p),cX-2,gy+1.5,{align:"right"});
      });
      // Baseline
      dc(C.line); lw(0.6); ln(cX,y+cH,cX+cW,y+cH);

      trendData.forEach((m,i)=>{
        const gx=cX+i*colW+colW*0.06;
        const hI=m.inc>0?(m.inc/maxT)*cH:0;
        const hE=m.exp>0?(m.exp/maxT)*cH:0;
        if(hI>0){fc(C.green); rr(gx,y+cH-hI,bW2,Math.max(hI,1),1);}
        if(hE>0){fc(C.red);   rr(gx+bW2+1,y+cH-hE,bW2,Math.max(hE,1),1);}
        // Month label
        tc(C.dark); ft("bold",6);
        // Bold if current month
        const isCur=(i===5);
        if(isCur){fc(C.purpleBg);rr(gx-1,y+cH+2,colW*0.7,5,1);}
        txt(m.l,gx+bW2,y+cH+5.5,{align:"center"});
      });

      // Legend
      fc(C.green); rx(W-54,y+1.5,8,3.5);
      tc(C.dark); ft("normal",7); txt(isEN?"Income":"Masuk",W-44,y+5);
      fc(C.red);   rx(W-54,y+7,8,3.5);
      txt(isEN?"Expense":"Keluar",W-44,y+10.5);
      y+=cH+12;

      // ─────────────────────────────────────────────────────────────────────
      // PAGE 4  –  BUDGET PERFORMANCE + HEALTH SCORE
      // ─────────────────────────────────────────────────────────────────────
      newPage(); y=6;

      // ── Budget performance table ──────────────────────────────────────────
      y=secTitle(isEN?"Budget Performance":"Performa Anggaran",
                 isEN?"Realized vs allocated per category":"Realisasi vs alokasi per kategori bulan ini",y);

      const budgetRows=s.budgets
        .map(b=>{
          const alloc=Num(b.alokasi)+b.sub.reduce((x,sb)=>x+Num(sb.alokasi),0);
          const real=katSpend[b.id]||0;
          const sisa=alloc-real;
          const p=alloc>0?(real/alloc*100):0;
          const status=p>100?(isEN?"OVER":"OVER"):p>80?(isEN?"WATCH":"HAMPIR"):(isEN?"OK":"AMAN");
          return {kat:clean(b.kat),alloc,real,sisa,p,status,_p:p};
        })
        .filter(r=>r.alloc>0||r.real>0);

      doc.autoTable({
        startY:y, margin:{left:ML,right:MR},
        head:[[
          isEN?"Category":"Kategori",
          isEN?"Allocated":"Alokasi",
          isEN?"Realized":"Realisasi",
          isEN?"Remaining":"Sisa",
          "%",
          isEN?"Status":"Status",
        ]],
        body:budgetRows.map(r=>[
          r.kat,
          idr(r.alloc),
          idr(r.real),
          r.sisa>=0?idr(r.sisa):"("+idr(Math.abs(r.sisa))+")",
          r.p.toFixed(0)+"%",
          r.status,
        ]),
        columnStyles:{
          0:{cellWidth:52},
          1:{cellWidth:33,halign:"right"},
          2:{cellWidth:33,halign:"right"},
          3:{cellWidth:33,halign:"right"},
          4:{cellWidth:19,halign:"center",fontStyle:"bold"},
          5:{cellWidth:22,halign:"center",fontStyle:"bold"},
        },
        headStyles:{fillColor:C.dark,textColor:255,fontStyle:"bold",fontSize:8,cellPadding:3.5},
        bodyStyles:{fontSize:8,cellPadding:3.5,textColor:C.dark},
        alternateRowStyles:{fillColor:C.grayLt},
        theme:"plain",
        tableLineColor:C.line,tableLineWidth:0.3,
        didParseCell:(d)=>{
          if(d.section!=="body") return;
          const r=budgetRows[d.row.index]; if(!r) return;
          if(d.column.index===5){d.cell.styles.textColor=r._p>100?C.red:r._p>80?C.amber:C.green;}
          if(d.column.index===4){d.cell.styles.textColor=r._p>100?C.red:r._p>80?C.amber:C.green;}
          if(d.column.index===3){d.cell.styles.textColor=r.sisa>=0?C.green:C.red;}
        },
        didDrawCell:(d)=>{
          if(d.column.index===0&&(d.section==="body"||d.section==="head")){
            fc(C.purple); rx(d.cell.x,d.cell.y,2,d.cell.height);
          }
          // Progress mini-bar inside % cell
          if(d.section==="body"&&d.column.index===4){
            const r=budgetRows[d.row.index]; if(!r) return;
            const bx=d.cell.x+1, by=d.cell.y+d.cell.height-2.8, bw=d.cell.width-2;
            fc(C.line); rx(bx,by,bw,1.5);
            fc(r._p>100?C.red:r._p>80?C.amber:C.green);
            rx(bx,by,Math.max(1.5,bw*Math.min(r._p,100)/100),1.5);
          }
        },
      });
      y=doc.lastAutoTable.finalY+8;

      // ── Health score ──────────────────────────────────────────────────────
      if(y>H-80){newPage();y=6;}
      y=secTitle(isEN?"Financial Health":"Kesehatan Keuangan",
                 isEN?"Key indicators - "+bulanLabel+" "+s.tahun:"Indikator utama - "+bulanLabel+" "+s.tahun,y);

      // Hero score box
      fc(C.purpleBg); rr(ML,y,CT,28,3);
      dc(C.purpleLt); lw(0.6); rr(ML,y,CT,28,3,"D");
      fc(C.purple); rx(ML,y,3,28);
      // Score circle
      fc(scoreRGB); rr(ML+5,y+4,22,20,3);
      tc(C.white); ft("bold",18); txt(String(score),ML+16,y+16.5,{align:"center"});
      tc(C.white); ft("normal",5.5); txt("/100",ML+16,y+21,{align:"center"});
      // Label + description
      tc(C.dark); ft("bold",15); txt(scoreLabel,ML+31,y+13);
      tc(C.gray); ft("normal",8); txt(isEN?`Financial Health - ${bulanLabel} ${s.tahun}`:`Skor Kesehatan Keuangan - ${bulanLabel} ${s.tahun}`,ML+31,y+19.5);
      progBar(ML+31,y+23,CT-35,3.5,score,scoreRGB);
      tc(C.gray); ft("bold",6); txt(score+"%",W-MR-1,y+26.5,{align:"right"});
      y+=34;

      // 4 KPI mini-cards
      const kpiW=(CT-9)/4, kpiH=20;
      const kpis=[
        {l:isEN?"Saving Rate":"Rasio Tabungan",  v:savRate.toFixed(1)+"%", bench:isEN?">=20% ideal":">=20% ideal", ok:savRate>=20},
        {l:isEN?"Budget Usage":"Pemakaian Budget",v:budgetPct.toFixed(1)+"%",bench:isEN?"<=85% ideal":"<=85% ideal",ok:budgetPct<=85},
        {l:"Net Cashflow",                         v:idrs(netCash),          bench:isEN?"Positive=good":"Positif=baik",ok:netCash>=0},
        {l:isEN?"Cash Runway":"Dana Darurat",     v:runway.toFixed(1)+(isEN?" mo":" bln"),bench:isEN?">=3 mo ideal":">=3 bln ideal",ok:runway>=3},
      ];
      kpis.forEach((kpi,i)=>{
        const kx=ML+i*(kpiW+3);
        fc(kpi.ok?C.greenLt:C.redLt); rr(kx,y,kpiW,kpiH,2);
        dc(kpi.ok?C.green:C.red); lw(0.4); rr(kx,y,kpiW,kpiH,2,"D");
        fc(kpi.ok?C.green:C.red); rx(kx,y,2.5,kpiH);
        tc(kpi.ok?C.green:C.red); ft("bold",5.5); txt(kpi.l,kx+4.5,y+5.5);
        tc(C.dark); ft("bold",kpi.v.length>8?8:9.5); txt(kpi.v,kx+4.5,y+12.5);
        tc(C.gray); ft("normal",5.5); txt(kpi.bench,kx+4.5,y+kpiH-2.5);
      });
      y+=kpiH+8;

      // Indicators table
      doc.autoTable({
        startY:y, margin:{left:ML,right:MR},
        head:[[
          isEN?"Indicator":"Indikator",
          isEN?"Value":"Nilai",
          isEN?"Benchmark":"Benchmark",
          isEN?"Status":"Status",
          isEN?"Score":"Skor",
        ]],
        body:[
          [isEN?"Saving Rate":"Rasio Tabungan",    savRate.toFixed(1)+"%", ">=20%", savRate>=20?(isEN?"GOOD":"BAIK"):(isEN?"LOW":"KURANG"), Math.round(sSav)+"/40"],
          [isEN?"Budget Discipline":"Disiplin Budget", budgetPct.toFixed(1)+"%","<=85%",budgetPct<=85?(isEN?"GOOD":"BAIK"):(isEN?"OVER":"OVER"),Math.max(0,Math.round(sDis))+"/30"],
          ["Net Cashflow", idrs(netCash), isEN?"Positive":"Positif", netCash>=0?(isEN?"GOOD":"BAIK"):(isEN?"DEFICIT":"DEFISIT"), "-"],
          [isEN?"Cash Runway":"Dana Darurat", runway.toFixed(1)+(isEN?" months":" bulan"), ">=3", runway>=3?(isEN?"GOOD":"BAIK"):(isEN?"LOW":"KURANG"), Math.min(30,Math.round(sRun))+"/30"],
          [isEN?"TOTAL SCORE":"TOTAL SKOR", score+"/100", "-", scoreLabel, score+"/100"],
        ],
        columnStyles:{
          0:{cellWidth:56},
          1:{cellWidth:38,halign:"right",fontStyle:"bold"},
          2:{cellWidth:30,halign:"center"},
          3:{cellWidth:30,halign:"center",fontStyle:"bold"},
          4:{cellWidth:28,halign:"center",fontStyle:"bold"},
        },
        headStyles:{fillColor:C.purple,textColor:255,fontStyle:"bold",fontSize:8,cellPadding:4},
        bodyStyles:{fontSize:8.5,cellPadding:4,textColor:C.dark},
        alternateRowStyles:{fillColor:C.purpleBg},
        theme:"plain",
        tableLineColor:C.line,tableLineWidth:0.3,
        didParseCell:(d)=>{
          if(d.section!=="body") return;
          const isTotal=d.row.index===4;
          if(isTotal){d.cell.styles.fillColor=C.dark;d.cell.styles.textColor=C.white;d.cell.styles.fontStyle="bold";return;}
          if(d.column.index===3){
            const ok=String(d.cell.raw||"").includes("GOOD")||String(d.cell.raw||"").includes("BAIK");
            d.cell.styles.textColor=ok?C.green:C.red;
          }
          if(d.column.index===1) d.cell.styles.textColor=C.purple;
        },
        didDrawCell:(d)=>{
          if(d.column.index===0&&(d.section==="body"||d.section==="head")){
            fc(C.purple); rx(d.cell.x,d.cell.y,2,d.cell.height);
          }
        },
      });
      y=doc.lastAutoTable.finalY+8;

      // ── Disclaimer ────────────────────────────────────────────────────────
      if(y<H-20){
        fc(C.grayLt); rr(ML,y,CT,13,2);
        dc(C.line); lw(0.3); rr(ML,y,CT,13,2,"D");
        fc(C.gray); rx(ML,y,3,13);
        tc(C.gray); ft("normal",6.5);
        const dis=isEN
          ?"This report was automatically generated by AturDuitku based on personal data entered by the user. Data is private and confidential. AturDuitku is not responsible for financial decisions made based on this report. Consult a certified financial planner for professional advice."
          :"Laporan ini dibuat otomatis oleh AturDuitku berdasarkan data yang dimasukkan pengguna. Data bersifat pribadi & rahasia. AturDuitku tidak bertanggung jawab atas keputusan keuangan berdasarkan laporan ini. Konsultasikan dengan perencana keuangan profesional.";
        const disLines=doc.splitTextToSize(dis,CT-8);
        doc.text(disLines,ML+4,y+5.5);
      }

      // ── Final footer + save ───────────────────────────────────────────────
      addFooter();
      doc.save(`AturDuitku_${bulanLabel}_${s.tahun}.pdf`);
      showToast(t("toast_pdfOk"));

    } catch(err) {
      console.error("PDF export error:", err);
      showToast("Gagal export PDF: "+String(err.message||err));
    }
  };

  // ── EXPORT GOOGLE SHEETS (XLSX) ─────────────────────────────────────────────
  const exportSheets = async () => {
    try{await loadSheetLibrary();}catch(err){showToast("Gagal memuat library Sheets. Coba lagi.");return;}
    const XLSX = window.XLSX;
    if (!XLSX) { showToast("Tunggu sebentar, library sedang dimuat..."); return; }
    try {
      const isEN = lang==="en";
      const Num = v => parseFloat(String(v||0).replace(/[^\d.,-]/g,"").replace(/\./g,"").replace(",","."))||0;
      const idr = n => "Rp "+Math.round(Math.abs(n||0)).toLocaleString("id-ID");
      const pct = (v,t) => t>0?((v/t)*100).toFixed(1)+"%":"0%";

      const txM = s.txs.filter(tx=>tx.bulan===s.bulan&&tx.tahun===s.tahun);
      const totalIn  = txM.filter(tx=>tx.tipe==="pemasukan").reduce((a,tx)=>a+Num(tx.jml),0);
      const totalOut = txM.filter(tx=>tx.tipe==="pengeluaran").reduce((a,tx)=>a+Num(tx.jml),0);
      const totalSav = txM.filter(tx=>tx.tipe==="tabungan").reduce((a,tx)=>a+Num(tx.jml),0);
      const netCash  = totalIn-totalOut-totalSav;
      const totalBal = s.dompet.reduce((a,d)=>a+Num(d.saldo),0);
      const katSpend = {};
      txM.filter(tx=>tx.tipe==="pengeluaran").forEach(tx=>{
        const b=s.budgets.find(b=>b.id===Number(tx.katId));
        const nm=b?.kat||(isEN?"Other":"Lainnya");
        katSpend[nm]=(katSpend[nm]||0)+Num(tx.jml);
      });

      const wb = XLSX.utils.book_new();

      // ── Palette & style helpers ──────────────────────────────────────────────
      const purple  = "5B21B6"; const purpleLt = "EDE9FE"; const purpleDk = "3F1682";
      const green   = "059669"; const greenLt  = "D1FAE5";
      const red     = "DC2626"; const redLt    = "FEE2E2";
      const amber   = "D97706"; const amberLt  = "FEF3C7";
      const gray    = "6B7280"; const grayLt   = "F9FAFB";
      const white   = "FFFFFF"; const dark     = "111827";
      const line    = "E5E7EB";

      const hdr = (bg, fg="FFFFFF", bold=true, sz=11) => ({
        fill:{patternType:"solid", fgColor:{rgb:bg}},
        font:{bold, color:{rgb:fg}, sz, name:"Arial"},
        alignment:{horizontal:"center", vertical:"center", wrapText:true},
        border:{top:{style:"thin",color:{rgb:line}},bottom:{style:"thin",color:{rgb:line}},
                left:{style:"thin",color:{rgb:line}},right:{style:"thin",color:{rgb:line}}}
      });
      const cell = (bg=white, fg=dark, bold=false, align="left", sz=10) => ({
        fill:{patternType:"solid", fgColor:{rgb:bg}},
        font:{bold, color:{rgb:fg}, sz, name:"Arial"},
        alignment:{horizontal:align, vertical:"center", wrapText:true},
        border:{top:{style:"thin",color:{rgb:line}},bottom:{style:"thin",color:{rgb:line}},
                left:{style:"thin",color:{rgb:line}},right:{style:"thin",color:{rgb:line}}}
      });
      const C = (r,c,v,s) => ({r,c,v,s});

      // ── SHEET 1: Ringkasan ───────────────────────────────────────────────────
      const ws1 = {};
      const rows1 = [];
      const pad1 = (r) => { rows1.push(r); };

      // Title block
      pad1([
        {v:"AturDuitku - "+(isEN?"Financial Report":"Laporan Keuangan"), s:hdr(purpleDk,"FFFFFF",true,14)},
        {v:"", s:hdr(purpleDk)},{v:"", s:hdr(purpleDk)},{v:"", s:hdr(purpleDk)},
      ]);
      pad1([
        {v:(isEN?"Period":"Periode")+": "+s.bulan+" "+s.tahun, s:hdr(purple,"FFFFFF",false,10)},
        {v:(isEN?"Name":"Nama")+": "+(s.name||"-"), s:hdr(purple,"FFFFFF",false,10)},
        {v:(isEN?"Generated":"Dibuat")+": "+new Date().toLocaleDateString("id-ID"), s:hdr(purple,"FFFFFF",false,10)},
        {v:"", s:hdr(purple)},
      ]);
      pad1([{v:"",s:cell()},{v:"",s:cell()},{v:"",s:cell()},{v:"",s:cell()}]);

      // Summary header
      pad1([
        {v:isEN?"MONTHLY SUMMARY":"RINGKASAN BULANAN", s:hdr(purple)},
        {v:"", s:hdr(purple)},{v:isEN?"AMOUNT":"JUMLAH", s:hdr(purple)},{v:isEN?"NOTE":"KETERANGAN", s:hdr(purple)},
      ]);
      const summaryRows = [
        [isEN?"Total Income":"Total Pemasukan", idr(totalIn), greenLt, green, "💰"],
        [isEN?"Total Expenses":"Total Pengeluaran", idr(totalOut), redLt, red, "💸"],
        [isEN?"Total Savings":"Total Tabungan", idr(totalSav), amberLt, amber, "🏦"],
        [isEN?"Net Cashflow":"Net Cashflow", idr(netCash), netCash>=0?greenLt:redLt, netCash>=0?green:red, netCash>=0?"✅":"⚠️"],
        [isEN?"Total Balance":"Total Saldo", idr(totalBal), purpleLt, purple, "💼"],
      ];
      summaryRows.forEach(([label, val, bg, fg, icon]) => {
        pad1([
          {v:icon+" "+label, s:cell(bg,fg,true,"left")},
          {v:"", s:cell(bg)},
          {v:val, s:cell(bg,fg,true,"right")},
          {v:isEN?"This month":"Bulan ini", s:cell(bg,gray,false,"center")},
        ]);
      });
      pad1([{v:"",s:cell()},{v:"",s:cell()},{v:"",s:cell()},{v:"",s:cell()}]);

      // Saving rate
      const savRate = totalIn>0?(totalSav/totalIn*100).toFixed(1):0;
      pad1([
        {v:isEN?"Saving Rate":"Rasio Tabungan", s:cell(grayLt,dark,true)},
        {v:"", s:cell(grayLt)},
        {v:savRate+"%", s:cell(grayLt, Number(savRate)>=20?green:Number(savRate)>=10?amber:red, true,"right")},
        {v:isEN?"Ideal ≥ 20%":"Ideal ≥ 20%", s:cell(grayLt,gray,false,"center")},
      ]);

      pad1([{v:"",s:cell()},{v:"",s:cell()},{v:"",s:cell()},{v:"",s:cell()}]);

      // Wallets
      pad1([
        {v:isEN?"WALLETS":"DOMPET", s:hdr(purple)},
        {v:isEN?"TYPE":"TIPE", s:hdr(purple)},
        {v:isEN?"BALANCE":"SALDO", s:hdr(purple)},
        {v:"", s:hdr(purple)},
      ]);
      s.dompet.forEach((d,idx) => {
        const bg = idx%2===0?white:grayLt;
        pad1([
          {v:d.nama, s:cell(bg,dark,true)},
          {v:d.tipe, s:cell(bg,gray,false,"center")},
          {v:idr(Num(d.saldo)), s:cell(bg,dark,false,"right")},
          {v:"", s:cell(bg)},
        ]);
      });
      pad1([
        {v:isEN?"TOTAL":"TOTAL", s:cell(purpleLt,purple,true)},
        {v:"", s:cell(purpleLt,purple,true)},
        {v:idr(totalBal), s:cell(purpleLt,purple,true,"right")},
        {v:"", s:cell(purpleLt)},
      ]);

      // Write sheet 1
      const range1 = {s:{r:0,c:0}, e:{r:rows1.length-1,c:3}};
      rows1.forEach((row,r) => {
        row.forEach((cel,c) => {
          const addr = XLSX.utils.encode_cell({r,c});
          ws1[addr] = {v:cel.v, t:"s", s:cel.s};
        });
      });
      ws1["!ref"] = XLSX.utils.encode_range(range1);
      ws1["!cols"] = [{wch:32},{wch:16},{wch:20},{wch:18}];
      ws1["!rows"] = rows1.map((_,i)=>i<2?{hpt:24}:{hpt:20});
      ws1["!merges"] = [{s:{r:0,c:0},e:{r:0,c:3}},{s:{r:1,c:0},e:{r:1,c:1}},{s:{r:1,c:2},e:{r:1,c:3}}];
      XLSX.utils.book_append_sheet(wb, ws1, isEN?"Summary":"Ringkasan");

      // ── SHEET 2: Transaksi ───────────────────────────────────────────────────
      const ws2 = {};
      const rows2 = [];
      rows2.push([
        {v:isEN?"DATE":"TANGGAL", s:hdr(purple)},
        {v:isEN?"DESCRIPTION":"KETERANGAN", s:hdr(purple)},
        {v:isEN?"TYPE":"TIPE", s:hdr(purple)},
        {v:isEN?"CATEGORY":"KATEGORI", s:hdr(purple)},
        {v:isEN?"WALLET":"DOMPET", s:hdr(purple)},
        {v:isEN?"AMOUNT":"JUMLAH", s:hdr(purple)},
      ]);
      const sorted = [...txM].sort((a,b)=>new Date(b.tgl)-new Date(a.tgl));
      sorted.forEach((tx,idx) => {
        const bg = idx%2===0?white:grayLt;
        const isTipe = tx.tipe==="pemasukan"?{bg:greenLt,fg:green}:tx.tipe==="tabungan"?{bg:amberLt,fg:amber}:{bg:redLt,fg:red};
        const kat = s.budgets.find(b=>b.id===Number(tx.katId));
        const dom = s.dompet.find(d=>d.id===Number(tx.dompetId));
        rows2.push([
          {v:tx.tgl||"-", s:cell(bg,gray,false,"center")},
          {v:tx.ket||"-", s:cell(bg,dark)},
          {v:tx.tipe, s:cell(isTipe.bg,isTipe.fg,true,"center")},
          {v:kat?.kat||(isEN?"Other":"Lainnya"), s:cell(bg,gray,false,"center")},
          {v:dom?.nama||"-", s:cell(bg,gray,false,"center")},
          {v:idr(Num(tx.jml)), s:cell(bg,tx.tipe==="pemasukan"?green:tx.tipe==="tabungan"?amber:red,true,"right")},
        ]);
      });
      // Total row
      rows2.push([
        {v:"", s:cell(purpleLt)},
        {v:isEN?"TOTAL":"TOTAL", s:cell(purpleLt,purple,true,"right")},
        {v:"", s:cell(purpleLt)},
        {v:"", s:cell(purpleLt)},
        {v:"", s:cell(purpleLt)},
        {v:idr(totalIn-totalOut), s:cell(purpleLt,purple,true,"right")},
      ]);
      rows2.forEach((row,r) => {
        row.forEach((cel,c) => {
          const addr = XLSX.utils.encode_cell({r,c});
          ws2[addr] = {v:cel.v, t:"s", s:cel.s};
        });
      });
      ws2["!ref"] = XLSX.utils.encode_range({s:{r:0,c:0},e:{r:rows2.length-1,c:5}});
      ws2["!cols"] = [{wch:14},{wch:34},{wch:14},{wch:18},{wch:16},{wch:20}];
      ws2["!rows"] = rows2.map(()=>({hpt:20}));
      XLSX.utils.book_append_sheet(wb, ws2, isEN?"Transactions":"Transaksi");

      // ── SHEET 3: Budget ──────────────────────────────────────────────────────
      const ws3 = {};
      const rows3 = [];
      rows3.push([
        {v:isEN?"CATEGORY":"KATEGORI", s:hdr(purple)},
        {v:isEN?"BUDGET":"ANGGARAN", s:hdr(purple)},
        {v:isEN?"ACTUAL":"REALISASI", s:hdr(purple)},
        {v:isEN?"REMAINING":"SISA", s:hdr(purple)},
        {v:"%", s:hdr(purple)},
        {v:isEN?"STATUS":"STATUS", s:hdr(purple)},
      ]);
      s.budgets.filter(b=>Num(b.alokasi)>0).forEach((b,idx) => {
        const bg = idx%2===0?white:grayLt;
        const spent = katSpend[b.kat]||0;
        const alloc = Num(b.alokasi);
        const sisa  = alloc-spent;
        const p     = alloc>0?Math.round(spent/alloc*100):0;
        const status= p>=100?(isEN?"Over Budget":"Melewati")
                    : p>=80?(isEN?"Warning":"Perlu Hati-hati")
                    : (isEN?"On Track":"Aman");
        const stFg  = p>=100?red:p>=80?amber:green;
        const stBg  = p>=100?redLt:p>=80?amberLt:greenLt;
        rows3.push([
          {v:b.kat, s:cell(bg,dark,true)},
          {v:idr(alloc), s:cell(bg,dark,false,"right")},
          {v:idr(spent), s:cell(bg,p>=100?red:dark,false,"right")},
          {v:idr(Math.max(0,sisa)), s:cell(bg,sisa>=0?green:red,false,"right")},
          {v:p+"%", s:cell(bg,p>=100?red:p>=80?amber:green,true,"center")},
          {v:status, s:cell(stBg,stFg,true,"center")},
        ]);
      });
      rows3.forEach((row,r) => {
        row.forEach((cel,c) => {
          const addr = XLSX.utils.encode_cell({r,c});
          ws3[addr] = {v:cel.v, t:"s", s:cel.s};
        });
      });
      ws3["!ref"] = XLSX.utils.encode_range({s:{r:0,c:0},e:{r:rows3.length-1,c:5}});
      ws3["!cols"] = [{wch:22},{wch:18},{wch:18},{wch:18},{wch:10},{wch:16}];
      ws3["!rows"] = rows3.map(()=>({hpt:20}));
      XLSX.utils.book_append_sheet(wb, ws3, isEN?"Budget":"Anggaran");

      // ── Save ─────────────────────────────────────────────────────────────────
      const fname = `AturDuitku_${s.bulan}_${s.tahun}.xlsx`;
      XLSX.writeFile(wb, fname, {bookType:"xlsx", type:"binary", cellStyles:true});
      showToast("✅ "+(isEN?"Exported to Excel/Sheets!":"Berhasil export ke Google Sheets!"));
    } catch(err) {
      console.error(err);
      showToast("Gagal export: "+String(err.message||err));
    }
  };

    const handleSaveScanTx = (tx) => {
    setS(p => {
      const newTxs = [...p.txs, tx];
      const newDompet = p.dompet.map(d => {
        if (d.id !== tx.dompetId) return d;
        const amt = parseFloat(String(tx.jml||0).replace(/[^\d.]/g,""))||0;
        const delta = tx.tipe==="pemasukan" ? amt : -amt;
        return {...d, saldo: String(parseFloat(String(d.saldo||0).replace(/[^\d.]/g,""))||0 + delta)};
      });
      return {...p, txs:newTxs, dompet:newDompet};
    });
    showToast(lang==="en"?"✅ Transaction saved!":"✅ Transaksi tersimpan!");
  };

  const importJSON=(file)=>{
    if(!file)return;
    const reader=new FileReader();
    reader.onload=(e)=>{
      try{
        const parsed=JSON.parse(e.target.result);
        // Validasi minimal field
        if(!parsed.dompet||!parsed.txs){showToast("❌ File tidak valid!");return;}
        setS({...INIT,...parsed,dompet:parsed.dompet||INIT.dompet,txs:parsed.txs||[],utang:parsed.utang||[],budgets:parsed.budgets||INIT_BUDGETS,goals:parsed.goals||[],asetTetap:parsed.asetTetap||[],recurring:parsed.recurring||[],amplop:parsed.amplop||[],habits:parsed.habits||[],processedRecurring:parsed.processedRecurring||{}});
        showToast("✅ Data berhasil di-restore!");
        setModal(null);
      }catch(err){showToast("❌ File rusak atau format salah!");}
    };
    reader.readAsText(file);
  };

  // ── RECURRING TRANSACTIONS ──────────────────────────────────────────────────
  const addRecurring=()=>{
    if(!recurringForm.nama||!recurringForm.jml){showToast("⚠️ Isi nama & jumlah!");return;}
    setS(p=>({...p,recurring:[...p.recurring,{...recurringForm,id:Date.now(),jml:pN(recurringForm.jml)}]}));
    setRecurringForm({nama:"",tipe:"pengeluaran",jml:"",katId:1,dompetId:1,hari:"1",aktif:true});
    setShowAddRecurring(false);
    showToast(t("toast_recurringOk"));
  };

  const prosesRecurring=()=>{
    // Proses recurring untuk bulan aktif
    const monthKey=`${yr}-${String(bulanIdx+1).padStart(2,"0")}`;
    const aktifList=s.recurring.filter(r=>r.aktif);
    if(!aktifList.length){showToast(t("toast_noRecurring"));return;}
    let count=0;
    let newTxs=[...s.txs];
    let newDompet=[...s.dompet];
    const newProcessed={...s.processedRecurring};

    aktifList.forEach(r=>{
      const key=`${r.id}_${monthKey}`;
      if(newProcessed[key])return; // sudah diproses bulan ini
      const tgl=`${monthKey}-${String(r.hari).padStart(2,"0")}`;
      const jmlNum=N(r.jml);
      newTxs=[{id:Date.now()+count,tipe:r.tipe,tgl,ket:`[${lang==="en"?"Recurring":"Rutin"}] ${r.nama}`,jml:r.jml,katId:r.katId,dompetId:r.dompetId,subKat:""},...newTxs];
      newDompet=newDompet.map(d=>{
        if(d.id!==r.dompetId)return d;
        if(r.tipe==="pemasukan")return{...d,saldo:String(N(d.saldo)+jmlNum)};
        if(r.tipe==="pengeluaran"||r.tipe==="tabungan")return{...d,saldo:String(N(d.saldo)-jmlNum)};
        return d;
      });
      newProcessed[key]=true;
      count++;
    });
    if(count===0){showToast("ℹ️ Semua transaksi rutin sudah diproses bulan ini");return;}
    setS(p=>({...p,txs:newTxs,dompet:newDompet,processedRecurring:newProcessed}));
    showToast(`✅ ${count} transaksi rutin berhasil diproses!`);
  };

  // ── AMPLOP DIGITAL ──────────────────────────────────────────────────────────
  const addAmplop=()=>{
    if(!amplopForm.nama||!amplopForm.alokasi){showToast("⚠️ Isi nama & alokasi!");return;}
    const jmlNum=N(amplopForm.alokasi);
    const dompetSumber=s.dompet.find(d=>d.id===amplopForm.dompetId);
    if(dompetSumber&&N(dompetSumber.saldo)<jmlNum){
      showToast(`⚠️ ${t("toast_notEnough")} (${dompetSumber.nama})`);return;
    }
    setS(p=>({
      ...p,
      amplop:[...p.amplop,{...amplopForm,id:Date.now(),alokasi:pN(amplopForm.alokasi),terpakai:"0"}],
      dompet:p.dompet.map(d=>d.id===amplopForm.dompetId?{...d,saldo:String(N(d.saldo)-jmlNum)}:d),
      txs:[{id:Date.now()+1,tipe:"pengeluaran",tgl:today(),ket:`Isi Amplop: ${amplopForm.nama}`,jml:pN(amplopForm.alokasi),dompetId:amplopForm.dompetId},...p.txs]
    }));
    setAmplopForm({nama:"",icon:"✉️",warna:"#8B5CF6",dompetId:1,alokasi:""});
    setShowAddAmplop(false);
    showToast(t("toast_envelopeOk"));
  };

  const isiAmplop=(id,jml,dompetId)=>{
    const jmlNum=N(jml);
    const dompetSumber=s.dompet.find(d=>d.id===dompetId);
    if(dompetSumber&&N(dompetSumber.saldo)<jmlNum){showToast(`⚠️ Saldo tidak cukup!`);return;}
    setS(p=>({
      ...p,
      amplop:p.amplop.map(a=>a.id!==id?a:{...a,alokasi:String(N(a.alokasi)+jmlNum)}),
      dompet:p.dompet.map(d=>d.id===dompetId?{...d,saldo:String(N(d.saldo)-jmlNum)}:d),
      txs:[{id:Date.now(),tipe:"pengeluaran",tgl:today(),ket:`Top-up Amplop`,jml:pN(jml),dompetId},...p.txs]
    }));
    setAmplopIsiForm({id:null,jml:"",dompetId:1});
    showToast(t("toast_topupOk"));
  };

  const pakaiAmplop=(amplopId,jml,ket)=>{
    const jmlNum=N(jml);
    const amp=s.amplop.find(a=>a.id===amplopId);
    if(!amp){showToast(t("toast_envelopeNotFound"));return;}
    const sisaAmplop=N(amp.alokasi)-N(amp.terpakai||0);
    if(jmlNum>sisaAmplop){showToast(`${t("toast_envelopeFunds")} ${IDR(sisaAmplop)}`);return;}
    setS(p=>({
      ...p,
      amplop:p.amplop.map(a=>a.id!==amplopId?a:{...a,terpakai:String(N(a.terpakai||0)+jmlNum)}),
      txs:[{id:Date.now(),tipe:"pengeluaran",tgl:today(),ket:ket||`Pakai Amplop: ${amp.nama}`,jml:pN(jml),dompetId:amp.dompetId||1},...p.txs]
    }));
    showToast(t("toast_expenseEnvOk"));
  };

  const resetAmplop=(id)=>{
    setS(p=>({...p,amplop:p.amplop.map(a=>a.id!==id?a:{...a,terpakai:"0"})}));
    showToast(t("toast_resetEnvOk"));
  };

  const addTx=()=>{
    const {tipe,tgl,ket,jml,katId,subKat,dompetId,dompetTo,biaya,goalId}=txForm;
    if(!tgl||!jml){showToast("⚠️ Isi tanggal & jumlah!");return;}
    const id=Date.now();
    const jmlNum=N(jml);

    if(tipe==="transfer"){
      const sumber=s.dompet.find(d=>d.id===dompetId);
      if(!sumber){showToast(t("toast_walletNotFound"));return;}
      if(N(sumber.saldo)<jmlNum+N(biaya)){showToast(`⚠️ ${t("toast_notEnough")} (${sumber.nama}: ${IDR(N(sumber.saldo))})`  );return;}
      if(dompetId===dompetTo){showToast(t("toast_sameDompet"));return;}
      setS(p=>({...p,
        dompet:p.dompet.map(d=>{
          if(d.id===dompetId)return{...d,saldo:String(N(d.saldo)-jmlNum-N(biaya))};
          if(d.id===dompetTo)return{...d,saldo:String(N(d.saldo)+jmlNum)};
          return d;
        }),
        txs:[{...txForm,id,tipe:"transfer",jml:pN(jml)},...p.txs]
      }));
      setTxForm(f=>({...f,tgl:today(),ket:"",jml:"",biaya:""}));
      showToast(t("toast_transferOk"));setModal(null);return;
    }

    if(tipe==="pengeluaran"){
      const dompetSumber=s.dompet.find(d=>d.id===dompetId);
      if(dompetSumber&&N(dompetSumber.saldo)<jmlNum){
        showToast(`⚠️ ${t("toast_notEnough")} (${dompetSumber.nama}: ${IDR(N(dompetSumber.saldo))})`  );
        return;
      }
      setS(p=>({...p,
        dompet:p.dompet.map(d=>d.id===dompetId?{...d,saldo:String(N(d.saldo)-jmlNum)}:d),
        txs:[{...txForm,id,jml:pN(jml)},...p.txs]
      }));
      setTxForm(f=>({...f,tgl:today(),ket:"",jml:"",subKat:"",goalId:""}));
      showToast(t("toast_expenseOk"));setModal(null);return;
    }

    if(tipe==="pemasukan"){
      const incomeKat = KAT_IN.includes(katId) ? katId : "Lainnya";
      setS(p=>({...p,
        dompet:p.dompet.map(d=>d.id===dompetId?{...d,saldo:String(N(d.saldo)+jmlNum)}:d),
        txs:[{...txForm,id,jml:pN(jml),katId:incomeKat,subKat:""},...p.txs]
      }));
      setTxForm(f=>({...f,tgl:today(),ket:"",jml:"",katId:incomeKat,subKat:"",goalId:""}));
      showToast(t("toast_incomeOk"));setModal(null);return;
    }

    if(tipe==="tabungan"){
      const dompetSumber=s.dompet.find(d=>d.id===dompetId);
      if(dompetSumber&&N(dompetSumber.saldo)<jmlNum){
        showToast(`⚠️ Saldo ${dompetSumber.nama} tidak cukup! Saldo: ${IDR(N(dompetSumber.saldo))}`);
        return;
      }
      setS(p=>({
        ...p,
        dompet:p.dompet.map(d=>d.id===dompetId?{...d,saldo:String(N(d.saldo)-jmlNum)}:d),
        goals:goalId?p.goals.map(g=>g.id===Number(goalId)?{...g,kumpul:String(N(g.kumpul)+jmlNum),history:[...(g.history||[]),{tgl:today(),jml:pN(jml)}]}:g):p.goals,
        txs:[{...txForm,id,jml:pN(jml)},...p.txs]
      }));
      setTxForm(f=>({...f,tgl:today(),ket:"",jml:"",subKat:"",goalId:""}));
      showToast(goalId?t("toast_savingOk"):t("toast_savingOk2"));setModal(null);return;
    }

    const savedTx={...txForm,id,jml:pN(jml)};
    setS(p=>({...p,txs:[savedTx,...p.txs]}));
    setTxForm(f=>({...f,tgl:today(),ket:"",jml:"",subKat:"",goalId:""}));
    showToast(t("toast_txOk"));setModal(null);
  };

  const addBulk=()=>{
    const valid=bulkRows.filter(r=>r.tgl&&r.jml);
    if(!valid.length){showToast("⚠️ Minimal satu baris terisi!");return;}
    const newTxs=valid.map((r,i)=>({...r,id:Date.now()+i,jml:pN(r.jml),ket:r.ket||""}));
    // Hitung delta saldo per dompet
    const dompetDelta={};
    valid.forEach(r=>{
      const d=Number(r.dompetId)||1;
      const jmlNum=N(r.jml);
      if(!dompetDelta[d])dompetDelta[d]=0;
      if(r.tipe==="pemasukan")dompetDelta[d]+=jmlNum;
      else if(r.tipe==="pengeluaran"||r.tipe==="tabungan")dompetDelta[d]-=jmlNum;
    });
    setS(p=>({
      ...p,
      txs:[...newTxs,...p.txs],
      dompet:p.dompet.map(d=>dompetDelta[d.id]!==undefined?{...d,saldo:String(N(d.saldo)+dompetDelta[d.id])}:d)
    }));
    setBulkRows([{tgl:today(),jml:"",tipe:"pengeluaran",dompetId:1,katId:"",ket:""}]);
    showToast(`✅ ${valid.length} transaksi ditambahkan & saldo diperbarui!`);setModal(null);
  };

  const addUt=()=>{
    if(!utForm.tgl||!utForm.nama||!utForm.jml){showToast("⚠️ Isi semua field!");return;}
    const provider=utForm.provider==="Lainnya"?"":(utForm.provider||detectDebtProvider(utForm.nama));
    setS(p=>({...p,utang:[{...utForm,provider,id:Date.now(),lunas:false,cicilan:[]},...p.utang]}));
    setUtForm({tipe:"utang",tgl:today(),provider:"",nama:"",jml:"",tempo:"",ket:""});
    showToast(t("toast_noteOk"));
  };

  const addGoal=()=>{
    if(!goalForm.nama||!goalForm.target){showToast("⚠️ Isi nama & target!");return;}
    setS(p=>({...p,goals:[{...goalForm,id:Date.now(),kumpul:goalForm.kumpul||"0",history:[],selesai:false},...p.goals]}));
    setGoalForm({nama:"",target:"",kumpul:"",deadline:"",icon:"⭐"});
    showToast("✅ Goal ditambahkan!");setModal(null);
  };

  const addDompet=()=>{
    if(!dompetForm.nama){showToast("⚠️ Isi nama dompet!");return;}
    setS(p=>({...p,dompet:[...p.dompet,{...dompetForm,id:Date.now(),icon:DOMPET_ICONS[dompetForm.tipe]||"💳",saldo:dompetForm.saldo||"0"}]}));
    setDompetForm({tipe:"Bank",nama:"",norek:"",saldo:""});
    showToast(t("toast_walletAdded"));setModal(null);
  };

  const addAset = () => {
    if(!asetForm.nama){showToast("⚠️ Isi nama aset!");return;}
    if(asetForm.beliDariDompet) {
       const targetDompet = s.dompet.find(d=>d.id===asetForm.dompetId);
       if(targetDompet && N(targetDompet.saldo) < N(asetForm.nilai)) {
           showToast(t("toast_walletNotEnough")); return;
       }
       setS(p=>({...p,
          asetTetap:[...p.asetTetap,{id:Date.now(), nama:asetForm.nama, nilai:asetForm.nilai, ket:asetForm.ket}],
          dompet:p.dompet.map(d=>d.id===asetForm.dompetId ? {...d, saldo: String(N(d.saldo)-N(asetForm.nilai))} : d),
          txs:[{id:Date.now()+1, tipe:"pengeluaran", tgl:today(), ket:`Beli Aset: ${asetForm.nama}`, jml:pN(asetForm.nilai), dompetId:asetForm.dompetId}, ...p.txs]
       }));
    } else {
       setS(p=>({...p,asetTetap:[...p.asetTetap,{id:Date.now(), nama:asetForm.nama, nilai:asetForm.nilai, ket:asetForm.ket}]}));
    }
    setAsetForm({nama:"",nilai:"",ket:"",beliDariDompet:false,dompetId:s.dompet[0]?.id||1});
    showToast("✅ Aset ditambahkan!");setModal(null);
  }

  const catatCicilan=(uid,jml,dompetId)=>{
    const targetDompet = s.dompet.find(d=>d.id===dompetId);
    if(targetDompet && N(targetDompet.saldo) < N(jml)) { showToast("⚠️ Saldo dompet tidak cukup!"); return; }
    
    setS(p=>({...p,
       utang:p.utang.map(u=>{if(u.id!==uid)return u;const nc=[...u.cicilan,{tgl:today(),jml}];const tc=nc.reduce((a,b)=>a+N(b.jml),0);return{...u,cicilan:nc,lunas:tc>=N(u.jml)};}),
       dompet:p.dompet.map(d=>d.id===dompetId ? {...d, saldo: String(N(d.saldo)-N(jml))} : d),
       txs:[{id:Date.now(), tipe:"pengeluaran", tgl:today(), ket:`Bayar Utang/Cicilan: ${p.utang.find(x=>x.id===uid)?.nama}`, jml:pN(jml), dompetId:dompetId}, ...p.txs]
    }));
    showToast(t("toast_paymentOk"));
  };

  const tambahGoalDana=(gid,jml,dompetId)=>{
    const targetDompet = s.dompet.find(d=>d.id===dompetId);
    if(targetDompet && N(targetDompet.saldo) < N(jml)) { showToast("⚠️ Saldo dompet tidak cukup!"); return; }

    setS(p=>({...p,
       goals:p.goals.map(g=>g.id!==gid?g:{...g,kumpul:String(N(g.kumpul)+N(jml)),history:[...(g.history||[]),{tgl:today(),jml}]}),
       dompet:p.dompet.map(d=>d.id===dompetId ? {...d, saldo: String(N(d.saldo)-N(jml))} : d),
       txs:[{id:Date.now(), tipe:"tabungan", tgl:today(), ket:`Nabung Goal: ${p.goals.find(x=>x.id===gid)?.nama}`, jml:pN(jml), dompetId:dompetId}, ...p.txs]
    }));
    showToast(t("toast_fundOk"));
  };

  const confirmDelete=({title,msg,onConfirm,toastMsg="Data berhasil dihapus"})=>{
    setModal({
      type:"confirm",
      title,
      msg,
      danger:true,
      onConfirm:()=>{
        onConfirm();
        setModal(null);
        showToast(toastMsg);
      }
    });
  };

  const deleteTx=(tx)=>confirmDelete({
    title:"Hapus transaksi?",
    msg:`Transaksi "${tx.ket||tx.tipe}" akan dihapus dan saldo dompet terkait akan disesuaikan ulang.`,
    toastMsg:"Transaksi dihapus",
    onConfirm:()=>setS(p=>{
      const jmlNum=N(tx.jml);
      let newDompet=p.dompet;
      if(tx.tipe==="pemasukan"&&tx.dompetId){
        newDompet=p.dompet.map(d=>d.id===tx.dompetId?{...d,saldo:String(N(d.saldo)-jmlNum)}:d);
      }else if((tx.tipe==="pengeluaran"||tx.tipe==="tabungan")&&tx.dompetId){
        newDompet=p.dompet.map(d=>d.id===tx.dompetId?{...d,saldo:String(N(d.saldo)+jmlNum)}:d);
      }else if(tx.tipe==="transfer"){
        newDompet=p.dompet.map(d=>{
          if(d.id===tx.dompetId)return{...d,saldo:String(N(d.saldo)+jmlNum+N(tx.biaya||0))};
          if(d.id===tx.dompetTo)return{...d,saldo:String(N(d.saldo)-jmlNum)};
          return d;
        });
      }
      return{...p,txs:p.txs.filter(x=>x.id!==tx.id),dompet:newDompet};
    })
  });

  const renderTxItem=t=>{
    const dompet=s.dompet.find(d=>d.id===t.dompetId);
    const kat=s.budgets.find(b=>b.id===t.katId);
    const isIn=t.tipe==="pemasukan"||t.tipe==="pemasukan_transfer";
    const txKatLabel=isIn
      ? (KAT_IN.includes(t.katId) ? t.katId : (typeof t.katId==="string" ? t.katId : "Lainnya"))
      : kat?.kat;
    const colorMap={pemasukan:T.ok,tabungan:T.info,transfer:T.accent,pengeluaran:T.err};
    return(
      <div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${T.borderLight}`}}>
        <div style={{display:"flex",gap:10,alignItems:"center",minWidth:0}}>
          <div style={{width:36,height:36,borderRadius:10,background:isIn?T.okBg:t.tipe==="tabungan"?T.infoBg:t.tipe==="transfer"?T.accentBg:T.errBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0}}>
            {isIn?"📈":t.tipe==="tabungan"?"🏦":t.tipe==="transfer"?"↔️":kat?uiIcon(kat.icon):"📉"}
          </div>
          <div style={{minWidth:0}}>
            <div style={{fontSize:13,fontWeight:600,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.ket||t.tipe}</div>
            <div style={{fontSize:11,color:T.muted}}>{t.tgl}{dompet&&` · ${uiIcon(dompet.icon)} ${dompet.nama}`}{txKatLabel&&` · ${txKatLabel}`}{t.subKat&&` › ${t.subKat}`}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
          <span style={{fontWeight:700,fontSize:13,color:isIn?T.ok:t.tipe==="tabungan"?T.info:t.tipe==="transfer"?T.accent:T.err}}>
            {isIn?"+":t.tipe==="tabungan"?"💰":t.tipe==="transfer"?"→":"-"}{IDRs(N(t.jml))}
          </span>
          <Del onClick={()=>deleteTx(t)}/>
        </div>
      </div>
    );
  };

  const IS={width:"100%",padding:"9px 12px",border:`1.5px solid ${T.inputBorder}`,borderRadius:9,fontSize:13,outline:"none",background:T.input,color:T.text,fontFamily:"inherit"};
  const LS={fontSize:10,color:T.accent,marginBottom:5,fontWeight:700,display:"block",textTransform:"uppercase",letterSpacing:.9};

  // ── ONBOARDING HANDLER ─────────────────────────────────────────────────────
  const handleOnboardDone = ({name, dompet, budgets}) => {
    const newData = {...s, name, dompet, budgets};
    setS(newData);
    try{localStorage.setItem("aturduitku_onboarded","1");}catch(e){}
    try{if(fireUser?.uid) localStorage.setItem(LOCAL_OWNER_KEY, fireUser.uid);}catch(e){}
    setOnboarded(true);
    // Save to Firebase immediately on onboard
    if(fireUser && isApproved){
      saveCloudData(fireUser.uid, {data:newData, onboarded:true});
    }
    showToast(`Selamat datang, ${name}! 🎉`);
  };

  const activeRecap=modal?.recap||monthlyRecap;
  const supportEmail="ichzan24@gmail.com";
  const supportWhatsapp="087785472696";
  const supportInstagram="@iksanarsana";
  const supportInstagramHref="https://www.instagram.com/iksanarsana/";
  const supportSubject=encodeURIComponent("Bantuan AturDuitku");
  const supportBody=encodeURIComponent(`Halo admin AturDuitku,\n\nSaya butuh bantuan untuk akun:\nEmail akun: ${fireUser?.email||accessProfile?.email||""}\nStatus: ${accessProfile?.approvalStatus||"belum login"}\n\nKendala saya:\n`);
  const supportWhatsappHref="https://wa.me/6287785472696?text="+supportBody;
  const supportHref=`mailto:${supportEmail}?subject=${supportSubject}&body=${supportBody}`;
  const supportBugBody=encodeURIComponent(`Halo admin AturDuitku,\n\nSaya mau lapor kendala/bug.\n\nEmail akun: ${fireUser?.email||accessProfile?.email||"-"}\nNama: ${accessProfile?.displayName||fireUser?.displayName||s.name||"-"}\nHalaman: ${page}\nStatus akun: ${accessProfile?.approvalStatus||"belum login"}\nStatus sync: ${!isOnline?"offline":syncStatus}\nMode PWA: ${isStandalone?"terpasang":"browser"}\nPerangkat: ${typeof navigator!=="undefined"?(navigator.userAgent||"").slice(0,160):"-"}\n\nKendala yang saya alami:\n`);
  const supportBugWhatsappHref="https://wa.me/6287785472696?text="+supportBugBody;

  // Show loading screen while checking auth
  if(fireLoading || accessLoading) return (
    <div style={{minHeight:"var(--app-height, 100dvh)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"radial-gradient(circle at 50% 20%,#5B21B6 0%,#2E1065 42%,#13051F 100%)",gap:16,padding:"env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px)",fontFamily:"system-ui,sans-serif"}}>
      <style>{`@keyframes loadCat{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-10px) rotate(2deg)}}@keyframes loadBar{0%{transform:translateX(-100%)}100%{transform:translateX(260%)}}`}</style>
      <img src="/icon-192.png" alt="" style={{width:84,height:84,borderRadius:24,objectFit:"cover",animation:"loadCat 1.6s ease-in-out infinite",boxShadow:"0 18px 42px rgba(124,58,237,.45)"}}/>
      <div style={{color:"white",fontWeight:900,fontSize:20,letterSpacing:-.3}}>AturDuitku</div>
      <div style={{color:"#DDD6FE",fontSize:12,fontWeight:700}}>Menyiapkan data akunmu...</div>
      <div style={{width:190,height:7,borderRadius:99,background:"rgba(255,255,255,.14)",overflow:"hidden",border:"1px solid rgba(255,255,255,.12)"}}>
        <div style={{width:70,height:"100%",borderRadius:99,background:"linear-gradient(90deg,transparent,#C4B5FD,transparent)",animation:"loadBar 1.15s ease-in-out infinite"}}/>
      </div>
      <div style={{color:"#A78BFA",fontSize:11}}>Sinkronisasi cloud berjalan otomatis</div>
    </div>
  );

  // Show Google login if not authenticated
  if(!fireUser) return (
    <div style={{minHeight:"var(--app-height, 100dvh)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#2E1065 0%,#1A0A2E 100%)",padding:"max(24px, env(safe-area-inset-top, 0px)) max(24px, env(safe-area-inset-right, 0px)) max(24px, env(safe-area-inset-bottom, 0px)) max(24px, env(safe-area-inset-left, 0px))",fontFamily:"system-ui,sans-serif"}}>
      <div style={{width:"100%",maxWidth:360,display:"flex",flexDirection:"column",alignItems:"center",gap:0}}>
        {/* Logo */}
        <img className="cat-mascot" src="/icon-192.png" alt="AturDuitku" style={{width:88,height:88,borderRadius:22,objectFit:"cover",marginBottom:20,boxShadow:"0 8px 32px rgba(124,58,237,0.5)"}}/>
        <div style={{color:"white",fontWeight:800,fontSize:28,marginBottom:6,letterSpacing:-0.5}}>AturDuitku</div>
        <div style={{color:"#A78BFA",fontSize:14,marginBottom:36,textAlign:"center",lineHeight:1.6}}>Teman finansial harian<br/>buat catat, paham, dan tumbuh lebih rapi</div>

        {/* Features */}
        <div style={{width:"100%",background:"rgba(124,58,237,0.15)",borderRadius:16,padding:20,marginBottom:28,border:"1px solid rgba(124,58,237,0.3)"}}>
          {[
            ["🧾","Catat pemasukan dan pengeluaran dengan cepat"],
            ["🤖","AI bantu analisis kondisi keuanganmu"],
            ["☁️","Sinkron otomatis ke semua perangkat"],
            ["📊","Laporan dan insight yang gampang dipahami"],
          ].map(([icon,txt])=>(
            <div key={txt} style={{display:"flex",alignItems:"center",gap:12,marginBottom:12,lastChild:{marginBottom:0}}}>
              <span style={{width:42,height:42,borderRadius:14,background:"rgba(255,255,255,.09)",border:"1px solid rgba(255,255,255,.14)",color:"#DDD6FE",fontSize:22,fontWeight:800,letterSpacing:0,textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{icon}</span>
              <span style={{color:"#E9D5FF",fontSize:13,lineHeight:1.45}}>{txt}</span>
            </div>
          ))}
        </div>

        {/* Google Sign In Button */}
        <button onClick={handleGoogleSignIn} style={{width:"100%",padding:"14px 20px",borderRadius:14,border:"none",background:"white",color:"#1F1F1F",fontWeight:700,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:12,boxShadow:"0 4px 20px rgba(0,0,0,0.3)",fontFamily:"inherit",transition:"all 0.2s"}}>
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Masuk dengan Google
        </button>

        <div style={{width:"100%",display:"flex",alignItems:"center",gap:10,margin:"18px 0 14px"}}>
          <div style={{height:1,flex:1,background:"rgba(255,255,255,.12)"}}/>
          <div style={{color:"#C4B5FD",fontSize:11,fontWeight:700,letterSpacing:1}}>ATAU EMAIL</div>
          <div style={{height:1,flex:1,background:"rgba(255,255,255,.12)"}}/>
        </div>

        <div style={{width:"100%",background:"rgba(255,255,255,.06)",borderRadius:16,padding:18,border:"1px solid rgba(255,255,255,.08)"}}>
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            {[["signin","Masuk"],["signup","Daftar"]].map(([mode,label])=>(
              <button key={mode} onClick={()=>{setAuthMode(mode);setAuthError("");}} style={{flex:1,padding:"10px 12px",borderRadius:12,border:`1.5px solid ${authMode===mode?"#C4B5FD":"rgba(255,255,255,.1)"}`,background:authMode===mode?"rgba(196,181,253,.18)":"transparent",color:"white",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{label}</button>
            ))}
          </div>
          {authMode==="signup"&&<input value={authForm.name} onChange={e=>setAuthForm(f=>({...f,name:e.target.value}))} placeholder="Nama lengkap" style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.08)",color:"white",marginBottom:10,outline:"none"}}/>}
          <input value={authForm.email} onChange={e=>setAuthForm(f=>({...f,email:e.target.value}))} placeholder="Email" type="email" style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.08)",color:"white",marginBottom:10,outline:"none"}}/>
          <input value={authForm.password} onChange={e=>setAuthForm(f=>({...f,password:e.target.value}))} placeholder="Password" type="password" style={{width:"100%",padding:"12px 14px",borderRadius:12,border:"1px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.08)",color:"white",marginBottom:10,outline:"none"}}/>
          {authError&&<div style={{fontSize:11,color:"#FCA5A5",marginBottom:10,lineHeight:1.5,background:"rgba(127,29,29,.22)",border:"1px solid rgba(252,165,165,.26)",borderRadius:10,padding:"9px 11px"}}>{authError}</div>}
          <button onClick={handleEmailAuth} style={{width:"100%",padding:"13px 16px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#8B5CF6,#6D28D9)",color:"white",fontWeight:800,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>
            {authMode==="signup" ? "Daftar dengan Email" : "Masuk dengan Email"}
          </button>
          <div style={{fontSize:10,color:"#A78BFA",lineHeight:1.55,marginTop:10,textAlign:"center"}}>
            Google dan Email bisa dipakai setelah provider aktif di Firebase.
          </div>
        </div>

        <div style={{color:"#6D28D9",fontSize:11,marginTop:16,textAlign:"center",lineHeight:1.6}}>
          Setelah daftar, akunmu akan dicek admin dulu<br/>supaya akses penuh tetap rapi dan aman
        </div>
        <a href={supportHref} style={{marginTop:14,color:"#C4B5FD",fontSize:12,fontWeight:800,textDecoration:"none",background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.1)",borderRadius:999,padding:"9px 13px"}}>
          Butuh bantuan? Hubungi admin
        </a>
      </div>
    </div>
  );

  if(!isApproved) return (
    <div style={{minHeight:"var(--app-height, 100dvh)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#2E1065 0%,#1A0A2E 100%)",padding:"max(24px, env(safe-area-inset-top, 0px)) max(24px, env(safe-area-inset-right, 0px)) max(24px, env(safe-area-inset-bottom, 0px)) max(24px, env(safe-area-inset-left, 0px))",fontFamily:"system-ui,sans-serif"}}>
      <div style={{width:"100%",maxWidth:420,background:"rgba(255,255,255,.08)",borderRadius:22,padding:24,border:"1px solid rgba(255,255,255,.1)",boxShadow:"0 20px 60px rgba(0,0,0,.22)"}}>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16}}>
          <img src={fireUser?.photoURL || "/icon-192.png"} alt="" style={{width:54,height:54,borderRadius:"50%",objectFit:"cover",border:"2px solid rgba(255,255,255,.2)"}}/>
          <div>
            <div style={{color:"white",fontWeight:800,fontSize:18}}>{accessProfile?.displayName || fireUser?.displayName || "Akun baru"}</div>
            <div style={{color:"#C4B5FD",fontSize:12}}>{accessProfile?.email || fireUser?.email || ""}</div>
          </div>
        </div>
        <div style={{display:"inline-flex",alignItems:"center",gap:8,background:accessProfile?.approvalStatus==="rejected"?"rgba(239,68,68,.16)":"rgba(250,204,21,.14)",color:accessProfile?.approvalStatus==="rejected"?"#FCA5A5":"#FDE68A",borderRadius:99,padding:"8px 14px",fontSize:12,fontWeight:800,marginBottom:14}}>
          {accessProfile?.approvalStatus==="rejected"?"Ditolak":"Menunggu approval admin"}
        </div>
        <div style={{color:"white",fontSize:14,lineHeight:1.7,marginBottom:14}}>
          {accessProfile?.approvalStatus==="rejected"
            ?"Akun ini sudah direview tetapi belum bisa diaktifkan. Kamu masih bisa hubungi admin untuk minta pengecekan ulang."
            :"Akun berhasil dibuat. Sekarang admin akan cek pembayaran dan mengaktifkan akses penuh setelah semuanya sesuai."}
        </div>
        {accessProfile?.approvalStatus!=="rejected"&&<div style={{display:"grid",gridTemplateColumns:"1fr",gap:8,marginBottom:14}}>
          {["Akun berhasil dibuat","Admin cek kecocokan pembayaran","Akses penuh dibuka setelah valid"].map((item,i)=><div key={item} style={{display:"flex",alignItems:"center",gap:10,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",borderRadius:12,padding:"10px 12px",color:i===2?"#C4B5FD":"white",fontSize:12,fontWeight:700}}><span style={{width:22,height:22,borderRadius:999,display:"inline-flex",alignItems:"center",justifyContent:"center",background:i===0?"rgba(134,239,172,.18)":i===1?"rgba(250,204,21,.18)":"rgba(196,181,253,.18)",color:i===0?"#86EFAC":i===1?"#FDE68A":"#C4B5FD",fontSize:11}}>{i+1}</span>{item}</div>)}
        </div>}
        {accessProfile?.adminNotes&&<div style={{background:"rgba(255,255,255,.06)",borderRadius:14,padding:14,color:"#E9D5FF",fontSize:12,lineHeight:1.6,marginBottom:14}}>
          Catatan admin: {accessProfile.adminNotes}
        </div>}
        <div style={{background:"linear-gradient(135deg,rgba(34,197,94,.14),rgba(124,58,237,.16))",border:"1px solid rgba(196,181,253,.22)",borderRadius:16,padding:14,marginBottom:14}}>
          <div style={{display:"flex",gap:11,alignItems:"flex-start",marginBottom:10}}>
            <img src="/icon-192.png" alt="" style={{width:38,height:38,borderRadius:12,objectFit:"cover",boxShadow:"0 8px 20px rgba(124,58,237,.24)",flexShrink:0}}/>
            <div style={{minWidth:0}}>
              <div style={{color:"white",fontWeight:900,fontSize:14,marginBottom:3}}>Butuh bantuan approval?</div>
              <div style={{color:"#DDD6FE",fontSize:12,lineHeight:1.55}}>Kirim email pembeli dan Order ID Scalev ke admin. Biasanya ini yang paling cepat mempercepat pengecekan.</div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <a href={supportWhatsappHref} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:7,color:"#052E16",fontWeight:900,textDecoration:"none",background:"#86EFAC",border:"1px solid rgba(134,239,172,.45)",borderRadius:12,padding:"10px 11px",fontSize:12}}>WhatsApp</a>
            <a href={supportInstagramHref} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:7,color:"white",fontWeight:900,textDecoration:"none",background:"rgba(124,58,237,.72)",border:"1px solid rgba(196,181,253,.32)",borderRadius:12,padding:"10px 11px",fontSize:12}}>Instagram</a>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <button onClick={async()=>{setAccessLoading(true);try{await loadAccessProfile();}finally{setAccessLoading(false);}}} style={{padding:"12px 14px",borderRadius:12,border:"1px solid rgba(255,255,255,.14)",background:"rgba(255,255,255,.08)",color:"white",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{accessLoading?"Mengecek...":"Cek status lagi"}</button>
          <button onClick={confirmSignOut} style={{padding:"12px 14px",borderRadius:12,border:"1px solid rgba(252,165,165,.35)",background:"rgba(127,29,29,.22)",color:"#FCA5A5",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Keluar</button>
        </div>
      </div>
    </div>
  );

  if (!onboarded) return <Onboarding onDone={handleOnboardDone} lang={lang} changeLang={changeLang}/>;

  // ── IMPORT MUTASI HANDLER ──────────────────────────────────────────────────
  const handleImportMutasi = (txRows, dompetId) => {
    setS(prev => {
      const newTxs = [...prev.txs, ...txRows];
      // Hitung delta saldo per dompet dari baris yang diimport
      const deltaSaldo = {};
      txRows.forEach(r => {
        const did = r.dompetId;
        if (!deltaSaldo[did]) deltaSaldo[did] = 0;
        if (r.tipe==="pemasukan") deltaSaldo[did] += Number(r.jml||0);
        else if (r.tipe==="pengeluaran") deltaSaldo[did] -= Number(r.jml||0);
      });
      const newDompet = prev.dompet.map(d => ({
        ...d,
        saldo: String(Math.max(0, N(d.saldo) + (deltaSaldo[d.id]||0)))
      }));
      return {...prev, txs:newTxs, dompet:newDompet};
    });
    showToast(`✅ ${txRows.length} transaksi berhasil diimport!`);
    setModal(null);
  };

  return(
    <ThemeCtx.Provider value={T}>
    {/* LAYOUT 100vh FULL (FIX SIDEBAR BOLONG) */}
    <div style={{display:"flex",height:"var(--app-height, 100dvh)",overflow:"hidden",maxWidth:"100vw",width:"100%",background:T.bg,fontFamily:"'Nunito',system-ui,sans-serif",color:T.text,fontSize:14,position:"relative",transition:"background .3s,color .3s"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body,#root,button,input,select,textarea{font-family:'Nunito',system-ui,sans-serif;}
        ::-webkit-scrollbar{width:5px;}
        ::-webkit-scrollbar-thumb{background:${T.scroll};border-radius:99px;}
        ::-webkit-scrollbar-track{background:transparent;}
        input,select,textarea{transition:border-color .15s,box-shadow .15s;}
        input:focus,select:focus,textarea:focus{outline:none!important;border-color:${T.accent}!important;box-shadow:0 0 0 3px ${T.accentPop}!important;}
        button:focus{outline:none;}
        button,[role="button"],.nav-item,.icon-action,.btn-go,.quick-action-item,.bottom-nav-item{touch-action:manipulation;-webkit-tap-highlight-color:transparent;}
        .topbar-safe{box-shadow:0 8px 28px rgba(31,20,70,.06);}
        .icon-action{transition:all .15s cubic-bezier(.4,0,.2,1);-webkit-tap-highlight-color:transparent;}
        .icon-action:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(139,92,246,.14);}
        .icon-action:active{transform:scale(.95);}
        .nav-item{transition:all .18s cubic-bezier(.4,0,.2,1);}
        .nav-item:hover{background:${T.navHover}!important;color:${T.accentSoft}!important;}
        .nav-item:active{transform:scale(.97);}
        .empty-polish{animation:fadeUp .25s ease-out both;}
        .btn-go{transition:all .15s cubic-bezier(.4,0,.2,1);}
        .btn-go:hover{filter:brightness(1.08);transform:translateY(-1px);box-shadow:0 6px 18px rgba(139,92,246,.25)!important;}
        .btn-go:active{transform:scale(.96);filter:brightness(.95);}
        .card-lift{transition:box-shadow .2s,transform .2s;}
        .card-lift:hover{box-shadow:${T.shadowMd}!important;transform:translateY(-2px);}
        .del-x{transition:color .15s,transform .15s;cursor:pointer;}
        .del-x:hover{color:#F43F5E!important;transform:rotate(12deg);}
        .bottom-nav{position:fixed;bottom:0;left:0;right:0;background:${T.nav};border-top:1.5px solid ${T.border};display:flex;z-index:200;padding-bottom:max(env(safe-area-inset-bottom),8px);padding-left:max(env(safe-area-inset-left),6px);padding-right:max(env(safe-area-inset-right),6px);box-shadow:0 -8px 28px rgba(31,20,70,.14);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);}
        .bottom-nav-item{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:9px 2px 7px;cursor:pointer;gap:4px;transition:all .15s;border:none;background:none;font-family:inherit;min-height:58px;-webkit-tap-highlight-color:transparent;touch-action:manipulation;border-radius:14px;margin:5px 1px;}
        .bottom-nav-item span:last-child{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .bottom-nav-item:hover{background:${T.navHover};}
        .bottom-nav-item:active{transform:scale(.9);}
        .sidebar-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:499;backdrop-filter:blur(2px);touch-action:none;}
        @keyframes slideIn{from{transform:translateX(-100%);}to{transform:translateX(0);}}
        @keyframes slideInRight{from{transform:translateX(100%);}to{transform:translateX(0);}}
        .sidebar-slide{animation:slideIn .22s cubic-bezier(.4,0,.2,1);}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:none;}}
        .page-in{animation:fadeUp .22s ease-out both;}
        @keyframes modalPop{from{opacity:0;transform:scale(.95) translateY(10px);}to{opacity:1;transform:none;}}
        .modal-pop{animation:modalPop .2s cubic-bezier(.34,1.36,.64,1) both;}
        @keyframes toastSlide{from{opacity:0;transform:translateX(16px);}to{opacity:1;transform:none;}}
        .toast-in{animation:toastSlide .25s ease-out;}
        @keyframes catBob{0%,100%{transform:translateY(0);}50%{transform:translateY(-3px);}}
        .cat-bob{display:inline-block;animation:catBob 2.2s ease-in-out infinite;}
        @keyframes catFloat{0%,100%{transform:translateY(0) rotate(-1deg);}50%{transform:translateY(-8px) rotate(1deg);}}
        @keyframes catJump{0%{transform:translateY(0) scale(1);}35%{transform:translateY(-20px) scale(1.08) rotate(-4deg);}70%{transform:translateY(2px) scale(.98) rotate(3deg);}100%{transform:translateY(0) scale(1);}}
        @keyframes premiumShine{0%{transform:translateX(-120%) skewX(-18deg);opacity:0;}25%{opacity:.28;}60%{opacity:.12;}100%{transform:translateX(180%) skewX(-18deg);opacity:0;}}
        @keyframes checkPop{0%{transform:scale(.86);box-shadow:0 0 0 0 ${T.accentPop};}55%{transform:scale(1.04);box-shadow:0 0 0 8px rgba(34,197,94,.12);}100%{transform:scale(1);box-shadow:none;}}
        .cat-mascot{animation:catFloat 3.8s ease-in-out infinite;transform-origin:center bottom;}
        .cat-mascot.win{animation:catJump .85s cubic-bezier(.2,.9,.24,1.2) both;}
        .premium-panel{position:relative;overflow:hidden;}
        .premium-panel:after{content:"";position:absolute;top:-40%;bottom:-40%;width:70px;left:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent);animation:premiumShine 5.5s ease-in-out infinite;pointer-events:none;}
        .habit-complete{animation:checkPop .32s ease-out both;}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:.4;}}
        .pulse{animation:pulse 2s infinite;}
        @keyframes notifBounce{0%,100%{transform:translateY(0);}30%{transform:translateY(-4px);}60%{transform:translateY(-2px);}}
        .notif-bounce{animation:notifBounce .5s ease-in-out;}
        .notif-card:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(15,23,42,.08);}
        @keyframes sheetIn{0%{transform:translateY(18px) scale(.96);opacity:0;}100%{transform:translateY(0) scale(1);opacity:1;}}
        @keyframes quickPop{0%{transform:scale(.82) rotate(-8deg);}65%{transform:scale(1.08) rotate(4deg);}100%{transform:scale(1) rotate(0);}}
        @keyframes shimmer{0%{background-position:120% 0;}100%{background-position:-120% 0;}}
        .quick-action-sheet{animation:sheetIn .22s cubic-bezier(.2,.9,.24,1.05) both;}
        .quick-action-item:hover{transform:translateY(-1px);box-shadow:0 10px 20px rgba(124,58,237,.12);}
        .quick-action-item:active{transform:scale(.98);}
        .fab.is-open{animation:quickPop .28s ease-out both;}
        .smooth-skeleton{background:linear-gradient(90deg,${T.cardAlt} 25%,rgba(255,255,255,.65) 42%,${T.cardAlt} 62%);background-size:220% 100%;animation:shimmer 1.35s ease-in-out infinite;border-radius:12px;}
        .premium-ring{animation:fadeUp .32s ease-out both;}
        .fab{position:fixed;bottom:calc(92px + max(env(safe-area-inset-bottom),8px));right:max(18px,env(safe-area-inset-right));z-index:190;min-width:92px;height:58px;border-radius:999px;background:linear-gradient(135deg,#8B5CF6 0%,#6D28D9 52%,#4C1D95 100%);border:1px solid rgba(255,255,255,.32);cursor:pointer;font-size:24px;display:flex;align-items:center;justify-content:center;gap:8px;padding:0 17px 0 13px;box-shadow:0 18px 34px rgba(109,40,217,.34),0 5px 12px rgba(15,23,42,.16),inset 0 1px 0 rgba(255,255,255,.32);transition:transform .15s,box-shadow .15s,min-width .15s,padding .15s;-webkit-tap-highlight-color:transparent;touch-action:manipulation;color:white;overflow:hidden;}
        .fab:before{content:"";position:absolute;inset:5px;border-radius:999px;border:1px solid rgba(255,255,255,.16);pointer-events:none;}
        .fab:after{content:"";position:absolute;top:-60%;bottom:-60%;left:-35%;width:34px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.46),transparent);transform:rotate(18deg);animation:premiumShine 4.8s ease-in-out infinite;pointer-events:none;}
        .fab-plus{position:relative;z-index:1;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.18);font-size:24px;font-weight:900;line-height:1;box-shadow:inset 0 1px 0 rgba(255,255,255,.26);}
        .fab-label{position:relative;z-index:1;font-size:13px;font-weight:950;letter-spacing:.1px;line-height:1;white-space:nowrap;}
        .fab.is-open{min-width:58px;padding:0;}
        .fab:hover{transform:scale(1.07);}
        .fab:active{transform:scale(.94);}
        @media(max-width:899px){
          .bottom-nav{backdrop-filter:none;-webkit-backdrop-filter:none;}
          .bottom-nav-item:hover,.quick-action-item:hover,.icon-action:hover,.btn-go:hover{transform:none;box-shadow:none!important;}
          .cat-mascot{animation-duration:6.5s;}
          .premium-panel:after,.fab:after{animation:none;opacity:.14;}
          .smooth-skeleton{animation-duration:1.9s;}
        }
        @media(display-mode:standalone) and (max-width:899px){
          .cat-mascot{animation:none;}
          .premium-panel:after,.fab:after{display:none;}
          .page-in,.modal-pop,.quick-action-sheet{animation:none;}
        }
        @media(max-width:767px){
  .mobile-hide{display:none!important;}
  .mobile-2col{grid-template-columns:1fr 1fr!important;}
  .mobile-1col{grid-template-columns:1fr!important;}
  .card-lift:hover{transform:none;}
  .btn-go:hover,.fab:hover,.ai-float-btn:hover{transform:none;}
  .page-in{animation:none;}
  input,select,textarea{min-height:40px;}
}
@media(max-width:374px){
  .bottom-nav-item{min-height:54px;padding-top:8px;}
  .bottom-nav-item span:first-child{font-size:18px!important;}
  .bottom-nav-item span:nth-child(2){font-size:8px!important;}
}
/* iOS input fix: prevent zoom on focus */
@media screen and (-webkit-min-device-pixel-ratio:0){
  select,textarea,input{font-size:16px!important;}
}
/* Android ripple-like active state */
button:active,.bottom-nav-item:active{opacity:.75;}
/* iOS standalone: hide status bar overlap */
@media(display-mode:standalone){
  .topbar-safe{padding-top:max(10px,env(safe-area-inset-top))!important;}
}
/* Prevent text selection on UI elements */
button,.bottom-nav-item,.nav-item,.quick-action-item,.icon-action{-webkit-user-select:none;user-select:none;}
      `}</style>

      {/* Toast */}
      {toast&&<div className="toast-in" style={{position:"fixed",top:"max(18px, calc(env(safe-area-inset-top) + 8px))",right:"max(14px, env(safe-area-inset-right))",left:isMobile?"max(14px, env(safe-area-inset-left))":"auto",maxWidth:isMobile?"none":"min(430px, calc(100vw - 28px))",background:T.card,color:T.text,padding:"12px 15px",borderRadius:14,fontSize:13,fontWeight:800,zIndex:9999,boxShadow:T.shadowMd,border:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:10,lineHeight:1.35}}><span style={{width:28,height:28,borderRadius:9,background:T.accentBg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><img src="/icon-192.png" style={{width:22,height:22,borderRadius:6,verticalAlign:"middle"}}/></span><span style={{minWidth:0,overflowWrap:"anywhere"}}>{toast}</span></div>}

      {/* Global Calculator */}
      {showCalc&&calcFor&&<Calculator value={calcFor.cur} onChange={v=>{calcFor.setter(v);setShowCalc(false);setCalcFor(null);}} onClose={()=>{setShowCalc(false);setCalcFor(null);}}/>}

      {/* Notification Panel */}
      {notifOpen&&<NotificationPanel notifs={notifications} onClose={()=>setNotifOpen(false)} onAction={openNotificationAction}/>}

      {/* More Menu (mobile) */}
      {moreOpen&&<MoreMenu page={page} setPage={setPage} navItems={navItems} onClose={()=>setMoreOpen(false)}/>}

      {/* Command Palette */}
      {commandOpen&&<div style={{position:"fixed",inset:0,background:"rgba(15,6,38,.52)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",zIndex:980,display:"flex",alignItems:isMobile?"flex-start":"center",justifyContent:"center",padding:isMobile?"max(18px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) 14px max(14px, env(safe-area-inset-left))":"22px"}} onClick={()=>setCommandOpen(false)}>
        <div className="modal-pop" style={{width:"100%",maxWidth:560,background:T.card,border:`1px solid ${T.border}`,borderRadius:22,boxShadow:T.shadowMd,padding:isMobile?16:18,color:T.text}} onClick={e=>e.stopPropagation()}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
            <img src="/icon-192.png" alt="" style={{width:42,height:42,borderRadius:14,objectFit:"cover",boxShadow:`0 10px 24px ${T.accentPop}`}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:16,fontWeight:950,color:T.text,letterSpacing:-.3}}>Cari aksi cepat</div>
              <div style={{fontSize:11,color:T.muted,marginTop:2}}>Buka menu penting tanpa pindah-pindah halaman.</div>
            </div>
            {!isMobile&&<span style={{fontSize:10,fontWeight:900,color:T.muted,background:T.cardAlt,border:`1px solid ${T.border}`,borderRadius:999,padding:"5px 9px"}}>Ctrl K</span>}
          </div>
          <input autoFocus value={commandQuery} onChange={e=>setCommandQuery(e.target.value)} placeholder="Cari: transaksi, budget, habit, laporan..." style={{...IS,marginBottom:12,background:T.cardAlt}}/>
          <div style={{display:"grid",gap:8,maxHeight:isMobile?"62svh":420,overflowY:"auto",paddingRight:2}}>
            {commandActions.filter(cmd=>`${cmd.title} ${cmd.desc}`.toLowerCase().includes(commandQuery.trim().toLowerCase())).map(cmd=>(
              <button key={cmd.title} onClick={()=>runCommand(cmd)} style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:11,alignItems:"center",textAlign:"left",border:`1px solid ${T.border}`,background:T.cardAlt,borderRadius:14,padding:"11px 12px",cursor:"pointer",fontFamily:"inherit"}}>
                <span style={{width:38,height:38,borderRadius:13,background:T.accentBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{cmd.icon}</span>
                <span style={{minWidth:0}}>
                  <span style={{display:"block",fontSize:13,fontWeight:900,color:T.text,marginBottom:3}}>{cmd.title}</span>
                  <span style={{display:"block",fontSize:11,color:T.muted,lineHeight:1.4}}>{cmd.desc}</span>
                </span>
              </button>
            ))}
            {!commandActions.some(cmd=>`${cmd.title} ${cmd.desc}`.toLowerCase().includes(commandQuery.trim().toLowerCase()))&&<div style={{padding:22,textAlign:"center",fontSize:12,color:T.muted,background:T.cardAlt,borderRadius:14,border:`1px dashed ${T.border}`}}>Aksi tidak ditemukan.</div>}
          </div>
        </div>
      </div>}

      {/* ── MODALS ── */}
      {modal&&(
        <div style={{cursor:"pointer",position:"fixed",touchAction:"none",overscrollBehavior:"none",inset:0,background:"rgba(0,0,0,.55)",display:"flex",alignItems:isMobile?"flex-end":"center",justifyContent:"center",zIndex:1000,padding:isMobile?0:"16px",paddingTop:isMobile?"max(12px, env(safe-area-inset-top))":undefined}} onClick={()=>setModal(null)}>
          <div className="modal-pop" style={{cursor:"pointer",background:T.card,borderRadius:isMobile?"24px 24px 0 0":20,padding:isMobile?"20px max(18px, env(safe-area-inset-right)) calc(env(safe-area-inset-bottom, 0px) + 24px) max(18px, env(safe-area-inset-left))":"26px",width:"100%",maxWidth:isMobile?"100%":520,maxHeight:isMobile?"min(88svh, calc(var(--app-height, 100dvh) - 12px))":"min(92vh, calc(var(--app-height, 100dvh) - 32px))",overflowY:"auto",overflowX:"hidden",color:T.text,WebkitOverflowScrolling:"touch"}} onClick={e=>e.stopPropagation()}>

            {isMobile&&<div style={{width:40,height:4,borderRadius:99,background:"rgba(0,0,0,.15)",margin:"-8px auto 16px",flexShrink:0}}/>}
            {/* Import Mutasi Bank Modal */}
            {modal.type==="importMutasi"&&<ImportMutasiBank dompet={s.dompet} onImport={handleImportMutasi} onClose={()=>setModal(null)} T={T}/>}

            {/* Kalkulator Cicilan */}
            {modal.type==="yearReview"&&<YearInReview s={s} T={T} lang={lang} onClose={()=>setModal(null)}/>}
            {modal.type==="monthlyRecap"&&<>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:14}}>
                <div>
                  <div style={{fontSize:10,color:T.accent,fontWeight:900,letterSpacing:1.2,textTransform:"uppercase"}}>Share card</div>
                  <div style={{fontSize:18,fontWeight:900,color:T.text}}>Recap {activeRecap.month} {activeRecap.year}</div>
                </div>
                <img src="/icon-192.png" alt="" style={{width:44,height:44,borderRadius:14,objectFit:"cover",boxShadow:`0 10px 24px ${T.accentPop}`}}/>
              </div>
              <div style={{position:"relative",overflow:"hidden",borderRadius:22,padding:20,background:"linear-gradient(135deg,#2D1060,#6D28D9 48%,#C026D3)",color:"white",boxShadow:`0 18px 48px ${T.accentPop}`,marginBottom:14}}>
                <div style={{position:"absolute",right:-40,top:-50,width:180,height:180,borderRadius:"50%",background:"rgba(255,255,255,.12)"}}/>
                <div style={{position:"relative",display:"flex",justifyContent:"space-between",gap:14,alignItems:"flex-start",marginBottom:18}}>
                  <div>
                    <div style={{fontSize:11,opacity:.75,fontWeight:800,letterSpacing:1.2,textTransform:"uppercase"}}>AturDuitku recap</div>
                    <div style={{fontSize:24,fontWeight:950,letterSpacing:-.5,marginTop:4}}>{activeRecap.score}/100</div>
                    <div style={{fontSize:12,opacity:.78}}>Skor finansial bulan ini</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:11,opacity:.75}}>Saving rate</div>
                    <div style={{fontSize:22,fontWeight:950}}>{PCT(activeRecap.savingRate)}</div>
                  </div>
                </div>
                <div style={{position:"relative",display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:14}}>
                  {[
                    ["Masuk",IDRs(activeRecap.income)],
                    ["Keluar",IDRs(activeRecap.expense)],
                    ["Nabung",IDRs(activeRecap.saving)],
                    ["Net",IDRs(activeRecap.net)],
                  ].map(([l,v])=><div key={l} style={{background:"rgba(255,255,255,.14)",border:"1px solid rgba(255,255,255,.16)",borderRadius:14,padding:"10px 12px"}}>
                    <div style={{fontSize:9,opacity:.7,fontWeight:800,letterSpacing:1,textTransform:"uppercase"}}>{l}</div>
                    <div style={{fontSize:15,fontWeight:900,marginTop:3}}>{v}</div>
                  </div>)}
                </div>
                <div style={{position:"relative",display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,fontSize:11}}>
                  <div style={{background:"rgba(0,0,0,.18)",borderRadius:12,padding:"10px 12px"}}>
                    <strong>{activeRecap.txCount}</strong> transaksi dicatat<br/>
                    Top: {activeRecap.topCategory} {activeRecap.topValue?`(${IDRs(activeRecap.topValue)})`:""}
                  </div>
                  <div style={{background:"rgba(0,0,0,.18)",borderRadius:12,padding:"10px 12px"}}>
                    Habit {activeRecap.habitDone}/{activeRecap.habitTotal||0}<br/>
                    Streak {activeRecap.streak} hari
                  </div>
                </div>
                <div style={{position:"relative",display:"flex",alignItems:"center",gap:8,marginTop:16,fontSize:11,opacity:.82}}>
                  <img src="/icon-192.png" alt="" style={{width:24,height:24,borderRadius:8,objectFit:"cover"}}/>
                  <span>aturduitku.com</span>
                </div>
              </div>
              <div style={{fontSize:12,color:T.muted,lineHeight:1.6,marginBottom:14}}>Tips: buka modal ini, lalu screenshot untuk konten Threads atau laporan pribadi bulanan.</div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10}}>
                <Btn onClick={()=>setPage("laporan")} ch="Buka laporan" c={T.accent} style={{padding:11}}/>
                <Btn onClick={()=>setModal(null)} ch="Tutup" c={T.muted} outline style={{padding:11}}/>
              </div>
            </>}
            {modal.type==="tour"&&<>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
                <img src="/icon-192.png" alt="" style={{width:54,height:54,borderRadius:16,objectFit:"cover",boxShadow:`0 12px 26px ${T.accentPop}`}}/>
                <div>
                  <div style={{fontSize:10,color:T.accent,fontWeight:900,letterSpacing:1.1,textTransform:"uppercase",marginBottom:4}}>Mulai cepat</div>
                  <div style={{fontSize:20,fontWeight:950,color:T.text,letterSpacing:-.4}}>Kenalan 2 menit</div>
                  <div style={{fontSize:12,color:T.muted,marginTop:2}}>Ikuti alur ini supaya data langsung rapi dari hari pertama.</div>
                </div>
              </div>
              <div style={{display:"grid",gap:9,marginBottom:16}}>
                {[
                  ["🧾","Catat transaksi","Mulai dari pemasukan atau pengeluaran pertama."],
                  ["📊","Pakai template budget","Kategori dasar langsung terisi, tinggal sesuaikan nominal."],
                  ["🐾","Tambah habit uang","Quest harian bikin user lebih sering balik."],
                  ["🐱","Tanya Dokter Keuangan","Minta saran setelah data mulai masuk."],
                ].map(([i,title,desc])=><div key={title} style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:11,alignItems:"center",background:T.cardAlt,border:`1px solid ${T.border}`,borderRadius:14,padding:"11px 12px"}}>
                  <span style={{width:38,height:38,borderRadius:13,display:"flex",alignItems:"center",justifyContent:"center",background:T.accentBg,fontSize:19}}>{i}</span>
                  <span>
                    <span style={{display:"block",fontSize:13,fontWeight:900,color:T.text,marginBottom:3}}>{title}</span>
                    <span style={{display:"block",fontSize:11,color:T.muted,lineHeight:1.45}}>{desc}</span>
                  </span>
                </div>)}
              </div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10}}>
                <Btn onClick={()=>{finishTour();setModal({type:"tx"});}} ch="Mulai catat" c={T.accent} style={{padding:12}}/>
                <Btn onClick={finishTour} ch="Nanti dulu" c={T.muted} outline style={{padding:12}}/>
              </div>
            </>}
            {modal.type==="kalkulator"&&<KalkulatorCicilan onClose={()=>setModal(null)} T={T}/>}

            {/* Import JSON Modal */}
            {modal.type==="importJSON"&&<>
              <div style={{fontSize:16,fontWeight:800,marginBottom:8,color:T.text}}>{t("restoreTitle")}</div>
              <div style={{fontSize:12,color:T.muted,marginBottom:16,background:T.warnBg,padding:12,borderRadius:10,border:`1px solid ${T.warnBorder}`}}>
                Import akan <strong>mengganti semua data</strong> yang ada sekarang dengan data dari file backup. Pastikan file backup memang berasal dari AturDuitku.
              </div>
              <label style={{display:"block",padding:"40px 20px",border:`2px dashed ${T.accent}`,borderRadius:12,textAlign:"center",cursor:"pointer",background:T.accentBg,color:T.accent,fontWeight:700,fontSize:13}}>
                Pilih file backup .json
                <input type="file" accept=".json" style={{display:"none"}} onChange={e=>importJSON(e.target.files[0])}/>
              </label>
              <Btn onClick={()=>setModal(null)} ch={t("cancel")} c={T.muted} outline style={{width:"100%",padding:10,marginTop:12}}/>
            </>}

            {/* User Menu Modal */}
            {modal.type==="userMenu"&&<>
              <div style={{textAlign:"center",marginBottom:20}}>
                {fireUser?.photoURL
                  ?<img src={fireUser.photoURL} alt="" style={{width:72,height:72,borderRadius:"50%",objectFit:"cover",marginBottom:12,border:"3px solid #7C3AED"}}/>
                  :<div style={{width:72,height:72,borderRadius:"50%",background:"linear-gradient(135deg,#8B5CF6,#6D28D9)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,fontWeight:900,color:"white",margin:"0 auto 12px"}}>{s.name?.[0]?.toUpperCase()||"U"}</div>
                }
                <div style={{fontWeight:800,fontSize:16,color:T.text}}>{fireUser?.displayName||s.name}</div>
                <div style={{fontSize:12,color:T.muted,marginTop:2}}>{fireUser?.email||""}</div>
                <div style={{marginTop:8,display:"inline-flex",alignItems:"center",gap:6,background:isApproved?"#D1FAE5":"#FEF3C7",borderRadius:20,padding:"4px 12px"}}>
                  <span style={{width:7,height:7,borderRadius:"50%",background:isApproved?"#10B981":"#F59E0B",display:"inline-block"}}/>
                  <span style={{fontSize:11,color:isApproved?"#065F46":"#92400E",fontWeight:700}}>{isApproved?"Lifetime aktif":"Menunggu approval"}</span>
                </div>
                <div style={{fontSize:11,color:T.muted,marginTop:8}}>Data tersimpan otomatis ke akun ini.</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {isAdmin&&<Btn onClick={()=>{setModal(null);navTo("admin");}} ch="Dashboard Admin" c={T.info} style={{width:"100%",padding:11}}/>}
                {!isStandalone&&!installDismissed&&<Btn onClick={()=>{setModal(null);handleInstallApp();}} ch="Pasang ke Home Screen" c={T.accent} style={{width:"100%",padding:11}}/>}
                <Btn onClick={()=>{exportJSON();}} ch="Backup data JSON" c={T.ok} outline style={{width:"100%",padding:11}}/>
                <Btn onClick={()=>{setModal(null);navTo("setting");}} ch="Pengaturan" outline c={T.accent} style={{width:"100%",padding:11}}/>
                <button onClick={()=>{setModal(null);setTimeout(confirmSignOut,0);}} style={{width:"100%",padding:11,borderRadius:10,border:"1.5px solid #FCA5A5",background:"#FEF2F2",color:"#B91C1C",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                  Keluar akun
                </button>
              </div>
            </>}

            {/* Confirm Modal */}
            {modal.type==="confirm"&&<>
              <div style={{textAlign:"center",marginBottom:20}}>
                <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",padding:"8px 14px",borderRadius:999,background:"#FEF3C7",color:"#92400E",fontSize:12,fontWeight:800,marginBottom:12}}>Konfirmasi</div>
                <div style={{fontSize:17,fontWeight:800,color:T.text,marginBottom:8}}>{modal.title}</div>
                <div style={{fontSize:13,color:T.sub,lineHeight:1.6}}>{modal.msg}</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10}}>
                <Btn onClick={()=>setModal(null)} ch={t("cancel")} c={T.muted} outline style={{flex:1,padding:11}}/>
                <Btn onClick={modal.onConfirm} ch={t("confirmBtn")} c={modal.danger?"#B91C1C":T.accent} style={{flex:1,padding:11}}/>
              </div>
            </>}

            {/* Kalkulator Finansial */}
            {modal.type==="kalkulator"&&<KalkulatorFinansial onClose={()=>setModal(null)} />}

            {/* TX Modal */}
            {modal.type==="tx"&&<>
              <div style={{fontSize:16,fontWeight:800,marginBottom:4,color:T.text}}>{t("newTx")}</div><div style={{fontSize:12,color:T.muted,marginBottom:16}}>Catat transaksi baru dengan detail yang cukup supaya laporan tetap akurat.</div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr 1fr",gap:6,marginBottom:14}}>
                {[{v:"pengeluaran",l:t("outflow2")},{v:"pemasukan",l:t("inflow2")},{v:"tabungan",l:t("savingShort")},{v:"transfer",l:"Transfer"}].map(({v,l})=>(
                  <button key={v} onClick={()=>setTxForm(f=>({...f,tipe:v,katId:v==="pemasukan"?(KAT_IN[0]||"Lainnya"):v==="pengeluaran"?(s.budgets[0]?.id||""):f.katId,subKat:"",goalId:""}))} style={{padding:"9px 6px",borderRadius:8,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit",border:`2px solid ${txForm.tipe===v?T.accent:T.inputBorder}`,background:txForm.tipe===v?T.accentBg:T.input,color:txForm.tipe===v?T.accent:T.sub}}>{l}</button>
                ))}
              </div>
              <label style={LS}>{t("date")}</label><input type="date" value={txForm.tgl} onChange={e=>setTxForm(f=>({...f,tgl:e.target.value}))} style={{...IS,marginBottom:10}}/>
              <label style={LS}>{t("amount")} (Rp)</label>
              <div style={{position:"relative",marginBottom:10}}>
                <CurIn value={txForm.jml} onChange={v=>setTxForm(f=>({...f,jml:v}))} placeholder="0" style={{paddingRight:40}}/>
                <button onClick={()=>openCalc("jml",txForm.jml,v=>setTxForm(f=>({...f,jml:v})))} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:12,fontWeight:800,color:T.accent}} title="Kalkulator" aria-label="Kalkulator">🧮</button>
              </div>
              <label style={LS}>{t("description")}</label><input placeholder={t("txDescPlaceholder")} value={txForm.ket} onChange={e=>setTxForm(f=>({...f,ket:e.target.value}))} style={{...IS,marginBottom:10}}/>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10,marginBottom:10}}>
                <div><label style={LS}>{txForm.tipe==="transfer"?t("fromWallet"):t("dompet")}</label>
                <select value={txForm.dompetId} onChange={e=>setTxForm(f=>({...f,dompetId:Number(e.target.value)}))} style={IS}>{s.dompet.map(d=><option key={d.id} value={d.id}>{uiIcon(d.icon)} {d.nama}</option>)}</select></div>
                {txForm.tipe==="pengeluaran"&&<div><label style={LS}>{t("category")}</label><select value={txForm.katId} onChange={e=>setTxForm(f=>({...f,katId:Number(e.target.value),subKat:""}))} style={IS}><option value="">-- Pilih --</option>{s.budgets.map(b=><option key={b.id} value={b.id}>{uiIcon(b.icon)} {b.kat}</option>)}</select></div>}
                {txForm.tipe==="transfer"&&<div><label style={LS}>{t("toWallet")}</label><select value={txForm.dompetTo} onChange={e=>setTxForm(f=>({...f,dompetTo:Number(e.target.value)}))} style={IS}>{s.dompet.map(d=><option key={d.id} value={d.id}>{uiIcon(d.icon)} {d.nama}</option>)}</select></div>}
                {txForm.tipe==="pemasukan"&&<div><label style={LS}>Kategori</label><select value={txForm.katId} onChange={e=>setTxForm(f=>({...f,katId:e.target.value}))} style={IS}>{KAT_IN.map(k=><option key={k}>{k}</option>)}</select></div>}
                {txForm.tipe==="tabungan"&&<div><label style={LS}>Goal</label><select value={txForm.goalId} onChange={e=>setTxForm(f=>({...f,goalId:e.target.value}))} style={IS}><option value="">-- Pilih Goal --</option>{s.goals.filter(g=>!g.selesai).map(g=><option key={g.id} value={g.id}>{uiIcon(g.icon)} {g.nama}</option>)}</select></div>}
              </div>
              {txForm.tipe==="pengeluaran"&&txForm.katId&&s.budgets.find(b=>b.id===txForm.katId)?.sub?.length>0&&(
                <div style={{marginBottom:10}}><label style={LS}>Subkategori</label>
                <select value={txForm.subKat} onChange={e=>setTxForm(f=>({...f,subKat:e.target.value}))} style={IS}>
                  <option value="">-- Pilih --</option>
                  {s.budgets.find(b=>b.id===txForm.katId)?.sub?.map(sb=><option key={sb.nama} value={sb.nama}>{sb.emoji} {sb.nama}</option>)}
                </select></div>
              )}
              {txForm.tipe==="transfer"&&<><label style={LS}>{t("transferFee")}</label><CurIn value={txForm.biaya} onChange={v=>setTxForm(f=>({...f,biaya:v}))} placeholder="0" style={{...IS,marginBottom:10}}/></>}
              <Btn onClick={addTx} ch={t("saveTx")} style={{width:"100%",padding:"12px",marginTop:4}}/>
            </>}

            {/* Bulk Modal */}
            {modal.type==="bulk"&&<>
              <div style={{fontSize:16,fontWeight:800,marginBottom:4,color:T.text}}>{t("bulkTitle")}</div>
              <div style={{fontSize:12,color:T.muted,marginBottom:16}}>Masukkan beberapa transaksi sekaligus dengan format yang rapi. Cocok untuk input histori harian atau pindahan catatan lama.</div>
              <div style={{overflowX:"auto",border:`1px solid ${T.border}`,borderRadius:12,background:T.cardAlt}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr style={{background:T.cardAlt}}>{(lang==="en"?[t("txHead1"),t("amount"),t("type"),t("dompet"),t("txHead2"),""]:["Tanggal","Jumlah","Tipe","Dompet","Keterangan",""]).map(h=><th key={h} style={{padding:"6px 8px",textAlign:"left",fontSize:10,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,borderBottom:`1px solid ${T.border}`}}>{h}</th>)}</tr></thead>
                  <tbody>{bulkRows.map((r,i)=>(
                    <tr key={i}>
                      <td style={{padding:4}}><input type="date" value={r.tgl} onChange={e=>{const n=[...bulkRows];n[i]={...n[i],tgl:e.target.value};setBulkRows(n);}} style={{...IS,fontSize:11,padding:"5px 7px",width:120}}/></td>
                      <td style={{padding:4}}><CurIn value={r.jml} onChange={v=>{const n=[...bulkRows];n[i]={...n[i],jml:v};setBulkRows(n);}} style={{...IS,fontSize:11,padding:"5px 7px",width:100}}/></td>
                      <td style={{padding:4}}><select value={r.tipe} onChange={e=>{const n=[...bulkRows];n[i]={...n[i],tipe:e.target.value};setBulkRows(n);}} style={{...IS,fontSize:11,padding:"5px 7px",width:110}}>{["pengeluaran","pemasukan","tabungan"].map(t=><option key={t}>{t}</option>)}</select></td>
                      <td style={{padding:4}}><select value={r.dompetId} onChange={e=>{const n=[...bulkRows];n[i]={...n[i],dompetId:Number(e.target.value)};setBulkRows(n);}} style={{...IS,fontSize:11,padding:"5px 7px",width:90}}>{s.dompet.map(d=><option key={d.id} value={d.id}>{d.nama}</option>)}</select></td>
                      <td style={{padding:4}}><input placeholder={t("txDescPlaceholder")} value={r.ket} onChange={e=>{const n=[...bulkRows];n[i]={...n[i],ket:e.target.value};setBulkRows(n);}} style={{...IS,fontSize:11,padding:"5px 7px",width:140}}/></td>
                      <td style={{padding:4}}><Del onClick={()=>setBulkRows(bulkRows.filter((_,j)=>j!==i))}/></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr auto",gap:10,marginTop:12,alignItems:"center"}}>
                <Btn onClick={()=>setBulkRows([...bulkRows,{tgl:bulkRows[bulkRows.length-1]?.tgl||today(),jml:"",tipe:bulkRows[bulkRows.length-1]?.tipe||"pengeluaran",dompetId:bulkRows[bulkRows.length-1]?.dompetId||1,katId:"",ket:""}])} ch="+ Tambah baris" c={T.accent} outline style={{padding:"10px 14px"}}/>
                <Btn onClick={addBulk} ch={`Simpan ${bulkRows.filter(r=>r.jml).length} transaksi`} style={{padding:"10px 18px"}}/>
              </div>
            </>}

            {/* Dompet Modal */}
            {modal.type==="dompet"&&<>
              <div style={{fontSize:16,fontWeight:800,marginBottom:4,color:T.text}}>{t("addDompetTitle")}</div><div style={{fontSize:12,color:T.muted,marginBottom:16}}>Simpan rekening, e-wallet, atau kas supaya saldo lebih mudah dipantau.</div>
              <label style={LS}>{t("type")}</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
                {DOMPET_TIPE.map(t=><button key={t} onClick={()=>setDompetForm(f=>({...f,tipe:t}))} style={{padding:"7px 14px",borderRadius:8,border:`2px solid ${dompetForm.tipe===t?T.accent:T.inputBorder}`,background:dompetForm.tipe===t?T.accentBg:T.input,color:dompetForm.tipe===t?T.accent:T.sub,fontWeight:600,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>{t.toUpperCase()}</button>)}
              </div>
              <label style={LS}>{t("name")}</label><input placeholder={t("walletPlaceholder")} value={dompetForm.nama} onChange={e=>setDompetForm(f=>({...f,nama:e.target.value}))} style={{...IS,marginBottom:10}}/>
              <label style={LS}>{t("accountNoOpt")}</label><input placeholder={t("norekPlaceholder")} value={dompetForm.norek} onChange={e=>setDompetForm(f=>({...f,norek:e.target.value}))} style={{...IS,marginBottom:10}}/>
              <label style={LS}>{t("openingBal")}</label><CurIn value={dompetForm.saldo} onChange={v=>setDompetForm(f=>({...f,saldo:v}))} placeholder="0" style={{...IS,marginBottom:14}}/>
              <Btn onClick={addDompet} ch={t("addWallet")} style={{width:"100%",padding:"12px"}}/>
            </>}

            {/* Goal Modal */}
            {modal.type==="goal"&&<>
              <div style={{fontSize:16,fontWeight:800,marginBottom:4,color:T.text}}>{t("addGoalTitle")}</div><div style={{fontSize:12,color:T.muted,marginBottom:16}}>Buat target yang jelas supaya tabungan terasa punya arah.</div>
              <label style={LS}>Pilih ikon</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:5,padding:10,border:`1.5px solid ${T.inputBorder}`,borderRadius:8,marginBottom:10,maxHeight:isMobile?170:"none",overflowY:isMobile?"auto":"visible"}}>
                {DREAM_ICONS.map(ico=><button key={ico} onClick={()=>setGoalForm(f=>({...f,icon:ico}))} style={{padding:"5px 7px",borderRadius:7,border:`2px solid ${goalForm.icon===ico?T.accent:"transparent"}`,background:goalForm.icon===ico?T.accentBg:"transparent",cursor:"pointer",fontSize:20,fontFamily:"inherit"}}>{uiIcon(ico)}</button>)}
              </div>
              <label style={LS}>{t("goalName")}</label><input placeholder={t("goalPlaceholder")} value={goalForm.nama} onChange={e=>setGoalForm(f=>({...f,nama:e.target.value}))} style={{...IS,marginBottom:10}}/>
              <label style={LS}>{t("goalTarget")}</label><CurIn value={goalForm.target} onChange={v=>setGoalForm(f=>({...f,target:v}))} placeholder="0" style={{...IS,marginBottom:10}}/>
              <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10,marginBottom:14}}>
                <div><label style={LS}>Deadline</label><input type="date" value={goalForm.deadline} onChange={e=>setGoalForm(f=>({...f,deadline:e.target.value}))} style={IS}/></div>
              </div>
              <Btn onClick={addGoal} ch={t("addGoal")} style={{width:"100%",padding:"12px"}}/>
            </>}

            {/* Aset Modal */}
            {modal.type==="aset"&&<>
              <div style={{fontSize:16,fontWeight:800,marginBottom:4,color:T.text}}>{t("addAsetTitle")}</div><div style={{fontSize:12,color:T.muted,marginBottom:16}}>Catat aset agar nilai kekayaan bersih kamu ikut terpantau.</div>
              <label style={LS}>{t("asetName2")}</label><input placeholder={t("assetPlaceholder")} value={asetForm.nama} onChange={e=>setAsetForm(f=>({...f,nama:e.target.value}))} style={{...IS,marginBottom:10}}/>
              <label style={LS}>{t("asetVal")}</label><CurIn value={asetForm.nilai} onChange={v=>setAsetForm(f=>({...f,nilai:v}))} placeholder="0" style={{...IS,marginBottom:10}}/>
              <label style={LS}>Keterangan</label><input placeholder={t("ketOpsional")} value={asetForm.ket} onChange={e=>setAsetForm(f=>({...f,ket:e.target.value}))} style={{...IS,marginBottom:14}}/>
              
              <div style={{background:T.cardAlt, padding:14, borderRadius:10, border:`1.5px dashed ${T.border}`, marginBottom:16}}>
                 <label style={{...LS, color:T.text}}>{t("useWalletBal")}</label>
                 <div style={{display:"flex", gap:10, marginBottom:asetForm.beliDariDompet?10:0, alignItems:"flex-start"}}>
                    <input type="checkbox" checked={asetForm.beliDariDompet} onChange={e=>setAsetForm(f=>({...f,beliDariDompet:e.target.checked}))} style={{width:18, height:18}}/>
                    <span style={{fontSize:13, fontWeight:600,lineHeight:1.45}}>Potong saldo dari dompet terpilih</span>
                 </div>
                 {asetForm.beliDariDompet && (
                    <select value={asetForm.dompetId} onChange={e=>setAsetForm(f=>({...f,dompetId:Number(e.target.value)}))} style={IS}>
                       {s.dompet.map(d=><option key={d.id} value={d.id}>{uiIcon(d.icon)} {d.nama}</option>)}
                    </select>
                 )}
              </div>

              <Btn onClick={addAset} ch={t("addAset")} style={{width:"100%",padding:"12px"}}/>
            </>}
          </div>
        </div>
      )}

      {/* ── SIDEBAR ── */}
      {isMobile&&sidebarOpen&&<div className="sidebar-overlay" style={{cursor:"pointer"}} onClick={()=>setSidebarOpen(false)}/>}
      {(!isMobile||sidebarOpen)&&(
        <div className={isMobile?"sidebar-slide":""} style={{position:isMobile?"fixed":"relative",top:0,left:0,width:isMobile?"min(82vw, 300px)":isTablet?190:220,minWidth:isMobile?0:isTablet?190:220,background:T.nav,borderRight:`1.5px solid ${T.border}`,display:"flex",flexDirection:"column",height:"var(--app-height, 100dvh)",overflowY:"auto",flexShrink:0,zIndex:isMobile?500:10,boxShadow:isMobile?`6px 0 30px rgba(0,0,0,.2)`:T.shadow,transition:"background .3s,border-color .3s",paddingTop:isMobile?"env(safe-area-inset-top, 0px)":0,paddingBottom:isMobile?"env(safe-area-inset-bottom, 0px)":0}}>
          <div style={{padding:"18px 16px",borderBottom:`1.5px solid ${T.border}`,display:"flex",alignItems:"center",gap:11}}>
            <img className="cat-mascot" src="/icon-192.png" alt="AturDuitku" style={{width:40,height:40,borderRadius:10,objectFit:"cover",flexShrink:0,boxShadow:`0 4px 14px ${T.accentPop}`}}/>
            <div style={{flex:1}}>
              <div style={{fontWeight:900,fontSize:15,color:T.text,letterSpacing:-.3}}>AturDuitku</div>
              <div style={{fontSize:10,color:T.accent,fontWeight:600,marginTop:1}}>{s.name} Workspace</div>
            </div>
            {isMobile&&<button onClick={()=>setSidebarOpen(false)} style={{background:T.accentBg,border:"none",borderRadius:8,minWidth:44,height:32,cursor:"pointer",fontSize:10,fontWeight:800,color:T.accent,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",flexShrink:0,padding:"0 10px"}}>Tutup</button>}
          </div>
          <div style={{padding:"10px 8px",flex:1}}>
            {[{label:"Menu Utama",items:navItems.slice(0,4)},{label:"Keuangan",items:navItems.slice(4,9)},{label:"Pengaturan",items:navItems.slice(9)}].map(section=>(
              <div key={section.label}>
                <div style={{fontSize:9,color:T.muted,fontWeight:700,letterSpacing:2,textTransform:"uppercase",padding:"8px 10px 6px",marginTop:4}}>{section.label}</div>
                {section.items.map(nav=>{const a=page===nav.id;return(
                  <div key={nav.id} onClick={()=>navTo(nav.id)} className="nav-item" style={{display:"flex",alignItems:"center",gap:10,padding:"11px 12px",borderRadius:11,cursor:"pointer",marginBottom:4,background:a?T.navActive:"transparent",color:a?T.accent:T.sub,fontWeight:a?800:600,fontSize:13,borderLeft:a?`3px solid ${T.navBorder}`:"3px solid transparent",transition:"background .15s,color .15s"}}>
                    <span style={{minWidth:34,padding:"4px 6px",borderRadius:999,background:a?T.accentBg:T.cardAlt,color:a?T.accent:T.muted,fontSize:16,fontWeight:700,letterSpacing:0,textAlign:"center",lineHeight:1}}>{uiIcon(nav.icon)}</span>
                    <span>{nav.label}</span>
                    {a&&<span style={{marginLeft:"auto",width:6,height:6,borderRadius:"50%",background:T.accent,display:"block",boxShadow:`0 0 7px ${T.accent}`}}/>}
                  </div>
                );})}
                {section.label!=="Pengaturan"&&<div style={{height:1,background:T.borderLight,margin:"6px 10px 0"}}/>}
              </div>
            ))}
          </div>
          <div style={{padding:12,borderTop:`1.5px solid ${T.border}`}}>
            <div style={{background:T.accentBg,borderRadius:12,padding:"12px 14px",border:`1px solid ${T.border}`}}>
              <div style={{fontSize:9,color:T.accent,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,marginBottom:4}}>Status Keuangan</div>
              <div style={{fontWeight:800,color:statusC,fontSize:14,marginBottom:2}}>{status}</div>
              <div style={{fontSize:10,color:T.muted}}>{s.bulan} {s.tahun}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <div style={{flex:1,height:"var(--app-height, 100dvh)",overflowY:"auto",overflowX:"hidden",minWidth:0,maxWidth:"100%",width:0,background:T.bg,transition:"background .3s",WebkitOverflowScrolling:"touch",overscrollBehavior:"contain"}}>
        {/* Topbar */}
        <div className="topbar-safe" style={{background:T.topbar,backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",borderBottom:`1.5px solid ${T.border}`,padding:isMobile?`10px max(14px,env(safe-area-inset-right)) 10px max(14px,env(safe-area-inset-left))`:"10px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50,transition:"background .3s,border-color .3s"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0,flex:1}}>
            {isMobile&&<button className="icon-action" onClick={()=>setSidebarOpen(true)} title="Menu" aria-label="Menu" style={{background:T.accentBg,border:"none",borderRadius:9,minWidth:44,height:36,cursor:"pointer",fontSize:18,fontWeight:800,color:T.accent,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",flexShrink:0,padding:"0 10px"}}>☰</button>}
            <div style={{minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
                <img className="cat-mascot" src="/icon-192.png" alt="" style={{width:isMobile?24:28,height:isMobile?24:28,borderRadius:8,objectFit:"cover",flexShrink:0,boxShadow:`0 4px 12px ${T.accentPop}`}}/>
                <div style={{fontWeight:800,fontSize:isMobile?13:15,color:T.accentFg,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:isMobile?"38vw":"none"}}>{page==="admin"?"Admin":((lang==="en"?{home:"Home",dompet:"Wallets",trans:"Transactions",budget:"Budget",amplop:"Envelopes",goals:"Goals",habit:"Habit",aset:"Assets",utang:"Debt",laporan:"Reports",setting:"Settings",admin:"Admin"}:{admin:"Admin",habit:"Habit"})[page]||navItems.find(n=>n.id===page)?.label||"")}</div>
              </div>
              {!isMobile&&<div style={{fontSize:10,color:T.muted,marginTop:1}}>{hariShort}{tzZone.zone?` • ${tzZone.zone}`:""}</div>}
            </div>
          </div>
          <div style={{display:"flex",gap:isMobile?6:8,alignItems:"center",flexShrink:0}}>
            {!isMobile&&(page==="trans"||page==="home")&&<Btn onClick={()=>setModal({type:"tx"})} ch={t("addTx")} style={{padding:"8px 14px",fontSize:12}}/>}
            {!isMobile&&page==="trans"&&<Btn onClick={()=>setModal({type:"bulk"})} ch="Input Massal" c={T.accentSoft} outline style={{padding:"8px 14px",fontSize:12}}/>}
            {!isMobile&&page==="dompet"&&<Btn onClick={()=>setModal({type:"dompet"})} ch={t("addWallet")+" "} style={{padding:"8px 14px",fontSize:12}}/>}
            {!isMobile&&page==="dompet"&&<Btn onClick={()=>setModal({type:"importMutasi"})} ch={lang==="en"?"Import Statement":"Import Mutasi"} c={T.accentSoft} outline style={{padding:"8px 14px",fontSize:12}}/>}
            {!isMobile&&page==="goals"&&<Btn onClick={()=>setModal({type:"goal"})} ch={t("addGoalBtn")+" "} style={{padding:"8px 14px",fontSize:12}}/>}
            {!isMobile&&page==="aset"&&<Btn onClick={()=>setModal({type:"aset"})} ch={"+ "+t("aset")} style={{padding:"8px 14px",fontSize:12}}/>}

            {!isMobile&&<button className="icon-action" onClick={()=>setCommandOpen(true)} style={{background:T.cardAlt,border:`1px solid ${T.border}`,borderRadius:10,minWidth:44,height:36,cursor:"pointer",fontSize:14,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",gap:7,fontFamily:"inherit",transition:"all .2s",padding:"0 12px",color:T.text}} title="Cari aksi cepat" aria-label="Cari aksi cepat"><span>⌘</span><span style={{fontSize:12}}>Aksi</span></button>}
            {!isMobile&&<button className="icon-action" onClick={()=>setModal({type:"kalkulator"})} style={{background:T.cardAlt,border:`1px solid ${T.border}`,borderRadius:10,minWidth:44,height:36,cursor:"pointer",fontSize:17,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",transition:"all .2s",padding:"0 8px"}} title="Kalkulator" aria-label="Kalkulator">🧮</button>}

            {/* Notification Bell */}
            <button onClick={()=>setNotifOpen(true)} className={`icon-action ${notifications.length?"notif-bounce":""}`} title="Notifikasi" aria-label="Notifikasi" style={{position:"relative",background:notifications.length?T.errBg:T.cardAlt,border:`1px solid ${notifications.length?T.errBorder:T.border}`,borderRadius:10,width:36,height:36,cursor:"pointer",fontSize:16,color:notifications.length?T.err:T.sub,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",transition:"all .15s"}}>
              🔔
              {notifications.length>0&&<span style={{position:"absolute",top:-3,right:-3,background:T.err,color:"white",borderRadius:"50%",width:16,height:16,fontSize:9,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",border:`2px solid ${T.nav}`}}>{Math.min(notifications.length,9)}</span>}
            </button>

            {/* Blur saldo toggle */}
            {!isMobile&&<button className="icon-action" onClick={toggleBlur} title={blurSaldo?t("showBalance"):t("hideBalance")} aria-label={blurSaldo?t("showBalance"):t("hideBalance")} style={{background:blurSaldo?T.accentBg:T.cardAlt,border:`1px solid ${blurSaldo?T.accent:T.border}`,borderRadius:10,minWidth:44,height:36,cursor:"pointer",fontSize:16,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",transition:"all .2s",padding:"0 8px"}}>
              {blurSaldo?"👁️":"🙈"}
            </button>}

            {/* Dark mode toggle */}
            <button className="icon-action" onClick={()=>setDark(!dark)} title={dark?"Mode terang":"Mode gelap"} aria-label={dark?"Mode terang":"Mode gelap"} style={{background:T.cardAlt,border:`1px solid ${T.border}`,borderRadius:10,minWidth:44,height:36,cursor:"pointer",fontSize:16,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",transition:"all .2s",padding:"0 8px"}}>
              {dark?"☀️":"🌙"}
            </button>

            {!isMobile&&<div style={{textAlign:"right",fontSize:12}}>
              <div style={{fontWeight:700,color:T.text,marginBottom:2}}>{t(greetingWord)}, {s.name}! {greetingEmoji}</div>
              <div style={{fontSize:11,color:T.sub,display:"flex",alignItems:"center",gap:4,justifyContent:"flex-end"}}>
                <span>{hariShort}</span>
                {tzZone.city&&<><span style={{opacity:.4}}>•</span><span style={{color:tzZone.color,fontWeight:700}}>{tzZone.city} {tzZone.zone}</span></>}
              </div>
            </div>}
            {/* Sync status */}
            {fireUser&&!isMobile&&<div title={isOnline?"Sinkron aktif":"Koneksi offline"} style={{fontSize:10,color:!isOnline?T.warn:syncStatus==="error"?T.err:syncStatus==="saving"?T.warn:T.ok,fontWeight:900,flexShrink:0,background:!isOnline?T.warnBg:syncStatus==="error"?T.errBg:syncStatus==="saving"?T.warnBg:T.okBg,border:`1px solid ${!isOnline?T.warnBorder:syncStatus==="error"?T.errBorder:syncStatus==="saving"?T.warnBorder:T.okBorder}`,borderRadius:999,padding:"6px 9px",whiteSpace:"nowrap"}}>
              {!isOnline?"Offline":syncStatus==="saving"?"Menyimpan":syncStatus==="error"?"Sync error":"Tersimpan"}
            </div>}
            {/* Google avatar + logout */}
            <div style={{position:"relative",flexShrink:0}} className="avatar-menu-wrap">
              {fireUser?.photoURL
                ?<img src={fireUser.photoURL} alt={fireUser.displayName||"User"} style={{width:34,height:34,borderRadius:"50%",objectFit:"cover",cursor:"pointer",boxShadow:`0 3px 10px ${T.accentPop}`,border:`2px solid ${T.accent}`}} onClick={()=>setModal({type:"userMenu"})}/>
                :<div style={{width:34,height:34,borderRadius:"50%",background:`linear-gradient(135deg,${T.accentFg},${T.accent})`,display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontWeight:900,fontSize:13,flexShrink:0,boxShadow:`0 3px 10px ${T.accentPop}`,cursor:"pointer"}} onClick={()=>setModal({type:"userMenu"})}>{s.name?.[0]?.toUpperCase()||"U"}</div>
              }
            </div>
          </div>
        </div>

        {fireUser&&(!isOnline||syncStatus==="error")&&<div style={{padding:isMobile?`10px max(14px,env(safe-area-inset-right)) 0 max(14px,env(safe-area-inset-left))`:"12px 28px 0",maxWidth:1340,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:11,background:!isOnline?T.warnBg:T.errBg,border:`1px solid ${!isOnline?T.warnBorder:T.errBorder}`,borderRadius:14,padding:"11px 13px",boxShadow:T.shadow,color:T.text}}>
            <span style={{width:34,height:34,borderRadius:12,background:T.card,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>{!isOnline?"â›…":"âš ï¸"}</span>
            <div style={{minWidth:0,flex:1}}>
              <div style={{fontSize:13,fontWeight:900,color:!isOnline?T.warn:T.err,marginBottom:2}}>{!isOnline?"Kamu sedang offline":"Sinkronisasi perlu dicek"}</div>
              <div style={{fontSize:11,color:T.sub,lineHeight:1.55}}>Data tetap aman tersimpan di perangkat ini. AturDuitku akan mencoba sync otomatis lagi saat koneksi stabil.</div>
            </div>
            <a href={supportBugWhatsappHref} target="_blank" rel="noreferrer" style={{fontSize:11,fontWeight:900,color:!isOnline?T.warn:T.err,textDecoration:"none",background:T.card,border:`1px solid ${T.border}`,borderRadius:999,padding:"7px 10px",whiteSpace:"nowrap"}}>Lapor</a>
          </div>
        </div>}

        {/* Mobile Quick Action */}
        {isMobile&&!moreOpen&&!sidebarOpen&&!aiOpen&&!modal&&(page==="home"||page==="trans"||page==="budget"||page==="habit")&&(
          <>
            {quickOpen&&<div onClick={()=>setQuickOpen(false)} style={{position:"fixed",inset:0,zIndex:610,background:"rgba(15,23,42,.18)",backdropFilter:"blur(2px)",WebkitBackdropFilter:"blur(2px)",touchAction:"none"}}/>}
            {quickOpen&&<div className="quick-action-sheet" style={{position:"fixed",right:"max(18px,env(safe-area-inset-right))",bottom:"calc(82px + max(env(safe-area-inset-bottom),8px))",zIndex:611,width:"min(292px, calc(100vw - 36px))",background:T.card,border:`1px solid ${T.border}`,borderRadius:20,boxShadow:T.shadowMd,padding:12}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,padding:"4px 4px 8px",borderBottom:`1px solid ${T.borderLight}`}}>
                <img src="/icon-192.png" alt="" style={{width:34,height:34,borderRadius:11,objectFit:"cover",boxShadow:`0 6px 16px ${T.accentPop}`}}/>
                <div>
                  <div style={{fontSize:12,fontWeight:900,color:T.text}}>Aksi cepat</div>
                  <div style={{fontSize:10,color:T.muted}}>Catat, cek habit, atau tanya AI</div>
                </div>
              </div>
              {[
                {k:"expense",i:"🧾",t:"Catat pengeluaran",d:"Uang keluar hari ini"},
                {k:"income",i:"💰",t:"Catat pemasukan",d:"Gaji, bonus, atau transfer"},
                {k:"habit",i:"🐾",t:"Quest habit",d:`${habitDoneToday}/${habitTotalToday||0} selesai hari ini`},
                {k:"ai",i:"🐱",t:"Dokter Keuangan",d:"Minta saran cepat"},
              ].map(item=>(
                <button key={item.k} onClick={()=>openQuickAction(item.k)} className="quick-action-item" style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 9px",border:"none",background:"transparent",borderRadius:14,cursor:"pointer",fontFamily:"inherit",textAlign:"left",transition:"all .16s"}}>
                  <span style={{width:36,height:36,borderRadius:12,background:T.accentBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{item.i}</span>
                  <span style={{minWidth:0}}>
                    <span style={{display:"block",fontSize:12,fontWeight:900,color:T.text}}>{item.t}</span>
                    <span style={{display:"block",fontSize:10,color:T.muted,marginTop:1}}>{item.d}</span>
                  </span>
                </button>
              ))}
            </div>}
            <button className={`fab ${quickOpen?"is-open":""}`} onClick={()=>setQuickOpen(v=>!v)} aria-label="Aksi cepat" style={quickOpen?{zIndex:612}:undefined}>
              {quickOpen
                ? <span className="fab-plus">×</span>
                : <><span className="fab-plus">+</span><span className="fab-label">Catat</span></>}
            </button>
          </>
        )}

        <div className="page-in" style={{display:page==="admin"?"none":undefined,padding:isMobile?`14px max(14px,env(safe-area-inset-right)) calc(80px + max(env(safe-area-inset-bottom),0px)) max(14px,env(safe-area-inset-left))`:"22px 28px 40px",maxWidth:1340,margin:"0 auto"}}>

          {/* ══════════════════════════════════════════════════════════
              HOME
          ══════════════════════════════════════════════════════════ */}
          {page==="home"&&<>
            {/* Smart Alert Banner */}
            {inAppAlerts.length>0&&<div style={{marginBottom:14}}>
              {inAppAlerts.slice(0,3).map((a,i)=>(
                <div key={i} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 14px",borderRadius:12,marginBottom:6,background:a.type==="danger"?T.errBg:a.type==="warn"?T.warnBg:T.infoBg,border:`1px solid ${a.type==="danger"?T.errBorder:a.type==="warn"?T.warnBorder:T.infoBorder}`,animation:"fadeUp .3s ease-out"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:800,color:a.type==="danger"?T.err:a.type==="warn"?T.warn:T.info,marginBottom:2}}>{a.title}</div>
                    <div style={{fontSize:11,color:T.sub}}>{a.body}</div>
                  </div>
                  <button onClick={()=>setInAppAlerts(p=>p.filter((_,j)=>j!==i))} style={{background:"transparent",border:"none",cursor:"pointer",color:T.muted,fontSize:14,padding:"0 2px",flexShrink:0}}>X</button>
                </div>
              ))}
              {inAppAlerts.length>3&&<div style={{fontSize:11,color:T.muted,textAlign:"center",padding:"4px 0"}}>+{inAppAlerts.length-3} notifikasi lainnya</div>}
            </div>}
            {!isStandalone&&!installDismissed&&<Card ch={<div style={{display:"flex",alignItems:isMobile?"flex-start":"center",justifyContent:"space-between",gap:14,flexDirection:isMobile?"column":"row"}}>
              <div style={{display:"flex",gap:12,alignItems:"center",minWidth:0}}>
                <img src="/icon-192.png" alt="" style={{width:44,height:44,borderRadius:14,objectFit:"cover",boxShadow:`0 8px 20px ${T.accentPop}`,flexShrink:0}}/>
                <div>
                  <div style={{fontSize:10,color:T.accent,fontWeight:900,letterSpacing:1.1,textTransform:"uppercase",marginBottom:4}}>Web app siap dipasang</div>
                  <div style={{fontSize:15,fontWeight:900,color:T.text,marginBottom:3}}>Buka AturDuitku dari Home Screen</div>
                  <div style={{fontSize:12,color:T.muted,lineHeight:1.55}}>{isIosDevice?"Di iPhone: tap Share, lalu Add to Home Screen.":"Pasang seperti app agar lebih cepat dibuka dan terasa native."}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:8,width:isMobile?"100%":"auto"}}>
                <Btn onClick={handleInstallApp} ch={isIosDevice?"Lihat cara":"Pasang app"} c={T.accent} style={{padding:"9px 13px",fontSize:12,flex:isMobile?1:"0 0 auto"}}/>
                <Btn onClick={dismissInstallPrompt} ch="Nanti" c={T.muted} outline style={{padding:"9px 13px",fontSize:12,flex:isMobile?1:"0 0 auto"}}/>
              </div>
            </div>} style={{marginBottom:14,padding:isMobile?14:"15px 18px"}}/>}
            {/* Hero */}
            <div style={{background:T.hero,borderRadius:isMobile?14:18,padding:"22px 28px",marginBottom:18,color:"white",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",right:-30,top:-50,width:220,height:220,borderRadius:"50%",background:"rgba(255,255,255,.04)"}}/>
              <div style={{position:"absolute",right:80,bottom:-70,width:160,height:160,borderRadius:"50%",background:"rgba(255,255,255,.05)"}}/>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",position:"relative",flexWrap:"wrap",gap:12}}>
                <div>
                  <div style={{fontSize:10,opacity:.6,letterSpacing:2,textTransform:"uppercase",marginBottom:5}}>{t("dailyBudget")}</div>
                  <div style={{fontSize:isMobile?24:32,fontWeight:900,letterSpacing:-.5,marginBottom:2}}>{IDR(budgetHarian)}</div>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,.15)",borderRadius:10,padding:"6px 14px"}}>
                      <span style={{fontSize:13}}>🕐</span>
                      <span style={{fontSize:17,fontWeight:900,letterSpacing:1.5,fontVariantNumeric:"tabular-nums"}}>{jam}</span>
                      {tzZone.zone&&<span style={{fontSize:11,fontWeight:700,background:"rgba(255,255,255,.2)",borderRadius:5,padding:"2px 7px",letterSpacing:.5}}>{tzZone.zone}</span>}
                    </div>
                    {tzZone.city&&<div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(255,255,255,.1)",borderRadius:8,padding:"5px 12px",fontSize:12,opacity:.9}}>
                      <span>Zona</span><span style={{fontWeight:600}}>{tzZone.city}</span>
                    </div>}
                  </div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    <div style={{background:"rgba(255,255,255,.15)",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700}}>Masuk {IDRs(totalIn)}</div>
                    <div style={{background:"rgba(255,255,255,.15)",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700}}>Keluar {IDRs(totalOut)}</div>
                    <div style={{background:"rgba(255,255,255,.15)",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700}}>{sisaHari} {t("days")}</div>
                  </div>
                </div>
                <div style={{textAlign:"right",background:"rgba(0,0,0,.2)",borderRadius:12,padding:"14px 18px",flexShrink:0}}>
                  <div style={{fontSize:9,opacity:.6,letterSpacing:1.5,textTransform:"uppercase",marginBottom:4}}>{t("totalBalance")}</div>
                  <div style={{fontSize:24,fontWeight:900}}><MV v={IDR(totalSaldo)}/></div>
                  <div style={{fontSize:10,opacity:.65,marginTop:3}}>{t("runway")}: {runwayReal} {t("months")}</div>
                  <div style={{fontSize:10,opacity:.65,marginTop:2}}>{t("scoreLabel")}: {skorTotal}/100 {getLabel(skorTotal)}</div>
                </div>
              </div>
            </div>

            <Card ch={<div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"auto 1fr auto",gap:14,alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
                <img className="cat-mascot" src="/icon-192.png" alt="" style={{width:52,height:52,borderRadius:16,objectFit:"cover",boxShadow:`0 10px 24px ${T.accentPop}`,flexShrink:0}}/>
                <div style={{minWidth:0}}>
                  <div style={{display:"inline-flex",alignItems:"center",gap:6,padding:"4px 9px",borderRadius:999,background:moneyDoctorInsight.tone==="danger"?T.errBg:moneyDoctorInsight.tone==="warn"?T.warnBg:moneyDoctorInsight.tone==="good"?T.okBg:T.accentBg,color:moneyDoctorInsight.tone==="danger"?T.err:moneyDoctorInsight.tone==="warn"?T.warn:moneyDoctorInsight.tone==="good"?T.ok:T.accent,fontSize:10,fontWeight:900,letterSpacing:.8,textTransform:"uppercase",marginBottom:6}}>{moneyDoctorInsight.badge}</div>
                  <div style={{fontSize:16,fontWeight:900,color:T.text,letterSpacing:-.2,marginBottom:4}}>{moneyDoctorInsight.title}</div>
                  <div style={{fontSize:12,color:T.muted,lineHeight:1.6,maxWidth:720}}>{moneyDoctorInsight.body}</div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,120px)",gap:8}}>
                {[
                  {l:"Skor",v:`${skorTotal}/100`,c:getC(skorTotal)},
                  {l:"Harian",v:IDRs(budgetHarian),c:T.accent},
                  {l:"Runway",v:`${runwayReal} bln`,c:T.info},
                ].map(item=><div key={item.l} style={{background:T.cardAlt,border:`1px solid ${T.border}`,borderRadius:12,padding:"10px 12px"}}>
                  <div style={{fontSize:9,color:T.muted,fontWeight:800,letterSpacing:1,textTransform:"uppercase",marginBottom:3}}>{item.l}</div>
                  <div style={{fontSize:14,fontWeight:900,color:item.c,whiteSpace:"nowrap"}}>{item.v}</div>
                </div>)}
              </div>
              <Btn onClick={moneyDoctorInsight.onAction} ch={moneyDoctorInsight.action} c={moneyDoctorInsight.tone==="danger"?T.err:moneyDoctorInsight.tone==="warn"?T.warn:T.accent} style={{padding:"10px 14px",fontSize:12,width:isMobile?"100%":"auto"}}/>
            </div>} style={{marginBottom:18,padding:isMobile?14:"16px 18px"}}/>

            <Card ch={<div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"auto 1fr auto",gap:16,alignItems:"center"}}>
              <div className="premium-ring" style={{width:74,height:74,borderRadius:"50%",background:`conic-gradient(${habitTodayPct>=100?T.ok:T.accent} ${habitTodayPct}%, ${T.cardAlt} 0)`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 12px 28px ${T.accentPop}`}}>
                <div style={{width:56,height:56,borderRadius:"50%",background:T.card,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                  <div style={{fontSize:15,fontWeight:900,color:habitTodayPct>=100?T.ok:T.accent}}>{Math.round(habitTodayPct)}%</div>
                  <div style={{fontSize:8,color:T.muted,fontWeight:800,letterSpacing:.8}}>HABIT</div>
                </div>
              </div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:10,color:T.accent,fontWeight:900,letterSpacing:1.1,textTransform:"uppercase",marginBottom:4}}>Progress hari ini</div>
                <div style={{fontSize:16,fontWeight:900,color:T.text,marginBottom:5}}>{habitTotalToday?`${habitDoneToday}/${habitTotalToday} quest selesai`:"Mulai quest harian pertamamu"}</div>
                <div style={{fontSize:12,color:T.muted,lineHeight:1.55}}>
                  {todayTxCount} transaksi dicatat hari ini
                  {perfectDayStreak>0?` • perfect streak ${perfectDayStreak} hari`:" • ceklis habit biar streak mulai hidup"}
                </div>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:isMobile?"stretch":"flex-end"}}>
                <Btn onClick={()=>setPage("habit")} ch="Buka Habit" c={habitTodayPct>=100?T.ok:T.accent} style={{padding:"9px 12px",fontSize:12,flex:isMobile?1:"0 0 auto"}}/>
                <Btn onClick={()=>setModal({type:"tx"})} ch="+ Transaksi" c={T.info} outline style={{padding:"9px 12px",fontSize:12,flex:isMobile?1:"0 0 auto"}}/>
              </div>
            </div>} style={{marginBottom:18,padding:isMobile?14:"16px 18px"}}/>

            <Card ch={<>
              <Sec t="Checklist sehat hari ini" sub="Empat tanda kecil bahwa akunmu sudah siap dipakai nyaman" right={<span style={{fontSize:11,fontWeight:900,color:healthChecklistPct>=100?T.ok:T.accent}}>{Math.round(healthChecklistPct)}%</span>}/>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(4,1fr)",gap:10}}>
                {healthChecklist.map(item=>(
                  <button key={item.key} onClick={()=>goPremiumTarget(item.target)} style={{textAlign:"left",border:`1px solid ${item.ok?T.okBorder:T.border}`,background:item.ok?T.okBg:T.cardAlt,borderRadius:14,padding:"12px 13px",cursor:"pointer",fontFamily:"inherit",minHeight:118,display:"flex",flexDirection:"column",gap:8}}>
                    <span style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                      <span style={{width:34,height:34,borderRadius:12,background:item.ok?T.ok:T.accentBg,color:item.ok?"white":T.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>{item.ok?"✓":item.icon}</span>
                      <span style={{fontSize:10,fontWeight:900,color:item.ok?T.ok:T.accent,background:T.card,border:`1px solid ${T.border}`,borderRadius:999,padding:"4px 8px",whiteSpace:"nowrap"}}>{item.ok?"Beres":item.action}</span>
                    </span>
                    <span style={{display:"block",fontSize:12,fontWeight:900,color:T.text,lineHeight:1.25}}>{item.title}</span>
                    <span style={{display:"block",fontSize:10,color:T.muted,lineHeight:1.45}}>{item.desc}</span>
                  </button>
                ))}
              </div>
            </>} style={{marginBottom:18,padding:isMobile?14:"16px 18px"}}/>

            {setupPct<100&&<Card ch={<>
              <Sec t="Start checklist" sub="Langkah kecil agar user baru cepat paham alur AturDuitku" right={<span style={{fontSize:11,fontWeight:900,color:T.accent}}>{Math.round(setupPct)}%</span>}/>
              <PBar pct={setupPct} c={T.accent} h={8}/>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
                <Btn onClick={applyBudgetTemplate} ch="Template budget" c={T.info} outline style={{padding:"8px 11px",fontSize:11}}/>
                <Btn onClick={addHabitPresets} ch="Preset habit uang" c={T.ok} outline style={{padding:"8px 11px",fontSize:11}}/>
                <Btn onClick={()=>setCommandOpen(true)} ch="Cari aksi cepat" c={T.accent} outline style={{padding:"8px 11px",fontSize:11}}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(4,1fr)",gap:10,marginTop:14}}>
                {setupSteps.map(step=><button key={step.key} onClick={()=>goPremiumTarget(step.target)} style={{textAlign:"left",border:`1px solid ${step.ok?T.okBorder:T.border}`,background:step.ok?T.okBg:T.cardAlt,borderRadius:14,padding:"12px 13px",cursor:"pointer",fontFamily:"inherit",display:"flex",gap:10,alignItems:"flex-start"}}>
                  <span style={{width:34,height:34,borderRadius:12,background:step.ok?T.ok:T.accentBg,color:step.ok?"white":T.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>{step.ok?"✓":step.icon}</span>
                  <span style={{minWidth:0}}>
                    <span style={{display:"block",fontSize:12,fontWeight:900,color:T.text,marginBottom:3}}>{step.title}</span>
                    <span style={{display:"block",fontSize:10,color:T.muted,lineHeight:1.45,marginBottom:7}}>{step.desc}</span>
                    <span style={{fontSize:10,fontWeight:900,color:step.ok?T.ok:T.accent}}>{step.ok?"Selesai":step.action}</span>
                  </span>
                </button>)}
              </div>
            </>} style={{marginBottom:18,padding:isMobile?14:"16px 18px"}}/>}

            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1.1fr .9fr",gap:18,marginBottom:18}}>
              <Card ch={<>
                <Sec t="Insight pintar" sub="Saran singkat yang langsung bisa ditindaklanjuti"/>
                <div style={{display:"grid",gap:10}}>
                  {smartInsightCards.map(card=>{
                    const c=card.tone==="danger"?T.err:card.tone==="warn"?T.warn:card.tone==="good"?T.ok:T.accent;
                    const bg=card.tone==="danger"?T.errBg:card.tone==="warn"?T.warnBg:card.tone==="good"?T.okBg:T.accentBg;
                    return <div key={card.title} style={{display:"grid",gridTemplateColumns:"auto 1fr auto",gap:11,alignItems:"center",background:bg,border:`1px solid ${c}22`,borderRadius:14,padding:"12px 13px"}}>
                      <span style={{width:38,height:38,borderRadius:13,background:T.card,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,boxShadow:T.shadow}}>{card.icon}</span>
                      <span style={{minWidth:0}}>
                        <span style={{display:"block",fontSize:13,fontWeight:900,color:T.text,marginBottom:3}}>{card.title}</span>
                        <span style={{display:"block",fontSize:11,color:T.sub,lineHeight:1.5}}>{card.body}</span>
                      </span>
                      <button onClick={()=>goPremiumTarget(card.target)} style={{border:"none",background:T.card,color:c,borderRadius:999,padding:"7px 10px",fontSize:10,fontWeight:900,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>{card.action}</button>
                    </div>;
                  })}
                </div>
              </>}/>
              <Card ch={<>
                <Sec t="Misi mingguan" sub={`${weeklyMissions.filter(m=>m.done).length}/${weeklyMissions.length} selesai`}/>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                  <div style={{width:58,height:58,borderRadius:"50%",background:`conic-gradient(${T.accent} ${weeklyMissionPct}%, ${T.cardAlt} 0)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <div style={{width:44,height:44,borderRadius:"50%",background:T.card,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:900,color:T.accent}}>{Math.round(weeklyMissionPct)}%</div>
                  </div>
                  <div style={{fontSize:12,color:T.muted,lineHeight:1.5}}>Misi kecil bikin app terasa seperti game, tapi tetap bantu keuangan makin rapi.</div>
                </div>
                <div style={{display:"grid",gap:8}}>
                  {weeklyMissions.map(m=>{
                    const pct=Math.min(100,(Number(m.progress)||0)/(Number(m.target)||1)*100);
                    return <button key={m.title} onClick={()=>setPage(m.targetPage)} style={{border:`1px solid ${m.done?T.okBorder:T.border}`,background:m.done?T.okBg:T.cardAlt,borderRadius:12,padding:"9px 10px",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
                      <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",marginBottom:6}}>
                        <span style={{fontSize:12,fontWeight:900,color:T.text}}>{m.icon} {m.title}</span>
                        <span style={{fontSize:10,fontWeight:900,color:m.done?T.ok:T.accent}}>{m.done?"Selesai":`${Math.min(m.progress,m.target)}/${m.target}`}</span>
                      </div>
                      <div style={{fontSize:10,color:T.muted,lineHeight:1.35,marginBottom:6}}>{m.desc}</div>
                      <PBar pct={pct} c={m.done?T.ok:T.accent} h={5}/>
                    </button>;
                  })}
                </div>
              </>}/>
            </div>

            <Card ch={<div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"auto 1fr auto",gap:14,alignItems:"center"}}>
              <div style={{width:58,height:58,borderRadius:18,background:T.accentBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,boxShadow:`0 12px 28px ${T.accentPop}`}}>📣</div>
              <div>
                <div style={{fontSize:10,color:T.accent,fontWeight:900,letterSpacing:1.2,textTransform:"uppercase",marginBottom:4}}>Monthly recap</div>
                <div style={{fontSize:16,fontWeight:900,color:T.text,marginBottom:4}}>Kartu ringkasan siap screenshot</div>
                <div style={{fontSize:12,color:T.muted,lineHeight:1.55}}>Tampilkan skor, saving rate, transaksi, kategori terbesar, dan streak habit dalam satu kartu cantik.</div>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:isMobile?"stretch":"flex-end"}}>
                <Btn onClick={()=>setModal({type:"monthlyRecap"})} ch="Buka recap" c={T.accent} style={{padding:"10px 14px",fontSize:12,flex:isMobile?1:"0 0 auto"}}/>
                <Btn onClick={()=>setModal({type:"confirm",title:"Tutup buku bulan ini?",msg:"Pemasukan dan pengeluaran bulan ini disimpan sebagai pembanding, lalu periode aktif pindah ke bulan berikutnya. Data transaksi tetap aman.",onConfirm:closeMonth})} ch="Tutup buku" c={T.info} outline style={{padding:"10px 14px",fontSize:12,flex:isMobile?1:"0 0 auto"}}/>
              </div>
            </div>} style={{marginBottom:18,padding:isMobile?14:"16px 18px"}}/>

            {/* Notifications banner */}
            {notifications.length>0&&<div onClick={()=>setNotifOpen(true)} style={{background:T.errBg,border:`1px solid ${T.errBorder}`,borderRadius:12,padding:"11px 16px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
              <div style={{display:"flex",gap:10,alignItems:"center",minWidth:0}}>
                <span style={{fontSize:11,fontWeight:800,color:T.err,background:"rgba(255,255,255,.5)",borderRadius:999,padding:"4px 8px"}} className="notif-bounce">ALERT</span>
                <span style={{fontSize:13,fontWeight:700,color:T.err}}>{notifications.length} notifikasi perlu perhatianmu</span>
              </div>
              <span style={{fontSize:12,color:T.err,fontWeight:700}}>Buka</span>
            </div>}

            {(s.txs.length===0||totalSaldo===0||!s.budgets.some(b=>N(b.alokasi)>0||(b.sub||[]).some(x=>N(x.alokasi)>0)))&&<Card ch={<>
              <div style={{display:"flex",alignItems:isMobile?"flex-start":"center",justifyContent:"space-between",gap:16,flexDirection:isMobile?"column":"row"}}>
                <div style={{display:"flex",gap:12,alignItems:"flex-start",minWidth:0}}>
                  <div style={{width:44,height:44,borderRadius:14,background:T.accentBg,color:T.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:23,boxShadow:`0 10px 24px ${T.accentPop}`,flexShrink:0}}>🚀</div>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:10,color:T.accent,fontWeight:900,letterSpacing:1.2,textTransform:"uppercase",marginBottom:4}}>Setup cepat</div>
                    <div style={{fontSize:16,fontWeight:900,color:T.text,marginBottom:5}}>Bikin dashboard kamu hidup dalam 2 menit</div>
                    <div style={{fontSize:12,color:T.muted,lineHeight:1.6,maxWidth:560}}>Tambahkan dompet, catat transaksi pertama, lalu isi budget dasar. Setelah itu laporan, insight, dan AI akan jauh lebih akurat.</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:isMobile?"flex-start":"flex-end",width:isMobile?"100%":"auto"}}>
                  <Btn onClick={startAiSetup} ch="Dokter setup" c={T.ok} outline style={{padding:"9px 12px",fontSize:12,flex:isMobile?"1 1 130px":"0 0 auto"}}/>
                  <Btn onClick={()=>setModal({type:"dompet"})} ch="👛 Dompet" c={T.accent} outline style={{padding:"9px 12px",fontSize:12,flex:isMobile?"1 1 130px":"0 0 auto"}}/>
                  <Btn onClick={()=>setModal({type:"tx"})} ch="🧾 Transaksi" style={{padding:"9px 12px",fontSize:12,flex:isMobile?"1 1 130px":"0 0 auto"}}/>
                  <Btn onClick={()=>setPage("budget")} ch="📊 Budget" c={T.info} outline style={{padding:"9px 12px",fontSize:12,flex:isMobile?"1 1 130px":"0 0 auto"}}/>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)",gap:8,marginTop:14}}>
                {[
                  {ok:s.dompet.some(d=>N(d.saldo)>0),t:"Saldo awal",d:"Isi saldo dompet utama"},
                  {ok:s.txs.length>0,t:"Transaksi pertama",d:"Catat pemasukan/pengeluaran"},
                  {ok:s.budgets.some(b=>N(b.alokasi)>0||(b.sub||[]).some(x=>N(x.alokasi)>0)),t:"Budget dasar",d:"Tentukan batas bulanan"},
                ].map(step=><div key={step.t} style={{display:"flex",gap:8,alignItems:"center",background:step.ok?T.okBg:T.cardAlt,border:`1px solid ${step.ok?T.okBorder:T.border}`,borderRadius:11,padding:"10px 12px"}}>
                  <span style={{width:24,height:24,borderRadius:999,display:"flex",alignItems:"center",justifyContent:"center",background:step.ok?T.ok:T.accentBg,color:step.ok?"white":T.accent,fontSize:12,fontWeight:900}}>{step.ok?"✓":"•"}</span>
                  <span style={{minWidth:0}}><span style={{display:"block",fontSize:12,fontWeight:800,color:T.text}}>{step.t}</span><span style={{display:"block",fontSize:10,color:T.muted}}>{step.d}</span></span>
                </div>)}
              </div>
            </>} style={{marginBottom:18,padding:isMobile?16:"18px 20px"}}/>}

            {/* Stats Row */}
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:isMobile?10:14,marginBottom:18}}>
              {[
                {l:"Saving Rate",v:savRate>999?"999%+":PCT(savRate),vc:savRate>=20?T.ok:T.err,bg:savRate>=20?T.okBg:T.errBg,sub:savRate>=20?"Ideal >= 20%":"Di bawah target 20%"},
                {l:t("netCashLabel"),v:IDRs(netCash),vc:netCash>=0?T.ok:T.err,bg:netCash>=0?T.okBg:T.errBg,sub:netCash>=0?"Surplus bulan ini":"Defisit bulan ini"},
                {l:t("runwayLabel"),v:`${runwayReal} ${t("runwayMonths")}`,vc:T.info,bg:T.infoBg,sub:t("runwayDesc")},
                {l:"Pengeluaran Terbesar",v:topKat[0]?.[0]||"-",vc:T.warn,bg:T.warnBg,sub:topKat[0]?IDRs(topKat[0][1]):"Belum ada data"},
              ].map(x=>(
                <div key={x.l} style={{background:x.bg,borderRadius:13,padding:"14px 16px",border:`1px solid ${x.vc}22`,transition:"background .3s"}}>
                  <div style={{fontSize:9,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1.2,marginBottom:6}}>{x.l}</div>
                  <div style={{fontSize:isMobile?14:16,fontWeight:800,color:x.vc,marginBottom:3}}>{x.v}</div>
                  <div style={{fontSize:10,color:T.muted}}>{x.sub}</div>
                </div>
              ))}
            </div>

            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1.05fr .95fr",gap:18,marginBottom:18}}>
              <Card ch={<>
                <Sec t="Laporan Mingguan" sub={`${weeklyReport.start} sampai ${weeklyReport.end}`} right={<button onClick={()=>setPage("laporan")} style={{fontSize:11,color:T.accent,background:"none",border:"none",cursor:"pointer",fontWeight:700}}>Detail</button>}/>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
                  {[
                    {l:"Masuk",v:IDRs(weeklyReport.income),c:T.ok,bg:T.okBg},
                    {l:"Keluar",v:IDRs(weeklyReport.expense),c:T.err,bg:T.errBg},
                    {l:"Nabung",v:IDRs(weeklyReport.saving),c:T.info,bg:T.infoBg},
                  ].map(item=><div key={item.l} style={{background:item.bg,borderRadius:11,padding:"10px 11px"}}>
                    <div style={{fontSize:9,color:T.muted,fontWeight:800,letterSpacing:1,textTransform:"uppercase",marginBottom:3}}>{item.l}</div>
                    <div style={{fontSize:13,fontWeight:900,color:item.c,whiteSpace:"nowrap"}}>{item.v}</div>
                  </div>)}
                </div>
                <div style={{display:"flex",gap:10,alignItems:"flex-start",background:T.cardAlt,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 13px"}}>
                  <img src="/icon-192.png" alt="" style={{width:34,height:34,borderRadius:10,objectFit:"cover",flexShrink:0}}/>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:900,color:T.text,marginBottom:3}}>{weeklyReport.health}</div>
                    <div style={{fontSize:11,color:T.muted,lineHeight:1.6}}>{weeklyReport.advice}</div>
                  </div>
                </div>
              </>}/>
              <Card ch={<>
                <Sec t="Achievement" sub="Badge kecil biar progress terasa seru"/>
                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)",gap:8}}>
                  {premiumBadges.slice(0,6).map(b=>{
                    const pct=b.target?Math.min(100,(Number(b.progress)||0)/(Number(b.target)||1)*100):0;
                    return <div key={b.title} style={{background:b.done?T.okBg:T.cardAlt,border:`1px solid ${b.done?T.okBorder:T.border}`,borderRadius:12,padding:"10px 11px",minHeight:86}}>
                      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:6}}>
                        <span style={{width:26,height:26,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",background:b.done?T.ok:T.accentBg,color:b.done?"white":T.accent,fontSize:15}}>{b.icon}</span>
                        <span style={{fontSize:11,fontWeight:900,color:T.text,lineHeight:1.2}}>{b.title}</span>
                      </div>
                      <div style={{fontSize:10,color:T.muted,lineHeight:1.35,marginBottom:7}}>{b.desc}</div>
                      <PBar pct={pct} c={b.done?T.ok:T.accent} h={5}/>
                    </div>;
                  })}
                </div>
              </>}/>
            </div>

            {/* Progress Pengeluaran */}
            <Card ch={<>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{fontWeight:700,fontSize:13,color:T.text}}>{t("budgetMonthProg")}</div>
                <div style={{fontSize:11,color:T.muted}}>{t("dayOf")}-{hariIni}/{hariDlmBulan}</div>
              </div>
              {[
                {l:"Kebutuhan",c:"#EF4444",val:s.budgets.filter(b=>b.kelas==="Kebutuhan"||b.kelas===t("needsCat")).reduce((a,b)=>a+(spendByKat[b.id]||0),0),total:s.budgets.filter(b=>b.kelas==="Kebutuhan").reduce((a,b)=>a+N(b.alokasi)+b.sub.reduce((x,y)=>x+N(y.alokasi),0),0)},
                {l:"Keinginan",c:"#F59E0B",val:s.budgets.filter(b=>b.kelas==="Keinginan"||b.kelas===t("wantsCat")).reduce((a,b)=>a+(spendByKat[b.id]||0),0),total:s.budgets.filter(b=>b.kelas==="Keinginan").reduce((a,b)=>a+N(b.alokasi)+b.sub.reduce((x,y)=>x+N(y.alokasi),0),0)},
                {l:"Tabungan",c:"#22C55E",val:totalTabung,total:N(s.targetDana)||totalIn*0.2},
              ].map(({l,c,val,total})=>{
                const pct=total>0?Math.min(val/total*100,100):0;
                return(
                  <div key={l} style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontSize:12,color:T.text,fontWeight:600}}>{l}</span>
                      <span style={{fontSize:11,color:T.muted}}>{IDRs(val)} / {IDRs(total)} ({pct.toFixed(0)}%)</span>
                    </div>
                    <PBar pct={pct} c={c} h={8}/>
                  </div>
                );
              })}
            </>} style={{marginBottom:18}}/>

            {/* Calendar + Recent Tx */}
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:18,marginBottom:18}}>
              <Card ch={<>
                <Sec t={`Aktivitas ${s.bulan}`} right={<span style={{fontSize:11,color:T.accent,fontWeight:700,background:T.accentBg,padding:"2px 8px",borderRadius:6}}>{now.getDate()} {MONTHS[now.getMonth()].slice(0,3)}</span>}/>
                <CalendarView txs={txBulan} bulan={s.bulan} tahun={s.tahun} liveDay={now.getDate()} liveMonth={now.getMonth()} liveYear={now.getFullYear()}/>
              </>}/>
              <Card ch={<>
                <Sec t={t("recentTx")} right={<button onClick={()=>setPage("trans")} style={{fontSize:11,color:T.accent,background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Lihat semua</button>}/>
                {txBulan.length
                  ? [...txBulan].sort((a,b)=>new Date(b.tgl)-new Date(a.tgl)).slice(0,6).map(t=>renderTxItem(t))
                  : <LaunchEmpty
                      icon="🧾"
                      title="Belum ada transaksi bulan ini"
                      desc="Mulai dari satu pemasukan atau satu pengeluaran dulu. Setelah itu dashboard bakal langsung terasa hidup."
                      actionLabel="Tambah transaksi pertama"
                      onAction={()=>setModal({type:"tx"})}
                      secondaryLabel="Tanya AI"
                      onSecondary={()=>setAiOpen(true)}
                      style={{padding:"24px 16px"}}
                    />}
              </>}/>
            </div>

            {/* Daily Spending + Tagihan + Top Spending */}
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":`${isMobile?"1fr":"1fr 1fr 1fr"}`,gap:18,marginBottom:18}}>
              <Card ch={<>
                <Sec t={`Ringkasan ${t("dailyExpense")}`} sub={s.bulan}/>
                <Suspense fallback={<ChartFallback height={130}/>}>
                  <DailyChartLazy txBulan={txBulan} bulan={s.bulan} tahun={s.tahun} months={MONTHS} T={T} idr={IDR} n={N}/>
                </Suspense>
              </>}/>
              <Card ch={<>
                <Sec t={t("upcomingBills")}/>
                {tagihan.length ? tagihan.slice(0,5).map((t,i)=>{
                  const tDate=new Date(now.getFullYear(),now.getMonth(),Number(t.tempo));
                  const diff=Math.ceil((tDate-now)/(1000*60*60*24));
                  const isUrgent=diff>=0&&diff<=3; const isOverdue=diff<0;
                  return(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",borderRadius:8,background:(isUrgent||isOverdue)?T.errBg:"transparent",borderBottom:`1px solid ${T.borderLight}`}}>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{fontSize:18}}>{t.emoji}</span>
                      <div><div style={{fontSize:12,fontWeight:600,color:(isUrgent||isOverdue)?T.err:T.text}}>{t.nama}</div><div style={{fontSize:10,color:T.muted}}>{t.kat}</div></div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:12,fontWeight:700,color:T.err}}>{IDRs(N(t.alokasi))}</div>
                      <div style={{fontSize:10,color:(isUrgent||isOverdue)?T.err:T.muted, fontWeight:(isUrgent||isOverdue)?700:400}}>
                         {isOverdue?`Lewat ${Math.abs(diff)} hari`:isUrgent?`${diff} hari lagi`:`tgl ${t.tempo}`}
                      </div>
                    </div>
                  </div>
                  );
                }) : <LaunchEmpty
                  icon="🗓️"
                  title={t("noBills")}
                  desc="Belum ada tagihan terjadwal. Tambahkan subkategori budget dengan tanggal jatuh tempo supaya pengingat otomatis mulai bekerja."
                  actionLabel="Buka budget"
                  onAction={()=>setPage("budget")}
                  style={{padding:"22px 16px"}}
                />}
              </>}/>
              <Card ch={<>
                <Sec t={t("topExpense")}/>
                {topKat.map((k,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${T.borderLight}`}}>
                    <span style={{fontSize:12,color:T.text,fontWeight:500}}>{k[0]}</span>
                    <span style={{fontSize:12,fontWeight:700,color:T.err}}>{IDRs(k[1])}</span>
                  </div>
                ))}
                {pieData.length>0&&<div style={{marginTop:12}}>
                  <Suspense fallback={<ChartFallback height={120}/>}>
                    <DonutChartLazy pieData={pieData} pieColors={PIE_C} T={T} idr={IDR} height={120} outerRadius={52} innerRadius={28}/>
                  </Suspense>
                </div>}
                {!topKat.length&&<LaunchEmpty
                  icon="📊"
                  title="Belum ada pengeluaran bulan ini"
                  desc="Catat satu pengeluaran dulu supaya kategori terbesar, grafik, dan insight laporan mulai muncul."
                  actionLabel="Catat pengeluaran"
                  onAction={()=>setModal({type:"tx",tipe:"pengeluaran"})}
                  secondaryLabel="Buka transaksi"
                  onSecondary={()=>setPage("trans")}
                  style={{padding:"24px 14px"}}
                />}
              </>}/>
            </div>
          </>}

          {/* ══════════════════════════════════════════════════════════
              DOMPET
          ══════════════════════════════════════════════════════════ */}
          {page==="dompet"&&<>
            <div style={{background:T.hero,borderRadius:16,padding:"22px 28px",marginBottom:20,color:"white"}}>
              <div style={{fontSize:10,opacity:.6,letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>{t("liquidAssets")}</div>
              <div style={{fontSize:30,fontWeight:900,marginBottom:4}}><MV v={IDR(totalSaldo)}/></div>
              <div style={{display:"flex",gap:16,fontSize:12,opacity:.7}}>
                <span>{t("scoreLabel")}: {getLabel(skorTotal)} ({skorTotal}/100)</span>
                <span>{s.dompet.length} akun aktif</span>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(280px,1fr))",gap:14,marginBottom:20}}>
              {s.dompet.map(d=>(
                <div key={d.id} style={{background:T.card,borderRadius:14,padding:18,border:`1px solid ${T.border}`,boxShadow:T.shadow,transition:"background .3s"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                    <div style={{display:"flex",gap:10,alignItems:"center",minWidth:0}}>
                      <span style={{fontSize:26}}>{uiIcon(d.icon)}</span>
                      <div><div style={{fontWeight:800,fontSize:14,color:T.text}}>{d.nama}</div><div style={{fontSize:11,color:T.muted}}>{d.tipe}{d.norek&&` • ${d.norek}`}</div></div>
                    </div>
                    <Del onClick={()=>setModal({type:"confirm",title:`${t("deleteWallet")}: "${d.nama}"?`,msg:`${t("deleteWalletMsg")} ${IDR(N(d.saldo))} akan dihapus. Transaksi yang terhubung tetap ada tapi tidak lagi menunjuk ke dompet ini.`,danger:true,onConfirm:()=>{setS(p=>({...p,dompet:p.dompet.filter(x=>x.id!==d.id)}));setModal(null);showToast(`Dompet ${d.nama} dihapus!`);}})} />
                  </div>
                  <div style={{fontSize:20,fontWeight:900,color:N(d.saldo)<0?T.err:T.text,marginBottom:8}}>
                    {N(d.saldo)<0&&<span style={{fontSize:12,background:T.errBg,color:T.err,borderRadius:6,padding:"1px 7px",marginRight:6,fontWeight:700}}>Minus</span>}
                    <MV v={IDR(N(d.saldo))}/>
                  </div>
                  <div style={{height:4,background:T.border,borderRadius:4,marginBottom:12,overflow:"hidden"}}>
                    <div style={{width:totalSaldo>0?Math.min(N(d.saldo)/totalSaldo*100,100)+"%" :"0%",height:"100%",background:T.accent,borderRadius:4}}/>
                  </div>
                  <label style={{...LS, color:T.muted}}>{t("adjustBalance")}</label>
                  <div style={{display:"flex", gap:6}}>
                    <CurIn value={editSaldo[d.id] !== undefined ? editSaldo[d.id] : d.saldo} onChange={v=>setEditSaldo(p=>({...p, [d.id]:v}))}/>
                    {editSaldo[d.id] !== undefined && editSaldo[d.id] !== String(N(d.saldo)) && (
                        <Btn onClick={()=>{
                            const diff = N(editSaldo[d.id]) - N(d.saldo);
                            const txTipe = diff > 0 ? "pemasukan" : "pengeluaran";
                            setS(p=>({...p,
                                dompet: p.dompet.map(x=>x.id===d.id ? {...x, saldo: String(N(editSaldo[d.id]))} : x),
                                txs: [{id:Date.now(), tipe:txTipe, tgl:today(), ket:`${t("balAdjustLabel")}: ${d.nama}`, jml:String(Math.abs(diff)), dompetId:d.id}, ...p.txs]
                            }));
                            setEditSaldo(p=>{const np={...p}; delete np[d.id]; return np;});
                            showToast(t("toast_balanceOk"));
                        }} ch="Simpan" c="#16A34A" />
                    )}
                  </div>
                </div>
              ))}
              <div onClick={()=>setModal({type:"dompet"})} style={{background:T.cardAlt,borderRadius:14,padding:18,border:`1.5px dashed ${T.border}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",minHeight:140,gap:8,color:T.muted,transition:"border-color .15s"}} onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                <span style={{fontSize:28}}>+</span><span style={{fontSize:13,fontWeight:600}}>{t("addWallet")}</span>
              </div>
            </div>
          </>}

          {/* ══════════════════════════════════════════════════════════
              TRANSAKSI
          ══════════════════════════════════════════════════════════ */}
          {page==="trans"&&<>
            <Card ch={<>
              <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
                <div style={{position:"relative",flex:1,minWidth:200}}>
                  <input placeholder={t("searchTx")} value={txSearch} onChange={e=>{setTxSearch(e.target.value);setTxPage(1);}} style={{...IS,paddingLeft:36,width:"100%"}}/>
                  <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:11,fontWeight:800,color:T.muted}}>Cari</span>
                </div>
                <select value={txFilt.dompet} onChange={e=>{setTxFilt(f=>({...f,dompet:e.target.value}));setTxPage(1);}} style={{...IS,width:"auto",fontSize:12}}>
                  <option value="">{t("allWallets")}</option>{s.dompet.map(d=><option key={d.id} value={d.id}>{uiIcon(d.icon)} {d.nama}</option>)}
                </select>
                <select value={txFilt.tipe} onChange={e=>{setTxFilt(f=>({...f,tipe:e.target.value}));setTxPage(1);}} style={{...IS,width:"auto",fontSize:12}}>
                  <option value="">{t("allTypes")}</option><option value="pemasukan">{t("income")}</option><option value="pengeluaran">{t("expense")}</option><option value="tabungan">{t("saving")}</option><option value="transfer">Transfer</option>
                </select>
                {(txSearch||txFilt.dompet||txFilt.tipe)&&<Btn onClick={()=>{setTxSearch("");setTxFilt({dompet:"",tipe:"",sub:""});setTxPage(1);}} ch="Reset" c={T.err} outline style={{padding:"7px 12px",fontSize:12}}/>}
                <Btn onClick={exportCSV} ch="Export" c="#16A34A" outline style={{padding:"7px 12px",fontSize:12}}/>
                <Btn onClick={()=>setModal({type:"importMutasi"})} ch="Import Mutasi" c={T.accent} style={{padding:"7px 12px",fontSize:12}}/>
              </div>
            </>} style={{marginBottom:16}}/>

            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:16}}>
              {[{l:t("incomeLabel"),v:IDR(totalIn),vc:T.ok,bg:T.okBg},{l:t("expenseLabel"),v:IDR(totalOut),vc:T.err,bg:T.errBg},{l:"Tabungan",v:IDR(totalTabung),vc:T.info,bg:T.infoBg},{l:"Net",v:IDR(netCash),vc:netCash>=0?T.ok:T.err,bg:netCash>=0?T.okBg:T.errBg}].map(x=>(
                <div key={x.l} style={{background:x.bg,borderRadius:12,padding:"13px 16px",transition:"background .3s"}}>
                  <div style={{fontSize:9,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{x.l}</div>
                  <div style={{fontWeight:800,fontSize:15,color:x.vc}}>{x.v}</div>
                </div>
              ))}
            </div>
            <Card ch={<>
              <Sec t={`${filtTx.length} ${t("txCount")}`} right={<div style={{fontSize:12,color:T.muted}}>{s.bulan} {s.tahun}</div>}/>
              {filtTx.length?<>
                {filtTx.slice(0,txPage*TX_PER_PAGE).map(t=>renderTxItem(t))}
                {filtTx.length>txPage*TX_PER_PAGE&&(
                  <div style={{textAlign:"center",paddingTop:16}}>
                    <Btn onClick={()=>setTxPage(p=>p+1)} ch={`${t("loadMore")} (${filtTx.length-txPage*TX_PER_PAGE} tersisa)`} c={T.accent} outline style={{padding:"9px 20px",fontSize:12}}/>
                  </div>
                )}
                {filtTx.length>TX_PER_PAGE&&txPage*TX_PER_PAGE>=filtTx.length&&(
                  <div style={{textAlign:"center",paddingTop:12,fontSize:11,color:T.muted}}>{filtTx.length} transaksi ditampilkan</div>
                )}
              </>:<LaunchEmpty
                icon="🔎"
                title="Tidak ada transaksi yang cocok"
                desc="Coba ganti filter, pindah bulan, atau tambah transaksi baru supaya riwayat keuanganmu mulai kebentuk."
                actionLabel="Tambah transaksi baru"
                onAction={()=>setModal({type:"tx"})}
                secondaryLabel="Bulan ini"
                onSecondary={()=>{setBln(MONTHS[now.getMonth()]);setThn(String(now.getFullYear()));}}
              />}
            </>}/>
          </>}

          {/* ══════════════════════════════════════════════════════════
              BUDGET
          ══════════════════════════════════════════════════════════ */}
          {page==="budget"&&<>
            <div style={{background:T.hero,borderRadius:16,padding:"20px 26px",marginBottom:20,color:"white",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
              <div>
                <div style={{fontSize:10,opacity:.6,letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>{t("budgetMonthly")}</div>
                <div style={{fontSize:isMobile?20:28,fontWeight:900,marginBottom:4}}>{IDR(totalBudget)}</div>
                <div style={{fontSize:12,opacity:.78}}>{t("budgetUsed")} {IDR(totalOut)} • {t("budgetLeft")} {IDR(Math.max(totalBudget-totalOut,0))}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:11,opacity:.6,marginBottom:4}}>{t("budgetDisc")}</div>
                <div style={{fontSize:20,fontWeight:900}}>{Math.round(skorDisiplin)}/100</div>
                <div style={{marginTop:8,width:120}}>
                  <div style={{background:"rgba(255,255,255,.2)",borderRadius:99,overflow:"hidden",height:6}}>
                    <div style={{width:Math.min(totalBudget>0?totalOut/totalBudget*100:0,100)+"%",height:"100%",background:"rgba(255,255,255,.7)",borderRadius:99,transition:"width .6s"}}/>
                  </div>
                </div>
              </div>
            </div>

            <Card ch={<>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:showAddKat?14:0,gap:10,flexWrap:"wrap"}}>
                <div style={{fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:T.muted}}>{t("manageCategory")}</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <Btn onClick={applyBudgetTemplate} ch="Template pemula" c={T.info} outline style={{padding:"7px 12px",fontSize:12}}/>
                  <Btn onClick={()=>setShowAddKat(!showAddKat)} ch={showAddKat?"Tutup form":"+ Tambah kategori"} c={T.accent} outline style={{padding:"7px 14px",fontSize:12}}/>
                </div>
              </div>
              {showAddKat&&<div style={{background:T.infoBg,border:`1px solid ${T.infoBorder}`,borderRadius:12,padding:16,marginTop:10}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,marginBottom:12}}>
                  <div><label style={LS}>{t("catName")}</label><input placeholder={t("catPlaceholder")} value={newKat.kat} onChange={e=>setNewKat(f=>({...f,kat:e.target.value}))} style={IS}/></div>
                  <div><label style={LS}>{t("catClass")}</label><select value={newKat.kelas} onChange={e=>setNewKat(f=>({...f,kelas:e.target.value}))} style={IS}><option>Kebutuhan</option><option>Keinginan</option></select></div>
                </div>
                <label style={LS}>Pilih ikon</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:5,padding:10,background:T.card,borderRadius:8,border:`1.5px solid ${T.infoBorder}`,marginBottom:12}}>
                  {ICONS.slice(0,28).map(ico=><button key={ico} onClick={()=>setNewKat(f=>({...f,icon:ico}))} style={{width:34,height:34,borderRadius:7,border:`2px solid ${newKat.icon===ico?T.accent:"transparent"}`,background:newKat.icon===ico?T.accentBg:"transparent",cursor:"pointer",fontSize:17,fontFamily:"inherit"}}>{uiIcon(ico)}</button>)}
                </div>
                <Btn onClick={()=>{if(!newKat.kat.trim()){showToast(t("toast_fillName"));return;}setS(p=>({...p,budgets:[...p.budgets,{id:Date.now(),kat:newKat.kat,icon:newKat.icon,kelas:newKat.kelas,alokasi:"0",sub:[]}]}));setNewKat({kat:"",icon:"ETC",kelas:"Kebutuhan"});setShowAddKat(false);showToast("Kategori ditambahkan!");}} ch="Simpan kategori" style={{padding:"10px 20px"}}/>
              </div>}
            </>} style={{marginBottom:20}}/>

            {totalBudget===0&&<LaunchEmpty
              icon="📊"
              title="Budget belum punya batas bulanan"
              desc="Kategori sudah siap. Isi alokasi untuk kebutuhan utama, atau pakai template pemula agar user baru langsung punya pagar belanja."
              actionLabel="Pakai template pemula"
              onAction={applyBudgetTemplate}
              secondaryLabel="Tanya Dokter"
              onSecondary={()=>{setAiOpen(true);setTimeout(()=>handleAiSend("Bantu saya buat budget bulanan pertama yang sederhana dan realistis."),0);}}
              style={{marginBottom:20,padding:isMobile?"34px 16px":"42px 20px"}}
            />}

            {[t("needsCat"),t("wantsCat")].map(kelas=>{
              const cats=s.budgets.filter(b=>b.kelas===kelas);
              const kelasTotal=cats.reduce((a,b)=>a+N(b.alokasi)+b.sub.reduce((x,y)=>x+N(y.alokasi),0),0);
              const kelasSpend=cats.reduce((a,b)=>a+(spendByKat[b.id]||0),0);
              return(
                <div key={kelas} style={{marginBottom:20}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    <div style={{display:"flex",gap:10,alignItems:"center",minWidth:0}}>
                      <span style={{fontSize:10,fontWeight:800,color:kelas===t("needsCat")?"#2563EB":"#CA8A04",background:kelas===t("needsCat")?"rgba(37,99,235,.12)":"rgba(202,138,4,.12)",borderRadius:999,padding:"4px 8px"}}>{kelas===t("needsCat")?"NEED":"WANT"}</span>
                      <div><div style={{fontWeight:800,fontSize:14,color:T.text}}>{kelas}</div><div style={{fontSize:11,color:T.muted}}>Total: {IDR(kelasSpend)} / {IDR(kelasTotal)}</div></div>
                    </div>
                    <Pill c={kelas==="Kebutuhan"?"blue":"yellow"} ch={`${cats.length} ${lang==="en"?"categories":"kategori"}`}/>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14}}>
                    {cats.map(b=>{
                      const spend=spendByKat[b.id]||0;
                      const alloc=N(b.alokasi)+b.sub.reduce((x,y)=>x+N(y.alokasi),0);
                      const pct=alloc>0?spend/alloc*100:0;
                      const unallocated=alloc<=0&&spend>0;
                      const over=alloc>0&&spend>alloc;
                      const statusColor=unallocated?"yellow":over?"red":pct>80?"yellow":"green";
                      const statusLabel=unallocated?"Perlu budget":over?t("overLabel"):pct>80?t("almostLabel"):t("safeLabel");
                      return(
                        <div key={b.id} style={{background:T.card,borderRadius:13,padding:16,border:`1px solid ${over?T.errBorder:unallocated?T.warnBorder:T.border}`,boxShadow:T.shadow,transition:"background .3s"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                            <div style={{display:"flex",gap:8,alignItems:"center"}}><span style={{fontSize:20}}>{uiIcon(b.icon)}</span><span style={{fontWeight:700,fontSize:13,color:T.text}}>{b.kat}</span></div>
                            <div style={{display:"flex",gap:6,alignItems:"center"}}>
                              <Pill c={statusColor} ch={statusLabel} xs/>
                              <button onClick={()=>confirmDelete({title:"Hapus kategori budget?",msg:`Kategori "${b.kat}" beserta subkategori di dalamnya akan dihapus. Transaksi lama tetap tersimpan.`,toastMsg:"Kategori budget dihapus",onConfirm:()=>setS(p=>({...p,budgets:p.budgets.filter(x=>x.id!==b.id)}))})} style={{background:"none",border:"none",cursor:"pointer",color:T.muted,fontSize:11,fontWeight:800,padding:"2px 5px",borderRadius:4,fontFamily:"inherit"}} onMouseEnter={e=>e.currentTarget.style.color=T.err} onMouseLeave={e=>e.currentTarget.style.color=T.muted}>Hapus</button>
                            </div>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:8,marginBottom:10}}>
                            <div><label style={LS}>Alokasi</label><CurIn value={b.alokasi} onChange={v=>setS(p=>({...p,budgets:p.budgets.map(x=>x.id!==b.id?x:{...x,alokasi:v})}))} /></div>
                            <div><label style={LS}>Realisasi</label>
                            <div style={{padding:"9px 12px",borderRadius:8,border:`1.5px dashed ${over?T.errBorder:unallocated?T.warnBorder:T.infoBorder}`,background:over?T.errBg:unallocated?T.warnBg:T.infoBg,color:over?T.err:unallocated?T.warn:T.info,fontWeight:700,fontSize:13}}>{IDRs(spend)||"Rp 0"}</div></div>
                          </div>
                          <PBar pct={pct} c={over?"#EF4444":pct>80?"#F59E0B":"#22C55E"} h={5}/>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:T.muted,marginTop:3,marginBottom:b.sub.length?10:0}}>
                            <span>{unallocated?"Belum ada alokasi":`${pct.toFixed(0)}% terpakai`}</span><span>Sisa: {IDR(Math.max(alloc-spend,0))}</span>
                          </div>
                          {b.sub.map((sb,si)=>(
                            <div key={si} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 10px",background:T.cardAlt,borderRadius:8,marginBottom:4,border:`1px solid ${T.borderLight}`}}>
                              <div style={{display:"flex",gap:7,alignItems:"center"}}>
                                <span style={{fontSize:14}}>{sb.emoji}</span>
                                <div><div style={{fontSize:12,fontWeight:600,color:T.text}}>{sb.nama}</div>{sb.tempo&&<div style={{fontSize:10,color:T.muted}}>Tagihan tgl {sb.tempo}</div>}</div>
                              </div>
                              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                                <span style={{fontSize:12,fontWeight:700,color:T.text}}>{IDRs(N(sb.alokasi))}</span>
                                <button onClick={()=>confirmDelete({title:"Hapus subkategori?",msg:`Subkategori "${sb.nama}" akan dihapus dari budget ${b.kat}.`,toastMsg:"Subkategori dihapus",onConfirm:()=>setS(p=>({...p,budgets:p.budgets.map(x=>x.id!==b.id?x:{...x,sub:x.sub.filter((_,j)=>j!==si)})}))})} style={{background:"none",border:"none",cursor:"pointer",color:T.muted,fontSize:12,fontFamily:"inherit"}} onMouseEnter={e=>e.currentTarget.style.color=T.err} onMouseLeave={e=>e.currentTarget.style.color=T.muted}>X</button>
                              </div>
                            </div>
                          ))}
                          {newSub.katId===b.id
                            ?<div style={{background:T.infoBg,borderRadius:8,padding:10,marginTop:8,border:`1px solid ${T.infoBorder}`}}>
                              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:8,marginBottom:8}}>
                                <div><label style={{...LS,fontSize:9}}>{t("name")}</label><input placeholder={t("subBillPlaceholder")} value={newSub.nama} onChange={e=>setNewSub(f=>({...f,nama:e.target.value}))} style={{...IS,fontSize:11,padding:"6px 9px"}}/></div>
                                <div><label style={{...LS,fontSize:9}}>Alokasi</label><CurIn value={newSub.alokasi} onChange={v=>setNewSub(f=>({...f,alokasi:v}))} style={{...IS,fontSize:11,padding:"6px 9px"}}/></div>
                              </div>
                              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:8,marginBottom:8}}>
                                <div><label style={{...LS,fontSize:9}}>Emoji</label>
                                <div style={{display:"flex",flexWrap:"wrap",gap:3,padding:5,background:T.card,borderRadius:6,border:`1px solid ${T.infoBorder}`}}>
                                  {ICONS.slice(0,16).map(ic=><button key={ic} onClick={()=>setNewSub(f=>({...f,emoji:ic}))} style={{width:26,height:26,borderRadius:5,border:`1.5px solid ${newSub.emoji===ic?T.accent:"transparent"}`,background:newSub.emoji===ic?T.accentBg:"transparent",cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>{ic}</button>)}
                                </div></div>
                                <div><label style={{...LS,fontSize:9}}>Jatuh Tempo (tgl)</label><input type="number" min="1" max="31" placeholder="tgl" value={newSub.tempo} onChange={e=>setNewSub(f=>({...f,tempo:e.target.value}))} style={{...IS,fontSize:11,padding:"6px 9px"}}/></div>
                              </div>
                              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr auto",gap:8}}>
                                <Btn onClick={()=>{if(!newSub.nama){showToast("Isi nama dulu");return;}setS(p=>({...p,budgets:p.budgets.map(x=>x.id!==b.id?x:{...x,sub:[...x.sub,{nama:newSub.nama,emoji:newSub.emoji,alokasi:newSub.alokasi||"0",tempo:newSub.tempo||null}]})}));setNewSub({katId:null,nama:"",emoji:"PIN",alokasi:"",tempo:""});showToast("Subkategori ditambahkan!");}} ch="Simpan" c="#0369A1" style={{fontSize:11,padding:"6px 12px"}}/>
                                <Btn onClick={()=>setNewSub({katId:null,nama:"",emoji:"PIN",alokasi:"",tempo:""})} ch="Batal" c={T.muted} outline style={{fontSize:11,padding:"6px 12px"}}/>
                              </div>
                            </div>
                            :<button onClick={()=>setNewSub({katId:b.id,nama:"",emoji:"PIN",alokasi:"",tempo:""})} style={{width:"100%",padding:7,borderRadius:8,border:`1.5px dashed ${T.infoBorder}`,background:T.infoBg,color:T.info,fontWeight:600,fontSize:11,cursor:"pointer",fontFamily:"inherit",marginTop:6}}>+ Tambah Subkategori</button>
                          }
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>}

          {/* ══════════════════════════════════════════════════════════
              GOALS
          ══════════════════════════════════════════════════════════ */}
          {/* ══════════════════════════════════════════════════════════
              AMPLOP DIGITAL
          ══════════════════════════════════════════════════════════ */}
          {page==="amplop"&&<>
            {/* Hero */}
            <div style={{background:T.hero,borderRadius:16,padding:"20px 26px",marginBottom:20,color:"white"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
                <div>
                  <div style={{fontSize:10,opacity:.6,letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>{t("totalEnvFunds")}</div>
                  <div style={{fontSize:28,fontWeight:900,marginBottom:4}}>{IDR(amplopTotal)}</div>
                  <div style={{display:"flex",gap:10,fontSize:12,flexWrap:"wrap"}}>
                    <div style={{background:"rgba(255,255,255,.12)",borderRadius:8,padding:"5px 12px"}}>Amplop: {s.amplop.length}</div>
                    <div style={{background:"rgba(255,255,255,.12)",borderRadius:8,padding:"5px 12px"}}>Terpakai: {IDRs(amplopTerpakai)}</div>
                    <div style={{background:"rgba(255,255,255,.12)",borderRadius:8,padding:"5px 12px"}}>{t("envelopeLeft")}: {IDRs(amplopTotal-amplopTerpakai)}</div>
                  </div>
                </div>
                <Btn onClick={()=>setShowAddAmplop(!showAddAmplop)} ch={showAddAmplop?"Tutup form":t("createEnvelope")} style={{padding:"10px 18px",background:"rgba(255,255,255,.2)",border:"1.5px solid rgba(255,255,255,.4)",color:"white"}}/>
              </div>
            </div>

            {/* Penjelasan */}
            <div style={{background:T.infoBg,border:`1px solid ${T.infoBorder}`,borderRadius:12,padding:"12px 16px",marginBottom:18,fontSize:12,color:T.info,lineHeight:1.6}}>
              {t("envelopeInfo")} untuk tujuan tertentu. Mirip metode amplop fisik, tapi digital. Uang dari dompet dipindah ke amplop, dan saat belanja cukup "ambil" dari amplop yang sesuai.
            </div>

            {/* Form Tambah Amplop */}
            {showAddAmplop&&<Card ch={<>
              <Sec t={lang==="en"?"Create New Envelope":"Buat Amplop Baru"}/>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10,marginBottom:10}}>
                <div><label style={LS}>{t("envelopeName")}</label><input placeholder="Makan, Bensin, Hiburan..." value={amplopForm.nama} onChange={e=>setAmplopForm(f=>({...f,nama:e.target.value}))} style={IS}/></div>
                <div><label style={LS}>{t("envelopeAlloc")}</label><CurIn value={amplopForm.alokasi} onChange={v=>setAmplopForm(f=>({...f,alokasi:v}))} placeholder="0" style={IS}/></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10,marginBottom:14}}>
                <div><label style={LS}>{t("envelopeSource")}</label>
                <select value={amplopForm.dompetId} onChange={e=>setAmplopForm(f=>({...f,dompetId:Number(e.target.value)}))} style={IS}>
                  {s.dompet.map(d=><option key={d.id} value={d.id}>{uiIcon(d.icon)} {d.nama} ({IDRs(N(d.saldo))})</option>)}
                </select></div>
                <div><label style={LS}>Pilih ikon</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:4,padding:8,background:T.cardAlt,borderRadius:8,border:`1.5px solid ${T.inputBorder}`}}>
                  {["ENV","FOD","MOV","SHP","IDEA","HLT","FUN","EDU","TRP","HOME","STYL","WORK","MUS","CAFE","GIFT","FIT","PLNT","STDY","PHN","CARE"].map(ico=>(
                    <button key={ico} onClick={()=>setAmplopForm(f=>({...f,icon:ico}))} style={{minWidth:44,height:28,padding:"0 6px",borderRadius:6,border:`2px solid ${amplopForm.icon===ico?T.accent:"transparent"}`,background:amplopForm.icon===ico?T.accentBg:"transparent",cursor:"pointer",fontSize:10,fontWeight:800,fontFamily:"inherit"}}>{uiIcon(ico)}</button>
                  ))}
                </div></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr auto",gap:8}}>
                <Btn onClick={addAmplop} ch={t("createTransfer")} style={{padding:"10px 18px"}}/>
                <Btn onClick={()=>setShowAddAmplop(false)} ch={t("cancel")} c={T.muted} outline style={{padding:"10px 14px"}}/>
              </div>
            </>} style={{marginBottom:18}}/>}

            {/* Daftar Amplop */}
            {s.amplop.length===0&&!showAddAmplop&&<LaunchEmpty
              icon="✉️"
              title={t("noEnvelope")}
              desc="Mulai dengan satu amplop sederhana seperti makan, tagihan, atau dana mingguan supaya pengeluaran harian lebih terarah."
              actionLabel="Buat amplop pertama"
              onAction={()=>setShowAddAmplop(true)}
              secondaryLabel="Buka budget"
              onSecondary={()=>setPage("budget")}
              style={{padding:"52px 20px",marginBottom:4}}
            />}

            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
              {s.amplop.map(amp=>(
                <AmplopCard
                  key={amp.id}
                  amp={amp}
                  dompetList={s.dompet}
                  onDelete={()=>setModal({type:"confirm",title:t("deleteEnvelope"),msg:`${t("deleteEnvelopeMsg")} "${amp.nama}"${t("deleteEnvelopeSuffix")} — Dana dikembalikan ke dompet.`,danger:true,onConfirm:()=>{setS(p=>({...p,amplop:p.amplop.filter(a=>a.id!==amp.id)}));setModal(null);showToast("✅ Amplop dihapus!")}})}
                  onIsi={(jml,dompetId)=>isiAmplop(amp.id,jml,dompetId)}
                  onPakai={(jml,ket)=>pakaiAmplop(amp.id,jml,ket)}
                  onReset={()=>resetAmplop(amp.id)}
                />
              ))}
            </div>
          </>}

          {/* ══════════════════════════════════════════════════════════
              GOALS
          ══════════════════════════════════════════════════════════ */}
          {page==="goals"&&<>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)",gap:isMobile?10:14,marginBottom:20}}>
              {[{l:"Total Goal",v:s.goals.length,vc:T.accent,bg:T.accentBg},{l:"Tercapai",v:s.goals.filter(g=>g.selesai||(N(g.target)>0&&N(g.kumpul)>=N(g.target))).length,vc:T.ok,bg:T.okBg},{l:"Total Terkumpul",v:IDR(s.goals.reduce((a,g)=>a+N(g.kumpul),0)),vc:T.info,bg:T.infoBg}].map(x=>(
                <div key={x.l} style={{background:x.bg,borderRadius:13,padding:"14px 18px",transition:"background .3s"}}>
                  <div style={{fontSize:9,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:5}}>{x.l}</div>
                  <div style={{fontWeight:800,fontSize:18,color:x.vc}}>{x.v}</div>
                </div>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
              {s.goals.map(g=><GoalCard key={g.id} g={g} dompetList={s.dompet} onDelete={()=>confirmDelete({title:"Hapus goal?",msg:`Goal "${g.nama}" dan riwayat tabungannya akan dihapus dari daftar.`,toastMsg:"Goal dihapus",onConfirm:()=>setS(p=>({...p,goals:p.goals.filter(x=>x.id!==g.id)}))})} onTambah={tambahGoalDana} onSelesai={id=>setS(p=>({...p,goals:p.goals.map(x=>x.id!==id?x:{...x,selesai:true})}))}/>)}
              {!s.goals.length&&<div style={{gridColumn:"1/-1"}}><LaunchEmpty
                icon="🎯"
                title={t("noGoal")}
                desc="Bikin target pertama seperti dana darurat, motor, laptop, atau liburan. Progress kecil bakal bikin kamu lebih semangat balik lagi."
                actionLabel="Tambah goal pertama"
                onAction={()=>setModal({type:"goal"})}
                secondaryLabel="Tanya AI"
                onSecondary={()=>setAiOpen(true)}
                style={{padding:"52px 20px"}}
              /></div>}
            </div>
            {s.goals.length>0&&<div style={{marginTop:16,textAlign:"right"}}><Btn onClick={()=>setModal({type:"goal"})} ch={t("addGoalBtn")} style={{padding:"10px 20px"}}/></div>}
          </>}

          {page==="habit"&&<>
            <div className="premium-panel" style={{background:T.hero,borderRadius:18,padding:isMobile?"20px 18px":"26px 30px",marginBottom:18,color:"white",boxShadow:T.shadowMd,border:"1px solid rgba(255,255,255,.14)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:18,flexWrap:"wrap"}}>
                <div style={{display:"flex",gap:16,alignItems:"center",minWidth:0}}>
                  <img className={`cat-mascot ${habitCelebrate?"win":""}`} src="/icon-192.png" alt="AturDuitku Habit" style={{width:isMobile?64:76,height:isMobile?64:76,borderRadius:20,objectFit:"cover",boxShadow:"0 14px 32px rgba(0,0,0,.28)",flexShrink:0}}/>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",opacity:.72,fontWeight:900,marginBottom:5}}>Daily habit game</div>
                    <div style={{fontSize:isMobile?24:30,fontWeight:900,letterSpacing:-.4,marginBottom:5}}>Naik level bareng kucingmu</div>
                    <div style={{fontSize:13,opacity:.82,lineHeight:1.6,maxWidth:560}}>Selesaikan habit harian, jaga streak, kumpulkan XP, dan bikin rutinitas finansial terasa seperti game kecil yang nagih.</div>
                  </div>
                </div>
                <div style={{background:"rgba(0,0,0,.22)",border:"1px solid rgba(255,255,255,.12)",borderRadius:16,padding:"14px 18px",minWidth:isMobile?"100%":190}}>
                  <div style={{fontSize:10,opacity:.65,letterSpacing:1.3,textTransform:"uppercase",fontWeight:800,marginBottom:4}}>Level {habitLevel}</div>
                  <div style={{fontSize:26,fontWeight:900,marginBottom:8}}>{habitXP} XP</div>
                  <div style={{height:8,borderRadius:99,background:"rgba(255,255,255,.18)",overflow:"hidden"}}>
                    <div style={{width:`${habitLevelPct}%`,height:"100%",borderRadius:99,background:"white",transition:"width .45s ease"}}/>
                  </div>
                  <div style={{fontSize:10,opacity:.72,marginTop:6}}>{120-(habitXP%120)} XP menuju level berikutnya</div>
                </div>
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:18}}>
              {[
                {l:"Hari ini",v:`${habitDoneToday}/${habitTotalToday||0}`,sub:"habit selesai",c:T.accent,bg:T.accentBg},
                {l:"Perfect streak",v:`${perfectDayStreak} hari`,sub:"semua habit beres",c:T.ok,bg:T.okBg},
                {l:"Best streak",v:`${habitBestAll} hari`,sub:"rekor terbaik",c:T.info,bg:T.infoBg},
                {l:"Total clear",v:habitTotalDone,sub:"check sepanjang waktu",c:T.warn,bg:T.warnBg},
              ].map(x=><div key={x.l} style={{background:x.bg,border:`1px solid ${x.c}22`,borderRadius:14,padding:"14px 16px"}}>
                <div style={{fontSize:9,color:T.muted,fontWeight:900,letterSpacing:1.1,textTransform:"uppercase",marginBottom:6}}>{x.l}</div>
                <div style={{fontSize:18,fontWeight:900,color:x.c,marginBottom:2}}>{x.v}</div>
                <div style={{fontSize:10,color:T.muted}}>{x.sub}</div>
              </div>)}
            </div>

            {habitTotalToday>0&&<div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1.45fr .85fr",gap:14,marginBottom:18}}>
              <Card ch={<>
                <Sec t={`Habit Graphic ${habitAnalytics.monthName}`} sub="Visual bulanan seperti tracker: baris habit, kolom tanggal, dan grafik konsistensi harian."/>
                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)",gap:8,marginBottom:12}}>
                  {[
                    ["Habit aktif",habitTotalToday,T.accent,T.accentBg],
                    ["Completed",habitAnalytics.monthDone,T.ok,T.okBg],
                    ["Progress",`${Math.round(habitAnalytics.monthPct)}%`,T.info,T.infoBg],
                  ].map(([label,value,color,bg])=><div key={label} style={{background:bg,border:`1px solid ${T.border}`,borderRadius:12,padding:"10px 12px"}}>
                    <div style={{fontSize:9,color:T.muted,fontWeight:900,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>{label}</div>
                    <div style={{fontSize:17,fontWeight:950,color}}>{value}</div>
                  </div>)}
                </div>
                <div style={{overflowX:"auto",border:`1px solid ${T.border}`,borderRadius:14,background:T.cardAlt,padding:10,marginBottom:12}}>
                  <div style={{minWidth:Math.max(620,150+habitAnalytics.monthDays.length*30),display:"grid",gridTemplateColumns:`150px repeat(${habitAnalytics.monthDays.length}, 30px)`,gap:5,alignItems:"center"}}>
                    <div style={{fontSize:10,color:T.accent,fontWeight:900,letterSpacing:1,textTransform:"uppercase"}}>My Habits</div>
                    {habitAnalytics.monthDays.map(day=><div key={day} style={{fontSize:9,color:day===habitDay?T.accent:T.muted,fontWeight:900,textAlign:"center",padding:"5px 0",borderRadius:8,background:day===habitDay?T.accentBg:"transparent"}}>{Number(day.slice(-2))}</div>)}
                    {habitAnalytics.habitRows.map(h=><React.Fragment key={h.id}>
                      <div style={{display:"flex",alignItems:"center",gap:7,minWidth:0,fontSize:11,fontWeight:900,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",padding:"6px 8px",borderRadius:10,background:T.card,border:`1px solid ${T.border}`}}>
                        <span>{h.icon||"🐾"}</span><span style={{overflow:"hidden",textOverflow:"ellipsis"}}>{h.nama}</span>
                      </div>
                      {habitAnalytics.monthDays.map(day=>{
                        const checked=(h.doneDates||[]).includes(day);
                        return <button key={`${h.id}-${day}`} onClick={()=>day===habitDay&&toggleHabit(h.id)} disabled={day!==habitDay} title={`${h.nama} · ${day}`} style={{width:26,height:26,borderRadius:8,border:`1.5px solid ${checked?T.okBorder:T.border}`,background:checked?T.okBg:T.card,color:checked?T.ok:T.muted,cursor:day===habitDay?"pointer":"default",fontWeight:950,fontSize:12,fontFamily:"inherit",padding:0}}>
                          {checked?"✓":"·"}
                        </button>;
                      })}
                    </React.Fragment>)}
                  </div>
                </div>
                <div style={{height:120,borderRadius:14,background:T.cardAlt,border:`1px solid ${T.border}`,padding:10,overflow:"hidden"}}>
                  {(()=>{
                    const len=Math.max(habitAnalytics.daily.length-1,1);
                    const pts=habitAnalytics.daily.map((d,i)=>`${(i/len*100).toFixed(2)},${(100-d.pct).toFixed(2)}`).join(" ");
                    return <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{width:"100%",height:"100%",display:"block"}}>
                      <polygon points={`0,100 ${pts} 100,100`} fill={T.accent} opacity=".16"/>
                      <polyline points={pts} fill="none" stroke={T.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>;
                  })()}
                </div>
              </>}/>
              <div style={{display:"grid",gap:14,alignContent:"start"}}>
                <Card ch={<>
                  <Sec t="Analysis" sub="Habit mana yang paling kuat bulan ini."/>
                  <div style={{display:"grid",gap:9}}>
                    {habitAnalytics.habitRows.slice(0,7).map(h=><div key={h.id} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,alignItems:"center"}}>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:900,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.icon||"🐾"} {h.nama}</div>
                        <div style={{height:8,borderRadius:99,background:T.cardAlt,border:`1px solid ${T.border}`,overflow:"hidden",marginTop:5}}>
                          <div style={{width:`${Math.min(h.monthPct,100)}%`,height:"100%",background:h.monthPct>=80?T.ok:h.monthPct>=50?T.accent:T.warn,borderRadius:99}}/>
                        </div>
                      </div>
                      <div style={{fontSize:12,fontWeight:950,color:h.monthPct>=80?T.ok:h.monthPct>=50?T.accent:T.warn}}>{Math.round(h.monthPct)}%</div>
                    </div>)}
                  </div>
                </>}/>
                <Card ch={<>
                  <Sec t="Yearly Habit Dashboard" sub={`Ringkasan habit ${habitAnalytics.year}`}/>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                    {[
                      ["Year progress",`${Math.round(habitAnalytics.yearPct)}%`,T.accent,T.accentBg],
                      ["Best month",habitAnalytics.bestMonth?.label||"-",T.ok,T.okBg],
                    ].map(([label,value,color,bg])=><div key={label} style={{background:bg,border:`1px solid ${T.border}`,borderRadius:12,padding:"10px 11px"}}>
                      <div style={{fontSize:9,color:T.muted,fontWeight:900,letterSpacing:.8,textTransform:"uppercase",marginBottom:4}}>{label}</div>
                      <div style={{fontSize:16,fontWeight:950,color}}>{value}</div>
                    </div>)}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(12,1fr)",gap:5,alignItems:"end",height:96,marginBottom:10}}>
                    {habitAnalytics.yearMonths.map(m=><div key={m.label} title={`${m.full}: ${Math.round(m.pct)}%`} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,height:"100%",justifyContent:"flex-end"}}>
                      <div style={{width:"100%",minHeight:4,height:`${Math.max(4,m.pct*.82)}%`,borderRadius:"7px 7px 3px 3px",background:m.pct>=80?T.ok:m.pct>=50?T.accent:m.pct>0?T.warn:T.border,transition:"height .4s ease"}}/>
                      <span style={{fontSize:8,color:T.muted,fontWeight:800}}>{m.label}</span>
                    </div>)}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:5}}>
                    {habitAnalytics.weekday.map(d=><div key={d.label} style={{textAlign:"center",padding:"7px 4px",borderRadius:10,background:d.pct>=80?T.okBg:d.pct>=50?T.accentBg:T.cardAlt,border:`1px solid ${T.border}`}}>
                      <div style={{fontSize:9,color:T.muted,fontWeight:900}}>{d.label}</div>
                      <div style={{fontSize:11,color:d.pct>=80?T.ok:d.pct>=50?T.accent:T.warn,fontWeight:950}}>{Math.round(d.pct)}%</div>
                    </div>)}
                  </div>
                </>}/>
              </div>
            </div>}

            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1.25fr .75fr",gap:14,marginBottom:18}}>
              <div className="premium-panel" style={{background:T.card,border:`1.5px solid ${T.border}`,borderRadius:16,padding:"16px 18px",boxShadow:T.shadow}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",marginBottom:12}}>
                  <div>
                    <div style={{fontSize:10,color:T.accent,fontWeight:900,letterSpacing:1.2,textTransform:"uppercase",marginBottom:4}}>Daily chest</div>
                    <div style={{fontSize:16,fontWeight:900,color:T.text}}>Hadiah hari ini</div>
                    <div style={{fontSize:12,color:T.muted,marginTop:3}}>Selesaikan semua quest hari ini untuk menjaga perfect streak.</div>
                  </div>
                  <div style={{fontSize:38,filter:habitTotalToday&&habitDoneToday===habitTotalToday?"none":"grayscale(.55)",opacity:habitTotalToday?1:.55}}>🎁</div>
                </div>
                <PBar pct={habitTodayPct} c={habitTodayPct>=100?T.ok:T.accent} h={10}/>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.muted,fontWeight:800,marginTop:8}}>
                  <span>{habitDoneToday} quest clear</span>
                  <span>{habitTotalToday&&habitDoneToday===habitTotalToday?"Chest terbuka!":"Butuh semua quest"}</span>
                </div>
              </div>
              <div style={{background:T.accentBg,border:`1.5px solid ${T.border}`,borderRadius:16,padding:"16px 18px",boxShadow:T.shadow}}>
                <div style={{fontSize:10,color:T.accent,fontWeight:900,letterSpacing:1.2,textTransform:"uppercase",marginBottom:5}}>Combo</div>
                <div style={{fontSize:28,fontWeight:900,color:T.accent,marginBottom:3}}>x{Math.max(1,Math.min(5,perfectDayStreak+1))}</div>
                <div style={{fontSize:12,color:T.muted,lineHeight:1.55}}>Semakin panjang perfect streak, semakin terasa progress game harianmu.</div>
              </div>
            </div>

            <Card ch={<>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:14,flexWrap:"wrap"}}>
                <div>
                  <div style={{fontSize:16,fontWeight:900,color:T.text}}>Quest hari ini</div>
                  <div style={{fontSize:12,color:T.muted,marginTop:2}}>Progress harian reset otomatis besok. Streak tetap hidup kalau kamu konsisten.</div>
                </div>
                <div style={{minWidth:isMobile?"100%":220}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,fontWeight:800,color:T.accent,marginBottom:5}}>
                    <span>Daily progress</span><span>{Math.round(habitTodayPct)}%</span>
                  </div>
                  <PBar pct={habitTodayPct} c={T.accent} h={9}/>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1.2fr .9fr auto auto",gap:10,alignItems:"center"}}>
                <input value={habitForm.nama} onChange={e=>setHabitForm(f=>({...f,nama:e.target.value}))} placeholder="Nama habit, contoh: Catat transaksi malam" style={IS}/>
                <input value={habitForm.target} onChange={e=>setHabitForm(f=>({...f,target:e.target.value}))} placeholder="Target, contoh: 5 menit" style={IS}/>
                <Btn onClick={addHabit} ch="Tambah quest" style={{padding:"10px 16px",whiteSpace:"nowrap"}}/>
                <Btn onClick={addHabitPresets} ch="Starter uang" c={T.ok} outline style={{padding:"10px 14px",whiteSpace:"nowrap"}}/>
              </div>
              <div style={{marginTop:12}}>
                <div style={{fontSize:10,color:T.muted,fontWeight:900,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Pilih ikon quest</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {["🧾","💧","🏃","📚","🧘","💰","🍽️","😴","🐾","🔥","⭐","🎯"].map(i=><button key={i} onClick={()=>setHabitForm(f=>({...f,icon:i}))} className="icon-action" style={{width:40,height:40,borderRadius:12,border:`2px solid ${habitForm.icon===i?T.accent:T.border}`,background:habitForm.icon===i?T.accentBg:T.cardAlt,cursor:"pointer",fontSize:21,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit"}}>{i}</button>)}
                </div>
              </div>
            </>} style={{marginBottom:18}}/>

            {habitTotalToday===0&&<LaunchEmpty
              icon="🐾"
              title="Belum ada habit harian"
              desc="Mulai dari rutinitas kecil dulu. Habit yang cocok untuk AturDuitku: catat pengeluaran, cek saldo, minum air, baca 5 menit, atau review budget."
              actionLabel="Buat habit pertama"
              onAction={()=>addHabit()}
              secondaryLabel="Pakai starter"
              onSecondary={addHabitPresets}
              style={{marginBottom:18}}
            />}

            {habitTotalToday>0&&<Card ch={<>
              <Sec t="Kalender quest" sub="Cek progres 7 hari terakhir. Kotak hijau berarti quest selesai di hari itu."/>
              <div style={{overflowX:"auto",paddingBottom:2}}>
                <div style={{minWidth:isMobile?520:"auto"}}>
                  <div style={{display:"grid",gridTemplateColumns:"minmax(150px,1.3fr) repeat(7, minmax(46px,1fr))",gap:7,alignItems:"center",marginBottom:8}}>
                    <div/>
                    {Array.from({length:7},(_,i)=>dateAdd(habitDay,i-6)).map(day=>{
                      const d=new Date(`${day}T00:00:00`);
                      return <div key={day} style={{textAlign:"center",fontSize:10,fontWeight:900,color:day===habitDay?T.accent:T.muted,background:day===habitDay?T.accentBg:"transparent",borderRadius:10,padding:"7px 4px"}}>
                        <div>{DAYS_SHORT[d.getDay()]}</div>
                        <div style={{fontSize:13,color:day===habitDay?T.accent:T.text}}>{d.getDate()}</div>
                      </div>;
                    })}
                  </div>
                  {activeHabits.map(h=>(
                    <div key={h.id} style={{display:"grid",gridTemplateColumns:"minmax(150px,1.3fr) repeat(7, minmax(46px,1fr))",gap:7,alignItems:"center",marginBottom:7}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0,padding:"8px 10px",borderRadius:11,background:T.cardAlt,border:`1px solid ${T.border}`}}>
                        <span style={{fontSize:18}}>{h.icon||"🐾"}</span>
                        <span style={{fontSize:12,fontWeight:900,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.nama}</span>
                      </div>
                      {Array.from({length:7},(_,i)=>dateAdd(habitDay,i-6)).map(day=>{
                        const checked=habitDone(h,day);
                        return <button key={day} onClick={()=>day===habitDay&&toggleHabit(h.id)} disabled={day!==habitDay} title={checked?"Selesai":"Belum selesai"} style={{height:38,borderRadius:12,border:`1.5px solid ${checked?T.okBorder:T.border}`,background:checked?T.okBg:T.cardAlt,color:checked?T.ok:T.muted,cursor:day===habitDay?"pointer":"default",fontSize:16,fontWeight:900,fontFamily:"inherit",opacity:day===habitDay?1:.86}}>
                          {checked?"✓":"·"}
                        </button>;
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </>} style={{marginBottom:18}}/>}

            {habitOpenToday.length>0&&<>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"2px 0 10px"}}>
                <div style={{fontSize:11,color:T.accent,fontWeight:900,letterSpacing:1.3,textTransform:"uppercase"}}>Quest belum selesai</div>
                <div style={{fontSize:11,color:T.muted,fontWeight:800}}>{habitOpenToday.length} tersisa</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14,marginBottom:18}}>
                {habitOpenToday.map(renderHabitCard)}
              </div>
            </>}

            {habitCompletedToday.length>0&&<>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"2px 0 10px"}}>
                <div style={{fontSize:11,color:T.ok,fontWeight:900,letterSpacing:1.3,textTransform:"uppercase"}}>Selesai hari ini</div>
                <div style={{fontSize:11,color:T.muted,fontWeight:800}}>Besok muncul lagi sebagai quest baru</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14,marginBottom:18}}>
                {habitCompletedToday.map(renderHabitCard)}
              </div>
            </>}

            {habitTotalToday>0&&<Card ch={<>
              <Sec t="Reward board" sub="Gamifikasi kecil supaya user punya alasan balik setiap hari"/>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)",gap:10}}>
                {[
                  {icon:"🐣",t:"Pemula konsisten",d:"Selesaikan 3 habit total",ok:habitTotalDone>=3},
                  {icon:"🔥",t:"Streak keeper",d:"Jaga streak 3 hari",ok:habitBestAll>=3},
                  {icon:"👑",t:"Perfect week",d:"7 perfect day berturut-turut",ok:perfectDayStreak>=7},
                ].map(b=><div key={b.t} style={{display:"flex",gap:10,alignItems:"center",padding:"12px 13px",borderRadius:13,border:`1px solid ${b.ok?T.okBorder:T.border}`,background:b.ok?T.okBg:T.cardAlt}}>
                  <span style={{fontSize:24,filter:b.ok?"none":"grayscale(1)",opacity:b.ok?1:.55}}>{b.icon}</span>
                  <span><span style={{display:"block",fontSize:12,fontWeight:900,color:b.ok?T.ok:T.text}}>{b.t}</span><span style={{display:"block",fontSize:10,color:T.muted}}>{b.d}</span></span>
                </div>)}
              </div>
            </>} />}
          </>}

          {/* ══════════════════════════════════════════════════════════
              ASET
          ══════════════════════════════════════════════════════════ */}
          {page==="aset"&&<>
            <div style={{background:T.hero,borderRadius:16,padding:"22px 28px",marginBottom:20,color:"white"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
                <div>
                  <div style={{fontSize:10,opacity:.6,letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>{lang==="en"?"Total Net Worth":t("assetHero")+" Bersih (Net Worth)"}</div>
                  <div style={{fontSize:30,fontWeight:900,marginBottom:8}}>{IDR(totalAset)}</div>
                  <div style={{display:"flex",gap:10,fontSize:12,flexWrap:"wrap"}}>
                    <div style={{background:"rgba(255,255,255,.12)",borderRadius:8,padding:"6px 12px"}}>{t("assetLiquid")}: {IDRs(totalSaldo)}</div>
                    <div style={{background:"rgba(255,255,255,.12)",borderRadius:8,padding:"6px 12px"}}>Aset Tetap: {IDRs(s.asetTetap.reduce((a,b)=>a+N(b.nilai),0))}</div>
                    <div style={{background:"rgba(255,255,255,.12)",borderRadius:8,padding:"6px 12px"}}>{t("assetDebt")}: -{IDRs(totalUtangAktif)}</div>
                  </div>
                </div>
                <div style={{textAlign:"center",background:"rgba(0,0,0,.2)",borderRadius:12,padding:"14px 20px"}}>
                  <CircleGauge value={skorTotal} c={getC(skorTotal)} label="SKOR"/>
                  <div style={{fontSize:12,fontWeight:700,color:getC(skorTotal),marginTop:6}}>{getLabel(skorTotal)}</div>
                </div>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:18}}>
              <Card ch={<>
                <Sec t={t("walletSection")} right={<button onClick={()=>setPage("dompet")} style={{fontSize:11,color:T.accent,background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Kelola →</button>}/>
                {s.dompet.map(d=>(
                  <div key={d.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${T.borderLight}`}}>
                    <div style={{display:"flex",gap:10,alignItems:"center",minWidth:0}}><span style={{fontSize:20}}>{uiIcon(d.icon)}</span><div><div style={{fontSize:13,fontWeight:600,color:T.text}}>{d.nama}</div><div style={{fontSize:11,color:T.muted}}>{d.tipe}</div></div></div>
                    <span style={{fontWeight:700,color:T.text}}><MV v={IDR(N(d.saldo))}/></span>
                  </div>
                ))}
                <div style={{marginTop:12,background:T.okBg,borderRadius:9,padding:"10px 14px",border:`1px solid ${T.okBorder}`}}>
                  <div style={{fontSize:10,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:2}}>{t("liquidAssets")}</div>
                  <div style={{fontWeight:800,color:T.ok,fontSize:16}}><MV v={IDR(totalSaldo)}/></div>
                </div>
              </>}/>
              <Card ch={<>
                <Sec t={t("assetSection")}/>
                {s.asetTetap.map(a=>(
                  <div key={a.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${T.borderLight}`}}>
                    <div><div style={{fontSize:13,fontWeight:600,color:T.text}}>{a.nama}</div>{a.ket&&<div style={{fontSize:11,color:T.muted}}>{a.ket}</div>}</div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{fontWeight:700,color:T.text}}>{IDR(N(a.nilai))}</span>
                      <Del onClick={()=>confirmDelete({title:"Hapus aset?",msg:`Aset "${a.nama}" akan dihapus dari ringkasan kekayaanmu.`,toastMsg:"Aset dihapus",onConfirm:()=>setS(p=>({...p,asetTetap:p.asetTetap.filter(x=>x.id!==a.id)}))})}/>
                    </div>
                  </div>
                ))}
                {!s.asetTetap.length&&<LaunchEmpty
                  icon="💎"
                  title="Belum ada aset tetap"
                  desc="Catat aset seperti rumah, kendaraan, emas, atau laptop kerja supaya net worth kamu terlihat lebih utuh."
                  actionLabel="Tambah aset pertama"
                  onAction={()=>setModal({type:"aset"})}
                  style={{padding:"24px 16px",marginTop:6}}
                />}
                <div style={{marginTop:10}}><Btn onClick={()=>setModal({type:"aset"})} ch={"+ "+t("aset")} c={T.accent} outline style={{padding:"8px 14px",fontSize:12}}/></div>
              </>}/>
            </div>
          </>}

          {/* ══════════════════════════════════════════════════════════
              UTANG
          ══════════════════════════════════════════════════════════ */}
          {page==="utang"&&<>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:20,marginBottom:20}}>
              <Card ch={<>
                <Sec t={t("debtTitle")}/>
                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)",gap:6,marginBottom:12}}>
                  {[{v:"utang",l:t("debtType_utang")},{v:"piutang",l:t("debtType_piutang")},{v:"piutangBisnis",l:t("debtType_biz")}].map(({v,l})=>(
                    <button key={v} onClick={()=>setUtForm(f=>({...f,tipe:v}))} style={{padding:"9px 6px",borderRadius:8,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit",border:`2px solid ${utForm.tipe===v?T.accent:T.inputBorder}`,background:utForm.tipe===v?T.accentBg:T.input,color:utForm.tipe===v?T.accent:T.sub}}>{l}</button>
                  ))}
                </div>
                <label style={LS}>Penyedia / Jenis</label>
                <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:10}}>
                  {DEBT_PROVIDER_OPTIONS.map(provider=>{
                    const active=utForm.provider===provider;
                    return <button key={provider} onClick={()=>setUtForm(f=>{
                      const isKnownName=DEBT_PROVIDER_OPTIONS.includes(f.nama);
                      const nextName=provider==="Lainnya"?(isKnownName?"":f.nama):(f.nama&&!isKnownName?f.nama:provider);
                      return {...f,provider,nama:nextName};
                    })} style={{padding:"7px 10px",borderRadius:999,border:`1.5px solid ${active?T.accent:T.border}`,background:active?T.accentBg:T.cardAlt,color:active?T.accent:T.sub,fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit",touchAction:"manipulation"}}>{provider}</button>;
                  })}
                </div>
                <label style={LS}>{t("date")}</label><input type="date" value={utForm.tgl} onChange={e=>setUtForm(f=>({...f,tgl:e.target.value}))} style={{...IS,marginBottom:10}}/>
                <label style={LS}>{utForm.tipe==="utang"?"Nama utang / detail":t("debtor")}</label><input placeholder={utForm.provider&&utForm.provider!=="Lainnya"?`${utForm.provider} - contoh: cicilan HP`:"Contoh: Shopee PayLater cicilan HP, pinjam teman, kartu kredit"} value={utForm.nama} onChange={e=>setUtForm(f=>({...f,nama:e.target.value,provider:DEBT_PROVIDER_OPTIONS.includes(e.target.value)?e.target.value:f.provider}))} style={{...IS,marginBottom:10}}/>
                <label style={LS}>{t("amount")} (Rp)</label>
                <div style={{position:"relative",marginBottom:10}}>
                  <CurIn value={utForm.jml} onChange={v=>setUtForm(f=>({...f,jml:v}))} placeholder="0" style={{paddingRight:40}}/>
                  <button onClick={()=>openCalc("utjml",utForm.jml,v=>setUtForm(f=>({...f,jml:v})))} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:12,fontWeight:800,color:T.accent}} title="Kalkulator" aria-label="Kalkulator">🧮</button>
                </div>
                <label style={LS}>Jatuh Tempo</label><input type="date" value={utForm.tempo} onChange={e=>setUtForm(f=>({...f,tempo:e.target.value}))} style={{...IS,marginBottom:10}}/>
                <label style={LS}>Keterangan</label><input placeholder={t("ketOpsional")} value={utForm.ket} onChange={e=>setUtForm(f=>({...f,ket:e.target.value}))} style={{...IS,marginBottom:14}}/>
                <Btn onClick={addUt} ch={t("saveNote")} style={{width:"100%",padding:11}}/>
              </>}/>
              <div style={{display:"grid",gap:14,alignContent:"start"}}>
                {[{l:t("debtActive"),v:IDR(totalUtangAktif),vc:T.err,bg:T.errBg},{l:t("recvActive"),v:IDR(totalPiutang),vc:T.ok,bg:T.okBg},{l:"Sudah Lunas",v:s.utang.filter(u=>u.lunas).length+" item",vc:T.accent,bg:T.accentBg}].map(x=>(
                  <div key={x.l} style={{background:x.bg,borderRadius:12,padding:"14px 18px",transition:"background .3s"}}>
                    <div style={{fontSize:9,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:5}}>{x.l}</div>
                    <div style={{fontWeight:800,fontSize:17,color:x.vc}}>{x.v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:18,marginBottom:20}}>
              <Card ch={<>
                <Sec t="PayLater Health" sub="Pantau risiko cicilan digital, kartu kredit, dan pinjaman konsumtif."/>
                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"auto 1fr",gap:14,alignItems:"center",marginBottom:14}}>
                  <div style={{width:96,height:96,borderRadius:"50%",background:paylaterHealth.score>=80?T.okBg:paylaterHealth.score>=60?T.infoBg:paylaterHealth.score>=40?T.warnBg:T.errBg,border:`1.5px solid ${paylaterHealth.score>=80?T.okBorder:paylaterHealth.score>=60?T.infoBorder:paylaterHealth.score>=40?T.warnBorder:T.errBorder}`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:T.shadow}}>
                    <div style={{textAlign:"center"}}>
                      <div style={{fontSize:26,fontWeight:900,color:paylaterHealth.score>=80?T.ok:paylaterHealth.score>=60?T.info:paylaterHealth.score>=40?T.warn:T.err}}>{paylaterHealth.score}</div>
                      <div style={{fontSize:9,color:T.muted,fontWeight:800,letterSpacing:1}}>SCORE</div>
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize:20,fontWeight:900,color:paylaterHealth.score>=80?T.ok:paylaterHealth.score>=60?T.info:paylaterHealth.score>=40?T.warn:T.err,marginBottom:4}}>{paylaterHealth.label}</div>
                    <div style={{fontSize:12,color:T.muted,lineHeight:1.6,marginBottom:10}}>
                      {paylaterHealth.list.length
                        ? `Total cicilan/paylater aktif ${IDR(paylaterHealth.total)}. ${paylaterHealth.nearest?`Tempo terdekat: ${paylaterHealth.nearest.nama} (${paylaterHealth.nearest.tempo}).`:""}`
                        : "Belum ada PayLater atau kartu kredit aktif. Bagus, risiko cicilan konsumtif masih rendah."}
                    </div>
                    <PBar pct={paylaterHealth.score} c={paylaterHealth.score>=80?T.ok:paylaterHealth.score>=60?T.info:paylaterHealth.score>=40?T.warn:T.err} h={8}/>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
                  {[
                    ["Total",IDRs(paylaterHealth.total),T.err,T.errBg],
                    ["Jatuh tempo 7 hari",paylaterHealth.dueSoon,T.warn,T.warnBg],
                    ["Terlambat",paylaterHealth.overdue,T.err,T.errBg],
                  ].map(([label,value,color,bg])=><div key={label} style={{background:bg,border:`1px solid ${T.border}`,borderRadius:12,padding:"10px 11px"}}>
                    <div style={{fontSize:9,color:T.muted,fontWeight:900,letterSpacing:.8,textTransform:"uppercase",marginBottom:4}}>{label}</div>
                    <div style={{fontSize:13,fontWeight:900,color}}>{value}</div>
                  </div>)}
                </div>
                {paylaterHealth.list.length>0?<div style={{display:"grid",gap:8}}>
                  {paylaterHealth.list.slice(0,4).map(u=><div key={u.id} style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",padding:"9px 10px",borderRadius:11,background:T.cardAlt,border:`1px solid ${T.border}`}}>
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:900,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.nama}</div>
                      <div style={{fontSize:10,color:T.muted}}>{u.provider||"PayLater"}{u.tempo?` · tempo ${u.tempo}`:""}</div>
                    </div>
                    <div style={{fontSize:12,fontWeight:900,color:T.err,whiteSpace:"nowrap"}}>{IDRs(u.sisa)}</div>
                  </div>)}
                </div>:<div style={{padding:"14px 12px",borderRadius:12,background:T.okBg,border:`1px solid ${T.okBorder}`,fontSize:12,color:T.ok,fontWeight:800,textAlign:"center"}}>Tidak ada cicilan PayLater aktif.</div>}
              </>}/>
              <Card ch={<>
                <Sec t="Kalender Tagihan" sub="Utang, PayLater, subbudget bertempo, dan transaksi rutin terdekat."/>
                {billCalendar.length?<div style={{display:"grid",gap:9}}>
                  {billCalendar.slice(0,8).map(item=>{
                    const urgent=item.days<0||item.days<=3;
                    const soon=item.days>=0&&item.days<=7;
                    return <div key={item.id} style={{display:"grid",gridTemplateColumns:"auto 1fr auto",gap:10,alignItems:"center",padding:"10px 11px",borderRadius:13,background:urgent?T.errBg:soon?T.warnBg:T.cardAlt,border:`1px solid ${urgent?T.errBorder:soon?T.warnBorder:T.border}`}}>
                      <div style={{width:38,height:38,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,background:T.card,border:`1px solid ${T.border}`}}>{item.icon}</div>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:900,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.title}</div>
                        <div style={{fontSize:10,color:T.muted}}>{item.type} · {item.date}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:11,fontWeight:900,color:urgent?T.err:soon?T.warn:T.accent}}>{item.days<0?`${Math.abs(item.days)} hari lewat`:item.days===0?"Hari ini":`${item.days} hari`}</div>
                        <div style={{fontSize:11,fontWeight:800,color:T.text}}>{item.amount?IDRs(item.amount):"-"}</div>
                      </div>
                    </div>;
                  })}
                </div>:<LaunchEmpty
                  icon="🔔"
                  title="Belum ada jadwal tagihan"
                  desc="Tambahkan jatuh tempo utang, subbudget tagihan, atau transaksi rutin supaya kalender mulai mengingatkan."
                  actionLabel="Tambah utang"
                  onAction={()=>setUtForm(f=>({...f,tipe:"utang"}))}
                  secondaryLabel="Buka budget"
                  onSecondary={()=>setPage("budget")}
                  style={{padding:"26px 16px"}}
                />}
              </>}/>
            </div>
            {["utang","piutang","piutangBisnis"].map(tipe=>{
              const list=s.utang.filter(u=>u.tipe===tipe&&!u.lunas);
              if(!list.length)return null;
              return <div key={tipe} style={{marginBottom:14}}>
                <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:2,marginBottom:8}}>{tipe==="utang"?"Utang Aktif":tipe==="piutangBisnis"?"Piutang Bisnis":"Piutang Aktif"}</div>
                {list.map(u=><UtangCard key={u.id} u={u} dompetList={s.dompet} onDelete={()=>confirmDelete({title:"Hapus catatan utang/piutang?",msg:`Catatan "${u.nama}" beserta riwayat cicilannya akan dihapus.`,toastMsg:"Catatan dihapus",onConfirm:()=>setS(p=>({...p,utang:p.utang.filter(x=>x.id!==u.id)}))})} onCicilan={catatCicilan}/>)}
              </div>;
            })}
            {s.utang.filter(u=>u.lunas).length>0&&<div>
              <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:2,marginBottom:8}}>✓ Sudah Lunas</div>
              {s.utang.filter(u=>u.lunas).map(u=><UtangCard key={u.id} u={u} dompetList={s.dompet} onDelete={()=>confirmDelete({title:"Hapus catatan lunas?",msg:`Riwayat "${u.nama}" akan dihapus dari daftar utang/piutang lunas.`,toastMsg:"Catatan lunas dihapus",onConfirm:()=>setS(p=>({...p,utang:p.utang.filter(x=>x.id!==u.id)}))})} onCicilan={catatCicilan}/>)}
            </div>}
            {!s.utang.length&&<Card ch={<div style={{textAlign:"center",padding:40,color:T.muted}}>{t("noDebt")} 🙌</div>}/>}
          </>}

          {/* ══════════════════════════════════════════════════════════
              LAPORAN
          ══════════════════════════════════════════════════════════ */}
          {page==="laporan"&&<>
            
            <div style={{marginBottom:18, display:"flex", justifyContent:"flex-end", gap:8, flexWrap:"wrap"}}>
              <Btn onClick={()=>setModal({type:"yearReview"})} ch={t("yearReviewBtn")} c={T.accentSoft} outline style={{padding:"7px 14px",fontSize:12}}/>
              <Btn onClick={()=>setModal({type:"kalkulator"})} ch={t("loanCalc")} c={T.accentSoft} outline style={{padding:"7px 14px",fontSize:12}}/>
              <Btn onClick={exportCSV} ch={t("exportCSV")} c="#16A34A" outline style={{padding:"7px 14px",fontSize:12}}/>
              <Btn onClick={exportSheets} ch={t("exportSheets")} c="#0F9D58" style={{padding:"7px 14px",fontSize:12}}/>
              <Btn onClick={exportPDF} ch={t("exportPDF")} c="#5B21B6" style={{padding:"7px 14px",fontSize:12}}/>
            </div>

            <Card ch={<div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"auto 1fr auto",gap:14,alignItems:"center"}}>
              <img src="/icon-192.png" alt="" style={{width:54,height:54,borderRadius:17,objectFit:"cover",boxShadow:`0 12px 28px ${T.accentPop}`,flexShrink:0}}/>
              <div style={{minWidth:0}}>
                <div style={{fontSize:10,color:T.accent,fontWeight:900,letterSpacing:1.2,textTransform:"uppercase",marginBottom:4}}>Ringkasan manusiawi</div>
                <div style={{fontSize:17,fontWeight:950,color:T.text,letterSpacing:-.25,marginBottom:5}}>{reportNarrative.title}</div>
                <div style={{fontSize:12,color:T.muted,lineHeight:1.65,maxWidth:760}}>{reportNarrative.body}</div>
                <div style={{display:"grid",gap:7,marginTop:12}}>
                  {reportNarrative.points.map((point,i)=><div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",fontSize:11,color:T.sub,lineHeight:1.5}}>
                    <span style={{width:20,height:20,borderRadius:999,display:"inline-flex",alignItems:"center",justifyContent:"center",background:reportNarrative.tone==="danger"?T.errBg:reportNarrative.tone==="good"?T.okBg:T.warnBg,color:reportNarrative.tone==="danger"?T.err:reportNarrative.tone==="good"?T.ok:T.warn,fontSize:10,fontWeight:900,flexShrink:0}}>{i+1}</span>
                    <span>{point}</span>
                  </div>)}
                </div>
              </div>
              <Btn onClick={()=>{setAiOpen(true);setTimeout(()=>handleAiSend("Jelaskan laporan bulan ini dengan bahasa yang sederhana dan beri 3 langkah terbaik untuk saya"),0);}} ch="Tanya Dokter" c={reportNarrative.tone==="danger"?T.err:reportNarrative.tone==="good"?T.ok:T.accent} style={{padding:"10px 14px",fontSize:12,width:isMobile?"100%":"auto"}}/>
            </div>} style={{marginBottom:18,padding:isMobile?14:"16px 18px"}}/>

            {/* Komparasi Bulanan */}
            <KomparasiBulanan txs={s.txs} budgets={s.budgets} T={T} isMobile={isMobile}/>

            <Card ch={<>
              <Sec t={t("healthScore")} sub="Dihitung dari rasio tabungan, disiplin anggaran, dan dana darurat"/>
              <div style={{display:"flex",gap:24,alignItems:"center",flexWrap:"wrap"}}>
                <CircleGauge value={skorTotal} c={getC(skorTotal)} label="SKOR" size={120}/>
                <div style={{flex:1,minWidth:200}}>
                  <div style={{fontSize:20,fontWeight:900,color:getC(skorTotal),marginBottom:4}}>{getLabel(skorTotal)}</div>
                  <div style={{fontSize:12,color:T.sub,marginBottom:14}}>{t("monthlyScore")} {s.bulan} {s.tahun}</div>
                  {[{l:t("savingRatioLabel"),v:skorTabungan,c:"#22C55E",hint:`${PCT(savRate)} dari ideal 20%`},{l:"Disiplin Anggaran",v:skorDisiplin,c:T.accent,hint:`${totalBudget>0?PCT(totalOut/totalBudget*100):"N/A"} terpakai dari budget`},{l:"Keamanan & Runway",v:skorRunway,c:"#F59E0B",hint:`${runwayReal} bulan dari ideal 6`}].map(x=>(
                    <div key={x.l} style={{marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                        <span style={{fontSize:12,color:T.text,fontWeight:600}}>{x.l}</span>
                        <span style={{fontSize:11,color:x.c,fontWeight:700}}>{Math.round(x.v)}/100 <span style={{color:T.muted,fontWeight:400}}>• {x.hint}</span></span>
                      </div>
                      <PBar pct={x.v} c={x.c}/>
                    </div>
                  ))}
                </div>
              </div>
            </>} style={{marginBottom:18}}/>

            {/* Trend 6 bulan */}
            <Card ch={<>
              <Sec t={t("trend6mo")} right={
                <div style={{display:"flex",gap:10,fontSize:10}}>
                  <span style={{color:"#22C55E",fontWeight:700}}>IN</span>
                  <span style={{color:"#EF4444",fontWeight:700}}>OUT</span>
                  <span style={{color:"#6366F1",fontWeight:700}}>SAVE</span>
                </div>
              }/>
              <Suspense fallback={<ChartFallback height={isMobile?160:200}/>}>
                <TrendChartLazy trendData={trendData} isMobile={isMobile} T={T} idrs={IDRs}/>
              </Suspense>
            </>} style={{marginBottom:18}}/>

            {/* Summary */}
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:18}}>
              {[
                {l:"Yang Ditabung",v:IDR(totalTabung),sub:`Rasio: ${PCT(savRate)}`,vc:T.info,bg:T.infoBg},
                {l:"+ "+t("incomeLabel"),v:IDR(totalIn),sub:prevIn>0?`${changePct(totalIn,prevIn)>0?"+":""}${changePct(totalIn,prevIn)}% vs lalu`:null,vc:T.ok,bg:T.okBg,trend:changePct(totalIn,prevIn)},
                {l:"- "+t("expenseLabel"),v:IDR(totalOut),sub:prevOut>0?`${changePct(totalOut,prevOut)>0?"+":""}${changePct(totalOut,prevOut)}% vs lalu`:null,vc:T.err,bg:T.errBg,trend:changePct(totalOut,prevOut)},
                {l:"Net Cashflow",v:IDR(netCash),vc:netCash>=0?T.ok:T.err,bg:netCash>=0?T.okBg:T.errBg},
              ].map(x=>(
                <div key={x.l} style={{background:x.bg,borderRadius:12,padding:"14px 16px",transition:"background .3s"}}>
                  <div style={{fontSize:9,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{x.l}</div>
                  <div style={{fontWeight:800,fontSize:16,color:x.vc,marginBottom:2}}>{x.v}</div>
                  {x.sub&&<div style={{fontSize:10,color:x.trend>0?T.ok:x.trend<0?T.err:T.muted}}>{x.sub}</div>}
                </div>
              ))}
            </div>

            {/* Charts */}
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:18,marginBottom:18}}>
              <Card ch={<>
                <Sec t={t("spendDetail")}/>
                {pieData.length?<Suspense fallback={<ChartFallback height={isReportCompact?180:200}/>}>
                  <DonutChartLazy pieData={pieData} pieColors={PIE_C} T={T} idr={IDR} height={isReportCompact?180:200} outerRadius={isReportCompact?64:80} innerRadius={isReportCompact?38:40} showLabel isMobile={isReportCompact}/>
                </Suspense>:<LaunchEmpty icon="📊" title="Belum ada distribusi pengeluaran" desc="Tambahkan beberapa transaksi pengeluaran di bulan ini supaya kategori belanja, pola spending, dan insight laporan mulai terbentuk." actionLabel="Tambah transaksi" onAction={()=>setModal({type:"tx"})} secondaryLabel="Buka transaksi" onSecondary={()=>setPage("trans")} style={{padding:"28px 16px"}}/>}
              </>}/>
              <Card ch={<>
                <Sec t={t("dailyExpense")} sub={s.bulan}/>
                <Suspense fallback={<ChartFallback height={isReportCompact?180:130}/>}>
                  <DailyChartLazy txBulan={txBulan} bulan={s.bulan} tahun={s.tahun} months={MONTHS} T={T} idr={IDR} n={N} isMobile={isReportCompact}/>
                </Suspense>
              </>}/>
            </div>

            {/* Performa Anggaran */}
            <Card ch={<>
              <Sec t={t("budgetPerformance")} sub="Alokasi vs realisasi per kategori"/>
              {isReportCompact?(
                <div style={{display:"grid",gap:10}}>
                  {s.budgets.map(b=>{
                    const alloc=N(b.alokasi)+b.sub.reduce((x,y)=>x+N(y.alokasi),0);
                    const spend=spendByKat[b.id]||0;const pct=alloc>0?spend/alloc*100:0;const over=alloc>0&&spend>alloc;
                    return(
                      <div key={b.id} style={{background:T.cardAlt,border:`1px solid ${over?T.errBorder:T.border}`,borderRadius:16,padding:12,boxShadow:"0 8px 18px rgba(88,28,135,.05)",overflow:"hidden"}}>
                        <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"flex-start",marginBottom:10}}>
                          <div style={{display:"flex",gap:9,alignItems:"center",minWidth:0}}>
                            <span style={{width:34,height:34,borderRadius:12,background:T.accentBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>{uiIcon(b.icon)}</span>
                            <div style={{minWidth:0}}>
                              <div style={{fontSize:13,fontWeight:900,color:T.text,lineHeight:1.25,wordBreak:"break-word"}}>{b.kat}</div>
                              <div style={{fontSize:10,color:T.muted,marginTop:2}}>Alokasi {IDRs(alloc)}</div>
                            </div>
                          </div>
                          <Pill c={over?"red":pct>80?"yellow":"green"} ch={`${pct.toFixed(0)}%`} xs/>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                          <div style={{background:T.bg,border:`1px solid ${T.borderLight}`,borderRadius:12,padding:"9px 10px",minWidth:0}}>
                            <div style={{fontSize:9,color:T.muted,fontWeight:800,textTransform:"uppercase",letterSpacing:.8,marginBottom:3}}>Realisasi</div>
                            <div style={{fontSize:13,fontWeight:900,color:over?T.err:T.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{IDRs(spend)}</div>
                          </div>
                          <div style={{background:T.bg,border:`1px solid ${T.borderLight}`,borderRadius:12,padding:"9px 10px",minWidth:0}}>
                            <div style={{fontSize:9,color:T.muted,fontWeight:800,textTransform:"uppercase",letterSpacing:.8,marginBottom:3}}>Sisa</div>
                            <div style={{fontSize:13,fontWeight:900,color:over?T.err:T.ok,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{IDRs(Math.max(alloc-spend,0))}</div>
                          </div>
                        </div>
                        <PBar pct={Math.min(pct,100)} c={over?"#EF4444":pct>80?"#F59E0B":"#22C55E"}/>
                        <div style={{display:"flex",justifyContent:"space-between",gap:10,fontSize:10,color:T.muted,marginTop:6}}>
                          <span>Progress</span>
                          <span style={{fontWeight:800,color:over?T.err:T.muted}}>{over?"Melebihi budget":`${pct.toFixed(0)}% terpakai`}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ):<>
                <div style={{display:"grid",gridTemplateColumns:"minmax(160px,1fr) 110px 110px minmax(150px,1fr) 78px",padding:"6px 0",borderBottom:`1.5px solid ${T.border}`,marginBottom:4,gap:10}}>
                  {(lang==="en"?["Category","Allocation","Realized","Progress","% Used"]:["Kategori","Alokasi","Realisasi","Progress","% Terpakai"]).map(h=><span key={h} style={{fontSize:9,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,whiteSpace:"nowrap"}}>{h}</span>)}
                </div>
                {s.budgets.map(b=>{
                const alloc=N(b.alokasi)+b.sub.reduce((x,y)=>x+N(y.alokasi),0);
                const spend=spendByKat[b.id]||0;const pct=alloc>0?spend/alloc*100:0;const over=alloc>0&&spend>alloc;
                return(
                  <div key={b.id} style={{display:"grid",gridTemplateColumns:"minmax(160px,1fr) 110px 110px minmax(150px,1fr) 78px",padding:"9px 0",borderBottom:`1px solid ${T.borderLight}`,gap:10,alignItems:"center"}}>
                    <span style={{fontSize:12,display:"flex",gap:6,alignItems:"center",color:T.text,minWidth:0}}><span style={{flexShrink:0}}>{uiIcon(b.icon)}</span><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{b.kat}</span></span>
                    <span style={{fontSize:12,color:T.sub}}>{IDRs(alloc)}</span>
                    <span style={{fontSize:12,fontWeight:600,color:over?T.err:T.text}}>{IDRs(spend)}</span>
                    <PBar pct={Math.min(pct,100)} c={over?"#EF4444":pct>80?"#F59E0B":"#22C55E"}/>
                    <Pill c={over?"red":pct>80?"yellow":"green"} ch={`${pct.toFixed(0)}%`} xs/>
                  </div>
                );
                })}
              </>}
            </>} style={{marginBottom:18}}/>

            {/* Prediksi + Saran */}
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:18}}>
              <Card ch={<>
                <Sec t={t("prediction")}/>
                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12,marginBottom:16}}>
                  <div style={{background:T.errBg,borderRadius:10,padding:"12px 14px"}}>
                    <div style={{fontSize:9,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>{t("prediksiPengeluaran")}</div>
                    <div style={{fontWeight:800,color:T.err,fontSize:16}}>{IDR(prediksiOut)}</div>
                    <div style={{fontSize:10,color:T.muted,marginTop:2}}>Avg harian: {IDRs(dailyAvg)}</div>
                  </div>
                  <div style={{background:prediksiSisa>=0?T.okBg:T.errBg,borderRadius:10,padding:"12px 14px"}}>
                    <div style={{fontSize:9,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>{t("prediksiSisa")}</div>
                    <div style={{fontWeight:800,color:prediksiSisa>=0?T.ok:T.err,fontSize:16}}>{IDR(prediksiSisa)}</div>
                    <div style={{fontSize:10,color:T.muted,marginTop:2}}>{prediksiSisa>=0?t("predSafe"):t("predDeficit")}</div>
                  </div>
                </div>
              </>}/>
              <Card ch={<>
                <Sec t={t("tipPerCat")}/>
                {saranList.length?saranList.map((saran,i)=>(
                  <div key={i} style={{background:saran.type==="over"?T.errBg:T.warnBg,border:`1px solid ${saran.type==="over"?T.errBorder:T.warnBorder}`,borderRadius:10,padding:"10px 12px",marginBottom:8}}>
                    <div style={{fontSize:13,marginBottom:3,color:T.text}}>{uiIcon(saran.icon)} <strong>{saran.kat}</strong></div>
                    <div style={{fontSize:12,color:saran.type==="over"?T.err:T.warn}}>{saran.msg}</div>
                  </div>
                )):<div style={{background:T.okBg,border:`1px solid ${T.okBorder}`,borderRadius:10,padding:16,textAlign:"center"}}>
                  <div style={{fontSize:20,marginBottom:8}}>Aman</div>
                  <div style={{fontSize:13,fontWeight:700,color:T.ok}}>{t("allSafe")}</div>
                </div>}
              </>}/>
            </div>

            {/* Riwayat Saldo Per Bulan */}
            <Card ch={<>
              <Sec t={t("histBalance")} sub={lang==="en"?"Balance estimated from transactions":"Saldo tiap dompet diestimasi berdasarkan transaksi historis"}/>
              <div style={{overflowX:"auto",border:`1px solid ${T.border}`,borderRadius:12,background:T.cardAlt}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:isMobile?320:400}}>
                  <thead>
                    <tr style={{background:T.cardAlt}}>
                      <th style={{padding:"8px 12px",textAlign:"left",fontSize:10,color:T.muted,fontWeight:700,textTransform:"uppercase",borderBottom:`1.5px solid ${T.border}`}}>Bulan</th>
                      {s.dompet.map(d=><th key={d.id} style={{padding:"8px 12px",textAlign:"right",fontSize:10,color:T.muted,fontWeight:700,textTransform:"uppercase",borderBottom:`1.5px solid ${T.border}`}}>{d.nama}</th>)}
                      <th style={{padding:"8px 12px",textAlign:"right",fontSize:10,color:T.accent,fontWeight:700,textTransform:"uppercase",borderBottom:`1.5px solid ${T.border}`}}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(historicalSaldo).map(([label,data],i)=>{
                      const isCurrentMonth=label===MSHORT[bulanIdx];
                      return(
                        <tr key={label} style={{background:isCurrentMonth?T.accentBg:"transparent"}}>
                          <td style={{padding:"9px 12px",fontWeight:isCurrentMonth?700:500,color:isCurrentMonth?T.accent:T.text,borderBottom:`1px solid ${T.borderLight}`}}>
                            {label} {isCurrentMonth&&<Pill c="blue" ch={t("activeLabel")} xs/>}
                          </td>
                          {s.dompet.map(d=>(
                            <td key={d.id} style={{padding:"9px 12px",textAlign:"right",fontWeight:600,color:data.dompetSaldo[d.id]>=0?T.text:T.err,borderBottom:`1px solid ${T.borderLight}`}}>
                              {IDRs(data.dompetSaldo[d.id]||0)}
                            </td>
                          ))}
                          <td style={{padding:"9px 12px",textAlign:"right",fontWeight:800,color:data.totalSaldo>=0?T.ok:T.err,borderBottom:`1px solid ${T.borderLight}`}}>
                            {IDR(data.totalSaldo)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{fontSize:10,color:T.muted,marginTop:10}}>* Estimasi dihitung dengan meng-reverse transaksi dari saldo saat ini. Angka paling akurat jika data transaksi lengkap.</div>
            </>} style={{marginTop:18}}/>
          </>}

          {/* ══════════════════════════════════════════════════════════
              SETTING
          ══════════════════════════════════════════════════════════ */}
          {page==="setting"&&(
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:20}}>
              <Card ch={<div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"auto 1fr auto",gap:14,alignItems:"center"}}>
                <img src={fireUser?.photoURL || "/icon-192.png"} alt="" style={{width:58,height:58,borderRadius:18,objectFit:"cover",boxShadow:`0 10px 24px ${T.accentPop}`,border:`2px solid ${T.border}`,flexShrink:0}}/>
                <div style={{minWidth:0}}>
                  <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:6}}>
                    <span style={{fontSize:10,fontWeight:900,padding:"5px 9px",borderRadius:999,background:isApproved?T.okBg:T.warnBg,color:isApproved?T.ok:T.warn,letterSpacing:.9,textTransform:"uppercase"}}>{isApproved?"Lifetime aktif":"Menunggu approval"}</span>
                  </div>
                  <div style={{fontSize:17,fontWeight:900,color:T.text,letterSpacing:-.2,marginBottom:3}}>{accessProfile?.displayName || fireUser?.displayName || s.name || "Akun AturDuitku"}</div>
                  <div style={{fontSize:12,color:T.muted,lineHeight:1.55,overflowWrap:"anywhere"}}>{accessProfile?.email || fireUser?.email || "-"} · Data tersimpan otomatis ke akun kamu.</div>
                  <div style={{fontSize:11,color:T.sub,marginTop:6}}>Status sinkron: <strong style={{color:syncStatus==="error"?T.err:syncStatus==="saving"?T.warn:T.ok}}>{syncStatus==="saving"?"menyimpan":syncStatus==="error"?"perlu dicek":"aman"}</strong>{accessProfile?.approvedAt?` · Approved ${new Date(accessProfile.approvedAt).toLocaleDateString("id-ID")}`:""}</div>
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:isMobile?"flex-start":"flex-end"}}>
                  {!isStandalone&&!installDismissed&&<Btn onClick={handleInstallApp} ch="Pasang app" c={T.accent} style={{padding:"9px 12px",fontSize:12}}/>}
                  <Btn onClick={exportJSON} ch="Backup" c={T.ok} outline style={{padding:"9px 12px",fontSize:12}}/>
                </div>
              </div>} style={{gridColumn:"1/-1",padding:isMobile?14:"16px 18px"}}/>
              <Card ch={<>
                <Sec t={t("profile")}/>
                <label style={LS}>{t("displayName")}</label><input value={sfForm.name} onChange={e=>setSfForm(f=>({...f,name:e.target.value}))} style={{...IS,marginBottom:10}}/>
                <label style={LS}>{t("emergencyTarget")}</label><CurIn value={sfForm.targetDana} onChange={v=>setSfForm(f=>({...f,targetDana:v}))} placeholder="0" style={{...IS,marginBottom:14}}/>

                <Sec t={t("display")}/>
                {/* Language Selector */}
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:10,fontWeight:700,color:T.accent,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>Bahasa</div>
                  <div style={{display:"flex",gap:6}}>
                    {[{code:"id",flag:"🇮🇩",label:"Indonesia"},{code:"en",flag:"🇺🇸",label:"English"}].map(l=>(
                      <button key={l.code} onClick={()=>changeLang(l.code)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"9px 12px",borderRadius:10,border:`2px solid ${lang===l.code?T.accent:T.border}`,background:lang===l.code?T.accentBg:T.card,color:lang===l.code?T.accent:T.sub,fontWeight:700,fontSize:13,cursor:"pointer",transition:"all .2s"}}>
                        <span style={{fontSize:18}}>{l.flag}</span>{l.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:T.cardAlt,borderRadius:10,border:`1px solid ${T.border}`,marginBottom:14}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:13,color:T.text}}>{t("darkMode")}</div>
                    <div style={{fontSize:11,color:T.muted}}>{t("darkModeDesc")}</div>
                  </div>
                  <button onClick={()=>setDark(!dark)} style={{width:52,height:28,borderRadius:99,background:dark?T.accent:T.border,border:"none",cursor:"pointer",position:"relative",transition:"background .3s"}}>
                    <div style={{width:22,height:22,borderRadius:"50%",background:"white",position:"absolute",top:3,left:dark?27:3,transition:"left .25s",boxShadow:"0 1px 3px rgba(0,0,0,.2)"}}/>
                  </button>
                </div>

                {/* Blur saldo toggle */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:T.cardAlt,borderRadius:10,border:`1px solid ${T.border}`,marginBottom:14}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:13,color:T.text}}>{t("blurBalance")}</div>
                    <div style={{fontSize:11,color:T.muted}}>{t("blurDesc")}</div>
                  </div>
                  <button onClick={toggleBlur} style={{width:52,height:28,borderRadius:99,background:blurSaldo?T.accent:T.border,border:"none",cursor:"pointer",position:"relative",transition:"background .3s"}}>
                    <div style={{width:22,height:22,borderRadius:"50%",background:"white",position:"absolute",top:3,left:blurSaldo?27:3,transition:"left .25s",boxShadow:"0 1px 3px rgba(0,0,0,.2)"}}/>
                  </button>
                </div>

                {/* Simple mode */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:T.cardAlt,borderRadius:10,border:`1px solid ${T.border}`,marginBottom:14}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:13,color:T.text}}>Simple Mode</div>
                    <div style={{fontSize:11,color:T.muted}}>Sembunyikan menu lanjutan supaya user baru fokus ke Home, Transaksi, Budget, Laporan, dan Setting.</div>
                  </div>
                  <button onClick={toggleSimpleMode} style={{width:52,height:28,borderRadius:99,background:simpleMode?T.accent:T.border,border:"none",cursor:"pointer",position:"relative",transition:"background .3s",flexShrink:0}}>
                    <div style={{width:22,height:22,borderRadius:"50%",background:"white",position:"absolute",top:3,left:simpleMode?27:3,transition:"left .25s",boxShadow:"0 1px 3px rgba(0,0,0,.2)"}}/>
                  </button>
                </div>

                {/* Notification permission */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:T.cardAlt,borderRadius:10,border:`1px solid ${T.border}`,marginBottom:14}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:13,color:T.text}}>{t("notifications")}</div>
                    <div style={{fontSize:11,color:T.muted}}>{t("notifDesc")}</div>
                  </div>
                  <button onClick={requestNotifPermission} style={{padding:"6px 14px",borderRadius:99,border:`1.5px solid ${T.accent}`,background:T.accentBg,color:T.accent,fontWeight:700,fontSize:11,cursor:"pointer"}}>
                    {typeof window!=="undefined"&&"Notification" in window&&Notification.permission==="granted"?t("notifActive"):"Aktifkan"}
                  </button>
                </div>

                <Sec t={t("laporanPeriod")}/>
                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10,marginBottom:14}}>
                  <div><label style={LS}>{t("bulanShort")}</label><select value={s.bulan} onChange={e=>setS(p=>({...p,bulan:e.target.value}))} style={IS}>{MONTHS.map(m=><option key={m}>{m}</option>)}</select></div>
                  <div><label style={LS}>{t("year")}</label><select value={s.tahun} onChange={e=>setS(p=>({...p,tahun:e.target.value}))} style={IS}>{YEAR_OPTIONS.map(y=><option key={y}>{y}</option>)}</select></div>
                </div>
                
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>EXPORT DATA</div>
                  <div style={{background:dark?"#1F1035":"#F0EBFF",borderRadius:10,padding:"12px",border:`1px solid ${T.border}`}}>
                    <div style={{fontSize:12,fontWeight:700,color:T.accent,marginBottom:4}}>Export laporan</div>
                    <div style={{fontSize:11,color:T.muted,lineHeight:1.6}}>Gunakan tombol <strong>Export Sheets</strong> atau <strong>Export PDF</strong> di halaman Laporan untuk download data kamu.</div>
                  </div>
                                  </div>
                <Btn onClick={()=>{setS(p=>({...p,name:sfForm.name,targetDana:sfForm.targetDana,prevPemasukan:sfForm.prevPemasukan,prevPengeluaran:sfForm.prevPengeluaran}));showToast("Tersimpan!");}} ch={lang==="en"?"Save Changes":"Simpan perubahan"} style={{width:"100%",padding:11}}/>
                <div style={{marginTop:16,paddingTop:14,borderTop:`1.5px solid ${T.errBorder}`}}>
                  <div style={{fontSize:10,fontWeight:700,color:T.err,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Zona berbahaya</div>
                  <button onClick={()=>setModal({type:"confirm",title:"Reset Semua Data",msg:"Tindakan ini akan menghapus SEMUA data keuanganmu secara permanen. Yakin ingin melanjutkan?",danger:true,onConfirm:()=>{
              localStorage.removeItem("aturduitku_data");
              localStorage.removeItem("aturduitku_onboarded");
              setS(INIT);
              setOnboarded(false);
              setModal(null);
              if(fireUser){ saveCloudData(fireUser.uid,{data:INIT,onboarded:false}); }
              showToast("Semua data berhasil direset!");
            }})} style={{width:"100%",padding:10,borderRadius:10,border:`1.5px solid ${T.errBorder}`,background:T.errBg,color:T.err,fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                    Reset semua data
                  </button>
                </div>
              </>}/>
              <div style={{display:"grid",gap:14,alignContent:"start"}}>
                <Card ch={<>
                  <Sec t="Export Data" sub="Akses export cepat tanpa perlu cari dari halaman lain."/>
                  <div style={{fontSize:12,color:T.muted,lineHeight:1.7}}>
                    Download data keuanganmu kapanpun:<br/>
                      <strong style={{color:T.text}}>Export Sheets</strong> {"->"} buka di Google Sheets<br/>
                      <strong style={{color:T.text}}>Export PDF</strong> {"->"} laporan siap cetak
                  </div>
                  <Btn onClick={()=>navTo("laporan")} ch="Buka laporan" style={{marginTop:8,padding:"8px 14px",fontSize:12}}/>
                </>}/>

                <Card ch={<>
                  <Sec t="Tutup Buku" sub="Simpan pembanding bulan ini sebelum masuk periode berikutnya."/>
                  <div style={{fontSize:12,color:T.muted,lineHeight:1.65,marginBottom:12}}>Cocok dipakai akhir bulan. Sistem menyimpan pemasukan dan pengeluaran bulan aktif sebagai acuan laporan bulan depan.</div>
                  <Btn onClick={()=>setModal({type:"confirm",title:"Tutup buku bulan ini?",msg:"Pemasukan dan pengeluaran bulan ini disimpan sebagai pembanding, lalu periode aktif pindah ke bulan berikutnya. Data transaksi tetap aman.",onConfirm:closeMonth})} ch="Tutup buku bulan ini" c={T.info} style={{padding:"9px 14px",fontSize:12}}/>
                </>}/>

                <Card ch={<>
                  <Sec t="Bantuan & Rilis" sub="Kontak admin dan cek kesiapan app sebelum dipakai harian."/>
                  <div style={{display:"grid",gap:8,marginBottom:12}}>
                    {[
                      ["Akun",isApproved?"Lifetime aktif":"Perlu approval",isApproved?T.ok:T.warn],
                      ["Sync",!isOnline?"Offline":syncStatus==="error"?"Perlu dicek":"Aman",!isOnline||syncStatus==="error"?T.warn:T.ok],
                      ["PWA",isStandalone?"Terpasang":"Bisa dipasang",isStandalone?T.ok:T.accent],
                    ].map(([label,value,color])=><div key={label} style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",background:T.cardAlt,border:`1px solid ${T.border}`,borderRadius:11,padding:"9px 11px"}}>
                      <span style={{fontSize:11,color:T.muted,fontWeight:800,textTransform:"uppercase",letterSpacing:.8}}>{label}</span>
                      <span style={{fontSize:12,color,fontWeight:900}}>{value}</span>
                    </div>)}
                  </div>
                  <div style={{fontSize:12,color:T.muted,lineHeight:1.65,marginBottom:12}}>Kalau ada error, kendala login, pembayaran, atau approval, hubungi admin lewat WhatsApp. Sertakan email akun dan Order ID Scalev kalau terkait pembayaran.</div>
                  <div style={{display:"grid",gap:8,marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",background:T.cardAlt,border:`1px solid ${T.border}`,borderRadius:11,padding:"9px 11px"}}>
                      <span style={{fontSize:12,color:T.text,fontWeight:800}}>WhatsApp</span>
                      <span style={{fontSize:12,color:T.ok,fontWeight:900}}>{supportWhatsapp}</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",background:T.cardAlt,border:`1px solid ${T.border}`,borderRadius:11,padding:"9px 11px"}}>
                      <span style={{fontSize:12,color:T.text,fontWeight:800}}>Instagram</span>
                      <span style={{fontSize:12,color:T.accent,fontWeight:900}}>{supportInstagram}</span>
                    </div>
                  </div>
                  <a href={supportWhatsappHref} target="_blank" rel="noreferrer" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"100%",padding:"11px 14px",borderRadius:14,background:T.ok,color:"white",fontSize:13,fontWeight:900,textDecoration:"none",boxShadow:`0 12px 28px ${T.ok}22`}}>Hubungi Admin</a>
                </>}/>

                <Card ch={<>
                  <Sec t={t("prevPeriod")}/>
                  <label style={LS}>{t("prevIncome")}</label><CurIn value={sfForm.prevPemasukan} onChange={v=>setSfForm(f=>({...f,prevPemasukan:v}))} placeholder="0" style={{...IS,marginBottom:10}}/>
                  <label style={LS}>{t("prevExpense")}</label><CurIn value={sfForm.prevPengeluaran} onChange={v=>setSfForm(f=>({...f,prevPengeluaran:v}))} placeholder="0" style={IS}/>
                </>}/>
                
                {/* Backup & Restore */}
                <Card ch={<>
                  <Sec t={t("backupRestore")}/>
                  <div style={{fontSize:12,color:T.sub,marginBottom:14,lineHeight:1.5}}>Export semua data ke file JSON untuk backup, atau import kembali dari file backup sebelumnya.</div>
                  <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                    <Btn onClick={exportJSON} ch="Export JSON" c="#16A34A" style={{flex:1,padding:"10px 14px"}}/>
                    <Btn onClick={()=>setModal({type:"importJSON"})} ch="Import JSON" c={T.info} outline style={{flex:1,padding:"10px 14px"}}/>
                  </div>
                  <div style={{marginTop:10,fontSize:11,color:T.muted}}>{t("csvHint")}</div>
                </>} style={{marginBottom:14}}/>

                {/* Recurring Transactions */}
                <Card ch={(
                  <div>
                    <Sec t={t("recurringTx")} right={<Btn onClick={()=>setShowAddRecurring(!showAddRecurring)} ch={showAddRecurring?"Tutup":t("add")} c={T.accent} outline style={{padding:"5px 12px",fontSize:11}}/>}/>
                    <div style={{fontSize:11,color:T.sub,marginBottom:12}}>{t("recurringDesc2")} Proses akan masuk otomatis ke bulan aktif.</div>

                    {showAddRecurring&&<div style={{background:T.infoBg,border:`1px solid ${T.infoBorder}`,borderRadius:10,padding:14,marginBottom:14}}>
                      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:8,marginBottom:8}}>
                        <div><label style={{...LS,fontSize:9}}>{t("name")}</label><input placeholder={t("recurringPlaceholder")} value={recurringForm.nama} onChange={e=>setRecurringForm(f=>({...f,nama:e.target.value}))} style={{...IS,fontSize:11,padding:"7px 9px"}}/></div>
                        <div><label style={{...LS,fontSize:9}}>{t("amount")}</label><CurIn value={recurringForm.jml} onChange={v=>setRecurringForm(f=>({...f,jml:v}))} style={{...IS,fontSize:11,padding:"7px 9px"}}/></div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 1fr",gap:8,marginBottom:10}}>
                        <div><label style={{...LS,fontSize:9}}>{t("type")}</label>
                        <select value={recurringForm.tipe} onChange={e=>setRecurringForm(f=>({...f,tipe:e.target.value}))} style={{...IS,fontSize:11,padding:"7px 9px"}}>
                          <option value="pengeluaran">{t("expense")}</option>
                          <option value="pemasukan">{t("income")}</option>
                          <option value="tabungan">{t("savingShort")}</option>
                        </select></div>
                        <div><label style={{...LS,fontSize:9}}>{t("recurringDay")}</label><input type="number" min="1" max="31" placeholder="tgl" value={recurringForm.hari} onChange={e=>setRecurringForm(f=>({...f,hari:e.target.value}))} style={{...IS,fontSize:11,padding:"7px 9px"}}/></div>
                        <div><label style={{...LS,fontSize:9}}>{t("dompet")}</label>
                        <select value={recurringForm.dompetId} onChange={e=>setRecurringForm(f=>({...f,dompetId:Number(e.target.value)}))} style={{...IS,fontSize:11,padding:"7px 9px"}}>
                          {s.dompet.map(d=><option key={d.id} value={d.id}>{uiIcon(d.icon)} {d.nama}</option>)}
                        </select></div>
                      </div>
                      <Btn onClick={addRecurring} ch={t("recurringAdd")} style={{padding:"8px 16px",fontSize:12}}/>
                    </div>}

                    {s.recurring.length>0 ? (
                      <div>
                        <div style={{marginBottom:10}}>
                          <Btn onClick={prosesRecurring} ch={`${t("processAll")} ${s.bulan} ${s.tahun}`} c="#D97706" style={{width:"100%",padding:"10px 14px",fontSize:12}}/>
                        </div>
                        {s.recurring.map(r=>(
                          <div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${T.borderLight}`}}>
                            <div style={{display:"flex",gap:10,alignItems:"center",minWidth:0}}>
                              <div style={{width:32,height:32,borderRadius:8,background:r.tipe==="pemasukan"?T.okBg:r.tipe==="tabungan"?T.infoBg:T.errBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>
                                {r.tipe==="pemasukan"?"📈":r.tipe==="tabungan"?"🏦":"📉"}
                              </div>
                              <div>
                                <div style={{fontSize:12,fontWeight:700,color:T.text}}>{r.nama}</div>
                                <div style={{fontSize:10,color:T.muted}}>Tgl {r.hari} tiap bulan • {s.dompet.find(d=>d.id===r.dompetId)?.nama}</div>
                              </div>
                            </div>
                            <div style={{display:"flex",gap:8,alignItems:"center"}}>
                              <span style={{fontSize:12,fontWeight:700,color:r.tipe==="pemasukan"?T.ok:r.tipe==="tabungan"?T.info:T.err}}>{IDRs(N(r.jml))}</span>
                              <button onClick={()=>setS(p=>({...p,recurring:p.recurring.map(x=>x.id!==r.id?x:{...x,aktif:!x.aktif})}))} style={{padding:"3px 8px",borderRadius:6,border:`1px solid ${r.aktif?T.okBorder:T.border}`,background:r.aktif?T.okBg:T.cardAlt,color:r.aktif?T.ok:T.muted,fontSize:10,cursor:"pointer",fontWeight:700,fontFamily:"inherit"}}>{r.aktif?"Aktif":"Nonaktif"}</button>
                              <Del onClick={()=>confirmDelete({title:"Hapus transaksi rutin?",msg:`Transaksi rutin "${r.nama}" tidak akan diproses otomatis lagi.`,toastMsg:"Transaksi rutin dihapus",onConfirm:()=>setS(p=>({...p,recurring:p.recurring.filter(x=>x.id!==r.id)}))})}/>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (!showAddRecurring&&<LaunchEmpty
                      icon="🔁"
                      title="Belum ada transaksi rutin"
                      desc="Tambahkan transaksi bulanan seperti gaji, listrik, internet, atau cicilan supaya pencatatan berulang jalan otomatis."
                      actionLabel="Tambah transaksi rutin"
                      onAction={()=>setShowAddRecurring(true)}
                      secondaryLabel="Lihat laporan"
                      onSecondary={()=>setPage("laporan")}
                      style={{padding:"24px 16px"}}
                    />)}
                  </div>
                )} style={{marginBottom:14}}/>

                {/* Notification Summary */}
                <Card ch={(
                  <div>
                    <Sec t={t("notifSummary")} right={<button onClick={()=>setNotifOpen(true)} style={{fontSize:11,color:T.accent,background:"none",border:"none",cursor:"pointer",fontWeight:700}}>Lihat Semua</button>}/>
                    {notifications.length===0 ? (
                      <LaunchEmpty
                        icon="🔔"
                        title="Belum ada notifikasi aktif"
                        desc="Kalau budget, tagihan, atau transaksi rutin mulai terisi, pengingat penting akan muncul di sini."
                        actionLabel="Buka budget"
                        onAction={()=>setPage("budget")}
                        secondaryLabel="Tambah transaksi"
                        onSecondary={()=>setModal({type:"tx"})}
                        style={{padding:"24px 16px"}}
                      />
                    ) : (
                      <div>
                        {notifications.slice(0,3).map((n,i)=>(
                          <div key={i} style={{display:"flex",gap:10,alignItems:"center",minWidth:0,padding:"8px 0",borderBottom:`1px solid ${T.borderLight}`}}>
                            <span style={{fontSize:18}}>{uiIcon(n.icon)}</span>
                            <div style={{flex:1}}>
                              <div style={{fontSize:12,fontWeight:700,color:n.color==="danger"?T.err:T.warn}}>{n.title}</div>
                              <div style={{fontSize:11,color:T.muted}}>{n.msg}</div>
                            </div>
                          </div>
                        ))}
                        {notifications.length>3&&<div style={{textAlign:"center",fontSize:11,color:T.accent,fontWeight:700,marginTop:8,cursor:"pointer"}} onClick={()=>setNotifOpen(true)}>+{notifications.length-3} notifikasi lainnya</div>}
                      </div>
                    )}
                  </div>
                )}/>
              </div>
            </div>
          )}
        </div>

        {page==="admin"&&isAdmin&&(
          <div style={{padding:isMobile?`12px max(12px,env(safe-area-inset-right)) calc(80px + max(env(safe-area-inset-bottom),0px)) max(12px,env(safe-area-inset-left))`:"14px 14px 40px",maxWidth:1340,margin:"0 auto"}}>
            <Card ch={<div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1.35fr .9fr .9fr",gap:14,alignItems:"stretch"}}>
              <div style={{display:"flex",gap:12,alignItems:"flex-start",minWidth:0}}>
                <img className="cat-mascot" src="/icon-192.png" alt="" style={{width:54,height:54,borderRadius:16,objectFit:"cover",boxShadow:`0 10px 24px ${T.accentPop}`,flexShrink:0}}/>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:10,fontWeight:900,color:T.accent,letterSpacing:1.2,textTransform:"uppercase",marginBottom:4}}>Scalev manual flow</div>
                  <div style={{fontSize:18,fontWeight:900,color:T.text,letterSpacing:-.2,marginBottom:5}}>Approval user dibuat seperti kasir kecil</div>
                  <div style={{fontSize:12,color:T.muted,lineHeight:1.65}}>Cocokkan buyer email dan order ID dari Scalev, ubah pembayaran menjadi <b>Sudah cocok</b>, lalu approve akun. User tidak perlu isi data pembelian sendiri.</div>
                </div>
              </div>
              <button onClick={()=>{setAdminFilter("pending_review");setAdminPaymentFilter("paid");setAdminReviewFilter("all");}} style={{textAlign:"left",border:`1px solid ${T.okBorder}`,background:T.okBg,borderRadius:14,padding:"13px 14px",cursor:"pointer",fontFamily:"inherit"}}>
                <div style={{fontSize:10,fontWeight:900,color:T.ok,letterSpacing:1,textTransform:"uppercase",marginBottom:5}}>Siap approve</div>
                <div style={{fontSize:24,fontWeight:900,color:T.ok,marginBottom:2}}>{adminReadyToApprove.length}</div>
                <div style={{fontSize:11,color:T.sub,lineHeight:1.45}}>Pembayaran sudah cocok, tinggal buka akses.</div>
              </button>
              <button onClick={()=>{setAdminFilter("pending_review");setAdminPaymentFilter("checking");setAdminReviewFilter("all");}} style={{textAlign:"left",border:`1px solid ${T.warnBorder}`,background:T.warnBg,borderRadius:14,padding:"13px 14px",cursor:"pointer",fontFamily:"inherit"}}>
                <div style={{fontSize:10,fontWeight:900,color:T.warn,letterSpacing:1,textTransform:"uppercase",marginBottom:5}}>Perlu dicek</div>
                <div style={{fontSize:24,fontWeight:900,color:T.warn,marginBottom:2}}>{adminNeedPaymentCheck.length}</div>
                <div style={{fontSize:11,color:T.sub,lineHeight:1.45}}>Butuh validasi email/order ID Scalev.</div>
              </button>
            </div>} style={{marginBottom:18,padding:isMobile?14:"16px 18px"}}/>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:18}}>
              {[
                {label:"Total User",value:adminStats.total,color:T.accent,bg:T.accentBg},
                {label:"Pending",value:adminStats.pending_review,color:T.warn,bg:T.warnBg},
                {label:"Approved",value:adminStats.approved,color:T.ok,bg:T.okBg},
                {label:"Rejected",value:adminStats.rejected,color:T.err,bg:T.errBg},
              ].map((item)=>(
                <div key={item.label} style={{background:item.bg,borderRadius:14,padding:"14px 16px",border:`1px solid ${T.border}`}}>
                  <div style={{fontSize:10,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{item.label}</div>
                  <div style={{fontSize:22,fontWeight:900,color:item.color}}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:18}}>
              {[
                {label:"Belum kirim",value:adminStats.payment?.pending_info || 0,color:T.muted,bg:T.cardAlt},
                {label:"Perlu dicek",value:adminStats.payment?.checking || 0,color:T.warn,bg:T.warnBg},
                {label:"Sudah cocok",value:adminStats.payment?.paid || 0,color:T.ok,bg:T.okBg},
                {label:"Bermasalah",value:adminStats.payment?.problem || 0,color:T.err,bg:T.errBg},
              ].map((item)=>(
                <div key={item.label} style={{background:item.bg,borderRadius:14,padding:"14px 16px",border:`1px solid ${T.border}`}}>
                  <div style={{fontSize:10,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{item.label}</div>
                  <div style={{fontSize:22,fontWeight:900,color:item.color}}>{item.value}</div>
                </div>
              ))}
            </div>
            <Card ch={<>
              <Sec t="Dashboard Admin" sub="Review akun baru, cek status pembayaran, lalu approve manual setelah pembayaran cocok." right={<Btn onClick={loadAdminUsers} ch={adminLoading?"Memuat...":"Refresh data"} c={T.info} outline style={{padding:"6px 12px",fontSize:11}}/>}/>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
                {[
                  {label:"Fokus Pending",onClick:()=>{setAdminFilter("pending_review");setAdminPaymentFilter("all");}},
                  {label:"Perlu Dicek",onClick:()=>{setAdminFilter("all");setAdminPaymentFilter("checking");}},
                  {label:"Review Hari Ini",onClick:()=>{setAdminReviewFilter("today");}},
                  {label:"Belum Direview",onClick:()=>{setAdminReviewFilter("unreviewed");}},
                  {label:"Sudah Cocok",onClick:()=>{setAdminFilter("all");setAdminPaymentFilter("paid");}},
                  {label:"Reset Filter",onClick:()=>{setAdminFilter("all");setAdminPaymentFilter("all");setAdminReviewFilter("all");setAdminQuery("");}},
                ].map((item)=>(
                  <button key={item.label} onClick={item.onClick} style={{padding:"8px 12px",borderRadius:999,border:`1px solid ${T.border}`,background:T.cardAlt,color:T.text,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                    {item.label}
                  </button>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"180px 180px 180px 1fr",gap:10,marginBottom:14}}>
                <select value={adminFilter} onChange={e=>setAdminFilter(e.target.value)} style={IS}>
                  <option value="all">Semua status</option>
                  <option value="pending_review">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <select value={adminPaymentFilter} onChange={e=>setAdminPaymentFilter(e.target.value)} style={IS}>
                  <option value="all">Semua pembayaran</option>
                  <option value="pending_info">Belum kirim referensi</option>
                  <option value="checking">Perlu dicek</option>
                  <option value="paid">Sudah cocok</option>
                  <option value="problem">Bermasalah</option>
                </select>
                <select value={adminReviewFilter} onChange={e=>setAdminReviewFilter(e.target.value)} style={IS}>
                  <option value="all">Semua review</option>
                  <option value="today">Direview hari ini</option>
                  <option value="unreviewed">Belum direview</option>
                </select>
                <input value={adminQuery} onChange={e=>setAdminQuery(e.target.value)} placeholder="Cari nama, email akun, buyer email, atau order ID" style={IS}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr auto",gap:12,marginBottom:14,padding:"12px 14px",borderRadius:12,background:T.cardAlt,border:`1px solid ${T.border}`}}>
                <div style={{fontSize:12,color:T.text,fontWeight:700}}>
                  {adminFilteredUsers.length} user tampil, halaman {adminPage} / {adminPageCount}
                </div>
                <div style={{fontSize:11,color:T.muted}}>
                  Urutan otomatis memprioritaskan user pending dan pembayaran yang masih perlu dicek.
                </div>
              </div>
              <div style={{display:"grid",gap:12}}>
                {adminLoading&&Array.from({length:3}).map((_,i)=>(
                  <div key={`admin-skeleton-${i}`} style={{background:T.cardAlt,border:`1px solid ${T.border}`,borderRadius:14,padding:14}}>
                    <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:12}}>
                      <div className="smooth-skeleton" style={{width:42,height:42,borderRadius:14}}/>
                      <div style={{flex:1}}>
                        <div className="smooth-skeleton" style={{width:"42%",height:14,marginBottom:8}}/>
                        <div className="smooth-skeleton" style={{width:"64%",height:10}}/>
                      </div>
                    </div>
                    <div className="smooth-skeleton" style={{height:42,marginBottom:10}}/>
                    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr 120px",gap:10}}>
                      <div className="smooth-skeleton" style={{height:38}}/>
                      <div className="smooth-skeleton" style={{height:38}}/>
                      <div className="smooth-skeleton" style={{height:38}}/>
                    </div>
                  </div>
                ))}
                {adminPagedUsers.map((user)=>(
                  <div key={user.uid} style={{background:T.cardAlt,border:`1px solid ${T.border}`,borderRadius:14,padding:14}}>
                    <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start",flexWrap:"wrap",marginBottom:10}}>
                      <div>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                          <div style={{fontSize:14,fontWeight:800,color:T.text}}>{user.displayName || "Tanpa nama"}</div>
                          {(user.approvalStatus || "pending_review")==="pending_review"&&<span style={{fontSize:10,fontWeight:800,padding:"4px 8px",borderRadius:99,background:T.warnBg,color:T.warn}}>Perlu aksi</span>}
                          {!user.reviewedAt&&<span style={{fontSize:10,fontWeight:800,padding:"4px 8px",borderRadius:99,background:T.errBg,color:T.err}}>Belum direview</span>}
                        </div>
                        <div style={{fontSize:12,color:T.muted,marginTop:2}}>{user.email || "-"}</div>
                        <div style={{fontSize:10,color:T.muted,marginTop:6}}>UID: {user.uid}</div>
                        <div style={{display:"grid",gap:6,marginTop:10}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",fontSize:11,color:T.sub}}>
                            <strong>Email akun:</strong> <span>{user.email || "-"}</span>
                            <button onClick={()=>copyAdminField("Email akun", user.email)} style={{padding:"4px 8px",borderRadius:999,border:`1px solid ${T.border}`,background:T.bg,color:T.text,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Copy</button>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",fontSize:11,color:T.sub}}>
                            <strong>Buyer email:</strong> <span>{user.buyerEmail || "-"}</span>
                            <button onClick={()=>copyAdminField("Buyer email", user.buyerEmail)} style={{padding:"4px 8px",borderRadius:999,border:`1px solid ${T.border}`,background:T.bg,color:T.text,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Copy</button>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",fontSize:11,color:T.sub}}>
                            <strong>Order ID:</strong> <span>{user.orderId || "-"}</span>
                            <button onClick={()=>copyAdminField("Order ID", user.orderId)} style={{padding:"4px 8px",borderRadius:999,border:`1px solid ${T.border}`,background:T.bg,color:T.text,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Copy</button>
                          </div>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                        <span style={{fontSize:11,fontWeight:800,padding:"6px 10px",borderRadius:99,background:user.approvalStatus==="approved"?T.okBg:user.approvalStatus==="rejected"?T.errBg:T.warnBg,color:user.approvalStatus==="approved"?T.ok:user.approvalStatus==="rejected"?T.err:T.warn}}>
                          {user.approvalStatus || "pending_review"}
                        </span>
                        <span style={{fontSize:11,fontWeight:800,padding:"6px 10px",borderRadius:99,background:(user.paymentStatus || "pending_info")==="paid"?T.okBg:(user.paymentStatus || "pending_info")==="problem"?T.errBg:(user.paymentStatus || "pending_info")==="checking"?T.warnBg:T.cardAlt,color:(user.paymentStatus || "pending_info")==="paid"?T.ok:(user.paymentStatus || "pending_info")==="problem"?T.err:(user.paymentStatus || "pending_info")==="checking"?T.warn:T.muted}}>
                          {paymentStatusLabel(user.paymentStatus)}
                        </span>
                        {user.role==="admin"&&<span style={{fontSize:11,fontWeight:800,padding:"6px 10px",borderRadius:99,background:T.infoBg,color:T.info}}>admin</span>}
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10}}>
                      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10}}>
                        <input value={adminBuyerEmail[user.uid] || ""} onChange={e=>setAdminBuyerEmail(prev=>({...prev,[user.uid]:e.target.value}))} placeholder="Buyer email Scalev" style={IS}/>
                        <input value={adminOrderId[user.uid] || ""} onChange={e=>setAdminOrderId(prev=>({...prev,[user.uid]:e.target.value}))} placeholder="Order ID Scalev" style={IS}/>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"220px 1fr auto",gap:10,alignItems:"center"}}>
                        <select value={adminPaymentStatus[user.uid] || "pending_info"} onChange={e=>setAdminPaymentStatus(prev=>({...prev,[user.uid]:e.target.value}))} style={IS}>
                          <option value="pending_info">Belum kirim referensi</option>
                          <option value="checking">Perlu dicek</option>
                          <option value="paid">Sudah cocok</option>
                          <option value="problem">Bermasalah</option>
                        </select>
                        <textarea value={adminNotes[user.uid] || ""} onChange={e=>setAdminNotes(prev=>({...prev,[user.uid]:e.target.value}))} placeholder="Catatan admin, mismatch, atau detail validasi pembayaran" style={{minHeight:72,resize:"vertical",...IS}}/>
                        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"1fr",gap:8}}>
                          <Btn onClick={()=>updateAdminApproval(user.uid,"approved")} ch="Approve" c="#16A34A" style={{padding:"9px 12px",fontSize:12}}/>
                          <Btn onClick={()=>copyAdminWhatsappMessage(user,"approved")} ch="Copy WA Aktif" c={T.ok} outline style={{padding:"9px 12px",fontSize:12}}/>
                          <Btn onClick={()=>copyAdminWhatsappMessage(user,"followup")} ch="Copy WA Cek" c={T.info} outline style={{padding:"9px 12px",fontSize:12}}/>
                          <Btn onClick={()=>updateAdminApproval(user.uid,"pending_review")} ch="Pending" c="#D97706" outline style={{padding:"9px 12px",fontSize:12}}/>
                          <Btn onClick={()=>updateAdminApproval(user.uid,"rejected")} ch="Reject" c="#DC2626" outline style={{padding:"9px 12px",fontSize:12}}/>
                        </div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:12,flexWrap:"wrap",fontSize:10,color:T.muted,marginTop:10}}>
                      <span>Dibuat: {user.createdAt ? new Date(user.createdAt).toLocaleString("id-ID") : "-"}</span>
                      <span>Login terakhir: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("id-ID") : "-"}</span>
                      <span>Provider: {user.authProvider || "-"}</span>
                      <span>Update payment: {user.paymentUpdatedAt ? new Date(user.paymentUpdatedAt).toLocaleString("id-ID") : "-"}</span>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10,marginTop:10,paddingTop:10,borderTop:`1px dashed ${T.border}`}}>
                      <div style={{fontSize:11,color:T.sub,lineHeight:1.6}}>
                        <div><strong>Review terakhir:</strong> {user.reviewedAt ? new Date(user.reviewedAt).toLocaleString("id-ID") : "-"}</div>
                        <div><strong>Direview oleh:</strong> {user.reviewedBy || "-"}</div>
                      </div>
                      <div style={{fontSize:11,color:T.sub,lineHeight:1.6}}>
                        <div><strong>Approved at:</strong> {user.approvedAt ? new Date(user.approvedAt).toLocaleString("id-ID") : "-"}</div>
                        <div><strong>Approved by:</strong> {user.approvedBy || "-"}</div>
                      </div>
                    </div>
                  </div>
                ))}
                {!adminFilteredUsers.length&&<LaunchEmpty icon="🛡️" title="Tidak ada user yang cocok" desc="Filter yang aktif sedang tidak menemukan akun. Coba reset filter atau cari dengan email akun, buyer email, atau order ID lain." actionLabel="Reset filter" onAction={()=>{setAdminFilter("all");setAdminPaymentFilter("all");setAdminReviewFilter("all");setAdminQuery("");}} secondaryLabel="Refresh data" onSecondary={loadAdminUsers} style={{padding:"34px 18px"}}/>}
              </div>
              {adminFilteredUsers.length>0&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",marginTop:14}}>
                <div style={{fontSize:11,color:T.muted}}>
                  Menampilkan {Math.min((adminPage-1)*ADMIN_PAGE_SIZE + 1, adminFilteredUsers.length)} - {Math.min(adminPage*ADMIN_PAGE_SIZE, adminFilteredUsers.length)} dari {adminFilteredUsers.length} user
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <button onClick={()=>setAdminPage(p=>Math.max(1, p-1))} disabled={adminPage===1} style={{padding:"8px 12px",borderRadius:10,border:`1px solid ${T.border}`,background:adminPage===1?T.cardAlt:T.bg,color:adminPage===1?T.muted:T.text,fontSize:12,fontWeight:700,cursor:adminPage===1?"default":"pointer",fontFamily:"inherit"}}>Sebelumnya</button>
                  <div style={{fontSize:12,color:T.text,fontWeight:700,minWidth:72,textAlign:"center"}}>{adminPage} / {adminPageCount}</div>
                  <button onClick={()=>setAdminPage(p=>Math.min(adminPageCount, p+1))} disabled={adminPage===adminPageCount} style={{padding:"8px 12px",borderRadius:10,border:`1px solid ${T.border}`,background:adminPage===adminPageCount?T.cardAlt:T.bg,color:adminPage===adminPageCount?T.muted:T.text,fontSize:12,fontWeight:700,cursor:adminPage===adminPageCount?"default":"pointer",fontFamily:"inherit"}}>Berikutnya</button>
                </div>
              </div>}
            </>}/>
          </div>
        )}

        <div style={{textAlign:"center",padding:14,fontSize:11,color:T.muted,borderTop:`1.5px solid ${T.border}`,background:T.topbar,marginTop:8,transition:"background .3s", paddingBottom: isMobile ? 80 : 14}}>
          AturDuitku • {s.name} Workspace • {s.bulan} {s.tahun} • {tzZone.city} {tzZone.zone} • {dark?"Dark":"Light"}
        </div>
      </div>

      {/* ── BOTTOM NAV (mobile only) ── */}
      {isMobile&&<nav className="bottom-nav" style={{background:T.nav,borderTopColor:T.border,display:(sidebarOpen||moreOpen||quickOpen||aiOpen||modal||notifOpen||commandOpen)?"none":"flex"}}>
        {[NAV[0],NAV[1],NAV[2],NAV[3]].map(nav=>{const a=page===nav.id;const go=()=>navTo(nav.id);return(
          <button key={nav.id} type="button" onClick={go} className="bottom-nav-item" style={{color:a?T.accent:T.muted}}>
            <span style={{minWidth:34,padding:"4px 6px",borderRadius:999,background:a?T.accentBg:T.cardAlt,color:a?T.accent:T.muted,fontSize:16,fontWeight:700,letterSpacing:0,lineHeight:1,transition:"transform .15s",transform:a?"scale(1.05)":"scale(1)"}}>{uiIcon(nav.icon)}</span>
            <span style={{fontSize:9,fontWeight:a?800:500}}>{nav.label}</span>
            {a&&<span style={{width:4,height:4,borderRadius:"50%",background:T.accent,marginTop:1,boxShadow:`0 0 6px ${T.accent}`}}/>}
          </button>
        );})}
        <button type="button" onClick={()=>setMoreOpen(true)} className="bottom-nav-item" style={{color:T.muted,position:"relative"}}>
          <span style={{minWidth:34,padding:"4px 6px",borderRadius:999,background:T.cardAlt,color:T.muted,fontSize:16,fontWeight:700,letterSpacing:0,lineHeight:1}}>⋯</span>
          <span style={{fontSize:9,fontWeight:500}}>{t("more")}</span>
          {notifications.length>0&&<span style={{position:"absolute",top:6,right:"calc(50% - 14px)",background:T.err,color:"white",borderRadius:"50%",width:14,height:14,fontSize:8,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center"}}>{Math.min(notifications.length,9)}</span>}
        </button>
      </nav>}
    </div>

      {/* ═══════ FLOATING AI BUTTON + CHAT PANEL ═══════ */}
      <style>{`
        @keyframes aiBounceIn {
          0%{transform:scale(0) translateY(20px);opacity:0;}
          70%{transform:scale(1.08) translateY(-4px);}
          100%{transform:scale(1) translateY(0);opacity:1;}
        }
        @keyframes aiPulseRing {
          0%{transform:scale(1);opacity:0.5;}
          100%{transform:scale(1.6);opacity:0;}
        }
        @keyframes aiFadeSlide {
          from{opacity:0;transform:translateX(100%);}
          to{opacity:1;transform:translateX(0);}
        }
        @keyframes aiTypingDot {
          0%,80%,100%{transform:scale(0.6);opacity:0.4;}
          40%{transform:scale(1);opacity:1;}
        }
        /* ── Float Button ── */
        .ai-float-btn {
          position:fixed;
          z-index:900;
          cursor:pointer;
          background:linear-gradient(135deg,#7C3AED,#5B21B6);
          color:white;
          border:none;
          border-radius:28px;
          padding:13px 18px;
          font-size:13px;
          font-weight:700;
          font-family:inherit;
          animation:aiBounceIn 0.45s cubic-bezier(0.34,1.56,0.64,1) both;
          box-shadow:0 6px 20px rgba(124,58,237,0.45);
          display:flex;
          align-items:center;
          gap:8px;
          touch-action:manipulation;
          -webkit-tap-highlight-color:transparent;
          user-select:none;
          -webkit-user-select:none;
          white-space:nowrap;
          transition:transform 0.15s, box-shadow 0.15s;
        }
        .ai-float-btn::before {
          content:"";
          position:absolute;
          inset:0;
          border-radius:28px;
          background:linear-gradient(135deg,#7C3AED,#5B21B6);
          animation:aiPulseRing 2.5s ease-out infinite;
          z-index:-1;
        }
        .ai-float-btn:active { transform:scale(0.94); box-shadow:0 3px 12px rgba(124,58,237,0.4); }
        @media (hover:hover) {
          .ai-float-btn:hover { transform:scale(1.04); box-shadow:0 8px 28px rgba(124,58,237,0.6); }
        }
        /* ── Panel ── */
        .ai-panel {
          position:fixed;
          right:0;
          top:var(--visual-top, 0px);
          width:min(380px,100vw);
          height:var(--app-height, 100dvh);
          max-height:var(--app-height, 100dvh);
          z-index:1100;
          display:flex;
          flex-direction:column;
          animation:aiFadeSlide 0.28s cubic-bezier(0.32,0.72,0,1);
          box-shadow:-6px 0 40px rgba(0,0,0,0.22);
          overscroll-behavior:contain;
        }
        /* ── Messages ── */
        .ai-msg-user {
          align-self:flex-end;
          background:linear-gradient(135deg,#7C3AED,#5B21B6);
          color:white;
          border-radius:18px 18px 4px 18px;
          padding:10px 14px;
          max-width:80%;
          font-size:13.5px;
          line-height:1.5;
          word-break:break-word;
          box-shadow:0 2px 8px rgba(124,58,237,0.3);
        }
        .ai-msg-ai {
          align-self:flex-start;
          border-radius:18px 18px 18px 4px;
          padding:10px 14px;
          max-width:86%;
          font-size:13.5px;
          line-height:1.6;
          word-break:break-word;
        }
        .ai-msgs-wrap {
          flex:1;
          overflow-y:auto;
          -webkit-overflow-scrolling:touch;
          overscroll-behavior:contain;
          padding:16px 14px;
          display:flex;
          flex-direction:column;
          gap:12px;
        }
        .ai-input-wrap {
          display:flex;
          gap:8px;
          align-items:flex-end;
          flex-shrink:0;
        }
        .ai-textarea {
          flex:1;
          border-radius:22px;
          padding:11px 16px;
          font-size:16px !important;
          font-family:inherit;
          resize:none;
          outline:none;
          line-height:1.4;
          max-height:120px;
          overflow-y:auto;
          -webkit-overflow-scrolling:touch;
          -webkit-appearance:none;
        }
        @media (max-width: 899px) {
          .ai-panel { width:100vw; }
          .ai-float-btn {
            width:54px;
            height:54px;
            max-width:54px;
            border-radius:50%;
            padding:0;
            justify-content:center;
            gap:0;
            z-index:180;
            bottom:calc(env(safe-area-inset-bottom) + 86px)!important;
            right:max(14px, env(safe-area-inset-right))!important;
          }
          .ai-float-btn::before { border-radius:50%; animation:none; opacity:.18; }
          .ai-float-btn img { width:34px!important; height:34px!important; border-radius:11px!important; }
          .ai-float-label,.ai-float-chip { display:none!important; }
          .ai-msg-user,.ai-msg-ai { max-width:88%; }
        }
        .ai-send-btn {
          width:44px;
          height:44px;
          border-radius:50%;
          border:none;
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:18px;
          cursor:pointer;
          flex-shrink:0;
          touch-action:manipulation;
          -webkit-tap-highlight-color:transparent;
          transition:transform 0.1s, opacity 0.1s;
        }
        .ai-send-btn:active { transform:scale(0.9); }
        .ai-typing-wrap { align-self:flex-start; display:flex; gap:4px; padding:12px 14px; border-radius:18px 18px 18px 4px; }
        .ai-typing-wrap span {
          width:7px; height:7px; border-radius:50%; background:#7C3AED;
          animation:aiTypingDot 1.3s ease-in-out infinite;
          display:inline-block;
        }
        .ai-typing-wrap span:nth-child(2){animation-delay:0.2s;}
        .ai-typing-wrap span:nth-child(3){animation-delay:0.4s;}
        .ai-quick-btn {
          flex-shrink:0;
          border:none;
          border-radius:999px;
          padding:8px 12px;
          font-size:11px;
          font-weight:700;
          cursor:pointer;
          white-space:nowrap;
          font-family:inherit;
          touch-action:manipulation;
          -webkit-tap-highlight-color:transparent;
        }
      `}</style>

      {/* Float Button */}
      {!aiOpen&&!moreOpen&&!quickOpen&&!modal&&!sidebarOpen&&!notifOpen&&!commandOpen&&!(isMobile&&(page==="home"||page==="trans"||page==="budget"||page==="habit"||page==="laporan"))&&<button
        className="ai-float-btn"
        onClick={()=>setAiOpen(true)}
        style={{
          bottom:isMobile?"calc(env(safe-area-inset-bottom) + 76px)":"24px",
          right:isMobile?"12px":"24px",
        }}
      >
        <img src="/icon-192.png" alt="cat" style={{width:22,height:22,borderRadius:6,objectFit:"cover"}}/>
        <span className="ai-float-label">Dokter Keuangan</span>
        <span className="ai-float-chip" style={{background:"rgba(255,255,255,0.22)",borderRadius:20,padding:"2px 8px",fontSize:13,fontWeight:800,letterSpacing:0.3}}>🤖</span>
      </button>}

      {/* Panel */}
      {aiOpen&&<>
        {/* Overlay */}
        <div style={{
          position:"fixed",
          inset:"var(--visual-top, 0px) 0 auto 0",
          height:"var(--app-height, 100dvh)",
          background:"rgba(0,0,0,0.45)",
          zIndex:1099,
          touchAction:"none",
          overscrollBehavior:"none",
        }} onClick={()=>setAiOpen(false)}/>

        <div className="ai-panel" style={{
          background:dark?"#130929":"#FAFAFA",
        }}>
          {/* Header */}
          <div style={{
            background:"linear-gradient(135deg,#7C3AED,#4C1D95)",
            padding:"12px 14px",
            paddingTop:"calc(env(safe-area-inset-top) + 12px)",
            display:"flex",alignItems:"center",gap:10,
            flexShrink:0,
          }}>
            <img src="/icon-192.png" alt="AturDuitku" style={{width:38,height:38,borderRadius:"50%",objectFit:"cover",flexShrink:0,border:"2px solid rgba(255,255,255,0.3)"}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{color:"white",fontWeight:800,fontSize:15,letterSpacing:-0.3}}>Dokter Keuangan</div><div style={{color:"rgba(255,255,255,0.78)",fontSize:11,marginTop:2}}>Advisor empatik, pencatat pintar, dan coach uang harianmu.</div>
              
            </div>
            <button onClick={()=>setAiOpen(false)} style={{
              background:"rgba(255,255,255,0.15)",
              border:"1px solid rgba(255,255,255,0.2)",
              color:"white",borderRadius:10,
              padding:"7px 12px",cursor:"pointer",
              fontSize:12,fontWeight:700,fontFamily:"inherit",minWidth:44,height:36,
              touchAction:"manipulation",
              WebkitTapHighlightColor:"transparent",
              flexShrink:0,
            }}>Tutup</button>
          </div>

          {/* Messages */}
          <div className="ai-msgs-wrap" ref={aiMsgsRef}>
            {aiMsgs.map((m,i)=>(
              <div key={i}
                className={m.role==="user"?"ai-msg-user":"ai-msg-ai"}
                style={m.role!=="user"?{
                  background:dark?"#2D1B69":"#F0EBFF",
                  color:dark?"#E9D5FF":"#1F1035",
                  border:`1px solid ${dark?"rgba(124,58,237,0.25)":"rgba(124,58,237,0.12)"}`,
                }:{}}
              >
                {m.role!=="user"&&i===0?<div style={{display:"inline-flex",alignItems:"center",gap:6,marginBottom:10,padding:"5px 10px",borderRadius:999,background:dark?"rgba(124,58,237,0.16)":"rgba(124,58,237,0.08)",color:dark?"#C4B5FD":"#6D28D9",fontSize:10,fontWeight:800}}>SIAP BANTU</div>:null}{renderAiContent(m.content)}
              </div>
            ))}
            {aiLoading&&<div className="ai-typing-wrap" style={{background:dark?"#2D1B69":"#F0EBFF"}}><span/><span/><span/></div>}
          </div>

          {/* Quick actions */}
          <div style={{padding:"6px 12px 4px",display:"flex",gap:8,overflowX:"auto",flexShrink:0,WebkitOverflowScrolling:"touch"}}>
            {[{q:"Diagnosis kondisi uangku seperti dokter keuangan dan beri langkah hari ini",tag:"DIAGNOSIS"},{q:"Buat rencana hemat yang realistis dan tetap manusiawi dari dataku",tag:"HEMAT"},{q:"Review budget, cari kebocoran, dan kasih batas harian yang aman",tag:"BUDGET"},{q:"Bantu buat target nabung yang realistis dari saldo dan cashflowku",tag:"NABUNG"},{q:"Jadi coach habit uangku hari ini, apa yang harus aku selesaikan?",tag:"COACH"}].map(({q,tag})=>(
              <button key={q} className="ai-quick-btn"
                onClick={()=>handleAiSend(q)}
                style={{
                  background:dark?"#2D1B69":"#EDE9FE",
                  color:dark?"#C4B5FD":"#5B21B6",
                }}
              ><span style={{display:"inline-block",padding:"2px 6px",borderRadius:999,background:dark?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.55)",fontSize:9,fontWeight:800,marginRight:6}}>{tag}</span>{q.replace(" dan beri 3 langkah paling penting","").replace(" dari dataku","").replace(" dari saldo dan cashflowku","")}</button>
            ))}
          </div>

          {/* Input area */}
          <div style={{
            padding:"8px 12px",
            paddingBottom:"calc(env(safe-area-inset-bottom) + 8px)",
            borderTop:`1px solid ${dark?"rgba(124,58,237,0.2)":"#E9D5FF"}`,
            background:dark?"#130929":"#fff",
            flexShrink:0,
            display:"flex",gap:8,alignItems:"flex-end",
          }}>
            <textarea
              className="ai-textarea"
              value={aiInput}
              onChange={e=>{setAiInput(e.target.value);e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,120)+"px";}}
              onFocus={()=>setTimeout(()=>{if(aiMsgsRef.current) aiMsgsRef.current.scrollTop=aiMsgsRef.current.scrollHeight;},180)}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleAiSend();}}}
              placeholder={lang==="en"?"Message... e.g: paid electricity 50k":"Tulis pesan... misalnya: bantu atur budget makan bulan ini"}
              rows={1}
              style={{
                border:`1.5px solid ${dark?"#5B21B6":"#C4B5FD"}`,
                background:dark?"#2D1B69":"#F5F3FF",
                color:dark?"#E9D5FF":"#1F1035",
              }}
            />
            <button
              className="ai-send-btn"
              onClick={()=>handleAiSend()}
              disabled={aiLoading||!aiInput.trim()}
              style={{
                background:aiLoading||!aiInput.trim()?"#9CA3AF":"linear-gradient(135deg,#7C3AED,#5B21B6)",
                color:"white",
                opacity:aiLoading||!aiInput.trim()?0.6:1,
              }}
            ><span style={{fontSize:12,fontWeight:900}}>Kirim</span></button>
          </div>
        </div>
      </>}
      {/* ═══════ END AI ═══════ */}
    </ThemeCtx.Provider>
  );
}

