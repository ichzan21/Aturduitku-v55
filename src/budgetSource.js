export const normalizeBudgetSourceId = value => value == null ? "" : value;

export const findBudgetSourceWallet = (wallets, sourceId) => {
  if (sourceId == null || sourceId === "") return null;
  return (wallets || []).find(wallet => String(wallet.id) === String(sourceId)) || null;
};

export const budgetSourceLabel = (wallets, sourceId, fallback = "Semua dompet") =>
  findBudgetSourceWallet(wallets, sourceId)?.nama || fallback;
