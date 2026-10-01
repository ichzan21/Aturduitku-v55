import { moneyNumber, sameId } from "./financeLedger.js";

const normalizedName = value => String(value || "").trim().toLowerCase();

export const getBillPayment = (transactions, budget, subcategory, subIndex, period) => {
  const reference = `${budget.id}:${subIndex}`;
  const payments = transactions.filter(transaction => {
    if (transaction.tipe !== "pengeluaran" || moneyNumber(transaction.jml) <= 0) return false;
    if (String(transaction.tgl || "").slice(0, 7) !== period) return false;
    const matchingName = normalizedName(transaction.subKat) === normalizedName(subcategory.nama);
    if (transaction.billRef) {
      return transaction.billRef === reference && (!transaction.subKat || matchingName);
    }
    return sameId(transaction.katId, budget.id) && matchingName;
  });
  const amount = payments.reduce((sum, transaction) => sum + moneyNumber(transaction.jml), 0);
  const explicitlyPaid = payments.some(transaction => transaction.billRef === reference);
  return { amount, paid: explicitlyPaid || (amount > 0 && amount >= moneyNumber(subcategory.alokasi)), transactionId: payments[0]?.id || null };
};
