import React,{useEffect,useMemo,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {useMoney} from './CurrencyContext.jsx';
import {findWallet,moneyNumber} from './financeLedger.js';
import {roundMoney} from './moneyValue.js';
import {getEnvelopeHistory,summarizeEnvelopeHistory} from './envelopeHistory.js';

export default function EnvelopeHistory({envelope,transactions,wallets,T,lang='id',onClose,transactionName}) {
  const english=lang==='en';
  const {IDR}=useMoney();
  const [mode,setMode]=useState('spending');
  const [limit,setLimit]=useState(20);
  const listRef=useRef(null);
  const nextFocus=useRef(null);
  useEffect(()=>{
    if(nextFocus.current===null)return;
    const row=listRef.current?.querySelector(`[data-history-index="${nextFocus.current}"]`);
    nextFocus.current=null;
    row?.focus({preventScroll:true});
    row?.scrollIntoView({block:'nearest'});
  },[limit]);
  const rows=useMemo(()=>getEnvelopeHistory(transactions,envelope?.id),[transactions,envelope?.id]);
  const summary=useMemo(()=>summarizeEnvelopeHistory(rows),[rows]);
  const filtered=mode==='spending'?rows.filter(tx=>tx.tipe==='pengeluaran'):rows;
  const difference=roundMoney(summary.spent-moneyNumber(envelope?.terpakai));
  const labels={pengeluaran:english?'Spending':'Pemakaian',alokasi_amplop:english?'Funding':'Pengisian',pengembalian_amplop:english?'Return to wallet':'Kembali ke dompet'};
  const closeLabel=english?'Close envelope history':'Tutup riwayat amplop';
  return <section data-testid="envelope-history" style={{minWidth:0}}>
    <header style={{display:'flex',gap:12,alignItems:'flex-start',marginBottom:16}}>
      <div style={{minWidth:0,flex:1}}>
        <h2 style={{fontSize:18,fontWeight:800,margin:'0 0 4px',color:T.text,overflowWrap:'anywhere'}}>{envelope?.nama||(english?'Envelope unavailable':'Amplop tidak tersedia')}</h2>
        <p style={{fontSize:12,color:T.sub,margin:0}}>{english?'Envelope history · All dates':'Riwayat amplop · Seluruh tanggal'}</p>
      </div>
      <button type="button" onClick={onClose} title={closeLabel} aria-label={closeLabel} style={{width:44,height:44,flexShrink:0,display:'grid',placeItems:'center',background:T.cardAlt,color:T.text,border:`1px solid ${T.inputBorder}`,borderRadius:8,cursor:'pointer'}}><X size={18} aria-hidden="true"/></button>
    </header>
    {envelope&&<>
      <dl style={{display:'flex',flexWrap:'wrap',gap:12,margin:'0 0 16px',paddingBottom:14,borderBottom:`1px solid ${T.border}`}}>
        <div style={{flex:'1 1 190px',minWidth:0}}><dt style={{fontSize:12,color:T.sub}}>{english?'Recorded spending':'Pemakaian tercatat'}</dt><dd data-testid="envelope-history-spent" style={{margin:'4px 0 0',fontSize:16,fontWeight:800,color:T.err,overflowWrap:'anywhere',fontVariantNumeric:'tabular-nums'}}>{IDR(summary.spent)}</dd></div>
        <div style={{flex:'1 1 190px',minWidth:0}}><dt style={{fontSize:12,color:T.sub}}>{english?'Currently used on card':'Terpakai pada kartu'}</dt><dd style={{margin:'4px 0 0',fontSize:16,fontWeight:800,color:T.text,overflowWrap:'anywhere',fontVariantNumeric:'tabular-nums'}}>{IDR(moneyNumber(envelope.terpakai))}</dd></div>
      </dl>
      {difference!==0&&<p data-testid="envelope-history-note" style={{fontSize:12,color:T.sub,lineHeight:1.6,margin:'0 0 14px'}}>{difference>0
        ?english?'History includes all recorded spending. The card amount may differ if spending was reset.':'Rincian mencakup seluruh pemakaian tercatat. Angka pada kartu bisa berbeda jika pemakaian pernah direset.'
        :english?'Only transactions still linked to this envelope are listed. Older records may not have an envelope link.':'Rincian hanya memuat transaksi yang masih terhubung ke amplop ini. Catatan lama mungkin belum memiliki tautan amplop.'}</p>}
      <div role="group" aria-label={english?'Envelope activity view':'Tampilan riwayat amplop'} style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:6,marginBottom:12}}>
        {[['spending',english?'Spending':'Pemakaian'],['all',english?'All activity':'Semua aktivitas']].map(([value,label])=><button key={value} type="button" aria-pressed={mode===value} onClick={()=>{setMode(value);setLimit(20);}} style={{minHeight:44,padding:'8px',border:`1.5px solid ${mode===value?T.accent:T.inputBorder}`,borderRadius:8,background:mode===value?T.accentBg:T.card,color:mode===value?T.accent:T.sub,fontSize:13,fontWeight:700,fontFamily:'inherit',cursor:'pointer'}}>{label}</button>)}
      </div>
      <p role="status" style={{fontSize:12,color:T.sub,margin:'0 0 6px'}}>{filtered.length} {english?'transactions':mode==='spending'?'transaksi pemakaian':'transaksi'}</p>
      {filtered.length?<ol ref={listRef} aria-label={english?'Envelope transactions':'Transaksi amplop'} style={{listStyle:'none',margin:0,padding:0}}>
        {filtered.slice(0,limit).map((tx,index)=>{
          const wallet=findWallet(wallets,tx.dompetId);
          const delta=(tx.tipe==='alokasi_amplop'?1:-1)*moneyNumber(tx.jml);
          const color=tx.tipe==='pengeluaran'?T.err:tx.tipe==='alokasi_amplop'?T.ok:T.info;
          return <li key={`${tx.id}-${index}`} tabIndex={-1} data-history-index={index} data-testid="envelope-history-row" data-activity-type={tx.tipe} style={{padding:'12px 0',borderBottom:`1px solid ${T.border}`,minWidth:0,outlineColor:T.accent,outlineOffset:2}}>
            <div style={{display:'flex',gap:8,alignItems:'baseline',justifyContent:'space-between',flexWrap:'wrap'}}>
              <strong style={{fontSize:13,color:T.text,minWidth:0,flex:'1 1 140px',overflowWrap:'anywhere'}}>{transactionName(tx)}</strong>
              <span style={{fontSize:13,fontWeight:800,color,overflowWrap:'anywhere',fontVariantNumeric:'tabular-nums',maxWidth:'100%'}}>{delta<0?'-':'+'}{IDR(Math.abs(delta))}</span>
            </div>
            <p style={{fontSize:12,color:T.sub,margin:'4px 0 0',overflowWrap:'anywhere'}}>{tx.tgl?<time dateTime={tx.tgl}>{tx.tgl}</time>:(english?'Date unavailable':'Tanggal tidak tersedia')}{' · '}{labels[tx.tipe]}{' · '}{wallet?.nama||(english?'Wallet unavailable':'Dompet tidak tersedia')}</p>
          </li>;
        })}
      </ol>:<p style={{color:T.sub,fontSize:13,padding:'18px 0',lineHeight:1.6}}>{mode==='spending'?(english?'No recorded spending for this envelope.':'Belum ada transaksi pemakaian untuk amplop ini.'):(english?'No recorded activity for this envelope.':'Belum ada aktivitas tercatat untuk amplop ini.')}</p>}
      {filtered.length>limit&&<button type="button" onClick={()=>{nextFocus.current=limit;setLimit(value=>value+20);}} style={{width:'100%',minHeight:44,marginTop:12,border:`1px solid ${T.inputBorder}`,borderRadius:8,color:T.accent,background:T.card,fontFamily:'inherit',fontSize:13,fontWeight:700,cursor:'pointer'}}>{english?'Show more':'Tampilkan lebih banyak'} ({Math.min(limit,filtered.length)}/{filtered.length})</button>}
    </>}
    <div style={{paddingTop:12,marginTop:8}}><button type="button" onClick={onClose} style={{width:'100%',minHeight:44,border:`1px solid ${T.inputBorder}`,borderRadius:8,background:T.card,color:T.text,fontFamily:'inherit',fontWeight:700,fontSize:13,cursor:'pointer'}}>{english?'Close':'Tutup'}</button></div>
  </section>;
}
