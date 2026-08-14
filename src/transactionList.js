const normalizedText = value => String(value || "").trim().toLowerCase();

const numericOrder = value => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const timestampOrder = value => {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const compareTransactionsNewestFirst = (left, right) => {
  const dateDelta = timestampOrder(right?.tgl) - timestampOrder(left?.tgl);
  if (dateDelta !== 0) return dateDelta;
  const explicitOrderDelta = numericOrder(right?.entryOrder) - numericOrder(left?.entryOrder);
  if (explicitOrderDelta !== 0) return explicitOrderDelta;
  const createdDelta = timestampOrder(right?.createdAt) - timestampOrder(left?.createdAt);
  if (createdDelta !== 0) return createdDelta;
  const idDelta = numericOrder(right?.id) - numericOrder(left?.id);
  if (idDelta !== 0) return idDelta;
  return String(right?.id || "").localeCompare(String(left?.id || ""));
};

const transactionDateKey = value => String(value || "").slice(0, 10);

export const getHighestExpenseDay = (transactions = [], numberValue = Number) => {
  const grouped = new Map();
  transactions.forEach(transaction => {
    if (transaction?.tipe !== "pengeluaran") return;
    const date = transactionDateKey(transaction?.tgl);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const current = grouped.get(date) || { date, amount:0, count:0 };
    current.amount += Number(numberValue(transaction?.jml) || 0);
    current.count += 1;
    grouped.set(date, current);
  });
  return [...grouped.values()].sort((left, right) => right.amount - left.amount || right.date.localeCompare(left.date))[0] || null;
};

export const filterTransactionsForList = (transactions = [], filters = {}) => {
  const search = normalizedText(filters.search);
  const walletId = String(filters.walletId ?? "");
  const type = String(filters.type ?? "");
  const startDate = transactionDateKey(filters.startDate);
  const endDate = transactionDateKey(filters.endDate);

  return [...transactions]
    .filter(transaction => !search || normalizedText(transaction?.ket).includes(search))
    .filter(transaction => !walletId || String(transaction?.dompetId ?? "") === walletId)
    .filter(transaction => {
      const date = transactionDateKey(transaction?.tgl);
      if (startDate && (!date || date < startDate)) return false;
      if (endDate && (!date || date > endDate)) return false;
      return true;
    })
    .filter(transaction => {
      if (!type) return true;
      if (type === "transfer_internal") {
        return ["transfer_internal_keluar", "transfer_internal_masuk"].includes(transaction?.tipe);
      }
      return transaction?.tipe === type;
    })
    .sort(compareTransactionsNewestFirst);
};
