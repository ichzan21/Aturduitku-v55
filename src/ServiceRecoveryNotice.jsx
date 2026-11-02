import React, { useEffect, useState } from 'react';
import { Clock3, ShieldCheck, Wrench } from 'lucide-react';
import { recoveryCountdown, SERVICE_RECOVERY_AT } from './serviceRecovery.js';
import './ServiceRecoveryNotice.css';

export default function ServiceRecoveryNotice({variant='panel',tone='dark'}) {
  const [now,setNow]=useState(Date.now);
  const countdown=recoveryCountdown(now);
  useEffect(()=>{
    if(recoveryCountdown().expired) return undefined;
    const update=()=>{
      if(document.hidden) return;
      const time=Date.now();
      setNow(time);
      if(recoveryCountdown(time).expired) clearInterval(timer);
    };
    const timer=setInterval(update,1000);
    document.addEventListener('visibilitychange',update);
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update);};
  },[]);

  return <section className={`service-recovery service-recovery--${variant} service-recovery--${tone}`} lang="id" aria-label="Informasi pemulihan layanan" data-testid="service-recovery-notice">
    <div className="service-recovery-heading">
      <div className="service-recovery-mascot" aria-hidden="true">
        <img src="/landing/mascot-think.webp" alt="" width="72" height="72"/>
        <Wrench size={19} className="service-recovery-tool"/>
      </div>
      <div>
        <h2 className="service-recovery-title">Kami sedang memulihkan layanan</h2>
        <p className="service-recovery-copy">Sebagian akses dan sinkronisasi sedang terganggu. Tim sedang melakukan perbaikan.</p>
      </div>
    </div>
    <div className="service-recovery-estimate">
      <p className="service-recovery-deadline"><Clock3 size={15} aria-hidden="true"/><span>Estimasi pemulihan<br/><time dateTime={SERVICE_RECOVERY_AT}>2 November 2026, <strong>16.00 WITA</strong></time></span></p>
      {!countdown.expired ? <div className="service-recovery-clock" role="timer" aria-live="off" aria-label={`${countdown.hours} jam ${countdown.minutes} menit ${countdown.seconds} detik menuju estimasi pemulihan`} data-testid="service-recovery-countdown">
        {[[countdown.hours,'Jam'],[countdown.minutes,'Menit'],[countdown.seconds,'Detik']].map(([value,label])=><div className="service-recovery-unit" key={label}><strong data-unit={label}>{String(value).padStart(2,'0')}</strong><span>{label}</span></div>)}
      </div> : <p className="service-recovery-checking" role="status" data-testid="service-recovery-checking">Waktu estimasi sudah terlewati. Kami masih memeriksa pemulihan layanan. Silakan cek status lagi.</p>}
    </div>
    <p className="service-recovery-safety"><ShieldCheck size={17} aria-hidden="true"/><span>Ini gangguan layanan, bukan penolakan akun atau hilangnya akses admin. Data tidak dihapus. Jangan reset aplikasi atau hapus cache selama gangguan.</span></p>
  </section>;
}
