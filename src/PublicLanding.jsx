import React, { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChartNoAxesCombined, Check, ChevronDown, LogIn, MessageCircle, ShieldCheck, Target, Wallet } from "lucide-react";
import "./PublicLanding.css";

const features = [
  { id:"wallet", label:"Dompet", icon:Wallet, title:"Uangmu tersebar. Catatannya tidak perlu.", copy:"Rekening bank, e-wallet, dan tunai dalam satu tempat. Catat perpindahan uang dan cocokkan saldo dengan kondisi sebenarnya.", image:"wallet.png" },
  { id:"budget", label:"Budget", icon:Target, title:"Kasih setiap kebutuhan batas yang jelas.", copy:"Susun alokasi per kategori, lihat realisasi dari transaksi, dan cek rinciannya. Jadi tahu kapan masih aman dan kapan perlu mengerem.", image:"budget.png" },
  { id:"reports", label:"Laporan", icon:ChartNoAxesCombined, title:"Bukan cuma angka. Ada cerita di baliknya.", copy:"Lihat pemasukan, pengeluaran, dan perkembangan keuangan per periode. Bawa laporanmu ke PDF untuk ditinjau kembali.", image:"reports.png" },
];
const examples = [
  { question:"Bantu saya mulai mengatur uang.", answer:"Boleh. Kita mulai dari uang yang benar-benar ada dulu, ya.", points:["Isi saldo awal rekening dan tunai di Dompet.","Catat pemasukan dan pengeluaranmu.","Pasang batas di Budget, lalu baca polanya bareng."] },
  { question:"Catat makan 25 ribu dari tunai.", answer:"Dari kalimatmu, detail transaksinya bisa dibaca seperti ini. Pastikan dompet dan kategorinya sesuai sebelum meminta pencatatan.", details:[["Jenis","Pengeluaran"],["Jumlah","Rp 25.000"],["Dompet","Tunai"],["Kategori","Makan & Minum"]] },
  { question:"Apa yang bisa saya evaluasi bulan ini?", answer:"Mulai dari tiga hal ini. Analisis AI di aplikasi memakai catatan yang tersedia di akunmu.", points:["Cashflow: berapa yang masuk dan keluar?","Budget: kategori mana yang perlu diperhatikan?","Saving rate: berapa bagian pemasukan yang disisihkan?"] },
];

