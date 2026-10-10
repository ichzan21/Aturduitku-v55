import React, { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChartNoAxesCombined, Check, ChevronDown, LogIn, MessageCircle, ShieldCheck, Target, Wallet } from "lucide-react";
import "./PublicLanding.css";

const features = [
  { id:"wallet", label:"Dompet", icon:Wallet, title:"Uangmu tersebar. Catatannya tidak perlu.", copy:"Rekening bank, e-wallet, dan tunai dalam satu tempat. Catat perpindahan uang dan cocokkan saldo dengan kondisi sebenarnya.", image:"wallet.png" },
  { id:"budget", label:"Budget", icon:Target, title:"Kasih setiap kebutuhan batas yang jelas.", copy:"Susun alokasi per kategori, lihat realisasi dari transaksi, dan cek rinciannya. Jadi tahu kapan masih aman dan kapan perlu mengerem.", image:"budget.png" },
  { id:"reports", label:"Laporan", icon:ChartNoAxesCombined, title:"Bukan cuma angka. Ada cerita di baliknya.", copy:"Lihat pemasukan, pengeluaran, dan perkembangan keuangan per periode. Bawa laporanmu ke PDF untuk ditinjau kembali.", image:"reports.png" },
];
const examples = [
  { question:"Bantu saya mulai mengatur uang.", answer:"Mulai dari saldo yang benar-benar kamu punya. Tambahkan rekening dan tunai di Dompet, catat transaksi, lalu tentukan batas bulanan di Budget. Setelah datanya terisi, kita bisa membaca polanya bersama." },
  { question:"Catat makan 25 ribu dari tunai.", answer:"Dokter Keuangan dapat membaca nominal, kebutuhan, dan dompet dari kalimatmu untuk membantu pencatatan. Periksa detail dan hasilnya; jika sumber uang belum jelas, lengkapi dulu sebelum dicatat." },
  { question:"Apa yang bisa saya evaluasi bulan ini?", answer:"Dengan data akunmu, Dokter Keuangan membantu membaca cashflow, saving rate, dan penggunaan budget. Tanyakan kategori mana yang perlu diperhatikan, lalu susun langkah kecil yang realistis." },
];

