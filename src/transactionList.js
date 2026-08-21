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

export const moveTransactionWithinDate = (transactions = [], transactionId, direction) => {
  const step = direction === "up" ? -1 : direction === "down" ? 1 : 0;
  if (!step) return transactions;
  const source = transactions.find(transaction => String(transaction?.id) === String(transactionId));
  const date = transactionDateKey(source?.tgl);
  if (!source || !date) return transactions;

  const sameDate = transactions
    .filter(transaction => transactionDateKey(transaction?.tgl) === date)
    .sort(compareTransactionsNewestFirst);
  const currentIndex = sameDate.findIndex(transaction => String(transaction?.id) === String(transactionId));
  const targetIndex = currentIndex + step;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= sameDate.length) return transactions;

  const highestExistingOrder = sameDate.reduce((highest, transaction) => Math.max(highest, numericOrder(transaction?.entryOrder)), 0);
  const anchor = Math.max(Date.now(), highestExistingOrder + sameDate.length + 1);
  const orderById = new Map(sameDate.map((transaction, index) => [String(transaction.id), anchor - index]));
  const current = sameDate[currentIndex];
  const target = sameDate[targetIndex];
  const currentOrder = orderById.get(String(current.id));
  orderById.set(String(current.id), orderById.get(String(target.id)));
  orderById.set(String(target.id), currentOrder);

  return transactions.map(transaction => {
    const nextOrder = orderById.get(String(transaction?.id));
    return nextOrder === undefined ? transaction : { ...transaction, entryOrder:nextOrder };
  });
};
