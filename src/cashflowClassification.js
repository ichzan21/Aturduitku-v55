export const isGoalFundUsage = transaction =>
  transaction?.tipe === "pengeluaran" && Boolean(transaction?.goalSpendId);

export const isCashflowExpense = transaction =>
  transaction?.tipe === "pengeluaran" && !isGoalFundUsage(transaction);

export const sumGoalFundUsage = (transactions = [], numberValue = Number) =>
  transactions
    .filter(isGoalFundUsage)
    .reduce((total, transaction) => total + Number(numberValue(transaction?.jml) || 0), 0);
