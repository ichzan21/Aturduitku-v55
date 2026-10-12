import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

const stageLabels = {
  app: 'Membuka AturDuitku...',
  auth: 'Memeriksa sesi login...',
  data: 'Memuat data keuangan dari server...',
};

export default function AppBoot({ stage = 'app' }) {
  const [slow, setSlow] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    // Count from navigation, including time spent loading the application chunk.
    const timer = setTimeout(() => setSlow(true), Math.max(0, 8000 - performance.now()));
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);
  return (
    <main className="app-boot" data-testid="app-boot" data-stage={stage}>
      <img className="app-boot-logo" src="/icon-192.png" alt="" width="84" height="84" />
      <h1>AturDuitku</h1>
      <p role="status" aria-live="polite">{online ? stageLabels[stage] : 'Koneksi internet terputus.'}</p>
      <div className="app-boot-progress" aria-hidden="true"><span /></div>
      <div className="app-boot-help">
        {(slow || !online) && <>
          <p>{online ? 'Pemuatan lebih lama dari biasanya.' : 'Sambungkan internet, lalu coba lagi.'}</p>
          <p className="app-boot-safe">Muat ulang tidak menghapus data atau keluar dari akun.</p>
          <button type="button" onClick={() => window.location.reload()}><RefreshCw size={17} aria-hidden="true" />Muat ulang</button>
        </>}
      </div>
    </main>
  );
}
