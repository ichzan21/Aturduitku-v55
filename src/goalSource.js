export const normalizeGoalSourceId = value => value == null ? "" : value;

export const findGoalSourceWallet = (wallets, sourceId) => {
  if (sourceId == null || sourceId === "") return null;
  return (wallets || []).find(wallet => String(wallet.id) === String(sourceId)) || null;
};

export const goalSourceLabel = (wallets, sourceId, fallback = "Belum ditentukan") =>
  findGoalSourceWallet(wallets, sourceId)?.nama || fallback;
