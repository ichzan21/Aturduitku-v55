export const moneyNumber = value => Number(String(value ?? 0).replace(/\./g, "")) || 0;

export const sameId = (left, right) => String(left ?? "") === String(right ?? "");

export const walletDeltasForTransaction = transaction => {
  const tx = transaction || {};
  const amount = moneyNumber(tx.jml);
  const fee = moneyNumber(tx.biaya);
  const deltas = new Map();
  const add = (walletId, delta) => {
    if (walletId === undefined || walletId === null || walletId === "" || !delta) return;
    const key = String(walletId);
    deltas.set(key, (deltas.get(key) || 0) + delta);
  };

  if (tx.tipe === "transfer") {
    add(tx.dompetId, -amount - fee);
    add(tx.dompetTo, amount);
  } else if (tx.tipe === "pemasukan" || tx.tipe === "pengembalian_amplop") {
    add(tx.dompetId, amount);
  } else if (tx.tipe === "pengeluaran") {
    if (!tx.amplopId) add(tx.dompetId, -amount);
  } else if (["tabungan", "investasi", "alokasi_amplop"].includes(tx.tipe)) {
    add(tx.dompetId, -amount);
  } else if (tx.tipe === "penyesuaian") {
    add(tx.dompetId, moneyNumber(tx.adjustmentDelta));
  }

  return deltas;
};

export const applyTransactionToWallets = (wallets, transaction, direction = 1) => {
  const deltas = walletDeltasForTransaction(transaction);
  return (wallets || []).map(wallet => {
    const delta = deltas.get(String(wallet.id));
    return delta === undefined
      ? wallet
      : { ...wallet, saldo:String(moneyNumber(wallet.saldo) + (delta * direction)) };
  });
};

export const hasWallet = (wallets, walletId) =>
  (wallets || []).some(wallet => sameId(wallet.id, walletId));
