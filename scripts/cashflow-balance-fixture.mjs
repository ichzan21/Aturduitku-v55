import { applyTransactionToWallets } from '../src/financeLedger.js';

export const cashflowBalanceTransactions = [
  {id:1,tipe:'pemasukan',jml:'500000',tgl:'2026-09-10',ket:'Gaji September',dompetId:'cash'},
  {id:2,tipe:'pemasukan',jml:'3000000',tgl:'2026-10-10',ket:'Gaji Oktober',dompetId:'cash'},
  {id:3,tipe:'pengeluaran',jml:'800000',tgl:'2026-10-11',ket:'Belanja Oktober',dompetId:'cash'},
  {id:4,tipe:'tabungan',jml:'200000',tgl:'2026-10-12',ket:'Tabungan Oktober',dompetId:'cash'},
  {id:5,tipe:'piutang_keluar',jml:'100000',tgl:'2026-10-13',ket:'Pinjaman ke teman',dompetId:'cash'},
  {id:6,tipe:'piutang_masuk',jml:'50000',tgl:'2026-10-14',ket:'Pengembalian teman',dompetId:'cash'},
  {id:7,tipe:'penyesuaian',jml:'25000',adjustmentDelta:'25000',tgl:'2026-10-15',ket:'Koreksi saldo',dompetId:'cash'},
  {id:8,tipe:'transfer',jml:'100000',tgl:'2026-10-16',ket:'Pindah ke bank',dompetId:'cash',dompetTo:'bank'},
];

export const cashflowBalanceWallets = cashflowBalanceTransactions.reduce((wallets,tx)=>applyTransactionToWallets(wallets,tx), [
  {id:'cash',nama:'Tunai QA',tipe:'Tunai',icon:'CASH',saldo:'1000000'},
  {id:'bank',nama:'Bank QA',tipe:'Bank',icon:'BANK',saldo:'500000'},
]);
