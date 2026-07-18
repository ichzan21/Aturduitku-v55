import React, { useEffect, useState } from "react";

const statusLabel = (value) => value ? "Aktif" : "Belum dikonfigurasi";

export default function AdminMonitoringPanel({ authedJson, theme: T, isMobile, reportError }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await authedJson("/api/admin/monitoring", { method:"GET" }));
    } catch (requestError) {
      setError(requestError.message || "Monitoring belum dapat dimuat");
      reportError?.(requestError, { type:"admin_monitoring", component:"AdminMonitoringPanel" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const testTelegram = async () => {
    setTesting(true);
    setTestResult("");
    try {
      await authedJson("/api/admin/monitoring", { method:"POST", body:JSON.stringify({ action:"test_telegram" }) });
      setTestResult("Pesan tes berhasil dikirim ke Telegram admin.");
    } catch (requestError) {
      setTestResult(requestError.message || "Pesan tes belum dapat dikirim.");
    } finally {
      setTesting(false);
    }
  };

  const services = data?.services || {};
  const serviceItems = [
    ["AI", services.ai],
    ["Telegram", services.telegram],
    ["Backup", services.backup],
    ["Firebase", services.firebase],
  ];

  return (
    <section style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:14,padding:isMobile?14:18,boxShadow:T.shadow,marginBottom:18}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap",marginBottom:14}}>
        <div>
          <div style={{fontSize:10,fontWeight:900,color:T.accent,letterSpacing:1.1,textTransform:"uppercase",marginBottom:4}}>Monitoring Produksi</div>
          <div style={{fontSize:16,fontWeight:900,color:T.text}}>Kesehatan aplikasi</div>
          <div style={{fontSize:11,color:T.muted,marginTop:3}}>Ringkasan privat untuk admin. Kunci API dan data sensitif tidak pernah ditampilkan.</div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button type="button" onClick={testTelegram} disabled={testing} style={{padding:"8px 12px",borderRadius:9,border:`1px solid ${T.okBorder}`,background:T.okBg,color:T.ok,fontWeight:800,fontSize:11,cursor:testing?"wait":"pointer",fontFamily:"inherit"}}>{testing?"Mengirim...":"Tes Telegram"}</button>
          <button type="button" onClick={load} disabled={loading} style={{padding:"8px 12px",borderRadius:9,border:`1px solid ${T.border}`,background:T.cardAlt,color:T.accent,fontWeight:800,fontSize:11,cursor:loading?"wait":"pointer",fontFamily:"inherit"}}>{loading?"Memuat...":"Refresh"}</button>
        </div>
      </div>

      {error && <div style={{padding:"10px 12px",borderRadius:10,background:T.errBg,border:`1px solid ${T.errBorder}`,color:T.err,fontSize:12,marginBottom:12}}>{error}</div>}
      {testResult && <div style={{padding:"10px 12px",borderRadius:10,background:T.infoBg,border:`1px solid ${T.infoBorder}`,color:T.info,fontSize:11,fontWeight:700,marginBottom:12}}>{testResult}</div>}

      <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,minmax(0,1fr))":"repeat(3,minmax(0,1fr))",gap:10,marginBottom:14}}>
        {[
          ["Error 24 jam", data?.summary?.last24Hours ?? "-", T.err, T.errBg],
          ["Lambat 1 jam", data?.summary?.performance1Hour ?? "-", T.warn, T.warnBg],
          ["Belum selesai", data?.summary?.unresolved ?? "-", T.info, T.infoBg],
        ].map(([label,value,color,bg]) => <div key={label} style={{padding:"12px 13px",borderRadius:11,background:bg,border:`1px solid ${T.border}`}}><div style={{fontSize:9,fontWeight:800,color:T.muted,textTransform:"uppercase",letterSpacing:.8}}>{label}</div><div style={{fontSize:21,fontWeight:900,color,marginTop:3}}>{value}</div></div>)}
      </div>

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"minmax(260px,.8fr) minmax(0,1.2fr)",gap:14}}>
        <div>
          <div style={{fontSize:11,fontWeight:900,color:T.text,marginBottom:8}}>Layanan produksi</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>
            {serviceItems.map(([label,active]) => <div key={label} style={{padding:"10px",borderRadius:10,background:T.cardAlt,border:`1px solid ${active?T.okBorder:T.warnBorder}`}}><div style={{fontSize:11,fontWeight:800,color:T.text}}>{label}</div><div style={{fontSize:9,color:active?T.ok:T.warn,fontWeight:800,marginTop:3}}>{statusLabel(active)}</div></div>)}
          </div>
        </div>
        <div style={{minWidth:0}}>
          <div style={{fontSize:11,fontWeight:900,color:T.text,marginBottom:8}}>Aktivitas terbaru</div>
          <div style={{display:"grid",gap:7,maxHeight:230,overflowY:"auto"}}>
            {(data?.recent || []).slice(0,8).map((event) => {const incident=event.category==="incident";const label=event.category==="performance"?"Peringatan performa":event.type==="api_network_error"?"Koneksi perangkat terputus":event.category==="operational"?"Perlindungan sinkronisasi":"Insiden";return <div key={event.id} style={{padding:"9px 10px",borderRadius:9,background:T.cardAlt,border:`1px solid ${T.border}`,minWidth:0}}><div style={{display:"flex",justifyContent:"space-between",gap:8}}><span style={{fontSize:10,fontWeight:900,color:incident?T.err:T.warn,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{event.type || "client_error"}</span><span style={{fontSize:9,color:T.muted,flexShrink:0}}>{event.createdAt?new Date(event.createdAt).toLocaleString("id-ID",{dateStyle:"short",timeStyle:"short"}):"-"}</span></div><div style={{fontSize:9,fontWeight:800,color:incident?T.err:T.warn,marginTop:3}}>{label}</div><div style={{fontSize:10,color:T.sub,marginTop:3,overflowWrap:"anywhere"}}>{event.message || "Tanpa detail"}</div></div>;})}
            {!loading && !(data?.recent || []).length && <div style={{padding:"18px 12px",textAlign:"center",borderRadius:10,background:T.okBg,color:T.ok,fontSize:11,fontWeight:800}}>Belum ada aktivitas monitoring.</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