export default function PublicLanding() {
  const [selected, setSelected] = useState(0);
  const [example, setExample] = useState(0);
  const root = useRef(null);
  useEffect(() => {
    document.body.classList.add("atur-public-page");
    return () => document.body.classList.remove("atur-public-page");
  }, []);
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
      <nav aria-label="Navigasi halaman publik"><a href="#dokter-keuangan">Kenalan dengan AI</a><a href="#fitur">Isi aplikasinya</a><a href="#pertanyaan">Tanya jawab</a></nav>
      <a className="public-login" href="#login"><LogIn size={17}/> Login</a>
    </header>
    <main id="public-main">
      <section className="public-hero" aria-labelledby="public-title">
        <div className="public-hero-copy">
          <p className="public-kicker">Uang ada ceritanya. Yuk, pahami bareng.</p>
          <h1 id="public-title">AturDuitku</h1>
          <h2>Asisten <span className="public-ai-word">AI</span> untuk<br/>uang sehari-hari.</h2>
          <p>Habis buat apa, masih cukup berapa? Catat uangmu, atur budget, lalu ngobrol dengan <strong>Dokter Keuangan AI</strong> untuk membaca polanya.</p>
          <div className="public-actions"><a className="public-primary" href="#login">Mulai atur uangmu <LogIn size={19}/></a><a className="public-text-link" href="#dokter-keuangan">Kenalan dengan AI <ChevronDown size={17}/></a></div>
          <span className="public-device-note">Di HP atau laptop. Satu akun, catatan yang sama.</span>
        </div>
        <div className="public-hero-scene">
          <div className="public-mascot-greeting"><span>Halo! Aku Dokter Keuangan.</span><strong>Teman AI buat<br/>ngobrolin uangmu.</strong></div>
          <img className="public-mascot" src="/landing/mascot.png" alt="Maskot kucing Dokter Keuangan menunjuk aplikasi AturDuitku" width="280" height="280"/>
          <div className="public-hero-product">
          <picture><source media="(max-width: 600px)" srcSet="/landing/mobile-home.png"/><img src="/landing/home.png" alt="Dashboard AturDuitku dengan batas belanja harian, saldo, dan ringkasan keuangan menggunakan data demo" width="1280" height="900" fetchPriority="high"/></picture>
          </div>
        </div>
        <p className="public-demo-note">Tampilan aplikasi dengan data demo. Bukan data pengguna.</p>
      </section>
      <section className="public-ai public-container" id="dokter-keuangan" aria-labelledby="ai-title" data-reveal>
        <div className="public-ai-heading"><p className="public-kicker">Kenalan dulu, yuk.</p><h2 id="ai-title">Dokter Keuangan.<br/><span>AI yang bisa diajak ngobrol.</span></h2><p>Enggak harus paham rumus untuk mulai paham uang. Tanyakan catatanmu, minta bantuan mencatat, atau cari langkah kecil untuk bulan ini.</p></div>
        <div className="public-ai-layout">
          <div className="public-ai-capabilities">
            <p className="public-ai-intro">Ketik seperti ngobrol dengan teman.<br/><strong>AI bantu memahami maksudmu.</strong></p>
            <article><MessageCircle/><h3>Ngobrol pakai konteks uangmu.</h3><p>Bahas cashflow, penggunaan budget, dan saving rate dari catatan yang tersedia. Bukan sekadar jawaban umum.</p></article>
            <article><Wallet/><h3>Kalimat biasa, bantu jadi catatan.</h3><p>Sebutkan transaksi, nominal, dan dompet. Dokter Keuangan AI membantu pencatatan yang didukung saat kamu memintanya dengan jelas.</p></article>
            <article><ShieldCheck/><h3>Keputusan tetap di tanganmu.</h3><p>Detail yang ambigu perlu diperjelas. Periksa hasil pencatatan dan edit bila perlu; bertanya atau simulasi bukan perintah mengubah data.</p></article>
          </div>
          <div className="public-ai-demo">
            <div className="public-ai-demo-header"><img src="/icon-192.png" width="42" height="42" alt=""/><div><strong>Dokter Keuangan AI</strong><span>Contoh percakapan, bukan analisis akunmu</span></div></div>
            <div className="public-prompts" aria-label="Pilih contoh percakapan">{["Mulai dari mana?","Bantu catat","Evaluasi uang"].map((label,index)=><button key={label} aria-pressed={example===index} onClick={()=>setExample(index)}>{label}</button>)}</div>
            <div className="public-conversation" aria-live="polite" aria-atomic="true">
              <div className="public-question">{examples[example].question}</div>
              <div className="public-answer" key={example}><p>{examples[example].answer}</p>
                {examples[example].points && <ul>{examples[example].points.map(point=><li key={point}><Check size={16}/><span>{point}</span></li>)}</ul>}
                {examples[example].details && <dl className="public-demo-transaction">{examples[example].details.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
              </div>
            </div>
            <p className="public-example-note">Simulasi fitur. Tidak mencatat transaksi atau mengubah saldo.</p>
          </div>
        </div><p className="public-ai-disclaimer">AI bisa keliru. Kualitas analisis bergantung pada kelengkapan catatanmu. Dokter Keuangan adalah alat bantu, bukan pengganti penasihat keuangan profesional.</p>
      </section>
      <section className="public-intro public-container" data-reveal>
        <p className="public-kicker">Biar uangmu enggak cuma lewat.</p>
        <h2>Gajian: senang.<br/>Akhir bulan: tetap punya rencana.</h2>
        <p>Mulai dari catatan sederhana. Lalu lihat gambaran besarnya: kebutuhan hari ini, target yang sedang dikejar, dan ruang untuk masa depan. Pelan-pelan juga boleh.</p>
      </section>
      <section className="public-feature-section" id="fitur" aria-labelledby="features-title">
        <div className="public-container" data-reveal>
          <div className="public-section-heading"><div><p className="public-kicker">KENALI APLIKASINYA</p><h2 id="features-title">Semua catatan, saling terhubung.</h2></div><p>Dari saldo dompet sampai laporan.<br/>Tidak perlu pindah-pindah spreadsheet.</p></div>
          <div className="public-tabs" role="tablist" aria-label="Lihat fitur aplikasi">{features.map((feature, index) => <button key={feature.id} id={`tab-${feature.id}`} role="tab" aria-selected={selected===index} aria-controls="public-feature-panel" tabIndex={selected===index?0:-1} onClick={()=>setSelected(index)} onKeyDown={event=>{if(["ArrowLeft","ArrowRight","Home","End"].includes(event.key)){event.preventDefault();const next=event.key==="Home"?0:event.key==="End"?features.length-1:(index+(event.key==="ArrowRight"?1:-1)+features.length)%features.length;setSelected(next);event.currentTarget.parentElement.children[next].focus();}}}><feature.icon size={18}/>{feature.label}</button>)}</div>
          <div id="public-feature-panel" role="tabpanel" aria-labelledby={`tab-${current.id}`} className="public-feature-panel"><div className="public-feature-copy"><h3>{current.title}</h3><p>{current.copy}</p><a className="public-text-link" href="#login">Buka AturDuitku <ArrowUpRight size={17}/></a></div><img key={current.image} src={`/landing/${current.image}`} alt={`Tampilan ${current.label} AturDuitku dengan data demo`} loading="lazy" width="1280" height="900"/></div>
          <div className="public-extra-features"><p><Check size={18}/> Goals untuk target tabungan</p><p><Check size={18}/> Amplop untuk dana terencana</p><p><Check size={18}/> Utang, piutang, dan jatuh tempo</p><p><Check size={18}/> Habit untuk menjaga konsistensi</p></div>
        </div>
      </section>
      <section className="public-faq" id="pertanyaan"><div className="public-container" data-reveal><div><p className="public-kicker">SEBELUM MULAI</p><h2>Biar tidak ada<br/>yang mengganjal.</h2></div><div>{[
        ["AI-nya bisa bantu apa saja?","Dokter Keuangan AI membantu membaca cashflow, budget, dan saving rate menggunakan catatan yang tersedia, serta membantu pencatatan melalui percakapan. Berikan detail yang jelas dan periksa hasilnya. AI bisa keliru; ini bukan layanan penasihat keuangan profesional."],
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
