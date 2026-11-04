import { applyTransactionToWallets, moneyNumber, sameId, transactionValidationError } from "./financeLedger.js";
import { budgetsForPeriod } from "./budgetPeriods.js";
import { storeMoney } from './moneyValue.js';

export const recordInvestment = (state, draft) => {
  const error = transactionValidationError(state.dompet, {...draft,tipe:"investasi"});
  if (error) throw new Error(error);
  const budget = budgetsForPeriod(state,String(draft.tgl||'').slice(0,7)).find(item => sameId(item.id, draft.katId));
  if (draft.katId !== "" && !budget) throw new Error("budget_not_found");
  const transaction = {...draft, tipe:"investasi", dompetTo:"", biaya:"", goalId:"", budgetExcluded:false};
  const asset = state.asetTetap.find(item => sameId(item.id, transaction.asetId));
  if (!asset && !String(transaction.ket || "").trim()) throw new Error("asset_name_required");
  return {
    ...state,
    dompet:applyTransactionToWallets(state.dompet, transaction),
    txs:[transaction, ...state.txs],
    asetTetap:asset
      ? state.asetTetap.map(item => sameId(item.id, asset.id)
        ? {...item, nilai:storeMoney(moneyNumber(item.nilai) + moneyNumber(transaction.jml))}
        : item)
      : [...state.asetTetap, {id:transaction.asetId, nama:transaction.ket.trim(), nilai:storeMoney(moneyNumber(transaction.jml)), ket:""}],
  };
};
