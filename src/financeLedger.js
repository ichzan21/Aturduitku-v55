export const moneyNumber = value => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? "").trim().replace(/[^\d-]/g, "");
  if (!normalized || normalized === "-") return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

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

export const findWallet = (wallets, walletId) =>
  (wallets || []).find(wallet => sameId(wallet.id, walletId));

export const transactionValidationError = (wallets, transaction, options = {}) => {
  const tx = transaction || {};
  const amount = moneyNumber(tx.jml);
  const fee = moneyNumber(tx.biaya);
  const source = findWallet(wallets, tx.dompetId);

  if (tx.tipe !== "penyesuaian" && amount <= 0) return "invalid_amount";
  if (fee < 0) return "invalid_amount";
  if (!source && walletDeltasForTransaction(tx).size) return "wallet_not_found";

  if (tx.tipe === "transfer") {
    const destination = findWallet(wallets, tx.dompetTo);
    if (!destination) return "wallet_not_found";
    if (sameId(tx.dompetId, tx.dompetTo)) return "same_wallet";
    if (options.requireFunds !== false && moneyNumber(source?.saldo) < amount + fee) return "insufficient_funds";
  } else if (["pengeluaran", "tabungan", "investasi", "alokasi_amplop"].includes(tx.tipe)) {
    if (!tx.amplopId && options.requireFunds !== false && moneyNumber(source?.saldo) < amount) {
      return "insufficient_funds";
    }
  }

  return "";
};

export const transactionFingerprint = transaction => {
  const tx = transaction || {};
  if (tx.importRef) return `import|${String(tx.importRef)}`;
  return [
    String(tx.tgl || ""),
    String(tx.tipe || "").toLowerCase(),
    moneyNumber(tx.jml),
    String(tx.ket || "").trim().toLowerCase().replace(/\s+/g, " "),
    String(tx.dompetId ?? ""),
    String(tx.dompetTo ?? ""),
  ].join("|");
};

export const uniqueNewTransactions = (existing, incoming) => {
  const seen = new Set((existing || []).map(transactionFingerprint));
  return (incoming || []).filter(transaction => {
    const fingerprint = transactionFingerprint(transaction);
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
};

export const replaceTransactionInWallets = (wallets, previousTransaction, nextTransaction) => {
  const restoredWallets = applyTransactionToWallets(wallets, previousTransaction, -1);
  const validationError = transactionValidationError(restoredWallets, nextTransaction);
  if (validationError) {
    const error = new Error(validationError);
    error.code = validationError;
    throw error;
  }
  return applyTransactionToWallets(restoredWallets, nextTransaction);
};
