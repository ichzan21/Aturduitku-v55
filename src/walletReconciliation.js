import { applyTransactionToWallets, findWallet, moneyNumber, walletDeltasForTransaction } from "./financeLedger.js";
import { roundMoney, storeMoney } from './moneyValue.js';

export const validBalanceDate = (date, today) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date && date <= today;
};

export const walletBalanceAtDate = (wallet, transactions, date) => {
  const laterDelta = (transactions || []).filter(tx => tx.tgl && tx.tgl > date)
    .reduce((sum, tx) => sum + (walletDeltasForTransaction(tx).get(String(wallet?.id)) || 0), 0);
  return roundMoney(moneyNumber(wallet?.saldo) - laterDelta);
};

export function reconcileWalletBalance(state, { walletId, actual, date, today, id }) {
  const wallet = findWallet(state.dompet, walletId);
  if (!wallet) return { error:"Pilih dompet yang masih tersedia." };
  if (!validBalanceDate(date, today)) return { error:"Pilih tanggal saldo yang valid, tidak melebihi hari ini." };
  if (!/^(?:\d+(?:[.,]\d{1,3})?|\d{1,3}(?:\.\d{3})+(?:,\d{1,3})?)$/.test(String(actual ?? "").trim())) return { error:"Isi saldo sebenarnya yang valid." };
  const amount = moneyNumber(actual);
  if (!Number.isSafeInteger(Math.round(amount*1000))) return { error:"Nominal saldo terlalu besar atau tidak valid." };
  const difference = roundMoney(amount - walletBalanceAtDate(wallet, state.txs, date));
  if (!difference) return { state, transaction:null };
  const transaction = { id, tipe:"penyesuaian", tgl:date, ket:`Cocokkan saldo: ${wallet.nama}`,
    jml:storeMoney(Math.abs(difference)), adjustmentDelta:difference, dompetId:wallet.id, bulan:state.bulan, tahun:state.tahun };
  return { transaction, state:{ ...state, dompet:applyTransactionToWallets(state.dompet, transaction), txs:[transaction, ...state.txs] } };
}
