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
  } else if (tx.tipe === "transfer_internal_keluar") {
    add(tx.dompetId, -amount);
  } else if (tx.tipe === "transfer_internal_masuk") {
    add(tx.dompetId, amount);
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

const normalizedWords = value => String(value || "").toLowerCase()
  .normalize("NFKD")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const TRANSFER_WORDS = /\b(?:transfer|trsf|bi\s*fast|bif|top\s*up|topup|pindah|kiriman|from|dari)\b/i;
const NON_TRANSFER_PAYMENT = /\b(?:qris|pembayaran|payment|purchase|belanja|tarik\s*tunai|withdraw|admin|fee|biaya)\b/i;
const GENERIC_TRANSFER_TOKENS = new Set(["transfer","trsf","fast","bank","dari","from","untuk","kepada","rekening","top","up","bif","ebanking","mobile","wib","idr"]);

const transactionDateDistance = (left, right) => {
  const a = Date.parse(`${left}T00:00:00Z`);
  const b = Date.parse(`${right}T00:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.abs(a - b) / 86400000 : Infinity;
};

const transferDescription = value => TRANSFER_WORDS.test(String(value || "")) && !NON_TRANSFER_PAYMENT.test(String(value || ""));

const descriptionMentionsWallet = (description, wallet) => {
  const text = ` ${normalizedWords(description)} `;
  const walletName = normalizedWords(wallet?.nama);
  if (walletName.length >= 3 && text.includes(` ${walletName} `)) return true;
  return walletName.split(" ").some(word => word.length >= 3 && text.includes(` ${word} `));
};

const meaningfulTokens = description => new Set(normalizedWords(description).split(" ").filter(word =>
  word.length >= 4 && !/^\d+$/.test(word) && !GENERIC_TRANSFER_TOKENS.has(word)
));

const descriptionsOverlap = (left, right) => {
  const a = meaningfulTokens(left);
  return [...meaningfulTokens(right)].some(word => a.has(word));
};

export const pairImportedInternalTransfers = (transactions, wallets = []) => {
  const previousPairs = new Map();
  (transactions || []).forEach(transaction => {
    if (!transaction?.internalTransferPairId) return;
    previousPairs.set(String(transaction.internalTransferPairId), transaction.internalTransferMatchedAt || "");
  });
  const restored = (transactions || []).map(transaction => {
    if (transaction.tipe === "transfer_internal_keluar") {
      const { internalTransferPairId, internalTransferDirection, internalTransferMatchedAt, ...rest } = transaction;
      return { ...rest, tipe:"pengeluaran" };
    }
    if (transaction.tipe === "transfer_internal_masuk") {
      const { internalTransferPairId, internalTransferDirection, internalTransferMatchedAt, ...rest } = transaction;
      return { ...rest, tipe:"pemasukan" };
    }
    return transaction;
  });

  const outgoing = restored.filter(tx => tx.importRef && tx.tipe === "pengeluaran" && transferDescription(tx.ket));
  const incoming = restored.filter(tx => tx.importRef && tx.tipe === "pemasukan" && transferDescription(tx.ket));
  const incomingByAmount = new Map();
  incoming.forEach(transaction => {
    const amount = moneyNumber(transaction.jml);
    const rows = incomingByAmount.get(amount);
    if (rows) rows.push(transaction);
    else incomingByAmount.set(amount,[transaction]);
  });
  const candidates = [];
  for (const out of outgoing) {
    for (const inc of incomingByAmount.get(moneyNumber(out.jml)) || []) {
      if (sameId(out.dompetId, inc.dompetId)) continue;
      const dateDistance = transactionDateDistance(out.tgl, inc.tgl);
      if (dateDistance > 1) continue;
      const outWallet = findWallet(wallets, out.dompetId);
      const inWallet = findWallet(wallets, inc.dompetId);
      const crossWalletHint = descriptionMentionsWallet(inc.ket, outWallet)
        || descriptionMentionsWallet(out.ket, inWallet)
        || descriptionsOverlap(out.ket, inc.ket);
      if (!crossWalletHint) continue;
      candidates.push({out,inc});
    }
  }

  const outCounts = new Map();
  const inCounts = new Map();
  candidates.forEach(({out,inc}) => {
    outCounts.set(String(out.id), (outCounts.get(String(out.id)) || 0) + 1);
    inCounts.set(String(inc.id), (inCounts.get(String(inc.id)) || 0) + 1);
  });
  const accepted = candidates.filter(({out,inc}) => outCounts.get(String(out.id)) === 1 && inCounts.get(String(inc.id)) === 1);
  const pairById = new Map();
  accepted.forEach(({out,inc}) => {
    const pairId = `internal|${String(out.importRef)}|${String(inc.importRef)}`;
    const matchedAt = previousPairs.get(pairId) || new Date().toISOString();
    pairById.set(String(out.id), {pairId,direction:"keluar",matchedAt});
    pairById.set(String(inc.id), {pairId,direction:"masuk",matchedAt});
  });
  const nextTransactions = restored.map(transaction => {
    const pair = pairById.get(String(transaction.id));
    if (!pair) return transaction;
    return {
      ...transaction,
      tipe:pair.direction === "keluar" ? "transfer_internal_keluar" : "transfer_internal_masuk",
      internalTransferPairId:pair.pairId,
      internalTransferDirection:pair.direction,
      internalTransferMatchedAt:pair.matchedAt,
    };
  });
  const newPairCount = accepted.reduce((count,{out,inc}) => {
    const pairId = `internal|${String(out.importRef)}|${String(inc.importRef)}`;
    return count + (previousPairs.has(pairId) ? 0 : 1);
  },0);
  return { transactions:nextTransactions, pairCount:accepted.length, newPairCount };
};

export const reconcileImportedStatement = (existingTransactions, wallets, incomingTransactions, walletId, options = {}) => {
  const normalizedText = value => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  const refParts = transaction => String(transaction?.importRef || "").split("|");
  const incoming = incomingTransactions || [];
  const incomingKeys = new Set(incoming.map(transaction => {
    const parts = refParts(transaction);
    return `${transaction.tgl}|${parts[1] || ""}|${normalizedText(transaction.ket)}`;
  }));
  const shouldReplace = transaction => {
    if (!options.replaceImportedPeriod || !transaction?.importRef) return false;
    const parts = refParts(transaction);
    const samePeriod = transaction.tgl >= options.periodStart && transaction.tgl <= options.periodEnd;
    const sameProvider = String(parts[0] || "").toLowerCase() === String(options.provider || "").toLowerCase();
    const sameRow = incomingKeys.has(`${transaction.tgl}|${parts[1] || ""}|${normalizedText(transaction.ket)}`);
    const legacyOpening = samePeriod && /\b(?:saldo awal|opening balance)\b/i.test(String(transaction.ket || ""));
    return sameId(transaction.dompetId, walletId) && ((sameProvider && samePeriod) || sameRow || legacyOpening);
  };
  const replaced = (existingTransactions || []).filter(shouldReplace);
  const remaining = (existingTransactions || []).filter(transaction => !shouldReplace(transaction));
  const added = uniqueNewTransactions(remaining, incoming);
  const restoredWallets = replaced.reduce((all, transaction) => applyTransactionToWallets(all, transaction, -1), wallets || []);
  let nextWallets = added.reduce((all, transaction) => applyTransactionToWallets(all, transaction), restoredWallets);
  if (options.closingBalance !== null && options.closingBalance !== undefined) {
    nextWallets = nextWallets.map(wallet => sameId(wallet.id, walletId)
      ? { ...wallet, saldo:String(Math.round(Number(options.closingBalance) || 0)) }
      : wallet);
  }
  return { transactions:[...remaining, ...added], wallets:nextWallets, importedCount:added.length, replacedCount:replaced.length };
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
