const normalizedText = value => String(value || "").trim().toLowerCase();

export const filterTransactionsForList = (transactions = [], filters = {}) => {
  const search = normalizedText(filters.search);
  const walletId = String(filters.walletId ?? "");
  const type = String(filters.type ?? "");

  return [...transactions]
    .filter(transaction => !search || normalizedText(transaction?.ket).includes(search))
    .filter(transaction => !walletId || String(transaction?.dompetId ?? "") === walletId)
    .filter(transaction => {
      if (!type) return true;
      if (type === "transfer_internal") {
        return ["transfer_internal_keluar", "transfer_internal_masuk"].includes(transaction?.tipe);
      }
      return transaction?.tipe === type;
    })
    .sort((left, right) => {
      const rightTime = new Date(right?.tgl || 0).getTime() || 0;
      const leftTime = new Date(left?.tgl || 0).getTime() || 0;
      return rightTime - leftTime;
    });
};