export default function PublicLanding() {
  const [selected, setSelected] = useState(0);
  const [example, setExample] = useState(0);
  const root = useRef(null);
  useEffect(() => {
    const nodes = root.current?.querySelectorAll("[data-reveal]") || [];
    if (!window.IntersectionObserver) return;
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); }
    }), { threshold:0.12 });
    nodes.forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, []);
  const current = features[selected];
  return <div className="public-site" ref={root}>
    <a className="public-skip" href="#public-main">Lewati ke konten</a>
    <header className="public-header">
      <a className="public-brand" href="#home" aria-label="AturDuitku, beranda"><img src="/icon-192.png" alt="" width="40" height="40"/><span>AturDuitku</span></a>
      <nav aria-label="Navigasi halaman publik"><a href="#fitur">Fitur</a><a href="#dokter-keuangan">Dokter Keuangan</a><a href="#pertanyaan">Tanya jawab</a></nav>
      <a className="public-login" href="#login"><LogIn size={17}/> Login</a>
    </header>
    <main id="public-main">
      <section className="public-hero" aria-labelledby="public-title">
        <div className="public-hero-copy">
          <p className="public-kicker">TEMAN FINANSIAL HARIANMU</p>
          <h1 id="public-title">AturDuitku</h1>
          <h2>Lebih paham uangmu.<br/>Lebih tenang jalani harimu.</h2>
          <p>Catat yang keluar, rencanakan yang penting, dan tumbuhkan kebiasaan baik. Ditemani Dokter Keuangan, AI yang membantu memahami catatanmu.</p>
          <div className="public-actions"><a className="public-primary" href="#login">Mulai atur uangmu <ArrowUpRight size={19}/></a><a className="public-text-link" href="#fitur">Lihat aplikasinya <ChevronDown size={17}/></a></div>
          <span className="public-device-note">Di HP atau laptop. Satu akun, catatan yang sama.</span>
        </div>
        <div className="public-hero-product">
          <picture><source media="(max-width: 600px)" srcSet="/landing/mobile-home.png"/><img src="/landing/home.png" alt="Dashboard AturDuitku dengan batas belanja harian, saldo, dan ringkasan keuangan menggunakan data demo" width="1280" height="900" fetchPriority="high"/></picture>
          <img className="public-mascot" src="/landing/mascot.png" alt="Maskot AturDuitku menunjuk dashboard" width="220" height="220"/>
        </div>
        <p className="public-demo-note">Tampilan aplikasi dengan data demo. Bukan data pengguna.</p>
      </section>
      <section className="public-intro public-container" data-reveal>
        <p className="public-kicker">DARI CATATAN KE KEBIASAAN</p>
        <h2>Gajian punya rencana.<br/>Pengeluaran punya cerita.</h2>
        <p>Uang tidak harus terasa seperti teka-teki. Mulai dari catatan sederhana, lalu lihat gambaran besarnya: kebutuhan hari ini, target yang sedang dikejar, dan ruang untuk masa depan.</p>
      </section>
      <section className="public-feature-section" id="fitur" aria-labelledby="features-title">
        <div className="public-container" data-reveal>
          <div className="public-section-heading"><div><p className="public-kicker">KENALI APLIKASINYA</p><h2 id="features-title">Semua catatan, saling terhubung.</h2></div><p>Dari saldo dompet sampai laporan.<br/>Tidak perlu pindah-pindah spreadsheet.</p></div>
          <div className="public-tabs" role="tablist" aria-label="Lihat fitur aplikasi">{features.map((feature, index) => <button key={feature.id} id={`tab-${feature.id}`} role="tab" aria-selected={selected===index} aria-controls="public-feature-panel" tabIndex={selected===index?0:-1} onClick={()=>setSelected(index)} onKeyDown={event=>{if(["ArrowLeft","ArrowRight","Home","End"].includes(event.key)){event.preventDefault();const next=event.key==="Home"?0:event.key==="End"?features.length-1:(index+(event.key==="ArrowRight"?1:-1)+features.length)%features.length;setSelected(next);event.currentTarget.parentElement.children[next].focus();}}}><feature.icon size={18}/>{feature.label}</button>)}</div>
          <div id="public-feature-panel" role="tabpanel" aria-labelledby={`tab-${current.id}`} className="public-feature-panel"><div className="public-feature-copy"><h3>{current.title}</h3><p>{current.copy}</p><a className="public-text-link" href="#login">Buka AturDuitku <ArrowUpRight size={17}/></a></div><img key={current.image} src={`/landing/${current.image}`} alt={`Tampilan ${current.label} AturDuitku dengan data demo`} loading="lazy" width="1280" height="900"/></div>
          <div className="public-extra-features"><p><Check size={18}/> Goals untuk target tabungan</p><p><Check size={18}/> Amplop untuk dana terencana</p><p><Check size={18}/> Utang, piutang, dan jatuh tempo</p><p><Check size={18}/> Habit untuk menjaga konsistensi</p></div>
        </div>
      </section>
      <section className="public-ai public-container" id="dokter-keuangan" aria-labelledby="ai-title" data-reveal>
        <div className="public-ai-heading"><p className="public-kicker">ADVANCED AI, BAHASA SEHARI-HARI</p><h2 id="ai-title">Kenalan dengan<br/><span>Dokter Keuangan.</span></h2><p>Bukan sekadar menjawab pertanyaan. Dokter Keuangan membantu membaca data akunmu, memahami pola uang, dan menjalankan pencatatan yang didukung saat kamu memintanya dengan jelas.</p></div>
        <div className="public-ai-layout"><div className="public-ai-capabilities"><article><MessageCircle/><h3>Ngobrol, tidak perlu rumus.</h3><p>Tanyakan cashflow, budget, atau langkah awal. Jawabannya memakai konteks catatan yang tersedia di akunmu.</p></article><article><Wallet/><h3>Bantu catat lewat percakapan.</h3><p>Sebutkan transaksi, nominal, dan dompet. AI membantu memahami maksudmu; detail yang ambigu perlu diperjelas.</p></article><article><ShieldCheck/><h3>Kamu tetap pegang kendali.</h3><p>Pertanyaan dan simulasi bukan perintah mengubah data. Periksa hasil pencatatan dan gunakan edit bila perlu.</p></article></div>
          <div className="public-ai-demo"><div className="public-ai-demo-header"><img src="/icon-192.png" width="42" height="42" alt=""/><div><strong>Dokter Keuangan</strong><span>Contoh percakapan, bukan analisis akunmu</span></div></div><div className="public-question">{examples[example].question}</div><div className="public-answer" key={example}><p>{examples[example].answer}</p></div><div className="public-prompts" aria-label="Pilih contoh percakapan">{["Mulai dari mana?","Bantu catat","Evaluasi uang"].map((label,index)=><button key={label} aria-pressed={example===index} onClick={()=>setExample(index)}>{label}</button>)}</div></div>
        </div><p className="public-ai-disclaimer">AI bisa keliru. Kualitas analisis bergantung pada kelengkapan catatanmu. Dokter Keuangan adalah alat bantu, bukan pengganti penasihat keuangan profesional.</p>
      </section>
      <section className="public-faq" id="pertanyaan"><div className="public-container" data-reveal><div><p className="public-kicker">SEBELUM MULAI</p><h2>Biar tidak ada<br/>yang mengganjal.</h2></div><div>{[
        ["Sudah punya akun. Login di mana?","Klik Login di kanan atas. Kamu akan masuk ke halaman login AturDuitku yang sama, dengan Google atau email. Gunakan akun dan metode masuk yang sebelumnya dipakai."],
        ["Harus memasang aplikasi dulu?","Tidak. AturDuitku bisa dibuka lewat browser di HP dan laptop. Kamu juga bisa menambahkannya ke layar utama melalui fitur instalasi PWA yang tersedia."],
        ["Apakah rekening bank terhubung otomatis?","Dompet adalah catatan saldo rekening, e-wallet, atau tunai. Transaksi perlu kamu catat atau impor melalui fitur Import Mutasi; bukan koneksi otomatis ke bank."],
        ["Bagaimana akses untuk akun baru?","Buat akun melalui halaman login. Akses penuh mengikuti proses pemeriksaan pembayaran dan persetujuan admin. Hubungi admin jika butuh bantuan aktivasi."],
      ].map(([question,answer])=><details key={question}><summary>{question}<ChevronDown size={19}/></summary><p>{answer}</p></details>)}</div></div></section>
      <section className="public-closing public-container" data-reveal><img src="/icon-192.png" alt="" width="64" height="64"/><h2>Mulai dari uang yang ada.<br/>Bangun kebiasaan yang bertahan.</h2><p>Tidak perlu menunggu semuanya rapi untuk mulai merapikannya.</p><a className="public-primary" href="#login">Masuk ke AturDuitku <LogIn size={18}/></a></section>
    </main>
    <footer className="public-footer public-container"><a className="public-brand" href="#home"><img src="/icon-192.png" alt="" width="32" height="32"/>AturDuitku</a><p>Catat, paham, dan tumbuh lebih rapi.</p><a href="https://wa.me/6287785472696" target="_blank" rel="noreferrer">Hubungi admin <ArrowUpRight size={15}/></a><span>© {new Date().getFullYear()} AturDuitku</span></footer>
  </div>;
}
