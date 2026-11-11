import {moneyNumber,sameId} from './financeLedger.js';
import {roundMoney} from './moneyValue.js';
import {compareTransactionsNewestFirst} from './transactionList.js';

const hasId=id=>(typeof id==='string'&&id.trim()!=='')||(typeof id==='number'&&Number.isFinite(id));
const activityTypes=new Set(['pengeluaran','alokasi_amplop','pengembalian_amplop']);

export function getEnvelopeHistory(transactions,envelopeId) {
  if(!hasId(envelopeId)||!Array.isArray(transactions))return [];
  return transactions.filter(tx=>tx&&hasId(tx.amplopId)&&sameId(tx.amplopId,envelopeId)&&activityTypes.has(tx.tipe))
    .sort(compareTransactionsNewestFirst);
}

export function summarizeEnvelopeHistory(rows=[]) {
  const total=type=>roundMoney(rows.filter(tx=>tx.tipe===type).reduce((sum,tx)=>sum+moneyNumber(tx.jml),0));
  return {
    spent:total('pengeluaran'),
    funded:total('alokasi_amplop'),
    returned:total('pengembalian_amplop'),
    spendingCount:rows.filter(tx=>tx.tipe==='pengeluaran').length,
    activityCount:rows.length,
  };
}
