import { moneyNumber, sameId } from './financeLedger.js';

const hasId = value => value !== undefined && value !== null && value !== '';
const text = value => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
const isReceivable = debt => ['piutang', 'piutangBisnis'].includes(debt?.tipe);
const legacyName = tx => String(tx?.ket || '').match(/^(?:Bayar Utang\/Cicilan|Bayar utang|Terima Piutang\/Cicilan):\s*(.+)$/i)?.[1];
const targetId = tx => hasId(tx?.debtId) ? tx.debtId : tx?.piutangId;
const failure = () => Object.assign(new Error('Cicilan transaksi ini belum dapat dicocokkan dengan aman. Catatan belum dihapus; hubungi admin untuk pemeriksaan.'), {code:'DEBT_PAYMENT_UNRESOLVED'});

export const isDebtPayment = tx => ['piutang_masuk', 'piutang_masuk_goal'].includes(tx?.tipe)
  || (tx?.tipe === 'pengeluaran' && (hasId(tx.debtId) || Boolean(legacyName(tx))));

const matchesDebt = (debt, tx) => hasId(targetId(tx))
  ? sameId(debt.id, targetId(tx))
  : text(debt.nama) === text(legacyName(tx)) && isReceivable(debt) === (tx.tipe !== 'pengeluaran');

const matchesLegacyPayment = (debt, payment, tx) => !hasId(payment.txId)
  && matchesDebt(debt, tx)
  && moneyNumber(payment.jml) === moneyNumber(tx.jml)
  && Boolean(payment.tgl && tx.tgl) && payment.tgl === tx.tgl
  && (!hasId(payment.dompetId) || sameId(payment.dompetId, tx.dompetId))
  && (!hasId(payment.goalId) || sameId(payment.goalId, tx.goalId));

const reversePaymentGoal = (goals, tx, debtName) => {
  if (tx.tipe !== 'piutang_masuk_goal') return goals;
  const goal = (goals || []).find(item => sameId(item.id, tx.goalId));
  if (!goal || moneyNumber(goal.kumpul) < moneyNumber(tx.jml)) {
    throw Object.assign(new Error('Dana pengembalian di Goal tidak cukup untuk membatalkan transaksi. Catatan belum dihapus.'), {code:'DEBT_GOAL_FUNDS_UNAVAILABLE'});
  }
  let historyIndices = (goal.history || []).flatMap((entry, index) => hasId(entry.txId) && sameId(entry.txId, tx.id) ? [index] : []);
  if (!historyIndices.length) historyIndices = (goal.history || []).flatMap((entry, index) =>
    !hasId(entry.txId) && entry.tipe === 'pengembalian_piutang' && entry.tgl === tx.tgl
    && moneyNumber(entry.jml) === moneyNumber(tx.jml) && text(entry.ket) === text(`Pengembalian piutang: ${debtName}`) ? [index] : []);
  if (historyIndices.length !== 1) throw failure();
  return goals.map(item => item !== goal ? item : {...goal,
    kumpul:String(moneyNumber(goal.kumpul) - moneyNumber(tx.jml)),
    history:goal.history.filter((_, index) => index !== historyIndices[0]),
  });
};

// Reverse only the installment and Goal effects; wallet reversal stays in the transaction ledger.
export function reverseDebtPayment(state, tx) {
  const unchanged = {utang:state.utang, goals:state.goals};
  if (!isDebtPayment(tx)) return unchanged;
  const debts = state.utang || [];
  const exact = debts.flatMap(debt => (debt.cicilan || []).flatMap((payment, index) =>
    hasId(payment.txId) && sameId(payment.txId, tx.id) ? [{debt, index}] : []));
  let link;
  if (exact.length) {
    if (exact.length !== 1 || (hasId(targetId(tx)) && !sameId(exact[0].debt.id, targetId(tx)))) throw failure();
    link = exact[0];
  } else {
    const candidates = debts.filter(debt => matchesDebt(debt, tx));
    if (!candidates.length) {
      if (!hasId(targetId(tx)) && debts.some(debt => text(debt.nama) === text(legacyName(tx)))) throw failure();
      return {...unchanged, goals:reversePaymentGoal(state.goals, tx, legacyName(tx))};
    }
    const legacy = candidates.flatMap(debt => (debt.cicilan || []).flatMap((payment, index) =>
      matchesLegacyPayment(debt, payment, tx) ? [{debt, index, payment}] : []));
    if (legacy.length !== 1) throw failure();
    link = legacy[0];
    const boundIds = new Set(debts.flatMap(debt => (debt.cicilan || []).filter(payment => hasId(payment.txId)).map(payment => String(payment.txId))));
    const competing = (state.txs || []).filter(other => isDebtPayment(other) && !boundIds.has(String(other.id)) && matchesLegacyPayment(link.debt, link.payment, other));
    if (competing.length !== 1 || !sameId(competing[0].id, tx.id)) throw failure();
  }
  const cicilan = link.debt.cicilan.filter((_, index) => index !== link.index);
  const lunas = cicilan.reduce((sum, payment) => sum + moneyNumber(payment.jml), 0) >= moneyNumber(link.debt.jml);
  const updated = {...link.debt, cicilan, lunas};
  if (text(updated.status) === 'lunas') updated.status = lunas ? 'lunas' : 'aktif';
  const goals = reversePaymentGoal(state.goals, tx, link.debt.nama);
  return {utang:debts.map(debt => debt !== link.debt ? debt : updated), goals};
}
