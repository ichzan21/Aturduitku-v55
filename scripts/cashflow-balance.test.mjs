import assert from 'node:assert/strict';
import { summarizeTransactions, filterTransactionsByPeriod } from '../src/reportPeriod.js';
import { filterTransactionsForList } from '../src/transactionList.js';
import { moneyNumber } from '../src/financeLedger.js';
import { cashflowBalanceTransactions as txs, cashflowBalanceWallets as wallets } from './cashflow-balance-fixture.mjs';

const summary=rows=>summarizeTransactions(rows,moneyNumber);
const balances=JSON.stringify(wallets);
assert.equal(wallets.reduce((sum,w)=>sum+moneyNumber(w.saldo),0),3975000);
assert.equal(summary(txs).net,2500000,'All-date cash flow is not the current wallet balance');
assert.equal(summary(filterTransactionsByPeriod(txs,'monthly','2026-10-28')).net,2000000);
assert.equal(summary(filterTransactionsForList(txs,{type:'pengeluaran'})).net,-800000,'A negative filtered result is not a negative wallet balance');
assert.equal(summary(filterTransactionsForList(txs,{walletId:'bank'})).net,0,'Receiving an internal transfer is not income');
assert.equal(summary(filterTransactionsForList(txs,{search:'Gaji Oktober'})).net,3000000);
assert.equal(summary(filterTransactionsForList(txs,{search:'not found'})).net,0);
assert.equal(JSON.stringify(wallets),balances,'Filters and cash-flow explanations must not alter balances');
console.log('Net cash flow versus current wallet balance tests passed');
