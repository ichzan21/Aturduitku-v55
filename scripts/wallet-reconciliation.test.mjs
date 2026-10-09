import assert from "node:assert/strict";
import { reconcileWalletBalance, validBalanceDate, walletBalanceAtDate } from "../src/walletReconciliation.js";
import { summarizeTransactions } from "../src/reportPeriod.js";
import { moneyNumber, applyTransactionToWallets } from "../src/financeLedger.js";

const initial={bulan:"Oktober",tahun:"2026",dompet:[{id:"bsi",nama:"BSI",saldo:"1000000"},{id:2,nama:"Tunai",saldo:"200000"}],txs:[
  {id:1,tipe:"pengeluaran",dompetId:"bsi",jml:"100000",tgl:"2026-10-05"},
  {id:2,tipe:"pemasukan",dompetId:"bsi",jml:"300000",tgl:"2026-10-06"},
  {id:3,tipe:"pengeluaran",dompetId:2,jml:"50000",tgl:"2026-10-05"},
]};
assert.equal(walletBalanceAtDate(initial.dompet[0],initial.txs,"2026-10-04"),800000);
const options={walletId:"bsi",actual:"500.000",date:"2026-10-04",today:"2026-10-09",id:4};
const result=reconcileWalletBalance(initial,options);
assert.equal(result.state.dompet[0].saldo,"700000","Historical correction preserves later income/expense");
assert.equal(result.state.dompet[1].saldo,"200000");
assert.equal(result.transaction.tgl,"2026-10-04");
assert.equal(result.transaction.adjustmentDelta,-300000);
assert.deepEqual(summarizeTransactions(result.state.txs,moneyNumber),summarizeTransactions(initial.txs,moneyNumber),"Corrections must not fabricate cashflow");
assert.equal(walletBalanceAtDate(result.state.dompet[0],result.state.txs,"2026-10-04"),500000);
assert.equal(reconcileWalletBalance(result.state,options).transaction,null,"Repeated correction must not double debit");
assert.equal(applyTransactionToWallets(result.state.dompet,result.transaction,-1)[0].saldo,"1000000","Undo must restore previous balance");
assert.equal(initial.dompet[0].saldo,"1000000","Source state must not be mutated");
for(const date of ["2026-10-10","2026-02-30","","bad"]){
  assert.equal(validBalanceDate(date,options.today),false);
  assert.ok(reconcileWalletBalance(initial,{...options,date}).error);
}
for(const actual of ["", "-1", "abc", "999999999999999999999999"])
  assert.ok(reconcileWalletBalance(initial,{...options,actual}).error);
assert.equal(reconcileWalletBalance(initial,{...options,actual:"0"}).state.dompet[0].saldo,"200000");
assert.ok(reconcileWalletBalance(initial,{...options,walletId:"missing"}).error);
console.log("Historical wallet reconciliation tests passed");
